import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, AlertCircle, UserPlus, Mail, Phone, MapPin, Lock, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const signIn = useAuthStore((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  
  // حقول نموذج التسجيل
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: ''
  });
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterLoading(true);
    
    // التحقق من تطابق كلمات المرور
    if (registerData.password !== registerData.confirmPassword) {
      setRegisterError('كلمات المرور غير متطابقة');
      setRegisterLoading(false);
      return;
    }
    
    try {
      // إنشاء حساب مستخدم في نظام المصادقة
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registerData.email,
        password: registerData.password,
        options: {
          data: {
            name: registerData.name,
            role: 'agent'
          }
        }
      });
      
      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('فشل إنشاء حساب المستخدم');
      }
      
      // إضافة المندوب إلى جدول agents مع حالة موافقة معلقة
      const { error: agentError } = await supabase
        .from('agents')
        .insert({
          id: authData.user.id,
          email: registerData.email,
          name: registerData.name,
          role: 'agent',
          phone: registerData.phone || null,
          address: registerData.address || null,
          approval_status: 'pending'
        });
      
      if (agentError) {
        console.error('تم إنشاء حساب المستخدم ولكن فشل إضافة المندوب:', agentError);
        throw new Error('تم إنشاء حساب المستخدم ولكن فشل إضافة المندوب إلى قاعدة البيانات');
      }
      
      // إظهار رسالة نجاح
      setRegisterSuccess(true);
      toast.success('تم إنشاء الحساب بنجاح! بانتظار موافقة المدير');
      
      // إعادة تعيين نموذج التسجيل
      setRegisterData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        address: ''
      });
      
    } catch (err: any) {
      console.error('Error registering agent:', err);
      setRegisterError(err.message || 'حدث خطأ أثناء تسجيل الحساب');
    } finally {
      setRegisterLoading(false);
    }
  };
  
  const toggleForm = () => {
    setShowRegister(!showRegister);
    setError('');
    setRegisterError('');
    setRegisterSuccess(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 dark:from-purple-900 dark:to-blue-800 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
            {showRegister ? (
              <UserPlus className="w-8 h-8 text-purple-600 dark:text-purple-300" />
            ) : (
              <User className="w-8 h-8 text-purple-600 dark:text-purple-300" />
            )}
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
          {t('app.name')}
        </h1>
        <h2 className="text-center text-gray-600 dark:text-gray-400 mb-6">
          {showRegister ? t('app.register', 'تسجيل حساب جديد') : t('app.login', 'تسجيل الدخول')}
        </h2>
        
        {registerSuccess ? (
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg mb-6">
            <h3 className="font-bold text-green-700 dark:text-green-300 mb-2">تم إنشاء الحساب بنجاح!</h3>
            <p className="text-green-600 dark:text-green-400 mb-4">
              تم إرسال طلب تسجيلك إلى المدير للموافقة عليه. سيتم إعلامك عند الموافقة على حسابك.
            </p>
            <button
              onClick={toggleForm}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <ArrowLeft className="ml-2 w-4 h-4" />
              العودة إلى تسجيل الدخول
            </button>
          </div>
        ) : showRegister ? (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                الاسم الكامل
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={registerData.name}
                  onChange={handleRegisterChange}
                  className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                البريد الإلكتروني
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                رقم الهاتف
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={registerData.phone}
                  onChange={handleRegisterChange}
                  className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                العنوان
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="address"
                  value={registerData.address}
                  onChange={handleRegisterChange}
                  className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                كلمة المرور
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                تأكيد كلمة المرور
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  name="confirmPassword"
                  value={registerData.confirmPassword}
                  onChange={handleRegisterChange}
                  className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
            </div>

            {registerError && (
              <div className="flex items-center p-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/50 dark:text-red-300">
                <AlertCircle className="w-5 h-5 ml-2 inline" />
                <span>{registerError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={registerLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registerLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'تسجيل حساب جديد'
              )}
            </button>
            
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={toggleForm}
                className="text-sm text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 flex items-center justify-center w-full"
              >
                <ArrowRight className="ml-1 w-4 h-4" />
                العودة إلى تسجيل الدخول
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('agent.username')}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('agent.password')}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center p-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/50 dark:text-red-300">
                  <AlertCircle className="w-5 h-5 ml-2 inline" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  t('app.login')
                )}
              </button>
            </form>
            
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-3">
                ليس لديك حساب؟
              </p>
              <button
                onClick={toggleForm}
                className="w-full flex justify-center items-center py-2 px-4 border border-purple-300 dark:border-purple-700 rounded-md shadow-sm text-sm font-medium text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <UserPlus className="ml-2 w-4 h-4" />
                تسجيل حساب جديد
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};