import express from 'express';
import cors from 'cors';
import os from 'os';
import { store } from './store.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Logging middleware
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.url.startsWith('/api/tables')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// --- Health ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// --- Auth & PIN Quick Login ---
app.post('/api/auth/login-pin', (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'PIN requerido' });
  const user = store.findUserByPin(pin.toString().trim());
  if (!user) return res.status(401).json({ error: 'PIN incorrecto' });
  res.json({ user });
});

// --- Users ---
app.get('/api/users', (req, res) => {
  res.json(store.getUsers());
});

app.post('/api/users', (req, res) => {
  try {
    const newUser = store.addUser(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const updated = store.updateUser(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  store.deleteUser(req.params.id);
  res.json({ success: true });
});

// --- Mesas (Tables) ---
app.get('/api/tables', (req, res) => {
  res.json(store.getTables());
});

app.put('/api/tables/:id', (req, res) => {
  const updated = store.updateTable(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Mesa no encontrada' });
  res.json(updated);
});

app.post('/api/tables', (req, res) => {
  const newTable = store.addTable(req.body);
  res.status(201).json(newTable);
});

app.delete('/api/tables/:id', (req, res) => {
  store.deleteTable(req.params.id);
  res.json({ success: true });
});

// --- Productos & Menú ---
app.get('/api/products', (req, res) => {
  res.json(store.getProducts());
});

app.post('/api/products', (req, res) => {
  const newProd = store.addProduct(req.body);
  res.status(201).json(newProd);
});

app.put('/api/products/:id', (req, res) => {
  const updated = store.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(updated);
});

app.delete('/api/products/:id', (req, res) => {
  store.deleteProduct(req.params.id);
  res.json({ success: true });
});

// --- Ingredientes & Materia Prima (Recetario / Stock) ---
app.get('/api/ingredients', (req, res) => {
  res.json(store.getIngredients());
});

app.post('/api/ingredients', (req, res) => {
  const newIng = store.addIngredient(req.body);
  res.status(201).json(newIng);
});

app.put('/api/ingredients/:id', (req, res) => {
  const updated = store.updateIngredient(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Ingrediente no encontrado' });
  res.json(updated);
});

app.post('/api/ingredients/:id/adjust', (req, res) => {
  const { quantityChange, reason, user, type } = req.body || {};
  const result = store.adjustIngredientStock(req.params.id, { quantityChange, reason, user, type });
  if (!result) return res.status(404).json({ error: 'Ingrediente no encontrado' });
  res.json(result);
});

app.get('/api/stock-log', (req, res) => {
  res.json(store.getStockAuditLog());
});

// --- Comandas y Pedidos ---
app.get('/api/orders', (req, res) => {
  res.json(store.getOrders());
});

app.get('/api/orders/:id', (req, res) => {
  const order = store.findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(order);
});

// Crear comanda (descuenta automáticamente stock por receta)
app.post('/api/orders', (req, res) => {
  const { orderData, user } = req.body || {};
  if (!orderData || !orderData.items || orderData.items.length === 0) {
    return res.status(400).json({ error: 'La comanda debe contener al menos un producto' });
  }
  const created = store.createOrder(orderData, user);
  res.status(201).json(created);
});

// Agregar platos a comanda abierta (descuenta stock)
app.post('/api/orders/:id/items', (req, res) => {
  const { items, user } = req.body || {};
  const updated = store.addItemsToOrder(req.params.id, items, user);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Mozo pide cuenta ("Sacar cuenta" -> estado Cuenta celeste)
app.post('/api/orders/:id/request-bill', (req, res) => {
  const { tipAmount } = req.body || {};
  const updated = store.requestBill(req.params.id, tipAmount);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Pasar pedido a Pendiente de cobro (estado Rojo)
app.post('/api/orders/:id/pending-payment', (req, res) => {
  const updated = store.markPendingPayment(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Cajero o Admin revierte solicitud de cuenta a abierta
app.post('/api/orders/:id/revert-bill', (req, res) => {
  const updated = store.revertBillRequest(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// --- Notificaciones Digitales (Comandas y Cuentas) ---
app.get('/api/notifications', (req, res) => {
  res.json(store.getNotifications());
});

app.post('/api/notifications/:id/read', (req, res) => {
  const updated = store.markNotificationRead(req.params.id);
  res.json({ ok: true, notification: updated });
});

app.post('/api/notifications/read-all', (req, res) => {
  store.markAllNotificationsRead();
  res.json({ ok: true });
});

// Actualizar estado de cocina / tracking de pedido (delivery, take away o salón)
app.put('/api/orders/:id/status', (req, res) => {
  const updated = store.updateOrderStatus(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(updated);
});

// Cajero cobra y cierra comanda/mesa
app.post('/api/orders/:id/close', (req, res) => {
  const { paymentMethod, paymentDetails, discount, tip, closedBy } = req.body || {};
  const closed = store.closeAndChargeOrder(req.params.id, { paymentMethod, paymentDetails, discount, tip, closedBy });
  if (!closed) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json(closed);
});

// --- Proveedores & Compras / Facturas / Remitos ---
app.get('/api/suppliers', (req, res) => {
  res.json(store.getSuppliers());
});

app.post('/api/suppliers', (req, res) => {
  const newSup = store.addSupplier(req.body || {});
  res.status(201).json(newSup);
});

app.get('/api/purchases', (req, res) => {
  res.json(store.getPurchases());
});

// Carga de factura o remito de proveedor (suma stock y actualiza costos)
app.post('/api/purchases', (req, res) => {
  const { purchaseData, user } = req.body || {};
  if (!purchaseData || !purchaseData.items || purchaseData.items.length === 0) {
    return res.status(400).json({ error: 'El comprobante debe tener al menos un ítem' });
  }
  const created = store.createPurchase(purchaseData, user);
  res.status(201).json(created);
});

// --- Arqueos y Turnos de Caja ---
app.get('/api/cash-shifts', (req, res) => {
  res.json(store.getCashShifts());
});

app.get('/api/cash-shifts/active', (req, res) => {
  res.json({ active: store.getActiveShift() });
});

app.post('/api/cash-shifts/open', (req, res) => {
  try {
    const shift = store.openCashShift(req.body);
    res.status(201).json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/cash-shifts/:id/movement', (req, res) => {
  const movement = store.addCashMovement(req.params.id, req.body);
  if (!movement) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json(movement);
});

app.post('/api/cash-shifts/:id/close', (req, res) => {
  const closed = store.closeCashShift(req.params.id, req.body);
  if (!closed) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json(closed);
});

// --- Analítica y Reportes de Ventas ---
app.get('/api/analytics', (req, res) => {
  res.json(store.getAnalytics());
});

// --- Sincronización de estado entre Escritorio y Comandera Móvil ---
app.get('/api/state', (req, res) => {
  res.json(store.getStateSnapshot());
});

app.post('/api/state/sync', (req, res) => {
  const { clientState } = req.body || {};
  const snapshot = store.syncStateSnapshot(clientState);
  res.json(snapshot);
});

// --- Información de red local para QR en LAN ---
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
