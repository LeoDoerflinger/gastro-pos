import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import CobroModal from './CobroModal';
import ReceiptModal from '../common/ReceiptModal';
import OrderTakingModal from '../mozo/OrderTakingModal';
import { getTableCode } from '../mozo/MozoSalonView';
import { api } from '../../api/client';

export default function CajeroDashboard() {
  const { orders, tables, refreshData, showToast } = useApp();
  const [channelFilter, setChannelFilter] = useState('todos');
  const [selectedOrderForCobro, setSelectedOrderForCobro] = useState(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);
  const [receiptType, setReceiptType] = useState('precuenta');
  const [isCounterOrderModalOpen, setIsCounterOrderModalOpen] = useState(false);

  const activeOrders = orders.filter(o => o.status === 'abierto' || o.status === 'cuenta_pedida');
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

  const getOrderTableCode = (order) => {
    if (!order.tableId) return null;
    const table = tables.find(t => t.id === order.tableId);
    return table ? getTableCode(table) : `M${order.tableNumber}`;
  };

  const handleRevertBill = async (order) => {
    try {
      await api.revertBill(order.id);
      const code = getOrderTableCode(order) || `#${order.orderNumber}`;
      showToast(`Mesa ${code} devuelta a estado Abierta`);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo revertir el estado', 'error');
    }
  };

  const renderOrderLocation = (order) => {
    if (order.channel === 'mesa') {
      const code = getOrderTableCode(order);
      return (
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-bold text-sm text-[var(--text-primary)] bg-[var(--bg-elevated)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
            {code || `Mesa ${order.tableNumber}`}
          </span>
          <span className="text-xs text-[var(--text-muted)] font-mono">#{order.orderNumber}</span>
        </div>
      );
    }
    if (order.channel === 'delivery') {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <i className="fa-solid fa-motorcycle text-xs text-[var(--accent-brand)] w-4 text-center shrink-0" aria-hidden="true"></i>
          <span className="text-sm font-bold text-[var(--text-primary)]">Delivery</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">#{order.orderNumber}</span>
          {order.customerName && (
            <span className="text-xs text-[var(--text-secondary)] truncate">· {order.customerName}</span>
          )}
        </div>
      );
    }
    if (order.channel === 'take_away') {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <i className="fa-solid fa-bag-shopping text-xs text-[var(--accent-brand)] w-4 text-center shrink-0" aria-hidden="true"></i>
          <span className="text-sm font-bold text-[var(--text-primary)]">Take Away</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">#{order.orderNumber}</span>
          {order.customerName && (
            <span className="text-xs text-[var(--text-secondary)] truncate">· {order.customerName}</span>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-store text-xs text-[var(--accent-brand)] w-4 text-center" aria-hidden="true"></i>
        <span className="text-sm font-bold text-[var(--text-primary)]">Mostrador</span>
        <span className="text-xs text-[var(--text-muted)] font-mono">#{order.orderNumber}</span>
      </div>
    );
  };

  const renderOrderStatusBadge = (order) => {
    if (order.status === 'cuenta_pedida') {
      return (
        <span className="pos-badge pos-badge-bill">
          <i className="fa-solid fa-receipt text-[11px]" aria-hidden="true"></i>
          <span>Pendiente cobro</span>
        </span>
      );
    }
    const statusMap = {
      en_preparacion: 'En cocina',
      listo: 'Listo',
      en_camino: 'En reparto',
      entregado: 'Entregado'
    };
    const label = statusMap[order.kitchenStatus] || 'Abierta';
    return <span className="pos-badge pos-badge-open">{label}</span>;
  };

  const channels = [
    { id: 'todos', label: 'Todos', count: activeOrders.length, icon: 'fa-layer-group' },
    { id: 'mesa', label: 'Salón', count: activeOrders.filter(o => o.channel === 'mesa').length, icon: 'fa-utensils' },
    { id: 'delivery', label: 'Delivery', count: activeOrders.filter(o => o.channel === 'delivery').length, icon: 'fa-motorcycle' },
    { id: 'mostrador', label: 'Mostrador', count: activeOrders.filter(o => o.channel === 'mostrador').length, icon: 'fa-store' },
    { id: 'take_away', label: 'Take Away', count: activeOrders.filter(o => o.channel === 'take_away').length, icon: 'fa-bag-shopping' }
  ];

  return (
    <section className="space-y-5" aria-label="Caja y puntos de venta activos">
      {/* Active Points of Sale Bar */}
      <div className="pb-4 border-b border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <div className="pos-segment-group" role="group" aria-label="Puntos de venta activos">
            {channels.map(ch => (
              <button
                key={ch.id}
                type="button"
                aria-pressed={channelFilter === ch.id}
                onClick={() => setChannelFilter(ch.id)}
                className="pos-segment-btn"
              >
                <i className={`fa-solid ${ch.icon} text-xs text-[var(--accent-brand)]`} aria-hidden="true"></i>
                <span>{ch.label}</span>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  {ch.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCounterOrderModalOpen(true)}
          className="pos-btn-primary self-start lg:self-auto shrink-0"
        >
          <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
          <span>Pedido de mostrador</span>
        </button>
      </div>

      {/* Priority Queue: Pendientes de Cobro (Only buttons trigger actions, never the row) */}
      {billRequestedOrders.length > 0 && (
        <div className="pos-panel border-l-4 border-l-[var(--status-bill-bar)] overflow-hidden">
          <div className="px-4 py-3 bg-[var(--status-bill-bg)] border-b border-[var(--status-bill-border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-bell text-sm text-[var(--status-bill-fg)]" aria-hidden="true"></i>
              <h2 className="font-display font-bold text-base text-[var(--status-bill-fg)]">
                Pendientes de cobro ({billRequestedOrders.length})
              </h2>
            </div>
            <span className="text-xs font-medium text-[var(--status-bill-fg)]">
              Pidieron la cuenta
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {billRequestedOrders.map(order => {
              const tableCode = getOrderTableCode(order);
              return (
                <div
                  key={order.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-[var(--status-bill-fg)] bg-[var(--status-bill-bg)] px-3 py-1 rounded border border-[var(--status-bill-border)]">
                      {tableCode || `#${order.orderNumber}`}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        Atendió: <strong>{order.waiterName || 'Personal'}</strong>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] font-mono">
                        {(order.items || []).length} platos registrados
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-[var(--text-muted)] block">Saldo a cobrar</span>
                      <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                        ${(order.total || order.subtotal).toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRevertBill(order)}
                        className="pos-btn-secondary text-xs"
                      >
                        <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
                        <span>Revertir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenCobro(order)}
                        className="pos-btn-primary"
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

      {/* Active Sales Vertical Ledger */}
      <div className="pos-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-subtle)]">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
            Ventas activas ({filteredOrders.length})
          </h2>
          <span className="text-xs font-medium text-[var(--text-secondary)] capitalize">
            Vista: {channelFilter.replace('_', ' ')}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-11 h-11 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--status-open-fg)] flex items-center justify-center mx-auto">
              <i className="fa-solid fa-check text-lg" aria-hidden="true"></i>
            </div>
            <p className="font-display font-bold text-base text-[var(--text-primary)]">
              No tenés cobros pendientes en este canal
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Las nuevas comandas aparecerán acá automáticamente apenas se carguen.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Desktop Column Headers */}
            <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2.5 bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
              <div className="col-span-3">Mesa / Canal</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-3">Mozo / Operador</div>
              <div className="col-span-2 text-right">Saldo</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            {filteredOrders.map(order => {
              const isPendiente = order.status === 'cuenta_pedida';

              return (
                <div
                  key={order.id}
                  className={`px-4 py-3 transition-colors flex flex-col md:grid md:grid-cols-12 gap-2.5 md:gap-3 md:items-center ${
                    isPendiente
                      ? 'bg-[var(--status-bill-bg)] border-l-4 border-l-[var(--status-bill-bar)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="md:col-span-3 flex items-center justify-between md:justify-start min-w-0">
                    {renderOrderLocation(order)}
                    <div className="md:hidden shrink-0">{renderOrderStatusBadge(order)}</div>
                  </div>

                  <div className="hidden md:block md:col-span-2">{renderOrderStatusBadge(order)}</div>

                  <div className="md:col-span-3 text-sm text-[var(--text-secondary)] flex items-center justify-between md:justify-start">
                    <span className="md:hidden text-xs text-[var(--text-muted)]">Atiende:</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {order.waiterName || order.driverName || 'Cajero'}
                    </span>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between md:justify-end">
                    <span className="md:hidden text-xs text-[var(--text-muted)]">Saldo:</span>
                    <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                      ${(order.total || order.subtotal).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 md:pt-0 border-t border-[var(--border-subtle)] md:border-t-0">
                    {isPendiente && (
                      <button
                        type="button"
                        onClick={() => handleRevertBill(order)}
                        title="Revertir mesa a Abierta"
                        aria-label="Revertir mesa a Abierta"
                        className="pos-btn-secondary px-3"
                      >
                        <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenReceipt(order, 'precuenta')}
                      className="pos-btn-secondary text-xs px-3"
                    >
                      <i className="fa-solid fa-receipt text-xs" aria-hidden="true"></i>
                      <span>Cuenta</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCobro(order)}
                      className="pos-btn-primary text-xs px-3.5"
                    >
                      <i className="fa-solid fa-dollar-sign text-xs" aria-hidden="true"></i>
                      <span>Cobrar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedOrderForCobro && (
        <CobroModal
          isOpen={!!selectedOrderForCobro}
          onClose={() => setSelectedOrderForCobro(null)}
          order={selectedOrderForCobro}
          onOrderClosed={refreshData}
        />
      )}

      {selectedOrderForReceipt && (
        <ReceiptModal
          isOpen={!!selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
          order={selectedOrderForReceipt}
          type={receiptType}
        />
      )}

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
    </section>
  );
}
