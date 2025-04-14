// src/components/ExcelImporter.tsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

// مكون Spinner البسيط
const Spinner = ({ className = "h-5 w-5", size = "md" }) => (
  <div className="flex items-center justify-center">
    <Loader2 className={`${size === "sm" ? "h-4 w-4" : className} animate-spin text-gray-500 dark:text-gray-400`} />
  </div>
);

interface ExcelImporterProps {
  onImportSuccess?: () => void;
  type: 'clients' | 'devices' | 'clients_and_devices';
}

// تعريف أنواع البيانات
// استخدام ExcelClient في التحويل لتجنب تحذير "declared but never used"
export interface ExcelClient {
  client_name: string;
  organization_name?: string;
  activity_type?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  notes?: string;
  subscription_type?: string;
  subscription_start?: string;
  subscription_end?: string;
  [key: string]: any; // للسماح بحقول إضافية
}

export interface ExcelDevice {
  client_name: string;
  activation_code?: string;
  device_type?: string;
  subscription_type?: string;
  subscription_value?: number | string;
  subscription_start?: string;
  subscription_end?: string;
  notes?: string;
  approval_status?: string;
  price?: number | string;
  [key: string]: any; // للسماح بحقول إضافية
}

export const ExcelImporter: React.FC<ExcelImporterProps> = ({ onImportSuccess, type }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState<{ clients: number; devices: number; total: number }>({ clients: 0, devices: 0, total: 0 });
  const [showStats, setShowStats] = useState(false);
  const { user, sessionError, refreshSession, resetSessionError } = useAuthStore();

  // معالجة أخطاء الجلسة
  useEffect(() => {
    if (sessionError) {
      toast.error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
      // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      resetSessionError();
    }
  }, [sessionError, resetSessionError]);

  // تحديث الجلسة عند تحميل المكون
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('تم اختيار الملف:', file.name);
      
      // تأكد من أن الملف هو ملف Excel
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('يرجى اختيار ملف Excel صالح (.xlsx أو .xls)');
        return;
      }
      
      // بدء معالجة الملف
      processExcelFile(file);
    }
  };

  // دالة لمعالجة الملف
  const processExcelFile = async (file: File) => {
    console.log('جاري قراءة الملف:', file.name);
    setIsImporting(true);
    setStats({ clients: 0, devices: 0, total: 0 });
    setShowStats(false);
    
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // التحقق من وجود الأوراق المطلوبة
      const sheetNames = workbook.SheetNames;
      
      // تحديد الأوراق المطلوبة بناءً على نوع الاستيراد
      let requiredSheets: string[] = [];
      if (type === 'clients') {
        requiredSheets = ['العملاء', 'clients'];
      } else if (type === 'devices') {
        requiredSheets = ['الأجهزة', 'devices'];
      } else if (type === 'clients_and_devices') {
        requiredSheets = ['العملاء', 'clients', 'الأجهزة', 'devices'];
      } else {
        requiredSheets = ['العملاء', 'clients', 'الأجهزة', 'devices'];
      }
      
      // التحقق من وجود أي من الأوراق المطلوبة
      const hasRequiredSheet = requiredSheets.some(sheet => sheetNames.includes(sheet));
      
      if (!hasRequiredSheet) {
        toast.error(`الملف لا يحتوي على الأوراق المطلوبة: ${requiredSheets.join(' أو ')}`);
        setIsImporting(false);
        return;
      }
      
      console.log('تم قراءة الملف بنجاح');
      
      // استخراج بيانات العملاء والأجهزة
      let clientsData: any[] = [];
      let devicesData: any[] = [];
      
      // استخراج بيانات العملاء إذا كان نوع الاستيراد هو 'clients' أو كلاهما
      if (type === 'clients' || type === 'clients_and_devices') {
        const clientsSheetName = sheetNames.find(name => 
          name === 'العملاء' || name.toLowerCase() === 'clients'
        );
        
        if (clientsSheetName) {
          const clientsSheet = XLSX.utils.sheet_to_json(workbook.Sheets[clientsSheetName]);
          console.log('بيانات العملاء:', clientsSheet);
          clientsData = clientsSheet;
        } else if (type === 'clients') {
          toast.error('لم يتم العثور على ورقة العملاء في الملف');
          setIsImporting(false);
          return;
        }
      }
      
      // استخراج بيانات الأجهزة إذا كان نوع الاستيراد هو 'devices' أو كلاهما
      if (type === 'devices' || type === 'clients_and_devices') {
        const devicesSheetName = sheetNames.find(name => 
          name === 'الأجهزة' || name.toLowerCase() === 'devices'
        );
        
        if (devicesSheetName) {
          const devicesSheet = XLSX.utils.sheet_to_json(workbook.Sheets[devicesSheetName]);
          console.log('بيانات الأجهزة:', devicesSheet);
          devicesData = devicesSheet;
        } else if (type === 'devices') {
          toast.error('لم يتم العثور على ورقة الأجهزة في الملف');
          setIsImporting(false);
          return;
        }
      }
      
      // تنسيق التاريخ
      const formatDate = (date: any): string => {
        if (!date) return new Date().toISOString().split('T')[0];
        
        // إذا كان التاريخ بصيغة نصية، نحاول تحويله
        if (typeof date === 'string') {
          try {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate.toISOString().split('T')[0];
            }
          } catch (e) {
            console.error('خطأ في تحويل التاريخ:', e);
          }
        }
        
        // إرجاع تاريخ اليوم كقيمة افتراضية
        return new Date().toISOString().split('T')[0];
      };
      
      // تحويل البيانات إلى التنسيق المطلوب
      const processedClients = clientsData.map((client: any) => ({
        client_name: client['اسم العميل'] || client['client_name'] || client['name'],
        organization_name: client['اسم المؤسسة'] || client['organization_name'] || '',
        activity_type: client['نوع النشاط'] || client['activity_type'] || '',
        phone: client['الهاتف'] || client['phone'] || '',
        phone2: client['الهاتف 2'] || client['phone2'] || '',
        address: client['العنوان'] || client['address'] || '',
        notes: client['ملاحظات'] || client['notes'] || '',
        subscription_type: client['نوع الاشتراك'] || client['subscription_type'] || 'monthly',
        subscription_start: formatDate(client['تاريخ بداية الاشتراك'] || client['subscription_start']),
        subscription_end: formatDate(client['تاريخ نهاية الاشتراك'] || client['subscription_end'])
      }));
      
      // معالجة بيانات الأجهزة
      const processedDevices = devicesData.map((device: any) => ({
        client_name: device['اسم العميل'] || device['client_name'] || device['name'] || '',
        activation_code: device['رمز التفعيل'] || device['activation_code'] || generateActivationCode(20),
        device_type: device['نوع الجهاز'] || device['device_type'] || 'computer',
        price: device['السعر'] || device['price'] || 0,
        subscription_start: formatDate(device['تاريخ بداية الاشتراك'] || device['subscription_start']),
        subscription_end: formatDate(device['تاريخ نهاية الاشتراك'] || device['subscription_end']),
        notes: device['ملاحظات'] || device['notes'] || '',
        approval_status: device['حالة الموافقة'] || device['approval_status'] || 'approved'
      }));
      
      // التحقق من وجود المستخدم الحالي
      const agent_id = user?.id;
      
      if (!agent_id) {
        console.error('لم يتم العثور على معلومات المستخدم الحالي');
        toast.error('لم يتم العثور على معلومات المستخدم الحالي');
        setIsImporting(false);
        return;
      }
      
      // إدخال العملاء في قاعدة البيانات
      let insertedClients = 0;
      let insertedDevices = 0;
      let clientsErrors = 0;
      let devicesErrors = 0;
      
      // إدخال العملاء
      for (const client of processedClients) {
        try {
          // التحقق من وجود العميل أولاً
          const { data: existingClients, error: checkError } = await supabase
            .from('clients')
            .select('id')
            .eq('client_name', client.client_name)
            .maybeSingle();
          
          if (checkError) {
            console.error('خطأ في التحقق من وجود العميل:', checkError);
            continue;
          }
          
          // إنشاء كائن بيانات العميل الأساسية
          const clientData: any = {
            client_name: client.client_name,
            organization_name: client.organization_name,
            activity_type: client.activity_type,
            phone: client.phone,
            phone2: client.phone2,
            address: client.address,
            notes: client.notes,
            subscription_start: client.subscription_start,
            subscription_end: client.subscription_end,
            agent_id
          };
          
          // إضافة حقل subscription_type إذا كان متاحًا
          if (client.subscription_type) {
            clientData.subscription_type = client.subscription_type;
          }
          
          // تحديث العميل الموجود أو إنشاء عميل جديد
          try {
            if (existingClients) {
              // تحديث العميل الموجود
              const { error: updateError } = await supabase
                .from('clients')
                .update(clientData)
                .eq('id', existingClients.id);
              
              if (updateError) {
                console.error('خطأ في تحديث العميل:', updateError);
                continue;
              }
            } else {
              // إنشاء عميل جديد
              const { error: insertError } = await supabase
                .from('clients')
                .insert(clientData);
              
              if (insertError) {
                console.error('خطأ في إدخال العميل:', insertError);
                continue;
              }
            }
            
            insertedClients++;
          } catch (error) {
            console.error('خطأ غير متوقع في معالجة العميل:', error);
            continue;
          }
        } catch (error) {
          console.error('خطأ في معالجة العميل:', error);
          continue;
        }
      }
      
      // إدخال الأجهزة
      for (const device of processedDevices) {
        try {
          if (!device.client_name) {
            console.warn('تم تخطي جهاز بدون اسم عميل');
            continue;
          }
          
          // البحث عن العميل بالاسم
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('client_name', device.client_name)
            .maybeSingle();
          
          if (clientError) {
            console.error('خطأ في البحث عن العميل للجهاز:', clientError);
            continue;
          }
          
          if (!clientData) {
            console.warn(`لم يتم العثور على العميل: ${device.client_name} للجهاز`);
            continue;
          }
          
          const clientId = clientData.id;
          
          // التحقق من وجود الجهاز مسبقًا
          const { data: existingDevices, error: checkDeviceError } = await supabase
            .from('devices')
            .select('id')
            .eq('client_id', clientId)
            .eq('activation_code', device.activation_code);
          
          if (checkDeviceError) {
            console.error('خطأ في التحقق من وجود الجهاز:', checkDeviceError);
            continue;
          }
          
          if (existingDevices && existingDevices.length > 0) {
            // تحديث الجهاز الموجود
            const { error: updateDeviceError } = await supabase
              .from('devices')
              .update({
                device_type: device.device_type,
                price: device.price,
                subscription_start: device.subscription_start,
                subscription_end: device.subscription_end,
                notes: device.notes
              })
              .eq('id', existingDevices[0].id);
            
            if (updateDeviceError) {
              console.error('خطأ في تحديث الجهاز:', updateDeviceError);
              continue;
            }
          } else {
            // إدخال جهاز جديد
            const { error: insertDeviceError } = await supabase
              .from('devices')
              .insert({
                client_id: clientId,
                activation_code: device.activation_code,
                device_type: device.device_type,
                price: device.price,
                subscription_start: device.subscription_start,
                subscription_end: device.subscription_end,
                notes: device.notes
              });
            
            if (insertDeviceError) {
              console.error('خطأ في إدخال الجهاز:', insertDeviceError);
              continue;
            }
          }
          
          insertedDevices++;
        } catch (error) {
          console.error('خطأ في معالجة الجهاز:', error);
          continue;
        }
      }
      
      // تحديث الإحصائيات
      setStats({
        clients: insertedClients,
        devices: insertedDevices,
        total: insertedClients + insertedDevices
      });
      
      setShowStats(true);
      
      if (insertedClients > 0 || insertedDevices > 0) {
        toast.success(`تم استيراد ${insertedClients} عميل و ${insertedDevices} جهاز بنجاح`);
        
        if (clientsErrors > 0 || devicesErrors > 0) {
          toast.error(`تم تخطي ${clientsErrors} عميل و ${devicesErrors} جهاز بسبب أخطاء`);
        }
      } else {
        if (clientsErrors > 0 || devicesErrors > 0) {
          toast.error(`فشل استيراد ${clientsErrors} عميل و ${devicesErrors} جهاز`);
        } else {
          toast.error('لم يتم استيراد أي بيانات');
        }
      }
      
      onImportSuccess?.();
    } catch (error) {
      console.error('خطأ في استيراد الملف:', error);
      toast.error(`حدث خطأ أثناء استيراد الملف: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // دالة لإنشاء رمز تفعيل عشوائي
  const generateActivationCode = (length: number) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center mb-4">
        <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400 ml-2" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">استيراد من ملف Excel</h2>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
        قم بتحميل ملف Excel يحتوي على ورقتين: "العملاء" و "الأجهزة" لاستيراد البيانات.
      </p>

      <button
        onClick={() => document.getElementById('excelFileInput')?.click()}
        disabled={isImporting}
        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-xl transition-colors"
      >
        {isImporting ? (
          <Spinner size="sm" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
        <span>استيراد من Excel</span>
      </button>
      <input
        id="excelFileInput"
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      {showStats && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
          <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">تم الاستيراد بنجاح:</h3>
          <div className="flex gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {stats.clients} عميل
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              {stats.devices} جهاز
            </span>
          </div>
        </div>
      )}

      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">تنسيق الملف:</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>ورقة "العملاء": اسم العميل، اسم المؤسسة، نوع النشاط، الهاتف، الهاتف 2، العنوان، ملاحظات، نوع الاشتراك، تاريخ بداية الاشتراك، تاريخ نهاية الاشتراك</li>
          <li>ورقة "الأجهزة": اسم العميل، رمز التفعيل مكون من ارقام ، نوع الجهاز (computer أو android)، السعر، تاريخ بداية الاشتراك، تاريخ نهاية الاشتراك، ملاحظات</li>
          <li>يتم الربط بين العملاء والأجهزة باستخدام حقل "اسم العميل"</li>
        </ul>
      </div>
    </div>
  );
};