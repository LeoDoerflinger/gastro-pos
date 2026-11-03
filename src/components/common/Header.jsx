import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatUserRoleDisplay } from '../../utils/userRoleHelper';

export default function Header() {
  const {
    currentUser,
    users,
    activeTab,
    setIsSidebarOpen,
    setIsPinModalOpen,
    setIsQrModalOpen,
    setIsNotificationsOpen,
    unreadNotificationsCount,
    logoutUser,
    theme,
    toggleTheme
  } = useApp();

  const isMozo = currentUser.role === 'mozo';

  const viewTitles = {
    mesas: 'Salón y Mesas',
    caja: 'Caja y Cobros',
    arqueo: 'Arqueo de Caja',
    delivery: 'Delivery y Take Away',
    stock_purchases: 'Facturas y Proveedores',
    recetario: 'Recetario e ingredientes',
    stock_control: 'Control de Stock',
    ventas: 'Ventas y Analítica',
    config: 'Configuración'
  };

  const roleLabels = {
    admin: 'Admin',
    cajero: 'Cajero',
    mozo: 'Mozo'
  };

  const userIcon = currentUser.avatar?.startsWith('fa-')
    ? currentUser.avatar
    : (currentUser.role === 'admin'
      ? 'fa-solid fa-user-shield'
      : currentUser.role === 'cajero'
      ? 'fa-solid fa-cash-register'
      : 'fa-solid fa-user-tie');

  return (
    <header className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-0 z-30 select-none">
      <nav aria-label="Barra principal de operación" className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Labeled Menu Button + Brand & Current View */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir menú de módulos"
            className="pos-btn-secondary shrink-0 px-3"
          >
            <i className="fa-solid fa-bars text-sm text-[var(--accent-brand)]" aria-hidden="true"></i>
            <span className="text-sm font-semibold">Menú</span>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="hidden md:flex items-center gap-2 pr-3 border-r border-[var(--border-subtle)]">
              <span className="w-6 h-6 rounded bg-[var(--accent-brand-bg)] border border-[var(--accent-brand-border)] text-[var(--accent-brand)] font-display font-extrabold text-xs flex items-center justify-center">
                GP
              </span>
              <span className="font-display font-bold text-sm tracking-tight text-[var(--text-primary)]">
                GastroPOS
              </span>
            </div>

            <h1 className="font-display font-bold text-base sm:text-lg text-[var(--text-primary)] truncate">
              {viewTitles[activeTab] || 'Salón y Mesas'}
            </h1>
          </div>
        </div>

        {/* Right: Notifications + Theme Toggle + QR + Staff Session */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen(true)}
            aria-label={`Centro de comandas y cuentas (${unreadNotificationsCount} sin leer)`}
            title="Ver comandas y solicitudes de cuenta"
            className="pos-btn-secondary px-3 relative"
          >
            <i
              className={`fa-solid fa-bell text-sm ${
                unreadNotificationsCount > 0 ? 'text-[var(--accent-brand)]' : 'text-[var(--text-secondary)]'
              }`}
              aria-hidden="true"
            ></i>
            <span className="hidden md:inline text-xs font-semibold">
              Avisos
            </span>
            {unreadNotificationsCount > 0 && (
              <span className="pos-badge pos-badge-brand font-mono text-[11px] px-1.5 py-0">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'graphite' ? 'Cambiar a tema Papel claro' : 'Cambiar a tema Grafito oscuro'}
            title={theme === 'graphite' ? 'Cambiar a tema claro (Papel)' : 'Cambiar a tema intermedio (Grafito)'}
            className="pos-btn-secondary px-3"
          >
            <i
              className={`fa-solid ${theme === 'graphite' ? 'fa-sun' : 'fa-moon'} text-sm text-[var(--text-secondary)]`}
              aria-hidden="true"
            ></i>
            <span className="hidden md:inline text-xs font-semibold">
              {theme === 'graphite' ? 'Claro' : 'Grafito'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            aria-label="Vincular comandera móvil por QR"
            title="Vincular comandera móvil por QR"
            className="pos-btn-secondary px-3"
          >
            <i
              className="fa-solid fa-qrcode text-sm text-[var(--accent-brand)]"
              aria-hidden="true"
            ></i>
            <span className="hidden md:inline text-xs font-semibold">
              Comandera QR
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsPinModalOpen(true)}
            aria-label={`Usuario actual ${currentUser.name}. Tocá para cambiar con PIN`}
            className="pos-btn-secondary px-2.5 sm:px-3 gap-2.5"
          >
            <span className="w-7 h-7 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--accent-brand)] flex items-center justify-center text-xs shrink-0">
              <i className={userIcon} aria-hidden="true"></i>
            </span>
            <div className="text-left leading-tight">
              <div className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span className="truncate max-w-[96px] sm:max-w-[140px]">{formatUserRoleDisplay(currentUser.name, currentUser.role, users)}</span>
                <i className="fa-solid fa-key text-[11px] text-[var(--text-muted)]" aria-hidden="true"></i>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] font-medium">
                {roleLabels[currentUser.role] || currentUser.role}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={logoutUser}
            aria-label="Cerrar sesión de usuario"
            title="Volver al panel de usuarios"
            className="pos-btn-secondary px-2.5 sm:px-3"
          >
            <i className="fa-solid fa-right-from-bracket text-sm text-[var(--status-danger-fg)]" aria-hidden="true"></i>
          </button>
        </div>
      </nav>
    </header>
  );
}
