import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Check, X, AlertCircle, UserCheck, UserX, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

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

  // التحقق من أن المستخدم هو مدير
  const isAdmin = user?.role === 'admin';

  // جلب المناديب المعلقين
  const fetchPendingAgents = async () => {
    setLoading(true);
    setError('');

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
      setError(err.message || 'حدث خطأ أثناء جلب طلبات المناديب المعلقة');
    } finally {
      setLoading(false);
    }
  };

  // الموافقة على طلب مندوب
  const approveAgent = async (id: string) => {
    if (!isAdmin) {
      toast.error('فقط المديرين يمكنهم الموافقة على طلبات المناديب');
      return;
    }

    setProcessingId(id);

    try {
      // تحديث حالة المندوب إلى "موافق عليه"
      const { error } = await supabase
        .from('agents')
        .update({ approval_status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      // تحديث القائمة
      setPendingAgents((prev) => prev.filter((agent) => agent.id !== id));
      toast.success('تمت الموافقة على المندوب بنجاح');
    } catch (err: any) {
      console.error('Error approving agent:', err);
      toast.error(err.message || 'حدث خطأ أثناء الموافقة على المندوب');
    } finally {
      setProcessingId(null);
    }
  };

  // رفض طلب مندوب
  const rejectAgent = async (id: string) => {
    if (!isAdmin) {
      toast.error('فقط المديرين يمكنهم رفض طلبات المناديب');
      return;
    }

    setProcessingId(id);

    try {
      // تحديث حالة المندوب إلى "مرفوض"
      const { error } = await supabase
        .from('agents')
        .update({ approval_status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      // تحديث القائمة
      setPendingAgents((prev) => prev.filter((agent) => agent.id !== id));
      toast.success('تم رفض طلب المندوب بنجاح');
    } catch (err: any) {
      console.error('Error rejecting agent:', err);
      toast.error(err.message || 'حدث خطأ أثناء رفض طلب المندوب');
    } finally {
      setProcessingId(null);
    }
  };

  // جلب المناديب المعلقين عند تحميل الصفحة
  useEffect(() => {
    fetchPendingAgents();
  }, []);

  // التحقق من صلاحيات المستخدم
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
          <h2 className="text-lg font-medium text-red-800 dark:text-red-300 flex items-center">
            <AlertCircle className="w-5 h-5 ml-2" />
            خطأ في الصلاحيات
          </h2>
          <p className="mt-2 text-red-700 dark:text-red-400">
            عذراً، هذه الصفحة متاحة فقط للمديرين.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          طلبات تسجيل المناديب المعلقة
        </h1>
        <button
          onClick={fetchPendingAgents}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 ml-2" />
          تحديث
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg mb-6">
          <div className="flex items-center text-red-800 dark:text-red-300">
            <AlertCircle className="w-5 h-5 ml-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>
      ) : pendingAgents.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            لا توجد طلبات تسجيل معلقة حالياً
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الاسم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  البريد الإلكتروني
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  رقم الهاتف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  تاريخ الطلب
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {pendingAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {agent.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {agent.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {agent.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(agent.created_at).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2 space-x-reverse">
                      <button
                        onClick={() => approveAgent(agent.id)}
                        disabled={processingId === agent.id}
                        className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-700/20 dark:text-green-400 dark:hover:bg-green-700/30 p-2 rounded-full transition-colors"
                        title="الموافقة على الطلب"
                      >
                        {processingId === agent.id ? (
                          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <UserCheck className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => rejectAgent(agent.id)}
                        disabled={processingId === agent.id}
                        className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-700/20 dark:text-red-400 dark:hover:bg-red-700/30 p-2 rounded-full transition-colors"
                        title="رفض الطلب"
                      >
                        {processingId === agent.id ? (
                          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <UserX className="w-5 h-5" />
                        )}
                      </button>
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
