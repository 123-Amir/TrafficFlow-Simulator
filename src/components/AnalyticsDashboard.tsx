import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildAnalyticsReport } from '../analytics';
import { SAMPLE_NETWORK } from '../roadNetwork';
import { subscribeToSimulation, simulationSession } from '../simulationSession';

const formatNumber = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '0.0';

export function AnalyticsDashboard() {
  const [, refresh] = useState(0);
  useEffect(() => subscribeToSimulation(() => refresh(value => value + 1)), []);
  const telemetry = simulationSession.getTelemetry();
  const report = useMemo(() => buildAnalyticsReport(telemetry, SAMPLE_NETWORK), [telemetry]);
  const { metrics } = report;
  const hasData = telemetry.samples.length > 0;
  const chartData = telemetry.samples.map(sample => ({ time: `${sample.time.toFixed(0)}s`, vehicles: sample.vehicleCount, speed: sample.averageSpeed, congestion: sample.congestionPercentage }));
  const roadData = report.roadPerformance.map(row => ({ road: row.roadId, vehicles: row.vehicleCount, utilization: row.utilization }));
  const queueData = report.junctionQueues.map(row => ({ junction: row.junctionId, queue: row.maximumQueue }));
  return <div className="analytics-dashboard">
    <div className="analytics-status"><span className={hasData ? 'status-live' : 'status-empty'}><i />{hasData ? 'Live telemetry available' : 'No simulation telemetry yet'}</span><span>{telemetry.completedTrips.length ? 'Completed-run metrics include finished vehicles only.' : 'Completed-run metrics will appear after vehicles finish.'}</span></div>
    <div className="metric-grid">
      <Metric label="Vehicles generated" value={metrics.totalVehiclesGenerated.toString()} detail="All agents spawned" />
      <Metric label="Vehicles completed" value={metrics.vehiclesCompleted.toString()} detail="Agents reaching destination" />
      <Metric label="Average speed" value={`${formatNumber(metrics.averageVehicleSpeed)} m/s`} detail="Current live average" />
      <Metric label="Average waiting time" value={`${formatNumber(metrics.averageWaitingTime)} s`} detail="Completed vehicles" />
      <Metric label="Average travel time" value={`${formatNumber(metrics.averageTravelTime)} s`} detail="Completed vehicles" />
      <Metric label="Maximum queue" value={metrics.maximumQueueLength.toString()} detail="Vehicles at a junction" />
      <Metric label="Road utilization" value={`${formatNumber(metrics.roadUtilization)}%`} detail="Average capacity usage" />
      <Metric label="Congestion" value={`${formatNumber(metrics.congestionPercentage)}%`} detail="Current live estimate" />
      <Metric label="Throughput" value={`${formatNumber(metrics.throughput, 2)} /s`} detail="Completed per simulation second" />
    </div>
    <div className="chart-grid"><Chart title="Vehicle count over time" data={chartData} dataKey="vehicles" color="#2dd4bf" unit="vehicles" /><Chart title="Average speed over time" data={chartData} dataKey="speed" color="#60a5fa" unit="m/s" /><Chart title="Congestion over time" data={chartData} dataKey="congestion" color="#fbbf24" unit="%" /></div>
    <div className="comparison-grid"><section className="panel analytics-panel"><div className="panel-header"><div><h2>Road-wise traffic</h2><p>Current vehicles and average capacity utilization</p></div></div>{hasData ? <ResponsiveContainer width="100%" height={240}><BarChart data={roadData}><CartesianGrid stroke="#25344a" vertical={false} /><XAxis dataKey="road" stroke="#718198" fontSize={10} /><YAxis stroke="#718198" fontSize={10} /><Tooltip contentStyle={{ background: '#111c2f', border: '1px solid #293852', fontSize: 11 }} /><Bar dataKey="vehicles" fill="#2dd4bf" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}</section><section className="panel analytics-panel"><div className="panel-header"><div><h2>Junction queues</h2><p>Maximum observed queue length</p></div></div>{hasData ? <ResponsiveContainer width="100%" height={240}><BarChart data={queueData}><CartesianGrid stroke="#25344a" vertical={false} /><XAxis dataKey="junction" stroke="#718198" fontSize={10} /><YAxis stroke="#718198" fontSize={10} /><Tooltip contentStyle={{ background: '#111c2f', border: '1px solid #293852', fontSize: 11 }} /><Bar dataKey="queue" fill="#a78bfa" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}</section></div>
    <section className="panel analytics-panel"><div className="panel-header"><div><h2>Road performance</h2><p>Metrics derived from sampled simulation state</p></div></div>{hasData ? <div className="table-wrap"><table><thead><tr><th>Road</th><th>Vehicles</th><th>Utilization</th><th>Avg speed</th><th>Congestion</th></tr></thead><tbody>{report.roadPerformance.map(row => <tr key={row.roadId}><td>{row.roadId}</td><td>{row.vehicleCount}</td><td>{formatNumber(row.utilization)}%</td><td>{formatNumber(row.averageSpeed)} m/s</td><td>{formatNumber(row.congestion)}%</td></tr>)}</tbody></table></div> : <EmptyChart />}</section>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="analytics-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function EmptyChart() { return <div className="chart-empty">No sampled simulation data</div>; }
function Chart({ title, data, dataKey, color, unit }: { title: string; data: Array<Record<string, string | number>>; dataKey: string; color: string; unit: string }) { return <section className="panel analytics-panel"><div className="panel-header"><div><h2>{title}</h2><p>Live simulation samples · {unit}</p></div></div>{data.length ? <ResponsiveContainer width="100%" height={220}><LineChart data={data}><CartesianGrid stroke="#25344a" vertical={false} /><XAxis dataKey="time" stroke="#718198" fontSize={10} /><YAxis stroke="#718198" fontSize={10} /><Tooltip contentStyle={{ background: '#111c2f', border: '1px solid #293852', fontSize: 11 }} /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <EmptyChart />}</section>; }
