import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Users, ClipboardList, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

import type { Database } from '../types/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [totalClients, setTotalClients] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState(0);
  const [averageDevices, setAverageDevices] = useState(0);
  const [renewalRate, setRenewalRate] = useState(0);
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch total clients
        const { count: totalCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });

        // Fetch total agents
        const { count: agentsCount } = await supabase
          .from('agents')
          .select('*', { count: 'exact', head: true });

        // Fetch active subscriptions
        const { count: activeCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .gt('subscription_end', new Date().toISOString());

        // Fetch recent clients
        const { data: recent } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch expired count for statistics
        const { count: expiredCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .lt('subscription_end', new Date().toISOString());

        // Fetch device data
        const { data: allClients } = await supabase
          .from('clients')
          .select('device_count');

        const totalDevices = allClients?.reduce((acc, client) => acc + (client.device_count || 0), 0) || 0;

        setTotalClients(totalCount || 0);
        setTotalAgents(agentsCount || 0);
        setActiveSubscriptions(activeCount || 0);
        setRecentClients(recent || []);
        setExpiredSubscriptions(expiredCount || 0);
        
        if (totalCount && totalCount > 0) {
          setAverageDevices(Math.round(totalDevices / totalCount));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error(t('error.fetchingData'));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

if (loading) {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}

return (
  <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
      {t('nav.dashboard')}
    </h1>

    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.totalClients')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {totalClients}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('dashboard.activeSubscriptions')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {activeSubscriptions}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div className="mr-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {t('nav.agents')}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {totalAgents}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          {t('dashboard.recentClients')}
        </h2>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentClients.length > 0 ? (
            recentClients.map((client) => (
              <li key={client.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary-600 truncate">
                      {client.client_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {client.organization_name}
                    </p>
                  </div>
                  <div className="mr-4 flex-shrink-0">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        new Date(client.subscription_end || '') > new Date()
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {client.subscription_type}
                    </span>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
              لا يوجد عملاء حتى الآن
            </li>
          )}
        </ul>
      </div>
    </div>
  </div>
);
};