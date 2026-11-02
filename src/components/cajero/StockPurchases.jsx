import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function StockPurchases() {
  const { suppliers, ingredients, purchases, currentUser, showToast, refreshData } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [voucherType, setVoucherType] = useState('Factura A');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');

  // Invoice items
  const [purchaseItems, setPurchaseItems] = useState([
    { ingredientId: ingredients[0]?.id || '', quantity: 10, unitCost: ingredients[0]?.costPerUnit || 1000 }
  ]);

  const handleAddItemRow = () => {
    setPurchaseItems(prev => [
      ...prev,
      { ingredientId: ingredients[0]?.id || '', quantity: 5, unitCost: ingredients[0]?.costPerUnit || 1000 }
    ]);
  };

  const handleRemoveRow = (index) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setPurchaseItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        if (field === 'ingredientId') {
          const ing = ingredients.find(ing => ing.id === value);
          if (ing) updated.unitCost = ing.costPerUnit || 0;
        }
        return updated;
      }
      return item;
    }));
  };

  const calculatedTotal = purchaseItems.reduce((sum, item) => {
    return sum + (Number(item.quantity || 0) * Number(item.unitCost || 0));
  }, 0);

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    if (!voucherNumber.trim()) {
      showToast('Ingresa el número de comprobante', 'error');
      return;
    }
    if (purchaseItems.length === 0) {
      showToast('Debes ingresar al menos un insumo para el stock', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedSup = suppliers.find(s => s.id === supplierId);
      const formattedItems = purchaseItems.map(item => {
        const ing = ingredients.find(i => i.id === item.ingredientId);
        return {
          ingredientId: item.ingredientId,
          ingredientName: ing ? ing.name : 'Insumo',
          quantity: Number(item.quantity),
          unit: ing ? ing.unit : 'kg',
          unitCost: Number(item.unitCost),
          total: Number(item.quantity) * Number(item.unitCost)
        };
      });

      const payload = {
        voucherType,
        voucherNumber,
        supplierId,
        supplierName: selectedSup ? selectedSup.name : 'Proveedor',
        date,
        items: formattedItems,
        totalAmount: calculatedTotal,
        paymentMethod,
        paymentStatus: 'pagado',
        notes
      };

      await api.createPurchase(payload, currentUser);
      showToast('Comprobante cargado e inventario actualizado');
      setIsFormOpen(false);
      setVoucherNumber('');
      setNotes('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error cargando factura de proveedor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header and Toggle */}
      <div className="bg-[#121215] p-3 rounded border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <i className="fa-solid fa-boxes-stacked text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Ingreso de Stock · Facturas y Remitos</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-1 font-mono">
            Carga de mercadería de materias primas e insumos recibidos. Actualiza el inventario y costos automáticamente.
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="px-3 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <i className={`fa-solid ${isFormOpen ? 'fa-xmark' : 'fa-plus'} text-xs`} aria-hidden="true"></i>
          <span>{isFormOpen ? 'Cancelar Carga' : 'Cargar Comprobante'}</span>
        </button>
      </div>

      {/* New Purchase Invoice Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmitPurchase} className="bg-[#121215] border border-[#27272a] p-3.5 rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <i className="fa-solid fa-file-invoice text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Nuevo Comprobante de Compra</span>
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Registrado por: <strong className="text-zinc-200">{currentUser.name}</strong></span>
          </div>

          {/* Voucher Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Tipo Comprobante:</label>
              <select
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="Factura A">Factura A</option>
                <option value="Factura B">Factura B</option>
                <option value="Factura C">Factura C</option>
                <option value="Remito Oficial">Remito Oficial</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Número:</label>
              <input
                type="text"
                placeholder="Ej: 0003-00045812"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-500 tabular-nums"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Proveedor:</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Fecha Emisión:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
          </div>

          {/* Items Table Builder */}
          <div className="bg-[#09090b] p-3 rounded-sm border border-[#27272a] space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#27272a]">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                Insumos Recibidos (Ingreso directo a Stock):
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-zinc-300 hover:text-white font-mono uppercase tracking-wider flex items-center gap-1"
              >
                <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
                <span>Agregar Insumo</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {purchaseItems.map((item, idx) => {
                const currentIng = ingredients.find(i => i.id === item.ingredientId);
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

                return (
                  <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#18181c] p-2 rounded-sm border border-[#27272a]">
                    {/* Insumo Selector */}
                    <div className="flex-1">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => handleItemChange(idx, 'ingredientId', e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                      >
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Stock: {ing.stock} {ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="w-full sm:w-28 flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Cant."
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs font-mono text-zinc-200 text-center tabular-nums"
                      />
                      <span className="text-xs text-zinc-400 font-mono font-bold shrink-0">{currentIng?.unit || 'u'}</span>
                    </div>

                    {/* Unit Cost */}
                    <div className="w-full sm:w-36 relative">
                      <span className="absolute left-2 top-1.5 text-xs text-zinc-500 font-mono">$</span>
                      <input
                        type="number"
                        placeholder="Costo u."
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-sm pl-6 pr-2 py-1.5 text-xs font-mono text-zinc-200 text-right tabular-nums"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="w-full sm:w-32 text-right font-mono font-bold text-xs text-zinc-200 self-center tabular-nums">
                      ${lineTotal.toLocaleString('es-AR')}
                    </div>

                    {/* Delete row */}
                    {purchaseItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 self-center transition-colors"
                        aria-label="Eliminar fila"
                      >
                        <i className="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total and Submit */}
            <div className="pt-2.5 border-t border-[#27272a] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Forma de Pago:</label>
                <div className="inline-flex border border-[#27272a] divide-x divide-[#27272a] rounded-sm overflow-hidden">
                  {['efectivo', 'transferencia', 'cuenta_corriente'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider transition-colors ${
                        paymentMethod === m
                          ? 'bg-zinc-800 text-zinc-100 font-bold'
                          : 'bg-[#121215] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-zinc-400 block">Total Comprobante:</span>
                  <span className="text-base font-bold font-mono text-zinc-100 tabular-nums">
                    ${calculatedTotal.toLocaleString('es-AR')}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
                  <span>{submitting ? 'Guardando...' : 'Confirmar e Ingresar'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Past Purchases History List */}
      <div className="bg-[#121215] rounded border border-[#27272a] overflow-hidden">
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Historial de Comprobantes ({purchases.length})</span>
          </h3>
        </div>

        <div className="divide-y divide-[#27272a]">
          {purchases.length === 0 ? (
            <p className="p-6 text-center text-zinc-500 font-mono text-xs">No hay comprobantes de compra registrados</p>
          ) : (
            purchases.map(pur => (
              <div key={pur.id} className="p-3 hover:bg-[#18181c] transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-[#18181c] text-zinc-300 px-2 py-0.5 rounded-sm border border-[#27272a] tabular-nums">
                      {pur.voucherType} {pur.voucherNumber}
                    </span>
                    <span className="font-bold text-xs text-zinc-200">{pur.supplierName}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-400 font-mono flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-days text-zinc-500 text-xs" aria-hidden="true"></i>
                      <span>{pur.date}</span>
                    </span>
                    <span className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                      ${pur.totalAmount?.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                {/* Items in this voucher */}
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono tabular-nums">
                  {(pur.items || []).map((it, idx) => (
                    <span key={idx} className="bg-[#09090b] text-zinc-300 px-2 py-0.5 rounded-xs border border-[#27272a]">
                      +{it.quantity} {it.unit} {it.ingredientName} (${it.unitCost?.toLocaleString('es-AR')}/{it.unit})
                    </span>
                  ))}
                </div>

                <div className="text-[10px] text-zinc-500 font-mono flex justify-between">
                  <span>Cargado por: {pur.registeredBy}</span>
                  <span className="uppercase tracking-wider">Pago: {pur.paymentMethod}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
