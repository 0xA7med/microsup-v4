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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === 'email') {
      setEmail(e.target.value);
    } else if (e.target.name === 'password') {
      setPassword(e.target.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      // استخدام رسالة الخطأ المحددة من authStore إذا كانت متوفرة
      if (err && err.message) {
        setError(err.message);
      } else {
        setError(t('auth.invalidCredentials'));
      }
      console.error('خطأ تسجيل الدخول:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterData({
      ...registerData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterLoading(true);
    
    try {
      // التحقق من الحقول المطلوبة
      const requiredFields = [
        { field: 'name', label: 'الاسم' },
        { field: 'email', label: 'البريد الإلكتروني' },
        { field: 'password', label: 'كلمة المرور' },
        { field: 'confirmPassword', label: 'تأكيد كلمة المرور' },
        { field: 'phone', label: 'رقم الهاتف' }
      ];
      
      for (const { field, label } of requiredFields) {
        if (!registerData[field as keyof typeof registerData]) {
          setRegisterError(`الرجاء إدخال ${label}`);
          setRegisterLoading(false);
          return;
        }
      }
      
      // التحقق من صحة البريد الإلكتروني
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(registerData.email)) {
        setRegisterError('الرجاء إدخال بريد إلكتروني صحيح');
        setRegisterLoading(false);
        return;
      }
      
      // التحقق من تطابق كلمات المرور
      if (registerData.password !== registerData.confirmPassword) {
        setRegisterError('كلمات المرور غير متطابقة');
        setRegisterLoading(false);
        return;
      }
      
      // تسجيل بيانات النموذج للتشخيص
      console.log('بيانات التسجيل:', {
        ...registerData,
        password: '*****', // إخفاء كلمة المرور للأمان
        confirmPassword: '*****'
      });
      
      // 1. التحقق من وجود المستخدم في جدول agents قبل التسجيل
      const checkResponse = await supabase
        .from('agents')
        .select('id')
        .eq('email', registerData.email)
        .maybeSingle();
      
      // تسجيل استجابة التحقق
      console.log('استجابة التحقق من البريد الإلكتروني:', checkResponse);
      
      if (checkResponse.error) {
        console.error('خطأ في التحقق من وجود المستخدم:', checkResponse.error);
        throw new Error(`خطأ في التحقق من وجود المستخدم: ${checkResponse.error.message}`);
      }
      
      if (checkResponse.data) {
        throw new Error('البريد الإلكتروني مستخدم بالفعل');
      }
      
      // 2. إنشاء UUID جديد للمستخدم باستخدام طريقة بسيطة
      const userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, 
              v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      console.log('تم إنشاء معرف المستخدم:', userId);
      
      // 3. تحضير بيانات المندوب
      const agentData = {
        id: userId,
        email: registerData.email,
        name: registerData.name,
        role: 'agent',
        phone: registerData.phone, // إزالة القيمة الاحتمالية null لأن الحقل مطلوب
        address: registerData.address || null,
        approval_status: 'pending',
        password: registerData.password
        // ملاحظة: تم إزالة is_active لأنه غير موجود في قاعدة البيانات
      };
      
      console.log('بيانات المندوب للإدراج:', {
        ...agentData,
        password: '*****' // إخفاء كلمة المرور للأمان
      });
      
      // 4. إضافة المندوب إلى جدول agents
      try {
        const insertResponse = await supabase
          .from('agents')
          .insert(agentData)
          .select();
        
        console.log('استجابة إدراج المندوب:', insertResponse);
        
        if (insertResponse.error) {
          // تسجيل تفاصيل الخطأ
          console.error('خطأ في إدراج المندوب:', {
            message: insertResponse.error.message,
            details: insertResponse.error.details,
            hint: insertResponse.error.hint,
            code: insertResponse.error.code
          });
          
          throw new Error(`فشل إضافة المندوب: ${insertResponse.error.message || 'خطأ غير معروف'}`);
        }
        
        if (!insertResponse.data || insertResponse.data.length === 0) {
          console.error('لم يتم إرجاع بيانات بعد الإدراج');
          throw new Error('فشل إضافة المندوب: لم يتم إرجاع بيانات');
        }
        
        // 5. نجاح العملية
        console.log('تم إضافة المندوب بنجاح:', insertResponse.data[0].id);
        
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
      } catch (insertError: any) {
        console.error('خطأ في عملية إدراج المندوب:', insertError);
        throw insertError; // إعادة إلقاء الخطأ ليتم التقاطه في كتلة الـ catch الخارجية
      }
    } catch (err: any) {
      // تحسين طريقة عرض الخطأ
      console.error('Error registering agent:', err);
      
      // محاولة تسجيل تفاصيل الخطأ بطريقة آمنة
      try {
        const errorProps: Record<string, unknown> = {};
        // الحصول على جميع خصائص الخطأ
        Object.getOwnPropertyNames(err).forEach(prop => {
          errorProps[prop] = err[prop as keyof typeof err];
        });
        console.log('تفاصيل الخطأ:', JSON.stringify(errorProps, null, 2));
      } catch (jsonError) {
        console.error('فشل تحويل الخطأ إلى JSON:', jsonError);
      }
      
      // التعامل مع أنواع مختلفة من الأخطاء
      let errorMessage = 'حدث خطأ أثناء تسجيل الحساب';
      
      if (err.message) {
        errorMessage = err.message;
      }
      
      // التحقق من أخطاء محددة
      if (err.code === '23505' || (err.message && err.message.includes('duplicate key'))) {
        errorMessage = 'البريد الإلكتروني مستخدم بالفعل. الرجاء استخدام بريد إلكتروني آخر.';
      }
      
      // التحقق من أخطاء not-null constraint
      if (err.code === '23502' || (err.message && err.message.includes('violates not-null constraint'))) {
        const columnMatch = err.message.match(/column "([^"]+)"/);
        const columnName = columnMatch ? columnMatch[1] : null;
        
        if (columnName === 'phone') {
          errorMessage = 'يجب إدخال رقم الهاتف';
        } else if (columnName) {
          // ترجمة أسماء الأعمدة إلى العربية
          const columnLabels: {[key: string]: string} = {
            'name': 'الاسم',
            'email': 'البريد الإلكتروني',
            'password': 'كلمة المرور',
            'address': 'العنوان'
          };
          errorMessage = `يجب إدخال ${columnLabels[columnName] || columnName}`;
        } else {
          errorMessage = 'يرجى التأكد من إدخال جميع البيانات المطلوبة';
        }
      }
      
      // التحقق من أخطاء الاتصال
      if (err.code === 'PGRST301' || (err.message && err.message.includes('connection'))) {
        errorMessage = 'فشل الاتصال بقاعدة البيانات. الرجاء التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';
      }
      
      // تحسين رسائل الخطأ العامة
      if (errorMessage.includes('خطأ في التحقق من وجود المستخدم')) {
        errorMessage = 'حدث خطأ أثناء التحقق من البريد الإلكتروني. الرجاء المحاولة مرة أخرى.';
      }
      
      if (errorMessage.includes('فشل إضافة المندوب')) {
        errorMessage = 'حدث خطأ أثناء إنشاء الحساب. الرجاء التأكد من إدخال جميع البيانات المطلوبة والمحاولة مرة أخرى.';
      }
      
      setRegisterError(errorMessage);
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
          {showRegister ? t('app.register', 'تسجيل مندوب جديد') : t('app.login', 'تسجيل الدخول')}
        </h2>
        
        {registerSuccess ? (
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg mb-6">
            <h3 className="font-bold text-green-700 dark:text-green-300 mb-2">تم إنشاء الحساب بنجاح!</h3>
            <p className="text-green-600 dark:text-green-400 mb-4">
              {t('auth.registerSuccess')}
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
                {t('auth.fullName')}
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
                {t('auth.email')}
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
                {t('auth.phone')}
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
                {t('auth.address')}
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
                {t('auth.password')}
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
                {t('auth.confirmPassword')}
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
                t('auth.register')
              )}
            </button>
            
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={toggleForm}
                className="text-sm text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 flex items-center justify-center w-full"
              >
                <ArrowRight className="ml-1 w-4 h-4" />
                {t('auth.backToLogin')}
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
                    name="email"
                    value={email}
                    onChange={handleChange}
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
                    name="password"
                    value={password}
                    onChange={handleChange}
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
                {t('auth.noAccount')}
              </p>
              <button
                onClick={toggleForm}
                className="w-full flex justify-center items-center py-2 px-4 border border-purple-300 dark:border-purple-700 rounded-md shadow-sm text-sm font-medium text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <UserPlus className="ml-2 w-4 h-4" />
                {t('auth.register')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};