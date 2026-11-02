import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function StockControl() {
  const { ingredients, stockLog, currentUser, showToast, refreshData } = useApp();

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'audit'
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  // Adjust stock modal
  const [selectedIngForAdjust, setSelectedIngForAdjust] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('merma'); // 'merma' | 'ingreso' | 'recuento'
  const [adjustReason, setAdjustReason] = useState('');

  // New Ingredient modal
  const [isNewIngModalOpen, setIsNewIngModalOpen] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('Lácteos');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngStock, setNewIngStock] = useState('10');
  const [newIngMinStock, setNewIngMinStock] = useState('3');
  const [newIngCost, setNewIngCost] = useState('5000');
  const [submitting, setSubmitting] = useState(false);

  const categories = ['Todas', ...Array.from(new Set(ingredients.map(i => i.category || 'Almacén')))];

  const filteredIngredients = ingredients.filter(ing => {
    const matchesCat = selectedCategory === 'Todas' || ing.category === selectedCategory;
    const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // KPI Calculations
  const lowStockCount = ingredients.filter(i => i.stock <= i.minStock).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + (i.stock * (i.costPerUnit || 0)), 0);

  const handleOpenAdjust = (ing) => {
    setSelectedIngForAdjust(ing);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustType('merma');
  };

  const handleConfirmAdjust = async () => {
    if (!adjustQty || isNaN(Number(adjustQty))) {
      showToast('Ingresa una cantidad válida', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const delta = adjustType === 'merma' ? -Math.abs(Number(adjustQty)) : Math.abs(Number(adjustQty));
      await api.adjustStock(selectedIngForAdjust.id, {
        quantityChange: delta,
        reason: adjustReason || (adjustType === 'merma' ? 'Merma o desperdicio' : 'Ajuste manual'),
        user: currentUser.name,
        type: adjustType === 'merma' ? 'merma' : 'ajuste_manual'
      });

      showToast(`Stock de "${selectedIngForAdjust.name}" actualizado`);
      setSelectedIngForAdjust(null);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error ajustando stock', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIngredient = async (e) => {
    e.preventDefault();
    if (!newIngName.trim()) {
      showToast('Ingresa el nombre del insumo', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.createIngredient({
        name: newIngName,
        category: newIngCategory,
        unit: newIngUnit,
        stock: Number(newIngStock || 0),
        minStock: Number(newIngMinStock || 0),
        costPerUnit: Number(newIngCost || 0)
      });
      showToast(`Insumo "${newIngName}" agregado al inventario`);
      setIsNewIngModalOpen(false);
      setNewIngName('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error agregando insumo', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a]">
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">Insumos Controlados</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-mono font-bold text-zinc-100 tabular-nums">{ingredients.length} items</span>
            <i className="fa-solid fa-boxes-stacked text-zinc-400 text-base" aria-hidden="true"></i>
          </div>
        </div>

        <div className={`p-3.5 rounded border ${
          lowStockCount > 0 ? 'bg-[#121215] border-l-2 border-l-rose-500 border-[#27272a]' : 'bg-[#121215] border-[#27272a]'
        }`}>
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">Stock Crítico</span>
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xl font-mono font-bold tabular-nums ${lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {lowStockCount} {lowStockCount === 1 ? 'insumo bajo' : 'insumos bajos'}
            </span>
            <i className={`fa-solid fa-triangle-exclamation text-base ${lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`} aria-hidden="true"></i>
          </div>
        </div>

        <div className="bg-[#121215] p-3.5 rounded border border-[#27272a]">
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">Valuación de Mercadería</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-mono font-bold text-zinc-100 tabular-nums">
              ${Math.round(totalValuation).toLocaleString('es-AR')}
            </span>
            <i className="fa-solid fa-chart-line text-emerald-400 text-base" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      {/* Control Header & Tabs */}
      <div className="bg-[#121215] p-3 rounded border border-[#27272a] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex border border-[#27272a] divide-x divide-[#27272a] rounded-sm overflow-hidden">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                activeTab === 'inventory'
                  ? 'bg-zinc-800 text-zinc-100 font-bold'
                  : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Inventario ({ingredients.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-zinc-800 text-zinc-100 font-bold'
                  : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <i className="fa-solid fa-clock-rotate-left text-xs" aria-hidden="true"></i>
              <span>Auditoría ({stockLog.length})</span>
            </button>
          </div>

          {activeTab === 'inventory' && (
            <button
              onClick={() => setIsNewIngModalOpen(true)}
              className="px-3 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto transition-all"
            >
              <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
              <span>Nuevo Insumo</span>
            </button>
          )}
        </div>

        {/* Filters if in inventory tab */}
        {activeTab === 'inventory' && (
          <div className="pt-2 border-t border-[#27272a] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="inline-flex border border-[#27272a] divide-x divide-[#27272a] rounded-sm overflow-x-auto no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-zinc-800 text-zinc-100 font-bold'
                      : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative min-w-[180px]">
              <i className="fa-solid fa-magnifying-glass text-zinc-500 absolute left-2.5 top-2.5 text-xs" aria-hidden="true"></i>
              <input
                type="text"
                placeholder="Buscar insumo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm pl-7 pr-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {activeTab === 'inventory' ? (
        <div className="bg-[#121215] rounded border border-[#27272a] overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#09090b] border-b border-[#27272a] text-zinc-400 uppercase text-[10px] tracking-wider font-mono font-bold">
                <th className="py-2.5 px-3">Insumo / Materia Prima</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Stock Actual</th>
                <th className="py-2.5 px-3">Stock Mínimo</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                <th className="py-2.5 px-3 text-right">Valuación</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {filteredIngredients.map(ing => {
                const isCritical = ing.stock <= ing.minStock;
                const isWarning = !isCritical && ing.stock <= ing.minStock * 1.3;
                const valuation = ing.stock * (ing.costPerUnit || 0);

                return (
                  <tr key={ing.id} className="hover:bg-[#18181c] transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-zinc-100">{ing.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">ID: {ing.id}</div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 font-mono text-[11px]">
                      {ing.category}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-100 tabular-nums">
                      <span className={isCritical ? 'text-rose-400 font-black' : ''}>
                        {ing.stock}
                      </span>{' '}
                      <span className="text-[11px] text-zinc-400">{ing.unit}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400 tabular-nums">
                      {ing.minStock} {ing.unit}
                    </td>
                    <td className="py-2.5 px-3">
                      {isCritical ? (
                        <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-[#18181c] text-rose-400 border border-rose-500/40 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-xs bg-rose-500" aria-hidden="true"></span>
                          Crítico
                        </span>
                      ) : isWarning ? (
                        <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-[#18181c] text-amber-400 border border-amber-500/40 inline-block">
                          Bajo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-[#18181c] text-emerald-400 border border-emerald-500/40 inline-block">
                          Óptimo
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-300 tabular-nums">
                      ${ing.costPerUnit?.toLocaleString('es-AR')} /{ing.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-100 tabular-nums">
                      ${Math.round(valuation).toLocaleString('es-AR')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleOpenAdjust(ing)}
                        className="px-2 py-1 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-200 text-[11px] font-mono border border-[#27272a] transition-colors"
                      >
                        Ajustar / Merma
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Audit Log Tab */
        <div className="bg-[#121215] rounded border border-[#27272a] overflow-hidden">
          <div className="p-3 border-b border-[#27272a] flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
              Trazabilidad Completa de Movimientos
            </span>
          </div>

          <div className="divide-y divide-[#27272a] max-h-[600px] overflow-y-auto">
            {stockLog.map(log => {
              const isDeduction = log.change?.startsWith('-');
              return (
                <div key={log.id} className="p-3 hover:bg-[#18181c] transition-colors flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">{log.ingredientName}</span>
                      <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-xs border border-[#27272a] ${
                        isDeduction ? 'text-rose-400 bg-[#09090b]' : 'text-emerald-400 bg-[#09090b]'
                      }`}>
                        {log.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{log.reason}</p>
                    <div className="text-[10px] text-zinc-500 font-mono tabular-nums">
                      {new Date(log.timestamp).toLocaleString()} · Por: {log.user}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-mono text-sm font-bold tabular-nums ${isDeduction ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {log.change}
                    </span>
                    <div className="text-[10px] text-zinc-500 font-mono tabular-nums">
                      Quedó: {log.resultingStock}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {selectedIngForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <h3 className="font-mono font-bold text-zinc-100 text-xs uppercase tracking-wider border-b border-[#27272a] pb-2">
              Ajustar Stock: {selectedIngForAdjust.name}
            </h3>

            <p className="text-xs text-zinc-400 font-mono">
              Stock actual: <strong className="text-zinc-100 tabular-nums">{selectedIngForAdjust.stock} {selectedIngForAdjust.unit}</strong>
            </p>

            <div className="grid grid-cols-2 border border-[#27272a] divide-x divide-[#27272a] rounded-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setAdjustType('merma')}
                className={`p-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                  adjustType === 'merma'
                    ? 'bg-zinc-800 text-rose-400 font-bold'
                    : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                - Merma / Pérdida
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('ingreso')}
                className={`p-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                  adjustType === 'ingreso'
                    ? 'bg-zinc-800 text-emerald-400 font-bold'
                    : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                + Ingreso / Ajuste
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">
                Cantidad ({selectedIngForAdjust.unit}):
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 tabular-nums"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Motivo / Explicación:</label>
              <input
                type="text"
                placeholder="Ej: Masa quemada, rotura de envase, recuento"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setSelectedIngForAdjust(null)}
                className="flex-1 py-1.5 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-300 text-xs font-mono border border-[#27272a] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmAdjust}
                className="flex-1 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Ingredient Modal */}
      {isNewIngModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <form onSubmit={handleCreateIngredient} className="bg-[#121215] border border-[#27272a] rounded w-full max-w-md p-4 space-y-3 shadow-2xl">
            <h3 className="font-mono font-bold text-zinc-100 text-xs uppercase tracking-wider border-b border-[#27272a] pb-2">
              Nuevo Insumo / Materia Prima
            </h3>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Nombre del Insumo:</label>
              <input
                type="text"
                placeholder="Ej: Queso Roquefort"
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Categoría:</label>
                <select
                  value={newIngCategory}
                  onChange={(e) => setNewIngCategory(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                >
                  <option value="Lácteos">Lácteos</option>
                  <option value="Panadería">Panadería</option>
                  <option value="Carnicería">Carnicería</option>
                  <option value="Fiambrería">Fiambrería</option>
                  <option value="Conservas">Conservas</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Almacén">Almacén</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Unidad de Medida:</label>
                <select
                  value={newIngUnit}
                  onChange={(e) => setNewIngUnit(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
                >
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="g">Gramos (g)</option>
                  <option value="l">Litros (l)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="u">Unidades (u)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Stock Inicial:</label>
                <input
                  type="number"
                  step="0.01"
                  value={newIngStock}
                  onChange={(e) => setNewIngStock(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs font-mono text-zinc-100 tabular-nums focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Stock Mínimo:</label>
                <input
                  type="number"
                  step="0.01"
                  value={newIngMinStock}
                  onChange={(e) => setNewIngMinStock(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs font-mono text-zinc-100 tabular-nums focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Costo Unit. ($):</label>
                <input
                  type="number"
                  value={newIngCost}
                  onChange={(e) => setNewIngCost(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs font-mono text-zinc-100 tabular-nums focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setIsNewIngModalOpen(false)}
                className="flex-1 py-1.5 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-300 text-xs font-mono border border-[#27272a] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold transition-all"
              >
                Crear Insumo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
