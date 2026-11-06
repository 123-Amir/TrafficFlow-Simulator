import { useMemo, useRef, useState } from 'react';
import { GitBranch, Hand, Minus, MousePointer2, Plus, RotateCcw, Save, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { networkValidation, SAMPLE_NETWORK } from '../roadNetwork';
import type { Network, Road, RoadDirection, RoadKind, RoadNode } from '../types';
import { TrafficCanvas } from './TrafficCanvas';

type Tool = 'select' | 'road' | 'junction' | 'pan';
const newRoad = (id: string, from: string, to: string, kind: RoadKind = 'straight'): Road => ({ id, from, to, kind, direction: 'two-way', length: 100, width: 10, lanes: 2, capacity: 1800, speedLimit: 50 });

export function RoadNetworkEditor() {
  const [network, setNetwork] = useState<Network>(() => SAMPLE_NETWORK);
  const [selectedRoad, setSelectedRoad] = useState<string>();
  const [tool, setTool] = useState<Tool>('select');
  const [message, setMessage] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pendingNode = useRef<string>();
  const errors = useMemo(() => networkValidation(network), [network]);
  const updateRoad = (changes: Partial<Road>) => setNetwork(current => ({ ...current, roads: current.roads.map(road => road.id === selectedRoad ? { ...road, ...changes } : road) }));
  const removeRoad = () => { if (!selectedRoad) return; setNetwork(current => ({ ...current, roads: current.roads.filter(road => road.id !== selectedRoad) })); setSelectedRoad(undefined); };
  const handleCanvasClick = (point: { x: number; y: number; nodeId?: string; roadId?: string }) => {
    if (tool === 'select') { setSelectedRoad(point.roadId); return; }
    if (tool === 'junction') {
      const node: RoadNode = { id: `junction-${Date.now()}`, x: point.x, y: point.y };
      setNetwork(current => ({ ...current, nodes: [...current.nodes, node] })); setMessage('Junction added'); return;
    }
    if (tool === 'road' && point.nodeId) {
      if (!pendingNode.current) { pendingNode.current = point.nodeId; setMessage('Select a second junction to connect the road'); return; }
      if (pendingNode.current === point.nodeId) { setMessage('A road must connect two different junctions'); return; }
      const id = `road-${Date.now()}`;
      const from = pendingNode.current;
      const to = point.nodeId;
      if (!from || !to) return;
      setNetwork(current => ({ ...current, roads: [...current.roads, newRoad(id, from, to)] }));
      pendingNode.current = undefined; setSelectedRoad(id); setMessage('Road added');
    }
  };
  const loadSample = () => { setNetwork(SAMPLE_NETWORK); setSelectedRoad(undefined); setMessage('Sample network loaded'); };
  const clear = () => { setNetwork({ nodes: [], roads: [] }); setSelectedRoad(undefined); setMessage('Network cleared'); };
  const save = () => { localStorage.setItem('trafficflow-network', JSON.stringify(network)); setMessage('Network saved locally'); };
  const load = () => { try { const saved = localStorage.getItem('trafficflow-network'); if (!saved) throw new Error('No saved network found'); const parsed = JSON.parse(saved) as Network; const validation = networkValidation(parsed); if (validation.length) throw new Error(validation[0] ?? 'Invalid network'); setNetwork(parsed); setMessage('Network loaded'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load network'); } };
  const selected = network.roads.find(road => road.id === selectedRoad);
  return <div className="network-editor">
    <div className="editor-toolbar"><div className="tool-group">{([['select', MousePointer2, 'Select'], ['road', GitBranch, 'Add road'], ['junction', Plus, 'Add junction'], ['pan', Hand, 'Pan']] as const).map(([name, Icon, label]) => <button key={name} className={`tool-button ${tool === name ? 'selected' : ''}`} onClick={() => { setTool(name); pendingNode.current = undefined; }}><Icon size={15} />{label}</button>)}</div><div className="tool-group"><button className="icon-button" onClick={() => setZoom(value => Math.min(2, value + .1))} aria-label="Zoom in"><ZoomIn size={16} /></button><span className="zoom-label">{Math.round(zoom * 100)}%</span><button className="icon-button" onClick={() => setZoom(value => Math.max(.5, value - .1))} aria-label="Zoom out"><ZoomOut size={16} /></button><button className="icon-button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset view"><RotateCcw size={16} /></button></div><div className="tool-group"><button className="text-button" onClick={loadSample}>Load sample</button><button className="icon-button" onClick={save} aria-label="Save network"><Save size={16} /></button><button className="icon-button" onClick={load} aria-label="Load network"><RotateCcw size={16} /></button><button className="icon-button danger" onClick={clear} aria-label="Clear network"><Trash2 size={16} /></button></div></div>
    <div className="editor-body"><div className="editor-canvas-wrap"><TrafficCanvas network={network} interactive zoom={zoom} pan={pan} onCanvasClick={handleCanvasClick} onPan={tool === 'pan' ? setPan : undefined} selectedRoadId={selectedRoad} /><div className="canvas-help">{tool === 'road' ? (pendingNode.current ? 'Click a second junction' : 'Click two junctions to connect a road') : tool === 'junction' ? 'Click the canvas to add a junction' : tool === 'pan' ? 'Drag to pan the network' : 'Select a road to edit its properties'}</div></div><aside className="road-properties"><div className="properties-header"><div><p className="eyebrow">ROAD PROPERTIES</p><h2>{selected ? selected.id : 'No selection'}</h2></div></div>{selected ? <div className="property-form"><label>Road ID<input value={selected.id} onChange={event => updateRoad({ id: event.target.value })} /></label><label>Road type<select value={selected.kind} onChange={event => updateRoad({ kind: event.target.value as RoadKind })}><option value="straight">Straight road</option><option value="flyover">Flyover</option></select></label><label>Direction<select value={selected.direction} onChange={event => updateRoad({ direction: event.target.value as RoadDirection })}><option value="two-way">Two-way</option><option value="one-way">One-way</option></select></label><div className="field-row"><label>Length (m)<input type="number" min="1" value={selected.length} onChange={event => updateRoad({ length: Number(event.target.value) })} /></label><label>Width (m)<input type="number" min="1" value={selected.width} onChange={event => updateRoad({ width: Number(event.target.value) })} /></label></div><div className="field-row"><label>Lanes<input type="number" min="1" value={selected.lanes} onChange={event => updateRoad({ lanes: Number(event.target.value) })} /></label><label>Capacity<input type="number" min="1" value={selected.capacity} onChange={event => updateRoad({ capacity: Number(event.target.value) })} /></label></div><label>Speed limit (km/h)<input type="number" min="1" value={selected.speedLimit} onChange={event => updateRoad({ speedLimit: Number(event.target.value) })} /></label><button className="delete-button" onClick={removeRoad}><Trash2 size={15} /> Delete road</button></div> : <div className="properties-empty"><MousePointer2 size={18} /><p>Select a road segment to view and edit its properties.</p></div>}</aside></div>
    <div className={`validation-bar ${errors.length ? 'invalid' : 'valid'}`}><span>{errors.length ? `${errors.length} validation issue${errors.length === 1 ? '' : 's'}` : 'Network valid and connected'}</span>{message && <small>{message}</small>}</div>
  </div>;
}
