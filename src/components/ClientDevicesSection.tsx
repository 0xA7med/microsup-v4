import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import DevicesList from './DevicesList';
import { DeviceType } from '../types/device.types';

interface ClientDevicesSectionProps {
  clientId: string;
  currentUser?: {
    id: string;
    role: string;
  } | null;
}

export default function ClientDevicesSection({
  clientId,
  currentUser
}: ClientDevicesSectionProps) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<DeviceType[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [showDevicesSection, setShowDevicesSection] = useState(true);

  const fetchDevices = async () => {
    if (!clientId) return;
    
    setIsLoadingDevices(true);
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('client_id', clientId);
      
      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchDevices();
    }
  }, [clientId]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setShowDevicesSection(!showDevicesSection)}
        className="flex items-center justify-between w-full p-5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
          {t('device.devicesSection', 'الأجهزة والاشتراكات')}
          <span className="mr-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({devices.length})
          </span>
        </h3>
        {showDevicesSection ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      
      {showDevicesSection && (
        <div className="p-5">
          {isLoadingDevices ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
            </div>
          ) : (
            <DevicesList
              devices={devices}
              clientId={clientId}
              onDeviceUpdated={fetchDevices}
              currentUser={currentUser}
            />
          )}
        </div>
      )}
    </div>
  );
}
