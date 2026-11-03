import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function StockPurchases() {
  const { suppliers, ingredients, purchases, currentUser, showToast, refreshData } = useApp();

  const [activeSubtab, setActiveSubtab] = useState('vouchers'); // 'vouchers' | 'suppliers'
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [selectedPurchaseForDetail, setSelectedPurchaseForDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('todos');

  // Form states for new purchase
  const [voucherType, setVoucherType] = useState('Factura A');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([
    { ingredientId: ingredients[0]?.id || '', quantity: 10, unitCost: ingredients[0]?.costPerUnit || 1000 }
  ]);

  // Form states for new supplier
  const [newSupName, setNewSupName] = useState('');
  const [newSupCuit, setNewSupCuit] = useState('');
  const [newSupCategory, setNewSupCategory] = useState('Lácteos');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsNewSupplierModalOpen(false);
        setSelectedPurchaseForDetail(null);
      }
    };
    if (isNewSupplierModalOpen || selectedPurchaseForDetail) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isNewSupplierModalOpen, selectedPurchaseForDetail]);

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

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupName.trim()) {
      showToast('Ingresá el nombre o razón social del proveedor', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createSupplier({
        name: newSupName.trim(),
        cuit: newSupCuit.trim(),
        category: newSupCategory,
        phone: newSupPhone.trim(),
        email: newSupEmail.trim()
      });
      await refreshData();
      showToast(`Proveedor ${created.name} registrado`);
      setSupplierId(created.id);
      setIsNewSupplierModalOpen(false);
      setNewSupName('');
      setNewSupCuit('');
      setNewSupPhone('');
      setNewSupEmail('');
    } catch (err) {
      showToast(err.message || 'No se pudo registrar el proveedor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPurchases = purchases.filter(pur => {
    const matchesSearch =
      !searchQuery.trim() ||
      pur.voucherNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pur.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pur.items || []).some(it => it.ingredientName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSupplier = filterSupplier === 'todos' || pur.supplierId === filterSupplier;
    return matchesSearch && matchesSupplier;
  });

  return (
    <section className="space-y-5" aria-label="Ingreso de mercadería y facturas de proveedores">
      {/* Header with Subtabs & Actions */}
      <div className="pb-4 border-b border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            Facturas y proveedores
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Cargá remitos y facturas para incorporar stock y consultar el historial discriminado de compras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <div className="pos-segment-group" role="group" aria-label="Subsecciones de proveedores">
            <button
              type="button"
              aria-pressed={activeSubtab === 'vouchers'}
              onClick={() => setActiveSubtab('vouchers')}
              className="pos-segment-btn"
            >
              <i className="fa-solid fa-file-invoice text-xs" aria-hidden="true"></i>
              <span>Comprobantes ({purchases.length})</span>
            </button>
            <button
              type="button"
              aria-pressed={activeSubtab === 'suppliers'}
              onClick={() => setActiveSubtab('suppliers')}
              className="pos-segment-btn"
            >
              <i className="fa-solid fa-truck-field text-xs" aria-hidden="true"></i>
              <span>Proveedores ({suppliers.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsNewSupplierModalOpen(true)}
            className="pos-btn-secondary"
            title="Dar de alta un nuevo proveedor"
          >
            <i className="fa-solid fa-user-plus text-xs" aria-hidden="true"></i>
            <span>Nuevo proveedor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFormOpen(!isFormOpen);
              if (!isFormOpen) setActiveSubtab('vouchers');
            }}
            className={isFormOpen ? 'pos-btn-secondary' : 'pos-btn-primary'}
          >
            <i className={`fa-solid ${isFormOpen ? 'fa-xmark' : 'fa-plus'} text-xs`} aria-hidden="true"></i>
            <span>{isFormOpen ? 'Cerrar formulario' : 'Cargar comprobante'}</span>
          </button>
        </div>
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
              <div className="flex items-center justify-between">
                <label htmlFor="voucher-supplier-select" className="pos-label">Proveedor:</label>
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(true)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold underline"
                >
                  + Nuevo
                </button>
              </div>
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

      {/* Subtab 1: Vouchers Ledger */}
      {activeSubtab === 'vouchers' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="pos-panel p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <label htmlFor="purchase-search" className="text-xs font-semibold text-[var(--text-secondary)] shrink-0 inline-flex items-center gap-1.5">
                <i className="fa-solid fa-magnifying-glass text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
                <span>Buscar:</span>
              </label>
              <input
                id="purchase-search"
                type="search"
                placeholder="Nro comprobante, proveedor o insumo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pos-input flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-sup" className="text-xs text-[var(--text-secondary)] shrink-0">Proveedor:</label>
              <select
                id="filter-sup"
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="pos-input py-1.5 text-xs w-48"
              >
                <option value="todos">Todos los proveedores</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vouchers List */}
          <div className="pos-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Comprobantes registrados ({filteredPurchases.length})
              </h3>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {filteredPurchases.length === 0 ? (
                <div className="p-10 text-center space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">No hay comprobantes que coincidan con la búsqueda</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Podés cargar una nueva factura o remito con el botón superior.
                  </p>
                </div>
              ) : (
                filteredPurchases.map(pur => (
                  <div key={pur.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="pos-badge pos-badge-neutral font-mono font-bold">
                          {pur.voucherType} {pur.voucherNumber}
                        </span>
                        <span className="font-bold text-sm text-[var(--text-primary)]">{pur.supplierName}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1.5">
                          <i className="fa-regular fa-calendar text-[var(--text-muted)]" aria-hidden="true"></i>
                          <span>{pur.date}</span>
                        </span>
                        <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                          ${pur.totalAmount?.toLocaleString('es-AR')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPurchaseForDetail(pur)}
                          className="pos-btn-secondary text-xs px-2.5"
                          title="Visualizar detalle discriminado"
                        >
                          <i className="fa-solid fa-eye text-xs" aria-hidden="true"></i>
                          <span>Ver detalle</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(pur.items || []).map((it, idx) => (
                        <span key={idx} className="pos-badge pos-badge-neutral font-mono text-[11px]">
                          +{it.quantity} {it.unit} {it.ingredientName} (${it.unitCost?.toLocaleString('es-AR')}/{it.unit})
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-[var(--text-muted)] flex justify-between pt-1 border-t border-[var(--border-subtle)]">
                      <span>Registró: <strong>{pur.registeredBy}</strong></span>
                      <span className="capitalize">Medio de pago: {pur.paymentMethod?.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Suppliers Directory */}
      {activeSubtab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(sup => {
            const supplierVouchers = purchases.filter(p => p.supplierId === sup.id);
            const totalBought = supplierVouchers.reduce((acc, p) => acc + (p.totalAmount || 0), 0);

            return (
              <div key={sup.id} className="pos-panel p-4 space-y-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                    <div>
                      <h4 className="font-display font-bold text-base text-[var(--text-primary)]">
                        {sup.name}
                      </h4>
                      <span className="pos-badge pos-badge-neutral text-xs mt-1">
                        {sup.category || 'Almacén'}
                      </span>
                    </div>
                    <span className="w-8 h-8 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center text-xs shrink-0">
                      <i className="fa-solid fa-truck" aria-hidden="true"></i>
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-[var(--text-secondary)]">
                    {sup.cuit && (
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-muted)] font-mono">CUIT:</span>
                        <strong className="font-mono text-[var(--text-primary)]">{sup.cuit}</strong>
                      </div>
                    )}
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-phone text-[var(--text-muted)] w-3.5" aria-hidden="true"></i>
                        <span>{sup.phone}</span>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-envelope text-[var(--text-muted)] w-3.5" aria-hidden="true"></i>
                        <span className="truncate">{sup.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block font-mono">Total compras:</span>
                    <strong className="font-mono text-[var(--text-primary)]">
                      ${totalBought.toLocaleString('es-AR')} ({supplierVouchers.length} facturas)
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSupplierId(sup.id);
                      setIsFormOpen(true);
                      setActiveSubtab('vouchers');
                    }}
                    className="pos-btn-secondary text-xs px-2.5"
                    title="Cargar factura para este proveedor"
                  >
                    <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
                    <span>Cargar remito</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Alta de Nuevo Proveedor */}
      {isNewSupplierModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-sup-modal-title"
        >
          <div className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-truck text-[var(--text-muted)]" aria-hidden="true"></i>
                <h3 id="new-sup-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                  Nuevo proveedor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="pos-btn-ghost -mr-1"
                aria-label="Cerrar modal de proveedor"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3.5">
              <div>
                <label htmlFor="sup-name" className="pos-label">Nombre o Razón Social:</label>
                <input
                  id="sup-name"
                  type="text"
                  placeholder="Ej. Distribuidora El Puente"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="pos-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-cuit" className="pos-label">CUIT (opcional):</label>
                  <input
                    id="sup-cuit"
                    type="text"
                    placeholder="30-71234567-8"
                    value={newSupCuit}
                    onChange={(e) => setNewSupCuit(e.target.value)}
                    className="pos-input font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="sup-cat" className="pos-label">Rubro principal:</label>
                  <select
                    id="sup-cat"
                    value={newSupCategory}
                    onChange={(e) => setNewSupCategory(e.target.value)}
                    className="pos-input"
                  >
                    <option value="Lácteos">Lácteos</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Carnes">Carnes</option>
                    <option value="Verduras">Verduras</option>
                    <option value="Panadería">Panadería</option>
                    <option value="Almacén">Almacén</option>
                    <option value="Descartables">Descartables</option>
                    <option value="Varios">Varios</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-phone" className="pos-label">Teléfono de contacto:</label>
                  <input
                    id="sup-phone"
                    type="text"
                    placeholder="+54 9 11 4455-8899"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    className="pos-input"
                  />
                </div>

                <div>
                  <label htmlFor="sup-email" className="pos-label">Correo electrónico:</label>
                  <input
                    id="sup-email"
                    type="email"
                    placeholder="ventas@proveedor.com"
                    value={newSupEmail}
                    onChange={(e) => setNewSupEmail(e.target.value)}
                    className="pos-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="pos-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="pos-btn-primary"
                >
                  <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
                  <span>{submitting ? 'Guardando...' : 'Crear proveedor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalle Discriminado de Factura / Remito */}
      {selectedPurchaseForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-purchase-title"
        >
          <div className="pos-panel w-full max-w-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-file-invoice text-[var(--text-muted)]" aria-hidden="true"></i>
                <div>
                  <h3 id="detail-purchase-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                    Detalle de comprobante
                  </h3>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">
                    {selectedPurchaseForDetail.voucherType} #{selectedPurchaseForDetail.voucherNumber}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPurchaseForDetail(null)}
                className="pos-btn-ghost -mr-1"
                aria-label="Cerrar detalle"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            {/* Voucher Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs">
              <div>
                <span className="text-[var(--text-muted)] block">Proveedor:</span>
                <strong className="text-[var(--text-primary)] block truncate">
                  {selectedPurchaseForDetail.supplierName}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Fecha de emisión:</span>
                <strong className="text-[var(--text-primary)] block font-mono">
                  {selectedPurchaseForDetail.date}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Registrado por:</span>
                <strong className="text-[var(--text-primary)] block">
                  {selectedPurchaseForDetail.registeredBy || 'Personal'}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Medio de pago:</span>
                <strong className="text-[var(--text-primary)] block capitalize">
                  {selectedPurchaseForDetail.paymentMethod?.replace('_', ' ') || 'Efectivo'}
                </strong>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-[var(--border-subtle)] rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold">
                    <th className="py-2.5 px-3">Insumo recibido</th>
                    <th className="py-2.5 px-3 text-center">Cantidad</th>
                    <th className="py-2.5 px-3 text-right">Costo unitario</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {(selectedPurchaseForDetail.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-hover)]">
                      <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                        {it.ingredientName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)]">
                        ${(it.unitCost || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text-primary)]">
                        ${(it.total || it.quantity * it.unitCost).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes if any */}
            {selectedPurchaseForDetail.notes && (
              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs">
                <span className="text-[var(--text-muted)] block font-semibold mb-0.5">Observaciones:</span>
                <p className="text-[var(--text-primary)]">{selectedPurchaseForDetail.notes}</p>
              </div>
            )}

            {/* Footer Summary */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-xs text-[var(--text-muted)] block">Total comprobante</span>
                <span className="font-mono font-extrabold text-xl text-[var(--text-primary)]">
                  ${(selectedPurchaseForDetail.totalAmount || 0).toLocaleString('es-AR')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="pos-btn-secondary text-xs"
                >
                  <i className="fa-solid fa-print text-xs" aria-hidden="true"></i>
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPurchaseForDetail(null)}
                  className="pos-btn-primary text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
