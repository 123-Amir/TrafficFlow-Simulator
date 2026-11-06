const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
import type { Scenario, ScenarioConfig, ScenarioRun } from './scenarios';
import type { Network } from './types';

export interface PersistedNetwork { id: number; name: string; description: string; graph: Network; created_at: string; updated_at: string; }
export interface SimulationSummary { id: number; scenario_id: number; network_id: number; duration: number; status: 'completed'; metrics: Record<string, number>; created_at: string; }

export async function getHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/api/health`);
  if (!response.ok) throw new Error(`Backend health check failed (${response.status})`);
  return response.json() as Promise<{ status: string }>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail ?? `Request failed (${response.status})`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const listScenarios = async () => (await request<{ items: Scenario[] }>('/api/scenarios')).items;
export const createScenario = (payload: { name: string; description: string; config: ScenarioConfig }) => request<Scenario>('/api/scenarios', { method: 'POST', body: JSON.stringify(payload) });
export const updateScenario = (id: number, payload: { name: string; description: string; config: ScenarioConfig }) => request<Scenario>(`/api/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteScenario = (id: number) => request<void>(`/api/scenarios/${id}`, { method: 'DELETE' });
export const createScenarioRun = (id: number, metrics: Record<string, number>) => request<ScenarioRun>(`/api/scenarios/${id}/runs`, { method: 'POST', body: JSON.stringify({ metrics }) });
export const listScenarioRuns = (id: number) => request<ScenarioRun[]>(`/api/scenarios/${id}/runs`);
export const listNetworks = async () => (await request<{ items: PersistedNetwork[] }>('/api/networks')).items;
export const createNetwork = (payload: { name: string; description: string; graph: Network }) => request<PersistedNetwork>('/api/networks', { method: 'POST', body: JSON.stringify(payload) });
export const getNetwork = (id: number) => request<PersistedNetwork>(`/api/networks/${id}`);
export const updateNetwork = (id: number, payload: { name: string; description: string; graph: Network }) => request<PersistedNetwork>(`/api/networks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteNetwork = (id: number) => request<void>(`/api/networks/${id}`, { method: 'DELETE' });
export const createSimulation = (payload: { scenario_id: number; network_id: number; duration: number; metrics: Record<string, number> }) => request<SimulationSummary>('/api/simulations', { method: 'POST', body: JSON.stringify(payload) });
export const getSimulation = (id: number) => request<SimulationSummary>(`/api/simulations/${id}`);
export const getSimulationMetrics = (id: number) => request<Record<string, number>>(`/api/simulations/${id}/metrics`);
export const compareSimulations = (firstId: number, secondId: number) => request<{ first: SimulationSummary; second: SimulationSummary; differences: Record<string, number> }>(`/api/simulations/compare?first_id=${firstId}&second_id=${secondId}`);
