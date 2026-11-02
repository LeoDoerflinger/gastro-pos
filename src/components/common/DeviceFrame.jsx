import React from 'react';
import { useApp } from '../../context/AppContext';

export default function DeviceFrame({ children }) {
  const { isMobileSimulated, setIsMobileSimulated } = useApp();

  if (!isMobileSimulated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] py-4 px-2 flex flex-col items-center justify-center">
      <div className="mb-3 flex items-center justify-between w-full max-w-[412px] pos-panel px-3.5 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <i className="fa-solid fa-mobile-screen text-[var(--accent-brand)]" aria-hidden="true"></i>
          <span>Vista simulada de celular (390px)</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileSimulated(false)}
          className="pos-btn-secondary text-xs px-3"
        >
          Salir
        </button>
      </div>

      <div className="relative w-full max-w-[412px] h-[844px] bg-[#111315] rounded-[28px] p-2.5 shadow-2xl border-2 border-[var(--border-strong)] flex flex-col overflow-hidden">
        <div className="h-6 px-5 pt-1 text-xs font-mono font-semibold text-[#c2c6ce] flex items-center justify-between z-30 shrink-0 select-none">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex items-center gap-2 text-xs">
            <i className="fa-solid fa-signal" aria-hidden="true"></i>
            <i className="fa-solid fa-wifi" aria-hidden="true"></i>
            <i className="fa-solid fa-battery-full text-[#7be0a8]" aria-hidden="true"></i>
          </div>
        </div>

        <div className="flex-1 rounded-[18px] overflow-y-auto bg-[var(--bg-canvas)] relative flex flex-col no-scrollbar">
          {children}
        </div>

        <div className="h-3 flex items-center justify-center shrink-0">
          <div className="w-28 h-1 bg-[#4b5059] rounded"></div>
        </div>
      </div>
    </div>
  );
}
