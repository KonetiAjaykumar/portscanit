import React, { useEffect, useState } from 'react';
import { 
  Sliders, 
  Activity, 
  CheckCircle, 
  XCircle,
  Save
} from 'lucide-react';

export interface ScanSettings {
  timeoutMs: number;
  concurrencyLimit: number;
}

export const DEFAULT_SETTINGS: ScanSettings = {
  timeoutMs: 1500,
  concurrencyLimit: 50
};

export const loadSettings = (): ScanSettings => {
  try {
    const saved = localStorage.getItem('portscanit_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        timeoutMs: Number(parsed.timeoutMs) || DEFAULT_SETTINGS.timeoutMs,
        concurrencyLimit: Number(parsed.concurrencyLimit) || DEFAULT_SETTINGS.concurrencyLimit
      };
    }
  } catch (e) {
    console.error('Failed to parse settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
};

interface SettingsProps {
  apiOnline: boolean;
  theme?: 'dark' | 'light';
}

export const Settings: React.FC<SettingsProps> = ({ apiOnline, theme }) => {
  const [settings, setSettings] = useState<ScanSettings>(DEFAULT_SETTINGS);
  const [health, setHealth] = useState<{ status: string; uptime: number } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      setHealthLoading(true);
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch (e) {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('portscanit_settings', JSON.stringify(settings));
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 3000);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight font-mono">SETTINGS & DIAGNOSTICS</h2>
          <p className="text-slate-400 text-sm mt-0.5 font-sans">Tune port scanner concurrency limits, network socket timeouts, and check engine health.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Configurations */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
            <Sliders className="w-5 h-5 text-[#06b6d4]" />
            <h3 className="font-bold text-slate-200">Scanner Calibration</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              {/* Timeout Setting */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-sm font-semibold text-slate-300">
                  <span>Connection Timeout (ms)</span>
                  <span className="text-xs text-slate-500 font-mono">Default: 1500ms</span>
                </label>
                <input
                  type="number"
                  min="200"
                  max="10000"
                  value={settings.timeoutMs}
                  onChange={(e) => setSettings({ ...settings, timeoutMs: Number(e.target.value) })}
                  className="w-full bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] rounded-lg px-4 py-2.5 text-slate-200 font-mono text-sm outline-none transition-all"
                />
                <p className="text-xs text-slate-500 leading-normal">
                  The duration the scanner waits for a response before marking the port as <code className="text-amber-500 bg-slate-900 px-1 py-0.5 rounded">FILTERED</code>. Lower values scan faster but may skip slower/highly latent hosts.
                </p>
              </div>

              {/* Concurrency Setting */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-sm font-semibold text-slate-300">
                  <span>Concurrency Limit</span>
                  <span className="text-xs text-slate-500 font-mono">Default: 50 connections</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={settings.concurrencyLimit}
                  onChange={(e) => setSettings({ ...settings, concurrencyLimit: Number(e.target.value) })}
                  className="w-full bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] rounded-lg px-4 py-2.5 text-slate-200 font-mono text-sm outline-none transition-all"
                />
                <p className="text-xs text-slate-500 leading-normal">
                  Max simultaneous socket connections. Higher concurrency speeds up scans significantly, but could exceed local file descriptor limits or trigger destination firewall rate limits.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-[#1e293b] pt-6">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#06b6d4] hover:bg-[#06b6d4]/90 text-[#080c14] rounded-lg font-bold text-sm font-mono tracking-wider transition-all"
              >
                <Save className="w-4 h-4" />
                SAVE CONFIG
              </button>
              {showSavedMsg && (
                <span className="text-xs text-emerald-400 font-mono font-bold animate-pulse">
                  ✓ Config successfully synchronized.
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Diagnostics & Health Status */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
              <Activity className="w-5 h-5 text-[#06b6d4]" />
              <h3 className="font-bold text-slate-200">System Diagnostics</h3>
            </div>

            {healthLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs font-mono text-slate-500 uppercase animate-pulse">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                Ping diagnostics...
              </div>
            ) : health ? (
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]/60">
                  <span className="text-slate-400 font-medium">Core API Server</span>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs uppercase">
                    <CheckCircle className="w-3.5 h-3.5" />
                    ONLINE
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]/60">
                  <span className="text-slate-400 font-medium font-sans">Database Engine</span>
                  <div className="flex items-center gap-1.5 text-[#06b6d4] font-mono font-bold text-xs uppercase">
                    NONE (IN-MEMORY)
                  </div>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400 font-medium">Daemon Uptime</span>
                  <span className="font-mono text-slate-300 text-xs">{formatUptime(health.uptime)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-[#1e293b]/60">
                  <span className="text-slate-400 font-medium">Core API Server</span>
                  <div className="flex items-center gap-1.5 text-red-500 font-mono font-bold text-xs uppercase">
                    <XCircle className="w-3.5 h-3.5" />
                    OFFLINE
                  </div>
                </div>
                <p className="text-xs text-red-400 leading-relaxed font-mono">
                  Could not establish REST connection. Ensure the Node backend service is active.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-[#1e293b] pt-6 flex justify-center">
            <button 
              onClick={fetchHealth}
              className="px-4 py-2 border border-[#1e293b] hover:border-[#06b6d4]/40 hover:bg-[#06b6d4]/5 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-mono font-semibold transition-all duration-200"
            >
              PING DIAGNOSTICS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
