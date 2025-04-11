import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from './components/LoginForm';
import { Layout } from './components/Layout';
import { useAuthStore } from './store/authStore';
import './i18n/config';

// استيراد الصفحات
import DashboardNew from './pages/DashboardNew';
import { ClientsList } from './pages/ClientsList';
import { AddClient } from './pages/AddClient';
import { AgentsList } from './pages/AgentsList';
import { AddAgent } from './pages/AddAgent';
import { PendingAgents } from './pages/PendingAgents';
import { PendingDevices } from './pages/PendingDevices';

function App() {
  const { i18n } = useTranslation();
  const { user, loading, initializeAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeAuth();
      setIsInitialized(true);
    };
    init();
  }, [initializeAuth]);

  useEffect(() => {
    document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  if (loading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 dark:from-purple-900 dark:to-blue-800">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // التحقق من صلاحيات المستخدم
  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager' || isAdmin;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout children={<DashboardNew />} />} />
        <Route path="/clients" element={<Layout children={<ClientsList />} />} />
        <Route path="/add-client" element={<Layout children={<AddClient />} />} />
        <Route 
          path="/agents" 
          element={isManager ? <Layout children={<AgentsList />} /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/add-agent" 
          element={isAdmin ? <Layout children={<AddAgent />} /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/pending-agents" 
          element={isAdmin ? <Layout children={<PendingAgents />} /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/pending-devices" 
          element={isManager ? <Layout children={<PendingDevices />} /> : <Navigate to="/" replace />} 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;