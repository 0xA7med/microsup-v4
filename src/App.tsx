import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from './components/LoginForm';
import { Layout } from './components/Layout';
import { useAuthStore } from './store/authStore';
import './i18n/config';

// تحميل الصفحات عند الطلب (lazy loading) لتحسين حجم الحزمة الأولية
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ClientsList = lazy(() => import('./pages/ClientsList').then(m => ({ default: m.ClientsList })));
const AddClient = lazy(() => import('./pages/AddClient').then(m => ({ default: m.AddClient })));
const AgentsList = lazy(() => import('./pages/AgentsList').then(m => ({ default: m.AgentsList })));
const AddAgent = lazy(() => import('./pages/AddAgent').then(m => ({ default: m.AddAgent })));
const BackupManager = lazy(() => import('./pages/BackupManager'));
const RequestsManagement = lazy(() => import('./pages/RequestsManagement'));

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
    i18n.changeLanguage('ar');
    document.dir = 'rtl';
  }, [i18n]);

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
  const isManager = isAdmin;

  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 dark:from-purple-900 dark:to-blue-800">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Layout children={<Dashboard />} />} />
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
            path="/requests" 
            element={isManager ? <Layout children={<RequestsManagement />} /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/backup-manager" 
            element={isAdmin ? <Layout children={<BackupManager />} /> : <Navigate to="/" replace />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;