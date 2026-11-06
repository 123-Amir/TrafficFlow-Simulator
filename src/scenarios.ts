import { calculateMetrics } from './analytics';
import type { SimulationConfig, VehicleType } from './simulation';
import { TrafficSimulationEngine } from './simulation';
import type { Network } from './types';

export type DemandLevel = 'low' | 'medium' | 'high';
export interface ScenarioConfig {
  demand_level: DemandLevel;
  spawn_rate: number;
  vehicle_mix: Partial<Record<VehicleType, number>>;
  signal_cycle: number;
  road_settings: Record<string, { width?: number; lanes?: number; speed_limit?: number; capacity?: number }>;
  duration: number;
  seed: number;
}
export interface Scenario { id: number; name: string; description: string; config: ScenarioConfig; created_at: string; updated_at: string; }
export interface ScenarioRun { id: number; scenario_id: number; metrics: Record<string, number>; created_at: string; }

export const DEFAULT_SCENARIO: ScenarioConfig = {
  demand_level: 'medium', spawn_rate: 60, vehicle_mix: { car: 70, bus: 10, truck: 10, motorcycle: 10 },
  signal_cycle: 20, road_settings: {}, duration: 60, seed: 1,
};

export function demandRate(level: DemandLevel): number {
  return level === 'low' ? 30 : level === 'high' ? 120 : 60;
}

export function runScenario(network: Network, config: ScenarioConfig): Record<string, number> {
  const configuredNetwork: Network = {
    ...network,
    roads: network.roads.map(road => {
      const settings = config.road_settings[road.id] ?? {};
      return { ...road, width: settings.width ?? road.width, lanes: settings.lanes ?? road.lanes, capacity: settings.capacity ?? road.capacity, speedLimit: settings.speed_limit ?? road.speedLimit };
    }),
  };
  const engineConfig: Partial<SimulationConfig> = { seed: config.seed, signalCycle: config.signal_cycle, demand: { perMinute: config.spawn_rate, vehicleMix: config.vehicle_mix }, maxVehicles: 1000 };
  const engine = new TrafficSimulationEngine(configuredNetwork, engineConfig);
  const steps = Math.ceil(config.duration / (engineConfig.fixedStep ?? 1 / 20));
  for (let index = 0; index < steps; index += 1) engine.step(engineConfig.fixedStep ?? 1 / 20);
  const telemetry = engine.getTelemetry();
  const metrics = calculateMetrics(telemetry, configuredNetwork);
  return {
    total_vehicles_generated: metrics.totalVehiclesGenerated,
    vehicles_completed: metrics.vehiclesCompleted,
    average_vehicle_speed: metrics.averageVehicleSpeed,
    average_waiting_time: metrics.averageWaitingTime,
    average_travel_time: metrics.averageTravelTime,
    maximum_queue_length: metrics.maximumQueueLength,
    road_utilization: metrics.roadUtilization,
    congestion_percentage: metrics.congestionPercentage,
    throughput: metrics.throughput,
  };
}
