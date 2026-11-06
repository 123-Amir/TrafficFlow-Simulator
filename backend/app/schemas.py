from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

VehicleType = Literal["car", "bus", "truck", "motorcycle"]
DemandLevel = Literal["low", "medium", "high"]
RoadDirection = Literal["one-way", "two-way"]
RoadKind = Literal["straight", "junction", "flyover"]

class RoadNode(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)

class Road(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    from_node: str = Field(alias="from", min_length=1, max_length=80)
    to_node: str = Field(alias="to", min_length=1, max_length=80)
    kind: RoadKind = "straight"
    direction: RoadDirection = "two-way"
    length: float = Field(gt=0)
    width: float = Field(gt=0)
    lanes: int = Field(ge=1)
    capacity: float = Field(gt=0)
    speed_limit: float = Field(alias="speedLimit", gt=0)
    model_config = ConfigDict(populate_by_name=True)

class NetworkGraph(BaseModel):
    nodes: list[RoadNode] = Field(default_factory=list)
    roads: list[Road] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_graph(self):
        node_ids = {node.id for node in self.nodes}
        road_ids: set[str] = set()
        for road in self.roads:
            if road.id in road_ids:
                raise ValueError(f"duplicate road id: {road.id}")
            road_ids.add(road.id)
            if road.from_node not in node_ids or road.to_node not in node_ids:
                raise ValueError(f"road {road.id} references a missing node")
            if road.from_node == road.to_node:
                raise ValueError(f"road {road.id} cannot connect a node to itself")
        return self

class NetworkCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    graph: NetworkGraph

class NetworkResponse(NetworkCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ScenarioConfig(BaseModel):
    demand_level: DemandLevel = "medium"
    spawn_rate: float = Field(60, ge=0)
    vehicle_mix: dict[VehicleType, float] = Field(default_factory=lambda: {"car": 70, "bus": 10, "truck": 10, "motorcycle": 10})
    signal_cycle: float = Field(20, gt=0)
    road_settings: dict[str, dict[str, float]] = Field(default_factory=dict)
    duration: float = Field(60, gt=0)
    seed: int = 1

    @model_validator(mode="after")
    def validate_mix(self):
        if any(value < 0 for value in self.vehicle_mix.values()):
            raise ValueError("vehicle mix values cannot be negative")
        if self.vehicle_mix and sum(self.vehicle_mix.values()) <= 0:
            raise ValueError("vehicle mix must contain a positive value")
        return self

class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    config: ScenarioConfig

class ScenarioResponse(ScenarioCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class RunCreate(BaseModel):
    metrics: dict[str, float]

class RunResponse(RunCreate):
    id: int
    scenario_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MetricsSummary(BaseModel):
    total_vehicles_generated: float = Field(ge=0)
    vehicles_completed: float = Field(ge=0)
    average_vehicle_speed: float = Field(ge=0)
    average_waiting_time: float = Field(ge=0)
    average_travel_time: float = Field(ge=0)
    maximum_queue_length: float = Field(ge=0)
    road_utilization: float = Field(ge=0, le=100)
    congestion_percentage: float = Field(ge=0, le=100)
    throughput: float = Field(ge=0)

class SimulationCreate(BaseModel):
    scenario_id: int = Field(gt=0)
    network_id: int = Field(gt=0)
    duration: float = Field(gt=0)
    metrics: MetricsSummary

class SimulationResponse(SimulationCreate):
    id: int
    status: Literal["completed"]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SimulationCompareResponse(BaseModel):
    first: SimulationResponse
    second: SimulationResponse
    differences: dict[str, float]

class ScenarioListResponse(BaseModel):
    items: list[ScenarioResponse]
    page: int
    page_size: int
    total: int

class NetworkListResponse(BaseModel):
    items: list[NetworkResponse]
    page: int
    page_size: int
    total: int
