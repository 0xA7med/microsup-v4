import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { Search, Edit, Trash2, AlertCircle, X, User, Calendar, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerInput from '../components/CustomerInput';
import CustomerField from '../components/CustomerField';
import CustomerSelect from '../components/CustomerSelect';
import CustomerTextArea from '../components/CustomerTextArea';
import Button from '../components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';

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
    full_name?: string;
  };
}

// تعريف أنواع الاشتراك
const SUBSCRIPTION_TYPES = [
  { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
  { value: 'semi_annual', label: 'نصف سنوي', labelEn: 'Biannual' },
  { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
  { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
];

// تعريف أنواع النسخة
const VERSION_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer' },
  { value: 'android', label: 'موبايل', labelEn: 'Mobile' }
];

export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isRTL = i18n.language === 'ar';
  
  const [clients, setClients] = useState<ClientType[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [dateInputValue, setDateInputValue] = useState<string>('');

  // إحضار قائمة العملاء
  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('client_name', { ascending: true });

      if (error) throw error;
      
      setClients(data || []);
      setFilteredClients(data || []);
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

  // تصفية العملاء حسب البحث
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients(clients);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = clients.filter(
        (client) =>
          client.client_name.toLowerCase().includes(term) ||
          client.organization_name.toLowerCase().includes(term) ||
          client.phone.toLowerCase().includes(term) ||
          client.subscription_type.toLowerCase().includes(term) ||
          (client.agent?.full_name?.toLowerCase().includes(term) || false)
      );
      setFilteredClients(filtered);
    }
  }, [searchTerm, clients]);

  // تنسيق التاريخ للعرض
  const formatDateForDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // حساب تاريخ نهاية الاشتراك
  const calculateEndDate = (startDate: Date, subscriptionType: string) => {
    let endDate = new Date(startDate);

    switch (subscriptionType) {
      case 'monthly':
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      case 'semi_annual':
        endDate.setMonth(startDate.getMonth() + 6);
        break;
      case 'annual':
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
      case 'permanent':
        endDate = new Date(2099, 11, 31); // تاريخ بعيد للاشتراك الدائم
        break;
    }

    return format(endDate, 'yyyy-MM-dd');
  };

  // Determine if subscription is active
  const isSubscriptionActive = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    return today <= end;
  };

  // Update client display logic
  const displayAgentName = (agent: { full_name?: string }) => {
    return agent?.full_name || 'غير معروف';
  };

  // معالجة النقر على عميل
  const handleClientClick = (client: ClientType) => {
    setSelectedClient(client);
    setDateInputValue(formatDateForDisplay(client.subscription_start));
    setShowClientDetails(true);
    setIsEditing(false);
  };

  // معالجة التعديل
  const handleEdit = () => {
    setIsEditing(true);
  };

  // معالجة تأكيد الحذف
  const handleConfirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  // معالجة إغلاق التفاصيل
  const handleCloseDetails = () => {
    setShowClientDetails(false);
    setIsEditing(false);
    setSelectedClient(null);
    setShowDeleteConfirm(false);
  };

  // معالجة تغيير البيانات
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (selectedClient) {
      setSelectedClient((prev) => ({ ...prev!, [name]: value }));
    }
  };

  // معالجة تغيير نوع النسخة
  const handleVersionChange = (value: string) => {
    if (selectedClient) {
      setSelectedClient((prev) => ({ ...prev!, software_version: value }));
    }
  };

  // معالجة إدخال التاريخ
  const handleDateInput = (value: string) => {
    setDateInputValue(value);
    
    // تنسيق إدخال التاريخ تلقائيًا
    let cleanValue = value.replace(/[^ -]/g, '');
    
    if (cleanValue.length === 2 && !cleanValue.includes('/')) {
      cleanValue = cleanValue + '/';
    } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
      cleanValue = cleanValue + '/';
    }
    
    cleanValue = cleanValue.slice(0, 10);
    setDateInputValue(cleanValue);
    
    // معالجة التاريخ عند إدخال تاريخ كامل
    if (cleanValue.length === 10 && selectedClient) {
      const [day, month, year] = cleanValue.split('/');
      try {
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        if (!isNaN(date.getTime())) {
          const formattedDate = format(date, 'yyyy-MM-dd');
          
          setSelectedClient((prev) => ({
            ...prev!,
            subscription_start: formattedDate,
            subscription_end: calculateEndDate(date, prev!.subscription_type)
          }));
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }
  };

  // حفظ التغييرات
  const handleSaveChanges = async () => {
    if (!selectedClient) return;
    
    try {
      // التحقق من البيانات المطلوبة
      if (!selectedClient.client_name || !selectedClient.organization_name || !selectedClient.phone) {
        toast.error(t('messages.requiredFieldsMissing', 'يرجى ملء جميع الحقول المطلوبة'));
        return;
      }
      
      const { error } = await supabase
        .from('clients')
        .update({
          client_name: selectedClient.client_name,
          organization_name: selectedClient.organization_name,
          activity_type: selectedClient.activity_type,
          phone: selectedClient.phone,
          activation_code: selectedClient.activation_code,
          subscription_type: selectedClient.subscription_type,
          address: selectedClient.address,
          device_count: selectedClient.device_count,
          software_version: selectedClient.software_version,
          subscription_start: selectedClient.subscription_start,
          subscription_end: selectedClient.subscription_end,
          notes: selectedClient.notes
        })
        .eq('id', selectedClient.id);
      
      if (error) throw error;
      
      toast.success(t('messages.clientUpdatedSuccess', 'تم تحديث بيانات العميل بنجاح'));
      setIsEditing(false);
      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(t('messages.errorOccurred', 'حدث خطأ أثناء تحديث البيانات، يرجى المحاولة مرة أخرى'));
    }
  };

  // حذف العميل
  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', selectedClient.id);
      
      if (error) throw error;
      
      toast.success(t('messages.clientDeletedSuccess', 'تم حذف العميل بنجاح'));
      setShowDeleteConfirm(false);
      setShowClientDetails(false);
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(t('messages.errorOccurred', 'حدث خطأ أثناء حذف العميل، يرجى المحاولة مرة أخرى'));
    }
  };

  // الحصول على تسمية نوع الاشتراك
  const getSubscriptionTypeLabel = (value: string) => {
    const subscriptionType = SUBSCRIPTION_TYPES.find(type => type.value === value);
    return i18n.language === 'en' ? subscriptionType?.labelEn : subscriptionType?.label;
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg max-w-7xl mx-auto">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          {t('nav.clients', 'العملاء')}
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder={t('actions.search', 'بحث...') as string}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
              isRTL ? 'text-right' : 'text-left'
            }`}
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                scope="col"
                className={`px-6 py-3 text-xs font-medium tracking-wider ${
                  isRTL ? 'text-right' : 'text-left'
                } text-gray-500 dark:text-gray-300 uppercase`}
              >
                {t('client.name', 'اسم العميل')}
              </th>
              <th
                scope="col"
                className={`px-6 py-3 text-xs font-medium tracking-wider ${
                  isRTL ? 'text-right' : 'text-left'
                } text-gray-500 dark:text-gray-300 uppercase`}
              >
                {t('client.phone', 'رقم الهاتف')}
              </th>
              <th
                scope="col"
                className={`px-6 py-3 text-xs font-medium tracking-wider ${
                  isRTL ? 'text-right' : 'text-left'
                } text-gray-500 dark:text-gray-300 uppercase`}
              >
                {t('client.subscriptionType', 'نوع الاشتراك')}
              </th>
              <th
                scope="col"
                className={`px-6 py-3 text-xs font-medium tracking-wider ${
                  isRTL ? 'text-right' : 'text-left'
                } text-gray-500 dark:text-gray-300 uppercase`}
              >
                {t('client.agent', 'المندوب')}
              </th>
              <th
                scope="col"
                className={`px-6 py-3 text-xs font-medium tracking-wider ${
                  isRTL ? 'text-right' : 'text-left'
                } text-gray-500 dark:text-gray-300 uppercase`}
              >
                {t('client.subscriptionDates', 'مدة الاشتراك')}
              </th>
              <th
                scope="col"
                className={`px-6 py-3 text-xs font-medium tracking-wider ${
                  isRTL ? 'text-right' : 'text-left'
                } text-gray-500 dark:text-gray-300 uppercase`}
              >
                {t('client.subscriptionStatus', 'حالة الاشتراك')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('common.loading', 'جاري التحميل...')}
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('messages.noClientsFound', 'لا يوجد عملاء مطابقين للبحث')}
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => handleClientClick(client)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`${isRTL ? 'mr-0 ml-3' : 'ml-0 mr-3'} flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center`}>
                        <span className="text-primary-600 dark:text-primary-300 font-semibold text-lg">
                          {client.client_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {client.client_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {client.organization_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Phone className={`h-4 w-4 text-gray-400 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      <span className="text-sm text-gray-900 dark:text-white">{client.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300">
                      {getSubscriptionTypeLabel(client.subscription_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className={`h-4 w-4 text-gray-400 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {displayAgentName(client.agent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className={`h-4 w-4 text-gray-400 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {`${formatDateForDisplay(client.subscription_start)} - ${formatDateForDisplay(client.subscription_end)}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300">
                      {isSubscriptionActive(client.subscription_end) ? t('client.subscriptionActive', 'نشط') : t('client.subscriptionExpired', 'منتهي')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة تفاصيل العميل */}
      {selectedClient && (
        <Dialog open={showClientDetails} onOpenChange={handleCloseDetails}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('client.details', 'تفاصيل العميل')}</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <CustomerField label={t('client.name', 'اسم العميل')} value={selectedClient?.client_name || ''} readOnly />
              <CustomerField label={t('client.organization', 'اسم المنظمة')} value={selectedClient?.organization_name || ''} readOnly />
              <CustomerField label={t('client.phone', 'رقم الهاتف')} value={selectedClient?.phone || ''} readOnly />
              <CustomerField label={t('client.subscriptionType', 'نوع الاشتراك')} value={selectedClient?.subscription_type || ''} readOnly />
              <CustomerField label={t('client.subscriptionStart', 'بداية الاشتراك')} value={formatDateForDisplay(selectedClient?.subscription_start)} readOnly />
              <CustomerField label={t('client.subscriptionEnd', 'نهاية الاشتراك')} value={formatDateForDisplay(selectedClient?.subscription_end)} readOnly />
              <CustomerField label={t('client.agent', 'المندوب')} value={displayAgentName(selectedClient?.agent)} readOnly />
              <CustomerTextArea label={t('client.notes', 'ملاحظات')} value={selectedClient?.notes || ''} readOnly />
            </div>
            <DialogFooter>
              <Button type="button" className="mr-2" onClick={handleEdit}>{t('common.edit', 'تعديل')}</Button>
              <Button type="button" variant="destructive" onClick={handleConfirmDelete}>{t('common.delete', 'حذف')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* نافذة تأكيد الحذف */}
      {selectedClient && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t('dialogs.confirmDelete', 'تأكيد الحذف')}
              </DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};