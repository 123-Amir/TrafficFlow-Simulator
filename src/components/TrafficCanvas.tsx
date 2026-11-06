import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { Network } from '../types';

interface Props {
  network?: Network;
  interactive?: boolean;
  zoom?: number;
  pan?: { x: number; y: number };
  selectedRoadId?: string;
  onCanvasClick?: (point: { x: number; y: number; nodeId?: string; roadId?: string }) => void;
  onPan?: (pan: { x: number; y: number }) => void;
}

export function TrafficCanvas({ network, interactive = false, zoom = 1, pan = { x: 0, y: 0 }, selectedRoadId, onCanvasClick, onPan }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; pan: { x: number; y: number } }>();
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const ratio = window.devicePixelRatio || 1; const width = canvas.clientWidth; const height = canvas.clientHeight;
    canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for (let x = (pan.x % 32 + 32) % 32; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = (pan.y % 32 + 32) % 32; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    if (!network?.roads.length) { ctx.fillStyle = '#64748b'; ctx.font = '13px DM Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No road network loaded', width / 2, height / 2); return; }
    const point = (node: { x: number; y: number }) => ({ x: node.x * width * zoom + pan.x, y: node.y * height * zoom + pan.y });
    network.roads.forEach(road => {
      const from = network.nodes.find(n => n.id === road.from); const to = network.nodes.find(n => n.id === road.to); if (!from || !to) return;
      const a = point(from); const b = point(to); ctx.strokeStyle = road.id === selectedRoadId ? '#fbbf24' : road.kind === 'flyover' ? '#a78bfa' : '#334155'; ctx.lineWidth = Math.max(4, road.width * .55); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.strokeStyle = road.id === selectedRoadId ? '#fef3c7' : '#2dd4bf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    network.nodes.forEach(node => { const p = point(node); ctx.fillStyle = '#0f172a'; ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  }, [network, pan, selectedRoadId, zoom]);
  const toGraphPoint = (event: MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(); const width = rect.width; const height = rect.height;
    const x = (event.clientX - rect.left - pan.x) / (width * zoom); const y = (event.clientY - rect.top - pan.y) / (height * zoom);
    const node = network?.nodes.find(item => Math.hypot(item.x - x, item.y - y) < .035 / zoom);
    const road = network?.roads.find(item => { const from = network.nodes.find(n => n.id === item.from); const to = network.nodes.find(n => n.id === item.to); if (!from || !to) return false; const dx = to.x - from.x; const dy = to.y - from.y; const length = Math.hypot(dx, dy); const distance = Math.abs(dy * x - dx * y + to.x * from.y - to.y * from.x) / length; const projection = ((x - from.x) * dx + (y - from.y) * dy) / (length * length); return distance < .025 / zoom && projection > 0 && projection < 1; });
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), nodeId: node?.id, roadId: road?.id };
  };
  return <canvas ref={ref} className={`traffic-canvas ${interactive ? 'interactive' : ''}`} aria-label="Traffic network visualization" onClick={interactive ? event => onCanvasClick?.(toGraphPoint(event)) : undefined} onMouseDown={interactive && onPan ? event => { drag.current = { x: event.clientX, y: event.clientY, pan }; } : undefined} onMouseMove={interactive && onPan ? event => { if (!drag.current) return; onPan({ x: drag.current.pan.x + event.clientX - drag.current.x, y: drag.current.pan.y + event.clientY - drag.current.y }); } : undefined} onMouseUp={() => { drag.current = undefined; }} />;
}
