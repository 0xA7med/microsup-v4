// تحديث قيم approval_status للمستخدمين الحاليين
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// تهيئة ملف البيئة
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('خطأ: لم يتم العثور على بيانات الاتصال بـ Supabase في ملف .env');
  process.exit(1);
}

// إنشاء اتصال بـ Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateApprovalStatus() {
  try {
    console.log('جاري تحديث قيم approval_status للمستخدمين الحاليين...');
    
    const { data, error } = await supabase
      .from('agents')
      .update({ approval_status: 'approved' })
      .is('approval_status', null);
    
    if (error) {
      console.error('خطأ في تحديث قيم approval_status:', error);
      return;
    }
    
    console.log('تم تحديث قيم approval_status بنجاح.');
    
    // التحقق من التحديث
    const { data: updatedData, error: fetchError } = await supabase
      .from('agents')
      .select('*');
    
    if (fetchError) {
      console.error('خطأ في جلب البيانات المحدثة:', fetchError);
      return;
    }
    
    console.log('بيانات المستخدمين بعد التحديث:');
    console.log(updatedData);
    
    // إضافة قيد للتأكد من أن القيم صالحة
    console.log('\nملاحظة: يجب إضافة قيد للتأكد من أن قيم approval_status صالحة.');
    console.log('يرجى تنفيذ الاستعلام التالي في لوحة تحكم Supabase SQL:');
    console.log("ALTER TABLE agents ADD CONSTRAINT IF NOT EXISTS approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));");
  } catch (error) {
    console.error('حدث خطأ غير متوقع:', error);
  }
}

updateApprovalStatus();
