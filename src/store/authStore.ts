import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import toast from 'react-hot-toast';

// تعريف نوع المستخدم من نوع الصف agents
type User = Database['public']['Tables']['agents']['Row'];

interface AuthState {
  user: User | null;
  loading: boolean;
  initializeAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: userData, error: userError } = await supabase
          .from('agents')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          console.error('Error fetching user data:', userError);
          set({ user: null, loading: false });
          return;
        }

        if (userData) {
          set({ user: userData, loading: false });
        } else {
          set({ user: null, loading: false });
        }
      } else {
        set({ user: null, loading: false });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ user: null, loading: false });
    }
  },
  signIn: async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      if (!data.session?.user) {
        console.error('No user session returned');
        throw new Error('فشل تسجيل الدخول: لم يتم إرجاع جلسة المستخدم');
      }

      console.log('Auth successful, fetching user data for ID:', data.session.user.id);
      
      const { data: userData, error: userError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        throw new Error('فشل في الحصول على بيانات المستخدم');
      }

      if (!userData) {
        console.error('No user data found for ID:', data.session.user.id);
        throw new Error('لم يتم العثور على بيانات المستخدم');
      }

      console.log('User data retrieved:', userData);

      // التحقق من حالة الموافقة للمناديب
      if (userData.role === 'agent') {
        // التحقق من وجود حقل approval_status
        if ('approval_status' in userData) {
          if (userData.approval_status !== 'approved') {
            if (userData.approval_status === 'pending') {
              throw new Error('حسابك قيد المراجعة. يرجى الانتظار حتى تتم الموافقة عليه من قبل المدير');
            } else if (userData.approval_status === 'rejected') {
              throw new Error('تم رفض طلب تسجيلك. يرجى التواصل مع المدير للحصول على مزيد من المعلومات');
            } else {
              throw new Error('غير مصرح لك بتسجيل الدخول. يرجى التواصل مع المدير');
            }
          }
        } else {
          // إذا لم يكن هناك حقل approval_status، نفترض أن المستخدم معتمد (للتوافق مع الإصدارات القديمة)
          console.log('No approval_status field found, assuming approved for backwards compatibility');
        }
      }

      // إذا كان المستخدم مديرًا أو مندوبًا معتمدًا، قم بتسجيل الدخول
      console.log('Login successful for user:', userData.name);
      toast.success(`مرحباً ${userData.name}!`);
      set({ user: userData });
    } catch (error: any) {
      console.error('Login process error:', error);
      toast.error(error.message || 'حدث خطأ أثناء تسجيل الدخول');
      throw error;
    }
  },
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        throw error;
      }
      toast.success('تم تسجيل الخروج بنجاح');
      set({ user: null });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },
  setUser: (user) => set({ user }),
}));