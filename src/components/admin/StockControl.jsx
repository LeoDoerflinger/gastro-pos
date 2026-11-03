import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function StockControl() {
  const { ingredients, stockLog, currentUser, showToast, refreshData } = useApp();

  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedIngForAdjust, setSelectedIngForAdjust] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('merma');
  const [adjustReason, setAdjustReason] = useState('');

  const [isNewIngModalOpen, setIsNewIngModalOpen] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('Lácteos');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngStock, setNewIngStock] = useState('10');
  const [newIngMinStock, setNewIngMinStock] = useState('3');
  const [newIngCost, setNewIngCost] = useState('5000');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedIngForAdjust(null);
        setIsNewIngModalOpen(false);
      }
    };
    if (selectedIngForAdjust || isNewIngModalOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [selectedIngForAdjust, isNewIngModalOpen]);

  const categories = ['Todas', ...Array.from(new Set(ingredients.map(i => i.category || 'Almacén')))];

  const filteredIngredients = ingredients.filter(ing => {
    const matchesCat = selectedCategory === 'Todas' || ing.category === selectedCategory;
    const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const lowStockCount = ingredients.filter(i => i.stock <= i.minStock).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + i.stock * (i.costPerUnit || 0), 0);

  const handleOpenAdjust = (ing) => {
    setSelectedIngForAdjust(ing);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustType('merma');
  };

  const handleConfirmAdjust = async () => {
    if (!adjustQty || isNaN(Number(adjustQty))) {
      showToast('Ingresá una cantidad numérica válida', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const delta = adjustType === 'merma' ? -Math.abs(Number(adjustQty)) : Math.abs(Number(adjustQty));
      await api.adjustStock(selectedIngForAdjust.id, {
        quantityChange: delta,
        reason: adjustReason || (adjustType === 'merma' ? 'Merma o desperdicio' : 'Recuento manual'),
        user: currentUser.name,
        type: adjustType === 'merma' ? 'merma' : 'ajuste_manual'
      });

      showToast(`Stock de "${selectedIngForAdjust.name}" actualizado`);
      setSelectedIngForAdjust(null);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo ajustar el stock', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIngredient = async (e) => {
    e.preventDefault();
    if (!newIngName.trim()) {
      showToast('Ingresá el nombre del insumo', 'error');
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
      showToast(`Insumo "${newIngName}" dado de alta`);
      setIsNewIngModalOpen(false);
      setNewIngName('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo crear el insumo', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="stock-control-heading">
      <div className="flex items-center justify-between">
        <h2 id="stock-control-heading" className="font-display font-bold text-base text-[var(--text-primary)]">
          Resumen de depósito e insumos
        </h2>
      </div>
      {/* Unified Summary Strip */}
      <div className="pos-panel grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden">
        <div className="p-4 space-y-0.5">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">Insumos registrados</span>
          <span className="font-display font-extrabold text-2xl font-mono text-[var(--text-primary)]">
            {ingredients.length}
          </span>
        </div>

        <div className="p-4 space-y-0.5">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">Alertas de reposición</span>
          <span
            className={`font-display font-extrabold text-2xl font-mono ${
              lowStockCount > 0 ? 'text-[var(--status-danger-fg)]' : 'text-[var(--status-open-fg)]'
            }`}
          >
            {lowStockCount} {lowStockCount === 1 ? 'crítico' : 'críticos'}
          </span>
        </div>

        <div className="p-4 space-y-0.5">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">Valuación en depósito</span>
          <span className="font-display font-extrabold text-2xl font-mono text-[var(--text-primary)]">
            ${Math.round(totalValuation).toLocaleString('es-AR')}
          </span>
        </div>
      </div>

      {/* Controls & View Switcher */}
      <div className="pb-4 border-b border-[var(--border-subtle)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="pos-segment-group self-start" role="group" aria-label="Vistas de inventario">
            <button
              type="button"
              aria-pressed={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              className="pos-segment-btn"
            >
              <span>Existencias ({ingredients.length})</span>
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
              className="pos-segment-btn"
            >
              <i className="fa-solid fa-clock-rotate-left text-xs" aria-hidden="true"></i>
              <span>Historial ({stockLog.length})</span>
            </button>
          </div>

          {activeTab === 'inventory' && (
            <button
              type="button"
              onClick={() => setIsNewIngModalOpen(true)}
              className="pos-btn-primary self-start sm:self-auto"
            >
              <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
              <span>Nuevo insumo</span>
            </button>
          )}
        </div>

        {activeTab === 'inventory' && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5" role="group" aria-label="Filtrar por rubro">
              {categories.map(cat => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[44px] px-3.5 rounded text-xs font-semibold whitespace-nowrap border transition-colors ${
                      active
                        ? 'bg-[var(--accent-brand-bg)] text-[var(--accent-brand)] border-[var(--accent-brand-border)] font-bold'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 w-full lg:w-72 shrink-0">
              <label htmlFor="stock-search-input" className="text-xs font-semibold text-[var(--text-secondary)] shrink-0 inline-flex items-center gap-1.5">
                <i className="fa-solid fa-magnifying-glass text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
                <span>Buscar:</span>
              </label>
              <input
                id="stock-search-input"
                type="search"
                placeholder="Materia prima..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pos-input flex-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      {activeTab === 'inventory' ? (
        <div className="pos-panel overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-semibold">
                <th className="py-3 px-4">Materia prima</th>
                <th className="py-3 px-4">Rubro</th>
                <th className="py-3 px-4">Disponible</th>
                <th className="py-3 px-4">Mínimo</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Costo u.</th>
                <th className="py-3 px-4 text-right">Valuación</th>
                <th className="py-3 px-4 text-right">Ajuste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    No encontramos insumos para esa búsqueda.
                  </td>
                </tr>
              ) : (
                filteredIngredients.map(ing => {
                  const isCritical = ing.stock <= ing.minStock;
                  const isWarning = !isCritical && ing.stock <= ing.minStock * 1.3;
                  const valuation = ing.stock * (ing.costPerUnit || 0);

                  return (
                    <tr key={ing.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text-primary)]">{ing.name}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {ing.category}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={isCritical ? 'text-[var(--status-danger-fg)]' : 'text-[var(--text-primary)]'}>
                          {ing.stock} {ing.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--text-muted)]">
                        {ing.minStock} {ing.unit}
                      </td>
                      <td className="py-3 px-4">
                        {isCritical ? (
                          <span className="pos-badge pos-badge-danger">Reponer ya</span>
                        ) : isWarning ? (
                          <span className="pos-badge pos-badge-bill">Stock justo</span>
                        ) : (
                          <span className="pos-badge pos-badge-open">Óptimo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[var(--text-secondary)]">
                        ${ing.costPerUnit?.toLocaleString('es-AR')} /{ing.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text-primary)]">
                        ${Math.round(valuation).toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenAdjust(ing)}
                          className="pos-btn-secondary text-xs px-3"
                        >
                          Merma / Ajuste
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pos-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              Trazabilidad de descuentos y cargas
            </h3>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] max-h-[600px] overflow-y-auto">
            {stockLog.map(log => {
              const isDeduction = log.change?.startsWith('-');
              return (
                <div key={log.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[var(--text-primary)]">{log.ingredientName}</span>
                      <span className={`pos-badge ${isDeduction ? 'pos-badge-danger' : 'pos-badge-open'} capitalize`}>
                        {log.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{log.reason}</p>
                    <div className="text-xs text-[var(--text-muted)] font-mono">
                      {new Date(log.timestamp).toLocaleString()} · {log.user}
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span
                      className={`text-base font-bold ${
                        isDeduction ? 'text-[var(--status-danger-fg)]' : 'text-[var(--status-open-fg)]'
                      }`}
                    >
                      {log.change}
                    </span>
                    <div className="text-xs text-[var(--text-muted)]">
                      Saldo: {log.resultingStock}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-stock-title"
        >
          <div className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 id="adjust-stock-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                Ajustar stock: {selectedIngForAdjust.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedIngForAdjust(null)}
                aria-label="Cerrar ventana"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              Existencia actual: <strong className="font-mono text-[var(--text-primary)]">{selectedIngForAdjust.stock} {selectedIngForAdjust.unit}</strong>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={adjustType === 'merma'}
                onClick={() => setAdjustType('merma')}
                className={adjustType === 'merma' ? 'pos-btn-danger' : 'pos-btn-secondary'}
              >
                Merma / Descarte
              </button>
              <button
                type="button"
                aria-pressed={adjustType === 'ingreso'}
                onClick={() => setAdjustType('ingreso')}
                className={adjustType === 'ingreso' ? 'pos-btn-primary' : 'pos-btn-secondary'}
              >
                Ingreso / Recuento
              </button>
            </div>

            <div>
              <label htmlFor="adjust-qty-input" className="pos-label">
                Cantidad ({selectedIngForAdjust.unit}):
              </label>
              <input
                id="adjust-qty-input"
                type="number"
                step="0.01"
                placeholder="0"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="pos-input font-mono font-bold"
              />
            </div>

            <div>
              <label htmlFor="adjust-reason-input" className="pos-label">Motivo:</label>
              <input
                id="adjust-reason-input"
                type="text"
                placeholder="Ej. Masa pasada de fermentación, control físico..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="pos-input"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setSelectedIngForAdjust(null)}
                className="pos-btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmAdjust}
                className="pos-btn-primary flex-1"
              >
                Aplicar ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Ingredient Modal */}
      {isNewIngModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-ing-title"
        >
          <form onSubmit={handleCreateIngredient} className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 id="new-ing-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                Alta de materia prima
              </h3>
              <button
                type="button"
                onClick={() => setIsNewIngModalOpen(false)}
                aria-label="Cerrar ventana"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <div>
              <label htmlFor="new-ing-name" className="pos-label">Nombre del insumo:</label>
              <input
                id="new-ing-name"
                type="text"
                placeholder="Ej. Queso Roquefort"
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                className="pos-input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-ing-cat" className="pos-label">Rubro:</label>
                <select
                  id="new-ing-cat"
                  value={newIngCategory}
                  onChange={(e) => setNewIngCategory(e.target.value)}
                  className="pos-input"
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
                <label htmlFor="new-ing-unit" className="pos-label">Unidad:</label>
                <select
                  id="new-ing-unit"
                  value={newIngUnit}
                  onChange={(e) => setNewIngUnit(e.target.value)}
                  className="pos-input"
                >
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="g">Gramos (g)</option>
                  <option value="l">Litros (l)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="u">Unidades (u)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="new-ing-stock" className="pos-label">Inicial:</label>
                <input
                  id="new-ing-stock"
                  type="number"
                  step="0.01"
                  value={newIngStock}
                  onChange={(e) => setNewIngStock(e.target.value)}
                  className="pos-input font-mono"
                />
              </div>

              <div>
                <label htmlFor="new-ing-min" className="pos-label">Mínimo:</label>
                <input
                  id="new-ing-min"
                  type="number"
                  step="0.01"
                  value={newIngMinStock}
                  onChange={(e) => setNewIngMinStock(e.target.value)}
                  className="pos-input font-mono"
                />
              </div>

              <div>
                <label htmlFor="new-ing-cost" className="pos-label">Costo ($):</label>
                <input
                  id="new-ing-cost"
                  type="number"
                  value={newIngCost}
                  onChange={(e) => setNewIngCost(e.target.value)}
                  className="pos-input font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsNewIngModalOpen(false)}
                className="pos-btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="pos-btn-primary flex-1"
              >
                Guardar insumo
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
