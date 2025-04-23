// src/pages/Dashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Phone,
  Clock, AlertCircle, Zap, Package, RefreshCw,
  ChevronDown, ChevronUp, Check, X, Smartphone, Laptop
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import { useAuthStore } from '../store/authStore';
import RecentClientsList from '../components/RecentClientsList'; // Assuming this component now uses useDataStore if needed
import { useDataStore, shallow } from '../store/dataStore'; // Import store hook and shallow
import { ClientType as ImportedClientType } from '../types/client.types'; // Import ClientType

// Remove unused types/constants if they are now handled by the store
// import type { DashboardData, Client } from '../types/dashboard.types';
// const CACHE_KEY = 'dashboard_cache_v1'; // No longer needed here
// const CACHE_DURATION = 30 * 1000; // No longer needed here

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  // --- Subscribe to Zustand Store ---
  const {
    dashboardStats,
    loading,
    error,
    fetchData,
    lastUpdatedTimestamp // Get timestamp from store
  } = useDataStore(
    (state) => ({
      dashboardStats: state.dashboardStats,
      loading: state.loading,
      error: state.error,
      fetchData: state.fetchData,
      lastUpdatedTimestamp: state.lastUpdatedTimestamp,
    }),
    shallow // Use shallow comparison
  );

  // --- Local UI State ---
  const [refreshTrigger, setRefreshTrigger] = useState(false); // For RecentClientsList if needed
  const [collapsedSections, setCollapsedSections] = useState({
    mainStats: true,
    valueStats: true,
    deviceStats: true,
    subscriptionStats: true,
    deviceStatusStats: true,
    permanentStats: true
  });

  // --- Fetch Data on Mount/User Change ---
  useEffect(() => {
    // Fetch data (store handles caching logic)
    // Pass the current user for role-based filtering/calculations in the store
    console.log('Dashboard: Triggering fetchData from store effect.');
    fetchData(false, user);
  }, [fetchData, user]); // Re-fetch if fetchData function reference or user changes

  // --- Error Handling ---
  useEffect(() => {
    if (error) {
      toast.error(`${t('error.fetchingData', 'حدث خطأ أثناء جلب البيانات')}: ${error}`);
      // Optionally clear the error in the store after showing it
      // useDataStore.setState({ error: null });
    }
  }, [error, t]);

  // --- Navigation Callbacks ---
  const navigateToClientsList = useCallback((filters: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
    });
    const queryString = params.toString();
    navigate(`/clients${queryString ? `?${queryString}` : ''}`);
  }, [navigate]);

  const navigateToPendingDevices = useCallback((status?: string) => {
    navigate(`/pending-devices${status ? `?status=${status}` : ''}`);
  }, [navigate]);

  const navigateToAgentsList = useCallback(() => {
    navigate('/agents');
  }, [navigate]);

  // --- UI Helpers ---
  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDateForDisplay = (dateStr?: string | number | Date | null): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date passed to formatDateForDisplay:', dateStr);
        return '-';
      }
      return format(date, 'yyyy/MM/dd HH:mm'); // Consistent format with time
    } catch (error) {
      console.error('Error formatting date:', error);
      return '-';
    }
  };

  // --- Force Refresh ---
  const handleRefresh = () => {
    console.log('Dashboard: Forcing data refresh via button.');
    fetchData(true, user); // Force refresh, bypass cache
    setRefreshTrigger(prev => !prev); // Trigger refresh for child components if needed
  };

  // --- Destructure Stats from Store ---
  // Use default values to prevent errors if stats are not yet available
  const {
    totalClients = 0,
    totalDevices = 0,
    mobileDevices = 0,
    computerDevices = 0,
    pendingDevices = 0,
    rejectedDevices = 0,
    approvedDevices = 0, // Added this stat
    totalValue = 0,
    mobileValue = 0,
    computerValue = 0,
    expiringCount = 0, // Renamed from expiringThisMonth for clarity
    expiredCount = 0,  // Renamed from expiredSubscriptions
    activeCount = 0,   // Renamed from activeSubscriptions / activeDevices
    noDevicesCount = 0,
    totalAgents = 0,
    // lastUpdated is now lastUpdatedTimestamp (number)
  } = dashboardStats || {};


    // Display loading indicator
    if (loading && !dashboardStats.totalClients) { // Show loading only on initial load or forced refresh without data
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t('nav.dashboard')}
        </h1>
        <div className="flex space-x-2 rtl:space-x-reverse">
          <Button
            onClick={handleRefresh}
            variant="secondary"
            className="flex items-center space-x-1 rtl:space-x-reverse"
            disabled={loading} // Disable button while loading
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('actions.refresh', 'تحديث')}</span>
          </Button>
        </div>
      </div>

      {/* Display Last Updated Timestamp */}
      {lastUpdatedTimestamp && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {t('dashboard.lastUpdated', 'آخر تحديث')}: {formatDateForDisplay(lastUpdatedTimestamp)}
        </div>
      )}

      {/* Error Display */}
      {error && !loading && (
         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
             <strong className="font-bold">{t('common.error', 'خطأ!')} </strong>
             <span className="block sm:inline">{t('error.fetchingData', 'حدث خطأ أثناء جلب البيانات.')} {error}</span>
         </div>
      )}

      {/* Main Stats Section */}
      <div className="mb-5">
        <div
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg mb-1 shadow cursor-pointer md:hidden"
          onClick={() => toggleSection('mainStats')}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.mainStats', 'الإحصائيات الرئيسية')}</h2>
          {collapsedSections.mainStats ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronUp className="h-5 w-5 text-gray-500" />}
        </div>
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 ${collapsedSections.mainStats ? 'hidden md:grid' : 'grid'}`}>
          {/* Total Clients Card */}
          <div
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList({ filter: 'all' })} // Navigate to all clients
          >
            <div className="p-5 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.totalClients', 'إجمالي العملاء')}</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{totalClients}</p>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <Users className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </div>
          {/* Total Agents Card (Admin/Super Admin only) */}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <div
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={navigateToAgentsList}
            >
              <div className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.agents', 'المندوبين')}</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{totalAgents}</p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                  <UserPlus className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Device Status Stats Section */}
      <div className="mb-8">
        <div
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
          onClick={() => toggleSection('deviceStatusStats')}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.deviceStatus', 'حالة الاشتراكات')}</h2>
          {collapsedSections.deviceStatusStats ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronUp className="h-5 w-5 text-gray-500" />}
        </div>
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${collapsedSections.deviceStatusStats ? 'hidden md:grid' : 'grid'}`}>
            {/* Total Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                 onClick={() => navigateToClientsList({ filter: 'allDevices' })} // Navigate to show all devices
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.totalDevices', 'إجمالي الاشتراكات')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{totalDevices}</p>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                        <Package className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>
                </div>
            </div>
             {/* Approved Devices Card */}
             <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                 onClick={() => navigateToClientsList({ filter: 'approved' })} // Filter for approved might need implementation in ClientsList
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.approvedDevices', 'الاشتراكات المقبولة')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{approvedDevices}</p>
                    </div>
                    <div className="bg-cyan-100 dark:bg-cyan-900 p-3 rounded-full">
                        <Check className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                    </div>
                </div>
            </div>
            {/* Active Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ filter: 'active' })}
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.activeDevices', 'الاشتراكات النشطة')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{activeCount}</p>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                        <Zap className="h-6 w-6 text-green-600 dark:text-green-300" />
                    </div>
                </div>
            </div>
            {/* Pending Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToPendingDevices('pending')}
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.pendingDevices', 'الاشتراكات المعلقة')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{pendingDevices}</p>
                    </div>
                    <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                        <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
                    </div>
                </div>
            </div>
            {/* Rejected Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToPendingDevices('rejected')}
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.rejectedDevices', 'الاشتراكات المرفوضة')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{rejectedDevices}</p>
                    </div>
                    <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                        <X className="h-6 w-6 text-red-600 dark:text-red-300" />
                    </div>
                </div>
            </div>
             {/* Mobile Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ deviceFilter: 'mobile' })} // Use deviceFilter param
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('clientsList.mobileFilter', 'اشتراكات الهاتف')}</p>
                         {/* Displaying count of *approved* mobile devices */}
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{mobileDevices}</p>
                    </div>
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
                        <Smartphone className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                    </div>
                </div>
            </div>
            {/* Computer Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ deviceFilter: 'computer' })} // Use deviceFilter param
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('clientsList.computerFilter', 'اشتراكات الكمبيوتر')}</p>
                        {/* Displaying count of *approved* computer devices */}
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{computerDevices}</p>
                    </div>
                    <div className="bg-teal-100 dark:bg-teal-900 p-3 rounded-full">
                        <Laptop className="h-6 w-6 text-teal-600 dark:text-teal-300" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Subscription Expiry Stats Section */}
      <div className="mb-5">
        <div
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
          onClick={() => toggleSection('permanentStats')} // Reusing name, maybe rename state key
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.subscriptionExpiry', 'حالة انتهاء الصلاحية')}</h2>
           {collapsedSections.permanentStats ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronUp className="h-5 w-5 text-gray-500" />}
        </div>
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 ${collapsedSections.permanentStats ? 'hidden md:grid' : 'grid'}`}>
            {/* Expired Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ filter: 'expired' })}
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.expiredSubscriptions', 'الاشتراكات المنتهية')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{expiredCount}</p>
                    </div>
                    <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                        <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-300" />
                    </div>
                </div>
            </div>
            {/* Expiring Soon Devices Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ filter: 'expiring' })}
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.expiringThisMonth', 'تنتهي خلال 15 يوم')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{expiringCount}</p>
                    </div>
                    <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full"> {/* Changed color */}
                        <Clock className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Financial Stats Section (Admin/Super Admin only) */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="mb-5">
          <div
            className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
            onClick={() => toggleSection('valueStats')}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.valueStats', 'إحصائيات المستحقات')}</h2>
             {collapsedSections.valueStats ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronUp className="h-5 w-5 text-gray-500" />}
          </div>
          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-3 ${collapsedSections.valueStats ? 'hidden md:grid' : 'grid'}`}>
            {/* Total Value Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                 onClick={() => navigateToClientsList({ filter: 'all' })} // Maybe link to a financial report later?
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.totalValue', 'إجمالي المستحقات ')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{totalValue.toLocaleString()} {t('common.currency', 'جنيه')}</p>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                        <Zap className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>
                </div>
            </div>
            {/* Mobile Value Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ deviceFilter: 'mobile' })} // Link to mobile devices
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.mobileValue', 'مستحقات الهاتف ')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{mobileValue.toLocaleString()} {t('common.currency', 'جنيه')}</p>
                    </div>
                    <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                        <Smartphone className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                    </div>
                </div>
            </div>
            {/* Computer Value Card */}
            <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ deviceFilter: 'computer' })} // Link to computer devices
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.computerValue', 'مستحقات الكمبيوتر ')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{computerValue.toLocaleString()} {t('common.currency', 'جنيه')}</p>
                    </div>
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
                        <Laptop className="h-6 w-6 text-indigo-600 dark:text-indigo-300" /> {/* Changed icon */}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

       {/* Recent Clients List - Ensure this component potentially uses the store too or receives data */}
       {/* Passing refreshTrigger might still be useful if it fetches its own specific 'recent' data */}
        <RecentClientsList
            formatDateForDisplay={formatDateForDisplay}
            // handleShowDetails might need adjustment if details modal is removed or changed
            // handleShowDetails={handleShowDetails} // Removed if modal logic changes
            navigateToClientsList={navigateToClientsList}
            refreshTrigger={refreshTrigger} // Keep if RecentClientsList fetches independently
            currentUser={user} // Pass user if needed for filtering inside RecentClientsList
        />

       {/* Client Details Modal - Removed from Dashboard */}
       {/* If needed, this modal should be triggered from ClientsList or a dedicated client page */}
       {/* The logic for updating/deleting clients now resides in ClientsList and interacts with the store */}

    </div>
  );
};