// أنواع البيانات المتعلقة بالعملاء والوكلاء

// تصحيح وتحسين أنواع البيانات
import { DeviceType } from './device.types';

export interface ClientType {
  id: string;
  created_at: string;
  client_name: string;
  organization_name: string;
  activity_type: string;
  phone: string;
  phone2?: string;
  activation_code: string;
  subscription_type: string;
  subscription_start: string;
  subscription_end: string;
  notes: string | null;
  agent_id: string;
  address?: string;
  active_devices_count?: number;
  device_count?: number;
  device_type: string;
  agent?: Agent; // إضافة خاصية agent كاختيارية
  devices?: DeviceType[]; // إضافة خاصية devices كاختيارية
}

export interface Agent {
  id: string;
  name: string | null;
  email: string;
  role: string;
  is_active: boolean;
}

export interface SubscriptionType {
  value: string;
  label: string;
  labelEn: string;
}

export interface VersionType {
  value: string;
  label: string;
  labelEn: string;
  icon?: string;
}

// تصدير الأنواع المستخدمة في ClientsList
export type ImportedClientType = ClientType;
export type ImportedAgent = Agent;
