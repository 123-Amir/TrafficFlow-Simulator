import { describe, expect, it } from 'vitest';
import { buildAnalyticsReport, calculateMetrics } from './analytics';
import { SAMPLE_NETWORK } from './roadNetwork';
import type { SimulationTelemetry } from './simulation';

const emptyTelemetry: SimulationTelemetry = { live: { time: 0, vehicles: [], signals: {}, spawned: 0, completed: 0 }, samples: [], completedTrips: [] };

describe('traffic analytics', () => {
  it('handles empty simulations without division by zero', () => {
    const metrics = calculateMetrics(emptyTelemetry, SAMPLE_NETWORK);
    expect(metrics.averageTravelTime).toBe(0);
    expect(metrics.throughput).toBe(0);
    expect(metrics.roadUtilization).toBe(0);
    expect(buildAnalyticsReport(emptyTelemetry, SAMPLE_NETWORK).roadPerformance[0].vehicleCount).toBe(0);
  });
  it('derives metrics from samples and completed trips', () => {
    const telemetry: SimulationTelemetry = {
      live: { time: 20, vehicles: [], signals: {}, spawned: 5, completed: 2 },
      samples: [
        { time: 10, vehicleCount: 3, averageSpeed: 20, congestionPercentage: 50, roadVehicleCounts: { 'main-west': 2 }, roadAverageSpeeds: { 'main-west': 20 }, junctionQueues: { 'junction-2': 4 } },
        { time: 20, vehicleCount: 3, averageSpeed: 30, congestionPercentage: 25, roadVehicleCounts: { 'main-west': 3 }, roadAverageSpeeds: { 'main-west': 30 }, junctionQueues: { 'junction-2': 2 } },
      ],
      completedTrips: [
        { vehicleId: 'v1', vehicleType: 'car', travelTime: 10, waitingTime: 2, averageSpeed: 40, roadsTravelled: ['main-west'] },
        { vehicleId: 'v2', vehicleType: 'bus', travelTime: 20, waitingTime: 4, averageSpeed: 30, roadsTravelled: ['main-west'] },
      ],
    };
    const metrics = calculateMetrics(telemetry, SAMPLE_NETWORK);
    expect(metrics.totalVehiclesGenerated).toBe(5);
    expect(metrics.vehiclesCompleted).toBe(2);
    expect(metrics.averageTravelTime).toBe(15);
    expect(metrics.averageWaitingTime).toBe(3);
    expect(metrics.maximumQueueLength).toBe(4);
    expect(metrics.throughput).toBe(.1);
    expect(metrics.congestionPercentage).toBe(25);
  });
});
