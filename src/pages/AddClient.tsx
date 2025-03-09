import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, Calendar, Save, X, ArrowRight } from 'lucide-react';
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

export const AddClient: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const today = startOfToday();
  const [dateInputValue, setDateInputValue] = useState('');

  const [formData, setFormData] = useState<Partial<ClientType>>({
    client_name: '',
    organization_name: '',
    activity_type: '',
    phone: '',
    activation_code: '', // جعل حقل رمز التفعيل فارغًا بشكل افتراضي
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
    let cleanValue = value.replace(/[^\d/]/g, '');

    if (cleanValue.length === 2 && !cleanValue.includes('/')) {
      cleanValue = cleanValue + '/';
    } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
      cleanValue = cleanValue + '/';
    }

    cleanValue = cleanValue.slice(0, 10);

    setDateInputValue(cleanValue);

    if (cleanValue.length === 10) {
      const [day, month, year] = cleanValue.split('/');
      try {
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        if (!isNaN(date.getTime())) {
          if (isAfter(date, today)) {
            toast.error(t('subscription.futureDateError', 'تاريخ البدء لا يمكن أن يكون في المستقبل'));
            return;
          }

          handleChange({
            target: {
              name: 'subscription_start',
              value: format(date, 'yyyy-MM-dd'),
            },
          } as React.ChangeEvent<HTMLInputElement>);
        }
      } catch {
        // Invalid date, do nothing
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // إضافة معرف المستخدم الحالي كمالك للعميل
      const clientData = {
        ...formData,
        agent_id: user?.id,
        // إضافة حقل created_by لتتبع من أنشأ العميل
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

  const SUBSCRIPTION_TYPES = [
    { value: 'monthly', label: t('subscription.monthly', 'شهري') },
    { value: 'semi_annual', label: t('subscription.semiannual', 'نصف سنوي') },
    { value: 'annual', label: t('subscription.annual', 'سنوي') },
    { value: 'permanent', label: t('subscription.permanent', 'دائم') },
  ];

  const VERSION_TYPES = [
    { value: 'computer', label: t('customer.pc', 'كمبيوتر') },
    { value: 'android', label: t('customer.android', 'أندرويد') },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-t-lg flex justify-between items-center">
          <h1 className="text-xl font-bold text-white flex items-center">
            {t('nav.addClient', 'إضافة عميل مشترك جديد')}
          </h1>
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-white hover:text-gray-200 ml-2 flex items-center"
              title="الرجوع إلى لوحة التحكم"
            >
              <ArrowRight size={20} />
              <span className="mr-1">لوحة التحكم</span>
            </button>
            <button
              onClick={() => navigate('/clients')}
              className="text-white hover:text-gray-200"
              title="إغلاق"
            >
              <X size={24} />
            </button>
          </div>
        </div>

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
                className="h-12 text-lg" // تكبير حقل الإدخال
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
                className="h-12 text-lg" // تكبير حقل الإدخال
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
                className="h-12 text-lg" // تكبير حقل الإدخال
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
                className="h-12 text-lg" // تكبير حقل الإدخال
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
                className="h-12 text-lg" // تكبير حقل الإدخال
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
                  placeholder="تلقائي"
                  className="h-12 text-lg" // تكبير حقل الإدخال
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePaste}
                  className="flex-shrink-0 h-12" // زيادة ارتفاع الزر
                  children={
                    <span>{t('common.paste', 'لصق')}</span>
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
                  className="h-12 text-lg" // تكبير حقل الاختيار
                  children={
                    SUBSCRIPTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))
                  }
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            } />

            {/* نوع النسخة */}
            <CustomerField label={t('client.softwareVersion', 'نوع النسخة')} children={
              <div className="relative">
                <CustomerSelect
                  name="software_version"
                  value={formData.software_version}
                  onChange={handleChange}
                  required
                  isEditing={true}
                  className="h-12 text-lg" // تكبير حقل الاختيار
                  children={
                    VERSION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))
                  }
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {formData.software_version === 'computer' ? (
                    <Monitor className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Smartphone className="h-5 w-5 text-gray-400" />
                  )}
                </div>
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
                className="h-12 text-lg" // تكبير حقل الإدخال
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
                  className="h-12 text-lg" // تكبير حقل الإدخال
                />
                <input
                  type="hidden"
                  name="subscription_start"
                  value={formData.subscription_start || ''}
                />
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
                  className="h-12 text-lg bg-gray-100" // تكبير حقل الإدخال وتغيير لونه
                />
                <input
                  type="hidden"
                  name="subscription_end"
                  value={formData.subscription_end || ''}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
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
                className="text-lg" // تكبير حقل النص
              />
            } />
          </div>

          {/* أزرار الإرسال */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/clients')}
              className="flex items-center h-12 px-6" // زيادة حجم الزر
              children={
                <span>
                  <X className="h-5 w-5 ml-2" />
                  {t('actions.cancel', 'إلغاء')}
                </span>
              }
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex items-center h-12 px-6" // زيادة حجم الزر
              children={
                <span>
                  <Save className="h-5 w-5 ml-2" />
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