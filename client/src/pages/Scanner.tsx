import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Search, 
  AlertTriangle, 
  Clock,
  ShieldCheck,
  ChevronRight,
  X,
  History,
  ShieldAlert
} from 'lucide-react';
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
  Legend 
} from 'recharts';
import { RadarAnimation } from '../components/RadarAnimation';
import { loadSettings } from './Settings';
import { ScanRecord } from '../App';

interface ScanProgress {
  scannedCount: number;
  openCount: number;
  closedCount: number;
  filteredCount: number;
  currentPort: number;
  elapsedTime: number; // ms
}

interface ScanResult {
  port: number;
  protocol: string;
  state: 'OPEN' | 'CLOSED' | 'FILTERED';
  service: string;
  banner: string;
  risk_level?: string;
  risk_explanation?: string;
  recommendation?: string;
}

interface ScannerProps {
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  scanTarget: string;
  setScanTarget: (target: string) => void;
  onScanComplete: (record: ScanRecord) => void;
  scansHistory: ScanRecord[];
}

export const Scanner: React.FC<ScannerProps> = ({
  isScanning,
  setIsScanning,
  scanTarget,
  setScanTarget,
  onScanComplete,
  scansHistory
}) => {
  // Inputs
  const [target, setTarget] = useState('127.0.0.1');
  const [rangePreset, setRangePreset] = useState<'top100' | 'system' | 'full' | 'custom'>('top100');
  const [startPort, setStartPort] = useState(1);
  const [endPort, setEndPort] = useState(1024);

  // Scanner States
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress>({
    scannedCount: 0,
    openCount: 0,
    closedCount: 0,
    filteredCount: 0,
    currentPort: 0,
    elapsedTime: 0
  });

  const [results, setResults] = useState<ScanResult[]>([]);
  const [totalPortsToScan, setTotalPortsToScan] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'FILTERED'>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'Critical' | 'High' | 'Medium' | 'Low'>('ALL');
  const [sortBy, setSortBy] = useState<'port' | 'risk'>('port');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const settings = loadSettings();

  const top100Ports = [
    20, 21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 993, 995, 1433, 1521, 2049, 3306, 3389, 5432, 5900, 6379, 8080, 8443
  ];

  const getPortsList = (): { start: number; end: number; custom?: number[] } => {
    if (rangePreset === 'top100') {
      return { start: 20, end: 8080, custom: top100Ports };
    }
    if (rangePreset === 'system') {
      return { start: 1, end: 1024 };
    }
    if (rangePreset === 'full') {
      return { start: 1, end: 65535 };
    }
    return { start: Number(startPort), end: Number(endPort) };
  };

  const handleStartScan = async () => {
    if (isScanning) return;
    setResults([]);
    setSelectedResult(null);
    setProgress({
      scannedCount: 0,
      openCount: 0,
      closedCount: 0,
      filteredCount: 0,
      currentPort: 0,
      elapsedTime: 0
    });

    const targetScope = getPortsList();
    const payload: any = {
      target: target.trim(),
      timeout: settings.timeoutMs,
      concurrency: settings.concurrencyLimit
    };

    if (targetScope.custom) {
      payload.customPorts = targetScope.custom;
      setTotalPortsToScan(targetScope.custom.length);
    } else {
      payload.startPort = targetScope.start;
      payload.endPort = targetScope.end;
      setTotalPortsToScan(targetScope.end - targetScope.start + 1);
    }

    try {
      setIsScanning(true);
      setScanTarget(target.trim());
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initiate scanning worker');
      }

      const scanObj = await res.json();
      setActiveScanId(scanObj.id);

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setProgress(prev => ({
          ...prev,
          elapsedTime: Date.now() - startTimeRef.current
        }));
      }, 100);

      connectSSEStream(scanObj.id);
    } catch (e: any) {
      alert(e.message);
      setIsScanning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const connectSSEStream = (scanId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/scans/${scanId}/stream`);
    eventSourceRef.current = sse;

    sse.addEventListener('init', (e: any) => {
      const data = JSON.parse(e.data);
      setProgress(data.progress);
    });

    sse.addEventListener('progress', (e: any) => {
      const data = JSON.parse(e.data);
      setProgress(prev => ({ ...prev, ...data }));
    });

    sse.addEventListener('port', (e: any) => {
      const portRes = JSON.parse(e.data);
      setResults(prev => {
        if (prev.some(r => r.port === portRes.port)) return prev;
        return [...prev, portRes];
      });
    });

    sse.addEventListener('completed', (e: any) => {
      const data = JSON.parse(e.data);
      const sortedResults = data.results.sort((a: any, b: any) => a.port - b.port);
      setResults(sortedResults);
      onScanComplete({ scan: data.scan, results: data.results });
      cleanupScanning();
    });

    sse.addEventListener('error', (e: any) => {
      console.error('SSE connection interrupted', e);
      cleanupScanning();
    });
  };

  const handleStopScan = async () => {
    if (!activeScanId) return;
    try {
      await fetch(`/api/scans/${activeScanId}/stop`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      cleanupScanning();
    }
  };

  const cleanupScanning = () => {
    setIsScanning(false);
    setActiveScanId(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- Dashboard aggregates calculations ---
  const hasHistory = scansHistory.length > 0;
  const totalScans = scansHistory.length;
  const totalOpen = scansHistory.reduce((acc, s) => acc + s.scan.open_ports, 0);
  const totalClosed = scansHistory.reduce((acc, s) => acc + s.scan.closed_ports, 0);
  const totalFiltered = scansHistory.reduce((acc, s) => acc + s.scan.filtered_ports, 0);

  const avgRiskScore = totalScans > 0 
    ? Math.round(scansHistory.reduce((acc, s) => acc + s.scan.risk_score, 0) / totalScans)
    : 0;

  const criticalFindings = scansHistory
    .flatMap(s => s.results)
    .filter(r => r.risk_level === 'Critical' && r.state === 'OPEN')
    .length;

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

  const portStateData = [
    { name: 'Open Ports', value: totalOpen, color: '#10b981' },
    { name: 'Closed Ports', value: totalClosed, color: '#475569' },
    { name: 'Filtered Ports', value: totalFiltered, color: '#f59e0b' }
  ].filter(p => p.value > 0);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const msRemainder = Math.floor((ms % 1000) / 100);
    return `${s}.${msRemainder}s`;
  };

  const getRiskColor = (level?: string) => {
    if (!level) return 'text-slate-400';
    switch (level.toUpperCase()) {
      case 'CRITICAL': return 'text-red-500 font-bold bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded text-[10px]';
      case 'HIGH': return 'text-orange-500 font-bold bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded text-[10px]';
      case 'MEDIUM': return 'text-yellow-500 font-bold bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded text-[10px]';
      default: return 'text-emerald-500 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 71) return 'text-red-500 border-red-500/20 bg-red-500/5';
    if (score >= 36) return 'text-orange-500 border-orange-500/20 bg-orange-500/5';
    if (score >= 11) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5';
    return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
  };

  // Sorting & Filtering logic
  const filteredResults = results
    .filter(r => {
      const searchMatch = 
        r.port.toString().includes(searchTerm) ||
        r.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.banner.toLowerCase().includes(searchTerm.toLowerCase());
      
      const stateMatch = stateFilter === 'ALL' || r.state === stateFilter;
      const riskMatch = riskFilter === 'ALL' || r.risk_level === riskFilter;

      return searchMatch && stateMatch && riskMatch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'port') {
        comparison = a.port - b.port;
      } else {
        const riskWeights: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        const wA = riskWeights[a.risk_level || 'Low'] || 0;
        const wB = riskWeights[b.risk_level || 'Low'] || 0;
        comparison = wA - wB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const triggerSort = (field: 'port' | 'risk') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full relative">
      {/* Scrollable Main Area */}
      <div className="flex-1 p-8 overflow-y-auto space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          
          {/* Top Panel: Control Center Header */}
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight font-mono">SOC CONSOLE & SCANNER</h2>
              <p className="text-slate-400 text-sm mt-0.5">Start sweeps on targets and analyze security risk distribution in a single dashboard.</p>
            </div>
            <div className="text-xs text-yellow-500 font-mono flex items-center gap-1 bg-yellow-500/5 px-3 py-1.5 rounded-full border border-yellow-500/10">
              <ShieldAlert className="w-3.5 h-3.5" />
              AUTHORIZED TARGETS ONLY
            </div>
          </div>

          {/* Scanner Setup Configurations (Full-Width Stacked Console Card) */}
          <div className="glass-panel p-6 rounded-xl border border-[#1e293b] hover:border-[#06b6d4]/10 transition-all w-full space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 tracking-wider font-mono">TARGET ENDPOINT</label>
              <input
                type="text"
                placeholder="127.0.0.1 or example.com"
                value={target}
                disabled={isScanning}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] rounded-lg px-4 py-2.5 text-slate-200 font-mono text-sm outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 tracking-wider font-mono">PORT PRESETS</label>
              <select
                value={rangePreset}
                disabled={isScanning}
                onChange={(e: any) => setRangePreset(e.target.value)}
                className="w-full bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] rounded-lg px-3 py-2.5 text-slate-300 font-mono text-sm outline-none transition-all"
              >
                <option value="top100">Top 100 Common Ports</option>
                <option value="system">Ports 1 – 1024</option>
                <option value="full">Full Range (1 – 65535)</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {rangePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 font-mono">START</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={startPort}
                    disabled={isScanning}
                    onChange={(e) => setStartPort(Number(e.target.value))}
                    className="w-full bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] rounded-lg px-3 py-2 text-slate-200 font-mono text-sm outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 font-mono">END</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={endPort}
                    disabled={isScanning}
                    onChange={(e) => setEndPort(Number(e.target.value))}
                    className="w-full bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] rounded-lg px-3 py-2 text-slate-200 font-mono text-sm outline-none"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              {isScanning ? (
                <button
                  onClick={handleStopScan}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-slate-955 font-bold rounded-lg text-sm font-mono tracking-wider transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current animate-pulse" />
                  ABORT SCAN
                </button>
              ) : (
                <button
                  onClick={handleStartScan}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#06b6d4] hover:bg-[#06b6d4]/90 text-[#080c14] font-bold rounded-lg text-sm font-mono tracking-wider transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  START SCAN
                </button>
              )}
            </div>
          </div>

          {/* Embedded Dashboard Panel: Shows stats only if history records exist */}
          {hasHistory && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <span className="text-[10px] tracking-widest font-mono uppercase font-bold text-slate-500">AGGREGATE TELEMETRY</span>
                <span className="text-[9px] font-mono text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/20 px-2 py-0.5 rounded">SESSION_ACTIVE</span>
              </div>

              {/* Stats widgets */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-xl border border-[#1e293b] hover:border-[#06b6d4]/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.05)] transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 text-slate-700 pointer-events-none group-hover:text-[#06b6d4]/10 transition-colors">
                    <History className="w-10 h-10 opacity-15" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono">Total Scans</span>
                  <div className="mt-4">
                    <span className="text-3xl font-bold font-mono text-slate-100">{totalScans}</span>
                    <span className="text-[9px] text-slate-500 font-mono block mt-1">Temporary memory</span>
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-xl border border-[#1e293b] hover:border-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.05)] border-l-2 border-l-emerald-500 transition-all duration-300 flex flex-col justify-between group">
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono">Open Ports (Hits)</span>
                  <div className="mt-4">
                    <span className="text-3xl font-bold font-mono text-emerald-400">{totalOpen}</span>
                    <span className="text-[9px] text-slate-500 font-mono block mt-1">Exposed interfaces</span>
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-xl border border-[#1e293b] hover:border-red-500/25 hover:shadow-[0_0_15px_rgba(239,68,68,0.08)] border-l-2 border-l-red-500 transition-all duration-300 flex flex-col justify-between group">
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono">Critical Risks</span>
                  <div className="mt-4">
                    <span className={`text-3xl font-bold font-mono ${criticalFindings > 0 ? 'text-red-500 animate-pulse' : 'text-slate-100'}`}>
                      {criticalFindings}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono block mt-1">Urgent patch advisories</span>
                  </div>
                </div>

                <div className={`glass-panel p-5 rounded-xl border border-[#1e293b] border-l-2 transition-all duration-300 flex flex-col justify-between group ${getRiskScoreColor(avgRiskScore)}`}>
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono">Avg Risk Score</span>
                  <div className="mt-4">
                    <span className="text-3xl font-bold font-mono">{avgRiskScore}</span>
                    <span className="text-[9px] font-mono block mt-1 uppercase opacity-60">Normalized index</span>
                  </div>
                </div>
              </div>

              {/* Dashboard charts row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-5 rounded-xl border border-[#1e293b] hover:border-[#06b6d4]/10 transition-colors flex flex-col justify-between bg-[#0c1220]/40">
                  <div className="flex items-center justify-between mb-4 border-b border-[#1e293b]/60 pb-2">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-300 font-mono uppercase">Port Status Telemetry</h4>
                    <span className="text-[9px] text-slate-500 font-mono">STATE_PIE</span>
                  </div>
                  <div className="h-48 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portStateData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                          stroke="#080c14"
                          strokeWidth={3}
                          dataKey="value"
                        >
                          {portStateData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f1626', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                          itemStyle={{ color: '#cbd5e1' }}
                        />
                        <Legend verticalAlign="bottom" height={24} iconType="circle" style={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-xl border border-[#1e293b] hover:border-[#06b6d4]/10 transition-colors flex flex-col justify-between bg-[#0c1220]/40">
                  <div className="flex items-center justify-between mb-4 border-b border-[#1e293b]/60 pb-2">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-300 font-mono uppercase">Top Exposed Services</h4>
                    <span className="text-[9px] text-slate-500 font-mono">FREQUENCY_BAR</span>
                  </div>
                  <div className="h-48">
                    {serviceDistribution.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[10px] text-slate-500 font-mono uppercase">
                        No open ports detected
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={serviceDistribution}
                          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="serviceBarGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.95}/>
                              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.15}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="service" stroke="#64748b" style={{ fontSize: '10px' }} tickLine={false} />
                          <YAxis stroke="#64748b" style={{ fontSize: '10px' }} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f1626', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                            itemStyle={{ color: '#cbd5e1' }}
                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                          />
                          <Bar dataKey="count" fill="url(#serviceBarGrad)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Scan Progress tracker card */}
          {(isScanning || progress.scannedCount > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className="glass-panel p-4 rounded-xl flex items-center justify-center md:col-span-1">
                <RadarAnimation isScanning={isScanning} discoveredPortsCount={progress.openCount} />
              </div>

              <div className="md:col-span-3 glass-panel p-4 rounded-xl flex flex-col justify-between gap-4">
                <div className="flex justify-between items-start border-b border-[#1e293b] pb-2">
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono tracking-wider uppercase">ACTIVE AUDIT TARGET</span>
                    <h4 className="font-bold text-slate-200 font-mono mt-0.5">{scanTarget || target}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 font-mono tracking-wider uppercase">DURATION</span>
                    <div className="flex items-center gap-1 text-slate-300 font-bold font-mono mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDuration(progress.elapsedTime)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      Scanned: <strong className="text-slate-300">{progress.scannedCount}</strong> / {totalPortsToScan}
                    </span>
                    {isScanning && (
                      <span className="text-slate-500">
                        Checking port <code className="text-[#06b6d4] font-bold">{progress.currentPort}</code>
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-[#080c14] rounded-full h-2 overflow-hidden border border-[#1e293b]">
                    <div 
                      className="bg-gradient-to-r from-[#06b6d4] to-cyan-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${totalPortsToScan > 0 ? (progress.scannedCount / totalPortsToScan) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono pt-1">
                  <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded p-1.5 text-emerald-400">
                    <span className="text-[9px] text-slate-500 block uppercase">OPEN</span>
                    <span className="text-base font-bold">{progress.openCount}</span>
                  </div>
                  <div className="bg-slate-800/10 border border-slate-700/20 rounded p-1.5 text-slate-400">
                    <span className="text-[9px] text-slate-500 block uppercase">CLOSED</span>
                    <span className="text-base font-bold">{progress.closedCount}</span>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded p-1.5 text-amber-500">
                    <span className="text-[9px] text-slate-500 block uppercase">FILTERED</span>
                    <span className="text-base font-bold">{progress.filteredCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Grid Table */}
          {results.length > 0 && (
            <div className="glass-panel rounded-xl overflow-hidden flex flex-col animate-in fade-in duration-300">
              <div className="p-4 border-b border-[#1e293b] flex flex-wrap gap-4 items-center justify-between bg-[#0b1222]/30">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search results..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] text-xs rounded-lg pl-9 pr-3 py-2 text-slate-300 outline-none w-48 transition-all"
                    />
                  </div>

                  <select
                    value={stateFilter}
                    onChange={(e: any) => setStateFilter(e.target.value)}
                    className="bg-[#080c14] border border-[#1e293b] text-xs text-slate-400 rounded-lg px-2 py-2 outline-none"
                  >
                    <option value="ALL">All States</option>
                    <option value="OPEN">Open</option>
                    <option value="CLOSED">Closed</option>
                    <option value="FILTERED">Filtered</option>
                  </select>

                  <select
                    value={riskFilter}
                    onChange={(e: any) => setRiskFilter(e.target.value)}
                    className="bg-[#080c14] border border-[#1e293b] text-xs text-slate-400 rounded-lg px-2 py-2 outline-none"
                  >
                    <option value="ALL">All Risks</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="text-xs font-mono text-slate-500">
                  Showing <strong className="text-slate-300">{filteredResults.length}</strong> of {results.length} ports
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1e293b] bg-slate-900/40 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th onClick={() => triggerSort('port')} className="px-5 py-3 cursor-pointer hover:text-slate-200 transition-colors">
                        Port {sortBy === 'port' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-5 py-3">Protocol</th>
                      <th className="px-5 py-3">State</th>
                      <th className="px-5 py-3">Service</th>
                      <th className="px-5 py-3">Banner Grabbed</th>
                      <th onClick={() => triggerSort('risk')} className="px-5 py-3 cursor-pointer hover:text-slate-200 transition-colors">
                        Risk Rating {sortBy === 'risk' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-5 py-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]/60">
                    {filteredResults.map((item, idx) => (
                      <tr 
                        key={idx}
                        onClick={() => setSelectedResult(item)}
                        className="hover:bg-slate-800/20 cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-3.5 text-slate-200 font-bold">{item.port}</td>
                        <td className="px-5 py-3.5 text-slate-400">{item.protocol || 'TCP'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.state === 'OPEN' ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/20' :
                            item.state === 'CLOSED' ? 'text-slate-400 bg-slate-800/10' :
                            'text-amber-500 bg-amber-500/5'
                          }`}>
                            {item.state}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 font-semibold">{item.service}</td>
                        <td className="px-5 py-3.5 text-slate-500 truncate max-w-xs">{item.banner || 'Not detected'}</td>
                        <td className="px-5 py-3.5">
                          <span className={getRiskColor(item.risk_level)}>
                            {item.risk_level || 'Low'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#06b6d4] transition-colors inline-block" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Port Details Drawer Panel */}
      {selectedResult && (
        <div className="w-96 bg-[#0a0f1d] border-l border-[#1e293b] flex flex-col shrink-0 h-full sticky top-0 animate-in slide-in-from-right duration-200 z-10">
          <div className="h-16 flex items-center justify-between px-6 border-b border-[#1e293b] bg-[#0b132b]/40">
            <h3 className="font-bold text-slate-200 font-mono tracking-wide">PORT ADVISORY</h3>
            <button 
              onClick={() => setSelectedResult(null)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="space-y-1.5 border-b border-[#1e293b] pb-4">
              <div className="flex justify-between items-center">
                <span className="text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
                  {selectedResult.port}
                </span>
                <span className="text-slate-400 text-xs font-mono tracking-wide">
                  {selectedResult.protocol || 'TCP'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono uppercase">Service Detected: <strong className="text-slate-300">{selectedResult.service}</strong></p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Severity Rating</span>
              <div>
                <span className={getRiskColor(selectedResult.risk_level)}>
                  {selectedResult.risk_level || 'Low'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Banner Grabbed</span>
              <div className="bg-[#080c14] border border-[#1e293b]/60 rounded-lg p-3 text-xs font-mono text-slate-300 break-all whitespace-pre-wrap leading-relaxed">
                {selectedResult.banner || 'Not detected'}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Security Explanation</span>
              <p className="text-xs text-slate-400 leading-relaxed">
                {selectedResult.risk_explanation || `An open port was detected running the '${selectedResult.service}' service. Exposing unnecessary ports increases the target host's network attack surface.`}
              </p>
            </div>

            <div className="space-y-2 border-t border-[#1e293b] pt-5">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Mitigation Advisory</span>
              <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-4 text-left flex gap-3 text-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-slate-400 leading-normal">
                  {selectedResult.recommendation || 'Verify if this port is required. If not, restrict exposure using local firewall rules.'}
                </p>
              </div>
            </div>

            <div className="space-y-3.5 border-t border-[#1e293b] pt-5">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Risk Methodology & Scoring</span>
              <div className="bg-[#080d1a] border border-[#1e293b] rounded-lg p-3 text-[11px] space-y-2 font-mono">
                <p className="text-slate-400 leading-relaxed font-sans">
                  The overall risk level of the target host is computed deterministically by scanning open services and accumulating severity points:
                </p>
                <div className="space-y-1 text-slate-300">
                  <div className="flex justify-between border-b border-[#1e293b]/40 pb-1">
                    <span>Critical Risk Ports (e.g. 23, 445, 6379)</span>
                    <span className="text-red-500 font-bold">+35 pts</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1e293b]/40 py-1">
                    <span>High Risk Ports (e.g. 21, 3306, 3389)</span>
                    <span className="text-orange-500 font-bold">+20 pts</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1e293b]/40 py-1">
                    <span>Medium Risk Ports (e.g. 22, 25)</span>
                    <span className="text-yellow-500 font-bold">+10 pts</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Low Risk Ports (e.g. 80, 443)</span>
                    <span className="text-emerald-400 font-bold">+2 pts</span>
                  </div>
                </div>
                <div className="border-t border-[#1e293b] pt-2 text-[10px] text-slate-400 font-sans space-y-1">
                  <p><strong>Grade Thresholds:</strong></p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                    <li><span className="text-emerald-400">Low Risk:</span> 0 - 10 points</li>
                    <li><span className="text-yellow-500">Medium Risk:</span> 11 - 35 points</li>
                    <li><span className="text-orange-500">High Risk:</span> 36 - 70 points</li>
                    <li><span className="text-red-500">Critical Risk:</span> 71 - 100 points</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
