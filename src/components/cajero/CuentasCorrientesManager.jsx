import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { buildWhatsAppLink, normalizeArgentinePhone } from '../../utils/phoneHelper';

export default function CuentasCorrientesManager() {
  const {
    customers,
    customerPayments,
    suppliers,
    purchases,
    supplierPayments,
    users,
    staffCcMovements,
    currentUser,
    showToast,
    refreshData
  } = useApp();

  const [mainTab, setMainTab] = useState('customers'); // 'customers' | 'suppliers' | 'staff'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals Clientes
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [isEditCustModalOpen, setIsEditCustModalOpen] = useState(false);
  const [selectedCustForEdit, setSelectedCustForEdit] = useState(null);
  const [isCustPaymentModalOpen, setIsCustPaymentModalOpen] = useState(false);
  const [selectedCustForPayment, setSelectedCustForPayment] = useState(null);
  const [isCustHistoryModalOpen, setIsCustHistoryModalOpen] = useState(false);
  const [selectedCustForHistory, setSelectedCustForHistory] = useState(null);

  // Form states Cliente
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDni, setCustDni] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custLimit, setCustLimit] = useState('150000');
  const [custNotes, setCustNotes] = useState('');
  const [custPaymentAmount, setCustPaymentAmount] = useState('');
  const [custPaymentMethod, setCustPaymentMethod] = useState('efectivo');
  const [custPaymentNotes, setCustPaymentNotes] = useState('');

  // Modals Proveedores
  const [isSupPaymentModalOpen, setIsSupPaymentModalOpen] = useState(false);
  const [selectedSupForPayment, setSelectedSupForPayment] = useState(null);
  const [selectedVoucherId, setSelectedVoucherId] = useState('');
  const [supPaymentAmount, setSupPaymentAmount] = useState('');
  const [supPaymentMethod, setSupPaymentMethod] = useState('transferencia');
  const [supPaymentNotes, setSupPaymentNotes] = useState('');

  // Modals y Estados Personal / Rendición de Sueldos
  const [isStaffMovementModalOpen, setIsStaffMovementModalOpen] = useState(false);
  const [selectedStaffUser, setSelectedStaffUser] = useState(null);
  const [staffMovType, setStaffMovType] = useState('sueldo'); // 'sueldo' | 'consumo' | 'adelanto' | 'pago'
  const [staffMovAmount, setStaffMovAmount] = useState('');
  const [staffMovConcept, setStaffMovConcept] = useState('');
  const [staffPaymentMethod, setStaffPaymentMethod] = useState('efectivo'); // 'efectivo' | 'transferencia'
  const [staffAffectCashShift, setStaffAffectCashShift] = useState(true);
  const [isStaffHistoryModalOpen, setIsStaffHistoryModalOpen] = useState(false);
  const [selectedStaffForHistory, setSelectedStaffForHistory] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsNewCustModalOpen(false);
        setIsEditCustModalOpen(false);
        setIsCustPaymentModalOpen(false);
        setIsCustHistoryModalOpen(false);
        setIsSupPaymentModalOpen(false);
        setIsStaffMovementModalOpen(false);
        setIsStaffHistoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Clientes calculations
  const filteredCustomers = (customers || []).filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.dniCuit?.includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });

  const totalCustomerDebt = (customers || []).reduce((sum, c) => sum + (c.currentBalance || 0), 0);
  const customersWithDebtCount = (customers || []).filter(c => (c.currentBalance || 0) > 0).length;
  const totalCustomerPaymentsMonth = (customerPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  // Proveedores calculations
  // Deuda por compras con cuenta corriente y estado pendiente
  const pendingPurchases = (purchases || []).filter(
    p => p.paymentMethod === 'cuenta_corriente' && p.paymentStatus !== 'pagado'
  );
  const totalSupplierDebt = pendingPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalSupplierPaymentsMonth = (supplierPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  const filteredSuppliers = (suppliers || []).filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.cuit?.includes(q) || s.category?.toLowerCase().includes(q);
  });

  // Handlers Clientes
  const handleOpenNewCustomer = () => {
    setCustName('');
    setCustPhone('');
    setCustDni('');
    setCustAddress('');
    setCustLimit('150000');
    setCustNotes('');
    setIsNewCustModalOpen(true);
  };

  const handleSaveNewCustomer = async (e) => {
    e.preventDefault();
    if (!custName.trim()) {
      showToast('Ingresá el nombre o razón social del cliente', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createCustomer({
        name: custName.trim(),
        phone: custPhone.trim(),
        dniCuit: custDni.trim(),
        address: custAddress.trim(),
        creditLimit: Number(custLimit) || 100000,
        notes: custNotes.trim()
      });
      showToast(`Cliente ${created.name} registrado en cuenta corriente`);
      await refreshData();
      setIsNewCustModalOpen(false);
    } catch (err) {
      showToast(err.message || 'No se pudo crear el cliente', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditCustomer = (cust) => {
    setSelectedCustForEdit(cust);
    setCustName(cust.name || '');
    setCustPhone(cust.phone || '');
    setCustDni(cust.dniCuit || '');
    setCustAddress(cust.address || '');
    setCustLimit(String(cust.creditLimit || '100000'));
    setCustNotes(cust.notes || '');
    setIsEditCustModalOpen(true);
  };

  const handleSaveEditCustomer = async (e) => {
    e.preventDefault();
    if (!selectedCustForEdit || !custName.trim()) return;
    setSubmitting(true);
    try {
      await api.updateCustomer(selectedCustForEdit.id, {
        name: custName.trim(),
        phone: custPhone.trim(),
        dniCuit: custDni.trim(),
        address: custAddress.trim(),
        creditLimit: Number(custLimit) || 0,
        notes: custNotes.trim()
      });
      showToast(`Datos de ${custName} actualizados`);
      await refreshData();
      setIsEditCustModalOpen(false);
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el cliente', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCustomerPayment = (cust) => {
    setSelectedCustForPayment(cust);
    setCustPaymentAmount(cust.currentBalance > 0 ? String(cust.currentBalance) : '');
    setCustPaymentMethod('efectivo');
    setCustPaymentNotes('');
    setIsCustPaymentModalOpen(true);
  };

  const handleSubmitCustomerPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustForPayment) return;
    const amt = Number(custPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Ingresá un importe válido mayor a cero', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.addCustomerPayment(selectedCustForPayment.id, {
        amount: amt,
        paymentMethod: custPaymentMethod,
        notes: custPaymentNotes.trim(),
        user: currentUser
      });
      showToast(`Cobro de $${amt.toLocaleString('es-AR')} registrado a ${selectedCustForPayment.name}`);
      await refreshData();
      setIsCustPaymentModalOpen(false);
    } catch (err) {
      showToast(err.message || 'No se pudo registrar el cobro', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handlers Proveedores
  const handleOpenSupplierPayment = (sup, voucher = null) => {
    setSelectedSupForPayment(sup);
    setSelectedVoucherId(voucher ? voucher.id : '');
    setSupPaymentAmount(voucher ? String(voucher.totalAmount) : '');
    setSupPaymentMethod('transferencia');
    setSupPaymentNotes(voucher ? `Pago comprobante ${voucher.voucherType} ${voucher.voucherNumber}` : '');
    setIsSupPaymentModalOpen(true);
  };

  const handleSubmitSupplierPayment = async (e) => {
    e.preventDefault();
    if (!selectedSupForPayment) return;
    const amt = Number(supPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Ingresá un importe válido mayor a cero', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.addSupplierPayment(selectedSupForPayment.id, {
        amount: amt,
        paymentMethod: supPaymentMethod,
        voucherId: selectedVoucherId || null,
        notes: supPaymentNotes.trim(),
        user: currentUser
      });
      showToast(`Pago de $${amt.toLocaleString('es-AR')} a ${selectedSupForPayment.name} registrado`);
      await refreshData();
      setIsSupPaymentModalOpen(false);
    } catch (err) {
      showToast(err.message || 'No se pudo registrar el pago', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenStaffMovement = (u = null, type = 'sueldo') => {
    setSelectedStaffUser(u || users[0] || null);
    setStaffMovType(type);
    setStaffMovAmount('');
    setStaffMovConcept('');
    setStaffPaymentMethod('efectivo');
    setStaffAffectCashShift(true);
    setIsStaffMovementModalOpen(true);
  };

  const handleSaveStaffMovement = async (e) => {
    e.preventDefault();
    if (!selectedStaffUser) {
      showToast('Seleccioná un empleado', 'error');
      return;
    }
    const amt = Number(staffMovAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Ingresá un importe válido mayor a cero', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const isOutflow = staffMovType === 'adelanto' || staffMovType === 'pago';
      await api.addStaffCcMovement({
        userId: selectedStaffUser.id,
        userName: selectedStaffUser.name,
        type: staffMovType,
        amount: amt,
        paymentMethod: isOutflow ? staffPaymentMethod : null,
        affectCashShift: isOutflow && staffPaymentMethod === 'efectivo' ? staffAffectCashShift : false,
        concept: staffMovConcept.trim() || `Movimiento de ${staffMovType}`,
        recordedBy: currentUser?.name || 'Admin'
      });
      if (isOutflow && staffPaymentMethod === 'efectivo' && staffAffectCashShift) {
        showToast(`Movimiento registrado e impactado como egreso en el arqueo del turno`);
      } else {
        showToast(`Movimiento registrado a ${selectedStaffUser.name}`);
      }
      await refreshData();
      setIsStaffMovementModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Error al guardar movimiento', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Subtab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex rounded border border-[var(--border-strong)] p-0.5 bg-[var(--bg-subtle)]" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'customers'}
              onClick={() => { setMainTab('customers'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                mainTab === 'customers'
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-bold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <i className="fa-solid fa-users text-xs" aria-hidden="true"></i>
              <span>Clientes ({customers.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'suppliers'}
              onClick={() => { setMainTab('suppliers'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                mainTab === 'suppliers'
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-bold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <i className="fa-solid fa-truck text-xs" aria-hidden="true"></i>
              <span>Proveedores ({suppliers.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'staff'}
              onClick={() => { setMainTab('staff'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                mainTab === 'staff'
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-bold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <i className="fa-solid fa-user-tie text-xs" aria-hidden="true"></i>
              <span>Personal y Sueldos ({users.length})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mainTab === 'customers' && (
            <button
              type="button"
              onClick={handleOpenNewCustomer}
              className="pos-btn-primary text-xs px-3.5"
            >
              <i className="fa-solid fa-user-plus text-xs" aria-hidden="true"></i>
              <span>Nuevo cliente cta. cte.</span>
            </button>
          )}

          {mainTab === 'staff' && (
            <button
              type="button"
              onClick={() => handleOpenStaffMovement()}
              className="pos-btn-primary text-xs px-3.5"
            >
              <i className="fa-solid fa-plus text-xs mr-1" aria-hidden="true"></i>
              <span>Nuevo movimiento personal</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <label htmlFor="cta-search" className="text-xs font-semibold text-[var(--text-secondary)] shrink-0 inline-flex items-center gap-1.5">
              <i className="fa-solid fa-magnifying-glass text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
              <span>Buscar:</span>
            </label>
            <input
              id="cta-search"
              type="search"
              placeholder={mainTab === 'customers' ? 'Cliente, teléfono...' : mainTab === 'staff' ? 'Nombre o rol...' : 'Proveedor, CUIT...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pos-input text-xs py-1.5 w-48 sm:w-60"
            />
          </div>
        </div>
      </div>

      {/* ======================= TAB CLIENTES ======================= */}
      {mainTab === 'customers' && (
        <div className="space-y-4">
          {/* KPIs Clientes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="pos-panel p-3.5 border-l-4 border-l-[var(--status-danger-bar)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Total saldo a cobrar (fiados)
              </span>
              <span className="font-mono font-black text-xl text-[var(--status-danger-fg)]">
                ${totalCustomerDebt.toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                {customersWithDebtCount} clientes con saldo pendiente
              </span>
            </div>

            <div className="pos-panel p-3.5 border-l-4 border-l-emerald-500">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Cobros registrados en el mes
              </span>
              <span className="font-mono font-black text-xl text-emerald-500">
                ${totalCustomerPaymentsMonth.toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                {customerPayments.length} comprobantes de abono
              </span>
            </div>

            <div className="pos-panel p-3.5 border-l-4 border-l-[var(--accent-brand)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Clientes registrados
              </span>
              <span className="font-mono font-black text-xl text-[var(--text-primary)]">
                {customers.length} cuentas
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                Córdoba Capital y alrededores
              </span>
            </div>
          </div>

          {/* Customers List */}
          <div className="pos-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Directorio de cuentas corrientes ({filteredCustomers.length})
              </h3>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {filteredCustomers.length === 0 ? (
                <div className="p-10 text-center space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">No hay clientes que coincidan con la búsqueda</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Podés dar de alta un cliente para cuenta corriente con el botón superior.
                  </p>
                </div>
              ) : (
                filteredCustomers.map(cust => {
                  const debt = Number(cust.currentBalance || 0);
                  const limit = Number(cust.creditLimit || 0);
                  const isOverLimit = limit > 0 && debt > limit;
                  const waInfo = cust.phone ? normalizeArgentinePhone(cust.phone) : null;
                  const waLink = waInfo?.isValid
                    ? buildWhatsAppLink(
                        cust.phone,
                        `¡Hola ${cust.name}! Te escribimos desde GastroPOS Córdoba Capital respecto a tu saldo de cuenta corriente ($${debt.toLocaleString('es-AR')}).`
                      )
                    : null;

                  return (
                    <div key={cust.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-display font-bold text-base text-[var(--text-primary)]">
                              {cust.name}
                            </h4>
                            {isOverLimit && (
                              <span className="pos-badge pos-badge-bill font-semibold text-xs">
                                Supera límite
                              </span>
                            )}
                            {debt === 0 && (
                              <span className="pos-badge pos-badge-open font-semibold text-xs">
                                Al día
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-1 flex-wrap">
                            {cust.phone && (
                              <span className="font-mono flex items-center gap-1 text-[var(--text-primary)]">
                                <i className="fa-solid fa-phone text-[var(--text-muted)] text-[10px]" aria-hidden="true"></i>
                                {waInfo?.formattedDisplay || cust.phone}
                              </span>
                            )}
                            {cust.dniCuit && (
                              <span className="font-mono text-[var(--text-muted)]">
                                CUIT/DNI: {cust.dniCuit}
                              </span>
                            )}
                            {cust.address && (
                              <span className="text-[var(--text-muted)] flex items-center gap-1">
                                <i className="fa-solid fa-location-dot text-[var(--accent-brand)] text-[10px]" aria-hidden="true"></i>
                                {cust.address}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-[var(--text-muted)] block">Saldo adeudado</span>
                            <span className={`font-mono font-bold text-lg ${debt > 0 ? 'text-[var(--status-danger-fg)]' : 'text-emerald-500'}`}>
                              ${debt.toLocaleString('es-AR')}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] font-mono block">
                              Límite: ${limit.toLocaleString('es-AR')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Contactar por WhatsApp"
                                aria-label={`Enviar WhatsApp a ${cust.name}`}
                                className="pos-btn-secondary text-xs px-2.5 text-emerald-500 font-semibold"
                              >
                                <i className="fa-brands fa-whatsapp text-sm" aria-hidden="true"></i>
                                <span className="hidden md:inline">WhatsApp</span>
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenCustomerPayment(cust)}
                              className="pos-btn-primary text-xs px-3"
                              title="Registrar entrega o abono de dinero"
                            >
                              <i className="fa-solid fa-hand-holding-dollar text-xs" aria-hidden="true"></i>
                              <span>Cobrar / Abonar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setSelectedCustForHistory(cust); setIsCustHistoryModalOpen(true); }}
                              className="pos-btn-secondary text-xs px-2.5"
                              title="Ver historial de consumos y cobros"
                            >
                              <i className="fa-solid fa-clock-rotate-left text-xs" aria-hidden="true"></i>
                              <span>Historial</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditCustomer(cust)}
                              className="pos-btn-secondary text-xs px-2.5"
                              title="Editar datos del cliente"
                            >
                              <i className="fa-solid fa-pen-to-square text-xs" aria-hidden="true"></i>
                            </button>
                          </div>
                        </div>
                      </div>

                      {cust.notes && (
                        <p className="text-xs text-[var(--text-muted)] italic pt-1 border-t border-[var(--border-subtle)]">
                          Nota: {cust.notes}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB PROVEEDORES ======================= */}
      {mainTab === 'suppliers' && (
        <div className="space-y-4">
          {/* KPIs Proveedores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="pos-panel p-3.5 border-l-4 border-l-[var(--status-danger-bar)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Deuda comercial a proveedores
              </span>
              <span className="font-mono font-black text-xl text-[var(--status-danger-fg)]">
                ${totalSupplierDebt.toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                {pendingPurchases.length} facturas/remitos pendientes de pago
              </span>
            </div>

            <div className="pos-panel p-3.5 border-l-4 border-l-emerald-500">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Pagos a proveedores en el mes
              </span>
              <span className="font-mono font-black text-xl text-emerald-500">
                ${totalSupplierPaymentsMonth.toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                {supplierPayments.length} transferencias/recibos registrados
              </span>
            </div>

            <div className="pos-panel p-3.5 border-l-4 border-l-[var(--accent-brand)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Proveedores en cartera
              </span>
              <span className="font-mono font-black text-xl text-[var(--text-primary)]">
                {suppliers.length} firmas comerciales
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                Córdoba Capital
              </span>
            </div>
          </div>

          {/* Suppliers with pending debt and purchases */}
          <div className="pos-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Cuentas corrientes comerciales de proveedores ({filteredSuppliers.length})
              </h3>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {filteredSuppliers.length === 0 ? (
                <div className="p-10 text-center space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">No hay proveedores que coincidan con la búsqueda</p>
                </div>
              ) : (
                filteredSuppliers.map(sup => {
                  const supPurchases = (purchases || []).filter(p => p.supplierId === sup.id);
                  const supPending = supPurchases.filter(
                    p => p.paymentMethod === 'cuenta_corriente' && p.paymentStatus !== 'pagado'
                  );
                  const totalPending = supPending.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
                  const totalBought = supPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

                  return (
                    <div key={sup.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-display font-bold text-base text-[var(--text-primary)]">
                              {sup.name}
                            </h4>
                            <span className="pos-badge pos-badge-neutral text-xs">
                              {sup.category || 'Almacén'}
                            </span>
                            {totalPending > 0 ? (
                              <span className="pos-badge pos-badge-bill font-semibold text-xs">
                                Deuda pendiente: ${totalPending.toLocaleString('es-AR')}
                              </span>
                            ) : (
                              <span className="pos-badge pos-badge-open font-semibold text-xs">
                                Cta. Cte. al día
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-1 flex-wrap">
                            {sup.cuit && <span className="font-mono text-[var(--text-muted)]">CUIT: {sup.cuit}</span>}
                            {sup.phone && <span className="font-mono text-[var(--text-muted)]">Tel: {sup.phone}</span>}
                            {sup.email && <span className="text-[var(--text-muted)]">Email: {sup.email}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-[var(--text-muted)] block">Saldo a pagar</span>
                            <span className={`font-mono font-bold text-lg ${totalPending > 0 ? 'text-[var(--status-danger-fg)]' : 'text-emerald-500'}`}>
                              ${totalPending.toLocaleString('es-AR')}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] font-mono block">
                              Total compras: ${totalBought.toLocaleString('es-AR')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenSupplierPayment(sup)}
                            className="pos-btn-primary text-xs px-3"
                            title="Registrar pago a proveedor"
                          >
                            <i className="fa-solid fa-money-bill-transfer text-xs" aria-hidden="true"></i>
                            <span>Registrar pago</span>
                          </button>
                        </div>
                      </div>

                      {/* Pending Invoices for this Supplier */}
                      {supPending.length > 0 && (
                        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                          <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                            Comprobantes en cuenta corriente pendientes de cancelación:
                          </span>
                          <div className="space-y-1">
                            {supPending.map(p => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[var(--text-primary)]">
                                    {p.voucherType} #{p.voucherNumber}
                                  </span>
                                  <span className="text-[var(--text-muted)] font-mono">({p.date})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-bold text-[var(--status-danger-fg)]">
                                    ${p.totalAmount?.toLocaleString('es-AR')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSupplierPayment(sup, p)}
                                    className="pos-btn-secondary text-[11px] py-1 px-2"
                                  >
                                    Pagar factura
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= VISTA PRINCIPAL: PERSONAL Y RENDICIÓN DE SUELDOS ======================= */}
      {mainTab === 'staff' && (
        <div className="space-y-4">
          {/* Top KPI Cards for Staff */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="pos-panel p-3.5 border-l-4 border-l-[var(--accent-brand)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">Personal Registrado</span>
              <span className="font-mono font-black text-xl text-[var(--text-primary)]">{users.length}</span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">Admin, cajeros y mozos</span>
            </div>

            <div className="pos-panel p-3.5 border-l-4 border-l-emerald-500">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">Total Sueldos Asignados</span>
              <span className="font-mono font-black text-xl text-emerald-500">
                ${(staffCcMovements || []).filter(m => m.type === 'sueldo').reduce((acc, m) => acc + Number(m.amount || 0), 0).toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">Haberes brutos del mes</span>
            </div>

            <div className="pos-panel p-3.5 border-l-4 border-l-amber-500">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">Consumos de Empleados</span>
              <span className="font-mono font-black text-xl text-amber-500">
                -${(staffCcMovements || []).filter(m => m.type === 'consumo').reduce((acc, m) => acc + Number(m.amount || 0), 0).toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">Mesas, delivery y mostrador</span>
            </div>

            <div className="pos-panel p-3.5 border-l-4 border-l-sky-500">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">Adelantos y Pagos</span>
              <span className="font-mono font-black text-xl text-sky-400">
                -${(staffCcMovements || []).filter(m => m.type === 'adelanto' || m.type === 'pago').reduce((acc, m) => acc + Number(m.amount || 0), 0).toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">Entregados en efectivo/transf.</span>
            </div>
          </div>

          {/* Staff Accounts Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {users
              .filter(u => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return u.name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q) || String(u.pin).includes(q);
              })
              .map(u => {
                const uMovs = (staffCcMovements || []).filter(m => m.userId === u.id);
                const netBal = uMovs.reduce((acc, m) => acc + (m.impact * Number(m.amount || 0)), 0);
                const sueldoTotal = uMovs.filter(m => m.type === 'sueldo').reduce((acc, m) => acc + Number(m.amount || 0), 0);
                const consumosTotal = uMovs.filter(m => m.type === 'consumo').reduce((acc, m) => acc + Number(m.amount || 0), 0);
                const adelantosTotal = uMovs.filter(m => m.type === 'adelanto').reduce((acc, m) => acc + Number(m.amount || 0), 0);
                const pagosTotal = uMovs.filter(m => m.type === 'pago').reduce((acc, m) => acc + Number(m.amount || 0), 0);

                return (
                  <article key={u.id} className="pos-panel p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-brand)] flex items-center justify-center text-sm">
                            <i className={u.role === 'admin' ? 'fa-solid fa-user-shield' : u.role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie'} aria-hidden="true"></i>
                          </span>
                          <div>
                            <h3 className="font-display font-bold text-base text-[var(--text-primary)] leading-tight">{u.name}</h3>
                            <span className="pos-badge pos-badge-brand text-[10px] mt-0.5">{u.role} · PIN: {u.pin}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Saldo Neto</span>
                          <span className={`font-mono font-black text-base ${
                            netBal > 0 ? 'text-emerald-500' : netBal < 0 ? 'text-[var(--status-danger-fg)]' : 'text-[var(--text-secondary)]'
                          }`}>
                            {netBal > 0 ? `+$${netBal.toLocaleString('es-AR')}` : netBal < 0 ? `-$${Math.abs(netBal).toLocaleString('es-AR')}` : '$0'}
                          </span>
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="mt-3 p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between text-[var(--text-secondary)]">
                          <span>(+) Sueldo mensual:</span>
                          <span className="font-bold text-emerald-500">${sueldoTotal.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-[var(--text-secondary)]">
                          <span>(-) Consumos mesa/mostrador:</span>
                          <span className="font-bold text-amber-500">-${consumosTotal.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-[var(--text-secondary)]">
                          <span>(-) Adelantos entregados:</span>
                          <span className="font-bold text-rose-500">-${adelantosTotal.toLocaleString('es-AR')}</span>
                        </div>
                        {pagosTotal > 0 && (
                          <div className="flex justify-between text-[var(--text-secondary)]">
                            <span>(-) Liquidaciones pagadas:</span>
                            <span className="font-bold text-sky-400">-${pagosTotal.toLocaleString('es-AR')}</span>
                          </div>
                        )}
                        <div className="pt-1.5 border-t border-[var(--border-subtle)] flex justify-between font-bold text-xs text-[var(--text-primary)]">
                          <span>A liquidar neto:</span>
                          <span className={netBal >= 0 ? 'text-emerald-500' : 'text-[var(--status-danger-fg)]'}>
                            ${netBal.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaffForHistory(u);
                          setIsStaffHistoryModalOpen(true);
                        }}
                        className="pos-btn-secondary text-xs px-2.5 py-1"
                      >
                        <i className="fa-solid fa-list-check text-xs mr-1" aria-hidden="true"></i>
                        <span>Ver Ficha ({uMovs.length})</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenStaffMovement(u, 'consumo')}
                          className="pos-btn-secondary text-xs px-2 py-1 text-amber-500"
                          title="Cargar consumo de salón o mostrador"
                        >
                          <i className="fa-solid fa-burger text-xs mr-1" aria-hidden="true"></i>
                          <span>Consumo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenStaffMovement(u, 'adelanto')}
                          className="pos-btn-primary text-xs px-2.5 py-1"
                          title="Otorgar adelanto de sueldo"
                        >
                          <i className="fa-solid fa-hand-holding-dollar text-xs mr-1" aria-hidden="true"></i>
                          <span>Adelanto</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        </div>
      )}

      {/* ======================= MODAL: NUEVO CLIENTE ======================= */}
      {isNewCustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Nuevo cliente de cuenta corriente
              </h3>
              <button type="button" onClick={() => setIsNewCustModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="p-4 space-y-3">
              <div>
                <label className="pos-label">Nombre / Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Estudio Contable Córdoba..."
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="pos-label">Teléfono (WhatsApp)</label>
                  <input
                    type="text"
                    placeholder="Ej. 351 512-3456"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="pos-input text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="pos-label">DNI o CUIT</label>
                  <input
                    type="text"
                    placeholder="Ej. 30-71458921-2"
                    value={custDni}
                    onChange={(e) => setCustDni(e.target.value)}
                    className="pos-input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="pos-label">Dirección (Córdoba Capital)</label>
                <input
                  type="text"
                  placeholder="Ej. Bv. San Juan 450, Centro"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div>
                <label className="pos-label">Límite de crédito autorizado ($)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={custLimit}
                  onChange={(e) => setCustLimit(e.target.value)}
                  className="pos-input text-xs font-mono"
                />
              </div>

              <div>
                <label className="pos-label">Observaciones / Condiciones comerciales</label>
                <textarea
                  rows="2"
                  placeholder="Ej. Facturación quincenal, almuerzos corporativos..."
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="pos-input text-xs"
                ></textarea>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex gap-2 justify-end">
                <button type="button" onClick={() => setIsNewCustModalOpen(false)} className="pos-btn-secondary text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary text-xs">
                  {submitting ? 'Guardando...' : 'Guardar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EDITAR CLIENTE ======================= */}
      {isEditCustModalOpen && selectedCustForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Editar cliente de cuenta corriente
              </h3>
              <button type="button" onClick={() => setIsEditCustModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="p-4 space-y-3">
              <div>
                <label className="pos-label">Nombre / Razón Social *</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="pos-label">Teléfono (WhatsApp)</label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="pos-input text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="pos-label">DNI o CUIT</label>
                  <input
                    type="text"
                    value={custDni}
                    onChange={(e) => setCustDni(e.target.value)}
                    className="pos-input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="pos-label">Dirección (Córdoba Capital)</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div>
                <label className="pos-label">Límite de crédito autorizado ($)</label>
                <input
                  type="number"
                  value={custLimit}
                  onChange={(e) => setCustLimit(e.target.value)}
                  className="pos-input text-xs font-mono"
                />
              </div>

              <div>
                <label className="pos-label">Observaciones</label>
                <textarea
                  rows="2"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="pos-input text-xs"
                ></textarea>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex gap-2 justify-end">
                <button type="button" onClick={() => setIsEditCustModalOpen(false)} className="pos-btn-secondary text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary text-xs">
                  {submitting ? 'Guardando...' : 'Actualizar datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REGISTRAR COBRO / ABONO DE CLIENTE ======================= */}
      {isCustPaymentModalOpen && selectedCustForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Registrar cobro de cuenta corriente
                </h3>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {selectedCustForPayment.name} · Saldo actual: ${Number(selectedCustForPayment.currentBalance || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <button type="button" onClick={() => setIsCustPaymentModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitCustomerPayment} className="p-4 space-y-3.5">
              <div>
                <label className="pos-label">Importe cobrado ($) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={custPaymentAmount}
                  onChange={(e) => setCustPaymentAmount(e.target.value)}
                  className="pos-input text-base font-bold font-mono text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="pos-label">Medio de cobro:</label>
                <select
                  value={custPaymentMethod}
                  onChange={(e) => setCustPaymentMethod(e.target.value)}
                  className="pos-input text-xs"
                >
                  <option value="efectivo">Efectivo (Impacta en turno de caja abierto)</option>
                  <option value="transferencia">Transferencia bancaria / QR</option>
                  <option value="debito">Tarjeta de débito</option>
                  <option value="credito">Tarjeta de crédito</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="pos-label">Detalle o comprobante</label>
                <input
                  type="text"
                  placeholder="Ej. Transferencia Bancor #10294, pago en caja..."
                  value={custPaymentNotes}
                  onChange={(e) => setCustPaymentNotes(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Saldo actual:</span>
                  <span className="font-mono font-bold">${Number(selectedCustForPayment.currentBalance || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Monto a abonar:</span>
                  <span className="font-mono font-bold text-emerald-500">
                    -${(Number(custPaymentAmount) || 0).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[var(--border-subtle)]">
                  <span className="font-semibold text-[var(--text-primary)]">Nuevo saldo remanente:</span>
                  <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                    ${Math.max(0, (Number(selectedCustForPayment.currentBalance || 0) - (Number(custPaymentAmount) || 0))).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex gap-2 justify-end">
                <button type="button" onClick={() => setIsCustPaymentModalOpen(false)} className="pos-btn-secondary text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary text-xs">
                  {submitting ? 'Registrando...' : 'Confirmar cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: HISTORIAL DE CLIENTE ======================= */}
      {isCustHistoryModalOpen && selectedCustForHistory && (() => {
        const custOrders = (selectedCustForHistory.ordersHistory || []);
        const custPays = (customerPayments || []).filter(p => p.customerId === selectedCustForHistory.id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3" role="dialog" aria-modal="true">
            <div className="pos-panel w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                    Historial de cuenta corriente
                  </h3>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {selectedCustForHistory.name} · Saldo: ${Number(selectedCustForHistory.currentBalance || 0).toLocaleString('es-AR')}
                  </span>
                </div>
                <button type="button" onClick={() => setIsCustHistoryModalOpen(false)} className="pos-btn-ghost">
                  <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Cobros / Pagos del Cliente */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[var(--text-secondary)] block">
                    Pagos y abonos recibidos ({custPays.length})
                  </span>
                  {custPays.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic">Sin pagos registrados aún.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {custPays.map(cp => (
                        <div key={cp.id} className="p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-[var(--text-primary)]">Abono {cp.paymentMethod}</span>
                            <span className="text-[var(--text-muted)] font-mono block text-[11px]">{cp.date} · Registró {cp.registeredBy}</span>
                            {cp.notes && <span className="text-[11px] text-[var(--text-secondary)] block">{cp.notes}</span>}
                          </div>
                          <span className="font-mono font-bold text-sm text-emerald-500">
                            +${cp.amount?.toLocaleString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Consumos / Comandas cargadas */}
                <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-xs font-bold text-[var(--text-secondary)] block">
                    Consumos cargados a la cuenta ({custOrders.length})
                  </span>
                  {custOrders.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic">Sin consumos cargados a cuenta corriente.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {custOrders.map((co, idx) => (
                        <div key={idx} className="p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-[var(--text-primary)]">Comanda #{co.orderNumber}</span>
                            <span className="text-[var(--text-muted)] font-mono block text-[11px]">{co.date?.split('T')[0]}</span>
                          </div>
                          <span className="font-mono font-bold text-sm text-[var(--status-danger-fg)]">
                            ${co.total?.toLocaleString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] text-right shrink-0">
                <button type="button" onClick={() => setIsCustHistoryModalOpen(false)} className="pos-btn-secondary text-xs">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================= MODAL: REGISTRAR PAGO A PROVEEDOR ======================= */}
      {isSupPaymentModalOpen && selectedSupForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Registrar pago a proveedor
                </h3>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {selectedSupForPayment.name}
                </span>
              </div>
              <button type="button" onClick={() => setIsSupPaymentModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitSupplierPayment} className="p-4 space-y-3.5">
              <div>
                <label className="pos-label">Importe a pagar ($) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={supPaymentAmount}
                  onChange={(e) => setSupPaymentAmount(e.target.value)}
                  className="pos-input text-base font-bold font-mono text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="pos-label">Medio de pago:</label>
                <select
                  value={supPaymentMethod}
                  onChange={(e) => setSupPaymentMethod(e.target.value)}
                  className="pos-input text-xs"
                >
                  <option value="transferencia">Transferencia Bancaria (Bancor / CBU)</option>
                  <option value="efectivo">Efectivo (Registra egreso en turno de caja)</option>
                  <option value="cheque">Cheque propio / diferido</option>
                  <option value="mercadopago">Mercado Pago / CVU</option>
                </select>
              </div>

              <div>
                <label className="pos-label">Comprobante o detalle del pago</label>
                <input
                  type="text"
                  placeholder="Ej. Transferencia nro 884912, recibo provisorio..."
                  value={supPaymentNotes}
                  onChange={(e) => setSupPaymentNotes(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex gap-2 justify-end">
                <button type="button" onClick={() => setIsSupPaymentModalOpen(false)} className="pos-btn-secondary text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary text-xs">
                  {submitting ? 'Registrando...' : 'Confirmar pago a proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: NUEVO MOVIMIENTO DE PERSONAL / CC ======================= */}
      {isStaffMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3" role="dialog" aria-modal="true">
          <div className="pos-panel w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Asentar Movimiento en Cuenta Corriente de Personal
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  Rendición de haberes, consumos y adelantos
                </span>
              </div>
              <button type="button" onClick={() => setIsStaffMovementModalOpen(false)} className="pos-btn-ghost">
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSaveStaffMovement} className="p-4 space-y-3.5">
              <div>
                <label className="pos-label">Empleado / Personal *</label>
                <select
                  value={selectedStaffUser?.id || ''}
                  onChange={(e) => {
                    const u = users.find(x => x.id === e.target.value);
                    setSelectedStaffUser(u || null);
                  }}
                  className="pos-input text-xs"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pos-label">Tipo de movimiento *</label>
                <select
                  value={staffMovType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setStaffMovType(nextType);
                    if (nextType === 'adelanto' || nextType === 'pago') {
                      setStaffPaymentMethod('efectivo');
                      setStaffAffectCashShift(true);
                    }
                  }}
                  className="pos-input text-xs font-semibold"
                >
                  <option value="sueldo">(+) Sueldo mensual / Asignación base</option>
                  <option value="consumo">(-) Consumo en salón / mostrador / delivery</option>
                  <option value="adelanto">(-) Adelanto de sueldo</option>
                  <option value="pago">(-) Liquidación / Pago restante de sueldo</option>
                </select>
              </div>

              {(staffMovType === 'adelanto' || staffMovType === 'pago') && (
                <div className="space-y-3 p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                  <div>
                    <label className="pos-label mb-1.5 block">Medio de pago / entrega *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStaffPaymentMethod('efectivo');
                          setStaffAffectCashShift(true);
                        }}
                        className={`px-3 py-2 text-xs font-semibold rounded border transition-colors flex items-center justify-center gap-1.5 ${
                          staffPaymentMethod === 'efectivo'
                            ? 'bg-[var(--accent-brand)] text-[var(--accent-brand-contrast)] border-[var(--accent-brand)] shadow-sm'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <i className="fa-solid fa-money-bill-wave text-xs" aria-hidden="true"></i>
                        <span>Efectivo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStaffPaymentMethod('transferencia');
                          setStaffAffectCashShift(false);
                        }}
                        className={`px-3 py-2 text-xs font-semibold rounded border transition-colors flex items-center justify-center gap-1.5 ${
                          staffPaymentMethod === 'transferencia'
                            ? 'bg-[var(--accent-brand)] text-[var(--accent-brand-contrast)] border-[var(--accent-brand)] shadow-sm'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <i className="fa-solid fa-arrow-right-arrow-left text-xs" aria-hidden="true"></i>
                        <span>Transferencia</span>
                      </button>
                    </div>
                  </div>

                  {staffPaymentMethod === 'efectivo' && (
                    <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                      <span className="text-xs font-bold text-[var(--text-primary)] block">
                        Origen del efectivo e impacto en arqueo:
                      </span>
                      <div className="space-y-2">
                        <label className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-colors ${
                          staffAffectCashShift
                            ? 'bg-[var(--bg-elevated)] border-[var(--accent-brand)]'
                            : 'bg-[var(--bg-card)] border-[var(--border-subtle)]'
                        }`}>
                          <input
                            type="radio"
                            name="affectCashShift"
                            checked={staffAffectCashShift === true}
                            onChange={() => setStaffAffectCashShift(true)}
                            className="mt-0.5"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-[var(--text-primary)] block">
                              Caja de turno (Impacta en el arqueo)
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] block">
                              El dinero sale de la caja del cajero actual. Se registrará un egreso en el turno activo.
                            </span>
                          </div>
                        </label>

                        <label className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-colors ${
                          !staffAffectCashShift
                            ? 'bg-[var(--bg-elevated)] border-[var(--accent-brand)]'
                            : 'bg-[var(--bg-card)] border-[var(--border-subtle)]'
                        }`}>
                          <input
                            type="radio"
                            name="affectCashShift"
                            checked={staffAffectCashShift === false}
                            onChange={() => setStaffAffectCashShift(false)}
                            className="mt-0.5"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-[var(--text-primary)] block">
                              Caja grande / Fondos centrales (NO impacta en arqueo)
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] block">
                              El adelanto se abonó de una caja fuerte o fondos externos. Se descuenta del empleado sin alterar el efectivo del turno del cajero.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {staffPaymentMethod === 'transferencia' && (
                    <div className="p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)] flex items-center gap-2">
                      <i className="fa-solid fa-circle-info text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                      <span>Pago bancario. Se descuenta de la cuenta del personal sin restar billetes del arqueo físico de caja.</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="pos-label">Importe ($) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ej. 50000"
                  value={staffMovAmount}
                  onChange={(e) => setStaffMovAmount(e.target.value)}
                  className="pos-input text-base font-mono font-bold"
                />
              </div>

              <div>
                <label className="pos-label">Concepto explicativo *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    staffMovType === 'sueldo'
                      ? 'Ej. Sueldo mes en curso'
                      : staffMovType === 'adelanto'
                      ? staffPaymentMethod === 'transferencia'
                        ? 'Ej. Adelanto transferido a cuenta bancaria'
                        : staffAffectCashShift
                        ? 'Ej. Adelanto en efectivo retirado de caja'
                        : 'Ej. Adelanto abonado desde caja grande'
                      : staffMovType === 'consumo'
                      ? 'Ej. Consumo Mesa 1 o cerveza artesanal'
                      : 'Ej. Liquidación final de haberes'
                  }
                  value={staffMovConcept}
                  onChange={(e) => setStaffMovConcept(e.target.value)}
                  className="pos-input text-xs"
                />
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex gap-2 justify-end">
                <button type="button" onClick={() => setIsStaffMovementModalOpen(false)} className="pos-btn-secondary text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="pos-btn-primary text-xs">
                  {submitting ? 'Guardando...' : 'Asentar movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: FICHA DE MOVIMIENTOS DE PERSONAL ======================= */}
      {isStaffHistoryModalOpen && selectedStaffForHistory && (() => {
        const u = selectedStaffForHistory;
        const uMovs = (staffCcMovements || []).filter(m => m.userId === u.id);
        const netBal = uMovs.reduce((acc, m) => acc + (m.impact * Number(m.amount || 0)), 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3" role="dialog" aria-modal="true">
            <div className="pos-panel w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded bg-[var(--accent-brand-bg)] border border-[var(--accent-brand-border)] text-[var(--accent-brand)] flex items-center justify-center text-xs">
                    <i className="fa-solid fa-file-invoice text-xs" aria-hidden="true"></i>
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                      Ficha de Cuenta Corriente: {u.name}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {u.role} · Saldo a liquidar: <strong className={netBal >= 0 ? 'text-emerald-500 font-mono' : 'text-rose-500 font-mono'}>${netBal.toLocaleString('es-AR')}</strong>
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsStaffHistoryModalOpen(false)} className="pos-btn-ghost">
                  <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-2">
                {uMovs.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] text-center py-8">
                    No hay movimientos registrados para este empleado.
                  </p>
                ) : (
                  uMovs.map(m => {
                    const isCredit = m.impact > 0;
                    return (
                      <div key={m.id} className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              m.type === 'sueldo'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : m.type === 'consumo'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : m.type === 'adelanto'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                            }`}>
                              {m.type === 'sueldo' ? '+ Sueldo' : m.type === 'consumo' ? '- Consumo' : m.type === 'adelanto' ? '- Adelanto' : '- Liquidación'}
                            </span>
                            {m.paymentMethod && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                                {m.paymentMethod === 'transferencia'
                                  ? 'Transferencia'
                                  : m.affectCashShift
                                  ? 'Efectivo · Caja turno'
                                  : 'Efectivo · Caja grande'}
                              </span>
                            )}
                            <span className="text-[11px] text-[var(--text-muted)] font-mono">
                              {new Date(m.date).toLocaleDateString()} {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="font-semibold text-[var(--text-primary)]">{m.concept}</p>
                          <span className="text-[10px] text-[var(--text-muted)] block">Registrado por: {m.recordedBy}</span>
                        </div>

                        <span className={`font-mono font-bold text-sm shrink-0 ${
                          isCredit ? 'text-emerald-500' : 'text-[var(--status-danger-fg)]'
                        }`}>
                          {isCredit ? '+' : '-'}${Number(m.amount).toLocaleString('es-AR')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] flex justify-between items-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsStaffHistoryModalOpen(false);
                    handleOpenStaffMovement(u, 'consumo');
                  }}
                  className="pos-btn-secondary text-xs"
                >
                  <i className="fa-solid fa-plus text-xs mr-1" aria-hidden="true"></i>
                  <span>Cargar movimiento</span>
                </button>

                <button type="button" onClick={() => setIsStaffHistoryModalOpen(false)} className="pos-btn-primary text-xs">
                  Cerrar ficha
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
