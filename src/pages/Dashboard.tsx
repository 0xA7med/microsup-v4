import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, ClipboardList, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import Table from '@/components/ui/Table';
import { Button } from '../components/ui/button';
import { toast } from 'react-hot-toast';
type Client = Database['public']['Tables']['clients']['Row'];

export const Dashboard: React.FC = () => { 
  const { t } = useTranslation();
  const [totalClients, setTotalClients] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [{ count: totalCount }, { count: agentsCount }, { count: activeCount }, { data: recent }, { count: expiredCount }, { data: allClients }] = await Promise.all([
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('agents').select('*', { count: 'exact', head: true }),
          supabase.from('clients').select('*', { count: 'exact', head: true }).gt('subscription_end', new Date().toISOString()),
          supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('clients').select('*', { count: 'exact', head: true }).lt('subscription_end', new Date().toISOString()),
          supabase.from('clients').select('device_count')
        ]);

        const totalDevices = allClients?.reduce((acc, client) => acc + (client.device_count || 0), 0) || 0;
        setTotalClients(totalCount || 0);
        setTotalAgents(agentsCount || 0);
        setActiveSubscriptions(activeCount || 0);
        setRecentClients(recent || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const createBackup = async () => {
    try {
      const { data } = await supabase.from('clients').select('*');
      const backupData = { timestamp: new Date().toISOString(), data };
      const { error } = await supabase.storage.from('backups').upload(`clients_${Date.now()}.json`, JSON.stringify(backupData));
      if (!error) toast.success(t('backupCreated'));
    } catch (error) {
      toast.error(t('backupFailed'));
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('nav.dashboard')}</h1>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title={t('dashboard.totalClients')} value={totalClients} icon={<Users className="h-6 w-6 text-white" />} color="bg-blue-500" />
        <StatCard title={t('dashboard.activeSubscriptions')} value={activeSubscriptions} icon={<ClipboardList className="h-6 w-6 text-white" />} color="bg-green-500" />
        <StatCard title={t('nav.agents')} value={totalAgents} icon={<UserPlus className="h-6 w-6 text-white" />} color="bg-purple-500" />
      </div>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6"><h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.recentClients')}</h2></div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <Table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('subscriptionType')}</TableHead>
                <TableHead>{t('devices')}</TableHead>
                <TableHead>{t('status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentClients.map((client) => (
                <TableRow key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <TableCell className="font-medium">{client.client_name}</TableCell>
                  <TableCell>{t(client.subscription_type || '')}</TableCell>
                  <TableCell>{client.device_count || 0}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${new Date(client.subscription_end || '') > new Date() ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {new Date(client.subscription_end || '') > new Date() ? t('active') : t('expired')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <Button onClick={createBackup} variant="secondary"><Save className="w-4 h-4 mr-2" />{t('createBackup')}</Button>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; }> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
    <div className="p-5 flex items-center">
      <div className={`flex-shrink-0 ${color} rounded-md p-3`}>{icon}</div>
      <div className="ml-4 w-0 flex-1">
        <dl>
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</dt>
          <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</dd>
        </dl>
      </div>
    </div>
  </div>
);
