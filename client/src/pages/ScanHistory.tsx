import React, { useState } from 'react';
import { 
  History, 
  Trash2, 
  Eye, 
  Calendar, 
  Clock, 
  Search
} from 'lucide-react';
import { ScanRecord as AppScanRecord } from '../App';

interface ScanHistoryProps {
  scansHistory: AppScanRecord[];
  onOpenScan: (scanId: string) => void;
  onDeleteScan: (scanId: string) => void;
  theme?: 'dark' | 'light';
}

export const ScanHistory: React.FC<ScanHistoryProps> = ({ 
  scansHistory, 
  onOpenScan, 
  onDeleteScan,
  theme
}) => {
  const [search, setSearch] = useState('');

  const scans = scansHistory.map(item => item.scan);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid triggering details select
    if (!confirm('Are you sure you want to delete this scan from history?')) return;
    onDeleteScan(id);
  };

  const getRiskColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL':
        return 'text-red-500 border-red-500/20 bg-red-500/5';
      case 'HIGH':
        return 'text-orange-500 border-orange-500/20 bg-orange-500/5';
      case 'MEDIUM':
        return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5';
      default:
        return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
    }
  };

  const filteredScans = scans.filter(s => 
    s.target.toLowerCase().includes(search.toLowerCase()) ||
    s.risk_level.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight font-mono">SCAN ARCHIVE</h2>
          <p className="text-slate-400 text-xs md:text-sm mt-0.5">Browse, inspect, or manage previously executed port scanning operations.</p>
        </div>
      </div>

      {scans.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl text-center space-y-4 max-w-lg mx-auto">
          <History className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">Archive is Empty</h3>
          <p className="text-slate-500 text-sm">No historical records are recorded. Scans will be registered here upon completion.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by target or risk level..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#090f1d] border border-[#1e293b] focus:border-[#06b6d4] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-300 outline-none transition-all"
            />
          </div>

          {/* Grid Layout of Scan Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-200">
            {filteredScans.map((scan) => (
              <div
                key={scan.id}
                onClick={() => onOpenScan(scan.id)}
                className="glass-panel hover:glass-panel-accent p-5 rounded-xl flex flex-col justify-between gap-5 border border-[#1e293b] hover:border-[#06b6d4]/30 cursor-pointer transition-all duration-200 group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-200 group-hover:text-[#06b6d4] transition-colors">{scan.target}</h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(scan.start_time).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono tracking-wider border uppercase ${getRiskColor(scan.risk_level)}`}>
                    {scan.risk_level || 'Low'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#080d1a]/60 border border-[#1e293b]/50 rounded-lg p-3 text-xs font-mono text-center">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Duration</span>
                    <span className="text-slate-300 font-bold flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {scan.duration || 0}s
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Scanned</span>
                    <span className="text-slate-300 font-bold block mt-0.5">{scan.ports_scanned}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Open Hits</span>
                    <span className="text-emerald-400 font-bold block mt-0.5">{scan.open_ports}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-[#1e293b]/60 pt-3">
                  <div className="text-[10px] text-slate-500 font-mono">
                    ID: <span className="text-slate-400">{scan.id.substring(0, 8)}...</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenScan(scan.id)}
                      className="p-2 text-slate-400 hover:text-[#06b6d4] hover:bg-[#06b6d4]/10 rounded-lg transition-colors border border-transparent hover:border-[#06b6d4]/20"
                      title="Inspect results"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, scan.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
