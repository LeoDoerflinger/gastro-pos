import React from 'react';
import { useApp } from '../../context/AppContext';

export default function AdminDashboard() {
  const { analytics, orders } = useApp();

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

  return (
    <section className="space-y-5" aria-label="Ventas y analítica">
      {/* Open Page Header */}
      <div className="pb-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
        <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
          Resumen
        </h2>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {activeOrdersCount} abiertas
        </span>
      </div>

      {/* Unified Architectural KPI Ledger Strip */}
      <div className="pos-panel grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden">
        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">Ventas</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-[var(--status-open-fg)]">
            ${totalVentas.toLocaleString('es-AR')}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">Tickets</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-[var(--text-primary)]">
            {totalTickets}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">Promedio</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-[var(--text-primary)]">
            ${ticketPromedio.toLocaleString('es-AR')}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">Mesas</span>
          <div className="font-display font-extrabold text-2xl sm:text-3xl font-mono text-[var(--accent-brand)]">
            {openTablesCount}
          </div>
        </div>
      </div>

      {/* Critical Stock Alert Banner */}
      {lowStockIngredients?.length > 0 && (
        <div className="pos-panel border-l-4 border-l-[var(--status-danger-bar)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--status-danger-fg)]">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>Stock crítico ({lowStockIngredients.length})</span>
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

      {/* Breakdown Panels with Concise Single-Word Titles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Channels */}
        <div className="pos-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2.5">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Canales
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {[
              { id: 'mesa', label: 'Salón', icon: 'fa-utensils', bar: 'bg-[var(--accent-brand)]' },
              { id: 'delivery', label: 'Delivery', icon: 'fa-motorcycle', bar: 'bg-[var(--status-open-bar)]' },
              { id: 'take_away', label: 'Take Away', icon: 'fa-bag-shopping', bar: 'bg-[var(--status-bill-bar)]' },
              { id: 'mostrador', label: 'Mostrador', icon: 'fa-store', bar: 'bg-[var(--border-strong)]' }
            ].map(ch => {
              const amount = byChannel?.[ch.id] || 0;
              const percent = Math.round((amount / totalChannelAmount) * 100);
              return (
                <div key={ch.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[var(--text-primary)]">
                    <span className="flex items-center gap-2 font-medium">
                      <i className={`fa-solid ${ch.icon} text-[var(--text-muted)] w-4 text-center`} aria-hidden="true"></i>
                      <span>{ch.label}</span>
                    </span>
                    <span className="font-mono font-semibold">
                      ${amount.toLocaleString('es-AR')} <span className="text-[var(--text-muted)]">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-subtle)] rounded overflow-hidden">
                    <div className={`h-full ${ch.bar}`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="pos-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2.5">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Pagos
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {[
              { id: 'efectivo', label: 'Efectivo', icon: 'fa-money-bill-wave', bar: 'bg-[var(--status-open-bar)]' },
              { id: 'mercadopago', label: 'Mercado Pago', icon: 'fa-qrcode', bar: 'bg-[var(--accent-brand)]' },
              { id: 'debito', label: 'Débito', icon: 'fa-credit-card', bar: 'bg-[var(--status-bill-bar)]' },
              { id: 'credito', label: 'Crédito', icon: 'fa-credit-card', bar: 'bg-[var(--text-secondary)]' },
              { id: 'transferencia', label: 'Transferencia', icon: 'fa-building-columns', bar: 'bg-[var(--border-strong)]' }
            ].map(pm => {
              const amount = byPaymentMethod?.[pm.id] || 0;
              const percent = Math.round((amount / totalPaymentAmount) * 100);
              return (
                <div key={pm.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[var(--text-primary)]">
                    <span className="flex items-center gap-2 font-medium">
                      <i className={`fa-solid ${pm.icon} text-[var(--text-muted)] w-4 text-center`} aria-hidden="true"></i>
                      <span>{pm.label}</span>
                    </span>
                    <span className="font-mono font-semibold">
                      ${amount.toLocaleString('es-AR')} <span className="text-[var(--text-muted)]">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-subtle)] rounded overflow-hidden">
                    <div className={`h-full ${pm.bar}`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Dishes */}
        <div className="pos-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2.5">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Platos
            </h3>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] text-sm">
            {topProducts?.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-8 text-center">
                Sin ventas cerradas
              </p>
            ) : (
              topProducts.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--accent-brand)] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-[var(--text-primary)] truncate">{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-[var(--text-secondary)] shrink-0">
                    {p.qty} un.
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Closed Sales Ledger Table */}
      <div className="pos-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
          <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
            Cierres
          </h3>
          <span className="text-xs font-mono text-[var(--text-secondary)]">{closedOrders.length}</span>
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
            <tbody className="divide-y divide-[var(--border-subtle)]">
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
                      {ord.waiterName || 'Personal'}
                    </td>
                    <td className="py-3 px-4 capitalize text-xs font-mono text-[var(--text-secondary)]">
                      {ord.paymentMethod || 'Efectivo'}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] text-xs font-mono">
                      {new Date(ord.closedAt || ord.createdAt).toLocaleString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--status-open-fg)]">
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
