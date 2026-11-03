import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import CobroModal from '../cajero/CobroModal';
import { api } from '../../api/client';
import { buildWhatsAppLink, getDefaultDeliveryMessage, normalizeArgentinePhone } from '../../utils/phoneHelper';

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
  'Sin orégano',
  'Timbre roto / llamar al llegar'
];

const MAX_DELIVERY_RADIUS_KM = 5.0;

const RESTAURANT_LOCATION = {
  name: 'Local Central GastroPOS Córdoba',
  address: 'Av. Hipólito Yrigoyen 450, Nueva Córdoba, Córdoba Capital',
  lat: -31.4241,
  lng: -64.1873
};

const PRESET_ADDRESSES = [
  { address: 'Bv. San Juan 320, Centro / Güemes', distanceKm: 0.7 },
  { address: 'Bv. Chacabuco 850, Nueva Córdoba', distanceKm: 1.1 },
  { address: 'Belgrano 740, Barrio Güemes', distanceKm: 1.3 },
  { address: 'Av. 24 de Septiembre 1100, General Paz', distanceKm: 2.4 },
  { address: 'Mariano Fragueiro 1900, Alta Córdoba', distanceKm: 3.8 },
  { address: 'Av. Colón 2800, Alberdi', distanceKm: 4.3 }
];

function calculateDeliveryInfo(distanceKm) {
  const dist = Number(distanceKm);
  if (isNaN(dist) || dist <= 0) {
    return {
      isValid: false,
      isOutOfRange: false,
      fee: 0,
      zoneName: 'Sin distancia',
      estimatedTime: '20 a 30 min'
    };
  }

  if (dist > MAX_DELIVERY_RADIUS_KM) {
    return {
      isValid: false,
      isOutOfRange: true,
      fee: 0,
      zoneName: 'Fuera de radio (máx. 5.0 km)',
      estimatedTime: 'No disponible'
    };
  }

  if (dist <= 1.5) {
    return {
      isValid: true,
      isOutOfRange: false,
      fee: 1200,
      zoneName: 'Zona 1 · Cercanía (hasta 1.5 km)',
      estimatedTime: '15 a 25 min'
    };
  } else if (dist <= 3.0) {
    return {
      isValid: true,
      isOutOfRange: false,
      fee: 1800,
      zoneName: 'Zona 2 · Media (hasta 3.0 km)',
      estimatedTime: '25 a 35 min'
    };
  }
  return {
    isValid: true,
    isOutOfRange: false,
    fee: 2600,
    zoneName: 'Zona 3 · Límite (hasta 5.0 km)',
    estimatedTime: '35 a 45 min'
  };
}

