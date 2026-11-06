from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

NETWORK = {
    "name": f"pytest-network-{uuid4()}",
    "description": "API test network",
    "graph": {
        "nodes": [{"id": "a", "x": 0.1, "y": 0.5}, {"id": "b", "x": 0.9, "y": 0.5}],
        "roads": [{
            "id": "road-a-b", "from": "a", "to": "b", "kind": "straight",
            "direction": "two-way", "length": 100, "width": 10, "lanes": 2,
            "capacity": 1200, "speedLimit": 50,
        }],
    },
}

SCENARIO = {
    "name": f"pytest-scenario-{uuid4()}",
    "description": "API test scenario",
    "config": {
        "demand_level": "low", "spawn_rate": 10,
        "vehicle_mix": {"car": 100}, "signal_cycle": 20,
        "road_settings": {}, "duration": 30, "seed": 9,
    },
}

METRICS = {
    "total_vehicles_generated": 10, "vehicles_completed": 8,
    "average_vehicle_speed": 12.5, "average_waiting_time": 2,
    "average_travel_time": 10, "maximum_queue_length": 3,
    "road_utilization": 25, "congestion_percentage": 20, "throughput": 0.4,
}

def test_network_scenario_and_simulation_api():
    with TestClient(app) as client:
        network_response = client.post("/api/networks", json=NETWORK)
        assert network_response.status_code == 201
        network = network_response.json()
        network_id = network["id"]
        assert client.get(f"/api/networks/{network_id}").status_code == 200
        updated = {**NETWORK, "description": "updated"}
        assert client.put(f"/api/networks/{network_id}", json=updated).status_code == 200
        assert client.get("/api/networks?page=1&page_size=1").json()["total"] >= 1

        scenario_response = client.post("/api/scenarios", json=SCENARIO)
        assert scenario_response.status_code == 201
        scenario = scenario_response.json()
        scenario_id = scenario["id"]
        assert client.get(f"/api/scenarios/{scenario_id}").json()["config"]["seed"] == 9

        simulation_payload = {"scenario_id": scenario_id, "network_id": network_id, "duration": 30, "metrics": METRICS}
        first = client.post("/api/simulations", json=simulation_payload)
        second = client.post("/api/simulations", json={**simulation_payload, "metrics": {**METRICS, "throughput": 0.6}})
        assert first.status_code == 201
        assert second.status_code == 201
        first_id = first.json()["id"]
        second_id = second.json()["id"]
        assert client.get(f"/api/simulations/{first_id}").json()["status"] == "completed"
        assert client.get(f"/api/simulations/{first_id}/metrics").json()["throughput"] == 0.4
        comparison = client.get(f"/api/simulations/compare?first_id={first_id}&second_id={second_id}")
        assert comparison.status_code == 200
        assert comparison.json()["differences"]["throughput"] == -0.2

        assert client.delete(f"/api/networks/{network_id}").status_code == 204
        assert client.get(f"/api/networks/{network_id}").status_code == 404

def test_api_validation_and_missing_records():
    with TestClient(app) as client:
        invalid = client.post("/api/networks", json={"name": "bad", "graph": {"nodes": [], "roads": [{"id": "r", "from": "x", "to": "y", "length": 0, "width": 1, "lanes": 1, "capacity": 1, "speedLimit": 1}]}})
        assert invalid.status_code == 422
        assert client.get("/api/scenarios/999999").status_code == 404
        assert client.get("/api/simulations/999999/metrics").status_code == 404
