// أنواع بيانات الأجهزة
export interface DeviceType {
  id: string;
  client_id: string;
  activation_code: string;
  subscription_start: string;
  subscription_end: string;
  subscription_type: string;
  device_type: string;
  notes?: string | null;
  price?: number;
  email?: string;
  approval_status?: 'approved' | 'pending' | 'rejected';
  client?: any; // للعلاقة مع العميل
}

// أنواع الأجهزة
export const DEVICE_TYPES = [
  { value: 'android', label: 'هاتف', labelEn: 'Mobile' },
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer' }
];

// حالات الموافقة
export const APPROVAL_STATUS = [
  { value: 'pending', label: 'قيد المراجعة', labelEn: 'Pending', color: 'yellow' },
  { value: 'approved', label: 'تمت الموافقة', labelEn: 'Approved', color: 'green' },
  { value: 'rejected', label: 'مرفوض', labelEn: 'Rejected', color: 'red' }
];
