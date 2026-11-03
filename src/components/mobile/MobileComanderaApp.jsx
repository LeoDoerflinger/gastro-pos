import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import OrderTakingModal from '../mozo/OrderTakingModal';
import { getTableCode } from '../mozo/MozoSalonView';
import UserLoginDashboard from '../auth/UserLoginDashboard';
import PinModal from '../common/PinModal';
import Toast from '../common/Toast';

export default function MobileComanderaApp() {
  const {
    currentUser,
    logoutUser,
    tables,
    orders,
    theme,
    toggleTheme,
    setIsPinModalOpen,
    refreshData,
    activeShift,
    showToast
  } = useApp();

  const [selectedSector, setSelectedSector] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [syncing, setSyncing] = useState(false);

  if (!currentUser) {
    return (
      <>
        <UserLoginDashboard isMobileComandera={true} />
        <Toast />
      </>
    );
  }

  const sectors = ['Todos', ...Array.from(new Set(tables.map(t => t.sector)))];

  const getTableOrder = (table) => {
    if (!table.activeOrderId) return null;
    return orders.find(o => o.id === table.activeOrderId) || null;
  };

  const getElapsedMinutes = (isoDate) => {
    if (!isoDate) return null;
    const diff = Math.max(1, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
    return `${diff}m`;
  };

  const filteredTables = tables.filter(table => {
    const matchesSector = selectedSector === 'Todos' || table.sector === selectedSector;
    const code = getTableCode(table).toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      code.includes(searchQuery.trim().toLowerCase()) ||
      String(table.number).includes(searchQuery.trim());

    if (!matchesSector || !matchesSearch) return false;
    if (statusFilter === 'abiertas') return table.status === 'ocupada';
    if (statusFilter === 'cuenta') return table.status === 'cuenta_solicitada';
    if (statusFilter === 'cobro') return table.status === 'pendiente_cobro' || table.status === 'cuenta_pedida';
    if (statusFilter === 'libres') return table.status === 'libre';
    return true;
  });

  const openCount = tables.filter(t => t.status === 'ocupada').length;
  const accountCount = tables.filter(t => t.status === 'cuenta_solicitada').length;
  const billCount = tables.filter(t => t.status === 'pendiente_cobro' || t.status === 'cuenta_pedida').length;

  const handleManualSync = async () => {
    setSyncing(true);
    await refreshData();
    setSyncing(false);
    showToast('Salón sincronizado con caja central');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded bg-[var(--accent-brand-bg)] border border-[var(--accent-brand-border)] text-[var(--accent-brand)] font-display font-extrabold text-xs flex items-center justify-center shrink-0">
              GP
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-base text-[var(--text-primary)] truncate leading-none">
                  Comandera Móvil
                </h1>
                <span className="pos-badge pos-badge-open text-[11px] py-0.5 px-2">
                  En línea
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                Operador: <strong className="text-[var(--text-primary)]">{currentUser.name}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleManualSync}
              aria-label="Sincronizar mesas"
              className="pos-btn-secondary px-2.5"
            >
              <i
                className={`fa-solid fa-rotate text-xs ${syncing ? 'animate-spin text-[var(--accent-brand)]' : ''}`}
                aria-hidden="true"
              ></i>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'graphite' ? 'Cambiar a tema Papel claro' : 'Cambiar a tema Grafito oscuro'}
              className="pos-btn-secondary px-2.5"
            >
              <i
                className={`fa-solid ${theme === 'graphite' ? 'fa-sun' : 'fa-moon'} text-xs`}
                aria-hidden="true"
              ></i>
            </button>

            <button
              type="button"
              onClick={() => setIsPinModalOpen(true)}
              aria-label="Cambiar operador con PIN"
              className="pos-btn-secondary px-2.5"
            >
              <i className="fa-solid fa-key text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
            </button>

            <button
              type="button"
              onClick={logoutUser}
              aria-label="Cerrar sesión de comandera"
              className="pos-btn-secondary px-2.5 text-xs"
            >
              <i className="fa-solid fa-right-from-bracket text-xs text-[var(--status-danger-fg)]" aria-hidden="true"></i>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation & Filter Controls */}
      <nav
        aria-label="Filtros de comandera móvil"
        className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] px-3 py-2.5"
      >
        <div className="max-w-xl mx-auto space-y-2.5">
          {/* Status Filter + Search */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="pos-segment-group overflow-x-auto no-scrollbar" role="group" aria-label="Estado de mesas">
              {[
                { id: 'todas', label: `Todas (${tables.length})` },
                { id: 'abiertas', label: `Abiertas (${openCount})` },
                { id: 'cuenta', label: `Cuenta (${accountCount})` },
                { id: 'cobro', label: `Pendiente (${billCount})` },
                { id: 'libres', label: 'Cerradas' }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  aria-pressed={statusFilter === st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className="pos-segment-btn text-xs px-2.5"
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <label htmlFor="mobile-table-search" className="text-xs font-semibold text-[var(--text-secondary)] shrink-0">
                <i className="fa-solid fa-magnifying-glass text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
                <span className="sr-only">Buscar mesa</span>
              </label>
              <input
                id="mobile-table-search"
                type="search"
                placeholder="Mesa S1, T5..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pos-input text-xs py-1.5"
              />
            </div>
          </div>

          {/* Sector Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5" role="group" aria-label="Sectores del salón">
            {sectors.map(sec => {
              const active = selectedSector === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedSector(sec)}
                  className={`min-h-[44px] px-3 rounded text-xs font-semibold whitespace-nowrap border transition-colors ${
                    active
                      ? 'bg-[var(--accent-brand-bg)] text-[var(--accent-brand)] border-[var(--accent-brand-border)] font-bold'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {sec}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Table Grid */}
      <main className="flex-1 max-w-xl w-full mx-auto px-3 py-4">
        {filteredTables.length === 0 ? (
          <div className="pos-panel p-8 text-center space-y-3">
            <p className="font-display font-bold text-base text-[var(--text-primary)]">
              No hay mesas con ese filtro
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedSector('Todos');
                setStatusFilter('todas');
                setSearchQuery('');
              }}
              className="pos-btn-secondary mx-auto text-xs"
            >
              Ver todas las mesas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {filteredTables.map(table => {
              const code = getTableCode(table);
              const order = getTableOrder(table);
              const isFree = table.status === 'libre';
              const isAccount = table.status === 'cuenta_solicitada';
              const isBill = table.status === 'pendiente_cobro' || table.status === 'cuenta_pedida';
              const elapsed = getElapsedMinutes(order?.createdAt || table.openedAt);

              const stateClass = isFree
                ? 'table-card-cerrada'
                : isAccount
                ? 'table-card-cuenta'
                : isBill
                ? 'table-card-pendiente'
                : 'table-card-abierta';

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTable(table)}
                  className={`table-card-base ${stateClass} p-3.5 text-left flex flex-col justify-between min-h-[112px]`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span className="font-display font-extrabold text-xl font-mono text-[var(--text-primary)] leading-none">
                      {code}
                    </span>
                    {!isFree && elapsed && (
                      <span className="font-mono text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                        {elapsed}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1 w-full">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold ${
                          isFree
                            ? 'text-[var(--text-muted)]'
                            : isAccount
                            ? 'text-[var(--status-account-fg)]'
                            : isBill
                            ? 'text-[var(--status-bill-fg)]'
                            : 'text-[var(--status-open-fg)]'
                        }`}
                      >
                        {isFree ? 'Cerrada' : isAccount ? 'Cuenta' : isBill ? 'Pendiente cobro' : 'Abierta'}
                      </span>
                      {order && (
                        <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                          ${(order.total || order.subtotal || 0).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {order ? `${(order.items || []).length} platos · ${order.waiterName || 'Salón'}` : table.sector}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
        <div className="max-w-xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[var(--text-primary)]">GastroPOS</span>
            <span>·</span>
            <span>Operador: <strong className="text-[var(--text-primary)]">{currentUser.name}</strong></span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>{activeShift ? 'Caja abierta' : 'Caja cerrada'}</span>
            <a href="/" className="pos-btn-secondary text-xs px-3 font-sans">
              Versión escritorio
            </a>
          </div>
        </div>
      </footer>

      {selectedTable && (
        <OrderTakingModal
          isOpen={true}
          table={selectedTable}
          activeOrder={getTableOrder(selectedTable)}
          onClose={() => setSelectedTable(null)}
        />
      )}

      <PinModal />
      <Toast />
    </div>
  );
}
