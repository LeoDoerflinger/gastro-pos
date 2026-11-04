import express from 'express';
import cors from 'cors';
import os from 'os';
import { store } from './store.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Tenant Extraction & Logging Middleware
app.use((req, res, next) => {
  const tenantHeader = req.headers['x-tenant-id'];
  const tenantQuery = req.query?.tenantId;
  req.tenantId = (tenantHeader || tenantQuery || store.getActiveTenantId()).toString().trim();

  if (req.method !== 'GET' || !req.url.startsWith('/api/tables')) {
    console.log(`[API ${req.tenantId}] ${req.method} ${req.url}`);
  }
  next();
});

// --- Health ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// --- Multi-tenancy & Business Registration ---
app.get('/api/tenants', (req, res) => {
  res.json(store.listTenants());
});

app.post('/api/tenants/register', (req, res) => {
  try {
    const result = store.registerTenant(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/business-config', (req, res) => {
  res.json(store.getBusinessConfig(req.tenantId));
});

app.put('/api/business-config', (req, res) => {
  try {
    const updated = store.updateBusinessConfig(req.tenantId, req.body || {});
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Auth & PIN Login ---
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, pin } = req.body || {};
    const result = store.loginUser({ email, password, pin, tenantId: req.tenantId });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/login-pin', (req, res) => {
  const { pin, tenantId } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'PIN requerido' });
  const result = store.findUserByPin(pin.toString().trim(), tenantId || req.tenantId);
  if (!result) return res.status(401).json({ error: 'PIN incorrecto' });
  res.json(result);
});

// --- Users ---
app.get('/api/users', (req, res) => {
  res.json(store.getUsers(req.tenantId));
});

