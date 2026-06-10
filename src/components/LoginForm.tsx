import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  UserPlus,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// ─── Types ──────────────────────────────────────────────────────────
type AuthView = 'login' | 'register' | 'forgot-password' | 'register-success' | 'forgot-success';

type PasswordStrength = {
  label: string;
  color: string;
  bg: string;
  width: string;
};

// ─── Password strength calculator ───────────────────────────────────
function getPasswordStrength(pw: string): PasswordStrength {
  const len = pw.length;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);

  const types = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (len >= 12 && types >= 3) return { label: 'قوية جداً', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', width: '100%' };
  if (len >= 8 && types >= 2) return { label: 'قوية', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500', width: '75%' };
  if (len >= 6 && types >= 1) return { label: 'متوسطة', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', width: '50%' };
  if (len >= 1) return { label: 'ضعيفة', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', width: '25%' };
  return { label: '', color: '', bg: '', width: '0%' };
}

// ─── Fade‑in wrapper ────────────────────────────────────────────────
const FadeIn = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <div className={`animate-scale-in ${className}`}>{children}</div>
);

// ─── Form field (icon + input + optional toggle) ────────────────────
interface FormFieldProps {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  required?: boolean;
  error?: string;
  placeholder?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  autoComplete?: string;
  rightElement?: React.ReactNode;
}

const FormField = ({
  label, name, type, value, onChange, icon, required, error, placeholder,
  dir, autoComplete, rightElement,
}: FormFieldProps) => (
  <div className="space-y-1.5">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      {required && <span className="text-red-500 me-1">*</span>}
    </label>
    <div className="relative">
      {/* Left icon */}
      <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none z-10">
        <span className="text-gray-400 dark:text-gray-500 transition-colors duration-200 group-focus-within:text-purple-500">
          {icon}
        </span>
      </div>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        dir={dir}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`
          ps-10 block w-full px-3 py-2.5 text-sm
          bg-white dark:bg-gray-800/80
          border border-gray-300 dark:border-gray-600
          rounded-xl shadow-sm
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500
          dark:focus:border-purple-400
          transition-all duration-200
          ${error ? 'border-red-400 dark:border-red-500 focus:ring-red-500/40 focus:border-red-500' : ''}
          ${rightElement ? 'pe-10' : 'pe-3'}
        `}
      />

      {/* Right element (toggle, etc.) */}
      {rightElement && (
        <div className="absolute inset-y-0 end-0 pe-2 flex items-center z-10">
          {rightElement}
        </div>
      )}
    </div>
    {error && (
      <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>
    )}
  </div>
);

// ─── Password strength bar ──────────────────────────────────────────
const PasswordStrengthBar = ({ password }: { password: string }) => {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${strength.bg}`}
          style={{ width: strength.width }}
        />
      </div>
      <p className={`text-xs ${strength.color} font-medium`}>
        {strength.label}
      </p>
    </div>
  );
};

// ─── Animated checkmark ─────────────────────────────────────────────
const AnimatedCheckmark = () => (
  <div className="flex items-center justify-center">
    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center animate-checkmark">
      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
    </div>
  </div>
);

// ─── Submit button ──────────────────────────────────────────────────
interface SubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
}

const SubmitButton = ({ loading, label, loadingLabel }: SubmitButtonProps) => (
  <button
    type="submit"
    disabled={loading}
    className={`
      w-full flex justify-center items-center gap-2 py-2.5 px-4
      rounded-xl text-sm font-semibold text-white
      bg-gradient-to-l from-purple-600 to-blue-500
      hover:from-purple-500 hover:to-blue-400
      focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 dark:focus:ring-offset-gray-900
      disabled:opacity-60 disabled:cursor-not-allowed
      transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30
    `}
  >
    {loading ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{loadingLabel || 'جارٍ المعالجة…'}</span>
      </>
    ) : label}
  </button>
);

// ─── Link button (text link) ────────────────────────────────────────
interface LinkButtonProps {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}

const LinkButton = ({ onClick, label, icon }: LinkButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 transition-colors duration-200"
  >
    {icon}
    {label}
  </button>
);

// ─── Animated background with floating orbs ─────────────────────────
const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    {/* Base gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900" />

    {/* Subtle grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }}
    />

    {/* Floating orbs */}
    <div
      className="absolute -top-40 -end-40 w-[500px] h-[500px] rounded-full opacity-20 animate-float"
      style={{
        background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)',
        animationDelay: '0s',
      }}
    />
    <div
      className="absolute -bottom-40 -start-40 w-[600px] h-[600px] rounded-full opacity-15"
      style={{
        background: 'radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)',
        animation: 'float 8s ease-in-out infinite',
        animationDelay: '-3s',
      }}
    />
    <div
      className="absolute top-1/2 start-1/3 w-[400px] h-[400px] rounded-full opacity-10"
      style={{
        background: 'radial-gradient(circle, rgba(168,85,247,0.3), transparent 70%)',
        animation: 'float 10s ease-in-out infinite',
        animationDelay: '-6s',
      }}
    />
    <div
      className="absolute bottom-1/4 end-1/4 w-[300px] h-[300px] rounded-full opacity-10"
      style={{
        background: 'radial-gradient(circle, rgba(34,211,238,0.2), transparent 70%)',
        animation: 'float 7s ease-in-out infinite',
        animationDelay: '-2s',
      }}
    />
  </div>
);

// ─── Decorative top brand bar ───────────────────────────────────────
const BrandBar = () => (
  <div className="flex flex-col items-center mb-6">
    {/* Logo icon */}
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 mb-4">
      <span className="text-white text-xl font-extrabold font-heading">M</span>
    </div>
    <h1 className="text-xl font-extrabold font-heading text-gray-900 dark:text-white tracking-tight">
      MicroSUB
    </h1>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-body">
      نظام إدارة المندوبين ونقاط البيع
    </p>
  </div>
);

// ─── Success message shared component ───────────────────────────────
const SuccessMessage = ({
  title, message, buttonLabel, onButtonClick
}: {
  title: string;
  message: string;
  buttonLabel: string;
  onButtonClick: () => void;
}) => (
  <FadeIn className="text-center py-4">
    <AnimatedCheckmark />
    <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-white mt-4 mb-2">
      {title}
    </h2>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
      {message}
    </p>
    <button
      type="button"
      onClick={onButtonClick}
      className="
        inline-flex items-center gap-2 py-2.5 px-6
        rounded-xl text-sm font-semibold text-white
        bg-gradient-to-l from-purple-600 to-blue-500
        hover:from-purple-500 hover:to-blue-400
        transition-all duration-200
        shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30
      "
    >
      <ArrowLeft className="w-4 h-4" />
      {buttonLabel}
    </button>
  </FadeIn>
);

// ─── Error alert ─────────────────────────────────────────────────────
const ErrorAlert = ({ message, onClose }: { message: string; onClose?: () => void }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 animate-scale-in">
    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
    <p className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</p>
    {onClose && (
      <button type="button" onClick={onClose} className="text-red-400 hover:text-red-600 transition-colors">
        <span className="text-lg leading-none">&times;</span>
      </button>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const signIn = useAuthStore((state) => state.signIn);

  // ─── View state ──────────────────────────────────────────────
  const [view, setView] = useState<AuthView>('login');
  const [animKey, setAnimKey] = useState(0);

  const navigateTo = useCallback((v: AuthView) => {
    setAnimKey((k) => k + 1);
    setView(v);
  }, []);

  // ─── Login state ─────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ─── Register state ──────────────────────────────────────────
  const [reg, setReg] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // ─── Forgot password state ───────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // ─── Validation helpers ──────────────────────────────────────
  const emailError = useMemo(() => {
    if (!email) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'البريد الإلكتروني غير صحيح';
  }, [email]);

  const passwordsMatch = reg.password === reg.confirmPassword;
  const confirmError = reg.confirmPassword && !passwordsMatch ? 'كلمات المرور غير متطابقة' : '';

  // ─── Handlers ────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err?.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);

    try {
      if (!reg.name || !reg.email || !reg.password || !reg.phone) {
        throw new Error('الرجاء إدخال جميع الحقول المطلوبة');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) {
        throw new Error('الرجاء إدخال بريد إلكتروني صحيح');
      }
      if (reg.password.length < 6) {
        throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      }
      if (reg.password !== reg.confirmPassword) {
        throw new Error('كلمات المرور غير متطابقة');
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: reg.email,
        password: reg.password,
        options: {
          data: {
            name: reg.name,
            phone: reg.phone,
            address: reg.address || null,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already exists')) {
          throw new Error('البريد الإلكتروني مستخدم بالفعل');
        }
        throw new Error(signUpError.message || 'فشل إنشاء الحساب');
      }
      if (!authData.user) {
        throw new Error('فشل إنشاء الحساب: لم يتم إنشاء المستخدم');
      }

      const { error: insertError } = await supabase.from('agents').insert({
        email: reg.email,
        name: reg.name,
        role: 'agent',
        phone: reg.phone || '',
        address: reg.address || null,
        approval_status: 'pending',
        is_active: true,
      });

      if (insertError) {
        console.error('فشل إدراج بيانات المندوب:', insertError);
        toast.error('تم إنشاء الحساب ولكن حدث خطأ في إعداد البيانات. يرجى التواصل مع المدير.');
      }

      setReg({ name: '', email: '', password: '', confirmPassword: '', phone: '', address: '' });
      navigateTo('register-success');
      toast.success('تم إنشاء الحساب بنجاح!');
    } catch (err: any) {
      setRegError(err.message || 'حدث خطأ أثناء تسجيل الحساب');
    } finally {
      setRegLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await useAuthStore.getState().forgotPassword(forgotEmail);
      navigateTo('forgot-success');
    } catch (err: any) {
      setForgotError(err?.message || 'فشل إرسال رابط إعادة تعيين كلمة المرور');
    } finally {
      setForgotLoading(false);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER VIEWS
  // ═════════════════════════════════════════════════════════════

  const renderLoginView = () => (
    <FadeIn>
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <FormField
          label="البريد الإلكتروني"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          required
          placeholder="أدخل بريدك الإلكتروني"
          dir="ltr"
          autoComplete="email"
          error={email !== '' && emailError ? emailError : undefined}
        />

        {/* Password */}
        <FormField
          label="كلمة المرور"
          name="password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
          required
          placeholder="أدخل كلمة المرور"
          dir="ltr"
          autoComplete="current-password"
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
              tabIndex={-1}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
              className="
                form-checkbox h-4 w-4 rounded
                text-purple-600 focus:ring-purple-500
                border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                cursor-pointer
              "
            />
            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
              تذكرني
            </span>
          </label>

          <button
            type="button"
            onClick={() => { setForgotEmail(email || ''); navigateTo('forgot-password'); }}
            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 transition-colors"
          >
            نسيت كلمة المرور؟
          </button>
        </div>

        {/* Error */}
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* Submit */}
        <SubmitButton loading={loading} label="تسجيل الدخول" loadingLabel="جارٍ تسجيل الدخول…" />
      </form>

      {/* Register link */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700/50">
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-3">
          ليس لديك حساب؟
        </p>
        <LinkButton
          onClick={() => navigateTo('register')}
          label="إنشاء حساب جديد"
          icon={<UserPlus className="w-4 h-4" />}
        />
      </div>
    </FadeIn>
  );

  const renderRegisterView = () => (
    <FadeIn>
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <FormField
            label="الاسم الكامل"
            name="name"
            type="text"
            value={reg.name}
            onChange={(e) => setReg({ ...reg, name: e.target.value })}
            icon={<User className="w-4 h-4" />}
            required
            placeholder="الاسم ثلاثي"
          />

          {/* Phone */}
          <FormField
            label="رقم الجوال"
            name="phone"
            type="tel"
            value={reg.phone}
            onChange={(e) => setReg({ ...reg, phone: e.target.value })}
            icon={<Phone className="w-4 h-4" />}
            required
            placeholder="05xxxxxxxx"
            dir="ltr"
          />
        </div>

        {/* Email */}
        <FormField
          label="البريد الإلكتروني"
          name="reg-email"
          type="email"
          value={reg.email}
          onChange={(e) => setReg({ ...reg, email: e.target.value })}
          icon={<Mail className="w-4 h-4" />}
          required
          placeholder="example@email.com"
          dir="ltr"
          autoComplete="email"
        />

        {/* Address */}
        <FormField
          label="العنوان"
          name="address"
          type="text"
          value={reg.address}
          onChange={(e) => setReg({ ...reg, address: e.target.value })}
          icon={<MapPin className="w-4 h-4" />}
          placeholder="المدينة - الحي - الشارع"
        />

        {/* Password */}
        <div>
          <FormField
            label="كلمة المرور"
            name="reg-password"
            type={showRegPassword ? 'text' : 'password'}
            value={reg.password}
            onChange={(e) => setReg({ ...reg, password: e.target.value })}
            icon={<Lock className="w-4 h-4" />}
            required
            placeholder="6 أحرف على الأقل"
            dir="ltr"
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowRegPassword(!showRegPassword)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                tabIndex={-1}
                aria-label={showRegPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <PasswordStrengthBar password={reg.password} />
        </div>

        {/* Confirm password */}
        <FormField
          label="تأكيد كلمة المرور"
          name="reg-confirm"
          type={showRegConfirm ? 'text' : 'password'}
          value={reg.confirmPassword}
          onChange={(e) => setReg({ ...reg, confirmPassword: e.target.value })}
          icon={<Lock className="w-4 h-4" />}
          required
          placeholder="أعد إدخال كلمة المرور"
          dir="ltr"
          autoComplete="new-password"
          error={confirmError}
          rightElement={
            <button
              type="button"
              onClick={() => setShowRegConfirm(!showRegConfirm)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
              tabIndex={-1}
              aria-label={showRegConfirm ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showRegConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

        {/* Error */}
        {regError && <ErrorAlert message={regError} onClose={() => setRegError('')} />}

        {/* Submit */}
        <SubmitButton loading={regLoading} label="إنشاء الحساب" loadingLabel="جارٍ إنشاء الحساب…" />

        {/* Back to login */}
        <div className="text-center pt-2">
          <LinkButton
            onClick={() => navigateTo('login')}
            label="العودة إلى تسجيل الدخول"
            icon={<ArrowLeft className="w-4 h-4" />}
          />
        </div>
      </form>
    </FadeIn>
  );

  const renderForgotPasswordView = () => (
    <FadeIn>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-bold font-heading text-gray-900 dark:text-white">
          نسيت كلمة المرور
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
        </p>
      </div>

      <form onSubmit={handleForgotPassword} className="space-y-4">
        <FormField
          label="البريد الإلكتروني"
          name="forgot-email"
          type="email"
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          required
          placeholder="أدخل بريدك الإلكتروني المسجل"
          dir="ltr"
          autoComplete="email"
        />

        {forgotError && <ErrorAlert message={forgotError} />}

        <SubmitButton loading={forgotLoading} label="إرسال رابط إعادة التعيين" loadingLabel="جارٍ الإرسال…" />

        <div className="text-center pt-2">
          <LinkButton
            onClick={() => navigateTo('login')}
            label="العودة إلى تسجيل الدخول"
            icon={<ArrowLeft className="w-4 h-4" />}
          />
        </div>
      </form>
    </FadeIn>
  );

  const renderRegisterSuccess = () => (
    <SuccessMessage
      title="تم إنشاء الحساب بنجاح! 🎉"
      message="شكراً لتسجيلك! حسابك قيد المراجعة من قبل الإدارة. سيتم تفعيله بعد الموافقة ويمكنك تسجيل الدخول لاحقاً."
      buttonLabel="العودة إلى تسجيل الدخول"
      onButtonClick={() => navigateTo('login')}
    />
  );

  const renderForgotSuccess = () => (
    <SuccessMessage
      title="تم إرسال رابط إعادة التعيين! 📧"
      message="إذا كان البريد الإلكتروني مسجلاً لدينا، ستتلقى رابطاً لإعادة تعيين كلمة المرور خلال دقائق. يرجى التحقق من صندوق الوارد والبريد المزعج."
      buttonLabel="العودة إلى تسجيل الدخول"
      onButtonClick={() => navigateTo('login')}
    />
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-body">
      <AnimatedBackground />

      {/* Main card */}
      <div
        key={animKey}
        className="
          relative w-full max-w-md
          bg-white/90 dark:bg-gray-900/90
          backdrop-blur-xl
          rounded-2xl
          shadow-2xl shadow-black/10 dark:shadow-black/30
          border border-white/20 dark:border-gray-800/50
          p-6 sm:p-8
          animate-scale-in
        "
      >
        <BrandBar />

        {/* View title */}
        {view === 'register' && (
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold font-heading text-gray-900 dark:text-white">
              تسجيل مندوب جديد
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              أدخل بياناتك للتسجيل في النظام
            </p>
          </div>
        )}
        {view === 'forgot-password' && (
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold font-heading text-gray-900 dark:text-white">
              استعادة كلمة المرور
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              سنرسل لك رابطاً لإعادة تعيين كلمة المرور
            </p>
          </div>
        )}

        {/* View switcher */}
        {view === 'login' && renderLoginView()}
        {view === 'register' && renderRegisterView()}
        {view === 'forgot-password' && renderForgotPasswordView()}
        {view === 'register-success' && renderRegisterSuccess()}
        {view === 'forgot-success' && renderForgotSuccess()}
      </div>
    </div>
  );
};
