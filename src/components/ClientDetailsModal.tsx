import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  X, Edit, Save, Trash2, Ban, AlertTriangle, ChevronDown, ChevronUp,
  Plus, Clipboard, Calendar, Smartphone, Laptop, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { ClientType, Agent, SubscriptionType, VersionType } from '../types/client.types';
import CustomerField from './CustomerField';
import CustomerInput from './CustomerInput';
import CustomerTextArea from './CustomerTextArea';
import DeviceModal from './DeviceModal';
import { DeviceType, DEVICE_TYPES, APPROVAL_STATUS } from '../types/device.types';

interface ClientDetailsModalProps {
  client: ClientType | null;
  agents: Agent[];
  subscriptionTypes: SubscriptionType[];
  versionTypes: VersionType[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedClient: ClientType) => Promise<void>;
  onDelete: (clientId: string) => Promise<void>;
  // إضافة معلومات المستخدم الحالي
  currentUser?: {
    id: string;
    role: string;
  } | null;
}

export default function ClientDetailsModal({
  client,
  agents,
  versionTypes,
  isOpen,
  onClose,
  onSave,
  onDelete,
  currentUser
}: ClientDetailsModalProps) {
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ClientType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [devices, setDevices] = useState<DeviceType[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [showDevicesSection, setShowDevicesSection] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceType | null>(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [localAgents, setLocalAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);

  useEffect(() => {
    if (client && isOpen) {
      console.log("Client data received:", client); // إضافة سجل للتحقق من بيانات العميل
      setFormData({ ...client }); 
      setIsEditing(false); 
      setShowDeleteConfirm(false);
      setIsSaving(false);
      setIsDeleting(false);
      fetchDevices(client.id);
      
      // جلب اسم المندوب مباشرة من قاعدة البيانات
      if (client.agent_id) {
        fetchAgentName(client.agent_id);
      } else {
        setAgentName(null);
      }
      
      // جلب قائمة المندوبين
      fetchAgents();
      
      // طباعة معلومات المندوبين للتشخيص
      console.log("Agents from props:", agents);
    } else if (!isOpen) {
      setTimeout(() => {
        setFormData(null);
        setIsEditing(false);
        setShowDeleteConfirm(false);
        setDevices([]);
        setAgentName(null);
      }, 200); 
    }
  }, [client, isOpen]);

  // دالة جديدة لجلب قائمة المندوبين
  const fetchAgents = async () => {
    setIsLoadingAgents(true);
    try {
      // تعديل الاستعلام لتجنب الخطأ - إزالة عمود is_active غير الموجود
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, email, role')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching agents:', error);
        return;
      }

      if (data) {
        console.log('Agents fetched directly:', data);
        setLocalAgents(data as Agent[]);
      }
    } catch (error) {
      console.error('Exception fetching agents:', error);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  // دالة جديدة لجلب اسم المندوب من قاعدة البيانات
  const fetchAgentName = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('name, email')
        .eq('id', agentId)
        .single();

      if (error) {
        console.error('Error fetching agent:', error);
        setAgentName(null);
        return;
      }

      if (data) {
        console.log('Agent data fetched:', data);
        setAgentName(data.name || data.email || null);
      } else {
        setAgentName(null);
      }
    } catch (error) {
      console.error('Exception fetching agent:', error);
      setAgentName(null);
    }
  };

  // جلب أجهزة العميل
  const fetchDevices = async (clientId?: string) => {
    if (!clientId) return;
    
    setIsLoadingDevices(true);
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // إضافة حالة الموافقة الافتراضية للأجهزة القديمة
      const devicesWithStatus = (data || []).map(device => ({
        ...device,
        approval_status: device.approval_status || 'approved' // الأجهزة القديمة تكون معتمدة افتراضيًا
      }));
      
      setDevices(devicesWithStatus);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error(t('messages.errorFetchingDevices', 'حدث خطأ أثناء جلب بيانات الأجهزة'));
    } finally {
      setIsLoadingDevices(false);
    }
  };
  
  const handleAddDevice = () => {
    setSelectedDevice(null);
    setShowDeviceModal(true);
  };

  const handleEditDevice = (device: DeviceType) => {
    setSelectedDevice(device);
    setShowDeviceModal(true);
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm(t('device.confirmDelete', 'هل أنت متأكد من رغبتك في حذف هذا الجهاز؟'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast.success(t('messages.deviceDeleted', 'تم حذف الجهاز بنجاح'));
      fetchDevices(client?.id);
    } catch (error) {
      console.error('Error deleting device:', error);
      toast.error(t('messages.errorDeletingDevice', 'حدث خطأ أثناء حذف الجهاز'));
    }
  };

  const handleSaveDevice = async (deviceData: DeviceType) => {
    try {
      if (selectedDevice?.id) {
        // تحديث جهاز موجود
        const { error } = await supabase
          .from('devices')
          .update(deviceData)
          .eq('id', selectedDevice.id);

        if (error) throw error;
        toast.success(t('messages.deviceUpdated', 'تم تحديث بيانات الجهاز بنجاح'));
      } else {
        // إضافة جهاز جديد
        const { error } = await supabase
          .from('devices')
          .insert([deviceData]);

        if (error) throw error;
        toast.success(t('messages.deviceAdded', 'تم إضافة الجهاز بنجاح'));
      }

      fetchDevices(client?.id);
      setShowDeviceModal(false);
    } catch (error) {
      console.error('Error saving device:', error);
      toast.error(t('messages.errorSavingDevice', 'حدث خطأ أثناء حفظ بيانات الجهاز'));
    }
  };
  
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch (error) {
      return dateStr;
    }
  };

  const copyActivationCode = (code: string) => {
    try {
      // إنشاء عنصر نصي مؤقت
      const textArea = document.createElement('textarea');
      textArea.value = code;
      
      // تعيين خصائص لإخفاء العنصر
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      
      // إضافة العنصر للصفحة
      document.body.appendChild(textArea);
      
      // تحديد النص
      textArea.select();
      
      // نسخ النص
      const successful = document.execCommand('copy');
      
      // إزالة العنصر المؤقت
      document.body.removeChild(textArea);
      
      if (successful) {
        toast.success(t('messages.codeCopied', 'تم نسخ رمز التفعيل'));
      } else {
        toast.error(t('messages.copyFailed', 'فشل نسخ الرمز'));
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error(t('messages.copyFailed', 'فشل نسخ الرمز'));
    }
  };

  const getDeviceTypeLabel = (value: string) => {
    const deviceType = DEVICE_TYPES.find(type => type.value === value);
    return deviceType ? (i18n.language === 'ar' ? deviceType.label : deviceType.labelEn) : value;
  };

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

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'computer') {
      return <Laptop className="h-5 w-5 text-blue-500" />;
    } else {
      return <Smartphone className="h-5 w-5 text-green-500" />;
    }
  };

  // دالة للحصول على أيقونة حالة الموافقة
  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />;
      case 'pending':
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />;
    }
  };

  // دالة للحصول على نص حالة الموافقة
  const getApprovalStatusLabel = (status: string) => {
    const statusItem = APPROVAL_STATUS.find(item => item.value === status);
    return statusItem ? (i18n.dir() === 'rtl' ? statusItem.label : statusItem.labelEn) : (i18n.dir() === 'rtl' ? 'قيد المراجعة' : 'Pending');
  };

  // دالة للحصول على لون خلفية حالة الموافقة
  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const isSubscriptionExpired = (endDate: string) => {
    try {
      return new Date(endDate) < new Date();
    } catch (error) {
      return false;
    }
  };

  // تم حذف هذه الوظيفة لأنها مكررة

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: ClientType | null) => prev ? { ...prev, [name]: value } : null);
  };

  // handleDateChange удален, так как больше не используется

  // دالة لحفظ التغييرات
  const handleSaveClick = async () => {
    if (!formData || !client) return;
    
    setIsSaving(true);
    try {
      // تحويل البيانات إلى الشكل المناسب لقاعدة البيانات
      await onSave(formData);
      
      // تحديث اسم المندوب المعروض بعد الحفظ
      if (formData.agent_id) {
        fetchAgentName(formData.agent_id);
      } else {
        setAgentName(null);
      }
      
      setIsEditing(false);
      toast.success(t('messages.clientUpdated', 'تم تحديث بيانات العميل بنجاح'));
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error(t('messages.errorSavingClient', 'حدث خطأ أثناء حفظ بيانات العميل'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (client) {
      setFormData({ ...client }); 
    }
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!client?.id) return;
    setIsDeleting(true);
    try {
      await onDelete(client.id);
      setShowDeleteConfirm(false);
      onClose(); 
    } catch (error) {
      console.error("Error deleting client:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // هذه الوظائف غير مستخدمة حالياً ويمكن إعادة تفعيلها عند الحاجة

  if (!isOpen && !formData) return null; 
  if (!client && !formData) return null; 

  const displayClient = isEditing ? formData : client; 

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 dark:bg-black/70 z-50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} 
      />

      <div
        className={`fixed inset-0 flex items-center justify-center p-4 z-[60] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('clientDetails.title', 'تفاصيل العميل')}
            </h3>
            <button
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-grow">
            {displayClient ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* اسم العميل */}
                <CustomerField label={t('client.name', 'اسم العميل')} children={
                  <CustomerInput
                    type="text"
                    name="client_name"
                    value={formData?.client_name || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-12 text-lg border-gray-300 dark:border-gray-600"
                  />
                } />

                {/* اسم المؤسسة */}
                <CustomerField label={t('client.organization', 'اسم المؤسسة')} children={
                  <CustomerInput
                    type="text"
                    name="organization_name"
                    value={formData?.organization_name || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-12 text-lg border-gray-300 dark:border-gray-600"
                  />
                } />

                {/* نوع النشاط */}
                <CustomerField label={t('client.activityType', 'نوع النشاط')} children={
                  <CustomerInput
                    type="text"
                    name="activity_type"
                    value={formData?.activity_type || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-12 text-lg border-gray-300 dark:border-gray-600"
                  />
                } />
                
                {/* العنوان */}
                <CustomerField label={t('client.address', 'العنوان')} children={
                  <CustomerInput
                    type="text"
                    name="address"
                    value={formData?.address || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-12 text-lg border-gray-300 dark:border-gray-600"
                  />
                } />

                {/* رقم الهاتف */}
                <CustomerField label={t('client.phone', 'رقم الهاتف')} children={
                  <CustomerInput
                    type="tel"
                    name="phone"
                    value={formData?.phone || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    dir="ltr"
                    className="h-12 text-lg border-gray-300 dark:border-gray-600"
                  />
                } />
                
                {/* رقم الهاتف 2 */}
                <CustomerField label={t('client.phone2', 'رقم الهاتف 2')} children={
                  <CustomerInput
                    type="tel"
                    name="phone2"
                    value={formData?.phone2 || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    dir="ltr"
                    className="h-12 text-lg border-gray-300 dark:border-gray-600"
                  />
                } />

                {/* تمت إزالة العناصر القديمة (كود التفعيل، نوع الاشتراك، نوع النسخة، تواريخ الاشتراك) لأنها أصبحت موجودة في قسم الأجهزة */}

                {/* ملاحظات */}
                <CustomerField label={t('client.notes', 'ملاحظات')} className="md:col-span-2" children={
                  <CustomerTextArea
                    name="notes"
                    value={formData?.notes || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    rows={4}
                    className="text-lg border-gray-300 dark:border-gray-600"
                  />
                } />
              </div>
            ) : (
              <div className="text-center py-4">
                <p>{t('clientDetails.loading', 'جار تحميل بيانات العميل...')}</p>
              </div>
            )}
          </div>
          
          {/* قسم الأجهزة */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowDevicesSection(!showDevicesSection)}
              className="flex items-center justify-between w-full p-5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
                {t('device.devicesSection', 'الأجهزة والاشتراكات')}
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({devices.length})
                </span>
              </h3>
              {showDevicesSection ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>
            
            {showDevicesSection && (
              <div className="p-5">
                {isLoadingDevices ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
                  </div>
                ) : devices.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t('device.deviceType', 'نوع الجهاز')}
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t('device.activationCode', 'رمز التفعيل')}
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t('device.subscriptionType', 'نوع الاشتراك')}
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t('device.subscriptionEnd', 'نهاية الاشتراك')}
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t('device.approvalStatus', 'حالة الموافقة')}
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t('common.actions', 'الإجراءات')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {devices.map((device) => (
                          <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {getDeviceIcon(device.device_type)}
                                <span className="mr-2">{getDeviceTypeLabel(device.device_type)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap" style={{ maxWidth: '200px' }}>
                              <div className="flex items-center">
                                <span className="font-mono text-sm truncate" style={{ maxWidth: '160px' }} title={device.activation_code}>
                                  {device.activation_code}
                                </span>
                                <button
                                  onClick={() => copyActivationCode(device.activation_code)}
                                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-0 ml-2"
                                  title={t('common.copy', 'نسخ')}
                                >
                                  <Clipboard className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                {getSubscriptionTypeLabel(device.subscription_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 ml-2" />
                                {device.subscription_type === 'permanent' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    {t('client.permanent', 'دائم')}
                                  </span>
                                ) : (
                                  <span className={isSubscriptionExpired(device.subscription_end) ? 'text-red-500 font-semibold' : ''}>
                                    {formatDate(device.subscription_end)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {getApprovalStatusIcon(device.approval_status || 'pending')}
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${getApprovalStatusColor(device.approval_status || 'pending')}`}>
                                  {getApprovalStatusLabel(device.approval_status || 'pending')}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center space-x-2 rtl:space-x-reverse">
                                {currentUser?.role === 'admin' && (
                                  <>
                                    <button
                                      onClick={() => handleEditDevice(device)}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                    >
                                      <Edit className="h-5 w-5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDevice(device.id!)}
                                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                    >
                                      <Trash2 className="h-5 w-5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    {t('device.noDevices', 'لا توجد أجهزة مسجلة لهذا العميل')}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button
                    variant="primary"
                    onClick={handleAddDevice}
                    className="flex items-center gap-2 px-5 py-2.5"
                  >
                    <Plus className="w-5 h-5" />
                    <span>{t('device.addDevice', 'إضافة جهاز جديد')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            
            {/* حقل المندوب */}
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('client.agent', 'المندوب')}
              </label>
              
              {isEditing && currentUser?.role === 'admin' ? (
                /* حالة التعديل - يظهر قائمة منسدلة للمندوبين */
                <>
                  {isLoadingAgents ? (
                    <div className="mt-1 block w-full rounded-md shadow-sm bg-gray-100 border-2 border-gray-300 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 px-3 py-2 h-12 text-lg flex items-center">
                      جاري تحميل المندوبين...
                    </div>
                  ) : (
                    <select
                      name="agent_id"
                      value={formData?.agent_id || ''}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        handleInputChange(e);
                        // عرض قيمة المندوب المختار للتشخيص
                        console.log("Selected agent ID:", e.target.value);
                      }}
                      className="mt-1 block w-full rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white border-2 border-blue-200 dark:bg-gray-700 dark:border-blue-700 dark:text-white h-12 text-lg"
                    >
                      <option value="">{t('client.noAgent', 'بدون مندوب')}</option>
                      {localAgents && localAgents.length > 0 ? (
                        localAgents.map(agent => (
                          <option 
                            key={agent.id} 
                            value={agent.id}
                          >
                            {agent.name || agent.email || agent.id}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>لا يوجد مندوبين متاحين</option>
                      )}
                    </select>
                  )}
                </>
              ) : (
                /* حالة العرض - يظهر اسم المندوب الحالي */
                <div className="mt-1 block w-full rounded-md shadow-sm bg-gray-100 border-2 border-gray-300 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 px-3 py-2 h-12 text-lg flex items-center">
                  {agentName || t('client.noAgent', 'بدون مندوب')}
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-5 py-2.5"
                    disabled={isSaving}
                  >
                    <Ban className="w-5 h-5" />
                    <span>{t('actions.cancel', 'إلغاء')}</span>
                  </Button>
                  <Button
                    variant="primary" 
                    onClick={handleSaveClick}
                    className="flex items-center gap-2 px-5 py-2.5"
                    disabled={isSaving}
                  >
                    <Save className="w-5 h-5" />
                    <span>{isSaving ? t('actions.saving', 'جار الحفظ...') : t('actions.save', 'حفظ')}</span>
                  </Button>
                </>
              ) : (
                <>
                  {/* عرض أزرار التعديل والحذف للمديرين فقط */}
                  {currentUser?.role === 'admin' && (
                    <>
                      <Button
                        variant="danger" 
                        onClick={handleDeleteClick}
                        className="flex items-center gap-2 px-5 py-2.5"
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-5 h-5" />
                        <span>{t('actions.delete', 'حذف')}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-5 py-2.5"
                        disabled={isDeleting}
                      >
                        <Edit className="w-5 h-5" />
                        <span>{t('actions.edit', 'تعديل')}</span>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {showDeleteConfirm && (
            <>
              <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[70] transition-opacity duration-150" onClick={() => setShowDeleteConfirm(false)} />
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-xl p-6 space-y-5 shadow-2xl bg-white dark:bg-gray-800 z-[80]">
                <div className="flex items-center gap-4">
                  <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                    <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t('deleteConfirmation.title', 'تأكيد الحذف')}
                  </h4>
                </div>
                <p className="text-base text-gray-600 dark:text-gray-300">
                  هل أنت متأكد من رغبتك في حذف العميل "{client?.client_name}"؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
                <div className="flex justify-end gap-3 pt-5 border-t border-gray-200 dark:border-gray-700">
                  <Button 
                    variant="secondary" 
                    onClick={() => setShowDeleteConfirm(false)} 
                    disabled={isDeleting}
                    className="px-5 py-2.5"
                  >
                    <span>{t('actions.cancel', 'إلغاء')}</span>
                  </Button>
                  <Button 
                    variant="danger" 
                    onClick={handleConfirmDelete} 
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-5 py-2.5"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>{isDeleting ? t('actions.deleting', 'جار الحذف...') : t('actions.confirmDelete', 'تأكيد الحذف')}</span>
                  </Button>
                </div>
              </div>
            </>
          )}
          
          {/* نافذة إضافة/تعديل الجهاز */}
          {showDeviceModal && (
            <DeviceModal
              isOpen={showDeviceModal}
              onClose={() => setShowDeviceModal(false)}
              onSave={handleSaveDevice}
              device={selectedDevice}
              clientId={client?.id || ''}
              versionTypes={versionTypes}
            />
          )}
        </div>
      </div>

    </>
  );
}
