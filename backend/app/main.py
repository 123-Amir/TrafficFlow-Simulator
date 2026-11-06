import logging
import os
import time
from contextlib import asynccontextmanager
from collections.abc import Generator

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .database import Network, Scenario, SessionLocal, Simulation, SimulationRun, engine, init_db
from .schemas import (
    NetworkCreate,
    NetworkListResponse,
    NetworkResponse,
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioResponse,
    RunCreate,
    RunResponse,
    SimulationCompareResponse,
    SimulationCreate,
    SimulationResponse,
)

logger = logging.getLogger("trafficflow.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="TrafficFlow Simulator API",
    version="0.2.0",
    description="Persistence and completed-run APIs for TrafficFlow Simulator.",
    lifespan=lifespan,
)
allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    logger.info(
        "API request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        },
    )
    return response


@app.exception_handler(Exception)
def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error", extra={"path": request.url.path, "method": request.method})
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(RequestValidationError)
def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.info("Invalid API request", extra={"path": request.url.path, "method": request.method})
    return JSONResponse(status_code=422, content={"detail": "Request validation failed", "errors": exc.errors()})


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def not_found(resource: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} not found")


def page_bounds(page: int, page_size: int) -> tuple[int, int]:
    return (page - 1) * page_size, page_size


def commit_or_conflict(db: Session, resource: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.info("Duplicate resource rejected", extra={"resource": resource})
        raise HTTPException(status_code=409, detail=f"{resource} already exists")
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database transaction failed", extra={"resource": resource})
        raise HTTPException(status_code=500, detail="Unable to save resource")


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(select(1))
        return {"status": "ok"}
    except SQLAlchemyError:
        logger.exception("Health check database failure")
        raise HTTPException(status_code=503, detail="Service unavailable")


@app.get("/api/networks", response_model=NetworkListResponse, tags=["networks"])
def list_networks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> NetworkListResponse:
    total = db.scalar(select(func.count()).select_from(Network)) or 0
    offset, limit = page_bounds(page, page_size)
    items = list(db.scalars(select(Network).order_by(Network.updated_at.desc()).offset(offset).limit(limit)))
    return NetworkListResponse(items=items, page=page, page_size=page_size, total=total)


@app.post("/api/networks", response_model=NetworkResponse, status_code=201, tags=["networks"])
def create_network(payload: NetworkCreate, db: Session = Depends(get_db)) -> Network:
    network = Network(name=payload.name, description=payload.description, graph=payload.graph.model_dump(by_alias=True))
    db.add(network)
    commit_or_conflict(db, "Network")
    db.refresh(network)
    return network


@app.get("/api/networks/{network_id}", response_model=NetworkResponse, tags=["networks"])
def get_network(network_id: int, db: Session = Depends(get_db)) -> Network:
    network = db.get(Network, network_id)
    if not network:
        raise not_found("Network")
    return network


@app.put("/api/networks/{network_id}", response_model=NetworkResponse, tags=["networks"])
def update_network(network_id: int, payload: NetworkCreate, db: Session = Depends(get_db)) -> Network:
    network = db.get(Network, network_id)
    if not network:
        raise not_found("Network")
    network.name = payload.name
    network.description = payload.description
    network.graph = payload.graph.model_dump(by_alias=True)
    commit_or_conflict(db, "Network")
    db.refresh(network)
    return network


@app.delete("/api/networks/{network_id}", status_code=204, tags=["networks"])
def delete_network(network_id: int, db: Session = Depends(get_db)) -> None:
    network = db.get(Network, network_id)
    if not network:
        raise not_found("Network")
    db.delete(network)
    commit_or_conflict(db, "Network")


@app.get("/api/scenarios", response_model=ScenarioListResponse, tags=["scenarios"])
def list_scenarios(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ScenarioListResponse:
    total = db.scalar(select(func.count()).select_from(Scenario)) or 0
    offset, limit = page_bounds(page, page_size)
    items = list(db.scalars(select(Scenario).order_by(Scenario.updated_at.desc()).offset(offset).limit(limit)))
    return ScenarioListResponse(items=items, page=page, page_size=page_size, total=total)


@app.post("/api/scenarios", response_model=ScenarioResponse, status_code=201, tags=["scenarios"])
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)) -> Scenario:
    scenario = Scenario(name=payload.name, description=payload.description, config=payload.config.model_dump())
    db.add(scenario)
    commit_or_conflict(db, "Scenario")
    db.refresh(scenario)
    return scenario


