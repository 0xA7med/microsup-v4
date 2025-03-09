import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, Calendar, Save, X, ArrowRight, Clipboard } from 'lucide-react';
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
  created_by?: string;
}

const SUBSCRIPTION_TYPES = [
  { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
  { value: 'biannual', label: 'نصف سنوي', labelEn: 'Biannual' },
  { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
  { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
];

const VERSION_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer', icon: <Monitor className="h-5 w-5" /> },
  { value: 'mobile', label: 'موبايل', labelEn: 'Mobile', icon: <Smartphone className="h-5 w-5" /> }
];

export const AddClient: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const today = startOfToday();
  const [dateInputValue, setDateInputValue] = useState('');
  const isRTL = i18n.language === 'ar';

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
    subscription_start: new Date().toISOString().split('T')[0],
    subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
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
        case 'biannual':
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

  const handleDateInput = (value: string) => {
    setDateInputValue(value);
    try {
      const dateParts = value.split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; 
        const year = parseInt(dateParts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const date = new Date(year, month, day);
          
          if (isAfter(date, today)) {
            toast.error(t('messages.futureDateNotAllowed', 'لا يمكن إدخال تاريخ مستقبلي'));
            return;
          }
          
          setFormData((prev) => ({
            ...prev,
            subscription_start: format(date, 'yyyy-MM-dd'),
            subscription_end: calculateEndDate(date, prev.subscription_type || 'monthly')
          }));
        }
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
  };

  const calculateEndDate = (startDate: Date, subscriptionType: string) => {
    let endDate = new Date(startDate);

    switch (subscriptionType) {
      case 'monthly':
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      case 'biannual':
        endDate.setMonth(startDate.getMonth() + 6);
        break;
      case 'annual':
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
      case 'permanent':
        endDate = new Date(2099, 11, 31); 
        break;
    }

    return endDate.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const clientData = {
        ...formData,
        agent_id: user?.id,
        created_by: user?.id,
      };

      const { error } = await supabase.from('clients').insert(clientData);

      if (error) throw error;
      navigate('/clients');
    } catch (error) {
      console.error('Error adding client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
          <ArrowRight className={`h-4 w-4 ${isRTL ? 'transform rotate-180' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
            <CustomerField label={t('client.activationCode', 'رمز التفعيل')} children={
              <div className="flex gap-2">
                <CustomerInput
                  type="text"
                  name="activation_code"
                  required
                  value={formData.activation_code}
                  onChange={handleChange}
                  isEditing={true}
                  className="h-12 text-lg flex-grow border-gray-300 dark:border-gray-600"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePaste}
                  className="flex-shrink-0 h-12 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
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
                  value={dateInputValue || ''}
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
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/clients')}
              className="flex items-center h-12 px-6"
              children={
                <span className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <X className={`h-5 w-5 ${isRTL ? 'mr-2' : 'ml-2'}`} />
                  {t('actions.cancel', 'إلغاء')}
                </span>
              }
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex items-center h-12 px-6"
              children={
                <span className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Save className={`h-5 w-5 ${isRTL ? 'mr-2' : 'ml-2'}`} />
                  {t('actions.save', 'حفظ')}
                </span>
              }
            />
          </div>
        </form>
      </div>
    </div>
  );
};