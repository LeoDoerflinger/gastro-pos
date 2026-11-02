import React from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function SidebarDrawer() {
  const { 
    isSidebarOpen, 
    setIsSidebarOpen, 
    activeTab, 
    setActiveTab, 
    currentUser, 
    setIsPinModalOpen,
    isMobileSimulated,
    setIsMobileSimulated,
    refreshData,
    showToast
  } = useApp();

  if (!isSidebarOpen) return null;

  const isMozo = currentUser.role === 'mozo';
  const isAdmin = currentUser.role === 'admin';

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const handleResetDemo = async () => {
    if (window.confirm('¿Restaurar todos los datos a la demostración inicial?')) {
      try {
        await api.resetDemo();
        await refreshData();
        showToast('Datos demo restaurados correctamente');
        setIsSidebarOpen(false);
      } catch (e) {
        showToast('Error al restaurar datos', 'error');
      }
    }
  };

  const roleLabels = {
    admin: 'ENCARGADO / ADMIN',
    cajero: 'CAJERO',
    mozo: 'MOZO'
  };

  const userIcon = currentUser.avatar?.startsWith('fa-')
    ? currentUser.avatar
    : (currentUser.role === 'admin' ? 'fa-solid fa-user-shield' : currentUser.role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie');

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in duration-150">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xs bg-[#121215] border-r border-[#27272a] h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-150">
        {/* Drawer Header */}
        <div className="p-3.5 border-b border-[#27272a] flex items-center justify-between bg-[#0e0e11]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-zinc-200 flex items-center justify-center text-zinc-950 font-black text-xs font-mono">
              GP
            </div>
            <div>
              <span className="font-extrabold text-xs tracking-wider text-zinc-100 uppercase font-mono">
                GASTRO<span className="text-zinc-500 font-normal">POS</span>
              </span>
              <span className="text-[10px] text-zinc-500 block font-mono">v1.2 PRO</span>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar menú"
            className="w-7 h-7 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181c] flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
          </button>
        </div>

        {/* Current Active User Profile Banner */}
        <div className="p-3 bg-[#15151a] border-b border-[#27272a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="w-7 h-7 flex items-center justify-center bg-zinc-800 text-zinc-300 rounded border border-zinc-700 text-xs shrink-0">
                <i className={userIcon} aria-hidden="true"></i>
              </span>
              <div className="overflow-hidden">
                <div className="font-bold text-xs text-zinc-100 truncate">{currentUser.name}</div>
                <div className="text-[10px] font-mono text-zinc-400">
                  {roleLabels[currentUser.role]} • PIN: {currentUser.pin}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setIsSidebarOpen(false);
                setIsPinModalOpen(true);
              }}
              title="Cambiar usuario con PIN"
              aria-label="Cambiar usuario con PIN"
              className="w-7 h-7 rounded bg-[#18181c] hover:bg-zinc-800 text-zinc-300 border border-[#27272a] transition-colors flex items-center justify-center shrink-0"
            >
              <i className="fa-solid fa-key text-xs" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* Navigation Links (Segmented, micro-radius, FA6) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2.5 py-1.5">
            Módulos Habilitados
          </p>

          {/* Salón / Mesas */}
          <button
            onClick={() => handleSelectTab('mesas')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
              activeTab === 'mesas'
                ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
            }`}
          >
            <i className="fa-solid fa-utensils w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
            <span>Salón & Mesas</span>
          </button>

          {/* Cajero & Admin Only Navigation */}
          {!isMozo && (
            <>
              <button
                onClick={() => handleSelectTab('caja')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'caja'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-cash-register w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Caja & Cobros</span>
              </button>

              <button
                onClick={() => handleSelectTab('arqueo')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'arqueo'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-clock w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Arqueos de Caja</span>
              </button>

              <button
                onClick={() => handleSelectTab('delivery')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'delivery'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-motorcycle w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Delivery & Take Away</span>
              </button>

              <button
                onClick={() => handleSelectTab('stock_purchases')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'stock_purchases'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-file-invoice-dollar w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Facturas / Proveedores</span>
              </button>
            </>
          )}

          {/* Admin Exclusive Navigation */}
          {isAdmin && (
            <>
              <div className="pt-2 pb-1 border-t border-[#27272a] my-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2.5 py-1">
                  Administración Central
                </p>
              </div>

              <button
                onClick={() => handleSelectTab('recetario')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'recetario'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-book-open w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Recetario & Escandallos</span>
              </button>

              <button
                onClick={() => handleSelectTab('stock_control')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'stock_control'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-boxes-stacked w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Control de Stock & Mermas</span>
              </button>

              <button
                onClick={() => handleSelectTab('ventas')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'ventas'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-chart-line w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Ventas & Analítica</span>
              </button>

              <button
                onClick={() => handleSelectTab('config')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  activeTab === 'config'
                    ? 'bg-[#18181c] text-white border-l-[3px] border-zinc-200'
                    : 'text-zinc-400 hover:bg-[#16161b] hover:text-zinc-200'
                }`}
              >
                <i className="fa-solid fa-gears w-4 text-center text-xs text-zinc-400" aria-hidden="true"></i>
                <span>Configuración Salón & Roles</span>
              </button>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-2.5 bg-[#0e0e11] border-t border-[#27272a] space-y-1">
          <button
            onClick={() => {
              setIsMobileSimulated(!isMobileSimulated);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#15151a] hover:bg-[#1c1c22] text-zinc-300 text-xs border border-[#27272a] transition-colors"
          >
            <span className="flex items-center gap-2">
              <i className={`fa-solid ${isMobileSimulated ? 'fa-desktop' : 'fa-mobile-screen'} text-zinc-400 text-xs`} aria-hidden="true"></i>
              <span>{isMobileSimulated ? 'Vista Escritorio' : 'Simulador Celular'}</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">
              {isMobileSimulated ? 'ON' : 'OFF'}
            </span>
          </button>

          {isAdmin && (
            <button
              onClick={handleResetDemo}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#15151a] hover:bg-[#1c1c22] text-zinc-400 hover:text-zinc-200 text-xs border border-[#27272a] transition-colors"
            >
              <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
              <span>Restaurar Datos Demo</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsSidebarOpen(false);
              setIsPinModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-bold transition-colors"
          >
            <i className="fa-solid fa-key text-xs" aria-hidden="true"></i>
            <span>Cambiar de Usuario (PIN)</span>
          </button>
        </div>
      </div>
    </div>
  );
}