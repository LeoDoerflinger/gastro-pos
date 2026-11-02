import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import OrderTakingModal from './OrderTakingModal';

// Helper to compute table identifier: Initial of sector + number (e.g. Salón 44 = S44, Terraza 10 = T10, Galería 3 = G3)
export function getTableCode(table) {
  if (!table) return '';
  const sector = (table.sector || 'Salón').trim();
  const initial = sector.charAt(0).toUpperCase();
  return `${initial}${table.number}`;
}

export default function MozoSalonView() {
  const { tables, orders, refreshData } = useApp();
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('todas'); // 'todas', 'cerrada', 'abierta', 'pendiente_cobro'
  const [searchTable, setSearchTable] = useState('');

  // Selected table to open comanda
  const [selectedTableForOrder, setSelectedTableForOrder] = useState(null);
  const [activeOrderForModal, setActiveOrderForModal] = useState(null);

  // Extract unique sectors
  const sectors = ['Todos', ...Array.from(new Set(tables.map(t => t.sector)))];

  // Map active order to each table
  const tableOrderMap = {};
  orders.forEach(ord => {
    if (ord.channel === 'mesa' && ord.tableId && (ord.status === 'abierto' || ord.status === 'cuenta_pedida')) {
      tableOrderMap[ord.tableId] = ord;
    }
  });

  // Calculate elapsed time from last comanda or openedAt
  const getElapsedTimeString = (table, order) => {
    if (table.status === 'libre' || !order) return '-';
    const timestamp = order.createdAt || table.openedAt;
    if (!timestamp) return '-';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'reciente';
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `${hours}h ${remMins}m`;
  };

  const filteredTables = tables.filter(table => {
    const matchesSector = selectedSector === 'Todos' || table.sector === selectedSector;
    
    // Status mapping: 'libre' = 'cerrada', 'ocupada' = 'abierta', 'cuenta_pedida' = 'pendiente_cobro'
    let tableMappedStatus = 'cerrada';
    if (table.status === 'ocupada') tableMappedStatus = 'abierta';
    if (table.status === 'cuenta_pedida') tableMappedStatus = 'pendiente_cobro';

    const matchesStatus = statusFilter === 'todas' || tableMappedStatus === statusFilter;
    const tableCode = getTableCode(table).toLowerCase();
    const matchesSearch = !searchTable || 
      table.number.toString().includes(searchTable) || 
      tableCode.includes(searchTable.toLowerCase());

    return matchesSector && matchesStatus && matchesSearch;
  });

  // Counters
  const countCerradas = tables.filter(t => t.status === 'libre').length;
  const countAbiertas = tables.filter(t => t.status === 'ocupada').length;
  const countPendientes = tables.filter(t => t.status === 'cuenta_pedida').length;

  const handleTableClick = (table) => {
    setSelectedTableForOrder(table);
    setActiveOrderForModal(tableOrderMap[table.id] || null);
  };

  return (
    <div className="space-y-3">
      {/* Control Toolbar: Segmented Controls with Crisp Shared Borders */}
      <div className="bg-[#121215] p-2.5 rounded border border-[#27272a] flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Status Segmented Control */}
        <div className="flex border border-[#27272a] rounded overflow-hidden divide-x divide-[#27272a] text-xs">
          <button
            onClick={() => setStatusFilter('todas')}
            className={`px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'todas'
                ? 'bg-zinc-800 text-zinc-100 font-bold'
                : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a20]'
            }`}
          >
            Todas ({tables.length})
          </button>

          <button
            onClick={() => setStatusFilter('cerrada')}
            className={`px-3 py-1.5 font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'cerrada'
                ? 'bg-zinc-800 text-zinc-100 font-bold'
                : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a20]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
            <span>Cerradas ({countCerradas})</span>
          </button>

          <button
            onClick={() => setStatusFilter('abierta')}
            className={`px-3 py-1.5 font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'abierta'
                ? 'bg-zinc-800 text-zinc-100 font-bold'
                : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a20]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
            <span>Abiertas ({countAbiertas})</span>
          </button>

          <button
            onClick={() => setStatusFilter('pendiente_cobro')}
            className={`px-3 py-1.5 font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'pendiente_cobro'
                ? 'bg-zinc-800 text-zinc-100 font-bold'
                : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a20]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>Pendiente Cobro ({countPendientes})</span>
          </button>
        </div>

        {/* Sectors & Search Input */}
        <div className="flex items-center gap-2">
          {/* Sector Segmented Bar */}
          <div className="flex border border-[#27272a] rounded overflow-hidden divide-x divide-[#27272a] text-xs">
            {sectors.map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
                  selectedSector === sec
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a20]'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-32 sm:w-36 shrink-0">
            <i className="fa-solid fa-magnifying-glass text-[11px] text-zinc-500 absolute left-2.5 top-2.5" aria-hidden="true"></i>
            <input
              type="text"
              placeholder="Buscar mesa..."
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              className="w-full bg-[#15151a] border border-[#27272a] rounded pl-7 pr-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Mesas Grid: Minimal, high-density, precise micro-radius geometry */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {filteredTables.map(table => {
          const order = tableOrderMap[table.id];
          const isCerrada = table.status === 'libre';
          const isAbierta = table.status === 'ocupada';
          const isPendiente = table.status === 'cuenta_pedida';

          const tableCode = getTableCode(table);
          const elapsedTime = getElapsedTimeString(table, order);

          let cardStyle = 'table-card-cerrada';
          let statusLabel = 'Cerrada';
          let statusTextClass = 'text-zinc-500';
          let dotColor = 'bg-zinc-600';

          if (isAbierta) {
            cardStyle = 'table-card-abierta';
            statusLabel = 'Abierta';
            statusTextClass = 'text-zinc-200';
            dotColor = 'bg-zinc-300';
          } else if (isPendiente) {
            cardStyle = 'table-card-pendiente';
            statusLabel = 'Pendiente cobro';
            statusTextClass = 'text-white font-bold';
            dotColor = 'bg-white';
          }

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`${cardStyle} rounded p-3 cursor-pointer transition-colors select-none flex flex-col justify-between min-h-[110px]`}
            >
              {/* Header: Table Code & Status Indicator */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-mono tabular-nums font-black tracking-tight text-zinc-100">
                    {tableCode}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                    {table.sector}
                  </div>
                </div>

                <div className="pt-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                </div>
              </div>

              {/* Status and Elapsed Time */}
              <div className="pt-2 border-t border-[#27272a] flex flex-col gap-0.5">
                <div className={`text-[11px] uppercase tracking-wider font-mono ${statusTextClass}`}>
                  {statusLabel}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-zinc-400">
                  {elapsedTime}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Taking Modal */}
      {selectedTableForOrder && (
        <OrderTakingModal
          isOpen={!!selectedTableForOrder}
          onClose={() => setSelectedTableForOrder(null)}
          table={selectedTableForOrder}
          activeOrder={activeOrderForModal}
          onOrderSubmitted={refreshData}
        />
      )}
    </div>
  );
}