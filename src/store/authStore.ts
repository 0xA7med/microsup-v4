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
      // التحقق من وجود بيانات المستخدم في التخزين المحلي
      const storedUser = localStorage.getItem('currentUser');
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // التحقق من صحة البيانات المخزنة
          if (userData && userData.id && userData.email) {
            // التحقق من وجود المستخدم في قاعدة البيانات
            const { data: agentData, error: agentError } = await supabase
              .from('agents')
              .select('*')
              .eq('id', userData.id)
              .single();
            
            if (agentError) {
              console.error('Error fetching user data:', agentError);
              localStorage.removeItem('currentUser');
              set({ user: null, loading: false });
              return;
            }
            
            if (agentData) {
              // التحقق من حالة الموافقة للمناديب
              if (agentData.role === 'agent' && 'approval_status' in agentData && agentData.approval_status !== 'approved') {
                localStorage.removeItem('currentUser');
                set({ user: null, loading: false });
                return;
              }
              
              set({ user: agentData, loading: false });
              return;
            }
          }
        } catch (e) {
          console.error('Error parsing stored user data:', e);
        }
        
        // إذا وصلنا إلى هنا، فهناك مشكلة في البيانات المخزنة
        localStorage.removeItem('currentUser');
      }
      
      set({ user: null, loading: false });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ user: null, loading: false });
    }
  },
  signIn: async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with email:', email);
      
      // أولاً، نتحقق مما إذا كان البريد الإلكتروني موجودًا في جدول agents
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('email', email)
        .single();
      
      if (agentError) {
        console.error('Error fetching agent data:', agentError);
        if (agentError.code === 'PGRST116') {
          // لم يتم العثور على المستخدم
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
        throw new Error('فشل في الحصول على بيانات المستخدم');
      }
      
      if (!agentData) {
        console.error('No agent data found for email:', email);
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
      
      // التحقق من كلمة المرور
      if (agentData.password !== password) {
        console.error('Password mismatch for email:', email);
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
      
      // التحقق من حالة الموافقة للمناديب
      if (agentData.role === 'agent') {
        // التحقق من وجود حقل approval_status
        if ('approval_status' in agentData) {
          if (agentData.approval_status !== 'approved') {
            if (agentData.approval_status === 'pending') {
              throw new Error('حسابك قيد المراجعة. يرجى الانتظار حتى تتم الموافقة عليه من قبل المدير');
            } else if (agentData.approval_status === 'rejected') {
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
      console.log('Login successful for user:', agentData.name);
      
      // تخزين بيانات المستخدم في التخزين المحلي
      localStorage.setItem('currentUser', JSON.stringify(agentData));
      
      toast.success(`مرحباً ${agentData.name}!`);
      set({ user: agentData });
    } catch (error: any) {
      console.error('Login process error:', error);
      toast.error(error.message || 'حدث خطأ أثناء تسجيل الدخول');
      throw error;
    }
  },
  signOut: async () => {
    try {
      // إزالة بيانات المستخدم من التخزين المحلي
      localStorage.removeItem('currentUser');
      
      toast.success('تم تسجيل الخروج بنجاح');
      set({ user: null });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },
  setUser: (user) => set({ user }),
}));