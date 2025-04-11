import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { Edit, Trash2, Plus, Clipboard, Calendar, Smartphone, Laptop } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import { DeviceType, DEVICE_TYPES } from '../types/device.types';
import DeviceModal from './DeviceModal';
import { supabase } from '../lib/supabase';

interface DevicesListProps {
  devices: DeviceType[];
  clientId: string;
  onDeviceUpdated: () => void;
  versionTypes: { value: string; label: string; labelEn: string }[];
  currentUser?: {
    id: string;
    role: string;
  } | null;
}

export default function DevicesList({
  devices,
  clientId,
  onDeviceUpdated,
  versionTypes,
  currentUser
}: DevicesListProps) {
  const { t, i18n } = useTranslation();
  const [selectedDevice, setSelectedDevice] = useState<DeviceType | null>(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddDevice = () => {
    setSelectedDevice(null);
    setShowDeviceModal(true);
  };

  const handleEditDevice = (device: DeviceType) => {
    setSelectedDevice(device);
    setShowDeviceModal(true);
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm(t('device.confirmDelete', 'هل أنت متأكد من رغبتك في حذف هذا الجهاز؟'))) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast.success(t('messages.deviceDeleted', 'تم حذف الجهاز بنجاح'));
      onDeviceUpdated();
    } catch (error) {
      console.error('Error deleting device:', error);
      toast.error(t('messages.errorDeletingDevice', 'حدث خطأ أثناء حذف الجهاز'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveDevice = async (deviceData: DeviceType) => {
    try {
      if (selectedDevice?.id) {
        // تحديث جهاز موجود
        const { error } = await supabase
          .from('devices')
          .update(deviceData)
          .eq('id', selectedDevice.id);

        if (error) throw error;
        toast.success(t('messages.deviceUpdated', 'تم تحديث بيانات الجهاز بنجاح'));
      } else {
        // إضافة جهاز جديد
        const { error } = await supabase
          .from('devices')
          .insert([deviceData]);

        if (error) throw error;
        toast.success(t('messages.deviceAdded', 'تم إضافة الجهاز بنجاح'));
      }

      onDeviceUpdated();
    } catch (error) {
      console.error('Error saving device:', error);
      throw error;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch (error) {
      return dateStr;
    }
  };

  const copyActivationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('messages.codeCopied', 'تم نسخ رمز التفعيل'));
  };

  const getDeviceTypeLabel = (value: string) => {
    const deviceType = DEVICE_TYPES.find(type => type.value === value);
    return deviceType ? (i18n.language === 'ar' ? deviceType.label : deviceType.labelEn) : value;
  };

  const getSubscriptionTypeLabel = (value: string | undefined) => {
    if (!value) return '';
    switch(value) {
      case 'monthly': return i18n.language === 'ar' ? 'شهري' : 'Monthly';
      case 'yearly': return i18n.language === 'ar' ? 'سنوي' : 'Yearly';
      case 'quarterly': return i18n.language === 'ar' ? 'ربع سنوي' : 'Quarterly';
      case 'half_yearly': return i18n.language === 'ar' ? 'نصف سنوي' : 'Half Yearly';
      default: return value;
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    return deviceType === 'computer' ? (
      <Laptop className="h-5 w-5 text-blue-500" />
    ) : (
      <Smartphone className="h-5 w-5 text-green-500" />
    );
  };

  const isSubscriptionExpired = (endDate: string) => {
    try {
      return new Date(endDate) < new Date();
    } catch (error) {
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({devices.length})
          </span>
        </h3>
        {/* إظهار زر إضافة جهاز للمديرين وللمندوبين */}
        {(currentUser?.role === 'admin' || currentUser?.role === 'agent') && (
          <Button
            onClick={handleAddDevice}
            variant="primary"
            className="flex items-center gap-2 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            <span>{t('device.addDevice', 'إضافة جهاز')}</span>
          </Button>
        )}
      </div>

      {devices.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {t('device.noDevices', 'لا توجد أجهزة مسجلة لهذا العميل')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('device.deviceType', 'نوع الجهاز')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('device.activationCode', 'رمز التفعيل')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('device.subscriptionType', 'نوع الاشتراك')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('device.subscriptionEnd', 'نهاية الاشتراك')}
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.actions', 'الإجراءات')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getDeviceIcon(device.device_type)}
                      <span className="ml-2">{getDeviceTypeLabel(device.device_type)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="font-mono text-sm">{device.activation_code}</span>
                      <button
                        onClick={() => copyActivationCode(device.activation_code)}
                        className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        <Clipboard className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSubscriptionTypeLabel(device.subscription_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span className={isSubscriptionExpired(device.subscription_end) ? 'text-red-500 font-semibold' : ''}>
                        {formatDate(device.subscription_end)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center space-x-2 rtl:space-x-reverse">
                      {/* إظهار أزرار التعديل والحذف للمديرين فقط */}
                      {currentUser?.role === 'admin' && (
                        <>
                          <button
                            onClick={() => handleEditDevice(device)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(device.id!)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDeviceModal && (
        <DeviceModal
          isOpen={showDeviceModal}
          onClose={() => setShowDeviceModal(false)}
          onSave={handleSaveDevice}
          device={selectedDevice}
          clientId={clientId}
          versionTypes={versionTypes}
        />
      )}
    </div>
  );
}
