# TrafficFlow Simulator

TrafficFlow Simulator is a foundation for an agent-based traffic simulation platform. The first phase provides a responsive React dashboard, a Canvas visualization surface, navigation for the core workspaces, and a FastAPI/SQLite service boundary. It intentionally does not fabricate simulation or analytics results: metrics remain empty until a real simulation engine is connected.

## Architecture

- **Frontend:** React + TypeScript + Vite. `src/components` contains reusable layout, visualization, stat, and empty-state components. `src/api.ts` is the backend boundary.
- **Visualization:** HTML Canvas in `TrafficCanvas`. It renders only supplied road-network data. The Road Network workspace adds select, add-road, add-junction, pan, and zoom tools.
- **Road graph:** `src/roadNetwork.ts` contains the sample graph, connectivity checks, endpoint/property validation, and local save/load boundaries. Nodes are junctions; edges are road segments.
- **Simulation engine:** `src/simulation.ts` is a deterministic, seeded agent-based engine. It owns vehicle spawning, routing, following distance, signals, entry/exit, and fixed-step updates. `SimulationCanvas` consumes engine state and only handles requestAnimationFrame scheduling and drawing.
- **Scenarios:** The Scenario workspace persists validated scenario configurations and completed-run metrics through the FastAPI SQLite API. Runs execute the real deterministic engine before their metrics are stored.
- **Backend:** FastAPI in `backend/app`, with SQLAlchemy-managed SQLite initialization and `/api` endpoints for health, networks, scenarios, and completed simulation summaries.
- **Testing:** Vitest covers graph, engine, analytics, scenario, and Canvas behavior; Pytest covers API validation, persistence, pagination, missing records, comparisons, and health.

## Setup

### Frontend

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. Set `VITE_API_URL` in `.env` when the API is hosted elsewhere. See [.env.production.example](<./.env.production.example>) for production configuration.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API runs at `http://localhost:8000`; health is available at `/health`.

The documented API is exposed under `/api`:

- `GET /api/health`
- Network CRUD: `GET/POST /api/networks`, `GET/PUT/DELETE /api/networks/{id}`
- Scenario reads/creation: `GET/POST /api/scenarios`, `GET /api/scenarios/{id}`
- Completed summaries: `POST /api/simulations`, `GET /api/simulations/{id}`, `GET /api/simulations/{id}/metrics`
- Comparison: `GET /api/simulations/compare?first_id={id}&second_id={id}`

Collection responses support `page` and `page_size` pagination. FastAPI's generated documentation is available at `/docs`.

### Environment variables

Frontend:

- `VITE_API_URL`: absolute backend API origin, for example `http://localhost:8000`.

Backend:

- `DATABASE_URL`: SQLAlchemy database URL. Defaults to a local SQLite file.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.


## Tests

```bash
npm test
cd backend
pytest
```

## Analytics definitions

The Analytics workspace reads telemetry emitted by the deterministic simulation session; it does not generate placeholder results.

- **Vehicles generated:** agents successfully admitted to the network.
- **Vehicles completed:** agents that reached their destination and exited the network.
- **Average vehicle speed:** mean instantaneous speed from the latest live sample.
- **Average waiting time:** mean time spent stopped by completed vehicles.
- **Average travel time:** mean simulation duration from spawn to destination for completed vehicles.
- **Maximum queue length:** largest sampled number of stopped vehicles approaching any junction.
- **Road utilization:** average sampled road vehicle count divided by that road's per-minute capacity estimate (`capacity / 60`), capped at 100%.
- **Congestion percentage:** live reduction from average sampled speed relative to the network's mean speed limit.
- **Throughput:** completed vehicles divided by elapsed simulation seconds.

Live metrics include active vehicles and the latest sample. Completed-run metrics only include vehicles that have exited; they remain zero when no vehicle has completed.

## Known limitations

- Server-side simulation execution is not implemented; the client executes deterministic runs and persists completed summaries through the API.
- Editor configurations are saved in browser local storage until a network is explicitly saved through the API.
- Dashboard values are explicit empty states, not placeholder results.
- SQLite is initialized on startup and stores network graphs, scenario configurations, and completed simulation summaries.
- Vehicle movement is implemented in the client-side engine; server-side simulation execution is not implemented.
- Scenario execution currently uses the sample network; selecting a persisted road-network configuration is planned for a later phase.
- The API stores only completed simulation summaries and never stores animation frames.
