import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Search, Edit, Trash } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Agent = {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  address: string | null;
  created_at: string;
};

export const AgentsList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // استعلام للحصول على المندوبين من جدول agents مباشرة
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching agents:', error);
          return;
        }
        
        setAgents(data || []);
      } catch (error) {
        console.error('Error fetching agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const filteredAgents = agents.filter((agent) =>
    (agent.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (agent.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t('nav.agents')}
        </h1>
        <Link
          to="/agents/add"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          {t('nav.addAgent')}
        </Link>
      </div>

      <div className="flex items-center justify-between space-x-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder={t('agent.fullName')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead>
            <tr>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-left text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.name')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-left text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.address')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-left text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.phone')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-left text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.clientsCount')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-left text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {filteredAgents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 font-medium text-gray-900 dark:text-white">
                  <button onClick={() => navigate(`/clients?agent_id=${agent.id}`)} className="text-primary-600 hover:text-primary-900">
                    {agent.name}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 text-gray-500 dark:text-gray-400">
                  {agent.address}
                </td>
                <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 text-gray-500 dark:text-gray-400">
                  {agent.phone}
                </td>
                <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 text-gray-500 dark:text-gray-400">
                  {/* Placeholder for clients count, needs implementation */}
                  0
                </td>
                <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900">
                    <Edit className="h-5 w-5" />
                  </button>
                  <button className="ml-4 text-red-600 hover:text-red-900">
                    <Trash className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};