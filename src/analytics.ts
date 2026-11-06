import type { Network } from './types';
import type { SimulationTelemetry } from './simulation';

export interface TrafficMetrics {
  totalVehiclesGenerated: number;
  vehiclesCompleted: number;
  averageVehicleSpeed: number;
  averageWaitingTime: number;
  averageTravelTime: number;
  maximumQueueLength: number;
  roadUtilization: number;
  congestionPercentage: number;
  throughput: number;
}

export interface RoadPerformance {
  roadId: string;
  vehicleCount: number;
  utilization: number;
  averageSpeed: number;
  congestion: number;
}

export interface AnalyticsReport {
  metrics: TrafficMetrics;
  roadPerformance: RoadPerformance[];
  junctionQueues: Array<{ junctionId: string; maximumQueue: number; averageQueue: number }>;
}

const mean = (values: number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const safePercent = (value: number, total: number): number => total > 0 ? (value / total) * 100 : 0;

export function calculateMetrics(telemetry: SimulationTelemetry, network: Network): TrafficMetrics {
  const { live, samples, completedTrips } = telemetry;
  const last = samples[samples.length - 1];
  const duration = last?.time ?? live.time;
  const averageVehicleSpeed = last?.averageSpeed ?? 0;
  const queueValues = samples.flatMap(sample => Object.values(sample.junctionQueues));
  const occupiedCapacity = samples.flatMap(sample => network.roads.map(road => safePercent(sample.roadVehicleCounts[road.id] ?? 0, Math.max(1, road.capacity / 60))));
  return {
    totalVehiclesGenerated: live.spawned,
    vehiclesCompleted: live.completed,
    averageVehicleSpeed,
    averageWaitingTime: mean(completedTrips.map(trip => trip.waitingTime)),
    averageTravelTime: mean(completedTrips.map(trip => trip.travelTime)),
    maximumQueueLength: queueValues.length ? Math.max(...queueValues) : 0,
    roadUtilization: Math.min(100, mean(occupiedCapacity)),
    congestionPercentage: last?.congestionPercentage ?? 0,
    throughput: duration > 0 ? live.completed / duration : 0,
  };
}

export function buildAnalyticsReport(telemetry: SimulationTelemetry, network: Network): AnalyticsReport {
  const samples = telemetry.samples;
  const roadPerformance = network.roads.map(road => {
    const counts = samples.map(sample => sample.roadVehicleCounts[road.id] ?? 0);
    const utilization = mean(counts.map(count => safePercent(count, Math.max(1, road.capacity / 60))));
    const speedSamples = samples.filter(sample => sample.roadAverageSpeeds[road.id] !== undefined).map(sample => sample.roadAverageSpeeds[road.id]);
    const averageSpeed = mean(speedSamples);
    return { roadId: road.id, vehicleCount: counts.length ? counts[counts.length - 1] : 0, utilization: Math.min(100, utilization), averageSpeed, congestion: averageSpeed && road.speedLimit ? Math.max(0, Math.min(100, (1 - averageSpeed / road.speedLimit) * 100)) : 0 };
  });
  const junctionIds = network.nodes.map(node => node.id);
  const junctionQueues = junctionIds.map(junctionId => {
    const values = samples.map(sample => sample.junctionQueues[junctionId] ?? 0);
    return { junctionId, maximumQueue: values.length ? Math.max(...values) : 0, averageQueue: mean(values) };
  });
  return { metrics: calculateMetrics(telemetry, network), roadPerformance, junctionQueues };
}
