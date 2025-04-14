import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { 
  Search, 
  Smartphone, 
  Laptop, 
  Calendar, Eye, ChevronRight, ChevronUp, ChevronDown, 
  Copy, Check, Zap, AlertCircle, Clock, Package, X 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types';
import { DeviceType, APPROVAL_STATUS } from '../types/device.types';

interface ClientType extends Omit<ImportedClientType, 'address'> {
  address: string; // جعل العنوان إلزامي في واجهة العرض
  agent?: {
    id?: any;
    name?: string;
  };
  created_by?: string;
  deviceCount?: number;
  devices?: any[];
  mobileDevices?: any[];
  computerDevices?: any[];
  earliestEndDate?: string | null;
  subscriptionTypes?: string[];
  totalPrice?: number; // إجمالي القيمة المدفوعة
  mobilePrice?: number; // إجمالي قيمة أجهزة الموبايل
  computerPrice?: number; // إجمالي قيمة أجهزة الكمبيوتر
  showDevices?: boolean; // إظهار الأجهزة لهذا العميل
  agents?: Agent[]; // إضافة خاصية agents
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

  // دالة لتبديل حالة إظهار الأجهزة لعميل معين
  const toggleShowDevices = (clientId: string) => {
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId ? { ...client, showDevices: !client.showDevices } : client
      )
    );
  };

  // دالة لترتيب العملاء
  const sortedClients = React.useMemo(() => {
    let sortableClients = [...clients];
    if (sortConfig !== null) {
      sortableClients.sort((a: any, b: any) => {
        // التعامل مع الحالات الخاصة
        if (sortConfig.key === 'agent') {
          const aValue = a.agent?.length > 0 && a.agent[0]?.name || '';
          const bValue = b.agent?.length > 0 && b.agent[0]?.name || '';
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

  // تعريف دالة البحث المحسنة
  const filterClients = useCallback(() => {
    if (!clients) return [];
    
    return clients.filter((client) => {
      const searchTermLower = searchTerm.toLowerCase();
      
      // البحث في الاسم والمؤسسة والهاتف والملاحظات
      return (
        (client.client_name && client.client_name.toLowerCase().includes(searchTermLower)) ||
        (client.organization_name && client.organization_name.toLowerCase().includes(searchTermLower)) ||
        (client.phone && client.phone.toLowerCase().includes(searchTermLower)) ||
        (client.notes && client.notes.toLowerCase().includes(searchTermLower))
      );
    });
  }, [clients, searchTerm]);

  // دالة جلب العملاء مع تطبيق الفلتر
  const fetchClients = async (filterOverride?: string | null) => {
    setLoading(true);
    const filter = filterOverride !== undefined ? filterOverride : activeFilter;
    setActiveFilter(filter);
    
    try {
      // إعداد الاستعلام الأساسي
      let query = supabase
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
          agents(id, name)
        `);
      
      // تطبيق فلتر حسب الوكيل إذا كان المستخدم وكيل
      if (user?.role === 'agent') {
        query = query.eq('agent_id', user.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // فحص بنية البيانات المسترجعة
      console.log('Client data structure:', data && data.length > 0 ? data[0] : 'No data');
      
      // جلب بيانات الأجهزة لكل عميل
      const clientsWithDevices = await Promise.all((data || []).map(async (client) => {
        const { data: devicesData, error: devicesError } = await supabase
          .from('devices')
          .select('*')
          .eq('client_id', client.id);
        
        if (devicesError) {
          console.error('Error fetching devices for client:', devicesError);
          return {
            ...client,
            devices: [],
            mobileDevices: [],
            computerDevices: []
          };
        }
        
        // تصنيف الأجهزة حسب النوع
        const mobileDevices = devicesData?.filter(device => device.device_type !== 'computer') || [];
        const computerDevices = devicesData?.filter(device => device.device_type === 'computer') || [];
        
        // حساب إجمالي القيمة
        const totalPrice = devicesData?.reduce((sum, device) => sum + (parseFloat(device.price) || 0), 0) || 0;
        const mobilePrice = mobileDevices.reduce((sum, device) => sum + (parseFloat(device.price) || 0), 0);
        const computerPrice = computerDevices.reduce((sum, device) => sum + (parseFloat(device.price) || 0), 0);
        
        // تحويل بيانات المندوب إلى الصيغة المطلوبة
        let agent = null;
        if (client.agents) {
          // فحص إذا كان agents مصفوفة
          if (Array.isArray(client.agents) && client.agents.length > 0) {
            agent = {
              id: client.agents[0].id,
              name: client.agents[0].name
            };
          } else if (client.agents.id) {
            // إذا كان كائن مفرد
            agent = {
              id: client.agents.id,
              name: client.agents.name
            };
          }
        }
        
        // البحث عن أقرب تاريخ انتهاء
        let earliestEndDate = null;
        if (devicesData && devicesData.length > 0) {
          const nonPermanentDevices = devicesData.filter(device => 
            device.subscription_type !== 'permanent' && device.subscription_end
          );
          
          if (nonPermanentDevices.length > 0) {
            earliestEndDate = nonPermanentDevices.reduce((earliest, device) => {
              if (!earliest) return device.subscription_end;
              return new Date(device.subscription_end) < new Date(earliest) ? device.subscription_end : earliest;
            }, null);
          }
        }
        
        // جمع أنواع الاشتراكات الفريدة
        const subscriptionTypes = [...new Set(devicesData?.map(device => device.subscription_type) || [])];
        
        return {
          ...client,
          devices: devicesData || [],
          mobileDevices,
          computerDevices,
          deviceCount: devicesData?.length || 0,
          earliestEndDate,
          subscriptionTypes,
          totalPrice,
          mobilePrice,
          computerPrice,
          agent: agent ? [agent] : null,
          showDevices: false
        };
      }));
      
      let formattedData = clientsWithDevices;
      
      // تطبيق الفلتر المحدد
      if (filter) {
        const today = new Date();
        
        switch (filter) {
          case 'active':
            // فقط العملاء الذين لديهم اشتراكات نشطة (مع استثناء الأجهزة المرفوضة والمعلقة)
            formattedData = formattedData.filter(client => {
              // العميل نشط إذا كان لديه على الأقل جهاز واحد نشط ومقبول
              return client.devices?.some((device: any) => {
                // استثناء الأجهزة المرفوضة والمعلقة
                if (device.approval_status !== 'approved') return false;
                
                if (device.subscription_type === 'permanent') return true;
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) > today;
              });
            });
            // إظهار الأجهزة تحت كل عميل
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              mobileDevices: client.mobileDevices?.filter((device: any) => {
                if (device.approval_status !== 'approved') return false;
                if (device.subscription_type === 'permanent') return true;
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) > today;
              }) || [],
              computerDevices: client.computerDevices?.filter((device: any) => {
                if (device.approval_status !== 'approved') return false;
                if (device.subscription_type === 'permanent') return true;
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) > today;
              }) || []
            }));
            break;
          case 'expired':
            // فقط العملاء الذين لديهم اشتراكات منتهية (مع استثناء الأجهزة المرفوضة والمعلقة)
            formattedData = formattedData.filter(client => {
              // العميل لديه اشتراك منتهي إذا كان لديه على الأقل جهاز واحد باشتراك منتهي ومقبول
              // وليس لديه أي اشتراك دائم
              if (client.devices?.some((device: any) => device.subscription_type === 'permanent' && device.approval_status === 'approved')) {
                return false; // استبعاد العملاء الذين لديهم اشتراكات دائمة مقبولة
              }
              return client.devices?.some((device: any) => {
                // استثناء الأجهزة المرفوضة والمعلقة
                if (device.approval_status !== 'approved') return false;
                
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) < today;
              });
            });
            // إظهار الأجهزة تحت كل عميل
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              mobileDevices: client.mobileDevices?.filter((device: any) => {
                if (device.approval_status !== 'approved') return false;
                if (device.subscription_type === 'permanent') return false;
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) < today;
              }) || [],
              computerDevices: client.computerDevices?.filter((device: any) => {
                if (device.approval_status !== 'approved') return false;
                if (device.subscription_type === 'permanent') return false;
                if (!device.subscription_end) return false;
                return new Date(device.subscription_end) < today;
              }) || []
            }));
            break;
          case 'mobile':
            // فقط العملاء الذين لديهم أجهزة موبايل (مع استثناء الأجهزة المرفوضة والمعلقة)
            console.log('Applying mobile filter');
            formattedData = formattedData.filter(client => {
              // استخدام الأجهزة المصنفة مسبقًا مع استثناء المرفوضة والمعلقة
              return client.mobileDevices?.some((device: any) => device.approval_status === 'approved');
            });
            // إظهار الأجهزة تحت كل عميل
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              computerDevices: [], // إخفاء أجهزة الكمبيوتر
              mobileDevices: client.mobileDevices?.filter((device: any) => device.approval_status === 'approved') || []
            }));
            break;
          case 'computer':
            // فقط العملاء الذين لديهم أجهزة كمبيوتر (مع استثناء الأجهزة المرفوضة والمعلقة)
            formattedData = formattedData.filter(client => {
              // استخدام الأجهزة المصنفة مسبقًا مع استثناء المرفوضة والمعلقة
              return client.computerDevices?.some((device: any) => device.approval_status === 'approved');
            });
            // إظهار الأجهزة تحت كل عميل
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              mobileDevices: [], // إخفاء أجهزة الموبايل
              computerDevices: client.computerDevices?.filter((device: any) => device.approval_status === 'approved') || []
            }));
            break;
          case 'approved':
            // فقط العملاء الذين لديهم أجهزة مقبولة
            formattedData = formattedData.filter(client => {
              return client.devices?.some((device: any) => device.approval_status === 'approved');
            });
            // إظهار الأجهزة المقبولة فقط
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              mobileDevices: client.mobileDevices?.filter((device: any) => device.approval_status === 'approved') || [],
              computerDevices: client.computerDevices?.filter((device: any) => device.approval_status === 'approved') || []
            }));
            break;
          case 'pending':
            // فقط العملاء الذين لديهم أجهزة معلقة
            formattedData = formattedData.filter(client => {
              return client.devices?.some((device: any) => device.approval_status === 'pending');
            });
            // إظهار الأجهزة المعلقة فقط
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              mobileDevices: client.mobileDevices?.filter((device: any) => device.approval_status === 'pending') || [],
              computerDevices: client.computerDevices?.filter((device: any) => device.approval_status === 'pending') || []
            }));
            break;
          case 'rejected':
            // فقط العملاء الذين لديهم أجهزة مرفوضة
            formattedData = formattedData.filter(client => {
              return client.devices?.some((device: any) => device.approval_status === 'rejected');
            });
            // إظهار الأجهزة المرفوضة فقط
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              mobileDevices: client.mobileDevices?.filter((device: any) => device.approval_status === 'rejected') || [],
              computerDevices: client.computerDevices?.filter((device: any) => device.approval_status === 'rejected') || []
            }));
            break;
          case 'expiring_soon':
            // العملاء الذين لديهم اشتراكات تنتهي خلال 15 يوم
            const twoWeeksFromNow = new Date();
            twoWeeksFromNow.setDate(today.getDate() + 15);
            
            formattedData = formattedData.filter(client => {
              return client.devices?.some((device: any) => {
                // استثناء الأجهزة المرفوضة والمعلقة والدائمة
                if (device.approval_status !== 'approved' || device.subscription_type === 'permanent') return false;
                
                if (!device.subscription_end) return false;
                const endDate = new Date(device.subscription_end);
                return endDate > today && endDate <= twoWeeksFromNow;
              });
            });
            // إظهار الأجهزة التي تنتهي قريبًا فقط
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true,
              mobileDevices: client.mobileDevices?.filter((device: any) => {
                if (device.approval_status !== 'approved' || device.subscription_type === 'permanent') return false;
                if (!device.subscription_end) return false;
                const endDate = new Date(device.subscription_end);
                return endDate > today && endDate <= twoWeeksFromNow;
              }) || [],
              computerDevices: client.computerDevices?.filter((device: any) => {
                if (device.approval_status !== 'approved' || device.subscription_type === 'permanent') return false;
                if (!device.subscription_end) return false;
                const endDate = new Date(device.subscription_end);
                return endDate > today && endDate <= twoWeeksFromNow;
              }) || []
            }));
            break;
          case 'devices':
            // عرض جميع الأجهزة
            formattedData = formattedData.map(client => ({
              ...client,
              agent: client.agents,
              devices: client.devices || [],
              mobileDevices: client.mobileDevices || [],
              computerDevices: client.computerDevices || [],
              deviceCount: client.deviceCount || 0,
              earliestEndDate: client.earliestEndDate,
              subscriptionTypes: client.subscriptionTypes || [],
              totalPrice: client.totalPrice || 0,
              mobilePrice: client.mobilePrice || 0,
              computerPrice: client.computerPrice || 0,
              showDevices: true // إظهار جميع الأجهزة
            }));
            break;
          default:
            // عرض جميع الأجهزة بدون فلترة
            formattedData = formattedData.map(client => ({
              ...client,
              showDevices: true // إظهار جميع الأجهزة
            }));
            break;
        }
      }
      
      setClients(formattedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error(t('messages.errorFetchingClients', 'حدث خطأ أثناء تحميل بيانات العملاء'));
      setLoading(false);
    }
  };

  // تأثير لتحميل العملاء عند تغيير الفلتر النشط
  useEffect(() => {
    fetchClients(activeFilter);
  }, [activeFilter]);

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
    const { agents, created_by, ...clientData } = updatedClient as ClientType;
    
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
              {activeFilter === 'active' && t('clientsList.activeFilter', 'الأجهزة النشطة')}
              {activeFilter === 'expired' && t('clientsList.expiredFilter', 'الأجهزة المنتهية')}
              {activeFilter === 'permanent' && t('clientsList.permanentFilter', 'التراخيص الدائمة')}
              {activeFilter === 'monthly' && t('clientsList.monthlyFilter', 'الاشتراكات الشهرية')}
              {activeFilter === 'annual' && t('clientsList.annualFilter', 'الاشتراكات السنوية')}
              {activeFilter === 'expiring' && t('clientsList.expiringFilter', 'تنتهي خلال 15 يوم')}
              {activeFilter === 'devices' && t('clientsList.devicesFilter', 'جميع الأجهزة')}
              {activeFilter === 'mobile' && t('clientsList.mobileFilter', 'أجهزة الموبايل')}
              {activeFilter === 'computer' && t('clientsList.computerFilter', 'أجهزة الكمبيوتر')}
              {activeFilter === 'approved' && t('clientsList.approvedFilter', 'الأجهزة المقبولة')}
              {activeFilter === 'pending' && t('clientsList.pendingFilter', 'الأجهزة المعلقة')}
              {activeFilter === 'rejected' && t('clientsList.rejectedFilter', 'الأجهزة المرفوضة')}
            </span>
            <button 
              onClick={() => {
                // أولاً: تحميل جميع العملاء بدون فلتر
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

      {/* أزرار الفلترة السريعة */}
      <div className="mb-6 flex flex-wrap gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl shadow-sm">
        {/* جميع الأجهزة */}
        <Button
          onClick={() => fetchClients('devices')}
          variant={activeFilter === 'devices' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'devices' ? 'bg-primary-600 text-white' : ''}`}
        >
          <Package className="w-4 h-4" />
          {t('clientsList.allDevices', 'جميع الأجهزة')}
        </Button>
        
        {/* الأجهزة النشطة */}
        <Button
          onClick={() => fetchClients('active')}
          variant={activeFilter === 'active' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'active' ? 'bg-primary-600 text-white' : ''}`}
        >
          <Zap className="w-4 h-4" />
          {t('clientsList.activeFilter', 'الأجهزة النشطة')}
        </Button>
        
        {/* الأجهزة المنتهية */}
        <Button
          onClick={() => fetchClients('expired')}
          variant={activeFilter === 'expired' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'expired' ? 'bg-primary-600 text-white' : ''}`}
        >
          <AlertCircle className="w-4 h-4" />
          {t('clientsList.expiredFilter', 'الأجهزة المنتهية')}
        </Button>
        
        {/* تنتهي خلال 15 يوم */}
        <Button
          onClick={() => fetchClients('expiring_soon')}
          variant={activeFilter === 'expiring_soon' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'expiring_soon' ? 'bg-primary-600 text-white' : ''}`}
        >
          <Clock className="w-4 h-4" />
          {t('clientsList.expiringSoonFilter', 'تنتهي خلال 15 يوم')}
        </Button>
        
        {/* أجهزة الموبايل */}
        <Button
          onClick={() => fetchClients('mobile')}
          variant={activeFilter === 'mobile' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'mobile' ? 'bg-primary-600 text-white' : ''}`}
        >
          <Smartphone className="w-4 h-4" />
          {t('clientsList.mobileFilter', 'أجهزة الموبايل')}
        </Button>
        
        {/* أجهزة الكمبيوتر */}
        <Button
          onClick={() => fetchClients('computer')}
          variant={activeFilter === 'computer' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'computer' ? 'bg-primary-600 text-white' : ''}`}
        >
          <Laptop className="w-4 h-4" />
          {t('clientsList.computerFilter', 'أجهزة الكمبيوتر')}
        </Button>
        
        {/* الأجهزة المقبولة */}
        <Button
          onClick={() => fetchClients('approved')}
          variant={activeFilter === 'approved' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'approved' ? 'bg-primary-600 text-white' : ''}`}
        >
          <Check className="w-4 h-4" />
          {t('clientsList.approvedFilter', 'الأجهزة المقبولة')}
        </Button>
        
        {/* الأجهزة المعلقة */}
        <Button
          onClick={() => fetchClients('pending')}
          variant={activeFilter === 'pending' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'pending' ? 'bg-primary-600 text-white' : ''}`}
        >
          <Clock className="w-4 h-4" />
          {t('clientsList.pendingFilter', 'الأجهزة المعلقة')}
        </Button>
        
        {/* الأجهزة المرفوضة */}
        <Button
          onClick={() => fetchClients('rejected')}
          variant={activeFilter === 'rejected' ? 'primary' : 'secondary'}
          className={`flex items-center gap-2 ${activeFilter === 'rejected' ? 'bg-primary-600 text-white' : ''}`}
        >
          <X className="w-4 h-4" />
          {t('clientsList.rejectedFilter', 'الأجهزة المرفوضة')}
        </Button>
      </div>
      
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="ابحث بالاسم، المؤسسة، الهاتف، الملاحظات..."
          className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
                  الأجهزة
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
              {filterClients().length > 0 ? (
                filterClients().map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-[20%] md:w-[25%]">
                      {client.client_name}
                      {((activeFilter === 'mobile' || activeFilter === 'computer') || client.showDevices) && (
                        <div className="mt-2">
                          {/* عرض أجهزة الموبايل */}
                          {/* عرض أجهزة الموبايل فقط إذا كان الفلتر هو موبايل أو إذا كان العميل يعرض جميع الأجهزة وليس الفلتر كمبيوتر */}
                          {((activeFilter === 'mobile' && client.mobileDevices && client.mobileDevices.length > 0) || 
                            (client.showDevices && client.mobileDevices && client.mobileDevices.length > 0 && activeFilter !== 'computer')) && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Smartphone className="inline h-3 w-3 mr-1" /> أجهزة الموبايل: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.mobileDevices.length}</span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.mobileDevices
                                  .filter((device: any) => {
                                    // تصفية الأجهزة حسب حالة الموافقة إذا كان الفلتر مطبق
                                    if (activeFilter === 'approved') return device.approval_status === 'approved';
                                    if (activeFilter === 'pending') return device.approval_status === 'pending' || !device.approval_status;
                                    if (activeFilter === 'rejected') return device.approval_status === 'rejected';
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
                          
                          {/* عرض أجهزة الكمبيوتر */}
                          {/* عرض أجهزة الكمبيوتر فقط إذا كان الفلتر هو كمبيوتر أو إذا كان العميل يعرض جميع الأجهزة وليس الفلتر موبايل */}
                          {((activeFilter === 'computer' && client.computerDevices && client.computerDevices.length > 0) || 
                            (client.showDevices && client.computerDevices && client.computerDevices.length > 0 && activeFilter !== 'mobile')) && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-primary-600 dark:text-primary-400">
                                <Laptop className="inline h-3 w-3 mr-1" /> أجهزة الكمبيوتر: 
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">{client.computerDevices.length}</span>
                              </span>
                              <div className="mt-1 space-y-1">
                                {client.computerDevices
                                  .filter((device: any) => {
                                    // تصفية الأجهزة حسب حالة الموافقة إذا كان الفلتر مطبق
                                    if (activeFilter === 'approved') return device.approval_status === 'approved';
                                    if (activeFilter === 'pending') return device.approval_status === 'pending' || !device.approval_status;
                                    if (activeFilter === 'rejected') return device.approval_status === 'rejected';
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
                      {client.agent && client.agent.length > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {client.agent[0].name}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">غير محدد</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.deviceCount && client.deviceCount > 0 ? (
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              <span className="font-bold">{client.deviceCount}</span> جهاز
                            </span>
                            
                            {/* مؤشرات حالة الأجهزة */}
                            {client.mobileDevices && client.computerDevices && (
                              <div className="flex items-center gap-2 mr-1">
                                {/* الأجهزة المقبولة */}
                                {(() => {
                                  const approvedCount = [...client.mobileDevices, ...client.computerDevices].filter(device => device.approval_status === 'approved').length;
                                  return approvedCount > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                                      <span className="text-xs">{approvedCount}</span>
                                    </div>
                                  ) : null;
                                })()}
                                
                                {/* الأجهزة قيد المراجعة */}
                                {(() => {
                                  const pendingCount = [...client.mobileDevices, ...client.computerDevices].filter(device => device.approval_status === 'pending' || !device.approval_status).length;
                                  return pendingCount > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex h-3 w-3 rounded-full bg-yellow-500"></span>
                                      <span className="text-xs">{pendingCount}</span>
                                    </div>
                                  ) : null;
                                })()}
                                
                                {/* الأجهزة المرفوضة */}
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
                          لا يوجد أجهزة
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
                            aria-label={client.showDevices ? t('actions.hideDevices', 'إخفاء الأجهزة') : t('actions.showDevices', 'عرض الأجهزة') as string}
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