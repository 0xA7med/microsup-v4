import React, { useState } from 'react';
import { Card, Button, Tabs, Input, Table, Switch, Tooltip, Radio, Modal, Upload, Progress, Slider } from 'antd';
import { UploadOutlined, FileExcelOutlined, SettingOutlined, InfoCircleOutlined, EditOutlined, GlobalOutlined } from '@ant-design/icons';
import { extractDataFromWhatsAppChat } from '../services/aiService';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { addClientsAndDevicesToDb } from '../services/whatsappImportService';

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
  const {  } = useAuthStore();

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

  // حالة التقدم
  const [importProgress, setImportProgress] = useState(0);
  const [importLoading, setImportLoading] = useState(false);

  // حالة الإحصائيات وسجل الدفعات
  const [stats, setStats] = useState<{ clients: number; devices: number }>({ clients: 0, devices: 0 });
  const [showStats, setShowStats] = useState(false);
  const [completedBatches, setCompletedBatches] = useState<{ clients: ClientData[]; devices: DeviceData[] }[]>([]);

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
    setShowDataPreview(true); // إظهار الجدول مباشرة
    setCompletedBatches([]);
    setClientsData([]);
    setDevicesData([]);
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
          const toastId = toast.loading(`معالجة الدفعة ${batchNumber} من ${batches.length}`);
          const result = await processWhatsAppChat(batch, aiProvider, apiKey);
          
          if (result.clients && Array.isArray(result.clients)) {
            allClientsData = [...allClientsData, ...result.clients];
            setClientsData(prev => [...prev, ...result.clients]);
          }
          
          if (result.devices && Array.isArray(result.devices)) {
            allDevicesData = [...allDevicesData, ...result.devices];
            setDevicesData(prev => [...prev, ...result.devices]);
          }
          
          setCompletedBatches(prev => [...prev, {
            clients: result.clients || [],
            devices: result.devices || []
          }]);
          toast.success(`تم معالجة الدفعة ${batchNumber} من ${batches.length}`, { id: toastId });
          batchNumber++;
        }
      } else {
        // معالجة النص كاملاً
        const result = await processWhatsAppChat(text, aiProvider, apiKey);
        
        if (result.clients && Array.isArray(result.clients)) {
          allClientsData = result.clients;
          setClientsData(result.clients);
        }
        
        if (result.devices && Array.isArray(result.devices)) {
          allDevicesData = result.devices;
          setDevicesData(result.devices);
        }
        
        setCompletedBatches([{
          clients: result.clients || [],
          devices: result.devices || []
        }]);
      }
      
      setShowStats(false);
      setStats({ clients: allClientsData.length, devices: allDevicesData.length });
      if (allClientsData.length === 0 && allDevicesData.length === 0) {
        toast.error('لم يتم العثور على بيانات للاستخراج');
      } else {
        toast.success(`تم استخراج ${allClientsData.length} عميل و ${allDevicesData.length} جهاز بنجاح`);
      }
    } catch (error: any) {
      console.error('Error processing WhatsApp chat:', error);
      setErrorMessage(error.message || 'حدث خطأ أثناء معالجة محادثة واتساب');
    } finally {
      setIsProcessing(false);
    }
  };

  // زر إضافة إلى النظام - إضافة حقيقية إلى قاعدة البيانات
  const handleAddToSystem = async () => {
    setImportLoading(true);
    setImportProgress(10);
    try {
      // إضافة فعلية إلى قاعدة البيانات
      const result = await addClientsAndDevicesToDb(clientsData, devicesData);
      setImportProgress(100);
      setShowStats(true);
      toast.success(language === 'ar' ? `تمت إضافة ${result.clients} عميل و${result.devices} جهاز بنجاح!` : `Added ${result.clients} clients and ${result.devices} devices successfully!`);
      if (onImportSuccess) onImportSuccess();
    } catch (error: any) {
      toast.error(language === 'ar' ? `حدث خطأ أثناء الإضافة: ${error.message}` : `Error during import: ${error.message}`);
    } finally {
      setImportLoading(false);
      setTimeout(() => setImportProgress(0), 1000);
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
                    <Button
                      danger
                      onClick={() => {
                        setClientsData([]);
                        setDevicesData([]);
                        setShowStats(false);
                        setCompletedBatches([]);
                      }}
                      disabled={clientsData.length === 0 && devicesData.length === 0}
                    >
                      مسح الجدول
                    </Button>
                    <button
                      className="ant-btn ant-btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      onClick={handleAddToSystem}
                      disabled={clientsData.length === 0 && devicesData.length === 0}
                    >
                      <svg viewBox="64 64 896 896" focusable="false" data-icon="plus" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                        <defs>
                          <style></style>
                        </defs>
                        <path d="M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z"></path>
                        <path d="M176 474h672q8 0 8 8v60q0 8-8 8H176q-8 0-8-8v-60q0-8 8-8z"></path>
                      </svg>
                      <span>{language === 'ar' ? 'إضافة إلى النظام' : 'Add to system'}</span>
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
              {/* عرض الإحصائيات بعد الإضافة */}
              {showStats && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                  <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">تسجيل مندوب جديد</h3>
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
              {/* عرض الدفعات المكتملة */}
              {completedBatches.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">سجل المعالجة</h3>
                  {completedBatches.map((batch, index) => (
                    <div key={index} className="mb-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex justify-between">
                        <span>الدفعة {index + 1}</span>
                        <div className="flex gap-2">
                          <span className="text-blue-600 dark:text-blue-300">
                            {batch.clients.length} عميل
                          </span>
                          <span className="text-purple-600 dark:text-purple-300">
                            {batch.devices.length} جهاز
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          
          {importLoading && (
            <div className="mb-4">
              <Progress
                percent={importProgress}
                status={importProgress === 100 ? 'success' : 'active'}
                showInfo={false}
                strokeColor={{
                  '0%': '#1677ff',
                  '100%': '#52c41a',
                }}
                className="w-full"
              />
            </div>
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
