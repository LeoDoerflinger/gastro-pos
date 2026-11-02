import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import CobroModal from '../cajero/CobroModal';
import { api } from '../../api/client';

// Maximum allowed delivery radius in kilometers
const MAX_DELIVERY_RADIUS_KM = 5.0;

// Local central restaurant base
const RESTAURANT_LOCATION = {
  name: 'Local Central GastroPOS',
  address: 'Av. Corrientes 1500, San Nicolás, CABA',
  lat: -34.6037,
  lng: -58.3816
};

// Preset realistic delivery zones and sample addresses
const PRESET_ADDRESSES = [
  { address: 'Talcahuano 450, Tribunales', distanceKm: 0.8 },
  { address: 'Av. Callao 1120, Recoleta Sur', distanceKm: 1.4 },
  { address: 'Av. Santa Fe 2340, Barrio Norte', distanceKm: 2.6 },
  { address: 'Av. Pueyrredón 1650, Recoleta', distanceKm: 3.4 },
  { address: 'Av. Coronel Díaz 2100, Palermo', distanceKm: 4.5 },
  { address: 'Av. Cabildo 2400, Belgrano', distanceKm: 7.2 } // Exceeds limit
];

// Calculate dynamic fee and zone based on distance
function calculateDeliveryInfo(distanceKm) {
  const dist = Number(distanceKm);
  if (isNaN(dist) || dist <= 0) {
    return {
      isValid: false,
      isOutOfRange: false,
      fee: 0,
      zoneName: 'Sin distancia',
      estimatedTime: '20-30 min'
    };
  }

  if (dist > MAX_DELIVERY_RADIUS_KM) {
    return {
      isValid: false,
      isOutOfRange: true,
      fee: 0,
      zoneName: 'Fuera de zona (Máx. 5.0 km)',
      estimatedTime: 'No disponible'
    };
  }

  if (dist <= 1.5) {
    return {
      isValid: true,
      isOutOfRange: false,
      fee: 1200,
      zoneName: 'Zona 1 (Cercanía hasta 1.5 km)',
      estimatedTime: '15 - 25 min'
    };
  } else if (dist <= 3.0) {
    return {
      isValid: true,
      isOutOfRange: false,
      fee: 1800,
      zoneName: 'Zona 2 (Media hasta 3.0 km)',
      estimatedTime: '25 - 35 min'
    };
  } else {
    return {
      isValid: true,
      isOutOfRange: false,
      fee: 2600,
      zoneName: 'Zona 3 (Límite hasta 5.0 km)',
      estimatedTime: '35 - 45 min'
    };
  }
}

