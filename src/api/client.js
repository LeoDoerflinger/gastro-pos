const API_BASE = '/api';
const LOCAL_DB_KEY = 'gastro_pos_db_v3';
export const SYNC_CHANNEL_NAME = 'gastro_pos_sync';
export { isShiftActive, formatUserRoleDisplay } from '../utils/userRoleHelper';
import { isShiftActive, formatUserRoleDisplay } from '../utils/userRoleHelper';

const ROLE_LABELS = {
  admin: 'Admin',
  cajero: 'Cajero',
  mozo: 'Mozo'
};

export function normalizeUsersRoleNames(users = []) {
  const counts = {};
  for (const u of users) {
    const r = u.role || 'mozo';
    counts[r] = (counts[r] || 0) + 1;
  }
  const indices = {};
  for (const u of users) {
    const r = u.role || 'mozo';
    const base = ROLE_LABELS[r] || 'Usuario';
    if (counts[r] > 1) {
      indices[r] = (indices[r] || 0) + 1;
      u.name = `${base} ${indices[r]}`;
    } else {
      u.name = base;
    }
  }
  return users;
}

function getTableCodeForClient(table) {
  if (!table) return 'Mostrador';
  const sector = (table.sector || 'Salón').trim();
  return `${sector.charAt(0).toUpperCase()}${table.number}`;
}

function formatDateAr(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTimeAr(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function normalizeClientDb(db) {
  if (!db) return db;
  if (!Array.isArray(db.users)) db.users = [];
  normalizeUsersRoleNames(db.users);
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (Array.isArray(db.tables)) {
    db.tables.forEach(t => {
      if (t.status === 'cuenta_pedida') t.status = 'pendiente_cobro';
    });
  }
  if (Array.isArray(db.orders)) {
    db.orders.forEach(o => {
      if (o.status === 'cuenta_pedida') o.status = 'pendiente_cobro';
      const waiter = db.users.find(u => u.id === o.waiterId);
      if (waiter) o.waiterName = waiter.name;
    });
  }
  if (Array.isArray(db.cashShifts)) {
    db.cashShifts.forEach(s => {
      if (s.status === 'abierto') s.status = 'abierta';
      if (!s.openedDate && s.openedAt) s.openedDate = formatDateAr(s.openedAt);
      if (!s.openedTime && s.openedAt) s.openedTime = formatTimeAr(s.openedAt);
      if (!s.closedDate && s.closedAt) s.closedDate = formatDateAr(s.closedAt);
      if (!s.closedTime && s.closedAt) s.closedTime = formatTimeAr(s.closedAt);
      const cashier = db.users.find(u => u.id === s.cashierId);
      if (cashier) s.cashierName = cashier.name;
    });
  }
  return db;
}

function pushClientNotification(db, notifData) {
  if (!Array.isArray(db.notifications)) db.notifications = [];
  const notif = {
    id: notifData.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
    type: notifData.type || 'comanda',
    title: notifData.title || 'Nuevo aviso',
    message: notifData.message || '',
    orderId: notifData.orderId || null,
    orderNumber: notifData.orderNumber || null,
    tableId: notifData.tableId || null,
    tableCode: notifData.tableCode || null,
    channel: notifData.channel || 'mesa',
    waiterName: notifData.waiterName || 'Mozo',
    total: Number(notifData.total) || 0,
    items: Array.isArray(notifData.items) ? notifData.items : [],
    createdAt: notifData.createdAt || new Date().toISOString(),
    read: false
  };
  db.notifications.unshift(notif);
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }
  return notif;
}

let memoryDb = null;
let initPromise = null;
let syncChannel = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
} catch (e) {}

function loadLocalDb(forceFromStorage = false) {
  if (memoryDb && !forceFromStorage) return memoryDb;
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.tables)) {
        memoryDb = normalizeClientDb(parsed);
        return memoryDb;
      }
    }
  } catch (e) {}
  return null;
}

function saveLocalDb(db, options = {}) {
  const { touch = true, broadcast = true } = options;
  normalizeClientDb(db);
  if (touch) {
    db.lastUpdated = Date.now();
  } else if (db.lastUpdated === undefined) {
    db.lastUpdated = 0;
  }
  memoryDb = db;
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch (e) {}
  if (broadcast) {
    try {
      syncChannel?.postMessage({ type: 'DB_UPDATED', lastUpdated: db.lastUpdated });
    } catch (e) {}
    rawFetchJson('/state/sync', {
      method: 'POST',
      body: JSON.stringify({ clientState: db })
    }).catch(() => {});
  }
  return db;
}

