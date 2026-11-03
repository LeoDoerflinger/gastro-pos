import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function StockPurchases() {
  const { suppliers, ingredients, purchases, currentUser, showToast, refreshData } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [voucherType, setVoucherType] = useState('Factura A');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');

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
    setPurchaseItems(prev =>
      prev.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          if (field === 'ingredientId') {
            const ing = ingredients.find(x => x.id === value);
            if (ing) updated.unitCost = ing.costPerUnit || 0;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const calculatedTotal = purchaseItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
    0
  );

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    if (!voucherNumber.trim()) {
      showToast('Ingresá el número de factura o remito', 'error');
      return;
    }
    if (purchaseItems.length === 0) {
      showToast('Sumá al menos un insumo al comprobante', 'error');
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
      showToast('Comprobante registrado y stock actualizado');
      setIsFormOpen(false);
      setVoucherNumber('');
      setNotes('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo guardar el comprobante', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5" aria-label="Ingreso de mercadería y facturas de proveedores">
      {/* Open Header */}
      <div className="pb-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            Facturas y remitos de proveedores
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Cargá la mercadería recibida para sumar stock y actualizar el costo por unidad al instante.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={isFormOpen ? 'pos-btn-secondary self-start sm:self-auto' : 'pos-btn-primary self-start sm:self-auto'}
        >
          <i className={`fa-solid ${isFormOpen ? 'fa-xmark' : 'fa-plus'} text-xs`} aria-hidden="true"></i>
          <span>{isFormOpen ? 'Cerrar formulario' : 'Cargar comprobante'}</span>
        </button>
      </div>

      {/* New Purchase Voucher Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmitPurchase} className="pos-panel p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Nuevo ingreso de mercadería
            </h3>
            <span className="text-xs text-[var(--text-secondary)]">
              Usuario: <strong className="text-[var(--text-primary)]">{currentUser.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label htmlFor="voucher-type-select" className="pos-label">Tipo de comprobante:</label>
              <select
                id="voucher-type-select"
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value)}
                className="pos-input"
              >
                <option value="Factura A">Factura A</option>
                <option value="Factura B">Factura B</option>
                <option value="Factura C">Factura C</option>
                <option value="Remito Oficial">Remito Oficial</option>
              </select>
            </div>

            <div>
              <label htmlFor="voucher-number-input" className="pos-label">Número:</label>
              <input
                id="voucher-number-input"
                type="text"
                placeholder="Ej. 0003-00045812"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                className="pos-input font-mono"
                required
              />
            </div>

            <div>
              <label htmlFor="voucher-supplier-select" className="pos-label">Proveedor:</label>
              <select
                id="voucher-supplier-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="pos-input"
              >
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="voucher-date-input" className="pos-label">Fecha de emisión:</label>
              <input
                id="voucher-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pos-input font-mono"
              />
            </div>
          </div>

          {/* Items Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--text-primary)]">
                Insumos recibidos ({purchaseItems.length})
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="pos-btn-secondary text-xs"
              >
                <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
                <span>Sumar renglón</span>
              </button>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded overflow-hidden">
              {purchaseItems.map((item, idx) => {
                const currentIng = ingredients.find(i => i.id === item.ingredientId);
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

                return (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--bg-subtle)] flex flex-col md:flex-row md:items-center gap-3"
                  >
                    <div className="flex-1">
                      <label htmlFor={`pur-ing-${idx}`} className="pos-label">Insumo recibido:</label>
                      <select
                        id={`pur-ing-${idx}`}
                        value={item.ingredientId}
                        onChange={(e) => handleItemChange(idx, 'ingredientId', e.target.value)}
                        className="pos-input bg-[var(--bg-surface)]"
                      >
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Stock actual: {ing.stock} {ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full md:w-36">
                      <label htmlFor={`pur-qty-${idx}`} className="pos-label">Cantidad ({currentIng?.unit || 'u'}):</label>
                      <input
                        id={`pur-qty-${idx}`}
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="pos-input bg-[var(--bg-surface)] font-mono text-center"
                      />
                    </div>

                    <div className="w-full md:w-40">
                      <label htmlFor={`pur-cost-${idx}`} className="pos-label">Costo unitario ($):</label>
                      <input
                        id={`pur-cost-${idx}`}
                        type="number"
                        placeholder="0"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                        className="pos-input bg-[var(--bg-surface)] font-mono text-right"
                      />
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 md:w-36">
                      <span className="md:hidden text-xs text-[var(--text-muted)]">Subtotal:</span>
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                        ${lineTotal.toLocaleString('es-AR')}
                      </span>
                      {purchaseItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="pos-btn-ghost text-[var(--text-muted)] hover:text-[var(--status-danger-fg)]"
                          aria-label="Quitar renglón"
                        >
                          <i className="fa-solid fa-trash-can text-sm" aria-hidden="true"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="pos-label">Condición de pago:</span>
              <div className="pos-segment-group" role="group" aria-label="Condición de pago">
                {[
                  { id: 'efectivo', label: 'Efectivo' },
                  { id: 'transferencia', label: 'Transferencia' },
                  { id: 'cuenta_corriente', label: 'Cta. corriente' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={paymentMethod === m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className="pos-segment-btn"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-4">
              <div className="text-left md:text-right">
                <span className="text-xs text-[var(--text-secondary)] block">Total comprobante</span>
                <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
                  ${calculatedTotal.toLocaleString('es-AR')}
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="pos-btn-primary"
              >
                <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
                <span>{submitting ? 'Guardando...' : 'Registrar ingreso'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Past Purchases Ledger */}
      <div className="pos-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
          <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
            Comprobantes registrados ({purchases.length})
          </h3>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {purchases.length === 0 ? (
            <div className="p-10 text-center space-y-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Todavía no hay facturas cargadas</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Usá el botón "Cargar comprobante" cuando recibas mercadería de un proveedor.
              </p>
            </div>
          ) : (
            purchases.map(pur => (
              <div key={pur.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="pos-badge pos-badge-neutral font-mono">
                      {pur.voucherType} {pur.voucherNumber}
                    </span>
                    <span className="font-bold text-sm text-[var(--text-primary)]">{pur.supplierName}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1.5">
                      <i className="fa-regular fa-calendar text-[var(--text-muted)]" aria-hidden="true"></i>
                      <span>{pur.date}</span>
                    </span>
                    <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                      ${pur.totalAmount?.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(pur.items || []).map((it, idx) => (
                    <span key={idx} className="pos-badge pos-badge-open font-mono">
                      +{it.quantity} {it.unit} {it.ingredientName} (${it.unitCost?.toLocaleString('es-AR')}/{it.unit})
                    </span>
                  ))}
                </div>

                <div className="text-xs text-[var(--text-muted)] flex justify-between">
                  <span>Cargó: {pur.registeredBy}</span>
                  <span className="capitalize">Pago: {pur.paymentMethod?.replace('_', ' ')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
