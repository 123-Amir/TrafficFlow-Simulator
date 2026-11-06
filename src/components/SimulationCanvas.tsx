import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { SAMPLE_NETWORK } from '../roadNetwork';
import { type SimulationState, type VehicleType } from '../simulation';
import { resetSimulation, simulationSession, stepSimulation } from '../simulationSession';
import type { Network } from '../types';

const vehicleColors: Record<VehicleType, string> = { car: '#38bdf8', bus: '#fbbf24', truck: '#c084fc', motorcycle: '#2dd4bf' };

function drawSimulation(canvas: HTMLCanvasElement, network: Network, state: SimulationState, zoom: number, pan: { x: number; y: number }) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const ratio = window.devicePixelRatio || 1; const width = canvas.clientWidth; const height = canvas.clientHeight;
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let x = (pan.x % 32 + 32) % 32; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = (pan.y % 32 + 32) % 32; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  const point = (node: { x: number; y: number }) => ({ x: node.x * width * zoom + pan.x, y: node.y * height * zoom + pan.y });
  const roadById = new Map(network.roads.map(road => [road.id, road]));
  network.roads.forEach(road => {
    const from = network.nodes.find(node => node.id === road.from); const to = network.nodes.find(node => node.id === road.to); if (!from || !to) return;
    const a = point(from); const b = point(to); ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(5, road.width * .55); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = road.kind === 'flyover' ? '#a78bfa' : '#2dd4bf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  network.nodes.forEach(node => { const p = point(node); const signal = state.signals[node.id]; const color = signal === 'green' ? '#4ade80' : signal === 'yellow' ? '#fbbf24' : '#f87171'; ctx.fillStyle = '#0b1120'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); });
  state.vehicles.forEach(vehicle => {
    const road = roadById.get(vehicle.currentRoad); if (!road) return;
    const fromNode = network.nodes.find(node => node.id === (vehicle.direction === 'forward' ? road.from : road.to)); const toNode = network.nodes.find(node => node.id === (vehicle.direction === 'forward' ? road.to : road.from)); if (!fromNode || !toNode) return;
    const progress = Math.max(0, Math.min(1, vehicle.position / road.length)); const a = point(fromNode); const b = point(toNode); const x = a.x + (b.x - a.x) * progress; const y = a.y + (b.y - a.y) * progress; const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = vehicleColors[vehicle.vehicleType]; ctx.beginPath(); if (vehicle.vehicleType === 'motorcycle') { ctx.arc(0, 0, 4, 0, Math.PI * 2); } else { ctx.roundRect(-7, -4, vehicle.vehicleType === 'bus' ? 14 : 11, 8, 2); } ctx.fill(); ctx.restore();
  });
}

export function SimulationCanvas({ network = SAMPLE_NETWORK }: { network?: Network }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>();
  const lastFrameRef = useRef<number>();
  const accumulatorRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number; pan: { x: number; y: number } }>();
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [state, setState] = useState<SimulationState>(() => simulationSession.getState());
  const [congestion, setCongestion] = useState<'low' | 'moderate' | 'heavy'>('low');
  useEffect(() => {
    if (!running) { if (frameRef.current) cancelAnimationFrame(frameRef.current); lastFrameRef.current = undefined; return; }
    const render = (timestamp: number) => {
      const previous = lastFrameRef.current ?? timestamp; lastFrameRef.current = timestamp;
      accumulatorRef.current += Math.min(.25, (timestamp - previous) / 1000) * speed;
      while (accumulatorRef.current >= 1 / 20) {
        stepSimulation(1 / 20); accumulatorRef.current -= 1 / 20;
      }
      const next = simulationSession.getState(); setState(next);
      const capacity = network.roads.reduce((total, road) => total + road.capacity / 60, 0);
      const ratio = capacity ? next.vehicles.length / capacity : 0;
      setCongestion(ratio > .75 ? 'heavy' : ratio > .4 ? 'moderate' : 'low');
      if (canvasRef.current) drawSimulation(canvasRef.current, network, next, zoom, pan);
      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [network, pan, running, speed, zoom]);
  useEffect(() => { if (canvasRef.current) drawSimulation(canvasRef.current, network, state, zoom, pan); }, [network, pan, state, zoom]);
  const reset = () => { resetSimulation(); setState(simulationSession.getState()); setRunning(false); setCongestion('low'); };
  return <div className="simulation-surface"><div className="simulation-toolbar"><div className="tool-group"><button className="button-primary" onClick={() => setRunning(value => !value)}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? 'Pause' : 'Start'}</button><button className="icon-button" onClick={() => setRunning(true)} aria-label="Resume simulation"><Play size={15} /></button><button className="icon-button" onClick={reset} aria-label="Reset simulation"><RotateCcw size={15} /></button></div><label className="speed-control">Speed <select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="0.5">0.5x</option><option value="1">1x</option><option value="2">2x</option><option value="4">4x</option></select></label><div className="tool-group"><button className="icon-button" onClick={() => setZoom(value => Math.min(2, value + .1))} aria-label="Zoom in"><ZoomIn size={15} /></button><button className="icon-button" onClick={() => setZoom(value => Math.max(.5, value - .1))} aria-label="Zoom out"><ZoomOut size={15} /></button></div></div><canvas ref={canvasRef} className="traffic-canvas simulation-canvas" aria-label="Live traffic simulation visualization" onMouseDown={event => { dragRef.current = { x: event.clientX, y: event.clientY, pan }; }} onMouseMove={event => { if (!dragRef.current) return; setPan({ x: dragRef.current.pan.x + event.clientX - dragRef.current.x, y: dragRef.current.pan.y + event.clientY - dragRef.current.y }); }} onMouseUp={() => { dragRef.current = undefined; }} onMouseLeave={() => { dragRef.current = undefined; }} /><div className="simulation-stats"><span><b>{state.vehicles.length}</b> vehicles</span><span><b>{state.time.toFixed(1)}s</b> simulation time</span><span className={`congestion ${congestion}`}><i />{congestion} congestion</span><span className="signal-key"><i className="signal green" />Green <i className="signal yellow" />Yellow <i className="signal red" />Red</span></div></div>;
}
