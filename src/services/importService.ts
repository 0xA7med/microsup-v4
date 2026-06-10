import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface ImportedClient {
  name: string;
  phone: string;
  phone2?: string;
  address?: string;
  business_type?: string;
  notes?: string;
  'الاسم'?: string;
  'رقم الهاتف'?: string;
  'رقم الهاتف 2'?: string;
  'العنوان'?: string;
  'نوع النشاط'?: string;
  'ملاحظات'?: string;
}

export const generateImportTemplate = (): Blob => {
  // إنشاء مصفوفة البيانات مع الرؤوس
  const data = [
    ['الاسم', 'رقم الهاتف', 'رقم الهاتف 2', 'العنوان', 'نوع النشاط', 'ملاحظات'],
    ['عميل نموذجي', '0512345678', '0598765432', 'الرياض، السعودية', 'متجر', 'ملاحظات للعميل']
  ];

  // إنشاء ورقة عمل
  const ws = XLSX.utils.aoa_to_sheet(data);

  // تنسيق عرض الأعمدة
  const wscols = [
    { wch: 20 }, // عرض عمود الاسم
    { wch: 15 }, // عرض عمود رقم الهاتف
    { wch: 15 }, // عرض عمود رقم الهاتف 2
    { wch: 30 }, // عرض عمود العنوان
    { wch: 20 }, // عرض عمود نوع النشاط
    { wch: 30 }  // عرض عمود الملاحظات
  ];
  ws['!cols'] = wscols;

  // إنشاء كتاب عمل وإضافة ورقة العمل
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'العملاء');

  // إضافة ورقة التعليمات
  const instructionsData = [
    ['تعليمات الاستيراد'],
    ['1. الاسم ورقم الهاتف حقول إلزامية'],
    ['2. باقي الحقول اختيارية'],
    ['3. تأكد من تنسيق أرقام الهواتف بشكل صحيح'],
    ['4. يمكنك نسخ ولصق البيانات من Excel مباشرة']
  ];
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'تعليمات');

  // تحويل الكتاب إلى مصفوفة ثنائية
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

  // تحويل المصفوفة الثنائية إلى Blob
  const buf = new ArrayBuffer(wbout.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < wbout.length; i++) {
    view[i] = wbout.charCodeAt(i) & 0xFF;
  }

  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const importClientsFromFile = async (file: File): Promise<{ success: boolean, count: number, errors: string[] }> => {
  try {
    const errors: string[] = [];
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // الحصول على الورقة الأولى
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // تحويل البيانات إلى JSON
          const jsonData = XLSX.utils.sheet_to_json<ImportedClient>(worksheet);
          
          if (jsonData.length === 0) {
            throw new Error('الملف لا يحتوي على بيانات');
          }
          
          // التحقق من صحة البيانات
          const validClients = [];
          
          for (const row of jsonData) {
            const name = row.name || row['الاسم'] || '';
            const phone = row.phone || row['رقم الهاتف'] || '';
            const phone2 = row.phone2 || row['رقم الهاتف 2'] || '';
            const address = row.address || row['العنوان'] || '';
            const business_type = row.business_type || row['نوع النشاط'] || '';
            const notes = row.notes || row['ملاحظات'] || '';

            if (!name || !phone) {
              errors.push(`صف غير صالح: الاسم ورقم الهاتف مطلوبان`);
              continue;
            }
            
            // إنشاء كائن العميل
            const client = {
              name,
              phone,
              phone2: phone2 || null,
              address: address || null,
              business_type: business_type || null,
              notes: notes || null,
              created_at: new Date().toISOString()
            };
            
            validClients.push(client);
          }
          
          // إضافة العملاء الصالحين إلى قاعدة البيانات
          if (validClients.length > 0) {
            const { error } = await supabase
              .from('clients')
              .insert(validClients);
            
            if (error) throw error;
          }
          
          resolve({
            success: true,
            count: validClients.length,
            errors
          });
        } catch (error) {
          console.error('خطأ في استيراد العملاء:', error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    console.error('خطأ في استيراد العملاء:', error);
    throw new Error('فشل في استيراد العملاء');
  }
};
