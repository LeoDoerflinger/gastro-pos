import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import ReceiptModal from '../common/ReceiptModal';
import { getTableCode } from '../mozo/MozoSalonView';
import { formatUserRoleDisplay } from '../../utils/userRoleHelper';

export default function CobroModal({ isOpen, onClose, order, onOrderClosed }) {
  const { currentUser, tables, users, customers, showToast, refreshData } = useApp();

  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [cashTendered, setCashTendered] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [tipAmount, setTipAmount] = useState(order?.tip || 0);
  const [splitCash, setSplitCash] = useState('');
  const [splitDigital, setSplitDigital] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustDni, setQuickCustDni] = useState('');
  const [quickCustLimit, setQuickCustLimit] = useState('100000');
  const [submitting, setSubmitting] = useState(false);
  const [closedOrderReceipt, setClosedOrderReceipt] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !closedOrderReceipt) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closedOrderReceipt, onClose]);

  if (!isOpen || !order) return null;

  const table = tables.find(t => t.id === order.tableId);
  const tableCode = table ? getTableCode(table) : (order.tableNumber ? `M${order.tableNumber}` : null);

  const subtotal = order.subtotal || 0;
  const deliveryFee = order.deliveryFee || 0;
  const totalToPay = Math.max(0, subtotal + deliveryFee - Number(discountAmount || 0) + Number(tipAmount || 0));

  const tenderedNum = cashTendered === '' ? totalToPay : (Number(cashTendered) || 0);
  const changeDue = tenderedNum >= totalToPay ? tenderedNum - totalToPay : 0;

  const presetBills = [
    totalToPay,
    Math.ceil(totalToPay / 1000) * 1000,
    Math.ceil(totalToPay / 5000) * 5000,
    Math.ceil(totalToPay / 10000) * 10000,
    Math.ceil(totalToPay / 20000) * 20000
  ]
    .filter((v, i, a) => v >= totalToPay && a.indexOf(v) === i)
    .slice(0, 4);

  const handleCreateQuickCustomer = async (e) => {
    e.preventDefault();
    if (!quickCustName.trim()) {
      showToast('Ingresá el nombre o razón social del cliente', 'error');
      return;
    }
    try {
      const created = await api.createCustomer({
        name: quickCustName.trim(),
        phone: quickCustPhone.trim(),
        dniCuit: quickCustDni.trim(),
        creditLimit: Number(quickCustLimit) || 100000
      });
      showToast(`Cliente ${created.name} registrado en cuenta corriente`);
      await refreshData();
      setSelectedCustomerId(created.id);
      setIsQuickCustomerOpen(false);
      setQuickCustName('');
      setQuickCustPhone('');
      setQuickCustDni('');
    } catch (err) {
      showToast(err.message || 'Error al crear cliente', 'error');
    }
  };

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'efectivo' && tenderedNum < totalToPay) {
      showToast('El efectivo recibido es menor al total a cobrar', 'error');
      return;
    }

    if (paymentMethod === 'cuenta_corriente' && !selectedCustomerId) {
      showToast('Seleccioná un cliente de cuenta corriente para registrar el consumo', 'error');
      return;
    }

    const selectedCust = customers?.find(c => c.id === selectedCustomerId);

    setSubmitting(true);
    try {
      const payload = {
        paymentMethod,
        discount: Number(discountAmount || 0),
        tip: Number(tipAmount || 0),
        paymentDetails: {
          cashTendered: paymentMethod === 'efectivo' ? tenderedNum : null,
          changeDue: paymentMethod === 'efectivo' ? changeDue : 0,
          splitDetails: paymentMethod === 'mixto' ? { cash: Number(splitCash), digital: Number(splitDigital) } : null,
          customerId: paymentMethod === 'cuenta_corriente' ? selectedCustomerId : null,
          customerName: paymentMethod === 'cuenta_corriente' ? selectedCust?.name : null
        },
        closedBy: currentUser
      };

      const closed = await api.closeOrder(order.id, payload);
      showToast(
        paymentMethod === 'cuenta_corriente'
          ? `Comanda #${order.orderNumber} cargada a cuenta corriente de ${selectedCust?.name || 'cliente'}.`
          : `Comanda #${order.orderNumber} cobrada y cerrada.`
      );
      await refreshData();
      onOrderClosed?.();
      setClosedOrderReceipt(closed);
    } catch (err) {
      showToast(err.message || 'No se pudo procesar el cobro', 'error');
      setSubmitting(false);
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

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cobro-modal-title"
      >
        <div className="pos-panel w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded bg-[var(--bg-elevated)] text-[var(--accent-brand)] border border-[var(--border-subtle)] flex items-center justify-center text-sm">
                <i className="fa-solid fa-cash-register" aria-hidden="true"></i>
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="cobro-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                    Cobrar comanda #{order.orderNumber}
                  </h2>
                  {tableCode && (
                    <span className="pos-badge pos-badge-brand font-mono">{tableCode}</span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Atendió: {formatUserRoleDisplay(order.waiterName || 'Personal', 'mozo', users)} · {order.items?.length || 0} platos
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana de cobro"
              className="pos-btn-ghost"
            >
              <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Items Summary Ledger */}
            <div className="pos-subpanel overflow-hidden max-h-36 overflow-y-auto">
              <div className="flex justify-between font-semibold text-[var(--text-secondary)] text-xs px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                <span>Detalle consumido</span>
                <span>Importe</span>
              </div>
              <div className="divide-y divide-[var(--border-subtle)] px-3">
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between py-2 text-xs text-[var(--text-primary)] gap-2">
                    <div>
                      <strong className="font-mono">{it.quantity}x</strong> {it.productName}
                      {it.notes && <span className="text-xs text-[var(--text-secondary)] italic block">{it.notes}</span>}
                    </div>
                    <span className="font-mono font-semibold shrink-0">${it.subtotal?.toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modifiers & Total */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cobro-discount-input" className="pos-label">
                    Descuento ($):
                  </label>
                  <input
                    id="cobro-discount-input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                    className="pos-input font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="cobro-tip-input" className="pos-label">
                    Propina incluida ($):
                  </label>
                  <input
                    id="cobro-tip-input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={tipAmount || ''}
                    onChange={(e) => setTipAmount(Number(e.target.value) || 0)}
                    className="pos-input font-mono"
                  />
                </div>
              </div>

              <div className="pos-elevated px-4 py-3 flex justify-between items-center border-l-4 border-l-[var(--accent-brand)]">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-secondary)] block">Total final a cobrar</span>
                  {deliveryFee > 0 && (
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      Incluye envío (${deliveryFee.toLocaleString('es-AR')})
                    </span>
                  )}
                </div>
                <span className="font-display font-extrabold text-2xl font-mono text-[var(--text-primary)]">
                  ${totalToPay.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Payment Method Keycaps */}
            <div>
              <span className="pos-label">Medio de pago:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2" role="group" aria-label="Seleccionar medio de pago">
                {paymentOptions.map(method => {
                  const active = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setPaymentMethod(method.id);
                        if (method.id === 'efectivo' && cashTendered === '') {
                          setCashTendered(String(totalToPay));
                        }
                      }}
                      className={`min-h-[56px] p-2 rounded border text-center transition-colors flex flex-col items-center justify-center gap-1 ${
                        active
                          ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-border)] font-bold shadow-sm'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <i className={`fa-solid ${method.icon} text-sm`} aria-hidden="true"></i>
                      <span className="text-xs truncate w-full">{method.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Tender & Vuelto */}
            {paymentMethod === 'efectivo' && (
              <div className="pos-subpanel p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label htmlFor="cash-tendered-input" className="pos-label">
                      Efectivo recibido ($):
                    </label>
                    <input
                      id="cash-tendered-input"
                      type="number"
                      placeholder={totalToPay.toString()}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="pos-input font-mono font-bold"
                    />
                  </div>

                  <div className="pos-elevated px-3.5 py-2.5 text-right">
                    <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                      {tenderedNum >= totalToPay ? 'Vuelto a entregar' : 'Faltan cubrir'}
                    </span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        tenderedNum >= totalToPay ? 'text-[var(--status-open-fg)]' : 'text-[var(--status-danger-fg)]'
                      }`}
                    >
                      ${Math.abs(tenderedNum - totalToPay).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-xs text-[var(--text-muted)] mr-1">Pago rápido:</span>
                  {presetBills.map(bill => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setCashTendered(String(bill))}
                      className="pos-btn-secondary text-xs font-mono px-3"
                    >
                      ${bill.toLocaleString('es-AR')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashTendered(String(totalToPay))}
                    className="pos-btn-secondary text-xs px-3"
                  >
                    Justo
                  </button>
                </div>
              </div>
            )}

            {paymentMethod === 'mercadopago' && (
              <div className="pos-subpanel p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-white p-2 rounded border border-[#cfc9be] flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-qrcode text-3xl text-[#18191b]" aria-hidden="true"></i>
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-[var(--text-primary)]">QR interoperable listo</div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Importe a cobrar: <strong className="font-mono text-[var(--text-primary)]">${totalToPay.toLocaleString('es-AR')}</strong>
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Compatible con cualquier billetera o banco.</p>
                </div>
              </div>
            )}

            {paymentMethod === 'mixto' && (
              <div className="pos-subpanel p-3.5 space-y-2.5">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Dividí el cobro entre efectivo y medio digital:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="split-cash-input" className="pos-label">Efectivo ($):</label>
                    <input
                      id="split-cash-input"
                      type="number"
                      placeholder="0"
                      value={splitCash}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setSplitCash(val);
                        setSplitDigital(Math.max(0, totalToPay - val));
                      }}
                      className="pos-input font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="split-digital-input" className="pos-label">Tarjeta / QR ($):</label>
                    <input
                      id="split-digital-input"
                      type="number"
                      placeholder="0"
                      value={splitDigital}
                      onChange={(e) => setSplitDigital(Number(e.target.value) || 0)}
                      className="pos-input font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'cuenta_corriente' && (
              <div className="pos-subpanel p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <i className="fa-solid fa-book-bookmark text-[var(--accent-brand)]" aria-hidden="true"></i>
                    <span>Cargar a cuenta corriente de cliente:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickCustomerOpen(!isQuickCustomerOpen)}
                    className="pos-btn-secondary text-xs px-2.5"
                  >
                    <i className={`fa-solid ${isQuickCustomerOpen ? 'fa-xmark' : 'fa-plus'} text-xs`} aria-hidden="true"></i>
                    <span>{isQuickCustomerOpen ? 'Cancelar' : 'Nuevo cliente'}</span>
                  </button>
                </div>

                {isQuickCustomerOpen ? (
                  <form onSubmit={handleCreateQuickCustomer} className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded space-y-2.5">
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      Alta rápida de cliente para cuenta corriente
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="pos-label">Nombre / Razón Social *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Estudio Jurídico..."
                          value={quickCustName}
                          onChange={(e) => setQuickCustName(e.target.value)}
                          className="pos-input text-xs"
                        />
                      </div>
                      <div>
                        <label className="pos-label">Teléfono (WhatsApp)</label>
                        <input
                          type="text"
                          placeholder="Ej. 351 512-3456"
                          value={quickCustPhone}
                          onChange={(e) => setQuickCustPhone(e.target.value)}
                          className="pos-input text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="pos-label">DNI o CUIT</label>
                        <input
                          type="text"
                          placeholder="Ej. 20-33445566-7"
                          value={quickCustDni}
                          onChange={(e) => setQuickCustDni(e.target.value)}
                          className="pos-input text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="pos-label">Límite de crédito ($)</label>
                        <input
                          type="number"
                          placeholder="100000"
                          value={quickCustLimit}
                          onChange={(e) => setQuickCustLimit(e.target.value)}
                          className="pos-input text-xs font-mono"
                        />
                      </div>
                    </div>
                    <button type="submit" className="pos-btn-primary text-xs w-full">
                      Guardar y seleccionar cliente
                    </button>
                  </form>
                ) : (
                  <div>
                    <label htmlFor="customer-select" className="pos-label">
                      Seleccionar cliente registrado:
                    </label>
                    <select
                      id="customer-select"
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="pos-input text-xs"
                    >
                      <option value="">-- Seleccioná un cliente con cuenta corriente --</option>
                      {(customers || [])
                        .filter(c => c.status !== 'inactivo')
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''} · Saldo actual: ${Number(c.currentBalance || 0).toLocaleString('es-AR')}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {selectedCustomerId && (() => {
                  const cust = customers.find(c => c.id === selectedCustomerId);
                  if (!cust) return null;
                  const current = Number(cust.currentBalance || 0);
                  const nextBalance = current + totalToPay;
                  const limit = Number(cust.creditLimit || 0);
                  const isOverLimit = limit > 0 && nextBalance > limit;

                  return (
                    <div className={`p-3 rounded border text-xs space-y-1.5 ${
                      isOverLimit ? 'bg-[var(--status-danger-bg)] border-[var(--status-danger-bar)]' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                    }`}>
                      <div className="flex justify-between items-center text-[var(--text-primary)]">
                        <span>Cliente: <strong>{cust.name}</strong></span>
                        <span className="font-mono text-[var(--text-secondary)]">Límite: ${limit.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-muted)]">Saldo actual adeudado:</span>
                        <span className="font-mono font-bold text-[var(--text-primary)]">${current.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[var(--border-subtle)]">
                        <span className="font-semibold text-[var(--text-primary)]">Nuevo saldo tras este consumo:</span>
                        <span className={`font-mono font-bold text-sm ${isOverLimit ? 'text-[var(--status-danger-fg)]' : 'text-[var(--accent-brand)]'}`}>
                          ${nextBalance.toLocaleString('es-AR')}
                        </span>
                      </div>
                      {isOverLimit && (
                        <p className="text-[11px] text-[var(--status-danger-fg)] font-semibold pt-0.5">
                          Atención: El nuevo saldo supera el límite de crédito acordado.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="pos-btn-secondary px-5"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={submitting || (paymentMethod === 'efectivo' && tenderedNum < totalToPay)}
              onClick={handleConfirmPayment}
              className="pos-btn-primary flex-1"
            >
              <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
              <span>
                {submitting ? 'Registrando cobro...' : `Confirmar cobro · $${totalToPay.toLocaleString('es-AR')}`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {closedOrderReceipt && (
        <ReceiptModal
          isOpen={!!closedOrderReceipt}
          onClose={() => {
            setClosedOrderReceipt(null);
            onClose();
          }}
          order={closedOrderReceipt}
          type="fiscal"
        />
      )}
    </>
  );
}