export default function DeliveryManager() {
  const { orders, products, currentUser, showToast, refreshData, activeShift, businessConfig } = useApp();

  const [channelType, setChannelType] = useState('delivery');
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedOrderForCobro, setSelectedOrderForCobro] = useState(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState(1.4);
  const [driverName, setDriverName] = useState('Gastón (Moto 1)');
  const [cartItems, setCartItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Modal for dish extras & kitchen clarifications
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [tempNotes, setTempNotes] = useState('');
  const [tempExtras, setTempExtras] = useState([]);

  useEffect(() => {
    if (!isNewOrderModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editingItemIndex !== null) {
          setEditingItemIndex(null);
        } else {
          setIsNewOrderModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNewOrderModalOpen, editingItemIndex]);

  const deliveryOrders = orders.filter(
    o => (o.channel === 'delivery' || o.channel === 'take_away') && o.status !== 'cobrado'
  );

  const deliveryInfo = useMemo(() => calculateDeliveryInfo(distanceKm), [distanceKm]);

  const handleSelectPresetAddress = (preset) => {
    setDeliveryAddress(preset.address);
    setDistanceKm(preset.distanceKm);
  };

  const handleAddToCart = (product) => {
    setCartItems(prev => [
      ...prev,
      {
        cartItemId: 'del_citem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
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

  const handleUpdateQty = (cartItemId, delta) => {
    setCartItems(prev =>
      prev
        .map(it => {
          if (it.cartItemId === cartItemId) {
            const next = it.quantity + delta;
            return next > 0 ? { ...it, quantity: next, subtotal: next * it.unitPrice } : null;
          }
          return it;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveItem = (cartItemId) => {
    setCartItems(prev => prev.filter(it => it.cartItemId !== cartItemId));
  };

  const handleOpenItemConfig = (idx) => {
    const item = cartItems[idx];
    if (!item) return;
    setEditingItemIndex(idx);
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

  const cartSubtotal = cartItems.reduce((acc, it) => acc + it.subtotal, 0);
  const totalWithFee = cartSubtotal + (channelType === 'delivery' ? (deliveryInfo.isValid ? deliveryInfo.fee : 0) : 0);

  const handleCreateDeliveryOrder = async (e) => {
    e.preventDefault();
    if (!activeShift) {
      showToast('Caja cerrada: Iniciá el turno de caja antes de cargar pedidos', 'error');
      return;
    }
    if (!customerName.trim()) {
      showToast('Ingresá el nombre del cliente', 'error');
      return;
    }
    if (channelType === 'delivery') {
      if (!deliveryAddress.trim()) {
        showToast('Ingresá la dirección de entrega', 'error');
        return;
      }
      if (deliveryInfo.isOutOfRange) {
        showToast(`Fuera de zona de reparto (máximo permitido: ${MAX_DELIVERY_RADIUS_KM} km)`, 'error');
        return;
      }
    }
    if (cartItems.length === 0) {
      showToast('Sumá al menos un plato al pedido', 'error');
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
          subtotal: it.subtotal,
          notes: noteString
        };
      });

      const orderData = {
        channel: channelType,
        customerName,
        customerPhone,
        deliveryAddress: channelType === 'delivery' ? deliveryAddress : null,
        deliveryDistanceKm: channelType === 'delivery' ? Number(distanceKm) : null,
        deliveryFee: channelType === 'delivery' ? deliveryInfo.fee : 0,
        driverName: channelType === 'delivery' ? driverName : null,
        kitchenStatus: 'en_preparacion',
        items: formattedItems
      };

      await api.createOrder(orderData, currentUser);
      showToast(`Pedido de ${channelType === 'delivery' ? 'Delivery' : 'Take Away'} en marcha.`);
      setIsNewOrderModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setDistanceKm(1.4);
      setCartItems([]);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo crear el pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (order, nextStatus) => {
    try {
      await api.updateOrderStatus(order.id, { kitchenStatus: nextStatus });
      const statusLabels = {
        en_preparacion: 'En preparación',
        listo: 'Listo para despacho',
        en_camino: 'En camino',
        entregado: 'Entregado'
      };
      showToast(`Pedido #${order.orderNumber}: ${statusLabels[nextStatus] || nextStatus}`);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el estado', 'error');
    }
  };

  const mapQuery = encodeURIComponent(
    `${deliveryAddress.trim() || businessConfig?.address || RESTAURANT_LOCATION.address}, ${businessConfig?.city || 'Córdoba'}, Argentina`
  );

  return (
    <section className="space-y-5" aria-label="Despacho de Delivery y Take Away">
      {/* Open Header */}
      <div className="pb-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            Despacho de Delivery y Take Away
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Zona de cobertura hasta {MAX_DELIVERY_RADIUS_KM} km con vista en mapa y tarifa automática por distancia.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNewOrderModalOpen(true)}
          className="pos-btn-primary self-start sm:self-auto shrink-0"
        >
          <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
          <span>Nuevo pedido</span>
        </button>
      </div>

      {/* Active Dispatch Cards */}
      {deliveryOrders.length === 0 ? (
        <div className="pos-panel p-12 text-center space-y-3">
          <div className="w-11 h-11 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
            <i className="fa-solid fa-motorcycle text-lg" aria-hidden="true"></i>
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
              No hay entregas activas en este momento
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Cargá un nuevo pedido a domicilio o para retirar por mostrador.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsNewOrderModalOpen(true)}
            className="pos-btn-secondary mx-auto"
          >
            <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
            <span>Cargar pedido ahora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliveryOrders.map(order => {
            const isDelivery = order.channel === 'delivery';
            const kStatus = order.kitchenStatus || 'en_preparacion';
            const statusText = {
              en_preparacion: { label: 'En cocina', cls: 'pos-badge-bill' },
              listo: { label: 'Listo p/ salir', cls: 'pos-badge-brand' },
              en_camino: { label: 'En camino', cls: 'pos-badge-open' },
              entregado: { label: 'Entregado', cls: 'pos-badge-neutral' }
            }[kStatus] || { label: kStatus, cls: 'pos-badge-neutral' };

            return (
              <article
                key={order.id}
                className="pos-panel p-4 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                        #{order.orderNumber}
                      </span>
                      <span className="pos-badge pos-badge-brand text-xs">
                        <i className={`fa-solid ${isDelivery ? 'fa-motorcycle' : 'fa-bag-shopping'} text-[11px]`} aria-hidden="true"></i>
                        <span>{isDelivery ? 'Delivery' : 'Take Away'}</span>
                      </span>
                    </div>
                    <span className={`pos-badge ${statusText.cls}`}>{statusText.label}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="font-display font-bold text-base text-[var(--text-primary)]">
                      {order.customerName || 'Cliente mostrador'}
                    </div>
                    {order.customerPhone && (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <p className="text-xs text-[var(--text-secondary)] font-mono">
                          Tel: {order.customerPhone}
                        </p>
                        {((isDelivery && kStatus === 'en_camino') || (!isDelivery && kStatus === 'listo')) && (() => {
                          const waUrl = buildWhatsAppLink(
                            order.customerPhone,
                            getDefaultDeliveryMessage({
                              customerName: order.customerName,
                              orderNumber: order.orderNumber,
                              channel: order.channel,
                              driverName: order.driverName
                            }, businessConfig)
                          );
                          if (!waUrl) return null;
                          return (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-sans font-semibold text-[11px] hover:bg-emerald-500/20 transition-colors"
                              title="Avisar por WhatsApp al cliente"
                            >
                              <i className="fa-brands fa-whatsapp text-emerald-500 text-xs" aria-hidden="true"></i>
                              <span>Avisar WhatsApp</span>
                            </a>
                          );
                        })()}
                      </div>
                    )}
                    {isDelivery && order.deliveryAddress && (
                      <div className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5 pt-1">
                        <i className="fa-solid fa-location-dot text-[var(--accent-brand)] shrink-0 mt-0.5" aria-hidden="true"></i>
                        <span className="font-medium text-[var(--text-primary)]">{order.deliveryAddress}</span>
                      </div>
                    )}
                    {isDelivery && order.deliveryDistanceKm && (
                      <p className="text-[11px] text-[var(--text-muted)] font-mono">
                        Distancia: {order.deliveryDistanceKm} km · Envío: ${order.deliveryFee?.toLocaleString('es-AR') || 0}
                      </p>
                    )}
                  </div>

                  <div className="p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1 text-xs">
                    {(order.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-2">
                        <span className="text-[var(--text-primary)] truncate">
                          <strong className="font-mono">{it.quantity}x</strong> {it.productName}
                        </span>
                        <span className="font-mono font-bold shrink-0 text-[var(--text-secondary)]">
                          ${it.subtotal?.toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                    {(order.items || []).some(it => it.notes) && (
                      <div className="pt-1.5 border-t border-[var(--border-subtle)] space-y-0.5">
                        {(order.items || []).filter(it => it.notes).map((it, idx) => (
                          <div key={idx} className="text-[11px] text-[var(--accent-brand)]">
                            {it.productName}: {it.notes}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs text-[var(--text-secondary)]">Total a cobrar</span>
                    <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                      ${(order.total || order.subtotal).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {kStatus === 'en_preparacion' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order, 'listo')}
                        className="pos-btn-secondary text-xs flex-1"
                      >
                        <i className="fa-solid fa-box text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                        <span>Listo despacho</span>
                      </button>
                    )}

                    {kStatus === 'listo' && isDelivery && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order, 'en_camino')}
                        className="pos-btn-secondary text-xs flex-1"
                      >
                        <i className="fa-solid fa-motorcycle text-xs text-[var(--status-open-fg)]" aria-hidden="true"></i>
                        <span>En camino</span>
                      </button>
                    )}

                    {(kStatus === 'listo' || kStatus === 'en_camino') && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order, 'entregado')}
                        className="pos-btn-secondary text-xs flex-1"
                      >
                        <i className="fa-solid fa-check text-xs text-[var(--status-open-fg)]" aria-hidden="true"></i>
                        <span>Entregado</span>
                      </button>
                    )}

                    {((isDelivery && kStatus === 'en_camino') || (!isDelivery && kStatus === 'listo')) && order.customerPhone && (() => {
                      const waUrl = buildWhatsAppLink(
                        order.customerPhone,
                        getDefaultDeliveryMessage({
                          customerName: order.customerName,
                          orderNumber: order.orderNumber,
                          channel: order.channel,
                          driverName: order.driverName
                        }, businessConfig)
                      );
                      if (!waUrl) return null;
                      return (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pos-btn-secondary text-xs flex-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 flex items-center justify-center gap-1.5"
                          title="Contactar al cliente por WhatsApp"
                        >
                          <i className="fa-brands fa-whatsapp text-emerald-500 text-sm" aria-hidden="true"></i>
                          <span>WhatsApp</span>
                        </a>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => setSelectedOrderForCobro(order)}
                      className="pos-btn-primary text-xs flex-1"
                    >
                      <i className="fa-solid fa-dollar-sign text-xs" aria-hidden="true"></i>
                      <span>Cobrar</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* New Delivery / Take Away Modal */}
      {isNewOrderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-modal-title"
        >
          <div className="pos-panel w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-motorcycle text-[var(--accent-brand)] text-sm" aria-hidden="true"></i>
                <div>
                  <h3 id="delivery-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                    Nuevo pedido de reparto o retiro
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Despacho a domicilio o take away con adicionales y notas a cocina
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                aria-label="Cerrar ventana"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateDeliveryOrder} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {!activeShift && (
                <div className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-xs text-[var(--status-danger-fg)] rounded flex items-center gap-2">
                  <i className="fa-solid fa-lock text-sm" aria-hidden="true"></i>
                  <span>Caja cerrada: Iniciá o abrí un turno de caja para poder despachar pedidos de delivery o take away.</span>
                </div>
              )}

              {/* Channel Selector */}
              <div>
                <label className="pos-label">Tipo de despacho:</label>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Canal de entrega">
                  <button
                    type="button"
                    aria-pressed={channelType === 'delivery'}
                    onClick={() => setChannelType('delivery')}
                    className={`min-h-[44px] px-4 rounded border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                      channelType === 'delivery'
                        ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-border)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <i className="fa-solid fa-motorcycle text-xs" aria-hidden="true"></i>
                    <span>Envío a domicilio</span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={channelType === 'take_away'}
                    onClick={() => setChannelType('take_away')}
                    className={`min-h-[44px] px-4 rounded border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                      channelType === 'take_away'
                        ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-border)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <i className="fa-solid fa-bag-shopping text-xs" aria-hidden="true"></i>
                    <span>Retiro por local (Take Away)</span>
                  </button>
                </div>
              </div>

              {/* Customer Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="del-customer-name" className="pos-label">Nombre del cliente:</label>
                  <input
                    id="del-customer-name"
                    type="text"
                    required
                    placeholder="Ej. Paula Gómez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pos-input"
                  />
                </div>
                <div>
                  <label htmlFor="del-customer-phone" className="pos-label">Teléfono / WhatsApp:</label>
                  <input
                    id="del-customer-phone"
                    type="tel"
                    placeholder="Ej. 351 512-3456 o 155123456"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pos-input font-mono"
                  />
                  {customerPhone && (() => {
                    const norm = normalizeArgentinePhone(customerPhone);
                    return (
                      <p className={`text-[11px] font-mono mt-1 ${norm ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                        {norm ? `WhatsApp: +${norm}` : 'Formato: código de área + número (sin 0 ni 15)'}
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Delivery Address & Distance */}
              {channelType === 'delivery' && (
                <div className="pos-panel p-4 space-y-3.5 bg-[var(--bg-subtle)] border-l-4 border-l-[var(--accent-brand)]">
                  <div>
                    <label htmlFor="del-address-input" className="pos-label">Dirección exacta de entrega:</label>
                    <input
                      id="del-address-input"
                      type="text"
                      required
                      placeholder="Calle y altura (ej. Av. Callao 1120)"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="pos-input"
                    />
                  </div>

                  {/* Preset Addresses Chips */}
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1.5">
                      Direcciones frecuentes para pruebas rápidas:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_ADDRESSES.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPresetAddress(p)}
                          className="text-xs px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-mono"
                        >
                          {p.address} ({p.distanceKm} km)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Distance Slider & Fee Calculation */}
                  <div className="pos-subpanel p-3 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <label htmlFor="del-distance-range" className="text-[var(--text-secondary)]">
                          Distancia calculada desde local central:
                        </label>
                        <span className="font-mono font-bold text-[var(--text-primary)]">
                          {distanceKm.toFixed(1)} km
                        </span>
                      </div>
                      <input
                        id="del-distance-range"
                        type="range"
                        min="0.3"
                        max="8.0"
                        step="0.1"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
                        className="w-full accent-[var(--accent-brand)] min-h-[44px]"
                      />

                      {/* Radial Zone Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
                          <span>0 km</span>
                          <span>1.5 km</span>
                          <span>3.0 km</span>
                          <span>Máx. {MAX_DELIVERY_RADIUS_KM} km</span>
                        </div>
                        <div className="w-full h-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              deliveryInfo.isOutOfRange ? 'bg-[var(--status-danger-bar)]' : 'bg-[var(--status-open-bar)]'
                            }`}
                            style={{ width: `${Math.min((distanceKm / MAX_DELIVERY_RADIUS_KM) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                      {deliveryInfo.isOutOfRange ? (
                        <div className="text-xs font-bold text-[var(--status-danger-fg)] flex items-center gap-1.5">
                          <i className="fa-solid fa-ban" aria-hidden="true"></i>
                          <span>Excede el límite de {MAX_DELIVERY_RADIUS_KM} km</span>
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--status-open-fg)] font-semibold">
                          <div>{deliveryInfo.zoneName}</div>
                          <div className="text-[var(--text-secondary)] font-normal">Demora est.: {deliveryInfo.estimatedTime}</div>
                        </div>
                      )}

                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-[var(--text-muted)] block">Tarifa envío</span>
                        <span
                          className={`font-mono font-bold text-base ${
                            deliveryInfo.isOutOfRange ? 'text-[var(--status-danger-fg)] line-through' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {deliveryInfo.isOutOfRange ? 'Bloqueado' : `$${deliveryInfo.fee.toLocaleString('es-AR')}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Driver Assignment */}
                  <div>
                    <label htmlFor="del-driver-select" className="pos-label">Repartidor asignado:</label>
                    <select
                      id="del-driver-select"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="pos-input bg-[var(--bg-surface)]"
                    >
                      <option value="Gastón (Moto 1)">Gastón (Moto 1)</option>
                      <option value="Matías (Moto 2)">Matías (Moto 2)</option>
                      <option value="Repartidor Propio">Repartidor Propio</option>
                      <option value="Cadetería Externa">Cadetería Externa</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Quick Dish Picker */}
              <div className="space-y-2">
                <span className="pos-label">Elegí los platos del pedido:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-2 pos-subpanel">
                  {products.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddToCart(prod)}
                      className="min-h-[60px] p-2.5 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-left transition-colors flex flex-col justify-between"
                    >
                      <span className="text-xs font-bold text-[var(--text-primary)] truncate w-full">{prod.name}</span>
                      <span className="text-xs font-mono font-bold text-[var(--accent-brand)]">
                        ${prod.price.toLocaleString('es-AR')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Items with Extras and Kitchen Notes */}
              {cartItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                      Platos seleccionados ({cartItems.reduce((acc, it) => acc + it.quantity, 0)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCartItems([])}
                      className="pos-btn-ghost text-xs px-2"
                    >
                      Vaciar
                    </button>
                  </div>

                  <div className="pos-subpanel divide-y divide-[var(--border-subtle)] px-3">
                    {cartItems.map((item, idx) => (
                      <div key={item.cartItemId} className="py-2.5 space-y-1.5 text-sm">
                        <div className="flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <span className="font-medium text-[var(--text-primary)] truncate block">
                              {item.productName}
                            </span>
                            <span className="text-xs font-mono text-[var(--text-muted)]">
                              ${item.unitPrice.toLocaleString('es-AR')} c/u
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              aria-label={`Restar ${item.productName}`}
                              onClick={() => handleUpdateQty(item.cartItemId, -1)}
                              className="pos-btn-secondary min-w-[36px] h-9 px-0"
                            >
                              -
                            </button>
                            <span className="font-bold font-mono w-6 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label={`Sumar ${item.productName}`}
                              onClick={() => handleUpdateQty(item.cartItemId, 1)}
                              className="pos-btn-secondary min-w-[36px] h-9 px-0"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              aria-label={`Eliminar ${item.productName}`}
                              onClick={() => handleRemoveItem(item.cartItemId)}
                              className="pos-btn-ghost min-w-[36px] h-9 px-0 text-[var(--status-danger-fg)]"
                            >
                              <i className="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
                            </button>
                            <span className="font-mono font-bold text-[var(--text-primary)] w-20 text-right">
                              ${item.subtotal.toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>

                        {/* Extras and Notes tags */}
                        {(item.extras?.length > 0 || item.notes) && (
                          <div className="space-y-1 pt-1">
                            {item.extras?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.extras.map(ex => (
                                  <span key={ex.id} className="pos-badge pos-badge-brand font-mono text-[11px]">
                                    +{ex.name} (${ex.price})
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <p className="text-[11px] text-[var(--status-bill-fg)] bg-[var(--status-bill-bg)] border border-[var(--status-bill-border)] px-2 py-0.5 rounded">
                                Nota cocina: {item.notes}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenItemConfig(idx)}
                            className="pos-btn-secondary text-xs px-2.5 py-1"
                          >
                            <i className="fa-solid fa-sliders text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                            <span>{item.extras?.length || item.notes ? 'Editar nota / extras' : 'Aclaración / Extras'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-[var(--text-secondary)] block">Total con envío</span>
                  <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
                    ${totalWithFee.toLocaleString('es-AR')}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !activeShift || cartItems.length === 0 || (channelType === 'delivery' && deliveryInfo.isOutOfRange)}
                  className="pos-btn-primary px-6"
                >
                  <i className="fa-solid fa-paper-plane text-xs" aria-hidden="true"></i>
                  <span>{submitting ? 'Confirmando...' : 'Confirmar y marchar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Extras & Kitchen Notes Modal */}
      {editingItemIndex !== null && cartItems[editingItemIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-item-config-title"
        >
          <div className="pos-panel w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="min-w-0">
                <h3 id="del-item-config-title" className="font-display font-bold text-base text-[var(--text-primary)] truncate">
                  Extras y nota · {cartItems[editingItemIndex].productName}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Personalizá el plato para cocina y despacho
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                aria-label="Cerrar personalización"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            {/* Quick Kitchen Notes */}
            <div className="space-y-2">
              <span className="pos-label">Aclaraciones frecuentes a cocina:</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Notas rápidas">
                {QUICK_NOTES.map(note => {
                  const isSelected = tempNotes.includes(note);
                  return (
                    <button
                      key={note}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (isSelected) {
                          setTempNotes(tempNotes.replace(note, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim());
                        } else {
                          setTempNotes(tempNotes ? `${tempNotes}, ${note}` : note);
                        }
                      }}
                      className={`min-h-[44px] px-3 rounded text-xs font-semibold border transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-brand)] text-white border-[var(--accent-brand)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {note}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Free Note Input */}
            <div>
              <label htmlFor="del-kitchen-note-input" className="pos-label">Nota personalizada para cocina:</label>
              <input
                id="del-kitchen-note-input"
                type="text"
                placeholder="Ej. Salsa picante en pote aparte, bien caliente..."
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                className="pos-input"
              />
            </div>

            {/* Additional Charged Extras */}
            <div className="space-y-2">
              <span className="pos-label">Adicionales con cargo:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {AVAILABLE_EXTRAS.map(extra => {
                  const isSelected = tempExtras.some(e => e.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleToggleExtra(extra)}
                      className={`min-h-[44px] p-2.5 rounded border text-left transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-border)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <span className="text-xs font-medium truncate">{extra.name}</span>
                      <span className="text-xs font-mono font-bold shrink-0">
                        +${extra.price.toLocaleString('es-AR')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
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
                Aplicar al plato
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderForCobro && (
        <CobroModal
          isOpen={!!selectedOrderForCobro}
          onClose={() => setSelectedOrderForCobro(null)}
          order={selectedOrderForCobro}
          onOrderClosed={refreshData}
        />
      )}
    </section>
  );
}
