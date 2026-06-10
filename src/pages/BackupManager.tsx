import React, { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { FileText, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { ExcelImporter } from '../components/ExcelImporter'; // تأكد من صحة المسار
import { WhatsAppImporter } from '../components/WhatsAppImporter'; // تأكد من صحة المسار
import * as XLSX from 'xlsx';
import { useAuthStore } from '@/store/authStore'; // تأكد من صحة المسار

// مكون Spinner البسيط
const Spinner: React.FC<{ className?: string }> = ({ className = "h-8 w-8" }) => (
  <div className="flex items-center justify-center">
    <Loader2 className={`${className} animate-spin text-gray-500 dark:text-gray-400`} />
  </div>
);

const BackupManager: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false); // لإنشاء النسخة الاحتياطية
  const [isRestoring, setIsRestoring] = useState(false); // لاستعادة النسخة الاحتياطية
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [backupStats, setBackupStats] = useState({
    clients: 0,
    devices: 0,
    agents: 0
  });
  const { sessionError, refreshSession } = useAuthStore();

  // تهيئة التكوين
  const config = {
    backupPath: 'backups', // قد لا يستخدم هذا مباشرة الآن
    maxBackups: 5,        // للرجوع إليه مستقبلاً لإدارة سجلات النسخ
    fileTypes: ['json'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    version: '1.0.0'      // لمقارنة إصدارات النسخ الاحتياطية
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
        window.location.href = '/login'; // تأكد من صحة مسار صفحة الدخول
      }, 2000);
    }
  }, [sessionError, history]); // أضف history إذا كنت تستخدم react-router

  // جلب معلومات آخر نسخة احتياطية والإحصائيات الحالية عند تحميل المكون
  useEffect(() => {
    fetchCurrentStatsAndLastBackupInfo();
  }, []);

  // --- دالة لإنشاء نسخة احتياطية مع جلب جميع العملاء (Pagination) ---
  const handleCreateBackup = async () => {
    if (isLoading) return; // منع الطلبات المتكررة

    setIsLoading(true);
    const backupToastId = toast.loading('جارٍ تجهيز النسخة الاحتياطية... قد يستغرق بعض الوقت حسب حجم البيانات.');

    try {
      let allClients: any[] = [];
      let offset = 0;
      const limit = 1000; // عدد السجلات لجلبها في كل طلب (الحد الأقصى الافتراضي لـ Supabase)
      let hasMore = true;
      let page = 1;

      console.log("Starting to fetch all clients for backup...");

      while (hasMore) {
        console.log(`Fetching client page ${page} (offset: ${offset}, limit: ${limit})...`);
        // toast.loading(`جارٍ جلب صفحة العملاء رقم ${page}...`, { id: `fetching-page-${page}` }); // يمكن إلغاء التعليق لإظهار تقدم أكثر تفصيلاً
        const { data: clientPage, error } = await supabase
          .from('clients')
          .select(`
            *,
            devices (*)
          `)
          .range(offset, offset + limit - 1); // <-- تحديد النطاق لجلب البيانات على دفعات

        // toast.dismiss(`fetching-page-${page}`);

        if (error) {
          console.error(`Error fetching client page ${page}:`, error);
          throw new Error(`فشل في جلب صفحة العملاء ${page}: ${error.message}`);
        }

        if (clientPage && clientPage.length > 0) {
          allClients = allClients.concat(clientPage);
          offset += clientPage.length;
          page++;
          console.log(`Fetched ${clientPage.length} clients. Total so far: ${allClients.length}`);
          // تحقق مما إذا كانت هذه آخر صفحة (حصلنا على أقل من الحد الأقصى للطلب)
          if (clientPage.length < limit) {
             hasMore = false;
             console.log("Last page fetched.");
          }
        } else {
          // لم يتم العثور على مزيد من البيانات
          hasMore = false;
          console.log("No more clients found in this request, assuming end.");
        }

        // إجراء وقائي بسيط ضد الحلقات اللانهائية المحتملة
        if (page > 200) { // يمكنك زيادة هذا الحد إذا كان لديك عدد كبير جدًا من العملاء
             console.warn("Backup fetching stopped after 200 pages to prevent potential infinite loop.");
             toast.error("توقف جلب البيانات للنسخ الاحتياطي بعد عدد كبير جدًا من الصفحات.", { duration: 6000 });
             hasMore = false; // أوقف الحلقة
             throw new Error("Exceeded maximum page limit for backup.");
        }
      }

      console.log(`Total clients fetched for backup: ${allClients.length}`);

      if (allClients.length === 0) {
         toast.error('لم يتم العثور على عملاء لإنشاء نسخة احتياطية.', { id: backupToastId });
         setIsLoading(false);
         return;
      }

      const backupData = {
        timestamp: new Date().toISOString(),
        clients: allClients, // استخدم مصفوفة العملاء الكاملة
        config: config // تضمين معلومات التكوين (اختياري)
      };

      toast.loading('جارٍ تحويل البيانات وحفظ الملف...', { id: backupToastId });

      const jsonString = JSON.stringify(backupData, null, 2); // تنسيق JSON بشكل مقروء
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' }); // تحديد الترميز
      // اسم ملف مفيد يتضمن التاريخ وعدد العملاء
      const fileName = `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}_${allClients.length}clients.json`;
      saveAs(blob, fileName);

      toast.success(`تم إنشاء وحفظ النسخة الاحتياطية بنجاح (${allClients.length} عميل).`, { id: backupToastId });

      // يمكنك هنا حفظ سجل النسخ الاحتياطي في قاعدة بيانات Supabase إذا أردت
      // await recordBackupEvent(fileName, { clients: allClients.length, devices: /* calculate device count */ });
      await fetchCurrentStatsAndLastBackupInfo(); // تحديث الإحصائيات والتاريخ بعد النسخ

    } catch (error: any) {
      console.error('خطأ في إنشاء النسخة الاحتياطية الكاملة:', error);
      toast.error(`حدث خطأ أثناء إنشاء النسخة الاحتياطية: ${error.message}`, { id: backupToastId });
    } finally {
      setIsLoading(false);
    }
  };

  // --- دالة لتنزيل قالب إكسل ---
  const handleDownloadTemplate = () => {
    // إنشاء ورقة العملاء
    const clientsData = [
      ['اسم العميل', 'اسم المؤسسة', 'نوع النشاط', 'الهاتف', 'الهاتف 2', 'العنوان', 'ملاحظات', 'نوع الاشتراك', 'قيمة الاشتراك', 'تاريخ بداية الاشتراك', 'تاريخ نهاية الاشتراك'],
      ['مثال عميل 1', 'شركة وهمية', 'تطوير برمجيات', '0500000001', '0500000002', 'الرياض، السعودية', 'عميل هام', 'سنوي', '1500', '2024-01-15', '2025-01-14'],
      ['مثال عميل 2', 'مؤسسة خيالية', 'تجارة', '0511111111', '', 'جدة، السعودية', '', 'شهري', '200', '2024-07-01', '2024-07-31'],
    ];

    // إنشاء ورقة الأجهزة
    const devicesData = [
      ['اسم العميل', 'رمز التفعيل', 'نوع الجهاز', 'السعر', 'تاريخ بداية الاشتراك', 'تاريخ نهاية الاشتراك', 'ملاحظات'],
      ['مثال عميل 1', 'ACTIVATE-CODE-11111111', 'computer', '1500', '2024-01-15', '2025-01-14', 'الجهاز الرئيسي'],
      ['مثال عميل 1', 'ACTIVATE-CODE-22222222', 'android', '0', '2024-01-15', '2025-01-14', 'جهاز إضافي مجاني'],
      ['مثال عميل 2', 'ACTIVATE-CODE-33333333', 'computer', '200', '2024-07-01', '2024-07-31', ''],
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
    XLSX.writeFile(wb, 'template_import_clients_devices.xlsx');
    toast.success('تم بدء تنزيل قالب الاستيراد.');
  };

  // --- دالة مساعد لتقسيم البيانات وإدراجها/تحديثها (Upsert) ---
  const chunkedUpsert = async (tableName: string, data: any[], chunkSize: number = 500) => {
    let processedCount = 0;
    const totalRecords = data.length;
    const numChunks = Math.ceil(totalRecords / chunkSize);

    for (let i = 0; i < totalRecords; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      console.log(`Upserting chunk ${chunkNumber}/${numChunks} for ${tableName} (${chunk.length} records)...`);
      const toastId = toast.loading(`(${tableName}) جاري معالجة الجزء ${chunkNumber} من ${numChunks}... (${processedCount}/${totalRecords})`);

      try {
        const { error } = await supabase.from(tableName).upsert(chunk);
        if (error) {
            console.error(`------ ERROR Upserting Chunk ${chunkNumber} for ${tableName} ------`);
            console.error("Error Details:", JSON.stringify(error, null, 2));
            // حاول تسجيل بعض البيانات من الجزء الفاشل لتشخيص المشكلة
            console.error("Failing Chunk Sample (first record):", JSON.stringify(chunk[0], null, 2));
            console.error("--------------------------------------------------");
            // رمي خطأ مفصل أكثر
            throw new Error(`فشل في إدراج جزء ${chunkNumber} من بيانات ${tableName}: ${error.message} - ${error.details || 'لا توجد تفاصيل'}`);
        }
        processedCount += chunk.length;
        toast.success(`(${tableName}) تم استيراد الجزء ${chunkNumber}/${numChunks} بنجاح. (${processedCount}/${totalRecords})`, { id: toastId });
      } catch (error) {
          // تأكد من أن toast الإشعار بالخطأ يظهر بدلاً من إشعار التحميل
          toast.error(`(${tableName}) خطأ في الجزء ${chunkNumber}: ${error instanceof Error ? error.message : String(error)}`, { id: toastId, duration: 10000 });
          // أعد رمي الخطأ لإيقاف عملية الاستعادة بأكملها عند أول فشل
          throw error;
      }
    }
    return processedCount;
  };
  // ------------------------------------------

  // --- دالة لاستعادة نسخة احتياطية مع تقسيم البيانات (Chunking) ---
  const restoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const fileInput = event.target; // للتمكن من إعادة التعيين

    if (!file) return;

    // تحقق دقيق من امتداد الملف
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'json') {
      toast.error('نوع الملف غير مدعوم. الرجاء اختيار ملف نسخة احتياطية بصيغة JSON.');
      if (fileInput) fileInput.value = ''; // إعادة تعيين حقل الإدخال
      return;
    }

    // تحقق من حجم الملف
    if (file.size > config.maxFileSize) {
      toast.error(`حجم الملف يتجاوز الحد المسموح به (${config.maxFileSize / (1024 * 1024)} ميجابايت).`);
      if (fileInput) fileInput.value = '';
      return;
    }

    setIsRestoring(true);
    const restoreToastId = toast.loading('جارٍ قراءة ملف النسخة الاحتياطية...');

    let clientsRestoredCount = 0;
    let devicesRestoredCount = 0;

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          toast.loading('جارٍ تحليل البيانات والتحقق منها...', { id: restoreToastId });
          if (!e.target?.result) {
            throw new Error('فشل قراءة محتوى الملف.');
          }

          const backupData = JSON.parse(e.target.result as string);

          // التحقق من صحة البنية الأساسية للملف
          if (!backupData || !backupData.timestamp || !Array.isArray(backupData.clients)) {
            throw new Error('ملف النسخ الاحتياطي غير صالح أو تالف (البنية الأساسية غير صحيحة).');
          }
          console.log(`Backup file loaded. Found ${backupData.clients.length} clients. Timestamp: ${backupData.timestamp}`);

          // التحقق من توافق الإصدار (اختياري ولكن مفيد)
          if (backupData.config && backupData.config.version !== config.version) {
            toast.error(`تحذير: إصدار النسخة الاحتياطية (${backupData.config.version}) قد يختلف عن إصدار التطبيق الحالي (${config.version}). قد تحدث مشاكل في التوافق.`, { duration: 8000 });
          }

          // تأكيد حذف البيانات الحالية
          const confirmDelete = window.confirm('تحذير!\nهل أنت متأكد أنك تريد حذف *جميع* بيانات العملاء والأجهزة الحالية قبل استعادة النسخة الاحتياطية؟\n\n*** هذا الإجراء لا يمكن التراجع عنه! ***');
          if (!confirmDelete) {
            throw new Error('تم إلغاء عملية الاستعادة بواسطة المستخدم.');
          }

          // حذف البيانات الحالية
          toast.loading('جارٍ حذف البيانات الحالية (الأجهزة أولاً)...', { id: restoreToastId });
          const { error: devicesDeleteError } = await supabase
            .from('devices')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // تجنب أخطاء معينة

          if (devicesDeleteError) {
              console.error('Delete devices error:', devicesDeleteError);
              throw new Error(`فشل حذف الأجهزة الحالية: ${devicesDeleteError.message}`);
          }

          toast.loading('جارٍ حذف البيانات الحالية (العملاء ثانياً)...', { id: restoreToastId });
          const { error: clientsDeleteError } = await supabase
            .from('clients')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

          if (clientsDeleteError) {
            console.error('Delete clients error:', clientsDeleteError);
            throw new Error(`فشل حذف العملاء الحاليين: ${clientsDeleteError.message}`);
          }

          toast.success('تم حذف البيانات الحالية بنجاح. بدء الاستعادة...', { id: restoreToastId });

          // 1. تحضير بيانات العملاء والأجهزة بشكل منفصل
          const clientsToRestore: any[] = [];
          const devicesToRestore: any[] = [];

          backupData.clients.forEach((client: any, index: number) => {
              if (!client || !client.id) {
                  console.warn(`Skipping client at index ${index} due to missing data or ID.`);
                  return; // تخطي العميل إذا كان فارغًا أو بدون ID
              }
              const { devices, ...clientData } = client; // فصل الأجهزة عن بيانات العميل
              clientsToRestore.push(clientData); // إضافة بيانات العميل (بدون الأجهزة المتداخلة)

              if (Array.isArray(devices)) {
                  // التأكد من أن كل جهاز لديه client_id صحيح و ID
                  devices.forEach((device: any, deviceIndex: number) => {
                     if (device && device.id && device.client_id === client.id) {
                         devicesToRestore.push(device);
                     } else {
                         console.warn(`Skipping device at index ${deviceIndex} for client ${client.id} due to missing data, ID, or mismatched client_id. Device data:`, device);
                     }
                  });
              }
          });

          console.log(`Prepared ${clientsToRestore.length} clients and ${devicesToRestore.length} devices for restore.`);

          // 2. استعادة العملاء باستخدام chunkedUpsert
          if (clientsToRestore.length > 0) {
              toast.loading(`جارٍ استعادة ${clientsToRestore.length} عميل...`, { id: restoreToastId });
              console.log("Starting client upsert...");
              clientsRestoredCount = await chunkedUpsert('clients', clientsToRestore, 500); // استخدام حجم chunk 500
              console.log("Finished client upsert. Count:", clientsRestoredCount);
              toast.success(`اكتملت استعادة العملاء (${clientsRestoredCount} سجل).`, { id: restoreToastId });
          } else {
              toast.success('لا يوجد عملاء صالحين لاستعادتهم في الملف.', { id: restoreToastId });
          }

          // 3. استعادة الأجهزة باستخدام chunkedUpsert
          if (devicesToRestore.length > 0) {
             toast.loading(`جارٍ استعادة ${devicesToRestore.length} جهاز...`, { id: restoreToastId });
             console.log("Starting device upsert...");
             // تأكد مرة أخرى أن الأجهزة تحتوي على client_id قبل الإرسال
             const validDevices = devicesToRestore.filter(d => d.client_id);
             if(validDevices.length !== devicesToRestore.length) {
                 console.warn(`Filtered out ${devicesToRestore.length - validDevices.length} devices missing client_id before upsert.`);
             }
             if(validDevices.length > 0) {
                devicesRestoredCount = await chunkedUpsert('devices', validDevices, 500); // استخدام حجم chunk 500
                console.log("Finished device upsert. Count:", devicesRestoredCount);
                toast.success(`اكتملت استعادة الأجهزة (${devicesRestoredCount} سجل).`, { id: restoreToastId });
             } else {
                 toast.success('لا توجد أجهزة صالحة مرتبطة بالعملاء لاستعادتها.', { id: restoreToastId });
             }
          } else {
              toast.success('لا توجد أجهزة لاستعادتها في الملف.', { id: restoreToastId });
          }

          // 4. عرض النتيجة النهائية وتحديث المعلومات
          toast.dismiss(restoreToastId); // إزالة إشعار التحميل النهائي
          const message = `اكتملت عملية الاستعادة بنجاح 🎉\n\nتمت معالجة:\n- ${clientsRestoredCount} عميل\n- ${devicesRestoredCount} جهاز`;
          // استخدام alert أو مكون Modal مخصص لعرض الملخص النهائي
          window.alert(message);
          await fetchCurrentStatsAndLastBackupInfo(); // تحديث الإحصائيات والمعلومات المعروضة

        } catch (error: any) {
          console.error('>>>>>> DETAILED ERROR in restoreBackup (reader.onload) <<<<<<<');
          console.error('Error Object:', error);
          console.error('>>>>>>>>>>>>>>>>>> End of Error <<<<<<<<<<<<<<<<<<<<<');
          // استخدم نفس معرف الـ Toast لعرض الخطأ بدلاً من إشعارات التحميل
          toast.error(`فشل استعادة النسخة الاحتياطية: ${error.message}`, { id: restoreToastId, duration: 10000 });
        } finally {
          setIsRestoring(false);
          // إعادة تعيين حقل إدخال الملف للسماح بإعادة تحديد نفس الملف إذا لزم الأمر
          if (fileInput) fileInput.value = '';
        }
      };

      reader.onerror = (errorEvent) => {
        console.error('خطأ في قراءة الملف (FileReader onerror):', errorEvent);
        toast.error('حدث خطأ أثناء قراءة الملف. تحقق من صلاحيات القراءة أو الملف نفسه.', { id: restoreToastId });
        setIsRestoring(false);
        if (fileInput) fileInput.value = '';
      };

      // بدء قراءة الملف
      reader.readAsText(file); // استخدم readAsText لملفات JSON

    } catch (error: any) {
      console.error('خطأ عام في بدء عملية الاستعادة:', error);
      toast.error(`حدث خطأ غير متوقع: ${error.message}`, { id: restoreToastId });
      setIsRestoring(false);
      if (fileInput) fileInput.value = ''; // تأكد من إعادة التعيين هنا أيضًا
    }
  };

  // --- دالة لجلب الإحصائيات الحالية ومعلومات آخر نسخة احتياطية مسجلة ---
  const fetchCurrentStatsAndLastBackupInfo = async () => {
    console.log("Fetching current stats and last backup info...");
    try {
      // جلب عدد العملاء الحالي
      const { count: clientCount, error: clientError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      if (clientError) throw new Error(`Failed to fetch client count: ${clientError.message}`);

      // جلب عدد الأجهزة الحالي
      const { count: deviceCount, error: deviceError } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true });

      if (deviceError) throw new Error(`Failed to fetch device count: ${deviceError.message}`);

      // جلب عدد الوكلاء الحالي (افترض وجود جدول 'agents')
      // استخدم try-catch منفصل للوكلاء لجعلها اختيارية
      let finalAgentCount = 0;
      try {
        const { count: agentCount, error: agentError } = await supabase
          .from('agents') // تأكد من اسم الجدول الصحيح للوكلاء
          .select('*', { count: 'exact', head: true });
        if (agentError) {
           console.warn('Could not fetch agent count (maybe table doesnt exist?):', agentError.message);
        } else if (agentCount !== null) {
          finalAgentCount = agentCount;
        }
      } catch (agentFetchError) {
         console.warn('Error during agent count fetch:', agentFetchError);
      }


      // تحديث حالة الإحصائيات
      setBackupStats({
        clients: clientCount ?? 0,
        devices: deviceCount ?? 0,
        agents: finalAgentCount
      });
      console.log("Current stats updated:", { clients: clientCount, devices: deviceCount, agents: finalAgentCount });

      // جلب تاريخ آخر نسخة احتياطية مسجلة (إذا كنت تستخدم getBackupHistory)
      try {
        // تأكد من أن getBackupHistory موجودة وتعمل كما هو متوقع
        // const backups = await getBackupHistory();
        // if (backups && backups.length > 0) {
        //   const latestBackup = backups[0]; // افترض أنها مرتبة تنازليًا
        //   setLastBackupDate(latestBackup.created_at);
        //   console.log("Last backup date found:", latestBackup.created_at);
        // } else {
        //   setLastBackupDate(null);
        //   console.log("No backup history found.");
        // }
        setLastBackupDate(null); // مؤقتًا، افترض عدم وجود سجل
      } catch (historyError) {
          console.error("Error fetching backup history:", historyError);
          setLastBackupDate(null); // اعتبر لا يوجد تاريخ عند حدوث خطأ
      }


    } catch (error: any) {
      console.error('خطأ في جلب الإحصائيات الحالية أو معلومات النسخ الاحتياطي:', error);
      toast.error(`فشل في تحميل الإحصائيات: ${error.message}`);
      // ضبط الإحصائيات على صفر في حالة الفشل
      setBackupStats({ clients: 0, devices: 0, agents: 0 });
      setLastBackupDate(null);
    }
  };

  // --- عرض المكون (JSX) ---
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* العنوان الرئيسي */}
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          إدارة النسخ الاحتياطي والاستيراد
        </h1>

        {/* شبكة أدوات النسخ والاستعادة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* بطاقة إنشاء نسخة احتياطية */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
              إنشاء نسخة احتياطية (JSON)
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              قم بإنشاء نسخة احتياطية كاملة (تشمل جميع العملاء والأجهزة) بتنسيق JSON لحفظ بياناتك.
            </p>
            <button
              onClick={handleCreateBackup}
              disabled={isLoading || isRestoring} // تعطيل أثناء الإنشاء أو الاستعادة
              className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl hover:from-green-700 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <Spinner className="w-5 h-5" /> جاري الإنشاء...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" /> إنشاء نسخة احتياطية الآن
                </>
              )}
            </button>
          </div>

          {/* بطاقة استعادة النسخة الاحتياطية */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              استعادة نسخة احتياطية (JSON)
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              استعد بياناتك من ملف JSON. <strong className="text-red-600 dark:text-red-400">تحذير:</strong> سيتم حذف البيانات الحالية قبل الاستعادة.
            </p>
            <label className="block w-full">
              {/* زر اختيار الملف، يتم تعطيله أثناء الاستعادة أو الإنشاء */}
              <div className={`flex items-center justify-center w-full px-4 py-3 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg ${isRestoring || isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 cursor-pointer'}`}>
                <FileText className="w-5 h-5 mr-2" />
                <span>{isRestoring ? 'جاري الاستعادة...' : 'اختيار ملف النسخة الاحتياطية (.json)'}</span>
                <input
                  type="file"
                  accept=".json,application/json" // تحديد أنواع الملفات المقبولة
                  onChange={restoreBackup}
                  className="hidden" // إخفاء الإدخال الفعلي
                  disabled={isRestoring || isLoading} // تعطيل الإدخال
                  // إعادة تعيين المفتاح لتمكين إعادة التحديد بعد الانتهاء
                  key={isRestoring ? 'restoring' : 'idle'}
                />
              </div>
            </label>
            {isRestoring && (
              <div className="flex justify-center items-center mt-4 space-x-2 space-x-reverse">
                <Spinner className="w-5 h-5"/>
                <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">العملية قد تستغرق بعض الوقت...</p>
              </div>
            )}
          </div>
        </div>

        {/* بطاقة استيراد من Excel */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            استيراد من ملف Excel
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            استورد بيانات العملاء والأجهزة من ملف Excel (.xlsx). استخدم القالب المخصص لتجنب الأخطاء.
          </p>
          <div className="space-y-4">
             {/* مكون استيراد اكسل */}
            <ExcelImporter
              type="clients_and_devices" // تأكد من أن هذا النوع مدعوم في المكون
              onImportSuccess={() => {
                toast.success('تم استيراد البيانات من Excel بنجاح.');
                fetchCurrentStatsAndLastBackupInfo(); // تحديث الإحصائيات بعد الاستيراد
              }}
            />
            {/* زر تحميل القالب */}
            <button
              onClick={handleDownloadTemplate}
              disabled={isLoading || isRestoring}
              className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <FileText className="w-5 h-5" />
              تحميل قالب الاستيراد (Excel)
            </button>
          </div>
        </div>

        {/* بطاقة استيراد من واتساب */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
           {/* مكون استيراد واتساب */}
          <WhatsAppImporter
            onImportSuccess={() => {
              toast.success('تم استيراد البيانات من WhatsApp بنجاح.');
              fetchCurrentStatsAndLastBackupInfo(); // تحديث الإحصائيات بعد الاستيراد
            }}
          />
        </div>

        {/* بطاقة عرض الإحصائيات ومعلومات آخر نسخة */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 animate-fadeIn">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              الإحصائيات الحالية وآخر نسخة احتياطية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* تاريخ آخر نسخة مسجلة */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">
                  تاريخ آخر نسخة احتياطية (مسجلة)
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {lastBackupDate ? format(new Date(lastBackupDate), 'yyyy-MM-dd HH:mm:ss') : 'غير متوفر'}
                </p>
              </div>
              {/* الإحصائيات الحالية */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
               <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">الإحصائيات الحالية في قاعدة البيانات</p>
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
      </div>
    </div>
  );
};

export default BackupManager;