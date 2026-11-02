import React, { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getTableCode } from '../mozo/MozoSalonView';

export default function ReceiptModal({ isOpen, onClose, order, type = 'precuenta' }) {
  const { tables } = useApp();
  const printRef = useRef(null);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const table = tables.find(t => t.id === order.tableId);
  const tableCode = table ? getTableCode(table) : (order.tableNumber ? `M${order.tableNumber}` : null);

  const isPrecuenta = type === 'precuenta';
  const tip10 = Math.round((order.subtotal || 0) * 0.1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between bg-[#09090b]">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-receipt text-zinc-400 text-xs" aria-hidden="true"></i>
            <h3 className="font-mono font-bold text-zinc-100 text-xs uppercase tracking-wider">
              {isPrecuenta ? 'Pre-Cuenta de Mesa' : 'Comprobante de Pago'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <i className="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
          </button>
        </div>

        {/* Thermal Ticket Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-black/50 flex justify-center">
          <div 
            ref={printRef}
            className="w-full bg-[#f4f4f5] text-zinc-900 p-4 rounded-xs font-mono text-[11px] shadow border border-zinc-300 select-all tabular-nums"
          >
            {/* Header branding */}
            <div className="text-center pb-2.5 border-b border-dashed border-zinc-400">
              <h2 className="font-bold text-xs uppercase tracking-wider">GASTROGESTIÓN RESTÓ</h2>
              <p className="text-[9px] text-zinc-600">Av. Gastronómica 1234, CABA</p>
              <p className="text-[9px] text-zinc-600">CUIT: 30-71999888-4 · IVA Resp. Inscripto</p>
            </div>

            {/* Order metadata */}
            <div className="py-2 border-b border-dashed border-zinc-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between font-bold">
                <span>{isPrecuenta ? 'PRE-CUENTA DE CONTROL' : 'TICKET FISCAL #0001-' + (order.orderNumber || '101')}</span>
                <span>{order.channel?.toUpperCase()}</span>
              </div>
              {tableCode && (
                <div className="flex justify-between font-bold text-zinc-900">
                  <span>MESA: {tableCode}</span>
                  <span>Comensales: {order.diners || 1}</span>
                </div>
              )}
              {order.customerName && (
                <div className="flex justify-between">
                  <span>Cliente: {order.customerName}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600 text-[9px]">
                <span>Mozo: {order.waiterName || 'Personal'}</span>
                <span>{new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Items list */}
            <div className="py-2 border-b border-dashed border-zinc-400 space-y-1">
              <div className="flex justify-between font-bold text-[9px] text-zinc-500 uppercase border-b border-zinc-300 pb-0.5">
                <span>Cant · Detalle</span>
                <span>Subtotal</span>
              </div>
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between items-start text-[10px]">
                  <div className="pr-2">
                    <span className="font-bold">{it.quantity}x </span>
                    <span>{it.productName}</span>
                    {it.notes && (
                      <p className="text-[8px] text-zinc-500 italic pl-2">↳ {it.notes}</p>
                    )}
                  </div>
                  <span className="font-bold shrink-0">${it.subtotal?.toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-zinc-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between text-zinc-700">
                <span>SUBTOTAL:</span>
                <span>${(order.subtotal || 0).toLocaleString('es-AR')}</span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="flex justify-between text-zinc-700">
                  <span>Envío:</span>
                  <span>${order.deliveryFee.toLocaleString('es-AR')}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Descuento:</span>
                  <span>-${order.discount.toLocaleString('es-AR')}</span>
                </div>
              )}
              {isPrecuenta && (
                <div className="flex justify-between text-zinc-600 italic text-[9px]">
                  <span>Propina Sugerida (10%):</span>
                  <span>${tip10.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-zinc-300 text-zinc-950">
                <span>TOTAL:</span>
                <span>${(isPrecuenta ? (order.subtotal + tip10) : order.total).toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Payment Details if Charged */}
            {!isPrecuenta && (
              <div className="py-1.5 border-b border-dashed border-zinc-400 text-[9px] space-y-0.5 text-zinc-600">
                <div className="flex justify-between font-semibold">
                  <span>Método de Pago:</span>
                  <span className="uppercase text-zinc-900">{order.paymentMethod || 'Efectivo'}</span>
                </div>
                {order.paymentDetails?.cashTendered && (
                  <>
                    <div className="flex justify-between">
                      <span>Abonó con:</span>
                      <span>${Number(order.paymentDetails.cashTendered).toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-zinc-900">
                      <span>Vuelto:</span>
                      <span>${Number(order.paymentDetails.changeDue || 0).toLocaleString('es-AR')}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-2 text-[9px] text-zinc-500">
              {isPrecuenta ? (
                <>
                  <p className="font-bold text-zinc-800">DOCUMENTO NO VÁLIDO COMO FACTURA</p>
                  <p>Solicite su ticket fiscal en caja.</p>
                </>
              ) : (
                <p className="font-bold text-zinc-800">GRACIAS POR SU VISITA</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal actions */}
        <div className="p-3 border-t border-[#27272a] bg-[#09090b] flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-all"
          >
            <i className="fa-solid fa-print text-xs" aria-hidden="true"></i>
            <span>Imprimir</span>
          </button>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-300 font-mono text-xs border border-[#27272a] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
