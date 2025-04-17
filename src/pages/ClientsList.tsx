import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { 
  Search, 
  Smartphone, 
  Laptop, 
  Eye, ChevronRight, ChevronUp, ChevronDown, ChevronLeft,
  Copy, Check, Zap, AlertCircle, Clock, Package, X 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types';
import { DeviceType } from '../types/device.types';

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [selectedClient, setSelectedClient] = useState<DisplayClientType | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [agents, setAgents] = useState<ImportedAgent[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  
  // دالة لتغيير ترتيب الجدول
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
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
    try {
      setLoading(true);
      const filter = filterOverride !== undefined ? filterOverride : activeFilter;
      const page = pageOverride !== undefined && pageOverride !== null ? pageOverride : currentPage;
      
      // حساب الإزاحة للصفحة
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // استعلام أساسي
      let query = supabase
        .from('clients')
        .select(`
          *,
          agent:agent_id(id, name),
          devices:devices(*)
        `, { count: 'exact' });
      
      // إضافة الفلتر إذا كان موجودًا
      if (filter) {
        switch(filter) {
          case 'all':
            // لا نضيف أي فلتر - عرض جميع العملاء
            break;
          case 'active':
            query = query.or(`subscription_end.gt.${new Date().toISOString()},subscription_type.eq.permanent`);
            break;
          case 'expired':
            query = query.lt('subscription_end', new Date().toISOString())
                         .not('subscription_type', 'eq', 'permanent');
            break;
          case 'expiringSoon':
            const thirtyDaysLater = new Date();
            thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
            query = query.lt('subscription_end', thirtyDaysLater.toISOString())
                         .gt('subscription_end', new Date().toISOString());
            break;
          case 'noDevices':
            // سنقوم بالفلترة بعد استلام البيانات
            break;
          default:
            // إذا كان الفلتر هو معرف وكيل
            if (filter.startsWith('agent_')) {
              const agentId = filter.replace('agent_', '');
              query = query.eq('agent_id', agentId);
            }
        }
      }
      
      // إضافة البحث إذا كان موجودًا
      if (searchTerm) {
        query = query.or(`
          client_name.ilike.%${searchTerm}%,
          organization_name.ilike.%${searchTerm}%,
          phone.ilike.%${searchTerm}%,
          phone2.ilike.%${searchTerm}%,
          address.ilike.%${searchTerm}%,
          activity_type.ilike.%${searchTerm}%
        `);
      }
      
      // إضافة الترتيب
      if (sortConfig) {
        const { key, direction } = sortConfig;
        const ascending = direction === 'ascending';
        
        // تعامل خاص مع الحقول المرتبطة
        if (key === 'agent') {
          query = query.order('agent_id', { ascending });
        } else if (key === 'deviceCount') {
          // سنقوم بالترتيب بعد استلام البيانات
        } else {
          query = query.order(key, { ascending });
        }
      } else {
        // الترتيب الافتراضي حسب تاريخ الإنشاء (الأحدث أولاً)
        query = query.order('created_at', { ascending: false });
      }
      
      // إضافة الصفحات
      query = query.range(from, to);
      
      const { data: clientsData, count, error } = await query;
      
      if (error) throw error;
      
      // معالجة البيانات المستلمة
      const processedClients = clientsData?.map(client => {
        // تقسيم الأجهزة حسب النوع
        const devices = client.devices || [];
        const mobileDevices = devices.filter((device: DeviceType) => device.device_type === 'android');
        const computerDevices = devices.filter((device: DeviceType) => device.device_type === 'computer');
        
        // حساب تاريخ انتهاء أقرب اشتراك
        let earliestEndDate: string | null = null;
        const subscriptionTypes: string[] = [];
        let totalPrice = 0;
        let mobilePrice = 0;
        let computerPrice = 0;
        
        if (devices && devices.length > 0) {
          // جمع أنواع الاشتراكات الفريدة
          devices.forEach((device: DeviceType) => {
            if (device.subscription_type && !subscriptionTypes.includes(device.subscription_type)) {
              subscriptionTypes.push(device.subscription_type);
            }
            
            // حساب السعر الإجمالي والسعر حسب نوع الجهاز
            if (device.price) {
              totalPrice += parseFloat(device.price.toString());
              if (device.device_type === 'android') {
                mobilePrice += parseFloat(device.price.toString());
              } else if (device.device_type === 'computer') {
                computerPrice += parseFloat(device.price.toString());
              }
            }
            
            // تحديد أقرب تاريخ انتهاء (باستثناء الاشتراكات الدائمة)
            if (device.subscription_end && device.subscription_type !== 'permanent') {
              if (!earliestEndDate || new Date(device.subscription_end) < new Date(earliestEndDate)) {
                earliestEndDate = device.subscription_end;
              }
            }
          });
        }
        
        return {
          ...client,
          devices,
          mobileDevices,
          computerDevices,
          deviceCount: devices.length,
          earliestEndDate,
          subscriptionTypes,
          totalPrice,
          mobilePrice,
          computerPrice,
          showDevices: false
        };
      }) || [];
      
      // تطبيق فلتر إضافي للعملاء بدون أجهزة إذا كان مطلوبًا
      let filteredProcessedClients = processedClients;
      if (filter === 'noDevices') {
        filteredProcessedClients = processedClients.filter(client => 
          !client.devices || client.devices.length === 0
        );
      }
      
      // تطبيق الترتيب على حقل عدد الأجهزة إذا كان مطلوبًا
      if (sortConfig && sortConfig.key === 'deviceCount') {
        const { direction } = sortConfig;
        filteredProcessedClients.sort((a, b) => {
          const aCount = a?.deviceCount || 0;
          const bCount = b?.deviceCount || 0;
          
          if (direction === 'ascending') {
            return aCount - bCount;
          } else {
            return bCount - aCount;
          }
        });
      }
      
      // حساب إجمالي الصفحات
      const totalItems = count || 0;
      const calculatedTotalPages = Math.ceil(totalItems / pageSize);
      
      setClients(filteredProcessedClients);
      setTotalPages(calculatedTotalPages);
      
      // إذا كانت الصفحة الحالية أكبر من إجمالي الصفحات، نعود للصفحة الأولى
      const currentPageNumber = typeof page === 'number' ? page : 1;
      if (currentPageNumber > calculatedTotalPages && calculatedTotalPages > 0) {
        setCurrentPage(1);
        if (pageOverride === undefined) {
          fetchClients(filter, 1);
          return;
        }
      }
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      toast.error('حدث خطأ أثناء جلب بيانات العملاء');
    } finally {
      setLoading(false);
    }
  };
  
  // دالة لتحميل البيانات
  const loadData = async () => {
    try {
      setLoading(true);
      
      // جلب الوكلاء
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('*')
        .order('name');
      
      if (agentsError) throw agentsError;
      
      setAgents(agentsData || []);
      
      // تحديد الفلتر النشط من عنوان URL
      const params = new URLSearchParams(location.search);
      const filterParam = params.get('filter');
      
      if (filterParam) {
        setActiveFilter(filterParam);
        await fetchClients(filterParam);
      } else {
        setActiveFilter('all');
        await fetchClients('all');
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };
  
  // تحميل البيانات عند تحميل المكون
  useEffect(() => {
    loadData();
  }, []);
  
  const handleShowDetails = (client: DisplayClientType) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };
  
  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedClient(null);
  };
  
  const handleDeleteClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) throw error;
      
      toast.success('تم حذف العميل بنجاح');
      handleCloseModal();
      fetchClients(); // إعادة تحميل البيانات
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast.error('حدث خطأ أثناء حذف العميل');
    }
  };
  
  const handleUpdateClient = async (updatedClient: ImportedClientType | DisplayClientType) => {
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
      
      toast.success('تم تحديث بيانات العميل بنجاح');
      handleCloseModal();
      fetchClients(); // إعادة تحميل البيانات
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error('حدث خطأ أثناء تحديث بيانات العميل');
    }
  };
  
  const getSubscriptionTypeLabel = (value: string) => {
    return SUBSCRIPTION_TYPES.find(type => type.value === value)?.label || value;
  };
  
  const formatDateForDisplay = (dateStr?: string | Date): string => {
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
                setActiveFilter('mobile');
                fetchClients('mobile');
              }}
              variant={activeFilter === 'mobile' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'mobile' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Smartphone className="w-3 h-3" />
              <span>{t('clientsList.mobileFilter', 'اشتراكات الهاتف')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setActiveFilter('computer');
                fetchClients('computer');
              }}
              variant={activeFilter === 'computer' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'computer' ? 'bg-primary-600 text-white' : ''}`}
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
                setActiveFilter('active');
                fetchClients('active');
              }}
              variant={activeFilter === 'active' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'active' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Zap className="w-3 h-3" />
              <span>{t('clientsList.activeFilter', 'الاشتراكات النشطة')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setActiveFilter('expired');
                fetchClients('expired');
              }}
              variant={activeFilter === 'expired' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'expired' ? 'bg-primary-600 text-white' : ''}`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>{t('clientsList.expiredFilter', 'الاشتراكات المنتهية')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setActiveFilter('expiring');
                fetchClients('expiring');
              }}
              variant={activeFilter === 'expiring' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'expiring' ? 'bg-primary-600 text-white' : ''}`}
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
                setActiveFilter('approved');
                fetchClients('approved');
              }}
              variant={activeFilter === 'approved' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'approved' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Check className="w-3 h-3" />
              <span>{t('clientsList.approvedFilter', 'الاشتراكات المقبولة')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setActiveFilter('pending');
                fetchClients('pending');
              }}
              variant={activeFilter === 'pending' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'pending' ? 'bg-primary-600 text-white' : ''}`}
            >
              <Clock className="w-3 h-3" />
              <span>{t('clientsList.pendingFilter', 'الاشتراكات المعلقة')}</span>
            </Button>
            
            <Button
              onClick={() => {
                setLoading(true);
                setActiveFilter('rejected');
                fetchClients('rejected');
              }}
              variant={activeFilter === 'rejected' ? 'primary' : 'secondary'}
              size="sm"
              className={`flex items-center gap-1 ${activeFilter === 'rejected' ? 'bg-primary-600 text-white' : ''}`}
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
              setActiveFilter('devices');
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
              setActiveFilter(null);
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                                        {device.price ? device.price.toLocaleString() : '0'} جنيه
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
                <div key={`page-${pageNum}`}>
                  <Button
                    onClick={() => {
                      setCurrentPage(pageNum);
                      fetchClients(activeFilter, pageNum);
                    }}
                    variant={currentPage === pageNum ? "primary" : "secondary"}
                    className={`px-4 py-2 text-sm ${currentPage === pageNum ? 'bg-primary-600 text-white' : ''}`}
                  >
                    {pageNum}
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