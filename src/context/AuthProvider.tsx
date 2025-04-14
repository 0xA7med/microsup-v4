import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { User, Session } from '@supabase/supabase-js';

// تعريف نوع سياق المصادقة
type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

// إنشاء سياق المصادقة
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// مزود سياق المصادقة
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // تحديث حالة المصادقة
  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('خطأ في الحصول على جلسة المستخدم:', error);
        handleAuthError(error);
        return;
      }
      
      if (data && data.session) {
        setSession(data.session);
        setUser(data.session.user);
      } else {
        setSession(null);
        setUser(null);
      }
    } catch (error) {
      console.error('خطأ غير متوقع في الحصول على جلسة المستخدم:', error);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // معالجة أخطاء المصادقة
  const handleAuthError = (error: any) => {
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('session')) {
      toast.error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
      navigate('/login');
    } else if (error.message) {
      toast.error(error.message);
    } else {
      toast.error('حدث خطأ في المصادقة');
    }
  };

  // تسجيل الدخول
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        handleAuthError(error);
        return;
      }
      
      if (data && data.session) {
        setSession(data.session);
        setUser(data.user);
        toast.success('تم تسجيل الدخول بنجاح');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('خطأ في تسجيل الدخول:', error);
      toast.error('حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  // تسجيل الخروج
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        handleAuthError(error);
        return;
      }
      
      setSession(null);
      setUser(null);
      toast.success('تم تسجيل الخروج بنجاح');
      navigate('/login');
    } catch (error) {
      console.error('خطأ في تسجيل الخروج:', error);
      toast.error('حدث خطأ أثناء تسجيل الخروج');
    } finally {
      setLoading(false);
    }
  };

  // الاستماع لتغييرات حالة المصادقة
  useEffect(() => {
    // تحديث الجلسة عند تحميل المكون
    refreshSession();

    // إعداد مستمع لتغييرات المصادقة
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('تغيير حالة المصادقة:', event);
      
      if (session) {
        setSession(session);
        setUser(session.user);
      } else {
        setSession(null);
        setUser(null);
        
        // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول إذا تم تسجيل الخروج
        if (event === 'SIGNED_OUT') {
          navigate('/login');
        }
      }
      
      setLoading(false);
    });

    // تنظيف المستمع عند إزالة المكون
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  // قيمة السياق
  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    refreshSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// هوك مخصص لاستخدام سياق المصادقة
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('يجب استخدام useAuth داخل AuthProvider');
  }
  
  return context;
};

// مكون لحماية المسارات التي تتطلب المصادقة
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      toast.error('يجب تسجيل الدخول للوصول إلى هذه الصفحة');
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
};

export default AuthProvider;
