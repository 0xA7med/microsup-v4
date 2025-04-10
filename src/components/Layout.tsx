import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { useAuthStore } from '../store/authStore';
import { LogOut, Users, UserPlus, List, PlusCircle, UserCheck, Menu, X } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('app.name')}
                </span>
              </Link>
            </div>

            {/* زر القائمة للأجهزة المحمولة */}
            <button 
              className="md:hidden flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
              onClick={toggleMobileMenu}
              aria-label="القائمة الرئيسية"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            <nav className="hidden md:flex space-x-4 mx-6">
              <Link
                to="/clients"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/clients')
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <List className="inline-block w-4 h-4 mr-2" />
                {t('nav.clients')}
              </Link>
              <Link
                to="/clients/add"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/clients/add')
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <PlusCircle className="inline-block w-4 h-4 mr-2" />
                {t('nav.addClient')}
              </Link>
              {user?.role === 'admin' && (
                <>
                  <Link
                    to="/agents"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/agents')
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Users className="inline-block w-4 h-4 mr-2" />
                    {t('nav.agents')}
                  </Link>
                  <Link
                    to="/agents/add"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/agents/add')
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <UserPlus className="inline-block w-4 h-4 mr-2" />
                    {t('nav.addAgent')}
                  </Link>
                  <Link
                    to="/pending-agents"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/pending-agents')
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <UserCheck className="inline-block w-4 h-4 mr-2" />
                    طلبات المناديب
                  </Link>
                </>
              )}
            </nav>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <LanguageToggle />
              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('app.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* القائمة المنسدلة للأجهزة المحمولة */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 shadow-lg rounded-b-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              to="/clients"
              className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/clients') ? 'bg-gray-900 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              onClick={() => setMobileMenuOpen(false)}
              data-component-name="LinkWithRef"
            >
              <List className="inline-block w-4 h-4 ml-2" />
              {t('nav.clients')}
            </Link>
            <Link
              to="/clients/add"
              className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/clients/add') ? 'bg-gray-900 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              onClick={() => setMobileMenuOpen(false)}
              data-component-name="LinkWithRef"
            >
              <PlusCircle className="inline-block w-4 h-4 ml-2" />
              {t('nav.addClient')}
            </Link>
            {user?.role === 'admin' && (
              <>
                <Link
                  to="/agents"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/agents') ? 'bg-gray-900 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-component-name="LinkWithRef"
                >
                  <Users className="inline-block w-4 h-4 ml-2" />
                  {t('nav.agents')}
                </Link>
                <Link
                  to="/agents/add"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/agents/add') ? 'bg-gray-900 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-component-name="LinkWithRef"
                >
                  <UserPlus className="inline-block w-4 h-4 ml-2" />
                  {t('nav.addAgent')}
                </Link>
                <Link
                  to="/pending-agents"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/pending-agents') ? 'bg-gray-900 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-component-name="LinkWithRef"
                >
                  <UserCheck className="inline-block w-4 h-4 ml-2" />
                  طلبات المناديب
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
};