// src/store/dataStore.ts
import create from 'zustand';
import { shallow } from 'zustand/shallow'; // Import shallow for optimized selections
import { supabase } from '../lib/supabaseClient'; // تأكد من صحة المسار
import { DashboardData } from '../types/dashboard.types'; // استورد أنواعك
import { ClientType as ImportedClientType, Agent as ImportedAgent, DeviceType } from '../types/client.types'; // استورد أنواعك (افترض وجود DeviceType)

// ثوابت التخزين المؤقت (يمكن تعديلها حسب الحاجة)
const CACHE_DURATION = 2 * 60 * 1000; // دقيقتان بالميلي ثانية
const BATCH_SIZE = 1000; // حجم الدفعة لجلب البيانات

interface DataState {
  clients: ImportedClientType[];
  devices: DeviceType[]; // استخدم النوع الصحيح هنا
  agents: ImportedAgent[];
  dashboardStats: Partial<DashboardData>; // بيانات محسوبة للوحة التحكم
  loading: boolean;
  error: string | null;
  lastUpdatedTimestamp: number | null;
  fetchData: (forceRefresh?: boolean, currentUser?: any) => Promise<void>;
  getClients: () => ImportedClientType[];
  getDevices: () => DeviceType[];
  getAgents: () => ImportedAgent[];
  getDashboardStats: () => Partial<DashboardData>;
}

// --- دالة جلب البيانات دفعة واحدة ---
async function fetchAllBatched<T>(
  tableName: string,
  selectQuery: string = '*',
  filterFn?: (query: any) => any // دالة لتطبيق الفلاتر الإضافية
): Promise<T[]> {
  let allData: T[] = [];
  let page = 0;
  let hasMore = true;

  console.log(`Starting batch fetch for ${tableName}...`);

  while (hasMore) {
    let query = supabase.from(tableName).select(selectQuery);
    if (filterFn) {
      query = filterFn(query); // تطبيق الفلاتر إذا وجدت
    }
    query = query.range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

    const { data: pageData, error: pageError } = await query;

    if (pageError) {
      console.error(`Error fetching page ${page + 1} of ${tableName}:`, pageError);
      throw new Error(`${tableName} fetch error: ${pageError.message}`);
    }

    if (pageData && pageData.length > 0) {
      allData = [...allData, ...pageData];
      page++;
      console.log(`Fetched page ${page} of ${tableName}: ${pageData.length} records. Total: ${allData.length}`);
      if (pageData.length < BATCH_SIZE) {
        hasMore = false; // وصلنا لآخر صفحة
      }
    } else {
      hasMore = false; // لا توجد بيانات أخرى
    }
  }
  console.log(`Finished batch fetch for ${tableName}. Total records: ${allData.length}`);
  return allData;
}


// --- دالة حساب إحصائيات لوحة التحكم ---
// Note: This function now takes raw clients and devices and calculates everything
function calculateDashboardStats(
    allClients: ImportedClientType[],
    allDevices: DeviceType[], // استخدم النوع الصحيح
    allAgents: ImportedAgent[],
    currentUser?: any // Needed to filter stats if user is an agent
): Partial<DashboardData> {

    let clientsToProcess = allClients;
    let devicesToProcess = allDevices;
    let agentsToProcess = allAgents;

    // Filter data based on user role *for stats calculation*
    if (currentUser?.role === 'agent') {
        const agentId = currentUser.id;
        clientsToProcess = allClients.filter(client => client.agent_id === agentId);
        const clientIds = clientsToProcess.map(c => c.id);
        devicesToProcess = allDevices.filter(device => clientIds.includes(device.client_id));
        // Agent's stats should only consider their own data
        agentsToProcess = allAgents.filter(a => a.id === agentId);
    } else if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
        // Handle other roles if necessary, or default to showing nothing/error
        clientsToProcess = [];
        devicesToProcess = [];
        agentsToProcess = [];
    }

    const totalClients = clientsToProcess.length;
    const totalDevices = devicesToProcess.length;
    const totalAgents = agentsToProcess.length; // Use filtered agents for count based on role

    let mobileDevices = 0;
    let computerDevices = 0;
    let pendingDevices = 0;
    let rejectedDevices = 0;
    let approvedDevices = 0;
    let totalValue = 0;
    let mobileValue = 0;
    let computerValue = 0;
    let activeCount = 0;
    let expiredCount = 0;
    let expiringCount = 0; // خلال 15 يوم

    const now = new Date();
    const fifteenDaysLater = new Date();
    fifteenDaysLater.setDate(now.getDate() + 15);

    devicesToProcess.forEach(device => {
        const price = parseFloat(device.price || '0') || 0; // Handle potential null/undefined price

        // إحصائيات الحالة والموافقة
        if (device.approval_status === 'pending') {
            pendingDevices++;
        } else if (device.approval_status === 'rejected') {
            rejectedDevices++;
        } else if (device.approval_status === 'approved') {
            approvedDevices++;
            totalValue += price;

            // إحصائيات نوع الجهاز والقيمة
            if (device.device_type === 'computer') {
                computerDevices++;
                computerValue += price;
            } else { // Assume anything not computer is mobile/android
                mobileDevices++;
                mobileValue += price;
            }

            // إحصائيات انتهاء الصلاحية للأجهزة الموافق عليها فقط
            if (device.subscription_type !== 'permanent' && device.subscription_end) {
                try {
                    const endDate = new Date(device.subscription_end);
                    if (!isNaN(endDate.getTime())) { // Check if date is valid
                         if (endDate < now) {
                            expiredCount++;
                        } else {
                            activeCount++; // يعتبر نشط إذا لم ينتهِ
                            if (endDate <= fifteenDaysLater) {
                                expiringCount++;
                            }
                        }
                    } else {
                         console.warn(`Invalid subscription_end date format for device ${device.id}: ${device.subscription_end}`);
                         // Decide how to count devices with invalid dates (e.g., count as active or ignore)
                         // activeCount++; // Example: Count as active if date is invalid but approved
                    }

                } catch (e) {
                    console.warn(`Error parsing date for device ${device.id}: ${device.subscription_end}`, e);
                     // activeCount++; // Example: Count as active if parsing fails
                }
            } else if (device.subscription_type === 'permanent') {
                activeCount++; // الدائم يعتبر نشط دائماً
            }
        }
         // Ensure we count all device types correctly even if not approved (for total mobile/computer counts)
         // Note: The current logic *only* counts approved devices towards mobile/computer counts.
         // If you want *total* mobile/computer regardless of approval, move this outside the 'approved' block.
    });

    // العملاء الذين ليس لديهم أجهزة (within the processed client list)
    const clientIdsWithDevices = new Set(devicesToProcess.map(d => d.client_id));
    const noDevicesCount = clientsToProcess.filter(client => !clientIdsWithDevices.has(client.id)).length;


    return {
        totalClients,
        totalDevices, // Total devices for the relevant user (agent or admin)
        mobileDevices, // Approved mobile devices
        computerDevices, // Approved computer devices
        pendingDevices,
        rejectedDevices,
        approvedDevices,
        totalValue, // Value of approved devices
        mobileValue, // Value of approved mobile devices
        computerValue, // Value of approved computer devices
        activeCount, // Active approved devices (non-expired or permanent)
        expiredCount, // Expired approved devices
        expiringCount, // Approved devices expiring within 15 days
        noDevicesCount, // Clients (relevant to user) with no devices
        totalAgents, // Total agents (only relevant for admin/super_admin view, filtered for agents)
        lastUpdated: new Date().toISOString(), // Timestamp of calculation
    };
}


