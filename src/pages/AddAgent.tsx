import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
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
  const [fetchingAgent, setFetchingAgent] = useState(isEditMode);

  // جلب بيانات المندوب في حالة التعديل
  useEffect(() => {
    if (isEditMode) {
      const fetchAgent = async () => {
        try {
          const { data, error } = await supabase
            .from('agents')
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;
          
          if (data) {
            setFormData({
              id: data.id,
              email: data.email,
              name: data.name,
              phone: data.phone || '',
              address: data.address || '',
              role: data.role,
              password: '', // لا نقوم بجلب كلمة المرور لأسباب أمنية
              confirmPassword: '',
            });
          }
        } catch (error: any) {
          console.error('Error fetching agent:', error);
          toast.error('فشل جلب بيانات المندوب');
        } finally {
          setFetchingAgent(false);
        }
      };

      fetchAgent();
    }
  }, [id, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // التحقق من كلمة المرور فقط إذا كنا في وضع الإضافة أو تم تغيير كلمة المرور في وضع التعديل
    if (!isEditMode || (formData.password && formData.password.length > 0)) {
      if (formData.password !== formData.confirmPassword) {
        setError('كلمات المرور غير متطابقة');
        return;
      }
    }

    setLoading(true);

    try {
      // التحقق من وجود المستخدم الحالي
      if (!user) {
        throw new Error('يجب تسجيل الدخول كمدير لإضافة أو تعديل مندوب');
      }

      // تحضير البيانات للإرسال
      const agentData: Record<string, any> = {
        email: formData.email,
        name: formData.name, 
        phone: formData.phone,
        address: formData.address,
        role: formData.role,
      };

      // إضافة كلمة المرور فقط إذا تم تغييرها
      if (formData.password && formData.password.length > 0) {
        agentData.password = formData.password;
      }

      let result;
      
      if (isEditMode) {
        // تحديث المندوب الموجود
        result = await supabase
          .from('agents')
          .update(agentData)
          .eq('id', id);
        
        if (result.error) throw result.error;
        
        toast.success('تم تحديث بيانات المندوب بنجاح');
      } else {
        // إضافة created_by فقط عند إنشاء مندوب جديد
        agentData.created_by = user.id;
        
        // إنشاء مندوب جديد
        result = await supabase
          .from('agents')
          .insert(agentData);
        
        if (result.error) throw result.error;
        
        toast.success('تم إضافة المندوب بنجاح');
      }
      
      navigate('/agents');
    } catch (err: any) {
      console.error('Error saving agent:', err);
      toast.error(err.message || 'حدث خطأ أثناء حفظ بيانات المندوب');
      setError(err.message || 'حدث خطأ أثناء حفظ بيانات المندوب');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prevState: typeof formData) => ({
      ...prevState,
      [name]: value,
    }));
  };

  if (fetchingAgent) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-t-lg flex justify-between items-center">
          <h1 className="text-xl font-bold text-white flex items-center">
            {isEditMode ? (
              <>
                <UserCog className="ml-2" size={24} />
                تعديل بيانات المندوب
              </>
            ) : (
              <>
                <UserPlus className="ml-2" size={24} />
                إضافة مندوب
              </>
            )}
          </h1>
          <button 
            onClick={() => navigate('/agents')}
            className="text-white hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <AgentField label="الاسم الكامل" children={
                <AgentInput
                  icon={<User />}
                  name="name"
                  placeholder="اسم المندوب"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              } />
            </div>
            
            <div>
              <AgentField label="البريد الإلكتروني" children={
                <AgentInput
                  icon={<Mail />}
                  name="email"
                  type="email"
                  placeholder="example@mail.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              } />
            </div>
            
            <div>
              <AgentField label="رقم الهاتف" children={
                <AgentInput
                  icon={<Phone />}
                  name="phone"
                  placeholder="رقم الهاتف"
                  value={formData.phone}
                  onChange={handleChange}
                />
              } />
            </div>
            
            <div>
              <AgentField label="العنوان" children={
                <AgentInput
                  icon={<MapPin />}
                  name="address"
                  placeholder="العنوان"
                  value={formData.address}
                  onChange={handleChange}
                />
              } />
            </div>
            
            <div>
              <AgentField label="الدور" children={
                <AgentSelect
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  children={
                    <>
                      <option value="agent">مندوب</option>
                      <option value="admin">مدير</option>
                    </>
                  }
                />
              } />
            </div>
            
            <div>
              <AgentField label={isEditMode ? "كلمة المرور الجديدة (اترك فارغة للاحتفاظ بنفس كلمة المرور)" : "كلمة المرور"} children={
                <AgentInput
                  icon={<Lock />}
                  name="password"
                  type="password"
                  placeholder="كلمة المرور"
                  value={formData.password}
                  onChange={handleChange}
                  required={!isEditMode}
                />
              } />
            </div>
            
            <div>
              <AgentField label={isEditMode ? "تأكيد كلمة المرور الجديدة" : "تأكيد كلمة المرور"} children={
                <AgentInput
                  icon={<Lock />}
                  name="confirmPassword"
                  type="password"
                  placeholder="تأكيد كلمة المرور"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required={!isEditMode}
                />
              } />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 ml-2"
              onClick={() => navigate('/agents')}
            >
              إلغاء
            </button>
            
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  جاري المعالجة...
                </span>
              ) : (
                isEditMode ? 'حفظ التغييرات' : 'إضافة المندوب'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};