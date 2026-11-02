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

  // Closed orders list for history table
  const closedOrders = orders.filter(o => o.status === 'cobrado');

  return (
    <div className="space-y-3">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a]">
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">Facturación Total</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400 tabular-nums">
              ${totalVentas.toLocaleString('es-AR')}
            </span>
            <i className="fa-solid fa-dollar-sign text-emerald-400 text-base" aria-hidden="true"></i>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono">Acumulado del turno actual</p>
        </div>

        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a]">
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">Tickets Cobrados</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-100 tabular-nums">
              {totalTickets}
            </span>
            <i className="fa-solid fa-receipt text-zinc-400 text-base" aria-hidden="true"></i>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono tabular-nums">{activeOrdersCount} pedidos activos</p>
        </div>

        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a]">
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">Ticket Promedio</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-100 tabular-nums">
              ${ticketPromedio.toLocaleString('es-AR')}
            </span>
            <i className="fa-solid fa-chart-line text-zinc-400 text-base" aria-hidden="true"></i>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono">Por mesa / comanda</p>
        </div>

        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a]">
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">Ocupación Salón</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-100 tabular-nums">
              {openTablesCount} mesas
            </span>
            <i className="fa-solid fa-chair text-zinc-400 text-base" aria-hidden="true"></i>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono">Con comandas abiertas</p>
        </div>
      </div>

      {/* Middle Grid: Channels, Payment Methods, and Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Sales by Channel */}
        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a] space-y-3">
          <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
            <i className="fa-solid fa-network-wired text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Ventas por Canal</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            {[
              { id: 'mesa', label: 'Salón / Mesas', icon: 'fa-utensils', color: 'bg-zinc-300' },
              { id: 'delivery', label: 'Delivery', icon: 'fa-motorcycle', color: 'bg-zinc-400' },
              { id: 'take_away', label: 'Take Away', icon: 'fa-bag-shopping', color: 'bg-zinc-500' },
              { id: 'mostrador', label: 'Mostrador', icon: 'fa-store', color: 'bg-zinc-600' }
            ].map(ch => {
              const amount = byChannel?.[ch.id] || 0;
              const percent = Math.round((amount / totalChannelAmount) * 100);
              return (
                <div key={ch.id} className="space-y-1">
                  <div className="flex justify-between text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <i className={`fa-solid ${ch.icon} text-zinc-400 w-3.5 text-center`} aria-hidden="true"></i>
                      <span>{ch.label}</span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-zinc-200">
                      ${amount.toLocaleString('es-AR')} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#18181c] rounded-xs overflow-hidden">
                    <div className={`h-full ${ch.color}`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales by Payment Method */}
        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a] space-y-3">
          <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
            <i className="fa-solid fa-credit-card text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Medios de Pago</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            {[
              { id: 'efectivo', label: 'Efectivo', icon: 'fa-money-bill-wave', color: 'bg-emerald-500' },
              { id: 'mercadopago', label: 'Mercado Pago / QR', icon: 'fa-qrcode', color: 'bg-sky-500' },
              { id: 'debito', label: 'Tarjeta Débito', icon: 'fa-credit-card', color: 'bg-blue-500' },
              { id: 'credito', label: 'Tarjeta Crédito', icon: 'fa-credit-card', color: 'bg-indigo-500' },
              { id: 'transferencia', label: 'Transferencia', icon: 'fa-building-columns', color: 'bg-amber-500' }
            ].map(pm => {
              const amount = byPaymentMethod?.[pm.id] || 0;
              const percent = Math.round((amount / totalPaymentAmount) * 100);
              return (
                <div key={pm.id} className="space-y-1">
                  <div className="flex justify-between text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <i className={`fa-solid ${pm.icon} text-zinc-400 w-3.5 text-center`} aria-hidden="true"></i>
                      <span>{pm.label}</span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-zinc-200">
                      ${amount.toLocaleString('es-AR')} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#18181c] rounded-xs overflow-hidden">
                    <div className={`h-full ${pm.color}`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Dishes Ranking */}
        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a] space-y-3">
          <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
            <i className="fa-solid fa-trophy text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Ranking de Platos Vendidos</span>
          </h3>

          <div className="space-y-1.5 text-xs font-mono">
            {topProducts?.length === 0 ? (
              <p className="text-zinc-500 italic py-6 text-center">Sin platos vendidos todavía</p>
            ) : (
              topProducts.map((p, idx) => (
                <div key={idx} className="p-2 rounded-sm bg-[#09090b] border border-[#27272a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-xs bg-[#18181c] border border-[#27272a] text-zinc-400 font-mono font-bold text-[10px] flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-zinc-200 truncate max-w-[140px] font-sans">{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-zinc-300 tabular-nums">{p.qty} un</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Critical Stock Alerts Banner if any */}
      {lowStockIngredients?.length > 0 && (
        <div className="bg-[#121215] border-l-2 border-l-rose-500 border border-[#27272a] p-3 rounded space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-xs uppercase tracking-wider">
            <i className="fa-solid fa-triangle-exclamation text-xs" aria-hidden="true"></i>
            <span>Insumos por debajo del stock mínimo ({lowStockIngredients.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {lowStockIngredients.map(ing => (
              <div key={ing.id} className="p-2 rounded-sm bg-[#09090b] border border-[#27272a] flex justify-between items-center font-mono">
                <span className="text-zinc-300 font-sans text-xs">{ing.name}</span>
                <span className="font-mono font-bold text-rose-400 tabular-nums text-xs">
                  {ing.stock} {ing.unit} (Mín: {ing.minStock})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales History Table */}
      <div className="bg-[#121215] rounded border border-[#27272a] overflow-hidden">
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Últimas Ventas Cerradas</span>
          </h3>
          <span className="text-[11px] font-mono text-zinc-500 tabular-nums">Total: {closedOrders.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#09090b] border-b border-[#27272a] text-zinc-400 uppercase text-[10px] tracking-wider font-mono font-bold">
                <th className="py-2 px-3">Comanda</th>
                <th className="py-2 px-3">Canal</th>
                <th className="py-2 px-3">Mozo / Personal</th>
                <th className="py-2 px-3">Medio de Pago</th>
                <th className="py-2 px-3">Fecha y Hora</th>
                <th className="py-2 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {closedOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-zinc-500 font-mono">No hay ventas cerradas aún en el turno</td>
                </tr>
              ) : (
                closedOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-[#18181c] transition-colors">
                    <td className="py-2 px-3 font-bold text-zinc-200 font-mono tabular-nums">
                      #{ord.orderNumber} {ord.tableNumber ? `(Mesa ${ord.tableNumber})` : ''}
                    </td>
                    <td className="py-2 px-3 uppercase text-[10px] text-zinc-400 font-mono font-bold">
                      {ord.channel}
                    </td>
                    <td className="py-2 px-3 text-zinc-300">
                      {ord.waiterName || 'Personal'}
                    </td>
                    <td className="py-2 px-3 uppercase text-[10px] text-zinc-300 font-mono">
                      {ord.paymentMethod || 'Efectivo'}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 text-[11px] font-mono tabular-nums">
                      {new Date(ord.closedAt || ord.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400 tabular-nums">
                      ${ord.total?.toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
