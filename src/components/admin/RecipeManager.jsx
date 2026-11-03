import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function RecipeManager() {
  const { products, ingredients, showToast, refreshData } = useApp();

  const [selectedProduct, setSelectedProduct] = useState(products[0] || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Lomitos');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');

  // Subtab de catálogo (platos vs insumos)
  const [catalogView, setCatalogView] = useState('platos'); // 'platos' | 'insumos'

  // Nuevo ingrediente / insumo
  const [isNewIngModalOpen, setIsNewIngModalOpen] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('Carnicería');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngCost, setNewIngCost] = useState('5000');
  const [newIngStock, setNewIngStock] = useState('10');
  const [newIngMin, setNewIngMin] = useState('2');

  useEffect(() => {
    if (!selectedProduct && products.length > 0) {
      setSelectedProduct(products[0]);
    } else if (selectedProduct) {
      const updated = products.find(p => p.id === selectedProduct.id);
      if (updated && !isEditing) setSelectedProduct(updated);
    }
  }, [products, selectedProduct, isEditing]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsNewProductModalOpen(false);
        setIsNewIngModalOpen(false);
      }
    };
    if (isNewProductModalOpen || isNewIngModalOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isNewProductModalOpen, isNewIngModalOpen]);

  const handleCreateIngredient = async (e) => {
    e.preventDefault();
    if (!newIngName.trim()) {
      showToast('Ingresá el nombre del insumo o ingrediente', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.addIngredient({
        name: newIngName.trim(),
        category: newIngCategory,
        unit: newIngUnit,
        costPerUnit: Number(newIngCost) || 0,
        stock: Number(newIngStock) || 0,
        minStock: Number(newIngMin) || 1
      });
      showToast(`Insumo "${created.name}" guardado para recetas y compras de proveedores`);
      await refreshData();
      setIsNewIngModalOpen(false);
      setNewIngName('');
      setNewIngCost('5000');
    } catch (err) {
      showToast(err.message || 'No se pudo crear el insumo', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setIsEditing(false);
    setEditedRecipe(JSON.parse(JSON.stringify(prod.recipe || [])));
  };

  const handleStartEdit = () => {
    setEditedRecipe(JSON.parse(JSON.stringify(selectedProduct.recipe || [])));
    setIsEditing(true);
  };

  const handleAddIngredientRow = () => {
    if (ingredients.length === 0) return;
    setEditedRecipe(prev => [
      ...prev,
      { ingredientId: ingredients[0].id, quantity: 0.1, unit: ingredients[0].unit }
    ]);
  };

  const handleRemoveRow = (index) => {
    setEditedRecipe(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index, field, value) => {
    setEditedRecipe(prev =>
      prev.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          if (field === 'ingredientId') {
            const ing = ingredients.find(x => x.id === value);
            if (ing) updated.unit = ing.unit;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const calculateRecipeCost = (recipeList) =>
    (recipeList || []).reduce((acc, item) => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      if (!ing) return acc;
      return acc + Number(item.quantity || 0) * (ing.costPerUnit || 0);
    }, 0);

  const activeRecipeCost = isEditing
    ? calculateRecipeCost(editedRecipe)
    : calculateRecipeCost(selectedProduct?.recipe);

  const price = selectedProduct?.price || 0;
  const marginGross = price > 0 ? Math.round(((price - activeRecipeCost) / price) * 100) : 0;

  const handleSaveRecipe = async () => {
    setSubmitting(true);
    try {
      const cleanRecipe = editedRecipe.map(r => ({
        ingredientId: r.ingredientId,
        quantity: Number(r.quantity),
        unit: r.unit
      }));

      await api.updateProduct(selectedProduct.id, { recipe: cleanRecipe });
      showToast(`Receta de "${selectedProduct.name}" guardada`);
      setIsEditing(false);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo guardar la receta', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductPrice) {
      showToast('Completá el nombre y el precio de venta', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const badgeIcon =
        newProductCategory === 'Pizzas'
          ? 'fa-solid fa-pizza-slice'
          : newProductCategory === 'Hamburguesas'
          ? 'fa-solid fa-burger'
          : 'fa-solid fa-utensils';
      const created = await api.createProduct({
        name: newProductName,
        category: newProductCategory,
        price: Number(newProductPrice),
        description: newProductDesc,
        badge: badgeIcon,
        recipe: []
      });
      showToast(`Plato "${created.name}" agregado a la carta`);
      setIsNewProductModalOpen(false);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductDesc('');
      await refreshData();
      setSelectedProduct(created);
      setIsEditing(true);
    } catch (err) {
      showToast(err.message || 'No se pudo crear el plato', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5" aria-label="Recetario e ingredientes">
      {/* Open Header */}
      <div className="pb-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            Recetario e ingredientes de cocina
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Definí qué cantidad de cada insumo lleva cada plato para descontar stock automáticamente al comandar.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsNewIngModalOpen(true)}
            className="pos-btn-secondary"
            title="Crear nueva materia prima o insumo para recetas y compras"
          >
            <i className="fa-solid fa-wheat-awn text-xs" aria-hidden="true"></i>
            <span>Nuevo ingrediente</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewProductModalOpen(true)}
            className="pos-btn-primary"
          >
            <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
            <span>Nuevo plato</span>
          </button>
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Menu Dishes List (Native <button> items per R-39) */}
        <div className="lg:col-span-5 pos-panel overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
            <div className="flex rounded border border-[var(--border-strong)] p-0.5 bg-[var(--bg-surface)] text-xs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={catalogView === 'platos'}
                onClick={() => setCatalogView('platos')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  catalogView === 'platos'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Platos ({products.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={catalogView === 'insumos'}
                onClick={() => setCatalogView('insumos')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  catalogView === 'insumos'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Insumos ({ingredients.length})
              </button>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {catalogView === 'platos' ? 'Escandallo' : 'Sincronizado'}
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] overflow-y-auto max-h-[600px]">
            {catalogView === 'insumos' ? (
              ingredients.map(ing => (
                <div key={ing.id} className="p-3 hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">
                      {ing.name}
                    </span>
                    <span className="pos-badge pos-badge-neutral text-[10px] mt-0.5">
                      {ing.category || 'Almacén'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-xs text-[var(--text-primary)] block">
                      ${ing.costPerUnit?.toLocaleString('es-AR')} / {ing.unit}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      Stock: {ing.stock} {ing.unit}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              products.map(prod => {
                const isSelected = selectedProduct?.id === prod.id;
                const prodCost = calculateRecipeCost(prod.recipe);
                const margin = prod.price > 0 ? Math.round(((prod.price - prodCost) / prod.price) * 100) : 0;

                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className={`w-full p-3.5 text-left transition-colors flex flex-col gap-1.5 min-h-[68px] ${
                      isSelected
                        ? 'bg-[var(--bg-elevated)] border-l-4 border-l-[var(--border-strong)]'
                        : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <span className="font-bold text-sm text-[var(--text-primary)] leading-snug">
                        {prod.name}
                      </span>
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)] shrink-0">
                        ${prod.price.toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] w-full font-mono">
                      <span>{prod.recipe?.length || 0} insumos</span>
                      <span className="text-[var(--status-open-fg)]">
                        Costo ${Math.round(prodCost).toLocaleString('es-AR')} · Margen {margin}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Recipe Escandallo Editor */}
        <div className="lg:col-span-7 pos-panel flex flex-col overflow-hidden">
          {selectedProduct ? (
            <div>
              <div className="p-4 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                    {selectedProduct.category}
                  </span>
                  <h3 className="font-display font-bold text-lg text-[var(--text-primary)]">
                    {selectedProduct.name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="pos-btn-primary text-xs"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs" aria-hidden="true"></i>
                      <span>Editar receta</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="pos-btn-secondary text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleSaveRecipe}
                        className="pos-btn-primary text-xs"
                      >
                        <i className="fa-solid fa-floppy-disk text-xs" aria-hidden="true"></i>
                        <span>Guardar receta</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Financial Strip */}
              <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-b border-[var(--border-subtle)] text-center bg-[var(--bg-surface)]">
                <div className="p-3.5">
                  <span className="text-xs text-[var(--text-secondary)] block">Precio en carta</span>
                  <span className="font-bold text-base font-mono text-[var(--text-primary)]">
                    ${selectedProduct.price?.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="p-3.5">
                  <span className="text-xs text-[var(--text-secondary)] block">Costo receta</span>
                  <span className="font-bold text-base font-mono text-[var(--text-primary)]">
                    ${Math.round(activeRecipeCost).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="p-3.5">
                  <span className="text-xs text-[var(--text-secondary)] block">Margen bruto</span>
                  <span className="font-bold text-base font-mono text-[var(--status-open-fg)]">
                    {marginGross}%
                  </span>
                </div>
              </div>

              {/* Recipe Rows */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Insumos descontados por unidad ({isEditing ? editedRecipe.length : (selectedProduct.recipe?.length || 0)})
                  </h4>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleAddIngredientRow}
                      className="pos-btn-secondary text-xs"
                    >
                      <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
                      <span>Sumar insumo</span>
                    </button>
                  )}
                </div>

                {(isEditing ? editedRecipe : (selectedProduct.recipe || [])).length === 0 ? (
                  <div className="pos-subpanel p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Este plato todavía no tiene insumos asociados
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Tocá "Editar receta" para vincular materias primas y calcular su costo real.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded overflow-hidden">
                    {(isEditing ? editedRecipe : selectedProduct.recipe).map((item, idx) => {
                      const ing = ingredients.find(i => i.id === item.ingredientId);
                      const unitCost = ing?.costPerUnit || 0;
                      const itemTotalCost = Number(item.quantity || 0) * unitCost;

                      if (isEditing) {
                        return (
                          <div key={idx} className="p-3 bg-[var(--bg-subtle)] flex flex-col sm:flex-row sm:items-center gap-2.5">
                            <div className="flex-1">
                              <label htmlFor={`rec-ing-${idx}`} className="pos-label">Insumo:</label>
                              <select
                                id={`rec-ing-${idx}`}
                                value={item.ingredientId}
                                onChange={(e) => handleRowChange(idx, 'ingredientId', e.target.value)}
                                className="pos-input bg-[var(--bg-surface)]"
                              >
                                {ingredients.map(i => (
                                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                ))}
                              </select>
                            </div>

                            <div className="w-full sm:w-40">
                              <label htmlFor={`rec-qty-${idx}`} className="pos-label">Cantidad ({item.unit || ing?.unit}):</label>
                              <input
                                id={`rec-qty-${idx}`}
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={item.quantity}
                                onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                                className="pos-input bg-[var(--bg-surface)] font-mono text-center"
                              />
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 sm:w-32">
                              <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                                ${Math.round(itemTotalCost).toLocaleString('es-AR')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                className="pos-btn-ghost text-[var(--text-muted)] hover:text-[var(--status-danger-fg)]"
                                aria-label="Quitar insumo"
                              >
                                <i className="fa-solid fa-trash-can text-sm" aria-hidden="true"></i>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="px-4 py-3 bg-[var(--bg-surface)] flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-sm text-[var(--text-primary)]">
                              {ing?.name || 'Insumo'}
                            </div>
                            <span className="text-xs text-[var(--text-muted)] font-mono">
                              Disponible en depósito: {ing?.stock} {ing?.unit}
                            </span>
                          </div>

                          <div className="text-right font-mono">
                            <div className="text-sm font-bold text-[var(--text-primary)]">
                              -{item.quantity} {item.unit}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                              ${Math.round(itemTotalCost).toLocaleString('es-AR')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Elegí un plato de la columna izquierda para revisar su receta
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Dish Modal */}
      {isNewProductModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-dish-modal-title"
        >
          <form onSubmit={handleCreateProduct} className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 id="new-dish-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                Sumar nuevo plato a la carta
              </h3>
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                aria-label="Cerrar ventana"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <div>
              <label htmlFor="new-dish-name" className="pos-label">Nombre del plato:</label>
              <input
                id="new-dish-name"
                type="text"
                placeholder="Ej. Pizza Fugazzeta Rellena"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="pos-input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-dish-cat" className="pos-label">Categoría:</label>
                <select
                  id="new-dish-cat"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  className="pos-input"
                >
                  <option value="Lomitos">Lomitos</option>
                  <option value="Pizzas">Pizzas</option>
                  <option value="Hamburguesas">Hamburguesas</option>
                  <option value="Minutas & Entradas">Minutas y Entradas</option>
                  <option value="Pastas">Pastas</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Postres">Postres</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-dish-price" className="pos-label">Precio de venta ($):</label>
                <input
                  id="new-dish-price"
                  type="number"
                  placeholder="0"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="pos-input font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-dish-notes" className="pos-label">Nota interna de producción:</label>
              <textarea
                id="new-dish-notes"
                rows="2"
                placeholder="Opcional para ficha técnica de cocina..."
                value={newProductDesc}
                onChange={(e) => setNewProductDesc(e.target.value)}
                className="pos-input"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="pos-btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="pos-btn-primary flex-1"
              >
                Crear plato
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal: Crear Insumo / Materia Prima */}
      {isNewIngModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-ing-modal-title"
        >
          <div className="pos-panel w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-wheat-awn text-[var(--accent-brand)] text-sm" aria-hidden="true"></i>
                <h3 id="new-ing-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                  Nuevo insumo / materia prima
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewIngModalOpen(false)}
                className="pos-btn-ghost"
                aria-label="Cerrar ventana"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleCreateIngredient} className="p-4 space-y-3.5">
              <div>
                <label htmlFor="new-ing-name-field" className="pos-label">Nombre del insumo / producto *</label>
                <input
                  id="new-ing-name-field"
                  type="text"
                  required
                  placeholder="Ej. Bife de Lomo Vacuno, Pan de Lomito..."
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="pos-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-ing-cat-field" className="pos-label">Rubro / Categoría:</label>
                  <select
                    id="new-ing-cat-field"
                    value={newIngCategory}
                    onChange={(e) => setNewIngCategory(e.target.value)}
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

                <div>
                  <label htmlFor="new-ing-unit-field" className="pos-label">Unidad de medida:</label>
                  <select
                    id="new-ing-unit-field"
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value)}
                    className="pos-input text-xs"
                  >
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="u">Unidades (u)</option>
                    <option value="l">Litros (l)</option>
                    <option value="ml">Mililitros (ml)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="new-ing-cost-field" className="pos-label">Costo unitario ($):</label>
                  <input
                    id="new-ing-cost-field"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newIngCost}
                    onChange={(e) => setNewIngCost(e.target.value)}
                    className="pos-input font-mono text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="new-ing-stock-field" className="pos-label">Stock inicial:</label>
                  <input
                    id="new-ing-stock-field"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={newIngStock}
                    onChange={(e) => setNewIngStock(e.target.value)}
                    className="pos-input font-mono text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="new-ing-min-field" className="pos-label">Stock mín. alerta:</label>
                  <input
                    id="new-ing-min-field"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1"
                    value={newIngMin}
                    onChange={(e) => setNewIngMin(e.target.value)}
                    className="pos-input font-mono text-xs"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] p-2 rounded border border-[var(--border-subtle)]">
                Este insumo quedará registrado en la base de datos y estará disponible inmediatamente tanto para el recetario como para las compras y remitos de proveedores.
              </p>

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
                  {submitting ? 'Guardando...' : 'Guardar insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
