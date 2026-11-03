import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatUserRoleDisplay } from '../../utils/userRoleHelper';

export default function AdminDashboard() {
  const { analytics, orders, users } = useApp();

  if (!analytics) return null;

  const {
    totalVentas,
    totalTickets,
    ticketPromedio,
    byChannel,
    byPaymentMethod,
    topProducts,
    lowStockIngredients,
    activeOrdersCount,
    openTablesCount
  } = analytics;

  const totalChannelAmount = Object.values(byChannel || {}).reduce((a, b) => a + b, 0) || 1;
  const totalPaymentAmount = Object.values(byPaymentMethod || {}).reduce((a, b) => a + b, 0) || 1;
  const closedOrders = orders.filter(o => o.status === 'cobrado');
  const maxProductQty = Math.max(1, ...(topProducts || []).map(p => p.qty || 0));

  const getPaymentBadgeClass = (method) => {
    switch (method?.toLowerCase()) {
      case 'efectivo':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
      case 'mercadopago':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/25';
      case 'debito':
      case 'credito':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
      case 'transferencia':
        return 'text-violet-400 bg-violet-500/10 border-violet-500/25';
      default:
        return 'text-[var(--text-secondary)] bg-[var(--bg-subtle)] border-[var(--border-subtle)]';
    }
  };

  return (
    <section className="space-y-5" aria-label="Ventas y analítica">
      {/* Page Header */}
      <div className="pb-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            Ventas y analítica
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Métricas de facturación, canales de despacho y rendimiento del turno en tiempo real.
          </p>
        </div>
        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
          {activeOrdersCount} comandas en curso
        </span>
      </div>

      {/* Vibrant High-Contrast KPI Ledger Strip */}
      <div className="pos-panel grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden">
        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-bold text-[var(--text-secondary)] tracking-wider uppercase block">Facturación</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-emerald-500">
            ${totalVentas.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Ventas totales cerradas</span>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-bold text-[var(--text-secondary)] tracking-wider uppercase block">Tickets</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-cyan-500">
            {totalTickets}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Comprobantes cobrados</span>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-bold text-[var(--text-secondary)] tracking-wider uppercase block">Ticket Promedio</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-amber-500">
            ${ticketPromedio.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Promedio por comensal / orden</span>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-bold text-[var(--text-secondary)] tracking-wider uppercase block">Mesas Abiertas</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-violet-500">
            {openTablesCount}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Ocupación activa en salón</span>
        </div>
      </div>

      {/* Critical Stock Alert Banner */}
      {lowStockIngredients?.length > 0 && (
        <div className="pos-panel border-l-4 border-l-[var(--status-danger-bar)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--status-danger-fg)]">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>Insumos bajo mínimo ({lowStockIngredients.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockIngredients.map(ing => (
              <div
                key={ing.id}
                className="pos-subpanel px-3 py-2 flex justify-between items-center text-xs"
              >
                <span className="font-semibold text-[var(--text-primary)]">{ing.name}</span>
                <span className="font-mono font-bold text-[var(--status-danger-fg)]">
                  {ing.stock} {ing.unit} (mín. {ing.minStock})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown Panels with Vibrant Colors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Channels */}
        <div className="pos-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2.5 flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Canales
            </h3>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              ${totalChannelAmount.toLocaleString('es-AR')}
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            {[
              { id: 'mesa', label: 'Salón', icon: 'fa-utensils', bar: 'bg-cyan-500', text: 'text-cyan-400' },
              { id: 'delivery', label: 'Delivery', icon: 'fa-motorcycle', bar: 'bg-emerald-500', text: 'text-emerald-400' },
              { id: 'take_away', label: 'Take Away', icon: 'fa-bag-shopping', bar: 'bg-amber-500', text: 'text-amber-400' },
              { id: 'mostrador', label: 'Mostrador', icon: 'fa-store', bar: 'bg-violet-500', text: 'text-violet-400' }
            ].map(ch => {
              const amount = byChannel?.[ch.id] || 0;
              const percent = Math.round((amount / totalChannelAmount) * 100);
              return (
                <div key={ch.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[var(--text-primary)]">
                    <span className="flex items-center gap-2 font-medium">
                      <i className={`fa-solid ${ch.icon} ${ch.text} w-4 text-center`} aria-hidden="true"></i>
                      <span>{ch.label}</span>
                    </span>
                    <span className="font-mono font-semibold">
                      ${amount.toLocaleString('es-AR')} <strong className={ch.text}>({percent}%)</strong>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-subtle)] rounded overflow-hidden">
                    <div className={`h-full ${ch.bar} transition-all duration-300`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="pos-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2.5 flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Pagos
            </h3>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              ${totalPaymentAmount.toLocaleString('es-AR')}
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            {[
              { id: 'efectivo', label: 'Efectivo', icon: 'fa-money-bill-wave', bar: 'bg-emerald-500', text: 'text-emerald-400' },
              { id: 'mercadopago', label: 'Mercado Pago', icon: 'fa-qrcode', bar: 'bg-sky-500', text: 'text-sky-400' },
              { id: 'debito', label: 'Débito', icon: 'fa-credit-card', bar: 'bg-amber-500', text: 'text-amber-400' },
              { id: 'credito', label: 'Crédito', icon: 'fa-credit-card', bar: 'bg-rose-500', text: 'text-rose-400' },
              { id: 'transferencia', label: 'Transferencia', icon: 'fa-building-columns', bar: 'bg-violet-500', text: 'text-violet-400' }
            ].map(pm => {
              const amount = byPaymentMethod?.[pm.id] || 0;
              const percent = Math.round((amount / totalPaymentAmount) * 100);
              return (
                <div key={pm.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[var(--text-primary)]">
                    <span className="flex items-center gap-2 font-medium">
                      <i className={`fa-solid ${pm.icon} ${pm.text} w-4 text-center`} aria-hidden="true"></i>
                      <span>{pm.label}</span>
                    </span>
                    <span className="font-mono font-semibold">
                      ${amount.toLocaleString('es-AR')} <strong className={pm.text}>({percent}%)</strong>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-subtle)] rounded overflow-hidden">
                    <div className={`h-full ${pm.bar} transition-all duration-300`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Dishes */}
        <div className="pos-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2.5 flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Platos
            </h3>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              Ranking de unidades
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] text-sm">
            {topProducts?.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-8 text-center">
                Sin ventas cerradas
              </p>
            ) : (
              topProducts.map((p, idx) => {
                const relPct = Math.round((p.qty / maxProductQty) * 100);
                const badgeStyle =
                  idx === 0
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : idx === 1
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : idx === 2
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]';

                return (
                  <div key={idx} className="py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded font-mono font-bold text-xs flex items-center justify-center shrink-0 ${badgeStyle}`}>
                          {idx + 1}
                        </span>
                        <span className="font-medium text-[var(--text-primary)] truncate text-xs sm:text-sm">{p.name}</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-[var(--text-primary)] shrink-0">
                        {p.qty} un.
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-subtle)] rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${
                          idx === 0
                            ? 'bg-amber-500'
                            : idx === 1
                            ? 'bg-cyan-500'
                            : idx === 2
                            ? 'bg-orange-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${relPct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Closed Sales Ledger Table */}
      <div className="pos-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
          <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
            Cierres de venta
          </h3>
          <span className="text-xs font-mono font-semibold text-[var(--text-secondary)]">
            {closedOrders.length} tickets registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-semibold">
                <th className="py-3 px-4">Comanda</th>
                <th className="py-3 px-4">Canal</th>
                <th className="py-3 px-4">Atendió</th>
                <th className="py-3 px-4">Medio de pago</th>
                <th className="py-3 px-4">Hora cierre</th>
                <th className="py-3 px-4 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs sm:text-sm">
              {closedOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    Todavía no se cerraron ventas en este turno.
                  </td>
                </tr>
              ) : (
                closedOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text-primary)] font-mono">
                      #{ord.orderNumber} {ord.tableNumber ? `(Mesa ${ord.tableNumber})` : ''}
                    </td>
                    <td className="py-3 px-4 capitalize text-xs font-semibold text-[var(--text-secondary)]">
                      {ord.channel?.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-primary)]">
                      {formatUserRoleDisplay(ord.waiterName || 'Personal', 'mozo', users)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${getPaymentBadgeClass(ord.paymentMethod)}`}>
                        {ord.paymentMethod || 'Efectivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] text-xs font-mono">
                      {new Date(ord.closedAt || ord.createdAt).toLocaleString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-500">
                      ${ord.total?.toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
