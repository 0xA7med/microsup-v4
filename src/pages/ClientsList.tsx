import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
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
  
  const [clients, setClients] = useState<DisplayClientType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [pageSize] = useState(50);
  
  // دالة جلب العملاء مع تطبيق الفلتر
  const fetchClients = useCallback(async (filterOverride?: string | null, pageOverride?: number | null) => {
    try {
      // إلغاء أي طلب سابق لمنع تضارب البيانات
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // إنشاء وحدة تحكم جديدة للإلغاء
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // تعيين حالة التحميل
      setIsLoading(true);
      
      const filter = filterOverride !== undefined ? filterOverride : activeFilter;
      const page = pageOverride !== undefined && pageOverride !== null ? pageOverride : currentPage;
      
      // حساب الإزاحة للصفحة
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      console.log(`Fetching clients with filter: ${filter}, page: ${page}, from: ${from}, to: ${to}`);
      
      // استعلام أساسي لجلب العملاء
      let query = supabase
        .from('clients')
        .select(`
          *,
          agent:agent_id(id, name),
          devices(*)
        `, { count: 'exact' });
      
      // تطبيق الفلتر
      if (filter === 'mobile' || deviceFilter === 'mobile') {
        // استعلام للعملاء الذين لديهم أجهزة هاتف
        const { data, error } = await supabase
          .from('devices')
          .select('client_id')
          .eq('device_type', 'android');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const clientIds = [...new Set(data.map(d => d.client_id))];
          query = query.in('id', clientIds);
        } else {
          // إذا لم يكن هناك أجهزة هاتف، نعيد قائمة فارغة
          setClients([]);
          setTotalPages(0);
          setIsLoading(false);
          return;
        }
      } else if (filter === 'computer' || deviceFilter === 'computer') {
        // استعلام للعملاء الذين لديهم أجهزة كمبيوتر
        const { data, error } = await supabase
          .from('devices')
          .select('client_id')
          .eq('device_type', 'computer');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const clientIds = [...new Set(data.map(d => d.client_id))];
          query = query.in('id', clientIds);
        } else {
          // إذا لم يكن هناك أجهزة كمبيوتر، نعيد قائمة فارغة
          setClients([]);
          setTotalPages(0);
          setIsLoading(false);
          return;
        }
      } else if (filter === 'active') {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('devices')
          .select('client_id')
          .gte('subscription_end', today);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const clientIds = [...new Set(data.map(d => d.client_id))];
          query = query.in('id', clientIds);
        } else {
          // إذا لم يكن هناك اشتراكات نشطة، نعيد قائمة فارغة
          setClients([]);
          setTotalPages(0);
          setIsLoading(false);
          return;
        }
      } else if (filter === 'expired') {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('devices')
          .select('client_id')
          .lt('subscription_end', today);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const clientIds = [...new Set(data.map(d => d.client_id))];
          query = query.in('id', clientIds);
        } else {
          // إذا لم يكن هناك اشتراكات منتهية، نعيد قائمة فارغة
          setClients([]);
          setTotalPages(0);
          setIsLoading(false);
          return;
        }
      } else if (filter === 'expiringSoon' || filter === 'expiring') {
        const today = new Date();
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);
        
        const todayStr = today.toISOString().split('T')[0];
        const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('devices')
          .select('client_id')
          .gte('subscription_end', todayStr)
          .lte('subscription_end', thirtyDaysLaterStr);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const clientIds = [...new Set(data.map(d => d.client_id))];
          query = query.in('id', clientIds);
        } else {
          // إذا لم يكن هناك اشتراكات قريبة الانتهاء، نعيد قائمة فارغة
          setClients([]);
          setTotalPages(0);
          setIsLoading(false);
          return;
        }
      } else if (filter === 'noDevices') {
        // استعلام للعملاء الذين ليس لديهم أجهزة
        const { data: clientsWithDevices, error } = await supabase
          .from('devices')
          .select('client_id');
        
        if (error) throw error;
        
        if (clientsWithDevices && clientsWithDevices.length > 0) {
          const clientIdsWithDevices = [...new Set(clientsWithDevices.map(d => d.client_id))];
          query = query.not('id', 'in', clientIdsWithDevices);
        }
      } else if (filter === 'allDevices') {
        // عرض جميع العملاء مع أجهزتهم
        const { data, error } = await supabase
          .from('devices')
          .select('client_id');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const clientIds = [...new Set(data.map(d => d.client_id))];
          query = query.in('id', clientIds);
        } else {
          // إذا لم يكن هناك أجهزة، نعيد قائمة فارغة
          setClients([]);
          setTotalPages(0);
          setIsLoading(false);
          return;
        }
      } else if (filter?.startsWith('agent_')) {
        const agentId = filter.replace('agent_', '');
        query = query.eq('agent_id', agentId);
      }
      
      // إضافة البحث إذا كان موجودًا
      if (searchTerm) {
        // البحث في بيانات العملاء
        query = query.or(`client_name.ilike.%${searchTerm}%,organization_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,phone2.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        
        // البحث في بيانات الأجهزة بشكل منفصل
        const { data: deviceData, error: deviceError } = await supabase
          .from('devices')
          .select('client_id')
          .or(`activation_code.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        
        if (!deviceError && deviceData && deviceData.length > 0) {
          // إضافة معرفات العملاء الذين لديهم أجهزة تطابق البحث
          const clientIdsFromDevices = [...new Set(deviceData.map(d => d.client_id))];
          
          // إذا كان هناك نتائج من البحث في الأجهزة، نضيفها إلى الاستعلام
          if (clientIdsFromDevices.length > 0) {
            // نجمع بين نتائج البحث في العملاء والأجهزة
            query = query.or(`id.in.(${clientIdsFromDevices.join(',')})`);
          }
        }
      }
      
      // إضافة الترتيب
      if (sortConfig) {
        const { key, direction } = sortConfig;
        const order = direction === 'ascending' ? true : false;
        
        // تطبيق الترتيب على مستوى قاعدة البيانات لجميع الأعمدة المدعومة
        if (key === 'client_name' || key === 'organization_name' || key === 'phone' || key === 'agent_id') {
          // ترتيب مباشر للأعمدة الموجودة في قاعدة البيانات (بدون حدود الصفحات)
          query = query.order(key, { ascending: order });
        } else if (key === 'deviceCount') {
          // لا يمكن ترتيب عدد الأجهزة مباشرة، نحاول استخدام ترتيب بديل
          // نجلب جميع البيانات ثم نرتبها في الذاكرة
          // لا نضيف حدود الصفحات هنا
        } else if (key === 'totalPrice') {
          // لا يمكن ترتيب المستحقات مباشرة، نحاول استخدام ترتيب بديل
          // نجلب جميع البيانات ثم نرتبها في الذاكرة
          // لا نضيف حدود الصفحات هنا
        } else if (key === 'subscription_end' || key === 'earliestEndDate') {
          // ترتيب حسب تاريخ انتهاء الاشتراك
          if (key === 'subscription_end') {
            query = query.order('subscription_end', { ascending: order });
          }
          // لا نضيف حدود الصفحات هنا للحصول على جميع البيانات
        } else {
          // الترتيب الافتراضي حسب اسم العميل
          query = query.order('client_name', { ascending: true });
        }
      } else {
        // الترتيب الافتراضي حسب اسم العميل
        query = query.order('client_name', { ascending: true });
      }
      
      // نحفظ الاستعلام الأصلي قبل إضافة حدود الصفحات
      const fullQuery = query;
      
      // نجلب جميع البيانات إذا كان الترتيب على عمود محسوب
      let allClientsData = null;
      if (sortConfig && (sortConfig.key === 'deviceCount' || sortConfig.key === 'totalPrice' || sortConfig.key === 'earliestEndDate')) {
        const { data: allData, error: allDataError } = await fullQuery.abortSignal(signal);
        
        if (allDataError) {
          console.error('Error fetching all data for sorting:', allDataError);
          throw allDataError;
        }
        
        allClientsData = allData;
      }
      
      // إضافة الصفحات للاستعلام العادي
      query = query.range(from, to);
      
      console.log('Executing Supabase query...');
      
      // استخدام البيانات المجلوبة مسبقًا أو تنفيذ الاستعلام العادي
      let clientsData, count, error;
      
      if (allClientsData) {
        // إذا كان لدينا بيانات مجلوبة مسبقًا، نستخدمها
        clientsData = allClientsData;
        count = allClientsData.length;
        error = null;
      } else {
        // تنفيذ الاستعلام العادي مع حدود الصفحات
        const result = await query.abortSignal(signal);
        clientsData = result.data;
        count = result.count;
        error = result.error;
      }
      
      if (signal.aborted) {
        console.log('Query aborted');
        return;
      }
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      console.log(`Fetched ${clientsData?.length || 0} clients, total count: ${count || 0}`);
      
      // جلب الوكلاء إذا لم تكن موجودة بالفعل
      if (!agents.length) {
        const { data: agentsData, error: agentsError } = await supabase
          .from('agents')
          .select('*')
          .abortSignal(signal);
        
        if (signal.aborted) return;
        
        if (agentsError) throw agentsError;
        setAgents(agentsData || []);
      }
      
      // تحويل البيانات إلى الشكل المطلوب للعرض
      const clientsWithDevices = clientsData || [];
      
      const processedClients = clientsWithDevices.map(client => {
        const devices = client.devices || [];
        const mobileDevices = devices.filter((d: any) => d.device_type === 'android');
        const computerDevices = devices.filter((d: any) => d.device_type === 'computer');
        
        // حساب تاريخ انتهاء أقرب اشتراك
        let earliestEndDate: string | null = null;
        let subscriptionTypes: string[] = [];
        let totalPrice = 0;
        let mobilePrice = 0;
        let computerPrice = 0;
        
        if (devices.length > 0) {
          // جمع أنواع الأجهزة الفريدة
          subscriptionTypes = [...new Set(devices.map((d: any) => d.device_type))] as string[];
          
          // حساب المستحقات الفعلية من الأجهزة
          devices.forEach((device: any) => {
            // استخدام السعر المخزن في الجهاز فقط إذا كان موجودًا
            const devicePrice = device.price ? parseFloat(device.price) : 0;
            
            // إضافة السعر فقط للأجهزة المقبولة
            if (device.approval_status === 'approved') {
              totalPrice += devicePrice;
              
              if (device.device_type === 'android') {
                mobilePrice += devicePrice;
              } else if (device.device_type === 'computer') {
                computerPrice += devicePrice;
              }
            }
          });
          
          // تحديد أقرب تاريخ انتهاء
          const validEndDates = devices
            .filter((d: any) => d.subscription_end)
            .map((d: any) => new Date(d.subscription_end))
            .filter((date: any) => !isNaN(date.getTime()))
            .sort((a: any, b: any) => a.getTime() - b.getTime());
          
          if (validEndDates.length > 0) {
            earliestEndDate = validEndDates[0].toISOString();
          }
        }
        
        return {
          ...client,
          deviceCount: devices.length,
          devices,
          mobileDevices,
          computerDevices,
          earliestEndDate,
          subscriptionTypes,
          totalPrice,
          mobilePrice,
          computerPrice,
          showDevices: filter === 'allDevices' || filter === 'mobile' || filter === 'computer' || 
                      filter === 'active' || filter === 'expired' || filter === 'expiring' || 
                      deviceFilter === 'mobile' || deviceFilter === 'computer' || 
                      (searchTerm && searchTerm.length > 0) // عرض الأجهزة تلقائيًا عند تطبيق أي فلتر أو البحث
        };
      });
      
      // تطبيق الترتيب للأعمدة المحسوبة
      if (sortConfig && (sortConfig.key === 'deviceCount' || sortConfig.key === 'totalPrice' || sortConfig.key === 'subscription_end' || sortConfig.key === 'earliestEndDate')) {
        const { key, direction } = sortConfig;
        
        processedClients.sort((a, b) => {
          let comparison = 0;
          
          if (key === 'deviceCount') {
            comparison = (a.deviceCount || 0) - (b.deviceCount || 0);
          } else if (key === 'totalPrice') {
            comparison = (a.totalPrice || 0) - (b.totalPrice || 0);
          } else if (key === 'subscription_end') {
            const dateA = a.subscription_end ? new Date(a.subscription_end).getTime() : 0;
            const dateB = b.subscription_end ? new Date(b.subscription_end).getTime() : 0;
            comparison = dateA - dateB;
          } else if (key === 'earliestEndDate') {
            const dateA = a.earliestEndDate ? new Date(a.earliestEndDate).getTime() : 0;
            const dateB = b.earliestEndDate ? new Date(b.earliestEndDate).getTime() : 0;
            comparison = dateA - dateB;
          }
          
          // تطبيق اتجاه الترتيب
          return direction === 'ascending' ? comparison : -comparison;
        });
      }
      
      // حساب إجمالي الصفحات
      const totalItems = count || 0;
      const calculatedTotalPages = Math.ceil(totalItems / pageSize);
      
      // التأكد من أن الطلب لم يتم إلغاؤه قبل تحديث الحالة
      if (!signal.aborted) {
        // تحديث البيانات أولاً ثم تعيين حالة التحميل
        setClients(processedClients);
        setTotalPages(calculatedTotalPages);
        
        // استخدام setTimeout لتأخير تحديث حالة التحميل
        // هذا يمنع الفلكر عن طريق ضمان تحديث البيانات أولاً
        setTimeout(() => {
          if (!signal.aborted) {
            setIsLoading(false);
            isDataLoaded.current = true;
          }
        }, 100);
        
        // إذا كانت الصفحة الحالية أكبر من إجمالي الصفحات، نعود للصفحة الأولى
        if (page > calculatedTotalPages && calculatedTotalPages > 0) {
          setCurrentPage(1);
        }
      }
    } catch (error: any) {
      // التأكد من أن الخطأ ليس بسبب إلغاء الطلب
      if (error.name !== 'AbortError') {
        console.error('Error fetching clients:', error);
        toast.error(t('errors.fetchClients', 'حدث خطأ أثناء جلب بيانات العملاء'));
        setIsLoading(false);
      }
    }
  }, [activeFilter, deviceFilter, currentPage, pageSize, t, searchTerm, agents.length, sortConfig]);
  
  // تحسين عملية تحميل البيانات وتجنب الفلكر
  const loadData = useCallback(async () => {
    try {
      // تعيين حالة التحميل
      if (!isDataLoaded.current) {
        setIsLoading(true);
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
      
      if (agentIdParam) {
        // إذا كان هناك معرف وكيل في العنوان، نقوم بتطبيق الفلتر
        setActiveFilter(`agent_${agentIdParam}`);
        await fetchClients(`agent_${agentIdParam}`);
      } else {
        await fetchClients();
      }
      
      // تعيين علامة تحميل البيانات
      isDataLoaded.current = true;
    } catch (error: any) {
      // التأكد من أن الخطأ ليس بسبب إلغاء الطلب
      if (error.name !== 'AbortError') {
        console.error('Error loading data:', error);
        toast.error(t('errors.loadData', 'حدث خطأ أثناء تحميل البيانات'));
        setIsLoading(false);
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
  
  // إضافة useEffect للبحث مع تأخير زمني
  useEffect(() => {
    // تجاهل التغييرات في الرندر الأول
    if (isFirstRender.current) return;
    
    const delayDebounceFn = setTimeout(() => {
      // تعيين حالة التحميل فقط إذا كان هناك مصطلح بحث
      if (searchTerm.trim().length > 0) {
        setIsLoading(true);
      }
      
      fetchClients(activeFilter, 1);
    }, 500);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeFilter, fetchClients]);
  
  // إضافة useEffect لمعالجة مشكلة الفلكر عند تغيير الصفحات
  useEffect(() => {
    // تجنب تحميل البيانات في الرندر الأول
    if (isFirstRender.current) return;
    
    // استخدام requestAnimationFrame لتأخير تحديث واجهة المستخدم
    // هذا يساعد في منع الفلكر عن طريق ضمان تزامن التحديثات مع دورة الرسم
    const frameId = requestAnimationFrame(() => {
      setIsLoading(true);
      fetchClients(activeFilter, currentPage);
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
    setIsLoading(true);
    fetchClients(activeFilter, 1);
  }, [activeFilter, fetchClients]);

  // دالة لتبديل حالة إظهار الاشتراكات لعميل معين
  const toggleShowDevices = useCallback((clientId: string) => {
    setClients(prevClients => 
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
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
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
                  setDeviceFilter(deviceFilter === 'mobile' ? null : 'mobile');
                  setActiveFilter(null);
                  setCurrentPage(1);
                  setIsLoading(true);
                  fetchClients(null, 1);
                }}
                variant={deviceFilter === 'mobile' ? 'primary' : 'secondary'}
                size="sm"
                className="flex items-center gap-1"
                data-key="mobile"
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
                  setIsLoading(true);
                  fetchClients(null, 1);
                }}
                variant={deviceFilter === 'computer' ? 'primary' : 'secondary'}
                size="sm"
                className="flex items-center gap-1"
                data-key="computer"
              >
                <Laptop className="w-3 h-3" />
                <span>{t('clientsList.computerFilter', 'اشتراكات الكمبيوتر')}</span>
                {deviceFilter === 'computer' && (
                  <span className="mr-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                    ✓
                  </span>
                )}
              </Button>
              
              <Button
                onClick={() => {
                  setActiveFilter('allDevices');
                  setDeviceFilter(null);
                  setCurrentPage(1);
                  setIsLoading(true);
                  fetchClients('allDevices', 1);
                }}
                variant={activeFilter === 'allDevices' ? 'primary' : 'secondary'}
                size="sm"
                className="flex items-center gap-1"
                data-key="allDevices"
              >
                <Eye className="w-3 h-3" />
                <span>{t('clientsList.allDevicesFilter', 'جميع الاشتراكات')}</span>
                {activeFilter === 'allDevices' && (
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
                  <Button
                    onClick={() => {
                      setActiveFilter(activeFilter === filter.value ? null : filter.value);
                      setDeviceFilter(null);
                      setCurrentPage(1);
                      setIsLoading(true);
                      fetchClients(filter.value, 1);
                    }}
                    variant={activeFilter === filter.value ? 'primary' : 'secondary'}
                    size="sm"
                    className="flex items-center gap-1"
                    data-key={filter.value}
                  >
                    <FilterIcon className="w-3 h-3" />
                    <span>{filter.label}</span>
                    {activeFilter === filter.value && (
                      <span className="mr-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                        ✓
                      </span>
                    )}
                  </Button>
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
                    if (selectedValue) {
                      setActiveFilter(selectedValue);
                      setDeviceFilter(null);
                      setCurrentPage(1);
                      setIsLoading(true);
                      fetchClients(selectedValue, 1);
                    } else {
                      setActiveFilter(null);
                      setDeviceFilter(null);
                      setCurrentPage(1);
                      setIsLoading(true);
                      fetchClients(null, 1);
                    }
                  }}
                >
                  <option value="">{t('clientsList.selectAgent', 'اختر المندوب...')}</option>
                  {agents.map(agent => (
                    <option data-key={agent.id} value={`agent_${agent.id}`}>
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
                setIsLoading(true);
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
            setIsLoading(true);
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
            setIsLoading(true);
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
  
  // إضافة useEffect للبحث مع تأخير زمني
  useEffect(() => {
    // تجاهل التغييرات في الرندر الأول
    if (isFirstRender.current) return;
    
    const delayDebounceFn = setTimeout(() => {
      // تعيين حالة التحميل فقط إذا كان هناك مصطلح بحث
      if (searchTerm.trim().length > 0) {
        setIsLoading(true);
      }
      
      fetchClients(activeFilter, 1);
    }, 500);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeFilter, fetchClients]);
  
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

      {isLoading ? (
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
              {isLoading ? (
                // عرض صفوف التحميل عندما تكون البيانات قيد التحميل
                Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonRow key={`skeleton-${index}`} />
                ))
              ) : clients.length > 0 ? (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-[20%] md:w-[25%]">
                      <div className="flex items-center justify-between">
                        <span>{client.client_name}</span>
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
                          {/* عرض اشتراكات الهاتف */}
                          {client.mobileDevices && client.mobileDevices.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Smartphone className="inline h-3 w-3 mr-1" /> اشتراكات الهاتف: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.mobileDevices.length}</span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.mobileDevices.map((device: any, index: number) => (
                                  <div key={index} className={`flex items-center justify-between p-1 rounded ${device.approval_status === 'approved' ? 'bg-green-50 dark:bg-green-900/20' : device.approval_status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                                    <div className="flex items-center">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-1">
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
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ml-2">
                                          {device.subscription_type === 'permanent' ? 'دائم' : 
                                           device.subscription_type === 'monthly' ? 'شهري' : 
                                           device.subscription_type === 'annual' ? 'سنوي' : device.subscription_type}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        {device.price ? parseFloat(device.price).toLocaleString() : '0'} جنيه
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* عرض اشتراكات الكمبيوتر */}
                          {client.computerDevices && client.computerDevices.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Laptop className="inline h-3 w-3 mr-1" /> اشتراكات الكمبيوتر: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.computerDevices.length}</span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.computerDevices.map((device: any, index: number) => (
                                  <div key={index} className={`flex items-center justify-between p-1 rounded ${device.approval_status === 'approved' ? 'bg-green-50 dark:bg-green-900/20' : device.approval_status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                                    <div className="flex items-center">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-1">
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
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ml-2">
                                          {device.subscription_type === 'permanent' ? 'دائم' : 
                                           device.subscription_type === 'monthly' ? 'شهري' : 
                                           device.subscription_type === 'annual' ? 'سنوي' : device.subscription_type}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        {device.price ? parseFloat(device.price).toLocaleString() : '0'} جنيه
                                      </span>
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.agent && typeof client.agent === 'object' && !Array.isArray(client.agent) && client.agent.name ? 
                        client.agent.name : '-'}
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
      {!isLoading && totalPages > 1 && (
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
          client={selectedClient as ImportedClientType}
          agents={agents}
          isOpen={showDetailsModal}
          onClose={handleCloseModal}
          onSave={handleUpdateClient}
          onDelete={handleDeleteClient}
          subscriptionTypes={SUBSCRIPTION_TYPES}
          versionTypes={VERSION_TYPES}
          currentUser={user}
        />
      )}
    </div>
  );
};