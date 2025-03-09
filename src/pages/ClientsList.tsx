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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('common.loading', 'جاري التحميل...')}
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
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
                        {client.agent?.full_name || t('common.unknown', 'غير معروف')}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة تفاصيل العميل */}
      {selectedClient && (
        <Dialog open={showClientDetails} onOpenChange={setShowClientDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center">
                <span>{isEditing ? t('actions.editClient', 'تعديل العميل') : t('actions.clientDetails', 'تفاصيل العميل')}</span>
                <button
                  onClick={handleCloseDetails}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* اسم العميل */}
              <CustomerField label={t('client.name', 'اسم العميل')} children={
                <CustomerInput
                  type="text"
                  name="client_name"
                  required
                  value={selectedClient.client_name}
                  onChange={handleChange}
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* اسم المؤسسة */}
              <CustomerField label={t('client.organization', 'اسم المؤسسة')} children={
                <CustomerInput
                  type="text"
                  name="organization_name"
                  required
                  value={selectedClient.organization_name}
                  onChange={handleChange}
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* نوع النشاط */}
              <CustomerField label={t('client.activity', 'نوع النشاط')} children={
                <CustomerInput
                  type="text"
                  name="activity_type"
                  required
                  value={selectedClient.activity_type}
                  onChange={handleChange}
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* رقم الهاتف */}
              <CustomerField label={t('client.phone', 'رقم الهاتف')} children={
                <CustomerInput
                  type="tel"
                  name="phone"
                  required
                  value={selectedClient.phone}
                  onChange={handleChange}
                  isEditing={isEditing}
                  dir="ltr"
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* العنوان */}
              <CustomerField label={t('client.address', 'العنوان')} children={
                <CustomerInput
                  type="text"
                  name="address"
                  required
                  value={selectedClient.address}
                  onChange={handleChange}
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* رمز التفعيل */}
              <CustomerField label={t('client.activationCode', 'رمز التفعيل')} children={
                <CustomerInput
                  type="text"
                  name="activation_code"
                  required
                  value={selectedClient.activation_code}
                  onChange={handleChange}
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* نوع الاشتراك */}
              <CustomerField label={t('client.subscriptionType', 'نوع الاشتراك')} children={
                <CustomerSelect
                  name="subscription_type"
                  value={selectedClient.subscription_type}
                  onChange={handleChange}
                  required
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                  children={
                    SUBSCRIPTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {i18n.language === 'en' ? type.labelEn : type.label}
                      </option>
                    ))
                  }
                />
              } />

              {/* نوع النسخة */}
              <CustomerField label={t('client.softwareVersion', 'نوع النسخة')} children={
                isEditing ? (
                  <div className="flex gap-2">
                    {VERSION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={`flex-1 h-10 flex items-center justify-center rounded-md border ${
                          selectedClient.software_version === type.value
                            ? 'bg-primary-100 border-primary-500 text-primary-700 dark:bg-primary-900 dark:border-primary-400 dark:text-primary-300'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                        onClick={() => handleVersionChange(type.value)}
                      >
                        <span className={isRTL ? 'mr-2' : 'ml-2'}>
                          {i18n.language === 'en' ? type.labelEn : type.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <CustomerInput
                    type="text"
                    value={i18n.language === 'en' 
                      ? VERSION_TYPES.find(t => t.value === selectedClient.software_version)?.labelEn || ''
                      : VERSION_TYPES.find(t => t.value === selectedClient.software_version)?.label || ''}
                    isEditing={false}
                    readOnly
                    className="text-lg border-gray-300 dark:border-gray-600"
                  />
                )
              } />

              {/* عدد الأجهزة */}
              <CustomerField label={t('client.deviceCount', 'عدد الأجهزة')} children={
                <CustomerInput
                  type="number"
                  name="device_count"
                  required
                  min="1"
                  value={String(selectedClient.device_count)}
                  onChange={handleChange}
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* تاريخ بداية الاشتراك */}
              <CustomerField label={t('client.subscriptionStart', 'تاريخ بداية الاشتراك')} children={
                isEditing ? (
                  <CustomerInput
                    type="text"
                    name="subscription_start_display"
                    required
                    value={dateInputValue}
                    onChange={(e) => handleDateInput(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    isEditing={true}
                    className="text-lg border-gray-300 dark:border-gray-600"
                  />
                ) : (
                  <CustomerInput
                    type="text"
                    value={formatDateForDisplay(selectedClient.subscription_start)}
                    isEditing={false}
                    readOnly
                    className="text-lg border-gray-300 dark:border-gray-600"
                  />
                )
              } />

              {/* تاريخ نهاية الاشتراك */}
              <CustomerField label={t('client.subscriptionEnd', 'تاريخ نهاية الاشتراك')} children={
                <CustomerInput
                  type="text"
                  value={formatDateForDisplay(selectedClient.subscription_end)}
                  isEditing={false}
                  readOnly
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />

              {/* ملاحظات */}
              <CustomerField label={t('client.notes', 'ملاحظات')} className="md:col-span-2" children={
                <CustomerTextArea
                  name="notes"
                  value={selectedClient.notes || ''}
                  onChange={handleChange}
                  rows={4}
                  isEditing={isEditing}
                  className="text-lg border-gray-300 dark:border-gray-600"
                />
              } />
            </div>

            <DialogFooter className="mt-6 flex justify-between md:justify-end gap-2">
              {isEditing ? (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditing(false)}
                    className="bg-white hover:bg-gray-100 text-gray-800"
                  >
                    {t('actions.cancel', 'إلغاء')}
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleSaveChanges}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {t('actions.save', 'حفظ')}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleEdit}
                    className="bg-white hover:bg-gray-100 text-gray-800"
                  >
                    <Edit className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('actions.edit', 'تعديل')}
                  </Button>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={handleConfirmDelete}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('actions.delete', 'حذف')}
                  </Button>
                </>
              )}
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