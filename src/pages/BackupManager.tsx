import { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { FileText, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { ExcelImporter } from '../components/ExcelImporter';
import { WhatsAppImporter } from '../components/WhatsAppImporter';
import { getBackupHistory } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';
import { useAuthStore } from '@/store/authStore';

// مكون Spinner البسيط
const Spinner = ({ className = "h-8 w-8" }) => (
  <div className="flex items-center justify-center">
    <Loader2 className={`${className} animate-spin text-gray-500 dark:text-gray-400`} />
  </div>
);

const BackupManager: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [backupStats, setBackupStats] = useState({
    clients: 0,
    devices: 0,
    agents: 0
  });
  const [clientsCount, setClientsCount] = useState(0);
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const { sessionError, refreshSession } = useAuthStore();

  // تهيئة التكوين
  const config = {
    backupPath: 'backups',
    maxBackups: 5,
    fileTypes: ['json'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    version: '1.0.0'
  };

  // تحديث الجلسة عند تحميل المكون
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // التحقق من أخطاء الجلسة
  useEffect(() => {
    if (sessionError) {
      toast.error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
      // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  }, [sessionError]);

  useEffect(() => {
    fetchLastBackupInfo();
  }, []);

  const handleCreateBackup = async () => {
    if (isLoading) return; // منع الطلبات المتكررة
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          devices (*)
        `);

      if (error) throw error;

      const backupData = {
        timestamp: new Date().toISOString(),
        clients: data,
        config: config
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      saveAs(blob, fileName);
      
      toast.success('تم إنشاء النسخة الاحتياطية بنجاح');
    } catch (error) {
      console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
      toast.error('حدث خطأ أثناء إنشاء النسخة الاحتياطية');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // إنشاء ورقة العملاء
    const clientsData = [
      ['اسم العميل', 'اسم المؤسسة', 'نوع النشاط', 'الهاتف', 'الهاتف 2', 'العنوان', 'ملاحظات', 'نوع الاشتراك', 'قيمة الاشتراك', 'تاريخ بداية الاشتراك', 'تاريخ نهاية الاشتراك'],
      ['أحمد محمد', 'شركة التقنية', 'تجارة إلكترونية', '0123456789', '0123456788', 'شارع المدينة', 'عميل منتظم', 'سنوي', '1200', '2024-01-01', '2025-01-01'],
      ['محمد علي', 'مؤسسة الأمل', 'خدمات طبية', '0198765432', '', 'شارع السلام', 'عميل جديد', 'شهري', '150', '2024-03-01', '2024-04-01'],
    ];

    // إنشاء ورقة الأجهزة
    const devicesData = [
      ['اسم العميل', 'رمز التفعيل', 'نوع الجهاز', 'السعر', 'تاريخ بداية الاشتراك', 'تاريخ نهاية الاشتراك', 'ملاحظات'],
      ['أحمد محمد', '12345678901234567890', 'computer', '1200', '2024-01-01', '2025-01-01', 'جهاز رئيسي'],
      ['أحمد محمد', '09876543210987654321', 'android', '1200', '2024-01-01', '2024-12-31', 'جهاز ثانوي'],
      ['محمد علي', '56789012345678901234', 'computer', '150', '2024-03-01', '2024-04-01', ''],
    ];

    // إنشاء ملف إكسل متعدد الأوراق
    const wb = XLSX.utils.book_new();
    
    // إضافة ورقة العملاء
    const wsClients = XLSX.utils.aoa_to_sheet(clientsData);
    XLSX.utils.book_append_sheet(wb, wsClients, 'العملاء');
    
    // إضافة ورقة الأجهزة
    setAllDevices([]); // Initialize empty array for devicesData
    const wsDevices = XLSX.utils.aoa_to_sheet(devicesData);
    XLSX.utils.book_append_sheet(wb, wsDevices, 'الأجهزة');
    
    // تنزيل الملف
    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  const restoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // تحقق من امتداد الملف بدلاً من نوع الملف
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'json') {
      toast.error('نوع الملف غير مدعوم. يجب أن يكون ملف JSON');
      event.target.value = '';
      return;
    }

    if (file.size > config.maxFileSize) {
      toast.error('حجم الملف كبير جداً');
      event.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error('فشل قراءة الملف');
          }
          
          const backupData = JSON.parse(e.target.result as string);
          
          // التحقق من صحة ملف النسخ الاحتياطي
          if (!backupData || !backupData.timestamp || !backupData.clients) {
            throw new Error('ملف النسخ الاحتياطي غير صالح');
          }

          // التحقق من توافق الإصدار
          if (backupData.config && backupData.config.version !== config.version) {
            console.warn('تحذير: النسخة قد لا تكون متوافقة مع إصدار البرنامج الحالي');
            // نستمر في الاستعادة رغم اختلاف الإصدار، لكن نعرض تحذيرًا
            toast.error('تحذير: النسخة قد لا تكون متوافقة مع إصدار البرنامج الحالي، سيتم المحاولة على أي حال');
          }

          // حذف البيانات الحالية (اختياري - يمكن تعديله حسب الحاجة)
          if (window.confirm('هل تريد حذف جميع البيانات الحالية قبل استعادة النسخ الاحتياطي؟')) {
            // حذف الأجهزة أولاً بسبب قيود المفتاح الأجنبي
            const { error: devicesDeleteError } = await supabase
              .from('devices')
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
            
            if (devicesDeleteError) {
              console.error('خطأ في حذف الأجهزة:', devicesDeleteError);
              throw devicesDeleteError;
            }
            
            // ثم حذف العملاء
            const { error: clientsDeleteError } = await supabase
              .from('clients')
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
            
            if (clientsDeleteError) {
              console.error('خطأ في حذف العملاء:', clientsDeleteError);
              throw clientsDeleteError;
            }
            
            toast.success('تم حذف البيانات الحالية بنجاح');
          }

          // إعداد مصفوفة لتخزين الأجهزة
          let allDevices: any[] = [];
          let clientsCount = 0;

          // معالجة بيانات العملاء والأجهزة
          for (const client of backupData.clients) {
            // استخراج الأجهزة من العميل
            const clientDevices = client.devices || [];
            
            // حفظ نسخة من الأجهزة قبل حذفها من كائن العميل
            setAllDevices(prev => [...prev, ...clientDevices]);
            
            // حذف الأجهزة من كائن العميل لتجنب الخطأ عند الإدراج
            const clientData = { ...client };
            delete clientData.devices;
            
            // إدراج العميل
            const { error: clientError } = await supabase
              .from('clients')
              .upsert(clientData);
            
            if (clientError) {
              console.error('خطأ في استعادة العميل:', {
                clientId: clientData.id,
                error: clientError,
                clientData: clientData
              });
              throw new Error(`فشل في استعادة العميل ${clientData.id}: ${clientError.message}`);
            }
            
            setClientsCount(prev => prev + 1);
          }

          // إشعار بعدد العملاء المستعادين
          toast.success(`تم استعادة ${clientsCount} عميل بنجاح`);
          
          // استعادة الأجهزة بعد الانتهاء من استعادة جميع العملاء
          if (allDevices.length > 0) {
            const { error: devicesError } = await supabase
              .from('devices')
              .upsert(allDevices);
            
            if (devicesError) {
              console.error('خطأ في استعادة الأجهزة:', {
                error: devicesError,
                devicesCount: allDevices.length,
                devices: allDevices
              });
              throw new Error(`فشل في استعادة الأجهزة: ${devicesError.message}`);
            }
            
            // إشعار بعدد الأجهزة المستعادين
            toast.success(`تم استعادة ${allDevices.length} جهاز بنجاح`);
          }

          // حوار نهائي يلخص عملية الاستعادة
          const message = `تم استعادة النسخة الاحتياطية بنجاح 🎉\n\nتم استعادة:\n${clientsCount} عميل\n${allDevices.length} جهاز`;
          window.alert(message);
          fetchLastBackupInfo();
        } catch (error) {
          console.error('خطأ في استعادة النسخة الاحتياطية:', {
            error: error,
            clientsCount: clientsCount,
          });
          toast.error(`حدث خطأ أثناء استعادة النسخة الاحتياطية:\n${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        } finally {
          setIsRestoring(false);
        }
      };

      reader.onerror = () => {
        console.error('خطأ في قراءة الملف');
        toast.error('حدث خطأ أثناء قراءة الملف');
        setIsRestoring(false);
        event.target.value = '';
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('خطأ في قراءة الملف:', error);
      toast.error('حدث خطأ أثناء قراءة الملف');
      setIsRestoring(false);
      event.target.value = '';
    }
  };

  const fetchLastBackupInfo = async () => {
    try {
      const backups = await getBackupHistory();
      if (backups && backups.length > 0) {
        const latestBackup = backups[0];
        setLastBackupDate(latestBackup.created_at);
        setBackupStats(latestBackup.stats || backupStats);
      }
    } catch (error) {
      console.error('خطأ في جلب معلومات النسخ الاحتياطي:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          إدارة النسخ الاحتياطي
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* إنشاء نسخة احتياطية */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
              إنشاء نسخة احتياطية
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              قم بإنشاء نسخة احتياطية كاملة من بيانات العملاء والأجهزة للحفاظ على بياناتك آمنة.
            </p>
            <div className="space-y-4">
              <button
                onClick={handleCreateBackup}
                disabled={isLoading}
                className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl hover:from-green-700 hover:to-green-600 disabled:opacity-50 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                {isLoading ? (
                  <Spinner className="w-5 h-5" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                إنشاء نسخة احتياطية
              </button>
            </div>
          </div>

          {/* استعادة النسخة الاحتياطية */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              استعادة النسخة الاحتياطية
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              استعد بياناتك من ملف نسخة احتياطية سابق. سيتم استبدال البيانات الحالية.
            </p>
            <div className="space-y-4">
              <label className="block w-full">
                <div className="flex items-center justify-center w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all duration-300 shadow-md hover:shadow-lg cursor-pointer">
                  <FileText className="w-5 h-5 mr-2" />
                  <span>اختر ملف النسخة الاحتياطية</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={restoreBackup}
                    className="hidden"
                    disabled={isRestoring}
                  />
                </div>
              </label>
              {isRestoring && (
                <div className="flex justify-center mt-4">
                  <Spinner />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* استيراد العملاء */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            استيراد العملاء
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            استورد بيانات العملاء والأجهزة من ملف إكسل. استخدم القالب المتوفر للحصول على أفضل النتائج.
          </p>
          <div className="space-y-4">
            <ExcelImporter 
              type="clients_and_devices" 
              onImportSuccess={() => {
                toast.success('تم استيراد البيانات بنجاح');
                fetchLastBackupInfo();
              }} 
            />
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl hover:from-purple-700 hover:to-purple-600 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <FileText className="w-5 h-5" />
              تحميل قالب الاستيراد
            </button>
          </div>
        </div>

        {/* استيراد من محادثات واتساب */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
          <WhatsAppImporter 
            onImportSuccess={() => {
              fetchLastBackupInfo();
            }} 
          />
        </div>

        {/* معلومات آخر نسخة احتياطية */}
        {lastBackupDate && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 animate-fadeIn">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              آخر نسخة احتياطية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                <p className="text-gray-600 dark:text-gray-300 font-medium">
                  تاريخ النسخة
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(new Date(lastBackupDate), 'yyyy-MM-dd HH:mm')}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-300 text-sm">العملاء</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{backupStats.clients}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-300 text-sm">الأجهزة</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{backupStats.devices}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-300 text-sm">الوكلاء</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{backupStats.agents}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupManager;