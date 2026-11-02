import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getTableCode } from './MozoSalonView';

// Lista de adicionales estándar disponibles para gastronomía
const AVAILABLE_EXTRAS = [
  { id: 'ext_muzza', name: 'Extra Muzzarella', price: 1800 },
  { id: 'ext_carne', name: 'Extra Medallón Carne', price: 2500 },
  { id: 'ext_cheddar', name: 'Extra Queso Cheddar', price: 1200 },
  { id: 'ext_panceta', name: 'Extra Panceta Ahumada', price: 1400 },
  { id: 'ext_jamon', name: 'Extra Jamón Cocido', price: 1500 },
  { id: 'ext_morron', name: 'Extra Morrones Asados', price: 1200 },
  { id: 'ext_huevo', name: 'Huevo Frito', price: 900 },
  { id: 'ext_papas', name: 'Porción Papas Chicas', price: 2200 },
  { id: 'ext_sintacc', name: 'Apto Celíaco / Sin TACC', price: 1500 },
  { id: 'ext_borde', name: 'Borde Relleno de Queso', price: 2400 }
];

// Aclaraciones rápidas para cocina
const QUICK_NOTES = [
  'Sin cebolla',
  'Bien cocido',
  'Punto jugoso',
  'Sin sal',
  'Poco hielo',
  'Aderezos aparte',
  'Para compartir',
  'Primero la entrada',
  'Sin orégano'
];

