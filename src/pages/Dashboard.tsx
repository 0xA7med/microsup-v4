// src/pages/Dashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus,
  Clock, AlertCircle, Zap, Package, RefreshCw,
  ChevronDown, ChevronUp, X, Smartphone, Laptop
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import { useAuthStore } from '../store/authStore';
import RecentClientsList from '../components/RecentClientsList'; 
import { useDataStore, shallow } from '../store/dataStore'; 
import { supabase } from '../lib/supabaseClient';
import ClientDetailsModal from '../components/ClientDetailsModal';

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
    lastUpdatedTimestamp 
  } = useDataStore(
    (state) => ({
      dashboardStats: state.dashboardStats,
      loading: state.loading,
      error: state.error,
      fetchData: state.fetchData,
      lastUpdatedTimestamp: state.lastUpdatedTimestamp,
    }),
    shallow 
  );

  // --- Local UI State ---
  const [refreshTrigger, setRefreshTrigger] = useState(false); 
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
  }, [fetchData, user]); 

  // --- Error Handling ---
  useEffect(() => {
    if (error) {
      toast.error(`${t('error.fetchingData', 'حدث خطأ أثناء جلب البيانات')}: ${error}`);
      // Optionally clear the error in the store after showing it
      // useDataStore.setState({ error: null });
    }
  }, [error, t]);

  // --- Navigation Callbacks ---
  const navigateToClientsList = (params: { filter?: string; deviceFilter?: string; allWithDevices?: boolean } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.filter) searchParams.set('filter', params.filter);
    if (params.deviceFilter) searchParams.set('deviceFilter', params.deviceFilter);
    if (params.allWithDevices) searchParams.set('filter', 'allWithDevices');
    navigate(`/clients?${searchParams.toString()}`);
  };

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
      return format(date, 'yyyy/MM/dd'); 
    } catch (error) {
      console.error('Error formatting date:', error);
      return '-';
    }
  };

  // --- Force Refresh ---
  const handleRefresh = () => {
    console.log('Dashboard: Forcing data refresh via button.');
    fetchData(true, user); 
    setRefreshTrigger(prev => !prev); 
  };

  // --- Destructure Stats from Store ---
  const {
    totalClients = 0,
    totalDevices = 0,
    mobileDevices = 0,
    computerDevices = 0,
    pendingDevices = 0,
    rejectedDevices = 0,
    totalValue = 0,
    mobileValue = 0,
    computerValue = 0,
    expiringCount = 0, 
    expiredCount = 0,  
    activeCount = 0,   
    totalAgents = 0,
    // lastUpdated is now lastUpdatedTimestamp (number)
  } = dashboardStats || {};

  // إضافة دوال للموافقة ورفض الأجهزة
  const handleApproveDevice = async (deviceId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ approval_status: 'approved' })
        .eq('id', deviceId);
        
      if (error) throw error;
      
      toast.success(t('device.approvalSuccess', 'تمت الموافقة على الجهاز بنجاح'));
      // تحديث البيانات
      fetchData(true, user);
    } catch (error) {
      console.error('Error approving device:', error);
      toast.error(t('device.approvalError', 'حدث خطأ أثناء الموافقة على الجهاز'));
    }
  };

  const handleRejectDevice = async (deviceId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ approval_status: 'rejected' })
        .eq('id', deviceId);
        
      if (error) throw error;
      
      toast.success(t('device.rejectionSuccess', 'تم رفض الجهاز بنجاح'));
      // تحديث البيانات
      fetchData(true, user);
    } catch (error) {
      console.error('Error rejecting device:', error);
      toast.error(t('device.rejectionError', 'حدث خطأ أثناء رفض الجهاز'));
    }
  };

  // إضافة دالة لعرض تفاصيل العميل
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isClientDetailsModalOpen, setIsClientDetailsModalOpen] = useState(false);
  
  // إضافة متغيرات إضافية مطلوبة للنافذة المنبثقة
  const [agents, setAgents] = useState<any[]>([]);
  const [subscriptionTypes] = useState([
    { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
    { value: 'semi_annual', label: 'نصف سنوي', labelEn: 'Biannual' },
    { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
    { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
  ]);

  // دالة لجلب المندوبين
  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, email, role')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setAgents(data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error(t('messages.errorFetchingAgents', 'حدث خطأ أثناء جلب بيانات المندوبين'));
    }
  };

  // جلب المندوبين عند تحميل الصفحة
  useEffect(() => {
    fetchAgents();
  }, []);

  const handleShowClientDetails = (client: any) => {
    setSelectedClient(client);
    setIsClientDetailsModalOpen(true);
  };

  const handleCloseClientDetailsModal = () => {
    setIsClientDetailsModalOpen(false);
    setSelectedClient(null);
  };
  
  // دوال إضافية مطلوبة للنافذة المنبثقة
  const handleSaveClient = async (updatedClient: any): Promise<void> => {
    try {
      const { error } = await supabase
        .from('clients')
        .update(updatedClient)
        .eq('id', updatedClient.id);
        
      if (error) throw error;
      
      toast.success(t('client.updateSuccess', 'تم تحديث بيانات العميل بنجاح'));
      fetchData(true, user);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(t('client.updateError', 'حدث خطأ أثناء تحديث بيانات العميل'));
      throw error;
    }
  };
  
  const handleDeleteClient = async (clientId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
        
      if (error) throw error;
      
      toast.success(t('client.deleteSuccess', 'تم حذف العميل بنجاح'));
      fetchData(true, user);
      handleCloseClientDetailsModal();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(t('client.deleteError', 'حدث خطأ أثناء حذف العميل'));
      throw error;
    }
  };

  // Display loading indicator
  if (loading && !dashboardStats.totalClients) { 
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
            disabled={loading} 
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
            onClick={() => navigateToClientsList()}
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
                 onClick={() => navigateToClientsList({ filter: 'allWithDevices' })}
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
                        {/* Mobile Devices Card */}
                        <div
                className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
                onClick={() => navigateToClientsList({ deviceFilter: 'mobile' })}
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
                onClick={() => navigateToClientsList({ deviceFilter: 'computer' })}
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
                onClick={() => navigateToClientsList({ filter: 'pending' })}
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
                onClick={() => navigateToClientsList({ filter: 'rejected' })}
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
 
        </div>
      </div>

      {/* Subscription Expiry Stats Section */}
      <div className="mb-5">
        <div
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
          onClick={() => toggleSection('permanentStats')} 
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
                    <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full"> 
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
                onClick={() => navigateToClientsList({ filter: 'allWithDevices' })}
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
                onClick={() => navigateToClientsList({ deviceFilter: 'mobile' })}
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
                onClick={() => navigateToClientsList({ deviceFilter: 'computer' })}
            >
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dashboard.computerValue', 'مستحقات الكمبيوتر ')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{computerValue.toLocaleString()} {t('common.currency', 'جنيه')}</p>
                    </div>
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
                        <Laptop className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
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
            navigateToClientsList={navigateToClientsList}
            refreshTrigger={refreshTrigger}
            handleShowDetails={handleShowClientDetails}
            handleApproveDevice={user?.role === 'admin' || user?.role === 'super_admin' ? handleApproveDevice : undefined}
            handleRejectDevice={user?.role === 'admin' || user?.role === 'super_admin' ? handleRejectDevice : undefined}
        />

       {/* Client Details Modal */}
       {isClientDetailsModalOpen && selectedClient && (
         <ClientDetailsModal
           isOpen={isClientDetailsModalOpen}
           onClose={handleCloseClientDetailsModal}
           client={selectedClient}
           agents={agents}
           subscriptionTypes={subscriptionTypes}
           onSave={handleSaveClient}
           onDelete={handleDeleteClient}
           currentUser={user}
         />
       )}
    </div>
  );
};