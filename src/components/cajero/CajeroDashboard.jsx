import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import CobroModal from './CobroModal';
import ReceiptModal from '../common/ReceiptModal';
import OrderTakingModal from '../mozo/OrderTakingModal';
import { getTableCode } from '../mozo/MozoSalonView';
import { api } from '../../api/client';

export default function CajeroDashboard() {
  const { orders, tables, refreshData, showToast } = useApp();
  const [channelFilter, setChannelFilter] = useState('todos'); // 'todos', 'mesa', 'mostrador', 'take_away', 'delivery'
  const [selectedOrderForCobro, setSelectedOrderForCobro] = useState(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);
  const [receiptType, setReceiptType] = useState('precuenta');
  
  // State for creating counter / mostrador order
  const [isCounterOrderModalOpen, setIsCounterOrderModalOpen] = useState(false);

  // Active uncharged orders
  const activeOrders = orders.filter(o => o.status === 'abierto' || o.status === 'cuenta_pedida');

  // Priority: orders with status === 'cuenta_pedida'
  const billRequestedOrders = activeOrders.filter(o => o.status === 'cuenta_pedida');

  const filteredOrders = activeOrders.filter(o => {
    if (channelFilter === 'todos') return true;
    return o.channel === channelFilter;
  });

  const handleOpenCobro = (order) => {
    setSelectedOrderForCobro(order);
  };

  const handleOpenReceipt = (order, type = 'precuenta') => {
    setSelectedOrderForReceipt(order);
    setReceiptType(type);
  };

  const handleRevertBill = async (order) => {
    try {
      await api.revertBill(order.id);
      const code = getOrderTableCode(order) || `#${order.orderNumber}`;
      showToast(`Mesa ${code} revertida a estado Abierta`);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error al revertir estado', 'error');
    }
  };

  // Helper to format table code from order
  const getOrderTableCode = (order) => {
    if (!order.tableId) return null;
    const table = tables.find(t => t.id === order.tableId);
    return table ? getTableCode(table) : `M${order.tableNumber}`;
  };

  // Helper to render channel / table label
  const renderOrderLocation = (order) => {
    if (order.channel === 'mesa') {
      const code = getOrderTableCode(order);
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums font-black text-xs text-zinc-100 bg-[#18181c] px-2 py-0.5 rounded border border-[#27272a]">
            {code || `Mesa ${order.tableNumber}`}
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">#{order.orderNumber}</span>
        </div>
      );
    }
    if (order.channel === 'delivery') {
      return (
        <div className="flex items-center gap-1.5">
          <i className="fa-solid fa-motorcycle text-xs text-zinc-400 w-4 text-center" aria-hidden="true"></i>
          <span className="text-xs font-bold text-zinc-200">Delivery</span>
          <span className="text-[11px] text-zinc-500 font-mono">#{order.orderNumber}</span>
          {order.customerName && (
            <span className="text-xs text-zinc-400 truncate max-w-[130px]">
              : {order.customerName}
            </span>
          )}
        </div>
      );
    }
    if (order.channel === 'take_away') {
      return (
        <div className="flex items-center gap-1.5">
          <i className="fa-solid fa-bag-shopping text-xs text-zinc-400 w-4 text-center" aria-hidden="true"></i>
          <span className="text-xs font-bold text-zinc-200">Take Away</span>
          <span className="text-[11px] text-zinc-500 font-mono">#{order.orderNumber}</span>
          {order.customerName && (
            <span className="text-xs text-zinc-400 truncate max-w-[130px]">
              : {order.customerName}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <i className="fa-solid fa-store text-xs text-zinc-400 w-4 text-center" aria-hidden="true"></i>
        <span className="text-xs font-bold text-zinc-200">Mostrador</span>
        <span className="text-[11px] text-zinc-500 font-mono">#{order.orderNumber}</span>
      </div>
    );
  };

  // Helper to render order status label cleanly without raw enum underscores
  const renderOrderStatusBadge = (order) => {
    if (order.status === 'cuenta_pedida') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-zinc-800 text-white border border-zinc-600 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
          Pendiente Cobro
        </span>
      );
    }
    const cleanStatus = order.kitchenStatus ? order.kitchenStatus.replace(/_/g, ' ') : 'Abierta';
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize tracking-wider bg-[#15151a] text-zinc-400 border border-[#27272a] font-mono">
        {cleanStatus}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Active Points of Sale Segmented Control Toolbar */}
      <div className="bg-[#121215] p-2.5 rounded border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
        <div className="flex border border-[#27272a] rounded overflow-hidden divide-x divide-[#27272a] text-xs">
          {[
            { id: 'todos', label: 'Todos', count: activeOrders.length, icon: 'fa-layer-group' },
            { id: 'mesa', label: 'Salón', count: activeOrders.filter(o => o.channel === 'mesa').length, icon: 'fa-utensils' },
            { id: 'delivery', label: 'Delivery', count: activeOrders.filter(o => o.channel === 'delivery').length, icon: 'fa-motorcycle' },
            { id: 'mostrador', label: 'Mostrador', count: activeOrders.filter(o => o.channel === 'mostrador').length, icon: 'fa-store' },
            { id: 'take_away', label: 'Take Away', count: activeOrders.filter(o => o.channel === 'take_away').length, icon: 'fa-bag-shopping' }
          ].map(ch => (
            <button
              key={ch.id}
              onClick={() => setChannelFilter(ch.id)}
              className={`px-3 py-1.5 font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                channelFilter === ch.id
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a20]'
              }`}
            >
              <i className={`fa-solid ${ch.icon} text-[10px] text-zinc-400`} aria-hidden="true"></i>
              <span>{ch.label}</span>
              <span className={`text-[10px] px-1 rounded font-mono tabular-nums ${
                channelFilter === ch.id ? 'bg-zinc-900 text-zinc-100 font-bold' : 'text-zinc-500'
              }`}>
                {ch.count}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsCounterOrderModalOpen(true)}
          className="px-3 py-1.5 rounded bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
          <span>+ Pedido Mostrador</span>
        </button>
      </div>

      {/* Pendientes de Cobro Alert Section (Sharp left border accent) */}
      {billRequestedOrders.length > 0 && (
        <div className="bg-[#141418] border border-zinc-700 border-l-[3px] border-l-white rounded p-3 shadow-sm space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-200 font-mono">
                Pendientes de Cobro ({billRequestedOrders.length})
              </h3>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              Atención inmediata
            </span>
          </div>

          <div className="space-y-1.5">
            {billRequestedOrders.map(order => {
              const tableCode = getOrderTableCode(order);
              return (
                <div 
                  key={order.id} 
                  className="bg-[#101014] p-2.5 rounded border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono tabular-nums font-black text-xs text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                      {tableCode || `Comanda #${order.orderNumber}`}
                    </span>
                    <div>
                      <div className="text-xs text-zinc-300 font-medium">
                        Mozo: <strong className="text-zinc-100 font-sans">{order.waiterName || 'Personal'}</strong>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                        {(order.items || []).length} ítems
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 uppercase block font-mono">Saldo:</span>
                      <span className="font-black text-sm font-mono tabular-nums text-zinc-100">
                        ${(order.total || order.subtotal).toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Revert table state button */}
                      <button
                        onClick={() => handleRevertBill(order)}
                        title="Revertir comanda a Abierta"
                        className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-colors flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-rotate-left text-xs text-zinc-400" aria-hidden="true"></i>
                        <span>Revertir a Abierta</span>
                      </button>

                      {/* Cobrar Button */}
                      <button
                        onClick={() => handleOpenCobro(order)}
                        className="px-3 py-1.5 rounded bg-zinc-200 hover:bg-white text-zinc-950 font-black text-xs transition-colors flex items-center gap-1.5 active:scale-95"
                      >
                        <i className="fa-solid fa-dollar-sign text-xs" aria-hidden="true"></i>
                        <span>Cobrar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Cobros Vertical List / Table */}
      <div className="bg-[#121215] rounded border border-[#27272a] overflow-hidden shadow-sm">
        <div className="p-2.5 border-b border-[#27272a] flex items-center justify-between bg-[#0e0e11]">
          <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-300 font-mono">
            Ventas y Cuentas Activas ({filteredOrders.length})
          </h3>
          <span className="text-[11px] text-zinc-500 font-mono uppercase">
            {channelFilter}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            <i className="fa-solid fa-circle-check text-2xl mb-2 text-zinc-600" aria-hidden="true"></i>
            <p className="font-bold text-xs uppercase tracking-wider text-zinc-400 font-mono">
              Sin ventas pendientes en este canal
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#27272a]">
            {/* Table Header (Desktop) */}
            <div className="hidden md:grid md:grid-cols-12 gap-3 px-3 py-2 bg-[#0e0e11] text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
              <div className="col-span-3">Mesa / Canal</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-3">Mozo / Atiende</div>
              <div className="col-span-2 text-right">Saldo</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            {/* Vertical Rows */}
            {filteredOrders.map(order => {
              const isPendiente = order.status === 'cuenta_pedida';

              return (
                <div
                  key={order.id}
                  className={`px-3 py-2.5 transition-colors flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 md:items-center ${
                    isPendiente ? 'bg-[#18181f] border-l-[3px] border-l-white' : 'hover:bg-[#16161b]'
                  }`}
                >
                  {/* Mesa / Canal */}
                  <div className="md:col-span-3 flex items-center justify-between md:justify-start">
                    {renderOrderLocation(order)}
                    <div className="md:hidden">
                      {renderOrderStatusBadge(order)}
                    </div>
                  </div>

                  {/* Estado (Desktop) */}
                  <div className="hidden md:block md:col-span-2">
                    {renderOrderStatusBadge(order)}
                  </div>

                  {/* Mozo / Operador */}
                  <div className="md:col-span-3 text-xs text-zinc-400 flex items-center justify-between md:justify-start">
                    <span className="md:hidden text-[11px] text-zinc-500 font-mono">Atiende:</span>
                    <span className="text-zinc-300 font-medium">
                      {order.waiterName || order.driverName || 'Cajero'}
                    </span>
                  </div>

                  {/* Saldo */}
                  <div className="md:col-span-2 flex items-center justify-between md:justify-end">
                    <span className="md:hidden text-[11px] text-zinc-500 uppercase font-mono">Saldo:</span>
                    <span className="font-mono tabular-nums font-black text-sm text-zinc-100">
                      ${(order.total || order.subtotal).toLocaleString('es-AR')}
                    </span>
                  </div>

                  {/* Botones Cuenta y Cobrar (+ Revertir si es cuenta_pedida) */}
                  <div className="md:col-span-2 flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t border-[#27272a] md:border-t-0">
                    {isPendiente && (
                      <button
                        onClick={() => handleRevertBill(order)}
                        title="Revertir a Abierta"
                        aria-label="Revertir comanda a Abierta"
                        className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors flex items-center justify-center"
                      >
                        <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenReceipt(order, 'precuenta')}
                      title="Imprimir Pre-cuenta"
                      className="px-2 py-1 rounded bg-[#18181c] hover:bg-zinc-800 text-zinc-200 border border-[#27272a] text-xs font-semibold transition-colors flex items-center gap-1 font-mono"
                    >
                      <i className="fa-solid fa-receipt text-[11px] text-zinc-400" aria-hidden="true"></i>
                      <span>Cuenta</span>
                    </button>

                    <button
                      onClick={() => handleOpenCobro(order)}
                      className="px-2.5 py-1 rounded bg-zinc-200 hover:bg-white text-zinc-950 font-black text-xs transition-colors flex items-center gap-1 active:scale-95 font-mono"
                    >
                      <i className="fa-solid fa-dollar-sign text-[11px]" aria-hidden="true"></i>
                      <span>Cobrar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cobro Modal */}
      {selectedOrderForCobro && (
        <CobroModal
          isOpen={!!selectedOrderForCobro}
          onClose={() => setSelectedOrderForCobro(null)}
          order={selectedOrderForCobro}
          onOrderClosed={refreshData}
        />
      )}

      {/* Receipt Modal */}
      {selectedOrderForReceipt && (
        <ReceiptModal
          isOpen={!!selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
          order={selectedOrderForReceipt}
          type={receiptType}
        />
      )}

      {/* Counter Order Modal */}
      {isCounterOrderModalOpen && (
        <OrderTakingModal
          isOpen={isCounterOrderModalOpen}
          onClose={() => setIsCounterOrderModalOpen(false)}
          table={{
            id: 'mostrador_' + Date.now(),
            number: 'Mostrador',
            sector: 'Mostrador',
            capacity: 1,
            diners: 1
          }}
          channel="mostrador"
          activeOrder={null}
          onOrderSubmitted={refreshData}
        />
      )}
    </div>
  );
}