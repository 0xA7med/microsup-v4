import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

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
        const { data: userData } = await supabase
          .from('agents')
          .select('*')
          .eq('id', session.user.id)
          .single();

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
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (session?.user) {
      const { data: userData } = await supabase
        .from('agents')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!userData) {
        throw new Error('لم يتم العثور على بيانات المستخدم');
      }

      // التحقق من حالة الموافقة للمناديب
      if (userData.role === 'agent' && userData.approval_status !== 'approved') {
        if (userData.approval_status === 'pending') {
          throw new Error('حسابك قيد المراجعة. يرجى الانتظار حتى تتم الموافقة عليه من قبل المدير');
        } else if (userData.approval_status === 'rejected') {
          throw new Error('تم رفض طلب تسجيلك. يرجى التواصل مع المدير للحصول على مزيد من المعلومات');
        } else {
          throw new Error('غير مصرح لك بتسجيل الدخول. يرجى التواصل مع المدير');
        }
      }

      // إذا كان المستخدم مديرًا أو مندوبًا معتمدًا، قم بتسجيل الدخول
      set({ user: userData });
    }
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null });
  },
  setUser: (user) => set({ user, loading: false }),
}));