import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { 
  Search, 
  Smartphone, 
  Laptop, 
  Calendar, Eye, ChevronRight, ChevronUp, ChevronDown, ChevronLeft,
  Copy, Check, Zap, AlertCircle, Clock, Package, X 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types';
import { DeviceType, APPROVAL_STATUS } from '../types/device.types';

interface ClientType {
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
  agents?: Agent[];
  created_by?: string;
  created_at?: string;
  activation_code?: string;
  device_type?: string;
}

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
  agents?: Agent[];
  created_by?: string;
  created_at?: string;
  activation_code?: string;
  device_type?: string;
}

interface Agent extends ImportedAgent {
  // إضافة أي خصائص إضافية مطلوبة في واجهة العرض
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
  const copyActivationCode = (code: string, deviceId: string) => {
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
  };
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore(); // استخدام معلومات المستخدم المسجل دخوله

  const [clients, setClients] = useState<DisplayClientType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<ImportedClientType | null>(null);
  const [agents] = useState<Agent[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  
  // نظام الفلترة المتقدم الجديد
  const [filters, setFilters] = useState<{
    deviceType: string | null;      // موبايل، كمبيوتر، الكل
    subscriptionStatus: string | null; // نشط، منتهي، ينتهي قريباً، الكل
    approvalStatus: string | null;  // مقبول، معلق، مرفوض، الكل
    showDevices: boolean;           // عرض الاشتراكات أم لا
  }>({
    deviceType: null,
    subscriptionStatus: null,
    approvalStatus: null,
    showDevices: false
  });
  
  // متغيرات نظام الصفحات
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalClients, setTotalClients] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const pageSize = 100; // عدد العملاء في كل صفحة

