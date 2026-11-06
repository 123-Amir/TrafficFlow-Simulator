import type { Network, Road } from './types';

export type VehicleType = 'car' | 'bus' | 'truck' | 'motorcycle';
export type SignalState = 'red' | 'yellow' | 'green';
export type TravelDirection = 'forward' | 'reverse';

export interface Vehicle {
  id: string;
  currentRoad: string;
  position: number;
  speed: number;
  maxSpeed: number;
  destination: string;
  vehicleType: VehicleType;
  direction: TravelDirection;
  route: RouteLeg[];
  routeIndex: number;
  spawnTime: number;
  waitingTime: number;
  distanceTravelled: number;
}

export interface RouteLeg {
  roadId: string;
  from: string;
  to: string;
  direction: TravelDirection;
}

export interface TrafficDemand {
  perMinute: number;
  vehicleMix?: Partial<Record<VehicleType, number>>;
}

export interface SimulationConfig {
  seed: number;
  demand: TrafficDemand;
  maxVehicles: number;
  fixedStep: number;
  signalCycle: number;
  safeDistance: number;
}

export interface SimulationState {
  time: number;
  vehicles: Vehicle[];
  signals: Record<string, SignalState>;
  spawned: number;
  completed: number;
}

export interface CompletedTrip {
  vehicleId: string;
  vehicleType: VehicleType;
  travelTime: number;
  waitingTime: number;
  averageSpeed: number;
  roadsTravelled: string[];
}

export interface SimulationSample {
  time: number;
  vehicleCount: number;
  averageSpeed: number;
  congestionPercentage: number;
  roadVehicleCounts: Record<string, number>;
  roadAverageSpeeds: Record<string, number>;
  junctionQueues: Record<string, number>;
}

export interface SimulationTelemetry {
  live: SimulationState;
  samples: SimulationSample[];
  completedTrips: CompletedTrip[];
}

const DEFAULT_CONFIG: SimulationConfig = {
  seed: 1,
  demand: { perMinute: 60, vehicleMix: { car: 70, bus: 10, truck: 10, motorcycle: 10 } },
  maxVehicles: 250,
  fixedStep: 1 / 20,
  signalCycle: 20,
  safeDistance: 8,
};

const VEHICLE_SPECS: Record<VehicleType, { maxSpeed: number; length: number }> = {
  car: { maxSpeed: 50, length: 4.5 },
  bus: { maxSpeed: 35, length: 12 },
  truck: { maxSpeed: 40, length: 14 },
  motorcycle: { maxSpeed: 60, length: 2.2 },
};

