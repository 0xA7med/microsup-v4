import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, Calendar, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { format, parse, isAfter, startOfToday } from 'date-fns';
import CustomerField from '../components/CustomerField';
import CustomerInput from '../components/CustomerInput';
import CustomerSelect from '../components/CustomerSelect';
import CustomerTextArea from '../components/CustomerTextArea';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import type { Client } from '../types/database.types';

export const AddClient: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const today = startOfToday();
  const [dateInputValue, setDateInputValue] = useState('');
  
  const [formData, setFormData] = useState<Partial<Client>>({
    client_name: '',
    organization_name: '',
    activity_type: '',
    phone: '',
    activation_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
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
              value: format(date, 'yyyy-MM-dd')
            }
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
        created_by: user?.id
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
    { value: 'permanent', label: t('subscription.permanent', 'دائم') }
  ];
  
  const VERSION_TYPES = [
    { value: 'computer', label: t('customer.pc', 'كمبيوتر') },
    { value: 'android', label: t('customer.android', 'أندرويد') }
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t('nav.addClient')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Name */}
            <CustomerField label={t('client.name')}>
              <CustomerInput
                type="text"
                name="client_name"
                required
                value={formData.client_name}
                onChange={handleChange}
                isEditing={true}
              />
            </CustomerField>

            {/* Business Name */}
            <CustomerField label={t('client.organization')}>
              <CustomerInput
                type="text"
                name="organization_name"
                required
                value={formData.organization_name}
                onChange={handleChange}
                isEditing={true}
              />
            </CustomerField>

            {/* Business Type */}
            <CustomerField label={t('client.activity')}>
              <CustomerInput
                type="text"
                name="activity_type"
                required
                value={formData.activity_type}
                onChange={handleChange}
                isEditing={true}
              />
            </CustomerField>

            {/* Phone */}
            <CustomerField label={t('client.phone')}>
              <CustomerInput
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                isEditing={true}
                dir="ltr"
              />
            </CustomerField>

            {/* Address */}
            <CustomerField label={t('client.address')}>
              <CustomerInput
                type="text"
                name="address"
                required
                value={formData.address}
                onChange={handleChange}
                isEditing={true}
              />
            </CustomerField>

            {/* Activation Code */}
            <CustomerField label={t('client.activationCode')}>
              <div className="flex gap-2">
                <CustomerInput
                  type="text"
                  name="activation_code"
                  required
                  value={formData.activation_code}
                  onChange={handleChange}
                  isEditing={true}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePaste}
                  className="flex-shrink-0"
                >
                  {t('common.paste', 'لصق')}
                </Button>
              </div>
            </CustomerField>

            {/* Subscription Type */}
            <CustomerField label={t('client.subscriptionType')}>
              <div className="relative">
                <CustomerSelect
                  name="subscription_type"
                  value={formData.subscription_type}
                  onChange={handleChange}
                  required
                  isEditing={true}
                >
                  {SUBSCRIPTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </CustomerSelect>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </CustomerField>

            {/* Version Type */}
            <CustomerField label={t('client.softwareVersion')}>
              <div className="relative">
                <CustomerSelect
                  name="software_version"
                  value={formData.software_version}
                  onChange={handleChange}
                  required
                  isEditing={true}
                >
                  {VERSION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </CustomerSelect>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {formData.software_version === 'computer' ? (
                    <Monitor className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Smartphone className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </CustomerField>

            {/* Device Count */}
            <CustomerField label={t('client.deviceCount')}>
              <CustomerInput
                type="number"
                name="device_count"
                required
                min="1"
                value={String(formData.device_count)}
                onChange={handleChange}
                isEditing={true}
              />
            </CustomerField>

            {/* Subscription Start */}
            <CustomerField label={t('client.subscriptionStart')}>
              <div className="relative">
                <CustomerInput
                  type="text"
                  name="subscriptionStartDisplay"
                  required
                  value={dateInputValue || ''}
                  onChange={(e) => handleDateInput(e.target.value)}
                  isEditing={true}
                  placeholder="DD/MM/YYYY"
                />
                <input
                  type="hidden"
                  name="subscription_start"
                  value={formData.subscription_start || ''}
                />
              </div>
            </CustomerField>

            {/* Notes */}
            <CustomerField label={t('client.notes')} className="md:col-span-2">
              <CustomerTextArea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                isEditing={true}
              />
            </CustomerField>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/clients')}
            className="flex items-center"
          >
            <X className="h-4 w-4 mr-2" />
            {t('actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="flex items-center"
          >
            <Save className="h-4 w-4 mr-2" />
            {t('actions.save')}
          </Button>
        </div>
      </form>
    </div>
  );
};