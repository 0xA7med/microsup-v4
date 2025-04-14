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
  User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { APPROVAL_STATUS } from '../types/device.types';
import { useAuthStore } from '../store/authStore';

interface PendingDevice {
  id: string;
  client_id: string;
  client_name?: string;
  agent_name?: string;
  activation_code: string;
  device_type: string;
  subscription_type: string;
  subscription_start: string;
  subscription_end: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

export default function PendingDevicesPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
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
      // جلب الأجهزة حسب حالة الموافقة
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .eq('approval_status', filterStatus)
        .order('created_at', { ascending: false });

      if (devicesError) throw devicesError;

      // جلب بيانات العملاء للأجهزة
      const clientIds = [...new Set(devicesData?.map(device => device.client_id) || [])];
      
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, client_name, created_by')
        .in('id', clientIds);

      if (clientsError) throw clientsError;

      // جلب بيانات المناديب
      const agentIds = [...new Set(clientsData?.map(client => client.created_by).filter(Boolean) || [])];
      
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name')
        .in('id', agentIds);

      if (agentsError) throw agentsError;

      // دمج البيانات
      const devicesWithDetails = devicesData?.map(device => {
        const client = clientsData?.find(c => c.id === device.client_id);
        const agent = agentsData?.find(a => a.id === client?.created_by);
        
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

      toast.success(t('device.approvedSuccess', 'تمت الموافقة على الجهاز بنجاح'));
      
      // تحديث القائمة
      setDevices(prev => prev.filter(device => device.id !== deviceId));
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
    if (!selectedDeviceId || !user) {
      toast.error(t('errors.unauthorized', 'غير مصرح لك بهذه العملية'));
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
          rejection_reason: rejectionReason
        })
        .eq('id', selectedDeviceId);

      if (error) throw error;

      toast.success(t('device.rejectedSuccess', 'تم رفض الجهاز بنجاح'));
      
      // تحديث القائمة
      setDevices(prev => prev.filter(device => device.id !== selectedDeviceId));
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
    if (deviceType === 'computer') {
      return <Laptop className="h-5 w-5 text-blue-500 dark:text-blue-400" />;
    } else {
      return <Smartphone className="h-5 w-5 text-green-500 dark:text-green-400" />;
    }
  };

  // دالة للحصول على نص نوع الجهاز
  const getDeviceTypeLabel = (deviceType: string) => {
    if (deviceType === 'computer') {
      return t('device.computer', 'كمبيوتر');
    } else {
      return t('device.mobile', 'موبايل');
    }
  };

  // دالة للحصول على نص نوع الاشتراك
  const getSubscriptionTypeLabel = (subscriptionType: string) => {
    switch (subscriptionType) {
      case 'monthly':
        return t('subscription.monthly', 'شهري');
      case 'yearly':
        return t('subscription.yearly', 'سنوي');
      case 'permanent':
        return t('subscription.permanent', 'دائم');
      default:
        return subscriptionType;
    }
  };

  // دالة للحصول على أيقونة حالة الموافقة
  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />;
      case 'pending':
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />;
    }
  };

  // دالة للحصول على نص حالة الموافقة
  const getApprovalStatusLabel = (status: string) => {
    const statusItem = APPROVAL_STATUS.find(item => item.value === status);
    return statusItem ? (isRTL ? statusItem.label : statusItem.labelEn) : (isRTL ? 'قيد المراجعة' : 'Pending');
  };

  // دالة للحصول على لون خلفية حالة الموافقة
  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  // تصفية الأجهزة حسب البحث
  const filteredDevices = devices.filter(device => 
    device.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.activation_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {filterStatus === 'pending' 
          ? t('device.pendingDevices', 'الأجهزة قيد المراجعة') 
          : filterStatus === 'approved' 
            ? t('device.approvedDevices', 'الأجهزة المعتمدة')
            : t('device.rejectedDevices', 'الأجهزة المرفوضة')
        }
      </h1>

      {/* فلاتر وبحث */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder={t('common.search', 'بحث') as string}
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('common.status', 'الحالة')}:
            </span>
            <select
              className="block w-full md:w-auto pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
            >
              <option value="pending">{t('status.pending', 'قيد المراجعة')}</option>
              <option value="approved">{t('status.approved', 'تمت الموافقة')}</option>
              <option value="rejected">{t('status.rejected', 'مرفوض')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* جدول الأجهزة */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex justify-center mb-4">
              {filterStatus === 'pending' ? (
                <AlertCircle className="h-16 w-16 text-yellow-500" />
              ) : filterStatus === 'approved' ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {filterStatus === 'pending' 
                ? t('device.noPendingDevices', 'لا توجد أجهزة قيد المراجعة') 
                : filterStatus === 'approved' 
                  ? t('device.noApprovedDevices', 'لا توجد أجهزة معتمدة')
                  : t('device.noRejectedDevices', 'لا توجد أجهزة مرفوضة')
              }
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {filterStatus === 'pending' 
                ? t('device.allDevicesReviewed', 'تمت مراجعة جميع الأجهزة') 
                : filterStatus === 'approved' 
                  ? t('device.noApprovedDevicesYet', 'لم يتم اعتماد أي جهاز بعد')
                  : t('device.noRejectedDevicesYet', 'لم يتم رفض أي جهاز بعد')
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('client.name', 'اسم العميل')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('agent.name', 'اسم المندوب')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('device.deviceType', 'نوع الجهاز')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('device.activationCode', 'رمز التفعيل')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('device.subscriptionType', 'نوع الاشتراك')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('device.createdAt', 'تاريخ الإضافة')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.actions', 'الإجراءات')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {device.client_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-2" />
                        <span className="text-gray-700 dark:text-gray-300">{device.agent_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getDeviceIcon(device.device_type)}
                        <span className="mr-2 text-gray-700 dark:text-gray-300">{getDeviceTypeLabel(device.device_type)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                        {device.activation_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {getSubscriptionTypeLabel(device.subscription_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-2" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {format(new Date(device.created_at), 'dd/MM/yyyy', { locale: ar })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {filterStatus === 'pending' && (
                        <div className="flex justify-center space-x-2 rtl:space-x-reverse">
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
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
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
}
