import { Activity, Plus } from 'lucide-react';
export function EmptyState({ title, description, action }: { title: string; description: string; action?: string }) {
  return <div className="empty-state"><div className="empty-icon"><Activity size={21} /></div><h3>{title}</h3><p>{description}</p>{action && <button className="button-primary"><Plus size={16} />{action}</button>}</div>;
}