export default function OrderTakingModal({ isOpen, onClose, table, activeOrder, onOrderSubmitted, channel = 'mesa' }) {
  const { products, currentUser, showToast, refreshData } = useApp();

  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [diners, setDiners] = useState(table?.diners || 2);
  const [cartItems, setCartItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Modal for configuring item additions & kitchen notes
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [tempNotes, setTempNotes] = useState('');
  const [tempExtras, setTempExtras] = useState([]);

  if (!isOpen || !table) return null;

  const tableCode = getTableCode(table);
  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      return [
        ...prev,
        {
          cartItemId: 'citem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          productId: product.id,
          productName: product.name,
          basePrice: product.price,
          unitPrice: product.price,
          quantity: 1,
          subtotal: product.price,
          notes: '',
          extras: []
        }
      ];
    });
  };

  const handleUpdateQuantity = (cartItemId, delta) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const nextQty = item.quantity + delta;
        return nextQty > 0 ? { ...item, quantity: nextQty, subtotal: nextQty * item.unitPrice } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const handleRemoveItem = (cartItemId) => {
    setCartItems(prev => prev.filter(it => it.cartItemId !== cartItemId));
  };

  // Open config sheet for a cart item
  const handleOpenItemConfig = (index) => {
    const item = cartItems[index];
    if (!item) return;
    setEditingItemIndex(index);
    setTempNotes(item.notes || '');
    setTempExtras(item.extras || []);
  };

  const handleToggleExtra = (extra) => {
    setTempExtras(prev => {
      const exists = prev.some(e => e.id === extra.id);
      if (exists) {
        return prev.filter(e => e.id !== extra.id);
      } else {
        return [...prev, extra];
      }
    });
  };

  const handleSaveItemConfig = () => {
    if (editingItemIndex === null) return;
    setCartItems(prev => prev.map((item, idx) => {
      if (idx === editingItemIndex) {
        const extrasCost = tempExtras.reduce((sum, e) => sum + e.price, 0);
        const newUnitPrice = item.basePrice + extrasCost;
        return {
          ...item,
          notes: tempNotes,
          extras: tempExtras,
          unitPrice: newUnitPrice,
          subtotal: item.quantity * newUnitPrice
        };
      }
      return item;
    }));
    setEditingItemIndex(null);
  };

  const cartTotal = cartItems.reduce((acc, it) => acc + it.subtotal, 0);

  const handleSubmit = async () => {
    if (cartItems.length === 0) {
      showToast('Agrega al menos un producto a la comanda', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formattedItems = cartItems.map(it => {
        let noteString = it.notes || '';
        if (it.extras && it.extras.length > 0) {
          const extrasStr = it.extras.map(e => `+${e.name}`).join(', ');
          noteString = noteString ? `${noteString} | Extras: ${extrasStr}` : `Extras: ${extrasStr}`;
        }
        return {
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          notes: noteString
        };
      });

      if (activeOrder) {
        await api.addItemsToOrder(activeOrder.id, formattedItems, currentUser);
        showToast(`Platos agregados a Mesa ${tableCode}. Stock descontado.`);
      } else {
        const orderData = {
          channel: channel || 'mesa',
          tableId: channel === 'mesa' ? table.id : null,
          tableNumber: table.number,
          diners: diners,
          items: formattedItems,
          kitchenStatus: 'en_preparacion'
        };
        await api.createOrder(orderData, currentUser);
        showToast(`Comanda enviada a cocina para Mesa ${tableCode}.`);
      }

      await refreshData();
      onOrderSubmitted?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'Error al enviar comanda', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSolicitarCierre = async () => {
    if (!activeOrder) return;
    try {
      await api.requestBill(activeOrder.id, 0);
      showToast(`Mesa ${tableCode} marcada como Pendiente de Cobro.`);
      await refreshData();
      onClose();
    } catch (err) {
      showToast(err.message || 'Error al solicitar cierre', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-3 animate-in fade-in duration-150">
      <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-5xl h-full sm:h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Header */}
        <div className="p-3 bg-[#0e0e11] border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="px-2.5 py-1 rounded bg-[#18181c] text-zinc-100 border border-[#27272a] font-mono tabular-nums font-black text-sm">
              {tableCode}
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-zinc-100 flex items-center gap-2">
                <span>{table.sector} : Mesa {table.number}</span>
                {activeOrder && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                    #{activeOrder.orderNumber}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Mozo: <strong className="text-zinc-200 font-sans">{currentUser.name}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!activeOrder && (
              <div className="flex items-center gap-1.5 bg-[#18181c] px-2 py-0.5 rounded border border-[#27272a]">
                <i className="fa-solid fa-users text-[11px] text-zinc-400" aria-hidden="true"></i>
                <button
                  type="button"
                  onClick={() => setDiners(Math.max(1, diners - 1))}
                  className="w-5 h-5 rounded bg-zinc-800 text-zinc-200 font-bold text-xs flex items-center justify-center"
                >
                  -
                </button>
                <span className="text-xs font-mono tabular-nums font-bold text-zinc-100 px-1">{diners}</span>
                <button
                  type="button"
                  onClick={() => setDiners(diners + 1)}
                  className="w-5 h-5 rounded bg-zinc-800 text-zinc-200 font-bold text-xs flex items-center justify-center"
                >
                  +
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              aria-label="Cerrar modal"
              className="w-7 h-7 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181c] flex items-center justify-center transition-colors"
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* Content Body: Split Menu / Active Cart */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Product Catalog (NO DESCRIPTIONS) */}
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-[#27272a] overflow-hidden bg-[#101014]">
            {/* Search & Categories */}
            <div className="p-2.5 bg-[#141418] border-b border-[#27272a] space-y-2 shrink-0">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass text-[11px] text-zinc-500 absolute left-3 top-2.5" aria-hidden="true"></i>
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#101014] border border-[#27272a] rounded pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              {/* Category Segmented Bar */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-zinc-200 text-zinc-950 font-bold'
                        : 'bg-[#18181c] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-[#27272a]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards: Clean, micro-radius, NO description */}
            <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredProducts.map(product => {
                const countInCart = cartItems.filter(it => it.productId === product.id)
                  .reduce((sum, it) => sum + it.quantity, 0);

                return (
                  <div
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className={`p-2.5 rounded border transition-colors cursor-pointer flex flex-col justify-between active:scale-[0.99] select-none ${
                      countInCart > 0
                        ? 'bg-[#18181c] border-zinc-600 border-l-[3px] border-l-white'
                        : 'bg-[#141418] border-[#27272a] hover:border-zinc-700 hover:bg-[#18181c]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <h4 className="font-bold text-xs text-zinc-100 leading-snug line-clamp-2">
                        {product.name}
                      </h4>
                      {countInCart > 0 && (
                        <span className="px-1.5 py-0.2 rounded-sm bg-zinc-200 text-zinc-950 font-black text-[10px] shrink-0 font-mono">
                          {countInCart}x
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#27272a]">
                      <span className="font-mono tabular-nums font-bold text-xs text-zinc-100">
                        ${product.price.toLocaleString('es-AR')}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase font-mono">
                        {product.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Active Ticket / Cart */}
          <div className="w-full md:w-80 lg:w-96 flex flex-col bg-[#121215] shrink-0">
            {/* Existing order items if table already occupied */}
            {activeOrder && activeOrder.items?.length > 0 && (
              <div className="p-2.5 bg-[#0e0e11] border-b border-[#27272a] max-h-36 overflow-y-auto">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">
                  <span>Platos ya comandados ({activeOrder.items.length})</span>
                  <span className="text-zinc-300 font-mono tabular-nums">${activeOrder.subtotal?.toLocaleString('es-AR')}</span>
                </div>
                <div className="space-y-1">
                  {activeOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-zinc-400 bg-[#15151a] p-1.5 rounded border border-[#27272a]">
                      <div className="truncate pr-2">
                        <span className="font-bold font-mono text-zinc-200">{it.quantity}x</span> {it.productName}
                      </div>
                      <span className="font-mono tabular-nums shrink-0 text-zinc-300">${it.subtotal?.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cart Header */}
            <div className="p-2.5 bg-[#15151a] border-b border-[#27272a] flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                Nueva Comanda ({cartItems.length})
              </span>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-[11px] text-zinc-500 hover:text-zinc-200 font-mono"
                >
                  Vaciar
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-600">
                  <i className="fa-solid fa-utensils text-2xl mb-2 text-zinc-700" aria-hidden="true"></i>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">Comanda Vacía</p>
                  <p className="text-[11px] text-zinc-600 mt-1">Selecciona productos a la izquierda para cargar platos.</p>
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div key={item.cartItemId} className="bg-[#16161b] p-2.5 rounded border border-[#27272a] space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 overflow-hidden">
                        <h5 className="font-bold text-xs text-zinc-100 truncate">{item.productName}</h5>
                        <div className="text-[11px] font-mono tabular-nums text-zinc-300 font-bold">
                          ${item.unitPrice.toLocaleString('es-AR')} c/u
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1 bg-[#101014] rounded p-0.5 border border-[#27272a]">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartItemId, -1)}
                          className="w-5 h-5 rounded bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-xs font-bold font-mono tabular-nums text-zinc-100">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartItemId, 1)}
                          className="w-5 h-5 rounded bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.cartItemId)}
                        aria-label="Quitar plato"
                        className="w-6 h-6 rounded text-zinc-500 hover:text-zinc-200 flex items-center justify-center"
                      >
                        <i className="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
                      </button>
                    </div>

                    {/* Extras / Notes chips */}
                    <div className="space-y-1 pt-0.5">
                      {item.extras && item.extras.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.extras.map(ex => (
                            <span key={ex.id} className="text-[10px] bg-zinc-800 text-zinc-200 px-1.5 py-0.2 rounded border border-zinc-700 font-mono">
                              +{ex.name} (${ex.price})
                            </span>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-zinc-400 italic">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#27272a] text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleOpenItemConfig(idx)}
                        className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono"
                      >
                        <i className="fa-solid fa-pen text-[10px]" aria-hidden="true"></i>
                        <span>{item.extras?.length || item.notes ? 'Editar detalles' : '+ Adicionales / Aclaración'}</span>
                      </button>

                      <span className="text-xs font-bold font-mono tabular-nums text-zinc-100">
                        ${item.subtotal.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            <div className="p-3 bg-[#0e0e11] border-t border-[#27272a] space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono uppercase text-[11px]">Subtotal comanda:</span>
                <span className="font-bold text-zinc-100 font-mono tabular-nums text-sm">${cartTotal.toLocaleString('es-AR')}</span>
              </div>

              {/* Submit to Kitchen */}
              <button
                type="button"
                disabled={submitting || cartItems.length === 0}
                onClick={handleSubmit}
                className="w-full py-2 px-3 rounded bg-zinc-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-black text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <i className="fa-solid fa-paper-plane text-xs" aria-hidden="true"></i>
                <span>{submitting ? 'Enviando...' : 'ENVIAR A COCINA'}</span>
              </button>

              {activeOrder && (
                <button
                  type="button"
                  onClick={handleSolicitarCierre}
                  className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-colors"
                >
                  Solicitar Cierre / Cobro a Caja
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item Extras & Kitchen Notes Config Modal */}
      {editingItemIndex !== null && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#141418] border border-[#27272a] rounded w-full max-w-md p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
              <h4 className="font-bold text-xs text-zinc-100 uppercase tracking-wider font-mono">
                Adicionales y Aclaraciones para Cocina
              </h4>
              <button 
                onClick={() => setEditingItemIndex(null)} 
                aria-label="Cerrar modal de adicionales"
                className="w-6 h-6 rounded text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            {/* Extras Selection */}
            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1.5 uppercase font-mono">
                Adicionales con costo ($):
              </label>
              <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto p-1 bg-[#101014] rounded border border-[#27272a]">
                {AVAILABLE_EXTRAS.map(extra => {
                  const isSelected = tempExtras.some(e => e.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => handleToggleExtra(extra)}
                      className={`p-1.5 rounded text-left text-xs transition-colors border flex items-center justify-between ${
                        isSelected
                          ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-bold'
                          : 'bg-[#18181c] text-zinc-300 border-[#27272a] hover:bg-zinc-800'
                      }`}
                    >
                      <span className="truncate pr-1">{extra.name}</span>
                      <span className="font-mono tabular-nums text-[10px] shrink-0">+${extra.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Kitchen Notes */}
            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1.5 uppercase font-mono">
                Aclaración a Cocina:
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {QUICK_NOTES.map(qNote => (
                  <button
                    key={qNote}
                    type="button"
                    onClick={() => setTempNotes(prev => prev ? `${prev}, ${qNote}` : qNote)}
                    className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700"
                  >
                    +{qNote}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Escribe un detalle personalizado..."
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                className="w-full bg-[#101014] border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveItemConfig}
                className="flex-1 py-1.5 rounded bg-zinc-200 hover:bg-white text-zinc-950 font-black text-xs"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}