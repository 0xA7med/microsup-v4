// تعريفات الأنواع المستخدمة في التطبيق

export interface ClientType {
  id: string;
  client_name: string;
  organization_name?: string;
  activity_type?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  agent_id?: string;
  device_count?: number;
  subscription_type?: string;
  device_type: string;
  subscription_start?: string;
  subscription_end?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Agent {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role?: string;
  status?: string;
}

export interface SubscriptionType {
  value: string;
  label: string;
  labelEn: string;
  icon?: React.ReactNode;
}

export interface VersionType {
  value: string;
  label: string;
  labelEn: string;
  icon?: React.ReactNode;
}
