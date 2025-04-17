import { useState, useEffect } from 'react';
import { Eye, Copy, Smartphone, Laptop } from 'lucide-react';
import Button from './Button';
import { useTranslation } from 'react-i18next';
import { Client } from '../types/dashboard.types';
// نستخدم نوع أي للأجهزة لتبسيط الكود
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

type RecentClientsListProps = {
  formatDateForDisplay: (date?: string | Date) => string;
  handleShowDetails: (client: Client) => void;
  navigateToClientsList?: (filter?: string) => void;
  refreshTrigger?: boolean; // مؤشر لإعادة تحميل البيانات عند تغييره
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
  const user = useAuthStore.getState().user;

  // دالة جلب أحدث 10 أجهزة
  const fetchRecentDevices = async () => {
    setLoading(true);
    try {
      // إعداد الاستعلام الأساسي
      let query = supabase
        .from('devices')
        .select(`
          id, 
          client_id,
          device_type,
          activation_code,
          subscription_type,
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
            subscription_start,
            subscription_end,
            agent_id,
            agents!clients_agent_id_fkey(id, name, email)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // تطبيق فلتر حسب الوكيل إذا كان المستخدم وكيل
      if (user?.role === 'agent') {
        // استخدام طريقة مختلفة للتصفية
        // أولاً، نجلب قائمة العملاء التابعين للمندوب
        const { data: agentClients, error: agentClientsError } = await supabase
          .from('clients')
          .select('id')
          .eq('agent_id', user.id);
          
        if (agentClientsError) {
          console.error('Error fetching agent clients:', agentClientsError);
          throw agentClientsError;
        }
        
        // ثم نستخدم قائمة معرفات العملاء للتصفية
        const clientIds = agentClients.map(client => client.id);
        console.log(`Filtering devices for agent ${user.id} with ${clientIds.length} clients`);
        
        // تطبيق الفلتر على الاستعلام
        if (clientIds.length > 0) {
          query = query.in('client_id', clientIds);
        } else {
          // إذا لم يكن لدى المندوب أي عملاء، نعيد قائمة فارغة
          setRecentDevices([]);
          setLoading(false);
          return;
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // تنسيق بيانات الأجهزة
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
      toast.error(t('messages.errorFetchingDevices', 'حدث خطأ أثناء جلب الأجهزة'));
    } finally {
      setLoading(false);
    }
  };

  // تحديث البيانات عند تغيير مؤشر التحديث
  useEffect(() => {
    fetchRecentDevices();
  }, [refreshTrigger]);

  // نسخ رمز التفعيل
  const copyActivationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('messages.codeCopied', 'تم نسخ الرمز بنجاح'));
  };

  // الحصول على أيقونة نوع الجهاز
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'android':
        return <Smartphone className="h-4 w-4 text-green-600" />;
      case 'ios':
        return <Smartphone className="h-4 w-4 text-blue-600" />;
      default:
        return <Laptop className="h-4 w-4 text-gray-600" />;
    }
  };

  // الحصول على تسمية نوع الجهاز
  const getDeviceTypeLabel = (value: string) => {
    switch (value) {
      case 'android': return t('device.android', 'أندرويد');
      case 'ios': return t('device.ios', 'آيفون');
      case 'windows': return t('device.windows', 'ويندوز');
      default: return value;
    }
  };

  // التحقق مما إذا كان الاشتراك منتهياً
  const isSubscriptionExpired = (endDate: string) => {
    if (!endDate) return false;
    
    try {
      const end = new Date(endDate);
      const now = new Date();
      return end < now;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
          {t('dashboard.recentDevices', 'أحدث الأجهزة')}
        </h3>
        {navigateToClientsList && (
          <Button
            onClick={() => navigateToClientsList()}
            variant="secondary"
            className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {t('dashboard.viewAllDevices', 'عرض الكل')}
          </Button>
        )}
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : recentDevices.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('device.details', 'تفاصيل الجهاز')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('client.name', 'اسم العميل')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('client.agent', 'المندوب')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('device.price', 'السعر')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('device.subscriptionEnd', 'نهاية الاشتراك')}
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('actions.actions', 'الإجراءات')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full">
                        {getDeviceIcon(device.device_type)}
                      </div>
                      <div className="mr-4 rtl:mr-4 ltr:ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {getDeviceTypeLabel(device.device_type) || t('device.unknown', 'غير معروف')}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <span className="font-mono">{device.activation_code}</span>
                          <button 
                            onClick={() => copyActivationCode(device.activation_code)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            aria-label={t('device.copyActivationCode', 'نسخ رمز التفعيل') as string}
                            title={t('device.copyActivationCode', 'نسخ رمز التفعيل') as string}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                     
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    <span 
                      className="truncate block max-w-[120px]" 
                      title={device.client_name || '-'}
                      dir={/^[A-Za-z]/.test(device.client_name || '') ? 'ltr' : 'auto'}
                    >
                      {device.client_name || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span 
                      className="truncate block max-w-[90px]" 
                      title={device.agent_name || '-'}
                      dir={/^[A-Za-z]/.test(device.agent_name || '') ? 'ltr' : 'auto'}
                    >
                      {device.agent_name || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">
                      {device.price ? `${device.price} ${t('client.currency', 'جنيه')}` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {device.subscription_type === 'permanent' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {t('client.permanent', 'دائم')}
                      </span>
                    ) : device.subscription_end ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isSubscriptionExpired(device.subscription_end) ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                        {formatDateForDisplay(device.subscription_end)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        {t('client.noEndDate', 'لا يوجد تاريخ انتهاء')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <div className="flex items-center justify-center gap-2 space-y-0">
                      {device.client && (
                        <Button
                          onClick={() => handleShowDetails(device.client)}
                          variant="secondary"
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-transform hover:scale-105 p-1 rounded-md"
                          aria-label={t('actions.viewDetails', 'عرض التفاصيل') as string}
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('clientsList.noDevicesFound', 'لم يتم العثور على أجهزة.')}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentClientsList;
