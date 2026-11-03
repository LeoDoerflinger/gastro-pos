import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getTableCode } from '../mozo/MozoSalonView';

export default function ArqueoCaja() {
  const { activeShift, orders, currentUser, showToast, refreshData, logoutUser, setLastClosedShiftReport, tables } = useApp();

  const [initialCashInput, setInitialCashInput] = useState('0');
  const [shiftHistory, setShiftHistory] = useState([]);

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState('egreso');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [actualCashCount, setActualCashCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getCashShifts().then(list => setShiftHistory(list || [])).catch(() => {});
  }, [activeShift]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMovementModalOpen(false);
        setIsClosingModalOpen(false);
      }
    };
    if (isMovementModalOpen || isClosingModalOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isMovementModalOpen, isClosingModalOpen]);

  const shiftStart = activeShift ? new Date(activeShift.openedAt).getTime() : 0;
  const closedShiftOrders = orders.filter(
    o => o.status === 'cobrado' && new Date(o.closedAt || o.createdAt).getTime() >= shiftStart
  );

  const salesByMethod = {
    efectivo: 0,
    debito: 0,
    credito: 0,
    mercadopago: 0,
    transferencia: 0,
    mixto: 0
  };

  closedShiftOrders.forEach(o => {
    const pm = o.paymentMethod || 'efectivo';
    salesByMethod[pm] = (salesByMethod[pm] || 0) + (o.total || 0);
  });

  const totalSales = Object.values(salesByMethod).reduce((a, b) => a + b, 0);

  const totalIngresos = (activeShift?.movements || [])
    .filter(m => m.type === 'ingreso')
    .reduce((a, m) => a + m.amount, 0);

  const totalEgresos = (activeShift?.movements || [])
    .filter(m => m.type === 'egreso')
    .reduce((a, m) => a + m.amount, 0);

  const expectedCash = activeShift
    ? (activeShift.initialCash || 0) + salesByMethod.efectivo + totalIngresos - totalEgresos
    : 0;

  const countNum = Number(actualCashCount) || 0;
  const cashDifference = actualCashCount !== '' ? countNum - expectedCash : 0;

  const handleOpenShift = async () => {
    if (initialCashInput === '' || Number(initialCashInput) < 0) {
      showToast('Ingresá un efectivo inicial válido (0 o mayor)', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.openShift({
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        initialCash: Number(initialCashInput)
      });
      showToast('Turno de caja abierto');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo abrir la caja', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMovement = async () => {
    if (!movementAmount || Number(movementAmount) <= 0 || !movementReason.trim()) {
      showToast('Completá el monto y el concepto del movimiento', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.addCashMovement(activeShift.id, {
        type: movementType,
        amount: Number(movementAmount),
        reason: movementReason,
        user: currentUser.name
      });
      showToast(`Movimiento de ${movementType} guardado`);
      setIsMovementModalOpen(false);
      setMovementAmount('');
      setMovementReason('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo registrar el movimiento', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (actualCashCount === '') {
      showToast('Ingresá el efectivo físico contado en la caja', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const closedReport = await api.closeCashShift(activeShift.id, {
        actualCash: countNum,
        notes: closingNotes,
        closedBy: currentUser.name
      });
      setIsClosingModalOpen(false);
      setActualCashCount('');
      setClosingNotes('');
      await refreshData();
      setLastClosedShiftReport(closedReport);
      logoutUser();
    } catch (err) {
      showToast(err.message || 'No se pudo cerrar la caja', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const nowDatePreview = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nowTimePreview = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const activeOpenedDate = activeShift?.openedDate || (activeShift?.openedAt ? new Date(activeShift.openedAt).toLocaleDateString('es-AR') : '');
  const activeOpenedTime = activeShift?.openedTime || (activeShift?.openedAt ? new Date(activeShift.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  const closedShifts = (shiftHistory || []).filter(s => s.status === 'cerrada');

  return (
    <section className="space-y-5" aria-label="Arqueo y control de caja">
      {/* Shift Status Bar */}
      <div className="pos-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeShift ? 'bg-[var(--status-open-bar)]' : 'bg-[var(--status-danger-bar)]'
              }`}
              aria-hidden="true"
            ></span>
            <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
              {activeShift ? 'Caja abierta · Turno en curso' : 'Caja cerrada · Iniciar nuevo turno'}
            </h2>
          </div>
          {activeShift ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)] mt-1">
              <span>
                Responsable: <strong className="text-[var(--text-primary)]">{activeShift.cashierName}</strong>
              </span>
              <span>
                Fecha apertura: <strong className="font-mono text-[var(--text-primary)]">{activeOpenedDate}</strong>
              </span>
              <span>
                Hora apertura: <strong className="font-mono text-[var(--text-primary)]">{activeOpenedTime} hs</strong>
              </span>
            </div>
          ) : (
            <div className="space-y-1 mt-1">
              <p className="text-sm text-[var(--text-secondary)]">
                Definí el efectivo inicial para habilitar cobros y movimientos del turno.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--text-secondary)]">
                <span>Fecha de apertura: <strong className="text-[var(--text-primary)]">{nowDatePreview}</strong></span>
                <span>Hora de apertura: <strong className="text-[var(--text-primary)]">{nowTimePreview} hs</strong></span>
              </div>
            </div>
          )}
        </div>

        {activeShift ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMovementModalOpen(true)}
              className="pos-btn-secondary"
            >
              <i className="fa-solid fa-arrows-up-down text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
              <span>Registrar ingreso / gasto</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClosingModalOpen(true)}
              className="pos-btn-primary"
            >
              <i className="fa-solid fa-lock text-xs" aria-hidden="true"></i>
              <span>Arqueo y cierre</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="w-44">
              <label htmlFor="initial-cash-input" className="pos-label">
                Efectivo inicial ($):
              </label>
              <input
                id="initial-cash-input"
                type="number"
                placeholder="0"
                value={initialCashInput}
                onChange={(e) => setInitialCashInput(e.target.value)}
                className="pos-input font-mono font-bold"
              />
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleOpenShift}
              className="pos-btn-primary"
            >
              <i className="fa-solid fa-lock-open text-xs" aria-hidden="true"></i>
              <span>Abrir turno</span>
            </button>
          </div>
        )}
      </div>

      {/* 3-Column Financial Ledger */}
      {activeShift && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Physical Cash Equation */}
          <div className="pos-panel flex flex-col justify-between overflow-hidden">
            <div>
              <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center gap-2">
                <i className="fa-solid fa-money-bill-wave text-sm text-[var(--accent-brand)]" aria-hidden="true"></i>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Efectivo en caja
                </h3>
              </div>

              <div className="divide-y divide-[var(--border-subtle)] px-4 text-sm">
                <div className="py-3 flex justify-between text-[var(--text-secondary)]">
                  <span>Efectivo inicial</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    ${(activeShift.initialCash || 0).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[var(--text-secondary)]">
                  <span>Cobros en efectivo</span>
                  <span className="font-mono font-semibold text-[var(--status-open-fg)]">
                    +${salesByMethod.efectivo.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[var(--text-secondary)]">
                  <span>Ingresos manuales</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    +${totalIngresos.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[var(--text-secondary)]">
                  <span>Gastos / retiros</span>
                  <span className="font-mono font-semibold text-[var(--status-danger-fg)]">
                    -${totalEgresos.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-4 py-3.5 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex justify-between items-center">
              <span className="text-sm font-bold text-[var(--text-primary)]">Efectivo esperado</span>
              <span className="font-mono font-bold text-lg text-[var(--text-primary)]">
                ${expectedCash.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Column 2: Sales by Payment Method */}
          <div className="pos-panel flex flex-col justify-between overflow-hidden">
            <div>
              <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-credit-card text-sm text-[var(--accent-brand)]" aria-hidden="true"></i>
                  <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                    Ventas por medio
                  </h3>
                </div>
                <span className="text-xs font-mono text-[var(--text-secondary)]">{closedShiftOrders.length} tickets</span>
              </div>

              <div className="divide-y divide-[var(--border-subtle)] px-4 text-sm">
                {[
                  { key: 'efectivo', label: 'Efectivo', icon: 'fa-money-bill-wave' },
                  { key: 'debito', label: 'Tarjeta Débito', icon: 'fa-credit-card' },
                  { key: 'credito', label: 'Tarjeta Crédito', icon: 'fa-credit-card' },
                  { key: 'mercadopago', label: 'QR / Mercado Pago', icon: 'fa-qrcode' },
                  { key: 'transferencia', label: 'Transferencia', icon: 'fa-building-columns' }
                ].map(item => (
                  <div key={item.key} className="py-2.5 flex justify-between items-center text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2">
                      <i className={`fa-solid ${item.icon} text-xs text-[var(--text-muted)] w-4 text-center`} aria-hidden="true"></i>
                      <span>{item.label}</span>
                    </span>
                    <span className="font-mono font-semibold text-[var(--text-primary)]">
                      ${salesByMethod[item.key].toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-3.5 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex justify-between items-center">
              <span className="text-sm font-bold text-[var(--text-primary)]">Total facturado</span>
              <span className="font-mono font-bold text-lg text-[var(--status-open-fg)]">
                ${totalSales.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Column 3: Manual Cash Movements */}
          <div className="pos-panel flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-sm text-[var(--accent-brand)]" aria-hidden="true"></i>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Movimientos ({activeShift.movements?.length || 0})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(true)}
                className="pos-btn-ghost text-xs px-2.5"
              >
                + Cargar
              </button>
            </div>

            <div className="flex-1 divide-y divide-[var(--border-subtle)] overflow-y-auto max-h-64">
              {(activeShift.movements || []).length === 0 ? (
                <div className="p-8 text-center space-y-1">
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Sin movimientos manuales</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Registrá acá retiros, pagos a proveedores en efectivo o refuerzos de cambio.
                  </p>
                </div>
              ) : (
                activeShift.movements.map(mov => (
                  <div key={mov.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`pos-badge ${mov.type === 'ingreso' ? 'pos-badge-open' : 'pos-badge-danger'}`}>
                          {mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-mono">
                          {new Date(mov.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] truncate mt-1">{mov.reason}</p>
                    </div>

                    <span
                      className={`font-mono font-bold text-sm shrink-0 ${
                        mov.type === 'ingreso' ? 'text-[var(--status-open-fg)]' : 'text-[var(--status-danger-fg)]'
                      }`}
                    >
                      {mov.type === 'ingreso' ? '+' : '-'}${mov.amount.toLocaleString('es-AR')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Closed Shifts History */}
      {closedShifts.length > 0 && (
        <div className="pos-panel overflow-hidden">
          <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Historial de arqueos cerrados ({closedShifts.length})
            </h3>
            <span className="text-xs text-[var(--text-secondary)]">
              Tocá Ver balance para revisar el detalle del turno
            </span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {closedShifts.map(s => {
              const sOpenDate = s.openedDate || (s.openedAt ? new Date(s.openedAt).toLocaleDateString('es-AR') : '');
              const sOpenTime = s.openedTime || (s.openedAt ? new Date(s.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
              const sCloseDate = s.closedDate || (s.closedAt ? new Date(s.closedAt).toLocaleDateString('es-AR') : '');
              const sCloseTime = s.closedTime || (s.closedAt ? new Date(s.closedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
              return (
                <div key={s.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-[var(--bg-hover)]">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      Usuario: {s.closedBy || s.cashierName}
                    </div>
                    <div className="text-xs font-mono text-[var(--text-secondary)] flex flex-wrap items-center gap-3">
                      <span>Apertura: {sOpenDate} · {sOpenTime} hs</span>
                      <span>Cierre: {sCloseDate} · {sCloseTime} hs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono">
                      <span className="text-xs text-[var(--text-muted)] block">Efectivo contado</span>
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        ${(s.actualCash || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastClosedShiftReport(s)}
                      className="pos-btn-secondary text-xs px-3"
                    >
                      <i className="fa-solid fa-file-lines text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                      <span>Ver balance</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Register Movement Modal */}
      {isMovementModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-modal-title"
        >
          <div className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 id="movement-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                Registrar movimiento de caja
              </h3>
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                aria-label="Cerrar ventana"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={movementType === 'egreso'}
                onClick={() => setMovementType('egreso')}
                className={movementType === 'egreso' ? 'pos-btn-danger' : 'pos-btn-secondary'}
              >
                Egreso / Gasto
              </button>
              <button
                type="button"
                aria-pressed={movementType === 'ingreso'}
                onClick={() => setMovementType('ingreso')}
                className={movementType === 'ingreso' ? 'pos-btn-primary' : 'pos-btn-secondary'}
              >
                Ingreso / Cambio
              </button>
            </div>

            <div>
              <label htmlFor="movement-amount-input" className="pos-label">Importe ($):</label>
              <input
                id="movement-amount-input"
                type="number"
                placeholder="0"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                className="pos-input font-mono font-bold"
              />
            </div>

            <div>
              <label htmlFor="movement-reason-input" className="pos-label">Concepto:</label>
              <input
                id="movement-reason-input"
                type="text"
                placeholder="Ej. Compra de hielo, adelanto cadete..."
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                className="pos-input"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="pos-btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleAddMovement}
                className="pos-btn-primary flex-1"
              >
                Guardar movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blind Count / Close Shift Modal */}
      {isClosingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="closing-modal-title"
        >
          <div className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 id="closing-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                Arqueo y cierre de turno
              </h3>
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                aria-label="Cerrar ventana"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              Contá los billetes físicos en la caja e ingresá el total para compararlo contra el saldo esperado.
            </p>

            {(() => {
              const openTables = (tables || []).filter(t => t.status !== 'libre');
              if (openTables.length === 0) return null;
              return (
                <div className="p-3 bg-[var(--status-bill-bg)] border border-[var(--status-bill-border)] rounded text-xs text-[var(--status-bill-fg)] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <i className="fa-solid fa-triangle-exclamation text-xs" aria-hidden="true"></i>
                    <span>Aviso: Hay {openTables.length} mesa(s) con comanda abierta en el salón</span>
                  </div>
                  <p className="text-[var(--text-secondary)]">
                    Mesas: {openTables.map(t => getTableCode(t)).join(', ')}. Podés cerrar el turno de caja de todos modos.
                  </p>
                </div>
              );
            })()}

            <div>
              <label htmlFor="actual-cash-input" className="pos-label">
                Efectivo físico contado ($):
              </label>
              <input
                id="actual-cash-input"
                type="number"
                placeholder="0"
                value={actualCashCount}
                onChange={(e) => setActualCashCount(e.target.value)}
                className="pos-input font-mono font-bold text-base"
              />
            </div>

            {actualCashCount !== '' && (
              <div className="pos-subpanel p-3.5 space-y-2 text-sm">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Efectivo esperado</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    ${expectedCash.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-[var(--border-subtle)]">
                  <span>Diferencia</span>
                  <span
                    className={`font-mono ${
                      cashDifference === 0
                        ? 'text-[var(--status-open-fg)]'
                        : cashDifference > 0
                        ? 'text-[var(--accent-brand)]'
                        : 'text-[var(--status-danger-fg)]'
                    }`}
                  >
                    {cashDifference === 0
                      ? 'Caja cuadrada ($0)'
                      : `${cashDifference > 0 ? 'Sobrante +' : 'Faltante -'}$${Math.abs(cashDifference).toLocaleString('es-AR')}`}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="closing-notes-input" className="pos-label">Observaciones del turno:</label>
              <textarea
                id="closing-notes-input"
                rows="2"
                placeholder="Aclaraciones opcionales sobre el cierre..."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="pos-input"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="pos-btn-secondary flex-1"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={submitting || actualCashCount === ''}
                onClick={handleCloseShift}
                className="pos-btn-danger flex-1"
              >
                <i className="fa-solid fa-lock text-xs" aria-hidden="true"></i>
                <span>Cerrar turno y finalizar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
