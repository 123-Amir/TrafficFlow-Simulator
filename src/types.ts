export type Page = 'Dashboard' | 'Simulation' | 'Road Network' | 'Analytics' | 'Scenarios';

export interface RoadNode { id: string; x: number; y: number; }
export type RoadDirection = 'one-way' | 'two-way';
export type RoadKind = 'straight' | 'junction' | 'flyover';
export interface Road {
  id: string;
  from: string;
  to: string;
  kind: RoadKind;
  direction: RoadDirection;
  length: number;
  width: number;
  lanes: number;
  capacity: number;
  speedLimit: number;
}
export interface Network { nodes: RoadNode[]; roads: Road[]; }
