import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// تعريف نوع البيانات
interface DashboardData {
  totalClients: number;
  totalAgents: number;
  activeSubscriptions: number;
  recentClients: any[];
  expiredSubscriptions: number;
  agents: any[];
  permanentClients: number;
  expiringThisMonth: number;
  averageDevices: number;
  renewalRate: number;
  isLoading: boolean;
}

// إنشاء سياق لبيانات لوحة التحكم
const DashboardContext = createContext<{
  data: DashboardData;
  refreshData: () => Promise<void>;
}>({
  data: {
    totalClients: 0,
    totalAgents: 0,
    activeSubscriptions: 0,
    recentClients: [],
    expiredSubscriptions: 0,
    agents: [],
    permanentClients: 0,
    expiringThisMonth: 0,
    averageDevices: 0,
    renewalRate: 0,
    isLoading: true
  },
  refreshData: async () => {}
});

// مزود بيانات لوحة التحكم
export const DashboardDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData>({
    totalClients: 0,
    totalAgents: 0,
    activeSubscriptions: 0,
    recentClients: [],
    expiredSubscriptions: 0,
    agents: [],
    permanentClients: 0,
    expiringThisMonth: 0,
    averageDevices: 0,
    renewalRate: 0,
    isLoading: true
  });

  // دالة تحديث البيانات
  const fetchDashboardData = async () => {
    console.log('Fetching dashboard data...');
    
    // تعيين حالة التحميل
    setData(prev => ({ ...prev, isLoading: true }));
    
    try {
      // الحصول على بيانات المستخدم الحالي
      const currentUser = useAuthStore.getState().user;
      
      // التحقق من وجود المستخدم
      if (!currentUser) {
        console.log('No user data available');
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      // تحديد نوع المستخدم وتطبيق الفلتر المناسب
      const isAgent = currentUser.role === 'agent';
      const clientsFilter: any = {};
      
      if (isAgent) {
        clientsFilter.agent_id = currentUser.id;
        console.log(`Filtering data for agent: ${currentUser.id}`);
      } else {
        console.log('Admin user, showing all data');
      }
      
      // جلب إجمالي العملاء
      const { count: totalCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(clientsFilter);
      
      // جلب المندوبين (للمدير فقط)
      let agentsCount = 0;
      if (!isAgent) {
        const { count: adminAgentsCount } = await supabase
          .from('agents')
          .select('*', { count: 'exact', head: true });
        agentsCount = adminAgentsCount || 0;
      }
      
      // جلب الاشتراكات النشطة
      const { count: activeCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(clientsFilter)
        .gt('subscription_end', new Date().toISOString());
      
      // جلب أحدث العملاء
      const { data: recent } = await supabase
        .from('clients')
        .select('*, agent:agents(id, name, email)')
        .match(clientsFilter)
        .order('created_at', { ascending: false })
        .limit(5);
      
      // جلب الاشتراكات المنتهية
      const { count: expiredCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(clientsFilter)
        .lt('subscription_end', new Date().toISOString());
      
      // جلب بيانات الأجهزة
      const { data: allClients } = await supabase
        .from('clients')
        .select('device_count, subscription_type')
        .match(clientsFilter);
      
      // جلب جميع المندوبين
      const { data: agentsData } = await supabase
        .from('agents')
        .select('id, name, email');
      
      // جلب العملاء بالاشتراك الدائم
      const { count: permanentCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(clientsFilter)
        .eq('subscription_type', 'permanent');
      
      // جلب العملاء الذين تنتهي اشتراكاتهم هذا الشهر
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const { count: expiringCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(clientsFilter)
        .lt('subscription_end', endOfMonth.toISOString())
        .gt('subscription_end', today.toISOString());
      
      // حساب متوسط الأجهزة ومعدل التجديد
      const totalDevices = allClients?.reduce((acc, client) => acc + (client.device_count || 0), 0) || 0;
      let averageDevices = 0;
      let renewalRate = 0;
      
      if (totalCount && totalCount > 0) {
        averageDevices = Math.round(totalDevices / totalCount);
        renewalRate = Math.round((activeCount || 0) / totalCount * 100);
      }
      
      // تحديث البيانات
      setData({
        totalClients: totalCount || 0,
        totalAgents: agentsCount || 0,
        activeSubscriptions: activeCount || 0,
        recentClients: recent || [],
        expiredSubscriptions: expiredCount || 0,
        agents: agentsData || [],
        permanentClients: permanentCount || 0,
        expiringThisMonth: expiringCount || 0,
        averageDevices,
        renewalRate,
        isLoading: false
      });
      
      console.log('Dashboard data loaded successfully');
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error(t('error.fetchingData'));
      setData(prev => ({ ...prev, isLoading: false }));
    }
  };
  
  // تحميل البيانات عند تحميل المكون
  useEffect(() => {
    fetchDashboardData();
    
    return () => {
      console.log('Dashboard data provider unmounting');
    };
  }, []);
  
  return (
    <DashboardContext.Provider value={{ data, refreshData: fetchDashboardData }}>
      {children}
    </DashboardContext.Provider>
  );
};

// هوك للوصول إلى بيانات لوحة التحكم
export const useDashboardData = () => useContext(DashboardContext);
