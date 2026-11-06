import { SAMPLE_NETWORK } from './roadNetwork';
import { TrafficSimulationEngine } from './simulation';

type Listener = () => void;

export const simulationSession = new TrafficSimulationEngine(SAMPLE_NETWORK, { seed: 42, demand: { perMinute: 90 }, maxVehicles: 100 });
const listeners = new Set<Listener>();

export function stepSimulation(deltaSeconds: number): void {
  simulationSession.step(deltaSeconds);
  listeners.forEach(listener => listener());
}

export function resetSimulation(): void {
  simulationSession.reset();
  listeners.forEach(listener => listener());
}

export function subscribeToSimulation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
