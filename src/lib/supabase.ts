import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// تهيئة عميل Supabase (مفاتيح مجهولة - anon key)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// الحصول على عميل Supabase الحالي
export const getSupabase = () => supabase;

// ── عميل Supabase بمفتاح service_role لإدارة المستخدمين ──
// ⚠️ يستخدم فقط لإنشاء/تعديل المستخدمين في Auth.
// لا يتم كشف هذا العميل في كود الواجهة في الإنتاج.
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export const getAdminClient = () => {
  if (adminClient) return adminClient;

  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'Missing VITE_SUPABASE_SERVICE_ROLE_KEY. Set it in your .env file for agent management.'
    );
  }

  adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return adminClient;
};