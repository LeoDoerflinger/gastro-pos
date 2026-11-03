import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import OrderTakingModal from './OrderTakingModal';

// Identifier format: Sector initial + table number (Salón 44 -> S44, Terraza 10 -> T10, Galería 3 -> G3)
export function getTableCode(table) {
  if (!table) return '';
  const sector = (table.sector || 'Salón').trim();
  const initial = sector.charAt(0).toUpperCase();
  return `${initial}${table.number}`;
}

export default function MozoSalonView() {
  const { tables, orders, refreshData } = useApp();
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [searchTable, setSearchTable] = useState('');

  const [selectedTableForOrder, setSelectedTableForOrder] = useState(null);
  const [activeOrderForModal, setActiveOrderForModal] = useState(null);

  const sectors = ['Todos', ...Array.from(new Set(tables.map(t => t.sector)))];

  const tableOrderMap = {};
  orders.forEach(ord => {
    if (ord.channel === 'mesa' && ord.tableId && (ord.status === 'abierto' || ord.status === 'cuenta_pedida')) {
      tableOrderMap[ord.tableId] = ord;
    }
  });

  const getElapsedTimeString = (table, order) => {
    if (table.status === 'libre' || !order) return 'Sin comanda';
    const timestamp = order.createdAt || table.openedAt;
    if (!timestamp) return 'Sin comanda';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Hace instantes';
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `${hours}h ${remMins}m`;
  };

  const filteredTables = tables.filter(table => {
    const matchesSector = selectedSector === 'Todos' || table.sector === selectedSector;

    let tableMappedStatus = 'cerrada';
    if (table.status === 'ocupada') tableMappedStatus = 'abierta';
    if (table.status === 'cuenta_pedida') tableMappedStatus = 'pendiente_cobro';

    const matchesStatus = statusFilter === 'todas' || tableMappedStatus === statusFilter;
    const tableCode = getTableCode(table).toLowerCase();
    const matchesSearch =
      !searchTable ||
      table.number.toString().includes(searchTable) ||
      tableCode.includes(searchTable.toLowerCase());

    return matchesSector && matchesStatus && matchesSearch;
  });

  const countCerradas = tables.filter(t => t.status === 'libre').length;
  const countAbiertas = tables.filter(t => t.status === 'ocupada').length;
  const countPendientes = tables.filter(t => t.status === 'cuenta_pedida').length;

  const handleTableClick = (table) => {
    setSelectedTableForOrder(table);
    setActiveOrderForModal(tableOrderMap[table.id] || null);
  };

  const resetFilters = () => {
    setSelectedSector('Todos');
    setStatusFilter('todas');
    setSearchTable('');
  };

  return (
    <section className="space-y-5" aria-label="Plano de salón y mesas">
      {/* Open Architectural Header & Filter Controls */}
      <div className="pb-4 border-b border-[var(--border-subtle)] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Filter Segmented Bar */}
          <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
            <div className="pos-segment-group" role="group" aria-label="Filtrar mesas por estado">
              <button
                type="button"
                aria-pressed={statusFilter === 'todas'}
                onClick={() => setStatusFilter('todas')}
                className="pos-segment-btn"
              >
                <span>Todas</span>
                <span className="font-mono text-xs text-[var(--text-muted)]">{tables.length}</span>
              </button>

              <button
                type="button"
                aria-pressed={statusFilter === 'abierta'}
                onClick={() => setStatusFilter('abierta')}
                className="pos-segment-btn"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-open-bar)]" aria-hidden="true"></span>
                <span>Abiertas</span>
                <span className="font-mono text-xs">{countAbiertas}</span>
              </button>

              <button
                type="button"
                aria-pressed={statusFilter === 'pendiente_cobro'}
                onClick={() => setStatusFilter('pendiente_cobro')}
                className="pos-segment-btn"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-bill-bar)]" aria-hidden="true"></span>
                <span>Pendiente cobro</span>
                <span className="font-mono text-xs">{countPendientes}</span>
              </button>

              <button
                type="button"
                aria-pressed={statusFilter === 'cerrada'}
                onClick={() => setStatusFilter('cerrada')}
                className="pos-segment-btn"
              >
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--border-strong)]" aria-hidden="true"></span>
                <span>Cerradas</span>
                <span className="font-mono text-xs text-[var(--text-muted)]">{countCerradas}</span>
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2 w-full lg:w-72 shrink-0">
            <label htmlFor="table-search-input" className="text-xs font-semibold text-[var(--text-secondary)] shrink-0 inline-flex items-center gap-1.5">
              <i className="fa-solid fa-magnifying-glass text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
              <span>Buscar:</span>
            </label>
            <input
              id="table-search-input"
              type="search"
              placeholder="Mesa (ej. S4, T10)..."
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              className="pos-input flex-1"
            />
          </div>
        </div>

        {/* Sector Filter Strip */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5" role="group" aria-label="Filtrar por sector">
          <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0 mr-1">
            Sector:
          </span>
          {sectors.map(sec => {
            const active = selectedSector === sec;
            return (
              <button
                key={sec}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedSector(sec)}
                className={`min-h-[44px] px-3.5 rounded text-xs font-semibold whitespace-nowrap border transition-colors ${
                  active
                    ? 'bg-[var(--accent-brand-bg)] text-[var(--accent-brand)] border-[var(--accent-brand-border)] font-bold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                {sec}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floor Plan Grid: 2 cols mobile, 3 sm, 4 md, 5 lg, 6 xl */}
      {filteredTables.length === 0 ? (
        <div className="pos-panel p-10 text-center space-y-3">
          <div className="w-11 h-11 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
            <i className="fa-solid fa-chair text-lg" aria-hidden="true"></i>
          </div>
          <div className="space-y-1">
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
              No encontramos mesas con ese filtro
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Probá limpiando la búsqueda o seleccionando otro sector del salón.
            </p>
          </div>
          <button type="button" onClick={resetFilters} className="pos-btn-secondary mx-auto">
            <i className="fa-solid fa-filter-circle-xmark text-xs" aria-hidden="true"></i>
            <span>Mostrar todas las mesas</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredTables.map(table => {
            const order = tableOrderMap[table.id];
            const isAbierta = table.status === 'ocupada';
            const isPendiente = table.status === 'cuenta_pedida';

            const tableCode = getTableCode(table);
            const elapsedTime = getElapsedTimeString(table, order);

            let cardVariant = 'table-card-cerrada';
            let statusLabel = 'Cerrada';
            let statusClass = 'text-[var(--text-muted)]';
            let statusIcon = 'fa-regular fa-circle text-[var(--text-muted)]';

            if (isAbierta) {
              cardVariant = 'table-card-abierta';
              statusLabel = 'Abierta';
              statusClass = 'text-[var(--status-open-fg)] font-bold';
              statusIcon = 'fa-solid fa-circle text-[var(--status-open-bar)]';
            } else if (isPendiente) {
              cardVariant = 'table-card-pendiente';
              statusLabel = 'Pendiente cobro';
              statusClass = 'text-[var(--status-bill-fg)] font-bold';
              statusIcon = 'fa-solid fa-receipt text-[var(--status-bill-fg)]';
            }

            return (
              <button
                key={table.id}
                type="button"
                onClick={() => handleTableClick(table)}
                aria-label={`Mesa ${tableCode}, estado ${statusLabel}, tiempo ${elapsedTime}`}
                className={`table-card-base ${cardVariant}`}
              >
                {/* Top: Table Code & Status Icon */}
                <div className="flex items-start justify-between w-full gap-2">
                  <span className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-[var(--text-primary)] font-mono">
                    {tableCode}
                  </span>
                  <i className={`${statusIcon} text-xs mt-1.5`} aria-hidden="true"></i>
                </div>

                {/* Bottom: Status Text & Elapsed Time since last comanda */}
                <div className="w-full pt-2.5 mt-3 border-t border-[var(--border-subtle)] flex flex-col gap-0.5">
                  <span className={`text-xs leading-tight ${statusClass}`}>
                    {statusLabel}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-secondary)] flex items-center gap-1.5">
                    <i className="fa-regular fa-clock text-[11px] opacity-80" aria-hidden="true"></i>
                    <span>{elapsedTime}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedTableForOrder && (
        <OrderTakingModal
          isOpen={!!selectedTableForOrder}
          onClose={() => setSelectedTableForOrder(null)}
          table={selectedTableForOrder}
          activeOrder={activeOrderForModal}
          onOrderSubmitted={refreshData}
        />
      )}
    </section>
  );
}
