import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addMonths, addYears, isAfter, startOfToday, parseISO } from 'date-fns';
import { X, Save, Ban, Calendar, Clipboard, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeviceType, DEVICE_TYPES } from '../types/device.types';
import Button from '../components/Button';
import CustomerField from './CustomerField';
import CustomerInput from './CustomerInput';
import CustomerSelect from './CustomerSelect';
import CustomerTextArea from './CustomerTextArea';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deviceData: DeviceType) => Promise<void>;
  device?: DeviceType | null;
  clientId: string;
  versionTypes: { value: string; label: string; labelEn: string }[];
}

export default function DeviceModal({
  isOpen,
  onClose,
  onSave,
  device,
  clientId,
  versionTypes
}: DeviceModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [formData, setFormData] = useState<DeviceType>({
    client_id: clientId,
    activation_code: '',
    subscription_start: format(new Date(), 'yyyy-MM-dd'),
    subscription_end: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
    subscription_type: 'monthly',
    software_version: '',
    device_type: 'computer',
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (device && isOpen) {
      setFormData({
        ...device,
        subscription_start: formatInputDate(device.subscription_start),
        subscription_end: formatInputDate(device.subscription_end)
      });
    } else if (!device && isOpen) {
      // إعادة تعيين النموذج عند فتح النافذة لإضافة جهاز جديد
      setFormData({
        client_id: clientId,
        activation_code: '',
        subscription_start: format(new Date(), 'yyyy-MM-dd'),
        subscription_end: calculateEndDate(format(new Date(), 'yyyy-MM-dd'), 'monthly'),
        subscription_type: 'monthly',
        software_version: '',
        device_type: 'computer',
        notes: ''
      });
    }
  }, [device, isOpen, clientId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // للتحقق من أن التاريخ ليس في المستقبل
    if (name === 'subscription_start') {
      const selectedDate = new Date(value);
      const today = startOfToday();
      
      if (isAfter(selectedDate, today)) {
        toast.error(t('messages.futureDateNotAllowed', 'لا يمكن إدخال تاريخ مستقبلي'));
        return;
      }
      
      // حساب تاريخ نهاية الاشتراك تلقائياً
      const endDate = calculateEndDate(value, formData.subscription_type || 'monthly');
      
      setFormData((prev) => ({
        ...prev,
        subscription_start: value,
        subscription_end: endDate
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubscriptionTypeChange = (value: string) => {
    // حساب تاريخ نهاية الاشتراك تلقائياً عند تغيير نوع الاشتراك
    const startDate = formData.subscription_start;
    const endDate = calculateEndDate(startDate, value);
    
    setFormData((prev) => ({
      ...prev,
      subscription_type: value,
      subscription_end: endDate
    }));
  };

  const handleSaveClick = async () => {
    if (!formData.activation_code) {
      toast.error(t('messages.activationCodeRequired', 'يرجى إدخال رمز التفعيل'));
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Error saving device:", error);
      toast.error(t('messages.errorSavingDevice', 'حدث خطأ أثناء حفظ بيانات الجهاز'));
    } finally {
      setIsSaving(false);
    }
  };

  const formatInputDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'yyyy-MM-dd');
    } catch (error) {
      console.warn("Error formatting input date:", dateString, error);
      if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      return '';
    }
  };

  const generateRandomCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    setFormData((prev) => ({
      ...prev,
      activation_code: result
    }));
    
    toast.success(t('messages.codeGenerated', 'تم إنشاء رمز تفعيل جديد'));
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 dark:bg-black/70 z-50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-3xl w-full max-h-[90vh] overflow-auto rounded-xl bg-white dark:bg-gray-900 shadow-2xl z-[60] transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* رأس النافذة */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {device ? t('device.editDevice', 'تعديل بيانات الجهاز') : t('device.addDevice', 'إضافة جهاز جديد')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            aria-label={t('actions.close', 'إغلاق') as string}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* محتوى النافذة */}
        <div className="p-5">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* رمز التفعيل */}
              <CustomerField label={t('device.activationCode', 'رمز التفعيل')} className="md:col-span-2" children={
                <div className="flex gap-2 items-center">
                  <CustomerInput
                    type="text"
                    name="activation_code"
                    value={formData.activation_code}
                    onChange={handleInputChange}
                    isEditing={true}
                    required
                    className="h-12 text-lg flex-grow border-gray-300 dark:border-gray-600"
                    style={{ minWidth: 'calc(100% - 120px)' }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.readText().then(text => {
                        setFormData((prev) => ({
                          ...prev,
                          activation_code: text
                        }));
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
                  name="device_type"
                  value={formData.device_type}
                  onChange={handleInputChange}
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
                  name="subscription_type"
                  value={formData.subscription_type || 'monthly'}
                  onChange={(e) => handleSubscriptionTypeChange(e.target.value)}
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
                    name="subscription_start"
                    value={formData.subscription_start}
                    onChange={handleDateChange}
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
                    name="subscription_end"
                    value={formData.subscription_end}
                    readOnly // جعل الحقل للقراءة فقط لأنه يتم حسابه تلقائياً
                    isEditing={true}
                    required
                    className="h-12 text-lg border-gray-300 dark:border-gray-600 pr-10 bg-gray-50 dark:bg-gray-600"
                  />
                  <Calendar className="absolute top-3 right-3 h-6 w-6 text-gray-400 pointer-events-none" />
                </div>
              } />

              {/* ملاحظات */}
              <CustomerField label={t('device.notes', 'ملاحظات')} className="md:col-span-2" children={
                <CustomerTextArea
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleInputChange}
                  isEditing={true}
                  rows={4}
                  className="text-base border-gray-300 dark:border-gray-600"
                />
              } />
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <Button
            variant="secondary"
            onClick={onClose}
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
        </div>
      </div>
    </>
  );
}