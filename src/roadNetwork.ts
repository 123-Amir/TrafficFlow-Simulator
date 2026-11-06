import type { Network, Road } from './types';

export const SAMPLE_NETWORK: Network = {
  nodes: [
    { id: 'junction-1', x: 0.18, y: 0.5 }, { id: 'junction-2', x: 0.5, y: 0.5 },
    { id: 'junction-3', x: 0.82, y: 0.5 }, { id: 'junction-4', x: 0.5, y: 0.2 },
    { id: 'junction-5', x: 0.5, y: 0.8 },
  ],
  roads: [
    { id: 'main-west', from: 'junction-1', to: 'junction-2', kind: 'straight', direction: 'two-way', length: 320, width: 12, lanes: 2, capacity: 1800, speedLimit: 50 },
    { id: 'main-east', from: 'junction-2', to: 'junction-3', kind: 'straight', direction: 'two-way', length: 320, width: 12, lanes: 2, capacity: 1800, speedLimit: 50 },
    { id: 'north-connector', from: 'junction-4', to: 'junction-2', kind: 'flyover', direction: 'one-way', length: 210, width: 7, lanes: 1, capacity: 900, speedLimit: 70 },
    { id: 'south-connector', from: 'junction-2', to: 'junction-5', kind: 'straight', direction: 'one-way', length: 210, width: 7, lanes: 1, capacity: 900, speedLimit: 40 },
  ],
};

export function validateNetwork(network: Network): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(network.nodes.map(node => node.id));
  const roadIds = new Set<string>();
  for (const road of network.roads) {
    if (roadIds.has(road.id)) errors.push(`Duplicate road ID: ${road.id}`);
    roadIds.add(road.id);
    if (!nodeIds.has(road.from) || !nodeIds.has(road.to)) errors.push(`${road.id} references a missing junction`);
    if (road.from === road.to) errors.push(`${road.id} cannot connect a junction to itself`);
    if (road.length <= 0 || road.width <= 0 || road.lanes < 1 || road.capacity < 1 || road.speedLimit <= 0) {
      errors.push(`${road.id} has invalid road properties`);
    }
  }
  if (network.roads.length && !network.nodes.length) errors.push('Roads require at least two junctions');
  if (network.roads.length && network.nodes.some(node => !network.roads.some(road => road.from === node.id || road.to === node.id))) {
    errors.push('Every junction must connect to at least one road');
  }
  return errors;
}

export function isConnected(network: Network): boolean {
  if (!network.nodes.length) return true;
  const visited = new Set<string>([network.nodes[0].id]);
  const queue = [network.nodes[0].id];
  while (queue.length) {
    const current = queue.shift()!;
    network.roads.forEach(road => {
      if (road.from === current && !visited.has(road.to)) { visited.add(road.to); queue.push(road.to); }
      if (road.to === current && !visited.has(road.from)) { visited.add(road.from); queue.push(road.from); }
    });
  }
  return visited.size === network.nodes.length;
}

export function networkValidation(network: Network): string[] {
  const errors = validateNetwork(network);
  if (!isConnected(network)) errors.push('The road network contains disconnected junctions');
  return errors;
}
