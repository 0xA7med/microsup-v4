// src/components/ExcelImporter.tsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { FileSpreadsheet, Upload } from 'lucide-react';
import Spinner from './Spinner';

interface ExcelImporterProps {
  onImportComplete?: () => void;
}

// تعريف أنواع البيانات
interface ExcelClient {
  'اسم العميل': string;
  'اسم المؤسسة': string;
  'نوع النشاط': string;
  'الهاتف': string;
  'الهاتف 2'?: string;
  'العنوان': string;
  'ملاحظات'?: string;
}

interface ExcelDevice {
  'اسم العميل': string;
  'رمز التفعيل': string;
  'تاريخ بداية الاشتراك': string;
  'تاريخ نهاية الاشتراك': string;
  'نوع الاشتراك': string;
  'نوع الجهاز': string;
  'ملاحظات'?: string;
  'حالة الموافقة'?: string;
}

const ExcelImporter: React.FC<ExcelImporterProps> = ({ onImportComplete }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState<{ clients: number; devices: number; total: number }>({ clients: 0, devices: 0, total: 0 });
  const [showStats, setShowStats] = useState(false);

  const processExcelFile = async (file: File) => {
    try {
      setIsImporting(true);
      
      // قراءة الملف
      const reader = new FileReader();
      
      // إضافة تصحيح للمستخدم
      toast.success('جاري قراءة الملف...');
      console.log('جاري قراءة الملف:', file.name);
      
      const data = await new Promise<string | ArrayBuffer>((resolve, reject) => {
        reader.onload = (e: ProgressEvent<FileReader>) => {
          const binaryStr = e.target?.result;
          if (binaryStr) {
            resolve(binaryStr);
          } else {
            reject(new Error('فشل قراءة الملف'));
          }
        };
        reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة الملف'));
        reader.readAsBinaryString(file);
      });

      // إضافة تصحيح للمستخدم
      toast.success('جاري معالجة البيانات...');
      console.log('تم قراءة الملف بنجاح');
      
      const workbook = XLSX.read(data, { type: 'binary' });
      
      // التحقق من وجود الأوراق المطلوبة
      console.log('أوراق العمل الموجودة:', workbook.SheetNames);
      
      const clientsSheetName = workbook.SheetNames.find(name => 
        name === 'العملاء' || name === 'clients' || name.toLowerCase().includes('client'));
      
      const devicesSheetName = workbook.SheetNames.find(name => 
        name === 'الأجهزة' || name === 'devices' || name.toLowerCase().includes('device'));
      
      if (!clientsSheetName || !devicesSheetName) {
        toast.error('الملف لا يحتوي على الأوراق المطلوبة (العملاء والأجهزة)');
        console.error('الأوراق الموجودة:', workbook.SheetNames);
        setIsImporting(false);
        return;
      }

      // قراءة البيانات من الأوراق
      const clientsSheet = XLSX.utils.sheet_to_json(workbook.Sheets[clientsSheetName]);
      const devicesSheet = XLSX.utils.sheet_to_json(workbook.Sheets[devicesSheetName]);

      // التحقق من وجود البيانات
      if (!Array.isArray(clientsSheet) || !Array.isArray(devicesSheet)) {
        toast.error('خطأ في قراءة الملف: تنسيق الملف غير صحيح');
        console.error('بيانات العملاء:', clientsSheet);
        console.error('بيانات الأجهزة:', devicesSheet);
        setIsImporting(false);
        return;
      }

      // إضافة تصحيح للمستخدم
      toast.success('جاري التحقق من صحة البيانات...');
      console.log('عدد العملاء:', clientsSheet.length);
      console.log('عدد الأجهزة:', devicesSheet.length);

      // التحقق من صحة البيانات
      const validateClient = (client: any) => {
        if (!client['اسم العميل'] && !client['client_name'] && !client['name']) {
          toast.error('أحد العملاء يفتقد إلى اسم العميل');
          return false;
        }
        return true;
      };

      const validateDevice = (device: any) => {
        const clientName = device['اسم العميل'] || device['client_name'] || device['name'];
        if (!clientName) {
          toast.error('أحد الأجهزة يفتقد إلى اسم العميل');
          return false;
        }
        return true;
      };

      // التحقق من صحة جميع العملاء والأجهزة
      const invalidClients = clientsSheet.filter((client: any) => !validateClient(client));
      const invalidDevices = devicesSheet.filter((device: any) => !validateDevice(device));

      if (invalidClients.length > 0 || invalidDevices.length > 0) {
        toast.error('هناك بيانات غير صالحة في الملف');
        setIsImporting(false);
        return;
      }

      // تحويل البيانات إلى التنسيق المطلوب
      const processedClients = clientsSheet.map((client: any) => ({
        client_name: client['اسم العميل'] || client['client_name'] || client['name'],
        phone: client['رقم الهاتف'] || client['phone'] || '',
        phone2: client['رقم الهاتف 2'] || client['phone2'] || '',
        address: client['العنوان'] || client['address'] || '',
        subscription_type: client['نوع الاشتراك'] || client['subscription_type'] || 'basic',
        subscription_start: formatDate(client['تاريخ بداية الاشتراك'] || client['subscription_start'] || new Date().toISOString()),
        subscription_end: formatDate(client['تاريخ نهاية الاشتراك'] || client['subscription_end'] || ''),
        software_version: client['نسخة البرنامج'] || client['software_version'] || 'latest'
      }));

      const processedDevices = devicesSheet.map((device: any) => ({
        client_name: device['اسم العميل'] || device['client_name'] || device['name'],
        device_name: device['اسم الجهاز'] || device['device_name'] || '',
        activation_code: device['رمز التفعيل'] || device['activation_code'] || '',
        status: device['الحالة'] || device['status'] || 'pending'
      }));

      // التحقق من وجود المستخدم الحالي
      const { data: userData } = await supabase.auth.getUser();
      const agentId = userData.user?.id;

      if (!agentId) {
        toast.error('لم يتم العثور على معلومات المستخدم الحالي');
        setIsImporting(false);
        return;
      }

      // إضافة agent_id إلى بيانات العملاء
      const clientsWithAgent = processedClients.map(client => ({
        ...client,
        agent_id: agentId
      }));

      // إضافة تصحيح قبل الإدخال
      toast.success('جاري إدخال البيانات في قاعدة البيانات...');
      console.log('بيانات العملاء للإدخال:', clientsWithAgent);

      // حفظ البيانات في قاعدة البيانات
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .upsert(clientsWithAgent, {
          onConflict: 'client_name',
          ignoreDuplicates: true
        })
        .select();

      console.log('نتيجة إدخال العملاء:', { data: clientsData, error: clientsError });

      if (clientsError) {
        console.error('خطأ في إدراج العملاء:', clientsError);
        throw clientsError;
      }

      // إضافة agent_id إلى بيانات الأجهزة
      const devicesWithAgent = processedDevices.map(device => ({
        ...device,
        agent_id: agentId
      }));

      // إضافة تصحيح قبل الإدخال
      console.log('بيانات الأجهزة للإدخال:', devicesWithAgent);

      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .upsert(devicesWithAgent, {
          onConflict: 'activation_code',
          ignoreDuplicates: true
        })
        .select();

      console.log('نتيجة إدخال الأجهزة:', { data: devicesData, error: devicesError });

      if (devicesError) {
        console.error('خطأ في إدراج الأجهزة:', devicesError);
        throw devicesError;
      }

      // تحديث الإحصائيات
      setStats({
        clients: processedClients.length,
        devices: processedDevices.length,
        total: processedClients.length + processedDevices.length
      });
      
      setShowStats(true);
      
      toast.success(`تم استيراد ${processedClients.length} عميل و ${processedDevices.length} جهاز بنجاح`);
      setIsImporting(false);
      onImportComplete?.();
    } catch (error) {
      console.error('خطأ في استيراد الملف:', error);
      toast.error('حدث خطأ أثناء استيراد الملف');
      setIsImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('تم اختيار الملف:', file.name);
      processExcelFile(file);
    }
  };

  // تنسيق التاريخ من صيغة الإكسل إلى صيغة ISO
  const formatDate = (excelDate: any): string => {
    if (!excelDate) return new Date().toISOString().split('T')[0];
    
    // إذا كان التاريخ بصيغة نصية، نحاول تحويله
    if (typeof excelDate === 'string') {
      const date = new Date(excelDate);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // إذا كان التاريخ بصيغة رقمية (عدد الأيام منذ 1/1/1900)
    if (typeof excelDate === 'number') {
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    
    // إرجاع تاريخ اليوم كقيمة افتراضية
    return new Date().toISOString().split('T')[0];
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
      
      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">تنسيق الملف:</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>ورقة "العملاء": اسم العميل، اسم المؤسسة، نوع النشاط، الهاتف، الهاتف 2، العنوان، ملاحظات</li>
          <li>ورقة "الأجهزة": اسم العميل، رمز التفعيل، تاريخ بداية الاشتراك، تاريخ نهاية الاشتراك، نوع الاشتراك، نوع الجهاز، ملاحظات، حالة الموافقة</li>
          <li>يتم الربط بين العملاء والأجهزة باستخدام حقل "اسم العميل"</li>
        </ul>
      </div>
    </div>
  );
};

export default ExcelImporter;