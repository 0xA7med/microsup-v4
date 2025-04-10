import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Search, Phone, Calendar, Eye, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types';

interface ClientType extends Omit<ImportedClientType, 'address'> {
  address: string; // جعل العنوان إلزامي في واجهة العرض
  agent?: {
    name?: string;
  };
  created_by?: string;
  deviceCount?: number;
  devices?: any[];
  earliestEndDate?: string | null;
  subscriptionTypes?: string[];
}

interface Agent extends ImportedAgent {
  // إضافة أي خصائص إضافية مطلوبة في واجهة العرض
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

export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore(); // استخدام معلومات المستخدم المسجل دخوله

  const [clients, setClients] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [agents] = useState<Agent[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const fetchClients = async (filterOverride?: string | null) => {
    setLoading(true);
    try {
      let query = supabase
        .from('clients')
        .select('*, agent:agents(id, name, email)');
      
      // إذا كان المستخدم مندوبًا، اعرض فقط العملاء الذين أضافهم
      if (user && user.role === 'agent') {
        query = query.eq('agent_id', user.id);
      }
      
      // Use the override filter if provided, otherwise use the component state
      const filterToApply = filterOverride !== undefined ? filterOverride : activeFilter;
      
      // Apply filter if exists
      if (filterToApply) {
        const today = new Date().toISOString();
        
        switch (filterToApply) {
          case 'active':
            query = query.gt('subscription_end', today);
            break;
          case 'expired':
            query = query.lt('subscription_end', today);
            break;
          case 'permanent':
            query = query.eq('subscription_type', 'permanent');
            break;
          case 'monthly':
            query = query.eq('subscription_type', 'monthly');
            break;
          case 'annual':
            query = query.eq('subscription_type', 'annual');
            break;
          default:
            // No filter
            break;
        }
      }
      
      // Apply ordering - عرض العملاء الأحدث أولاً
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // تنسيق بيانات العملاء
      let formattedData = data?.map((client: ClientType) => ({
        ...client,
        agent: client.agent ? client.agent : undefined
      })) || [];
      
      // جلب بيانات الأجهزة لكل عميل
      if (formattedData.length > 0) {
        const clientIds = formattedData.map(client => client.id);
        try {
          const { data: devicesData, error: devicesError } = await supabase
            .from('devices')
            .select('client_id, id, subscription_type, subscription_end')
            .in('client_id', clientIds);
            
          if (devicesError) {
            console.error('Error fetching devices:', devicesError);
          } else if (devicesData) {
            // تجميع الأجهزة حسب العميل
            formattedData = formattedData.map(client => {
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
                subscriptionTypes: Array.from(subscriptionTypes) as string[]
              };
            });
          }
        } catch (devicesError) {
          console.error('Exception fetching devices:', devicesError);
        }
      }
      
      setClients(formattedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error(t('messages.errorFetchingClients', 'حدث خطأ أثناء تحميل بيانات العملاء'));
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get filter from URL query parameters
    const queryParams = new URLSearchParams(location.search);
    const filterParam = queryParams.get('filter');
    
    // Update the filter state and fetch clients in one go to avoid race conditions
    if (filterParam) {
      // First fetch data with the filter to avoid any delay
      fetchClients(filterParam);
      // Then update the state
      setActiveFilter(filterParam);
    } else {
      // First fetch all data without filter
      fetchClients(null);
      // Then update the state
      setActiveFilter(null);
    }
    
  }, [location.search]);

  const handleShowDetails = (client: ClientType) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedClient(null);
    fetchClients();
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

  const handleUpdateClient = async (updatedClient: ImportedClientType | ClientType) => {
    if (!updatedClient.id) return;
    
    // تحويل البيانات إلى الشكل المناسب لقاعدة البيانات
    const { agent, created_by, ...clientData } = updatedClient as ClientType;
    
    // التأكد من أن العنوان موجود، وإذا لم يكن موجودًا نضع قيمة فارغة
    const dataToUpdate = {
      ...clientData,
      address: clientData.address || '',
    };

    try {
      const { error } = await supabase
        .from('clients')
        .update(dataToUpdate)
        .match({ id: updatedClient.id });

      if (error) throw error;
      toast.success(t('messages.clientUpdated', 'تم تحديث بيانات العميل بنجاح'));
      handleCloseModal();
      // إعادة تحميل البيانات بعد التحديث
      fetchClients(activeFilter);
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
    if (!dateStr) return t('common.notAvailable', 'غير متاح');
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(date.getTime())) {
         return t('common.invalidDate', 'تاريخ غير صالح');
      }
      if (date.getFullYear() <= 1970) {
          return t('common.notSet', 'لم يحدد');
      }
      return format(date, 'yyyy/MM/dd');
    } catch (error) {
      console.error("Error formatting date:", dateStr, error);
      return t('common.invalidDate', 'تاريخ غير صالح');
    }
  };

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.organization_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm) ||
    client.activation_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('clientsList.title', 'قائمة العملاء')}</h1>
        
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            <span>{t('common.backToDashboard', 'العودة للوحة التحكم')}</span>
            <ChevronRight className="h-5 w-5 mr-1" />
          </button>
        </div>
        
        {activeFilter && (
          <div className="flex items-center">
            <span className="mr-2 text-sm text-gray-600 dark:text-gray-300">
              {t('clientsList.filterActive', 'الفلتر النشط')}:
            </span>
            <span className="px-3 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 rounded-full text-sm font-medium">
              {activeFilter === 'active' && t('clientsList.activeFilter', 'الاشتراكات النشطة')}
              {activeFilter === 'expired' && t('clientsList.expiredFilter', 'الاشتراكات المنتهية')}
              {activeFilter === 'permanent' && t('clientsList.permanentFilter', 'التراخيص الدائمة')}
              {activeFilter === 'monthly' && t('clientsList.monthlyFilter', 'الاشتراكات الشهرية')}
              {activeFilter === 'annual' && t('clientsList.annualFilter', 'الاشتراكات السنوية')}
            </span>
            <button 
              onClick={() => {
                // أولاً: تحميل جميع العملاء بدون فلتر
                fetchClients(null);
                // ثانياً: تحديث الرابط لإزالة معلمة الفلتر
                navigate('/clients', { replace: true });
              }}
              className="mr-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              {t('clientsList.clearFilter', 'إلغاء الفلتر')} ×
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 relative">
        <input
          type="text"
          placeholder={t('clientsList.searchPlaceholder', 'ابحث بالاسم، المؤسسة، الهاتف، كود التفعيل...') as string}
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className={`w-full p-3 ${isRTL ? 'pr-10' : 'pl-10'} border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white`}
        />
        <Search className={`absolute top-1/2 transform -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} h-5 w-5 text-gray-400 dark:text-gray-500`} />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t('common.loading', 'جار التحميل...')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
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
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{client.client_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{client.organization_name}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'text-right' : 'text-left'}`} dir="ltr">{client.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.agent && client.agent.name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {client.agent.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">غير محدد</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.deviceCount && client.deviceCount > 0 ? (
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
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${client.earliestEndDate && new Date(client.earliestEndDate) < new Date() ? 'text-red-500 font-semibold' : client.subscription_end && new Date(client.subscription_end) < new Date() && client.subscription_type !== 'permanent' ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {client.subscriptionTypes && client.subscriptionTypes.includes('permanent') ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t('client.permanent', 'دائم')}
                        </span>
                      ) : client.earliestEndDate ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${new Date(client.earliestEndDate) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                          {formatDateForDisplay(client.earliestEndDate)}
                        </span>
                      ) : client.subscription_end ? (
                        formatDateForDisplay(client.subscription_end)
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
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('clientsList.noClientsFound', 'لم يتم العثور على عملاء يطابقون البحث.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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