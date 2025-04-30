import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import MFASetup from '../components/auth/MFASetup';
import { Button } from '../components/Button';

// الترجمات
const translations = {
  ar: {
    title: 'إعدادات الأمان',
    passwordSection: 'تغيير كلمة المرور',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور الجديدة',
    updatePassword: 'تحديث كلمة المرور',
    passwordMismatch: 'كلمات المرور غير متطابقة',
    passwordUpdated: 'تم تحديث كلمة المرور بنجاح',
    passwordError: 'حدث خطأ أثناء تحديث كلمة المرور',
    mfaSection: 'المصادقة الثنائية',
    backToSettings: 'العودة للإعدادات',
    passwordRequirements: 'متطلبات كلمة المرور:',
    minLength: '8 أحرف على الأقل',
    hasUppercase: 'حرف كبير واحد على الأقل',
    hasLowercase: 'حرف صغير واحد على الأقل',
    hasNumber: 'رقم واحد على الأقل',
    hasSpecial: 'رمز خاص واحد على الأقل',
  },
  en: {
    title: 'Security Settings',
    passwordSection: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm New Password',
    updatePassword: 'Update Password',
    passwordMismatch: 'Passwords do not match',
    passwordUpdated: 'Password updated successfully',
    passwordError: 'Error updating password',
    mfaSection: 'Two-Factor Authentication',
    backToSettings: 'Back to Settings',
    passwordRequirements: 'Password requirements:',
    minLength: 'At least 8 characters',
    hasUppercase: 'At least one uppercase letter',
    hasLowercase: 'At least one lowercase letter',
    hasNumber: 'At least one number',
    hasSpecial: 'At least one special character',
  }
};

const SecuritySettings: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [language, setLanguage] = useState<'ar' | 'en'>('ar'); // الافتراضي هو العربية
  const t = translations[language];
  const navigate = useNavigate();

  // التحقق من حالة تسجيل الدخول
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        navigate('/login');
      }
    };
    
    getUser();
  }, [navigate]);

  // التحقق من قوة كلمة المرور
  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial
    };
  };

  const passwordValidation = validatePassword(newPassword);

  // تحديث كلمة المرور
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t.passwordMismatch });
      return;
    }
    
    if (!passwordValidation.isValid) {
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        throw error;
      }
      
      setMessage({ type: 'success', text: t.passwordUpdated });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t.passwordError });
    } finally {
      setLoading(false);
    }
  };

  // تبديل اللغة
  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 dir-rtl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t.title}</h1>
        <Button onClick={toggleLanguage} variant="secondary" size="sm">
          {language === 'ar' ? 'English' : 'العربية'}
        </Button>
      </div>
      
      <div className="grid grid-cols-12 gap-8">
        {/* قسم تغيير كلمة المرور */}
        <div className="col-span-12 md:col-span-6 space-y-6 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.passwordSection}</h2>
          
          {message && (
            <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}
          
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.currentPassword}
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.newPassword}
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.confirmPassword}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* متطلبات كلمة المرور */}
            {newPassword.length > 0 && (
              <div className="text-sm space-y-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium">{t.passwordRequirements}</p>
                <ul className="space-y-1">
                  <li className={passwordValidation.minLength ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {t.minLength}
                  </li>
                  <li className={passwordValidation.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {t.hasUppercase}
                  </li>
                  <li className={passwordValidation.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {t.hasLowercase}
                  </li>
                  <li className={passwordValidation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {t.hasNumber}
                  </li>
                  <li className={passwordValidation.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {t.hasSpecial}
                  </li>
                </ul>
              </div>
            )}
            
            <div className="pt-2">
              <Button
                type="submit"
                isLoading={loading}
                disabled={loading || !passwordValidation.isValid || newPassword !== confirmPassword}
                variant="primary"
                fullWidth
              >
                {t.updatePassword}
              </Button>
            </div>
          </form>
        </div>
        
        {/* قسم المصادقة الثنائية */}
        <div className="col-span-12 md:col-span-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t.mfaSection}</h2>
          <MFASetup userId={user.id} />
        </div>
      </div>
      
      <div className="mt-8">
        <Button onClick={() => navigate('/settings')} variant="secondary">
          {t.backToSettings}
        </Button>
      </div>
    </div>
  );
};

export default SecuritySettings;
