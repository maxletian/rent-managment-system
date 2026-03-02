import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Houses from './components/Houses';
import Tenants from './components/Tenants';
import TenantProfile from './components/TenantProfile';
import Reports from './components/Reports';
import { motion, AnimatePresence } from 'motion/react';

const MainApp: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderContent = () => {
    if (selectedTenantId) {
      return <TenantProfile tenantId={selectedTenantId} onBack={() => setSelectedTenantId(null)} />;
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />;
      case 'houses': return <Houses />;
      case 'tenants': return <Tenants onSelectTenant={setSelectedTenantId} />;
      case 'reports': return <Reports />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setSelectedTenantId(null); }} />
      
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTenantId ? `tenant-${selectedTenantId}` : activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

