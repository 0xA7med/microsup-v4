import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, Mail, Lock, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<UserType> & { password: string; confirmPassword: string }>({
    email: '',
    full_name: '',
    phone: '',
    address: '',
    role: 'agent', // القيمة الافتراضية هي مندوب
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
      // التحقق من وجود المستخدم الحالي
      if (!user) {
        throw new Error('يجب تسجيل الدخول كمدير لإضافة مندوب جديد');
      }

      // إنشاء المستخدم في جدول agents مباشرة
      const { error: agentError } = await supabase
        .from('agents')
        .insert({
          email: formData.email,
          name: formData.full_name,
          phone: formData.phone,
          address: formData.address,
          role: formData.role,
          password: formData.password, // سيتم تشفير كلمة المرور في قاعدة البيانات
          created_by: user.id
        });

      if (agentError) {
        console.error('خطأ في إنشاء المندوب:', agentError);
        throw agentError;
      }

      // نجاح العملية
      navigate('/agents');
    } catch (err: any) {
      console.error('Error adding agent:', err);
      setError(err.message || 'حدث خطأ أثناء إضافة المندوب');
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
    <div className="h-full w-full flex flex-col">
      <div className="bg-slate-800 dark:bg-slate-900 p-4 rounded-lg m-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white flex items-center">
          <UserPlus className="mr-2" size={24} />
          إضافة مندوب
        </h1>
        <div className="text-sm text-slate-400">
          أدخل معلومات المندوب
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 mx-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      <div className="bg-slate-800 dark:bg-slate-900 p-4 rounded-lg m-4">
        <h2 className="text-lg font-semibold text-white mb-4">المعلومات الشخصية</h2>
        <p className="text-sm text-slate-400 mb-6">أدخل معلومات المندوب</p>

        <div className="space-y-6">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-300 mb-2">
              الاسم الكامل
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="bg-slate-700 text-white block w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل الاسم الكامل للمندوب"
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
              رقم الهاتف
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="bg-slate-700 text-white block w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل رقم الهاتف"
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-2">
              العنوان
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="bg-slate-700 text-white block w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل العنوان"
                dir="rtl"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 dark:bg-slate-900 p-4 rounded-lg m-4">
        <h2 className="text-lg font-semibold text-white mb-4">معلومات الحساب</h2>

        <div className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              اسم المستخدم
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-slate-700 text-white block w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل البريد الإلكتروني"
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-2">
              الدور
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="bg-slate-700 text-white block w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="rtl"
            >
              <option value="agent">مندوب</option>
              <option value="admin">مدير</option>
            </select>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="bg-slate-700 text-white block w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل كلمة المرور"
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
              تأكيد كلمة المرور
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="bg-slate-700 text-white block w-full pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل تأكيد كلمة المرور"
                dir="rtl"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center space-x-4 m-4">
        <button
          type="button"
          onClick={() => navigate('/agents')}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center"
        >
          <X className="mr-2" size={16} />
          إلغاء
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center"
        >
          <UserPlus className="mr-2" size={16} />
          {loading ? 'جاري الإضافة...' : 'إضافة مندوب'}
        </button>
      </div>
    </div>
  );
};