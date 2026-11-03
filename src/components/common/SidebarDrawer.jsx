import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { formatUserRoleDisplay } from '../../utils/userRoleHelper';

export default function SidebarDrawer() {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    activeTab,
    setActiveTab,
    currentUser,
    users,
    logoutUser,
    setIsPinModalOpen,
    setIsQrModalOpen,
    theme,
    toggleTheme,
    refreshData,
    showToast,
    businessConfig,
    activeTenant
  } = useApp();

  useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, setIsSidebarOpen]);

  if (!isSidebarOpen) return null;

  const isMozo = currentUser.role === 'mozo';
  const isAdmin = currentUser.role === 'admin';

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const handleResetDemo = async () => {
    if (window.confirm('¿Querés restaurar las mesas, pedidos y stock a los valores iniciales de prueba?')) {
      try {
        await api.resetDemo();
        await refreshData();
        showToast('Datos de prueba restaurados');
        setIsSidebarOpen(false);
      } catch (e) {
        showToast('No se pudieron restaurar los datos', 'error');
      }
    }
  };

  const roleLabels = {
    admin: 'Encargado / Admin',
    cajero: 'Cajero',
    mozo: 'Mozo de salón'
  };

  const userIcon = currentUser.avatar?.startsWith('fa-')
    ? currentUser.avatar
    : (currentUser.role === 'admin'
      ? 'fa-solid fa-user-shield'
      : currentUser.role === 'cajero'
      ? 'fa-solid fa-cash-register'
      : 'fa-solid fa-user-tie');

  const navItemClass = (tab) => {
    const active = activeTab === tab;
    const isNeutralTab = tab === 'stock_purchases' || tab === 'recetario';
    return `w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded text-sm transition-colors text-left ${
      active
        ? isNeutralTab
          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold border border-[var(--border-strong)] border-l-4 border-l-[var(--border-strong)]'
          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold border border-[var(--border-strong)] border-l-4 border-l-[var(--accent-brand)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] font-medium border border-transparent'
    }`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
    >
      <button
        type="button"
        aria-label="Cerrar menú lateral"
        className="fixed inset-0 bg-[var(--backdrop-overlay)]"
        onClick={() => setIsSidebarOpen(false)}
        tabIndex={-1}
      />

      <div className="relative w-full max-w-xs bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] h-full flex flex-col z-10 shadow-2xl">
        {/* Drawer Header */}
        <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-[var(--accent-brand-bg)] border border-[var(--accent-brand-border)] flex items-center justify-center text-[var(--accent-brand)] font-display font-extrabold text-xs shrink-0">
              {businessConfig?.name ? businessConfig.name.slice(0, 2).toUpperCase() : 'GP'}
            </div>
            <div className="min-w-0">
              <span className="font-display font-bold text-sm text-[var(--text-primary)] block leading-tight truncate">
                {businessConfig?.name || activeTenant?.name || 'GastroPOS'}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono block truncate">
                @{businessConfig?.domain || activeTenant?.domain || 'quepibar.gp.com'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar menú"
            className="pos-btn-ghost"
          >
            <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        {/* Active Operator Profile */}
        <div className="p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="w-9 h-9 flex items-center justify-center bg-[var(--bg-elevated)] text-[var(--accent-brand)] rounded border border-[var(--border-subtle)] text-sm shrink-0">
                <i className={userIcon} aria-hidden="true"></i>
              </span>
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-[var(--text-primary)] truncate">{formatUserRoleDisplay(currentUser.name, currentUser.role, users)}</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {roleLabels[currentUser.role]} · <span className="font-mono">PIN {currentUser.pin}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsPinModalOpen(true);
              }}
              aria-label="Cambiar usuario con PIN"
              title="Cambiar usuario con PIN"
              className="pos-btn-secondary px-3 shrink-0"
            >
              <i className="fa-solid fa-key text-xs" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Módulos del sistema">
          <div className="text-xs font-semibold text-[var(--text-muted)] px-2.5 py-1.5">
            Operación diaria
          </div>

          <button
            type="button"
            onClick={() => handleSelectTab('mesas')}
            aria-current={activeTab === 'mesas' ? 'page' : undefined}
            className={navItemClass('mesas')}
          >
            <i className="fa-solid fa-utensils w-4 text-center text-sm" aria-hidden="true"></i>
            <span>Salón y Mesas</span>
          </button>

          {!isMozo && (
            <>
              <button
                type="button"
                onClick={() => handleSelectTab('caja')}
                aria-current={activeTab === 'caja' ? 'page' : undefined}
                className={navItemClass('caja')}
              >
                <i className="fa-solid fa-cash-register w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Caja y Cobros</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('arqueo')}
                aria-current={activeTab === 'arqueo' ? 'page' : undefined}
                className={navItemClass('arqueo')}
              >
                <i className="fa-solid fa-vault w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Arqueo de Caja</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('delivery')}
                aria-current={activeTab === 'delivery' ? 'page' : undefined}
                className={navItemClass('delivery')}
              >
                <i className="fa-solid fa-motorcycle w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Delivery y Take Away</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('stock_purchases')}
                aria-current={activeTab === 'stock_purchases' ? 'page' : undefined}
                className={navItemClass('stock_purchases')}
              >
                <i className="fa-solid fa-file-invoice-dollar w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Facturas y Proveedores</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('cuentas_corrientes')}
                aria-current={activeTab === 'cuentas_corrientes' ? 'page' : undefined}
                className={navItemClass('cuentas_corrientes')}
              >
                <i className="fa-solid fa-book-bookmark w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Cuentas Corrientes</span>
              </button>
            </>
          )}

          {isAdmin && (
            <>
              <div className="pt-3 mt-2 border-t border-[var(--border-subtle)]">
                <div className="text-xs font-semibold text-[var(--text-muted)] px-2.5 py-1.5">
                  Gestión y control
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectTab('recetario')}
                aria-current={activeTab === 'recetario' ? 'page' : undefined}
                className={navItemClass('recetario')}
              >
                <i className="fa-solid fa-book-open w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Recetario e ingredientes</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('stock_control')}
                aria-current={activeTab === 'stock_control' ? 'page' : undefined}
                className={navItemClass('stock_control')}
              >
                <i className="fa-solid fa-boxes-stacked w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Control de Stock</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('ventas')}
                aria-current={activeTab === 'ventas' ? 'page' : undefined}
                className={navItemClass('ventas')}
              >
                <i className="fa-solid fa-chart-simple w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Ventas y Analítica</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('config')}
                aria-current={activeTab === 'config' ? 'page' : undefined}
                className={navItemClass('config')}
              >
                <i className="fa-solid fa-sliders w-4 text-center text-sm" aria-hidden="true"></i>
                <span>Configuración</span>
              </button>
            </>
          )}
        </nav>

        {/* Drawer Footer Controls */}
        <div className="p-3 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="pos-btn-secondary text-xs px-2.5"
            >
              <i className={`fa-solid ${theme === 'graphite' ? 'fa-sun' : 'fa-moon'} text-xs`} aria-hidden="true"></i>
              <span>{theme === 'graphite' ? 'Tema Claro' : 'Tema Grafito'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsQrModalOpen(true);
              }}
              className="pos-btn-secondary text-xs px-2.5"
            >
              <i className="fa-solid fa-qrcode text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
              <span>Comandera QR</span>
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={handleResetDemo}
              className="pos-btn-secondary w-full text-xs"
            >
              <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
              <span>Restaurar datos de prueba</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsPinModalOpen(true);
              }}
              className="pos-btn-primary text-xs px-2.5"
            >
              <i className="fa-solid fa-key text-xs" aria-hidden="true"></i>
              <span>Cambiar PIN</span>
            </button>

            <button
              type="button"
              onClick={logoutUser}
              className="pos-btn-secondary text-xs px-2.5 text-[var(--status-danger-fg)]"
            >
              <i className="fa-solid fa-right-from-bracket text-xs" aria-hidden="true"></i>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