async function rawFetchJson(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

async function ensureDbInitialized() {
  const existing = loadLocalDb();
  if (existing) return existing;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const snapshot = await rawFetchJson('/state');
        if (snapshot && Array.isArray(snapshot.users) && Array.isArray(snapshot.tables)) {
          return saveLocalDb(snapshot, { touch: false, broadcast: false });
        }
      } catch (e) {}

      const [
        users,
        tables,
        products,
        ingredients,
        orders,
        cashShifts,
        suppliers,
        purchases,
        stockLog
      ] = await Promise.all([
        rawFetchJson('/users'),
        rawFetchJson('/tables'),
        rawFetchJson('/products'),
        rawFetchJson('/ingredients'),
        rawFetchJson('/orders'),
        rawFetchJson('/cash-shifts'),
        rawFetchJson('/suppliers'),
        rawFetchJson('/purchases'),
        rawFetchJson('/stock-log')
      ]);

      const db = {
        users: users || [],
        tables: tables || [],
        products: products || [],
        ingredients: ingredients || [],
        orders: orders || [],
        cashShifts: cashShifts || [],
        suppliers: suppliers || [],
        purchases: purchases || [],
        stockLog: stockLog || [],
        notifications: [],
        lastUpdated: Date.now(),
        historicalSales: [
          {
            id: 'sale_prev_1',
            orderNumber: 98,
            channel: 'mesa',
            tableNumber: 1,
            total: 31200,
            paymentMethod: 'efectivo',
            closedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
            waiterName: 'Mozo 1'
          },
          {
            id: 'sale_prev_2',
            orderNumber: 99,
            channel: 'mostrador',
            tableNumber: null,
            total: 16000,
            paymentMethod: 'mercadopago',
            closedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
            waiterName: 'Cajero'
          },
          {
            id: 'sale_prev_3',
            orderNumber: 100,
            channel: 'delivery',
            tableNumber: null,
            total: 28500,
            paymentMethod: 'debito',
            closedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
            waiterName: 'Cajero'
          }
        ]
      };
      return saveLocalDb(db, { touch: false, broadcast: false });
    })().finally(() => {
      initPromise = null;
    });
  }

  return initPromise;
}

function computeAnalyticsFromDb(db) {
  const orders = db.orders || [];
  const closedOrders = orders.filter(o => o.status === 'cobrado');
  const historical = db.historicalSales || [];

  const totalVentas =
    closedOrders.reduce((sum, o) => sum + (o.total || 0), 0) +
    historical.reduce((sum, h) => sum + (h.total || 0), 0);

  const totalTickets = closedOrders.length + historical.length;
  const ticketPromedio = totalTickets > 0 ? Math.round(totalVentas / totalTickets) : 0;

  const byChannel = { mesa: 0, mostrador: 0, take_away: 0, delivery: 0 };
  [...closedOrders, ...historical].forEach(o => {
    const ch = o.channel || 'mesa';
    byChannel[ch] = (byChannel[ch] || 0) + (o.total || 0);
  });

  const byPaymentMethod = { efectivo: 0, debito: 0, credito: 0, mercadopago: 0, transferencia: 0 };
  [...closedOrders, ...historical].forEach(o => {
    const pm = o.paymentMethod || 'efectivo';
    byPaymentMethod[pm] = (byPaymentMethod[pm] || 0) + (o.total || 0);
  });

  const productCounts = {};
  closedOrders.forEach(o => {
    (o.items || []).forEach(it => {
      productCounts[it.productName] = (productCounts[it.productName] || 0) + (Number(it.quantity) || 1);
    });
  });

  const topProducts = Object.entries(productCounts)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const lowStockIngredients = (db.ingredients || []).filter(i => i.stock <= i.minStock);

  return {
    totalVentas,
    totalTickets,
    ticketPromedio,
    byChannel,
    byPaymentMethod,
    topProducts,
    lowStockIngredients,
    activeOrdersCount: orders.filter(o => o.status === 'abierto' || o.status === 'cuenta_solicitada' || o.status === 'pendiente_cobro' || o.status === 'cuenta_pedida').length,
    openTablesCount: (db.tables || []).filter(t => t.status !== 'libre').length
  };
}

