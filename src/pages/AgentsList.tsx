import React, { useEffect, useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Search, Edit, Trash, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Agent = {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  clients_count?: number;
};

type AgentWithClients = Agent & {
  clients_count: number;
};

export const AgentsList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentWithClients[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AgentWithClients | null>(null);
  const [deleteOption, setDeleteOption] = useState<'transfer' | 'delete' | null>(null);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // استعلام للحصول على المندوبين من جدول agents
        const { data: agentsData, error: agentsError } = await supabase
          .from('agents')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (agentsError) {
          console.error('Error fetching agents:', agentsError);
          return;
        }

        // استعلام للحصول على عدد العملاء لكل مندوب
        const agentsWithClientsCount = await Promise.all(
          (agentsData || []).map(async (agent: Agent) => {
            const { count, error: countError } = await supabase
              .from('clients')
              .select('*', { count: 'exact', head: true })
              .eq('agent_id', agent.id);
            
            if (countError) {
              console.error(`Error fetching clients count for agent ${agent.id}:`, countError);
              return { ...agent, clients_count: 0 };
            }
            
            return { ...agent, clients_count: count || 0 };
          })
        );
        
        setAgents(agentsWithClientsCount);
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

  const handleEditClick = (agent: AgentWithClients) => {
    // التنقل إلى صفحة تعديل المندوب
    navigate(`/agents/edit/${agent.id}`);
  };

  const handleDeleteClick = async (agent: AgentWithClients) => {
    setAgentToDelete(agent);
    setShowDeleteModal(true);
    
    // إذا كان لديه عملاء، نحتاج إلى تحضير الخيارات
    if (agent.clients_count > 0) {
      // الحصول على قائمة المندوبين الآخرين للترحيل
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .neq('id', agent.id);
      
      if (error) {
        console.error('Error fetching available agents:', error);
        setAvailableAgents([]);
      } else {
        setAvailableAgents(data || []);
      }
    }
  };

  const confirmDelete = async () => {
    if (!agentToDelete) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // إذا كان لديه عملاء ويريد المستخدم ترحيلهم
      if (agentToDelete.clients_count > 0 && deleteOption === 'transfer' && targetAgentId) {
        // تحديث العملاء لتعيينهم إلى المندوب الجديد
        const { error: updateError } = await supabase
          .from('clients')
          .update({ agent_id: targetAgentId })
          .eq('agent_id', agentToDelete.id);
        
        if (updateError) {
          throw new Error(updateError.message);
        }
        
        setSuccessMessage(t('messages.clientsTransferredSuccess'));
      } 
      // إذا كان لديه عملاء ويريد المستخدم حذفهم
      else if (agentToDelete.clients_count > 0 && deleteOption === 'delete') {
        // حذف العملاء المرتبطين بالمندوب
        const { error: deleteClientsError } = await supabase
          .from('clients')
          .delete()
          .eq('agent_id', agentToDelete.id);
        
        if (deleteClientsError) {
          throw new Error(deleteClientsError.message);
        }
        
        setSuccessMessage(t('messages.clientsDeletedSuccess'));
      }
      
      // حذف المندوب من جدول agents
      const { error: deleteAgentError } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentToDelete.id);
      
      if (deleteAgentError) {
        throw new Error(deleteAgentError.message);
      }
      
      // تحديث قائمة المندوبين
      setAgents(agents.filter((a: AgentWithClients) => a.id !== agentToDelete.id));
      setSuccessMessage(t('messages.agentDeletedSuccess'));
      
      // إغلاق النافذة المنبثقة
      closeModal();
    } catch (error) {
      console.error('Error deleting agent:', error);
      setError(t('messages.errorOccurred'));
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setAgentToDelete(null);
    setDeleteOption(null);
    setTargetAgentId('');
    setError(null);
  };

  // إضافة مؤقت لإزالة رسالة النجاح بعد 3 ثوانٍ
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <X className="h-5 w-5 text-green-700" />
          </button>
        </div>
      )}
      
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
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 shadow rounded-lg">
          <thead>
            <tr>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-right text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.name')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-right text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.address')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-right text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.phone')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-right text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.role')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-right text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('agent.clientsCount')}
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 dark:border-gray-700 text-right text-xs leading-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {filteredAgents.length > 0 ? (
              filteredAgents.map((agent: AgentWithClients) => (
                <tr key={agent.id} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 font-medium text-gray-900 dark:text-white">
                    <button onClick={() => navigate(`/clients?agent_id=${agent.id}`)} className="text-primary-600 hover:text-primary-900">
                      {agent.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 text-gray-500 dark:text-gray-400">
                    {agent.address || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 text-gray-500 dark:text-gray-400">
                    {agent.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 text-gray-500 dark:text-gray-400">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        agent.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {agent.role === 'admin' ? t('agent.admin') : t('agent.agent')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 text-gray-500 dark:text-gray-400">
                    {agent.clients_count}
                  </td>
                  <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 font-medium">
                    <div className="flex items-center justify-end space-x-4">
                      <button 
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => handleEditClick(agent)}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDeleteClick(agent)}
                      >
                        <Trash className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('messages.noAgentsFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة منبثقة لتأكيد الحذف */}
      {showDeleteModal && agentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t('dialogs.deleteAgent')}
            </h3>
            
            {agentToDelete.clients_count > 0 ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('dialogs.agentHasClients')}
                </p>
                
                <div className="mb-4">
                  <div className="flex items-center mb-2">
                    <input
                      type="radio"
                      id="transfer"
                      name="deleteOption"
                      value="transfer"
                      checked={deleteOption === 'transfer'}
                      onChange={() => setDeleteOption('transfer')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <label htmlFor="transfer" className="mr-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('dialogs.transferClients')}
                    </label>
                  </div>
                  
                  {deleteOption === 'transfer' && (
                    <div className="mr-6 mt-2">
                      {availableAgents.length > 0 ? (
                        <select
                          value={targetAgentId}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => setTargetAgentId(e.target.value)}
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="">{t('dialogs.selectAgent')}</option>
                          {availableAgents.map((agent: Agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-red-500">
                          {t('dialogs.noAgentsAvailable')}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center mt-3">
                    <input
                      type="radio"
                      id="delete"
                      name="deleteOption"
                      value="delete"
                      checked={deleteOption === 'delete'}
                      onChange={() => setDeleteOption('delete')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <label htmlFor="delete" className="mr-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('dialogs.deleteClients')}
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('dialogs.deleteAgentConfirm')}
              </p>
            )}
            
            {error && (
              <div className="mb-4 text-sm text-red-500">
                {error}
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                disabled={isProcessing}
              >
                {t('actions.cancel')}
              </button>
              
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                disabled={isProcessing || (agentToDelete.clients_count > 0 && (!deleteOption || (deleteOption === 'transfer' && !targetAgentId)))}
              >
                {isProcessing ? '...' : t('actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};