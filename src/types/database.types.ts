export type User = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'agent';
  phone: string;
  address: string;
  created_at: string;
};

export type Client = {
  id: string;
  client_name: string;
  organization_name: string;
  activity_type: string;
  phone: string;
  activation_code: string;
  subscription_type: 'monthly' | 'semi_annual' | 'annual' | 'permanent';
  address: string;
  device_count: number;
  software_version: 'computer' | 'android';
  subscription_start: string;
  subscription_end: string | null;
  notes: string | null;
  agent_id: string;
  created_at: string;
};