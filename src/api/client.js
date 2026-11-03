const API_BASE = '/api';
const LOCAL_DB_KEY = 'gastro_pos_db_v2';

let memoryDb = null;
let initPromise = null;

function loadLocalDb() {
  if (memoryDb) return memoryDb;
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.tables)) {
        memoryDb = parsed;
        return memoryDb;
      }
    }
  } catch (e) {}
  return null;
}

function saveLocalDb(db) {
  memoryDb = db;
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch (e) {}
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
        historicalSales: [
          {
            id: 'sale_prev_1',
            orderNumber: 98,
            channel: 'mesa',
            tableNumber: 1,
            total: 31200,
            paymentMethod: 'efectivo',
            closedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
            waiterName: 'Lucas'
          },
          {
            id: 'sale_prev_2',
            orderNumber: 99,
            channel: 'mostrador',
            tableNumber: null,
            total: 16000,
            paymentMethod: 'mercadopago',
            closedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
            waiterName: 'Martín'
          },
          {
            id: 'sale_prev_3',
            orderNumber: 100,
            channel: 'delivery',
            tableNumber: null,
            total: 28500,
            paymentMethod: 'debito',
            closedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
            waiterName: 'Martín'
          }
        ]
      };
      return saveLocalDb(db);
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
    activeOrdersCount: orders.filter(o => o.status === 'abierto' || o.status === 'cuenta_pedida').length,
    openTablesCount: (db.tables || []).filter(t => t.status === 'ocupada' || t.status === 'cuenta_pedida').length
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

    const newUser = {
      id: 'u_' + Date.now(),
      name: String(userData.name || '').trim(),
      role: userData.role || 'mozo',
      pin: cleanPin,
      email: userData.email || '',
      avatar:
        userData.avatar ||
        (userData.role === 'admin'
          ? 'fa-solid fa-user-shield'
          : userData.role === 'cajero'
          ? 'fa-solid fa-cash-register'
          : 'fa-solid fa-user-tie')
    };

    rawFetchJson('/users', { method: 'POST', body: JSON.stringify(newUser) }).catch(() => {});
    db.users.push(newUser);
    saveLocalDb(db);
    return newUser;
  },

  deleteUser: async (id) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/users/${id}`, { method: 'DELETE' }).catch(() => {});
    db.users = (db.users || []).filter(u => u.id !== id);
    saveLocalDb(db);
    return { success: true };
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
      user: payload.user || 'Operador'
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
    const nextOrderNumber = Math.max(100, ...(db.orders || []).map(o => o.orderNumber || 0)) + 1;
    const subtotal = (orderData.items || []).reduce((acc, it) => acc + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
    const deliveryFee = Number(orderData.deliveryFee) || 0;
    const discount = Number(orderData.discount) || 0;
    const tip = Number(orderData.tip) || 0;
    const total = subtotal + deliveryFee - discount + tip;

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
      waiterName: user?.name || orderData.waiterName || 'Operador',
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

    if (newOrder.channel === 'mesa' && newOrder.tableId) {
      const table = (db.tables || []).find(t => t.id === newOrder.tableId);
      if (table) {
        table.status = 'ocupada';
        table.activeOrderId = newOrder.id;
        table.diners = newOrder.diners;
        table.waiterId = newOrder.waiterId;
        table.openedAt = new Date().toISOString();
      }
    }

    saveLocalDb(db);
    return newOrder;
  },

  addItemsToOrder: async (orderId, items, user) => {
    const db = await ensureDbInitialized();
    rawFetchJson(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items, user })
    }).catch(() => {});

    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

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

    order.status = 'cuenta_pedida';
    order.tip = Number(tipAmount) || 0;
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + order.tip;

    if (order.tableId) {
      const table = (db.tables || []).find(t => t.id === order.tableId);
      if (table) table.status = 'cuenta_pedida';
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
    const active = (db.cashShifts || []).find(s => s.status === 'abierta') || null;
    return { active };
  },

  openShift: async (data) => {
    return api.openCashShift(data);
  },

  openCashShift: async (data) => {
    const db = await ensureDbInitialized();
    const existing = (db.cashShifts || []).find(s => s.status === 'abierta');
    if (existing) throw new Error('Ya existe una caja abierta en el sistema.');

    rawFetchJson('/cash-shifts/open', { method: 'POST', body: JSON.stringify(data) }).catch(() => {});

    const nextShiftNumber = Math.max(0, ...(db.cashShifts || []).map(s => s.shiftNumber || 0)) + 1;
    const newShift = {
      id: 'shift_' + Date.now(),
      shiftNumber: nextShiftNumber,
      cashierId: data.cashierId || 'u_cajero',
      cashierName: data.cashierName || 'Cajero',
      openedAt: new Date().toISOString(),
      initialCash: Number(data.initialCash) || 0,
      status: 'abierta',
      movements: [],
      actualCash: null,
      difference: null,
      closedAt: null,
      notes: ''
    };
    if (!db.cashShifts) db.cashShifts = [];
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
    const cashSales = (db.orders || [])
      .filter(o => o.status === 'cobrado' && o.paymentMethod === 'efectivo' && new Date(o.closedAt).getTime() >= shiftStart)
      .reduce((acc, o) => acc + (o.total || 0), 0);

    const totalIngresos = (shift.movements || [])
      .filter(m => m.type === 'ingreso')
      .reduce((acc, m) => acc + m.amount, 0);

    const totalEgresos = (shift.movements || [])
      .filter(m => m.type === 'egreso')
      .reduce((acc, m) => acc + m.amount, 0);

    const expectedCash = (shift.initialCash || 0) + cashSales + totalIngresos - totalEgresos;
    const diff = Number(data.actualCash) - expectedCash;

    shift.status = 'cerrada';
    shift.actualCash = Number(data.actualCash);
    shift.expectedCash = expectedCash;
    shift.difference = diff;
    shift.notes = data.notes || '';
    shift.closedAt = new Date().toISOString();
    shift.closedBy = data.closedBy || 'Cajero';

    saveLocalDb(db);
    return { ...shift };
  },

  getAnalytics: async () => {
    const db = await ensureDbInitialized();
    return computeAnalyticsFromDb(db);
  },

  resetDemo: async () => {
    await rawFetchJson('/system/reset-demo', { method: 'POST' }).catch(() => {});
    memoryDb = null;
    try {
      localStorage.removeItem(LOCAL_DB_KEY);
    } catch (e) {}
    await ensureDbInitialized();
    return { ok: true };
  }
};
