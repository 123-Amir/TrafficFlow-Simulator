import { describe, expect, it } from 'vitest';
import { SAMPLE_NETWORK } from './roadNetwork';
import { demandRate, runScenario } from './scenarios';

describe('scenario execution', () => {
  it('maps demand presets to real spawn rates', () => {
    expect(demandRate('low')).toBeLessThan(demandRate('medium'));
    expect(demandRate('high')).toBeGreaterThan(demandRate('medium'));
  });
  it('produces reproducible completed-run metrics from the engine', () => {
    const config = { demand_level: 'high' as const, spawn_rate: 120, vehicle_mix: { car: 100 }, signal_cycle: 20, road_settings: {}, duration: 30, seed: 4 };
    const first = runScenario(SAMPLE_NETWORK, config);
    const second = runScenario(SAMPLE_NETWORK, config);
    expect(first).toEqual(second);
    expect(first.total_vehicles_generated).toBeGreaterThan(0);
    expect(Number.isFinite(first.throughput)).toBe(true);
  });
});
