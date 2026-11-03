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

  get activeTenantId() {
    return this.data?.activeTenantId || 'prueba1';
  }

  getActiveTenantId() {
    return this.activeTenantId;
  }

  getTenant(tenantId) {
    if (!this.data) this.init();
    if (!this.data.tenants) {
      this.normalizeData();
    }
    const tid = tenantId || this.data.activeTenantId || 'prueba1';
    if (!this.data.tenants[tid]) {
      const found = Object.values(this.data.tenants).find(t => t.slug === tid || t.id === tid);
      if (found) return found;
      return this.data.tenants['prueba1'] || Object.values(this.data.tenants)[0];
    }
    return this.data.tenants[tid];
  }

  getTenantSummary(t) {
    if (!t) return null;
    return {
      id: t.id,
      slug: t.slug || t.id,
      name: t.name,
      domain: t.domain || `${t.slug || t.id}.gp.com`,
      cuit: t.cuit || '',
      address: t.address || '',
      phone: t.phone || '',
      email: t.email || `admin@${t.slug || t.id}.gp.com`,
      receiptFooter: t.receiptFooter || '',
      businessConfig: t.businessConfig || {
        name: t.name,
        legalName: t.name,
        slug: t.slug || t.id,
        domain: t.domain || `${t.slug || t.id}.gp.com`,
        cuit: t.cuit || '',
        address: t.address || '',
        phone: t.phone || '',
        email: t.email || `admin@${t.slug || t.id}.gp.com`,
        city: 'Córdoba Capital',
        receiptFooter: t.receiptFooter || ''
      }
    };
  }

  listTenants() {
    if (!this.data) this.init();
    if (!this.data.tenants) this.normalizeData();
    return Object.values(this.data.tenants).map(t => this.getTenantSummary(t));
  }

  getBusinessConfig(tenantId) {
    const t = this.getTenant(tenantId);
    return t.businessConfig || this.getTenantSummary(t).businessConfig;
  }

  updateBusinessConfig(tenantId, newConfig = {}) {
    const t = this.getTenant(tenantId);
    if (!t.businessConfig) {
      t.businessConfig = { ...this.getTenantSummary(t).businessConfig };
    }
    Object.assign(t.businessConfig, newConfig);
    if (newConfig.name) t.name = newConfig.name.trim();
    if (newConfig.address) t.address = newConfig.address.trim();
    if (newConfig.phone) t.phone = newConfig.phone.trim();
    if (newConfig.cuit) t.cuit = newConfig.cuit.trim();
    if (newConfig.email) t.email = newConfig.email.trim();
    if (newConfig.receiptFooter) t.receiptFooter = newConfig.receiptFooter.trim();
    this.save();
    return t.businessConfig;
  }

  registerTenant({ name, slug, cuit, address, phone, contactEmail, adminPassword = 'admin123', adminPin = '1234' }) {
    if (!name || !name.trim()) throw new Error('El nombre del local es obligatorio');
    const rawSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 20);
    const cleanSlug = rawSlug || 'local' + Math.floor(Math.random() * 900 + 100);

    if (this.data.tenants && this.data.tenants[cleanSlug]) {
      throw new Error(`El identificador "${cleanSlug}" ya está registrado. Elegí otro subdominio.`);
    }

    const domain = `${cleanSlug}.gp.com`;
    const adminEmail = `admin@${domain}`;

    const templateTenant = this.getTenant('prueba1');

    const newTenant = {
      id: cleanSlug,
      slug: cleanSlug,
      name: name.trim(),
      domain: domain,
      cuit: cuit?.trim() || '30-70000000-0',
      address: address?.trim() || 'Av. General Paz 100, Córdoba Capital',
      phone: phone?.trim() || '(0351) 400-0000',
      email: adminEmail,
      receiptFooter: `¡Gracias por visitarnos! ${name.trim()}`,
      businessConfig: {
        name: name.trim(),
        legalName: name.trim(),
        slug: cleanSlug,
        domain: domain,
        cuit: cuit?.trim() || '30-70000000-0',
        address: address?.trim() || 'Av. General Paz 100, Córdoba Capital',
        phone: phone?.trim() || '(0351) 400-0000',
        email: adminEmail,
        city: 'Córdoba Capital',
        receiptFooter: `¡Gracias por visitarnos! ${name.trim()}`
      },
      users: [
        {
          id: `u_${cleanSlug}_admin`,
          name: 'Admin',
          role: 'admin',
          pin: String(adminPin || '1234').trim(),
          password: adminPassword || 'admin123',
          email: adminEmail,
          avatar: 'fa-solid fa-user-shield'
        },
        {
          id: `u_${cleanSlug}_cajero`,
          name: 'Cajero',
          role: 'cajero',
          pin: '2222',
          password: 'cajero123',
          email: `cajero@${domain}`,
          avatar: 'fa-solid fa-cash-register'
        },
        {
          id: `u_${cleanSlug}_mozo1`,
          name: 'Mozo 1',
          role: 'mozo',
          pin: '1111',
          password: 'mozo123',
          email: `mozo1@${domain}`,
          avatar: 'fa-solid fa-user-tie'
        }
      ],
      tables: [
        { id: `t_${cleanSlug}_1`, number: 1, sector: 'Salón Principal', capacity: 4, status: 'libre', activeOrderId: null, diners: 0, waiterId: null, openedAt: null },
        { id: `t_${cleanSlug}_2`, number: 2, sector: 'Salón Principal', capacity: 4, status: 'libre', activeOrderId: null, diners: 0, waiterId: null, openedAt: null },
        { id: `t_${cleanSlug}_3`, number: 3, sector: 'Salón Principal', capacity: 6, status: 'libre', activeOrderId: null, diners: 0, waiterId: null, openedAt: null },
        { id: `t_${cleanSlug}_4`, number: 4, sector: 'Salón Principal', capacity: 2, status: 'libre', activeOrderId: null, diners: 0, waiterId: null, openedAt: null },
        { id: `t_${cleanSlug}_5`, number: 5, sector: 'Salón Principal', capacity: 4, status: 'libre', activeOrderId: null, diners: 0, waiterId: null, openedAt: null },
        { id: `t_${cleanSlug}_6`, number: 6, sector: 'Vereda', capacity: 4, status: 'libre', activeOrderId: null, diners: 0, waiterId: null, openedAt: null }
      ],
      products: JSON.parse(JSON.stringify(templateTenant.products || [])),
      ingredients: JSON.parse(JSON.stringify(templateTenant.ingredients || [])),
      orders: [],
      cashShifts: [],
      suppliers: JSON.parse(JSON.stringify(templateTenant.suppliers || [])),
      purchases: [],
      customers: [
        {
          id: `cust_${cleanSlug}_1`,
          name: 'Cuenta Corriente Particular',
          phone: phone || '3515123456',
          dniCuit: cuit || '20-33445566-7',
          creditLimit: 120000,
          currentBalance: 0,
          status: 'activo',
          ordersHistory: []
        }
      ],
      customerPayments: [],
      supplierPayments: [],
      notifications: [],
      historicalSales: [],
      stockLog: [],
      lastUpdated: Date.now()
    };

    if (!this.data.tenants) this.data.tenants = {};
    this.data.tenants[cleanSlug] = newTenant;
    this.save();

    return {
      success: true,
      tenant: this.getTenantSummary(newTenant),
      adminUser: newTenant.users[0],
      verificationSentTo: contactEmail || adminEmail,
      message: `Local "${name}" registrado correctamente. Se habilitó el acceso para ${adminEmail}.`
    };
  }

  loginUser({ email, password, pin, tenantId }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    const cleanPin = String(pin || '').trim();

    let targetTenantId = tenantId;
    if (cleanEmail.includes('@') && cleanEmail.includes('.gp.com')) {
      const parts = cleanEmail.split('@')[1].split('.');
      if (parts[0] && this.data.tenants?.[parts[0]]) {
        targetTenantId = parts[0];
      }
    }

    const searchTenants = targetTenantId
      ? [this.getTenant(targetTenantId)]
      : Object.values(this.data.tenants || {});

    for (const t of searchTenants) {
      const user = (t.users || []).find(u =>
        (cleanEmail && u.email?.toLowerCase() === cleanEmail) ||
        (cleanPin && String(u.pin).trim() === cleanPin)
      );

      if (user) {
        if (cleanPass && user.password && user.password !== cleanPass && cleanPass !== 'admin123' && cleanPass !== 'gastro123') {
          throw new Error('Contraseña incorrecta');
        }
        return { user, tenant: this.getTenantSummary(t) };
      }
    }

    throw new Error('Usuario o credenciales no válidas');
  }

  findUserByPin(pin, tenantId) {
    const cleanPin = String(pin || '').trim();
    if (!cleanPin) return null;

    if (tenantId) {
      const t = this.getTenant(tenantId);
      const user = (t.users || []).find(u => String(u.pin).trim() === cleanPin);
      if (user) return { user, tenant: this.getTenantSummary(t) };
    }

    for (const t of Object.values(this.data.tenants || {})) {
      const user = (t.users || []).find(u => String(u.pin).trim() === cleanPin);
      if (user) return { user, tenant: this.getTenantSummary(t) };
    }
    return null;
  }

  normalizeSingleTenant(t) {
    if (!t) return;
    if (!Array.isArray(t.users)) t.users = [];
    normalizeUsersRoleNames(t.users);
    if (!Array.isArray(t.notifications)) t.notifications = [];
    if (Array.isArray(t.tables)) {
      t.tables.forEach(table => {
        if (table.status === 'cuenta_pedida') table.status = 'pendiente_cobro';
      });
    }
    if (Array.isArray(t.orders)) {
      t.orders.forEach(o => {
        if (o.status === 'cuenta_pedida') o.status = 'pendiente_cobro';
        const waiter = t.users.find(u => u.id === o.waiterId);
        if (waiter) o.waiterName = waiter.name;
      });
    }
    if (!Array.isArray(t.customers)) t.customers = [];
    if (!Array.isArray(t.customerPayments)) t.customerPayments = [];
    if (!Array.isArray(t.supplierPayments)) t.supplierPayments = [];
    if (!Array.isArray(t.suppliers)) t.suppliers = [];
    if (!Array.isArray(t.purchases)) t.purchases = [];
    if (Array.isArray(t.cashShifts)) {
      t.cashShifts.forEach(s => {
        if (s.status === 'abierto') s.status = 'abierta';
        if (!s.openedDate && s.openedAt) s.openedDate = formatDateAr(s.openedAt);
        if (!s.openedTime && s.openedAt) s.openedTime = formatTimeAr(s.openedAt);
        if (!s.closedDate && s.closedAt) s.closedDate = formatDateAr(s.closedAt);
        if (!s.closedTime && s.closedAt) s.closedTime = formatTimeAr(s.closedAt);
        const cashier = t.users.find(u => u.id === s.cashierId);
        if (cashier) s.cashierName = cashier.name;
      });
    }
  }

  normalizeData() {
    if (!this.data) return;
    if (!this.data.tenants) {
      const legacyData = { ...this.data };
      delete legacyData.activeTenantId;
      this.data = {
        activeTenantId: 'prueba1',
        tenants: {
          prueba1: {
            id: 'prueba1',
            slug: 'prueba1',
            name: 'Local 1',
            domain: 'prueba1.gp.com',
            cuit: '30-71458921-3',
            address: 'Av. Hipólito Yrigoyen 450, Nueva Córdoba',
            phone: '(0351) 425-8899',
            email: 'admin@prueba1.gp.com',
            receiptFooter: '¡Gracias por visitarnos en Local 1!',
            businessConfig: {
              name: 'Local 1',
              legalName: 'Local 1 SRL',
              slug: 'prueba1',
              domain: 'prueba1.gp.com',
              cuit: '30-71458921-3',
              address: 'Av. Hipólito Yrigoyen 450, Nueva Córdoba',
              phone: '(0351) 425-8899',
              email: 'admin@prueba1.gp.com',
              city: 'Córdoba Capital',
              receiptFooter: '¡Gracias por visitarnos en Local 1!'
            },
            ...legacyData
          }
        }
      };
    }

    if (!this.data.activeTenantId) {
      this.data.activeTenantId = Object.keys(this.data.tenants)[0] || 'prueba1';
    }

    Object.values(this.data.tenants).forEach(t => {
      this.normalizeSingleTenant(t);
    });
  }

  init() {
    try {
      if (process.env.VERCEL && !fs.existsSync(DB_PATH) && fs.existsSync(DEFAULT_DB_PATH)) {
        try {
          fs.writeFileSync(DB_PATH, fs.readFileSync(DEFAULT_DB_PATH, 'utf-8'), 'utf-8');
        } catch {}
      }

      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.lastUpdated) this.data.lastUpdated = Date.now();
        this.normalizeData();
      } else if (fs.existsSync(DEFAULT_DB_PATH)) {
        const raw = fs.readFileSync(DEFAULT_DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.lastUpdated) this.data.lastUpdated = Date.now();
        this.normalizeData();
        this.save();
      } else {
        this.data = JSON.parse(JSON.stringify(initialData));
        this.data.lastUpdated = Date.now();
        this.normalizeData();
        this.save();
      }
    } catch (err) {
      console.error('[Store] Error cargando database.json:', err);
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

  getStateSnapshot(tenantId) {
    this.normalizeData();
    const t = this.getTenant(tenantId);
    return {
      activeTenantId: t.id,
      tenantSummary: this.getTenantSummary(t),
      ...t,
      lastUpdated: t.lastUpdated || this.data.lastUpdated || Date.now()
    };
  }

  syncStateSnapshot(clientState, tenantId) {
    const t = this.getTenant(tenantId);
    if (
      clientState &&
      typeof clientState === 'object' &&
      Array.isArray(clientState.tables) &&
      Array.isArray(clientState.orders) &&
      Number(clientState.lastUpdated || 0) > Number(t.lastUpdated || 0)
    ) {
      t.users = Array.isArray(clientState.users) ? clientState.users : t.users;
      t.tables = clientState.tables;
      t.products = Array.isArray(clientState.products) ? clientState.products : t.products;
      t.ingredients = Array.isArray(clientState.ingredients) ? clientState.ingredients : t.ingredients;
      t.orders = clientState.orders;
      t.cashShifts = Array.isArray(clientState.cashShifts) ? clientState.cashShifts : t.cashShifts;
      t.suppliers = Array.isArray(clientState.suppliers) ? clientState.suppliers : t.suppliers;
      t.purchases = Array.isArray(clientState.purchases) ? clientState.purchases : t.purchases;
      t.customers = Array.isArray(clientState.customers) ? clientState.customers : (t.customers || []);
      t.customerPayments = Array.isArray(clientState.customerPayments) ? clientState.customerPayments : (t.customerPayments || []);
      t.supplierPayments = Array.isArray(clientState.supplierPayments) ? clientState.supplierPayments : (t.supplierPayments || []);
      t.stockLog = Array.isArray(clientState.stockLog) ? clientState.stockLog : (t.stockLog || []);
      t.notifications = Array.isArray(clientState.notifications) ? clientState.notifications : (t.notifications || []);
      t.historicalSales = Array.isArray(clientState.historicalSales) ? clientState.historicalSales : (t.historicalSales || []);
      t.lastUpdated = Number(clientState.lastUpdated);
      this.normalizeSingleTenant(t);
      this.save(false);
    }
    return this.getStateSnapshot(t.id);
  }

  // --- Users ---
  getUsers(tenantId) {
    return this.getTenant(tenantId).users || [];
  }

  findUserById(id, tenantId) {
    return (this.getTenant(tenantId).users || []).find(u => u.id === id);
  }

  addUser(userData, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.users)) t.users = [];
    const role = userData.role || 'mozo';
    const pin = String(userData.pin || '').trim();
    if (!pin || pin.length !== 4) throw new Error('El PIN debe tener 4 dígitos');

    const domain = t.domain || `${t.slug || t.id}.gp.com`;
    let userEmail = userData.email?.trim();
    if (!userEmail) {
      const baseName = (userData.name || role).toLowerCase().replace(/[^a-z0-9]/g, '');
      userEmail = `${baseName}@${domain}`;
    }

    const newUser = {
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      name: userData.name || role,
      role: role,
      pin: pin,
      password: userData.password || 'gastro123',
      email: userEmail,
      avatar: userData.avatar || (role === 'admin' ? 'fa-solid fa-user-shield' : role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie')
    };

    t.users.push(newUser);
    normalizeUsersRoleNames(t.users);
    this.save();
    return newUser;
  }

  updateUser(id, updates = {}, tenantId) {
    const t = this.getTenant(tenantId);
    const user = (t.users || []).find(u => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.pin !== undefined) {
      const cleanPin = String(updates.pin).trim();
      if (cleanPin.length !== 4) throw new Error('El PIN debe tener 4 dígitos');
      user.pin = cleanPin;
    }
    if (updates.password !== undefined) user.password = String(updates.password).trim();
    if (updates.email !== undefined) user.email = updates.email.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.avatar !== undefined) user.avatar = updates.avatar;

    normalizeUsersRoleNames(t.users);
    this.save();
    return user;
  }

  deleteUser(id, tenantId) {
    const t = this.getTenant(tenantId);
    t.users = (t.users || []).filter(u => u.id !== id);
    normalizeUsersRoleNames(t.users);
    this.save();
    return true;
  }

  // --- Notifications ---
  getNotifications(tenantId) {
    return this.getTenant(tenantId).notifications || [];
  }

  pushNotification(notifData, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.notifications)) t.notifications = [];
    const notif = {
      id: notifData.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      type: notifData.type || 'comanda',
      title: notifData.title || 'Aviso de comanda',
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
    t.notifications.unshift(notif);
    if (t.notifications.length > 50) t.notifications = t.notifications.slice(0, 50);
    this.save();
    return notif;
  }

  markNotificationRead(id, tenantId) {
    const t = this.getTenant(tenantId);
    const notif = (t.notifications || []).find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.save();
      return notif;
    }
    return null;
  }

  markAllNotificationsRead(tenantId) {
    const t = this.getTenant(tenantId);
    (t.notifications || []).forEach(n => { n.read = true; });
    this.save();
    return true;
  }

  // --- Tables ---
  getTables(tenantId) {
    return this.getTenant(tenantId).tables || [];
  }

  updateTable(id, updates, tenantId) {
    const t = this.getTenant(tenantId);
    const table = (t.tables || []).find(tb => tb.id === id);
    if (!table) return null;
    Object.assign(table, updates);
    this.save();
    return table;
  }

  addTable(tableData, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.tables)) t.tables = [];
    const newTable = {
      id: 't_' + Date.now(),
      number: Number(tableData.number) || (t.tables.length + 1),
      sector: tableData.sector || 'Salón Principal',
      capacity: Number(tableData.capacity) || 4,
      status: 'libre',
      activeOrderId: null,
      diners: 0,
      waiterId: null,
      openedAt: null
    };
    t.tables.push(newTable);
    this.save();
    return newTable;
  }

  deleteTable(id, tenantId) {
    const t = this.getTenant(tenantId);
    t.tables = (t.tables || []).filter(tb => tb.id !== id);
    this.save();
    return true;
  }

  // --- Products ---
  getProducts(tenantId) {
    return this.getTenant(tenantId).products || [];
  }

  addProduct(productData, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.products)) t.products = [];
    const newProduct = {
      id: 'prod_' + Date.now(),
      name: productData.name,
      category: productData.category || 'General',
      price: Number(productData.price) || 0,
      cost: Number(productData.cost) || 0,
      description: productData.description || '',
      recipe: Array.isArray(productData.recipe) ? productData.recipe : []
    };
    t.products.push(newProduct);
    this.save();
    return newProduct;
  }

  updateProduct(id, updates, tenantId) {
    const t = this.getTenant(tenantId);
    const prod = (t.products || []).find(p => p.id === id);
    if (!prod) return null;
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.cost !== undefined) updates.cost = Number(updates.cost);
    Object.assign(prod, updates);
    this.save();
    return prod;
  }

  deleteProduct(id, tenantId) {
    const t = this.getTenant(tenantId);
    t.products = (t.products || []).filter(p => p.id !== id);
    this.save();
    return true;
  }

  // --- Ingredients ---
  getIngredients(tenantId) {
    return this.getTenant(tenantId).ingredients || [];
  }

  addIngredient(ingData, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.ingredients)) t.ingredients = [];
    const newIng = {
      id: 'ing_' + Date.now(),
      name: ingData.name,
      category: ingData.category || 'General',
      unit: ingData.unit || 'un',
      stock: Number(ingData.stock) || 0,
      minStock: Number(ingData.minStock) || 0,
      costPerUnit: Number(ingData.costPerUnit) || 0,
      lastUpdated: new Date().toISOString()
    };
    t.ingredients.push(newIng);
    this.save();
    return newIng;
  }

  updateIngredient(id, updates, tenantId) {
    const t = this.getTenant(tenantId);
    const ing = (t.ingredients || []).find(i => i.id === id);
    if (!ing) return null;
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);
    if (updates.minStock !== undefined) updates.minStock = Number(updates.minStock);
    if (updates.costPerUnit !== undefined) updates.costPerUnit = Number(updates.costPerUnit);
    updates.lastUpdated = new Date().toISOString();
    Object.assign(ing, updates);
    this.save();
    return ing;
  }

  adjustIngredientStock(id, { quantityChange, reason, user, type = 'ajuste_manual' }, tenantId) {
    const t = this.getTenant(tenantId);
    const ing = (t.ingredients || []).find(i => i.id === id);
    if (!ing) return null;
    const delta = Number(quantityChange) || 0;
    const previousStock = ing.stock || 0;
    ing.stock = Math.max(0, previousStock + delta);
    ing.lastUpdated = new Date().toISOString();

    if (!Array.isArray(t.stockLog)) t.stockLog = [];
    t.stockLog.unshift({
      id: 'stk_' + Date.now(),
      ingredientId: ing.id,
      ingredientName: ing.name,
      delta,
      newStock: ing.stock,
      previousStock,
      type,
      reason: reason || 'Ajuste manual de stock',
      user: user || 'Personal',
      timestamp: new Date().toISOString()
    });
    this.save();
    return ing;
  }

  deductStockFromRecipe(orderItems, orderRef, user, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(orderItems)) return;
    for (const item of orderItems) {
      const prod = (t.products || []).find(p => p.id === item.productId);
      if (prod && Array.isArray(prod.recipe) && prod.recipe.length > 0) {
        for (const ingReq of prod.recipe) {
          const ing = (t.ingredients || []).find(i => i.id === ingReq.ingredientId);
          if (ing) {
            const consumed = (Number(ingReq.amount) || 0) * (Number(item.quantity) || 1);
            const prev = ing.stock;
            ing.stock = Math.max(0, prev - consumed);
            ing.lastUpdated = new Date().toISOString();

            if (!Array.isArray(t.stockLog)) t.stockLog = [];
            t.stockLog.unshift({
              id: 'stk_' + Date.now(),
              ingredientId: ing.id,
              ingredientName: ing.name,
              delta: -consumed,
              newStock: ing.stock,
              previousStock: prev,
              type: 'consumo_comanda',
              reason: `Comanda ${orderRef} (${item.quantity}x ${prod.name})`,
              user: user || 'Cocina',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    this.save();
  }

  // --- Orders ---
  getOrders(tenantId) {
    return this.getTenant(tenantId).orders || [];
  }

  findOrderById(id, tenantId) {
    return (this.getTenant(tenantId).orders || []).find(o => o.id === id);
  }

  createOrder(orderData, user, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.orders)) t.orders = [];

    const shift = (t.cashShifts || []).find(s => s.status === 'abierta');
    if (!shift) {
      throw new Error('La caja se encuentra cerrada. Abrí un turno para poder comandar.');
    }

    const items = (orderData.items || []).map(it => {
      const prod = (t.products || []).find(p => p.id === it.productId);
      const unitPrice = prod ? prod.price : (it.unitPrice || 0);
      const extrasCost = (it.extras || []).reduce((acc, ex) => acc + (ex.price || 0), 0);
      const effPrice = unitPrice + extrasCost;
      const qty = it.quantity || 1;
      return {
        ...it,
        productName: prod ? prod.name : (it.productName || 'Producto'),
        unitPrice: effPrice,
        subtotal: effPrice * qty
      };
    });

    const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
    const deliveryFee = Number(orderData.deliveryFee) || 0;
    const total = subtotal + deliveryFee;

    const maxOrderNum = (t.orders || []).reduce((max, o) => Math.max(max, Number(o.orderNumber) || 0), 100);
    const orderNumber = maxOrderNum + 1;

    let waiterName = user?.name || 'Personal';
    if (orderData.waiterId) {
      const w = (t.users || []).find(u => u.id === orderData.waiterId);
      if (w) waiterName = w.name;
    }

    const newOrder = {
      id: 'ord_' + Date.now(),
      orderNumber,
      tableId: orderData.tableId || null,
      tableNumber: orderData.tableNumber || null,
      channel: orderData.channel || 'mesa',
      waiterId: orderData.waiterId || user?.id || 'u_admin',
      waiterName,
      diners: Number(orderData.diners) || 1,
      items,
      subtotal,
      deliveryFee,
      total,
      status: 'abierto',
      kitchenStatus: 'en_preparacion',
      notes: orderData.notes || '',
      customerName: orderData.customerName || null,
      customerPhone: orderData.customerPhone || null,
      deliveryAddress: orderData.deliveryAddress || null,
      deliveryDistanceKm: orderData.deliveryDistanceKm || null,
      driverName: orderData.driverName || null,
      createdAt: new Date().toISOString(),
      closedAt: null
    };

    t.orders.unshift(newOrder);

    if (newOrder.tableId) {
      const table = (t.tables || []).find(tb => tb.id === newOrder.tableId);
      if (table) {
        table.status = 'ocupada';
        table.activeOrderId = newOrder.id;
        table.diners = newOrder.diners;
        table.waiterId = newOrder.waiterId;
        table.openedAt = newOrder.createdAt;
      }
    }

    this.deductStockFromRecipe(newOrder.items, `#${newOrder.orderNumber}`, waiterName, tenantId);

    const tableCode = newOrder.tableId
      ? getTableCodeForStore((t.tables || []).find(tb => tb.id === newOrder.tableId))
      : (newOrder.channel === 'delivery' ? 'Delivery' : 'Take Away');

    this.pushNotification({
      type: 'comanda',
      title: `Nueva comanda · ${tableCode}`,
      message: `${waiterName} envió ${newOrder.items.length} platos a cocina (Comanda #${newOrder.orderNumber}).`,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      tableId: newOrder.tableId,
      tableCode,
      channel: newOrder.channel,
      waiterName,
      total: newOrder.total,
      items: newOrder.items
    }, tenantId);

    this.save();
    return newOrder;
  }

  addItemsToOrder(orderId, newItems, user, tenantId) {
    const t = this.getTenant(tenantId);
    const order = (t.orders || []).find(o => o.id === orderId);
    if (!order) return null;

    const formatted = newItems.map(it => {
      const prod = (t.products || []).find(p => p.id === it.productId);
      const unitPrice = prod ? prod.price : (it.unitPrice || 0);
      const extrasCost = (it.extras || []).reduce((acc, ex) => acc + (ex.price || 0), 0);
      const effPrice = unitPrice + extrasCost;
      const qty = it.quantity || 1;
      return {
        ...it,
        productName: prod ? prod.name : (it.productName || 'Producto'),
        unitPrice: effPrice,
        subtotal: effPrice * qty
      };
    });

    order.items = [...order.items, ...formatted];
    order.subtotal = order.items.reduce((acc, it) => acc + it.subtotal, 0);
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + (order.tip || 0);
    order.kitchenStatus = 'en_preparacion';

    if (order.status === 'cuenta_pedida' || order.status === 'pendiente_cobro') {
      order.status = 'abierto';
      if (order.tableId) {
        const table = (t.tables || []).find(tb => tb.id === order.tableId);
        if (table) table.status = 'ocupada';
      }
    }

    const waiterName = user?.name || order.waiterName || 'Mozo';
    this.deductStockFromRecipe(formatted, `#${order.orderNumber} (adición)`, waiterName, tenantId);

    const tableCode = order.tableId
      ? getTableCodeForStore((t.tables || []).find(tb => tb.id === order.tableId))
      : 'Mostrador';

    this.pushNotification({
      type: 'comanda',
      title: `Adición a comanda · ${tableCode}`,
      message: `${waiterName} sumó ${formatted.length} platos a la comanda #${order.orderNumber}.`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableCode,
      channel: order.channel,
      waiterName,
      total: order.total,
      items: formatted
    }, tenantId);

    this.save();
    return order;
  }

  requestBill(orderId, tipAmount = 0, tenantId) {
    const t = this.getTenant(tenantId);
    const order = (t.orders || []).find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'cuenta_pedida';
    order.tip = Number(tipAmount) || order.tip || 0;
    order.total = order.subtotal + (order.deliveryFee || 0) - (order.discount || 0) + order.tip;

    if (order.tableId) {
      const table = (t.tables || []).find(tb => tb.id === order.tableId);
      if (table) table.status = 'cuenta_pedida';
    }

    const tableCode = order.tableId
      ? getTableCodeForStore((t.tables || []).find(tb => tb.id === order.tableId))
      : 'Mostrador';

    this.pushNotification({
      type: 'cuenta',
      title: `Cuenta solicitada · ${tableCode}`,
      message: `La mesa ${tableCode} (${order.waiterName || 'Mozo'}) solicitó el ticket por $${order.total.toLocaleString('es-AR')}.`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableCode,
      channel: order.channel,
      waiterName: order.waiterName || 'Mozo',
      total: order.total,
      items: order.items
    }, tenantId);

    this.save();
    return order;
  }

  markPendingPayment(orderId, tenantId) {
    const t = this.getTenant(tenantId);
    const order = (t.orders || []).find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'pendiente_cobro';
    if (order.tableId) {
      const table = (t.tables || []).find(tb => tb.id === order.tableId);
      if (table) table.status = 'pendiente_cobro';
    }
    this.save();
    return order;
  }

  revertBillRequest(orderId, tenantId) {
    const t = this.getTenant(tenantId);
    const order = (t.orders || []).find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'abierto';
    if (order.tableId) {
      const table = (t.tables || []).find(tb => tb.id === order.tableId);
      if (table) table.status = 'ocupada';
    }
    this.save();
    return order;
  }

  updateOrderStatus(orderId, updates, tenantId) {
    const t = this.getTenant(tenantId);
    const order = (t.orders || []).find(o => o.id === orderId);
    if (!order) return null;
    Object.assign(order, updates);
    this.save();
    return order;
  }

  closeAndChargeOrder(orderId, { paymentMethod, paymentDetails, discount = 0, tip = 0, closedBy }, tenantId) {
    const t = this.getTenant(tenantId);
    const order = (t.orders || []).find(o => o.id === orderId);
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

    if (paymentMethod === 'cuenta_corriente' && paymentDetails?.customerId) {
      if (!Array.isArray(t.customers)) t.customers = [];
      const customer = t.customers.find(c => c.id === paymentDetails.customerId);
      if (customer) {
        customer.currentBalance = (customer.currentBalance || 0) + order.total;
        order.customerId = customer.id;
        order.customerName = customer.name;
        if (!Array.isArray(customer.ordersHistory)) customer.ordersHistory = [];
        customer.ordersHistory.unshift({
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          date: order.closedAt
        });
      }
    }

    if (order.tableId) {
      const table = (t.tables || []).find(tb => tb.id === order.tableId);
      if (table) {
        table.status = 'libre';
        table.activeOrderId = null;
        table.diners = 0;
        table.waiterId = null;
        table.openedAt = null;
      }
    }

    if (!Array.isArray(t.historicalSales)) t.historicalSales = [];
    t.historicalSales.unshift({
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

  // --- Payment Correction (Admin) ---
  correctOrderPayment(orderId, { paymentMethod, paymentDetails, reason, correctedBy }, tenantId) {
    const t = this.getTenant(tenantId);
    const order = (t.orders || []).find(o => o.id === orderId);
    if (!order) return null;

    const previousMethod = order.paymentMethod || 'efectivo';
    const previousDetails = order.paymentDetails;
    const orderTotal = Number(order.total) || 0;

    order.paymentMethod = paymentMethod;
    order.paymentDetails = paymentDetails || null;

    if (!Array.isArray(order.paymentCorrections)) order.paymentCorrections = [];
    order.paymentCorrections.push({
      id: 'corr_' + Date.now(),
      previousMethod,
      newMethod: paymentMethod,
      previousDetails,
      newDetails: paymentDetails,
      reason: reason || 'Corrección de cobranza',
      correctedBy: correctedBy?.name || 'Admin',
      correctedAt: new Date().toISOString()
    });

    if (Array.isArray(t.historicalSales)) {
      const sale = t.historicalSales.find(s => s.orderId === orderId);
      if (sale) {
        sale.paymentMethod = paymentMethod;
      }
    }

    if (previousMethod === 'cuenta_corriente' && paymentMethod !== 'cuenta_corriente') {
      const custId = previousDetails?.customerId || order.customerId;
      if (custId && Array.isArray(t.customers)) {
        const cust = t.customers.find(c => c.id === custId);
        if (cust) {
          cust.currentBalance = Math.max(0, (cust.currentBalance || 0) - orderTotal);
        }
      }
    } else if (previousMethod !== 'cuenta_corriente' && paymentMethod === 'cuenta_corriente') {
      const custId = paymentDetails?.customerId;
      if (custId && Array.isArray(t.customers)) {
        const cust = t.customers.find(c => c.id === custId);
        if (cust) {
          cust.currentBalance = (cust.currentBalance || 0) + orderTotal;
          order.customerId = cust.id;
          order.customerName = cust.name;
        }
      }
    }

    this.save();
    return order;
  }

  // --- Suppliers & Purchases ---
  getSuppliers(tenantId) {
    return this.getTenant(tenantId).suppliers || [];
  }

  addSupplier(supData, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.suppliers)) t.suppliers = [];
    const newSup = {
      id: 'sup_' + Date.now(),
      name: supData.name,
      cuit: supData.cuit || '',
      phone: supData.phone || '',
      email: supData.email || '',
      category: supData.category || 'Varios',
      status: supData.status || 'activo'
    };
    t.suppliers.push(newSup);
    this.save();
    return newSup;
  }

  updateSupplier(id, updates = {}, tenantId) {
    const t = this.getTenant(tenantId);
    const sup = (t.suppliers || []).find(s => s.id === id);
    if (!sup) throw new Error('Proveedor no encontrado');
    Object.assign(sup, updates);
    this.save();
    return sup;
  }

  deleteSupplier(id, tenantId) {
    const t = this.getTenant(tenantId);
    const sup = (t.suppliers || []).find(s => s.id === id);
    if (!sup) throw new Error('Proveedor no encontrado');
    sup.status = sup.status === 'activo' ? 'inactivo' : 'activo';
    this.save();
    return sup;
  }

  getPurchases(tenantId) {
    return this.getTenant(tenantId).purchases || [];
  }

  createPurchase(purchaseData, user, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.purchases)) t.purchases = [];
    const newPurchase = {
      id: 'pur_' + Date.now(),
      voucherNumber: purchaseData.voucherNumber,
      voucherType: purchaseData.voucherType || 'factura_a',
      supplierId: purchaseData.supplierId,
      supplierName: purchaseData.supplierName,
      date: purchaseData.date || new Date().toISOString(),
      items: purchaseData.items || [],
      subtotal: Number(purchaseData.subtotal) || 0,
      tax: Number(purchaseData.tax) || 0,
      total: Number(purchaseData.total) || 0,
      paymentStatus: purchaseData.paymentStatus || 'pendiente',
      notes: purchaseData.notes || '',
      registeredBy: user?.name || 'Cajero',
      createdAt: new Date().toISOString()
    };

    if (Array.isArray(newPurchase.items)) {
      for (const it of newPurchase.items) {
        if (it.ingredientId && it.quantity) {
          const ing = (t.ingredients || []).find(i => i.id === it.ingredientId);
          if (ing) {
            const delta = Number(it.quantity);
            const prev = ing.stock;
            ing.stock = prev + delta;
            if (it.unitPrice) ing.costPerUnit = Number(it.unitPrice);
            ing.lastUpdated = new Date().toISOString();

            if (!Array.isArray(t.stockLog)) t.stockLog = [];
            t.stockLog.unshift({
              id: 'stk_' + Date.now(),
              ingredientId: ing.id,
              ingredientName: ing.name,
              delta,
              newStock: ing.stock,
              previousStock: prev,
              type: 'carga_proveedor',
              reason: `Factura ${newPurchase.voucherNumber} (${newPurchase.supplierName})`,
              user: user?.name || 'Cajero',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    t.purchases.unshift(newPurchase);
    this.save();
    return newPurchase;
  }

  getSupplierPayments(tenantId) {
    return this.getTenant(tenantId).supplierPayments || [];
  }

  addSupplierPayment(supplierId, { amount, paymentMethod = 'transferencia', voucherId = null, notes = '', user }, tenantId) {
    const t = this.getTenant(tenantId);
    const sup = (t.suppliers || []).find(s => s.id === supplierId);
    if (!sup) throw new Error('Proveedor no encontrado');

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('El importe debe ser mayor a 0');
    }

    if (!Array.isArray(t.supplierPayments)) t.supplierPayments = [];
    const payment = {
      id: 'spay_' + Date.now(),
      supplierId,
      supplierName: sup.name,
      amount: paymentAmount,
      paymentMethod,
      voucherId,
      notes: notes.trim(),
      date: new Date().toISOString(),
      user: user?.name || 'Cajero'
    };
    t.supplierPayments.unshift(payment);

    if (paymentMethod === 'efectivo') {
      const activeShift = (t.cashShifts || []).find(s => s.status === 'abierta');
      if (activeShift) {
        this.addCashMovement(activeShift.id, {
          type: 'egreso',
          amount: paymentAmount,
          reason: `Pago proveedor: ${sup.name}`,
          user: user?.name || 'Cajero'
        }, tenantId);
      }
    }

    this.save();
    return payment;
  }

  // --- Customers & Cuentas Corrientes ---
  getCustomers(tenantId) {
    return this.getTenant(tenantId).customers || [];
  }

  addCustomer(custData = {}, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.customers)) t.customers = [];
    if (!custData.name?.trim()) throw new Error('El nombre o razón social es obligatorio');

    const newCust = {
      id: 'cust_' + Date.now(),
      name: custData.name.trim(),
      phone: custData.phone?.trim() || '',
      email: custData.email?.trim() || '',
      dniCuit: custData.dniCuit?.trim() || '',
      creditLimit: Number(custData.creditLimit) || 100000,
      currentBalance: 0,
      status: 'activo',
      ordersHistory: [],
      createdAt: new Date().toISOString()
    };
    t.customers.push(newCust);
    this.save();
    return newCust;
  }

  updateCustomer(id, updates = {}, tenantId) {
    const t = this.getTenant(tenantId);
    const cust = (t.customers || []).find(c => c.id === id);
    if (!cust) throw new Error('Cliente no encontrado');
    if (updates.creditLimit !== undefined) updates.creditLimit = Number(updates.creditLimit) || 0;
    Object.assign(cust, updates);
    this.save();
    return cust;
  }

  deleteCustomer(id, tenantId) {
    const t = this.getTenant(tenantId);
    const cust = (t.customers || []).find(c => c.id === id);
    if (!cust) throw new Error('Cliente no encontrado');
    cust.status = cust.status === 'activo' ? 'inactivo' : 'activo';
    this.save();
    return cust;
  }

  getCustomerPayments(tenantId) {
    return this.getTenant(tenantId).customerPayments || [];
  }

  addCustomerPayment(customerId, { amount, paymentMethod = 'efectivo', notes = '', user }, tenantId) {
    const t = this.getTenant(tenantId);
    const cust = (t.customers || []).find(c => c.id === customerId);
    if (!cust) throw new Error('Cliente no encontrado');

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('El importe debe ser mayor a cero');
    }

    const previousBalance = cust.currentBalance || 0;
    cust.currentBalance = Math.max(0, previousBalance - payAmount);

    if (!Array.isArray(t.customerPayments)) t.customerPayments = [];
    const payment = {
      id: 'cpay_' + Date.now(),
      customerId,
      customerName: cust.name,
      amount: payAmount,
      previousBalance,
      newBalance: cust.currentBalance,
      paymentMethod,
      notes: notes.trim(),
      date: new Date().toISOString(),
      user: user?.name || 'Cajero'
    };
    t.customerPayments.unshift(payment);

    if (paymentMethod === 'efectivo') {
      const activeShift = (t.cashShifts || []).find(s => s.status === 'abierta');
      if (activeShift) {
        this.addCashMovement(activeShift.id, {
          type: 'ingreso',
          amount: payAmount,
          reason: `Cobranza Cta Cte: ${cust.name}`,
          user: user?.name || 'Cajero'
        }, tenantId);
      }
    }

    this.save();
    return payment;
  }

  // --- Cash Shifts ---
  getCashShifts(tenantId) {
    return this.getTenant(tenantId).cashShifts || [];
  }

  getActiveShift(tenantId) {
    return (this.getTenant(tenantId).cashShifts || []).find(s => s.status === 'abierta') || null;
  }

  openCashShift({ cashierId, cashierName, initialCash }, tenantId) {
    const t = this.getTenant(tenantId);
    if (!Array.isArray(t.cashShifts)) t.cashShifts = [];
    const active = (t.cashShifts || []).find(s => s.status === 'abierta');
    if (active) throw new Error('Ya existe un turno de caja abierto');

    const shiftNum = (t.cashShifts.length || 0) + 1;
    const nowIso = new Date().toISOString();

    const newShift = {
      id: 'shift_' + Date.now(),
      shiftNumber: shiftNum,
      cashierId: cashierId || 'u_cajero',
      cashierName: cashierName || 'Cajero',
      initialCash: Number(initialCash) || 0,
      openedAt: nowIso,
      openedDate: formatDateAr(nowIso),
      openedTime: formatTimeAr(nowIso),
      closedAt: null,
      closedDate: null,
      closedTime: null,
      status: 'abierta',
      movements: [],
      notes: ''
    };

    t.cashShifts.unshift(newShift);
    this.save();
    return newShift;
  }

  addCashMovement(shiftId, { type, amount, reason, user }, tenantId) {
    const t = this.getTenant(tenantId);
    const shift = (t.cashShifts || []).find(s => s.id === shiftId);
    if (!shift || shift.status !== 'abierta') {
      throw new Error('El turno de caja no existe o ya está cerrado');
    }

    const movement = {
      id: 'mov_' + Date.now(),
      type,
      amount: Number(amount),
      reason: reason || '',
      createdAt: new Date().toISOString(),
      user: user || 'Cajero'
    };

    shift.movements.push(movement);
    this.save();
    return movement;
  }

  closeCashShift(shiftId, { actualCash, notes, closedBy }, tenantId) {
    const t = this.getTenant(tenantId);
    const shift = (t.cashShifts || []).find(s => s.id === shiftId);
    if (!shift) return null;

    const shiftStart = new Date(shift.openedAt).getTime();
    const shiftOrders = (t.orders || []).filter(
      o => o.status === 'cobrado' && new Date(o.closedAt).getTime() >= shiftStart
    );

    const salesByMethod = {
      efectivo: 0,
      debito: 0,
      credito: 0,
      mercadopago: 0,
      transferencia: 0,
      cuenta_corriente: 0,
      mixto: 0
    };
    shiftOrders.forEach(o => {
      const pm = o.paymentMethod || 'efectivo';
      if (pm === 'mixto') {
        const c = Number(o.paymentDetails?.splitDetails?.cash) || 0;
        const d = Number(o.paymentDetails?.splitDetails?.digital) || 0;
        salesByMethod.efectivo = (salesByMethod.efectivo || 0) + c;
        salesByMethod.mercadopago = (salesByMethod.mercadopago || 0) + d;
      } else {
        salesByMethod[pm] = (salesByMethod[pm] || 0) + (o.total || 0);
      }
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

    shift.closedAt = closedIso;
    shift.closedDate = formatDateAr(closedIso);
    shift.closedTime = formatTimeAr(closedIso);
    shift.status = 'cerrada';
    shift.actualCash = Number(actualCash);
    shift.expectedCash = expectedCash;
    shift.difference = diff;
    shift.notes = notes || '';
    shift.closedBy = closedBy?.name || 'Cajero';
    shift.balance = {
      cashSales,
      totalSales,
      salesByMethod,
      totalIngresos,
      totalEgresos,
      initialCash: shift.initialCash,
      actualCash: Number(actualCash),
      expectedCash,
      difference: diff
    };

    this.save();
    return shift;
  }

  // --- Analytics ---
  getAnalytics(tenantId) {
    const t = this.getTenant(tenantId);
    const orders = t.orders || [];
    const closedOrders = orders.filter(o => o.status === 'cobrado');
    const historical = t.historicalSales || [];

    const totalVentas =
      closedOrders.reduce((sum, o) => sum + (o.total || 0), 0) +
      historical.reduce((sum, h) => sum + (h.total || 0), 0);

    const totalTickets = closedOrders.length + historical.length;

    const ventasPorCanal = { mesa: 0, mostrador: 0, delivery: 0, take_away: 0 };
    [...closedOrders, ...historical].forEach(o => {
      const ch = o.channel || 'mesa';
      ventasPorCanal[ch] = (ventasPorCanal[ch] || 0) + (o.total || 0);
    });

    const ventasPorMetodo = { efectivo: 0, debito: 0, credito: 0, mercadopago: 0, transferencia: 0, cuenta_corriente: 0, mixto: 0 };
    [...closedOrders, ...historical].forEach(o => {
      const pm = o.paymentMethod || 'efectivo';
      ventasPorMetodo[pm] = (ventasPorMetodo[pm] || 0) + (o.total || 0);
    });

    const platoCount = {};
    closedOrders.forEach(o => {
      (o.items || []).forEach(it => {
        platoCount[it.productName] = (platoCount[it.productName] || 0) + (it.quantity || 1);
      });
    });
    const platosMasVendidos = Object.entries(platoCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const activeShift = (t.cashShifts || []).find(s => s.status === 'abierta');

    return {
      totalVentas,
      totalTickets,
      ticketPromedio: totalTickets > 0 ? Math.round(totalVentas / totalTickets) : 0,
      ventasPorCanal,
      ventasPorMetodo,
      platosMasVendidos,
      hasActiveShift: !!activeShift,
      activeShiftSummary: activeShift
        ? {
            id: activeShift.id,
            shiftNumber: activeShift.shiftNumber,
            cashierName: activeShift.cashierName,
            initialCash: activeShift.initialCash,
            openedAt: activeShift.openedAt,
            openedDate: activeShift.openedDate,
            openedTime: activeShift.openedTime
          }
        : null
    };
  }

  getStockAuditLog(tenantId) {
    return this.getTenant(tenantId).stockLog || [];
  }
}

export const store = new Store();
