import { describe, expect, it } from 'vitest';
import { SAMPLE_NETWORK } from './roadNetwork';
import { TrafficSimulationEngine } from './simulation';

describe('TrafficSimulationEngine', () => {
  it('spawns deterministic independent agents and advances them', () => {
    const config = { seed: 7, demand: { perMinute: 600 }, maxVehicles: 10 };
    const first = new TrafficSimulationEngine(SAMPLE_NETWORK, config);
    const second = new TrafficSimulationEngine(SAMPLE_NETWORK, config);
    for (let index = 0; index < 20; index += 1) { first.step(.05); second.step(.05); }
    const firstState = first.getState(); const secondState = second.getState();
    expect(firstState.vehicles.length).toBeGreaterThan(0);
    expect(firstState.vehicles.map(vehicle => vehicle.id)).toEqual(secondState.vehicles.map(vehicle => vehicle.id));
    expect(firstState.vehicles.map(vehicle => vehicle.currentRoad)).toEqual(secondState.vehicles.map(vehicle => vehicle.currentRoad));
    expect(new Set(firstState.vehicles.map(vehicle => vehicle.id)).size).toBe(firstState.vehicles.length);
    expect(firstState.vehicles.some(vehicle => vehicle.position > 0)).toBe(true);
  });

  it('stops vehicles at a red junction signal', () => {
    const engine = new TrafficSimulationEngine(SAMPLE_NETWORK, { seed: 2, demand: { perMinute: 1200 }, maxVehicles: 5, safeDistance: 4 });
    for (let index = 0; index < 10; index += 1) engine.step(.05);
    const state = engine.getState();
    const vehicle = state.vehicles[0];
    expect(vehicle).toBeDefined();
    SAMPLE_NETWORK.nodes.forEach(node => engine.setSignalOverride(node.id, 'red'));
    for (let index = 0; index < 1000; index += 1) engine.step(.05);
    const stopped = engine.getState().vehicles.find(item => item.id === vehicle.id);
    expect(stopped).toBeDefined();
    expect(stopped!.position).toBeLessThanOrEqual(SAMPLE_NETWORK.roads.find(road => road.id === stopped!.currentRoad)!.length);
    expect(stopped!.speed).toBe(0);
  });

  it('does not overlap agents sharing a road and direction', () => {
    const engine = new TrafficSimulationEngine(SAMPLE_NETWORK, { seed: 3, demand: { perMinute: 2400 }, maxVehicles: 20, safeDistance: 8 });
    for (let index = 0; index < 200; index += 1) engine.step(.05);
    const vehicles = engine.getState().vehicles;
    for (const vehicle of vehicles) {
      for (const other of vehicles) {
        if (vehicle.id === other.id || vehicle.currentRoad !== other.currentRoad || vehicle.direction !== other.direction) continue;
        const distance = Math.abs(vehicle.position - other.position);
        expect(distance).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('resets to the same seeded sequence', () => {
    const engine = new TrafficSimulationEngine(SAMPLE_NETWORK, { seed: 11, demand: { perMinute: 600 }, maxVehicles: 10 });
    for (let index = 0; index < 20; index += 1) engine.step(.05);
    const beforeReset = engine.getState().vehicles.map(vehicle => `${vehicle.id}:${vehicle.currentRoad}:${vehicle.position.toFixed(3)}`);
    engine.reset();
    for (let index = 0; index < 20; index += 1) engine.step(.05);
    expect(engine.getState().vehicles.map(vehicle => `${vehicle.id}:${vehicle.currentRoad}:${vehicle.position.toFixed(3)}`)).toEqual(beforeReset);
  });
});
