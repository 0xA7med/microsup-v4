import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import toast from 'react-hot-toast';

// ── Security: passwords are handled by Supabase Auth, never by the app ──

type User = Database['public']['Tables']['agents']['Row'];

interface AuthState {
  user: User | null;
  loading: boolean;
  sessionError: boolean;
  initializeAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshSession: () => Promise<void>;
  resetSessionError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  sessionError: false,

  initializeAuth: async () => {
    try {
      // 1. Check for existing Supabase Auth session (persisted in localStorage)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        set({ user: null, loading: false });
        return;
      }

      if (session?.user) {
        // 2. Load agent profile from agents table using email as the link
        const { data: agentData, error: agentError } = await supabase
          .from('agents')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (agentError) {
          if (agentError.code === 'PGRST116') {
            // Auth user exists but no agent record — possible incomplete migration
            console.warn('No agent record for auth user:', session.user.email);
            await supabase.auth.signOut();
          } else {
            console.error('Error fetching agent:', agentError);
            set({ sessionError: true });
          }
          set({ user: null, loading: false });
          return;
        }

        if (agentData) {
          // 3. Check approval for agent role
          if (agentData.role === 'agent' && agentData.approval_status !== 'approved') {
            await supabase.auth.signOut();
            set({ user: null, loading: false });
            return;
          }

          set({ user: agentData, loading: false });
          return;
        }
      }

      set({ user: null, loading: false });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ user: null, loading: false, sessionError: true });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      // 1. Verify credentials via Supabase Auth (secure bcrypt hashing)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        if (authError.message?.includes('Invalid login credentials')) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
        if (authError.message?.includes('Email not confirmed')) {
          throw new Error('البريد الإلكتروني غير مؤكد. يرجى التحقق من بريدك الإلكتروني');
        }
        throw new Error(authError.message || 'فشل في تسجيل الدخول');
      }

      if (!authData.user) {
        throw new Error('فشل في تسجيل الدخول: لم يتم الحصول على بيانات المستخدم');
      }

      // 2. Load agent profile from agents table
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (agentError) {
        console.error('Error loading agent data:', agentError);
        if (agentError.code === 'PGRST116') {
          // Auth succeeded but no agent record
          await supabase.auth.signOut();
          throw new Error('لم يتم العثور على حساب مندوب مرتبط بهذا البريد الإلكتروني');
        }
        throw new Error('فشل في تحميل بيانات المستخدم');
      }

      // 3. Check approval status (for agents)
      if (agentData.role === 'agent' && agentData.approval_status) {
        if (agentData.approval_status !== 'approved') {
          await supabase.auth.signOut();
          if (agentData.approval_status === 'pending') {
            throw new Error('حسابك قيد المراجعة. يرجى الانتظار حتى تتم الموافقة عليه من قبل المدير');
          } else if (agentData.approval_status === 'rejected') {
            throw new Error('REJECTED:تم رفض طلب تسجيلك. يرجى التواصل مع المدير للحصول على مزيد من المعلومات');
          }
          throw new Error('غير مصرح لك بتسجيل الدخول. يرجى التواصل مع المدير');
        }
      }

      // 4. Check if account is active
      if (agentData.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('هذا الحساب غير نشط. يرجى التواصل مع المدير');
      }

      toast.success(`مرحباً ${agentData.name}!`);
      set({ user: agentData });
    } catch (error: any) {
      console.error('Login error:', error);

      let errorMessage = error.message || 'حدث خطأ أثناء تسجيل الدخول';

      if (errorMessage.startsWith('REJECTED:')) {
        errorMessage = errorMessage.replace('REJECTED:', '');
        toast.error(errorMessage, {
          icon: '❌',
          duration: 5000,
          style: { background: '#FFEBEE', color: '#D32F2F', fontWeight: 'bold' }
        });
      } else {
        toast.error(errorMessage);
      }

      throw error;
    }
  },

  forgotPassword: async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      toast.success('تم تسجيل الخروج بنجاح');
      set({ user: null });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  setUser: (user) => set({ user }),

  refreshSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        set({ sessionError: true });
        return;
      }

      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (agentError) {
        set({ sessionError: true });
        return;
      }

      set({ user: agentData, sessionError: false });
    } catch (error) {
      console.error('Error refreshing session:', error);
      set({ sessionError: true });
    }
  },

  resetSessionError: () => set({ sessionError: false }),
}));
