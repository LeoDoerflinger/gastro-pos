import React from 'react';
import { useApp } from './context/AppContext';
import Header from './components/common/Header';
import SidebarDrawer from './components/common/SidebarDrawer';
import PinModal from './components/common/PinModal';
import Toast from './components/common/Toast';
import DeviceFrame from './components/common/DeviceFrame';

// Views
import MozoSalonView from './components/mozo/MozoSalonView';
import CajeroDashboard from './components/cajero/CajeroDashboard';
import ArqueoCaja from './components/cajero/ArqueoCaja';
import StockPurchases from './components/cajero/StockPurchases';
import DeliveryManager from './components/delivery/DeliveryManager';
import RecipeManager from './components/admin/RecipeManager';
import StockControl from './components/admin/StockControl';
import AdminDashboard from './components/admin/AdminDashboard';
import Configuration from './components/admin/Configuration';

export default function App() {
  const { activeTab, currentUser, loading } = useApp();

  const isMozo = currentUser.role === 'mozo';
  const isCajero = currentUser.role === 'cajero';
  const isAdmin = currentUser.role === 'admin';

  const renderContent = () => {
    if (loading) {
      return (
        <div className="py-24 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-mono text-zinc-500">Cargando sistema...</p>
        </div>
      );
    }

    // Role Enforcement: Mozo ONLY has access to Salón/Mesas
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

    // Admin Only Views
    if (isAdmin) {
      if (activeTab === 'recetario') return <RecipeManager />;
      if (activeTab === 'stock_control') return <StockControl />;
      if (activeTab === 'ventas') return <AdminDashboard />;
      if (activeTab === 'config') return <Configuration />;
    }

    return <MozoSalonView />;
  };

  return (
    <DeviceFrame>
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-zinc-200 selection:text-zinc-950">
        <Header />
        <SidebarDrawer />

        <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-5">
          {renderContent()}
        </main>

        {/* Global Modals & Notifications */}
        <PinModal />
        <Toast />
      </div>
    </DeviceFrame>
  );
}
