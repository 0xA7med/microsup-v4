import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  Smartphone, 
  Laptop, 
  Calendar,
  User,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import Button from '../components/button';
import { APPROVAL_STATUS } from '../types/device.types';
import { useAuthStore } from '../store/authStore';

interface PendingDevice {
  id: string;
  client_id: string;
  client_name?: string;
  agent_name?: string;
  activation_code: string;
  device_type: string;
  software_version: string;
  subscription_type: string;
  subscription_start: string;
  subscription_end: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

export const PendingDevices: React.FC = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [devices, setDevices] = useState<PendingDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [processingDeviceId, setProcessingDeviceId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingDevices();
  }, [filterStatus]);

  const fetchPendingDevices = async () => {
    setLoading(true);
    try {
      console.log('Fetching devices with status:', filterStatus);
      
      // جلب الأجهزة حسب حالة الموافقة
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .eq('approval_status', filterStatus)
        .order('created_at', { ascending: false });

      if (devicesError) {
        console.error('Error fetching devices:', devicesError);
        throw devicesError;
      }

      console.log('Devices data:', devicesData);

      // جلب بيانات العملاء للأجهزة
      const clientIds = [...new Set(devicesData?.map(device => device.client_id) || [])];
      
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, client_name, agent_id')
        .in('id', clientIds);

      if (clientsError) throw clientsError;

      // جلب بيانات المناديب
      const agentIds = [...new Set(clientsData?.map(client => client.agent_id).filter(Boolean) || [])];
      
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name')
        .in('id', agentIds);

      if (agentsError) throw agentsError;

      // دمج البيانات
      const devicesWithDetails = devicesData?.map(device => {
        const client = clientsData?.find(c => c.id === device.client_id);
        const agent = agentsData?.find(a => a.id === client?.agent_id);
        
        return {
          ...device,
          client_name: client?.client_name || t('common.unknown', 'غير معروف'),
          agent_name: agent?.name || t('common.unknown', 'غير معروف')
        };
      }) || [];

      setDevices(devicesWithDetails);
    } catch (error) {
      console.error('Error fetching pending devices:', error);
      toast.error(t('errors.fetchDevices', 'حدث خطأ أثناء جلب بيانات الأجهزة'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDevice = async (deviceId: string) => {
    if (!user) {
      toast.error(t('errors.unauthorized', 'غير مصرح لك بهذه العملية'));
      return;
    }

    setProcessingDeviceId(deviceId);
    
    try {
      const { error } = await supabase
        .from('devices')
        .update({
          approval_status: 'approved',
          approval_date: new Date().toISOString(),
          approved_by: user.id
        })
        .eq('id', deviceId);

      if (error) throw error;

      toast.success(t('success.deviceApproved', 'تمت الموافقة على الجهاز بنجاح'));
      
      // تحديث القائمة
      setDevices(prevDevices => 
        filterStatus === 'pending'
          ? prevDevices.filter(d => d.id !== deviceId)
          : prevDevices.map(d => d.id === deviceId ? { ...d, approval_status: 'approved' } : d)
      );
    } catch (error) {
      console.error('Error approving device:', error);
      toast.error(t('errors.approveDevice', 'حدث خطأ أثناء الموافقة على الجهاز'));
    } finally {
      setProcessingDeviceId(null);
    }
  };

  const handleRejectClick = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleRejectDevice = async () => {
    if (!user || !selectedDeviceId) {
      toast.error(t('errors.unauthorized', 'غير مصرح لك بهذه العملية'));
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error(t('errors.rejectionReasonRequired', 'يرجى إدخال سبب الرفض'));
      return;
    }

    setProcessingDeviceId(selectedDeviceId);
    
    try {
      const { error } = await supabase
        .from('devices')
        .update({
          approval_status: 'rejected',
          approval_date: new Date().toISOString(),
          approved_by: user.id,
          rejection_reason: rejectionReason.trim()
        })
        .eq('id', selectedDeviceId);

      if (error) throw error;

      toast.success(t('success.deviceRejected', 'تم رفض الجهاز بنجاح'));
      
      // تحديث القائمة
      setDevices(prevDevices => 
        filterStatus === 'pending'
          ? prevDevices.filter(d => d.id !== selectedDeviceId)
          : prevDevices.map(d => d.id === selectedDeviceId ? { ...d, approval_status: 'rejected', rejection_reason: rejectionReason } : d)
      );
      
      setShowRejectionModal(false);
    } catch (error) {
      console.error('Error rejecting device:', error);
      toast.error(t('errors.rejectDevice', 'حدث خطأ أثناء رفض الجهاز'));
    } finally {
      setProcessingDeviceId(null);
    }
  };

  // دالة للحصول على أيقونة نوع الجهاز
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'android': return <Smartphone className="h-5 w-5 text-blue-500" />;
      case 'computer': return <Laptop className="h-5 w-5 text-indigo-500" />;
      default: return <Laptop className="h-5 w-5 text-gray-500" />;
    }
  };

  // دالة للحصول على نص نوع الجهاز
  const getDeviceTypeLabel = (deviceType: string) => {
    switch (deviceType) {
      case 'android': return t('device.types.mobile', 'موبايل');
      case 'computer': return t('device.types.computer', 'كمبيوتر');
      default: return t('device.types.unknown', 'غير معروف');
    }
  };

  // دالة للحصول على نص نوع الاشتراك
  const getSubscriptionTypeLabel = (subscriptionType: string) => {
    switch (subscriptionType) {
      case 'monthly':
        return t('subscription.monthly', 'شهري');
      case 'semi_annual':
        return t('subscription.semiAnnual', 'نصف سنوي');
      case 'annual':
        return t('subscription.annual', 'سنوي');
      case 'permanent':
        return t('subscription.permanent', 'دائم');
      default:
        return t('subscription.unknown', 'غير معروف');
    }
  };

  // دالة للحصول على أيقونة حالة الموافقة
  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  // دالة للحصول على نص حالة الموافقة
  const getApprovalStatusLabel = (status: string) => {
    const statusItem = APPROVAL_STATUS.find(s => s.value === status);
    return i18n.language === 'ar' ? statusItem?.label : statusItem?.labelEn;
  };

  // دالة للحصول على لون خلفية حالة الموافقة
  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  // تصفية الأجهزة حسب البحث
  const filteredDevices = devices.filter(device => 
    device.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.activation_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('pages.pendingDevices', 'الأجهزة المعلقة')}
      </h1>
      
      {/* أدوات البحث والتصفية */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full p-3 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder={t('actions.search', 'بحث...') as string}
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <select
              className="appearance-none w-full p-3 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
            >
              {APPROVAL_STATUS.map(status => (
                <option key={status.value} value={status.value}>
                  {i18n.language === 'ar' ? status.label : status.labelEn}
                </option>
              ))}
            </select>
            <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          </div>
          
          <Button
            variant="secondary"
            onClick={() => fetchPendingDevices()}
            className="px-4 py-3"
          >
            {t('actions.refresh', 'تحديث')}
          </Button>
        </div>
      </div>
      
      {/* عرض الأجهزة */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="text-center p-8 text-gray-500 dark:text-gray-400">
            {t('messages.noDevicesFound', 'لا توجد أجهزة للعرض')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.client', 'العميل')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.agent', 'المندوب')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.activationCode', 'رمز التفعيل')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.deviceType', 'نوع الجهاز')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.subscriptionType', 'نوع الاشتراك')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.subscriptionDates', 'تاريخ الاشتراك')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.status', 'الحالة')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('device.actions', 'الإجراءات')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 ml-2" />
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.client_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{device.agent_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <div className="text-sm text-gray-900 dark:text-white font-mono max-w-[120px] truncate">
                          {device.activation_code}
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(device.activation_code);
                            toast.success(t('common.copied', 'تم النسخ'));
                          }}
                          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title={t('actions.copy', 'نسخ') as string}
                        >
                          <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getDeviceIcon(device.device_type)}
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                          {getDeviceTypeLabel(device.device_type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {getSubscriptionTypeLabel(device.subscription_type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 ml-1" />
                          <span>
                            {format(new Date(device.subscription_start), 'dd MMM yyyy', { locale: i18n.language === 'ar' ? ar : undefined })}
                          </span>
                        </div>
                        <div className="flex items-center mt-1">
                          <Calendar className="h-4 w-4 text-gray-400 ml-1" />
                          <span>
                            {format(new Date(device.subscription_end), 'dd MMM yyyy', { locale: i18n.language === 'ar' ? ar : undefined })}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getApprovalStatusColor(device.approval_status)}`}>
                        {getApprovalStatusIcon(device.approval_status)}
                        <span className="ml-1">{getApprovalStatusLabel(device.approval_status)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {filterStatus === 'pending' && (
                        <div className="flex space-x-2 rtl:space-x-reverse">
                          <Button
                            variant="primary"
                            onClick={() => handleApproveDevice(device.id)}
                            disabled={!!processingDeviceId}
                            className="px-3 py-1.5 text-sm"
                          >
                            <CheckCircle className="h-4 w-4 ml-1.5" />
                            {t('actions.approve', 'موافقة')}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleRejectClick(device.id)}
                            disabled={!!processingDeviceId}
                            className="px-3 py-1.5 text-sm"
                          >
                            <XCircle className="h-4 w-4 ml-1.5" />
                            {t('actions.reject', 'رفض')}
                          </Button>
                        </div>
                      )}
                      {filterStatus === 'rejected' && device.rejection_reason && (
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">{t('device.rejectionReason', 'سبب الرفض')}:</span> {device.rejection_reason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة سبب الرفض */}
      {showRejectionModal && (
        <>
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[70] transition-opacity duration-150" onClick={() => setShowRejectionModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-xl p-6 space-y-5 shadow-2xl bg-white dark:bg-gray-800 z-[80]">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                <XCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('device.rejectionReason', 'سبب الرفض')}
              </h4>
            </div>
            <p className="text-base text-gray-600 dark:text-gray-300">
              {t('device.rejectionReasonDescription', 'يرجى تحديد سبب رفض هذا الجهاز. سيتم إرسال هذا السبب إلى المندوب.')}
            </p>
            <textarea
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={4}
              value={rejectionReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value as string)}
              placeholder={t('device.rejectionReasonPlaceholder', 'اكتب سبب الرفض هنا...') as string}
            />
            <div className="flex justify-end gap-3 pt-5 border-t border-gray-200 dark:border-gray-700">
              <Button 
                variant="secondary" 
                onClick={() => setShowRejectionModal(false)} 
                disabled={!!processingDeviceId}
                className="px-5 py-2.5"
              >
                <span>{t('actions.cancel', 'إلغاء')}</span>
              </Button>
              <Button 
                variant="danger" 
                onClick={handleRejectDevice} 
                disabled={!!processingDeviceId || !rejectionReason.trim()}
                className="flex items-center gap-2 px-5 py-2.5"
              >
                <XCircle className="w-5 h-5" />
                <span>{processingDeviceId ? t('actions.rejecting', 'جار الرفض...') : t('actions.confirmReject', 'تأكيد الرفض')}</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
