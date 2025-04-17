import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  Smartphone, 
  Laptop, 
  Calendar,
  Copy,
  Eye,
  CheckSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import Button from '../components/Button';
import { useAuthStore } from '../store/authStore';
import ClientDetailsModal from '../components/ClientDetailsModal';

interface PendingDevice {
  id: string;
  client_id: string;
  client_name?: string;
  agent_name?: string;
  agent_id?: string;
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
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [devices, setDevices] = useState<PendingDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [processingDeviceId, setProcessingDeviceId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // دالة لتحديث عدد الطلبات المعلقة
  const updatePendingCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      
      if (error) throw error;
      setPendingCount(count || 0);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  }, []);

  // دالة لجلب الأجهزة المعلقة
  const fetchPendingDevices = useCallback(async () => {
    setLoading(true);
    try {
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .eq('approval_status', filterStatus)
        .order('created_at', { ascending: false });

      if (devicesError) throw devicesError;

      const clientIds = [...new Set(devicesData?.map(device => device.client_id) || [])];
      
      // تحسين استعلام العملاء للحصول على بيانات أكثر
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, client_name, created_by, agent_id')
        .in('id', clientIds);

      if (clientsError) throw clientsError;

      // جمع معرفات المندوبين من حقلي created_by و agent_id (إذا كان موجودًا)
      const agentIds = [...new Set(
        clientsData?.flatMap(client => {
          const ids: string[] = [];
          if (client.created_by) ids.push(client.created_by);
          if (client.agent_id && client.agent_id !== client.created_by) ids.push(client.agent_id);
          return ids;
        }) || []
      )];
      
      // تحسين استعلام المندوبين
      interface Agent {
        id: string;
        name: string;
        email?: string;
      }
      
      let agentsData: Agent[] = [];
      if (agentIds.length > 0) {
        const { data, error: agentsError } = await supabase
          .from('agents')
          .select('id, name, email')
          .in('id', agentIds);

        if (agentsError) {
          console.error('Error fetching agents:', agentsError);
        } else {
          agentsData = data || [];
        }
      }

      console.log("Agents data:", agentsData);

      const devicesWithDetails = devicesData?.map(device => {
        const client = clientsData?.find(c => c.id === device.client_id);
        
        // البحث عن المندوب باستخدام agent_id أو created_by
        const agentId = client?.agent_id || client?.created_by;
        const agent = agentsData?.find(a => a.id === agentId);
        
        console.log(`Device ${device.id} - Client: ${client?.client_name}, Agent ID: ${agentId}, Agent: ${agent?.name}`);
        
        return {
          ...device,
          client_name: client?.client_name || t('common.unknown', 'غير معروف'),
          agent_name: agent?.name || t('common.unknown', 'غير معروف'),
          agent_id: agentId
        };
      }) || [];

      console.log("Devices with details:", devicesWithDetails);
      setDevices(devicesWithDetails);
      
      // تحديث عدد الطلبات المعلقة إذا كان الفلتر هو 'pending'
      if (filterStatus === 'pending') {
        updatePendingCount();
      }
    } catch (error) {
      console.error('Error fetching pending devices:', error);
      toast.error(t('errors.fetchDevices', 'حدث خطأ أثناء جلب بيانات الأجهزة'));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, t, updatePendingCount]);

  useEffect(() => {
    fetchPendingDevices();
    updatePendingCount();
  }, [fetchPendingDevices, updatePendingCount, filterStatus]);

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
          approved_by: user.id
        })
        .eq('id', deviceId);

      if (error) throw error;

      toast.success(t('success.deviceApproved', 'تم اعتماد الجهاز بنجاح'));
      fetchPendingDevices();
      updatePendingCount();
    } catch (error) {
      console.error('Error approving device:', error);
      toast.error(t('errors.approveDevice', 'حدث خطأ أثناء اعتماد الجهاز'));
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

    setProcessingDeviceId(selectedDeviceId);
    
    try {
      const { error } = await supabase
        .from('devices')
        .update({ 
          approval_status: 'rejected',
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim()
        })
        .eq('id', selectedDeviceId);

      if (error) throw error;

      toast.success(t('success.deviceRejected', 'تم رفض الجهاز بنجاح'));
      setShowRejectionModal(false);
      fetchPendingDevices();
    } catch (error) {
      console.error('Error rejecting device:', error);
      toast.error(t('errors.rejectDevice', 'حدث خطأ أثناء رفض الجهاز'));
    } finally {
      setProcessingDeviceId(null);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    return deviceType === 'android' ? 
      <Smartphone className="h-5 w-5 text-blue-500" /> : 
      <Laptop className="h-5 w-5 text-indigo-500" />;
  };

  const getDeviceTypeLabel = (deviceType: string) => {
    return deviceType === 'android' ? 
      t('device.mobile', 'موبايل') : 
      t('device.computer', 'كمبيوتر');
  };

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
        return subscriptionType;
    }
  };

  const handleShowClientDetails = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;

      if (data) {
        setSelectedClient(data);
        setShowClientModal(true);
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
      toast.error(t('errors.fetchClientDetails', 'حدث خطأ أثناء جلب بيانات العميل'));
    }
  };

  const copyActivationCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => toast.success(t('success.codeCopied', 'تم نسخ كود التفعيل')))
      .catch(() => toast.error(t('errors.copyCode', 'حدث خطأ أثناء نسخ الكود')));
  };

  const filteredDevices = devices.filter(device => 
    device.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.activation_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApproveAllDevices = async () => {
    if (!user) {
      toast.error(t('errors.unauthorized', 'غير مصرح لك بهذه العملية'));
      return;
    }

    if (!devices.length) {
      toast.error(t('errors.noDevices', 'لا توجد أجهزة معلقة للموافقة عليها'));
      return;
    }

    setApprovingAll(true);
    try {
      const deviceIds = devices.map(device => device.id);
      const { error } = await supabase
        .from('devices')
        .update({ 
          approval_status: 'approved',
          approved_by: user.id
        })
        .in('id', deviceIds);

      if (error) throw error;

      toast.success(t('success.allDevicesApproved', 'تم اعتماد جميع الأجهزة بنجاح'));
      fetchPendingDevices();
      updatePendingCount();
    } catch (error) {
      console.error('Error approving all devices:', error);
      toast.error(t('errors.approveAllDevices', 'حدث خطأ أثناء اعتماد جميع الأجهزة'));
    } finally {
      setApprovingAll(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('device.pendingDevicesTitle', 'إدارة الأجهزة')}
        {/* تم إزالة عرض العدد هنا لتقليل ظهور الأرقام */}
      </h1>
      
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden mb-8">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                onClick={() => setFilterStatus('pending')}
              >
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 ml-1" />
                  {t('device.pendingStatus', 'معلق')}
                  {/* عرض العدد فقط في مكان واحد وهو زر التصفية */}
                  {pendingCount > 0 && (
                    <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs font-medium mr-1 ml-2 px-2 py-0.5 rounded">
                      {pendingCount}
                    </span>
                  )}
                </div>
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filterStatus === 'approved'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                onClick={() => setFilterStatus('approved')}
              >
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 ml-1" />
                  {t('device.approvedStatus', 'معتمد')}
                </div>
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filterStatus === 'rejected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                onClick={() => setFilterStatus('rejected')}
              >
                <div className="flex items-center">
                  <XCircle className="h-4 w-4 ml-1" />
                  {t('device.rejectedStatus', 'مرفوض')}
                </div>
              </button>
            </div>
            
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full p-2 pr-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                  placeholder={t('device.searchPlaceholder', 'بحث...') as string}
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {filterStatus === 'pending' && devices.length > 0 && (
                <Button
                  variant="primary"
                  onClick={handleApproveAllDevices}
                  disabled={approvingAll || loading}
                  className="flex items-center gap-1 px-4 py-2"
                >
                  <CheckSquare className="h-5 w-5 ml-1" />
                  {approvingAll ? t('actions.approving', 'جاري الموافقة...') : t('actions.approveAll', 'قبول الكل')}
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {filterStatus === 'pending' && t('device.pendingDevicesList', 'الأجهزة المعلقة')}
              {filterStatus === 'approved' && t('device.approvedDevicesList', 'الأجهزة المعتمدة')}
              {filterStatus === 'rejected' && t('device.rejectedDevicesList', 'الأجهزة المرفوضة')}
              <span className="bg-primary-100 text-primary-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-primary-900 dark:text-primary-300">
                {filteredDevices.length}
              </span>
            </h2>
          </div>

          <div className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : devices.length === 0 ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                  {filterStatus === 'pending' && t('device.noPendingDevices', 'لا توجد أجهزة معلقة')}
                  {filterStatus === 'approved' && t('device.noApprovedDevices', 'لا توجد أجهزة معتمدة')}
                  {filterStatus === 'rejected' && t('device.noRejectedDevices', 'لا توجد أجهزة مرفوضة')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {filterStatus === 'pending' && t('device.noPendingDevicesDesc', 'ليس هناك أجهزة تنتظر المراجعة في الوقت الحالي.')}
                  {filterStatus === 'approved' && t('device.noApprovedDevicesDesc', 'لم يتم اعتماد أي أجهزة حتى الآن.')}
                  {filterStatus === 'rejected' && t('device.noRejectedDevicesDesc', 'لم يتم رفض أي أجهزة حتى الآن.')}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                <div dir="rtl" className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t('device.deviceType', 'نوع الجهاز')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t('device.clientName', 'اسم العميل')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-32">
                          {t('device.activationCode', 'رمز التفعيل')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t('device.agentName', 'المندوب')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t('device.subscriptionType', 'نوع الاشتراك')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t('device.subscriptionDates', 'تاريخ الاشتراك')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t('device.actions', 'الإجراءات')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredDevices.map((device) => (
                        <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="ml-2">{getDeviceIcon(device.device_type)}</span>
                              <span className="text-sm text-gray-900 dark:text-white">{getDeviceTypeLabel(device.device_type)}</span>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{device.client_name}</div>
                          </td>
                          
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-32">
                            <div className="flex items-center justify-between p-1 rounded bg-green-50 dark:bg-green-900/20">
                              <div className="flex items-center">
                                <div className="flex items-center">
                                  <span className="text-xs font-mono truncate max-w-[80px]" title={device.activation_code}>
                                    {device.activation_code}
                                  </span>
                                  <button
                                    className="mr-1 p-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                                    title={t('device.copyActivationCode', 'نسخ رمز التفعيل')}
                                    onClick={() => copyActivationCode(device.activation_code)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {device.agent_name || t('common.unknown', 'غير معروف')}
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">{getSubscriptionTypeLabel(device.subscription_type)}</div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 ml-1 text-gray-400 dark:text-gray-500" />
                                <span>{format(new Date(device.subscription_start), 'dd/MM/yyyy', { locale: ar })}</span>
                              </div>
                              <div className="flex items-center mt-1">
                                <Calendar className="h-4 w-4 ml-1 text-gray-400 dark:text-gray-500" />
                                <span>{format(new Date(device.subscription_end), 'dd/MM/yyyy', { locale: ar })}</span>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => handleShowClientDetails(device.client_id)}
                                className="px-3 py-1.5 text-sm flex items-center gap-1"
                                title={t('device.viewClientDetails', 'عرض تفاصيل العميل')}
                              >
                                <Eye className="h-4 w-4 ml-1" />
                                {t('actions.view', 'عرض')}
                              </Button>
                              
                              {filterStatus === 'pending' && (
                                <>
                                  <Button
                                    variant="primary"
                                    onClick={() => handleApproveDevice(device.id)}
                                    disabled={!!processingDeviceId}
                                    className="px-3 py-1.5 text-sm flex items-center gap-1"
                                  >
                                    <CheckCircle className="h-4 w-4 ml-1" />
                                    {t('actions.approve', 'موافقة')}
                                  </Button>
                                  <Button
                                    variant="danger"
                                    onClick={() => handleRejectClick(device.id)}
                                    disabled={!!processingDeviceId}
                                    className="px-3 py-1.5 text-sm flex items-center gap-1"
                                  >
                                    <XCircle className="h-4 w-4 ml-1" />
                                    {t('actions.reject', 'رفض')}
                                  </Button>
                                </>
                              )}
                              {filterStatus === 'rejected' && device.rejection_reason && (
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  <span className="font-semibold">{t('device.rejectionReason', 'سبب الرفض')}:</span> {device.rejection_reason}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

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

          {showClientModal && selectedClient && (
            <ClientDetailsModal
              client={selectedClient}
              agents={[]}
              subscriptionTypes={[]}
              versionTypes={[]}
              isOpen={showClientModal}
              onClose={() => setShowClientModal(false)}
              onSave={async () => {}}
              onDelete={async () => {}}
              currentUser={user}
            />
          )}
        </div>
      </div>
    </div>
  );
}
