import { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../components/Spinner';
import ExcelImporter from '../components/ExcelImporter';
import { getBackupHistory } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';

const BackupManager: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [backupStats, setBackupStats] = useState({
    clients: 0,
    devices: 0,
    agents: 0
  });

  // تهيئة التكوين
  const config = {
    backupPath: 'backups',
    maxBackups: 5,
    fileTypes: ['json'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    version: '1.0.0'
  };

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
      ['اسم العميل', 'اسم المؤسسة', 'نوع النشاط', 'الهاتف', 'الهاتف 2', 'العنوان', 'ملاحظات'],
      ['أحمد محمد', 'شركة التقنية', 'تجارة إلكترونية', '0123456789', '0123456788', 'شارع المدينة', 'عميل منتظم'],
      ['محمد علي', 'مؤسسة الأمل', 'خدمات طبية', '0198765432', '', 'شارع السلام', 'عميل جديد'],
    ];

    // إنشاء ورقة الأجهزة
    const devicesData = [
      ['اسم العميل', 'رمز التفعيل', 'تاريخ بداية الاشتراك', 'تاريخ نهاية الاشتراك', 'نوع الاشتراك', 'نوع الجهاز', 'ملاحظات', 'حالة الموافقة'],
      ['أحمد محمد', 'ABC123', '2024-01-01', '2025-01-01', 'سنوي', 'Windows', 'جهاز رئيسي', 'approved'],
      ['أحمد محمد', 'DEF456', '2024-01-01', '2024-12-31', 'سنوي', 'Android', 'جهاز ثانوي', 'approved'],
      ['محمد علي', 'GHI789', '2024-03-01', '2025-03-01', 'سنوي', 'Windows', '', 'pending'],
    ];

    // إنشاء ملف إكسل متعدد الأوراق
    const wb = XLSX.utils.book_new();
    
    // إضافة ورقة العملاء
    const wsClients = XLSX.utils.aoa_to_sheet(clientsData);
    XLSX.utils.book_append_sheet(wb, wsClients, 'العملاء');
    
    // إضافة ورقة الأجهزة
    const wsDevices = XLSX.utils.aoa_to_sheet(devicesData);
    XLSX.utils.book_append_sheet(wb, wsDevices, 'الأجهزة');
    
    // تنزيل الملف
    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  const restoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!config.fileTypes.includes(file.type)) {
      toast.error('نوع الملف غير مدعوم');
      return;
    }

    if (file.size > config.maxFileSize) {
      toast.error('حجم الملف كبير جداً');
      return;
    }

    setIsRestoring(true);
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target?.result as string);
          
          // التحقق من صحة ملف النسخ الاحتياطي
          if (!backupData || !backupData.timestamp || !backupData.clients) {
            throw new Error('ملف النسخ الاحتياطي غير صالح');
          }

          // التحقق من توافق الإصدار
          if (backupData.config && backupData.config.version !== config.version) {
            throw new Error('النسخة غير متوافقة مع إصدار البرنامج الحالي');
          }

          // حذف البيانات الحالية (اختياري - يمكن تعديله حسب الحاجة)
          if (window.confirm('هل تريد حذف جميع البيانات الحالية قبل استعادة النسخ الاحتياطي؟')) {
            await supabase.from('devices').delete().neq('id', 0);
            await supabase.from('clients').delete().neq('id', 0);
          }

          // تنفيذ عملية الاستعادة
          const { error } = await supabase
            .from('clients')
            .upsert(backupData.clients);

          if (error) throw error;

          toast.success('تم استعادة النسخة الاحتياطية بنجاح');
          fetchLastBackupInfo();
        } catch (error) {
          console.error('خطأ في استعادة النسخة الاحتياطية:', error);
          toast.error('حدث خطأ أثناء استعادة النسخة الاحتياطية');
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('خطأ في قراءة الملف:', error);
      toast.error('حدث خطأ أثناء قراءة الملف');
    } finally {
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          إدارة النسخ الاحتياطي
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            إنشاء نسخة احتياطية
          </h2>
          <div className="space-y-4">
            <button
              onClick={handleCreateBackup}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            استعادة النسخة الاحتياطية
          </h2>
          <div className="space-y-4">
            <input
              type="file"
              accept=".json"
              onChange={restoreBackup}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isRestoring}
            />
            {isRestoring && (
              <div className="flex justify-center mt-4">
                <Spinner />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            استيراد العملاء
          </h2>
          <div className="space-y-4">
            <ExcelImporter />
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FileText className="w-5 h-5" />
              تحميل قالب الاستيراد
            </button>
          </div>
        </div>

        {lastBackupDate && (
          <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              آخر نسخة احتياطية
            </h3>
            <div className="space-y-2">
              <p className="text-gray-600 dark:text-gray-300">
                تاريخ النسخة: {format(new Date(lastBackupDate), 'yyyy-MM-dd HH:mm')}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                عدد العملاء: {backupStats.clients}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                عدد الأجهزة: {backupStats.devices}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                عدد الوكلاء: {backupStats.agents}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupManager;