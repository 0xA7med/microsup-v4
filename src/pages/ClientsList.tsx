import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import ReactDOM from 'react-dom';
import { 
  Search, 
  Smartphone, 
  Laptop, 
  Eye, ChevronRight, ChevronUp, ChevronDown, ChevronLeft,
  Copy, Check, Zap, AlertCircle, Clock, X, Filter 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types';

interface DisplayClientType {
  id: string;
  client_name?: string;
  organization_name?: string;
  activity_type?: string;
  address?: string;
  phone?: string;
  phone2?: string;
  notes?: string;
  subscription_type?: string;
  subscription_start?: string | null;
  subscription_end?: string | null;
  agent_id?: string;
  deviceCount?: number;
  devices?: any[];
  mobileDevices?: any[];
  computerDevices?: any[];
  earliestEndDate?: string | null;
  subscriptionTypes?: string[];
  totalPrice?: number; 
  mobilePrice?: number;
  computerPrice?: number;
  showDevices?: boolean;
  agent?: { 
    id?: string;
    name?: string;
  } | null | any[];  
  agents?: ImportedAgent[];
  created_by?: string;
  created_at?: string;
  activation_code?: string;
  device_type?: string;
}

const SUBSCRIPTION_TYPES = [
  { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
  { value: 'semi_annual', label: 'نصف سنوي', labelEn: 'Biannual' },
  { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
  { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
];

const VERSION_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer' },
  { value: 'android', label: 'موبايل', labelEn: 'Mobile' }
];

export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [copiedCodes, setCopiedCodes] = useState<{[key: string]: boolean}>({});
  
  // وظيفة لنسخ رمز التفعيل
  const copyActivationCode = useCallback((code: string, deviceId: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedCodes(prev => ({
          ...prev,
          [deviceId]: true
        }));
        
        setTimeout(() => {
          setCopiedCodes(prev => {
            const newState = {...prev};
            delete newState[deviceId];
            return newState;
          });
        }, 2000); // إعادة تعيين بعد ثانيتين
        
        toast.success('تم نسخ رمز التفعيل');
      })
      .catch(() => {
        toast.error('فشل نسخ رمز التفعيل');
      });
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore(); // استخدام معلومات المستخدم المسجل دخوله

  // استخدام useRef للتحكم في طلبات الشبكة
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFirstRender = useRef(true);
  const isDataLoaded = useRef(false);
  const isFetchingRef = useRef(false); // مرجع جديد لتتبع حالة الجلب
  const pendingFetchRef = useRef<{filter: string | null, page: number | null} | null>(null); // مرجع لتخزين طلب معلق
  
  const [stableClients, setStableClients] = useState<DisplayClientType[]>([]); // حالة مستقرة للعملاء
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<'mobile' | 'computer' | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [selectedClient, setSelectedClient] = useState<DisplayClientType | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [agents, setAgents] = useState<ImportedAgent[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // إضافة متغير عام لتخزين معرفات الأجهزة المطابقة للبحث
  const [matchingDeviceIds, setMatchingDeviceIds] = useState<string[]>([]);
  const [filteredDevicesByClient, setFilteredDevicesByClient] = useState<Record<string, string[]>>({});
  
  // دالة لتأخير التنفيذ
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // دالة مساعدة لتحديث الحالة بطريقة مستقرة
  const updateClientsStable = useCallback((newClients: DisplayClientType[], newTotalPages: number) => {
    // أولاً، نعيين حالة التحميل إلى false
    setIsLoadingMore(false);
    
    // تحديث الحالة المستقرة فوراً
    setStableClients(newClients);
    
    // استخدام تقنية batching لتحديث الحالة في دفعة واحدة
    // هذا يمنع React من إعادة الرسم عدة مرات
    setTimeout(() => {
      ReactDOM.flushSync(() => {
        setTotalPages(newTotalPages);
      });
    }, 50);
  }, []);
  
  const fetchClients = useCallback(async (filterOverride?: string | null, pageOverride?: number | null) => {
    // إذا كان هناك عملية جلب بيانات جارية، قم بتخزين الطلب الجديد وإنهاء الدالة
    if (isFetchingRef.current) {
      console.log('هناك عملية جلب بيانات جارية، تخزين الطلب الجديد للتنفيذ لاحقاً');
      pendingFetchRef.current = {
        filter: filterOverride !== undefined ? filterOverride : activeFilter,
        page: pageOverride !== undefined ? pageOverride : currentPage
      };
      return;
    }
    
    // تعيين حالة الجلب إلى نشط
    isFetchingRef.current = true;
    
    // إلغاء أي طلب سابق لتجنب تداخل النتائج
    if (abortControllerRef.current) {
      console.log('إلغاء الطلب السابق لمنع الفلكر');
      abortControllerRef.current.abort();
      // انتظار لحظة قصيرة للتأكد من إلغاء الطلب السابق بالكامل
      await delay(100);
    }
    
    // إنشاء controller جديد
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const filter = filterOverride !== undefined ? filterOverride : activeFilter;
    const page = (pageOverride !== undefined ? pageOverride : currentPage) || 1; // استخدم القيمة 1 إذا كانت null
    const from = (page - 1) * 50;
    const to = from + 49;
    
    console.log(`جلب العملاء مع الفلتر: ${filter}, الصفحة: ${page}, من: ${from}, إلى: ${to}`);
    
    setIsLoadingMore(true);
    
    try {
      // التحقق من إلغاء الطلب قبل المتابعة
      if (signal.aborted) {
        console.log('تم إلغاء الطلب، إنهاء الدالة');
        isFetchingRef.current = false;
        
        // التحقق من وجود طلب معلق وتنفيذه
        if (pendingFetchRef.current) {
          const { filter: pendingFilter, page: pendingPage } = pendingFetchRef.current;
          pendingFetchRef.current = null;
          console.log('تنفيذ طلب معلق');
          fetchClients(pendingFilter, pendingPage);
        }
        return;
      }
      
      // 1. إذا كان هناك بحث، نجلب أولاً معرفات العملاء المطابقة من الأجهزة والعملاء
      let matchingClientIds: string[] = [];
      
      if (searchTerm) {
        console.log('البحث عن:', searchTerm);
        
        // 1.1 البحث في جدول الأجهزة
        const devicesResponse = await supabase
          .from('devices')
          .select('*') // تغيير من 'client_id' إلى '*' لجلب جميع بيانات الأجهزة
          .or(`activation_code.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
          .abortSignal(signal);
        
        // التحقق مرة أخرى من إلغاء الطلب
        if (signal.aborted) {
          console.log('تم إلغاء الطلب أثناء البحث في الأجهزة');
          isFetchingRef.current = false;
          return;
        }
        
        if (devicesResponse.error) {
          console.error('خطأ في البحث في الأجهزة:', devicesResponse.error);
        } else if (devicesResponse.data && devicesResponse.data.length > 0) {
          // تخزين الأجهزة المطابقة للبحث
          const matchingDevices = devicesResponse.data;
          const deviceClientIds = [...new Set(matchingDevices.map(d => d.client_id))];
          console.log('تم العثور على أجهزة تطابق البحث:', {
            count: matchingDevices.length,
            clientIds: deviceClientIds
          });
          
          // تخزين معرفات الأجهزة المطابقة للبحث في متغير عام
          setMatchingDeviceIds(matchingDevices.map(d => d.id));
          console.log('معرفات الأجهزة المطابقة للبحث:', matchingDeviceIds);
          
          matchingClientIds.push(...deviceClientIds);
        }
        
        // 1.2 البحث في جدول العملاء
        const clientsResponse = await supabase
          .from('clients')
          .select('id')
          .or(`client_name.ilike.%${searchTerm}%,organization_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,phone2.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
          .abortSignal(signal);
        
        // التحقق مرة أخرى من إلغاء الطلب
        if (signal.aborted) {
          console.log('تم إلغاء الطلب أثناء البحث في العملاء');
          isFetchingRef.current = false;
          return;
        }
        
        if (clientsResponse.error) {
          console.error('خطأ في البحث في العملاء:', clientsResponse.error);
        } else if (clientsResponse.data && clientsResponse.data.length > 0) {
          const clientIds = clientsResponse.data.map(c => c.id);
          console.log('تم العثور على عملاء يطابقون البحث:', {
            count: clientsResponse.data.length,
            clientIds: clientIds
          });
          matchingClientIds.push(...clientIds);
        }
        
        // 1.3 إزالة التكرار
        matchingClientIds = [...new Set(matchingClientIds)];
        console.log('إجمالي العملاء المطابقين للبحث:', matchingClientIds.length);
        
        // 1.4 إذا لم نجد أي نتائج، نعيد قائمة فارغة
        if (matchingClientIds.length === 0) {
          console.log('لم يتم العثور على نتائج تطابق البحث');
          updateClientsStable([], 0);
          return;
        }
      }
      
      // 2. إعداد الاستعلام الأساسي لجلب العملاء مع عدد الأجهزة
      // هنا نستعيد كل بيانات العملاء والأجهزة للمعالجة في الذاكرة
      let baseQuery = supabase.from('clients').select('*, devices(*), agent:agents(id, name)');
      
      // 3. تطبيق فلترة البحث إذا كان هناك نتائج بحث
      if (searchTerm && matchingClientIds.length > 0) {
        baseQuery = baseQuery.in('id', matchingClientIds);
      } else if (searchTerm && matchingClientIds.length === 0) {
        console.log('لا توجد نتائج بحث، إرجاع قائمة فارغة');
        updateClientsStable([], 0);
        return;
      }
      
      // 4. تطبيق الفلترات الأخرى
      if (filter) {
        // متغير لتخزين معرفات الأجهزة المطابقة للفلتر لكل عميل
        let filteredDevicesMap: Record<string, string[]> = {};
        
        if (filter === 'expired') {
          // الاشتراكات المنتهية: تاريخ الانتهاء أقل من اليوم وليست دائمة
          const today = new Date().toISOString();
          // جلب معرفات العملاء الذين لديهم أجهزة منتهية
          const { data: expiredDevicesData } = await supabase
            .from('devices')
            .select('id, client_id')
            .lt('subscription_end', today)
            .not('subscription_type', 'eq', 'permanent')
            .abortSignal(signal);
            
          if (expiredDevicesData && expiredDevicesData.length > 0) {
            // تجميع الأجهزة حسب العميل
            expiredDevicesData.forEach(device => {
              if (!filteredDevicesMap[device.client_id]) {
                filteredDevicesMap[device.client_id] = [];
              }
              filteredDevicesMap[device.client_id].push(device.id);
            });
            
            const expiredClientIds = [...new Set(expiredDevicesData.map(d => d.client_id))];
            baseQuery = baseQuery.in('id', expiredClientIds);
          } else {
            // إذا لم تكن هناك أجهزة منتهية
            updateClientsStable([], 0);
            return;
          }
        } else if (filter === 'expiring') {
          // الاشتراكات التي تنتهي قريباً: تاريخ الانتهاء بين اليوم و15 يوم قادمة وليست دائمة
          const today = new Date();
          const fifteenDaysFromNow = new Date();
          fifteenDaysFromNow.setDate(today.getDate() + 15);
          
          // جلب معرفات العملاء الذين لديهم أجهزة تنتهي قريباً
          const { data: expiringDevicesData } = await supabase
            .from('devices')
            .select('id, client_id')
            .gte('subscription_end', today.toISOString())
            .lte('subscription_end', fifteenDaysFromNow.toISOString())
            .not('subscription_type', 'eq', 'permanent')
            .abortSignal(signal);
            
          if (expiringDevicesData && expiringDevicesData.length > 0) {
            // تجميع الأجهزة حسب العميل
            expiringDevicesData.forEach(device => {
              if (!filteredDevicesMap[device.client_id]) {
                filteredDevicesMap[device.client_id] = [];
              }
              filteredDevicesMap[device.client_id].push(device.id);
            });
            
            const expiringClientIds = [...new Set(expiringDevicesData.map(d => d.client_id))];
            baseQuery = baseQuery.in('id', expiringClientIds);
          } else {
            // إذا لم تكن هناك أجهزة تنتهي قريباً
            updateClientsStable([], 0);
            return;
          }
        } else if (filter === 'active') {
          // الاشتراكات النشطة: تاريخ الانتهاء أكبر من اليوم أو دائمة
          const today = new Date().toISOString();
          
          // جلب معرفات العملاء الذين لديهم أجهزة نشطة
          const { data: activeDevicesData } = await supabase
            .from('devices')
            .select('id, client_id')
            .or(`subscription_end.gt.${today},subscription_type.eq.permanent`)
            .eq('approval_status', 'approved')
            .abortSignal(signal);
            
          if (activeDevicesData && activeDevicesData.length > 0) {
            // تجميع الأجهزة حسب العميل
            activeDevicesData.forEach(device => {
              if (!filteredDevicesMap[device.client_id]) {
                filteredDevicesMap[device.client_id] = [];
              }
              filteredDevicesMap[device.client_id].push(device.id);
            });
            
            const activeClientIds = [...new Set(activeDevicesData.map(d => d.client_id))];
            baseQuery = baseQuery.in('id', activeClientIds);
          } else {
            // إذا لم تكن هناك أجهزة نشطة
            updateClientsStable([], 0);
            return;
          }
        } else if (filter === 'noDevices') {
          // العملاء بدون أجهزة
          // جلب معرفات العملاء الذين ليس لديهم أجهزة
          const { data: clientsWithDevicesData } = await supabase
            .from('devices')
            .select('client_id')
            .abortSignal(signal);
            
          if (clientsWithDevicesData) {
            const clientsWithDevicesIds = [...new Set(clientsWithDevicesData.map(d => d.client_id))];
            // استبعاد العملاء الذين لديهم أجهزة
            if (clientsWithDevicesIds.length > 0) {
              baseQuery = baseQuery.not('id', 'in', `(${clientsWithDevicesIds.join(',')})`);
            }
          }
        } else if (filter === 'permanent') {
          // الاشتراكات الدائمة
          // جلب معرفات العملاء الذين لديهم أجهزة دائمة
          const { data: permanentDevicesData } = await supabase
            .from('devices')
            .select('id, client_id')
            .eq('subscription_type', 'permanent')
            .abortSignal(signal);
            
          if (permanentDevicesData && permanentDevicesData.length > 0) {
            // تجميع الأجهزة حسب العميل
            permanentDevicesData.forEach(device => {
              if (!filteredDevicesMap[device.client_id]) {
                filteredDevicesMap[device.client_id] = [];
              }
              filteredDevicesMap[device.client_id].push(device.id);
            });
            
            const permanentClientIds = [...new Set(permanentDevicesData.map(d => d.client_id))];
            baseQuery = baseQuery.in('id', permanentClientIds);
          } else {
            // إذا لم تكن هناك أجهزة دائمة
            updateClientsStable([], 0);
            return;
          }
        } else if (filter === 'allDevices' || filter === 'devices') {
          // جميع الاشتراكات
          // جلب معرفات العملاء الذين لديهم أجهزة
          const { data: clientsWithDevicesData } = await supabase
            .from('devices')
            .select('id, client_id')
            .abortSignal(signal);
            
          if (clientsWithDevicesData && clientsWithDevicesData.length > 0) {
            // تجميع الأجهزة حسب العميل
            clientsWithDevicesData.forEach(device => {
              if (!filteredDevicesMap[device.client_id]) {
                filteredDevicesMap[device.client_id] = [];
              }
              filteredDevicesMap[device.client_id].push(device.id);
            });
            
            const clientsWithDevicesIds = [...new Set(clientsWithDevicesData.map(d => d.client_id))];
            baseQuery = baseQuery.in('id', clientsWithDevicesIds);
          } else {
            // إذا لم تكن هناك أجهزة
            updateClientsStable([], 0);
            return;
          }
        } else if (filter?.startsWith('agent_')) {
          const agentId = filter.replace('agent_', '');
          baseQuery = baseQuery.eq('agent_id', agentId);
        } else if (filter?.startsWith('status_')) {
          // فلتر حسب حالة الجهاز (للتنقل من صفحة الأجهزة المعلقة)
          const status = filter.replace('status_', '');
          
          // جلب معرفات العملاء الذين لديهم أجهزة بالحالة المطلوبة
          const { data: statusDevicesData } = await supabase
            .from('devices')
            .select('id, client_id')
            .eq('approval_status', status)
            .abortSignal(signal);
            
          if (statusDevicesData && statusDevicesData.length > 0) {
            // تجميع الأجهزة حسب العميل
            statusDevicesData.forEach(device => {
              if (!filteredDevicesMap[device.client_id]) {
                filteredDevicesMap[device.client_id] = [];
              }
              filteredDevicesMap[device.client_id].push(device.id);
            });
            
            const statusClientIds = [...new Set(statusDevicesData.map(d => d.client_id))];
            baseQuery = baseQuery.in('id', statusClientIds);
          } else {
            // إذا لم تكن هناك أجهزة بالحالة المطلوبة
            updateClientsStable([], 0);
            return;
          }
        }
        
        // حفظ معرفات الأجهزة المطابقة للفلتر لكل عميل
        setFilteredDevicesByClient(filteredDevicesMap);
      }
      
      // فلترة حسب نوع الجهاز
      if (deviceFilter === 'mobile' || filter === 'mobile') {
        // جلب العملاء الذين لديهم أجهزة جوال
        const mobileResponse = await supabase
          .from('devices')
          .select('id, client_id')
          .eq('device_type', 'android')
          .abortSignal(signal);
          
        if (signal.aborted) {
          console.log('تم إلغاء الطلب أثناء فلترة الأجهزة الجوال');
          isFetchingRef.current = false;
          return;
        }
        
        if (!mobileResponse.error && mobileResponse.data) {
          // تجميع الأجهزة حسب العميل
          let filteredDevicesMap: Record<string, string[]> = {};
          mobileResponse.data.forEach(device => {
            if (!filteredDevicesMap[device.client_id]) {
              filteredDevicesMap[device.client_id] = [];
            }
            filteredDevicesMap[device.client_id].push(device.id);
          });
          
          // حفظ معرفات الأجهزة المطابقة للفلتر
          setFilteredDevicesByClient(filteredDevicesMap);
          
          const mobileClientIds = mobileResponse.data.map(d => d.client_id);
          if (mobileClientIds.length > 0) {
            baseQuery = baseQuery.in('id', mobileClientIds);
          } else {
            // إذا لم تكن هناك أجهزة جوال مطابقة
            updateClientsStable([], 0);
            return;
          }
        }
      } else if (deviceFilter === 'computer' || filter === 'computer') {
        // جلب العملاء الذين لديهم أجهزة كمبيوتر
        const computerResponse = await supabase
          .from('devices')
          .select('id, client_id')
          .eq('device_type', 'computer')
          .abortSignal(signal);
          
        if (signal.aborted) {
          console.log('تم إلغاء الطلب أثناء فلترة الأجهزة الكمبيوتر');
          isFetchingRef.current = false;
          return;
        }
        
        if (!computerResponse.error && computerResponse.data) {
          // تجميع الأجهزة حسب العميل
          let filteredDevicesMap: Record<string, string[]> = {};
          computerResponse.data.forEach(device => {
            if (!filteredDevicesMap[device.client_id]) {
              filteredDevicesMap[device.client_id] = [];
            }
            filteredDevicesMap[device.client_id].push(device.id);
          });
          
          // حفظ معرفات الأجهزة المطابقة للفلتر
          setFilteredDevicesByClient(filteredDevicesMap);
          
          const computerClientIds = computerResponse.data.map(d => d.client_id);
          if (computerClientIds.length > 0) {
            baseQuery = baseQuery.in('id', computerClientIds);
          } else {
            // إذا لم تكن هناك أجهزة كمبيوتر مطابقة
            updateClientsStable([], 0);
            return;
          }
        }
      }
      
      if (user?.role === 'agent' && user?.id) {
        baseQuery = baseQuery.eq('agent_id', user.id);
      }
      
      // 5. تطبيق الترتيب
      if (sortConfig) {
        const { key, direction } = sortConfig;
        const order = direction === 'ascending' ? true : false;
        
        if (key === 'client_name' || key === 'organization_name' || key === 'phone' || key === 'agent_id') {
          baseQuery = baseQuery.order(key, { ascending: order });
        }
      } else {
        // إذا لم يكن هناك ترتيب محدد، نستخدم الترتيب الافتراضي (الأحدث أولاً)
        baseQuery = baseQuery.order('created_at', { ascending: false });
      }
      
      // إضافة إشارة الإلغاء إلى الاستعلام الرئيسي
      baseQuery = baseQuery.abortSignal(signal);
      
      console.log('تنفيذ استعلام Supabase الرئيسي...');
      // استخدام destructuring لاستخراج البيانات والأخطاء فقط، وتجاهل count غير المستخدم
      const { data, error } = await baseQuery;
      
      if (signal.aborted) {
        console.log('تم إلغاء الطلب بعد تنفيذه، إنهاء الدالة');
        isFetchingRef.current = false;
        return;
      }
      
      // 7. معالجة النتائج
      if (error) {
        console.error('خطأ في جلب العملاء:', error);
        toast.error(t('errors.fetchClients', 'حدث خطأ أثناء جلب بيانات العملاء'));
        updateClientsStable([], 0);
        return;
      }
      
      if (data) {
        // معالجة البيانات وإضافة معلومات الأجهزة المحسوبة
        const processedClients = data.map(client => {
          // حساب عدد الأجهزة
          const devices = client.devices || [];
          const deviceCount = devices.length;
          
          // حساب أنواع الأجهزة
          const mobileDevices = devices.filter((d: any) => d.device_type === 'android');
          const computerDevices = devices.filter((d: any) => d.device_type === 'computer');
          
          // حساب تواريخ انتهاء الاشتراكات
          let earliestEndDate = null;
          const subscriptionTypes: string[] = [];
          
          // حساب إجمالي الأسعار
          let totalPrice = 0;
          let mobilePrice = 0;
          let computerPrice = 0;
          
          if (deviceCount > 0) {
            // حساب أقرب تاريخ انتهاء
            const endDates = devices
              .filter((d: any) => d.subscription_end)
              .map((d: any) => d.subscription_end);
            
            if (endDates.length > 0) {
              earliestEndDate = endDates.sort()[0];
            }
            
            // جمع أنواع الاشتراكات
            devices.forEach((d: any) => {
              if (d.subscription_type && !subscriptionTypes.includes(d.subscription_type)) {
                subscriptionTypes.push(d.subscription_type);
              }
              
              // إضافة السعر إلى الإجمالي فقط للأجهزة المقبولة
              if (d.approval_status === 'approved') {
                const price = d.price || 0;
                totalPrice += price;
                
                // إضافة السعر حسب نوع الجهاز
                if (d.device_type === 'android') {
                  mobilePrice += price;
                } else if (d.device_type === 'computer') {
                  computerPrice += price;
                }
              }
            });
          }
          
          return {
            ...client,
            deviceCount,
            devices,
            mobileDevices,
            computerDevices,
            earliestEndDate,
            subscriptionTypes,
            totalPrice,
            mobilePrice,
            computerPrice,
            showDevices: searchTerm !== '' || filter !== null || deviceFilter !== null, // إظهار الأجهزة عند تطبيق البحث أو الفلترة
            agent: client.agent
          };
        });
        
        // تطبيق الترتيب في الذاكرة إذا لزم الأمر
        const sortedClients = [...processedClients];
        
        if (sortConfig) {
          const { key, direction } = sortConfig;
          
          if (key === 'deviceCount' || key === 'totalPrice' || key === 'earliestEndDate') {
            sortedClients.sort((a, b) => {
              let valueA = a[key];
              let valueB = b[key];
              
              // معالجة خاصة لقيم NULL أو undefined
              if (valueA === undefined || valueA === null) valueA = (direction === 'ascending') ? -Infinity : Infinity;
              if (valueB === undefined || valueB === null) valueB = (direction === 'ascending') ? -Infinity : Infinity;
              
              // المقارنة
              if (valueA < valueB) return direction === 'ascending' ? -1 : 1;
              if (valueA > valueB) return direction === 'ascending' ? 1 : -1;
              return 0;
            });
          }
        }
        
        // تطبيق الصفحات
        const total = sortedClients.length;
        const totalPages = Math.ceil(total / 50);
        const startIndex = (page - 1) * 50;
        const endIndex = Math.min(startIndex + 50, total);
        const paginatedClients = sortedClients.slice(startIndex, endIndex);
        
        console.log(`تم جلب ${paginatedClients.length} عميل من إجمالي ${total}`);
        updateClientsStable(paginatedClients, totalPages);
      } else {
        console.log('لم يتم العثور على عملاء');
        updateClientsStable([], 0);
      }
    } catch (error) {
      console.error('خطأ غير متوقع في جلب العملاء:', error);
      toast.error(t('errors.fetchClients', 'حدث خطأ أثناء جلب بيانات العملاء'));
    } finally {
      // نقوم بالتحقق من وجود طلب معلق وتنفيذه
      if (pendingFetchRef.current) {
        const { filter: pendingFilter, page: pendingPage } = pendingFetchRef.current;
        pendingFetchRef.current = null;
        console.log('تنفيذ طلب معلق بعد انتهاء الطلب الحالي');
        
        // تأخير قصير قبل تنفيذ الطلب المعلق
        setTimeout(() => {
          fetchClients(pendingFilter, pendingPage);
        }, 100);
      } else {
        // إذا لم يكن هناك طلب معلق، نقوم بإعادة ضبط حالة الجلب
        isFetchingRef.current = false;
      }
    }
  }, [activeFilter, deviceFilter, currentPage, searchTerm, sortConfig, t]);
  
  // تحسين عملية تحميل البيانات وتجنب الفلكر
  const loadData = useCallback(async () => {
    try {
      // تعيين حالة التحميل
      if (!isDataLoaded.current) {
        setIsLoadingMore(true);
      }

      // جلب الوكلاء أولاً
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('*');
      
      if (agentsError) throw agentsError;
      
      setAgents(agentsData || []);
      
      // التحقق من وجود معلمات في عنوان URL
      const params = new URLSearchParams(location.search);
      const agentIdParam = params.get('agent_id');
      const filterParam = params.get('filter');
      const statusParam = params.get('status');
      
      // تطبيق الفلتر المناسب بناءً على المعلمات
      if (agentIdParam) {
        // إذا كان هناك معرف وكيل في العنوان، نقوم بتطبيق الفلتر
        setActiveFilter(`agent_${agentIdParam}`);
        await fetchClients(`agent_${agentIdParam}`);
      } else if (filterParam) {
        // تطبيق الفلتر المناسب بناءً على معلمة filter
        console.log(`تطبيق الفلتر من URL: ${filterParam}`);
        
        // معالجة الفلاتر المختلفة
        switch (filterParam) {
          case 'mobile':
          case 'computer':
            // فلتر حسب نوع الجهاز
            setDeviceFilter(filterParam as 'mobile' | 'computer');
            setActiveFilter(null);
            break;
          case 'active':
            // فلتر الاشتراكات النشطة
            setActiveFilter('active');
            setDeviceFilter(null);
            break;
          case 'expired':
            // فلتر الاشتراكات المنتهية
            setActiveFilter('expired');
            setDeviceFilter(null);
            break;
          case 'expiring':
            // فلتر الاشتراكات التي تنتهي قريباً
            setActiveFilter('expiring');
            setDeviceFilter(null);
            break;
          case 'permanent':
            // فلتر الاشتراكات الدائمة
            setActiveFilter('permanent');
            setDeviceFilter(null);
            break;
          case 'devices':
            // فلتر جميع الأجهزة
            setActiveFilter('devices');
            setDeviceFilter(null);
            break;
          case 'all':
          default:
            // عرض جميع العملاء
            setActiveFilter(null);
            setDeviceFilter(null);
            break;
        }
        
        // جلب البيانات مع الفلتر المناسب
        await fetchClients(filterParam);
      } else if (statusParam) {
        // تطبيق فلتر حسب حالة الجهاز (للتنقل من صفحة الأجهزة المعلقة)
        console.log(`تطبيق فلتر الحالة من URL: ${statusParam}`);
        
        // تعيين الفلتر النشط بناءً على حالة الجهاز
        setActiveFilter(`status_${statusParam}`);
        setDeviceFilter(null);
        
        // جلب البيانات مع الفلتر
        await fetchClients(`status_${statusParam}`);
      } else {
        // بدون فلتر، جلب جميع العملاء
        setActiveFilter(null);
        setDeviceFilter(null);
        await fetchClients();
      }
      
      // تعيين علامة تحميل البيانات
      isDataLoaded.current = true;
    } catch (error: any) {
      // التأكد من أن الخطأ ليس بسبب إلغاء الطلب
      if (error.name !== 'AbortError') {
        console.error('Error loading data:', error);
        toast.error(t('errors.loadData', 'حدث خطأ أثناء تحميل البيانات'));
        setIsLoadingMore(false);
      }
    }
  }, [fetchClients, location.search, t]);
  
  // تحميل البيانات عند تحميل المكون
  useEffect(() => {
    // تجنب التحميل المزدوج في الرندر الأول في وضع التطوير
    if (isFirstRender.current) {
      isFirstRender.current = false;
      
      // استخدام setTimeout لتأخير تحميل البيانات
      // هذا يساعد في منع الفلكر عن طريق ضمان استقرار المكون أولاً
      setTimeout(() => {
        loadData();
      }, 100);
    }
    
    // تنظيف عند إلغاء تحميل المكون
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);
  
  useEffect(() => {
    // استخدام debounce لمنع تنفيذ الاستعلامات المتكررة
    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim() !== '') {
        // تعيين حالة التحميل فقط إذا كان هناك مصطلح بحث
        setIsLoadingMore(true);
        
        // إعادة ضبط حالة الجلب قبل التنفيذ
        isFetchingRef.current = false;
        pendingFetchRef.current = null;
        
        // إضافة تأخير قصير لمنع الفلكر
        setTimeout(() => {
          fetchClients(activeFilter, 1);
        }, 300);
      } else if (searchTerm.trim() === '' && isFirstRender.current === false) {
        setIsLoadingMore(true);
        
        // إعادة ضبط حالة الجلب قبل التنفيذ
        isFetchingRef.current = false;
        pendingFetchRef.current = null;
        
        // إعادة تعيين قائمة الأجهزة المطابقة عند إزالة البحث
        setMatchingDeviceIds([]);
        
        // إضافة تأخير قصير لمنع الفلكر
        setTimeout(() => {
          fetchClients(activeFilter, 1);
        }, 300);
      }
    }, 500); // انتظار 500 مللي ثانية بعد التوقف عن الكتابة
    
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, activeFilter, fetchClients]);
  
  // إضافة useEffect لمعالجة مشكلة الفلكر عند تغيير الصفحات
  useEffect(() => {
    // تجنب تحميل البيانات في الرندر الأول
    if (isFirstRender.current) return;
    
    // استخدام requestAnimationFrame لتأخير تحديث واجهة المستخدم
    // هذا يساعد في منع الفلكر عن طريق ضمان تزامن التحديثات مع دورة الرسم
    const frameId = requestAnimationFrame(() => {
      setIsLoadingMore(true);
      
      // إعادة ضبط حالة الجلب قبل التنفيذ
      isFetchingRef.current = false;
      pendingFetchRef.current = null;
      
      // إضافة تأخير قصير لمنع الفلكر
      setTimeout(() => {
        fetchClients(activeFilter, currentPage);
      }, 300);
    });
    
    return () => cancelAnimationFrame(frameId);
  }, [currentPage, activeFilter, fetchClients]);
  
  // مكون هيكل التحميل للجدول
  const SkeletonRow = useCallback(() => (
    <tr className="animate-pulse">
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div></td>
    </tr>
  ), []);
  
  // دالة لتغيير ترتيب الجدول
  const requestSort = useCallback((key: string) => {
    setSortConfig(prevConfig => {
      if (!prevConfig || prevConfig.key !== key) {
        // إذا كان الترتيب على عمود مختلف، نبدأ بالترتيب التصاعدي
        return { key, direction: 'ascending' };
      } else {
        // إذا كان الترتيب على نفس العمود، نعكس الاتجاه
        const newDirection = prevConfig.direction === 'ascending' ? 'descending' : 'ascending';
        return { key, direction: newDirection };
      }
    });
    
    // إعادة تحميل البيانات مع الترتيب الجديد
    setCurrentPage(1);
    setIsLoadingMore(true);
    fetchClients(activeFilter, 1);
  }, [activeFilter, fetchClients]);

  // دالة لتبديل حالة إظهار الاشتراكات لعميل معين
  const toggleShowDevices = useCallback((clientId: string) => {
    // تحديث حالة stableClients
    setStableClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId 
          ? { ...client, showDevices: !client.showDevices } 
          : client
      )
    );
  }, []);

  const handleShowDetails = useCallback((client: DisplayClientType) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  }, []);
  
  const handleCloseModal = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedClient(null);
  }, []);
  
  const handleDeleteClient = useCallback(async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) throw error;
      
      toast.success(t('clientsList.deleteSuccess', 'تم حذف العميل بنجاح'));
      handleCloseModal();
      fetchClients(); // إعادة تحميل البيانات
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(t('clientsList.deleteError', 'حدث خطأ أثناء حذف العميل'));
    }
  }, [fetchClients, handleCloseModal, t]);
  
  const handleUpdateClient = useCallback(async (updatedClient: ImportedClientType | DisplayClientType) => {
    try {
      // تحديث بيانات العميل في قاعدة البيانات
      const { error } = await supabase
        .from('clients')
        .update({
          client_name: updatedClient.client_name,
          organization_name: updatedClient.organization_name,
          activity_type: updatedClient.activity_type,
          address: updatedClient.address,
          phone: updatedClient.phone,
          phone2: updatedClient.phone2,
          notes: updatedClient.notes,
          agent_id: updatedClient.agent_id
        })
        .eq('id', updatedClient.id);
      
      if (error) throw error;
      
      toast.success(t('clientsList.updateSuccess', 'تم تحديث بيانات العميل بنجاح'));
      handleCloseModal();
      fetchClients(); // إعادة تحميل البيانات
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(t('clientsList.updateError', 'حدث خطأ أثناء تحديث بيانات العميل'));
    }
  }, [fetchClients, handleCloseModal, t]);
  
  const getSubscriptionTypeLabel = useCallback((value: string) => {
    return SUBSCRIPTION_TYPES.find(type => type.value === value)?.label || value;
  }, []);
  
  const formatDateForDisplay = useCallback((dateStr?: string | Date): string => {
    if (!dateStr) return '-';
    
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      
      // التحقق من صحة التاريخ
      if (isNaN(date.getTime())) {
        return '-';
      }
      
      // تنسيق التاريخ
      return format(date, 'yyyy/MM/dd');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '-';
    }
  }, []);
  
  // واجهة الفلاتر القابلة للطي
  const renderFilters = useCallback(() => (
    <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl shadow-sm">
      <div 
        className="flex justify-between items-center cursor-pointer mb-2"
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          <Filter className="inline mr-2 h-4 w-4" />
          {t('clientsList.filters', 'فلترة العملاء')}
        </h2>
        {filtersOpen ? <ChevronUp /> : <ChevronDown />}
      </div>

      {filtersOpen && (
        <div className="space-y-4">
          {/* فلترة نوع الجهاز */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clientsList.deviceType', 'نوع الجهاز')}:
            </h3>
            <div className="flex flex-wrap gap-2">
            <Button
                onClick={() => {
                  setActiveFilter('allDevices');
                  setDeviceFilter(null);
                  setCurrentPage(1);
                  setIsLoadingMore(true);
                  fetchClients('allDevices', 1);
                }}
                variant={activeFilter === 'allDevices' ? 'primary' : 'secondary'}
                size="sm"
                className="flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                <span>{t('clientsList.allDevicesFilter', 'جميع الاشتراكات')}</span>
                {activeFilter === 'allDevices' && (
                  <span className="mr-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                    ✓
                  </span>
                )}
              </Button>
              <Button
                onClick={() => {
                  setDeviceFilter(deviceFilter === 'mobile' ? null : 'mobile');
                  setActiveFilter(null);
                  setCurrentPage(1);
                  setIsLoadingMore(true);
                  fetchClients(null, 1);
                }}
                variant={deviceFilter === 'mobile' ? 'primary' : 'secondary'}
                size="sm"
                className="flex items-center gap-1"
              >
                <Smartphone className="w-3 h-3" />
                <span>{t('clientsList.mobileFilter', 'اشتراكات الهاتف')}</span>
                {deviceFilter === 'mobile' && (
                  <span className="mr-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                    ✓
                  </span>
                )}
              </Button>
              
              <Button
                onClick={() => {
                  setDeviceFilter(deviceFilter === 'computer' ? null : 'computer');
                  setActiveFilter(null);
                  setCurrentPage(1);
                  setIsLoadingMore(true);
                  fetchClients(null, 1);
                }}
                variant={deviceFilter === 'computer' ? 'primary' : 'secondary'}
                size="sm"
                className="flex items-center gap-1"
              >
                <Laptop className="w-3 h-3" />
                <span>{t('clientsList.computerFilter', 'اشتراكات الكمبيوتر')}</span>
                {deviceFilter === 'computer' && (
                  <span className="mr-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                    ✓
                  </span>
                )}
              </Button>
              
             
            </div>
          </div>

          {/* فلترة حالة الاشتراك */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clientsList.subscriptionStatus', 'حالة الاشتراك')}:
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'active', icon: Zap, label: t('clientsList.activeFilter', 'نشط') },
                { value: 'expired', icon: AlertCircle, label: t('clientsList.expiredFilter', 'منتهي') },
                { value: 'expiring', icon: Clock, label: t('clientsList.expiringFilter', 'قريب الانتهاء') },
                { value: 'noDevices', icon: X, label: t('clientsList.noDevicesFilter', 'بدون أجهزة') }
              ].map((filter) => {
                const FilterIcon = filter.icon;
                return (
                  <div key={`filter-${filter.value}`}>
                    <Button
                      onClick={() => {
                        setActiveFilter(activeFilter === filter.value ? null : filter.value);
                        setDeviceFilter(null);
                        setCurrentPage(1);
                        setIsLoadingMore(true);
                        fetchClients(filter.value, 1);
                      }}
                      variant={activeFilter === filter.value ? 'primary' : 'secondary'}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <FilterIcon className="w-3 h-3" />
                      <span>{filter.label}</span>
                      {activeFilter === filter.value && (
                        <span className="mr-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                          ✓
                        </span>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* فلترة الوكلاء */}
          {agents.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('clientsList.agents', 'المندوبين')}:
              </h3>
              <div className="mb-2">
                <select
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                  value={activeFilter?.startsWith('agent_') ? activeFilter : ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const selectedValue = e.target.value;
                    
                    // تحديث الحالة المستقرة فوراً قبل تغيير الفلتر
                    setStableClients([]);
                    
                    // تأخير قصير قبل تنفيذ الاستعلام
                    setTimeout(() => {
                      // إعادة ضبط حالة الجلب قبل التنفيذ
                      isFetchingRef.current = false;
                      pendingFetchRef.current = null;
                      
                      if (selectedValue) {
                        setActiveFilter(selectedValue);
                        setDeviceFilter(null);
                        setCurrentPage(1);
                        setIsLoadingMore(true);
                        fetchClients(selectedValue, 1);
                      } else {
                        setActiveFilter(null);
                        setDeviceFilter(null);
                        setCurrentPage(1);
                        setIsLoadingMore(true);
                        fetchClients(null, 1);
                      }
                    }, 50);
                  }}
                >
                  <option value="">{t('clientsList.selectAgent', 'اختر المندوب...')}</option>
                  {agents.map(agent => (
                    <option key={`agent-${agent.id}`} value={`agent_${agent.id}`}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* إلغاء الفلاتر */}
          {(activeFilter || deviceFilter) && (
            <Button
              onClick={() => {
                setActiveFilter(null);
                setDeviceFilter(null);
                setCurrentPage(1);
                setIsLoadingMore(true);
                fetchClients(null, 1);
              }}
              variant="secondary"
              size="sm"
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <X className="w-4 h-4 ml-1" />
              {t('clientsList.clearFilters', 'إلغاء جميع الفلاتر')}
            </Button>
          )}
        </div>
      )}
    </div>
  ), [activeFilter, deviceFilter, agents, filtersOpen, t, fetchClients]);

  // واجهة البحث
  const renderSearch = useCallback(() => (
    <div className="relative mb-6">
      <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
      <input
        type="text"
        placeholder={t('clientsList.searchPlaceholder', 'ابحث بالاسم، الهاتف، الملاحظات، البريد الإلكتروني، رمز التفعيل...')}
        className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
        value={searchTerm}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
      />
      {searchTerm && (
        <button
          onClick={() => {
            setSearchTerm('');
            setIsLoadingMore(true);
            fetchClients(activeFilter, 1);
          }}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  ), [searchTerm, t, activeFilter, fetchClients]);

  // عرض الفلتر النشط
  const renderActiveFilter = useCallback(() => {
    if (!activeFilter && !deviceFilter) return null;

    const getFilterLabel = () => {
      if (deviceFilter === 'mobile') return t('clientsList.mobileFilter', 'اشتراكات الهاتف');
      if (deviceFilter === 'computer') return t('clientsList.computerFilter', 'اشتراكات الكمبيوتر');
      if (activeFilter === 'active') return t('clientsList.activeFilter', 'الاشتراكات النشطة');
      if (activeFilter === 'expired') return t('clientsList.expiredFilter', 'الاشتراكات المنتهية');
      if (activeFilter === 'expiring') return t('clientsList.expiringFilter', 'اشتراكات قريبة الانتهاء');
      if (activeFilter === 'noDevices') return t('clientsList.noDevicesFilter', 'عملاء بدون أجهزة');
      if (activeFilter === 'allDevices') return t('clientsList.allDevicesFilter', 'جميع الاشتراكات');
      if (activeFilter?.startsWith('agent_')) {
        const agentId = activeFilter.replace('agent_', '');
        const agent = agents.find(a => a.id === agentId);
        return `${t('clientsList.agentFilter', 'مندوب')}: ${agent?.name || ''}`;
      }
      return '';
    };

    return (
      <div className="mb-4 flex items-center">
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
          {t('clientsList.activeFilter', 'الفلتر النشط')}:
        </span>
        <span className="px-3 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 rounded-full text-sm font-medium">
          {getFilterLabel()}
        </span>
        <button
          onClick={() => {
            setActiveFilter(null);
            setDeviceFilter(null);
            setCurrentPage(1);
            setIsLoadingMore(true);
            fetchClients(null, 1);
          }}
          className="mr-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          {t('clientsList.clearFilter', 'إلغاء الفلتر')} ×
        </button>
      </div>
    );
  }, [activeFilter, deviceFilter, agents, t, fetchClients]);

  // تحميل البيانات عند تحميل المكون
  useEffect(() => {
    // تجنب التحميل المزدوج في الرندر الأول في وضع التطوير
    if (isFirstRender.current) {
      isFirstRender.current = false;
      
      // استخدام setTimeout لتأخير تحميل البيانات
      // هذا يساعد في منع الفلكر عن طريق ضمان استقرار المكون أولاً
      setTimeout(() => {
        loadData();
      }, 100);
    }
    
    // تنظيف عند إلغاء تحميل المكون
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);
  
  // إضافة useEffect لمتابعة التغييرات في جدول العملاء
  useEffect(() => {
    const clientsChannel = supabase
      .channel('clients-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clients'
      }, () => {
        console.log('Clients table changed, refreshing data...');
        fetchClients(activeFilter, currentPage);
      })
      .subscribe();
      
    // تنظيف عند إلغاء تحميل المكون
    return () => {
      supabase.removeChannel(clientsChannel);
    };
  }, [activeFilter, currentPage, fetchClients]);
  
  // إضافة useEffect لمتابعة التغييرات في جدول الأجهزة
  useEffect(() => {
    const devicesChannel = supabase
      .channel('devices-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'devices'
      }, () => {
        console.log('Devices table changed, refreshing data...');
        fetchClients(activeFilter, currentPage);
      })
      .subscribe();
      
    // تنظيف عند إلغاء تحميل المكون
    return () => {
      supabase.removeChannel(devicesChannel);
    };
  }, [activeFilter, currentPage, fetchClients]);
  
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('clientsList.title', 'قائمة العملاء')}</h1>
        <div className="flex items-center">
          <button 
            className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            onClick={() => navigate('/dashboard')}
          >
            <span>{t('common.backToDashboard', 'العودة للوحة التحكم')}</span>
            <ChevronRight className="h-5 w-5 mr-1" />
          </button>
        </div>
      </div>

      {renderFilters()}
      {renderActiveFilter()}
      {renderSearch()}

      {isLoadingMore ? (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr className="bg-white dark:bg-gray-800">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right w-[20%] md:w-[25%]">
                  اسم العميل
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">
                  المؤسسة
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">
                  الهاتف
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">
                  المندوب
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">
                  عدد الأجهزة
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">
                  تاريخ الانتهاء
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonRow key={`skeleton-${index}`} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr className="bg-white dark:bg-gray-800">
              <th
  scope="col"
  className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[20%] md:w-[25%]"
  onClick={() => requestSort('client_name')}
>
  اسم العميل
  {sortConfig?.key === 'client_name' && (
    <span className="inline-block mr-1">
      {sortConfig.direction === 'ascending' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </span>
  )}
</th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[20%]"
                  onClick={() => requestSort('phone')}
                  dir="ltr"
                >
                  رقم الهاتف
                  {sortConfig?.key === 'phone' && (
                    <span className="inline-block mr-1">
                      {sortConfig.direction === 'ascending' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  )}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]"
                  onClick={() => requestSort('agent_id')}
                >
                  المندوب
                  {sortConfig?.key === 'agent_id' && (
                    <span className="inline-block mr-1">
                      {sortConfig.direction === 'ascending' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  )}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[10%]"
                  onClick={() => requestSort('deviceCount')}
                >
                  الاشتراكات
                  {sortConfig?.key === 'deviceCount' && (
                    <span className="inline-block mr-1">
                      {sortConfig.direction === 'ascending' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  )}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[10%]"
                  onClick={() => requestSort('totalPrice')}
                >
                  المستحقات
                  {sortConfig?.key === 'totalPrice' && (
                    <span className="inline-block mr-1">
                      {sortConfig.direction === 'ascending' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  )}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]"
                  onClick={() => requestSort('subscription_end')}
                >
                  انتهاء الاشتراك
                  {sortConfig?.key === 'subscription_end' && (
                    <span className="inline-block mr-1">
                      {sortConfig.direction === 'ascending' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  )}
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center w-[10%]">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingMore ? (
                // عرض صفوف التحميل عندما تكون البيانات قيد التحميل
                Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonRow key={`skeleton-${index}`} />
                ))
              ) : stableClients.length > 0 ? (
                stableClients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-[20%] md:w-[25%]">
  <div className="flex items-center justify-between">
    <div
      className={`
        text-sm font-medium text-gray-900 dark:text-white
        max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap
        ${typeof client.agent === 'object' && client.agent && 'name' in client.agent ? (/^[A-Za-z]/.test(client.agent.name || '') ? 'text-left' : 'text-right') : 'text-right'}
      `}
      style={{
        direction: typeof client.agent === 'object' && client.agent && 'name' in client.agent ? (/^[A-Za-z]/.test(client.agent.name || '') ? 'ltr' : 'rtl') : 'rtl',
        unicodeBidi: 'plaintext'
      }}
      title={typeof client.agent === 'object' && client.agent && 'name' in client.agent ? client.agent.name || '-' : '-'} // لعرض الاسم الكامل عند hover
    >
      {typeof client.agent === 'object' && client.agent && 'name' in client.agent ? client.agent.name || '-' : '-'}
    </div>
    <button 
      onClick={() => toggleShowDevices(client.id)}
      className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title={client.showDevices ? "إخفاء الأجهزة" : "عرض الأجهزة"}
    >
      {client.showDevices ? 
        <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : 
        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      }
    </button>
  </div>
                      {client.showDevices && (
                        <div className="mt-2">
                          {/* عرض اشتراكات الهاتف فقط إذا كانت متوافقة مع الفلتر أو لا يوجد فلتر */}
                          {client.mobileDevices && client.mobileDevices.length > 0 && 
                            (deviceFilter !== 'computer') && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Smartphone className="inline h-3 w-3 mr-1" /> اشتراكات الهاتف: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">
                                  {client.mobileDevices.filter((device: any) => 
                                    // إذا كان هناك فلتر نشط، نعرض فقط الأجهزة المطابقة للفلتر
                                    !activeFilter || !filteredDevicesByClient[client.id] || 
                                    filteredDevicesByClient[client.id]?.includes(device.id)
                                  ).length}
                                </span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.mobileDevices
                                  .filter((device: any) => 
                                    // إذا كان هناك بحث، نعرض فقط الأجهزة المطابقة للبحث
                                    (searchTerm === '' || matchingDeviceIds.includes(device.id)) &&
                                    // إذا كان هناك فلتر نشط، نعرض فقط الأجهزة المطابقة للفلتر
                                    (!activeFilter || !filteredDevicesByClient[client.id] || 
                                     filteredDevicesByClient[client.id]?.includes(device.id))
                                  )
                                  .map(device => (
                                  <div key={`mobile-${device.id}`} className={`flex items-center justify-between p-1 rounded ${device.approval_status === 'approved' ? 'bg-green-50 dark:bg-green-900/20' : device.approval_status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                                    <div className="flex items-center">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-1">
                                        {device.device_type || 'غير محدد'}
                                      </span>
                                      <div className="flex items-center">
                                        <span className="text-xs font-mono ml-2 max-w-[100px] truncate">{device.activation_code}</span>
                                        <button 
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            copyActivationCode(device.activation_code, device.id);
                                          }} 
                                          className="ml-1 p-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                                          title="نسخ رمز التفعيل"
                                        >
                                          {copiedCodes[device.id] ? 
                                            <Check size={14} className="text-green-500" /> : 
                                            <Copy size={14} />}
                                        </button>
                                      </div>
                                      {/* إضافة حالة الجهاز */}
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2 ${device.approval_status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : device.approval_status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                        {device.approval_status === 'approved' ? 'مقبول' : 
                                         device.approval_status === 'rejected' ? 'مرفوض' : 'معلق'}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      {device.subscription_type && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 ml-1">
                                          {getSubscriptionTypeLabel(device.subscription_type)}
                                        </span>
                                      )}
                                      <span className="text-xs font-medium ml-1">{(device.price || 0).toLocaleString()} جنيه</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* عرض اشتراكات الكمبيوتر فقط إذا كانت متوافقة مع الفلتر أو لا يوجد فلتر */}
                          {client.computerDevices && client.computerDevices.length > 0 && 
                            (deviceFilter !== 'mobile') && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Laptop className="inline h-3 w-3 mr-1" /> اشتراكات الكمبيوتر: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">
                                  {client.computerDevices.filter((device: any) => 
                                    // إذا كان هناك فلتر نشط، نعرض فقط الأجهزة المطابقة للفلتر
                                    !activeFilter || !filteredDevicesByClient[client.id] || 
                                    filteredDevicesByClient[client.id]?.includes(device.id)
                                  ).length}
                                </span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.computerDevices
                                  .filter((device: any) => 
                                    // إذا كان هناك بحث، نعرض فقط الأجهزة المطابقة للبحث
                                    (searchTerm === '' || matchingDeviceIds.includes(device.id)) &&
                                    // إذا كان هناك فلتر نشط، نعرض فقط الأجهزة المطابقة للفلتر
                                    (!activeFilter || !filteredDevicesByClient[client.id] || 
                                     filteredDevicesByClient[client.id]?.includes(device.id))
                                  )
                                  .map(device => (
                                  <div key={`computer-${device.id}`} className={`flex items-center justify-between p-1 rounded ${device.approval_status === 'approved' ? 'bg-green-50 dark:bg-green-900/20' : device.approval_status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                                    <div className="flex items-center">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-1">
                                        {device.device_type || 'غير محدد'}
                                      </span>
                                      <div className="flex items-center">
                                        <span className="text-xs font-mono ml-2 max-w-[100px] truncate">{device.activation_code}</span>
                                        <button 
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            copyActivationCode(device.activation_code, device.id);
                                          }} 
                                          className="ml-1 p-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                                          title="نسخ رمز التفعيل"
                                        >
                                          {copiedCodes[device.id] ? 
                                            <Check size={14} className="text-green-500" /> : 
                                            <Copy size={14} />}
                                        </button>
                                      </div>
                                      {/* إضافة حالة الجهاز */}
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2 ${device.approval_status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : device.approval_status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                        {device.approval_status === 'approved' ? 'مقبول' : 
                                         device.approval_status === 'rejected' ? 'مرفوض' : 'معلق'}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      {device.subscription_type && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 ml-1">
                                          {getSubscriptionTypeLabel(device.subscription_type)}
                                        </span>
                                      )}
                                      <span className="text-xs font-medium ml-1">{(device.price || 0).toLocaleString()} جنيه</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className={`px-4 py-4 whitespace-nowrap text-sm ${isRTL ? 'text-right' : 'text-left'} dir="ltr"`}>{client.phone}</td>
                    {/* <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.agent && typeof client.agent === 'object' && !Array.isArray(client.agent) && client.agent.name ? 
                        client.agent.name : '-'}
                    </td> */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
  <div
    className={`
      max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap
      ${typeof client.agent === 'object' && client.agent && 'name' in client.agent ? (/^[A-Za-z]/.test(client.agent.name || '') ? 'text-left' : 'text-right') : 'text-right'}
    `}
    style={{
      direction: typeof client.agent === 'object' && client.agent && 'name' in client.agent ? (/^[A-Za-z]/.test(client.agent.name || '') ? 'ltr' : 'rtl') : 'rtl',
      unicodeBidi: 'plaintext'
    }}
    title={typeof client.agent === 'object' && client.agent && 'name' in client.agent ? client.agent.name || '-' : '-'} // لعرض الاسم الكامل عند hover
  >
    {typeof client.agent === 'object' && client.agent && 'name' in client.agent ? client.agent.name || '-' : '-'}
  </div>
</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.deviceCount && client.deviceCount > 0 ? (
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              <span className="font-bold">{client.deviceCount}</span> اشتراك
                            </span>
                            
                            {/* مؤشرات حالة الاشتراكات */}
                            {client.mobileDevices && client.computerDevices && (
                              <div className="flex items-center gap-2 mr-1">
                                {/* الاشتراكات المقبولة */}
                                {(() => {
                                  const approvedCount = [...client.mobileDevices, ...client.computerDevices].filter(device => device.approval_status === 'approved').length;
                                  return approvedCount > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                                      <span className="text-xs">{approvedCount}</span>
                                    </div>
                                  ) : null;
                                })()}
                                
                                {/* الاشتراكات قيد المراجعة */}
                                {(() => {
                                  const pendingCount = [...client.mobileDevices, ...client.computerDevices].filter(device => device.approval_status === 'pending' || !device.approval_status).length;
                                  return pendingCount > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex h-3 w-3 rounded-full bg-yellow-500"></span>
                                      <span className="text-xs">{pendingCount}</span>
                                    </div>
                                  ) : null;
                                })()}
                                
                                {/* الاشتراكات المرفوضة */}
                                {(() => {
                                  const rejectedCount = [...client.mobileDevices, ...client.computerDevices].filter(device => device.approval_status === 'rejected').length;
                                  return rejectedCount > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                                      <span className="text-xs">{rejectedCount}</span>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            )}
                          </div>
                          

                        </div>
                      ) : client.subscription_type ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {getSubscriptionTypeLabel(client.subscription_type)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          لا يوجد اشتراكات
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {client.totalPrice ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <span className="font-bold">{typeof client.totalPrice === 'string' ? parseFloat(client.totalPrice).toLocaleString() : client.totalPrice.toLocaleString()}</span> جنيه
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          0 جنيه
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-sm ${client.earliestEndDate && new Date(client.earliestEndDate) < new Date() ? 'text-red-500 font-semibold' : client.subscription_end && new Date(client.subscription_end) < new Date() && client.subscription_type !== 'permanent' ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {client.earliestEndDate ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${new Date(client.earliestEndDate) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                          {formatDateForDisplay(client.earliestEndDate)}
                          {client.subscriptionTypes && client.subscriptionTypes.includes('permanent') && (
                            <span className="mr-1 text-xs opacity-75">+دائم</span>
                          )}
                        </span>
                      ) : client.subscriptionTypes && client.subscriptionTypes.includes('permanent') ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t('client.permanent', 'دائم')}
                        </span>
                      ) : client.subscription_end ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${new Date(client.subscription_end) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                          {formatDateForDisplay(client.subscription_end)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          لا يوجد تاريخ انتهاء
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-center">
                      <div className="flex items-center justify-center gap-2 space-y-0">
                        {client.deviceCount && client.deviceCount > 0 && (
                          <Button
                            onClick={() => toggleShowDevices(client.id)}
                            variant="secondary"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-transform hover:scale-105 p-1 rounded-md"
                            aria-label={client.showDevices ? t('actions.hideDevices', 'إخفاء الاشتراكات') : t('actions.showDevices', 'عرض الاشتراكات') as string}
                          >
                            {client.showDevices ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={() => handleShowDetails(client)}
                          variant="secondary"
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-transform hover:scale-105 p-1 rounded-md"
                          aria-label={t('actions.viewDetails', 'عرض التفاصيل') as string}
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('clientsList.noClientsFound', 'لم يتم العثور على عملاء يطابقون البحث.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* مكون التنقل بين الصفحات */}
      {!isLoadingMore && totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center space-x-2 rtl:space-x-reverse">
          <Button
            onClick={() => setCurrentPage(prev => {
              const newPage = Math.max(prev - 1, 1);
              fetchClients(activeFilter, newPage);
              return newPage;
            })}
            disabled={currentPage === 1}
            variant="secondary"
            className="px-4 py-2 text-sm"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-1 rtl:space-x-reverse">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // حساب رقم الصفحة بناءً على موقع الصفحة الحالية
              let pageNumber;
              if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }
              
              return (
                <div key={`page-${pageNumber}`}>
                  <Button
                    onClick={() => {
                      setCurrentPage(pageNumber);
                      fetchClients(activeFilter, pageNumber);
                    }}
                    variant={currentPage === pageNumber ? 'primary' : 'secondary'}
                    size="sm"
                    className={`${currentPage === pageNumber ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    {pageNumber}
                  </Button>
                </div>
              );
            })}
            
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="px-2">...</span>
                <Button
                  onClick={() => {
                    setCurrentPage(totalPages);
                    fetchClients(activeFilter, totalPages);
                  }}
                  variant="secondary"
                  className="px-4 py-2 text-sm"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>
          
          <Button
            onClick={() => setCurrentPage(prev => {
              const newPage = Math.min(prev + 1, totalPages);
              fetchClients(activeFilter, newPage);
              return newPage;
            })}
            disabled={currentPage === totalPages}
            variant="secondary"
            className="px-4 py-2 text-sm"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient as any}
          agents={agents}
          versionTypes={VERSION_TYPES}
          subscriptionTypes={SUBSCRIPTION_TYPES}
          isOpen={showDetailsModal}
          onClose={handleCloseModal}
          onSave={handleUpdateClient}
          onDelete={handleDeleteClient}
          currentUser={user}
        />
      )}
    </div>
  );
};