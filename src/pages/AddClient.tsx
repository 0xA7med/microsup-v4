import React, { useState, useEffect, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, Calendar, X, Clipboard, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { format, isAfter, startOfToday } from 'date-fns';
import CustomerField from '../components/CustomerField';
import CustomerInput from '../components/CustomerInput';
import CustomerSelect from '../components/CustomerSelect';
import CustomerTextArea from '../components/CustomerTextArea';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

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
}

// تعريف أنواع الاشتراك - تحديث القيم لتتوافق مع قيود قاعدة البيانات
const SUBSCRIPTION_TYPES = [
  { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
  { value: 'semi_annual', label: 'نصف سنوي', labelEn: 'Biannual' },
  { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
  { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
];

// تعريف أنواع النسخة
const VERSION_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer', icon: <Monitor className="h-5 w-5" /> },
  { value: 'android', label: 'موبايل', labelEn: 'Mobile', icon: <Smartphone className="h-5 w-5" /> }
];

export const AddClient: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const today = startOfToday();
  const isRTL = i18n.language === 'ar';

  const [dateInputValue, setDateInputValue] = useState<string>('');
  const [loading, setLoading] = useState(false);

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

  const [formData, setFormData] = useState<Partial<ClientType>>({
    client_name: '',
    organization_name: '',
    activity_type: '',
    phone: '',
    activation_code: '', 
    subscription_type: 'monthly',
    address: '',
    device_count: 1,
    software_version: 'computer',
    subscription_start: format(today, 'yyyy-MM-dd'),
    subscription_end: calculateEndDate(today, 'monthly'),
    notes: ''
  });

  useEffect(() => {
    setDateInputValue(formatDateForDisplay(formData.subscription_start));
  }, [formData.subscription_start]);

  useEffect(() => {
    if (formData.subscription_start && formData.subscription_type) {
      const startDate = new Date(formData.subscription_start);
      let endDate = new Date(startDate);

      switch (formData.subscription_type) {
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
          endDate = new Date(2099, 11, 31); 
          break;
      }

      setFormData((prev) => ({
        ...prev,
        subscription_end: endDate.toISOString().split('T')[0],
      }));
    }
  }, [formData.subscription_start, formData.subscription_type]);

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

  // تحسين معالجة التاريخ
  const handleDateInput = (value: string) => {
    setDateInputValue(value);
    
    // تنسيق إدخال التاريخ تلقائيًا
    let cleanValue = value.replace(/[^\d/]/g, '');
    
    if (cleanValue.length === 2 && !cleanValue.includes('/')) {
      cleanValue = cleanValue + '/';
    } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
      cleanValue = cleanValue + '/';
    }
    
    cleanValue = cleanValue.slice(0, 10);
    setDateInputValue(cleanValue);
    
    // معالجة التاريخ عند إدخال تاريخ كامل
    if (cleanValue.length === 10) {
      const [day, month, year] = cleanValue.split('/');
      try {
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        if (!isNaN(date.getTime())) {
          // التحقق من أن التاريخ ليس في المستقبل
          if (isAfter(date, today)) {
            toast.error(t('messages.futureDateNotAllowed', 'لا يمكن إدخال تاريخ مستقبلي'));
            return;
          }
          
          // تحديث تاريخ بداية الاشتراك
          setFormData((prev) => ({
            ...prev,
            subscription_start: format(date, 'yyyy-MM-dd'),
            // حساب تاريخ نهاية الاشتراك بناءً على نوع الاشتراك
            subscription_end: calculateEndDate(date, prev.subscription_type || 'monthly')
          }));
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // التحقق من صحة البيانات قبل الإرسال
      if (!formData.client_name || !formData.organization_name || !formData.phone) {
        toast.error(t('messages.requiredFieldsMissing', 'يرجى ملء جميع الحقول المطلوبة'));
        setLoading(false);
        return;
      }

      const clientData = {
        ...formData,
        agent_id: user?.id,
      };

      const { error } = await supabase.from('clients').insert([clientData]);

      if (error) {
        console.error('Error adding client:', error);
        
        // معالجة أنواع الأخطاء المختلفة
        if (error.code === '23514' && error.message.includes('clients_subscription_type_check')) {
          toast.error(t('messages.invalidSubscriptionType', 'نوع الاشتراك غير صالح'));
        } else if (error.code === '23505') {
          toast.error(t('messages.duplicateClient', 'هذا العميل موجود بالفعل'));
        } else {
          toast.error(t('messages.errorOccurred', 'حدث خطأ أثناء إضافة العميل، يرجى المحاولة مرة أخرى'));
        }
        
        setLoading(false);
        return;
      }

      toast.success(t('messages.clientAddedSuccess', 'تمت إضافة العميل بنجاح'));
      navigate('/clients');
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('messages.errorOccurred', 'حدث خطأ، يرجى المحاولة مرة أخرى'));
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setFormData((prev) => ({ ...prev, activation_code: text }));
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg max-w-5xl mx-auto">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          {t('nav.addClient', 'إضافة عميل')}
        </h2>
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <span className="mr-1">{t('actions.back', 'رجوع')}</span>
          <X className={`h-4 w-4 ${isRTL ? 'transform rotate-180' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* اسم العميل */}
            <CustomerField label={t('client.name', 'اسم العميل')} children={
              <CustomerInput
                type="text"
                name="client_name"
                required
                value={formData.client_name}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* اسم المؤسسة */}
            <CustomerField label={t('client.organization', 'اسم المؤسسة')} children={
              <CustomerInput
                type="text"
                name="organization_name"
                required
                value={formData.organization_name}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* نوع النشاط */}
            <CustomerField label={t('client.activity', 'نوع النشاط')} children={
              <CustomerInput
                type="text"
                name="activity_type"
                required
                value={formData.activity_type}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* رقم الهاتف */}
            <CustomerField label={t('client.phone', 'رقم الهاتف')} children={
              <CustomerInput
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                isEditing={true}
                dir="ltr"
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* العنوان */}
            <CustomerField label={t('client.address', 'العنوان')} children={
              <CustomerInput
                type="text"
                name="address"
                required
                value={formData.address}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* رمز التفعيل */}
            <CustomerField label={t('client.activationCode', 'رمز التفعيل')} className="md:col-span-2" children={
              <div className="flex gap-2 items-center">
                <CustomerInput
                  type="text"
                  name="activation_code"
                  required
                  value={formData.activation_code}
                  onChange={handleChange}
                  isEditing={true}
                  className="h-12 text-lg flex-grow border-gray-300 dark:border-gray-600"
                  style={{ minWidth: 'calc(100% - 110px)' }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePaste}
                  className="flex-shrink-0 h-12 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  style={{ marginTop: '0' }}
                  children={
                    <span className="flex items-center">
                      <Clipboard className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('common.paste', 'لصق')}
                    </span>
                  }
                />
              </div>
            } />

            {/* نوع الاشتراك */}
            <CustomerField label={t('client.subscriptionType', 'نوع الاشتراك')} children={
              <div className="relative">
                <CustomerSelect
                  name="subscription_type"
                  value={formData.subscription_type}
                  onChange={handleChange}
                  required
                  isEditing={true}
                  className="h-12 text-lg border-gray-300 dark:border-gray-600"
                  children={
                    SUBSCRIPTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {i18n.language === 'en' ? type.labelEn : type.label}
                      </option>
                    ))
                  }
                />
                <div className={`absolute inset-y-0 ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center pointer-events-none`}>
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            } />

            {/* نوع النسخة */}
            <CustomerField label={t('client.softwareVersion', 'نوع النسخة')} children={
              <div className="flex gap-2">
                {VERSION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`flex-1 h-12 flex items-center justify-center rounded-md border ${
                      formData.software_version === type.value
                        ? 'bg-primary-100 border-primary-500 text-primary-700 dark:bg-primary-900 dark:border-primary-400 dark:text-primary-300'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => handleChange({ target: { name: 'software_version', value: type.value } } as any)}
                  >
                    <span className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      {type.icon}
                      <span className={isRTL ? 'mr-2' : 'ml-2'}>
                        {i18n.language === 'en' ? type.labelEn : type.label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            } />

            {/* عدد الأجهزة */}
            <CustomerField label={t('client.deviceCount', 'عدد الأجهزة')} children={
              <CustomerInput
                type="number"
                name="device_count"
                required
                min="1"
                value={String(formData.device_count)}
                onChange={handleChange}
                isEditing={true}
                className="h-12 text-lg border-gray-300 dark:border-gray-600"
              />
            } />

            {/* تاريخ بداية الاشتراك */}
            <CustomerField label={t('client.subscriptionStart', 'تاريخ بداية الاشتراك')} children={
              <div className="relative">
                <CustomerInput
                  type="text"
                  name="subscriptionStartDisplay"
                  required
                  value={dateInputValue || formatDateForDisplay(formData.subscription_start) || ''}
                  onChange={(e) => handleDateInput(e.target.value)}
                  isEditing={true}
                  placeholder="DD/MM/YYYY"
                  className="h-12 text-lg border-gray-300 dark:border-gray-600"
                />
                <input
                  type="hidden"
                  name="subscription_start"
                  value={formData.subscription_start || ''}
                />
                <div className={`absolute inset-y-0 ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center pointer-events-none`}>
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            } />

            {/* تاريخ نهاية الاشتراك */}
            <CustomerField label={t('client.subscriptionEnd', 'تاريخ نهاية الاشتراك')} children={
              <div className="relative">
                <CustomerInput
                  type="text"
                  name="subscription_end_display"
                  value={formatDateForDisplay(formData.subscription_end) || ''}
                  isEditing={false}
                  readOnly
                  className="h-12 text-lg bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
                <input
                  type="hidden"
                  name="subscription_end"
                  value={formData.subscription_end || ''}
                />
                <div className={`absolute inset-y-0 ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center pointer-events-none`}>
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            } />

            {/* ملاحظات */}
            <CustomerField label={t('client.notes', 'ملاحظات')} className="md:col-span-2" children={
              <CustomerTextArea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={4}
                isEditing={true}
                className="text-lg border-gray-300 dark:border-gray-600"
              />
            } />
          </div>

          {/* أزرار الإرسال */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md flex items-center justify-center"
              children={
                loading ? (
                  <div className="flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {t('actions.save', 'حفظ')}
                  </div>
                ) : (
                  t('actions.save', 'حفظ')
                )
              }
            />
          </div>
        </form>
      </div>
    </div>
  );
};