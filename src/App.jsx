import React from 'react';
import { useApp } from './context/AppContext';
import Header from './components/common/Header';
import SidebarDrawer from './components/common/SidebarDrawer';
import PinModal from './components/common/PinModal';
import MobileQrModal from './components/common/MobileQrModal';
import NotificationCenter from './components/common/NotificationCenter';
import Toast from './components/common/Toast';
import UserLoginDashboard from './components/auth/UserLoginDashboard';
import MobileComanderaApp from './components/mobile/MobileComanderaApp';

import MozoSalonView from './components/mozo/MozoSalonView';
import CajeroDashboard from './components/cajero/CajeroDashboard';
import ArqueoCaja from './components/cajero/ArqueoCaja';
import ShiftBalanceModal from './components/cajero/ShiftBalanceModal';
import StockPurchases from './components/cajero/StockPurchases';
import DeliveryManager from './components/delivery/DeliveryManager';
import RecipeManager from './components/admin/RecipeManager';
import StockControl from './components/admin/StockControl';
import AdminDashboard from './components/admin/AdminDashboard';
import Configuration from './components/admin/Configuration';

export default function App() {
  const { activeTab, currentUser, loading, apiError, tables, refreshData, theme, activeShift } = useApp();

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isStandaloneMobile =
    searchParams?.get('mode') === 'comandera' ||
    (typeof window !== 'undefined' && window.location.pathname === '/comandera');

  if (isStandaloneMobile) {
    return <MobileComanderaApp />;
  }

  if (!currentUser) {
    return (
      <>
        <UserLoginDashboard />
        <MobileQrModal />
        <ShiftBalanceModal />
        <NotificationCenter />
        <Toast />
      </>
    );
  }

  const isMozo = currentUser.role === 'mozo';
  const isAdmin = currentUser.role === 'admin';

  const renderContent = () => {
    if (loading) {
      return (
        <div className="pos-panel p-12 my-8 max-w-md mx-auto text-center space-y-3" role="status" aria-live="polite">
          <div className="w-9 h-9 border-2 border-[var(--accent-brand)] border-t-transparent rounded-full animate-spin mx-auto" aria-hidden="true"></div>
          <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
            Sincronizando salón y caja
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Cargando mesas, comandas activas y stock disponible...
          </p>
        </div>
      );
    }

    if (apiError && tables.length === 0) {
      return (
        <div className="pos-panel p-8 my-8 max-w-lg mx-auto text-center space-y-4 border-l-4 border-l-[var(--status-danger-bar)]" role="alert">
          <div className="w-11 h-11 rounded bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border border-[var(--status-danger-border)] flex items-center justify-center mx-auto">
            <i className="fa-solid fa-plug-circle-exclamation text-lg" aria-hidden="true"></i>
          </div>
          <div className="space-y-1">
            <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
              Sin conexión con el servicio de comandas
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {apiError}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshData}
            className="pos-btn-primary mx-auto"
          >
            <i className="fa-solid fa-rotate-right text-xs" aria-hidden="true"></i>
            <span>Reintentar conexión</span>
          </button>
        </div>
      );
    }

    if (isMozo || activeTab === 'mesas') {
      return <MozoSalonView />;
    }

    if (activeTab === 'caja') {
      return <CajeroDashboard />;
    }

    if (activeTab === 'arqueo') {
      return <ArqueoCaja />;
    }

    if (activeTab === 'delivery') {
      return <DeliveryManager />;
    }

    if (activeTab === 'stock_purchases') {
      return <StockPurchases />;
    }

    if (isAdmin) {
      if (activeTab === 'recetario') return <RecipeManager />;
      if (activeTab === 'stock_control') return <StockControl />;
      if (activeTab === 'ventas') return <AdminDashboard />;
      if (activeTab === 'config') return <Configuration />;
    }

    return <MozoSalonView />;
  };

  return (
    <div className="min-h-screen flex flex-col text-[var(--text-primary)]">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 pos-btn-primary"
      >
        Saltar al área de trabajo
      </a>

      <Header />
      <SidebarDrawer />

      <main id="main-workspace" className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {apiError && tables.length > 0 && (
          <div className="mb-4 pos-panel px-4 py-3 border-l-4 border-l-[var(--status-bill-bar)] flex flex-wrap items-center justify-between gap-3" role="alert">
            <div className="flex items-center gap-2.5 text-sm text-[var(--text-primary)]">
              <i className="fa-solid fa-triangle-exclamation text-[var(--status-bill-fg)]" aria-hidden="true"></i>
              <span>La última sincronización falló. Mostrando el último estado guardado.</span>
            </div>
            <button type="button" onClick={refreshData} className="pos-btn-secondary">
              <i className="fa-solid fa-rotate-right text-xs" aria-hidden="true"></i>
              <span>Sincronizar ahora</span>
            </button>
          </div>
        )}
        {renderContent()}
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 sm:px-6 py-2.5 text-xs text-[var(--text-secondary)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[var(--text-primary)]">GastroPOS</span>
            <span>·</span>
            <span>Operador: <strong className="text-[var(--text-primary)]">{currentUser.name}</strong></span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>{activeShift ? 'Caja abierta' : 'Caja cerrada'}</span>
            <span>·</span>
            <span>Tema: {theme === 'graphite' ? 'Grafito Táctil' : 'Papel Técnico'}</span>
          </div>
        </div>
      </footer>

      <PinModal />
      <MobileQrModal />
      <ShiftBalanceModal />
      <NotificationCenter />
      <Toast />
    </div>
  );
}
