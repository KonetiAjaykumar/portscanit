import React from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area,
  CartesianGrid
} from 'recharts';
import { 
  Activity, 
  ShieldAlert, 
  History,
  Info
} from 'lucide-react';
import { ScanRecord } from '../App';

interface DashboardProps {
  scansHistory: ScanRecord[];
}

export const Dashboard: React.FC<DashboardProps> = ({ scansHistory }) => {
  const hasScans = scansHistory.length > 0;

  // Compute stats dynamically from memory
  const totalScans = scansHistory.length;
  const totalOpen = scansHistory.reduce((acc, curr) => acc + curr.scan.open_ports, 0);
  const totalClosed = scansHistory.reduce((acc, curr) => acc + curr.scan.closed_ports, 0);
  const totalFiltered = scansHistory.reduce((acc, curr) => acc + curr.scan.filtered_ports, 0);
  
  const avgRiskScore = totalScans > 0 
    ? Math.round(scansHistory.reduce((acc, curr) => acc + curr.scan.risk_score, 0) / totalScans) 
    : 0;

  const criticalFindings = scansHistory
    .flatMap(s => s.results)
    .filter(r => r.risk_level === 'Critical' && r.state === 'OPEN')
    .length;

  // Calculate service distribution
  const serviceCounts: Record<string, number> = {};
  scansHistory
    .flatMap(s => s.results)
    .filter(r => r.state === 'OPEN')
    .forEach(r => {
      serviceCounts[r.service] = (serviceCounts[r.service] || 0) + 1;
    });

  const serviceDistribution = Object.entries(serviceCounts)
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Calculate risk distribution
  const riskCounts: Record<string, number> = { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
  scansHistory
    .flatMap(s => s.results)
    .filter(r => r.state === 'OPEN')
    .forEach(r => {
      if (r.risk_level in riskCounts) {
        riskCounts[r.risk_level]++;
      }
    });

  const riskDistribution = Object.entries(riskCounts)
    .map(([name, value]) => ({ name, value }))
    .filter(r => r.value > 0);

  // Get recent scans (chronological for charting)
  const recentScans = scansHistory
    .slice(0, 8)
    .map(s => ({
      id: s.scan.id,
      target: s.scan.target,
      startTime: s.scan.start_time,
      openPorts: s.scan.open_ports,
      riskScore: s.scan.risk_score
    }))
    .reverse();

  // Pie chart formatting for Open vs Closed vs Filtered
  const portStateData = [
    { name: 'Open Ports', value: totalOpen, color: '#10b981' },
    { name: 'Closed Ports', value: totalClosed, color: '#475569' },
    { name: 'Filtered Ports', value: totalFiltered, color: '#f59e0b' }
  ].filter(p => p.value > 0);

  const placeholderPortData = [
    { name: 'No Scan Data', value: 1, color: '#1e293b' }
  ];

  // Risk Distribution Colors
  const riskColors: Record<string, string> = {
    'Critical': '#ef4444',
    'High': '#f97316',
    'Medium': '#eab308',
    'Low': '#10b981'
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 71) return 'text-red-500 border-red-500/20 bg-red-500/5';
    if (score >= 36) return 'text-orange-500 border-orange-500/20 bg-orange-500/5';
    if (score >= 11) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5';
    return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
  };

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto max-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Security Control Center</h2>
          <p className="text-slate-400 text-sm mt-0.5 font-sans">Real-time scan logs, network risk telemetry, and threat distributions (Temporary Session).</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-xs font-semibold font-mono tracking-wider">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          SYS_ONLINE
        </div>
      </div>

      {!hasScans ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-6 max-w-2xl mx-auto my-12 animate-in fade-in duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/20 flex items-center justify-center">
            <Activity className="w-8 h-8 text-[#06b6d4]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-100">Welcome to PortScanIT</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              No cybersecurity scan data is loaded. Head over to the Port Scanner tab to run an authorized target check.
            </p>
          </div>
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg p-4 text-left flex gap-3 max-w-lg mx-auto">
            <Info className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              <strong className="text-yellow-500">Notice:</strong> Data is stored in your browser RAM. Refreshing the browser or closing this window will clear all scan history.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
            {/* Stat Cards */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-slate-700 pointer-events-none">
                <History className="w-12 h-12 opacity-15" />
              </div>
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Total Scans</span>
              <div className="mt-4">
                <span className="text-3xl font-bold font-mono text-slate-100">{totalScans}</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">In-memory records</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl border-l-2 border-emerald-500 flex flex-col justify-between relative overflow-hidden">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Open Ports</span>
              <div className="mt-4">
                <span className="text-3xl font-bold font-mono text-emerald-400">{totalOpen}</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Services exposed</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Closed Ports</span>
              <div className="mt-4">
                <span className="text-3xl font-bold font-mono text-slate-400">{totalClosed}</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Connections refused</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Filtered Ports</span>
              <div className="mt-4">
                <span className="text-3xl font-bold font-mono text-amber-500">{totalFiltered}</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Requests timed out</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl border-l-2 border-red-500 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-red-500/10 pointer-events-none">
                <ShieldAlert className="w-12 h-12" />
              </div>
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Critical Findings</span>
              <div className="mt-4">
                <span className={`text-3xl font-bold font-mono ${criticalFindings > 0 ? 'text-red-500 animate-pulse' : 'text-slate-100'}`}>
                  {criticalFindings}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Exposed critical risks</span>
              </div>
            </div>

            <div className={`glass-panel p-5 rounded-xl border border-l-2 flex flex-col justify-between relative overflow-hidden ${getRiskScoreColor(avgRiskScore)}`}>
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Avg Risk Score</span>
              <div className="mt-4">
                <span className="text-3xl font-bold font-mono">{avgRiskScore}</span>
                <span className="text-[10px] font-mono block mt-1">Normalized severity</span>
              </div>
            </div>
          </div>

          {/* Charts Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel p-5 rounded-xl flex flex-col">
              <h3 className="text-sm font-bold tracking-wider text-slate-300 font-mono uppercase mb-4">Ports Status Telemetry</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portStateData.length > 0 ? portStateData : placeholderPortData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(portStateData.length > 0 ? portStateData : placeholderPortData).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#cbd5e1' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl flex flex-col">
              <h3 className="text-sm font-bold tracking-wider text-slate-300 font-mono uppercase mb-4">Risk Severity Matrix</h3>
              <div className="h-64">
                {riskDistribution.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono uppercase">
                    No open services to calculate severity distribution
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={riskDistribution}
                      margin={{ top: 20, right: 30, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                      <YAxis stroke="#64748b" tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#cbd5e1' }}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar dataKey="value" name="Services Count" fill="#06b6d4">
                        {riskDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={riskColors[entry.name] || '#64748b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl flex flex-col">
              <h3 className="text-sm font-bold tracking-wider text-slate-300 font-mono uppercase mb-4">Top Open Services</h3>
              <div className="h-64">
                {serviceDistribution.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono uppercase">
                    No active services detected in scans
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={serviceDistribution}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" tickLine={false} />
                      <YAxis dataKey="service" type="category" stroke="#64748b" tickLine={false} width={80} style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#cbd5e1' }}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar dataKey="count" name="Count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl flex flex-col">
              <h3 className="text-sm font-bold tracking-wider text-slate-300 font-mono uppercase mb-4">Scan Severity Over Time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={recentScans}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="target" stroke="#64748b" tickFormatter={(v) => v.substring(0, 15)} tickLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#cbd5e1' }}
                    />
                    <Area type="monotone" dataKey="riskScore" name="Risk Score" stroke="#06b6d4" fillOpacity={1} fill="url(#colorRisk)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
