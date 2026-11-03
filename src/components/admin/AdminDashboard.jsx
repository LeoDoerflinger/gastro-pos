import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatUserRoleDisplay } from '../../utils/userRoleHelper';
import ReceiptModal from '../common/ReceiptModal';

export default function AdminDashboard() {
  const { analytics, orders, users, customers, correctOrderPayment } = useApp();

  const [filterSearch, setFilterSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('todos');

  // Modal para corregir medio de pago
  const [orderToCorrect, setOrderToCorrect] = useState(null);
  const [newMethod, setNewMethod] = useState('efectivo');
  const [correctionReason, setCorrectionReason] = useState('Error de registro en caja');
  const [corrSplitCash, setCorrSplitCash] = useState('');
  const [corrSplitDigital, setCorrSplitDigital] = useState('');
  const [corrCustomerId, setCorrCustomerId] = useState('');
  const [submittingCorr, setSubmittingCorr] = useState(false);

  // Modal para ver/reimprimir ticket
  const [selectedTicketOrder, setSelectedTicketOrder] = useState(null);

  if (!analytics) return null;

  const {
    totalVentas,
    totalTickets,
    ticketPromedio,
    byChannel,
    byPaymentMethod,
    topProducts,
    lowStockIngredients,
    activeOrdersCount,
    openTablesCount
  } = analytics;

  const totalChannelAmount = Object.values(byChannel || {}).reduce((a, b) => a + b, 0) || 1;
  const totalPaymentAmount = Object.values(byPaymentMethod || {}).reduce((a, b) => a + b, 0) || 1;
  const closedOrders = orders.filter(o => o.status === 'cobrado');
  const maxProductQty = Math.max(1, ...(topProducts || []).map(p => p.qty || 0));

  const getPaymentBadgeClass = (method) => {
    switch (method?.toLowerCase()) {
      case 'efectivo':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
      case 'mercadopago':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/25';
      case 'debito':
      case 'credito':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
      case 'transferencia':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/25';
      case 'cuenta_corriente':
        return 'text-teal-400 bg-teal-500/10 border-teal-500/25';
      case 'mixto':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/25';
    }
  };

  const paymentOptions = [
    { id: 'efectivo', label: 'Efectivo', icon: 'fa-money-bill-wave' },
    { id: 'debito', label: 'Débito', icon: 'fa-credit-card' },
    { id: 'credito', label: 'Crédito', icon: 'fa-credit-card' },
    { id: 'mercadopago', label: 'QR / MP', icon: 'fa-qrcode' },
    { id: 'transferencia', label: 'Transfer.', icon: 'fa-building-columns' },
    { id: 'cuenta_corriente', label: 'Cta. Cte.', icon: 'fa-book-bookmark' },
    { id: 'mixto', label: 'Mixto', icon: 'fa-scale-balanced' }
  ];

  const handleOpenCorrection = (order) => {
    setOrderToCorrect(order);
    setNewMethod(order.paymentMethod || 'efectivo');
    setCorrectionReason('Error de tipeo en caja');
    const total = Number(order.total) || 0;
    if (order.paymentMethod === 'mixto' && order.paymentDetails?.splitDetails) {
      setCorrSplitCash(String(order.paymentDetails.splitDetails.cash || ''));
      setCorrSplitDigital(String(order.paymentDetails.splitDetails.digital || ''));
    } else {
      const half = Math.round(total / 2);
      setCorrSplitCash(String(half));
      setCorrSplitDigital(String(total - half));
    }
    setCorrCustomerId(order.customerId || '');
  };

  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    if (!orderToCorrect) return;

    const total = Number(orderToCorrect.total) || 0;
    let paymentDetails = null;

    if (newMethod === 'mixto') {
      const c = Number(corrSplitCash) || 0;
      const d = Number(corrSplitDigital) || 0;
      if (c <= 0 && d <= 0) {
        alert('Ingresá los montos de efectivo y digital para el pago mixto.');
        return;
      }
      if (c + d !== total) {
        alert(`La suma ($${(c + d).toLocaleString('es-AR')}) debe ser igual al total del ticket ($${total.toLocaleString('es-AR')}).`);
        return;
      }
      paymentDetails = { splitDetails: { cash: c, digital: d } };
    } else if (newMethod === 'cuenta_corriente') {
      if (!corrCustomerId) {
        alert('Seleccioná un cliente de cuenta corriente.');
        return;
      }
      const cust = customers?.find(c => c.id === corrCustomerId);
      paymentDetails = { customerId: corrCustomerId, customerName: cust?.name || '' };
    }

    setSubmittingCorr(true);
    try {
      await correctOrderPayment(orderToCorrect.id, {
        paymentMethod: newMethod,
        paymentDetails,
        reason: correctionReason.trim()
      });
      setOrderToCorrect(null);
    } catch {
      // toast already handled
    } finally {
      setSubmittingCorr(false);
    }
  };

  const filteredClosedOrders = closedOrders.filter(ord => {
    if (filterMethod !== 'todos' && ord.paymentMethod !== filterMethod) return false;
    if (filterSearch.trim()) {
      const term = filterSearch.toLowerCase().trim();
      const matchNum = String(ord.orderNumber).includes(term);
      const matchTable = String(ord.tableNumber || '').includes(term);
      const matchWaiter = String(ord.waiterName || '').toLowerCase().includes(term);
      const matchCustomer = String(ord.customerName || '').toLowerCase().includes(term);
      if (!matchNum && !matchTable && !matchWaiter && !matchCustomer) return false;
    }
    return true;
  });

  return (
    <section className="space-y-6" aria-label="Dashboard Administrativo">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="pos-panel p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Ventas del turno</span>
          <div className="text-2xl font-extrabold font-mono text-[var(--text-primary)] mt-1">
            ${totalVentas?.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-2">
            {totalTickets} tickets emitidos
          </span>
        </div>

        <div className="pos-panel p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Ticket promedio</span>
          <div className="text-2xl font-extrabold font-mono text-[var(--text-primary)] mt-1">
            ${ticketPromedio?.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-2">
            Por comanda cobrada
          </span>
        </div>

        <div className="pos-panel p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Mesas en servicio</span>
          <div className="text-2xl font-extrabold font-mono text-[var(--accent-brand)] mt-1">
            {openTablesCount}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-2">
            {activeOrdersCount} pedidos activos
          </span>
        </div>

        <div className="pos-panel p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Insumos en alerta</span>
          <div className={`text-2xl font-extrabold font-mono mt-1 ${
            (lowStockIngredients?.length || 0) > 0 ? 'text-[var(--status-danger-fg)]' : 'text-[var(--text-primary)]'
          }`}>
            {lowStockIngredients?.length || 0}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-2">
            Por debajo del stock mínimo
          </span>
        </div>
      </div>

      {/* Analytics Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Canales de Venta */}
        <div className="pos-panel p-4 space-y-3">
          <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
            Canales de venta
          </h3>
          <div className="space-y-2 text-xs">
            {Object.entries(byChannel || {}).map(([chan, amount]) => {
              const pct = Math.round((amount / totalChannelAmount) * 100);
              return (
                <div key={chan} className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="capitalize">{chan.replace('_', ' ')}</span>
                    <span className="font-bold">${amount.toLocaleString('es-AR')} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[var(--bg-subtle)] h-2 rounded overflow-hidden">
                    <div className="bg-[var(--accent-brand)] h-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Medios de Pago */}
        <div className="pos-panel p-4 space-y-3">
          <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
            Medios de pago recibidos
          </h3>
          <div className="space-y-2 text-xs">
            {Object.entries(byPaymentMethod || {}).map(([method, amount]) => {
              const pct = Math.round((amount / totalPaymentAmount) * 100);
              return (
                <div key={method} className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="capitalize">{method.replace('_', ' ')}</span>
                    <span className="font-bold">${amount.toLocaleString('es-AR')} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[var(--bg-subtle)] h-2 rounded overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Platos */}
        <div className="pos-panel p-4 space-y-3">
          <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
            Platos más pedidos
          </h3>
          <div className="space-y-2 text-xs">
            {(topProducts || []).map((p, idx) => {
              const pct = Math.round(((p.qty || 0) / maxProductQty) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="truncate pr-2 font-medium">{p.name}</span>
                    <span className="font-mono font-bold shrink-0">{p.qty} un</span>
                  </div>
                  <div className="w-full bg-[var(--bg-subtle)] h-2 rounded overflow-hidden">
                    <div className="bg-amber-500 h-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historial de Cobros y Tickets Cerrados */}
      <div className="pos-panel overflow-hidden space-y-0">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Historial de Cobros y Corrección de Métodos de Pago
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Accedé al registro de ventas cerradas y rectificá el medio de pago en caso de error de tipeo.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Buscar comanda, mesa, mozo..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pos-input text-xs py-1.5 px-3 min-w-[200px]"
            />

            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="pos-input text-xs py-1.5 px-3 bg-[var(--bg-surface)]"
            >
              <option value="todos">Todos los medios ({closedOrders.length})</option>
              <option value="efectivo">Efectivo</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="mercadopago">QR / MercadoPago</option>
              <option value="transferencia">Transferencia</option>
              <option value="cuenta_corriente">Cuenta Corriente</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-semibold">
                <th className="py-3 px-4">Comanda</th>
                <th className="py-3 px-4">Canal</th>
                <th className="py-3 px-4">Atendió / Cobró</th>
                <th className="py-3 px-4">Medio de pago</th>
                <th className="py-3 px-4">Hora cierre</th>
                <th className="py-3 px-4 text-right">Importe</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs sm:text-sm">
              {filteredClosedOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    No se encontraron tickets cerrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredClosedOrders.map(ord => {
                  const hasCorrections = Array.isArray(ord.paymentCorrections) && ord.paymentCorrections.length > 0;
                  return (
                    <tr key={ord.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)] font-mono">
                        <div>#{ord.orderNumber} {ord.tableNumber ? `(Mesa ${ord.tableNumber})` : ''}</div>
                        {hasCorrections && (
                          <span className="text-[10px] font-sans font-bold text-amber-500 inline-block bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded mt-0.5">
                            Corregido ({ord.paymentCorrections.length})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 capitalize text-xs font-semibold text-[var(--text-secondary)]">
                        {ord.channel?.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-primary)]">
                        <div>{formatUserRoleDisplay(ord.waiterName || 'Personal', 'mozo', users)}</div>
                        <span className="text-[11px] text-[var(--text-muted)]">Caja: {ord.closedBy || 'Cajero'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${getPaymentBadgeClass(ord.paymentMethod)}`}>
                          {ord.paymentMethod || 'Efectivo'}
                        </span>
                        {ord.paymentMethod === 'cuenta_corriente' && ord.customerName && (
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{ord.customerName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] text-xs font-mono">
                        {new Date(ord.closedAt || ord.createdAt).toLocaleString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-500">
                        ${ord.total?.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCorrection(ord)}
                            className="pos-btn-secondary text-xs px-2.5 py-1 text-[var(--accent-brand)]"
                            title="Rectificar medio de pago"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs mr-1" aria-hidden="true"></i>
                            <span>Corregir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTicketOrder(ord)}
                            className="pos-btn-secondary text-xs px-2.5 py-1 text-[var(--text-secondary)]"
                            title="Ver o imprimir comprobante"
                          >
                            <i className="fa-solid fa-receipt text-xs mr-1" aria-hidden="true"></i>
                            <span>Ticket</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Rectificar Medio de Pago */}
      {orderToCorrect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="corr-modal-title"
        >
          <div className="pos-panel w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-file-pen text-[var(--accent-brand)]" aria-hidden="true"></i>
                <div>
                  <h3 id="corr-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                    Corregir cobro comanda #{orderToCorrect.orderNumber}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Importe total: <strong className="font-mono text-[var(--text-primary)]">${Number(orderToCorrect.total).toLocaleString('es-AR')}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToCorrect(null)}
                className="pos-btn-ghost -mr-1"
                aria-label="Cerrar modal"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4">
              <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Medio de pago actual registrado:</span>
                  <span className="font-bold font-mono uppercase text-[var(--text-primary)]">
                    {orderToCorrect.paymentMethod || 'Efectivo'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Hora de cierre original:</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {new Date(orderToCorrect.closedAt || orderToCorrect.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Selector de nuevo medio de pago */}
              <div>
                <label className="pos-label">Seleccioná el nuevo medio de pago real:</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {paymentOptions.map(opt => {
                    const active = newMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewMethod(opt.id)}
                        className={`p-2 rounded border text-center transition-colors flex flex-col items-center justify-center gap-1 ${
                          active
                            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-border)] font-bold'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <i className={`fa-solid ${opt.icon} text-xs`} aria-hidden="true"></i>
                        <span className="text-xs truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mixto Fields */}
              {newMethod === 'mixto' && (
                <div className="pos-subpanel p-3 space-y-2 border-l-4 border-l-[var(--accent-brand)]">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    Importes a corregir (total: ${Number(orderToCorrect.total).toLocaleString('es-AR')}):
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="pos-label">Efectivo ($):</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={corrSplitCash}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                          setCorrSplitCash(val);
                          if (val !== '') {
                            setCorrSplitDigital(String(Math.max(0, Number(orderToCorrect.total) - Number(val))));
                          }
                        }}
                        className="pos-input font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="pos-label">Digital / Tarjeta ($):</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={corrSplitDigital}
                        onChange={(e) => setCorrSplitDigital(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        className="pos-input font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cuenta Corriente Customer */}
              {newMethod === 'cuenta_corriente' && (
                <div>
                  <label className="pos-label">Asignar a cliente de cuenta corriente:</label>
                  <select
                    value={corrCustomerId}
                    onChange={(e) => setCorrCustomerId(e.target.value)}
                    className="pos-input text-xs bg-[var(--bg-surface)]"
                    required
                  >
                    <option value="">Seleccionar cliente...</option>
                    {(customers || []).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Saldo: ${c.currentBalance?.toLocaleString('es-AR')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Motivo de corrección */}
              <div>
                <label htmlFor="corr-reason" className="pos-label">Motivo u observación de la corrección:</label>
                <input
                  id="corr-reason"
                  type="text"
                  required
                  placeholder="Ej. El cliente pagó por transferencia a último momento"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              {/* Historial de correcciones previas si existiesen */}
              {Array.isArray(orderToCorrect.paymentCorrections) && orderToCorrect.paymentCorrections.length > 0 && (
                <div className="p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1 text-xs">
                  <span className="font-semibold text-[var(--text-secondary)] block">Historial de rectificaciones previas:</span>
                  {orderToCorrect.paymentCorrections.map((c, i) => (
                    <div key={i} className="text-[11px] text-[var(--text-muted)]">
                      · {c.previousMethod} -&gt; {c.newMethod}: "{c.reason}" por {c.correctedBy} ({new Date(c.correctedAt).toLocaleTimeString()})
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setOrderToCorrect(null)}
                  className="pos-btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCorr || newMethod === orderToCorrect.paymentMethod}
                  className="pos-btn-primary flex-1"
                >
                  {submittingCorr ? 'Guardando...' : 'Aplicar corrección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para ver ticket */}
      {selectedTicketOrder && (
        <ReceiptModal
          isOpen={!!selectedTicketOrder}
          onClose={() => setSelectedTicketOrder(null)}
          order={selectedTicketOrder}
          type="fiscal"
        />
      )}
    </section>
  );
}