function hashSeed(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function directedLegs(network: Network): RouteLeg[] {
  return network.roads.flatMap(road => {
    const forward: RouteLeg = { roadId: road.id, from: road.from, to: road.to, direction: 'forward' };
    return road.direction === 'two-way'
      ? [forward, { roadId: road.id, from: road.to, to: road.from, direction: 'reverse' }]
      : [forward];
  });
}

export class TrafficSimulationEngine {
  private readonly network: Network;
  private readonly config: SimulationConfig;
  private random: () => number;
  private vehicles = new Map<string, Vehicle>();
  private overrides = new Map<string, SignalState>();
  private spawnAccumulator = 0;
  private nextVehicleId = 1;
  private spawned = 0;
  private completed = 0;
  private time = 0;
  private samples: SimulationSample[] = [];
  private completedTrips: CompletedTrip[] = [];

  constructor(network: Network, config: Partial<SimulationConfig> = {}) {
    this.network = network;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      demand: { ...DEFAULT_CONFIG.demand, ...config.demand, vehicleMix: { ...DEFAULT_CONFIG.demand.vehicleMix, ...config.demand?.vehicleMix } },
    };
    this.random = hashSeed(this.config.seed);
  }

  step(deltaSeconds = this.config.fixedStep): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.time += deltaSeconds;
    this.spawnAccumulator += (this.config.demand.perMinute / 60) * deltaSeconds;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.spawnVehicle();
    }
    const ordered = [...this.vehicles.values()].sort((a, b) => b.position - a.position);
    for (const vehicle of ordered) this.advanceVehicle(vehicle, deltaSeconds);
    this.recordSample();
  }

  reset(): void {
    this.vehicles.clear();
    this.overrides.clear();
    this.spawnAccumulator = 0;
    this.random = hashSeed(this.config.seed);
    this.nextVehicleId = 1;
    this.spawned = 0;
    this.completed = 0;
    this.time = 0;
    this.samples = [];
    this.completedTrips = [];
  }

  setSignalOverride(nodeId: string, state?: SignalState): void {
    if (state) this.overrides.set(nodeId, state);
    else this.overrides.delete(nodeId);
  }

  getSignal(nodeId: string): SignalState {
    const override = this.overrides.get(nodeId);
    if (override) return override;
    const phase = (this.time + this.signalOffset(nodeId)) % this.config.signalCycle;
    const greenDuration = this.config.signalCycle * 0.5;
    const yellowDuration = this.config.signalCycle * 0.1;
    return phase < greenDuration ? 'green' : phase < greenDuration + yellowDuration ? 'yellow' : 'red';
  }

  getState(): SimulationState {
    const signals: Record<string, SignalState> = {};
    this.network.nodes.forEach(node => { signals[node.id] = this.getSignal(node.id); });
    return { time: this.time, vehicles: [...this.vehicles.values()].map(vehicle => ({ ...vehicle, route: vehicle.route.map(leg => ({ ...leg })) })), signals, spawned: this.spawned, completed: this.completed };
  }

  getTelemetry(): SimulationTelemetry {
    return {
      live: this.getState(),
      samples: this.samples.map(sample => ({ ...sample, roadVehicleCounts: { ...sample.roadVehicleCounts }, roadAverageSpeeds: { ...sample.roadAverageSpeeds }, junctionQueues: { ...sample.junctionQueues } })),
      completedTrips: this.completedTrips.map(trip => ({ ...trip, roadsTravelled: [...trip.roadsTravelled] })),
    };
  }

  private signalOffset(nodeId: string): number {
    return [...nodeId].reduce((total, character) => total + character.charCodeAt(0), 0) % this.config.signalCycle;
  }

  private spawnVehicle(): void {
    if (this.vehicles.size >= this.config.maxVehicles) return;
    const legs = directedLegs(this.network);
    if (!legs.length) return;
    const first = legs[Math.floor(this.random() * legs.length)];
    const destinationCandidates = this.network.nodes.filter(node => node.id !== first.from && (node.id === first.to || this.findRoute(first.to, node.id).length > 0));
    if (!destinationCandidates.length) return;
    const destination = destinationCandidates[Math.floor(this.random() * destinationCandidates.length)].id;
    const route = [first, ...this.findRoute(first.to, destination)];
    const vehicleType = this.chooseVehicleType();
    const spec = VEHICLE_SPECS[vehicleType];
    const vehicle: Vehicle = {
      id: `vehicle-${this.nextVehicleId++}`,
      currentRoad: first.roadId,
      position: 0,
      speed: 0,
      maxSpeed: spec.maxSpeed,
      destination,
      vehicleType,
      direction: first.direction,
      route,
      routeIndex: 0,
      spawnTime: this.time,
      waitingTime: 0,
      distanceTravelled: 0,
    };
    const atEntry = [...this.vehicles.values()].some(other => other.currentRoad === first.roadId && other.direction === first.direction && other.position < this.config.safeDistance + spec.length);
    if (atEntry) return;
    this.vehicles.set(vehicle.id, vehicle);
    this.spawned += 1;
  }

  private chooseVehicleType(): VehicleType {
    const mix = this.config.demand.vehicleMix ?? {};
    const total = (Object.values(mix) as number[]).reduce((sum, value) => sum + Math.max(0, value), 0) || 100;
    let target = this.random() * total;
    for (const type of Object.keys(VEHICLE_SPECS) as VehicleType[]) {
      target -= Math.max(0, mix[type] ?? 0);
      if (target <= 0) return type;
    }
    return 'car';
  }

  private findRoute(start: string, destination: string): RouteLeg[] {
    if (start === destination) return [];
    const queue: Array<{ node: string; route: RouteLeg[] }> = [{ node: start, route: [] }];
    const visited = new Set([start]);
    while (queue.length) {
      const current = queue.shift()!;
      for (const leg of directedLegs(this.network).filter(item => item.from === current.node)) {
        if (visited.has(leg.to)) continue;
        const route = [...current.route, leg];
        if (leg.to === destination) return route;
        visited.add(leg.to);
        queue.push({ node: leg.to, route });
      }
    }
    return [];
  }

  private advanceVehicle(vehicle: Vehicle, deltaSeconds: number): void {
    const road = this.network.roads.find(item => item.id === vehicle.currentRoad);
    if (!road) { this.vehicles.delete(vehicle.id); return; }
    const leader = [...this.vehicles.values()].filter(other => other.id !== vehicle.id && other.currentRoad === vehicle.currentRoad && other.direction === vehicle.direction && other.position > vehicle.position).sort((a, b) => a.position - b.position)[0];
    const spec = VEHICLE_SPECS[vehicle.vehicleType];
    let targetSpeed = Math.min(vehicle.maxSpeed, road.speedLimit);
    if (leader) {
      const gap = leader.position - vehicle.position - VEHICLE_SPECS[leader.vehicleType].length;
      targetSpeed = Math.min(targetSpeed, Math.max(0, gap - this.config.safeDistance) / deltaSeconds);
    }
    const currentLeg = vehicle.route[vehicle.routeIndex];
    const distanceToJunction = road.length - vehicle.position;
    if (distanceToJunction <= Math.max(this.config.safeDistance, targetSpeed * deltaSeconds * 1.5)) {
      const signal = this.getSignal(currentLeg.to);
      if (signal === 'red') targetSpeed = 0;
      else if (signal === 'yellow') targetSpeed = Math.min(targetSpeed, Math.max(0, distanceToJunction - this.config.safeDistance) / deltaSeconds);
    }
    vehicle.speed = Math.min(targetSpeed, Math.max(0, vehicle.speed + 3.5 * deltaSeconds));
    if (vehicle.speed < 0.1) vehicle.waitingTime += deltaSeconds;
    vehicle.position += vehicle.speed * deltaSeconds;
    vehicle.distanceTravelled += vehicle.speed * deltaSeconds;
    if (leader && vehicle.position + spec.length + this.config.safeDistance > leader.position) {
      vehicle.position = Math.max(0, leader.position - spec.length - this.config.safeDistance);
      vehicle.speed = 0;
    }
    if (vehicle.position < road.length) return;
    if (this.getSignal(currentLeg.to) === 'red') { vehicle.position = road.length; vehicle.speed = 0; return; }
    const next = vehicle.route[vehicle.routeIndex + 1];
    if (!next) {
      this.vehicles.delete(vehicle.id);
      this.completed += 1;
      this.completedTrips.push({
        vehicleId: vehicle.id,
        vehicleType: vehicle.vehicleType,
        travelTime: this.time - vehicle.spawnTime,
        waitingTime: vehicle.waitingTime,
        averageSpeed: vehicle.distanceTravelled / Math.max(0.001, this.time - vehicle.spawnTime),
        roadsTravelled: vehicle.route.map(leg => leg.roadId),
      });
      return;
    }
    vehicle.routeIndex += 1;
    vehicle.currentRoad = next.roadId;
    vehicle.direction = next.direction;
    vehicle.position = Math.min(vehicle.position - road.length, this.config.safeDistance);
  }

  private recordSample(): void {
    const vehicles = [...this.vehicles.values()];
    const roadVehicleCounts: Record<string, number> = {};
    const roadSpeedTotals: Record<string, number> = {};
    const junctionQueues: Record<string, number> = {};
    vehicles.forEach(vehicle => {
      roadVehicleCounts[vehicle.currentRoad] = (roadVehicleCounts[vehicle.currentRoad] ?? 0) + 1;
      roadSpeedTotals[vehicle.currentRoad] = (roadSpeedTotals[vehicle.currentRoad] ?? 0) + vehicle.speed;
      const road = this.network.roads.find(item => item.id === vehicle.currentRoad);
      const leg = vehicle.route[vehicle.routeIndex];
      if (road && leg && road.length - vehicle.position < this.config.safeDistance * 2 && vehicle.speed < 0.1) {
        junctionQueues[leg.to] = (junctionQueues[leg.to] ?? 0) + 1;
      }
    });
    const averageSpeed = vehicles.length ? vehicles.reduce((sum, vehicle) => sum + vehicle.speed, 0) / vehicles.length : 0;
    const speedLimits = this.network.roads.map(road => road.speedLimit);
    const referenceSpeed = speedLimits.length ? speedLimits.reduce((sum, speed) => sum + speed, 0) / speedLimits.length : 0;
    this.samples.push({
      time: this.time,
      vehicleCount: vehicles.length,
      averageSpeed,
      congestionPercentage: referenceSpeed ? Math.min(100, Math.max(0, (1 - averageSpeed / referenceSpeed) * 100)) : 0,
      roadVehicleCounts,
      roadAverageSpeeds: Object.fromEntries(Object.entries(roadSpeedTotals).map(([roadId, total]) => [roadId, total / Math.max(1, roadVehicleCounts[roadId])])),
      junctionQueues,
    });
  }
}

export const vehicleLength = (type: VehicleType): number => VEHICLE_SPECS[type].length;
