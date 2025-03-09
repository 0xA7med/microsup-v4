// أداة لتنفيذ ملف migration في Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// تهيئة ملف البيئة
dotenv.config();

// الحصول على المسار الحالي
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('خطأ: لم يتم العثور على بيانات الاتصال بـ Supabase في ملف .env');
  process.exit(1);
}

// إنشاء اتصال بـ Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// قراءة ملف migration
const migrationFile = path.join(__dirname, 'supabase', 'migrations', 'complete_approval_status.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

console.log('محتوى ملف SQL:');
console.log(migrationSQL);

// تنفيذ استعلام SQL
async function executeMigration() {
  try {
    console.log('جاري التحقق من وجود جدول agents...');
    
    // التحقق من وجود جدول agents
    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .limit(1);
    
    if (agentsError) {
      console.error('خطأ في الوصول إلى جدول agents:', agentsError);
      console.log('يرجى التأكد من وجود جدول agents في قاعدة البيانات.');
      process.exit(1);
    }
    
    console.log('تم العثور على جدول agents.');
    
    // التحقق من وجود عمود approval_status
    console.log('جاري التحقق من وجود عمود approval_status...');
    
    try {
      const { data: approvalData, error: approvalError } = await supabase
        .from('agents')
        .select('approval_status')
        .limit(1);
      
      if (approvalError) {
        console.log('عمود approval_status غير موجود. سيتم إضافته...');
      } else {
        console.log('عمود approval_status موجود بالفعل.');
        console.log('هل ترغب في المتابعة وتنفيذ migration بالكامل؟ (قد يؤدي هذا إلى إعادة تعيين القيم الحالية)');
        console.log('إذا كنت ترغب في المتابعة، يرجى تنفيذ الاستعلامات التالية في لوحة تحكم Supabase SQL:');
        console.log(migrationSQL);
        process.exit(0);
      }
    } catch (error) {
      console.log('حدث خطأ أثناء التحقق من عمود approval_status:', error);
    }
    
    console.log('يرجى تنفيذ الاستعلامات التالية في لوحة تحكم Supabase SQL:');
    console.log(migrationSQL);
    
    console.log('\nبعد تنفيذ الاستعلامات، يرجى التحقق من تسجيل الدخول باستخدام حساب مندوب للتأكد من أن النظام يعمل بشكل صحيح.');
    
  } catch (error) {
    console.error('حدث خطأ أثناء تنفيذ migration:', error);
  }
}

executeMigration();
