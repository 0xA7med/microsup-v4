import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabaseClient'; // Corrected import path
import { AlertCircle, UserCheck, RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore'; // Ensure correct path
import Button from '../components/Button'; // Ensure correct path

interface PendingAgent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null; // Keep address if you want to display it
  created_at: string;
  approval_status: 'pending' | 'approved' | 'rejected'; // Added status
  // Add rejection_reason if you implement rejection reasons for agents
  // rejection_reason?: string;
}

// Props interface (optional, e.g., for refreshTrigger if needed)
interface PendingAgentsProps {
    refreshTrigger?: number; // Optional refresh trigger
}


export const PendingAgents: React.FC<PendingAgentsProps> = ({ refreshTrigger }) => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [agents, setAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Add filterStatus if you want Approved/Rejected tabs for agents too
  // const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [pendingCount, setPendingCount] = useState(0); // For consistency, though not displayed in filters here

  const isAdmin = user?.role === 'admin';

  // Simplified check - assumes column exists or focuses on fetching
  const checkDbPrerequisites = async () => {
      try {
          // Basic check to ensure connection and table access
          await supabase.from('agents').select('id').limit(1);
          return true;
      } catch (err: any) {
          console.error('Error checking agents table access:', err);
          // More specific error checking can be done here if needed
          if (err.message.includes("does not exist") || err.code === '42P01') {
              setError(t('errors.tableNotFound', 'جدول المناديب غير موجود أو لا يمكن الوصول إليه.'));
          } else if (err.message.includes("approval_status") && err.code === '42703'){
               setError(t('errors.columnNotFound', 'عمود approval_status مفقود في جدول المناديب. يرجى تحديث قاعدة البيانات.'));
          } else {
              setError(t('errors.dbConnection', 'خطأ في الاتصال بقاعدة بيانات المناديب.'));
          }
          return false;
      }
  };


  const fetchPendingAgents = useCallback(async () => {
    if (!isAdmin) return; // Should not be called if not admin, but double-check

    setLoading(true);
    setError('');

    const prerequisitesMet = await checkDbPrerequisites();
    if (!prerequisitesMet) {
        setLoading(false);
        setAgents([]); // Clear agents on error
        return;
    }

    try {
      // Fetch only pending agents for this view
      const { data, error: fetchError, count } = await supabase
        .from('agents')
        .select('*', { count: 'exact' }) // Fetch all columns for potential future use
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setAgents(data || []);
      setPendingCount(count || 0); // Update pending count

    } catch (err: any) {
      console.error('Error fetching pending agents:', err);
      setError(err.message || t('errors.fetchAgents', 'حدث خطأ أثناء جلب طلبات المناديب المعلقة'));
      setAgents([]); // Clear agents on error
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]); // Add 't' to dependencies

  const updateAgentStatus = async (id: string, status: 'approved' | 'rejected') => {
      if (!isAdmin) {
          toast.error(t('errors.unauthorized', 'غير مصرح لك بهذه العملية'));
          return;
      }
      setProcessingId(id);
      try {
          const { error } = await supabase
              .from('agents')
              .update({ approval_status: status })
              // Add rejection_reason here if implementing
              // .update({ approval_status: status, rejection_reason: status === 'rejected' ? 'Some reason' : null })
              .eq('id', id);

          if (error) throw error;

          // Refetch after update to ensure UI and counts are correct
          await fetchPendingAgents();

          toast.success(status === 'approved'
              ? t('success.agentApproved', 'تمت الموافقة على المندوب بنجاح')
              : t('success.agentRejected', 'تم رفض طلب المندوب بنجاح')
          );
      } catch (err: any) {
          console.error(`Error ${status === 'approved' ? 'approving' : 'rejecting'} agent:`, err);
          toast.error(err.message || t(`errors.${status === 'approved' ? 'approveAgent' : 'rejectAgent'}`, `حدث خطأ أثناء ${status === 'approved' ? 'الموافقة على' : 'رفض'} المندوب`));
      } finally {
          setProcessingId(null);
      }
  };


  useEffect(() => {
    if (isAdmin) {
      fetchPendingAgents();
    } else {
      setLoading(false); // Stop loading if not admin
    }
  }, [isAdmin, fetchPendingAgents]);

   // Effect for refresh trigger (if provided)
   useEffect(() => {
    if (isAdmin && refreshTrigger && refreshTrigger > 0) {
        console.log("Refresh triggered for agents");
        fetchPendingAgents();
    }
  }, [refreshTrigger, isAdmin, fetchPendingAgents]);


  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8 bg-gray-50 dark:bg-gray-800 rounded-lg shadow">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">{t('common.unauthorized', 'غير مصرح')}</h2>
        <p className="text-gray-600 dark:text-gray-400 text-center">
          {t('auth.adminOnlyAccess', 'ليس لديك صلاحية للوصول إلى هذه الصفحة. فقط المديرين يمكنهم إدارة طلبات المناديب.')}
        </p>
      </div>
    );
  }

  // Filter agents based on search term
  const filteredAgents = agents.filter(agent =>
    agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.phone?.includes(searchTerm)
  );

  return (
    // Removed container div, assuming it's provided by RequestsManagement
    <>
      {/* Title is now in RequestsManagement */}
      {/* <h1 className="text-2xl font-bold mb-6">...</h1> */}

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden mb-8">
        <div className="p-6">
          {/* Header: Search and Refresh */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white hidden sm:block">
                  {t('agent.pendingRequests', 'طلبات المناديب المعلقة')}
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-yellow-900 dark:text-yellow-300">
                      {filteredAgents.length}
                  </span>
              </h2>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                 <div className="relative">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                      type="text"
                      className="block w-full p-2 pr-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                      placeholder={t('agent.searchPlaceholder', 'بحث بالاسم, الايميل, الهاتف...') as string}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  </div>
                  <Button
                      variant="secondary" // Or another appropriate variant
                      onClick={fetchPendingAgents}
                      disabled={loading}
                      className="flex items-center justify-center gap-1 px-4 py-2 text-sm"
                  >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? t('common.loading', 'جاري التحميل...') : t('common.refresh', 'تحديث')}
                  </Button>
              </div>
          </div>

          {/* Error Message */}
          {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                  <div className="flex">
                      <div className="py-1"><AlertCircle className="h-5 w-5 text-red-500 mr-3" /></div>
                      <div>
                          <p className="font-bold">{t('common.error', 'خطأ')}</p>
                          <p className="text-sm">{error}</p>
                      </div>
                  </div>
              </div>
          )}

          {/* Table or Loading/Empty State */}
          <div className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
                <UserCheck className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                   {searchTerm ? t('common.noSearchResults', 'لا توجد نتائج بحث') : t('agent.noPendingRequests', 'لا توجد طلبات مناديب معلقة')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm ? t('common.tryDifferentSearch', 'حاول البحث بكلمات أخرى.') : t('agent.noPendingRequestsDesc', 'ليس هناك طلبات تسجيل معلقة من المناديب في الوقت الحالي.')}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                <div dir="rtl" className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('agent.name', 'الاسم')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('agent.email', 'البريد الإلكتروني')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('agent.phone', 'رقم الهاتف')}</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('agent.requestDate', 'تاريخ الطلب')}</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('common.actions', 'الإجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">{agent.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">{agent.phone || t('common.notAvailable', 'غير متوفر')}</div>
                          </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {format(new Date(agent.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => updateAgentStatus(agent.id, 'approved')}
                                disabled={processingId === agent.id}
                                className="px-2 py-1 text-xs flex items-center gap-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5 ml-1" />
                                {processingId === agent.id ? t('actions.approvingShort', 'جارٍ...') : t('actions.approve', 'موافقة')}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => updateAgentStatus(agent.id, 'rejected')}
                                disabled={processingId === agent.id}
                                className="px-2 py-1 text-xs flex items-center gap-1"
                              >
                                <XCircle className="h-3.5 w-3.5 ml-1" />
                                {processingId === agent.id ? t('actions.rejectingShort', 'جارٍ...') : t('actions.reject', 'رفض')}
                              </Button>
                              {/* Add Reject with Reason modal trigger here if needed */}
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
    </>
    // </div> // End of removed container div
  );
};

export default PendingAgents; // Keep default export if used elsewhere like this