import React, { useState } from 'react';
import { Card, Button, Tabs, Input, Table, Switch, Tooltip, Radio, Modal, Upload, Progress, Slider } from 'antd';
import { UploadOutlined, FileExcelOutlined, SettingOutlined, InfoCircleOutlined, EditOutlined, GlobalOutlined } from '@ant-design/icons';
import { extractDataFromWhatsAppChat } from '../services/aiService';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

// تعريف أنواع البيانات
interface ClientData {
  [key: string]: string;
}

interface DeviceData {
  [key: string]: string;
}

interface WhatsAppImporterProps {
  onImportSuccess?: () => void;
}

const WhatsAppImporter: React.FC<WhatsAppImporterProps> = ({ onImportSuccess }) => {
  const { user } = useAuthStore();

  // حالة الملف والمعالجة
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [clientsData, setClientsData] = useState<ClientData[]>([]);
  const [devicesData, setDevicesData] = useState<DeviceData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [messageText, setMessageText] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'deepseek'>('gemini');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [activeTab, setActiveTab] = useState<'clients' | 'devices'>('clients');
  
  // حالة التعديل
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<'client' | 'device'>('client');
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceData | null>(null);
  
  // حالة معالجة الدفعات
  const [useBatchProcessing, setUseBatchProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState(20);
  const [advancedSettingsVisible, setAdvancedSettingsVisible] = useState(false);

  // قراءة مفاتيح API من ملف البيئة عند تحميل المكون
  React.useEffect(() => {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
    
    if (geminiApiKey && aiProvider === 'gemini') {
      setApiKeyInput(geminiApiKey);
    } else if (deepseekApiKey && aiProvider === 'deepseek') {
      setApiKeyInput(deepseekApiKey);
    }
  }, [aiProvider]);

  // وظائف تعديل البيانات
  const handleEditClient = (index: number) => {
    setEditingType('client');
    setEditingIndex(index);
    setEditingClient({ ...clientsData[index] });
    setIsEditModalVisible(true);
  };

  const handleEditDevice = (index: number) => {
    setEditingType('device');
    setEditingIndex(index);
    setEditingDevice({ ...devicesData[index] });
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (editingType === 'client' && editingClient) {
      const newClientsData = [...clientsData];
      newClientsData[editingIndex] = editingClient;
      setClientsData(newClientsData);
    } else if (editingType === 'device' && editingDevice) {
      const newDevicesData = [...devicesData];
      newDevicesData[editingIndex] = editingDevice;
      setDevicesData(newDevicesData);
    }
    
    setIsEditModalVisible(false);
    toast.success('تمت العملية بنجاح');
  };

  const handleCancelEdit = () => {
    setIsEditModalVisible(false);
    setEditingClient(null);
    setEditingDevice(null);
    setEditingIndex(-1);
  };

  const handleEditClientField = (field: string, value: string) => {
    if (editingClient) {
      setEditingClient({
        ...editingClient,
        [field]: value
      });
    }
  };

  const handleEditDeviceField = (field: string, value: string) => {
    if (editingDevice) {
      setEditingDevice({
        ...editingDevice,
        [field]: value
      });
    }
  };

  // وظيفة قراءة محتوى الملف
  const readFileContent = (file: any): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === 'string') {
          resolve(e.target.result);
        } else {
          reject(new Error('فشل قراءة الملف'));
        }
      };
      reader.onerror = () => reject(new Error('خطأ في قراءة الملف'));
      reader.readAsText(file);
    });
  };

  // وظيفة تقسيم النص إلى دفعات
  const splitTextIntoBatches = (text: string, batchSize: number): string[] => {
    const lines = text.split('\n');
    const batches: string[] = [];
    
    for (let i = 0; i < lines.length; i += batchSize) {
      batches.push(lines.slice(i, i + batchSize).join('\n'));
    }
    
    return batches;
  };

  // وظيفة معالجة محادثة واتساب
  const processWhatsAppChat = async (text: string, provider: 'gemini' | 'deepseek', apiKey: string): Promise<{ clients: ClientData[], devices: DeviceData[] }> => {
    try {
      const result = await extractDataFromWhatsAppChat(text, provider, apiKey);
      
      // تحسين بيانات الأجهزة بإضافة القيم الافتراضية
      const enhancedDevices = result.devices.map((device: DeviceData) => ({
        ...device,
        'نوع الجهاز': device['نوع الجهاز'] || 'android',
        'نوع الاشتراك': device['نوع الاشتراك'] || 'دائم'
      }));
      
      // استخراج أجهزة إضافية من ملاحظات العملاء
      const additionalDevices: DeviceData[] = [];
      
      for (const client of result.clients) {
        if (client['ملاحظات'] && client['ملاحظات'].includes('رمز التفعيل')) {
          try {
            // محاولة استخراج رموز التفعيل من الملاحظات
            const activationCodes = client['ملاحظات'].match(/رمز التفعيل[: ]+([A-Za-z0-9-]+)/g);
            if (activationCodes) {
              for (const codeText of activationCodes) {
                const code = codeText.replace(/رمز التفعيل[: ]+/, '').trim();
                // التحقق من أن الرمز ليس موجوداً بالفعل
                const exists = enhancedDevices.some((d: DeviceData) => d['رمز التفعيل'] === code);
                if (!exists && code) {
                  additionalDevices.push({
                    'اسم العميل': client['اسم العميل'],
                    'رمز التفعيل': code,
                    'نوع الجهاز': 'android',
                    'السعر': '',
                    'تاريخ بداية الاشتراك': '',
                    'تاريخ نهاية الاشتراك': '',
                    'نوع الاشتراك': 'دائم',
                    'ملاحظات': 'تم استخراجه من ملاحظات العميل'
                  });
                }
              }
            }
          } catch (error) {
            console.error('خطأ في استخراج الأجهزة من الملاحظات:', error);
          }
        }
      }
      
      return {
        clients: result.clients,
        devices: [...enhancedDevices, ...additionalDevices]
      };
    } catch (error: any) {
      console.error('Error in processWhatsAppChat:', error);
      
      // تحسين رسائل الخطأ
      if (error.message.includes('API key not valid') || error.message.includes('invalid')) {
        throw new Error('مفتاح API غير صالح. يرجى التحقق من المفتاح وإعادة المحاولة.');
      } else if (error.message.includes('402') || error.message.includes('quota') || error.message.includes('limit')) {
        throw new Error('الرصيد غير كافٍ أو تم تجاوز الحصة. يرجى التحقق من حساب API الخاص بك.');
      } else if (error.message.includes('not found') || error.message.includes('model')) {
        throw new Error('نموذج الذكاء الاصطناعي غير موجود أو غير متاح. يرجى تحديث إصدار النموذج.');
      }
      
      throw error;
    }
  };

  // تعديل وظيفة معالجة النص لدعم الدفعات
  const handleProcessClick = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    setShowDataPreview(false);
    
    try {
      let text = '';
      
      if (selectedFile) {
        const fileContent = await readFileContent(selectedFile);
        text = fileContent;
      } else if (messageText) {
        text = messageText;
      } else {
        throw new Error('الرجاء تحديد ملف أو إدخال نص المحادثة');
      }
      
      // التحقق من مفتاح API إذا تم اختيار مزود ذكاء اصطناعي
      let apiKey = '';
      if (aiProvider === 'deepseek' || aiProvider === 'gemini') {
        // استخدام المفتاح المدخل أو المفتاح المخزن في ملف البيئة
        apiKey = apiKeyInput || (aiProvider === 'gemini' ? import.meta.env.VITE_GEMINI_API_KEY : import.meta.env.VITE_DEEPSEEK_API_KEY);
        
        if (!apiKey) {
          throw new Error(`الرجاء إدخال مفتاح API لـ ${aiProvider}`);
        }
      }
      
      let allClientsData: ClientData[] = [];
      let allDevicesData: DeviceData[] = [];
      
      // معالجة النص كدفعات إذا تم تفعيل الخيار
      if (useBatchProcessing && text.length > 1000) {
        const batches = splitTextIntoBatches(text, batchSize);
        let batchNumber = 1;
        
        for (const batch of batches) {
          toast.loading(`معالجة الدفعة ${batchNumber} من ${batches.length}`);
          
          const result = await processWhatsAppChat(batch, aiProvider, apiKey);
          
          if (result.clients && Array.isArray(result.clients)) {
            allClientsData = [...allClientsData, ...result.clients];
          }
          
          if (result.devices && Array.isArray(result.devices)) {
            allDevicesData = [...allDevicesData, ...result.devices];
          }
          
          batchNumber++;
        }
      } else {
        // معالجة النص كاملاً
        const result = await processWhatsAppChat(text, aiProvider, apiKey);
        
        if (result.clients && Array.isArray(result.clients)) {
          allClientsData = result.clients;
        }
        
        if (result.devices && Array.isArray(result.devices)) {
          allDevicesData = result.devices;
        }
      }
      
      // إزالة السجلات المكررة
      const uniqueClients = allClientsData.filter((client, index, self) =>
        index === self.findIndex((c) => c['اسم العميل'] === client['اسم العميل'])
      );
      
      const uniqueDevices = allDevicesData.filter((device, index, self) =>
        index === self.findIndex((d) => d['رمز التفعيل'] === device['رمز التفعيل'])
      );
      
      // تحديث البيانات
      setClientsData(uniqueClients);
      setDevicesData(uniqueDevices);
      setShowDataPreview(true);
      
      if (uniqueClients.length === 0 && uniqueDevices.length === 0) {
        toast.error('لم يتم العثور على بيانات للاستخراج');
      } else {
        toast.success(`تم استخراج ${uniqueClients.length} عميل و ${uniqueDevices.length} جهاز بنجاح`);
      }
    } catch (error: any) {
      console.error('Error processing WhatsApp chat:', error);
      setErrorMessage(error.message || 'حدث خطأ أثناء معالجة محادثة واتساب');
    } finally {
      setIsProcessing(false);
    }
  };

  // تصدير البيانات إلى Excel
  const exportToExcel = () => {
    try {
      // إنشاء مصنف عمل جديد
      const workbook = XLSX.utils.book_new();
      
      // إنشاء ورقة عمل للعملاء
      if (clientsData.length > 0) {
        const clientsSheet = XLSX.utils.json_to_sheet(clientsData);
        XLSX.utils.book_append_sheet(workbook, clientsSheet, 'العملاء');
      }
      
      // إنشاء ورقة عمل للأجهزة
      if (devicesData.length > 0) {
        const devicesSheet = XLSX.utils.json_to_sheet(devicesData);
        XLSX.utils.book_append_sheet(workbook, devicesSheet, 'الأجهزة');
      }
      
      // تصدير المصنف إلى ملف
      XLSX.writeFile(workbook, 'بيانات_واتساب.xlsx');
      
      toast.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  // إضافة البيانات إلى النظام بنفس طريقة ExcelImporter
  const addDataToSystemExcelStyle = async () => {
    // إنشاء عنصر div للإشعار
    const createNotification = (message: string, type: 'success' | 'error') => {
      const notificationDiv = document.createElement('div');
      notificationDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      } text-white max-w-md`;
      
      notificationDiv.innerHTML = `
        <div class="flex items-center">
          <div class="mr-3">
            ${type === 'success' 
              ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' 
              : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
            }
          </div>
          <div>${message}</div>
        </div>
      `;
      
      document.body.appendChild(notificationDiv);
      
      setTimeout(() => {
        notificationDiv.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => {
          document.body.removeChild(notificationDiv);
        }, 500);
      }, 3000);
    };

    try {
      // الحصول على معرف المستخدم الحالي
      const agent_id = user?.id || getDefaultAgentId();
      
      console.log('معرف المستخدم الحالي:', agent_id);
      
      // تحويل بيانات العملاء إلى التنسيق المناسب لقاعدة البيانات
      const processedClients = clientsData.map((client) => {
        // استخراج اسم العميل
        const clientName = client["اسم العميل"] || "";
        
        return {
          client_name: clientName || "عميل جديد",
          organization_name: client["اسم المؤسسة"] || clientName || "مؤسسة جديدة",
          activity_type: client["نوع النشاط"] || "أخرى",
          phone: client["الهاتف"] || "00000000000",
          phone2: client["الهاتف 2"] || "",
          address: client["العنوان"] || "",
          notes: client["ملاحظات"] || "",
          agent_id: agent_id, // إضافة معرف المستخدم الحالي
          subscription_type: client["نوع الاشتراك"] || "دائم",
          subscription_start: client["تاريخ بداية الاشتراك"] || new Date().toISOString().split('T')[0],
          subscription_end: client["تاريخ نهاية الاشتراك"] || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
        };
      });
      
      console.log('بيانات العملاء المنسقة:', processedClients);
      
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
            clientsErrors++;
            continue;
          }
          
          // إنشاء كائن بيانات العميل
          const clientData = {
            client_name: client.client_name,
            organization_name: client.organization_name,
            activity_type: client.activity_type,
            phone: client.phone,
            phone2: client.phone2,
            address: client.address,
            notes: client.notes,
            agent_id: agent_id, // إضافة معرف المستخدم الحالي
            subscription_type: client.subscription_type,
            subscription_start: client.subscription_start,
            subscription_end: client.subscription_end
          };
          
          // تحديث العميل الموجود أو إنشاء عميل جديد
          if (existingClients) {
            // تحديث العميل الموجود
            const { error: updateError } = await supabase
              .from('clients')
              .update(clientData)
              .eq('id', existingClients.id);
            
            if (updateError) {
              console.error('خطأ في تحديث العميل:', updateError);
              clientsErrors++;
              continue;
            }
          } else {
            // إنشاء عميل جديد
            const { error: insertError } = await supabase
              .from('clients')
              .insert(clientData);
            
            if (insertError) {
              console.error('خطأ في إدخال العميل:', insertError);
              clientsErrors++;
              continue;
            }
          }
          
          insertedClients++;
        } catch (error) {
          console.error('خطأ في معالجة العميل:', error);
          clientsErrors++;
          continue;
        }
      }
      
      // تحويل بيانات الأجهزة إلى التنسيق المناسب لقاعدة البيانات
      const processedDevices = devicesData.map((device) => {
        // معالجة التواريخ بشكل صحيح
        let startDate = device["تاريخ بداية الاشتراك"] || new Date().toISOString().split('T')[0];
        let endDate = device["تاريخ نهاية الاشتراك"] || "";
        
        // التحقق من صحة تنسيق التاريخ
        const isValidDate = (dateStr: string) => {
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
        };
        
        if (!isValidDate(startDate)) {
          startDate = new Date().toISOString().split('T')[0];
        }
        
        if (endDate && !isValidDate(endDate)) {
          // إذا كان نوع الاشتراك دائم، نضع تاريخ بعيد بدلاً من تركه فارغًا
          if (device["نوع الاشتراك"] === "دائم") {
            endDate = "2099-12-31";
          } else {
            const oneYearLater = new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1));
            endDate = oneYearLater.toISOString().split('T')[0];
          }
        } else if (!endDate) {
          // إذا كان تاريخ النهاية فارغًا، نضع تاريخًا بعيدًا للاشتراكات الدائمة
          if (device["نوع الاشتراك"] === "دائم") {
            endDate = "2099-12-31";
          } else {
            const oneYearLater = new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1));
            endDate = oneYearLater.toISOString().split('T')[0];
          }
        }
        
        return {
          client_name: device["اسم العميل"] || "",
          activation_code: device["رمز التفعيل"] || "",
          device_type: device["نوع الجهاز"] || "android",
          subscription_type: device["نوع الاشتراك"] || "دائم",
          subscription_start: startDate,
          subscription_end: endDate,
          notes: device["ملاحظات"] || ""
        };
      });
      
      console.log('بيانات الأجهزة المنسقة:', processedDevices);
      
      // إدخال الأجهزة
      for (const device of processedDevices) {
        try {
          if (!device.client_name) {
            console.warn('تم تخطي جهاز بدون اسم عميل');
            devicesErrors++;
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
            devicesErrors++;
            continue;
          }
          
          if (!clientData) {
            console.warn(`لم يتم العثور على العميل: ${device.client_name} للجهاز`);
            devicesErrors++;
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
            devicesErrors++;
            continue;
          }
          
          if (existingDevices && existingDevices.length > 0) {
            // تحديث الجهاز الموجود
            const { error: updateDeviceError } = await supabase
              .from('devices')
              .update({
                device_type: device.device_type,
                subscription_type: device.subscription_type,
                subscription_start: device.subscription_start,
                subscription_end: device.subscription_end,
                notes: device.notes
              })
              .eq('id', existingDevices[0].id);
            
            if (updateDeviceError) {
              console.error('خطأ في تحديث الجهاز:', updateDeviceError);
              devicesErrors++;
              continue;
            }
          } else {
            // إدخال جهاز جديد
            const deviceData: any = {
              client_id: clientId,
              activation_code: device.activation_code,
              device_type: device.device_type,
              subscription_type: device.subscription_type,
              subscription_start: device.subscription_start,
              notes: device.notes,
              approval_status: "approved"
            };
            
            // إضافة تاريخ نهاية الاشتراك فقط إذا كان موجودًا
            if (device.subscription_end) {
              deviceData.subscription_end = device.subscription_end;
            }
            
            const { error: insertDeviceError } = await supabase
              .from('devices')
              .insert(deviceData);
            
            if (insertDeviceError) {
              console.error('خطأ في إدخال الجهاز:', insertDeviceError);
              devicesErrors++;
              continue;
            }
          }
          
          insertedDevices++;
        } catch (error) {
          console.error('خطأ في معالجة الجهاز:', error);
          devicesErrors++;
          continue;
        }
      }
      
      // عرض رسالة نجاح أو فشل
      if (insertedClients > 0 || insertedDevices > 0) {
        createNotification(`تم إضافة ${insertedClients} عميل و ${insertedDevices} جهاز بنجاح`, 'success');
        
        if (clientsErrors > 0 || devicesErrors > 0) {
          setTimeout(() => {
            createNotification(`تم تخطي ${clientsErrors} عميل و ${devicesErrors} جهاز بسبب أخطاء`, 'error');
          }, 3500);
        }
      } else {
        if (clientsErrors > 0 || devicesErrors > 0) {
          createNotification(`فشل إضافة ${clientsErrors} عميل و ${devicesErrors} جهاز`, 'error');
        } else {
          createNotification('لم يتم إضافة أي بيانات', 'error');
        }
      }
      
      // استدعاء دالة onImportSuccess إذا كانت موجودة
      if (onImportSuccess) {
        onImportSuccess();
      }
      
      toast.success('تمت إضافة البيانات بنجاح');
    } catch (error: any) {
      console.error('خطأ في إضافة البيانات إلى النظام:', error);
      toast.error(`حدث خطأ أثناء إضافة البيانات: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  // إعداد أعمدة جدول العملاء
  const clientColumns = [
    {
      title: 'اسم العميل',
      dataIndex: 'اسم العميل',
      key: 'اسم العميل',
      render: (text: string) => <span className="font-bold">{text}</span>
    },
    {
      title: 'اسم المؤسسة',
      dataIndex: 'اسم المؤسسة',
      key: 'اسم المؤسسة'
    },
    {
      title: 'نوع النشاط',
      dataIndex: 'نوع النشاط',
      key: 'نوع النشاط'
    },
    {
      title: 'الهاتف',
      dataIndex: 'الهاتف',
      key: 'الهاتف'
    },
    {
      title: 'الهاتف 2',
      dataIndex: 'الهاتف 2',
      key: 'الهاتف 2'
    },
    {
      title: 'العنوان',
      dataIndex: 'العنوان',
      key: 'العنوان'
    },
    {
      title: 'ملاحظات',
      dataIndex: 'ملاحظات',
      key: 'ملاحظات'
    },
    {
      title: 'إجراءات',
      key: 'actions',
      render: (_: any, __: any, index: number) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEditClient(index)}>تعديل</Button>
      )
    }
  ];

  // إعداد أعمدة جدول الأجهزة
  const deviceColumns = [
    {
      title: 'رمز التفعيل',
      dataIndex: 'رمز التفعيل',
      key: 'رمز التفعيل',
      render: (text: string) => <span className="font-bold">{text}</span>
    },
    {
      title: 'اسم العميل',
      dataIndex: 'اسم العميل',
      key: 'اسم العميل'
    },
    {
      title: 'نوع الجهاز',
      dataIndex: 'نوع الجهاز',
      key: 'نوع الجهاز'
    },
    {
      title: 'السعر',
      dataIndex: 'السعر',
      key: 'السعر'
    },
    {
      title: 'تاريخ بداية الاشتراك',
      dataIndex: 'تاريخ بداية الاشتراك',
      key: 'تاريخ بداية الاشتراك'
    },
    {
      title: 'تاريخ نهاية الاشتراك',
      dataIndex: 'تاريخ نهاية الاشتراك',
      key: 'تاريخ نهاية الاشتراك'
    },
    {
      title: 'نوع الاشتراك',
      dataIndex: 'نوع الاشتراك',
      key: 'نوع الاشتراك'
    },
    {
      title: 'ملاحظات',
      dataIndex: 'ملاحظات',
      key: 'ملاحظات'
    },
    {
      title: 'إجراءات',
      key: 'actions',
      render: (_: any, __: any, index: number) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEditDevice(index)}>تعديل</Button>
      )
    }
  ];

  // إضافة وظيفة لإنشاء معرف مستخدم افتراضي إذا لم يكن المستخدم مسجل دخوله
  const getDefaultAgentId = () => {
    // استخدام معرف ثابت للمستخدم الافتراضي (يمكن تغييره حسب الحاجة)
    return "00000000-0000-0000-0000-000000000000";
  };

  return (
    <div className="p-4 max-w-full mx-auto rtl">
      <Card
        title={<h2 className="text-xl font-bold">استيراد بيانات من محادثات واتساب</h2>}
      >
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">طريقة المعالجة</h3>
          <Radio.Group
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            className="flex flex-wrap gap-4"
          >
            <Radio.Button value="gemini" className="flex-1 text-center">
              Gemini
            </Radio.Button>
            <Radio.Button value="deepseek" className="flex-1 text-center">
              DeepSeek
            </Radio.Button>
          </Radio.Group>

          {(aiProvider === 'deepseek' || aiProvider === 'gemini') && (
            <Input
              placeholder={`مفتاح API لـ ${aiProvider} (اختياري)`}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="mb-4 mt-4"
            />
          )}

          {/* إعدادات متقدمة */}
          <div className="mb-4">
            <Button 
              type="dashed" 
              icon={<SettingOutlined />} 
              onClick={() => setAdvancedSettingsVisible(!advancedSettingsVisible)}
              className="mb-2"
            >
              إعدادات متقدمة
            </Button>
            
            {advancedSettingsVisible && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span>معالجة الدفعات</span>
                    <Switch 
                      checked={useBatchProcessing} 
                      onChange={setUseBatchProcessing} 
                      size="small"
                    />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    تقسيم الملفات الكبيرة إلى دفعات صغيرة للمعالجة (مفيد للملفات الكبيرة)
                  </div>
                </div>
                
                {useBatchProcessing && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span>حجم الدفعة: {batchSize}</span>
                      <Tooltip title="عدد السطور في كل دفعة">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </div>
                    <Slider 
                      min={5} 
                      max={50} 
                      value={batchSize} 
                      onChange={setBatchSize} 
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* زر التبديل بين اللغات */}
          <div className="mb-4 flex justify-end">
            <Button
              icon={<GlobalOutlined />}
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center"
            >
              {language === 'ar' ? 'English' : 'العربية'}
            </Button>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">تحميل ملف محادثة</h3>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Upload
                  beforeUpload={(file) => {
                    setSelectedFile(file);
                    return false;
                  }}
                  fileList={selectedFile ? [selectedFile] : []}
                  onRemove={() => setSelectedFile(null)}
                  accept=".txt,.json"
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />} disabled={isProcessing}>
                    اختر ملف محادثة واتساب
                  </Button>
                </Upload>
                <div className="text-xs text-gray-500 mt-1">
                  يدعم ملفات النصوص (.txt) وملفات JSON (.json)
                </div>
              </div>

              <div className="flex-1">
                <Button
                  type="primary"
                  onClick={handleProcessClick}
                  loading={isProcessing}
                  disabled={!selectedFile && !messageText}
                  className="w-full"
                >
                  معالجة
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">أو أدخل نص المحادثة مباشرة</h3>
            <Input.TextArea
              rows={6}
              placeholder="انسخ والصق محادثة واتساب هنا..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={isProcessing}
              className="mb-2"
            />
          </div>

          {isProcessing && (
            <div className="mb-4">
              <Progress
                percent={100}
                status="active"
                format={() => 'معالجة البيانات'}
              />
            </div>
          )}

          {showDataPreview && (
            <Card
              title={
                <div className="flex justify-between items-center">
                  <span>البيانات المستخرجة</span>
                  <div className="flex gap-2">
                    <Button
                      icon={<FileExcelOutlined />}
                      onClick={exportToExcel}
                      disabled={clientsData.length === 0 && devicesData.length === 0}
                    >
                      تصدير Excel
                    </Button>
                    <button
                      className="ant-btn ant-btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      onClick={addDataToSystemExcelStyle}
                      disabled={clientsData.length === 0 && devicesData.length === 0}
                    >
                      <svg viewBox="64 64 896 896" focusable="false" data-icon="plus" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                        <defs>
                          <style></style>
                        </defs>
                        <path d="M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z"></path>
                        <path d="M176 474h672q8 0 8 8v60q0 8-8 8H176q-8 0-8-8v-60q0-8 8-8z"></path>
                      </svg>
                      <span>إضافة إلى النظام</span>
                    </button>
                  </div>
                </div>
              }
              className="shadow-lg rounded-2xl mb-4"
            >
              <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as 'clients' | 'devices')}
                items={[
                  {
                    key: 'clients',
                    label: `العملاء (${clientsData.length})`,
                    children: (
                      <Table
                        dataSource={clientsData.map((item, index) => ({ ...item, key: index }))}
                        columns={clientColumns}
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 5 }}
                        bordered
                        size="middle"
                      />
                    )
                  },
                  {
                    key: 'devices',
                    label: `الأجهزة (${devicesData.length})`,
                    children: (
                      <Table
                        dataSource={devicesData.map((item, index) => ({ ...item, key: index }))}
                        columns={deviceColumns}
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 5 }}
                        bordered
                        size="middle"
                      />
                    )
                  }
                ]}
              />
            </Card>
          )}

          {errorMessage && (
            <Card className="bg-red-50 shadow-lg rounded-2xl mb-4">
              <div className="text-red-600 p-4">
                <h3 className="text-lg font-bold mb-2">خطأ</h3>
                <p>{errorMessage}</p>
              </div>
            </Card>
          )}
          
          {/* نافذة تعديل البيانات */}
          <Modal
            title={editingType === 'client' ? 'تعديل بيانات العميل' : 'تعديل بيانات الجهاز'}
            open={isEditModalVisible}
            onOk={handleSaveEdit}
            onCancel={handleCancelEdit}
            okText="حفظ"
            cancelText="إلغاء"
          >
            {editingType === 'client' && editingClient && (
              <div className="space-y-3">
                <Input
                  placeholder="اسم العميل"
                  value={editingClient['اسم العميل']}
                  onChange={(e) => handleEditClientField('اسم العميل', e.target.value)}
                />
                <Input
                  placeholder="اسم المؤسسة"
                  value={editingClient['اسم المؤسسة']}
                  onChange={(e) => handleEditClientField('اسم المؤسسة', e.target.value)}
                />
                <Input
                  placeholder="نوع النشاط"
                  value={editingClient['نوع النشاط']}
                  onChange={(e) => handleEditClientField('نوع النشاط', e.target.value)}
                />
                <Input
                  placeholder="الهاتف"
                  value={editingClient['الهاتف']}
                  onChange={(e) => handleEditClientField('الهاتف', e.target.value)}
                />
                <Input
                  placeholder="الهاتف 2"
                  value={editingClient['الهاتف 2']}
                  onChange={(e) => handleEditClientField('الهاتف 2', e.target.value)}
                />
                <Input
                  placeholder="العنوان"
                  value={editingClient['العنوان']}
                  onChange={(e) => handleEditClientField('العنوان', e.target.value)}
                />
                <Input.TextArea
                  placeholder="ملاحظات"
                  value={editingClient['ملاحظات']}
                  onChange={(e) => handleEditClientField('ملاحظات', e.target.value)}
                  rows={3}
                />
              </div>
            )}
            
            {editingType === 'device' && editingDevice && (
              <div className="space-y-3">
                <Input
                  placeholder="رمز التفعيل"
                  value={editingDevice['رمز التفعيل']}
                  onChange={(e) => handleEditDeviceField('رمز التفعيل', e.target.value)}
                />
                <Input
                  placeholder="اسم العميل"
                  value={editingDevice['اسم العميل']}
                  onChange={(e) => handleEditDeviceField('اسم العميل', e.target.value)}
                />
                <Input
                  placeholder="نوع الجهاز"
                  value={editingDevice['نوع الجهاز']}
                  onChange={(e) => handleEditDeviceField('نوع الجهاز', e.target.value)}
                />
                <Input
                  placeholder="السعر"
                  value={editingDevice['السعر']}
                  onChange={(e) => handleEditDeviceField('السعر', e.target.value)}
                />
                <Input
                  placeholder="تاريخ بداية الاشتراك"
                  value={editingDevice['تاريخ بداية الاشتراك']}
                  onChange={(e) => handleEditDeviceField('تاريخ بداية الاشتراك', e.target.value)}
                />
                <Input
                  placeholder="تاريخ نهاية الاشتراك"
                  value={editingDevice['تاريخ نهاية الاشتراك']}
                  onChange={(e) => handleEditDeviceField('تاريخ نهاية الاشتراك', e.target.value)}
                />
                <Input
                  placeholder="نوع الاشتراك"
                  value={editingDevice['نوع الاشتراك']}
                  onChange={(e) => handleEditDeviceField('نوع الاشتراك', e.target.value)}
                />
                <Input.TextArea
                  placeholder="ملاحظات"
                  value={editingDevice['ملاحظات']}
                  onChange={(e) => handleEditDeviceField('ملاحظات', e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </Modal>
        </div>
      </Card>
    </div>
  );
};

export { WhatsAppImporter };
