import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  X, Edit, Save, Trash2, AlertTriangle, ChevronDown, ChevronUp,
  Plus, Clipboard, Smartphone, Laptop, CheckCircle, XCircle, AlertCircle, Eye,
  MessageSquare, UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
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
  versionTypes?: VersionType[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedClient: ClientType) => Promise<void>;
  onDelete: (clientId: string) => Promise<void>;
  // إضافة معلومات المستخدم الحالي
  currentUser?: {
    id: string;
    role: string;
  } | null;
  onSaveContact?: (client: ClientType) => void; // دالة لحفظ العميل كجهة اتصال
}

export default function ClientDetailsModal({
  client,
  agents,
  subscriptionTypes,
  isOpen,
  onClose,
  onSave,
  onDelete,
  currentUser,
  onSaveContact
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
  const [deviceModalMode, setDeviceModalMode] = useState<'edit' | 'view'>('edit');

  // إنشاء نسخة من العميل للعرض
  const displayClient = formData;

  useEffect(() => {
    if (client && isOpen) {
      console.log("Client data received:", client); // إضافة سجل للتحقق من بيانات العميل
      setFormData({ ...client }); 
      setIsEditing(false); 
      setShowDeleteConfirm(false);
      setIsSaving(false);
      setIsDeleting(false);
      fetchDevices(client.id);
      
      // طباعة معلومات المندوبين للتشخيص
      console.log("Agents from props:", agents);
      console.log("Current user:", currentUser); // إضافة سجل للتحقق من معلومات المستخدم الحالي
    } else if (!isOpen) {
      setTimeout(() => {
        setFormData(null);
        setIsEditing(false);
        setShowDeleteConfirm(false);
        setDevices([]);
      }, 200); 
    }
  }, [client, isOpen]);

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
      // تسجيل البيانات قبل الحفظ للتحقق من وجود البريد الإلكتروني
      console.log('بيانات الجهاز قبل الحفظ في ClientDetailsModal:', deviceData);
      
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
      return <Laptop className="h-5 w-5" />;
    } else {
      return <Smartphone className="h-5 w-5" />;
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: ClientType | null) => prev ? { ...prev, [name]: value } : null);
  };

  // دالة لحفظ التغييرات
  const handleSaveClick = async () => {
    if (!formData || !client) return;
    
    setIsSaving(true);
    try {
      // تحويل البيانات إلى الشكل المناسب لقاعدة البيانات
      await onSave(formData);
      
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

  // دالة لعرض تفاصيل الجهاز (للمندوبين فقط - عرض بدون تعديل)
  const handleViewDevice = (device: DeviceType) => {
    setSelectedDevice(device);
    setShowDeviceModal(true);
    setDeviceModalMode('view'); // وضع العرض فقط
  };

  if (!isOpen && !formData) return null; 
  if (!client && !formData) return null; 

  // دالة لفتح واتساب
  const openWhatsApp = () => {
    if (!client?.phone) return;
    
    // تنظيف رقم الهاتف من أي أحرف غير رقمية
    const cleanPhone = client.phone.replace(/\D/g, '');
    
    // إذا كان الرقم لا يبدأ بـ +، نضيف مفتاح مصر
    let formattedPhone = cleanPhone;
    if (!cleanPhone.startsWith('+')) {
      // إذا كان الرقم يبدأ بصفر، نحذفه ونضيف مفتاح مصر
      if (cleanPhone.startsWith('0')) {
        formattedPhone = '20' + cleanPhone.substring(1);
      } else {
        formattedPhone = '20' + cleanPhone;
      }
    }
    
    // فتح واتساب
    const whatsappUrl = `https://wa.me/${formattedPhone}`;
    window.open(whatsappUrl, '_blank');
  };

  // دالة لحفظ العميل كجهة اتصال
  const handleSaveContact = () => {
    if (!client) return;
    
    if (onSaveContact) {
      onSaveContact(client);
      toast.success(t('client.contactSaved', 'تم حفظ العميل كجهة اتصال'));
    } else {
      // إذا لم تكن الدالة متوفرة، نقوم بإنشاء vCard وتنزيلها
      const vCard = createVCard(client);
      downloadVCard(vCard, client.client_name);
    }
  };

  // إنشاء vCard
  const createVCard = (client: ClientType) => {
    let vCard = 'BEGIN:VCARD\nVERSION:3.0\n';
    vCard += `FN:${client.client_name}\n`;
    if (client.organization_name) vCard += `ORG:${client.organization_name}\n`;
    if (client.phone) vCard += `TEL;TYPE=CELL:${client.phone}\n`;
    if (client.phone2) vCard += `TEL;TYPE=WORK:${client.phone2}\n`;
    if (client.address) vCard += `ADR;TYPE=WORK:;;${client.address};;;;\n`;
    vCard += 'END:VCARD';
    return vCard;
  };

  // تنزيل vCard
  const downloadVCard = (vCard: string, name: string) => {
    const blob = new Blob([vCard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 dark:bg-black/80 z-50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} 
      />

      <div
        className={`fixed inset-0 flex items-center justify-center p-4 z-[60] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div dir="rtl" className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('client.details', 'تفاصيل العميل')}
            </h3>
            
            {/* أزرار إضافية في الأعلى */}
            <div className="flex flex-wrap items-center gap-2">
              {client?.phone && (
                <Button
                  variant="primary"
                  onClick={openWhatsApp}
                  className="px-3 py-1.5 text-sm flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white"
                  title={t('client.whatsapp', 'التواصل عبر واتساب')}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('client.whatsapp', 'واتساب')}</span>
                </Button>
              )}
              
              <Button
                variant="secondary"
                onClick={handleSaveContact}
                className="px-3 py-1.5 text-sm flex items-center gap-1"
                title={t('client.saveContact', 'حفظ كجهة اتصال')}
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('client.saveContact', 'حفظ جهة')}</span>
              </Button>
              
              <button 
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 rounded-full" 
                onClick={onClose}
                aria-label={t('actions.close', 'إغلاق') as string}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-grow">
            {displayClient ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* اسم العميل */}
                <CustomerField label={t('client.name', 'اسم العميل')} children={
                  <CustomerInput
                    type="text"
                    name="client_name"
                    value={isEditing ? formData?.client_name || '' : displayClient?.client_name || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-10 text-base border-gray-300 dark:border-gray-600"
                  />
                } />

                {/* اسم المؤسسة */}
                <CustomerField label={t('client.organization', 'اسم المؤسسة')} children={
                  <CustomerInput
                    type="text"
                    name="organization_name"
                    value={isEditing ? formData?.organization_name || '' : displayClient?.organization_name || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-10 text-base border-gray-300 dark:border-gray-600"
                  />
                } />

                {/* رقم الهاتف */}
                <CustomerField label={t('client.phone', 'رقم الهاتف')} children={
                  <CustomerInput
                    type="tel"
                    name="phone"
                    value={isEditing ? formData?.phone || '' : displayClient?.phone || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    dir="ltr"
                    className="h-10 text-base border-gray-300 dark:border-gray-600"
                  />
                } />

                {/* رقم الهاتف 2 */}
                <CustomerField label={t('client.phone2', 'رقم الهاتف 2')} children={
                  <CustomerInput
                    type="tel"
                    name="phone2"
                    value={isEditing ? formData?.phone2 || '' : displayClient?.phone2 || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    dir="ltr"
                    className="h-10 text-base border-gray-300 dark:border-gray-600"
                  />
                } />
                
                {/* نوع النشاط */}
                <CustomerField label={t('client.activityType', 'نوع النشاط')} children={
                  <CustomerInput
                    type="text"
                    name="activity_type"
                    value={isEditing ? formData?.activity_type || '' : displayClient?.activity_type || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-10 text-base border-gray-300 dark:border-gray-600"
                  />
                } />
                
                {/* العنوان */}
                <CustomerField label={t('client.address', 'العنوان')} children={
                  <CustomerInput
                    type="text"
                    name="address"
                    value={isEditing ? formData?.address || '' : displayClient?.address || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    required
                    className="h-10 text-base border-gray-300 dark:border-gray-600"
                  />
                } />
                
                {/* ملاحظات */}
                <CustomerField label={t('client.notes', 'ملاحظات')} className="md:col-span-2" children={
                  <CustomerTextArea
                    name="notes"
                    value={isEditing ? formData?.notes || '' : displayClient?.notes || ''}
                    onChange={handleInputChange}
                    isEditing={isEditing}
                    rows={3}
                    className="text-base border-gray-300 dark:border-gray-600"
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
              className="flex items-center justify-between w-full p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-lg font-medium text-gray-800 dark:text-white flex items-center">
                <Smartphone className="w-5 h-5 ml-2" />
                {t('device.devicesSection', 'الأجهزة والاشتراكات')}
                <span className="mr-2 text-sm font-normal text-gray-500 dark:text-gray-400">
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
              <div className="p-4">
                {isLoadingDevices ? (
                  <div className="flex justify-center items-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
                  </div>
                ) : devices.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {t('device.totalDevices', 'إجمالي الأجهزة')}: {devices.length}
                      </h4>
                      
                      {/* زر إضافة جهاز جديد - في الجانب على الشاشات الكبيرة وفي الوسط على الشاشات الصغيرة */}
                      {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                        <div className="hidden sm:block">
                          <Button
                            variant="primary"
                            onClick={handleAddDevice}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{t('device.addDevice', 'إضافة جهاز جديد')}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* عرض الأجهزة كبطاقات في وضع الجوال */}
                    <div className="sm:hidden space-y-4">
                      {devices.map((device) => (
                        <div key={device.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center">
                              {getDeviceIcon(device.device_type)}
                              <span className="mr-2 text-sm font-medium">{getDeviceTypeLabel(device.device_type)}</span>
                            </div>
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getApprovalStatusColor(device.approval_status || 'pending')}`}>
                              {getApprovalStatusIcon(device.approval_status || 'pending')}
                              <span className="ml-1">{getApprovalStatusLabel(device.approval_status || 'pending')}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('device.activationCode', 'رمز التفعيل')}:</div>
                            <div className="flex items-center">
                              <code className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded truncate max-w-[120px]" title={device.activation_code}>
                                {device.activation_code}
                              </code>
                              <button
                                onClick={() => copyActivationCode(device.activation_code)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-0 ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                                title={t('common.copy', 'نسخ')}
                              >
                                <Clipboard className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          
                          {device.email && (
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-gray-500 dark:text-gray-400">{t('device.email', 'البريد الإلكتروني')}:</div>
                              <div className="text-sm text-gray-600 dark:text-gray-300 dir-ltr truncate max-w-[200px]">
                                {device.email || '-'}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('device.subscriptionType', 'نوع الاشتراك')}:</div>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {getSubscriptionTypeLabel(device.subscription_type)}
                            </span>
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            {/* زر عرض التفاصيل للمندوبين فقط */}
                            {currentUser?.role === 'agent' && (
                              <button
                                onClick={() => handleViewDevice(device)}
                                className="flex items-center gap-1 p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-xs"
                              >
                                <Eye className="w-4 h-4" />
                                <span>{t('device.viewDetails', 'عرض التفاصيل')}</span>
                              </button>
                            )}
                            
                            {/* أزرار التعديل والحذف للمديرين فقط */}
                            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                              <>
                                <button
                                  onClick={() => handleEditDevice(device)}
                                  className="flex items-center gap-1 p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-xs"
                                >
                                  <Edit className="w-4 h-4" />
                                  <span>{t('actions.edit', 'تعديل')}</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteDevice(device.id || '')}
                                  className="flex items-center gap-1 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-xs"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>{t('actions.delete', 'حذف')}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* عرض الأجهزة كجدول في وضع الشاشات المتوسطة والكبيرة */}
                    <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('device.deviceType', 'نوع الجهاز')}
                            </th>
                            <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('device.activationCode', 'رمز التفعيل')}
                            </th>
                            <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                              {t('device.email', 'البريد الإلكتروني')}
                            </th>
                            <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                              {t('device.subscriptionType', 'نوع الاشتراك')}
                            </th>
                            <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                              {t('device.status', 'الحالة')}
                            </th>
                            <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('common.actions', 'الإجراءات')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                          {devices.map((device) => (
                            <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  {getDeviceIcon(device.device_type)}
                                  <span className="mr-2 text-sm">{getDeviceTypeLabel(device.device_type)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[100px] sm:max-w-[150px]" title={device.activation_code}>
                                    {device.activation_code}
                                  </code>
                                  <button
                                    onClick={() => copyActivationCode(device.activation_code)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-0 ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                                    title={t('common.copy', 'نسخ')}
                                  >
                                    <Clipboard className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap hidden md:table-cell">
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                  {device.email || '-'}
                                </span>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {getSubscriptionTypeLabel(device.subscription_type)}
                                </span>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getApprovalStatusColor(device.approval_status || 'pending')}`}>
                                  {getApprovalStatusIcon(device.approval_status || 'pending')}
                                  <span className="ml-1">{getApprovalStatusLabel(device.approval_status || 'pending')}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-center">
                                <div className="flex justify-center gap-1">
                                  {/* زر عرض التفاصيل للمندوبين فقط */}
                                  {currentUser?.role === 'agent' && (
                                    <button
                                      onClick={() => handleViewDevice(device)}
                                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                                      title={t('device.viewDetails', 'عرض التفاصيل')}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}
                                  
                                  {/* أزرار التعديل والحذف للمديرين فقط */}
                                  {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                                    <>
                                      <button
                                        onClick={() => handleEditDevice(device)}
                                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                                        title={t('actions.edit', 'تعديل')}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteDevice(device.id || '')}
                                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                        title={t('actions.delete', 'حذف')}
                                      >
                                        <Trash2 className="w-4 h-4" />
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
                    
                    {/* زر إضافة جهاز جديد للشاشات الصغيرة فقط */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                      <div className="flex justify-center mt-4 sm:hidden">
                        <Button
                          variant="primary"
                          onClick={handleAddDevice}
                          className="flex items-center gap-2 px-4 py-2 text-sm w-full"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{t('device.addDevice', 'إضافة جهاز جديد')}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      {t('device.noDevices', 'لا توجد أجهزة مسجلة لهذا العميل')}
                    </div>
                    
                    {/* زر إضافة جهاز جديد عندما لا توجد أجهزة */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="primary"
                          onClick={handleAddDevice}
                          className="flex items-center gap-2 px-4 py-2 text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{t('device.addDevice', 'إضافة جهاز جديد')}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            {isEditing ? (
              <>
                <Button
                  variant="secondary"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-4 py-2 text-sm w-full sm:w-auto"
                  disabled={isSaving}
                >
                  <X className="w-4 h-4" />
                  <span>{t('actions.cancel', 'إلغاء')}</span>
                </Button>
                <Button
                  variant="primary" 
                  onClick={handleSaveClick}
                  className="flex items-center gap-2 px-4 py-2 text-sm w-full sm:w-auto"
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? t('actions.saving', 'جار الحفظ...') : t('actions.save', 'حفظ')}</span>
                </Button>
              </>
            ) : (
              <>
                {/* عرض أزرار التعديل والحذف للمديرين فقط */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                      variant="danger" 
                      onClick={handleDeleteClick}
                      className="flex items-center gap-2 px-4 py-2 text-sm w-full sm:w-auto"
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t('actions.delete', 'حذف')}</span>
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm w-full sm:w-auto"
                      disabled={isDeleting}
                    >
                      <Edit className="w-4 h-4" />
                      <span>{t('actions.edit', 'تعديل')}</span>
                    </Button>
                  </div>
                )}
                <Button
                  variant="secondary"
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 text-sm w-full sm:w-auto"
                >
                  <X className="w-4 h-4" />
                  <span>{t('actions.close', 'إغلاق')}</span>
                </Button>
              </>
            )}
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
                    className="px-4 py-2 text-sm"
                  >
                    <span>{t('actions.cancel', 'إلغاء')}</span>
                  </Button>
                  <Button 
                    variant="danger" 
                    onClick={handleConfirmDelete} 
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
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
              subscriptionTypes={subscriptionTypes}
              mode={deviceModalMode}
            />
          )}
        </div>
      </div>
    </>
  );
}
