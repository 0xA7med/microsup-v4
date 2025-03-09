import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, Grid, List as ListIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client } from '../types/database.types';

export const ClientsList: React.FC = () => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });
        
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

  const renderClientRow = (client: Client) => (
    <div key={client.id} className="flex items-center justify-between p-4 border-b border-gray-200">
      <div className="flex-1">
        <p className="text-lg font-semibold">{client.client_name}</p>
        <p className="text-sm text-gray-500">{client.phone}</p>
      </div>
      <div className="flex-1">
        <p className="text-sm">{client.subscription_type}</p>
        <p className="text-sm text-gray-500">{client.agent_name}</p>
      </div>
      <div className="flex-1">
        <p className="text-sm">{client.subscription_start}</p>
        <p className="text-sm text-gray-500">{client.subscription_end}</p>
      </div>
      <button onClick={() => openClientDetails(client)} className="text-blue-500 hover:underline">{t('actions.viewDetails', 'عرض التفاصيل')}</button>
    </div>
  );

  const openClientDetails = (client: Client) => {
    setSelectedClient(client);
  };

  const closeClientDetails = () => {
    setSelectedClient(null);
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      // toast.success(t('messages.clientDeletedSuccess', 'تم حذف العميل بنجاح'));
      setClients(clients.filter(client => client.id !== clientId));
      closeClientDetails();
    } catch (error) {
      // toast.error(t('messages.errorOccurred', 'حدث خطأ، يرجى المحاولة مرة أخرى'));
    }
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    try {
      const { error } = await supabase.from('clients').update(updatedClient).eq('id', updatedClient.id);
      if (error) throw error;
      // toast.success(t('messages.clientUpdatedSuccess', 'تم تحديث بيانات العميل بنجاح'));
      setClients(clients.map(client => client.id === updatedClient.id ? updatedClient : client));
      closeClientDetails();
    } catch (error) {
      // toast.error(t('messages.errorOccurred', 'حدث خطأ، يرجى المحاولة مرة أخرى'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{t('nav.clients', 'قائمة العملاء')}</h1>
        <Link to="/add-client" className="text-blue-500 hover:underline flex items-center">
          <PlusCircle className="h-5 w-5 mr-2" />
          {t('nav.addClient', 'إضافة عميل')}
        </Link>
      </div>
      <input
        type="text"
        placeholder={t('actions.search', 'بحث')}
        value={searchTerm}
        onChange={handleSearch}
        className="w-full p-2 mb-4 border border-gray-300 rounded-md"
      />
      <div className="bg-white shadow rounded-md">
        {filteredClients.map(renderClientRow)}
      </div>

      {selectedClient && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-md shadow-md w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{selectedClient.client_name}</h2>
            <p>{t('client.phone', 'رقم الهاتف')}: {selectedClient.phone}</p>
            <p>{t('client.subscriptionType', 'نوع الاشتراك')}: {selectedClient.subscription_type}</p>
            <p>{t('client.subscriptionStart', 'تاريخ بداية الاشتراك')}: {selectedClient.subscription_start}</p>
            <p>{t('client.subscriptionEnd', 'تاريخ نهاية الاشتراك')}: {selectedClient.subscription_end}</p>
            <div className="flex justify-end mt-4">
              <button onClick={closeClientDetails} className="text-gray-500 hover:underline mr-4">{t('actions.cancel', 'إلغاء')}</button>
              <button onClick={() => handleDeleteClient(selectedClient.id)} className="text-red-500 hover:underline mr-4">{t('actions.delete', 'حذف')}</button>
              <button onClick={() => handleUpdateClient(selectedClient)} className="text-blue-500 hover:underline">{t('actions.edit', 'تعديل')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};