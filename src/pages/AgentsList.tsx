import { useEffect, useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Edit, Trash, X, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AgentWithClients | null>(null);
  const [agentToEdit, setAgentToEdit] = useState<AgentWithClients | null>(null);
  const [deleteOption, setDeleteOption] = useState<'transfer' | 'delete' | null>(null);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // استعلام للحصول على المندوبين من جدول agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (agentsError) {
        console.error('Error fetching agents:', agentsError);
        toast.error(t('messages.errorFetchingAgents', 'حدث خطأ أثناء تحميل بيانات المناديب'));
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
      toast.error(t('messages.errorFetchingAgents', 'حدث خطأ أثناء تحميل بيانات المناديب'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const filteredAgents = agents.filter((agent) =>
    (agent.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (agent.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (agent: AgentWithClients) => {
    // فتح نافذة منبثقة لتعديل بيانات المندوب
    setAgentToEdit(agent);
    setShowEditModal(true);
  };
  
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setAgentToEdit(null);
  };
  
  const handleUpdateAgent = async (updatedAgent: Agent) => {
    try {
      setIsProcessing(true);
      
      const { error } = await supabase
        .from('agents')
        .update({
          name: updatedAgent.name,
          email: updatedAgent.email,
          phone: updatedAgent.phone,
          address: updatedAgent.address,
          role: updatedAgent.role
        })
        .eq('id', updatedAgent.id);
      
      if (error) throw error;
      
      setSuccessMessage(t('messages.agentUpdated', 'تم تحديث بيانات المندوب بنجاح'));
      setShowEditModal(false);
      setAgentToEdit(null);
      fetchAgents(); // إعادة تحميل بيانات المناديب
    } catch (error) {
      console.error('Error updating agent:', error);
      setError(t('messages.errorUpdatingAgent', 'حدث خطأ أثناء تحديث بيانات المندوب'));
    } finally {
      setIsProcessing(false);
    }
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



  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
      {successMessage && (
        <div className="mb-6 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg relative" role="alert">
          <span className="block sm:inline">{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="absolute top-0 bottom-0 left-0 px-4 py-3"
          >
            <X className="h-5 w-5 text-green-700 dark:text-green-400" />
          </button>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('nav.agents', 'قائمة المناديب')}</h1>
        
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            <span>{t('common.backToDashboard', 'العودة للوحة التحكم')}</span>
            <ChevronRight className="h-5 w-5 mr-1" />
          </button>
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 right-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 mr-3" />
        </div>
        <input
          type="text"
          placeholder={t('agent.fullName', 'البحث عن مناديب...')}
          className="pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading', 'جاري التحميل...')}</p>
        </div>
      ) : (
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
                  <td className="px-6 py-4 whitespace-no-wrap text-sm leading-5 font-medium text-center">
                    <div className="flex items-center justify-center space-x-3 space-x-reverse">
                      <button 
                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-transform hover:scale-105 p-1 rounded-md"
                        onClick={() => handleEditClick(agent)}
                        aria-label={t('actions.edit', 'تعديل') as string}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-transform hover:scale-105 p-1 rounded-md"
                        onClick={() => handleDeleteClick(agent)}
                        aria-label={t('actions.delete', 'حذف') as string}
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
      )}

      {/* نافذة منبثقة لتعديل المندوب */}
      {showEditModal && agentToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('agent.editAgent', 'تعديل بيانات المندوب')}
              </h3>
              <button onClick={handleCloseEditModal} className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            
            <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              if (agentToEdit) {
                handleUpdateAgent(agentToEdit);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('agent.name', 'اسم المندوب')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={agentToEdit.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentToEdit({...agentToEdit, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('agent.email', 'البريد الإلكتروني')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={agentToEdit.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentToEdit({...agentToEdit, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('agent.phone', 'رقم الهاتف')}
                  </label>
                  <input
                    type="text"
                    id="phone"
                    value={agentToEdit.phone || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentToEdit({...agentToEdit, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('agent.address', 'العنوان')}
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={agentToEdit.address || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentToEdit({...agentToEdit, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('agent.role', 'الدور')}
                  </label>
                  <select
                    id="role"
                    value={agentToEdit.role}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgentToEdit({...agentToEdit, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="agent">{t('agent.agent', 'مندوب')}</option>
                    <option value="admin">{t('agent.admin', 'مدير')}</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 space-x-reverse mt-6">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {t('actions.cancel', 'إلغاء')}
                </button>
                
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-1"></span>
                      {t('common.processing', 'جاري المعالجة...')}
                    </span>
                  ) : t('actions.save', 'حفظ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-white sm:text-sm"
                        >
                          <option value="">{t('dialogs.selectAgent', 'اختر مندوب')}</option>
                          {availableAgents.map((agent: Agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-red-500 dark:text-red-400">
                          {t('dialogs.noAgentsAvailable', 'لا يوجد مناديب آخرين متاحين')}
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
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                    />
                    <label htmlFor="delete" className="mr-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('dialogs.deleteClients', 'حذف العملاء')}
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {t('dialogs.deleteAgentConfirm', `هل أنت متأكد من حذف المندوب ${agentToDelete.name}؟`)}
              </p>
            )}
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
                {successMessage}
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                disabled={isProcessing}
              >
                {t('actions.cancel', 'إلغاء')}
              </button>
              
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                disabled={isProcessing || (agentToDelete.clients_count > 0 && (!deleteOption || (deleteOption === 'transfer' && !targetAgentId)))}
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-1"></span>
                    {t('common.processing', 'جاري المعالجة...')}
                  </span>
                ) : t('actions.delete', 'حذف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};