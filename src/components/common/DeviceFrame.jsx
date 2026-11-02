import React from 'react';
import { useApp } from '../../context/AppContext';

export default function DeviceFrame({ children }) {
  const { isMobileSimulated, setIsMobileSimulated } = useApp();

  if (!isMobileSimulated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#09090b] py-4 px-2 flex flex-col items-center justify-center">
      {/* Simulator top control banner */}
      <div className="mb-2.5 flex items-center justify-between w-full max-w-[400px] bg-[#121215] px-3.5 py-1.5 rounded-sm border border-[#27272a] text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-mobile-screen text-zinc-400 text-xs" aria-hidden="true"></i>
          <span className="font-mono text-[11px] uppercase tracking-wider">Simulador Celular</span>
        </div>
        <button
          onClick={() => setIsMobileSimulated(false)}
          className="text-zinc-200 hover:text-white font-mono text-[11px] uppercase tracking-wider"
        >
          Cerrar
        </button>
      </div>

      {/* Smartphone Bezel */}
      <div className="relative w-full max-w-[400px] h-[840px] bg-[#000000] rounded-[36px] p-2.5 shadow-2xl border-2 border-[#27272a] flex flex-col overflow-hidden">
        {/* Dynamic Island / Notch */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-40 flex items-center justify-end px-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#18181c]"></div>
        </div>

        {/* Status Bar */}
        <div className="h-6 px-6 pt-1 text-[10px] font-mono font-bold text-zinc-400 flex items-center justify-between z-30 shrink-0 select-none tabular-nums">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
            <i className="fa-solid fa-signal" aria-hidden="true"></i>
            <i className="fa-solid fa-wifi" aria-hidden="true"></i>
            <i className="fa-solid fa-battery-full text-emerald-400" aria-hidden="true"></i>
          </div>
        </div>

        {/* Screen Content Wrapper */}
        <div className="flex-1 rounded-[24px] overflow-y-auto bg-[#09090b] relative flex flex-col no-scrollbar">
          {children}
        </div>

        {/* Home Indicator */}
        <div className="h-3 flex items-center justify-center shrink-0">
          <div className="w-28 h-1 bg-zinc-700 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