const useDataStore = create<DataState>((set, get) => ({
  clients: [],
  devices: [],
  agents: [],
  dashboardStats: {},
  loading: false,
  error: null,
  lastUpdatedTimestamp: null,

  fetchData: async (forceRefresh = false, currentUser = null) => {
    const now = Date.now();
    const lastUpdate = get().lastUpdatedTimestamp;
    const currentState = get();

    // 1. التحقق من الـ Cache والوقت
    if (!forceRefresh && lastUpdate && now - lastUpdate < CACHE_DURATION && currentState.clients.length > 0 && currentState.devices.length > 0) {
      console.log('Using cached data from store state.');
      // Recalculate stats based on current user, even with cached data
      const stats = calculateDashboardStats(currentState.clients, currentState.devices, currentState.agents, currentUser);
      set({ dashboardStats: stats, loading: false, error: null }); // Ensure loading is off
      return;
    }

    // 2. بدء التحميل
    // Avoid multiple concurrent fetches
    if (currentState.loading) {
        console.log("Fetch already in progress, skipping.");
        return;
    }
    set({ loading: true, error: null });
    console.log('Fetching fresh data from Supabase...');

    try {
      // 3. جلب البيانات بالتوازي باستخدام الدالة المجمعة
      // We fetch *all* clients and devices, filtering happens later or in calculations/components
      const [clientsData, devicesData, agentsDataResult] = await Promise.all([
        fetchAllBatched<ImportedClientType>('clients', '*, agent:agents(id, name)'), // Include agent name directly
        fetchAllBatched<DeviceType>('devices', '*'),
        // Fetch agents only if admin/super_admin, otherwise fetch only the current agent if needed
        (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')
          ? fetchAllBatched<ImportedAgent>('agents', '*')
          : (currentUser?.role === 'agent' && currentUser.id)
             ? supabase.from('agents').select('*').eq('id', currentUser.id).then(({ data, error }) => {
                 if (error) throw new Error(`Agent fetch error: ${error.message}`);
                 return data || [];
               })
             : Promise.resolve([]) // No agents needed for other roles or if no currentUser
      ]);

       const fetchedAgents = agentsDataResult || [];

       // Enrich client data with agent object if not already done by the query join ':agents(id, name)'
       // This might be redundant if the join works reliably.
       const enrichedClients = clientsData.map(client => {
         if (!client.agent && client.agent_id) { // If join didn't populate agent object but ID exists
            return { ...client, agent: fetchedAgents.find(a => a.id === client.agent_id) || null };
         }
         return client; // Already has agent object or no agent_id
       });


      // 4. حساب إحصائيات لوحة التحكم بناءً على المستخدم الحالي
      const stats = calculateDashboardStats(enrichedClients, devicesData, fetchedAgents, currentUser);

      // 5. تحديث الحالة
      set({
        clients: enrichedClients, // Store enriched clients
        devices: devicesData,
        agents: fetchedAgents, // Store all fetched agents
        dashboardStats: stats,
        loading: false,
        lastUpdatedTimestamp: Date.now(),
        error: null,
      });
      console.log('Data fetched/recalculated and store updated.');

    } catch (err: any) {
      console.error('Error in fetchData:', err);
      set({ loading: false, error: err.message || 'Failed to fetch data' });
    }
  },

  // Selectors for components
  getClients: () => get().clients,
  getDevices: () => get().devices,
  getAgents: () => get().agents,
  getDashboardStats: () => get().dashboardStats,

}));

// Export shallow along with the store hook for convenience
export { useDataStore, shallow };