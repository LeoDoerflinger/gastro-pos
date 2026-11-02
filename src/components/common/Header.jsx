import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Header() {
  const { 
    currentUser, 
    activeTab, 
    setIsSidebarOpen, 
    setIsPinModalOpen,
    activeShift,
    isMobileSimulated,
    setIsMobileSimulated
  } = useApp();

  const isMozo = currentUser.role === 'mozo';

  const viewTitles = {
    mesas: 'Salón & Mesas',
    caja: 'Caja & Cobros',
    arqueo: 'Arqueo de Caja',
    delivery: 'Delivery & Take Away',
    stock_purchases: 'Facturas / Proveedores',
    recetario: 'Recetario & Escandallos',
    stock_control: 'Control de Stock',
    ventas: 'Ventas & Analítica',
    config: 'Configuración'
  };

  const roleStyles = {
    admin: 'bg-zinc-800 text-zinc-100 border-zinc-600',
    cajero: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    mozo: 'bg-zinc-800 text-zinc-300 border-zinc-700'
  }[currentUser.role] || 'bg-zinc-800 text-zinc-300 border-zinc-700';

  const userIcon = currentUser.avatar?.startsWith('fa-') 
    ? currentUser.avatar 
    : (currentUser.role === 'admin' ? 'fa-solid fa-user-shield' : currentUser.role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie');

  return (
    <header className="bg-[#121215] border-b border-[#27272a] sticky top-0 z-30 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
        {/* Left: Menu Toggle & Title */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir menú de navegación"
            className="w-8 h-8 rounded bg-[#18181c] hover:bg-zinc-800 border border-[#27272a] text-zinc-300 hover:text-white transition-colors flex items-center justify-center active:scale-95"
          >
            <i className="fa-solid fa-bars text-sm" aria-hidden="true"></i>
          </button>

          <div className="flex items-baseline gap-2">
            <span className="font-extrabold text-xs tracking-wider uppercase text-zinc-100 hidden sm:inline font-mono">
              GASTRO<span className="text-zinc-500 font-normal">POS</span>
            </span>
            <span className="text-zinc-700 hidden sm:inline text-xs">/</span>
            <h1 className="font-bold text-xs sm:text-sm text-zinc-200 tracking-tight">
              {viewTitles[activeTab] || 'Salón & Mesas'}
            </h1>
          </div>
        </div>

        {/* Right: Shift status + Device simulator + User Pill */}
        <div className="flex items-center gap-2">
          {/* Shift status indicator */}
          {!isMozo && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-[#18181c] border border-[#27272a] text-[11px] font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${activeShift ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className="text-zinc-500">Caja:</span>
              <span className={activeShift ? 'text-zinc-200 font-bold' : 'text-zinc-500 font-bold'}>
                {activeShift ? `#${activeShift.shiftNumber}` : 'Cerrada'}
              </span>
            </div>
          )}

          {/* Device Frame Simulator Toggle */}
          <button
            onClick={() => setIsMobileSimulated(!isMobileSimulated)}
            aria-label={isMobileSimulated ? "Volver a pantalla completa" : "Simular pantalla móvil"}
            className="hidden sm:flex w-8 h-8 rounded bg-[#18181c] hover:bg-zinc-800 border border-[#27272a] text-zinc-400 hover:text-zinc-200 items-center justify-center transition-colors"
          >
            <i className={`fa-solid ${isMobileSimulated ? 'fa-desktop text-zinc-200' : 'fa-mobile-screen text-zinc-400'} text-xs`} aria-hidden="true"></i>
          </button>

          {/* Active User Switcher Pill */}
          <button
            onClick={() => setIsPinModalOpen(true)}
            aria-label="Cambiar usuario mediante PIN"
            className="flex items-center gap-2 px-2 py-1 rounded bg-[#18181c] hover:bg-[#202026] border border-[#27272a] text-left transition-colors active:scale-95 group"
          >
            <span className="w-5 h-5 flex items-center justify-center bg-zinc-800 text-zinc-300 rounded-sm text-[11px] border border-zinc-700">
              <i className={userIcon} aria-hidden="true"></i>
            </span>
            <div className="text-xs">
              <div className="font-bold text-zinc-200 group-hover:text-white transition-colors leading-tight flex items-center gap-1">
                <span className="truncate max-w-[90px] sm:max-w-none">{currentUser.name.split(' ')[0]}</span>
                <i className="fa-solid fa-key text-[10px] text-zinc-500" aria-hidden="true"></i>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] font-bold uppercase px-1 rounded-sm border leading-none py-0.5 ${roleStyles}`}>
                  {currentUser.role}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">PIN:{currentUser.pin}</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}