// أنواع بيانات الأجهزة
export interface DeviceType {
  id?: string;
  client_id: string;
  activation_code: string;
  subscription_start: string;
  subscription_end: string;
  subscription_type?: string;
  device_type: string;
  email?: string; // البريد الإلكتروني المرتبط بالجهاز (اختياري)
  notes?: string;
  created_at?: string;
  updated_at?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  approval_date?: string;
  approved_by?: string;
  rejection_reason?: string;
  price: number; // قيمة الجهاز (إجباري)
}

// أنواع الأجهزة
export const DEVICE_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer' },
  { value: 'android', label: 'موبايل', labelEn: 'Mobile' }
];

// حالات الموافقة
export const APPROVAL_STATUS = [
  { value: 'pending', label: 'قيد المراجعة', labelEn: 'Pending', color: 'yellow' },
  { value: 'approved', label: 'تمت الموافقة', labelEn: 'Approved', color: 'green' },
  { value: 'rejected', label: 'مرفوض', labelEn: 'Rejected', color: 'red' }
];
