export interface Client {
  id: string;
  client_name: string;
  organization_name: string;
  phone: string;
  phone2?: string;
  address?: string;
  activity_type?: string;
  subscription_type: string;
  subscription_start?: string;
  subscription_end?: string;
  device_count: number;
  created_at: string;
  agent_id?: string;
  agent_name?: string;
  agent_email?: string;
  software_version?: string;
  activation_code?: string;
  notes?: string;
  agents?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  email: string;
}

export interface DashboardData {
  totalClients: number;
  totalAgents: number;
  activeSubscriptions: number;
  recentClients: Client[];
  expiredSubscriptions: number;
  averageDevices: number;
  renewalRate: number;
  agents: Agent[];
  permanentClients: number;
  expiringThisMonth: number;
  lastUpdated: string | null;
  // حقول جديدة لإجمالي القيم
  totalValue: number;
  mobileValue: number;
  computerValue: number;
  // عدد الأجهزة النشطة
  activeDevices: number;
  // حقول جديدة لحالة الأجهزة
  approvedDevices: number;
  pendingDevices: number;
  rejectedDevices: number;
  // عدد الأجهزة حسب النوع
  totalDevices: number;
  mobileDevices: number;
  computerDevices: number;
  // حقول إضافية للإحصائيات
  expiringCount?: number;
  expiredCount?: number;
  activeCount?: number;
  noDevicesCount?: number;
}


export interface CacheData {
  data: DashboardData;
  timestamp: number;
}
