import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, UserPlus, Phone, 
  Clock, AlertCircle, Zap, Package, RefreshCw,
  ChevronDown, ChevronUp, Check, X, Smartphone, Laptop, Infinity
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // حالة البيانات
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  
  // حالة التحميل والتحديث
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState(false); // مؤشر لتحديث مكون أحدث الاشتراكات
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  
  // إضافة حالة لتخزين بيانات الاشتراكات
  const [devicesData, setDevicesData] = useState<any[]>([]);
  
  // حالة طي البطاقات في وضع الهاتف
  const [collapsedSections, setCollapsedSections] = useState({
    mainStats: true,
    valueStats: true,
    deviceStats: true,
    subscriptionStats: true,
    deviceStatusStats: true, // إضافة قسم جديد لحالة الاشتراكات
    permanentStats: true // إضافة قسم جديد لإحصائيات الاشتراكات الدائمة والمنتهية
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
    // المستحقات المالية
    totalValue = 0,
    mobileValue = 0,
    computerValue = 0,
    // حالة الاشتراكات
    pendingDevices,
    rejectedDevices,
    approvedDevices = 0, // إضافة مستحقاتة افتراضية
    // عدد الاشتراكات حسب النوع
    totalDevices,
    // إضافة الحقول المفقودة
    activeDevices: activeDevicesCount,
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
  }, [dashboardData]);

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
      
      // جلب بيانات الاشتراكات
      const { data: allDevicesData = [], error: devicesError } = await supabase
        .from('devices')
        .select('id, client_id, subscription_end, subscription_type, device_type, price, approval_status');
      
      if (devicesError) throw devicesError;
      
      // تصفية الاشتراكات حسب العملاء المصفاة
      let filteredDevicesData = allDevicesData || [];
      
      // إذا كان المستخدم مندوب، نصفي الاشتراكات لعرض أجهزة عملائه فقط
      if (user?.role === 'agent') {
        const filteredClientIds = filteredClientsData.map(client => client.id);
        filteredDevicesData = filteredDevicesData.filter(device => filteredClientIds.includes(device.client_id));
        console.log('Filtered devices for agent:', filteredDevicesData.length);
      }
      
      // تخزين بيانات الاشتراكات في حالة المكون
      setDevicesData(filteredDevicesData || []);
      
      // حساب المستحقات
      let totalValue = 0;
      let mobileValue = 0;
      let computerValue = 0;
      
      // حساب عدد الاشتراكات حسب النوع والحالة
      let totalDevices = 0;
      let pendingDevices = 0;
      let rejectedDevices = 0;
      let approvedDevices = 0;
      
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
      
      // حساب المستحقات المالية والأعداد من الاشتراكات
      if (filteredDevicesData) {
        // ابدأ بطباعة العدد الإجمالي للأجهزة للتشخيص
        console.log('Total devices fetched:', filteredDevicesData.length);
        
        // تحليل البيانات للعثور على الاشتراكات المنتهية والنشطة
        const approvedDevicesArr = filteredDevicesData.filter(device => device.approval_status === 'approved');
        console.log('Approved devices:', approvedDevicesArr.length);
        
        // الاشتراكات المنتهية هي الاشتراكات المقبولة وغير الدائمة وتاريخ انتهاء صلاحيتها أقل من التاريخ الحالي
        const expiredDevicesArr = approvedDevicesArr.filter(device => {
          if (device.subscription_type === 'permanent') return false;
          if (!device.subscription_end) return false;
          const endDate = new Date(device.subscription_end);
          const isExpired = endDate < currentDate;
          return isExpired;
        });
        
        // الاشتراكات النشطة هي الاشتراكات المقبولة إما الدائمة أو التي لم تنته صلاحيتها بعد
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
        
        // الاشتراكات التي ستنتهي خلال 15 يوم
        const expiringDevicesArr = activeDevicesArr.filter(device => {
          if (device.subscription_type === 'permanent') return false;
          if (!device.subscription_end) return false;
          const endDate = new Date(device.subscription_end);
          return endDate <= futureDate;
        });
        
        expiringThisMonthCount = expiringDevicesArr.length;
        console.log('Expiring soon devices count:', expiringThisMonthCount);
        
        filteredDevicesData.forEach((device: any) => {
          // حساب المستحقات المالية فقط للأجهزة المقبولة
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
          
          // حساب عدد الاشتراكات حسب النوع والحالة
          totalDevices++;
          
          if (device.approval_status === 'pending') {
            pendingDevices++;
          } else if (device.approval_status === 'rejected') {
            rejectedDevices++;
          } else if (device.approval_status === 'approved') {
            approvedDevices++;
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
        // المستحقات المالية
        totalValue,
        mobileValue,
        computerValue,
        // حالة الاشتراكات
        pendingDevices,
        rejectedDevices,
        approvedDevices,
        // عدد الاشتراكات حسب النوع
        totalDevices,
        // إضافة الحقول المفقودة
        activeDevices: activeSubscriptionsCount || 0,
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

  // الانتقال إلى قائمة العملاء مع تطبيق الفلتر المناسب
  const navigateToClientsList = useCallback((filter?: string) => {
    if (!filter || filter === 'all') {
      navigate('/clients');
    } else {
      navigate(`/clients?filter=${filter}`);
    }
  }, [navigate]);

  // عرض مؤشر التحميل أثناء التحميل الأولي
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // حساب إحصائيات الاشتراكات الدائمة والمنتهية وتنتهي خلال 15 يوم بشكل ديناميكي
  const now = new Date();
  const fifteenDaysLater = new Date();
  fifteenDaysLater.setDate(now.getDate() + 15);

  const permanentCount = devicesData.filter(device => device.subscription_type === 'permanent').length;
  const expiredCount = devicesData.filter(device => {
    if (device.subscription_type === 'permanent') return false;
    if (!device.subscription_end) return false;
    return new Date(device.subscription_end) < now;
  }).length;
  const expiringSoonCount = devicesData.filter(device => {
    if (device.subscription_type === 'permanent') return false;
    if (!device.subscription_end) return false;
    const end = new Date(device.subscription_end);
    return end >= now && end <= fifteenDaysLater;
  }).length;

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
              setRefreshTrigger(prev => !prev); // تغيير مستحقاتة مؤشر التحديث لإعادة تحميل بيانات الاشتراكات
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
            onClick={() => navigateToClientsList('all')}
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
        </div>
      </div>
      
     
      {/* قسم حالة الاشتراكات */}
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
           
          {/* أجهزة الهاتف */}
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
          
          {/* أجهزة الكمبيوتر */}
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
          {/* الاشتراكات النشطة */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('active')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.activeDevices', 'الاشتراكات النشطة')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{activeDevicesCount || 0}</span>
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
         
        </div>
      </div>
      
      {/* قسم إحصائيات الاشتراكات الدائمة والمنتهية وتنتهي قريباً */}
      <div className="mb-5">
        <div 
          className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
          onClick={() => toggleSection('permanentStats')}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.subscriptionTypes', 'أنواع الاشتراكات')}</h2>
          <div className="flex items-center">
            {collapsedSections.permanentStats ? 
              <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : 
              <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            }
          </div>
        </div>
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-3 ${collapsedSections.permanentStats ? 'hidden md:grid' : ''}`}>
          {/* الاشتراكات الدائمة */}
          <div 
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
            onClick={() => navigateToClientsList('permanent')}
          >
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.permanentSubscriptions', 'الاشتراكات الدائمة')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{permanentCount}</span>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                <Infinity className="h-6 w-6 text-purple-600 dark:text-purple-300" />
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
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{expiredCount}</span>
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
                <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{expiringSoonCount}</span>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
       {/* قسم إحصائيات المستحقات - يظهر فقط للمديرين */}
       {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="mb-5">
          <div 
            className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-1 mt-4 cursor-pointer md:hidden"
            onClick={() => toggleSection('valueStats')}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.valueStats', 'إحصائيات المستحقات')}</h2>
            <div className="flex items-center">
              {collapsedSections.valueStats ? 
                <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : 
                <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              }
            </div>
          </div>
          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-3 ${collapsedSections.valueStats ? 'hidden md:grid' : ''}`}>
            {/* إجمالي المستحقات */}
            <div 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={() => navigateToClientsList('all')}
            >
              <div className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalValue', 'إجمالي المستحقات')}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{(totalValue || 0).toLocaleString()} {t('common.currency', 'جنيه')}</span>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </div>
            {/* مستحقات أجهزة الهاتف */}
            <div 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={() => navigateToClientsList('mobile')}
            >
              <div className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.mobileValue', 'مستحقات الهاتف')}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{(mobileValue || 0).toLocaleString()} {t('common.currency', 'جنيه')}</span>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                  <Phone className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                </div>
              </div>
            </div>
            {/* مستحقات أجهزة الكمبيوتر */}
            <div 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
              onClick={() => navigateToClientsList('computer')}
            >
              <div className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.computerValue', 'مستحقات الكمبيوتر')}</span>
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
      
      {/* أحدث الاشتراكات */}
      <RecentClientsList 
        formatDateForDisplay={formatDateForDisplay}
        handleShowDetails={handleShowDetails}
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