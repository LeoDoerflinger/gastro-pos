import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // User session persists in localStorage so completing an order never resets the active role
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('gastro_user_session');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error loading stored user session:', e);
    }
    return {
      id: 'u_admin',
      name: 'Rodrigo (Encargado / Admin)',
      role: 'admin',
      pin: '9999',
      avatar: 'fa-solid fa-user-shield'
    };
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
      meta.setAttribute('content', theme === 'paper' ? '#eeebe4' : '#17191c');
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
  const [isMobileSimulated, setIsMobileSimulated] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stockLog, setStockLog] = useState([]);
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
        tablesData,
        productsData,
        ingredientsData,
        ordersData,
        shiftRes,
        suppliersData,
        purchasesData,
        analyticsData,
        logData
      ] = await Promise.all([
        api.getTables(),
        api.getProducts(),
        api.getIngredients(),
        api.getOrders(),
        api.getActiveShift(),
        api.getSuppliers(),
        api.getPurchases(),
        api.getAnalytics(),
        api.getStockLog()
      ]);

      setTables(tablesData);
      setProducts(productsData);
      setIngredients(ingredientsData);
      setOrders(ordersData);
      setActiveShift(shiftRes.active);
      setSuppliers(suppliersData);
      setPurchases(purchasesData);
      setAnalytics(analyticsData);
      setStockLog(logData);
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
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Enforce domain rule: mozos can only access Salón / Mesas
  useEffect(() => {
    if (currentUser?.role === 'mozo' && activeTab !== 'mesas') {
      setActiveTab('mesas');
    }
  }, [currentUser, activeTab, setActiveTab]);

  const switchUser = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('gastro_user_session', JSON.stringify(user));
    } catch (e) {
      console.error('Error saving user session:', e);
    }
    if (user.role === 'mozo') {
      setActiveTab('mesas');
    }
    showToast(`Sesión activa: ${user.name}`, 'info');
  };

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

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchUser,
        loginWithPin,
        theme,
        setTheme: setThemeState,
        toggleTheme,
        isPinModalOpen,
        setIsPinModalOpen,
        activeTab,
        setActiveTab,
        isSidebarOpen,
        setIsSidebarOpen,
        isMobileSimulated,
        setIsMobileSimulated,
        toast,
        showToast,
        tables,
        products,
        ingredients,
        orders,
        activeShift,
        suppliers,
        purchases,
        analytics,
        stockLog,
        loading,
        apiError,
        refreshData
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
