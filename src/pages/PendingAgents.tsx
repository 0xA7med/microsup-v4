import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { AlertCircle, UserCheck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';

interface PendingAgent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export const PendingAgents: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [needsDbUpdate, setNeedsDbUpdate] = useState(false);

  const isAdmin = user?.role === 'admin';

  const checkApprovalStatusColumn = async () => {
    try {
      const { error } = await supabase
        .from('agents')
        .select('approval_status')
        .limit(1);
      
      if (error && error.code === '42703') {
        setNeedsDbUpdate(true);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error checking approval_status column:', err);
      return false;
    }
  };

  const fetchPendingAgents = async () => {
    setLoading(true);
    setError('');

    const columnExists = await checkApprovalStatusColumn();
    
    if (!columnExists) {
      setError(t('يجب تحديث قاعدة البيانات لإضافة عمود approval_status إلى جدول agents'));
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, email, phone, address, created_at')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPendingAgents(data || []);
    } catch (err: any) {
      console.error('Error fetching pending agents:', err);
      setError(err.message || t('حدث خطأ أثناء جلب طلبات المناديب المعلقة'));
    } finally {
      setLoading(false);
    }
  };

  const approveAgent = async (id: string) => {
    if (!isAdmin) {
      toast.error(t('فقط المديرين يمكنهم الموافقة على طلبات المناديب'));
      return;
    }

    setProcessingId(id);

    try {
      const { error } = await supabase
        .from('agents')
        .update({ approval_status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      setPendingAgents((prev) => prev.filter((agent) => agent.id !== id));
      toast.success(t('تمت الموافقة على المندوب بنجاح'));
    } catch (err: any) {
      console.error('Error approving agent:', err);
      toast.error(err.message || t('حدث خطأ أثناء الموافقة على المندوب'));
    } finally {
      setProcessingId(null);
    }
  };

  const rejectAgent = async (id: string) => {
    if (!isAdmin) {
      toast.error(t('فقط المديرين يمكنهم رفض طلبات المناديب'));
      return;
    }

    setProcessingId(id);

    try {
      const { error } = await supabase
        .from('agents')
        .update({ approval_status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      setPendingAgents((prev) => prev.filter((agent) => agent.id !== id));
      toast.success(t('تم رفض طلب المندوب بنجاح'));
    } catch (err: any) {
      console.error('Error rejecting agent:', err);
      toast.error(err.message || t('حدث خطأ أثناء رفض المندوب'));
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchPendingAgents();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{t('غير مصرح')}</h2>
        <p className="text-gray-600 text-center">
          {t('ليس لديك صلاحية للوصول إلى هذه الصفحة. فقط المديرين يمكنهم الوصول إلى إدارة طلبات المناديب.')}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('طلبات المناديب المعلقة')}</h1>
        <Button 
          type="button"
          onClick={fetchPendingAgents} 
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('تحديث')}
        </Button>
      </div>

      {needsDbUpdate && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm">
                <strong>{t('تحديث قاعدة البيانات مطلوب:')}</strong> {t('يجب إضافة عمود approval_status إلى جدول agents.')}
              </p>
              <p className="text-sm mt-2">
                {t('يرجى تنفيذ ملف SQL الموجود في مجلد supabase/migrations/add_approval_status.sql في لوحة تحكم Supabase.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : pendingAgents.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">{t('لا توجد طلبات معلقة')}</h3>
          <p className="text-gray-600">
            {t('ليس هناك طلبات تسجيل معلقة من المناديب في الوقت الحالي.')}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('الاسم')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('البريد الإلكتروني')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('رقم الهاتف')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('تاريخ الطلب')}
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('الإجراءات')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingAgents.map((agent) => (
                <tr key={agent.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{agent.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{agent.phone || t('غير متوفر')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(agent.created_at).toLocaleDateString('ar-EG')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center space-x-2 rtl:space-x-reverse">
                      <Button
                        type="button"
                        onClick={() => approveAgent(agent.id)}
                        disabled={processingId === agent.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm"
                      >
                        {processingId === agent.id ? t('جاري...') : t('موافقة')}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => rejectAgent(agent.id)}
                        disabled={processingId === agent.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm"
                      >
                        {processingId === agent.id ? t('جاري...') : t('رفض')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendingAgents;
