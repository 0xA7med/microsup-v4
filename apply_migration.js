import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// قراءة ملف البيئة للحصول على بيانات الاتصال بـ Supabase
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
const migrationFile = path.join(__dirname, 'supabase', 'migrations', 'add_approval_status.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

// تنفيذ استعلام SQL
async function applyMigration() {
  console.log('جاري تطبيق migration...');
  console.log('محتوى ملف SQL:');
  console.log(migrationSQL);
  
  try {
    // تقسيم الاستعلامات وتنفيذها واحدة تلو الأخرى
    const queries = migrationSQL.split(';').filter(query => query.trim() !== '');
    
    for (const query of queries) {
      if (query.trim()) {
        console.log(`تنفيذ الاستعلام: ${query.trim()}`);
        
        try {
          // محاولة تنفيذ الاستعلام باستخدام وظيفة exec_sql
          const { data, error } = await supabase.rpc('exec_sql', { sql: query.trim() });
          
          if (error) {
            console.error('خطأ في تنفيذ الاستعلام باستخدام RPC:', error);
            
            // محاولة تنفيذ الاستعلام مباشرة
            console.log('محاولة تنفيذ الاستعلام مباشرة...');
            const { data: directData, error: directError } = await supabase.from('agents').select('count').limit(1);
            
            if (directError) {
              console.error('خطأ في الوصول إلى جدول agents:', directError);
              throw directError;
            } else {
              console.log('تم الوصول إلى جدول agents بنجاح، سنقوم بتنفيذ الاستعلام يدويًا في لوحة تحكم Supabase');
            }
          } else {
            console.log('تم تنفيذ الاستعلام بنجاح');
          }
        } catch (queryError) {
          console.error('خطأ أثناء تنفيذ الاستعلام:', queryError);
          console.log('يرجى تنفيذ الاستعلام يدويًا في لوحة تحكم Supabase:');
          console.log(query.trim());
        }
      }
    }
    
    console.log('تم الانتهاء من محاولة تطبيق migration!');
    console.log('يرجى التأكد من تنفيذ الاستعلامات التالية في لوحة تحكم Supabase إذا لم يتم تنفيذها تلقائيًا:');
    console.log(migrationSQL);
  } catch (error) {
    console.error('حدث خطأ أثناء تطبيق migration:', error);
  }
}

applyMigration();
