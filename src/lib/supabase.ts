import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://llaycsycajqvdratmqyb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsYXljc3ljYWpxdmRyYXRtcXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk2NTc4NTYsImV4cCI6MjAyNTIzMzg1Nn0.1uw_dGV2rF8xDPnV0-yb1CJjONKzk1mgDzM_bIKLSEE';

// تهيئة عميل Supabase مع التأكد من أنه متاح دائمًا
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// تصدير دالة للحصول على عميل Supabase الحالي
// هذا يساعد في حالة إعادة تحميل الصفحة أو إعادة تهيئة العميل
export const getSupabase = () => {
  return supabase;
};