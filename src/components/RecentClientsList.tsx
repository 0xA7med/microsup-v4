import { useState, useEffect } from 'react';
import { 
  Eye, 
  Copy, 
  Smartphone, 
  Laptop, 
  RefreshCw, 
  Calendar, 
  Search,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Client } from '../types/dashboard.types';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import Button from './Button';

type RecentClientsListProps = {
  formatDateForDisplay: (date?: string | Date | number | null) => string;
  handleShowDetails?: (client: Client) => void;
  navigateToClientsList?: (params?: { filter?: string; deviceFilter?: string; allWithDevices?: boolean }) => void;
  refreshTrigger?: boolean;
}

const RecentClientsList = ({ 
  formatDateForDisplay, 
  handleShowDetails,
  navigateToClientsList,
  refreshTrigger
}: RecentClientsListProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [recentDevices, setRecentDevices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const user = useAuthStore.getState().user;

  const fetchRecentDevices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('devices')
        .select(`
          id, 
          client_id,
          device_type,
          activation_code,
          subscription_type,
          subscription_start,
          subscription_end,
          price,
          created_at,
          approval_status,
          clients!devices_client_id_fkey(
            id, 
            client_name, 
            organization_name,
            activity_type,
            address,
            phone,
            phone2,
            notes,
            subscription_type,
            subscription_end,
            agent_id,
            agents!clients_agent_id_fkey(id, name, email)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (user?.role === 'agent') {
        const { data: agentClients, error: agentClientsError } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', user.id);
          
        if (agentClientsError) throw agentClientsError;
        
        const clientIds = agentClients.map(client => client.id);
        
        if (clientIds.length > 0) {
          query = query.in('client_id', clientIds);
        } else {
          setRecentDevices([]);
          setLoading(false);
          return;
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const formattedDevices = data?.map((device: any) => ({
        ...device,
        client: {
          ...device.clients,
          agent_name: device.clients?.agents?.name
        },
        client_name: device.clients?.client_name,
        phone: device.clients?.phone,
        agent_name: device.clients?.agents?.name
      })) || [];
      
      setRecentDevices(formattedDevices);
    } catch (error) {
      console.error('Error fetching recent devices:', error);
      toast.error(t('messages.errorFetchingDevices', 'حدث خطأ أثناء جلب الأشتراكات'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentDevices();
  }, [refreshTrigger]);
  
  const copyActivationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('messages.codeCopied', 'تم نسخ الرمز'));
  };
  
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'computer':
        return <Laptop className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
      case 'android':
      default:
        return <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };
  
  const getDeviceTypeLabel = (value: string) => {
    switch (value) {
      case 'computer':
        return t('device.computer', 'كمبيوتر');
      case 'android':
      default:
        return t('device.android', 'هاتف');
    }
  };
  
  const getSubscriptionTypeLabel = (subscriptionType: string) => {
    switch (subscriptionType) {
      case 'monthly':
        return t('subscription.monthly', 'شهري');
      case 'semi_annual':
        return t('subscription.semiAnnual', 'نصف سنوي');
      case 'annual':
        return t('subscription.annual', 'سنوي');
      case 'permanent':
        return t('subscription.permanent', 'دائم');
      default:
        return subscriptionType;
    }
  };

  const filteredDevices = recentDevices.filter(device => 
    device.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.activation_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden mb-8">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.recentDevices', 'أحدث الأشتراكات')}
            <span className="bg-primary-100 text-primary-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-primary-900 dark:text-primary-300">
              {filteredDevices.length}
            </span>
          </h1>
          
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full p-2 pr-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                placeholder={t('device.searchPlaceholder', 'بحث...') as string}
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Button
                onClick={fetchRecentDevices}
                variant="secondary"
                className="p-2 rounded-md"
                aria-label={t('actions.refresh', 'تحديث') as string}
                title={t('actions.refresh', 'تحديث') as string}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              {navigateToClientsList && (
                <Button
                  onClick={() => navigateToClientsList()}
                  variant="primary"
                  className="text-sm px-4 py-2"
                >
                  {t('actions.viewAll', 'عرض الكل')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : recentDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                {t('clientsList.noDevicesFound', 'لا توجد أجهزة')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('clientsList.noDevicesDesc', 'لم يتم العثور على أجهزة حديثة.')}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
              <div dir="rtl" className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('device.deviceType', 'نوع الاشتراك')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[25%]">
                        {t('device.clientName', 'اسم العميل')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-32">
                        {t('device.activationCode', 'رمز التفعيل')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[10%]">
                        {t('device.agentName', 'المندوب')}
                      </th>
                      
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('device.subscriptionType', 'نوع الاشتراك')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('device.subscriptionDates', 'تاريخ الاشتراك')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('device.price', 'المستحقات')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('device.actions', 'الإجراءات')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="ml-2">{getDeviceIcon(device.device_type)}</span>
                            <span className="text-sm text-gray-900 dark:text-white">
                              {getDeviceTypeLabel(device.device_type)}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div 
                            className={`
                              text-sm font-medium text-gray-900 dark:text-white
                              max-w-[6rem] overflow-hidden text-ellipsis whitespace-nowrap
                              ${/^[A-Za-z]/.test(device.client_name || '') ? 'text-left' : 'text-right'}
                            `}
                            style={{
                              direction: /^[A-Za-z]/.test(device.client_name || '') ? 'ltr' : 'rtl',
                              unicodeBidi: 'plaintext'
                            }}
                            title={device.client_name || '-'} // لعرض الاسم الكامل عند hover
                          >
                            {device.client_name || '-'}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-32">
                          <div className={`flex items-center justify-between p-1 rounded ${
                            device.approval_status === 'approved' 
                              ? 'bg-green-50 dark:bg-green-900/20' 
                              : device.approval_status === 'rejected' 
                                ? 'bg-red-50 dark:bg-red-900/20' 
                                : 'bg-yellow-50 dark:bg-yellow-900/20'
                          }`}>
                            <div className="flex items-center">
                              <span className={`text-xs font-mono truncate max-w-[80px] ${
                                device.approval_status === 'approved' 
                                  ? 'text-green-800 dark:text-green-200' 
                                  : device.approval_status === 'rejected' 
                                    ? 'text-red-800 dark:text-red-200' 
                                    : 'text-yellow-800 dark:text-yellow-200'
                              }`} title={device.activation_code}>
                                {device.activation_code}
                              </span>
                              <button
                                className={`mr-1 p-1 ${
                                  device.approval_status === 'approved' 
                                    ? 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300' 
                                    : device.approval_status === 'rejected' 
                                      ? 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300' 
                                      : 'text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300'
                                } transition-colors`}
                                title={t('device.copyActivationCode', 'نسخ رمز التفعيل')}
                                onClick={() => copyActivationCode(device.activation_code)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div 
                            className={`
                              text-sm text-gray-500 dark:text-gray-400 
                              max-w-[6rem] overflow-hidden text-ellipsis whitespace-nowrap
                              ${/^[A-Za-z]/.test(device.agent_name) ? 'text-left' : 'text-right rtl'}
                            `}
                            style={{ direction: /^[A-Za-z]/.test(device.agent_name) ? 'ltr' : 'rtl', unicodeBidi: 'plaintext' }}
                            title={device.agent_name || '-'}
                          >
                            {device.agent_name || '-'}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {getSubscriptionTypeLabel(device.subscription_type)}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400">
                            {device.subscription_start ? (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 ml-1 text-gray-400 dark:text-gray-500" />
                                <span>{formatDateForDisplay(device.subscription_start)}</span>
                              </div>
                            ) : null}
                            {device.subscription_end ? (
                              <div className="flex items-center mt-1">
                                <Calendar className="h-4 w-4 ml-1 text-gray-400 dark:text-gray-500" />
                                <span>{formatDateForDisplay(device.subscription_end)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {t('client.noEndDate', 'لا يوجد تاريخ انتهاء')}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {device.price ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <span className="font-bold">{device.price}</span> جنيه
                              </span>
                            ) : '-'}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {device.client && handleShowDetails && (
                              <Button
                                variant="secondary"
                                onClick={() => handleShowDetails(device.client)}
                                className="px-3 py-1.5 text-sm flex items-center gap-1"
                                title={t('device.viewClientDetails', 'عرض تفاصيل العميل')}
                              >
                                <Eye className="h-4 w-4 ml-1" />
                                {t('actions.view', 'عرض')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentClientsList;