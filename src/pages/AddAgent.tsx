import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// تعريف نوع المستخدم
interface UserType {
  id?: string;
  email?: string;
  name?: string;
  full_name?: string;
  phone?: string;
  address?: string;
  role?: string;
}

export const AddAgent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<UserType> & { password: string; confirmPassword: string }>({
    email: '',
    full_name: '',
    phone: '',
    address: '',
    role: 'agent',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }

    setLoading(true);

    try {
      // أولاً، إنشاء المستخدم في نظام المصادقة (auth.users)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email!,
        password: formData.password!,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role,
          },
        },
      });

      if (signUpError) {
        console.error('خطأ في إنشاء المستخدم في نظام المصادقة:', signUpError);
        throw signUpError;
      }

      if (!authData.user?.id) {
        throw new Error('فشل في إنشاء المستخدم: لم يتم إرجاع معرف المستخدم');
      }

      // إضافة تأخير قصير للتأكد من اكتمال عملية إنشاء المستخدم في auth.users
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ثانياً، إنشاء سجل في جدول المستخدمين المخصص
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          name: formData.full_name, // استخدام name بدلاً من full_name
          role: formData.role,
          phone: formData.phone,
          address: formData.address
        });

      if (userError) {
        console.error('خطأ في إنشاء المستخدم في جدول users:', userError);
        
        // محاولة إنشاء المستخدم مرة أخرى بعد تأخير إضافي
        if (userError.code === '23503' && userError.message.includes('users_id_fkey')) {
          // تأخير إضافي
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // محاولة ثانية
          const { error: retryError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: formData.email,
              name: formData.full_name,
              role: formData.role,
              phone: formData.phone,
              address: formData.address
            });
            
          if (retryError) {
            console.error('فشلت المحاولة الثانية لإنشاء المستخدم:', retryError);
            throw retryError;
          }
        } else {
          throw userError;
        }
      }

      // ثالثاً، إنشاء سجل في جدول المندوبين
      const { error: profileError } = await supabase
        .from('agents')
        .insert({
          id: authData.user?.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address,
          role: formData.role,
        });

      if (profileError) throw profileError;

      navigate('/agents');
    } catch (err) {
      console.error('Error adding agent:', err);
      setError('Failed to create agent account');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t('nav.addAgent')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('agent.fullName')}
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('agent.username')}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('agent.phone')}
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('agent.address')}
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('agent.password')}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('agent.confirmPassword')}
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/agents')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <X className="h-4 w-4 mr-2" />
            {t('actions.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Save className="h-4 w-4 mr-2" />
            {t('actions.save')}
          </button>
        </div>
      </form>
    </div>
  );
};