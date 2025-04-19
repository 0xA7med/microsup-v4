import { supabase } from '../lib/supabase';
import { ClientData, DeviceData } from '../types/whatsapp.types';
import { useAuthStore } from '../store/authStore';
import { isValid, parse, format } from 'date-fns';

// تحويل بيانات العميل إلى شكل قاعدة البيانات
function mapClientToDb(client: ClientData) {
  // الحصول على معرف المستخدم الحالي من المتجر
  const user = useAuthStore.getState().user;
  
  // التاريخ الحالي بتنسيق ISO
  const now = new Date().toISOString();
  
  return {
    client_name: client['اسم العميل'] || '',
    organization_name: client['اسم المؤسسة'] || '',
    activity_type: client['نوع النشاط'] || '',
    phone: client['الهاتف'] || '',
    phone2: client['الهاتف 2'] || '',
    address: client['العنوان'] || '',
    notes: client['ملاحظات'] || '',
    agent_id: user?.id || '', // إضافة معرف الوكيل
    created_at: now, // إضافة تاريخ الإنشاء
    // تم إزالة الحقول غير الموجودة في قاعدة البيانات
    subscription_type: 'permanent', // نوع الاشتراك الافتراضي
    subscription_start: now.split('T')[0], // تاريخ بداية الاشتراك (اليوم)
    subscription_end: '2099-12-31' // تاريخ نهاية الاشتراك (بعيد)
  };
}

// إنشاء رمز تفعيل عشوائي
function generateActivationCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// التحقق من صحة التاريخ وتحويله إلى التنسيق الصحيح
function validateAndFormatDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0]; // اليوم الحالي إذا كان فارغًا
  
  // محاولة تحليل التاريخ بتنسيقات مختلفة
  const formats = ['yyyy-MM-dd', 'yyyy/MM/dd', 'dd-MM-yyyy', 'dd/MM/yyyy'];
  
  for (const dateFormat of formats) {
    try {
      const parsedDate = parse(dateStr, dateFormat, new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    } catch (e) {
      // استمر في المحاولة بالتنسيق التالي
    }
  }
  
  // إذا فشلت جميع المحاولات، تحقق من وجود أرقام غير صالحة
  const dateMatch = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1]);
    let month = parseInt(dateMatch[2]);
    let day = parseInt(dateMatch[3]);
    
    // تصحيح القيم خارج النطاق
    if (month > 12) month = 12;
    if (day > 31) day = 31;
    
    // تنسيق التاريخ بشكل صحيح
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  
  // إرجاع التاريخ الحالي كقيمة افتراضية آمنة
  return new Date().toISOString().split('T')[0];
}

function mapDeviceToDb(device: DeviceData, clientId: string) {
  const now = new Date().toISOString();
  
  // التحقق من حقل السعر - إذا كان فارغًا، استخدم 0
  const price = device['السعر'] ? parseFloat(device['السعر']) : 0;
  
  // التحقق من صحة التواريخ وتنسيقها
  const startDate = validateAndFormatDate(device['تاريخ بداية الاشتراك'] || '');
  const endDate = device['تاريخ نهاية الاشتراك'] 
    ? validateAndFormatDate(device['تاريخ نهاية الاشتراك']) 
    : '2099-12-31';
  
  return {
    client_id: clientId,
    activation_code: device['رمز التفعيل'] || generateActivationCode(),
    device_type: device['نوع الجهاز'] || 'android',
    price, // إضافة حقل السعر بعد التحويل إلى رقم
    subscription_start: startDate,
    subscription_end: endDate,
    subscription_type: device['نوع الاشتراك'] || 'permanent',
    notes: device['ملاحظات'] || '',
    created_at: now,
    updated_at: now
  };
}

// إضافة دفعة من العملاء والأجهزة دفعة واحدة
export async function addClientsAndDevicesToDb(clients: ClientData[], devices: DeviceData[]) {
  const insertedClients: any[] = [];
  const clientNameToId: Record<string, string> = {};
  
  try {
    // 1. إضافة العملاء
    for (const client of clients) {
      const dbClient = mapClientToDb(client);
      
      // التحقق من البيانات المطلوبة
      if (!dbClient.client_name || !dbClient.phone || !dbClient.agent_id) {
        console.error('بيانات العميل غير مكتملة:', dbClient);
        continue; // تخطي هذا العميل
      }
      
      // طباعة بيانات العميل للتصحيح
      console.log('بيانات العميل المرسلة:', dbClient);
      
      const { data, error } = await supabase
        .from('clients')
        .insert([dbClient])
        .select('id,client_name');
      
      if (error) {
        console.error('خطأ في إضافة العميل:', error);
        throw new Error(`فشل إضافة العميل ${dbClient.client_name}: ${error.message}`);
      }
      
      if (data && data[0]) {
        insertedClients.push(data[0]);
        clientNameToId[data[0].client_name] = data[0].id;
      }
    }
    
    // 2. إضافة الأجهزة وربطها بالعميل المناسب
    const deviceRows = devices.map(device => {
      const clientId = clientNameToId[device['اسم العميل']] || null;
      return clientId ? mapDeviceToDb(device, clientId) : null;
    }).filter(Boolean);
    
    if (deviceRows.length > 0) {
      // طباعة بيانات الأجهزة للتصحيح
      console.log('بيانات الأجهزة المرسلة:', deviceRows);
      
      // إضافة الأجهزة على دفعات لتجنب الأخطاء
      const batchSize = 10;
      for (let i = 0; i < deviceRows.length; i += batchSize) {
        const batch = deviceRows.slice(i, i + batchSize);
        const { error } = await supabase
          .from('devices')
          .insert(batch);
        
        if (error) {
          console.error(`خطأ في إضافة دفعة الأجهزة ${i/batchSize + 1}:`, error);
          throw new Error(`فشل إضافة الأجهزة: ${error.message}`);
        }
      }
    }
    
    return { clients: insertedClients.length, devices: deviceRows.length };
  } catch (error: any) {
    console.error('خطأ في عملية الإضافة:', error);
    throw error;
  }
}
