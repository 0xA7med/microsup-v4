import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Users, ClipboardList, UserPlus, Phone, Calendar, Eye, 
  Clock, AlertCircle, Zap, Monitor, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { useAuthStore } from '../store/authStore';
// لا نحتاج لاستيراد مكون التحميل لأننا نستخدم Loader2 من lucide-react

import type { Database } from '../types/database.types';
import { Agent as ImportedAgent } from '../types/client.types';

type Client = Database['public']['Tables']['clients']['Row'];

// نستخدم ImportedAgent مباشرة بدلاً من إنشاء واجهة جديدة

interface DashboardData {
  totalClients: number;
  totalAgents: number;
  activeSubscriptions: number;
  recentClients: any[];
  expiredSubscriptions: number;
  agents: ImportedAgent[];
  permanentClients: number;
  expiringThisMonth: number;
  expiringIn15Days: number; // إضافة عدد الاشتراكات التي ستنتهي خلال 15 يوم
  totalDevices: number;
  mobileDevices: number; // إضافة عدد أجهزة الموبايل
  computerDevices: number; // إضافة عدد أجهزة الكمبيوتر
  renewalRate: number;
}

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

// المكون الرئيسي للوحة التحكم
export const DashboardNew: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // حالة التحميل
  const [loading, setLoading] = useState(true);
  
  // بيانات لوحة التحكم
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalClients: 0,
    totalAgents: 0,
    activeSubscriptions: 0,
    recentClients: [],
    expiredSubscriptions: 0,
    agents: [],
    permanentClients: 0,
    expiringThisMonth: 0,
    expiringIn15Days: 0,
    totalDevices: 0,
    mobileDevices: 0,
    computerDevices: 0,
    renewalRate: 0
  });
  
  // حالة تفاصيل العميل
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  
  // تحميل البيانات عند تحميل المكون
  useEffect(() => {
    // تعيين حالة التحميل
    setLoading(true);
    
    // إعادة تعيين البيانات إلى القيم الافتراضية
    setDashboardData({
      totalClients: 0,
      totalAgents: 0,
      activeSubscriptions: 0,
      recentClients: [],
      expiredSubscriptions: 0,
      agents: [],
      permanentClients: 0,
      expiringThisMonth: 0,
      expiringIn15Days: 0,
      totalDevices: 0,
      mobileDevices: 0,
      computerDevices: 0,
      renewalRate: 0
    });
    
    // تأخير طفيف لضمان تحديث الواجهة أولاً
    const timer = setTimeout(() => {
      fetchDashboardData();
    }, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);
  
  // دالة جلب بيانات لوحة التحكم
  const fetchDashboardData = async () => {
    try {
      // التحقق من وجود المستخدم
      const currentUser = useAuthStore.getState().user;
      
      if (!currentUser) {
        console.log('No user data available');
        setLoading(false);
        return;
      }
      
      console.log('Fetching dashboard data for user:', currentUser.id, 'role:', currentUser.role);
      
      // تحديد نوع المستخدم وإنشاء الفلتر المناسب
      const isAgent = currentUser.role === 'agent';
      const filter = isAgent ? { agent_id: currentUser.id } : {};
      console.log('Using filter:', filter);
      
      // جلب إجمالي العملاء
      const { count: totalCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(filter);
      
      // جلب إجمالي المندوبين (للمدير فقط)
      let agentsCount = 0;
      if (!isAgent) {
        const { count: adminAgentsCount } = await supabase
          .from('agents')
          .select('*', { count: 'exact', head: true });
        agentsCount = adminAgentsCount || 0;
      }
      
      // جلب قائمة المندوبين
      let agents: ImportedAgent[] = [];
      try {
        // تعديل الاستعلام لتجنب الخطأ - إزالة عمود is_active غير الموجود
        const { data: agentsData, error: agentsError } = await supabase
          .from('agents')
          .select('id, name, email, role')
          .order('name', { ascending: true });
          
        if (agentsError) {
          console.error('Error fetching agents list:', agentsError);
        } else if (agentsData) {
          // استخدام البيانات كما هي بدون تصفية
          agents = agentsData as ImportedAgent[];
        }
      } catch (agentsError) {
        console.error('Exception fetching agents list:', agentsError);
      }
      
      // جلب الاشتراكات النشطة باستخدام جدول الأجهزة
      let activeCount = 0;
      
      if (isAgent) {
        // إذا كان المستخدم مندوبًا، نحتاج إلى الحصول على قائمة عملائه أولاً
        const { data: agentClients } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', currentUser.id);
          
        if (agentClients && agentClients.length > 0) {
          const clientIds = agentClients.map(client => client.id);
          
          // البحث عن الأجهزة النشطة لعملاء المندوب
          const { data: activeDevicesData } = await supabase
            .from('devices')
            .select('client_id')
            .in('client_id', clientIds)
            .gt('subscription_end', new Date().toISOString())
            .not('subscription_type', 'eq', 'permanent');
            
          if (activeDevicesData) {
            // نحسب عدد العملاء الفريدين الذين لديهم أجهزة نشطة
            const uniqueClientIds = new Set(activeDevicesData.map(device => device.client_id));
            activeCount = uniqueClientIds.size;
          }
        }
      } else {
        // للمدير: جلب جميع الأجهزة النشطة
        const { data: activeDevicesData } = await supabase
          .from('devices')
          .select('client_id')
          .gt('subscription_end', new Date().toISOString())
          .not('subscription_type', 'eq', 'permanent');
          
        if (activeDevicesData) {
          // نحسب عدد العملاء الفريدين الذين لديهم أجهزة نشطة
          const uniqueClientIds = new Set(activeDevicesData.map(device => device.client_id));
          activeCount = uniqueClientIds.size;
        }
      }
      
      // جلب أحدث العملاء مع معلومات المندوب
      let recent = [];
      try {
        // استعلام بسيط لجلب العملاء
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .match(filter)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (error) {
          console.error('Error fetching recent clients:', error);
        } else {
          // جلب معلومات المندوب لكل عميل
          recent = data || [];
          console.log('Recent clients data:', recent);
          
          // جلب معلومات المندوبين للعملاء
          if (recent.length > 0) {
            const agentIds = recent.map(client => client.agent_id).filter(id => id);
            if (agentIds.length > 0) {
              const { data: agentsData } = await supabase
                .from('agents')
                .select('id, name, email, role')
                .in('id', agentIds);
                
              // ربط بيانات المندوبين بالعملاء
              if (agentsData) {
                recent = recent.map(client => {
                  if (client.agent_id) {
                    const agent = agentsData.find(a => a.id === client.agent_id);
                    return { ...client, agent };
                  }
                  return client;
                });
              }
            }
            
            // جلب عدد الأجهزة لكل عميل
            const clientIds = recent.map(client => client.id);
            if (clientIds.length > 0) {
              try {
                const { data: devicesData, error: devicesError } = await supabase
                  .from('devices')
                  .select('client_id, id, subscription_type, subscription_end')
                  .in('client_id', clientIds);
                  
                if (devicesError) {
                  console.error('Error fetching devices:', devicesError);
                } else if (devicesData) {
                  // تجميع الأجهزة حسب العميل
                  recent = recent.map(client => {
                    const clientDevices = devicesData.filter(d => d.client_id === client.id) || [];
                    const deviceCount = clientDevices.length;
                    
                    // البحث عن أقرب تاريخ انتهاء للاشتراك
                    let earliestEndDate: string | null = null;
                    let subscriptionTypes = new Set<string>();
                    
                    clientDevices.forEach(device => {
                      if (device.subscription_type) {
                        subscriptionTypes.add(device.subscription_type);
                      }
                      
                      if (device.subscription_end && (!earliestEndDate || new Date(device.subscription_end) < new Date(earliestEndDate))) {
                        earliestEndDate = device.subscription_end;
                      }
                    });
                    
                    return { 
                      ...client, 
                      deviceCount,
                      devices: clientDevices,
                      earliestEndDate,
                      subscriptionTypes: Array.from(subscriptionTypes)
                    };
                  });
                }
              } catch (devicesError) {
                console.error('Exception fetching devices:', devicesError);
              }
            }
          }
        }
      } catch (recentError) {
        console.error('Exception fetching recent clients:', recentError);
      }
      
      // جلب الاشتراكات المنتهية باستخدام جدول الأجهزة
      let expiredCount = 0;
      
      if (isAgent) {
        // إذا كان المستخدم مندوبًا، نحتاج إلى الحصول على قائمة عملائه أولاً
        const { data: agentClients } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', currentUser.id);
          
        if (agentClients && agentClients.length > 0) {
          const clientIds = agentClients.map(client => client.id);
          
          // البحث عن الأجهزة المنتهية لعملاء المندوب
          const { data: expiredDevicesData } = await supabase
            .from('devices')
            .select('client_id')
            .in('client_id', clientIds)
            .lt('subscription_end', new Date().toISOString())
            .not('subscription_type', 'eq', 'permanent');
            
          if (expiredDevicesData) {
            // نحسب عدد العملاء الفريدين الذين لديهم أجهزة منتهية
            const uniqueClientIds = new Set(expiredDevicesData.map(device => device.client_id));
            expiredCount = uniqueClientIds.size;
          }
        }
      } else {
        // للمدير: جلب جميع الأجهزة المنتهية
        const { data: expiredDevicesData } = await supabase
          .from('devices')
          .select('client_id')
          .lt('subscription_end', new Date().toISOString())
          .not('subscription_type', 'eq', 'permanent');
          
        if (expiredDevicesData) {
          // نحسب عدد العملاء الفريدين الذين لديهم أجهزة منتهية
          const uniqueClientIds = new Set(expiredDevicesData.map(device => device.client_id));
          expiredCount = uniqueClientIds.size;
        }
      }
      
      // جلب إجمالي الأجهزة مباشرة من جدول الأجهزة
      let totalDevicesCount = 0;
      let mobileDevicesCount = 0;
      let computerDevicesCount = 0;
      
      if (isAgent) {
        // للمندوبين: جلب الأجهزة التي تنتمي لعملاء المندوب
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', currentUser.id);
          
        if (clientsData && clientsData.length > 0) {
          const clientIds = clientsData.map(client => client.id);
          
          // جلب جميع الأجهزة لحساب العدد الإجمالي
          const { data: devicesData, count: devicesCount } = await supabase
            .from('devices')
            .select('id, device_type', { count: 'exact' })
            .in('client_id', clientIds);
            
          totalDevicesCount = devicesCount || 0;
          
          // حساب عدد أجهزة الموبايل والكمبيوتر
          if (devicesData) {
            mobileDevicesCount = devicesData.filter(device => 
              device.device_type === 'android' || device.device_type === 'mobile'
            ).length;
            
            // حساب عدد أجهزة الكمبيوتر
            computerDevicesCount = devicesData.filter(device => 
              device.device_type === 'computer' || device.device_type === 'desktop'
            ).length;
          }
        }
      } else {
        // للمدير: جلب جميع الأجهزة
        const { data: devicesData, count: devicesCount } = await supabase
          .from('devices')
          .select('id, device_type', { count: 'exact' });
          
        totalDevicesCount = devicesCount || 0;
        
        // حساب عدد أجهزة الموبايل والكمبيوتر
        if (devicesData) {
          mobileDevicesCount = devicesData.filter(device => 
            device.device_type === 'android' || device.device_type === 'mobile'
          ).length;
          
          // حساب عدد أجهزة الكمبيوتر
          computerDevicesCount = devicesData.filter(device => 
            device.device_type === 'computer' || device.device_type === 'desktop'
          ).length;
        }
      }
      
      // جلب العملاء بالاشتراك الدائم باستخدام جدول الأجهزة
      let permanentCount = 0;
      
      if (isAgent) {
        // إذا كان المستخدم مندوبًا، نحتاج إلى الحصول على قائمة عملائه أولاً
        const { data: agentClients } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', currentUser.id);
          
        if (agentClients && agentClients.length > 0) {
          const clientIds = agentClients.map(client => client.id);
          
          // البحث عن الأجهزة بالاشتراك الدائم لعملاء المندوب
          const { data: permanentDevicesData } = await supabase
            .from('devices')
            .select('client_id')
            .in('client_id', clientIds)
            .eq('subscription_type', 'permanent');
            
          if (permanentDevicesData) {
            // نحسب عدد العملاء الفريدين الذين لديهم أجهزة باشتراك دائم
            const uniqueClientIds = new Set(permanentDevicesData.map(device => device.client_id));
            permanentCount = uniqueClientIds.size;
          }
        }
      } else {
        // للمدير: جلب جميع الأجهزة بالاشتراك الدائم
        const { data: permanentDevicesData } = await supabase
          .from('devices')
          .select('client_id')
          .eq('subscription_type', 'permanent');
          
        if (permanentDevicesData) {
          // نحسب عدد العملاء الفريدين الذين لديهم أجهزة باشتراك دائم
          const uniqueClientIds = new Set(permanentDevicesData.map(device => device.client_id));
          permanentCount = uniqueClientIds.size;
        }
      }
      
      // جلب العملاء الذين تنتهي اشتراكاتهم هذا الشهر
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      // حساب العملاء الذين تنتهي اشتراكاتهم هذا الشهر باستخدام جدول الأجهزة
      let expiringCount = 0;
      
      if (isAgent) {
        // للمندوبين: جلب الأجهزة التي تنتهي هذا الشهر لعملاء المندوب فقط
        const { data: agentClients } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', currentUser.id);
          
        if (agentClients && agentClients.length > 0) {
          const clientIds = agentClients.map(client => client.id);
          
          const { data: expiringDevicesData, error: expiringDevicesError } = await supabase
            .from('devices')
            .select('client_id')
            .in('client_id', clientIds)
            .lt('subscription_end', endOfMonth.toISOString())
            .gt('subscription_end', today.toISOString())
            .not('subscription_type', 'eq', 'permanent');
            
          if (expiringDevicesError) {
            console.error('Error fetching expiring devices:', expiringDevicesError);
          } else if (expiringDevicesData) {
            // نحسب عدد العملاء الفريدين الذين لديهم أجهزة تنتهي هذا الشهر
            const uniqueClientIds = new Set(expiringDevicesData.map(device => device.client_id));
            expiringCount = uniqueClientIds.size;
          }
        }
      } else {
        // للمدير: جلب جميع الأجهزة التي تنتهي هذا الشهر
        const { data: expiringDevicesData, error: expiringDevicesError } = await supabase
          .from('devices')
          .select('client_id')
          .lt('subscription_end', endOfMonth.toISOString())
          .gt('subscription_end', today.toISOString())
          .not('subscription_type', 'eq', 'permanent');
        
        // هذا الجزء يتم تنفيذه فقط للمدير، لأننا عالجنا حالة المندوب في الشرط السابق
        if (expiringDevicesError) {
          console.error('Error fetching expiring devices:', expiringDevicesError);
        } else if (expiringDevicesData) {
          // نحسب عدد العملاء الفريدين الذين لديهم أجهزة تنتهي هذا الشهر
          const uniqueClientIds = new Set(expiringDevicesData.map(device => device.client_id));
          expiringCount = uniqueClientIds.size;
        }
      }
      
      // جلب العملاء الذين تنتهي اشتراكاتهم خلال 15 يوم
      const in15Days = new Date();
      in15Days.setDate(today.getDate() + 15);
      
      let expiringIn15DaysCount = 0;
      
      if (isAgent) {
        // للمندوبين: جلب الأجهزة التي تنتهي خلال 15 يوم لعملاء المندوب فقط
        const { data: agentClients } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', currentUser.id);
          
        if (agentClients && agentClients.length > 0) {
          const clientIds = agentClients.map(client => client.id);
          
          const { data: expiring15DevicesData, error: expiring15DevicesError } = await supabase
            .from('devices')
            .select('client_id')
            .in('client_id', clientIds)
            .lt('subscription_end', in15Days.toISOString())
            .gt('subscription_end', today.toISOString())
            .not('subscription_type', 'eq', 'permanent');
            
          if (expiring15DevicesError) {
            console.error('Error fetching devices expiring in 15 days:', expiring15DevicesError);
          } else if (expiring15DevicesData) {
            // نحسب عدد العملاء الفريدين الذين لديهم أجهزة تنتهي خلال 15 يوم
            const uniqueClientIds = new Set(expiring15DevicesData.map(device => device.client_id));
            expiringIn15DaysCount = uniqueClientIds.size;
          }
        }
      } else {
        // للمدير: جلب جميع الأجهزة التي تنتهي خلال 15 يوم
        const { data: expiring15DevicesData, error: expiring15DevicesError } = await supabase
          .from('devices')
          .select('client_id')
          .lt('subscription_end', in15Days.toISOString())
          .gt('subscription_end', today.toISOString())
          .not('subscription_type', 'eq', 'permanent');
        
        // هذا الجزء يتم تنفيذه فقط للمدير، لأننا عالجنا حالة المندوب في الشرط السابق
        if (expiring15DevicesError) {
          console.error('Error fetching devices expiring in 15 days:', expiring15DevicesError);
        } else if (expiring15DevicesData) {
          // نحسب عدد العملاء الفريدين الذين لديهم أجهزة تنتهي خلال 15 يوم
          const uniqueClientIds = new Set(expiring15DevicesData.map(device => device.client_id));
          expiringIn15DaysCount = uniqueClientIds.size;
        }
      }
      
      // حساب معدل التجديد
      let renewalRate = 0;
      
      if (totalCount && totalCount > 0) {
        renewalRate = Math.round((activeCount || 0) / totalCount * 100);
      }
      
      // تحديث بيانات لوحة التحكم
      const dashboardDataToSet = {
        totalClients: totalCount || 0,
        totalAgents: agentsCount || 0,
        activeSubscriptions: activeCount || 0,
        recentClients: recent || [],
        expiredSubscriptions: expiredCount || 0,
        agents: agents || [],
        permanentClients: permanentCount || 0,
        expiringThisMonth: expiringCount || 0,
        expiringIn15Days: expiringIn15DaysCount || 0,
        totalDevices: totalDevicesCount || 0,
        mobileDevices: mobileDevicesCount || 0,
        computerDevices: computerDevicesCount || 0,
        renewalRate
      };
      
      console.log('Dashboard data to set:', dashboardDataToSet);
      setDashboardData(dashboardDataToSet);
      
      console.log('Dashboard data loaded successfully');
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error(t('error.fetchingData'));
    } finally {
      setLoading(false);
    }
  };
  
  // دالة تحديث البيانات
  const handleRefresh = () => {
    toast.success(t('messages.refreshing'));
    setLoading(true);
    fetchDashboardData();
  };
  
  // دوال إدارة تفاصيل العميل
  const handleShowDetails = (client: Client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };
  
  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedClient(null);
    fetchDashboardData();
  };
  
  const handleDeleteClient = async (clientId: string) => {
    try {
      const { error } = await supabase.from('clients').delete().match({ id: clientId });
      if (error) throw error;
      toast.success(t('messages.clientDeleted', 'تم حذف العميل بنجاح'));
      handleCloseModal();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(t('messages.errorDeletingClient', 'حدث خطأ أثناء حذف العميل'));
    }
  };
  
  const handleUpdateClient = async (updatedClient: Client) => {
    if (!updatedClient.id) return;
    
    try {
      // استخراج بيانات العميل بدون حقل agent
      const { agent, ...clientData } = updatedClient as any;
      
      const { error } = await supabase
        .from('clients')
        .update(clientData)
        .match({ id: updatedClient.id });
      
      if (error) throw error;
      toast.success(t('messages.clientUpdated', 'تم تحديث بيانات العميل بنجاح'));
      handleCloseModal();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(t('messages.errorUpdatingClient', 'حدث خطأ أثناء تحديث بيانات العميل'));
    }
  };
  
  // دوال مساعدة
  const getSubscriptionTypeLabel = (value: string | undefined) => {
    if (!value) return i18n.language === 'ar' ? 'غير محدد' : 'Unspecified';
    
    // تحويل القيمة إلى حروف صغيرة للمقارنة
    const lowerValue = value.toLowerCase();
    
    // التعامل مع القيم المختلفة لنفس نوع الاشتراك
    switch(lowerValue) {
      case 'monthly': return i18n.language === 'ar' ? 'شهري' : 'Monthly';
      case 'yearly': 
      case 'annual': return i18n.language === 'ar' ? 'سنوي' : 'Annual';
      case 'half_yearly':
      case 'semi_annual': return i18n.language === 'ar' ? 'نصف سنوي' : 'Semi-Annual';
      case 'permanent': return i18n.language === 'ar' ? 'دائم' : 'Permanent';
      default: 
        console.log('Unknown subscription type:', value);
        return i18n.language === 'ar' ? 'غير معروف' : value;
    }
  };
  
  const formatDateForDisplay = (dateStr?: string | Date): string => {
    if (!dateStr) return '-';
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error formatting date:', error, typeof dateStr);
      return '-';
    }
  };
  
  const navigateToClientsList = (filter?: string) => {
    console.log('Navigating to clients list with filter:', filter); // للتشخيص
    // استخدام replace: true لضمان استبدال المسار الحالي بدلاً من إضافة مسار جديد إلى السجل
    navigate('/clients', { state: { filter }, replace: true });
  };
  
  // إزالة الدالة غير المستخدمة
  
  // استخراج البيانات من حالة dashboardData
  const {
    totalClients,
    totalAgents,
    activeSubscriptions,
    recentClients,
    expiredSubscriptions,
    agents,
    permanentClients,
    expiringIn15Days,
    totalDevices
  } = dashboardData;
  
  // عرض شاشة التحميل
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }
  
  // عرض لوحة التحكم
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {t('dashboard.title', 'لوحة التحكم')}
        </h1>
        <Button onClick={handleRefresh} variant="secondary" className="flex items-center gap-2">
          <span>{t('actions.refresh', 'تحديث')}</span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      </div>

      {/* إحصائيات العملاء والاشتراكات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList()}
          title={t('dashboard.clickToViewAllClients', 'انقر لعرض جميع العملاء')}
        >
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.totalClients', 'إجمالي العملاء')}</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{totalClients}</div>
          </div>
        </div>
        
        {user?.role !== 'agent' && (
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
            onClick={() => navigate('/agents')}
            title={t('dashboard.clickToViewAgents', 'انقر لعرض المندوبين')}
          >
            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.totalAgents', 'إجمالي المندوبين')}</div>
              <div className="text-2xl font-semibold text-gray-800 dark:text-white">{totalAgents}</div>
            </div>
          </div>
        )}
        
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList('active')}
          title={t('dashboard.clickToViewActiveClients', 'انقر لعرض العملاء النشطين')}
        >
          <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">العملاء النشطة</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{activeSubscriptions}</div>
          </div>
        </div>
        
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList('permanent')}
          title={t('dashboard.clickToViewPermanentClients', 'انقر لعرض الاشتراكات الدائمة')}
        >
          <div className="p-3 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.permanentClients', 'اشتراكات دائمة')}</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{permanentClients}</div>
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList('expired')}
          title={t('dashboard.clickToViewExpiredClients', 'انقر لعرض الاشتراكات المنتهية')}
        >
          <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.expiredSubscriptions', 'الاشتراكات المنتهية')}</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{expiredSubscriptions}</div>
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList('expiring')}
          title={t('dashboard.clickToViewExpiringClients', 'انقر لعرض الاشتراكات التي ستنتهي قريباً')}
        >
          <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.expiringIn15Days', 'تنتهي خلال 15 يوم')}</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{expiringIn15Days}</div>
          </div>
        </div>
      </div>

      {/* إحصائيات الأجهزة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList('devices')}
          title={t('dashboard.clickToViewAllDevices', 'انقر لعرض جميع الأجهزة')}
        >
          <div className="p-3 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.totalDevices', 'إجمالي الأجهزة')}</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{totalDevices}</div>
          </div>
        </div>
        
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList('mobile')}
          title={t('dashboard.clickToViewMobileDevices', 'انقر لعرض أجهزة الموبايل')}
        >
          <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.mobileDevices', 'أجهزة الموبايل')}</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{dashboardData.mobileDevices || 0}</div>
          </div>
        </div>
        
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center space-x-4 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigateToClientsList('computer')}
          title={t('dashboard.clickToViewComputerDevices', 'انقر لعرض أجهزة الكمبيوتر')}
        >
          <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300">
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.computerDevices', 'أجهزة الكمبيوتر')}</div>
            <div className="text-2xl font-semibold text-gray-800 dark:text-white">{dashboardData.computerDevices || 0}</div>
          </div>
        </div>
      </div>

      {/* أحدث العملاء */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{t('dashboard.recentClients', 'أحدث العملاء')}</h2>
          <Button onClick={() => navigateToClientsList()} variant="secondary" className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300">
            {t('actions.viewAll', 'عرض الكل')}
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          {Array.isArray(recentClients) && recentClients.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('client.name', 'اسم العميل')}
                  </th>
                  <th scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('client.organization', 'اسم المؤسسة')}
                  </th>
                  <th scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    <Phone className="inline h-4 w-4 mr-1" /> {t('client.phone', 'الهاتف')}
                  </th>
                  <th scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('client.agent', 'المندوب')}
                  </th>
                  <th scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('client.devices', 'الأجهزة')}
                  </th>
                  <th scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    <Calendar className="inline h-4 w-4 mr-1" /> {t('client.subscriptionEnd', 'انتهاء الاشتراك')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center">
                    {t('common.actions', 'الإجراءات')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {Array.isArray(recentClients) && recentClients.map((client: any) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{client.client_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{client.organization_name}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'text-right' : 'text-left'}`} dir="ltr">{client.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" data-component-name="DashboardNew">
                      {client.agent && client.agent.name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {client.agent.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">غير محدد</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" data-component-name="DashboardNew">
                      {client.deviceCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          <span className="font-bold">{client.deviceCount}</span> جهاز
                        </span>
                      ) : client.subscription_type ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {getSubscriptionTypeLabel(client.subscription_type)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          لا يوجد أجهزة
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${client.earliestEndDate && new Date(client.earliestEndDate) < new Date() ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`} data-component-name="DashboardNew">
                      {client.earliestEndDate ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${new Date(client.earliestEndDate) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                          {formatDateForDisplay(client.earliestEndDate)}
                          {client.subscriptionTypes && client.subscriptionTypes.includes('permanent') && (
                            <span className="mr-1 text-xs opacity-75">+دائم</span>
                          )}
                        </span>
                      ) : client.subscriptionTypes && client.subscriptionTypes.includes('permanent') ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t('client.permanent', 'دائم')}
                        </span>
                      ) : client.subscription_end ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${new Date(client.subscription_end) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                          {formatDateForDisplay(client.subscription_end)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          لا يوجد تاريخ انتهاء
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                      <Button
                        onClick={() => handleShowDetails(client)}
                        variant="secondary"
                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-transform hover:scale-105 p-1 rounded-md"
                        aria-label={t('actions.viewDetails', 'عرض التفاصيل') as string}
                      >
                        <Eye className="h-5 w-5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400" data-component-name="DashboardNew">
              {t('clientsList.noClientsFound', 'لم يتم العثور على عملاء.')}
            </div>
          )}
        </div>
      </div>

      {/* نافذة تفاصيل العميل */}
      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          agents={agents}
          isOpen={showDetailsModal}
          onClose={handleCloseModal}
          onSave={handleUpdateClient}
          onDelete={handleDeleteClient}
          subscriptionTypes={SUBSCRIPTION_TYPES}
          versionTypes={VERSION_TYPES}
          currentUser={user}
        />
      )}
    </div>
  );
};

export default DashboardNew;
