# TrafficFlow Simulator architecture

```text
React UI
  ├─ Road Network Editor ── Network graph state ── local save/load
  ├─ Simulation Canvas ──── TrafficSimulationEngine ── telemetry
  ├─ Analytics Dashboard ── analytics.ts ───────────── charts/tables
  └─ Scenario Manager ───── api.ts ─────────────────── scenario/run API

FastAPI
  ├─ /api/networks
  ├─ /api/scenarios
  └─ /api/simulations
        └─ SQLAlchemy ── SQLite (configuration + completed summaries only)
```

The simulation engine is independent from React and Canvas rendering. It advances on a deterministic fixed timestep and exposes state/telemetry snapshots. The Canvas schedules rendering with `requestAnimationFrame`; it does not calculate vehicle movement.

SQLite stores network graphs, scenario configurations, and completed simulation summaries. Animation frames and active vehicle state remain in memory.
