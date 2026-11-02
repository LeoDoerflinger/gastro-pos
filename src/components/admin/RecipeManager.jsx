import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function RecipeManager() {
  const { products, ingredients, currentUser, showToast, refreshData } = useApp();

  const [selectedProduct, setSelectedProduct] = useState(products[0] || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // New product modal state
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Pizzas');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');

  // When selecting a product to edit
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
    setEditedRecipe(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        if (field === 'ingredientId') {
          const ing = ingredients.find(ing => ing.id === value);
          if (ing) updated.unit = ing.unit;
        }
        return updated;
      }
      return item;
    }));
  };

  // Cost calculations
  const calculateRecipeCost = (recipeList) => {
    return (recipeList || []).reduce((acc, item) => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      if (!ing) return acc;
      return acc + (Number(item.quantity || 0) * (ing.costPerUnit || 0));
    }, 0);
  };

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

      await api.updateProduct(selectedProduct.id, {
        recipe: cleanRecipe
      });

      showToast(`Receta de "${selectedProduct.name}" actualizada con éxito`);
      setIsEditing(false);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error guardando receta', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductPrice) {
      showToast('Completa el nombre y precio del producto', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const badgeIcon = newProductCategory === 'Pizzas' ? 'fa-solid fa-pizza-slice' : newProductCategory === 'Hamburguesas' ? 'fa-solid fa-burger' : 'fa-solid fa-utensils';
      const created = await api.createProduct({
        name: newProductName,
        category: newProductCategory,
        price: Number(newProductPrice),
        description: newProductDesc,
        badge: badgeIcon,
        recipe: []
      });
      showToast(`Producto "${created.name}" creado correctamente`);
      setIsNewProductModalOpen(false);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductDesc('');
      await refreshData();
      setSelectedProduct(created);
      setIsEditing(true);
    } catch (err) {
      showToast(err.message || 'Error creando producto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-[#121215] p-3 rounded border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <i className="fa-solid fa-book text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Recetario & Escandallos de Producción</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-1 font-mono">
            Vincula insumos a cada plato. El stock se descuenta automáticamente con cada comanda comandada.
          </p>
        </div>

        <button
          onClick={() => setIsNewProductModalOpen(true)}
          className="px-3 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
          <span>Nuevo Plato</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Left Column: Products List */}
        <div className="md:col-span-5 lg:col-span-4 bg-[#121215] rounded border border-[#27272a] overflow-hidden flex flex-col">
          <div className="p-2.5 bg-[#09090b] border-b border-[#27272a] flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
              Platos del Menú ({products.length})
            </span>
          </div>

          <div className="p-1.5 overflow-y-auto max-h-[580px] space-y-1">
            {products.map(prod => {
              const isSelected = selectedProduct?.id === prod.id;
              const prodCost = calculateRecipeCost(prod.recipe);
              const margin = prod.price > 0 ? Math.round(((prod.price - prodCost) / prod.price) * 100) : 0;

              return (
                <div
                  key={prod.id}
                  onClick={() => handleSelectProduct(prod)}
                  className={`p-2 rounded-sm cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-zinc-800 border-zinc-600'
                      : 'bg-[#09090b] border-[#27272a] hover:bg-[#18181c]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h4 className={`text-xs font-bold leading-tight ${isSelected ? 'text-zinc-100' : 'text-zinc-200'}`}>
                      {prod.name}
                    </h4>
                    <span className="font-mono font-bold text-xs text-zinc-200 shrink-0 tabular-nums">
                      ${prod.price.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
                    <span>{prod.recipe?.length || 0} insumos</span>
                    <span className="text-emerald-400">
                      Costo: ${Math.round(prodCost).toLocaleString('es-AR')} ({margin}% margen)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Recipe Details & Editor */}
        <div className="md:col-span-7 lg:col-span-8 bg-[#121215] rounded border border-[#27272a] flex flex-col overflow-hidden">
          {selectedProduct ? (
            <div>
              {/* Product Info Header */}
              <div className="p-3 bg-[#09090b] border-b border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm font-sans">{selectedProduct.name}</h3>
                  <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-wider">{selectedProduct.category}</p>
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      onClick={handleStartEdit}
                      className="px-3 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs" aria-hidden="true"></i>
                      <span>Modificar Receta</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-2.5 py-1.5 rounded-sm bg-[#18181c] text-zinc-300 text-xs font-mono border border-[#27272a] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        disabled={submitting}
                        onClick={handleSaveRecipe}
                        className="px-2.5 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-all flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-floppy-disk text-xs" aria-hidden="true"></i>
                        <span>Guardar Cambios</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost & Profit Margin Bar */}
              <div className="p-3 bg-[#121215] border-b border-[#27272a] grid grid-cols-3 divide-x divide-[#27272a] border-t border-[#27272a] text-center text-xs">
                <div className="px-2">
                  <span className="text-zinc-400 block text-[10px] uppercase font-mono tracking-wider">Precio Venta</span>
                  <span className="font-bold text-sm text-zinc-100 font-mono tabular-nums">
                    ${selectedProduct.price?.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="px-2">
                  <span className="text-zinc-400 block text-[10px] uppercase font-mono tracking-wider">Costo Insumos</span>
                  <span className="font-bold text-sm text-zinc-200 font-mono tabular-nums">
                    ${Math.round(activeRecipeCost).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="px-2">
                  <span className="text-zinc-400 block text-[10px] uppercase font-mono tracking-wider">Margen Bruto</span>
                  <span className="font-bold text-sm font-mono text-emerald-400 tabular-nums">
                    {marginGross}%
                  </span>
                </div>
              </div>

              {/* Recipe Ingredients Breakdown */}
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
                  <h4 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                    <i className="fa-solid fa-scale-balanced text-zinc-400 text-xs" aria-hidden="true"></i>
                    <span>Insumos por Porción ({isEditing ? editedRecipe.length : (selectedProduct.recipe?.length || 0)})</span>
                  </h4>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleAddIngredientRow}
                      className="text-xs text-zinc-200 hover:text-white font-mono uppercase tracking-wider flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
                      <span>Agregar Insumo</span>
                    </button>
                  )}
                </div>

                {/* Ingredients List */}
                <div className="space-y-1.5">
                  {(isEditing ? editedRecipe : (selectedProduct.recipe || [])).length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 bg-[#09090b] rounded border border-[#27272a]">
                      <i className="fa-solid fa-triangle-exclamation text-xl mb-2 text-zinc-600 block" aria-hidden="true"></i>
                      <p className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Sin receta asignada</p>
                    </div>
                  ) : (
                    (isEditing ? editedRecipe : selectedProduct.recipe).map((item, idx) => {
                      const ing = ingredients.find(i => i.id === item.ingredientId);
                      const unitCost = ing?.costPerUnit || 0;
                      const itemTotalCost = Number(item.quantity || 0) * unitCost;

                      if (isEditing) {
                        return (
                          <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#09090b] p-2 rounded-sm border border-[#27272a]">
                            <div className="flex-1">
                              <select
                                value={item.ingredientId}
                                onChange={(e) => handleRowChange(idx, 'ingredientId', e.target.value)}
                                className="w-full bg-[#18181c] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                              >
                                {ingredients.map(i => (
                                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                ))}
                              </select>
                            </div>

                            <div className="w-full sm:w-28 flex items-center gap-1">
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={item.quantity}
                                onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                                className="w-full bg-[#18181c] border border-[#27272a] rounded-sm p-1 text-xs font-mono text-center text-zinc-100 tabular-nums"
                              />
                              <span className="text-xs text-zinc-400 font-mono font-bold shrink-0">{item.unit || ing?.unit}</span>
                            </div>

                            <div className="w-full sm:w-24 text-right font-mono text-xs text-zinc-300 font-bold self-center tabular-nums">
                              ${Math.round(itemTotalCost).toLocaleString('es-AR')}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1 text-zinc-500 hover:text-rose-400 self-center transition-colors"
                              aria-label="Eliminar insumo"
                            >
                              <i className="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
                            </button>
                          </div>
                        );
                      } else {
                        return (
                          <div key={idx} className="p-2.5 rounded-sm bg-[#09090b] border border-[#27272a] flex items-center justify-between text-xs">
                            <div>
                              <h5 className="font-semibold text-zinc-200">{ing?.name || 'Insumo'}</h5>
                              <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                                Stock actual: {ing?.stock} {ing?.unit}
                              </span>
                            </div>

                            <div className="text-right font-mono tabular-nums">
                              <div className="font-bold text-zinc-200">
                                Descuenta: <span className="text-zinc-100 font-bold">{item.quantity} {item.unit}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                Costo: ${Math.round(itemTotalCost).toLocaleString('es-AR')}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-zinc-500 font-mono">
              <i className="fa-solid fa-book-open text-2xl mb-2 text-zinc-600 block" aria-hidden="true"></i>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Selecciona un plato para ver su escandallo</p>
            </div>
          )}
        </div>
      </div>

      {/* New Product Modal */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <form onSubmit={handleCreateProduct} className="bg-[#121215] border border-[#27272a] rounded w-full max-w-md p-4 space-y-3 shadow-2xl">
            <h3 className="font-mono font-bold text-zinc-100 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
              <i className="fa-solid fa-plus text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Agregar Nuevo Plato al Menú</span>
            </h3>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Nombre del Plato:</label>
              <input
                type="text"
                placeholder="Ej: Pizza Fugazzeta Rellena"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Categoría:</label>
                <select
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                >
                  <option value="Pizzas">Pizzas</option>
                  <option value="Hamburguesas">Hamburguesas</option>
                  <option value="Minutas & Entradas">Minutas & Entradas</option>
                  <option value="Pastas">Pastas</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Postres">Postres</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Precio de Venta ($):</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-500 tabular-nums"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Detalle / Notas internas:</label>
              <textarea
                rows="2"
                placeholder="Detalle para cocina o carta..."
                value={newProductDesc}
                onChange={(e) => setNewProductDesc(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="flex-1 py-1.5 rounded-sm bg-[#18181c] hover:bg-[#27272a] text-zinc-300 text-xs font-mono border border-[#27272a] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-1.5 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold transition-all"
              >
                Crear Plato
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
