import React from 'react';
import { 
  Radar, 
  History, 
  FileSpreadsheet, 
  Settings as SettingsIcon,
  ShieldAlert
} from 'lucide-react';

export type Page = 'scanner' | 'history' | 'reports' | 'settings';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isScanning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, 
  setCurrentPage, 
  isScanning
}) => {
  interface MenuItem {
    readonly id: Page;
    readonly label: string;
    readonly icon: React.ComponentType<any>;
    readonly badge?: boolean;
  }

  const menuItems: readonly MenuItem[] = [
    { id: 'scanner', label: 'Port Scanner', icon: Radar, badge: isScanning },
    { id: 'history', label: 'Scan History', icon: History },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-[#1e293b] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#1e293b] bg-[#0b132b]/40">
          <img src="/logo.jpg" alt="PortScanIT Logo" className="w-9 h-9 rounded-lg border border-slate-700 object-cover shrink-0" />
          <div>
            <h1 className="font-bold text-lg tracking-wider text-slate-100 uppercase">
              PortScan<span className="text-[#06b6d4]">IT</span>
            </h1>
            <span className="text-[10px] text-[#06b6d4] font-mono tracking-widest block -mt-1 font-bold">
              v1.0.0 SECURE
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5 mt-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#06b6d4]/20 to-[#06b6d4]/5 border-l-2 border-[#06b6d4] text-[#06b6d4] shadow-lg shadow-[#06b6d4]/5'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive 
                      ? 'text-[#06b6d4]' 
                      : 'text-slate-400 group-hover:text-slate-300'
                  }`} />
                  <span>{item.label}</span>
                </div>
                
                {item.badge && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]"></span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Warnings & Security Advisory */}
      <div className="p-4 m-4 rounded-lg bg-[#0f172a]/80 border border-[#1e293b]/60">
        <p className="text-[10px] uppercase font-bold text-[#f59e0b] tracking-wider mb-1 font-mono">
          Security Advisory
        </p>
        <p className="text-[10px] text-slate-400 leading-normal">
          Authorized Security Testing Only. Exposing systems without consent is prohibited.
        </p>
      </div>
    </aside>
  );
};
