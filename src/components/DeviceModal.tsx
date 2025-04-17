import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addMonths, addYears, isAfter, startOfToday, parseISO } from 'date-fns';
import { X, Save, Ban, Calendar, Clipboard } from 'lucide-react';
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
  const [formData, setFormData] = useState<DeviceType>({
    client_id: clientId,
    activation_code: '',
    subscription_start: format(new Date(), 'yyyy-MM-dd'),
    subscription_end: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
    subscription_type: 'monthly',
    device_type: '',
    notes: '',
    price: 0 // إضافة حقل السعر
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
        device_type: '',
        notes: '',
        price: 0 // إضافة حقل السعر
      });
    }
  }, [device, isOpen, clientId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // معالجة خاصة لحقل السعر لضمان تحويله إلى رقم
    if (name === 'price') {
      const priceValue = parseFloat(value) || 0;
      setFormData((prev) => ({ ...prev, [name]: priceValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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
      
      // تحديث تاريخ البداية وإعادة حساب تاريخ النهاية
      setFormData((prev) => ({
        ...prev,
        subscription_start: value,
        subscription_end: calculateEndDate(value, prev.subscription_type || 'monthly')
      }));
    } else {
      // تحديث أي حقل تاريخ آخر
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubscriptionTypeChange = (value: string) => {
    // تحديث نوع الاشتراك وإعادة حساب تاريخ النهاية
    setFormData((prev) => ({
      ...prev,
      subscription_type: value,
      subscription_end: calculateEndDate(prev.subscription_start || format(new Date(), 'yyyy-MM-dd'), value)
    }));
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving device:', error);
      toast.error(t('messages.errorSavingDevice', 'حدث خطأ أثناء حفظ الجهاز'));
    } finally {
      setIsSaving(false);
    }
  };

  // تنسيق التاريخ للإدخال
  const formatInputDate = (dateString?: string | null): string => {
    if (!dateString) return format(new Date(), 'yyyy-MM-dd');
    
    try {
      const date = parseISO(dateString);
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error('خطأ في تنسيق التاريخ:', error);
      return format(new Date(), 'yyyy-MM-dd');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[60] transition-opacity duration-150" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-3xl w-full rounded-xl shadow-2xl bg-white dark:bg-gray-800 z-[70] max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* رأس النافذة */}
          <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {device ? t('device.editDevice', 'تعديل جهاز') : t('device.addDevice', 'إضافة جهاز جديد')}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label={t('actions.close', 'إغلاق') as string}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* محتوى النافذة */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* رمز التفعيل */}
              <CustomerField label={t('device.activationCode', 'رمز التفعيل')} children={
                <div className="relative">
                  <CustomerInput
                    type="text"
                    name="activation_code"
                    value={formData.activation_code || ''}
                    onChange={handleInputChange}
                    isEditing={true}
                    placeholder={t('device.enterActivationCode', 'أدخل رمز التفعيل') as string}
                    required
                    className="h-12 text-lg border-gray-300 dark:border-gray-600 pl-10"
                  />
                  <Clipboard className="absolute top-3 left-3 h-6 w-6 text-gray-400 pointer-events-none" />
                </div>
              } />

              {/* نوع الجهاز */}
              <CustomerField label={t('device.deviceType', 'نوع الجهاز')} children={
                <CustomerSelect
                  name="device_type"
                  value={formData.device_type || ''}
                  onChange={handleInputChange}
                  isEditing={true}
                  required
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
                  value={formData.subscription_type || ''}
                  onChange={(e) => handleSubscriptionTypeChange(e.target.value)}
                  isEditing={true}
                  required
                  options={versionTypes.map(type => ({
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

              {/* السعر */}
              <CustomerField label={t('device.price', 'القيمة')} children={
                <div className="relative">
                  <CustomerInput
                    type="number"
                    name="price"
                    value={formData.price?.toString() || '0'}
                    onChange={handleInputChange}
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