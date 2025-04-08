import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Search, Phone, Calendar, Eye } from 'lucide-react';
import Button from '../components/ui/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';

interface ClientType {
  id?: string;
  client_name: string;
  organization_name: string;
  activity_type: string;
  phone: string;
  activation_code: string;
  subscription_type: string;
  address: string;
  device_count: number;
  software_version: string;
  subscription_start: string;
  subscription_end: string;
  notes?: string;
  agent_id?: string;
  created_by?: string;
  agent?: {
    name?: string;
  };
}

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

export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [clients, setClients] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [agents] = useState<Agent[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, agent:agents(id, name, email)')
        .order('client_name', { ascending: true });
      if (error) throw error;
      const formattedData = data?.map((client: ClientType) => ({
        ...client,
        agent: client.agent ? client.agent : undefined
      })) || [];
      setClients(formattedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error(t('messages.errorFetchingClients', 'حدث خطأ أثناء تحميل بيانات العملاء'));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

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

  const handleUpdateClient = async (updatedClient: ClientType) => {
    if (!updatedClient.id) return;
    const { agent, ...clientData } = updatedClient;

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
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{t('clientsList.title', 'قائمة العملاء')}</h1>

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
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{client.client_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{client.organization_name}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'text-right' : 'text-left'}`} dir="ltr">{client.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getSubscriptionTypeLabel(client.subscription_type)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${new Date(client.subscription_end) < new Date() && client.subscription_type !== 'permanent' ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
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
        />
      )}
    </div>
  );
};