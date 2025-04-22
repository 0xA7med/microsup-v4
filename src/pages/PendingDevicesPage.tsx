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
import { supabase } from '../lib/supabaseClient'; // Ensure correct path
import Button from '../components/Button';      // Ensure correct path
import { useAuthStore } from '../store/authStore'; // Ensure correct path
import ClientDetailsModal from '../components/ClientDetailsModal'; // Ensure correct path

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
  price: string;
}

// Define Agent interface locally if not imported
interface Agent {
  id: string;
  name: string;
  email?: string;
}

interface PendingDevicesPageProps {
  refreshTrigger: number; // Receive refreshTrigger
}

export default function PendingDevicesPage({ refreshTrigger }: PendingDevicesPageProps) {
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
  const [selectedClient, setSelectedClient] = useState<any>(null); // Use 'any' or a proper Client type
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
      console.error('Error fetching pending device count:', error);
    }
  }, []);

  // دالة لجلب الأجهزة
  const fetchPendingDevices = useCallback(async () => {
    setLoading(true);
    try {
      console.log(`بدء جلب الأجهزة بحالة: ${filterStatus}`);
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .eq('approval_status', filterStatus)
        .order('created_at', { ascending: false });

      if (devicesError) {
        console.error('خطأ في جلب الأجهزة:', devicesError);
        throw devicesError;
      }

      console.log(`تم جلب ${devicesData?.length || 0} جهاز بحالة ${filterStatus}`);

      if (!devicesData || devicesData.length === 0) {
        setDevices([]);
        setLoading(false);
        // Ensure pending count is updated even if no devices are fetched for the current filter
        if (filterStatus === 'pending') {
           updatePendingCount();
        }
        return;
      }

      const clientIds = [...new Set(devicesData.map(device => device.client_id))];

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, client_name, created_by, agent_id')
        .in('id', clientIds);

      if (clientsError) throw clientsError;

      const agentIds = [...new Set(
        clientsData?.flatMap(client => {
          const ids: string[] = [];
          if (client.created_by) ids.push(client.created_by);
          if (client.agent_id && client.agent_id !== client.created_by) ids.push(client.agent_id);
          return ids;
        }) || []
      )];

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

      const devicesWithDetails = devicesData.map(device => {
        const client = clientsData?.find(c => c.id === device.client_id);
        const agentId = client?.agent_id || client?.created_by;
        const agent = agentsData?.find(a => a.id === agentId);

        return {
          ...device,
          client_name: client?.client_name || t('common.unknown', 'غير معروف'),
          agent_name: agent?.name || t('common.unknown', 'غير معروف'),
          agent_id: agentId
        };
      });

      setDevices(devicesWithDetails);

      if (filterStatus === 'pending') {
        updatePendingCount();
      }

    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error(t('errors.fetchDevices', 'حدث خطأ أثناء جلب بيانات الأجهزة'));
      setDevices([]); // Clear devices on error
    } finally {
      setLoading(false);
    }
  }, [filterStatus, t, updatePendingCount]);


  // Effect for initial load and filter changes
  useEffect(() => {
    fetchPendingDevices();
  }, [fetchPendingDevices, filterStatus]); // Depend only on fetch function and filterStatus

  // Effect for refresh trigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log("Refresh triggered for devices");
      fetchPendingDevices();
      // No need to call updatePendingCount here if fetchPendingDevices already does it for 'pending' status
    }
  }, [refreshTrigger, fetchPendingDevices]);

  // Effect for URL params (run only once on mount)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    if (statusParam && ['pending', 'approved', 'rejected'].includes(statusParam)) {
      setFilterStatus(statusParam);
    }
    // Fetch initial pending count on mount regardless of filter
    updatePendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means run once

  const handleApproveDevice = async (deviceId: string) => {
    if (!user) {
      toast.error(t('errors.unauthorized', 'غير مصرح لك بهذه العملية'));
      return;
    }
    setProcessingDeviceId(deviceId);
    try {
      const { error } = await supabase
        .from('devices')
        .update({ approval_status: 'approved' })
        .eq('id', deviceId);

      if (error) throw error;
      toast.success(t('success.deviceApproved', 'تم اعتماد الجهاز بنجاح'));
      await fetchPendingDevices(); // Refetch to update list and count
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
          rejection_reason: rejectionReason.trim() || t('device.defaultRejectionReason', 'تم الرفض بدون سبب محدد')
        })
        .eq('id', selectedDeviceId);

      if (error) throw error;
      toast.success(t('success.deviceRejected', 'تم رفض الجهاز بنجاح'));
      setShowRejectionModal(false);
      await fetchPendingDevices(); // Refetch to update list and count
    } catch (error) {
      console.error('Error rejecting device:', error);
      toast.error(t('errors.rejectDevice', 'حدث خطأ أثناء رفض الجهاز'));
    } finally {
      setProcessingDeviceId(null);
      setSelectedDeviceId(null);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    return deviceType === 'android' ?
      <Smartphone className="h-5 w-5 text-blue-500" /> :
      <Laptop className="h-5 w-5 text-indigo-500" />;
  };

  const getDeviceTypeLabel = (deviceType: string) => {
    return deviceType === 'android' ?
      t('device.mobile', 'اندرويد') :
      t('device.computer', 'كمبيوتر');
  };

  const getSubscriptionTypeLabel = (subscriptionType: string) => {
    switch (subscriptionType) {
      case 'monthly': return t('subscription.monthly', 'شهري');
      case 'semi_annual': return t('subscription.semiAnnual', 'نصف سنوي');
      case 'annual': return t('subscription.annual', 'سنوي');
      case 'permanent': return t('subscription.permanent', 'دائم');
      default: return subscriptionType;
    }
  };

  const handleShowClientDetails = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*') // Fetch all details needed for the modal
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
    // Filter only pending devices from the current state for approval
    const pendingDevicesToApprove = devices.filter(d => d.approval_status === 'pending');

    if (!pendingDevicesToApprove.length) {
        toast.error(t('errors.noDevices', 'لا توجد أجهزة معلقة للموافقة عليها'));
        return;
    }


    setApprovingAll(true);
    try {
      const deviceIds = pendingDevicesToApprove.map(device => device.id);
      const { error } = await supabase
        .from('devices')
        .update({ approval_status: 'approved' })
        .in('id', deviceIds);

      if (error) throw error;
      toast.success(t('success.allDevicesApproved', 'تم اعتماد جميع الأجهزة بنجاح'));
      await fetchPendingDevices(); // Refetch to update list and count
    } catch (error) {
      console.error('Error approving all devices:', error);
      toast.error(t('errors.approveAllDevices', 'حدث خطأ أثناء اعتماد جميع الأجهزة'));
    } finally {
      setApprovingAll(false);
    }
  };

  return (
    // Removed container div, assuming it's provided by RequestsManagement
    // <div className="container mx-auto px-4 py-8">
    <>
      {/* Title is now in RequestsManagement */}
      {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">...</h1> */}

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden mb-8">
        <div className="p-6">
          {/* Filters, Search, Approve All */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filterStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                onClick={() => setFilterStatus('pending')}
              >
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 ml-1" />
                  {t('device.pendingStatus', 'معلق')}
                  {pendingCount > 0 && (
                    <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs font-medium mr-1 ml-2 px-2 py-0.5 rounded">
                      {pendingCount}
                    </span>
                  )}
                </div>
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filterStatus === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                onClick={() => setFilterStatus('approved')}
              >
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 ml-1" />
                  {t('device.approvedStatus', 'معتمد')}
                </div>
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filterStatus === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                onClick={() => setFilterStatus('rejected')}
              >
                <div className="flex items-center">
                  <XCircle className="h-4 w-4 ml-1" />
                  {t('device.rejectedStatus', 'مرفوض')}
                </div>
              </button>
            </div>

            {/* Search and Approve All */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full p-2 pr-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                  placeholder={t('device.searchPlaceholder', 'بحث بالعميل, المندوب, الرمز...') as string}
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
              </div>

              {filterStatus === 'pending' && devices.some(d => d.approval_status === 'pending') && (
                <Button
                  variant="primary"
                  onClick={handleApproveAllDevices}
                  disabled={approvingAll || loading}
                  className="flex items-center justify-center gap-1 px-4 py-2 text-sm" // Added justify-center for consistency
                >
                  <CheckSquare className="h-4 w-4 ml-1" />
                  {approvingAll ? t('actions.approving', 'جاري الموافقة...') : t('actions.approveAll', 'قبول الكل')}
                </Button>
              )}
            </div>
          </div>

          {/* Table Section Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {filterStatus === 'pending' && t('device.pendingDevicesList', 'الأجهزة المعلقة')}
              {filterStatus === 'approved' && t('device.approvedDevicesList', 'الأجهزة المعتمدة')}
              {filterStatus === 'rejected' && t('device.rejectedDevicesList', 'الأجهزة المرفوضة')}
              <span className="bg-primary-100 text-primary-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-primary-900 dark:text-primary-300">
                {filteredDevices.length} {/* Show count of filtered devices */}
              </span>
            </h2>
          </div>

          {/* Table or Loading/Empty State */}
          <div className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredDevices.length === 0 ? ( // Check filteredDevices here
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                  {searchTerm ? t('common.noSearchResults', 'لا توجد نتائج بحث') : (
                    filterStatus === 'pending' ? t('device.noPendingDevices', 'لا توجد أجهزة معلقة') :
                    filterStatus === 'approved' ? t('device.noApprovedDevices', 'لا توجد أجهزة معتمدة') :
                    t('device.noRejectedDevices', 'لا توجد أجهزة مرفوضة')
                  )}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                   {searchTerm ? t('common.tryDifferentSearch', 'حاول البحث بكلمات أخرى.') : (
                    filterStatus === 'pending' ? t('device.noPendingDevicesDesc', 'ليس هناك أجهزة تنتظر المراجعة في الوقت الحالي.') :
                    filterStatus === 'approved' ? t('device.noApprovedDevicesDesc', 'لم يتم اعتماد أي أجهزة حتى الآن.') :
                    t('device.noRejectedDevicesDesc', 'لم يتم رفض أي أجهزة حتى الآن.')
                   )}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                <div dir="rtl" className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('device.deviceType', 'نوع الجهاز')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('device.clientName', 'اسم العميل')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-32">{t('device.activationCode', 'رمز التفعيل')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('device.agentName', 'المندوب')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('device.subscriptionType', 'نوع الاشتراك')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('device.price', 'السعر')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('device.subscriptionDates', 'تاريخ الاشتراك')}</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('device.actions', 'الإجراءات')}</th>
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
                                <span className="text-xs font-mono truncate max-w-[80px]" title={device.activation_code}>{device.activation_code}</span>
                                <button
                                  className="mr-1 p-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                                  title={t('device.copyActivationCode', 'نسخ رمز التفعيل')}
                                  onClick={() => copyActivationCode(device.activation_code)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">{device.agent_name || t('common.unknown', 'غير معروف')}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">{getSubscriptionTypeLabel(device.subscription_type)}</div>
                          </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                             {/* Ensure price is displayed correctly */}
                             <div className="text-sm text-gray-900 dark:text-white">{device.price || '-'}</div>
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
                              {device.client_id && ( // Conditionally render view button if client_id exists
                                <Button
                                    variant="secondary"
                                    size="sm" // Use size prop if available, otherwise use className
                                    onClick={() => handleShowClientDetails(device.client_id)}
                                    className="px-2 py-1 text-xs flex items-center gap-1" // Adjust padding/size
                                    title={t('device.viewClientDetails', 'عرض تفاصيل العميل')}
                                >
                                    <Eye className="h-3.5 w-3.5 ml-1" />
                                    {t('actions.view', 'عرض')}
                                </Button>
                              )}

                              {filterStatus === 'pending' && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleApproveDevice(device.id)}
                                    disabled={!!processingDeviceId}
                                    className="px-2 py-1 text-xs flex items-center gap-1"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 ml-1" />
                                    {processingDeviceId === device.id ? t('actions.approvingShort', 'جارٍ...') : t('actions.approve', 'موافقة')}
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleRejectClick(device.id)}
                                    disabled={!!processingDeviceId}
                                    className="px-2 py-1 text-xs flex items-center gap-1"
                                  >
                                    <XCircle className="h-3.5 w-3.5 ml-1" />
                                    {processingDeviceId === device.id ? t('actions.rejectingShort', 'جارٍ...') : t('actions.reject', 'رفض')}
                                  </Button>
                                </>
                              )}
                              {filterStatus === 'rejected' && device.rejection_reason && (
                                <div className="text-xs text-red-600 dark:text-red-400 p-1 bg-red-50 dark:bg-red-900/20 rounded max-w-[150px] truncate" title={device.rejection_reason}>
                                   <span className="font-semibold">{t('device.rejectionReasonShort', 'السبب')}:</span> {device.rejection_reason}
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
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && (
        <>
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[70] transition-opacity duration-150" onClick={() => setShowRejectionModal(false)} />
          <div dir="rtl" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-xl p-6 space-y-5 shadow-2xl bg-white dark:bg-gray-800 z-[80]">
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
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500"
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
                disabled={!!processingDeviceId}
                className="flex items-center gap-2 px-5 py-2.5"
              >
                <XCircle className="w-5 h-5" />
                <span>{processingDeviceId ? t('actions.rejecting', 'جار الرفض...') : t('actions.confirmReject', 'تأكيد الرفض')}</span>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Client Details Modal */}
      {showClientModal && selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          // Pass necessary props if ClientDetailsModal expects them
          agents={[]} // Pass actual agents if needed/available
          subscriptionTypes={[]} // Pass actual types if needed/available
          versionTypes={[]} // Pass actual types if needed/available
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          onSave={async () => { /* Implement save logic if needed */ }}
          onDelete={async () => { /* Implement delete logic if needed */}}
          currentUser={user} // Pass current user
        />
      )}
    </>
    // </div> // End of removed container div
  );
}