import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addMonths, addYears, isAfter, startOfToday } from 'date-fns';
import { Plus, Calendar, Clipboard, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import CustomerField from './CustomerField';
import CustomerInput from './CustomerInput';
import CustomerSelect from './CustomerSelect';
import CustomerTextArea from './CustomerTextArea';
import { DeviceType, DEVICE_TYPES } from '../types/device.types';

interface ClientDevicesFormProps {
  clientId?: string;
  onDevicesChange: (devices: DeviceType[]) => void;
  versionTypes?: { value: string; label: string; labelEn: string; icon?: React.ReactNode }[];
  isNewClient: boolean;
}

export default function ClientDevicesForm({
  clientId,
  onDevicesChange,
  isNewClient
}: ClientDevicesFormProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [devices, setDevices] = useState<DeviceType[]>([]);

  // إذا كان عميل جديد، نضيف جهاز افتراضي
  useEffect(() => {
    if (isNewClient && devices.length === 0) {
      setDevices([{
        client_id: clientId || '',
        activation_code: '',
        subscription_start: format(new Date(), 'yyyy-MM-dd'),
        subscription_end: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
        subscription_type: 'monthly',
        device_type: 'computer',
        approval_status: 'pending', // إضافة حالة الموافقة الافتراضية
        notes: '',
        price: 0 // إضافة حقل القيمة الافتراضية
      }]);
    }
  }, [isNewClient, clientId]);

  // إرسال التغييرات إلى المكون الأب
  useEffect(() => {
    onDevicesChange(devices);
  }, [devices, onDevicesChange]);

  // حساب تاريخ نهاية الاشتراك بناءً على تاريخ البداية ونوع الاشتراك
  const calculateEndDate = (startDate: string, subscriptionType: string): string => {
    const start = new Date(startDate);
    let endDate: Date;

    switch (subscriptionType) {
      case 'monthly':
        endDate = addMonths(start, 1);
        break;
      case 'semi_annual':
        endDate = addMonths(start, 6);
        break;
      case 'annual':
        endDate = addYears(start, 1);
        break;
      case 'permanent':
        endDate = new Date(2099, 11, 31); // تاريخ بعيد للاشتراك الدائم
        break;
      default:
        endDate = addYears(start, 1);
    }

    return format(endDate, 'yyyy-MM-dd');
  };

  const handleDeviceChange = (index: number, field: keyof DeviceType, value: string) => {
    const updatedDevices = [...devices];
    
    // إذا كان الحقل هو تاريخ بداية الاشتراك، نتحقق من أنه ليس في المستقبل
    if (field === 'subscription_start') {
      const selectedDate = new Date(value);
      const today = startOfToday();
      
      if (isAfter(selectedDate, today)) {
        toast.error(t('messages.futureDateNotAllowed', 'لا يمكن إدخال تاريخ مستقبلي'));
        return;
      }
      
      // حساب تاريخ نهاية الاشتراك تلقائياً
      const subscriptionType = updatedDevices[index].subscription_type || 'monthly';
      const endDate = calculateEndDate(value, subscriptionType);
      
      updatedDevices[index] = {
        ...updatedDevices[index],
        subscription_start: value,
        subscription_end: endDate
      };
    }
    // إذا كان الحقل هو نوع الاشتراك، نعيد حساب تاريخ نهاية الاشتراك
    else if (field === 'subscription_type') {
      const startDate = updatedDevices[index].subscription_start;
      const endDate = calculateEndDate(startDate, value);
      
      updatedDevices[index] = {
        ...updatedDevices[index],
        subscription_type: value,
        subscription_end: endDate
      };
    }
    // إذا كان الحقل هو القيمة، نتأكد من تحويله إلى رقم
    else if (field === 'price') {
      const priceValue = parseFloat(value) || 0;
      
      updatedDevices[index] = {
        ...updatedDevices[index],
        price: priceValue
      };
    }
    // إذا كان الحقل هو نوع الجهاز
    else if (field === 'device_type') {
      // إذا كان نوع الجهاز هو موبايل، نجعل نوع الاشتراك دائم افتراضيًا
      if (value === 'android') {
        const startDate = updatedDevices[index].subscription_start;
        const endDate = calculateEndDate(startDate, 'permanent');
        
        updatedDevices[index] = {
          ...updatedDevices[index],
          device_type: value,
          subscription_type: 'permanent',
          subscription_end: endDate
        };
      } else {
        updatedDevices[index] = {
          ...updatedDevices[index],
          device_type: value
        };
      }
    }
    // غير ذلك، نقوم بتحديث الحقل المطلوب فقط
    else {
      updatedDevices[index] = {
        ...updatedDevices[index],
        [field]: value
      };
    }
    
    setDevices(updatedDevices);
  };

  const handleAddDevice = () => {
    // إنشاء رمز تفعيل عشوائي
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    setDevices([...devices, {
      client_id: clientId || '',
      activation_code: randomCode, // إضافة رمز تفعيل عشوائي
      subscription_start: format(new Date(), 'yyyy-MM-dd'),
      subscription_end: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
      subscription_type: 'monthly',
      device_type: 'computer',
      approval_status: 'pending', // إضافة حالة الموافقة الافتراضية
      notes: '',
      price: 0 // إضافة حقل القيمة الافتراضية
    }]);
    
    // إظهار رسالة توضح أن الجهاز سيكون قيد المراجعة
    toast.success(t('device.pendingApproval', 'تمت إضافة الجهاز وسيكون قيد المراجعة من قبل المدير'));
  };

  const handleRemoveDevice = (index: number) => {
    if (devices.length === 1 && isNewClient) {
      toast.error(t('messages.firstDeviceRequired', 'يجب إضافة جهاز واحد على الأقل للعميل الجديد'));
      return;
    }
    const updatedDevices = devices.filter((_, i) => i !== index);
    setDevices(updatedDevices);
  };



  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('client.devices', 'الأجهزة')}
          </h3>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddDevice}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('device.addDevice', 'إضافة جهاز')}</span>
          </Button>
        </div>
        
        {/* رسالة توضيحية حول نظام الموافقة */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t('device.approvalNotice', 'الأجهزة الجديدة ستكون قيد المراجعة من قبل المدير قبل إضافتها بشكل رسمي للنظام.')}
            </p>
          </div>
        </div>
      </div>

      {devices.map((device, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {t('device.deviceNumber', 'الجهاز رقم {{number}}', { number: index + 1 })}
            </h4>
            {(!isNewClient || devices.length > 1) && (
              <Button
                type="button"
                variant="danger"
                onClick={() => handleRemoveDevice(index)}
                className="p-2 h-10 flex items-center justify-center gap-2 rounded-lg transition-all hover:scale-105"
                title={t('actions.delete', 'حذف') as string}
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">{t('actions.delete', 'حذف')}</span>
              </Button>
            )}
          </div>
          
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* رمز التفعيل */}
            <CustomerField label={t('device.activationCode', 'رمز التفعيل')} className="md:col-span-2" children={
              <div className="flex gap-2 items-center">
                <CustomerInput
                  type="text"
                  name={`device_activation_code_${index}`}
                  value={device.activation_code}
                  onChange={(e) => handleDeviceChange(index, 'activation_code', e.target.value)}
                  isEditing={true}
                  required
                  className="h-12 text-lg flex-grow border-gray-300 dark:border-gray-600"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.readText().then(text => {
                      handleDeviceChange(index, 'activation_code', text);
                    });
                  }}
                  className="flex-shrink-0 h-12 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  <span className="flex items-center">
                    <Clipboard className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('common.paste', 'لصق')}
                  </span>
                </Button>
              </div>
            } />

            {/* نوع الجهاز */}
            <CustomerField label={t('device.deviceType', 'نوع الجهاز')} children={
              <CustomerSelect
                name={`device_type_${index}`}
                value={device.device_type}
                onChange={(e) => handleDeviceChange(index, 'device_type', e.target.value)}
                isEditing={true}
                options={DEVICE_TYPES.map(type => ({
                  value: type.value,
                  label: i18n.language === 'ar' ? type.label : type.labelEn
                }))}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* نوع الاشتراك */}
            <CustomerField label={t('device.subscriptionType', 'نوع الاشتراك')} children={
              <CustomerSelect
                name={`subscription_type_${index}`}
                value={device.subscription_type || 'monthly'}
                onChange={(e) => handleDeviceChange(index, 'subscription_type', e.target.value)}
                isEditing={true}
                options={[
                  { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
                  { value: 'semi_annual', label: 'نصف سنوي', labelEn: 'Semi-Annual' },
                  { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
                  { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
                ].map(type => ({
                  value: type.value,
                  label: i18n.language === 'ar' ? type.label : type.labelEn
                }))}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* تاريخ بداية الاشتراك */}
            <CustomerField label={t('device.subscriptionStart', 'بداية الاشتراك')} children={
              <div className="relative">
                <CustomerInput
                  type="date"
                  name={`subscription_start_${index}`}
                  value={device.subscription_start}
                  onChange={(e) => handleDeviceChange(index, 'subscription_start', e.target.value)}
                  isEditing={true}
                  required
                  max={format(new Date(), 'yyyy-MM-dd')} // لا يسمح بتواريخ في المستقبل
                  className="h-12 text-lg border-gray-300 dark:border-gray-600 pr-10"
                />
                <Calendar className="absolute top-3 right-3 h-6 w-6 text-gray-400 pointer-events-none" />
              </div>
            } />

            {/* تاريخ نهاية الاشتراك */}
            <CustomerField label={t('device.subscriptionEnd', 'نهاية الاشتراك')} children={
              <div className="relative">
                <CustomerInput
                  type="date"
                  name={`subscription_end_${index}`}
                  value={device.subscription_end}
                  onChange={(e) => handleDeviceChange(index, 'subscription_end', e.target.value)}
                  isEditing={true}
                  required
                  readOnly // جعل الحقل للقراءة فقط لأنه يتم حسابه تلقائياً
                  className="h-12 text-lg border-gray-300 dark:border-gray-600 pr-10 bg-gray-50 dark:bg-gray-600"
                />
                <Calendar className="absolute top-3 right-3 h-6 w-6 text-gray-400 pointer-events-none" />
              </div>
            } />

            {/* القيمة */}
            <CustomerField label={t('device.price', 'القيمة')} children={
              <div className="relative">
                <CustomerInput
                  type="number"
                  name={`price_${index}`}
                  value={device.price?.toString() || '0'}
                  onChange={(e) => handleDeviceChange(index, 'price', e.target.value)}
                  isEditing={true}
                  min="0"
                  step="0.01"
                  required
                  className="h-12 text-lg border-gray-300 dark:border-gray-600 pl-16"
                />
                <span className="absolute top-3 left-3 text-gray-500 dark:text-gray-400 text-sm">جنيه</span>
              </div>
            } />

            {/* ملاحظات */}
            <CustomerField label={t('device.notes', 'ملاحظات')} className="md:col-span-2" children={
              <CustomerTextArea
                name={`notes_${index}`}
                value={device.notes || ''}
                onChange={(e) => handleDeviceChange(index, 'notes', e.target.value)}
                isEditing={true}
                rows={4}
                className="text-base border-gray-300 dark:border-gray-600"
              />
            } />
          </div>
        </div>
      ))}
    </div>
  );
}