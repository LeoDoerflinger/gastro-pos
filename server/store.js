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

class Store {
  constructor() {
    this.data = null;
    this.init();
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
        console.log('[Store] Base de datos JSON cargada correctamente.');
      } else if (fs.existsSync(DEFAULT_DB_PATH)) {
        const raw = fs.readFileSync(DEFAULT_DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        this.save();
        console.log('[Store] Base de datos JSON inicializada.');
      } else {
        this.data = JSON.parse(JSON.stringify(initialData));
        this.save();
        console.log('[Store] Base de datos JSON inicializada con datos demo.');
      }
    } catch (err) {
      console.error('[Store] Error cargando database.json, restaurando initialData:', err);
      this.data = JSON.parse(JSON.stringify(initialData));
      this.save();
    }
  }

  save() {
    try {
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
    this.save();
    return this.data;
  }

  // --- Auth & Users ---
  getUsers() {
    return this.data.users || [];
  }

  findUserByPin(pin) {
    return this.data.users.find(u => u.pin === pin);
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  addUser(userData) {
    const newUser = {
      id: 'u_' + Date.now(),
      name: userData.name,
      role: userData.role,
      pin: userData.pin,
      email: userData.email || '',
      avatar: userData.avatar || (userData.role === 'admin' ? 'fa-solid fa-user-shield' : userData.role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie')
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  deleteUser(id) {
    this.data.users = this.data.users.filter(u => u.id !== id);
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

    // Descontar materias primas automáticamente del stock según receta
    this.deductStockFromRecipe(newOrder.items, newOrder.orderNumber, user?.name);

    this.data.orders.unshift(newOrder);

    // Si es de mesa, actualizar estado de la mesa
    if (newOrder.channel === 'mesa' && newOrder.tableId) {
      const table = this.data.tables.find(t => t.id === newOrder.tableId);
      if (table) {
        table.status = 'ocupada';
        table.activeOrderId = newOrder.id;
        table.diners = newOrder.diners;
        table.waiterId = newOrder.waiterId;
        table.openedAt = new Date().toISOString();
      }
    }

    this.save();
    return newOrder;
  }

  // Agregar items a comanda existente (por ejemplo cuando una mesa pide más cosas)
  addItemsToOrder(orderId, newItems, user) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

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

    // Recalcular montos
    order.subtotal = order.items.reduce((acc, it) => acc + it.subtotal, 0);
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + (order.tip || 0);

    // Descontar del stock los nuevos items
    this.deductStockFromRecipe(formattedItems, order.orderNumber, user?.name);

    this.save();
    return order;
  }

  // Mozo solicita cuenta ("Sacar cuenta")
  requestBill(orderId, tipAmount = 0) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'cuenta_pedida';
    order.tip = Number(tipAmount) || 0;
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + order.tip;

    if (order.tableId) {
      const table = this.data.tables.find(t => t.id === order.tableId);
      if (table) {
        table.status = 'cuenta_pedida';
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

  // --- Arqueos y Turnos de Caja ---
  getCashShifts() {
    return this.data.cashShifts || [];
  }

  getActiveShift() {
    return (this.data.cashShifts || []).find(s => s.status === 'abierta') || null;
  }

  openCashShift({ cashierId, cashierName, initialCash }) {
    const active = this.getActiveShift();
    if (active) {
      throw new Error('Ya existe una caja abierta en el sistema.');
    }

    const nextShiftNumber = Math.max(0, ...(this.data.cashShifts || []).map(s => s.shiftNumber || 0)) + 1;
    const newShift = {
      id: 'shift_' + Date.now(),
      shiftNumber: nextShiftNumber,
      cashierId: cashierId || 'u_cajero',
      cashierName: cashierName || 'Cajero',
      openedAt: new Date().toISOString(),
      initialCash: Number(initialCash) || 0,
      status: 'abierta',
      movements: [],
      actualCash: null,
      difference: null,
      closedAt: null,
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
      type: type, // 'ingreso' o 'egreso'
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

    // Calcular ventas en efectivo desde que se abrió este turno
    const shiftStart = new Date(shift.openedAt).getTime();
    const cashSales = (this.data.orders || [])
      .filter(o => o.status === 'cobrado' && o.paymentMethod === 'efectivo' && new Date(o.closedAt).getTime() >= shiftStart)
      .reduce((acc, o) => acc + (o.total || 0), 0);

    const totalIngresos = (shift.movements || [])
      .filter(m => m.type === 'ingreso')
      .reduce((acc, m) => acc + m.amount, 0);

    const totalEgresos = (shift.movements || [])
      .filter(m => m.type === 'egreso')
      .reduce((acc, m) => acc + m.amount, 0);

    const expectedCash = (shift.initialCash || 0) + cashSales + totalIngresos - totalEgresos;
    const diff = Number(actualCash) - expectedCash;

    shift.status = 'cerrada';
    shift.actualCash = Number(actualCash);
    shift.expectedCash = expectedCash;
    shift.difference = diff;
    shift.notes = notes || '';
    shift.closedAt = new Date().toISOString();
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
      activeOrdersCount: orders.filter(o => o.status === 'abierto' || o.status === 'cuenta_pedida').length,
      openTablesCount: (this.data.tables || []).filter(t => t.status === 'ocupada' || t.status === 'cuenta_pedida').length
    };
  }

  getStockAuditLog() {
    return this.data.stockLog || [];
  }
}

export const store = new Store();
