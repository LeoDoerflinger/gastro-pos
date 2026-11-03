import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getTableCode } from './MozoSalonView';

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
  const [mobilePane, setMobilePane] = useState('catalog');

  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [tempNotes, setTempNotes] = useState('');
  const [tempExtras, setTempExtras] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editingItemIndex !== null) {
          setEditingItemIndex(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, editingItemIndex, onClose]);

  if (!isOpen || !table) return null;

  const isMostrador = channel === 'mostrador';
  const tableCode = isMostrador ? 'MOSTRADOR' : getTableCode(table);
  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleAddToCart = (product) => {
    setCartItems(prev => [
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
    ]);
  };

  const handleUpdateQuantity = (cartItemId, delta) => {
    setCartItems(prev =>
      prev
        .map(item => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty, subtotal: nextQty * item.unitPrice } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveItem = (cartItemId) => {
    setCartItems(prev => prev.filter(it => it.cartItemId !== cartItemId));
  };

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
      return exists ? prev.filter(e => e.id !== extra.id) : [...prev, extra];
    });
  };

  const handleSaveItemConfig = () => {
    if (editingItemIndex === null) return;
    setCartItems(prev =>
      prev.map((item, idx) => {
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
      })
    );
    setEditingItemIndex(null);
  };

  const cartTotal = cartItems.reduce((acc, it) => acc + it.subtotal, 0);
  const cartCount = cartItems.reduce((acc, it) => acc + it.quantity, 0);

  const handleSubmit = async () => {
    if (cartItems.length === 0) {
      showToast('Agregá al menos un plato antes de enviar a cocina', 'error');
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
        showToast(`Platos agregados a ${tableCode}.`);
      } else {
        const orderData = {
          channel: channel || 'mesa',
          tableId: channel === 'mesa' ? table.id : null,
          tableNumber: table.number,
          diners,
          items: formattedItems,
          kitchenStatus: 'en_preparacion'
        };
        await api.createOrder(orderData, currentUser);
        showToast(`Comanda enviada a cocina (${tableCode}).`);
      }

      await refreshData();
      onOrderSubmitted?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'No se pudo enviar la comanda', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSolicitarCierre = async () => {
    if (!activeOrder) return;
    try {
      await api.requestBill(activeOrder.id, 0);
      showToast(`Mesa ${tableCode} en estado Cuenta (aviso enviado a caja).`);
      await refreshData();
      onOrderSubmitted?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'No se pudo solicitar la cuenta', 'error');
    }
  };

  const handlePasarAPendienteCobro = async () => {
    if (!activeOrder) return;
    try {
      await api.markPendingPayment(activeOrder.id);
      showToast(`Mesa ${tableCode} marcada como Pendiente de cobro.`);
      await refreshData();
      onOrderSubmitted?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el estado de cobro', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div className="pos-panel w-full max-w-6xl h-full sm:h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-none sm:rounded-[6px]">
        {/* Top Header */}
        <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-3 py-1.5 rounded bg-[var(--accent-brand-bg)] text-[var(--accent-brand)] border border-[var(--accent-brand-border)] font-mono font-bold text-sm shrink-0">
              {tableCode}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="order-modal-title" className="font-display font-bold text-base text-[var(--text-primary)] truncate">
                  {isMostrador ? 'Nueva venta de mostrador' : `${table.sector} · Mesa ${table.number}`}
                </h2>
                {activeOrder && (
                  <span className="pos-badge pos-badge-open font-mono">
                    Comanda #{activeOrder.orderNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Operador: <strong className="text-[var(--text-primary)]">{currentUser.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!activeOrder && !isMostrador && (
              <div className="hidden sm:flex items-center gap-1.5 bg-[var(--bg-surface)] px-2 py-1 rounded border border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-secondary)] px-1">Cubiertos:</span>
                <button
                  type="button"
                  aria-label="Restar un cubierto"
                  onClick={() => setDiners(Math.max(1, diners - 1))}
                  className="pos-btn-secondary min-w-[44px] px-0"
                >
                  -
                </button>
                <span className="w-7 text-center text-sm font-mono font-bold text-[var(--text-primary)]">{diners}</span>
                <button
                  type="button"
                  aria-label="Sumar un cubierto"
                  onClick={() => setDiners(diners + 1)}
                  className="pos-btn-secondary min-w-[44px] px-0"
                >
                  +
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar comandera"
              className="pos-btn-ghost"
            >
              <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* Mobile View Switcher (< md) */}
        <div className="md:hidden px-3 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMobilePane('catalog')}
              aria-pressed={mobilePane === 'catalog'}
              className={mobilePane === 'catalog' ? 'pos-btn-primary text-xs' : 'pos-btn-secondary text-xs'}
            >
              <i className="fa-solid fa-utensils text-xs" aria-hidden="true"></i>
              <span>Carta de platos</span>
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('ticket')}
              aria-pressed={mobilePane === 'ticket'}
              className={mobilePane === 'ticket' ? 'pos-btn-primary text-xs' : 'pos-btn-secondary text-xs'}
            >
              <i className="fa-solid fa-receipt text-xs" aria-hidden="true"></i>
              <span>Comanda ({cartCount})</span>
            </button>
          </div>
        </div>

        {/* Split Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Product Catalog (Strictly NO product descriptions per domain rule) */}
          <div
            className={`flex-1 flex-col md:border-r border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-canvas)] ${
              mobilePane === 'catalog' ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* Search & Category Bar */}
            <div className="p-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] space-y-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <label htmlFor="order-product-search" className="text-xs font-semibold text-[var(--text-secondary)] shrink-0 inline-flex items-center gap-1.5">
                  <i className="fa-solid fa-magnifying-glass text-xs text-[var(--text-muted)]" aria-hidden="true"></i>
                  <span>Buscar:</span>
                </label>
                <input
                  id="order-product-search"
                  type="search"
                  placeholder="Plato por nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pos-input flex-1"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5" role="group" aria-label="Categorías de platos">
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
                          ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-border)] font-bold'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Keycaps Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {filteredProducts.length === 0 ? (
                <div className="pos-panel p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    No hay platos que coincidan con "{searchQuery}"
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('Todas');
                    }}
                    className="pos-btn-secondary text-xs mx-auto"
                  >
                    Ver toda la carta
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredProducts.map(product => {
                    const countInCart = cartItems
                      .filter(it => it.productId === product.id)
                      .reduce((sum, it) => sum + it.quantity, 0);

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        className={`p-3.5 rounded text-left border transition-all flex flex-col justify-between min-h-[104px] active:translate-y-px ${
                          countInCart > 0
                            ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)] border-l-4 border-l-[var(--accent-brand)] shadow-sm'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 w-full mb-3">
                          <span className="font-display font-bold text-sm text-[var(--text-primary)] leading-snug line-clamp-2">
                            {product.name}
                          </span>
                          {countInCart > 0 && (
                            <span className="pos-badge pos-badge-brand font-mono shrink-0">
                              {countInCart}x
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 w-full pt-2 border-t border-[var(--border-subtle)]">
                          <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                            ${product.price.toLocaleString('es-AR')}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] truncate">
                            {product.category}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Sticky Quick Summary Bar */}
            {cartItems.length > 0 && (
              <div className="md:hidden p-3 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
                <div>
                  <span className="text-xs text-[var(--text-secondary)] block">{cartCount} platos cargados</span>
                  <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                    ${cartTotal.toLocaleString('es-AR')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePane('ticket')}
                  className="pos-btn-primary"
                >
                  <span>Revisar y enviar</span>
                  <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
                </button>
              </div>
            )}
          </div>

          {/* Right: Active Ticket / Comanda */}
          <div
            className={`w-full md:w-96 lg:w-[410px] flex-col bg-[var(--bg-surface)] shrink-0 overflow-hidden ${
              mobilePane === 'ticket' ? 'flex flex-1' : 'hidden md:flex'
            }`}
          >
            {/* Existing Sent Order Items */}
            {activeOrder && activeOrder.items?.length > 0 && (
              <div className="p-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] max-h-40 overflow-y-auto shrink-0">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] mb-2">
                  <span>Ya marchado en cocina ({activeOrder.items.length})</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    ${activeOrder.subtotal?.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {activeOrder.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2.5 py-1.5 rounded border border-[var(--border-subtle)]"
                    >
                      <div className="truncate pr-2">
                        <strong className="font-mono text-[var(--text-primary)]">{it.quantity}x</strong> {it.productName}
                      </div>
                      <span className="font-mono shrink-0 text-[var(--text-primary)]">
                        ${it.subtotal?.toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Comanda Header */}
            <div className="px-4 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
              <span className="text-sm font-bold text-[var(--text-primary)]">
                Nueva comanda ({cartCount})
              </span>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="pos-btn-ghost text-xs px-2.5"
                >
                  Vaciar lista
                </button>
              )}
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-11 h-11 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center mb-3">
                    <i className="fa-solid fa-bell-concierge text-lg" aria-hidden="true"></i>
                  </div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">Todavía no cargaste platos</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[230px]">
                    Tocá cualquier plato de la carta para sumarlo a esta comanda.
                  </p>
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div
                    key={item.cartItemId}
                    className="pos-elevated p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-[var(--text-primary)] leading-snug">
                          {item.productName}
                        </h3>
                        <span className="text-xs font-mono text-[var(--text-secondary)]">
                          ${item.unitPrice.toLocaleString('es-AR')} c/u
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.cartItemId)}
                        aria-label={`Quitar ${item.productName}`}
                        className="pos-btn-ghost text-[var(--text-muted)] hover:text-[var(--status-danger-fg)]"
                      >
                        <i className="fa-solid fa-trash-can text-sm" aria-hidden="true"></i>
                      </button>
                    </div>

                    {(item.extras?.length > 0 || item.notes) && (
                      <div className="space-y-1">
                        {item.extras && item.extras.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {item.extras.map(ex => (
                              <span key={ex.id} className="pos-badge pos-badge-brand font-mono">
                                +{ex.name} (${ex.price})
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-[var(--status-bill-fg)] bg-[var(--status-bill-bg)] border border-[var(--status-bill-border)] px-2.5 py-1 rounded">
                            Nota cocina: {item.notes}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => handleOpenItemConfig(idx)}
                        className="pos-btn-secondary text-xs px-3"
                      >
                        <i className="fa-solid fa-sliders text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                        <span>{item.extras?.length || item.notes ? 'Editar nota / extras' : 'Aclaración / Extras'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Restar uno de ${item.productName}`}
                          onClick={() => handleUpdateQuantity(item.cartItemId, -1)}
                          className="pos-btn-secondary min-w-[44px] px-0"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-sm font-bold font-mono text-[var(--text-primary)]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Sumar uno de ${item.productName}`}
                          onClick={() => handleUpdateQuantity(item.cartItemId, 1)}
                          className="pos-btn-secondary min-w-[44px] px-0"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            <div className="p-4 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Total nueva comanda</span>
                <span className="font-mono font-bold text-lg text-[var(--text-primary)]">
                  ${cartTotal.toLocaleString('es-AR')}
                </span>
              </div>

              <button
                type="button"
                disabled={submitting || cartItems.length === 0}
                onClick={handleSubmit}
                className="pos-btn-primary w-full"
              >
                <i className="fa-solid fa-paper-plane text-xs" aria-hidden="true"></i>
                <span>{submitting ? 'Enviando a cocina...' : 'Marchar a cocina'}</span>
              </button>

              {activeOrder && activeOrder.status === 'abierto' && (
                <button
                  type="button"
                  onClick={handleSolicitarCierre}
                  className="pos-btn-secondary w-full"
                >
                  <i className="fa-solid fa-bell-concierge text-xs text-[var(--status-account-fg)]" aria-hidden="true"></i>
                  <span>Solicitar cuenta</span>
                </button>
              )}

              {activeOrder && activeOrder.status === 'cuenta_solicitada' && (
                <button
                  type="button"
                  onClick={handlePasarAPendienteCobro}
                  className="pos-btn-secondary w-full"
                >
                  <i className="fa-solid fa-receipt text-xs text-[var(--status-bill-fg)]" aria-hidden="true"></i>
                  <span>Pasar a Pendiente de cobro</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item Extras & Kitchen Notes Sub-Modal */}
      {editingItemIndex !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extras-modal-title"
        >
          <div className="pos-panel w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 id="extras-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                  Adicionales y aclaraciones a cocina
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {cartItems[editingItemIndex]?.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                aria-label="Cerrar adicionales"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            {/* Priced Extras */}
            <div>
              <span className="pos-label">Adicionales con cargo:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                {AVAILABLE_EXTRAS.map(extra => {
                  const isSelected = tempExtras.some(e => e.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleToggleExtra(extra)}
                      className={`min-h-[44px] px-3 py-2 rounded text-left text-xs transition-colors border flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[var(--accent-brand-bg)] text-[var(--accent-brand)] border-[var(--accent-brand-border)] font-bold'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <span className="truncate">{extra.name}</span>
                      <span className="font-mono shrink-0">+${extra.price.toLocaleString('es-AR')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kitchen Notes */}
            <div className="space-y-2">
              <label htmlFor="kitchen-custom-note" className="pos-label">
                Aclaración para cocina:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTES.map(qNote => (
                  <button
                    key={qNote}
                    type="button"
                    onClick={() => setTempNotes(prev => (prev ? `${prev}, ${qNote}` : qNote))}
                    className="min-h-[44px] px-3 rounded text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                  >
                    + {qNote}
                  </button>
                ))}
              </div>
              <input
                id="kitchen-custom-note"
                type="text"
                placeholder="Escribí un detalle especial (ej. sin pimienta, cortar en 8)..."
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                className="pos-input"
              />
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                className="pos-btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveItemConfig}
                className="pos-btn-primary flex-1"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
