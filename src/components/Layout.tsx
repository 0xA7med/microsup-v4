import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { useAuthStore } from '../store/authStore';
import { LogOut, Users, UserPlus, List, PlusCircle, UserCheck, Menu, X, AlertCircle, UserCog } from 'lucide-react';

// تعريف واضح لخصائص المكون
interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore(); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  const isManager = user?.role === 'manager' || isAdmin;
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
    {
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
    }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    return item.roles.some(role => {
      if (role === 'agent') return isAgent;
      if (role === 'manager') return isManager;
      if (role === 'admin') return isAdmin;
      return false;
    });
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header Navigation */}
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">MicroSup</h1>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4 rtl:space-x-reverse">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium",
                    location.pathname === item.path
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  {item.icon && <span className="inline-block w-5 h-5 ml-2 mr-6 rtl:ml-6 rtl:mr-2">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
              
              <div className="flex items-center ml-4 space-x-2 rtl:space-x-reverse">
                <ThemeToggle />
                <LanguageToggle />
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <LogOut className="inline-block w-4 h-4 mr-2" />
                  {t('app.logout')}
                </button>
              </div>
            </nav>
            
            {/* Mobile menu button */}
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 shadow-lg">
          <nav className="px-4 py-2">
            <ul className="space-y-2">
              {filteredMenuItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handleNavigation(item.path)}
                    className={cn(
                      "flex items-center w-full p-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all",
                      location.pathname === item.path && "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                    )}
                  >
                    {item.icon}
                    <span className="mr-3">{item.label}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full p-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
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
    </div>
  );
};