export const api = {
  loginWithPin: async (pin) => {
    const db = await ensureDbInitialized();
    const cleanPin = String(pin || '').trim();
    const localUser = (db.users || []).find(u => String(u.pin).trim() === cleanPin);

    if (localUser) {
      rawFetchJson('/auth/login-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: cleanPin })
      }).catch(() => {});
      return { user: localUser };
    }

    const res = await rawFetchJson('/auth/login-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: cleanPin })
    });
    if (res?.user) {
      const exists = db.users.some(u => u.id === res.user.id);
      if (!exists) {
        db.users.push(res.user);
        saveLocalDb(db);
      }
    }
    return res;
  },

  getUsers: async () => {
    const db = await ensureDbInitialized();
    return (db.users || []).map(u => ({ ...u }));
  },

  createUser: async (userData) => {
    const db = await ensureDbInitialized();
    const cleanPin = String(userData.pin || '').trim();
    if (!cleanPin || cleanPin.length !== 4) {
      throw new Error('Ingresá un PIN numérico de 4 dígitos');
    }
    const duplicate = (db.users || []).find(u => String(u.pin).trim() === cleanPin);
    if (duplicate) {
      throw new Error(`El PIN ${cleanPin} ya está asignado a ${duplicate.name}`);
    }

    const role = userData.role || 'mozo';
    const newUser = {
      id: 'u_' + Date.now(),
      name: ROLE_LABELS[role] || 'Usuario',
      role,
      pin: cleanPin,
      email: userData.email || '',
      avatar:
        userData.avatar ||
        (role === 'admin'
          ? 'fa-solid fa-user-shield'
          : role === 'cajero'
          ? 'fa-solid fa-cash-register'
          : 'fa-solid fa-user-tie')
    };

    rawFetchJson('/users', { method: 'POST', body: JSON.stringify(newUser) }).catch(() => {});
    db.users.push(newUser);
    normalizeUsersRoleNames(db.users);
    saveLocalDb(db);
    return db.users.find(u => u.id === newUser.id) || newUser;
  },

  updateUser: async (id, updates = {}) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(() => {});

    const user = (db.users || []).find(u => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');

    if (updates.pin) {
      const cleanPin = String(updates.pin).trim();
      if (cleanPin.length !== 4) throw new Error('Ingresá un PIN válido de 4 dígitos');
      const conflict = (db.users || []).find(u => u.id !== id && String(u.pin).trim() === cleanPin);
      if (conflict) throw new Error(`El PIN ${cleanPin} ya está asignado a otro usuario`);
      user.pin = cleanPin;
    }

    if (typeof updates.name === 'string' && updates.name.trim()) {
      user.name = updates.name.trim();
    }
    if (typeof updates.email === 'string') {
      user.email = updates.email.trim();
    }
    if (updates.role && updates.role !== user.role) {
      user.role = updates.role;
      user.avatar = updates.avatar || (user.role === 'admin' ? 'fa-solid fa-user-shield' : user.role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie');
      normalizeUsersRoleNames(db.users);
    }
    saveLocalDb(db);
    return user;
  },

  deleteUser: async (id) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/users/${id}`, { method: 'DELETE' }).catch(() => {});
    db.users = (db.users || []).filter(u => u.id !== id);
    normalizeUsersRoleNames(db.users);
    saveLocalDb(db);
    return { success: true };
  },

  getNotifications: async () => {
    const db = await ensureDbInitialized();
    return [...(db.notifications || [])];
  },

  markNotificationRead: async (id) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
    const notif = (db.notifications || []).find(n => n.id === id);
    if (notif) {
      notif.read = true;
      saveLocalDb(db);
    }
    return notif;
  },

  markAllNotificationsRead: async () => {
    const db = await ensureDbInitialized();
    rawFetchJson('/notifications/read-all', { method: 'POST' }).catch(() => {});
    (db.notifications || []).forEach(n => {
      n.read = true;
    });
    saveLocalDb(db);
    return { ok: true };
  },

  getTables: async () => {
    const db = await ensureDbInitialized();
    return (db.tables || []).map(t => ({ ...t }));
  },

  updateTable: async (id, updates) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/tables/${id}`, { method: 'PUT', body: JSON.stringify(updates) }).catch(() => {});
    const table = (db.tables || []).find(t => t.id === id);
    if (!table) throw new Error('Mesa no encontrada');
    Object.assign(table, updates);
    saveLocalDb(db);
    return { ...table };
  },

  createTable: async (tableData) => {
    const db = await ensureDbInitialized();
    const nextNumber = Math.max(0, ...(db.tables || []).map(t => t.number || 0)) + 1;
    const newTable = {
      id: 'm_' + Date.now(),
      number: Number(tableData.number) || nextNumber,
      sector: tableData.sector || 'Salón Principal',
      capacity: Number(tableData.capacity) || 4,
      status: 'libre',
      activeOrderId: null,
      diners: 0,
      waiterId: null,
      openedAt: null
    };
    rawFetchJson('/tables', { method: 'POST', body: JSON.stringify(newTable) }).catch(() => {});
    db.tables.push(newTable);
    saveLocalDb(db);
    return newTable;
  },

  deleteTable: async (id) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/tables/${id}`, { method: 'DELETE' }).catch(() => {});
    db.tables = (db.tables || []).filter(t => t.id !== id);
    saveLocalDb(db);
    return { success: true };
  },

  getProducts: async () => {
    const db = await ensureDbInitialized();
    return [...(db.products || [])];
  },

  createProduct: async (productData) => {
    const db = await ensureDbInitialized();
    const newProduct = {
      id: 'prod_' + Date.now(),
      name: productData.name,
      category: productData.category,
      price: Number(productData.price),
      description: productData.description || '',
      badge: productData.badge || 'fa-solid fa-utensils',
      recipe: Array.isArray(productData.recipe) ? productData.recipe : []
    };
    rawFetchJson('/products', { method: 'POST', body: JSON.stringify(newProduct) }).catch(() => {});
    db.products.push(newProduct);
    saveLocalDb(db);
    return newProduct;
  },

  updateProduct: async (id, updates) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/products/${id}`, { method: 'PUT', body: JSON.stringify(updates) }).catch(() => {});
    const prod = (db.products || []).find(p => p.id === id);
    if (!prod) throw new Error('Producto no encontrado');
    if (updates.price !== undefined) updates.price = Number(updates.price);
    Object.assign(prod, updates);
    saveLocalDb(db);
    return { ...prod };
  },

  deleteProduct: async (id) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/products/${id}`, { method: 'DELETE' }).catch(() => {});
    db.products = (db.products || []).filter(p => p.id !== id);
    saveLocalDb(db);
    return { success: true };
  },

  getIngredients: async () => {
    const db = await ensureDbInitialized();
    return [...(db.ingredients || [])];
  },

  createIngredient: async (ingData) => {
    const db = await ensureDbInitialized();
    const newIng = {
      id: 'ing_' + Date.now(),
      name: ingData.name,
      category: ingData.category || 'Almacén',
      unit: ingData.unit || 'kg',
      stock: Number(ingData.stock) || 0,
      minStock: Number(ingData.minStock) || 0,
      costPerUnit: Number(ingData.costPerUnit) || 0,
      lastUpdated: new Date().toISOString()
    };
    rawFetchJson('/ingredients', { method: 'POST', body: JSON.stringify(newIng) }).catch(() => {});
    db.ingredients.push(newIng);
    saveLocalDb(db);
    return newIng;
  },

  updateIngredient: async (id, updates) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(updates) }).catch(() => {});
    const ing = (db.ingredients || []).find(i => i.id === id);
    if (!ing) throw new Error('Ingrediente no encontrado');
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);
    if (updates.minStock !== undefined) updates.minStock = Number(updates.minStock);
    if (updates.costPerUnit !== undefined) updates.costPerUnit = Number(updates.costPerUnit);
    updates.lastUpdated = new Date().toISOString();
    Object.assign(ing, updates);
    saveLocalDb(db);
    return { ...ing };
  },

  adjustStock: async (id, payload) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/ingredients/${id}/adjust`, { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
    const ing = (db.ingredients || []).find(i => i.id === id);
    if (!ing) throw new Error('Ingrediente no encontrado');

    const quantityChange = Number(payload.quantityChange) || 0;
    ing.stock = Math.max(0, Number((ing.stock + quantityChange).toFixed(3)));
    ing.lastUpdated = new Date().toISOString();

    const logEntry = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      ingredientId: ing.id,
      ingredientName: ing.name,
      type: payload.type || 'ajuste_manual',
      change: `${quantityChange > 0 ? '+' : ''}${quantityChange} ${ing.unit}`,
      resultingStock: ing.stock,
      reason: payload.reason || 'Ajuste manual de inventario',
      user: payload.user || 'Usuario'
    };
    if (!db.stockLog) db.stockLog = [];
    db.stockLog.unshift(logEntry);
    saveLocalDb(db);
    return { ingredient: { ...ing }, log: logEntry };
  },

  getStockLog: async () => {
    const db = await ensureDbInitialized();
    return [...(db.stockLog || [])];
  },

  getOrders: async () => {
    const db = await ensureDbInitialized();
    return (db.orders || []).map(o => ({ ...o, items: [...(o.items || [])] }));
  },

  getOrderById: async (id) => {
    const db = await ensureDbInitialized();
    return (db.orders || []).find(o => o.id === id) || null;
  },

  createOrder: async (orderData, user) => {
    const db = await ensureDbInitialized();
    const activeShift = (db.cashShifts || []).find(isShiftActive);
    if (!activeShift) {
      throw new Error('La caja se encuentra cerrada. Iniciá un turno de caja para realizar comandas o adiciones.');
    }
    const nextOrderNumber = Math.max(100, ...(db.orders || []).map(o => o.orderNumber || 0)) + 1;
    const subtotal = (orderData.items || []).reduce((acc, it) => acc + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
    const deliveryFee = Number(orderData.deliveryFee) || 0;
    const discount = Number(orderData.discount) || 0;
    const tip = Number(orderData.tip) || 0;
    const total = subtotal + deliveryFee - discount + tip;
    const assignedWaiterName = formatUserRoleDisplay(user?.name || orderData.waiterName, user?.role, db.users);

    const newOrder = {
      id: 'ord_' + Date.now(),
      orderNumber: nextOrderNumber,
      channel: orderData.channel || 'mesa',
      tableId: orderData.tableId || null,
      tableNumber: orderData.tableNumber || null,
      customerName: orderData.customerName || null,
      customerPhone: orderData.customerPhone || null,
      deliveryAddress: orderData.deliveryAddress || null,
      deliveryDistanceKm: orderData.deliveryDistanceKm || null,
      deliveryFee,
      driverName: orderData.driverName || null,
      waiterId: user?.id || orderData.waiterId || null,
      waiterName: assignedWaiterName,
      status: 'abierto',
      kitchenStatus: orderData.kitchenStatus || 'en_preparacion',
      diners: Number(orderData.diners) || 1,
      items: (orderData.items || []).map((it, idx) => ({
        id: 'item_' + Date.now() + '_' + idx,
        productId: it.productId,
        productName: it.productName,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        subtotal: (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
        notes: it.notes || ''
      })),
      subtotal,
      discount,
      tip,
      total,
      paymentMethod: orderData.paymentMethod || null,
      createdAt: new Date().toISOString(),
      closedAt: null,
      closedBy: null
    };

    rawFetchJson('/orders', {
      method: 'POST',
      body: JSON.stringify({ orderData, user })
    }).catch(() => {});

    // Stock is intentionally NOT deducted on order creation (only via manual adjustment or supplier purchase)
    db.orders.unshift(newOrder);

    let tableCode = 'Mostrador';
    if (newOrder.channel === 'mesa' && newOrder.tableId) {
      const table = (db.tables || []).find(t => t.id === newOrder.tableId);
      if (table) {
        table.status = 'ocupada';
        table.activeOrderId = newOrder.id;
        table.diners = newOrder.diners;
        table.waiterId = newOrder.waiterId;
        table.openedAt = new Date().toISOString();
        tableCode = getTableCodeForClient(table);
      }
    } else if (newOrder.channel === 'delivery') {
      tableCode = 'Delivery';
    } else if (newOrder.channel === 'take_away') {
      tableCode = 'Take Away';
    }

    pushClientNotification(db, {
      type: 'comanda',
      title: `Nueva comanda · ${tableCode}`,
      message: `${newOrder.waiterName} envió ${newOrder.items.reduce((s, i) => s + i.quantity, 0)} platos a cocina (Comanda #${newOrder.orderNumber}).`,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      tableId: newOrder.tableId,
      tableCode,
      channel: newOrder.channel,
      waiterName: newOrder.waiterName,
      total: newOrder.total,
      items: newOrder.items.map(it => ({
        productName: it.productName,
        quantity: it.quantity,
        notes: it.notes || ''
      }))
    });

    saveLocalDb(db);
    return newOrder;
  },

  addItemsToOrder: async (orderId, items, user) => {
    const db = await ensureDbInitialized();
    const activeShift = (db.cashShifts || []).find(isShiftActive);
    if (!activeShift) {
      throw new Error('La caja se encuentra cerrada. Iniciá un turno de caja para realizar comandas o adiciones.');
    }

    rawFetchJson(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items, user })
    }).catch(() => {});

    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

    // Si la mesa estaba en cuenta solicitada o pendiente de cobro, vuelve a abierto
    if (order.status === 'cuenta_solicitada' || order.status === 'pendiente_cobro' || order.status === 'cuenta_pedida') {
      order.status = 'abierto';
    }

    const formattedItems = (items || []).map((it, idx) => ({
      id: 'item_' + Date.now() + '_' + idx,
      productId: it.productId,
      productName: it.productName,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      subtotal: (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
      notes: it.notes || ''
    }));

    order.items.push(...formattedItems);
    order.subtotal = order.items.reduce((acc, it) => acc + it.subtotal, 0);
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + (order.tip || 0);

    const table = order.tableId ? (db.tables || []).find(t => t.id === order.tableId) : null;
    if (table) {
      table.status = 'ocupada';
    }
    const tableCode = table ? getTableCodeForClient(table) : `Comanda #${order.orderNumber}`;
    const waiterName = user?.name || order.waiterName || 'Mozo';

    pushClientNotification(db, {
      type: 'comanda',
      title: `Adición a cocina · ${tableCode}`,
      message: `${waiterName} sumó ${formattedItems.reduce((s, i) => s + i.quantity, 0)} platos a ${tableCode} (Comanda #${order.orderNumber}).`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableCode,
      channel: order.channel,
      waiterName,
      total: order.total,
      items: formattedItems.map(it => ({
        productName: it.productName,
        quantity: it.quantity,
        notes: it.notes || ''
      }))
    });

    saveLocalDb(db);
    return { ...order };
  },

  requestBill: async (orderId, tipAmount = 0) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/orders/${orderId}/request-bill`, {
      method: 'POST',
      body: JSON.stringify({ tipAmount })
    }).catch(() => {});

    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

    order.status = 'cuenta_solicitada';
    order.tip = Number(tipAmount) || 0;
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + order.tip;

    let tableCode = `Comanda #${order.orderNumber}`;
    if (order.tableId) {
      const table = (db.tables || []).find(t => t.id === order.tableId);
      if (table) {
        table.status = 'cuenta_solicitada';
        tableCode = getTableCodeForClient(table);
      }
    }

    pushClientNotification(db, {
      type: 'cuenta',
      title: `Cuenta solicitada · ${tableCode}`,
      message: `${order.waiterName || 'Mozo'} solicitó la cuenta de ${tableCode} (Total $${order.total.toLocaleString('es-AR')}).`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableCode,
      channel: order.channel,
      waiterName: order.waiterName || 'Mozo',
      total: order.total,
      items: (order.items || []).map(it => ({
        productName: it.productName,
        quantity: it.quantity,
        notes: it.notes || ''
      }))
    });

    saveLocalDb(db);
    return { ...order };
  },

  markPendingPayment: async (orderId) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/orders/${orderId}/pending-payment`, {
      method: 'POST'
    }).catch(() => {});

    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

    order.status = 'pendiente_cobro';
    if (order.tableId) {
      const table = (db.tables || []).find(t => t.id === order.tableId);
      if (table) table.status = 'pendiente_cobro';
    }

    saveLocalDb(db);
    return { ...order };
  },

  revertBill: async (orderId) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/orders/${orderId}/revert-bill`, {
      method: 'POST'
    }).catch(() => {});

    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

    order.status = 'abierto';
    order.tip = 0;
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0);

    if (order.tableId) {
      const table = (db.tables || []).find(t => t.id === order.tableId);
      if (table) table.status = 'ocupada';
    }

    saveLocalDb(db);
    return { ...order };
  },

  updateOrderStatus: async (orderId, updates) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }).catch(() => {});

    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

    if (updates.kitchenStatus !== undefined) order.kitchenStatus = updates.kitchenStatus;
    if (updates.status !== undefined) order.status = updates.status;
    if (updates.driverName !== undefined) order.driverName = updates.driverName;

    saveLocalDb(db);
    return { ...order };
  },

  closeOrder: async (orderId, payload) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/orders/${orderId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).catch(() => {});

    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

    order.discount = Number(payload.discount) || order.discount || 0;
    order.tip = Number(payload.tip) || order.tip || 0;
    order.subtotal = (order.items || []).reduce((acc, it) => acc + it.subtotal, 0);
    order.total = order.subtotal + (order.deliveryFee || 0) - order.discount + order.tip;
    order.paymentMethod = payload.paymentMethod;
    order.paymentDetails = payload.paymentDetails || null;
    order.status = 'cobrado';
    order.kitchenStatus = 'entregado';
    order.closedAt = new Date().toISOString();
    order.closedBy = payload.closedBy?.name || 'Cajero';

    if (order.tableId) {
      const table = (db.tables || []).find(t => t.id === order.tableId);
      if (table) {
        table.status = 'libre';
        table.activeOrderId = null;
        table.diners = 0;
        table.waiterId = null;
        table.openedAt = null;
      }
    }

    saveLocalDb(db);
    return { ...order };
  },

  getSuppliers: async () => {
    const db = await ensureDbInitialized();
    return [...(db.suppliers || [])];
  },

  createSupplier: async (supData) => {
    const db = await ensureDbInitialized();
    const newSup = {
      id: 'sup_' + Date.now(),
      name: supData.name,
      cuit: supData.cuit || '',
      phone: supData.phone || '',
      email: supData.email || '',
      category: supData.category || 'Varios'
    };
    rawFetchJson('/suppliers', { method: 'POST', body: JSON.stringify(newSup) }).catch(() => {});
    db.suppliers.push(newSup);
    saveLocalDb(db);
    return newSup;
  },

  getPurchases: async () => {
    const db = await ensureDbInitialized();
    return [...(db.purchases || [])];
  },

  createPurchase: async (purchaseData, user) => {
    const db = await ensureDbInitialized();
    rawFetchJson('/purchases', {
      method: 'POST',
      body: JSON.stringify({ purchaseData, user })
    }).catch(() => {});

    const newPurchase = {
      id: 'pur_' + Date.now(),
      voucherType: purchaseData.voucherType || 'Factura B',
      voucherNumber: purchaseData.voucherNumber,
      supplierId: purchaseData.supplierId,
      supplierName: purchaseData.supplierName,
      date: purchaseData.date || new Date().toISOString().split('T')[0],
      items: purchaseData.items || [],
      totalAmount: Number(purchaseData.totalAmount) || 0,
      paymentMethod: purchaseData.paymentMethod || 'efectivo',
      paymentStatus: purchaseData.paymentStatus || 'pagado',
      notes: purchaseData.notes || '',
      registeredBy: user?.name || 'Cajero',
      createdAt: new Date().toISOString()
    };

    for (const item of newPurchase.items) {
      const ing = (db.ingredients || []).find(i => i.id === item.ingredientId);
      if (ing) {
        const addedQty = Number(item.quantity) || 0;
        ing.stock = Number((ing.stock + addedQty).toFixed(3));
        if (item.unitCost) {
          ing.costPerUnit = Number(item.unitCost);
        }
        ing.lastUpdated = new Date().toISOString();

        const logEntry = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          ingredientId: ing.id,
          ingredientName: ing.name,
          type: 'compra_proveedor',
          change: `+${addedQty} ${ing.unit}`,
          resultingStock: ing.stock,
          reason: `${newPurchase.voucherType} ${newPurchase.voucherNumber} (${newPurchase.supplierName})`,
          user: user?.name || 'Cajero'
        };
        if (!db.stockLog) db.stockLog = [];
        db.stockLog.unshift(logEntry);
      }
    }

    if (!db.purchases) db.purchases = [];
    db.purchases.unshift(newPurchase);
    saveLocalDb(db);
    return newPurchase;
  },

  getCashShifts: async () => {
    const db = await ensureDbInitialized();
    return [...(db.cashShifts || [])];
  },

  getActiveShift: async () => {
    const db = await ensureDbInitialized();
    const active = (db.cashShifts || []).find(isShiftActive) || null;
    return { active };
  },

  openShift: async (data) => {
    return api.openCashShift(data);
  },

  openCashShift: async (data) => {
    const db = await ensureDbInitialized();
    if (!db.cashShifts) db.cashShifts = [];
    // Archivar de forma segura cualquier turno previo abierto para evitar bloqueos
    db.cashShifts.forEach(s => {
      if (isShiftActive(s)) {
        s.status = 'cerrada';
        s.closedAt = s.closedAt || new Date().toISOString();
      }
    });

    rawFetchJson('/cash-shifts/open', { method: 'POST', body: JSON.stringify(data) }).catch(() => {});

    const nowIso = new Date().toISOString();
    const nextShiftNumber = Math.max(0, ...(db.cashShifts || []).map(s => s.shiftNumber || 0)) + 1;
    const newShift = {
      id: 'shift_' + Date.now(),
      shiftNumber: nextShiftNumber,
      cashierId: data.cashierId || 'u_cajero',
      cashierName: formatUserRoleDisplay(data.cashierName || 'Cajero', 'cajero', db.users),
      openedAt: nowIso,
      openedDate: formatDateAr(nowIso),
      openedTime: formatTimeAr(nowIso),
      initialCash: Number(data.initialCash) || 0,
      status: 'abierta',
      movements: [],
      actualCash: null,
      difference: null,
      closedAt: null,
      closedDate: null,
      closedTime: null,
      notes: ''
    };
    db.cashShifts.unshift(newShift);
    saveLocalDb(db);
    return newShift;
  },

  addCashMovement: async (shiftId, data) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/cash-shifts/${shiftId}/movement`, { method: 'POST', body: JSON.stringify(data) }).catch(() => {});

    const shift = (db.cashShifts || []).find(s => s.id === shiftId);
    if (!shift) throw new Error('Turno no encontrado');

    const movement = {
      id: 'mov_' + Date.now(),
      type: data.type,
      amount: Number(data.amount),
      reason: data.reason || '',
      createdAt: new Date().toISOString(),
      user: data.user || 'Cajero'
    };
    shift.movements.push(movement);
    saveLocalDb(db);
    return movement;
  },

  closeCashShift: async (shiftId, data) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/cash-shifts/${shiftId}/close`, { method: 'POST', body: JSON.stringify(data) }).catch(() => {});

    const shift = (db.cashShifts || []).find(s => s.id === shiftId);
    if (!shift) throw new Error('Turno no encontrado');

    const shiftStart = new Date(shift.openedAt).getTime();
    const shiftOrders = (db.orders || []).filter(
      o => o.status === 'cobrado' && new Date(o.closedAt).getTime() >= shiftStart
    );

    const salesByMethod = {
      efectivo: 0,
      debito: 0,
      credito: 0,
      mercadopago: 0,
      transferencia: 0
    };
    shiftOrders.forEach(o => {
      const pm = o.paymentMethod || 'efectivo';
      salesByMethod[pm] = (salesByMethod[pm] || 0) + (o.total || 0);
    });

    const cashSales = salesByMethod.efectivo || 0;
    const totalSales = Object.values(salesByMethod).reduce((a, b) => a + b, 0);

    const totalIngresos = (shift.movements || [])
      .filter(m => m.type === 'ingreso')
      .reduce((acc, m) => acc + m.amount, 0);

    const totalEgresos = (shift.movements || [])
      .filter(m => m.type === 'egreso')
      .reduce((acc, m) => acc + m.amount, 0);

    const expectedCash = (shift.initialCash || 0) + cashSales + totalIngresos - totalEgresos;
    const diff = Number(data.actualCash) - expectedCash;
    const closedIso = new Date().toISOString();

    shift.status = 'cerrada';
    shift.actualCash = Number(data.actualCash);
    shift.expectedCash = expectedCash;
    shift.cashSales = cashSales;
    shift.totalSales = totalSales;
    shift.salesByMethod = salesByMethod;
    shift.totalIngresos = totalIngresos;
    shift.totalEgresos = totalEgresos;
    shift.difference = diff;
    shift.notes = data.notes || '';
    shift.closedAt = closedIso;
    shift.closedDate = formatDateAr(closedIso);
    shift.closedTime = formatTimeAr(closedIso);
    shift.closedBy = data.closedBy || 'Cajero';

    saveLocalDb(db);
    return { ...shift };
  },

  getAnalytics: async () => {
    const db = await ensureDbInitialized();
    return computeAnalyticsFromDb(db);
  },

  reloadFromLocalStorage: () => {
    return loadLocalDb(true);
  },

  syncWithServer: async () => {
    const db = await ensureDbInitialized();
    try {
      const remote = await rawFetchJson('/state');
      if (
        remote &&
        Array.isArray(remote.tables) &&
        Number(remote.lastUpdated || 0) > Number(db.lastUpdated || 0)
      ) {
        saveLocalDb(remote, { touch: false, broadcast: false });
        return { changed: true, lastUpdated: remote.lastUpdated };
      }
    } catch (e) {}
    return { changed: false, lastUpdated: db.lastUpdated };
  },

  getNetworkInfo: async () => {
    try {
      return await rawFetchJson('/network-info');
    } catch (e) {
      return { lanIps: [] };
    }
  },

  resetDemo: async () => {
    const res = await rawFetchJson('/system/reset-demo', { method: 'POST' }).catch(() => null);
    memoryDb = null;
    try {
      localStorage.removeItem(LOCAL_DB_KEY);
    } catch (e) {}
    if (res?.state && Array.isArray(res.state.tables)) {
      saveLocalDb(res.state, { touch: true, broadcast: true });
    } else {
      const fresh = await ensureDbInitialized();
      saveLocalDb(fresh, { touch: true, broadcast: true });
    }
    return { ok: true };
  }
};
