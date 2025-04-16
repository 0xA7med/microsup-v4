import React, { useState, useEffect } from 'react';
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

  // جلب عدد طلبات المناديب المعلقة
  const fetchPendingAgentsCount = async () => {
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
  };

  // جلب عدد الأجهزة المعلقة
  const fetchPendingDevicesCount = async () => {
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
  };

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    fetchPendingAgentsCount();
    fetchPendingDevicesCount();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
        {t('requestsManagement.title', 'إدارة الطلبات')}
        {(pendingAgentsCount > 0 || pendingDevicesCount > 0) && (
          <span className="mr-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {pendingAgentsCount + pendingDevicesCount}
          </span>
        )}
      </h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <TabsTrigger 
            value="pendingDevices" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-lg py-3 relative"
          >
            {t('requestsManagement.pendingDevicesTab', 'الأجهزة المعلقة')}
            {pendingDevicesCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {pendingDevicesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="pendingAgents" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-lg py-3 relative"
          >
            {t('requestsManagement.pendingAgentsTab', 'طلبات المناديب')}
            {pendingAgentsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {pendingAgentsCount}
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
