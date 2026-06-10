import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { useAuthStore } from '../store/authStore';
import { LogOut, Users, UserPlus, List, PlusCircle, UserCheck, Menu, X, Database, ClipboardList } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

// تعريف واضح لخصائص المكون
interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, refreshSession, sessionError, resetSessionError } = useAuthStore(); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingAgentsCount, setPendingAgentsCount] = useState(0);
  const [pendingDevicesCount, setPendingDevicesCount] = useState(0);

  // تحديث الجلسة عند تحميل المكون
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // معالجة أخطاء الجلسة
  useEffect(() => {
    if (sessionError) {
      toast.error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
      resetSessionError();
      navigate('/');
    }
  }, [sessionError, resetSessionError, navigate]);

  // جلب عدد طلبات المناديب المعلقة والأجهزة المعلقة
  useEffect(() => {
    if (user?.role === 'admin') {
      const fetchCounts = async () => {
        try {
          // جلب عدد طلبات المناديب المعلقة
          if (user.role === 'admin') {
            const { count: agentsCount, error: agentsError } = await supabase
              .from('agents')
              .select('id', { count: 'exact', head: true })
              .eq('approval_status', 'pending');
            
            if (!agentsError) {
              setPendingAgentsCount(agentsCount || 0);
            }
          }
          
          // جلب عدد الأجهزة المعلقة
          const { count: devicesCount, error: devicesError } = await supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('approval_status', 'pending');
          
          if (!devicesError) {
            setPendingDevicesCount(devicesCount || 0);
          }
        } catch (error) {
          console.error('Error fetching pending counts:', error);
        }
      };
      
      fetchCounts();
      
      // تحديث العدد كل دقيقة
      const interval = setInterval(fetchCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleNavigation = (path: string) => {
    console.log(`Navigating to: ${path}`);
    setIsMenuOpen(false);
    navigate(path);
  };

  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin;
  const isAgent = user?.role === 'agent' || isManager;

  const menuItems = [
    {
      path: '/',
      label: t('nav.dashboard'),
      icon: <List className="w-5 h-5" />,
      roles: ['agent', 'manager', 'admin']
    },
    {
      path: '/clients',
      label: t('nav.clients'),
      icon: <Users className="w-5 h-5" />,
      roles: ['agent', 'manager', 'admin']
    },
    {
      path: '/add-client',
      label: t('nav.addClient'),
      icon: <UserPlus className="w-5 h-5" />,
      roles: ['agent', 'manager', 'admin']
    },
    {
      path: '/agents',
      label: t('nav.agents'),
      icon: <UserCheck className="w-5 h-5" />,
      roles: ['manager', 'admin']
    },
    {
      path: '/add-agent',
      label: t('nav.addAgent'),
      icon: <PlusCircle className="w-5 h-5" />,
      roles: ['admin']
    },
    // إزالة عنصري القائمة القديمين وإضافة عنصر جديد موحد
    {
      path: '/requests',
      label: t('nav.requests', 'إدارة الطلبات'),
      icon: <ClipboardList className="w-5 h-5" />,
      roles: ['manager', 'admin'],
      badge: pendingAgentsCount + pendingDevicesCount > 0 ? pendingAgentsCount + pendingDevicesCount : null
    },
    /* {
      path: '/pending-agents',
      label: t('nav.pendingAgents', 'طلبات المندوبين'),
      icon: <UserCog className="w-5 h-5" />,
      roles: ['admin']
    },
    {
      path: '/pending-devices',
      label: t('nav.pendingDevices'),
      icon: <AlertCircle className="w-5 h-5" />,
      roles: ['manager', 'admin']
    }, */
    {
      path: '/backup-manager',
      label: t('nav.backupManager', 'إدارة النسخ الاحتياطي'),
      icon: <Database className="w-5 h-5" />,
      roles: ['admin']
    }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    return item.roles.some(role => {
      if (role === 'agent') return isAgent;
      if (role === 'manager' || role === 'admin') return isAdmin;
      return false;
    });
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header Navigation */}
      <header className="bg-white dark:bg-gray-800 shadow-lg sticky top-0 z-50 transition-all">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">MicroSub</h1>
              {/* <span className="text-xs ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">v4.0</span> */}
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4 rtl:space-x-reverse">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 hover:scale-105 relative",
                    location.pathname === item.path
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  {item.icon && <span className="inline-block">{item.icon}</span>}
                  {item.label}
                  {item.badge && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
              
              <div className="flex items-center ml-4 space-x-2 rtl:space-x-reverse">
                <ThemeToggle />
                <LanguageToggle />
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {t('app.logout')}
                </button>
              </div>
            </nav>
            
            {/* Mobile menu button */}
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              aria-label={isMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 shadow-lg absolute top-16 left-0 right-0 z-40 border-t border-gray-200 dark:border-gray-700 animate-slideDown">
        <nav className="px-4 py-2">
          <ul className="space-y-2">
            {filteredMenuItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "flex items-center w-full p-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all relative",
                    location.pathname === item.path && "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium"
                  )}
                >
                  {item.icon}
                  <span className="mr-3">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={handleLogout}
                className="flex items-center w-full p-2 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="mr-3">{t('app.logout')}</span>
              </button>
            </li>
            <li>
              <div className="flex justify-between p-2">
                <ThemeToggle />
                <LanguageToggle />
              </div>
            </li>
          </ul>
        </nav>
      </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 mt-4">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 shadow-inner py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>MicroSub &copy; {new Date().getFullYear()} - {t('footer.allRightsReserved', 'جميع الحقوق محفوظة')}</p>
        </div>
      </footer>
    </div>
  );
};