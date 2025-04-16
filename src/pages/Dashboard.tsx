import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Users, UserPlus, Phone, 
  Clock, AlertCircle, Zap, Package, RefreshCw,
  ChevronDown, ChevronUp, Check, X, Smartphone, Laptop
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { useAuthStore } from '../store/authStore';
import RecentClientsList from '../components/RecentClientsList';

import type { DashboardData, Client } from '../types/dashboard.types';

// ثوابت التخزين المؤقت
const CACHE_KEY = 'dashboard_cache_v1';
const CACHE_DURATION = 30 * 1000; // 30 ثانية بالميلي ثانية

const SUBSCRIPTION_TYPES = [
  { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
  { value: 'semi_annual', label: 'نصف سنوي', labelEn: 'Biannual' },
  { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
  { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
];

const VERSION_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer' },
  { value: 'android', label: 'موبايل', labelEn: 'Mobile' }
];

export const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  
  // حالة البيانات
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  
  // حالة التحميل والتحديث
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState(false); // مؤشر لتحديث مكون أحدث الأجهزة
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  
  // إضافة حالة لتخزين بيانات الأجهزة
  const [devicesData, setDevicesData] = useState<any[]>([]);
  
  // حالة طي البطاقات في وضع الهاتف
  const [collapsedSections, setCollapsedSections] = useState({
    mainStats: true,
    valueStats: true,
    deviceStats: true,
    subscriptionStats: true,
    deviceStatusStats: true // إضافة قسم جديد لحالة الأجهزة
  });
  
  // دالة لتبديل حالة طي القسم
  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // مرجع لتتبع ما إذا كانت المكون مرئي
  const isVisible = useRef<boolean>(true);
  
  // الحصول على معلومات المستخدم الحالي
  const user = useAuthStore(state => state.user);
  
  // استخراج البيانات من كائن لوحة المعلومات
  const {
    totalClients,
    totalAgents,
    activeSubscriptions,
    expiredSubscriptions,
    averageDevices,
    renewalRate,
    permanentClients,
    expiringThisMonth,
    lastUpdated,
    // القيم المالية
    totalValue = 0,
    mobileValue = 0,
    computerValue = 0,
    // حالة الأجهزة
    approvedDevices,
    pendingDevices,
    rejectedDevices,
    // عدد الأجهزة حسب النوع
    totalDevices,
    // إضافة الحقول المفقودة
    activeDevices,
    mobileDevices,
    computerDevices
  } = dashboardData || {};
  
  // طباعة البيانات للتحقق من صحتها
  useEffect(() => {
    if (dashboardData) {
      console.log('Dashboard Data:', { 
        totalClients, 
        totalAgents, 
        activeSubscriptions, 
        expiredSubscriptions,
        averageDevices,
        renewalRate,
        permanentClients,
        expiringThisMonth
      });
    }
  }, [dashboardData, totalClients, totalAgents, activeSubscriptions, expiredSubscriptions, averageDevices, renewalRate, permanentClients, expiringThisMonth]);
  
  // وظيفة للحصول على البيانات المخزنة مؤقتًا
  const getCachedDashboardData = useCallback((): { data: DashboardData | null, expired: boolean } => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (!cachedData) return { data: null, expired: true };
      
      const { data, timestamp } = JSON.parse(cachedData);
      const now = new Date().getTime();
      const expired = now - timestamp > CACHE_DURATION;
      
      return { data, expired };
    } catch (error) {
      console.error('Error reading cache:', error);
      return { data: null, expired: true };
    }
  }, []);

  // وظيفة لتخزين البيانات مؤقتًا
  const cacheDashboardData = useCallback((data: DashboardData) => {
    try {
      const cacheData = {
        data,
        timestamp: new Date().getTime()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }, []);

  // وظيفة جلب بيانات لوحة المعلومات
  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      // التحقق من وجود بيانات مخزنة مؤقتًا
      const { data: cachedData, expired } = getCachedDashboardData();
      
      // استخدام البيانات المخزنة مؤقتًا إذا كانت صالحة ولم يتم طلب تحديث إجباري
      if (cachedData && !expired && !forceRefresh) {
        setDashboardData(cachedData);
        setLoading(false);
        return;
      }
      
      // جلب بيانات العملاء
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, client_name, subscription_end, subscription_type, agent_id');
      
      if (clientsError) throw clientsError;
      
      // جلب بيانات المندوبين
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name, email');
      
      if (agentsError) throw agentsError;
      
      // تصفية العملاء حسب المندوب الحالي إذا كان المستخدم مندوب
      let filteredClientsData = clientsData || [];
      
      // إذا كان المستخدم مندوب، نعرض فقط العملاء المرتبطين به
      if (user?.role === 'agent') {
        const agentId = user.id;
        filteredClientsData = filteredClientsData.filter(client => client.agent_id === agentId);
        console.log(`Filtered clients for agent ${agentId}:`, filteredClientsData.length);
      }
      
      // جلب بيانات الأجهزة
      const { data: allDevicesData = [], error: devicesError } = await supabase
        .from('devices')
        .select('id, client_id, subscription_end, subscription_type, device_type, price, approval_status');
      
      if (devicesError) throw devicesError;
      
      // تصفية الأجهزة حسب العملاء المصفاة
      let filteredDevicesData = allDevicesData || [];
      
      // إذا كان المستخدم مندوب، نصفي الأجهزة لعرض أجهزة عملائه فقط
      if (user?.role === 'agent') {
        const filteredClientIds = filteredClientsData.map(client => client.id);
        filteredDevicesData = filteredDevicesData.filter(device => filteredClientIds.includes(device.client_id));
        console.log('Filtered devices for agent:', filteredDevicesData.length);
      }
      
      // تخزين بيانات الأجهزة في حالة المكون
      setDevicesData(filteredDevicesData || []);
      
      // حساب القيم
      let totalValue = 0;
      let mobileValue = 0;
      let computerValue = 0;
      
      // حساب عدد الأجهزة حسب النوع والحالة
      let totalDevices = 0;
      let approvedDevices = 0;
      let pendingDevices = 0;
      let rejectedDevices = 0;
      
      // إضافة متغيرات لحساب الاشتراكات النشطة والمنتهية
      let activeSubscriptionsCount = 0;
      let expiredSubscriptionsCount = 0;
      let expiringThisMonthCount = 0;
      let mobileDevicesCount = 0;
      let computerDevicesCount = 0;
      
      // الحصول على التاريخ الحالي
      const currentDate = new Date();
      // تاريخ بعد 15 يوم من الآن
      const futureDate = new Date();
      futureDate.setDate(currentDate.getDate() + 15);
      
      // حساب القيم المالية والأعداد من الأجهزة
      if (filteredDevicesData) {
        // ابدأ بطباعة العدد الإجمالي للأجهزة للتشخيص
        console.log('Total devices fetched:', filteredDevicesData.length);
        
        // تحليل البيانات للعثور على الأجهزة المنتهية والنشطة
        const approvedDevicesArr = filteredDevicesData.filter(device => device.approval_status === 'approved');
        console.log('Approved devices:', approvedDevicesArr.length);
        
        // الأجهزة المنتهية هي الأجهزة المقبولة وغير الدائمة وتاريخ انتهاء صلاحيتها أقل من التاريخ الحالي
        const expiredDevicesArr = approvedDevicesArr.filter(device => {
          if (device.subscription_type === 'permanent') return false;
          if (!device.subscription_end) return false;
          const endDate = new Date(device.subscription_end);
          const isExpired = endDate < currentDate;
          return isExpired;
        });
        
        // الأجهزة النشطة هي الأجهزة المقبولة إما الدائمة أو التي لم تنته صلاحيتها بعد
        const activeDevicesArr = approvedDevicesArr.filter(device => {
          if (device.subscription_type === 'permanent') return true;
          if (!device.subscription_end) return false;
          const endDate = new Date(device.subscription_end);
          return endDate >= currentDate;
        });
        
        // تحديث المتغيرات
        expiredSubscriptionsCount = expiredDevicesArr.length;
        activeSubscriptionsCount = activeDevicesArr.length;
        
        console.log('Expired devices count:', expiredSubscriptionsCount);
        console.log('Active devices count:', activeSubscriptionsCount);
        
        // الأجهزة التي ستنتهي خلال 15 يوم
        const expiringDevicesArr = activeDevicesArr.filter(device => {
          if (device.subscription_type === 'permanent') return false;
          if (!device.subscription_end) return false;
          const endDate = new Date(device.subscription_end);
          return endDate <= futureDate;
        });
        
        expiringThisMonthCount = expiringDevicesArr.length;
        console.log('Expiring soon devices count:', expiringThisMonthCount);
        
        filteredDevicesData.forEach((device: any) => {
          // حساب القيم المالية فقط للأجهزة المقبولة
          if (device.approval_status === 'approved') {
            const price = parseFloat(device.price) || 0;
            totalValue += price;
            
            if (device.device_type === 'computer') {
              computerValue += price;
              computerDevicesCount++;
            } else {
              mobileValue += price;
              mobileDevicesCount++;
            }
          }
          
          // حساب عدد الأجهزة حسب النوع والحالة
          totalDevices++;
          
          if (device.approval_status === 'approved') {
            approvedDevices++;
          } else if (device.approval_status === 'rejected') {
            rejectedDevices++;
          } else {
            pendingDevices++;
          }
        });
      }
      
      // إنشاء كائن البيانات
      const newDashboardData: DashboardData = {
        totalClients: filteredClientsData?.length || 0,
        totalAgents: agentsData?.length || 0,
        activeSubscriptions: activeSubscriptionsCount,
        recentClients: [],
        expiredSubscriptions: expiredSubscriptionsCount,
        averageDevices: 0,
        renewalRate: 0,
        agents: [],
        permanentClients: 0,
        expiringThisMonth: expiringThisMonthCount,
        lastUpdated: new Date().toISOString(),
        // القيم المالية
        totalValue,
        mobileValue,
        computerValue,
        // حالة الأجهزة
        approvedDevices,
        pendingDevices,
        rejectedDevices,
        // عدد الأجهزة حسب النوع
        totalDevices,
        // إضافة الحقول المفقودة
        activeDevices: approvedDevices || 0,
        mobileDevices: mobileDevicesCount,
        computerDevices: computerDevicesCount
      };
      
      // تحديث حالة المكون
      setDashboardData(newDashboardData);
      
      // تخزين البيانات مؤقتًا
      cacheDashboardData(newDashboardData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error(t('error.fetchingData', 'حدث خطأ أثناء جلب البيانات'));
    } finally {
      setLoading(false);
    }
  }, [getCachedDashboardData, cacheDashboardData, t]);

  // تحديث البيانات عند تغير رؤية الصفحة
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisible.current = document.visibilityState === 'visible';
      
      if (isVisible.current) {
        // تحقق من عمر البيانات المخزنة مؤقتًا عند العودة إلى الصفحة
        const { expired } = getCachedDashboardData();
        if (expired) {
          fetchDashboardData(true);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getCachedDashboardData, fetchDashboardData]);

  // استدعاء البيانات عند تحميل الصفحة
  useEffect(() => {
    const loadInitialData = async () => {
      // محاولة استخدام البيانات المخزنة مؤقتًا أولاً
      const { data: cachedData, expired } = getCachedDashboardData();
      
      if (cachedData) {
        // استخدام البيانات المخزنة مؤقتًا حتى يتم تحديثها
        setDashboardData(cachedData);
        
        // إذا كانت البيانات قديمة، قم بتحديثها في الخلفية
        if (expired) {
          fetchDashboardData(false);
        }
      } else {
        // لا توجد بيانات مخزنة مؤقتًا، قم بتحميل البيانات
        fetchDashboardData(true);
      }
    };
    
    loadInitialData();
    // استخدام مصفوفة تبعيات فارغة لضمان تنفيذ هذا التأثير مرة واحدة فقط عند تحميل المكون
  }, [getCachedDashboardData]);

  // تحديث بيانات العميل
  const updateClient = async (updatedClient: any): Promise<void> => {
    try {
      // تحديث بيانات العميل في قاعدة البيانات
      const { error } = await supabase
        .from('clients')
        .update({
          client_name: updatedClient.client_name,
          organization_name: updatedClient.organization_name,
          activity_type: updatedClient.activity_type,
          address: updatedClient.address,
          phone: updatedClient.phone,
          phone2: updatedClient.phone2,
          notes: updatedClient.notes,
          subscription_type: updatedClient.subscription_type,
          subscription_start: updatedClient.subscription_start,
          subscription_end: updatedClient.subscription_end,
          agent_id: updatedClient.agent_id
        })
        .eq('id', updatedClient.id);
      
      if (error) throw error;
      
      // إظهار رسالة نجاح
      toast.success(t('messages.clientUpdated', 'تم تحديث بيانات العميل بنجاح'));
      
      // تحديث البيانات
      fetchDashboardData(true);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(t('messages.errorUpdatingClient', 'حدث خطأ أثناء تحديث بيانات العميل'));
    }
  };

  // حذف العميل
  const handleDeleteClient = async (clientId: string): Promise<void> => {
    try {
      // تحديث بيانات العميل في قاعدة البيانات
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) throw error;
      
      // إظهار رسالة نجاح
      toast.success(t('messages.clientDeleted', 'تم حذف العميل بنجاح'));
      
      // إغلاق النافذة وتحديث البيانات
      handleCloseModal();
      fetchDashboardData(true);
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(t('messages.errorDeletingClient', 'حدث خطأ أثناء حذف العميل'));
    }
  };

  // Helper functions for client management
  const handleShowDetails = (client: Client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedClient(null);
    // Refresh data after closing modal
    fetchDashboardData(true);
  };

  const formatDateForDisplay = (dateStr?: string | Date): string => {
    if (!dateStr) return '';
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(date.getTime())) {
        return '';
      }
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      console.warn('Error formatting date:', error);
      return '';
    }
  };

  // Navigate to agents list
  const navigateToAgentsList = () => {
    navigate('/agents');
  };

  // Navigate to clients list with filter
  const navigateToClientsList = useCallback((filter?: string) => {
    // تخزين الفلتر الحالي في الحالة أولا
    const filterToUse = filter || 'all';
    
    // ثم ننتقل إلى صفحة قائمة العملاء مع تمرير الفلتر كمعلمة
    console.log(`Navigating to clients list with filter: ${filterToUse}`);
    navigate('/clients', { 
      state: { 
        filter: filterToUse, 
        applyFilterImmediately: true 
      } 
    });
  }, [navigate]);

  // عرض مؤشر التحميل أثناء التحميل الأولي
  if (loading) {
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
            onClick={() => {
              fetchDashboardData(true);
              setRefreshTrigger(prev => !prev); // تغيير قيمة مؤشر التحديث لإعادة تحميل بيانات الأجهزة
            }}
            variant="secondary"
            className={`flex items-center space-x-1 rtl:space-x-reverse`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t('actions.refresh', 'تحديث')}</span>
          </Button>
        </div>
      </div>
      
      {lastUpdated && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {t('dashboard.lastUpdated', 'آخر تحديث')}: {formatDateForDisplay(lastUpdated)} {format(new Date(lastUpdated), 'HH:mm:ss')}
        </div>
      )}

      {/* قسم حالة الأجهزة */}
      <div className="mb-8">
        <div 
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
          onClick={() => toggleSection('deviceStatusStats')}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.deviceStatus', 'حالة الاشتراكات')}</h2>
          {collapsedSections.deviceStatusStats ? (
            <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
        </div>
        
        <div className={`flex justify-between items-center mb-4 mt-4 ${collapsedSections.deviceStatusStats ? 'hidden md:flex' : 'flex'}`}>
          {/* <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.deviceStatus', 'حالة الأجهزة')}</h2> */}
        </div>
        
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-3 ${collapsedSections.deviceStatusStats ? 'hidden md:grid' : 'grid'}`}>
          {/* إجمالي الاشتراكات */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('devices')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalDevices', 'إجمالي الاشتراكات')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalDevices || 0}</span>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </div>
          
          {/* الاشتراكات المقبولة */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('approved')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.approvedDevices', 'الاشتراكات المقبولة')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{approvedDevices || 0}</span>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <Check className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </div>
          
          {/* الاشتراكات المعلقة */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('pending')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.pendingDevices', 'الاشتراكات المعلقة')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{pendingDevices || 0}</span>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
              </div>
            </div>
          </div>
          
          {/* الاشتراكات المرفوضة */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('rejected')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.rejectedDevices', 'الاشتراكات المرفوضة')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{rejectedDevices || 0}</span>
              </div>
              <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                <X className="h-6 w-6 text-red-600 dark:text-red-300" />
              </div>
            </div>
          </div>
          
          {/* اشتراكات الهاتف */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105" 
            onClick={() => navigateToClientsList('mobile')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('clientsList.mobileFilter', 'اشتراكات الهاتف')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {mobileDevices || devicesData.filter((device: any) => device.device_type !== 'computer').length}
                </span>
              </div>
              <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
                <Smartphone className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
              </div>
            </div>
          </div>
          
          {/* اشتراكات الكمبيوتر */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105" 
            onClick={() => navigateToClientsList('computer')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('clientsList.computerFilter', 'اشتراكات الكمبيوتر')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {computerDevices || devicesData.filter((device: any) => device.device_type === 'computer').length}
                </span>
              </div>
              <div className="bg-teal-100 dark:bg-teal-900 p-3 rounded-full">
                <Laptop className="h-6 w-6 text-teal-600 dark:text-teal-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* الصف الأول من البطاقات */}
      <div className="mb-5">
        <div 
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg mb-1 shadow cursor-pointer md:hidden"
          onClick={() => toggleSection('mainStats')}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.mainStats', 'الإحصائيات الرئيسية')}</h2>
          <div className="flex items-center">
            {collapsedSections.mainStats ? 
              <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : 
              <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            }
          </div>
        </div>
        
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 ${collapsedSections.mainStats ? 'hidden md:grid' : ''}`}>
          {/* إجمالي العملاء */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList()}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalClients', 'إجمالي العملاء')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalClients}</span>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <Users className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </div>
          
          {/* المندوبين - عرض فقط للمسؤولين */}
          {user?.role !== 'agent' && (
            <div 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={navigateToAgentsList}
            >
              <div className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.agents', 'المندوبين')}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalAgents}</span>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                  <UserPlus className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
              </div>
            </div>
          )}
          
          {/* إجمالي الاشتراكات */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('devices')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalDevices', 'إجمالي الاشتراكات')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalDevices || 0}</span>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <Package className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* الصف الثاني من البطاقات - متاحة للمديرين فقط */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="mb-5">
          <div 
            className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
            onClick={() => toggleSection('valueStats')}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.valueStats', 'إحصائيات القيم')}</h2>
            <div className="flex items-center">
              {collapsedSections.valueStats ? 
                <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : 
                <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              }
            </div>
          </div>
          
          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-3 ${collapsedSections.valueStats ? 'hidden md:grid' : ''}`}>
            {/* إجمالي القيم */}
            <div 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={() => navigateToClientsList('all')}
            >
              <div className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalValue', 'إجمالي القيم')}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{(totalValue || 0).toLocaleString()} {t('common.currency', 'جنيه')}</span>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </div>
            
            {/* قيم اشتراكات الهاتف */}
            <div 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={() => navigateToClientsList('mobile')}
            >
              <div className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.mobileValue', 'قيم اشتراكات الهاتف')}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{(mobileValue || 0).toLocaleString()} {t('common.currency', 'جنيه')}</span>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                  <Phone className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                </div>
              </div>
            </div>
            
            {/* قيم اشتراكات الكمبيوتر */}
            <div 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={() => navigateToClientsList('computer')}
            >
              <div className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.computerValue', 'قيم اشتراكات الكمبيوتر')}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{(computerValue || 0).toLocaleString()} {t('common.currency', 'جنيه')}</span>
                </div>
                <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
                  <Package className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* الصف الرابع من البطاقات */}
      <div className="mb-5">
        <div 
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
          onClick={() => toggleSection('subscriptionStats')}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.subscriptionStats', 'إحصائيات الاشتراكات')}</h2>
          <div className="flex items-center">
            {collapsedSections.subscriptionStats ? 
              <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : 
              <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            }
          </div>
        </div>
        
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-3 ${collapsedSections.subscriptionStats ? 'hidden md:grid' : ''}`}>
          {/* الاشتراكات النشطة */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('active')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.activeSubscriptions', 'الاشتراكات النشطة')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{activeSubscriptions || 0}</span>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <Zap className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </div>
          
          {/* الاشتراكات المنتهية */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('expired')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.expiredSubscriptions', 'الاشتراكات المنتهية')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{expiredSubscriptions || 0}</span>
              </div>
              <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-300" />
              </div>
            </div>
          </div>
          
          {/* تنتهي خلال 15 يوم */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('expiring')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.expiringThisMonth', 'تنتهي خلال 15 يوم')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{expiringThisMonth || 0}</span>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* أحدث الاشتراكات */}
      <RecentClientsList 
        formatDateForDisplay={formatDateForDisplay}
        handleShowDetails={handleShowDetails}
        isRTL={isRTL}
        navigateToClientsList={navigateToClientsList}
        refreshTrigger={refreshTrigger} // إضافة مؤشر التحديث
      />

      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient as any}
          agents={[]}
          isOpen={showDetailsModal}
          onClose={handleCloseModal}
          onSave={(updatedClient: any) => updateClient(updatedClient)}
          onDelete={handleDeleteClient}
          subscriptionTypes={SUBSCRIPTION_TYPES}
          versionTypes={VERSION_TYPES}
          currentUser={user}
        />
      )}
    </div>
  );
};