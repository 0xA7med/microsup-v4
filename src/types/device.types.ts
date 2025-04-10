// أنواع بيانات الأجهزة
export interface DeviceType {
  id?: string;
  client_id: string;
  activation_code: string;
  subscription_start: string;
  subscription_end: string;
  subscription_type?: string;
  software_version: string;
  device_type: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// أنواع الأجهزة
export const DEVICE_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer' },
  { value: 'android', label: 'موبايل', labelEn: 'Mobile' }
];
