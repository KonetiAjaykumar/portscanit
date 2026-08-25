import React from 'react';

interface RadarAnimationProps {
  isScanning: boolean;
  discoveredPortsCount: number;
}

export const RadarAnimation: React.FC<RadarAnimationProps> = ({ isScanning, discoveredPortsCount }) => {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center bg-[#090e1a]/80 rounded-full border border-[#06b6d4]/10 cyber-glow">
      {/* Concentric grid lines */}
      <div className="absolute w-[90%] h-[90%] rounded-full border border-[#06b6d4]/5 border-dashed"></div>
      <div className="absolute w-[70%] h-[70%] rounded-full border border-[#06b6d4]/10"></div>
      <div className="absolute w-[50%] h-[50%] rounded-full border border-[#06b6d4]/5 border-dashed"></div>
      <div className="absolute w-[30%] h-[30%] rounded-full border border-[#06b6d4]/15"></div>

      {/* Radar crosshairs */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[#06b6d4]/10"></div>
      <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#06b6d4]/10"></div>

      {/* Rotating sweep line */}
      {isScanning && (
        <div className="absolute w-1/2 h-1/2 top-0 left-1/2 origin-bottom-left overflow-hidden pointer-events-none animate-radar-sweep">
          <div className="w-full h-full bg-gradient-to-tr from-[#06b6d4]/20 via-[#06b6d4]/5 to-transparent origin-bottom-left -rotate-90"></div>
        </div>
      )}

      {/* Center status display */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={`text-[10px] tracking-widest font-mono uppercase font-bold ${isScanning ? 'text-[#06b6d4] animate-pulse' : 'text-slate-500'}`}>
          {isScanning ? 'SCANNING' : 'STANDBY'}
        </span>
        <span className="text-xl font-bold font-mono text-slate-100 mt-0.5">
          {discoveredPortsCount}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">
          Hits Found
        </span>
      </div>

      {/* Random scanning target dots */}
      {isScanning && (
        <>
          <div className="absolute top-[30%] left-[25%] w-2 h-2 rounded-full bg-[#10b981] animate-ping opacity-75"></div>
          <div className="absolute top-[30%] left-[25%] w-1.5 h-1.5 rounded-full bg-[#10b981]"></div>

          <div className="absolute bottom-[20%] right-[35%] w-2 h-2 rounded-full bg-[#ef4444] animate-ping opacity-60"></div>
          <div className="absolute bottom-[20%] right-[35%] w-1.5 h-1.5 rounded-full bg-[#ef4444]"></div>

          <div className="absolute top-[45%] right-[22%] w-2 h-2 rounded-full bg-[#f59e0b] animate-ping opacity-80"></div>
          <div className="absolute top-[45%] right-[22%] w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></div>
        </>
      )}
    </div>
  );
};
