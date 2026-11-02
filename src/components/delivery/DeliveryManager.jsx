import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import CobroModal from '../cajero/CobroModal';
import { api } from '../../api/client';

const MAX_DELIVERY_RADIUS_KM = 5.0;

const RESTAURANT_LOCATION = {
  name: 'Local Central GastroPOS',
  address: 'Av. Corrientes 1500, San Nicolás, CABA',
  lat: -34.6037,
  lng: -58.3816
};

const PRESET_ADDRESSES = [
  { address: 'Talcahuano 450, Tribunales', distanceKm: 0.8 },
  { address: 'Av. Callao 1120, Recoleta Sur', distanceKm: 1.4 },
  { address: 'Av. Santa Fe 2340, Barrio Norte', distanceKm: 2.6 },
  { address: 'Av. Pueyrredón 1650, Recoleta', distanceKm: 3.4 },
  { address: 'Av. Coronel Díaz 2100, Palermo', distanceKm: 4.5 },
  { address: 'Av. Cabildo 2400, Belgrano', distanceKm: 7.2 }
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
  const { orders, products, currentUser, showToast, refreshData } = useApp();

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

  useEffect(() => {
    if (!isNewOrderModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsNewOrderModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNewOrderModalOpen]);

  const deliveryOrders = orders.filter(
    o => (o.channel === 'delivery' || o.channel === 'take_away') && o.status !== 'cobrado'
  );

  const deliveryInfo = useMemo(() => calculateDeliveryInfo(distanceKm), [distanceKm]);

  const handleSelectPresetAddress = (preset) => {
    setDeliveryAddress(preset.address);
    setDistanceKm(preset.distanceKm);
  };

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(it => it.productId === product.id);
      if (existing) {
        return prev.map(it =>
          it.productId === product.id
            ? { ...it, quantity: it.quantity + 1, subtotal: (it.quantity + 1) * it.unitPrice }
            : it
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          subtotal: product.price,
          notes: ''
        }
      ];
    });
  };

  const handleUpdateQty = (productId, delta) => {
    setCartItems(prev =>
      prev
        .map(it => {
          if (it.productId === productId) {
            const next = it.quantity + delta;
            return next > 0 ? { ...it, quantity: next, subtotal: next * it.unitPrice } : null;
          }
          return it;
        })
        .filter(Boolean)
    );
  };

  const cartSubtotal = cartItems.reduce((acc, it) => acc + it.subtotal, 0);
  const totalWithFee = cartSubtotal + (channelType === 'delivery' ? (deliveryInfo.isValid ? deliveryInfo.fee : 0) : 0);

  const handleCreateDeliveryOrder = async (e) => {
    e.preventDefault();
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
      const orderData = {
        channel: channelType,
        customerName,
        customerPhone,
        deliveryAddress: channelType === 'delivery' ? deliveryAddress : null,
        deliveryDistanceKm: channelType === 'delivery' ? Number(distanceKm) : null,
        deliveryFee: channelType === 'delivery' ? deliveryInfo.fee : 0,
        driverName: channelType === 'delivery' ? driverName : null,
        kitchenStatus: 'en_preparacion',
        items: cartItems
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
    `${deliveryAddress.trim() || RESTAURANT_LOCATION.address}, Buenos Aires, Argentina`
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
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-brand)] flex items-center justify-center text-sm shrink-0">
                        <i className={`fa-solid ${isDelivery ? 'fa-motorcycle' : 'fa-bag-shopping'}`} aria-hidden="true"></i>
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[var(--text-secondary)]">
                          #{order.orderNumber} · {isDelivery ? 'Delivery' : 'Take Away'}
                        </div>
                        <h3 className="font-display font-bold text-base text-[var(--text-primary)] truncate">
                          {order.customerName}
                        </h3>
                      </div>
                    </div>

                    <span className={`pos-badge ${statusText.cls} shrink-0`}>
                      {statusText.label}
                    </span>
                  </div>

                  {/* Customer & Route Details */}
                  <div className="pos-subpanel p-3 space-y-1.5 text-xs">
                    {order.customerPhone && (
                      <p className="text-[var(--text-primary)] font-mono flex items-center gap-2">
                        <i className="fa-solid fa-phone text-[var(--text-muted)] w-3.5 text-center" aria-hidden="true"></i>
                        <span>{order.customerPhone}</span>
                      </p>
                    )}
                    {order.deliveryAddress && (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[var(--text-primary)] flex items-start gap-2 leading-snug">
                          <i className="fa-solid fa-location-dot text-[var(--accent-brand)] shrink-0 mt-0.5 w-3.5 text-center" aria-hidden="true"></i>
                          <span>{order.deliveryAddress}</span>
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress + ', CABA')}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir en Google Maps"
                          aria-label={`Ver ${order.deliveryAddress} en Google Maps`}
                          className="pos-btn-secondary px-2.5 shrink-0"
                        >
                          <i className="fa-solid fa-map-location-dot text-xs" aria-hidden="true"></i>
                        </a>
                      </div>
                    )}
                    {order.deliveryDistanceKm && (
                      <p className="text-[var(--text-secondary)] flex items-center gap-2">
                        <i className="fa-solid fa-route text-[var(--text-muted)] w-3.5 text-center" aria-hidden="true"></i>
                        <span>
                          Distancia: <strong className="font-mono text-[var(--text-primary)]">{order.deliveryDistanceKm} km</strong>
                        </span>
                      </p>
                    )}
                    {order.driverName && (
                      <p className="text-[var(--text-secondary)] flex items-center gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
                        <i className="fa-solid fa-helmet-safety text-[var(--text-muted)] w-3.5 text-center" aria-hidden="true"></i>
                        <span>Repartidor: <strong className="text-[var(--text-primary)]">{order.driverName}</strong></span>
                      </p>
                    )}
                  </div>

                  {/* Items */}
                  <div className="space-y-1 text-xs">
                    {(order.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between gap-2 text-[var(--text-secondary)]">
                        <span className="truncate">
                          <strong className="font-mono text-[var(--text-primary)]">{it.quantity}x</strong> {it.productName}
                        </span>
                        <span className="font-mono text-[var(--text-primary)] shrink-0">
                          ${it.subtotal?.toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                    {order.deliveryFee > 0 && (
                      <div className="flex justify-between text-xs text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
                        <span>Envío</span>
                        <span className="font-mono">${order.deliveryFee.toLocaleString('es-AR')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer & Stage Controls */}
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Total pedido</span>
                    <span className="font-mono font-bold text-lg text-[var(--text-primary)]">
                      ${(order.total || order.subtotal).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {kStatus === 'en_preparacion' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order, 'listo')}
                        className="pos-btn-secondary text-xs"
                      >
                        <i className="fa-solid fa-check text-xs text-[var(--status-open-fg)]" aria-hidden="true"></i>
                        <span>Marcar listo</span>
                      </button>
                    )}
                    {kStatus === 'listo' && isDelivery && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order, 'en_camino')}
                        className="pos-btn-secondary text-xs"
                      >
                        <i className="fa-solid fa-motorcycle text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                        <span>Despachar</span>
                      </button>
                    )}
                    {kStatus === 'listo' && !isDelivery && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order, 'entregado')}
                        className="pos-btn-secondary text-xs"
                      >
                        <i className="fa-solid fa-bag-shopping text-xs text-[var(--status-open-fg)]" aria-hidden="true"></i>
                        <span>Entregar</span>
                      </button>
                    )}
                    {kStatus === 'en_camino' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order, 'entregado')}
                        className="pos-btn-secondary text-xs"
                      >
                        <i className="fa-solid fa-circle-check text-xs text-[var(--status-open-fg)]" aria-hidden="true"></i>
                        <span>Entregado</span>
                      </button>
                    )}
                    {kStatus === 'entregado' && (
                      <span className="min-h-[44px] rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] text-xs font-semibold border border-[var(--border-subtle)] flex items-center justify-center">
                        Completado
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedOrderForCobro(order)}
                      className="pos-btn-primary text-xs"
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

      {/* New Order Modal with Live Maps & Dynamic Zone Validator */}
      {isNewOrderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-delivery-modal-title"
        >
          <div className="pos-panel w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
              <h3 id="new-delivery-modal-title" className="font-display font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                <i className="fa-solid fa-motorcycle text-[var(--accent-brand)] text-sm" aria-hidden="true"></i>
                <span>Nuevo pedido · Delivery o Take Away</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                aria-label="Cerrar ventana"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleCreateDeliveryOrder} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Channel Segmented Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={channelType === 'delivery'}
                  onClick={() => setChannelType('delivery')}
                  className={channelType === 'delivery' ? 'pos-btn-primary' : 'pos-btn-secondary'}
                >
                  <i className="fa-solid fa-motorcycle text-xs" aria-hidden="true"></i>
                  <span>Envío a domicilio</span>
                </button>
                <button
                  type="button"
                  aria-pressed={channelType === 'take_away'}
                  onClick={() => setChannelType('take_away')}
                  className={channelType === 'take_away' ? 'pos-btn-primary' : 'pos-btn-secondary'}
                >
                  <i className="fa-solid fa-bag-shopping text-xs" aria-hidden="true"></i>
                  <span>Retira en local (Take Away)</span>
                </button>
              </div>

              {/* Customer Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="del-customer-name" className="pos-label">Nombre del cliente:</label>
                  <input
                    id="del-customer-name"
                    type="text"
                    placeholder="Ej. Marcelo Fernández"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pos-input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="del-customer-phone" className="pos-label">Teléfono / WhatsApp:</label>
                  <input
                    id="del-customer-phone"
                    type="tel"
                    placeholder="Ej. 11-4455-6677"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pos-input font-mono"
                  />
                </div>
              </div>

              {/* Delivery Specific: Address, Live Maps & 5km Radius Validator */}
              {channelType === 'delivery' && (
                <div className="pos-subpanel p-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label htmlFor="del-address-input" className="text-xs font-bold text-[var(--text-primary)]">
                        Dirección exacta de entrega:
                      </label>
                      {deliveryAddress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress + ', CABA')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[var(--accent-brand)] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Abrir en Google Maps</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true"></i>
                        </a>
                      )}
                    </div>
                    <input
                      id="del-address-input"
                      type="text"
                      placeholder="Ej. Av. Santa Fe 2340, Piso 3 A"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="pos-input bg-[var(--bg-surface)]"
                      required
                    />
                  </div>

                  {/* Quick Preset Reference Zones */}
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-secondary)] block mb-1.5">
                      Probar direcciones de referencia:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_ADDRESSES.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPresetAddress(preset)}
                          className="min-h-[44px] px-3 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{preset.address}</span>
                          <span className={`font-mono font-bold ${preset.distanceKm > MAX_DELIVERY_RADIUS_KM ? 'text-[var(--status-danger-fg)]' : 'text-[var(--text-secondary)]'}`}>
                            ({preset.distanceKm} km)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Split Map Preview + Distance Gauge */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Live Google Maps Embed with reserved height (R-40) */}
                    <div className="rounded border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface)] flex flex-col">
                      <div className="px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          <i className="fa-solid fa-map-location-dot text-[var(--accent-brand)]" aria-hidden="true"></i>
                          <span>Vista en Maps</span>
                        </span>
                        <span className="text-[var(--text-muted)] truncate max-w-[180px]">
                          {deliveryAddress || RESTAURANT_LOCATION.address}
                        </span>
                      </div>
                      <iframe
                        title="Mapa de ubicación de entrega"
                        src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                        width="400"
                        height="180"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="w-full h-[180px] border-0 block"
                      />
                    </div>

                    {/* Dynamic Distance & Radius Validator */}
                    <div className="pos-elevated p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor="del-distance-number" className="text-xs font-bold text-[var(--text-primary)]">
                            Distancia desde el local:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="del-distance-number"
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="15.0"
                              value={distanceKm}
                              onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                              className="pos-input w-20 font-mono text-right font-bold py-1"
                            />
                            <span className="text-xs font-mono text-[var(--text-secondary)]">km</span>
                          </div>
                        </div>

                        <label htmlFor="del-distance-range" className="text-xs font-semibold text-[var(--text-secondary)] block">
                          Deslizar radio de entrega:
                        </label>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 pos-subpanel">
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

              {/* Selected Items */}
              {cartItems.length > 0 && (
                <div className="pos-subpanel divide-y divide-[var(--border-subtle)] px-3">
                  {cartItems.map(item => (
                    <div key={item.productId} className="flex justify-between items-center py-2 text-sm gap-2">
                      <span className="font-medium text-[var(--text-primary)] truncate">{item.productName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label={`Restar ${item.productName}`}
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          className="pos-btn-secondary min-w-[44px] px-0"
                        >
                          -
                        </button>
                        <span className="font-bold font-mono w-6 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Sumar ${item.productName}`}
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          className="pos-btn-secondary min-w-[44px] px-0"
                        >
                          +
                        </button>
                        <span className="font-mono font-bold text-[var(--text-primary)] w-20 text-right">
                          ${item.subtotal.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  ))}
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
                  disabled={submitting || cartItems.length === 0 || (channelType === 'delivery' && deliveryInfo.isOutOfRange)}
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