  // تعريف حالة الترتيب
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  // دالة لتغيير ترتيب الجدول
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    
    // إعادة تحميل البيانات مع الترتيب الجديد
    fetchClients(activeFilter, currentPage);
  };

  // دالة لتبديل حالة إظهار الاشتراكات لعميل معين
  const toggleShowDevices = (clientId: string) => {
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId ? { ...client, showDevices: !client.showDevices } : client
      )
    );
  };

  // دالة جلب العملاء مع تطبيق الفلتر
  const fetchClients = async (filterOverride?: string | null, pageOverride?: number | null) => {
    // تفعيل حالة التحميل
    setLoading(true);
    
    // تسجيل الفلتر المستخدم للتصحيح
    console.log('جاري تنفيذ fetchClients مع الفلتر:', filterOverride, 'الصفحة:', pageOverride, 'البحث:', searchTerm, 'الترتيب:', sortConfig);
    
    const filter = filterOverride !== undefined ? filterOverride : activeFilter;
    const page = pageOverride !== undefined && pageOverride !== null ? pageOverride : currentPage;
    
    try {
      // تحديث الفلتر النشط فقط إذا كان مختلفاً عن القيمة الحالية وليس استدعاء من useEffect
      if (filter !== activeFilter && filterOverride !== undefined) {
        // تحديث حالة الفلاتر المتقدمة بناءً على الفلتر النشط
        if (filter) {
          const newFilters = { ...filters, showDevices: true };
          
          // إعادة تعيين جميع الفلاتر أولاً
          newFilters.deviceType = null;
          newFilters.subscriptionStatus = null;
          newFilters.approvalStatus = null;
          
          // تحديد الفلتر المناسب
          switch (filter) {
            case 'mobile':
              newFilters.deviceType = 'mobile';
              break;
            case 'computer':
              newFilters.deviceType = 'computer';
              break;
            case 'active':
              newFilters.subscriptionStatus = 'active';
              break;
            case 'expired':
              newFilters.subscriptionStatus = 'expired';
              break;
            case 'expiring':
              newFilters.subscriptionStatus = 'expiring';
              break;
            case 'approved':
              newFilters.approvalStatus = 'approved';
              break;
            case 'pending':
              newFilters.approvalStatus = 'pending';
              break;
            case 'rejected':
              newFilters.approvalStatus = 'rejected';
              break;
            case 'devices':
              newFilters.showDevices = true;
              break;
            default:
              newFilters.showDevices = false;
              break;
          }
          
          setFilters(newFilters);
        }
        
        // إعادة تعيين الصفحة إلى الأولى عند تغيير الفلتر
        if (page === currentPage) {
          setCurrentPage(1);
        }
      }
      
      // حساب الصفحات للتصفح
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // بناء استعلام قاعدة البيانات مع تطبيق الفلاتر مباشرة في الاستعلام
      let clientsQuery = supabase
        .from('clients')
        .select(`
          id, 
          client_name, 
          organization_name,
          activity_type,
          address,
          phone,
          phone2,
          notes,
          subscription_type,
          subscription_start,
          subscription_end,
          agent_id,
          agents(id, name),
          created_at,
          created_by
        `, { count: 'exact' });
      
      // تطبيق فلتر حسب الوكيل إذا كان المستخدم وكيل
      if (user?.role === 'agent') {
        clientsQuery = clientsQuery.eq('agent_id', user.id);
      }
      
      // تطبيق البحث على بيانات العميل
      if (searchTerm) {
        const searchTermLower = `%${searchTerm.toLowerCase()}%`;
        clientsQuery = clientsQuery.or(
          `client_name.ilike.${searchTermLower},organization_name.ilike.${searchTermLower},phone.ilike.${searchTermLower},phone2.ilike.${searchTermLower},notes.ilike.${searchTermLower}`
        );
      }
      
      // تطبيق الترتيب على الاستعلام
      if (sortConfig) {
        let sortKey = sortConfig.key;
        
        // التحقق من نوع الترتيب
        if (sortKey === 'agent_id') {
          // الترتيب حسب اسم المندوب غير مدعوم مباشرة في الاستعلام
          // سيتم تطبيقه بعد جلب البيانات
        } else if (sortKey === 'earliestEndDate' || sortKey === 'deviceCount' || sortKey === 'totalPrice') {
          // هذه الحقول تتطلب معالجة بعد جلب البيانات
          console.warn(`الترتيب حسب ${sortKey} يتطلب معالجة بعد جلب البيانات.`);
        } else {
          // تطبيق الترتيب مباشرة في الاستعلام
          clientsQuery = clientsQuery.order(sortKey, {
            ascending: sortConfig.direction === 'ascending',
            nullsFirst: false
          });
        }
      } else {
        // الترتيب الافتراضي حسب تاريخ الإنشاء تنازلياً
        clientsQuery = clientsQuery.order('created_at', { ascending: false });
      }
      
      // تطبيق التصفح
      clientsQuery = clientsQuery.range(from, to);
      
      // تنفيذ الاستعلام للحصول على العملاء
      const { data: allClientsData, error: clientsError, count } = await clientsQuery;
      
      if (clientsError) throw clientsError;
      
      if (!allClientsData) {
        setClients([]);
        setTotalClients(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }
      
      // تحديث إجمالي العملاء والصفحات
      if (count !== null) {
        setTotalClients(count);
        setTotalPages(Math.ceil(count / pageSize));
      }
      
      // الحصول على معرفات العملاء لاستخدامها في استعلام الاشتراكات
      const clientIds = allClientsData.map(c => c.id);
      
      // جلب الاشتراكات للعملاء في الصفحة الحالية فقط
      let devices = [];
      if (clientIds.length > 0) {
        let devicesQuery = supabase
          .from('devices')
          .select('*')
          .in('client_id', clientIds);
        
        // تطبيق فلاتر الاشتراكات مباشرة في الاستعلام
        if (filters.deviceType === 'mobile') {
          devicesQuery = devicesQuery.neq('device_type', 'computer');
        } else if (filters.deviceType === 'computer') {
          devicesQuery = devicesQuery.eq('device_type', 'computer');
        }
        
        if (filters.approvalStatus === 'approved') {
          devicesQuery = devicesQuery.eq('approval_status', 'approved');
        } else if (filters.approvalStatus === 'rejected') {
          devicesQuery = devicesQuery.eq('approval_status', 'rejected');
        } else if (filters.approvalStatus === 'pending') {
          devicesQuery = devicesQuery.or('approval_status.is.null,approval_status.eq.pending');
        }
        
        // تنفيذ الاستعلام للحصول على الاشتراكات
        const { data: devicesData, error: devicesError } = await devicesQuery;
        
        if (devicesError) {
          console.error('Error fetching devices:', devicesError);
        } else {
          devices = devicesData || [];
        }
      }
      
      // معالجة بيانات العملاء والاشتراكات
      let processedClients = allClientsData.map(client => {
        // الحصول على اشتراكات العميل الحالي
        const clientDevices = devices.filter(d => d.client_id === client.id);
        
        // تطبيق فلتر حالة الاشتراك (يتطلب معالجة بعد جلب البيانات)
        let filteredDevices = [...clientDevices];
        
        if (filters.subscriptionStatus) {
          const now = new Date();
          
          if (filters.subscriptionStatus === 'active') {
            filteredDevices = filteredDevices.filter(device => 
              device.subscription_type === 'permanent' || 
              (device.subscription_end && new Date(device.subscription_end) > now)
            );
          } else if (filters.subscriptionStatus === 'expired') {
            filteredDevices = filteredDevices.filter(device => 
              device.subscription_type !== 'permanent' && 
              device.subscription_end && 
              new Date(device.subscription_end) <= now
            );
          } else if (filters.subscriptionStatus === 'expiring') {
            const twoWeeksFromNow = new Date();
            twoWeeksFromNow.setDate(now.getDate() + 15);
            
            filteredDevices = filteredDevices.filter(device => 
              device.subscription_type !== 'permanent' && 
              device.subscription_end && 
              new Date(device.subscription_end) > now && 
              new Date(device.subscription_end) <= twoWeeksFromNow
            );
          }
        }
        
        // تطبيق البحث على بيانات الاشتراكات
        if (searchTerm) {
          const searchTermLower = searchTerm.toLowerCase();
          
          // التحقق مما إذا كانت الاشتراكات تطابق البحث
          const deviceMatches = filteredDevices.some(d =>
            (d.activation_code && d.activation_code.toLowerCase().includes(searchTermLower)) ||
            (d.notes && d.notes.toLowerCase().includes(searchTermLower))
          );
          
          // إذا كان البحث موجودًا ولكن لا العميل ولا اشتراكاته تطابق البحث، استبعد العميل
          const clientMatches = 
            (client.client_name && client.client_name.toLowerCase().includes(searchTermLower)) ||
            (client.organization_name && client.organization_name.toLowerCase().includes(searchTermLower)) ||
            (client.phone && client.phone.toLowerCase().includes(searchTermLower)) ||
            (client.phone2 && client.phone2.toLowerCase().includes(searchTermLower)) ||
            (client.notes && client.notes.toLowerCase().includes(searchTermLower));
          
          if (!clientMatches && !deviceMatches) {
            return null; // سيتم تصفية هذا لاحقًا
          }
        }
        
        // إذا كان هناك فلتر نشط وليس هناك اشتراكات تطابق الفلتر، نتخطى هذا العميل
        if ((filters.deviceType || filters.subscriptionStatus || filters.approvalStatus) && filteredDevices.length === 0) {
          return null; // سيتم تصفية هذا العميل لاحقاً
        }
        
        // تصنيف الاشتراكات حسب النوع
        const mobileDevices = filteredDevices.filter(device => device.device_type !== 'computer');
        const computerDevices = filteredDevices.filter(device => device.device_type === 'computer');
        
        // حساب إجمالي القيمة
        const totalPrice = filteredDevices.reduce((sum, device) => sum + (parseFloat(device.price || '0') || 0), 0);
        const mobilePrice = mobileDevices.reduce((sum, device) => sum + (parseFloat(device.price || '0') || 0), 0);
        const computerPrice = computerDevices.reduce((sum, device) => sum + (parseFloat(device.price || '0') || 0), 0);
        
        // البحث عن أقرب تاريخ انتهاء
        let earliestEndDate = null;
        const nonPermanentDevices = filteredDevices.filter(device => 
          device.subscription_type !== 'permanent' && device.subscription_end
        );
        
        if (nonPermanentDevices.length > 0) {
          earliestEndDate = nonPermanentDevices.reduce((earliest, device) => {
            if (!device.subscription_end) return earliest;
            if (!earliest) return device.subscription_end;
            
            try {
              return new Date(device.subscription_end) < new Date(earliest) ? device.subscription_end : earliest;
            } catch (e) {
              console.error("Error comparing dates:", device.subscription_end, earliest);
              return earliest;
            }
          }, null);
        }
        
        // جمع أنواع الاشتراكات الفريدة
        const subscriptionTypes = [...new Set(filteredDevices.map(d => d.subscription_type).filter(Boolean))];
        
        // تحويل بيانات المندوب إلى الصيغة المطلوبة
        let agent: { id?: string; name?: string } | null = null;
        if (client.agents) {
          // التعامل مع الحالات المختلفة لبنية بيانات المندوب
          const agentsData = client.agents as any;
          
          if (Array.isArray(agentsData) && agentsData.length > 0) {
            const firstAgent = agentsData[0];
            if (firstAgent && typeof firstAgent === 'object') {
              agent = {
                id: firstAgent.id?.toString(),
                name: firstAgent.name?.toString()
              };
            }
          } else if (agentsData && typeof agentsData === 'object') {
            // إذا كان كائن مفرد
            agent = {
              id: agentsData.id?.toString(),
              name: agentsData.name?.toString()
            };
          }
        }
        
        return {
          ...client,
          devices: filteredDevices,
          mobileDevices: filters.deviceType === 'mobile' ? filteredDevices : mobileDevices,
          computerDevices: filters.deviceType === 'computer' ? filteredDevices : computerDevices,
          deviceCount: filteredDevices.length,
          earliestEndDate,
          subscriptionTypes,
          totalPrice,
          mobilePrice,
          computerPrice,
          agent: agent,
          showDevices: filters.showDevices || (filters.deviceType || filters.subscriptionStatus || filters.approvalStatus)
        };
      }).filter(Boolean); // تصفية العملاء الذين ليس لديهم اشتراكات تطابق الفلتر (قيمة null)
      
      // تطبيق الترتيب على النتائج المفلترة إذا كان الترتيب يتطلب معالجة بعد جلب البيانات
      if (sortConfig && (sortConfig.key === 'deviceCount' || sortConfig.key === 'totalPrice' || sortConfig.key === 'earliestEndDate' || sortConfig.key === 'agent_id')) {
        processedClients.sort((a, b) => {
          let aValue, bValue;
          
          switch (sortConfig.key) {
            case 'deviceCount':
              aValue = a.deviceCount || 0;
              bValue = b.deviceCount || 0;
              break;
            case 'totalPrice':
              aValue = a.totalPrice || 0;
              bValue = b.totalPrice || 0;
              break;
            case 'earliestEndDate':
              // التعامل مع القيم الفارغة والتواريخ بشكل صحيح للترتيب
              aValue = a.earliestEndDate ? new Date(a.earliestEndDate).getTime() : (sortConfig.direction === 'ascending' ? Infinity : -Infinity);
              bValue = b.earliestEndDate ? new Date(b.earliestEndDate).getTime() : (sortConfig.direction === 'ascending' ? Infinity : -Infinity);
              break;
            case 'agent_id':
              aValue = a.agent ? a.agent.name || '' : '';
              bValue = b.agent ? b.agent.name || '' : '';
              return sortConfig.direction === 'ascending' 
                ? aValue.localeCompare(bValue) 
                : bValue.localeCompare(aValue);
            default:
              return 0;
          }
          
          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        });
      }
      
      // تحديث قائمة العملاء
      setClients(processedClients);
      
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error(`حدث خطأ أثناء جلب بيانات العملاء: ${error.message}`);
      setClients([]);
      setTotalClients(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // استخدام useEffect واحد لإدارة جميع حالات تحميل البيانات
  useEffect(() => {
    // دالة لتحميل البيانات
    const loadData = async () => {
      // التحقق مما إذا كان هناك فلتر في حالة الموقع
      const locationState = location.state as { filter?: string; applyFilterImmediately?: boolean } | null;
      
      try {
        console.log('تنفيذ loadData، الحالة الأولية:', { 
          locationState, 
          initialLoadComplete, 
          activeFilter 
        });
        
        if (locationState?.filter && locationState?.applyFilterImmediately) {
          console.log('تطبيق الفلتر من حالة الموقع:', locationState.filter);
          
          // مسح حالة الموقع فورًا لتجنب التكرار
          navigate(location.pathname, { replace: true });
          
          // تعيين الفلتر النشط وتنفيذ الفلترة مباشرة
          setActiveFilter(locationState.filter);
          await fetchClients(locationState.filter);
          
          // تعيين حالة التحميل الأولي كمكتمل
          setInitialLoadComplete(true);
        } else if (!initialLoadComplete) {
          // إذا لم يكن هناك فلتر في حالة الموقع، قم بتحميل البيانات بشكل عادي
          console.log('تنفيذ التحميل الأولي للبيانات');
          await fetchClients(null);
          setInitialLoadComplete(true);
        } else if (initialLoadComplete) {
          // إذا تغير الفلتر النشط بعد التحميل الأولي
          console.log('تحديث البيانات بعد التحميل الأولي، الفلتر النشط:', activeFilter);
          await fetchClients(activeFilter);
        }
      } catch (error) {
        console.error('خطأ أثناء تحميل البيانات:', error);
        toast.error('حدث خطأ أثناء تحميل البيانات');
        setLoading(false);
      }
    };
    
    loadData();
  }, [location, activeFilter, initialLoadComplete]);

  const handleShowDetails = (client: DisplayClientType) => {
    setSelectedClient(client as unknown as ImportedClientType);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedClient(null);
    fetchClients();
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      const { error } = await supabase.from('clients').delete().match({ id: clientId });
      if (error) throw error;
      toast.success('تم حذف العميل بنجاح');
      handleCloseModal();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('حدث خطأ أثناء حذف العميل');
    }
  };

  const handleUpdateClient = async (updatedClient: ImportedClientType | DisplayClientType) => {
    if (!updatedClient.id) return;
    
    // تحويل البيانات إلى الشكل المناسب لقاعدة البيانات
    const { agents, created_by, ...clientData } = updatedClient as any;
    
    // التأكد من أن العنوان موجود، وإذا لم يكن موجودًا نضع قيمة فارغة
    const dataToUpdate = {
      ...clientData,
      address: clientData.address || '',
    };

    try {
      const { error } = await supabase
        .from('clients')
        .update(dataToUpdate)
        .match({ id: updatedClient.id });

      if (error) throw error;
      toast.success('تم تحديث بيانات العميل بنجاح');
      handleCloseModal();
      // إعادة تحميل البيانات بعد التحديث
      fetchClients(activeFilter);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('حدث خطأ أثناء تحديث بيانات العميل');
    }
  };

  const getSubscriptionTypeLabel = (value: string) => {
    const type = SUBSCRIPTION_TYPES.find(t => t.value === value);
    return type ? (i18n.language === 'ar' ? type.label : type.labelEn) : value;
  };

  const formatDateForDisplay = (dateStr?: string | Date): string => {
    if (!dateStr) return 'غير متاح';
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(date.getTime())) {
         return 'تاريخ غير صالح';
      }
      if (date.getFullYear() <= 1970) {
          return 'لم يحدد';
      }
      return format(date, 'yyyy/MM/dd');
    } catch (error) {
      console.error("Error formatting date:", dateStr, error);
      return 'تاريخ غير صالح';
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('clientsList.title', 'قائمة العملاء')}</h1>
        
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            <span>{t('common.backToDashboard', 'العودة للوحة التحكم')}</span>
            <ChevronRight className="h-5 w-5 mr-1" />
          </button>
        </div>
        
        {activeFilter && (
          <div className="flex items-center">
            <span className="mr-2 text-sm text-gray-600 dark:text-gray-300">
              {t('clientsList.filterActive', 'الفلتر النشط')}:
            </span>
            <span className="px-3 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 rounded-full text-sm font-medium">
              {activeFilter === 'active' && t('clientsList.activeFilter', 'الاشتراكات النشطة')}
              {activeFilter === 'expired' && t('clientsList.expiredFilter', 'الاشتراكات المنتهية')}
              {activeFilter === 'permanent' && t('clientsList.permanentFilter', 'التراخيص الدائمة')}
              {activeFilter === 'monthly' && t('clientsList.monthlyFilter', 'الاشتراكات الشهرية')}
              {activeFilter === 'annual' && t('clientsList.annualFilter', 'الاشتراكات السنوية')}
              {activeFilter === 'expiring' && t('clientsList.expiringFilter', 'تنتهي خلال 15 يوم')}
              {activeFilter === 'devices' && t('clientsList.devicesFilter', 'عرض جميع الاشتراكات')}
              {activeFilter === 'mobile' && t('clientsList.mobileFilter', 'اشتراكات الهاتف')}
              {activeFilter === 'computer' && t('clientsList.computerFilter', 'اشتراكات الكمبيوتر')}
              {activeFilter === 'approved' && t('clientsList.approvedFilter', 'الاشتراكات المقبولة')}
              {activeFilter === 'pending' && t('clientsList.pendingFilter', 'الاشتراكات المعلقة')}
              {activeFilter === 'rejected' && t('clientsList.rejectedFilter', 'الاشتراكات المرفوضة')}
            </span>
            <button 
              onClick={() => {
                // أولاً: جلب البيانات مع الفلتر لتجنب أي تأخير
                fetchClients(null);
                // ثم تحديث الحالة
                setActiveFilter(null);
                // ثالثاً: تحديث الرابط لإزالة معلمة الفلتر
                navigate('/clients', { replace: true });
              }}
              className="mr-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              {t('clientsList.clearFilter', 'إلغاء الفلتر')} ×
            </button>
          </div>
        )}
      </div>

      {/* أزرار الفلترة الجديدة */}
      <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">فلترة العملاء</h2>
        
        {/* قسم فلترة نوع الاشتراك */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نوع الاشتراك:</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  deviceType: prev.deviceType === 'mobile' ? null : 'mobile',
                  showDevices: true
                }));
                fetchClients('mobile');
              }}
              variant={filters.deviceType === 'mobile' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.deviceType === 'mobile' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Smartphone className="w-3 h-3" />
              <span>{t('clientsList.mobileFilter', 'اشتراكات الهاتف')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  deviceType: prev.deviceType === 'computer' ? null : 'computer',
                  showDevices: true
                }));
                fetchClients('computer');
              }}
              variant={filters.deviceType === 'computer' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.deviceType === 'computer' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Laptop className="w-3 h-3" />
              <span>{t('clientsList.computerFilter', 'اشتراكات الكمبيوتر')}</span>
            </Button>
          </div>
        </div>
        
        {/* قسم فلترة حالة الاشتراك */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حالة الاشتراك:</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  subscriptionStatus: prev.subscriptionStatus === 'active' ? null : 'active',
                  showDevices: true
                }));
                fetchClients('active');
              }}
              variant={filters.subscriptionStatus === 'active' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.subscriptionStatus === 'active' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Zap className="w-3 h-3" />
              <span>{t('clientsList.activeFilter', 'الاشتراكات النشطة')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  subscriptionStatus: prev.subscriptionStatus === 'expired' ? null : 'expired',
                  showDevices: true
                }));
                fetchClients('expired');
              }}
              variant={filters.subscriptionStatus === 'expired' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.subscriptionStatus === 'expired' ? 'bg-primary-600 text-white' : ''}`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>{t('clientsList.expiredFilter', 'الاشتراكات المنتهية')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  subscriptionStatus: prev.subscriptionStatus === 'expiring' ? null : 'expiring',
                  showDevices: true
                }));
                fetchClients('expiring');
              }}
              variant={filters.subscriptionStatus === 'expiring' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.subscriptionStatus === 'expiring' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Clock className="w-3 h-3" />
              <span>{t('clientsList.expiringFilter', 'تنتهي خلال 15 يوم')}</span>
            </Button>
          </div>
        </div>
        
        {/* قسم فلترة حالة القبول */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حالة القبول:</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  approvalStatus: prev.approvalStatus === 'approved' ? null : 'approved',
                  showDevices: true
                }));
                fetchClients('approved');
              }}
              variant={filters.approvalStatus === 'approved' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.approvalStatus === 'approved' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Check className="w-3 h-3" />
              <span>{t('clientsList.approvedFilter', 'الاشتراكات المقبولة')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  approvalStatus: prev.approvalStatus === 'pending' ? null : 'pending',
                  showDevices: true
                }));
                fetchClients('pending');
              }}
              variant={filters.approvalStatus === 'pending' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.approvalStatus === 'pending' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Clock className="w-3 h-3" />
              <span>{t('clientsList.pendingFilter', 'الاشتراكات المعلقة')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setFilters(prev => ({
                  ...prev,
                  approvalStatus: prev.approvalStatus === 'rejected' ? null : 'rejected',
                  showDevices: true
                }));
                fetchClients('rejected');
              }}
              variant={filters.approvalStatus === 'rejected' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${filters.approvalStatus === 'rejected' ? 'bg-primary-600 text-white' : ''}`}
            >
              <X className="w-3 h-3" />
              <span>{t('clientsList.rejectedFilter', 'الاشتراكات المرفوضة')}</span>
            </Button>
          </div>
        </div>
        
        {/* أزرار إضافية */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            onClick={() => {
              setLoading(true);
              setFilters({
                deviceType: null,
                subscriptionStatus: null,
                approvalStatus: null,
                showDevices: true
              });
              fetchClients('devices');
            }}
            variant={activeFilter === 'devices' ? 'primary' : 'secondary'}
            size="sm"
            className={`flex items-center gap-1 ${activeFilter === 'devices' ? 'bg-primary-600 text-white' : ''}`}
          >
            <Package className="w-3 h-3" />
            <span>{t('clientsList.devicesFilter', 'عرض جميع الاشتراكات')}</span>
          </Button>
          
          <Button
            onClick={() => {
              setLoading(true);
              setFilters({
                deviceType: null,
                subscriptionStatus: null,
                approvalStatus: null,
                showDevices: false
              });
              fetchClients(null);
            }}
            variant="secondary"
            size="sm"
            className="flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>{t('clientsList.clearFilters', 'إلغاء جميع الفلاتر')}</span>
          </Button>
        </div>
      </div>
      
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="ابحث بالاسم، المؤسسة، الهاتف، الملاحظات، رمز التفعيل..."
          className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            // إعادة تعيين الصفحة إلى الأولى عند البحث
            if (currentPage !== 1) {
              setCurrentPage(1);
            } else {
              // إذا كانت الصفحة بالفعل هي الأولى، نقوم بإعادة جلب البيانات
              const delayDebounceFn = setTimeout(() => {
                fetchClients(activeFilter, 1);
              }, 500);
              
              return () => clearTimeout(delayDebounceFn);
            }
          }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t('common.loading', 'جار التحميل...')}</p>
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
                  القيمة
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
              {clients.length > 0 ? (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-[20%] md:w-[25%]">
                      {client.client_name}
                      {((filters.deviceType === 'mobile' || filters.deviceType === 'computer') || client.showDevices) && (
                        <div className="mt-2">
                          {/* عرض اشتراكات الهاتف */}
                          {/* عرض اشتراكات الهاتف فقط إذا كان الفلتر هو موبايل أو إذا كان العميل يعرض جميع الاشتراكات وليس الفلتر كمبيوتر */}
                          {((filters.deviceType === 'mobile' && client.mobileDevices && client.mobileDevices.length > 0) || 
                            (client.showDevices && client.mobileDevices && client.mobileDevices.length > 0 && filters.deviceType !== 'computer')) && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Smartphone className="inline h-3 w-3 mr-1" /> اشتراكات الهاتف: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.mobileDevices.length}</span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.mobileDevices
                                  .filter((device: any) => {
                                    // تصفية الاشتراكات حسب حالة الموافقة إذا كان الفلتر مطبق
                                    if (filters.approvalStatus === 'approved') return device.approval_status === 'approved';
                                    if (filters.approvalStatus === 'pending') return device.approval_status === 'pending' || !device.approval_status;
                                    if (filters.approvalStatus === 'rejected') return device.approval_status === 'rejected';
                                    return true;
                                  })
                                  .map((device: any, index: number) => (
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
                                        {device.price ? device.price.toLocaleString() : '0'} جنيه
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* عرض اشتراكات الكمبيوتر */}
                          {/* عرض اشتراكات الكمبيوتر فقط إذا كان الفلتر هو كمبيوتر أو إذا كان العميل يعرض جميع الاشتراكات وليس الفلتر موبايل */}
                          {((filters.deviceType === 'computer' && client.computerDevices && client.computerDevices.length > 0) || 
                            (client.showDevices && client.computerDevices && client.computerDevices.length > 0 && filters.deviceType !== 'mobile')) && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Laptop className="inline h-3 w-3 mr-1" /> اشتراكات الكمبيوتر: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.computerDevices.length}</span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.computerDevices
                                  .filter((device: any) => {
                                    // تصفية الاشتراكات حسب حالة الموافقة إذا كان الفلتر مطبق
                                    if (filters.approvalStatus === 'approved') return device.approval_status === 'approved';
                                    if (filters.approvalStatus === 'pending') return device.approval_status === 'pending' || !device.approval_status;
                                    if (filters.approvalStatus === 'rejected') return device.approval_status === 'rejected';
                                    return true;
                                  })
                                  .map((device: any, index: number) => (
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
                                        {device.price ? device.price.toLocaleString() : '0'} جنيه
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-[15%]">
                      {(() => {
                        // التعامل مع خاصية agent بشكل آمن
                        const agent = client.agent;
                        
                        if (!agent) return 'غير متاح';
                        
                        // إذا كان مصفوفة
                        if (Array.isArray(agent) && agent.length > 0) {
                          return agent[0].name || 'غير متاح';
                        }
                        
                        // إذا كان كائن
                        if (typeof agent === 'object' && agent !== null) {
                          return agent.name || 'غير متاح';
                        }
                        
                        return 'غير متاح';
                      })()}
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
                          <span className="font-bold">{client.totalPrice.toLocaleString()}</span> جنيه
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
      {!loading && totalPages > 1 && (
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
              // عرض 5 صفحات فقط مع الصفحة الحالية في المنتصف
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  onClick={() => {
                    setCurrentPage(pageNum);
                    fetchClients(activeFilter, pageNum);
                  }}
                  variant={currentPage === pageNum ? "primary" : "secondary"}
                  className={`px-4 py-2 text-sm ${currentPage === pageNum ? 'bg-primary-600 text-white' : ''}`}
                >
                  {pageNum}
                </Button>
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