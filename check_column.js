// التحقق من وجود عمود approval_status في جدول agents
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

async function checkColumn() {
  try {
    // التحقق من وجود جدول agents
    console.log('جاري التحقق من وجود جدول agents...');
    
    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .limit(1);
    
    if (agentsError) {
      console.error('خطأ في الوصول إلى جدول agents:', agentsError);
      return;
    }
    
    console.log('تم العثور على جدول agents.');
    console.log('بيانات العميل الأول:', agentsData);
    
    // التحقق من وجود عمود approval_status
    console.log('\nجاري التحقق من وجود عمود approval_status...');
    
    try {
      const { data: approvalData, error: approvalError } = await supabase
        .from('agents')
        .select('approval_status')
        .limit(1);
      
      if (approvalError) {
        console.log('خطأ في الوصول إلى عمود approval_status:', approvalError);
        console.log('يبدو أن عمود approval_status غير موجود. يجب إضافته.');
      } else {
        console.log('عمود approval_status موجود بالفعل.');
        console.log('قيمة approval_status للعميل الأول:', approvalData);
      }
    } catch (error) {
      console.log('حدث خطأ أثناء التحقق من عمود approval_status:', error);
    }
  } catch (error) {
    console.error('حدث خطأ غير متوقع:', error);
  }
}

checkColumn();