app.post('/api/users', (req, res) => {
  try {
    const newUser = store.addUser(req.body, req.tenantId);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const updated = store.updateUser(req.params.id, req.body || {}, req.tenantId);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  store.deleteUser(req.params.id, req.tenantId);
  res.json({ success: true });
});

// --- Mesas (Tables) ---
app.get('/api/tables', (req, res) => {
  res.json(store.getTables(req.tenantId));
});

app.put('/api/tables/:id', (req, res) => {
  const updated = store.updateTable(req.params.id, req.body, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Mesa no encontrada' });
  res.json(updated);
});

app.post('/api/tables', (req, res) => {
  const newTable = store.addTable(req.body, req.tenantId);
  res.status(201).json(newTable);
});

app.delete('/api/tables/:id', (req, res) => {
  store.deleteTable(req.params.id, req.tenantId);
  res.json({ success: true });
});

// --- Productos & Menú ---
app.get('/api/products', (req, res) => {
  res.json(store.getProducts(req.tenantId));
});

app.post('/api/products', (req, res) => {
  const newProd = store.addProduct(req.body, req.tenantId);
  res.status(201).json(newProd);
});

app.put('/api/products/:id', (req, res) => {
  const updated = store.updateProduct(req.params.id, req.body, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(updated);
});

app.delete('/api/products/:id', (req, res) => {
  store.deleteProduct(req.params.id, req.tenantId);
  res.json({ success: true });
});

// --- Ingredientes & Materia Prima (Recetario / Stock) ---
app.get('/api/ingredients', (req, res) => {
  res.json(store.getIngredients(req.tenantId));
});

app.post('/api/ingredients', (req, res) => {
  const newIng = store.addIngredient(req.body, req.tenantId);
  res.status(201).json(newIng);
});

app.put('/api/ingredients/:id', (req, res) => {
  const updated = store.updateIngredient(req.params.id, req.body, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Ingrediente no encontrado' });
  res.json(updated);
});

app.post('/api/ingredients/:id/adjust', (req, res) => {
  const { quantityChange, reason, user, type } = req.body || {};
  const result = store.adjustIngredientStock(req.params.id, { quantityChange, reason, user, type }, req.tenantId);
  if (!result) return res.status(404).json({ error: 'Ingrediente no encontrado' });
  res.json(result);
});

app.get('/api/stock-log', (req, res) => {
  res.json(store.getStockAuditLog(req.tenantId));
});

// --- Comandas y Pedidos ---
app.get('/api/orders', (req, res) => {
  res.json(store.getOrders(req.tenantId));
});

app.get('/api/orders/:id', (req, res) => {
  const order = store.findOrderById(req.params.id, req.tenantId);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(order);
});

// Crear comanda (descuenta automáticamente stock por receta)
app.post('/api/orders', (req, res) => {
  const { orderData, user } = req.body || {};
  if (!orderData || !orderData.items || orderData.items.length === 0) {
    return res.status(400).json({ error: 'La comanda debe contener al menos un producto' });
  }
  try {
    const created = store.createOrder(orderData, user, req.tenantId);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Agregar platos a comanda abierta (descuenta stock)
app.post('/api/orders/:id/items', (req, res) => {
  const { items, user } = req.body || {};
  const updated = store.addItemsToOrder(req.params.id, items, user, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Mozo pide cuenta ("Sacar cuenta" -> estado Cuenta celeste)
app.post('/api/orders/:id/request-bill', (req, res) => {
  const { tipAmount } = req.body || {};
  const updated = store.requestBill(req.params.id, tipAmount, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Pasar pedido a Pendiente de cobro (estado Rojo)
app.post('/api/orders/:id/pending-payment', (req, res) => {
  const updated = store.markPendingPayment(req.params.id, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Revertir solicitud de cuenta a abierta
app.post('/api/orders/:id/revert-bill', (req, res) => {
  const updated = store.revertBillRequest(req.params.id, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Actualizar estado de cocina / tracking de pedido
app.put('/api/orders/:id/status', (req, res) => {
  const updated = store.updateOrderStatus(req.params.id, req.body || {}, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Aplicar descuento a la comanda antes de imprimir cuenta
app.put('/api/orders/:id/discount', (req, res) => {
  const updated = store.updateOrderDiscount(req.params.id, req.body?.discount, req.tenantId);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Cajero cobra y cierra comanda/mesa
app.post('/api/orders/:id/close', (req, res) => {
  const { paymentMethod, paymentDetails, discount, tip, closedBy } = req.body || {};
  const closed = store.closeAndChargeOrder(req.params.id, { paymentMethod, paymentDetails, discount, tip, closedBy }, req.tenantId);
  if (!closed) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(closed);
});

// Admin rectifica medio de pago de pedido ya cobrado
app.put('/api/orders/:id/payment-correction', (req, res) => {
  const { paymentMethod, paymentDetails, reason, correctedBy } = req.body || {};
  const corrected = store.correctOrderPayment(req.params.id, { paymentMethod, paymentDetails, reason, correctedBy }, req.tenantId);
  if (!corrected) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(corrected);
});

// --- Notificaciones Digitales ---
app.get('/api/notifications', (req, res) => {
  res.json(store.getNotifications(req.tenantId));
});

app.post('/api/notifications/:id/read', (req, res) => {
  const updated = store.markNotificationRead(req.params.id, req.tenantId);
  res.json({ ok: true, notification: updated });
});

app.post('/api/notifications/read-all', (req, res) => {
  store.markAllNotificationsRead(req.tenantId);
  res.json({ ok: true });
});

// --- Proveedores & Compras / Facturas / Remitos ---
app.get('/api/suppliers', (req, res) => {
  res.json(store.getSuppliers(req.tenantId));
});

app.post('/api/suppliers', (req, res) => {
  const newSup = store.addSupplier(req.body || {}, req.tenantId);
  res.status(201).json(newSup);
});

app.put('/api/suppliers/:id', (req, res) => {
  try {
    const updated = store.updateSupplier(req.params.id, req.body || {}, req.tenantId);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.delete('/api/suppliers/:id', (req, res) => {
  try {
    const result = store.deleteSupplier(req.params.id, req.tenantId);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/supplier-payments', (req, res) => {
  res.json(store.getSupplierPayments(req.tenantId));
});

app.post('/api/suppliers/:id/payments', (req, res) => {
  try {
    const { amount, paymentMethod, voucherId, notes, user } = req.body || {};
    const result = store.addSupplierPayment(req.params.id, { amount, paymentMethod, voucherId, notes, user }, req.tenantId);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/purchases', (req, res) => {
  res.json(store.getPurchases(req.tenantId));
});

app.post('/api/purchases', (req, res) => {
  const { purchaseData, user } = req.body || {};
  if (!purchaseData || !purchaseData.items || purchaseData.items.length === 0) {
    return res.status(400).json({ error: 'El comprobante debe tener al menos un ítem' });
  }
  const created = store.createPurchase(purchaseData, user, req.tenantId);
  res.status(201).json(created);
});

// --- Cuentas Corrientes de Clientes ---
app.get('/api/customers', (req, res) => {
  res.json(store.getCustomers(req.tenantId));
});

app.post('/api/customers', (req, res) => {
  try {
    const created = store.addCustomer(req.body || {}, req.tenantId);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const updated = store.updateCustomer(req.params.id, req.body || {}, req.tenantId);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    const result = store.deleteCustomer(req.params.id, req.tenantId);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/customer-payments', (req, res) => {
  res.json(store.getCustomerPayments(req.tenantId));
});

app.post('/api/customers/:id/payments', (req, res) => {
  try {
    const { amount, paymentMethod, notes, user } = req.body || {};
    const result = store.addCustomerPayment(req.params.id, { amount, paymentMethod, notes, user }, req.tenantId);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Cuentas Corrientes de Personal / Sueldos ---
app.get('/api/staff-cc', (req, res) => {
  res.json(store.getStaffCcMovements(req.tenantId));
});

app.post('/api/staff-cc', (req, res) => {
  try {
    const created = store.addStaffCcMovement(req.body || {}, req.tenantId);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Arqueos y Turnos de Caja ---
app.get('/api/cash-shifts', (req, res) => {
  res.json(store.getCashShifts(req.tenantId));
});

app.get('/api/cash-shifts/active', (req, res) => {
  res.json({ active: store.getActiveShift(req.tenantId) });
});

app.post('/api/cash-shifts/open', (req, res) => {
  try {
    const shift = store.openCashShift(req.body, req.tenantId);
    res.status(201).json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/cash-shifts/:id/movement', (req, res) => {
  const movement = store.addCashMovement(req.params.id, req.body, req.tenantId);
  if (!movement) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json(movement);
});

app.post('/api/cash-shifts/:id/close', (req, res) => {
  const closed = store.closeCashShift(req.params.id, req.body, req.tenantId);
  if (!closed) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json(closed);
});

// --- Analítica y Reportes de Ventas ---
app.get('/api/analytics', (req, res) => {
  res.json(store.getAnalytics(req.tenantId));
});

// --- Sincronización de estado ---
app.get('/api/state', (req, res) => {
  res.json(store.getStateSnapshot(req.tenantId));
});

app.post('/api/state/sync', (req, res) => {
  const { clientState } = req.body || {};
  const snapshot = store.syncStateSnapshot(clientState, req.tenantId);
  res.json(snapshot);
});

// --- Información de red local para QR ---
app.get('/api/network-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const lanIps = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIps.push(net.address);
      }
    }
  }
  res.json({ lanIps });
});

// --- Reset Demo ---
app.post('/api/system/reset-demo', (req, res) => {
  const data = store.resetDemo();
  res.json({ message: 'Datos demo restaurados con éxito', ok: true, state: data });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`GastroGestion Backend corriendo en http://localhost:${PORT}`);
  });
}

export default app;
