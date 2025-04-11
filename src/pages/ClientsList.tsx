import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Search, Phone, Calendar, Eye, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types';

interface ClientType extends Omit<ImportedClientType, 'address'> {
  address: string; // جعل العنوان إلزامي في واجهة العرض
  agent?: {
    name?: string;
  };
  created_by?: string;
  deviceCount?: number;
  devices?: any[];
  mobileDevices?: any[];
  computerDevices?: any[];
  earliestEndDate?: string | null;
  subscriptionTypes?: string[];
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore(); // استخدام معلومات المستخدم المسجل دخوله

  const [clients, setClients] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [agents] = useState<Agent[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // تعريف حالة الترتيب
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  // دالة لتغيير ترتيب الجدول
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // دالة لترتيب العملاء
  const sortedClients = React.useMemo(() => {
    let sortableClients = [...clients];
    if (sortConfig !== null) {
      sortableClients.sort((a: any, b: any) => {
        // التعامل مع الحالات الخاصة
        if (sortConfig.key === 'agent') {
          const aValue = a.agent?.name || '';
          const bValue = b.agent?.name || '';
          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        } else if (sortConfig.key === 'deviceCount') {
          const aValue = a.deviceCount || 0;
          const bValue = b.deviceCount || 0;
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        } else if (sortConfig.key === 'subscription_end') {
          // استخدام تاريخ انتهاء الجهاز الأقرب إذا كان متاحاً
          const aValue = a.earliestEndDate || a.subscription_end || '';
          const bValue = b.earliestEndDate || b.subscription_end || '';
          if (!aValue && !bValue) return 0;
          if (!aValue) return sortConfig.direction === 'ascending' ? 1 : -1;
          if (!bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
          return sortConfig.direction === 'ascending' 
            ? new Date(aValue).getTime() - new Date(bValue).getTime() 
            : new Date(bValue).getTime() - new Date(aValue).getTime();
        } else {
          // الترتيب العام للحقول النصية
          const aValue = a[sortConfig.key] || '';
          const bValue = b[sortConfig.key] || '';
          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        }
      });
    }
    return sortableClients;
  }, [clients, sortConfig]);

  const fetchClients = async (filterOverride?: string | null) => {
    setLoading(true);
    try {
      // استخدم الفلتر المقدم أو الفلتر النشط من حالة المكون
      const filterToApply = filterOverride !== undefined ? filterOverride : activeFilter;
      console.log('Filter will be applied after fetching data:', filterToApply);
      
      // تحديث حالة الفلتر النشط
      if (filterOverride !== undefined) {
        setActiveFilter(filterOverride);
      }
      
      // إعداد الاستعلام الأساسي
      let query = supabase
        .from('clients')
        .select(`
          id, 
          client_name, 
          organization_name, 
          phone, 
          phone2,
          address, 
          created_at,
          created_by,
          agent:agents(id, name)
        `)
        .order('created_at', { ascending: false });
      
      // تطبيق فلتر حسب الوكيل إذا كان المستخدم وكيل
      if (user?.role === 'agent') {
        query = query.eq('agent_id', user.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // تنسيق بيانات العملاء
      let formattedData = data?.map((client: any) => ({
        ...client,
        agent: client.agent ? client.agent : undefined
      })) || [];
      
      // جلب بيانات الأجهزة لكل عميل
      if (formattedData.length > 0) {
        const clientIds = formattedData.map(client => client.id);
        try {
          const { data: devicesData, error: devicesError } = await supabase
            .from('devices')
            .select('client_id, id, subscription_type, subscription_end, software_version, device_type')
            .in('client_id', clientIds);
            
          if (devicesError) {
            console.error('Error fetching devices:', devicesError);
          } else if (devicesData) {
            // تجميع الأجهزة حسب العميل
            formattedData = formattedData.map(client => {
              const clientDevices = devicesData.filter((d: any) => d.client_id === client.id) || [];
              const deviceCount = clientDevices.length;
              
              // تصنيف الأجهزة حسب النوع باستخدام حقل device_type للتوافق مع نافذة تفاصيل العميل
              const mobileDevices = clientDevices.filter((d: any) => {
                // إذا كان لدينا device_type نستخدمه
                if (d.device_type) {
                  return d.device_type.toString().toLowerCase() !== 'computer';
                }
                // إذا لم يكن لدينا device_type نستخدم software_version كبديل
                if (d.software_version) {
                  return d.software_version.toString().toLowerCase() !== 'computer';
                }
                return false;
              });
              
              // الكمبيوتر يكون فقط الأجهزة التي لها قيمة computer للتوافق مع نافذة تفاصيل العميل
              const computerDevices = clientDevices.filter((d: any) => {
                // إذا كان لدينا device_type نستخدمه
                if (d.device_type) {
                  return d.device_type.toString().toLowerCase() === 'computer';
                }
                // إذا لم يكن لدينا device_type نستخدم software_version كبديل
                if (d.software_version) {
                  return d.software_version.toString().toLowerCase() === 'computer';
                }
                return false;
              });
              
              // طباعة بيانات الأجهزة للتشخيص
              console.log(`Client ${client.client_name} devices:`);
              clientDevices.forEach((device: any) => {
                console.log(`Device: ${device.id}, Type: ${device.device_type || device.software_version}, Software: ${device.software_version}`);
              });
              
              // طباعة للتشخيص
              if (clientDevices.length > 0) {
                console.log(`Client ${client.client_name} has ${clientDevices.length} devices:`);
                clientDevices.forEach((d: any) => {
                  console.log(` - Device ID: ${d.id}, Version: ${d.software_version}`);
                });
                console.log(` - Mobile devices: ${mobileDevices.length}`);
                console.log(` - Computer devices: ${computerDevices.length}`);
              }
              
              // البحث عن أقرب تاريخ انتهاء للاشتراك
              let earliestEndDate: string | null = null;
              let subscriptionTypes = new Set<string>();
              
              clientDevices.forEach((device: any) => {
                if (device.subscription_type) {
                  subscriptionTypes.add(device.subscription_type);
                }
                
                if (device.subscription_end && (!earliestEndDate || new Date(device.subscription_end) < new Date(earliestEndDate))) {
                  earliestEndDate = device.subscription_end;
                }
              });
              
              return { 
                ...client, 
                deviceCount,
                devices: clientDevices,
                mobileDevices,
                computerDevices,
                earliestEndDate,
                subscriptionTypes: Array.from(subscriptionTypes) as string[]
              };
            });
          }
        } catch (devicesError) {
          console.error('Exception fetching devices:', devicesError);
        }
      }
      
      // تطبيق الفلاتر التي تعتمد على بيانات الأجهزة
      if (filterToApply) {
        console.log('Applying post-fetch filter:', filterToApply); // للتشخيص
        console.log('Clients before filtering:', formattedData.length); // للتشخيص
        
        const today = new Date();
        // تاريخ بعد 15 يوم من اليوم
        const in15Days = new Date();
        in15Days.setDate(in15Days.getDate() + 15);
        
        switch (filterToApply) {
          case 'devices':
            // فقط العملاء الذين لديهم أجهزة
            formattedData = formattedData.filter(client => (client.deviceCount || 0) > 0);
            break;
          case 'mobile':
            // فقط العملاء الذين لديهم أجهزة موبايل
            console.log('Applying mobile filter');
            formattedData = formattedData.filter(client => {
              // استخدام الأجهزة المصنفة مسبقًا
              const hasMobileDevices = client.mobileDevices && client.mobileDevices.length > 0;
              if (hasMobileDevices) {
                console.log(`Client ${client.client_name} has ${client.mobileDevices.length} mobile devices`);
              }
              return hasMobileDevices;
            });
            console.log('After mobile filter, clients count:', formattedData.length);
            break;
          case 'computer':
            // فقط العملاء الذين لديهم أجهزة كمبيوتر
            console.log('Applying computer filter');
            formattedData = formattedData.filter(client => {
              // استخدام الأجهزة المصنفة مسبقًا
              const hasComputerDevices = client.computerDevices && client.computerDevices.length > 0;
              if (hasComputerDevices) {
                console.log(`Client ${client.client_name} has ${client.computerDevices.length} computer devices`);
              }
              return hasComputerDevices;
            });
            console.log('After computer filter, clients count:', formattedData.length);
            break;
          case 'active':
            // فقط العملاء الذين لديهم اشتراكات نشطة
            formattedData = formattedData.filter(client => {
              // العميل نشط إذا كان لديه على الأقل جهاز واحد باشتراك نشط
              return client.devices?.some((device: any) => {
                if (device.subscription_type === 'permanent') return true;
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) > today;
              });
            });
            break;
          case 'expired':
            // فقط العملاء الذين لديهم اشتراكات منتهية
            formattedData = formattedData.filter(client => {
              // العميل لديه اشتراك منتهي إذا كان لديه على الأقل جهاز واحد باشتراك منتهي
              // وليس لديه أي اشتراك دائم
              if (client.devices?.some((device: any) => device.subscription_type === 'permanent')) {
                return false; // استبعاد العملاء الذين لديهم اشتراكات دائمة
              }
              return client.devices?.some((device: any) => {
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) < today;
              });
            });
            break;
          case 'permanent':
            // فقط العملاء الذين لديهم اشتراكات دائمة
            formattedData = formattedData.filter(client => 
              client.devices?.some((device: any) => device.subscription_type === 'permanent'));
            break;
          case 'monthly':
            // فقط العملاء الذين لديهم اشتراكات شهرية
            formattedData = formattedData.filter(client => 
              client.devices?.some((device: any) => device.subscription_type === 'monthly'));
            break;
          case 'annual':
            // فقط العملاء الذين لديهم اشتراكات سنوية
            formattedData = formattedData.filter(client => 
              client.devices?.some((device: any) => device.subscription_type === 'annual'));
            break;
          case 'expiring':
            // فقط العملاء الذين لديهم اشتراكات ستنتهي خلال 15 يوم
            formattedData = formattedData.filter(client => {
              return client.devices?.some((device: any) => {
                if (!device.subscription_end || device.subscription_type === 'permanent') return false;
                const endDate = new Date(device.subscription_end);
                return endDate > today && endDate < in15Days;
              });
            });
            break;
        }
        
        console.log('Clients after filtering:', formattedData.length); // للتشخيص
      }

      setClients(formattedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error(t('messages.errorFetchingClients', 'حدث خطأ أثناء تحميل بيانات العملاء'));
      setLoading(false);
    }
  };

  // استقبال الفلتر من الرابط أو من حالة التنقل
  useEffect(() => {
    // Get filter from URL query parameters
    const queryParams = new URLSearchParams(location.search);
    const filterParam = queryParams.get('filter');
    
    // Check for filter in location state (from dashboard navigation)
    const stateFilter = location.state?.filter;
    
    console.log('State filter:', stateFilter); // للتشخيص
    
    // تحديث حالة الفلتر بناءً على مصدر التنقل
    if (stateFilter) {
      console.log('Setting filter from state:', stateFilter);
      // أولاً: جلب البيانات مع الفلتر لتجنب أي تأخير
      fetchClients(stateFilter);
      // ثم تحديث الحالة
      setActiveFilter(stateFilter);
      // مسح الحالة لمنع إعادة تطبيق الفلتر عند التنقل
      window.history.replaceState({}, document.title);
    } else if (filterParam) {
      console.log('Setting filter from URL param:', filterParam);
      // أولاً: جلب البيانات مع الفلتر لتجنب أي تأخير
      fetchClients(filterParam);
      // ثم تحديث الحالة
      setActiveFilter(filterParam);
    } else {
      console.log('No filter found, fetching all clients');
      // جلب جميع البيانات بدون فلتر
      fetchClients(null);
      // ثم تحديث الحالة
      setActiveFilter(null);
    }
    
  }, [location.search]);

  const handleShowDetails = (client: ClientType) => {
    setSelectedClient(client);
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
      toast.success(t('messages.clientDeleted', 'تم حذف العميل بنجاح'));
      handleCloseModal();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(t('messages.errorDeletingClient', 'حدث خطأ أثناء حذف العميل'));
    }
  };

  const handleUpdateClient = async (updatedClient: ImportedClientType | ClientType) => {
    if (!updatedClient.id) return;
    
    // تحويل البيانات إلى الشكل المناسب لقاعدة البيانات
    const { agent, created_by, ...clientData } = updatedClient as ClientType;
    
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
      toast.success(t('messages.clientUpdated', 'تم تحديث بيانات العميل بنجاح'));
      handleCloseModal();
      // إعادة تحميل البيانات بعد التحديث
      fetchClients(activeFilter);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(t('messages.errorUpdatingClient', 'حدث خطأ أثناء تحديث بيانات العميل'));
    }
  };

  const getSubscriptionTypeLabel = (value: string) => {
    const type = SUBSCRIPTION_TYPES.find(t => t.value === value);
    return type ? (i18n.language === 'ar' ? type.label : type.labelEn) : value;
  };

  const formatDateForDisplay = (dateStr?: string | Date): string => {
    if (!dateStr) return t('common.notAvailable', 'غير متاح');
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(date.getTime())) {
         return t('common.invalidDate', 'تاريخ غير صالح');
      }
      if (date.getFullYear() <= 1970) {
          return t('common.notSet', 'لم يحدد');
      }
      return format(date, 'yyyy/MM/dd');
    } catch (error) {
      console.error("Error formatting date:", dateStr, error);
      return t('common.invalidDate', 'تاريخ غير صالح');
    }
  };

  const filteredClients = sortedClients.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.organization_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

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
              {activeFilter === 'devices' && t('clientsList.devicesFilter', 'جميع الأجهزة')}
              {activeFilter === 'mobile' && t('clientsList.mobileFilter', 'أجهزة الموبايل')}
              {activeFilter === 'computer' && t('clientsList.computerFilter', 'أجهزة الكمبيوتر')}
            </span>
            <button 
              onClick={() => {
                // أولاً: تحميل جميع العملاء بدون فلتر
                fetchClients(null);
                // ثانياً: تحديث حالة الفلتر النشط
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

      {/* أزرار الفلترة السريعة */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button 
          onClick={() => {
            fetchClients('active');
          }}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === 'active' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900'}`}
        >
          {t('clientsList.activeFilter', 'الاشتراكات النشطة')}
        </button>
        <button 
          onClick={() => {
            fetchClients('expired');
          }}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === 'expired' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900'}`}
        >
          {t('clientsList.expiredFilter', 'الاشتراكات المنتهية')}
        </button>
        <button 
          onClick={() => {
            fetchClients('expiring');
          }}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === 'expiring' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900'}`}
        >
          {t('clientsList.expiringFilter', 'تنتهي خلال 15 يوم')}
        </button>
        <button 
          onClick={() => {
            fetchClients('devices');
          }}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === 'devices' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900'}`}
        >
          {t('clientsList.devicesFilter', 'جميع الأجهزة')}
        </button>
        <button 
          onClick={() => {
            fetchClients('mobile');
          }}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === 'mobile' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900'}`}
        >
          {t('clientsList.mobileFilter', 'أجهزة الموبايل')}
        </button>
        <button 
          onClick={() => {
            fetchClients('computer');
          }}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${activeFilter === 'computer' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900'}`}
        >
          {t('clientsList.computerFilter', 'أجهزة الكمبيوتر')}
        </button>
      </div>
      
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder={t('clientsList.searchPlaceholder', 'ابحث بالاسم، المؤسسة، الهاتف...') as string}
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className={`w-full p-3 ${isRTL ? 'pr-10' : 'pl-10'} border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white`}
        />
        <Search className={`absolute top-1/2 transform -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} h-5 w-5 text-gray-400 dark:text-gray-500`} />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t('common.loading', 'جار التحميل...')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th 
                  scope="col" 
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700`}
                  onClick={() => requestSort('client_name')}
                >
                  {t('client.name', 'اسم العميل')}
                  {sortConfig?.key === 'client_name' && (
                    <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700`}
                  onClick={() => requestSort('organization_name')}
                >
                  {t('client.organization', 'اسم المؤسسة')}
                  {sortConfig?.key === 'organization_name' && (
                    <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700`}
                  onClick={() => requestSort('phone')}
                >
                  <Phone className="inline h-4 w-4 mr-1" /> {t('client.phone', 'الهاتف')}
                  {sortConfig?.key === 'phone' && (
                    <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700`}
                  onClick={() => requestSort('agent')}
                >
                  {t('client.agent', 'المندوب')}
                  {sortConfig?.key === 'agent' && (
                    <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700`}
                  onClick={() => requestSort('deviceCount')}
                >
                  {t('client.devices', 'الأجهزة')}
                  {sortConfig?.key === 'deviceCount' && (
                    <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700`}
                  onClick={() => requestSort('subscription_end')}
                >
                  <Calendar className="inline h-4 w-4 mr-1" /> {t('client.subscriptionEnd', 'انتهاء الاشتراك')}
                  {sortConfig?.key === 'subscription_end' && (
                    <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center">
                  {t('common.actions', 'الإجراءات')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {client.client_name}
                      {(activeFilter === 'mobile' || activeFilter === 'computer') && (
                        <div className="mt-2">
                          {activeFilter === 'mobile' && client.mobileDevices && client.mobileDevices.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">أجهزة الموبايل: <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.mobileDevices.length}</span></span>
                              <div className="mt-1 space-y-1">
                                {client.mobileDevices.map((device: any, index: number) => (
                                  <div key={index} className="flex items-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-1">
                                      {device.device_type || device.software_version || 'غير محدد'}
                                    </span>
                                    {device.subscription_type && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mr-1">
                                        {device.subscription_type === 'permanent' ? 'دائم' : 
                                         device.subscription_type === 'monthly' ? 'شهري' : 
                                         device.subscription_type === 'annual' ? 'سنوي' : device.subscription_type}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {activeFilter === 'computer' && client.computerDevices && client.computerDevices.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">أجهزة الكمبيوتر: <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.computerDevices.length}</span></span>
                              <div className="mt-1 space-y-1">
                                {client.computerDevices.map((device: any, index: number) => (
                                  <div key={index} className="flex items-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-1">
                                      {device.device_type || device.software_version || 'غير محدد'}
                                    </span>
                                    {device.subscription_type && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mr-1">
                                        {device.subscription_type === 'permanent' ? 'دائم' : 
                                         device.subscription_type === 'monthly' ? 'شهري' : 
                                         device.subscription_type === 'annual' ? 'سنوي' : device.subscription_type}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{client.organization_name}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'text-right' : 'text-left'}`} dir="ltr">{client.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.agent && client.agent.name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {client.agent.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">غير محدد</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.deviceCount && client.deviceCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          <span className="font-bold">{client.deviceCount}</span> جهاز
                        </span>
                      ) : client.subscription_type ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {getSubscriptionTypeLabel(client.subscription_type)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          لا يوجد أجهزة
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${client.earliestEndDate && new Date(client.earliestEndDate) < new Date() ? 'text-red-500 font-semibold' : client.subscription_end && new Date(client.subscription_end) < new Date() && client.subscription_type !== 'permanent' ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                      <Button
                        onClick={() => handleShowDetails(client)}
                        variant="secondary"
                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-transform hover:scale-105 p-1 rounded-md"
                        aria-label={t('actions.viewDetails', 'عرض التفاصيل') as string}
                      >
                        <Eye className="h-5 w-5" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('clientsList.noClientsFound', 'لم يتم العثور على عملاء يطابقون البحث.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
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