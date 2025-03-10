import React, { useState, useEffect, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Search, Phone, Calendar, X, User, Edit, Trash2 } from 'lucide-react';
import Dialog, { DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/Dialog';
import Button from '../components/ui/Button';
import CustomerInput from '../components/CustomerInput';
import CustomerTextArea from '../components/CustomerTextArea';
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
  const [showClientDetails, setShowClientDetails] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('client_name', { ascending: true });
      if (error) throw error;
      setClients(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error(t('messages.errorFetchingClients', 'حدث خطأ أثناء تحميل بيانات العملاء'));
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, email, name');
      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error(t('messages.errorFetchingAgents', 'حدث خطأ أثناء تحميل بيانات المندوبين'));
    }
  };

  useEffect(() => {
    fetchClients();
    fetchAgents();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSelectedClient((prev) => ({ ...prev!, [name]: value }));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleConfirmDelete = () => {
    // يمكن تنفيذ منطق تأكيد الحذف هنا
    setShowDeleteConfirm(true);
  };

  const handleCloseDetails = () => {
    setShowClientDetails(false);
    setIsEditing(false);
    setSelectedClient(null);
    setShowDeleteConfirm(false);
  };

  const handleSaveChanges = async () => {
    if (!selectedClient) return;

    try {
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

  const handleDeleteClient = async (clientId: string) => {
    if (!clientId) return;
    
    try {
      // TODO: API call to delete client
      console.log('Deleting client:', clientId);
      
      // Remove client from state
      setClients(clients.filter(c => c.id !== clientId));
      setShowDeleteConfirm(false);
      setSelectedClient(null);
      
      toast.success(t('messages.clientDeleted', 'تم حذف العميل بنجاح'));
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(t('messages.deleteError', 'حدث خطأ أثناء حذف العميل'));
    }
  };

  const handleEditClient = (client: ClientType) => {
    setSelectedClient(client);
    setShowClientDetails(true);
    setIsEditing(true);
  };

  const getSubscriptionTypeLabel = (value: string) => {
    const subscriptionType = SUBSCRIPTION_TYPES.find((type) => type.value === value);
    return i18n.language === 'en' ? subscriptionType?.labelEn : subscriptionType?.label;
  };

  const formatDateForDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  const handleSetShowClientDetails = (client: ClientType) => {
    setSelectedClient(client);
    setShowClientDetails(true);
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
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
                {t('client.actions', 'إجراءات')}
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
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
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
                        {client.agent?.name || t('client.unknownAgent', 'غير معروف')}
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
                    <div className="flex space-x-2">
                      <Button onClick={() => handleSetShowClientDetails(client)}>
                        <User className="h-4 w-4 mr-2" />
                        {t('actions.viewDetails', 'عرض التفاصيل')}
                      </Button>
                      <Button onClick={() => {
                        setSelectedClient(client);
                        handleConfirmDelete();
                      }} variant="danger">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('actions.delete', 'حذف')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedClient && (
        <Dialog open={showClientDetails} onOpenChange={setShowClientDetails}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {isEditing
                 ? t('dialogs.editClient', 'تعديل بيانات العميل')
                  : t('dialogs.clientDetails', 'تفاصيل العميل')}
                  <button
                  onClick={handleCloseDetails}
                  className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                >              
                  <X className="h-5 w-5" />
                </button>
              </DialogTitle>
              
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">        
              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.name', 'اسم العميل')}</label>
                <CustomerInput
                  name="client_name"
                  value={selectedClient.client_name}
                  onChange={handleChange}
                  isEditing={isEditing}
                  placeholder={t('client.namePlaceholder', 'أدخل اسم العميل') as string}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.organization', 'اسم المؤسسة')}</label>
                <CustomerInput
                  name="organization_name"
                  value={selectedClient.organization_name}
                  onChange={handleChange}
                  isEditing={isEditing}
                  placeholder={t('client.organizationPlaceholder', 'أدخل اسم المؤسسة') as string}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.activityType', 'نوع النشاط')}</label>
                <CustomerInput
                  name="activity_type"
                  value={selectedClient.activity_type}
                  onChange={handleChange}
                  isEditing={isEditing}
                  placeholder={t('client.activityTypePlaceholder', 'أدخل نوع النشاط') as string}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.phone', 'رقم الهاتف')}</label>
                <CustomerInput
                  name="phone"
                  value={selectedClient.phone}
                  onChange={handleChange}
                  isEditing={isEditing}
                  placeholder={t('client.phonePlaceholder', 'أدخل رقم الهاتف') as string}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.activationCode', 'كود التفعيل')}</label>
                <CustomerInput
                  name="activation_code"
                  value={selectedClient.activation_code}
                  onChange={handleChange}
                  isEditing={isEditing}
                  placeholder={t('client.activationCodePlaceholder', 'أدخل كود التفعيل') as string}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.subscriptionType', 'نوع الاشتراك')}</label>
                <select
                  name="subscription_type"
                  value={selectedClient.subscription_type}
                  onChange={handleChange}
                  className={`block w-full py-2 pl-10 pr-4 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                    isEditing ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                >
                  {SUBSCRIPTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {i18n.language === 'en' ? type.labelEn : type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.address', 'العنوان')}</label>
                <CustomerInput
                  name="address"
                  value={selectedClient.address}
                  onChange={handleChange}
                  isEditing={isEditing}
                  placeholder={t('client.addressPlaceholder', 'أدخل العنوان') as string}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.deviceCount', 'عدد الأجهزة')}</label>
                <CustomerInput
                  type="number"
                  name="device_count"
                  value={selectedClient.device_count.toString()}
                  onChange={handleChange}
                  isEditing={isEditing}
                  min="1"
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.softwareVersion', 'نوع النسخة')}</label>
                <select
                  name="software_version"
                  value={selectedClient.software_version}
                  onChange={handleChange}
                  className={`block w-full py-2 pl-10 pr-4 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                    isEditing ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                >
                  {VERSION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {i18n.language === 'en' ? type.labelEn : type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.subscriptionStart', 'تاريخ بداية الاشتراك')}</label>
                <CustomerInput
                  type="date"
                  name="subscription_start"
                  value={selectedClient.subscription_start}
                  onChange={handleChange}
                  isEditing={isEditing}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.subscriptionEnd', 'تاريخ نهاية الاشتراك')}</label>
                <CustomerInput
                  type="date"
                  name="subscription_end"
                  value={selectedClient.subscription_end}
                  onChange={handleChange}
                  isEditing={isEditing}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.notes', 'ملاحظات')}</label>
                <CustomerTextArea
                  name="notes"
                  value={selectedClient.notes || ''}
                  onChange={handleChange}
                  isEditing={isEditing}
                  placeholder={t('client.notesPlaceholder', 'أدخل ملاحظات إضافية') as string}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('client.agent', 'المندوب')}</label>
                <select
                  name="agent_id"
                  value={selectedClient.agent_id || ''}
                  onChange={handleChange}
                  className={`block w-full py-2 pl-10 pr-4 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                    isEditing ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                >
                  <option value="">{t('client.selectAgent', 'اختر المندوب')}</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <DialogFooter>
              {isEditing ? (
                <>
                  <Button onClick={handleSaveChanges} className="bg-primary-600 hover:bg-primary-700 text-white">
                    <Edit className="h-4 w-4 mr-2" />
                    {t('actions.save', 'حفظ')}
                  </Button>
                  <Button onClick={() => setIsEditing(false)} variant="secondary">
                    {t('actions.cancel', 'إلغاء')}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleEdit} className="bg-primary-600 hover:bg-primary-700 text-white">
                    <Edit className="h-4 w-4 mr-2" />
                    {t('actions.edit', 'تعديل')}
                  </Button>
                  <Button onClick={() => {
                    setSelectedClient(selectedClient);
                    handleConfirmDelete();
                  }} variant="danger">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('actions.delete', 'حذف')}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
          )}
      
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
           <DialogHeader><DialogTitle>{t('dialogs.confirmDelete', 'تأكيد الحذف')}</DialogTitle></DialogHeader>
          <div className="p-4">
            <p className="text-gray-700 dark:text-gray-300">
              {t('dialogs.confirmDeleteMessage', 'هل أنت متأكد من رغبتك في حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.')}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDeleteConfirm(false)} variant="secondary">
              <X className="h-4 w-4 mr-2" />
              {t('actions.cancel', 'إلغاء')}
            </Button>
            <Button variant="danger" onClick={() => {
              if (selectedClient && selectedClient.id) {
                handleDeleteClient(selectedClient.id);
              }
            }}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('actions.confirmDelete', 'تأكيد الحذف')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
};