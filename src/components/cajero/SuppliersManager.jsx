import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function SuppliersManager() {
  const { suppliers, purchases, supplierPayments, showToast, refreshData, currentUser, setActiveTab } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('activos'); // 'activos' | 'todos' | 'inactivos'

  // Modals
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [isEditSupplierModalOpen, setIsEditSupplierModalOpen] = useState(false);
  const [selectedSupForEdit, setSelectedSupForEdit] = useState(null);
  const [selectedSupForPayment, setSelectedSupForPayment] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Supplier Form
  const [newSupName, setNewSupName] = useState('');
  const [newSupCuit, setNewSupCuit] = useState('');
  const [newSupCategory, setNewSupCategory] = useState('Lácteos');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');

  // Edit Supplier Form
  const [editSupName, setEditSupName] = useState('');
  const [editSupCuit, setEditSupCuit] = useState('');
  const [editSupCategory, setEditSupCategory] = useState('Lácteos');
  const [editSupPhone, setEditSupPhone] = useState('');
  const [editSupEmail, setEditSupEmail] = useState('');
  const [editSupAddress, setEditSupAddress] = useState('');
  const [editSupStatus, setEditSupStatus] = useState('activo');

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsNewSupplierModalOpen(false);
        setIsEditSupplierModalOpen(false);
        setIsPaymentModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const categories = ['todos', ...new Set((suppliers || []).map(s => s.category).filter(Boolean))];

  // Financial summary per supplier
  const getSupplierBalance = (supId) => {
    const supPurchases = (purchases || []).filter(p => p.supplierId === supId);
    const totalPurchased = supPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
    const pendingPurchases = supPurchases.filter(p => p.paymentMethod === 'cuenta_corriente' && p.paymentStatus !== 'pagado');
    const debt = pendingPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
    const payments = (supplierPayments || []).filter(sp => sp.supplierId === supId);
    const totalPaid = payments.reduce((acc, sp) => acc + (Number(sp.amount) || 0), 0);
    return {
      totalPurchased,
      debt,
      totalPaid,
      invoicesCount: supPurchases.length
    };
  };

  const filteredSuppliers = (suppliers || []).filter(s => {
    if (filterStatus === 'activos' && s.status === 'inactivo') return false;
    if (filterStatus === 'inactivos' && s.status !== 'inactivo') return false;
    if (filterCategory !== 'todos' && s.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.cuit?.includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalGlobalDebt = (suppliers || []).reduce((acc, s) => acc + getSupplierBalance(s.id).debt, 0);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupName.trim()) {
      showToast('Ingresá el nombre o razón social del proveedor', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.createSupplier({
        name: newSupName.trim(),
        cuit: newSupCuit.trim(),
        category: newSupCategory,
        phone: newSupPhone.trim(),
        email: newSupEmail.trim(),
        address: newSupAddress.trim(),
        status: 'activo'
      });
      showToast(`Proveedor "${newSupName}" registrado`);
      await refreshData();
      setIsNewSupplierModalOpen(false);
      setNewSupName('');
      setNewSupCuit('');
      setNewSupPhone('');
      setNewSupEmail('');
      setNewSupAddress('');
    } catch (err) {
      showToast(err.message || 'No se pudo crear el proveedor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditSupplier = (sup) => {
    setSelectedSupForEdit(sup);
    setEditSupName(sup.name || '');
    setEditSupCuit(sup.cuit || '');
    setEditSupCategory(sup.category || 'Lácteos');
    setEditSupPhone(sup.phone || '');
    setEditSupEmail(sup.email || '');
    setEditSupAddress(sup.address || '');
    setEditSupStatus(sup.status || 'activo');
    setIsEditSupplierModalOpen(true);
  };

  const handleSaveEditSupplier = async (e) => {
    e.preventDefault();
    if (!selectedSupForEdit || !editSupName.trim()) return;
    setSubmitting(true);
    try {
      await api.updateSupplier(selectedSupForEdit.id, {
        name: editSupName.trim(),
        cuit: editSupCuit.trim(),
        category: editSupCategory,
        phone: editSupPhone.trim(),
        email: editSupEmail.trim(),
        address: editSupAddress.trim(),
        status: editSupStatus
      });
      showToast(`Datos del proveedor "${editSupName}" actualizados`);
      await refreshData();
      setIsEditSupplierModalOpen(false);
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el proveedor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (sup) => {
    const isCurrentlyActive = sup.status !== 'inactivo';
    const actionLabel = isCurrentlyActive ? 'dar de baja' : 'reactivar';
    if (!window.confirm(`¿Seguro que querés ${actionLabel} al proveedor "${sup.name}"?`)) return;

    try {
      await api.updateSupplier(sup.id, {
        status: isCurrentlyActive ? 'inactivo' : 'activo'
      });
      showToast(`Proveedor "${sup.name}" ${isCurrentlyActive ? 'dado de baja' : 'reactivado'}`);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error al cambiar estado del proveedor', 'error');
    }
  };

  const handleOpenPayment = (sup) => {
    setSelectedSupForPayment(sup);
    const balance = getSupplierBalance(sup.id);
    setPaymentAmount(balance.debt > 0 ? String(balance.debt) : '');
    setPaymentMethod('transferencia');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!selectedSupForPayment) return;
    const amountNum = Number(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Ingresá un importe de pago válido', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.addSupplierPayment(selectedSupForPayment.id, {
        amount: amountNum,
        paymentMethod,
        notes: paymentNotes.trim() || 'Pago a cuenta de proveedor',
        user: currentUser
      });
      showToast(`Pago de $${amountNum.toLocaleString('es-AR')} asentado a "${selectedSupForPayment.name}"`);
      await refreshData();
      setIsPaymentModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Error al registrar pago', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Directorio y cuentas corrientes de proveedores">
      {/* Top Header & Actions */}
      <div className="pos-panel p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-extrabold text-lg text-[var(--text-primary)]">
              Directorio de Proveedores
            </h2>
            <span className="pos-badge pos-badge-brand text-xs font-mono">
              {filteredSuppliers.length} proveedores
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Gestión comercial, contactos, rubros y estado de saldos en cuenta corriente
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('stock_purchases')}
            className="pos-btn-secondary text-xs flex-1 sm:flex-initial"
            title="Ver facturas y remitos cargados"
          >
            <i className="fa-solid fa-file-invoice-dollar text-xs mr-1.5" aria-hidden="true"></i>
            <span>Ver Facturas y Pagos</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewSupplierModalOpen(true)}
            className="pos-btn-primary text-xs flex-1 sm:flex-initial"
          >
            <i className="fa-solid fa-user-plus text-xs mr-1.5" aria-hidden="true"></i>
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Global Financial Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="pos-panel p-3.5 border-l-4 border-l-[var(--accent-brand)]">
          <span className="text-xs text-[var(--text-secondary)] block">Total Proveedores Registrados</span>
          <span className="font-mono font-bold text-xl text-[var(--text-primary)]">
            {suppliers.length}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
            {(suppliers || []).filter(s => s.status !== 'inactivo').length} activos en Córdoba
          </span>
        </div>

        <div className="pos-panel p-3.5 border-l-4 border-l-rose-500">
          <span className="text-xs text-[var(--text-secondary)] block">Deuda Pendiente en Cta. Cte.</span>
          <span className="font-mono font-bold text-xl text-[var(--status-danger-fg)]">
            ${totalGlobalDebt.toLocaleString('es-AR')}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
            Saldo acumulado por compras fiadas
          </span>
        </div>

        <div className="pos-panel p-3.5 border-l-4 border-l-emerald-500">
          <span className="text-xs text-[var(--text-secondary)] block">Pagos Emitidos Acumulados</span>
          <span className="font-mono font-bold text-xl text-[var(--status-open-fg)]">
            ${(supplierPayments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toLocaleString('es-AR')}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
            {(supplierPayments || []).length} transferencias / recibos
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="pos-panel p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <i className="fa-solid fa-magnifying-glass text-xs text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true"></i>
            <input
              type="text"
              placeholder="Buscar por nombre, CUIT, rubro o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pos-input text-xs pl-8 w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="pos-input text-xs py-1.5"
            aria-label="Filtrar por rubro"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'todos' ? 'Todos los rubros' : c}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="pos-input text-xs py-1.5"
            aria-label="Filtrar por estado"
          >
            <option value="activos">Solo activos</option>
            <option value="todos">Todos los estados</option>
            <option value="inactivos">Solo inactivos / baja</option>
          </select>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full pos-panel p-10 text-center text-xs text-[var(--text-muted)]">
            No se encontraron proveedores con los filtros aplicados.
          </div>
        ) : (
          filteredSuppliers.map(sup => {
            const bal = getSupplierBalance(sup.id);
            const isInactive = sup.status === 'inactivo';

            return (
              <article
                key={sup.id}
                className={`pos-panel p-4 flex flex-col justify-between space-y-3 transition-colors ${
                  isInactive ? 'opacity-60 bg-[var(--bg-subtle)]' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="pos-badge pos-badge-brand text-[10px] mb-1">
                        {sup.category || 'General'}
                      </span>
                      <h3 className="font-display font-bold text-base text-[var(--text-primary)] leading-tight">
                        {sup.name}
                      </h3>
                      {sup.cuit && (
                        <span className="font-mono text-xs text-[var(--text-muted)] block">
                          CUIT: {sup.cuit}
                        </span>
                      )}
                    </div>

                    <span className={`pos-badge text-[10px] font-semibold ${
                      isInactive ? 'pos-badge-neutral text-rose-500' : 'pos-badge-open'
                    }`}>
                      {isInactive ? 'Inactivo' : 'Activo'}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="pt-2 mt-2 border-t border-[var(--border-subtle)] space-y-1 text-xs text-[var(--text-secondary)]">
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-phone text-xs text-[var(--accent-brand)] w-4 text-center" aria-hidden="true"></i>
                        <span className="font-mono">{sup.phone}</span>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-envelope text-xs text-[var(--accent-brand)] w-4 text-center" aria-hidden="true"></i>
                        <span className="truncate">{sup.email}</span>
                      </div>
                    )}
                    {sup.address && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-location-dot text-xs text-[var(--accent-brand)] w-4 text-center" aria-hidden="true"></i>
                        <span className="truncate">{sup.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Ledger Badge */}
                  <div className="mt-3 p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Comprado:</span>
                      <span className="font-mono font-semibold text-[var(--text-primary)]">
                        ${bal.totalPurchased.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Saldo deudor:</span>
                      <span className={`font-mono font-bold ${bal.debt > 0 ? 'text-[var(--status-danger-fg)]' : 'text-[var(--status-open-fg)]'}`}>
                        {bal.debt > 0 ? `$${bal.debt.toLocaleString('es-AR')}` : 'Al día ($0)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditSupplier(sup)}
                      className="pos-btn-secondary text-xs px-2.5 py-1"
                      title="Editar datos del proveedor"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs mr-1" aria-hidden="true"></i>
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(sup)}
                      className="pos-btn-ghost text-xs px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      title={isInactive ? 'Reactivar proveedor' : 'Dar de baja temporalmente'}
                    >
                      <i className={`fa-solid ${isInactive ? 'fa-rotate-left' : 'fa-ban'} text-xs`} aria-hidden="true"></i>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPayment(sup)}
                    className="pos-btn-primary text-xs px-3 py-1"
                    title="Registrar pago a este proveedor"
                  >
                    <i className="fa-solid fa-hand-holding-dollar text-xs mr-1" aria-hidden="true"></i>
                    <span>Pagar</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Modal Nuevo Proveedor */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Registrar Nuevo Proveedor
              </h3>
              <button type="button" onClick={() => setIsNewSupplierModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="pos-label">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Frigorífico Los Prados SRL"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="pos-input font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="pos-label">CUIT Comercial</label>
                  <input
                    type="text"
                    placeholder="Ej. 30-71458921-3"
                    value={newSupCuit}
                    onChange={(e) => setNewSupCuit(e.target.value)}
                    className="pos-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="pos-label">Rubro principal</label>
                  <select
                    value={newSupCategory}
                    onChange={(e) => setNewSupCategory(e.target.value)}
                    className="pos-input text-xs"
                  >
                    <option value="Carnicería">Carnicería</option>
                    <option value="Panadería">Panadería</option>
                    <option value="Lácteos">Lácteos y Quesos</option>
                    <option value="Fiambrería">Fiambrería</option>
                    <option value="Verdulería">Verdulería</option>
                    <option value="Bebidas">Bebidas y Cervezas</option>
                    <option value="Pastas">Pastas</option>
                    <option value="Conservas">Conservas</option>
                    <option value="Almacén">Almacén general</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="pos-label">Teléfono comercial</label>
                  <input
                    type="text"
                    placeholder="Ej. (0351) 450-8800"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    className="pos-input text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="pos-label">Email de contacto</label>
                  <input
                    type="email"
                    placeholder="pedidos@proveedor.com"
                    value={newSupEmail}
                    onChange={(e) => setNewSupEmail(e.target.value)}
                    className="pos-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="pos-label">Dirección comercial</label>
                <input
                  type="text"
                  placeholder="Ej. Bv. Los Andes 1200, Córdoba Capital"
                  value={newSupAddress}
                  onChange={(e) => setNewSupAddress(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={() => setIsNewSupplierModalOpen(false)} className="pos-btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary flex-1">
                  {submitting ? 'Guardando...' : 'Crear Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Proveedor */}
      {isEditSupplierModalOpen && selectedSupForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Editar Proveedor: {selectedSupForEdit.name}
              </h3>
              <button type="button" onClick={() => setIsEditSupplierModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEditSupplier} className="space-y-3">
              <div>
                <label className="pos-label">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  value={editSupName}
                  onChange={(e) => setEditSupName(e.target.value)}
                  className="pos-input font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="pos-label">CUIT Comercial</label>
                  <input
                    type="text"
                    value={editSupCuit}
                    onChange={(e) => setEditSupCuit(e.target.value)}
                    className="pos-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="pos-label">Rubro principal</label>
                  <select
                    value={editSupCategory}
                    onChange={(e) => setEditSupCategory(e.target.value)}
                    className="pos-input text-xs"
                  >
                    <option value="Carnicería">Carnicería</option>
                    <option value="Panadería">Panadería</option>
                    <option value="Lácteos">Lácteos y Quesos</option>
                    <option value="Fiambrería">Fiambrería</option>
                    <option value="Verdulería">Verdulería</option>
                    <option value="Bebidas">Bebidas y Cervezas</option>
                    <option value="Pastas">Pastas</option>
                    <option value="Conservas">Conservas</option>
                    <option value="Almacén">Almacén general</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="pos-label">Teléfono comercial</label>
                  <input
                    type="text"
                    value={editSupPhone}
                    onChange={(e) => setEditSupPhone(e.target.value)}
                    className="pos-input text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="pos-label">Email de contacto</label>
                  <input
                    type="email"
                    value={editSupEmail}
                    onChange={(e) => setEditSupEmail(e.target.value)}
                    className="pos-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="pos-label">Dirección comercial</label>
                  <input
                    type="text"
                    value={editSupAddress}
                    onChange={(e) => setEditSupAddress(e.target.value)}
                    className="pos-input text-xs"
                  />
                </div>
                <div>
                  <label className="pos-label">Estado de la cuenta</label>
                  <select
                    value={editSupStatus}
                    onChange={(e) => setEditSupStatus(e.target.value)}
                    className="pos-input text-xs"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo / Baja</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={() => setIsEditSupplierModalOpen(false)} className="pos-btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary flex-1">
                  {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago a Proveedor */}
      {isPaymentModalOpen && selectedSupForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Asentar Pago: {selectedSupForPayment.name}
              </h3>
              <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3">
              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Saldo deudor en cuenta corriente:</span>
                <strong className="font-mono text-sm text-[var(--status-danger-fg)]">
                  ${getSupplierBalance(selectedSupForPayment.id).debt.toLocaleString('es-AR')}
                </strong>
              </div>

              <div>
                <label className="pos-label">Monto del pago ($) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pos-input font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="pos-label">Forma de pago emitida:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="pos-input text-xs"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo">Efectivo (registra egreso en caja)</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="pos-label">Concepto o referencia:</label>
                <input
                  type="text"
                  placeholder="Ej. Transferencia Banco Macro comprobante #9412"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="pos-btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary flex-1">
                  {submitting ? 'Asentando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
