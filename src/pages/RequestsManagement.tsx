import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'; // Ensure correct path to your Tabs component
import { PendingAgents } from './PendingAgents';
import PendingDevicesPage from './PendingDevicesPage';
import { supabase } from '../lib/supabase'; // Ensure correct path
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore'; // Ensure correct path
import { AlertCircle } from 'lucide-react'; // Import AlertCircle for unauthorized message


const RequestsManagement: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user); // Get user from store
  const [pendingAgentsCount, setPendingAgentsCount] = useState<number>(0);
  const [pendingDevicesCount, setPendingDevicesCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("pendingDevices");
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [loadingCounts, setLoadingCounts] = useState<boolean>(true);

  const isAdmin = user?.role === 'admin'; // Check if user is admin

  // Fetch pending agents count (only if admin)
  const fetchPendingAgentsCount = useCallback(async () => {
    if (!isAdmin) {
        setPendingAgentsCount(0); // Reset count if not admin
        return;
    }
    try {
      const { count, error } = await supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending');

      if (error) throw error;
      setPendingAgentsCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending agents count:', err);
      setPendingAgentsCount(0); // Reset on error
    }
  }, [isAdmin]); // Add isAdmin dependency

  // Fetch pending devices count (accessible to admins, maybe others depending on policy)
  const fetchPendingDevicesCount = useCallback(async () => {
    // Add role check if needed for devices count too
    // if (!isAdmin) return;
    try {
      const { count, error } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending');

      if (error) throw error;
      setPendingDevicesCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending devices count:', err);
      setPendingDevicesCount(0); // Reset on error
    }
  }, []);

  // Combined function to refresh both counts
  const refreshCounts = useCallback(async () => {
    setLoadingCounts(true);
    await Promise.all([
        fetchPendingAgentsCount(),
        fetchPendingDevicesCount()
    ]);
    setLoadingCounts(false);
  }, [fetchPendingAgentsCount, fetchPendingDevicesCount]);

  // Initial fetch and setup real-time listeners
  useEffect(() => {
    refreshCounts(); // Initial fetch

    // Subscribe to device changes
    const devicesChannel = supabase
      .channel('public:devices:pending-count')
      .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'devices',
          // Filter on the server side if possible, otherwise refresh on any change
          // filter: `approval_status=eq.pending` // May require DB setup
        },
        (payload) => {
          console.log('Device change detected, refreshing counts:', payload);
          fetchPendingDevicesCount(); // Refresh only device count
        }
      )
      .subscribe((status, err) => {
           if (status === 'SUBSCRIBED') {
               console.log('Subscribed to device changes for counts');
           }
           if(err) {
               console.error("Device subscription error:", err)
           }
       });

    // Subscribe to agent changes (only if admin)
    let agentsChannel: ReturnType<typeof supabase.channel> | null = null;
    if (isAdmin) {
      agentsChannel = supabase
        .channel('public:agents:pending-count')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'agents',
            // filter: `approval_status=eq.pending`
          },
          (payload) => {
            console.log('Agent change detected, refreshing counts:', payload);
            fetchPendingAgentsCount(); // Refresh only agent count
          }
        )
        .subscribe((status, err) => {
           if (status === 'SUBSCRIBED') {
               console.log('Subscribed to agent changes for counts');
           }
            if(err) {
               console.error("Agent subscription error:", err)
           }
        });
    }

    // Optional interval refresh as a fallback
    const intervalId = setInterval(refreshCounts, 60000); // Refresh every 60 seconds

    // Cleanup function
    return () => {
      console.log('Unsubscribing from DB changes');
      if (devicesChannel) supabase.removeChannel(devicesChannel);
      if (agentsChannel) supabase.removeChannel(agentsChannel);
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]); // Rerun setup if isAdmin status changes

  // Manual refresh handler
  const handleManualRefresh = () => {
    setRefreshTrigger(prev => prev + 1); // Trigger refresh in child components
    refreshCounts(); // Refresh counts in this component
  };


   // Display unauthorized message if not admin
   if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
          <AlertCircle className="w-20 h-20 text-red-500 mb-6" />
          <h1 className="text-2xl font-bold mb-3 text-gray-800 dark:text-white">{t('common.unauthorized', 'غير مصرح')}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 text-center max-w-md">
              {t('auth.adminOnlyAccess', 'ليس لديك صلاحية للوصول إلى هذه الصفحة. فقط المديرين يمكنهم إدارة طلبات المناديب والأجهزة.')}
          </p>
          {/* Optionally add a button to go back or to login */}
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 py-8" dir="rtl"> {/* Added dir="rtl" */}
      <div className="flex items-center justify-between mb-6">
         <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
              {t('requestsManagement.title', 'إدارة الطلبات')}
          </h1>
          <button
              onClick={handleManualRefresh}
              disabled={loadingCounts}
              className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-300 py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
          >
              <RefreshCw className={`w-4 h-4 ${loadingCounts ? 'animate-spin' : ''}`} />
              {loadingCounts ? t('common.loading', 'جاري...') : t('common.refresh', 'تحديث')}
          </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Use grid-cols-2 for two tabs */}
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
          <TabsTrigger
            value="pendingDevices"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-primary-700 dark:data-[state=active]:text-primary-300 data-[state=active]:shadow-sm rounded-md py-2.5 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 relative transition-all"
          >
            {t('requestsManagement.pendingDevicesTab', 'الأجهزة المعلقة')}
            {pendingDevicesCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                {pendingDevicesCount > 99 ? '99+' : pendingDevicesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="pendingAgents"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-primary-700 dark:data-[state=active]:text-primary-300 data-[state=active]:shadow-sm rounded-md py-2.5 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 relative transition-all"
          >
            {t('requestsManagement.pendingAgentsTab', 'طلبات المناديب')}
            {pendingAgentsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                {pendingAgentsCount > 99 ? '99+' : pendingAgentsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendingDevices" className="mt-2 outline-none ring-0">
          {/* Pass refreshTrigger to PendingDevicesPage */}
          <PendingDevicesPage refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="pendingAgents" className="mt-2 outline-none ring-0">
           {/* Pass refreshTrigger to PendingAgents (optional but good for consistency) */}
           <PendingAgents refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequestsManagement;