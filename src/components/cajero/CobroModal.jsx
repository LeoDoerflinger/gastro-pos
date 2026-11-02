import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import ReceiptModal from '../common/ReceiptModal';
import { getTableCode } from '../mozo/MozoSalonView';

export default function CobroModal({ isOpen, onClose, order, onOrderClosed }) {
  const { currentUser, tables, showToast, refreshData } = useApp();

  const [paymentMethod, setPaymentMethod] = useState('efectivo'); // 'efectivo', 'debito', 'credito', 'mercadopago', 'transferencia', 'mixto'
  const [cashTendered, setCashTendered] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [tipAmount, setTipAmount] = useState(order?.tip || 0);
  const [splitCash, setSplitCash] = useState('');
  const [splitDigital, setSplitDigital] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closedOrderReceipt, setClosedOrderReceipt] = useState(null);

  if (!isOpen || !order) return null;

  const table = tables.find(t => t.id === order.tableId);
  const tableCode = table ? getTableCode(table) : (order.tableNumber ? `M${order.tableNumber}` : null);

  const subtotal = order.subtotal || 0;
  const deliveryFee = order.deliveryFee || 0;
  const totalToPay = Math.max(0, subtotal + deliveryFee - Number(discountAmount || 0) + Number(tipAmount || 0));

  // Change calculator for cash
  const tenderedNum = Number(cashTendered) || 0;
  const changeDue = tenderedNum >= totalToPay ? tenderedNum - totalToPay : 0;

  // Preset bill shortcuts
  const presetBills = [
    totalToPay,
    Math.ceil(totalToPay / 1000) * 1000,
    Math.ceil(totalToPay / 5000) * 5000,
    Math.ceil(totalToPay / 10000) * 10000,
    Math.ceil(totalToPay / 20000) * 20000
  ].filter((v, i, a) => v >= totalToPay && a.indexOf(v) === i).slice(0, 4);

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'efectivo' && tenderedNum < totalToPay) {
      showToast('El monto abonado en efectivo es menor al total a pagar', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        paymentMethod: paymentMethod,
        discount: Number(discountAmount || 0),
        tip: Number(tipAmount || 0),
        paymentDetails: {
          cashTendered: paymentMethod === 'efectivo' ? tenderedNum : null,
          changeDue: paymentMethod === 'efectivo' ? changeDue : 0,
          splitDetails: paymentMethod === 'mixto' ? { cash: Number(splitCash), digital: Number(splitDigital) } : null
        },
        closedBy: currentUser
      };

      const closed = await api.closeOrder(order.id, payload);
      showToast(`Comanda #${order.orderNumber} cobrada con éxito.`);
      await refreshData();
      onOrderClosed?.();
      setClosedOrderReceipt(closed);
    } catch (err) {
      showToast(err.message || 'Error al procesar el cobro', 'error');
      setSubmitting(false);
    }
  };

  const paymentOptions = [
    { id: 'efectivo', label: 'Efectivo', icon: 'fa-money-bill-wave' },
    { id: 'debito', label: 'Débito', icon: 'fa-credit-card' },
    { id: 'credito', label: 'Crédito', icon: 'fa-credit-card' },
    { id: 'mercadopago', label: 'QR / MP', icon: 'fa-qrcode' },
    { id: 'transferencia', label: 'Transfer.', icon: 'fa-building-columns' },
    { id: 'mixto', label: 'Mixto', icon: 'fa-scale-balanced' }
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 animate-in fade-in duration-150">
        <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-3 bg-[#0e0e11] border-b border-[#27272a] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 flex items-center justify-center font-bold text-xs">
                <i className="fa-solid fa-cash-register" aria-hidden="true"></i>
              </span>
              <div>
                <h3 className="font-bold text-zinc-100 text-xs flex items-center gap-2 font-mono">
                  <span>Cobrar Comanda #{order.orderNumber}</span>
                  {tableCode && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-200 px-1.5 py-0.2 rounded border border-zinc-700 font-bold">
                      {tableCode}
                    </span>
                  )}
                  <span className="text-[10px] uppercase bg-zinc-900 text-zinc-400 px-1 py-0.2 rounded border border-[#27272a]">
                    {order.channel}
                  </span>
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Atiende: {order.waiterName || 'Personal'} : {order.items?.length || 0} ítems
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Cerrar modal de cobro"
              className="w-6 h-6 rounded text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Items Mini Summary (Clean tabular table without rounded box-in-box) */}
            <div className="border border-[#27272a] rounded overflow-hidden max-h-32 overflow-y-auto bg-[#0e0e11] text-xs font-mono">
              <div className="flex justify-between font-bold text-zinc-500 text-[10px] uppercase px-2.5 py-1 bg-[#141418] border-b border-[#27272a]">
                <span>Cant : Detalle</span>
                <span>Subtotal</span>
              </div>
              <div className="divide-y divide-[#1e1e24] px-2.5">
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1 text-zinc-300">
                    <span className="font-sans">
                      <strong className="text-zinc-100 font-mono tabular-nums">{it.quantity}x</strong> {it.productName}
                      {it.notes && <span className="text-[10px] text-zinc-500 italic block">↳ {it.notes}</span>}
                    </span>
                    <span className="text-zinc-400 font-mono tabular-nums">${it.subtotal?.toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="bg-[#15151a] p-3 rounded border border-[#27272a] space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal platos:</span>
                <span className="font-mono tabular-nums text-zinc-200 font-bold">${subtotal.toLocaleString('es-AR')}</span>
              </div>

              {deliveryFee > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Costo de envío:</span>
                  <span className="font-mono tabular-nums text-zinc-200">${deliveryFee.toLocaleString('es-AR')}</span>
                </div>
              )}

              {/* Discount and Tip modifiers */}
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#27272a]">
                <div>
                  <label className="text-[10px] text-zinc-400 font-bold block mb-1 uppercase font-mono">Descuento ($):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                    className="w-full bg-[#101014] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono tabular-nums focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 font-bold block mb-1 uppercase font-mono">Propina ($):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={tipAmount || ''}
                    onChange={(e) => setTipAmount(Number(e.target.value) || 0)}
                    className="w-full bg-[#101014] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono tabular-nums focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Display */}
              <div className="pt-2 border-t border-[#27272a] flex justify-between items-center">
                <span className="font-bold text-xs uppercase text-zinc-400 font-mono">TOTAL A COBRAR:</span>
                <span className="font-black text-lg font-mono tabular-nums text-zinc-100">
                  ${totalToPay.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5 font-mono">
                Forma de Pago:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {paymentOptions.map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.id);
                      if (method.id === 'efectivo' && !cashTendered) setCashTendered(totalToPay);
                    }}
                    className={`p-2 rounded border text-center transition-colors ${
                      paymentMethod === method.id
                        ? 'bg-zinc-200 text-zinc-950 font-bold border-white'
                        : 'bg-[#15151a] text-zinc-400 border-[#27272a] hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <i className={`fa-solid ${method.icon} text-sm mb-1 block`} aria-hidden="true"></i>
                    <div className="text-[10px] truncate">{method.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cash specific details */}
            {paymentMethod === 'efectivo' && (
              <div className="bg-[#101014] p-2.5 rounded border border-[#27272a] space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1 font-mono">Monto recibido:</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-zinc-400 font-mono font-bold">$</span>
                      <input
                        type="number"
                        placeholder={totalToPay.toString()}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-full bg-[#16161b] border border-zinc-700 rounded pl-6 pr-2.5 py-1 text-xs font-mono tabular-nums font-bold text-zinc-100 focus:outline-none focus:border-zinc-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Vuelto / Change Box */}
                  <div className="p-2 rounded border border-zinc-700 flex-1 text-center bg-zinc-900">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                      {tenderedNum >= totalToPay ? 'Vuelto a Entregar:' : 'Faltan:'}
                    </div>
                    <div className="text-base font-black font-mono tabular-nums mt-0.5 text-zinc-100">
                      ${Math.abs(changeDue).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>

                {/* Preset Fast Bill Buttons */}
                <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-[#1e1e24]">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">Billetes:</span>
                  {presetBills.map(bill => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setCashTendered(bill)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono tabular-nums font-semibold border border-zinc-700 transition-colors"
                    >
                      ${bill.toLocaleString('es-AR')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashTendered(totalToPay)}
                    className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-100 text-xs font-bold border border-zinc-600 hover:bg-zinc-600 transition-colors font-mono"
                  >
                    Exacto
                  </button>
                </div>
              </div>
            )}

            {paymentMethod === 'mercadopago' && (
              <div className="bg-[#101014] p-3 rounded border border-[#27272a] flex items-center justify-center gap-3">
                <div className="w-16 h-16 bg-white p-1 rounded flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-qrcode text-3xl text-zinc-950" aria-hidden="true"></i>
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  <div className="font-bold text-zinc-200">QR Interoperable Activo</div>
                  <p className="text-zinc-400">Total: <strong className="text-zinc-100 tabular-nums">${totalToPay.toLocaleString('es-AR')}</strong></p>
                  <p className="text-[10px] text-zinc-500">Escaneable desde cualquier billetera bancaria o fintech.</p>
                </div>
              </div>
            )}

            {paymentMethod === 'mixto' && (
              <div className="bg-[#101014] p-2.5 rounded border border-[#27272a] space-y-2">
                <p className="text-xs font-semibold text-zinc-300 font-mono">Dividir pago (Efectivo + Digital):</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono">Efectivo ($):</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={splitCash}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setSplitCash(val);
                        setSplitDigital(Math.max(0, totalToPay - val));
                      }}
                      className="w-full bg-[#16161b] border border-zinc-700 rounded p-1 text-xs font-mono tabular-nums text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono">Tarjeta / QR ($):</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={splitDigital}
                      onChange={(e) => setSplitDigital(Number(e.target.value) || 0)}
                      className="w-full bg-[#16161b] border border-zinc-700 rounded p-1 text-xs font-mono tabular-nums text-zinc-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-2.5 bg-[#0e0e11] border-t border-[#27272a] flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={submitting || (paymentMethod === 'efectivo' && tenderedNum < totalToPay)}
              onClick={handleConfirmPayment}
              className="flex-1 py-1.5 px-4 rounded bg-zinc-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition-colors font-mono"
            >
              <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
              <span>{submitting ? 'Cerrando...' : `Confirmar Cobro ($${totalToPay.toLocaleString('es-AR')})`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Closed Fiscal Receipt */}
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