@app.put("/api/scenarios/{scenario_id}", response_model=ScenarioResponse, tags=["scenarios"])
def update_scenario(scenario_id: int, payload: ScenarioCreate, db: Session = Depends(get_db)) -> Scenario:
    scenario = db.get(Scenario, scenario_id)
    if not scenario:
        raise not_found("Scenario")
    scenario.name = payload.name
    scenario.description = payload.description
    scenario.config = payload.config.model_dump()
    commit_or_conflict(db, "Scenario")
    db.refresh(scenario)
    return scenario


@app.get("/api/scenarios/{scenario_id}", response_model=ScenarioResponse, tags=["scenarios"])
def get_scenario(scenario_id: int, db: Session = Depends(get_db)) -> Scenario:
    scenario = db.get(Scenario, scenario_id)
    if not scenario:
        raise not_found("Scenario")
    return scenario


@app.delete("/api/scenarios/{scenario_id}", status_code=204, tags=["scenarios"])
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)) -> None:
    scenario = db.get(Scenario, scenario_id)
    if not scenario:
        raise not_found("Scenario")
    db.delete(scenario)
    commit_or_conflict(db, "Scenario")


@app.post("/api/scenarios/{scenario_id}/runs", response_model=RunResponse, status_code=201, tags=["scenarios"])
def create_scenario_run(scenario_id: int, payload: RunCreate, db: Session = Depends(get_db)) -> SimulationRun:
    if not db.get(Scenario, scenario_id):
        raise not_found("Scenario")
    run = SimulationRun(scenario_id=scenario_id, metrics=payload.metrics)
    db.add(run)
    commit_or_conflict(db, "Scenario run")
    db.refresh(run)
    return run


@app.get("/api/scenarios/{scenario_id}/runs", response_model=list[RunResponse], tags=["scenarios"])
def list_scenario_runs(scenario_id: int, db: Session = Depends(get_db)) -> list[SimulationRun]:
    if not db.get(Scenario, scenario_id):
        raise not_found("Scenario")
    return list(db.scalars(select(SimulationRun).where(SimulationRun.scenario_id == scenario_id).order_by(SimulationRun.created_at.desc())))


@app.post("/api/simulations", response_model=SimulationResponse, status_code=201, tags=["simulations"])
def create_simulation(payload: SimulationCreate, db: Session = Depends(get_db)) -> Simulation:
    if not db.get(Scenario, payload.scenario_id):
        raise not_found("Scenario")
    if not db.get(Network, payload.network_id):
        raise not_found("Network")
    simulation = Simulation(
        scenario_id=payload.scenario_id,
        network_id=payload.network_id,
        duration=payload.duration,
        metrics=payload.metrics.model_dump(),
        status="completed",
    )
    db.add(simulation)
    commit_or_conflict(db, "Simulation")
    db.refresh(simulation)
    return simulation


@app.get("/api/simulations/compare", response_model=SimulationCompareResponse, tags=["simulations"])
def compare_simulations(
    first_id: int = Query(..., gt=0),
    second_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
) -> SimulationCompareResponse:
    first = db.get(Simulation, first_id)
    second = db.get(Simulation, second_id)
    if not first or not second:
        raise not_found("Simulation")
    differences = {
        key: round(float(first.metrics.get(key, 0)) - float(second.metrics.get(key, 0)), 12)
        for key in first.metrics
    }
    return SimulationCompareResponse(first=first, second=second, differences=differences)


@app.get("/api/simulations/{simulation_id}", response_model=SimulationResponse, tags=["simulations"])
def get_simulation(simulation_id: int, db: Session = Depends(get_db)) -> Simulation:
    simulation = db.get(Simulation, simulation_id)
    if not simulation:
        raise not_found("Simulation")
    return simulation


@app.get("/api/simulations/{simulation_id}/metrics", response_model=dict[str, float], tags=["simulations"])
def get_simulation_metrics(simulation_id: int, db: Session = Depends(get_db)) -> dict[str, float]:
    simulation = db.get(Simulation, simulation_id)
    if not simulation:
        raise not_found("Simulation")
    return simulation.metrics
