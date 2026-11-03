import React from 'react';
import { useApp } from '../../context/AppContext';

export default function ShiftBalanceModal() {
  const { lastClosedShiftReport, setLastClosedShiftReport } = useApp();

  if (!lastClosedShiftReport) return null;

  const s = lastClosedShiftReport;
  const salesByMethod = s.salesByMethod || {
    efectivo: s.cashSales || 0,
    debito: 0,
    credito: 0,
    mercadopago: 0,
    transferencia: 0
  };
  const totalSales =
    s.totalSales !== undefined
      ? s.totalSales
      : Object.values(salesByMethod).reduce((a, b) => a + b, 0);

  const movements = Array.isArray(s.movements) ? s.movements : [];
  const totalIngresos =
    s.totalIngresos !== undefined
      ? s.totalIngresos
      : movements.filter(m => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
  const totalEgresos =
    s.totalEgresos !== undefined
      ? s.totalEgresos
      : movements.filter(m => m.type === 'egreso').reduce((a, m) => a + m.amount, 0);

  const expectedCash =
    s.expectedCash !== undefined
      ? s.expectedCash
      : (s.initialCash || 0) + (salesByMethod.efectivo || 0) + totalIngresos - totalEgresos;

  const actualCash = Number(s.actualCash) || 0;
  const diff = s.difference !== undefined ? s.difference : actualCash - expectedCash;

  const openedDate =
    s.openedDate ||
    (s.openedAt ? new Date(s.openedAt).toLocaleDateString('es-AR') : '');
  const openedTime =
    s.openedTime ||
    (s.openedAt
      ? new Date(s.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '');

  const closedDate =
    s.closedDate ||
    (s.closedAt ? new Date(s.closedAt).toLocaleDateString('es-AR') : '');
  const closedTime =
    s.closedTime ||
    (s.closedAt
      ? new Date(s.closedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-balance-title"
    >
      <div className="pos-panel w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3.5 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded bg-[var(--accent-brand-bg)] border border-[var(--accent-brand-border)] text-[var(--accent-brand)] flex items-center justify-center text-sm shrink-0">
              <i className="fa-solid fa-file-invoice-dollar" aria-hidden="true"></i>
            </span>
            <div>
              <h2 id="shift-balance-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                Balance detallado de arqueo y cierre de turno
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Sesión finalizada · Operador: <strong>{s.closedBy || s.cashierName || 'Cajero'}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLastClosedShiftReport(null)}
            aria-label="Cerrar balance del turno"
            className="pos-btn-ghost"
          >
            <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Discriminated Dates & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="pos-subpanel p-3 space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Inicio de turno
              </span>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--text-muted)]">Fecha:</span>
                <strong className="text-[var(--text-primary)]">{openedDate}</strong>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--text-muted)]">Hora:</span>
                <strong className="text-[var(--text-primary)]">{openedTime} hs</strong>
              </div>
            </div>

            <div className="pos-subpanel p-3 space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Cierre de turno
              </span>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--text-muted)]">Fecha:</span>
                <strong className="text-[var(--text-primary)]">{closedDate}</strong>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--text-muted)]">Hora:</span>
                <strong className="text-[var(--text-primary)]">{closedTime} hs</strong>
              </div>
            </div>
          </div>

          {/* Physical Cash Reconciliation */}
          <div className="pos-panel p-4 space-y-2.5">
            <h3 className="font-display font-bold text-sm text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
              Conciliación de efectivo en gaveta
            </h3>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Fondo inicial de apertura</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  ${(s.initialCash || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Cobros en efectivo del turno</span>
                <span className="font-mono font-semibold text-[var(--status-open-fg)]">
                  +${(salesByMethod.efectivo || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Ingresos manuales ({movements.filter(m => m.type === 'ingreso').length})</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  +${totalIngresos.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Retiros y gastos en efectivo ({movements.filter(m => m.type === 'egreso').length})</span>
                <span className="font-mono font-semibold text-[var(--status-danger-fg)]">
                  -${totalEgresos.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="pos-subpanel p-2.5">
                <span className="text-xs text-[var(--text-muted)] block">Efectivo esperado</span>
                <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                  ${expectedCash.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="pos-subpanel p-2.5">
                <span className="text-xs text-[var(--text-muted)] block">Efectivo contado</span>
                <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                  ${actualCash.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="pos-subpanel p-2.5">
                <span className="text-xs text-[var(--text-muted)] block">Resultado arqueo</span>
                <span
                  className={`font-mono font-bold text-base ${
                    diff === 0
                      ? 'text-[var(--status-open-fg)]'
                      : diff > 0
                      ? 'text-[var(--accent-brand)]'
                      : 'text-[var(--status-danger-fg)]'
                  }`}
                >
                  {diff === 0
                    ? 'Cuadrada ($0)'
                    : `${diff > 0 ? '+' : '-'}$${Math.abs(diff).toLocaleString('es-AR')}`}
                </span>
              </div>
            </div>
          </div>

          {/* Sales Breakdown by Payment Method */}
          <div className="pos-panel p-4 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                Facturación por medio de cobro
              </h3>
              <span className="font-mono font-bold text-sm text-[var(--status-open-fg)]">
                Total: ${totalSales.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                { key: 'efectivo', label: 'Efectivo' },
                { key: 'debito', label: 'Débito' },
                { key: 'credito', label: 'Crédito' },
                { key: 'mercadopago', label: 'QR / MP' },
                { key: 'transferencia', label: 'Transferencia' }
              ].map(m => (
                <div key={m.key} className="pos-subpanel px-3 py-2 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{m.label}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    ${(salesByMethod[m.key] || 0).toLocaleString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Cash Movements List */}
          <div className="pos-panel p-4 space-y-2">
            <h3 className="font-display font-bold text-sm text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
              Detalle de movimientos del turno ({movements.length})
            </h3>
            {movements.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                No se registraron ingresos ni egresos manuales durante este turno.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] max-h-40 overflow-y-auto">
                {movements.map(mov => (
                  <div key={mov.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`pos-badge ${mov.type === 'ingreso' ? 'pos-badge-open' : 'pos-badge-danger'}`}>
                        {mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </span>
                      <span className="text-[var(--text-primary)] truncate">{mov.reason}</span>
                      <span className="text-[var(--text-muted)] font-mono shrink-0">({mov.user})</span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        mov.type === 'ingreso' ? 'text-[var(--status-open-fg)]' : 'text-[var(--status-danger-fg)]'
                      }`}
                    >
                      {mov.type === 'ingreso' ? '+' : '-'}${mov.amount.toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {s.notes && (
            <div className="pos-subpanel p-3 text-xs text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Observaciones:</strong> {s.notes}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="pos-btn-secondary text-xs"
          >
            <i className="fa-solid fa-print text-xs" aria-hidden="true"></i>
            <span>Imprimir balance</span>
          </button>
          <button
            type="button"
            onClick={() => setLastClosedShiftReport(null)}
            className="pos-btn-primary text-xs"
          >
            <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
            <span>Entendido y cerrar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
