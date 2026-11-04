import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getTableCode } from '../mozo/MozoSalonView';
import { formatUserRoleDisplay } from '../../utils/userRoleHelper';

export default function ReceiptModal({ isOpen, onClose, order, type = 'precuenta' }) {
  const { tables, users, businessConfig, activeTenant, refreshData } = useApp();
  const printRef = useRef(null);

  const [discountValue, setDiscountValue] = useState(order?.discount || 0);
  const [customDiscountInput, setCustomDiscountInput] = useState(order?.discount ? String(order.discount) : '');

  useEffect(() => {
    if (order?.discount !== undefined) {
      setDiscountValue(order.discount || 0);
      setCustomDiscountInput(order.discount > 0 ? String(order.discount) : '');
    }
  }, [order]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleApplyDiscount = async (val) => {
    const num = Math.max(0, Number(val) || 0);
    setDiscountValue(num);
    setCustomDiscountInput(num > 0 ? String(num) : '');
    try {
      await api.updateOrderDiscount(order.id, num);
      order.discount = num;
      order.total = Math.max(0, (order.subtotal || 0) + (order.deliveryFee || 0) - num);
      await refreshData();
    } catch (e) {}
  };

  const handleCustomDiscountChange = (strVal) => {
    setCustomDiscountInput(strVal);
    const num = Math.max(0, Number(strVal) || 0);
    setDiscountValue(num);
    api.updateOrderDiscount(order.id, num).then(async () => {
      order.discount = num;
      order.total = Math.max(0, (order.subtotal || 0) + (order.deliveryFee || 0) - num);
      await refreshData();
    }).catch(() => {});
  };

  const table = tables.find(t => t.id === order.tableId);
  const tableCode = table ? getTableCode(table) : (order.tableNumber ? `M${order.tableNumber}` : null);

  const isPrecuenta = type === 'precuenta';
  const tip10 = Math.round((order.subtotal || 0) * 0.1);
  const finalTotal = Math.max(0, (order.subtotal || 0) + (order.deliveryFee || 0) - discountValue + (isPrecuenta ? tip10 : 0));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="pos-panel w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-receipt text-[var(--accent-brand)] text-sm" aria-hidden="true"></i>
            <h2 id="receipt-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
              {isPrecuenta ? 'Pre-cuenta de control' : 'Comprobante de cobro'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pos-btn-ghost"
            aria-label="Cerrar comprobante"
          >
            <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        {/* Discount Selector Bar (Pre-cuenta de control) */}
        {isPrecuenta && (
          <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <i className="fa-solid fa-percent text-[var(--accent-brand)]" aria-hidden="true"></i>
                Descuento antes de imprimir:
              </span>
              {discountValue > 0 && (
                <span className="pos-badge pos-badge-open text-[11px] font-mono">
                  -${discountValue.toLocaleString('es-AR')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: '0%', val: 0 },
                { label: '10%', val: Math.round((order.subtotal || 0) * 0.1) },
                { label: '15%', val: Math.round((order.subtotal || 0) * 0.15) },
                { label: '20%', val: Math.round((order.subtotal || 0) * 0.2) },
                { label: '25%', val: Math.round((order.subtotal || 0) * 0.25) }
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyDiscount(preset.val)}
                  className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors ${
                    discountValue === preset.val
                      ? 'bg-[var(--accent-brand)] text-white'
                      : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-[var(--text-muted)]">$</span>
                <input
                  type="number"
                  placeholder="Monto $"
                  value={customDiscountInput}
                  onChange={(e) => handleCustomDiscountChange(e.target.value)}
                  className="w-20 text-xs py-1 px-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-right"
                />
              </div>
            </div>
          </div>
        )}

        {/* Thermal Ticket Slip */}
        <div className="p-4 overflow-y-auto flex-1 bg-[var(--bg-subtle)] flex justify-center">
          <div
            ref={printRef}
            className="printable-ticket w-full bg-[#faf8f2] text-[#18191b] p-5 rounded border border-[#cfc9be] font-mono text-xs shadow-sm select-all tabular-nums space-y-3"
          >
            <div className="text-center pb-3 border-b border-dashed border-[#8c867a]">
              <div className="font-bold text-sm tracking-tight">{(businessConfig?.name || activeTenant?.name || 'GastroPOS Restó').toUpperCase()}</div>
              <p className="text-[11px] text-[#43464c]">
                {businessConfig?.address || 'Av. Hipólito Yrigoyen 450, Nueva Córdoba'}, {businessConfig?.city || 'Córdoba Capital'} · Tel: {businessConfig?.phone || '(0351) 425-8899'}
              </p>
              <p className="text-[11px] text-[#43464c]">
                CUIT {businessConfig?.cuit || '30-71999888-4'} · IVA Resp. Inscripto
              </p>
            </div>

            <div className="pb-3 border-b border-dashed border-[#8c867a] space-y-1 text-xs">
              <div className="flex justify-between font-bold">
                <span>{isPrecuenta ? 'CONTROL DE MESA' : `TICKET #0001-${order.orderNumber || '101'}`}</span>
                <span className="uppercase">{order.channel?.replace('_', ' ')}</span>
              </div>
              {tableCode && (
                <div className="flex justify-between font-bold">
                  <span>MESA: {tableCode}</span>
                  <span>Cubiertos: {order.diners || 1}</span>
                </div>
              )}
              {order.customerName && (
                <div className="flex justify-between">
                  <span>Cliente: {order.customerName}</span>
                </div>
              )}
              <div className="flex justify-between text-[#43464c] text-[11px]">
                <span>Atendió: {formatUserRoleDisplay(order.waiterName || 'Personal', 'mozo', users)}</span>
                <span>{new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="pb-3 border-b border-dashed border-[#8c867a] space-y-1.5">
              <div className="flex justify-between font-bold text-[11px] text-[#43464c] border-b border-[#d8d3c8] pb-1">
                <span>Cant. / Plato</span>
                <span>Importe</span>
              </div>
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs gap-2">
                  <div>
                    <span className="font-bold">{it.quantity}x </span>
                    <span>{it.productName}</span>
                    {it.notes && (
                      <p className="text-[11px] text-[#43464c] italic pl-3">{it.notes}</p>
                    )}
                  </div>
                  <span className="font-bold shrink-0">${it.subtotal?.toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>

            <div className="pb-3 border-b border-dashed border-[#8c867a] space-y-1 text-xs">
              <div className="flex justify-between text-[#43464c]">
                <span>Subtotal:</span>
                <span>${(order.subtotal || 0).toLocaleString('es-AR')}</span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="flex justify-between text-[#43464c]">
                  <span>Envío:</span>
                  <span>${order.deliveryFee.toLocaleString('es-AR')}</span>
                </div>
              )}
              {discountValue > 0 && (
                <div className="flex justify-between text-[#185936] font-bold">
                  <span>Descuento aplicado:</span>
                  <span>-${discountValue.toLocaleString('es-AR')}</span>
                </div>
              )}
              {isPrecuenta && (
                <div className="flex justify-between text-[#43464c] italic text-[11px]">
                  <span>Propina sugerida (10%):</span>
                  <span>${tip10.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-[#cfc9be] text-[#18191b]">
                <span>TOTAL:</span>
                <span>${finalTotal.toLocaleString('es-AR')}</span>
              </div>
            </div>

            {!isPrecuenta && (
              <div className="pb-2 border-b border-dashed border-[#8c867a] text-[11px] space-y-0.5 text-[#43464c]">
                <div className="flex justify-between font-semibold">
                  <span>Medio de pago:</span>
                  <span className="uppercase text-[#18191b]">{order.paymentMethod || 'Efectivo'}</span>
                </div>
                {order.paymentDetails?.cashTendered && (
                  <>
                    <div className="flex justify-between">
                      <span>Recibido:</span>
                      <span>${Number(order.paymentDetails.cashTendered).toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#18191b]">
                      <span>Vuelto:</span>
                      <span>${Number(order.paymentDetails.changeDue || 0).toLocaleString('es-AR')}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="text-center pt-1 text-[11px] text-[#43464c]">
              {isPrecuenta ? (
                <>
                  <p className="font-bold text-[#18191b]">NO VÁLIDO COMO FACTURA</p>
                  <p>{businessConfig?.receiptFooter || 'Pedí tu comprobante fiscal en caja.'}</p>
                </>
              ) : (
                <p className="font-bold text-[#18191b]">
                  {businessConfig?.receiptFooter || 'GRACIAS POR SU VISITA'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal actions */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="pos-btn-primary flex-1"
          >
            <i className="fa-solid fa-print text-xs" aria-hidden="true"></i>
            <span>Imprimir</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pos-btn-secondary px-5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
