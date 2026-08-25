import React, { useState, useEffect } from 'react';
import { Sidebar, Page } from './components/Sidebar';
import { Scanner } from './pages/Scanner';
import { ScanHistory } from './pages/ScanHistory';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { 
  ShieldCheck, 
  Wifi,
  WifiOff,
  Radar
} from 'lucide-react';

export interface ScanSummary {
  id: string;
  target: string;
  start_port: number;
  end_port: number;
  status: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  ports_scanned: number;
  open_ports: number;
  closed_ports: number;
  filtered_ports: number;
  risk_score: number;
  risk_level: string;
}

export interface ScanResultDetail {
  port: number;
  protocol: string;
  state: 'OPEN' | 'CLOSED' | 'FILTERED';
  service: string;
  banner: string;
  risk_level: string;
  risk_explanation: string;
  recommendation: string;
}

export interface ScanRecord {
  scan: ScanSummary;
  results: ScanResultDetail[];
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('scanner');
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState('');
  const [apiOnline, setApiOnline] = useState(true);

  // Lifted Scan History state (ephemeral, stored in browser RAM)
  const [scansHistory, setScansHistory] = useState<ScanRecord[]>([]);

  // Poll API health status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setApiOnline(true);
        } else {
          setApiOnline(false);
        }
      } catch (e) {
        setApiOnline(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenScan = (scanId: string) => {
    setCurrentPage('reports');
    sessionStorage.setItem('portscanit_view_scan_id', scanId);
  };

  const handleScanComplete = (record: ScanRecord) => {
    setScansHistory(prev => [record, ...prev]);
  };

  const handleDeleteScan = (scanId: string) => {
    setScansHistory(prev => prev.filter(item => item.scan.id !== scanId));
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'scanner':
        return (
          <Scanner 
            isScanning={isScanning} 
            setIsScanning={setIsScanning} 
            scanTarget={scanTarget}
            setScanTarget={setScanTarget}
            onScanComplete={handleScanComplete}
            scansHistory={scansHistory}
          />
        );
      case 'history':
        return (
          <ScanHistory 
            scansHistory={scansHistory} 
            onOpenScan={handleOpenScan} 
            onDeleteScan={handleDeleteScan}
          />
        );
      case 'reports':
        return <Reports scansHistory={scansHistory} />;
      case 'settings':
        return <Settings apiOnline={apiOnline} />;
      default:
        return (
          <Scanner 
            isScanning={isScanning} 
            setIsScanning={setIsScanning} 
            scanTarget={scanTarget}
            setScanTarget={setScanTarget}
            onScanComplete={handleScanComplete}
            scansHistory={scansHistory}
          />
        );
    }
  };

  return (
    <div className="flex bg-[#080c14] min-h-screen text-slate-100 font-sans selection:bg-[#06b6d4] selection:text-[#080c14] overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} isScanning={isScanning} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Status Header */}
        <header className="h-16 border-b border-[#1e293b] bg-[#090e1a]/85 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] tracking-widest font-mono uppercase font-bold text-slate-500">CONSOLE</span>
            <div className="h-4 w-[1px] bg-[#1e293b]"></div>
            <h2 className="text-sm font-semibold font-mono tracking-wide text-slate-300 capitalize">
              {currentPage.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-5 text-xs font-mono">
            {/* Active Scanning Status Banner */}
            {isScanning ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full animate-pulse">
                <Radar className="w-3.5 h-3.5 animate-spin" />
                <span>SCAN_RUNNING: {scanTarget}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/40 border border-slate-700/20 text-slate-400 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SCANNER_STANDBY</span>
              </div>
            )}

            {/* API Server status indicator */}
            {apiOnline ? (
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/10">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>API_CONNECTED</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-red-500 font-bold bg-red-500/5 px-2.5 py-1 rounded-full border border-red-500/10">
                <WifiOff className="w-3.5 h-3.5 text-red-500" />
                <span>API_OFFLINE</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Body Router */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
