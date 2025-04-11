import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Users, ClipboardList, UserPlus, Phone, Calendar, Eye, 
  Clock, AlertCircle, Zap, Percent, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
// Removed unused table imports
import Button from '../components/button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { useAuthStore } from '../store/authStore';

import type { Database } from '../types/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface Agent {
  id: string;
  email: string;
  name?: string;
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

export const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  // لن نستخدم user من useAuthStore هنا لأننا سنحصل عليه مباشرة من getState في الوظيفة
  
  const [totalClients, setTotalClients] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState(0);
  const [averageDevices, setAverageDevices] = useState(0);
  const [renewalRate, setRenewalRate] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [permanentClients, setPermanentClients] = useState(0);
  const [expiringThisMonth, setExpiringThisMonth] = useState(0);
  
  // Helper functions for client management
  const handleShowDetails = (client: Client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedClient(null);
    // Refresh data after closing modal
    fetchDashboardData();
  };
  
  // استدعاء البيانات عند تحميل الصفحة
  useEffect(() => {
    // إعادة تعيين البيانات إلى القيم الافتراضية أولاً
    setTotalClients(0);
    setTotalAgents(0);
    setActiveSubscriptions(0);
    setRecentClients([]);
    setExpiredSubscriptions(0);
    setAgents([]);
    setPermanentClients(0);
    setExpiringThisMonth(0);
    setAverageDevices(0);
    setRenewalRate(0);
    setLoading(true);
    
    // تأخير طفيف للتأكد من تحديث الواجهة أولاً
    const timer = setTimeout(() => {
      fetchDashboardData();
    }, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

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
    // إزالة أي خصائص غير موجودة في جدول العملاء
    const clientData = {
      client_name: updatedClient.client_name,
      organization_name: updatedClient.organization_name,
      activity_type: updatedClient.activity_type,
      phone: updatedClient.phone,
      activation_code: updatedClient.activation_code,
      subscription_type: updatedClient.subscription_type,
      subscription_start: updatedClient.subscription_start,
      subscription_end: updatedClient.subscription_end,
      notes: updatedClient.notes,
      agent_id: updatedClient.agent_id
    };

    try {
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

  const getSubscriptionTypeLabel = (value: string) => {
    const type = SUBSCRIPTION_TYPES.find(t => t.value === value);
    return type ? (i18n.language === 'ar' ? type.label : type.labelEn) : value;
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

  const fetchDashboardData = async () => {
    setLoading(true);
    
    try {
      // الحصول على بيانات المستخدم الحالي
      const currentUser = useAuthStore.getState().user;
      
      if (!currentUser) {
        console.log('No user data available');
        setLoading(false);
        return;
      }
      
      console.log('Fetching dashboard data for user:', currentUser.id, 'role:', currentUser.role);
      
      // تحديد ما إذا كان المستخدم مندوبًا أم مديرًا
      const isAgent = currentUser.role === 'agent';
      
      // إنشاء الفلتر المناسب
      const filter = isAgent ? { agent_id: currentUser.id } : {};
      
      // جلب إجمالي العملاء
      const { count: totalCount, error: clientsError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(filter);
      
      if (clientsError) {
        throw clientsError;
      }
      
      // جلب إجمالي المندوبين (للمدير فقط)
      let agentsCount = 0;
      if (!isAgent) {
        const { count: adminAgentsCount, error: agentsError } = await supabase
          .from('agents')
          .select('*', { count: 'exact', head: true });
          
        if (agentsError) {
          throw agentsError;
        }
        
        agentsCount = adminAgentsCount || 0;
      }
      
      // جلب الاشتراكات النشطة
      const { count: activeCount, error: activeError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(filter)
        .gt('subscription_end', new Date().toISOString());
        
      if (activeError) {
        throw activeError;
      }
      
      // جلب أحدث العملاء
      const { data: recent, error: recentError } = await supabase
        .from('clients')
        .select('*, agents!clients_agent_id_fkey(id, name, email)')
        .match(filter)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (recentError) {
        throw recentError;
      }
      
      // جلب الاشتراكات المنتهية
      const { count: expiredCount, error: expiredError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(filter)
        .lt('subscription_end', new Date().toISOString());
        
      if (expiredError) {
        throw expiredError;
      }
      
      // جلب بيانات الأجهزة
      const { data: allClients, error: deviceError } = await supabase
        .from('clients')
        .select('device_count, subscription_type')
        .match(filter);
        
      if (deviceError) {
        throw deviceError;
      }
      
      // جلب جميع المندوبين
      const { data: agentsData, error: agentsDataError } = await supabase
        .from('agents')
        .select('id, name, email');
        
      if (agentsDataError) {
        throw agentsDataError;
      }
      
      // جلب العملاء بالاشتراك الدائم
      const { count: permanentCount, error: permanentError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(filter)
        .eq('subscription_type', 'permanent');
        
      if (permanentError) {
        throw permanentError;
      }
      
      // جلب العملاء الذين تنتهي اشتراكاتهم هذا الشهر
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const { count: expiringCount, error: expiringError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .match(filter)
        .lt('subscription_end', endOfMonth.toISOString())
        .gt('subscription_end', today.toISOString());
        
      if (expiringError) {
        throw expiringError;
      }
      
      // حساب متوسط الأجهزة ومعدل التجديد
      const totalDevices = allClients?.reduce((acc, client) => acc + (client.device_count || 0), 0) || 0;
      let avgDevices = 0;
      let renewal = 0;
      
      if (totalCount && totalCount > 0) {
        avgDevices = Math.round(totalDevices / totalCount);
        renewal = Math.round((activeCount || 0) / totalCount * 100);
      }
      
      // تحديث حالة المكون
      setTotalClients(totalCount || 0);
      setTotalAgents(agentsCount || 0);
      setActiveSubscriptions(activeCount || 0);
      setRecentClients(recent || []);
      setExpiredSubscriptions(expiredCount || 0);
      setAgents(agentsData || []);
      setPermanentClients(permanentCount || 0);
      setExpiringThisMonth(expiringCount || 0);
      setAverageDevices(avgDevices);
      setRenewalRate(renewal);
      
      console.log('Dashboard data loaded successfully');
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error(t('error.fetchingData'));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch total clients
        const { count: totalCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });

        // Fetch total agents
        const { count: agentsCount } = await supabase
          .from('agents')
          .select('*', { count: 'exact', head: true });

        // Fetch active subscriptions
        const { count: activeCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .gt('subscription_end', new Date().toISOString());

        // Fetch recent clients with agent information
        const { data: recent } = await supabase
          .from('clients')
          .select('*, agent:agents(id, name, email)')
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch expired count for statistics
        const { count: expiredCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .lt('subscription_end', new Date().toISOString());

        // Fetch device data
        const { data: allClients } = await supabase
          .from('clients')
          .select('device_count');

        // Fetch all agents for client details modal
        const { data: agentsData } = await supabase
          .from('agents')
          .select('id, name, email');

        const totalDevices = allClients?.reduce((acc, client) => acc + (client.device_count || 0), 0) || 0;

        setTotalClients(totalCount || 0);
        setTotalAgents(agentsCount || 0);
        setActiveSubscriptions(activeCount || 0);
        setRecentClients(recent || []);
        setExpiredSubscriptions(expiredCount || 0);
        setAgents(agentsData || []);
        
        if (totalCount && totalCount > 0) {
          setAverageDevices(Math.round(totalDevices / totalCount));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error(t('error.fetchingData'));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Navigate to clients list with filter
  const navigateToClientsList = (filter?: string) => {
    // Use URL query parameters instead of sessionStorage
    if (filter) {
      navigate(`/clients?filter=${filter}`);
    } else {
      navigate('/clients');
    }
  };

  // Navigate to agents list
  const navigateToAgentsList = () => {
    navigate('/agents');
  };

if (loading) {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}

return (
  <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
      {t('nav.dashboard')}
    </h1>

    {/* Main Stats */}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div 
        className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
        onClick={() => navigateToClientsList()}
      >
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.totalClients')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {totalClients}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
        onClick={() => navigateToClientsList('active')}
      >
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.activeSubscriptions')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {activeSubscriptions}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
        onClick={() => navigateToClientsList('expired')}
      >
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.expiredSubscriptions', 'الاشتراكات المنتهية')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {expiredSubscriptions}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
        onClick={() => navigateToAgentsList()}
      >
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('nav.agents')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {totalAgents}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Additional Stats */}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.expiringThisMonth', 'تنتهي هذا الشهر')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {expiringThisMonth}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.averageDevices', 'متوسط الأجهزة')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {averageDevices}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-teal-500 rounded-md p-3">
              <Percent className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.renewalRate', 'معدل التجديد')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {renewalRate}%
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105"
        onClick={() => navigateToClientsList('permanent')}
      >
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-pink-500 rounded-md p-3">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.permanentLicenses', 'التراخيص الدائمة')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {permanentClients}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          {t('dashboard.recentClients')}
        </h2>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
        {recentClients.length > 0 ? (
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
                  {t('client.subscriptionType', 'نوع الاشتراك')}
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
              {recentClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{client.client_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{client.organization_name}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'text-right' : 'text-left'}`} dir="ltr">{client.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getSubscriptionTypeLabel(client.subscription_type)}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${new Date(client.subscription_end || '') < new Date() && client.subscription_type !== 'permanent' ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                    {client.subscription_type === 'permanent' ? t('client.permanent', 'دائم') : formatDateForDisplay(client.subscription_end)}
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
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('clientsList.noClientsFound', 'لم يتم العثور على عملاء.')}
          </div>
        )}
      </div>
    </div>

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
      />
    )}
  </div>
);
};