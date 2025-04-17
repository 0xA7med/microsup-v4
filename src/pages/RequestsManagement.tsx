import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
// تصحيح المسار
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'; 
import { PendingAgents } from './PendingAgents'; // استيراد مكون المناديب
import PendingDevicesPage from './PendingDevicesPage'; // استيراد مكون الأجهزة
import { supabase } from '../lib/supabase';

const RequestsManagement: React.FC = () => {
  const { t } = useTranslation();
  const [pendingAgentsCount, setPendingAgentsCount] = useState<number>(0);
  const [pendingDevicesCount, setPendingDevicesCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("pendingDevices"); // جعل تبويب الأجهزة المعلقة هو الافتراضي
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0); // مؤشر لإعادة تحميل البيانات

  // جلب عدد طلبات المناديب المعلقة
  const fetchPendingAgentsCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      
      if (error) throw error;
      setPendingAgentsCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending agents count:', err);
    }
  }, []);

  // جلب عدد الأجهزة المعلقة
  const fetchPendingDevicesCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      
      if (error) throw error;
      setPendingDevicesCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending devices count:', err);
    }
  }, []);

  // دالة لتحديث البيانات
  const refreshCounts = useCallback(() => {
    fetchPendingAgentsCount();
    fetchPendingDevicesCount();
  }, [fetchPendingAgentsCount, fetchPendingDevicesCount]);

  // إعداد مستمع للتغييرات في قاعدة البيانات
  useEffect(() => {
    // جلب البيانات عند تحميل المكون
    refreshCounts();

    // إعداد مستمع للتغييرات في جدول الأجهزة
    const devicesSubscription = supabase
      .channel('devices-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'devices' 
      }, () => {
        console.log('Devices table changed, refreshing counts');
        refreshCounts();
      })
      .subscribe();

    // إعداد مستمع للتغييرات في جدول المناديب
    const agentsSubscription = supabase
      .channel('agents-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agents' 
      }, () => {
        console.log('Agents table changed, refreshing counts');
        refreshCounts();
      })
      .subscribe();

    // تحديث البيانات كل 30 ثانية كاحتياط إضافي
    const intervalId = setInterval(() => {
      refreshCounts();
    }, 30000);

    // تنظيف المستمعين عند إزالة المكون
    return () => {
      devicesSubscription.unsubscribe();
      agentsSubscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [refreshCounts]);

  // تحديث البيانات عند تغيير التبويب النشط
  useEffect(() => {
    refreshCounts();
  }, [activeTab, refreshCounts]);

  // دالة لتحديث البيانات يدويًا
  const handleManualRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    refreshCounts();
  };

  // تحديث البيانات عند تغيير مؤشر التحديث
  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshCounts();
    }
  }, [refreshTrigger, refreshCounts]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white flex items-center justify-between">
        <div className="flex items-center">
          {t('requestsManagement.title', 'إدارة الطلبات')}
          {/* تم إزالة عرض العدد الإجمالي من العنوان لتقليل ظهور الأرقام */}
        </div>
        <button 
          onClick={handleManualRefresh}
          className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-300 py-1 px-3 rounded-md flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('common.refresh', 'تحديث')}
        </button>
      </h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <TabsTrigger 
            value="pendingDevices" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-lg py-3 relative"
          >
            {t('requestsManagement.pendingDevicesTab', 'الأجهزة المعلقة')}
            {/* عرض العدد فقط إذا كان أكبر من صفر */}
            {pendingDevicesCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {pendingDevicesCount > 99 ? '99+' : pendingDevicesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="pendingAgents" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-lg py-3 relative"
          >
            {t('requestsManagement.pendingAgentsTab', 'طلبات المناديب')}
            {/* عرض العدد فقط إذا كان أكبر من صفر */}
            {pendingAgentsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {pendingAgentsCount > 99 ? '99+' : pendingAgentsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pendingAgents" className="mt-2">
          <PendingAgents />
        </TabsContent>
        
        <TabsContent value="pendingDevices" className="mt-2">
          <PendingDevicesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequestsManagement;
