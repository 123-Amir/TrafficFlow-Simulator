import type { ReactNode } from 'react';
export function StatCard({ label, value, detail, icon, tone = 'teal' }: { label: string; value: string; detail: string; icon: ReactNode; tone?: 'teal' | 'amber' | 'blue' | 'purple' }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}
