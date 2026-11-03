import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, SYNC_CHANNEL_NAME } from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Session starts unauthenticated (null) so the operator logs in from the User Access Dashboard
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('gastro_user_session');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error loading stored user session:', e);
    }
    return null;
  });

  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('gastro_theme');
      if (saved === 'paper' || saved === 'graphite') return saved;
    } catch (e) {}
    return 'graphite';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.getElementById('meta-theme-color');
    if (meta) {
      meta.setAttribute('content', theme === 'paper' ? '#ffffff' : '#17191c');
    }
    try {
      localStorage.setItem('gastro_theme', theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'graphite' ? 'paper' : 'graphite'));
  }, []);

  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const storedTab = localStorage.getItem('gastro_active_tab');
      if (storedTab) return storedTab;
    } catch (e) {}
    return 'mesas';
  });

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('gastro_active_tab', tab);
    } catch (e) {}
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [lastClosedShiftReport, setLastClosedShiftReport] = useState(null);
  const [toast, setToast] = useState(null);

  const [activeTenantId, setActiveTenantIdState] = useState(() => {
    try {
      return localStorage.getItem('gastro_pos_tenant_id') || 'quepibar';
    } catch (e) {
      return 'quepibar';
    }
  });

  const [tenantsList, setTenantsList] = useState([]);
  const [businessConfig, setBusinessConfig] = useState({
    name: 'Qué Pi Bar & Tapas',
    legalName: 'Qué Pi Bar Gastronomía SRL',
    address: 'Belgrano 740, Barrio Güemes, Córdoba Capital',
    phone: '(0351) 460-2211',
    cuit: '30-71458921-3',
    email: 'admin@quepibar.gp.com',
    city: 'Córdoba Capital',
    receiptFooter: '¡Gracias por visitarnos en Barrio Güemes! Qué Pi Bar & Tapas',
    domain: 'quepibar.gp.com'
  });

  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stockLog, setStockLog] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3800);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [
        usersData,
        tablesData,
        productsData,
        ingredientsData,
        ordersData,
        shiftRes,
        suppliersData,
        purchasesData,
        customersData,
        custPaymentsData,
        supPaymentsData,
        analyticsData,
        logData,
        notifsData,
        bizConfigData,
        tenantsData
      ] = await Promise.all([
        api.getUsers(),
        api.getTables(),
        api.getProducts(),
        api.getIngredients(),
        api.getOrders(),
        api.getActiveShift(),
        api.getSuppliers(),
        api.getPurchases(),
        api.getCustomers(),
        api.getCustomerPayments(),
        api.getSupplierPayments(),
        api.getAnalytics(),
        api.getStockLog(),
        api.getNotifications(),
        api.getBusinessConfig(),
        api.listTenants()
      ]);

      setUsers(usersData);
      setTables(tablesData);
      setProducts(productsData);
      setIngredients(ingredientsData);
      setOrders(ordersData);
      const activeShiftObj = shiftRes && typeof shiftRes === 'object' && 'active' in shiftRes ? shiftRes.active : shiftRes;
      setActiveShift(activeShiftObj || null);
      setSuppliers(suppliersData);
      setPurchases(purchasesData);
      setCustomers(customersData || []);
      setCustomerPayments(custPaymentsData || []);
      setSupplierPayments(supPaymentsData || []);
      setAnalytics(analyticsData);
      setStockLog(logData);
      setNotifications(notifsData || []);
      if (bizConfigData) setBusinessConfig(bizConfigData);
      if (Array.isArray(tenantsData)) setTenantsList(tenantsData);
      setCurrentUser(prev => {
        if (!prev) return null;
        const updated = (usersData || []).find(u => u.id === prev.id);
        return updated ? { ...updated } : prev;
      });
      setApiError(null);
    } catch (err) {
      console.error('Error cargando datos de GastroPOS:', err);
      setApiError('No pudimos conectar con el servidor de comandas. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Cross-tab & cross-device synchronization (Mobile Comandera <-> Desktop POS)
  useEffect(() => {
    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        channel.onmessage = (ev) => {
          if (ev.data?.type === 'DB_UPDATED') {
            api.reloadFromLocalStorage();
            refreshData();
          }
        };
      }
    } catch (e) {}

    const onStorage = (e) => {
      if (e.key === 'gastro_pos_db_v3' || e.key === 'gastro_pos_db_v2') {
        api.reloadFromLocalStorage();
        refreshData();
      }
    };
    window.addEventListener('storage', onStorage);

    const syncInterval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const res = await api.syncWithServer();
      if (res?.changed) {
        refreshData();
      }
    }, 3500);

    return () => {
      try { channel?.close(); } catch (e) {}
      window.removeEventListener('storage', onStorage);
      clearInterval(syncInterval);
    };
  }, [refreshData]);

  // Enforce domain rule: mozos can only access Salón / Mesas
  useEffect(() => {
    if (currentUser?.role === 'mozo' && activeTab !== 'mesas') {
      setActiveTab('mesas');
    }
  }, [currentUser, activeTab, setActiveTab]);

  const switchUser = useCallback((user) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('gastro_user_session', JSON.stringify(user));
    } catch (e) {
      console.error('Error saving user session:', e);
    }
    if (user.role === 'mozo') {
      setActiveTab('mesas');
    }
    showToast(`Sesión activa: ${user.name}`, 'info');
  }, [setActiveTab, showToast]);

  const logoutUser = useCallback(() => {
    setCurrentUser(null);
    setIsSidebarOpen(false);
    setIsPinModalOpen(false);
    try {
      sessionStorage.removeItem('gastro_user_session');
    } catch (e) {}
    showToast('Sesión finalizada', 'info');
  }, [showToast]);

  const loginWithPin = async (pin) => {
    try {
      const res = await api.loginWithPin(pin);
      if (res.user) {
        switchUser(res.user);
        setIsPinModalOpen(false);
        return true;
      }
    } catch (err) {
      showToast(err.message || 'PIN no válido', 'error');
      return false;
    }
  };

  const switchTenant = useCallback(async (tenantId, userToLogin = null) => {
    setLoading(true);
    api.setTenant(tenantId);
    setActiveTenantIdState(tenantId);
    try {
      localStorage.setItem('gastro_pos_tenant_id', tenantId);
    } catch (e) {}

    if (userToLogin) {
      setCurrentUser(userToLogin);
      try {
        sessionStorage.setItem('gastro_user_session', JSON.stringify(userToLogin));
      } catch (e) {}
    } else {
      setCurrentUser(null);
      try {
        sessionStorage.removeItem('gastro_user_session');
      } catch (e) {}
    }

    await refreshData();
    setLoading(false);
  }, [refreshData]);

  const updateBusinessConfig = useCallback(async (configUpdates) => {
    try {
      const updated = await api.updateBusinessConfig(configUpdates);
      setBusinessConfig(updated);
      showToast('Datos del local guardados con éxito');
      await refreshData();
      return updated;
    } catch (err) {
      showToast(err.message || 'Error al actualizar datos del local', 'error');
      throw err;
    }
  }, [showToast, refreshData]);

  const correctOrderPayment = useCallback(async (orderId, correctionData) => {
    try {
      const updated = await api.correctOrderPayment(orderId, {
        ...correctionData,
        correctedBy: currentUser
      });
      showToast(`Cobro comanda #${updated.orderNumber} corregido a ${updated.paymentMethod}`);
      await refreshData();
      return updated;
    } catch (err) {
      showToast(err.message || 'Error al rectificar medio de pago', 'error');
      throw err;
    }
  }, [currentUser, showToast, refreshData]);

  const markNotificationRead = useCallback(async (id) => {
    await api.markNotificationRead(id);
    await refreshData();
  }, [refreshData]);

  const markAllNotificationsRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    await refreshData();
  }, [refreshData]);

  const unreadNotificationsCount = (notifications || []).filter(n => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchUser,
        logoutUser,
        loginWithPin,
        theme,
        setTheme: setThemeState,
        toggleTheme,
        isPinModalOpen,
        setIsPinModalOpen,
        isQrModalOpen,
        setIsQrModalOpen,
        isNotificationsOpen,
        setIsNotificationsOpen,
        lastClosedShiftReport,
        setLastClosedShiftReport,
        activeTab,
        setActiveTab,
        isSidebarOpen,
        setIsSidebarOpen,
        toast,
        showToast,
        users,
        setUsers,
        tables,
        products,
        ingredients,
        orders,
        activeShift,
        suppliers,
        purchases,
        customers,
        setCustomers,
        customerPayments,
        setCustomerPayments,
        supplierPayments,
        setSupplierPayments,
        analytics,
        stockLog,
        notifications,
        unreadNotificationsCount,
        markNotificationRead,
        markAllNotificationsRead,
        loading,
        apiError,
        refreshData,
        activeTenantId,
        activeTenant: tenantsList.find(t => t.id === activeTenantId) || null,
        tenantsList,
        switchTenant,
        businessConfig,
        updateBusinessConfig,
        correctOrderPayment
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider');
  return context;
}
