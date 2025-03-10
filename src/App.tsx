import { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from './components/LoginForm';
import { Layout } from './components/Layout';
import { AppRoutes } from './routes';
import { useAuthStore } from './store/authStore';
import './i18n/config';

function App() {
  const { i18n } = useTranslation();
  const { user, loading, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 dark:from-purple-900 dark:to-blue-800">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <Router>    
      <Layout>  
        <div>
          <AppRoutes />
        </div>
      </Layout>
    </Router>  
  );
}

export default App;