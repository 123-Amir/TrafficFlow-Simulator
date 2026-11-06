import { describe, expect, it } from 'vitest';
import { isConnected, networkValidation, SAMPLE_NETWORK, validateNetwork } from './roadNetwork';
import type { Network } from './types';

describe('road network graph validation', () => {
  it('accepts the sample network as connected and valid', () => {
    expect(isConnected(SAMPLE_NETWORK)).toBe(true);
    expect(networkValidation(SAMPLE_NETWORK)).toEqual([]);
  });
  it('rejects missing endpoints and self connections', () => {
    const network = { nodes: [{ id: 'a', x: 0, y: 0 }], roads: [{ ...SAMPLE_NETWORK.roads[0], from: 'missing', to: 'a' }] } as Network;
    expect(validateNetwork(network)).toEqual(expect.arrayContaining(['main-west references a missing junction']));
  });
  it('detects disconnected graph components', () => {
    const network: Network = { nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: .5, y: 1 }], roads: [{ ...SAMPLE_NETWORK.roads[0], from: 'a', to: 'b' }] };
    expect(isConnected(network)).toBe(false);
    expect(networkValidation(network)).toContain('The road network contains disconnected junctions');
  });
});
