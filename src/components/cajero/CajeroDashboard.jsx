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

  const activeOrders = orders.filter(
    o => o.status === 'abierto' || o.status === 'cuenta_solicitada' || o.status === 'pendiente_cobro' || o.status === 'cuenta_pedida'
  );
  const billRequestedOrders = activeOrders.filter(
    o => o.status === 'cuenta_solicitada' || o.status === 'pendiente_cobro' || o.status === 'cuenta_pedida'
  );

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

  const handleMarkPendingPayment = async (order) => {
    try {
      await api.markPendingPayment(order.id);
      const code = getOrderTableCode(order) || `#${order.orderNumber}`;
      showToast(`Mesa ${code} marcada como Pendiente de cobro`);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo cambiar el estado', 'error');
    }
  };

  const handleAdvanceKitchenStatus = async (order, nextStatus) => {
    try {
      await api.updateOrderStatus(order.id, { kitchenStatus: nextStatus });
      const labels = {
        listo: 'Listo',
        en_camino: 'En camino',
        entregado: 'Entregado'
      };
      showToast(`Pedido #${order.orderNumber}: ${labels[nextStatus] || nextStatus}`);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo cambiar el estado del pedido', 'error');
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
    const statusMap = {
      pendiente: 'Pendiente',
      en_preparacion: 'En cocina',
      listo: 'Listo',
      en_camino: 'En reparto',
      entregado: 'Entregado'
    };
    const label = statusMap[order.kitchenStatus] || 'En cocina';
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {order.status === 'cuenta_solicitada' && (
          <span className="pos-badge pos-badge-account">
            <i className="fa-solid fa-bell-concierge text-[11px]" aria-hidden="true"></i>
            <span>Cuenta</span>
          </span>
        )}
        {(order.status === 'pendiente_cobro' || order.status === 'cuenta_pedida') && (
          <span className="pos-badge pos-badge-bill">
            <i className="fa-solid fa-receipt text-[11px]" aria-hidden="true"></i>
            <span>Pendiente cobro</span>
          </span>
        )}
        <span className="pos-badge pos-badge-open">{label}</span>
      </div>
    );
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
                Cuentas y pendientes de cobro ({billRequestedOrders.length})
              </h2>
            </div>
            <span className="text-xs font-medium text-[var(--status-bill-fg)]">
              Prioridad de caja
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {billRequestedOrders.map(order => {
              const tableCode = getOrderTableCode(order);
              const isCuentaStep = order.status === 'cuenta_solicitada';
              return (
                <div
                  key={order.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono font-bold text-sm px-3 py-1 rounded border ${
                        isCuentaStep
                          ? 'text-[var(--status-account-fg)] bg-[var(--status-account-bg)] border-[var(--status-account-border)]'
                          : 'text-[var(--status-bill-fg)] bg-[var(--status-bill-bg)] border-[var(--status-bill-border)]'
                      }`}
                    >
                      {tableCode || `#${order.orderNumber}`}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                        <span>Atendió: <strong>{order.waiterName || 'Personal'}</strong></span>
                        <span className={`pos-badge ${isCuentaStep ? 'pos-badge-account' : 'pos-badge-bill'}`}>
                          {isCuentaStep ? 'Cuenta' : 'Pendiente cobro'}
                        </span>
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

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRevertBill(order)}
                        className="pos-btn-secondary text-xs"
                      >
                        <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
                        <span>Revertir</span>
                      </button>

                      {isCuentaStep && (
                        <button
                          type="button"
                          onClick={() => handleMarkPendingPayment(order)}
                          className="pos-btn-secondary text-xs"
                        >
                          <i className="fa-solid fa-receipt text-xs text-[var(--status-bill-fg)]" aria-hidden="true"></i>
                          <span>Pendiente cobro</span>
                        </button>
                      )}

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
            {filteredOrders.map(order => {
              const isCuenta = order.status === 'cuenta_solicitada';
              const isPendiente = order.status === 'pendiente_cobro' || order.status === 'cuenta_pedida';
              const kStatus = order.kitchenStatus || 'en_preparacion';

              return (
                <div
                  key={order.id}
                  className={`px-4 py-3.5 transition-colors flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${
                    isPendiente
                      ? 'bg-[var(--status-bill-bg)] border-l-4 border-l-[var(--status-bill-bar)]'
                      : isCuenta
                      ? 'bg-[var(--status-account-bg)] border-l-4 border-l-[var(--status-account-bar)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {/* Left & Middle Info: Mesa/Canal + Estado + Mozo */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-5 min-w-0 flex-1">
                    <div className="min-w-[130px] shrink-0">
                      {renderOrderLocation(order)}
                    </div>

                    <div className="shrink-0">
                      {renderOrderStatusBadge(order)}
                    </div>

                    <div className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-[var(--text-muted)]">Mozo:</span>
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {order.waiterName || order.driverName || 'Cajero'}
                      </span>
                    </div>
                  </div>

                  {/* Right Side: Price (with guaranteed spacing) + Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 sm:gap-4 pt-2.5 lg:pt-0 border-t border-[var(--border-subtle)] lg:border-t-0 shrink-0">
                    <div className="text-left lg:text-right pr-1 shrink-0">
                      <span className="lg:hidden text-xs text-[var(--text-muted)] mr-2">Saldo:</span>
                      <span className="font-mono font-bold text-base sm:text-lg text-[var(--text-primary)] whitespace-nowrap">
                        ${(order.total || order.subtotal).toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      {(kStatus === 'en_preparacion' || kStatus === 'pendiente') && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceKitchenStatus(order, 'listo')}
                          className="pos-btn-secondary text-xs px-3"
                        >
                          <i className="fa-solid fa-check text-xs text-[var(--status-open-fg)]" aria-hidden="true"></i>
                          <span>Listo</span>
                        </button>
                      )}

                      {(kStatus === 'listo' || kStatus === 'en_camino') && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceKitchenStatus(order, 'entregado')}
                          className="pos-btn-secondary text-xs px-3"
                        >
                          <i className="fa-solid fa-circle-check text-xs text-[var(--status-open-fg)]" aria-hidden="true"></i>
                          <span>Entregar</span>
                        </button>
                      )}

                      {(isCuenta || isPendiente) && (
                        <button
                          type="button"
                          onClick={() => handleRevertBill(order)}
                          title="Revertir mesa a Abierta"
                          aria-label="Revertir mesa a Abierta"
                          className="pos-btn-secondary text-xs px-3"
                        >
                          <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
                          <span>Revertir</span>
                        </button>
                      )}

                      {isCuenta && (
                        <button
                          type="button"
                          onClick={() => handleMarkPendingPayment(order)}
                          className="pos-btn-secondary text-xs px-3"
                        >
                          <i className="fa-solid fa-file-invoice-dollar text-xs text-[var(--status-bill-fg)]" aria-hidden="true"></i>
                          <span>Pendiente cobro</span>
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
