import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function ArqueoCaja() {
  const { activeShift, orders, currentUser, showToast, refreshData } = useApp();

  // State for opening new shift
  const [initialCashInput, setInitialCashInput] = useState('45000');
  
  // State for adding movement
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState('egreso'); // 'ingreso' | 'egreso'
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  // State for blind count / closing shift
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [actualCashCount, setActualCashCount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Calculate sales for active shift
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

  // Movements totals
  const totalIngresos = (activeShift?.movements || [])
    .filter(m => m.type === 'ingreso')
    .reduce((a, m) => a + m.amount, 0);

  const totalEgresos = (activeShift?.movements || [])
    .filter(m => m.type === 'egreso')
    .reduce((a, m) => a + m.amount, 0);

  // Theoretical expected cash
  const expectedCash = activeShift
    ? (activeShift.initialCash || 0) + salesByMethod.efectivo + totalIngresos - totalEgresos
    : 0;

  const countNum = Number(actualCashCount) || 0;
  const cashDifference = actualCashCount !== '' ? countNum - expectedCash : 0;

  // Handlers
  const handleOpenShift = async () => {
    if (!initialCashInput || Number(initialCashInput) < 0) {
      showToast('Ingresa un monto inicial válido', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.openShift({
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        initialCash: Number(initialCashInput)
      });
      showToast('Caja abierta exitosamente');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error al abrir caja', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMovement = async () => {
    if (!movementAmount || Number(movementAmount) <= 0 || !movementReason) {
      showToast('Completa el monto y el motivo del movimiento', 'error');
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
      showToast(`Movimiento de ${movementType.toUpperCase()} registrado`);
      setIsMovementModalOpen(false);
      setMovementAmount('');
      setMovementReason('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error registrando movimiento', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (actualCashCount === '') {
      showToast('Ingresa el monto de efectivo contado en la gaveta', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.closeCashShift(activeShift.id, {
        actualCash: countNum,
        notes: closingNotes,
        closedBy: currentUser.name
      });
      showToast('Turno de caja cerrado y arqueado correctamente');
      setIsClosingModalOpen(false);
      setActualCashCount('');
      setClosingNotes('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error al cerrar caja', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Shift State Header */}
      <div className="bg-[#121215] p-3 rounded border border-[#27272a] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-xs ${activeShift ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden="true"></span>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
              <span>{activeShift ? `Turno de Caja #${activeShift.shiftNumber} (Abierto)` : 'Caja Cerrada'}</span>
            </h2>
          </div>
          {activeShift ? (
            <p className="text-[11px] text-zinc-400 mt-1 font-mono">
              Responsable: <strong className="text-zinc-200">{activeShift.cashierName}</strong> · Apertura: <span className="tabular-nums">{new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500 mt-1">
              No hay ningún turno abierto actualmente en este punto de venta.
            </p>
          )}
        </div>

        {activeShift ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMovementModalOpen(true)}
              className="px-2.5 py-1.5 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-200 text-xs font-mono font-semibold border border-[#27272a] flex items-center gap-1.5 transition-colors"
            >
              <i className="fa-solid fa-plus text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Registrar Movimiento</span>
            </button>

            <button
              onClick={() => setIsClosingModalOpen(true)}
              className="px-2.5 py-1.5 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-mono font-semibold border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              <i className="fa-solid fa-lock text-zinc-300 text-xs" aria-hidden="true"></i>
              <span>Arqueo y Cierre</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-xs text-zinc-500 font-mono">$</span>
              <input
                type="number"
                placeholder="Fondo inicial"
                value={initialCashInput}
                onChange={(e) => setInitialCashInput(e.target.value)}
                className="bg-[#09090b] border border-[#27272a] rounded-sm pl-6 pr-2.5 py-1 text-xs font-mono font-bold text-zinc-100 w-32 focus:outline-none focus:border-zinc-500 tabular-nums"
              />
            </div>
            <button
              disabled={submitting}
              onClick={handleOpenShift}
              className="px-3 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-lock-open text-xs" aria-hidden="true"></i>
              <span>Abrir Turno</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Shift Analytics Grid */}
      {activeShift && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Cash in Drawer Overview */}
          <div className="bg-[#121215] p-3 rounded border border-[#27272a] space-y-2.5">
            <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
              <i className="fa-solid fa-money-bill-wave text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Efectivo en Gaveta</span>
            </h3>

            <div className="space-y-1.5 text-xs font-mono tabular-nums">
              <div className="flex justify-between text-zinc-400 font-sans">
                <span>Fondo Inicial:</span>
                <span className="font-mono text-zinc-200 font-semibold tabular-nums">${(activeShift.initialCash || 0).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-sans">
                <span>+ Ventas Efectivo:</span>
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">+${salesByMethod.efectivo.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-sans">
                <span>+ Ingresos:</span>
                <span className="font-mono text-sky-400 font-semibold tabular-nums">+${totalIngresos.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-sans">
                <span>- Egresos (Gastos):</span>
                <span className="font-mono text-rose-400 font-semibold tabular-nums">-${totalEgresos.toLocaleString('es-AR')}</span>
              </div>

              <div className="pt-2 border-t border-[#27272a] flex justify-between items-center font-sans">
                <span className="font-bold text-zinc-300 text-[11px] uppercase tracking-wider font-mono">Efectivo Esperado:</span>
                <span className="font-mono font-bold text-sm text-zinc-100 tabular-nums">
                  ${expectedCash.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Sales by Payment Method */}
          <div className="bg-[#121215] p-3 rounded border border-[#27272a] space-y-2.5">
            <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
              <i className="fa-solid fa-file-lines text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Ventas del Turno ({closedShiftOrders.length})</span>
            </h3>

            <div className="space-y-1.5 text-xs font-mono tabular-nums">
              <div className="flex justify-between text-zinc-400 font-sans">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-money-bill-wave text-zinc-500 w-3.5 text-center" aria-hidden="true"></i>
                  <span>Efectivo:</span>
                </span>
                <span className="font-mono text-zinc-200 tabular-nums">${salesByMethod.efectivo.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-sans">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-credit-card text-zinc-500 w-3.5 text-center" aria-hidden="true"></i>
                  <span>Tarjeta Débito:</span>
                </span>
                <span className="font-mono text-zinc-200 tabular-nums">${salesByMethod.debito.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-sans">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-credit-card text-zinc-500 w-3.5 text-center" aria-hidden="true"></i>
                  <span>Tarjeta Crédito:</span>
                </span>
                <span className="font-mono text-zinc-200 tabular-nums">${salesByMethod.credito.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-sans">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-qrcode text-zinc-500 w-3.5 text-center" aria-hidden="true"></i>
                  <span>Mercado Pago:</span>
                </span>
                <span className="font-mono text-zinc-200 tabular-nums">${salesByMethod.mercadopago.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-sans">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-building-columns text-zinc-500 w-3.5 text-center" aria-hidden="true"></i>
                  <span>Transferencias:</span>
                </span>
                <span className="font-mono text-zinc-200 tabular-nums">${salesByMethod.transferencia.toLocaleString('es-AR')}</span>
              </div>

              <div className="pt-2 border-t border-[#27272a] flex justify-between items-center font-sans">
                <span className="font-bold text-zinc-300 text-[11px] uppercase tracking-wider font-mono">Total Cobrado:</span>
                <span className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                  ${totalSales.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Shift Movements List */}
          <div className="bg-[#121215] p-3 rounded border border-[#27272a] space-y-2 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
              <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-zinc-400 text-xs" aria-hidden="true"></i>
                <span>Movimientos ({activeShift.movements?.length || 0})</span>
              </h3>
              <button
                onClick={() => setIsMovementModalOpen(true)}
                className="text-[11px] text-zinc-300 hover:text-white font-mono uppercase tracking-wider"
              >
                + Nuevo
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-48 text-xs pr-0.5">
              {(activeShift.movements || []).length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-center py-6 font-mono">Sin egresos ni ingresos registrados</p>
              ) : (
                activeShift.movements.map(mov => (
                  <div key={mov.id} className="p-2 rounded-sm bg-[#09090b] border border-[#27272a] flex items-start justify-between gap-2">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`text-[10px] uppercase font-mono font-bold ${mov.type === 'ingreso' ? 'text-sky-400' : 'text-rose-400'}`}>
                          {mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono tabular-nums">· {new Date(mov.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 truncate mt-0.5">{mov.reason}</p>
                    </div>

                    <span className={`font-mono font-bold shrink-0 tabular-nums ${mov.type === 'ingreso' ? 'text-sky-400' : 'text-rose-400'}`}>
                      {mov.type === 'ingreso' ? '+' : '-'}${mov.amount.toLocaleString('es-AR')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <h3 className="font-mono font-bold text-zinc-100 text-xs uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-arrows-up-down text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Registrar Movimiento de Caja</span>
            </h3>
            
            <div className="grid grid-cols-2 border border-[#27272a] divide-x divide-[#27272a] rounded-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setMovementType('egreso')}
                className={`p-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                  movementType === 'egreso'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Egreso / Gasto
              </button>
              <button
                type="button"
                onClick={() => setMovementType('ingreso')}
                className={`p-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                  movementType === 'ingreso'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Ingreso / Refuerzo
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Monto ($):</label>
              <input
                type="number"
                placeholder="0"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 tabular-nums"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Motivo / Concepto:</label>
              <input
                type="text"
                placeholder="Ej: Compra de insumo menor, propina cadete"
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="flex-1 py-1.5 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-300 text-xs font-mono border border-[#27272a] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleAddMovement}
                className="flex-1 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold transition-all"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blind Count / Close Shift Modal */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-md p-4 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#27272a] pb-2">
              <i className="fa-solid fa-lock text-zinc-300 text-xs" aria-hidden="true"></i>
              <h3 className="font-mono font-bold text-zinc-100 text-xs uppercase tracking-wider">Arqueo Ciego y Cierre de Caja</h3>
            </div>

            <p className="text-xs text-zinc-400">
              Cuenta el efectivo físico total que se encuentra en la gaveta e ingrésalo para cotejar contra el sistema.
            </p>

            <div className="bg-[#09090b] p-3 rounded-sm border border-[#27272a] space-y-1.5">
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block">Efectivo Contado en Gaveta ($):</label>
              <input
                type="number"
                placeholder="0"
                value={actualCashCount}
                onChange={(e) => setActualCashCount(e.target.value)}
                className="w-full bg-[#18181c] border border-[#27272a] rounded-sm p-2 text-sm font-mono font-bold text-zinc-100 focus:outline-none focus:border-zinc-500 tabular-nums"
                autoFocus
              />
            </div>

            {/* Live Difference Result */}
            {actualCashCount !== '' && (
              <div className="p-3 rounded-sm border border-[#27272a] bg-[#09090b] space-y-1 font-mono text-xs tabular-nums">
                <div className="flex justify-between text-zinc-400">
                  <span>Efectivo Esperado:</span>
                  <span className="font-bold text-zinc-200 tabular-nums">${expectedCash.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[#27272a]">
                  <span className="text-zinc-300">Diferencia:</span>
                  <span className={cashDifference === 0 ? 'text-emerald-400' : cashDifference > 0 ? 'text-sky-400' : 'text-rose-400'}>
                    {cashDifference === 0 ? (
                      <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-check text-emerald-400" aria-hidden="true"></i>
                        <span>Caja cuadrada exacta</span>
                      </span>
                    ) : (
                      `${cashDifference > 0 ? '+ Sobrante' : '- Faltante'}: $${Math.abs(cashDifference).toLocaleString('es-AR')}`
                    )}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Observaciones:</label>
              <textarea
                rows="2"
                placeholder="Novedades o aclaraciones del arqueo..."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="flex-1 py-1.5 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-300 text-xs font-mono border border-[#27272a] transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={submitting || actualCashCount === ''}
                onClick={handleCloseShift}
                className="flex-1 py-1.5 rounded-sm bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-colors disabled:opacity-50"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
