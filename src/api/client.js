// Cliente API para GastroGestión
const API_BASE = '/api';

async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
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
    } catch (e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  loginWithPin: (pin) => fetchJson('/auth/login-pin', {
    method: 'POST',
    body: JSON.stringify({ pin })
  }),

  // Users
  getUsers: () => fetchJson('/users'),
  createUser: (data) => fetchJson('/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id) => fetchJson(`/users/${id}`, { method: 'DELETE' }),

  // Tables
  getTables: () => fetchJson('/tables'),
  updateTable: (id, data) => fetchJson(`/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  createTable: (data) => fetchJson('/tables', { method: 'POST', body: JSON.stringify(data) }),
  deleteTable: (id) => fetchJson(`/tables/${id}`, { method: 'DELETE' }),

  // Products & Menu
  getProducts: () => fetchJson('/products'),
  createProduct: (data) => fetchJson('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => fetchJson(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => fetchJson(`/products/${id}`, { method: 'DELETE' }),

  // Ingredients & Stock (Recetario)
  getIngredients: () => fetchJson('/ingredients'),
  createIngredient: (data) => fetchJson('/ingredients', { method: 'POST', body: JSON.stringify(data) }),
  updateIngredient: (id, data) => fetchJson(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adjustStock: (id, data) => fetchJson(`/ingredients/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  getStockLog: () => fetchJson('/stock-log'),

  // Orders
  getOrders: () => fetchJson('/orders'),
  getOrderById: (id) => fetchJson(`/orders/${id}`),
  createOrder: (orderData, user) => fetchJson('/orders', {
    method: 'POST',
    body: JSON.stringify({ orderData, user })
  }),
  addItemsToOrder: (orderId, items, user) => fetchJson(`/orders/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify({ items, user })
  }),
  requestBill: (orderId, tipAmount = 0) => fetchJson(`/orders/${orderId}/request-bill`, {
    method: 'POST',
    body: JSON.stringify({ tipAmount })
  }),
  revertBill: (orderId) => fetchJson(`/orders/${orderId}/revert-bill`, {
    method: 'POST'
  }),
  updateOrderStatus: (orderId, updates) => fetchJson(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }),
  closeOrder: (orderId, payload) => fetchJson(`/orders/${orderId}/close`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Suppliers & Purchases
  getSuppliers: () => fetchJson('/suppliers'),
  createSupplier: (data) => fetchJson('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  getPurchases: () => fetchJson('/purchases'),
  createPurchase: (purchaseData, user) => fetchJson('/purchases', {
    method: 'POST',
    body: JSON.stringify({ purchaseData, user })
  }),

  // Cash Shifts (Arqueos)
  getCashShifts: () => fetchJson('/cash-shifts'),
  getActiveShift: () => fetchJson('/cash-shifts/active'),
  openCashShift: (data) => fetchJson('/cash-shifts/open', { method: 'POST', body: JSON.stringify(data) }),
  addCashMovement: (shiftId, data) => fetchJson(`/cash-shifts/${shiftId}/movement`, { method: 'POST', body: JSON.stringify(data) }),
  closeCashShift: (shiftId, data) => fetchJson(`/cash-shifts/${shiftId}/close`, { method: 'POST', body: JSON.stringify(data) }),

  // Analytics
  getAnalytics: () => fetchJson('/analytics'),

  // System
  resetDemo: () => fetchJson('/system/reset-demo', { method: 'POST' })
};
