import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialData } from './data/initialData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'database.json');
const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'database.json')
  : DEFAULT_DB_PATH;

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

function getTableCodeForStore(table) {
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

class Store {
  constructor() {
    this.data = null;
    this.init();
  }

  normalizeData() {
    if (!this.data) return;
    if (!Array.isArray(this.data.users)) this.data.users = [];
    normalizeUsersRoleNames(this.data.users);
    if (!Array.isArray(this.data.notifications)) this.data.notifications = [];
    if (Array.isArray(this.data.tables)) {
      this.data.tables.forEach(t => {
        if (t.status === 'cuenta_pedida') t.status = 'pendiente_cobro';
      });
    }
    if (Array.isArray(this.data.orders)) {
      this.data.orders.forEach(o => {
        if (o.status === 'cuenta_pedida') o.status = 'pendiente_cobro';
        const waiter = this.data.users.find(u => u.id === o.waiterId);
        if (waiter) o.waiterName = waiter.name;
      });
    }
    if (!Array.isArray(this.data.customers)) this.data.customers = [];
    if (!Array.isArray(this.data.customerPayments)) this.data.customerPayments = [];
    if (!Array.isArray(this.data.supplierPayments)) this.data.supplierPayments = [];
    if (!Array.isArray(this.data.suppliers)) this.data.suppliers = [];
    if (!Array.isArray(this.data.purchases)) this.data.purchases = [];
    if (Array.isArray(this.data.cashShifts)) {
      this.data.cashShifts.forEach(s => {
        if (!s.openedDate && s.openedAt) s.openedDate = formatDateAr(s.openedAt);
        if (!s.openedTime && s.openedAt) s.openedTime = formatTimeAr(s.openedAt);
        if (!s.closedDate && s.closedAt) s.closedDate = formatDateAr(s.closedAt);
        if (!s.closedTime && s.closedAt) s.closedTime = formatTimeAr(s.closedAt);
        const cashier = this.data.users.find(u => u.id === s.cashierId);
        if (cashier) s.cashierName = cashier.name;
      });
    }
  }

  init() {
    try {
      if (process.env.VERCEL && !fs.existsSync(DB_PATH) && fs.existsSync(DEFAULT_DB_PATH)) {
        try {
          fs.writeFileSync(DB_PATH, fs.readFileSync(DEFAULT_DB_PATH, 'utf-8'), 'utf-8');
        } catch {
          // ignore copy error
        }
      }

      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.lastUpdated) this.data.lastUpdated = Date.now();
        this.normalizeData();
        console.log('[Store] Base de datos JSON cargada correctamente.');
      } else if (fs.existsSync(DEFAULT_DB_PATH)) {
        const raw = fs.readFileSync(DEFAULT_DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.lastUpdated) this.data.lastUpdated = Date.now();
        this.normalizeData();
        this.save();
        console.log('[Store] Base de datos JSON inicializada.');
      } else {
        this.data = JSON.parse(JSON.stringify(initialData));
        this.data.lastUpdated = Date.now();
        this.normalizeData();
        this.save();
        console.log('[Store] Base de datos JSON inicializada con datos demo.');
      }
    } catch (err) {
      console.error('[Store] Error cargando database.json, restaurando initialData:', err);
      this.data = JSON.parse(JSON.stringify(initialData));
      this.data.lastUpdated = Date.now();
      this.normalizeData();
      this.save();
    }
  }

  save(touchTimestamp = true) {
    try {
      if (touchTimestamp && this.data) {
        this.data.lastUpdated = Date.now();
      }
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error guardando en database.json:', err);
    }
  }

  resetDemo() {
    this.data = JSON.parse(JSON.stringify(initialData));
    this.data.lastUpdated = Date.now();
    this.normalizeData();
    this.save(false);
    return this.data;
  }

  getStateSnapshot() {
    this.normalizeData();
    return {
      ...this.data,
      lastUpdated: this.data.lastUpdated || Date.now()
    };
  }

  syncStateSnapshot(clientState) {
    if (
      clientState &&
      typeof clientState === 'object' &&
      Array.isArray(clientState.tables) &&
      Array.isArray(clientState.orders) &&
      Number(clientState.lastUpdated || 0) > Number(this.data.lastUpdated || 0)
    ) {
      this.data = {
        ...this.data,
        users: Array.isArray(clientState.users) ? clientState.users : this.data.users,
        tables: clientState.tables,
        products: Array.isArray(clientState.products) ? clientState.products : this.data.products,
        ingredients: Array.isArray(clientState.ingredients) ? clientState.ingredients : this.data.ingredients,
        orders: clientState.orders,
        cashShifts: Array.isArray(clientState.cashShifts) ? clientState.cashShifts : this.data.cashShifts,
        suppliers: Array.isArray(clientState.suppliers) ? clientState.suppliers : this.data.suppliers,
        purchases: Array.isArray(clientState.purchases) ? clientState.purchases : this.data.purchases,
        customers: Array.isArray(clientState.customers) ? clientState.customers : (this.data.customers || []),
        customerPayments: Array.isArray(clientState.customerPayments) ? clientState.customerPayments : (this.data.customerPayments || []),
        supplierPayments: Array.isArray(clientState.supplierPayments) ? clientState.supplierPayments : (this.data.supplierPayments || []),
        stockLog: Array.isArray(clientState.stockLog) ? clientState.stockLog : this.data.stockLog,
        notifications: Array.isArray(clientState.notifications) ? clientState.notifications : (this.data.notifications || []),
        historicalSales: Array.isArray(clientState.historicalSales) ? clientState.historicalSales : this.data.historicalSales,
        lastUpdated: Number(clientState.lastUpdated)
      };
      this.normalizeData();
      this.save(false);
    }
    return this.getStateSnapshot();
  }

  // --- Auth & Users ---
  getUsers() {
    this.normalizeData();
    return this.data.users || [];
  }

  findUserByPin(pin) {
    this.normalizeData();
    const cleanPin = String(pin || '').trim();
    return (this.data.users || []).find(u => String(u.pin).trim() === cleanPin);
  }

  findUserById(id) {
    this.normalizeData();
    return (this.data.users || []).find(u => u.id === id);
  }

  addUser(userData) {
    const cleanPin = String(userData.pin || '').trim();
    if (!cleanPin || cleanPin.length !== 4) {
      throw new Error('Ingresá un PIN válido de 4 dígitos');
    }
    const existing = (this.data.users || []).find(u => String(u.pin).trim() === cleanPin);
    if (existing) {
      throw new Error(`El PIN ${cleanPin} ya está asignado a ${existing.name}`);
    }
    const role = userData.role || 'mozo';
    const newUser = {
      id: userData.id || ('u_' + Date.now()),
      name: ROLE_LABELS[role] || 'Usuario',
      role,
      pin: cleanPin,
      email: userData.email || '',
      avatar: userData.avatar || (role === 'admin' ? 'fa-solid fa-user-shield' : role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie')
    };
    this.data.users.push(newUser);
    normalizeUsersRoleNames(this.data.users);
    this.save();
    return this.data.users.find(u => u.id === newUser.id) || newUser;
  }

  updateUser(id, updates = {}) {
    const user = (this.data.users || []).find(u => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');

    if (updates.pin) {
      const cleanPin = String(updates.pin).trim();
      if (cleanPin.length !== 4) throw new Error('Ingresá un PIN válido de 4 dígitos');
      const conflict = (this.data.users || []).find(u => u.id !== id && String(u.pin).trim() === cleanPin);
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
      normalizeUsersRoleNames(this.data.users);
    }
    this.save();
    return user;
  }

  deleteUser(id) {
    this.data.users = this.data.users.filter(u => u.id !== id);
    normalizeUsersRoleNames(this.data.users);
    this.save();
    return true;
  }

  // --- Notificaciones Digitales (Comandas y Cuentas) ---
  getNotifications() {
    return this.data.notifications || [];
  }

  pushNotification(notifData) {
    if (!Array.isArray(this.data.notifications)) this.data.notifications = [];
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
    this.data.notifications.unshift(notif);
    if (this.data.notifications.length > 50) {
      this.data.notifications = this.data.notifications.slice(0, 50);
    }
    return notif;
  }

  markNotificationRead(id) {
    const notif = (this.data.notifications || []).find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.save();
    }
    return notif;
  }

  markAllNotificationsRead() {
    (this.data.notifications || []).forEach(n => {
      n.read = true;
    });
    this.save();
    return true;
  }

  // --- Mesas (Tables) ---
  getTables() {
    return this.data.tables || [];
  }

  updateTable(id, updates) {
    const table = this.data.tables.find(t => t.id === id);
    if (table) {
      Object.assign(table, updates);
      this.save();
      return table;
    }
    return null;
  }

  addTable(tableData) {
    const nextNumber = Math.max(0, ...this.data.tables.map(t => t.number || 0)) + 1;
    const newTable = {
      id: 'm_' + Date.now(),
      number: tableData.number || nextNumber,
      sector: tableData.sector || 'Salón Principal',
      capacity: Number(tableData.capacity) || 4,
      status: 'libre',
      activeOrderId: null,
      diners: 0,
      waiterId: null,
      openedAt: null
    };
    this.data.tables.push(newTable);
    this.save();
    return newTable;
  }

  deleteTable(id) {
    this.data.tables = this.data.tables.filter(t => t.id !== id);
    this.save();
    return true;
  }

  // --- Productos & Menú ---
  getProducts() {
    return this.data.products || [];
  }

  addProduct(productData) {
    const newProduct = {
      id: 'prod_' + Date.now(),
      name: productData.name,
      category: productData.category,
      price: Number(productData.price),
      description: productData.description || '',
      badge: productData.badge || 'fa-solid fa-utensils',
      recipe: Array.isArray(productData.recipe) ? productData.recipe : []
    };
    this.data.products.push(newProduct);
    this.save();
    return newProduct;
  }

  updateProduct(id, updates) {
    const prod = this.data.products.find(p => p.id === id);
    if (prod) {
      if (updates.price) updates.price = Number(updates.price);
      Object.assign(prod, updates);
      this.save();
      return prod;
    }
    return null;
  }

  deleteProduct(id) {
    this.data.products = this.data.products.filter(p => p.id !== id);
    this.save();
    return true;
  }

  // --- Ingredientes & Materia Prima (Recetario / Stock) ---
  getIngredients() {
    return this.data.ingredients || [];
  }

  addIngredient(ingData) {
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
    this.data.ingredients.push(newIng);
    this.save();
    return newIng;
  }

  updateIngredient(id, updates) {
    const ing = this.data.ingredients.find(i => i.id === id);
    if (ing) {
      if (updates.stock !== undefined) updates.stock = Number(updates.stock);
      if (updates.minStock !== undefined) updates.minStock = Number(updates.minStock);
      if (updates.costPerUnit !== undefined) updates.costPerUnit = Number(updates.costPerUnit);
      updates.lastUpdated = new Date().toISOString();
      Object.assign(ing, updates);
      this.save();
      return ing;
    }
    return null;
  }

  adjustIngredientStock(id, { quantityChange, reason, user, type = 'ajuste_manual' }) {
    const ing = this.data.ingredients.find(i => i.id === id);
    if (!ing) return null;

    ing.stock = Math.max(0, Number((ing.stock + quantityChange).toFixed(3)));
    ing.lastUpdated = new Date().toISOString();

    // Registrar en log de auditoría
    const logEntry = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      ingredientId: ing.id,
      ingredientName: ing.name,
      type: type, // 'comanda', 'compra', 'ajuste_manual', 'merma'
      change: `${quantityChange > 0 ? '+' : ''}${quantityChange} ${ing.unit}`,
      resultingStock: ing.stock,
      reason: reason || 'Ajuste de inventario',
      user: user || 'Sistema'
    };
    if (!this.data.stockLog) this.data.stockLog = [];
    this.data.stockLog.unshift(logEntry);

    this.save();
    return { ingredient: ing, log: logEntry };
  }

  // Descontar stock a partir de la receta de los items de una comanda
  deductStockFromRecipe(orderItems, orderRef, user) {
    const deductions = [];
    for (const item of orderItems) {
      const product = this.data.products.find(p => p.id === item.productId);
      if (!product || !product.recipe || product.recipe.length === 0) continue;

      const qtyMultiplier = Number(item.quantity) || 1;

      for (const recipeItem of product.recipe) {
        const ingredient = this.data.ingredients.find(i => i.id === recipeItem.ingredientId);
        if (!ingredient) continue;

        const deductAmount = recipeItem.quantity * qtyMultiplier;
        const oldStock = ingredient.stock;
        ingredient.stock = Math.max(0, Number((ingredient.stock - deductAmount).toFixed(3)));
        ingredient.lastUpdated = new Date().toISOString();

        const logEntry = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          type: 'consumo_comanda',
          change: `-${deductAmount} ${recipeItem.unit || ingredient.unit}`,
          resultingStock: ingredient.stock,
          reason: `Comanda #${orderRef} (${item.productName} x${item.quantity})`,
          user: user || 'Mozo'
        };

        if (!this.data.stockLog) this.data.stockLog = [];
        this.data.stockLog.unshift(logEntry);

        deductions.push({
          ingredientName: ingredient.name,
          deducted: deductAmount,
          unit: recipeItem.unit || ingredient.unit,
          remainingStock: ingredient.stock
        });
      }
    }
    this.save();
    return deductions;
  }

  // --- Comandas y Pedidos ---
  getOrders() {
    return this.data.orders || [];
  }

  findOrderById(id) {
    return this.data.orders.find(o => o.id === id);
  }

  createOrder(orderData, user) {
    if (!this.getActiveShift()) {
      throw new Error('La caja se encuentra cerrada. Iniciá un turno de caja para realizar comandas o adiciones.');
    }
    const nextOrderNumber = Math.max(100, ...this.data.orders.map(o => o.orderNumber || 0)) + 1;
    const subtotal = (orderData.items || []).reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
    const deliveryFee = Number(orderData.deliveryFee) || 0;
    const discount = Number(orderData.discount) || 0;
    const tip = Number(orderData.tip) || 0;
    const total = subtotal + deliveryFee - discount + tip;

    const newOrder = {
      id: 'ord_' + Date.now(),
      orderNumber: nextOrderNumber,
      channel: orderData.channel || 'mesa', // 'mesa', 'mostrador', 'take_away', 'delivery'
      tableId: orderData.tableId || null,
      tableNumber: orderData.tableNumber || null,
      customerName: orderData.customerName || null,
      customerPhone: orderData.customerPhone || null,
      deliveryAddress: orderData.deliveryAddress || null,
      deliveryFee: deliveryFee,
      driverName: orderData.driverName || null,
      waiterId: user?.id || orderData.waiterId || null,
      waiterName: user?.name || orderData.waiterName || 'Mozo',
      status: 'abierto', // 'abierto', 'cuenta_pedida', 'cobrado', 'cancelado'
      kitchenStatus: orderData.kitchenStatus || 'en_preparacion', // 'pendiente', 'en_preparacion', 'listo', 'en_camino', 'entregado'
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

    this.data.orders.unshift(newOrder);

    let tableCode = 'Mostrador';
    if (newOrder.channel === 'mesa' && newOrder.tableId) {
      const table = this.data.tables.find(t => t.id === newOrder.tableId);
      if (table) {
        table.status = 'ocupada';
        table.activeOrderId = newOrder.id;
        table.diners = newOrder.diners;
        table.waiterId = newOrder.waiterId;
        table.openedAt = new Date().toISOString();
        tableCode = getTableCodeForStore(table);
      }
    } else if (newOrder.channel === 'delivery') {
      tableCode = 'Delivery';
    } else if (newOrder.channel === 'take_away') {
      tableCode = 'Take Away';
    }

    this.pushNotification({
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

    this.save();
    return newOrder;
  }

  addItemsToOrder(orderId, newItems, user) {
    if (!this.getActiveShift()) {
      throw new Error('La caja se encuentra cerrada. Iniciá un turno de caja para realizar comandas o adiciones.');
    }
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    // Si la mesa estaba en cuenta solicitada o pendiente de cobro, vuelve a abierto
    if (order.status === 'cuenta_solicitada' || order.status === 'pendiente_cobro' || order.status === 'cuenta_pedida') {
      order.status = 'abierto';
    }

    const formattedItems = newItems.map((it, idx) => ({
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

    const table = order.tableId ? this.data.tables.find(t => t.id === order.tableId) : null;
    if (table) {
      table.status = 'ocupada';
    }
    const tableCode = table ? getTableCodeForStore(table) : `Comanda #${order.orderNumber}`;
    const waiterName = user?.name || order.waiterName || 'Mozo';

    this.pushNotification({
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

    this.save();
    return order;
  }

  // Mozo solicita cuenta ("Cuenta" - estado celeste)
  requestBill(orderId, tipAmount = 0) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'cuenta_solicitada';
    order.tip = Number(tipAmount) || 0;
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + order.tip;

    let tableCode = `Comanda #${order.orderNumber}`;
    if (order.tableId) {
      const table = this.data.tables.find(t => t.id === order.tableId);
      if (table) {
        table.status = 'cuenta_solicitada';
        tableCode = getTableCodeForStore(table);
      }
    }

    this.pushNotification({
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

    this.save();
    return order;
  }

  // Pasar de "Cuenta" (celeste) a "Pendiente de cobro" (rojo)
  markPendingPayment(orderId) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'pendiente_cobro';
    if (order.tableId) {
      const table = this.data.tables.find(t => t.id === order.tableId);
      if (table) {
        table.status = 'pendiente_cobro';
      }
    }

    this.save();
    return order;
  }

  // Revertir solicitud de cuenta (cuando se pidió por error)
  revertBillRequest(orderId) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'abierto';
    order.tip = 0;
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0);

    if (order.tableId) {
      const table = this.data.tables.find(t => t.id === order.tableId);
      if (table) {
        table.status = 'ocupada';
      }
    }

    this.save();
    return order;
  }

  // Actualizar estado de pedido / cocina (ej: pendiente, en_preparacion, listo, en_camino, entregado)
  updateOrderStatus(orderId, updates) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    if (updates.kitchenStatus) order.kitchenStatus = updates.kitchenStatus;
    if (updates.status) order.status = updates.status;
    if (updates.driverName) order.driverName = updates.driverName;

    this.save();
    return order;
  }

  // Cajero cobra y cierra comanda/mesa
  closeAndChargeOrder(orderId, { paymentMethod, paymentDetails, discount = 0, tip = 0, closedBy }) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.discount = Number(discount) || order.discount || 0;
    order.tip = Number(tip) || order.tip || 0;
    order.subtotal = order.items.reduce((acc, it) => acc + it.subtotal, 0);
    order.total = order.subtotal + (order.deliveryFee || 0) - order.discount + order.tip;
    order.paymentMethod = paymentMethod;
    order.paymentDetails = paymentDetails || null;
    order.status = 'cobrado';
    order.kitchenStatus = 'entregado';
    order.closedAt = new Date().toISOString();
    order.closedBy = closedBy?.name || 'Cajero';

    // Si se cobra mediante Cuenta Corriente, impactar en el saldo del cliente
    if (paymentMethod === 'cuenta_corriente' && paymentDetails?.customerId) {
      if (!this.data.customers) this.data.customers = [];
      const customer = this.data.customers.find(c => c.id === paymentDetails.customerId);
      if (customer) {
        customer.currentBalance = (customer.currentBalance || 0) + order.total;
        order.customerId = customer.id;
        order.customerName = customer.name;
        if (!customer.ordersHistory) customer.ordersHistory = [];
        customer.ordersHistory.unshift({
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          date: order.closedAt
        });
      }
    }

    // Si tiene mesa asociada, liberar la mesa
    if (order.tableId) {
      const table = this.data.tables.find(t => t.id === order.tableId);
      if (table) {
        table.status = 'libre';
        table.activeOrderId = null;
        table.diners = 0;
        table.waiterId = null;
        table.openedAt = null;
      }
    }

    // Registrar en ventas históricas
    if (!this.data.historicalSales) this.data.historicalSales = [];
    this.data.historicalSales.unshift({
      id: 'sale_' + Date.now(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      channel: order.channel,
      tableNumber: order.tableNumber,
      total: order.total,
      paymentMethod: order.paymentMethod,
      closedAt: order.closedAt,
      waiterName: order.waiterName,
      closedBy: order.closedBy
    });

    this.save();
    return order;
  }

  // --- Proveedores & Compras / Facturas / Remitos ---
  getSuppliers() {
    return this.data.suppliers || [];
  }

  addSupplier(supData) {
    const newSup = {
      id: 'sup_' + Date.now(),
      name: supData.name,
      cuit: supData.cuit || '',
      phone: supData.phone || '',
      email: supData.email || '',
      category: supData.category || 'Varios'
    };
    this.data.suppliers.push(newSup);
    this.save();
    return newSup;
  }

  getPurchases() {
    return this.data.purchases || [];
  }

  // Cargar factura o remito de proveedor -> actualiza stock y costos
  createPurchase(purchaseData, user) {
    const newPurchase = {
      id: 'pur_' + Date.now(),
      voucherType: purchaseData.voucherType || 'Factura B', // 'Factura A', 'Factura B', 'Remito Oficial'
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

    // Incrementar stock y actualizar costo de cada ingrediente ingresado
    for (const item of newPurchase.items) {
      const ing = this.data.ingredients.find(i => i.id === item.ingredientId);
      if (ing) {
        const addedQty = Number(item.quantity) || 0;
        ing.stock = Number((ing.stock + addedQty).toFixed(3));
        if (item.unitCost) {
          ing.costPerUnit = Number(item.unitCost);
        }
        ing.lastUpdated = new Date().toISOString();

        // Log de stock
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
        if (!this.data.stockLog) this.data.stockLog = [];
        this.data.stockLog.unshift(logEntry);
      }
    }

    if (!this.data.purchases) this.data.purchases = [];
    this.data.purchases.unshift(newPurchase);

    this.save();
    return newPurchase;
  }

  updateSupplier(id, updates = {}) {
    if (!this.data.suppliers) this.data.suppliers = [];
    const sup = this.data.suppliers.find(s => s.id === id);
    if (!sup) return null;

    if (updates.name) sup.name = updates.name.trim();
    if (updates.cuit !== undefined) sup.cuit = updates.cuit.trim();
    if (updates.phone !== undefined) sup.phone = updates.phone.trim();
    if (updates.email !== undefined) sup.email = updates.email.trim();
    if (updates.category) sup.category = updates.category.trim();
    if (updates.status !== undefined) sup.status = updates.status;

    this.save();
    return sup;
  }

  deleteSupplier(id) {
    if (!this.data.suppliers) return false;
    const sup = this.data.suppliers.find(s => s.id === id);
    if (!sup) return false;

    const hasPurchases = (this.data.purchases || []).some(p => p.supplierId === id);
    if (hasPurchases) {
      sup.status = 'inactivo';
      this.save();
      return { deactivated: true, supplier: sup };
    } else {
      this.data.suppliers = this.data.suppliers.filter(s => s.id !== id);
      this.save();
      return { deleted: true };
    }
  }

  getSupplierPayments() {
    return this.data.supplierPayments || [];
  }

  addSupplierPayment(supplierId, { amount, paymentMethod = 'transferencia', voucherId = null, notes = '', user }) {
    if (!this.data.suppliers) this.data.suppliers = [];
    const sup = this.data.suppliers.find(s => s.id === supplierId);
    if (!sup) throw new Error('Proveedor no encontrado');

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('El importe debe ser mayor a cero');
    }

    if (voucherId && Array.isArray(this.data.purchases)) {
      const pur = this.data.purchases.find(p => p.id === voucherId);
      if (pur) {
        pur.paymentStatus = 'pagado';
      }
    }

    const paymentRecord = {
      id: 'spay_' + Date.now(),
      supplierId: sup.id,
      supplierName: sup.name,
      amount: paymentAmount,
      paymentMethod,
      voucherId,
      notes: notes || '',
      date: new Date().toISOString().split('T')[0],
      registeredBy: user?.name || 'Admin',
      createdAt: new Date().toISOString()
    };

    if (!this.data.supplierPayments) this.data.supplierPayments = [];
    this.data.supplierPayments.unshift(paymentRecord);

    if (paymentMethod === 'efectivo') {
      const activeShift = this.getActiveShift();
      if (activeShift) {
        this.addCashMovement(activeShift.id, {
          type: 'egreso',
          amount: paymentAmount,
          reason: `Pago a proveedor ${sup.name} (${notes || 'Cta. Cte.'})`,
          user: user?.name || 'Cajero'
        });
      }
    }

    this.save();
    return { supplier: sup, payment: paymentRecord };
  }

  // --- Cuentas Corrientes de Clientes ---
  getCustomers() {
    return this.data.customers || [];
  }

  addCustomer(custData = {}) {
    if (!this.data.customers) this.data.customers = [];
    const newCust = {
      id: 'cust_' + Date.now(),
      name: custData.name?.trim() || 'Cliente Sin Nombre',
      phone: custData.phone?.trim() || '',
      dniCuit: custData.dniCuit?.trim() || '',
      address: custData.address?.trim() || '',
      currentBalance: Number(custData.currentBalance) || 0,
      creditLimit: Number(custData.creditLimit) || 100000,
      notes: custData.notes?.trim() || '',
      status: 'activo',
      createdAt: new Date().toISOString()
    };
    this.data.customers.push(newCust);
    this.save();
    return newCust;
  }

  updateCustomer(id, updates = {}) {
    if (!this.data.customers) this.data.customers = [];
    const cust = this.data.customers.find(c => c.id === id);
    if (!cust) return null;

    if (updates.name) cust.name = updates.name.trim();
    if (updates.phone !== undefined) cust.phone = updates.phone.trim();
    if (updates.dniCuit !== undefined) cust.dniCuit = updates.dniCuit.trim();
    if (updates.address !== undefined) cust.address = updates.address.trim();
    if (updates.creditLimit !== undefined) cust.creditLimit = Number(updates.creditLimit) || 0;
    if (updates.notes !== undefined) cust.notes = updates.notes.trim();
    if (updates.status !== undefined) cust.status = updates.status;

    this.save();
    return cust;
  }

  deleteCustomer(id) {
    if (!this.data.customers) return false;
    const cust = this.data.customers.find(c => c.id === id);
    if (!cust) return false;

    if ((cust.currentBalance || 0) > 0) {
      throw new Error(`El cliente tiene un saldo pendiente de $${cust.currentBalance.toLocaleString('es-AR')}`);
    }

    cust.status = 'inactivo';
    this.save();
    return { deactivated: true, customer: cust };
  }

  getCustomerPayments() {
    return this.data.customerPayments || [];
  }

  addCustomerPayment(customerId, { amount, paymentMethod = 'efectivo', notes = '', user }) {
    if (!this.data.customers) this.data.customers = [];
    const cust = this.data.customers.find(c => c.id === customerId);
    if (!cust) throw new Error('Cliente no encontrado');

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('El importe debe ser mayor a cero');
    }

    cust.currentBalance = Math.max(0, (cust.currentBalance || 0) - paymentAmount);

    const paymentRecord = {
      id: 'cpay_' + Date.now(),
      customerId: cust.id,
      customerName: cust.name,
      amount: paymentAmount,
      paymentMethod,
      notes: notes || '',
      date: new Date().toISOString().split('T')[0],
      registeredBy: user?.name || 'Cajero',
      createdAt: new Date().toISOString()
    };

    if (!this.data.customerPayments) this.data.customerPayments = [];
    this.data.customerPayments.unshift(paymentRecord);

    if (paymentMethod === 'efectivo') {
      const activeShift = this.getActiveShift();
      if (activeShift) {
        this.addCashMovement(activeShift.id, {
          type: 'ingreso',
          amount: paymentAmount,
          reason: `Cobro Cta. Cte. cliente ${cust.name}`,
          user: user?.name || 'Cajero'
        });
      }
    }

    this.save();
    return { customer: cust, payment: paymentRecord };
  }

  // --- Arqueos y Turnos de Caja ---
  getCashShifts() {
    return this.data.cashShifts || [];
  }

  getActiveShift() {
    return (this.data.cashShifts || []).find(s => s && (s.status === 'abierta' || s.status === 'abierto')) || null;
  }

  openCashShift({ cashierId, cashierName, initialCash }) {
    if (!this.data.cashShifts) this.data.cashShifts = [];
    this.data.cashShifts.forEach(s => {
      if (s && (s.status === 'abierta' || s.status === 'abierto')) {
        s.status = 'cerrada';
        s.closedAt = s.closedAt || new Date().toISOString();
      }
    });

    const nowIso = new Date().toISOString();
    const nextShiftNumber = Math.max(0, ...(this.data.cashShifts || []).map(s => s.shiftNumber || 0)) + 1;
    const newShift = {
      id: 'shift_' + Date.now(),
      shiftNumber: nextShiftNumber,
      cashierId: cashierId || 'u_cajero',
      cashierName: cashierName || 'Cajero',
      openedAt: nowIso,
      openedDate: formatDateAr(nowIso),
      openedTime: formatTimeAr(nowIso),
      initialCash: Number(initialCash) || 0,
      status: 'abierta',
      movements: [],
      actualCash: null,
      difference: null,
      closedAt: null,
      closedDate: null,
      closedTime: null,
      notes: ''
    };

    if (!this.data.cashShifts) this.data.cashShifts = [];
    this.data.cashShifts.unshift(newShift);
    this.save();
    return newShift;
  }

  addCashMovement(shiftId, { type, amount, reason, user }) {
    const shift = (this.data.cashShifts || []).find(s => s.id === shiftId);
    if (!shift) return null;

    const movement = {
      id: 'mov_' + Date.now(),
      type: type,
      amount: Number(amount),
      reason: reason || '',
      createdAt: new Date().toISOString(),
      user: user || 'Cajero'
    };

    shift.movements.push(movement);
    this.save();
    return movement;
  }

  closeCashShift(shiftId, { actualCash, notes, closedBy }) {
    const shift = (this.data.cashShifts || []).find(s => s.id === shiftId);
    if (!shift) return null;

    const shiftStart = new Date(shift.openedAt).getTime();
    const shiftOrders = (this.data.orders || []).filter(
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
    const diff = Number(actualCash) - expectedCash;
    const closedIso = new Date().toISOString();

    shift.status = 'cerrada';
    shift.actualCash = Number(actualCash);
    shift.expectedCash = expectedCash;
    shift.cashSales = cashSales;
    shift.totalSales = totalSales;
    shift.salesByMethod = salesByMethod;
    shift.totalIngresos = totalIngresos;
    shift.totalEgresos = totalEgresos;
    shift.difference = diff;
    shift.notes = notes || '';
    shift.closedAt = closedIso;
    shift.closedDate = formatDateAr(closedIso);
    shift.closedTime = formatTimeAr(closedIso);
    shift.closedBy = closedBy || 'Cajero';

    this.save();
    return shift;
  }

  // --- Analítica & Reportes de Ventas ---
  getAnalytics() {
    const orders = this.data.orders || [];
    const closedOrders = orders.filter(o => o.status === 'cobrado');
    const historical = this.data.historicalSales || [];

    const totalVentas = closedOrders.reduce((sum, o) => sum + (o.total || 0), 0) +
      historical.reduce((sum, h) => sum + (h.total || 0), 0);

    const totalTickets = closedOrders.length + historical.length;
    const ticketPromedio = totalTickets > 0 ? Math.round(totalVentas / totalTickets) : 0;

    // Ventas por canal
    const byChannel = { mesa: 0, mostrador: 0, take_away: 0, delivery: 0 };
    [...closedOrders, ...historical].forEach(o => {
      const ch = o.channel || 'mesa';
      byChannel[ch] = (byChannel[ch] || 0) + (o.total || 0);
    });

    // Ventas por método de pago
    const byPaymentMethod = { efectivo: 0, debito: 0, credito: 0, mercadopago: 0, transferencia: 0 };
    [...closedOrders, ...historical].forEach(o => {
      const pm = o.paymentMethod || 'efectivo';
      byPaymentMethod[pm] = (byPaymentMethod[pm] || 0) + (o.total || 0);
    });

    // Ranking de productos más vendidos
    const productCounts = {};
    closedOrders.forEach(o => {
      (o.items || []).forEach(it => {
        productCounts[it.productName] = (productCounts[it.productName] || 0) + it.quantity;
      });
    });
    const topProducts = Object.entries(productCounts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Alertas de Stock Bajo
    const lowStockIngredients = (this.data.ingredients || []).filter(i => i.stock <= i.minStock);

    return {
      totalVentas,
      totalTickets,
      ticketPromedio,
      byChannel,
      byPaymentMethod,
      topProducts,
      lowStockIngredients,
      activeOrdersCount: orders.filter(o => o.status === 'abierto' || o.status === 'cuenta_solicitada' || o.status === 'pendiente_cobro' || o.status === 'cuenta_pedida').length,
      openTablesCount: (this.data.tables || []).filter(t => t.status !== 'libre').length
    };
  }

  getStockAuditLog() {
    return this.data.stockLog || [];
  }
}

export const store = new Store();
