import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, Mail, Lock, UserPlus, X, UserCog } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import AgentField from '../components/AgentField';
import AgentInput from '../components/AgentInput';
import AgentSelect from '../components/AgentSelect';
import toast from 'react-hot-toast';

// تعريف نوع المندوب
interface AgentType {
  id?: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  role: string;
  password?: string;
  created_by?: string;
  created_at?: string;
}

export const AddAgent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AgentType & { confirmPassword: string }>({
    email: '',
    name: '', 
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
      // التحقق من وجود المستخدم الحالي
      if (!user) {
        throw new Error('يجب تسجيل الدخول كمدير لإضافة مندوب جديد');
      }

      // إنشاء المندوب في جدول agents مباشرة
      const { error: agentError } = await supabase
        .from('agents')
        .insert({
          email: formData.email,
          name: formData.name, 
          phone: formData.phone,
          address: formData.address,
          role: formData.role,
          password: formData.password, 
          created_by: user.id
        });

      if (agentError) {
        console.error('خطأ في إنشاء المندوب:', agentError);
        throw agentError;
      }

      // نجاح العملية
      toast.success('تم إضافة المندوب بنجاح');
      navigate('/agents');
    } catch (err: any) {
      console.error('Error adding agent:', err);
      toast.error(err.message || 'حدث خطأ أثناء إضافة المندوب');
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
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-t-lg flex justify-between items-center">
          <h1 className="text-xl font-bold text-white flex items-center">
            <UserPlus className="ml-2" size={24} />
            إضافة مندوب
          </h1>
          <div className="text-sm text-white/80">
            أدخل معلومات المندوب
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-r-4 border-red-500 text-red-700 dark:text-red-200 p-4 m-4">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
              <User className="ml-2" size={20} />
              المعلومات الشخصية
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">أدخل معلومات المندوب</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AgentField label="الاسم الكامل">
                <AgentInput
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="أدخل الاسم الكامل للمندوب"
                  icon={<User className="h-5 w-5 text-gray-400" />}
                  required
                />
              </AgentField>

              <AgentField label="رقم الهاتف">
                <AgentInput
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="أدخل رقم الهاتف"
                  icon={<Phone className="h-5 w-5 text-gray-400" />}
                />
              </AgentField>

              <AgentField label="العنوان" className="md:col-span-2">
                <AgentInput
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="أدخل العنوان"
                  icon={<MapPin className="h-5 w-5 text-gray-400" />}
                />
              </AgentField>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
              <UserCog className="ml-2" size={20} />
              معلومات الحساب
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AgentField label="البريد الإلكتروني">
                <AgentInput
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="أدخل البريد الإلكتروني"
                  icon={<Mail className="h-5 w-5 text-gray-400" />}
                  required
                />
              </AgentField>

              <AgentField label="الدور">
                <AgentSelect
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  icon={<UserCog className="h-5 w-5 text-gray-400" />}
                  required
                >
                  <option value="agent">مندوب</option>
                  <option value="admin">مدير</option>
                </AgentSelect>
              </AgentField>

              <AgentField label="كلمة المرور">
                <AgentInput
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="أدخل كلمة المرور"
                  icon={<Lock className="h-5 w-5 text-gray-400" />}
                  required
                />
              </AgentField>

              <AgentField label="تأكيد كلمة المرور">
                <AgentInput
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="أدخل تأكيد كلمة المرور"
                  icon={<Lock className="h-5 w-5 text-gray-400" />}
                  required
                />
              </AgentField>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <button
              type="button"
              onClick={() => navigate('/agents')}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center"
            >
              <X className="ml-2" size={16} />
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center"
            >
              <UserPlus className="ml-2" size={16} />
              {loading ? 'جاري الإضافة...' : 'إضافة مندوب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};