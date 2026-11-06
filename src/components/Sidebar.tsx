import { Activity, BarChart3, CarFront, ChevronDown, CircleDot, GitBranch, LayoutDashboard, Network, Settings2 } from 'lucide-react';
import type { Page } from '../types';

const items: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Simulation', icon: Activity },
  { label: 'Road Network', icon: Network }, { label: 'Analytics', icon: BarChart3 }, { label: 'Scenarios', icon: GitBranch },
];

export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><CarFront size={19} /></div><div><strong>TrafficFlow</strong><span>SIMULATOR</span></div></div>
    <div className="workspace"><CircleDot size={13} className="text-teal-300" /><span>Urban Mobility Lab</span><ChevronDown size={14} className="ml-auto text-slate-500" /></div>
    <p className="nav-label">Workspace</p>
    <nav>{items.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => onNavigate(label)}><Icon size={18} /><span>{label}</span>{label === 'Simulation' && <span className="live-dot" />}</button>)}</nav>
    <div className="sidebar-bottom"><button className="nav-item"><Settings2 size={18} /><span>Settings</span></button><div className="user-card"><div className="avatar">AM</div><div><strong>Alex Morgan</strong><span>Administrator</span></div><ChevronDown size={14} className="ml-auto text-slate-500" /></div></div>
  </aside>;
}