export default function DeliveryManager() {
  const { orders, products, currentUser, showToast, refreshData } = useApp();

  const [channelType, setChannelType] = useState('delivery'); // 'delivery' | 'take_away'
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedOrderForCobro, setSelectedOrderForCobro] = useState(null);

  // New order form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState(1.4);
  const [driverName, setDriverName] = useState('Gastón (Moto 1)');
  const [cartItems, setCartItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Filter delivery and take away orders
  const deliveryOrders = orders.filter(
    o => (o.channel === 'delivery' || o.channel === 'take_away') && o.status !== 'cobrado'
  );

  const deliveryInfo = useMemo(() => {
    return calculateDeliveryInfo(distanceKm);
  }, [distanceKm]);

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
    setCartItems(prev => prev.map(it => {
      if (it.productId === productId) {
        const next = it.quantity + delta;
        return next > 0 ? { ...it, quantity: next, subtotal: next * it.unitPrice } : null;
      }
      return it;
    }).filter(Boolean));
  };

  const cartSubtotal = cartItems.reduce((acc, it) => acc + it.subtotal, 0);
  const totalWithFee = cartSubtotal + (channelType === 'delivery' ? (deliveryInfo.isValid ? deliveryInfo.fee : 0) : 0);

  const handleCreateDeliveryOrder = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      showToast('Ingresa el nombre del cliente', 'error');
      return;
    }
    if (channelType === 'delivery') {
      if (!deliveryAddress.trim()) {
        showToast('Ingresa la dirección de entrega', 'error');
        return;
      }
      if (deliveryInfo.isOutOfRange) {
        showToast(`La dirección está fuera del radio de reparto permitido (Máximo ${MAX_DELIVERY_RADIUS_KM} km)`, 'error');
        return;
      }
    }
    if (cartItems.length === 0) {
      showToast('Agrega al menos un producto al pedido', 'error');
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
      showToast(`Pedido de ${channelType === 'delivery' ? 'Delivery' : 'Take Away'} generado con éxito. Stock descontado.`);
      setIsNewOrderModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setDistanceKm(1.4);
      setCartItems([]);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error creando pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (order, nextStatus) => {
    try {
      await api.updateOrderStatus(order.id, { kitchenStatus: nextStatus });
      const statusLabels = {
        en_preparacion: 'En Preparación',
        listo: 'Listo para despacho',
        en_camino: 'En Camino',
        entregado: 'Entregado'
      };
      showToast(`Pedido #${order.orderNumber} pasó a: ${statusLabels[nextStatus] || nextStatus}`);
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error al actualizar estado en cocina', 'error');
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <div className="bg-[#121215] p-3 rounded border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-zinc-100 flex items-center gap-2 font-mono">
            <i className="fa-solid fa-motorcycle text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Gestión de Delivery & Take Away</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Radio de reparto restringido a {MAX_DELIVERY_RADIUS_KM} km con cálculo tarifario dinámico y verificación cartográfica.
          </p>
        </div>

        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="px-3 py-1.5 rounded bg-zinc-200 hover:bg-white text-zinc-950 font-bold text-xs shadow flex items-center gap-1.5 self-start sm:self-auto transition-colors active:scale-95"
        >
          <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
          <span>+ Nuevo Pedido</span>
        </button>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {deliveryOrders.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-500 bg-[#121215] rounded border border-[#27272a]">
            <i className="fa-solid fa-motorcycle text-2xl mb-2 text-zinc-600" aria-hidden="true"></i>
            <p className="font-bold text-xs uppercase tracking-wider text-zinc-400 font-mono">
              Sin entregas pendientes
            </p>
          </div>
        ) : (
          deliveryOrders.map(order => {
            const isDelivery = order.channel === 'delivery';
            const kStatus = order.kitchenStatus || 'en_preparacion';

            return (
              <div
                key={order.id}
                className="bg-[#121215] border border-[#27272a] rounded p-3 flex flex-col justify-between space-y-2.5 shadow-sm hover:border-zinc-700 transition-colors"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-[#27272a]">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded bg-[#18181c] border border-[#27272a] text-zinc-300 flex items-center justify-center text-xs">
                        <i className={`fa-solid ${isDelivery ? 'fa-motorcycle' : 'fa-bag-shopping'}`} aria-hidden="true"></i>
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-zinc-100 flex items-center gap-1.5 font-mono">
                          <span>#{order.orderNumber}</span>
                          <span className="text-[11px] text-zinc-400 font-normal">
                            : {isDelivery ? 'Delivery' : 'Take Away'}
                          </span>
                        </h4>
                        <div className="text-xs font-bold text-zinc-200">
                          {order.customerName}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#18181c] text-zinc-300 border border-[#27272a] font-mono">
                      {kStatus.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Contact & Address */}
                  <div className="bg-[#0e0e11] p-2 rounded border border-[#27272a] space-y-1 text-xs font-mono">
                    {order.customerPhone && (
                      <p className="text-zinc-300 flex items-center gap-1.5">
                        <i className="fa-solid fa-phone text-[10px] text-zinc-500 w-3 text-center" aria-hidden="true"></i>
                        <span>{order.customerPhone}</span>
                      </p>
                    )}
                    {order.deliveryAddress && (
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-zinc-300 flex items-start gap-1.5 leading-snug font-sans text-xs">
                          <i className="fa-solid fa-location-dot text-[11px] text-zinc-400 shrink-0 mt-0.5 w-3 text-center" aria-hidden="true"></i>
                          <span>{order.deliveryAddress}</span>
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir en Google Maps"
                          aria-label="Abrir dirección en Google Maps"
                          className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 shrink-0 text-xs"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                        </a>
                      </div>
                    )}
                    {order.deliveryDistanceKm && (
                      <p className="text-zinc-400 text-[11px] flex items-center gap-1.5">
                        <i className="fa-solid fa-route text-[10px] text-zinc-500 w-3 text-center" aria-hidden="true"></i>
                        <span>Distancia: <strong className="text-zinc-200 tabular-nums">{order.deliveryDistanceKm} km</strong></span>
                      </p>
                    )}
                    {order.driverName && (
                      <p className="text-zinc-300 flex items-center gap-1.5 text-[11px] pt-1 border-t border-[#1e1e24]">
                        <i className="fa-solid fa-user text-[10px] text-zinc-500 w-3 text-center" aria-hidden="true"></i>
                        <span>Cadete: {order.driverName}</span>
                      </p>
                    )}
                  </div>

                  {/* Items list */}
                  <div className="mt-2 text-xs space-y-0.5 text-zinc-400 font-mono">
                    {(order.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between font-sans text-[11px]">
                        <span><strong className="text-zinc-200 font-mono tabular-nums">{it.quantity}x</strong> {it.productName}</span>
                        <span className="font-mono tabular-nums text-zinc-300">${it.subtotal?.toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                    {order.deliveryFee > 0 && (
                      <div className="flex justify-between font-sans text-[10px] text-zinc-500 pt-1 border-t border-[#27272a]">
                        <span>Envío:</span>
                        <span className="font-mono tabular-nums">${order.deliveryFee.toLocaleString('es-AR')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer and progression buttons */}
                <div className="pt-2 border-t border-[#27272a] space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 uppercase text-[10px] font-mono">Total:</span>
                    <span className="font-black text-sm font-mono tabular-nums text-zinc-100">
                      ${(order.total || order.subtotal).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Status change actions */}
                    {kStatus === 'en_preparacion' && (
                      <button
                        onClick={() => handleUpdateStatus(order, 'listo')}
                        className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
                        <span>Listo</span>
                      </button>
                    )}
                    {kStatus === 'listo' && isDelivery && (
                      <button
                        onClick={() => handleUpdateStatus(order, 'en_camino')}
                        className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fa-solid fa-motorcycle text-[10px]" aria-hidden="true"></i>
                        <span>Despachar</span>
                      </button>
                    )}
                    {kStatus === 'listo' && !isDelivery && (
                      <button
                        onClick={() => handleUpdateStatus(order, 'entregado')}
                        className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fa-solid fa-hand-holding-dollar text-[10px]" aria-hidden="true"></i>
                        <span>Entregar</span>
                      </button>
                    )}
                    {kStatus === 'en_camino' && (
                      <button
                        onClick={() => handleUpdateStatus(order, 'entregado')}
                        className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
                        <span>Entregado</span>
                      </button>
                    )}
                    {kStatus === 'entregado' && (
                      <span className="py-1 px-2 rounded bg-[#0e0e11] text-zinc-500 text-xs text-center border border-[#27272a] font-mono">
                        Completado
                      </span>
                    )}

                    {/* Cobro button */}
                    <button
                      onClick={() => setSelectedOrderForCobro(order)}
                      className="py-1 px-2 rounded bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-bold shadow transition-colors flex items-center justify-center gap-1 active:scale-95 font-mono"
                    >
                      <i className="fa-solid fa-dollar-sign text-[11px]" aria-hidden="true"></i>
                      <span>Cobrar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Order Modal with Address, Maps & Distance Validator */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 animate-in fade-in">
          <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-3 bg-[#0e0e11] border-b border-[#27272a] flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm text-zinc-100 flex items-center gap-2 font-mono">
                <i className="fa-solid fa-motorcycle text-zinc-400 text-xs" aria-hidden="true"></i>
                <span>Nuevo Pedido : Delivery / Take Away</span>
              </h3>
              <button 
                onClick={() => setIsNewOrderModalOpen(false)} 
                aria-label="Cerrar modal de pedido"
                className="w-6 h-6 rounded text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateDeliveryOrder} className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {/* Channel Selector Segmented Control */}
              <div className="flex border border-[#27272a] rounded overflow-hidden divide-x divide-[#27272a] text-xs">
                <button
                  type="button"
                  onClick={() => setChannelType('delivery')}
                  className={`flex-1 py-2 font-bold flex items-center justify-center gap-2 transition-colors ${
                    channelType === 'delivery'
                      ? 'bg-zinc-200 text-zinc-950'
                      : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <i className="fa-solid fa-motorcycle text-xs" aria-hidden="true"></i>
                  <span>Envío a Domicilio (Delivery)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannelType('take_away')}
                  className={`flex-1 py-2 font-bold flex items-center justify-center gap-2 transition-colors ${
                    channelType === 'take_away'
                      ? 'bg-zinc-200 text-zinc-950'
                      : 'bg-[#15151a] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <i className="fa-solid fa-bag-shopping text-xs" aria-hidden="true"></i>
                  <span>Para Retirar (Take Away)</span>
                </button>
              </div>

              {/* Customer Inputs */}
              <div className="bg-[#0e0e11] p-3 rounded border border-[#27272a] space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1 uppercase font-mono">Nombre del Cliente:</label>
                    <input
                      type="text"
                      placeholder="Ej: Marcelo Fernández"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#15151a] border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1 uppercase font-mono">Teléfono / WhatsApp:</label>
                    <input
                      type="text"
                      placeholder="Ej: 11-4455-6677"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-[#15151a] border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
                    />
                  </div>
                </div>

                {channelType === 'delivery' && (
                  <div className="space-y-2.5 pt-2 border-t border-[#27272a]">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-zinc-300 font-bold uppercase font-mono flex items-center gap-1.5">
                          <i className="fa-solid fa-location-dot text-zinc-400 text-xs" aria-hidden="true"></i>
                          <span>Dirección de Entrega:</span>
                        </label>
                        {deliveryAddress && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono underline"
                          >
                            <span>Ver en Google Maps</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" aria-hidden="true"></i>
                          </a>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Ej: Av. Santa Fe 2340, Piso 3 A"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full bg-[#15151a] border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
                        required
                      />
                    </div>

                    {/* Quick Preset Addresses */}
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1 font-mono">
                        Zonas de reparto de referencia:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {PRESET_ADDRESSES.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectPresetAddress(preset)}
                            className="px-2 py-0.5 rounded bg-[#16161b] hover:bg-zinc-800 border border-[#27272a] text-[11px] text-zinc-300 transition-colors flex items-center gap-1 font-mono"
                          >
                            <span>{preset.address}</span>
                            <span className="text-zinc-500 tabular-nums">({preset.distanceKm} km)</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Distance & Zone Validator */}
                    <div className="bg-[#121215] p-2.5 rounded border border-[#27272a] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-300 uppercase font-mono flex items-center gap-1.5">
                          <i className="fa-solid fa-route text-zinc-400 text-xs" aria-hidden="true"></i>
                          <span>Distancia al Local:</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="15.0"
                            value={distanceKm}
                            onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                            className="w-16 bg-[#16161b] border border-zinc-700 rounded p-1 text-xs font-mono tabular-nums text-right text-zinc-100 font-bold"
                          />
                          <span className="text-xs text-zinc-400 font-mono">km</span>
                        </div>
                      </div>

                      <input
                        type="range"
                        min="0.3"
                        max="8.0"
                        step="0.1"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
                        className="w-full accent-zinc-300 cursor-pointer"
                      />

                      {/* Visual Map / Radar Canvas Indicator */}
                      <div className="bg-[#0e0e11] p-2 rounded border border-[#27272a] text-xs">
                        <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#27272a] text-[10px] font-mono">
                          <span className="text-zinc-400">Origen: {RESTAURANT_LOCATION.name}</span>
                          <span className="text-zinc-500 tabular-nums">Límite Máximo: {MAX_DELIVERY_RADIUS_KM} km</span>
                        </div>

                        {/* Interactive Visual Map Representation */}
                        <div className="relative w-full h-24 bg-[#121216] rounded border border-[#27272a] overflow-hidden flex items-center justify-center">
                          {/* Concentric Zone Circles */}
                          <div 
                            className="absolute rounded-full border border-zinc-700/60 pointer-events-none"
                            style={{ width: '85%', height: '85%' }}
                            title="Límite 5.0 km"
                          />
                          <div 
                            className="absolute rounded-full border border-dashed border-zinc-800 pointer-events-none"
                            style={{ width: '50%', height: '50%' }}
                            title="Zona 2 (3.0 km)"
                          />
                          <div 
                            className="absolute rounded-full border border-zinc-800 pointer-events-none"
                            style={{ width: '25%', height: '25%' }}
                            title="Zona 1 (1.5 km)"
                          />

                          {/* Center Restaurant Marker */}
                          <div className="absolute flex flex-col items-center z-10">
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-200 border border-black shadow"></span>
                            <span className="text-[8px] font-mono text-zinc-400 font-bold bg-black/80 px-1 rounded-sm mt-0.5">LOCAL</span>
                          </div>

                          {/* Target Customer Marker */}
                          {(() => {
                            const ratio = Math.min(distanceKm / 5.0, 1.3);
                            const offsetX = ratio * 40;
                            const offsetY = -ratio * 24;
                            const isOutOfRange = distanceKm > MAX_DELIVERY_RADIUS_KM;

                            return (
                              <div 
                                className="absolute flex flex-col items-center transition-transform duration-200 z-10"
                                style={{ transform: `translate(${offsetX * 2.8}px, ${offsetY * 1.5}px)` }}
                              >
                                <div className={`w-2.5 h-2.5 rounded-full border border-black ${isOutOfRange ? 'bg-rose-500' : 'bg-white'}`} />
                                <span className={`text-[8px] font-mono font-bold px-1 rounded-sm mt-0.5 whitespace-nowrap ${isOutOfRange ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-black/90 text-zinc-200'}`}>
                                  {distanceKm} km {isOutOfRange ? 'FUERA' : ''}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Zone details & Dynamic Fee Status */}
                        <div className="mt-2 pt-1.5 border-t border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-mono">
                          <div>
                            {deliveryInfo.isOutOfRange ? (
                              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                                <i className="fa-solid fa-triangle-exclamation text-xs" aria-hidden="true"></i>
                                <span>Fuera de zona de reparto: excede el límite máximo de {MAX_DELIVERY_RADIUS_KM} km.</span>
                              </div>
                            ) : (
                              <div className="text-zinc-300 flex items-center gap-1.5 text-[11px]">
                                <i className="fa-solid fa-circle-check text-zinc-400 text-xs" aria-hidden="true"></i>
                                <span><strong>{deliveryInfo.zoneName}</strong> : {deliveryInfo.estimatedTime}</span>
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-zinc-500 uppercase block">Costo de Envío:</span>
                            <span className={`tabular-nums font-black text-xs ${deliveryInfo.isOutOfRange ? 'text-rose-400 line-through' : 'text-zinc-100'}`}>
                              {deliveryInfo.isOutOfRange ? 'No Disponible' : `$${deliveryInfo.fee.toLocaleString('es-AR')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cadete Assignment */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1 uppercase font-mono">Cadete Asignado:</label>
                      <select
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full bg-[#15151a] border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
                      >
                        <option value="Gastón (Moto 1)">Gastón (Moto 1)</option>
                        <option value="Matías (Moto 2)">Matías (Moto 2)</option>
                        <option value="Repartidor Propio">Repartidor Propio</option>
                        <option value="Cadetería Externa">Cadetería Externa</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Selector Quick Grid */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                  Agregar Platos al Pedido:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 bg-[#0e0e11] rounded border border-[#27272a]">
                  {products.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddToCart(prod)}
                      className="p-2 rounded bg-[#141418] hover:bg-[#18181c] border border-[#27272a] text-left transition-colors flex flex-col justify-between"
                    >
                      <div className="text-xs font-bold text-zinc-200 truncate">{prod.name}</div>
                      <div className="text-[11px] font-mono tabular-nums text-zinc-300 font-bold">${prod.price.toLocaleString('es-AR')}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart Items List */}
              {cartItems.length > 0 && (
                <div className="bg-[#0e0e11] p-2.5 rounded border border-[#27272a] space-y-1 text-xs">
                  <div className="font-bold text-zinc-500 text-[10px] uppercase pb-1 border-b border-[#27272a] font-mono">
                    Platos seleccionados ({cartItems.length}):
                  </div>
                  {cartItems.map(item => (
                    <div key={item.productId} className="flex justify-between items-center text-zinc-200 py-0.5">
                      <span className="truncate pr-2">{item.name || item.productName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => handleUpdateQty(item.productId, -1)} className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs flex items-center justify-center">-</button>
                        <span className="font-bold font-mono tabular-nums w-4 text-center">{item.quantity}</span>
                        <button type="button" onClick={() => handleUpdateQty(item.productId, 1)} className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs flex items-center justify-center">+</button>
                        <span className="font-mono tabular-nums text-zinc-300 ml-2">${item.subtotal.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total & Submit */}
              <div className="pt-2.5 border-t border-[#27272a] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Total Pedido:</span>
                  <span className="text-lg font-black font-mono tabular-nums text-zinc-100">
                    ${totalWithFee.toLocaleString('es-AR')}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || cartItems.length === 0 || (channelType === 'delivery' && deliveryInfo.isOutOfRange)}
                  className={`px-4 py-2 rounded font-bold text-xs shadow transition-colors flex items-center gap-1.5 font-mono ${
                    deliveryInfo.isOutOfRange && channelType === 'delivery'
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : 'bg-zinc-200 hover:bg-white text-zinc-950 font-black'
                  }`}
                >
                  <i className="fa-solid fa-paper-plane text-xs" aria-hidden="true"></i>
                  <span>{submitting ? 'Creando...' : 'Crear y Despachar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cobro Modal */}
      {selectedOrderForCobro && (
        <CobroModal
          isOpen={!!selectedOrderForCobro}
          onClose={() => setSelectedOrderForCobro(null)}
          order={selectedOrderForCobro}
          onOrderClosed={refreshData}
        />
      )}
    </div>
  );
}