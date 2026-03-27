// src/store/dataStore.ts
import create from 'zustand';
import { shallow } from 'zustand/shallow'; // Import shallow for optimized selections
import { supabase } from '../lib/supabaseClient'; // تأكد من صحة المسار
import { DashboardData } from '../types/dashboard.types'; // استورد أنواعك
import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types'; // استورد أنواعك
import type { DeviceType } from '../types/device.types'; // تحقق من الاستيراد الصحيح لنوع DeviceType

// تعريف GenericStringError إذا لم يكن معرفًا
export type GenericStringError = { error: true; [key: string]: any };

// ثوابت التخزين المؤقت (يمكن تعديلها حسب الحاجة)
const CACHE_DURATION = 15 * 60 * 1000; // زيادة مدة التخزين المؤقت إلى 15 دقيقة
const BATCH_SIZE = 1000; // زيادة حجم الدفعة إلى 1000 لجلب أكبر قدر ممكن من البيانات في المرة الواحدة
const BACKGROUND_BATCH_SIZE = 1000; // حجم دفعة كبير للتحميل في الخلفية

// تحديد الحقول المطلوبة لكل جدول لتقليل حجم البيانات المنقولة
const CLIENT_FIELDS = 'id, client_name, organization_name, phone, phone2, address, activity_type, agent_id, created_at, notes';
const DEVICE_FIELDS = 'id, client_id, device_type, activation_code, subscription_type, subscription_start, subscription_end, price, approval_status, created_at, email, notes';
const AGENT_FIELDS = 'id, name, email, role';

interface DataState {
  clients: ImportedClientType[];
  devices: DeviceType[]; 
  agents: ImportedAgent[];
  dashboardStats: Partial<DashboardData>; // بيانات محسنة للوحة التحكم
  loading: boolean;
  loadingMore: boolean; // حالة تحميل المزيد من البيانات
  error: string | null;
  lastUpdatedTimestamp: number | null;
  currentPage: number; // الصفحة الحالية للبيانات المحملة
  hasMoreData: boolean; // هل هناك المزيد من البيانات للتحميل
  isInitialized: boolean; // متغير جديد لتتبع ما إذا كانت البيانات قد تم تحميلها بالفعل
  fetchData: (forceRefresh?: boolean, currentUser?: any) => Promise<void>;
  loadMoreData: (currentUser?: any) => Promise<void>; // دالة لتحميل المزيد من البيانات
  getClients: () => ImportedClientType[];
  getDevices: () => DeviceType[];
  getAgents: () => ImportedAgent[];
  getDashboardStats: () => Partial<DashboardData>;
  getClientDetails: (clientId: string) => Promise<ImportedClientType | null>; // دالة جديدة لجلب تفاصيل عميل محدد
  loadAllDataInBackground: (currentUser?: any) => Promise<void>; // دالة جديدة لتحميل جميع البيانات في الخلفية
}

// --- دالة التخزين المؤقت ---
const saveToCache = (key: string, data: any) => {
  try {
    // إضافة نظام تخزين مؤقت متدرج
    // تخزين البيانات الكاملة
    localStorage.setItem(`microsup_${key}`, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
    
    // تخزين إصدار مصغر من البيانات للوصول السريع (للعملاء فقط)
    if (key === 'clients' && Array.isArray(data) && data.length > 0) {
      const minimalClients = data.map(client => ({
        id: client.id,
        client_name: client.client_name,
        organization_name: client.organization_name,
        phone: client.phone,
        created_at: client.created_at,
        agent_id: client.agent_id
      }));
      localStorage.setItem(`microsup_${key}_minimal`, JSON.stringify({
        timestamp: Date.now(),
        data: minimalClients
      }));
    }
  } catch (e) {
    console.warn('فشل في حفظ البيانات في التخزين المؤقت:', e);
  }
};

const loadFromCache = (key: string, maxAge = CACHE_DURATION, minimal = false) => {
  try {
    // تحميل البيانات المصغرة إذا طلب ذلك
    const cacheKey = minimal ? `microsup_${key}_minimal` : `microsup_${key}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp > maxAge) return null;
    
    return data;
  } catch (e) {
    console.warn('فشل في تحميل البيانات من التخزين المؤقت:', e);
    return null;
  }
};

// --- دالة جلب البيانات دفعة واحدة محسنة ---
async function fetchAllBatched<T>(
  tableName: string,
  selectQuery: string = '*',
  page: number = 0,
  pageSize: number = BATCH_SIZE,
  filterFn?: (query: any) => any // دالة لتطبيق الفلاتر الإضافية
): Promise<{ data: T[], hasMore: boolean }> {
  let query = supabase.from(tableName).select(selectQuery);
  if (filterFn) {
    query = filterFn(query); // تطبيق الفلاتر إذا وجدت
  }
  
  // تطبيق التقسيم
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);
  
  console.log(`جلب البيانات من ${tableName} - الصفحة ${page + 1}, الحجم: ${pageSize}`);
  
  const { data: pageData, error: pageError } = await query;
  
  if (pageError) {
    console.error(`خطأ في جلب البيانات من ${tableName}:`, pageError);
    return { data: [] as T[], hasMore: false };
  }
  
  // التحقق مما إذا كان هناك المزيد من البيانات
  const hasMore = pageData.length === pageSize;
  
  return { data: pageData as T[], hasMore };
}

// --- دالة حساب إحصائيات لوحة التحكم محسنة ---
function calculateDashboardStats(
    allClients: ImportedClientType[],
    allDevices: DeviceType[], 
    allAgents: ImportedAgent[],
    currentUser?: any // Needed to filter stats if user is an agent
): Partial<DashboardData> {
    console.time('calculateDashboardStats');
    
    // استخدام Map للبحث السريع
    const deviceMap = new Map<string, DeviceType[]>();
    
    // تجميع الأجهزة حسب العميل للبحث السريع
    allDevices.forEach(device => {
        if (!deviceMap.has(device.client_id)) {
            deviceMap.set(device.client_id, []);
        }
        deviceMap.get(device.client_id)?.push(device);
    });
    
    // تحديد العملاء المناسبين (فلترة حسب المندوب إذا كان المستخدم مندوبًا)
    const filteredClients = currentUser?.role === 'agent'
        ? allClients.filter(client => client.agent_id === currentUser.id)
        : allClients;
    
    // استخدام reduce بدلاً من forEach للأداء الأفضل
    const deviceStats = allDevices.reduce((acc, device) => {
        // تحديث الإحصائيات في مرور واحد
        acc.totalDevices++;
        
        // حساب الأجهزة حسب النوع
        if (device.device_type === 'computer') {
            acc.computerDevices++;
        } else {
            acc.mobileDevices++;
        }
        
        // حساب الأجهزة حسب حالة الموافقة
        if (device.approval_status === 'approved') {
            acc.approvedDevices++;
            // حساب السعر الإجمالي للأجهزة المعتمدة فقط
            const price = parseFloat(String(device.price ?? '0')) || 0;
            acc.totalPrice += price;
            
            // حساب السعر حسب نوع الجهاز
            if (device.device_type === 'computer') {
                acc.computerPrice += price;
            } else {
                acc.mobilePrice += price;
            }
        } else if (device.approval_status === 'pending') {
            acc.pendingDevices++;
        } else if (device.approval_status === 'rejected') {
            acc.rejectedDevices++;
        }
        
        // حساب الاشتراكات المنتهية
        if (device.subscription_end && device.subscription_type !== 'permanent') {
            const endDate = new Date(device.subscription_end);
            const now = new Date();
            
            if (endDate < now) {
                acc.expiredDevices++;
            } else {
                // حساب الاشتراكات التي ستنتهي قريبًا (خلال 15 يوم)
                const fifteenDaysLater = new Date();
                fifteenDaysLater.setDate(now.getDate() + 15);
                
                if (endDate <= fifteenDaysLater) {
                    acc.expiringDevices++;
                }
            }
        }
        
        return acc;
    }, { 
        totalDevices: 0, 
        mobileDevices: 0, 
        computerDevices: 0, 
        approvedDevices: 0,
        pendingDevices: 0,
        rejectedDevices: 0,
        expiredDevices: 0,
        expiringDevices: 0,
        totalPrice: 0,
        mobilePrice: 0,
        computerPrice: 0
    });
    
    // حساب إحصائيات العملاء
    const clientStats = {
        totalClients: filteredClients.length,
        clientsWithDevices: new Set(allDevices.map(d => d.client_id)).size,
        clientsWithoutDevices: filteredClients.length - new Set(allDevices.map(d => d.client_id)).size,
        totalAgents: allAgents.length
    };

    // دمج الإحصائيات
    return { 
        ...clientStats, 
        ...deviceStats, 
        lastUpdated: new Date().toISOString() 
    };
}

const useDataStore = create<DataState>((set, get) => ({
  clients: [],
  devices: [],
  agents: [],
  dashboardStats: {},
  loading: false,
  loadingMore: false,
  error: null,
  lastUpdatedTimestamp: null,
  currentPage: 0,
  hasMoreData: true,
  isInitialized: false, // إضافة متغير لتتبع حالة التهيئة
  // دالة جديدة لتحميل جميع البيانات في الخلفية
  loadAllDataInBackground: async (currentUser = null) => {
    console.log('بدء تحميل جميع البيانات في الخلفية...');
    
    try {
      let page = 1; // نبدأ من الصفحة الثانية لأن الصفحة الأولى تم تحميلها بالفعل
      let allClientsLoaded = false;
      let allDevicesLoaded = false;
      let allClients: ImportedClientType[] = [...get().clients];
      let allDevices: DeviceType[] = [...get().devices];
      
      // إنشاء مجموعات للمعرفات الحالية للتحقق من التكرار
      const existingClientIds = new Set(allClients.map(client => client.id));
      const existingDeviceIds = new Set(allDevices.map(device => device.id));
      
      // استمر في التحميل حتى يتم جلب جميع البيانات
      while (!allClientsLoaded || !allDevicesLoaded) {
        // تحميل المزيد من العملاء إذا لم يتم تحميلهم جميعًا بعد
        if (!allClientsLoaded) {
          const { data: moreClients, hasMore } = await fetchAllBatched<ImportedClientType>(
            'clients', 
            `${CLIENT_FIELDS}, agent:agents(${AGENT_FIELDS})`, 
            page, 
            BACKGROUND_BATCH_SIZE,
            query => {
              // تطبيق فلتر المندوب إذا كان المستخدم مندوبًا
              if (currentUser && currentUser.role === 'agent') {
                return query.eq('agent_id', currentUser.id);
              }
              return query;
            }
          );
          
          // معالجة بيانات المندوبين
          const processedClients = moreClients.map(client => {
            if (client.agent && Array.isArray(client.agent) && client.agent.length > 0) {
              return {
                ...client,
                agent: {
                  id: client.agent[0].id,
                  name: client.agent[0].name,
                  email: client.agent[0].email,
                  role: client.agent[0].role,
                  is_active: true // نفترض أن المندوب نشط
                }
              };
            }
            return client;
          });
          
          // تصفية العملاء الجدد للتأكد من أنهم فريدون
          const uniqueNewClients = processedClients.filter(client => !existingClientIds.has(client.id));
          
          // إضافة معرفات العملاء الجدد إلى المجموعة
          uniqueNewClients.forEach(client => existingClientIds.add(client.id));
          
          // إضافة العملاء الفريدين إلى المصفوفة
          allClients = [...allClients, ...uniqueNewClients];
          
          // التحقق مما إذا كان هناك المزيد من العملاء للتحميل
          allClientsLoaded = !hasMore || moreClients.length === 0 || uniqueNewClients.length === 0;
          
          console.log(`تم تحميل ${uniqueNewClients.length} عميل إضافي فريد في الخلفية. المجموع: ${allClients.length}`);
        }
        
        // تحميل المزيد من الأجهزة إذا لم يتم تحميلها جميعًا بعد
        if (!allDevicesLoaded) {
          const { data: moreDevices, hasMore } = await fetchAllBatched<DeviceType>(
            'devices', 
            DEVICE_FIELDS, 
            page, 
            BACKGROUND_BATCH_SIZE,
            query => {
              // تطبيق فلتر المندوب إذا كان المستخدم مندوبًا
              if (currentUser && currentUser.role === 'agent') {
                return query.in('client_id', allClients.map(c => c.id));
              }
              return query;
            }
          );
          
          // تصفية الأجهزة الجديدة للتأكد من أنها فريدة
          const uniqueNewDevices = moreDevices.filter(device => !existingDeviceIds.has(device.id));
          
          // إضافة معرفات الأجهزة الجديدة إلى المجموعة
          uniqueNewDevices.forEach(device => existingDeviceIds.add(device.id));
          
          // إضافة الأجهزة الفريدة إلى المصفوفة
          allDevices = [...allDevices, ...uniqueNewDevices];
          
          // التحقق مما إذا كان هناك المزيد من الأجهزة للتحميل
          allDevicesLoaded = !hasMore || moreDevices.length === 0 || uniqueNewDevices.length === 0;
          
          console.log(`تم تحميل ${uniqueNewDevices.length} جهاز إضافي فريد في الخلفية. المجموع: ${allDevices.length}`);
        }
        
        // تحديث الحالة بعد كل دفعة
        set({
          clients: allClients,
          devices: allDevices,
          hasMoreData: !allClientsLoaded || !allDevicesLoaded
        });
        
        // حفظ البيانات في التخزين المؤقت بعد كل دفعة
        saveToCache('clients', allClients);
        saveToCache('devices', allDevices);
        
        // إعادة حساب الإحصائيات بعد كل دفعة
        const stats = calculateDashboardStats(allClients, allDevices, get().agents, currentUser);
        set({ dashboardStats: stats });
        
        page++;
      }
      
      console.log('تم الانتهاء من تحميل جميع البيانات في الخلفية.');
      set({ hasMoreData: false });
      
    } catch (err: any) {
      console.error('خطأ في تحميل البيانات في الخلفية:', err);
      // لا نقوم بتعيين حالة الخطأ لأن هذا يحدث في الخلفية
    }
  },

  fetchData: async (forceRefresh = false, currentUser = null) => {
    // التحقق مما إذا كانت البيانات قد تم تحميلها بالفعل وليست قديمة
    const now = Date.now();
    const lastUpdate = get().lastUpdatedTimestamp;
    const isDataFresh = lastUpdate && (now - lastUpdate < CACHE_DURATION);
    const isInitialized = get().isInitialized;
    
    // إذا كانت البيانات محملة بالفعل وحديثة ولم يتم طلب تحديث قسري، نخرج مبكرًا
    if (!forceRefresh && isInitialized && isDataFresh && get().clients.length > 0) {
      console.log('البيانات محملة بالفعل وحديثة، لا داعي لإعادة التحميل.');
      return;
    }
    
    // إذا كانت عملية التحميل قيد التنفيذ، لا تبدأ عملية تحميل أخرى
    if (get().loading) {
      console.log('عملية التحميل قيد التنفيذ بالفعل، لا داعي لبدء عملية جديدة.');
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      // 1. محاولة تحميل البيانات المصغرة أولاً للعرض السريع
      if (!forceRefresh) {
        const minimalClients = loadFromCache('clients', CACHE_DURATION, true);
        if (minimalClients && minimalClients.length > 0) {
          // عرض البيانات المصغرة فوراً بينما يتم تحميل البيانات الكاملة
          set({ 
            clients: minimalClients,
            loading: true // لا تزال عملية التحميل مستمرة
          });
        }
      }
      
      // 2. التحقق من وجود بيانات مخزنة مؤقتًا (إذا لم يتم طلب تحديث قسري)
      let clientsData: ImportedClientType[] = [];
      let devicesData: DeviceType[] = [];
      let agentsData: ImportedAgent[] = [];
      
      if (!forceRefresh) {
        clientsData = loadFromCache('clients') || [];
        devicesData = loadFromCache('devices') || [];
        agentsData = loadFromCache('agents') || [];
        
        // إذا كانت البيانات المخزنة مؤقتًا حديثة وكاملة، استخدمها
        if (clientsData.length > 0 && devicesData.length > 0 && agentsData.length > 0) {
          const stats = calculateDashboardStats(clientsData, devicesData, agentsData, currentUser);
          set({
            clients: clientsData,
            devices: devicesData,
            agents: agentsData,
            dashboardStats: stats,
            loading: false,
            currentPage: 0,
            hasMoreData: false, // تم تحميل جميع البيانات
            lastUpdatedTimestamp: Date.now(),
            isInitialized: true, // تعيين حالة التهيئة إلى true
            error: null,
          });
          console.log('تم تحميل البيانات من التخزين المؤقت بنجاح.');
          
          // حتى لو كانت البيانات متوفرة في التخزين المؤقت، نقوم بتحميل البيانات المحدثة في الخلفية
          // لكن فقط إذا كانت البيانات قديمة نسبيًا (أكثر من دقيقة)
          if (lastUpdate && (now - lastUpdate > 60000)) {
            setTimeout(() => {
              get().loadAllDataInBackground(currentUser);
            }, 1000);
          }
          
          return; // الخروج مبكرًا لأن البيانات تم تحميلها من التخزين المؤقت
        }
      }
      
      // 3. جلب جميع البيانات من قاعدة البيانات
      console.log('جلب جميع البيانات من قاعدة البيانات...');
      
      // تحميل جميع البيانات مرة واحدة
      await loadAllData(currentUser, set);
      
    } catch (err: any) {
      console.error('خطأ في جلب البيانات:', err);
      set({ loading: false, error: err.message || 'فشل في جلب البيانات' });
    }
  },
  
  // دالة لتحميل المزيد من البيانات
  loadMoreData: async (currentUser = null) => {
    const { currentPage, loadingMore, hasMoreData } = get();
    
    // لا تحمل المزيد إذا كانت عملية التحميل قيد التنفيذ أو لا توجد المزيد من البيانات
    if (loadingMore || !hasMoreData) return;
    
    set({ loadingMore: true });
    const nextPage = currentPage + 1;
    
    try {
      // تحميل المزيد من العملاء
      const { data: moreClients, hasMore: hasMoreClients } = await fetchAllBatched<ImportedClientType>(
        'clients', 
        `${CLIENT_FIELDS}, agent:agents(${AGENT_FIELDS})`, 
        nextPage, 
        BATCH_SIZE,
        query => {
          // تطبيق فلتر المندوب إذا كان المستخدم مندوبًا
          if (currentUser && currentUser.role === 'agent') {
            return query.eq('agent_id', currentUser.id);
          }
          return query;
        }
      );
      
      // معالجة بيانات المندوبين
      const processedClients = moreClients.map(client => {
        if (client.agent && Array.isArray(client.agent) && client.agent.length > 0) {
          return {
            ...client,
            agent: {
              id: client.agent[0].id,
              name: client.agent[0].name,
              email: client.agent[0].email,
              role: client.agent[0].role,
              is_active: true // نفترض أن المندوب نشط
            }
          };
        }
        return client;
      });
      
      // تحميل المزيد من الأجهزة
      const { data: moreDevices, hasMore: hasMoreDevices } = await fetchAllBatched<DeviceType>(
        'devices', 
        DEVICE_FIELDS, 
        nextPage, 
        BATCH_SIZE,
        query => {
          // تطبيق فلتر المندوب إذا كان المستخدم مندوبًا
          if (currentUser && currentUser.role === 'agent') {
            return query.in('client_id', get().clients.map(c => c.id));
          }
          return query;
        }
      );
      
      // إنشاء مجموعة من معرفات العملاء الحالية للتحقق من التكرار
      const existingClientIds = new Set(get().clients.map(client => client.id));
      const uniqueNewClients = processedClients.filter(client => !existingClientIds.has(client.id));
      
      // إنشاء مجموعة من معرفات الأجهزة الحالية للتحقق من التكرار
      const existingDeviceIds = new Set(get().devices.map(device => device.id));
      const uniqueNewDevices = moreDevices.filter(device => !existingDeviceIds.has(device.id));
      
      console.log(`تم تحميل ${uniqueNewClients.length} عميل جديد و ${uniqueNewDevices.length} جهاز جديد`);
      
      // تحديث الحالة بالبيانات الجديدة الفريدة فقط
      set(state => ({
        clients: [...state.clients, ...uniqueNewClients],
        devices: [...state.devices, ...uniqueNewDevices],
        currentPage: nextPage,
        hasMoreData: (hasMoreClients && uniqueNewClients.length > 0) || (hasMoreDevices && uniqueNewDevices.length > 0),
        loadingMore: false
      }));
      
    } catch (err: any) {
      console.error('خطأ في تحميل المزيد من البيانات:', err);
      set({ loadingMore: false, error: err.message || 'فشل في تحميل المزيد من البيانات' });
    }
  },
  
  // دالة لجلب تفاصيل عميل محدد
  getClientDetails: async (clientId: string) => {
    try {
      // التحقق أولاً من وجود بيانات العميل في المخزن
      const clientInStore = get().clients.find(c => c.id === clientId);
      if (clientInStore) {
        // جلب أجهزة العميل
        const { data: clientDevices, error } = await supabase
          .from('devices')
          .select(DEVICE_FIELDS)
          .eq('client_id', clientId);
          
        if (error) throw error;
        
        // دمج بيانات العميل مع أجهزته
        return { ...clientInStore, devices: clientDevices };
      }
      
      // إذا لم يكن العميل موجودًا في المخزن، جلب بياناته من قاعدة البيانات
      const { data, error } = await supabase
        .from('clients')
        .select(`${CLIENT_FIELDS}, subscription_type, subscription_start, subscription_end, agent:agents(${AGENT_FIELDS}), devices(${DEVICE_FIELDS})`)
        .eq('id', clientId)
        .single();
        
      if (error) throw error;
      
      // معالجة بيانات المندوب
      const processedData = {
        ...data,
        agent: data.agent && Array.isArray(data.agent) && data.agent.length > 0 
          ? {
              id: data.agent[0].id,
              name: data.agent[0].name,
              email: data.agent[0].email,
              role: data.agent[0].role,
              is_active: true // نفترض أن المندوب نشط
            } 
          : undefined
      };
      
      return processedData as ImportedClientType;
    } catch (err) {
      console.error('خطأ في جلب تفاصيل العميل:', err);
      return null;
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

// دالة مساعدة لتحميل جميع البيانات مرة واحدة
async function loadAllData(currentUser: any, set: any) {
  try {
    let allClients: ImportedClientType[] = [];
    let allDevices: DeviceType[] = [];
    let allAgentsData: ImportedAgent[] = [];
    let page = 0;
    let hasMoreClients = true;
    let hasMoreDevices = true;
    
    // إنشاء مجموعات للمعرفات للتحقق من التكرار
    const clientIds = new Set<string>();
    const deviceIds = new Set<string>();
    
    console.log('بدء تحميل جميع البيانات...');
    
    // 1. تحميل جميع المندوبين (عددهم قليل عادة)
    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select(AGENT_FIELDS);
      
    if (agentsError) throw agentsError;
    
    // معالجة بيانات المندوبين
    allAgentsData = agentsData.map(agent => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      is_active: true // نفترض أن جميع المندوبين نشطين
    }));
    
    // 2. تحميل جميع العملاء
    while (hasMoreClients) {
      const { data: clientsData, hasMore } = await fetchAllBatched<ImportedClientType>(
        'clients', 
        `${CLIENT_FIELDS}, agent:agents(${AGENT_FIELDS}), subscription_type, subscription_start, subscription_end`, 
        page, 
        BATCH_SIZE,
        query => {
          // تطبيق فلتر المندوب إذا كان المستخدم مندوبًا
          if (currentUser && currentUser.role === 'agent') {
            return query.eq('agent_id', currentUser.id);
          }
          return query;
        }
      );
      
      // معالجة بيانات المندوبين
      const processedClients = clientsData.map(client => {
        if (client.agent && Array.isArray(client.agent) && client.agent.length > 0) {
          return {
            ...client,
            agent: {
              id: client.agent[0].id,
              name: client.agent[0].name,
              email: client.agent[0].email,
              role: client.agent[0].role,
              is_active: true // نفترض أن المندوب نشط
            }
          };
        }
        return client;
      });
      
      // تصفية العملاء الجدد للتأكد من أنهم فريدون
      const uniqueClients = processedClients.filter(client => !clientIds.has(client.id));
      uniqueClients.forEach(client => clientIds.add(client.id));
      
      allClients = [...allClients, ...uniqueClients];
      hasMoreClients = hasMore && clientsData.length > 0;
      page++;
      
      console.log(`تم تحميل ${allClients.length} عميل حتى الآن...`);
      
      // تحديث الحالة بالتقدم
      set({
        clients: allClients,
        loading: true
      });
    }
    
    // 3. تحميل جميع الأجهزة
    page = 0;
    while (hasMoreDevices) {
      const { data: devicesData, hasMore } = await fetchAllBatched<DeviceType>(
        'devices', 
        DEVICE_FIELDS, 
        page, 
        BATCH_SIZE,
        query => {
          // تطبيق فلتر المندوب إذا كان المستخدم مندوبًا
          if (currentUser && currentUser.role === 'agent') {
            return query.in('client_id', allClients.map(c => c.id));
          }
          return query;
        }
      );
      
      // تصفية الأجهزة الجديدة للتأكد من أنها فريدة
      const uniqueDevices = devicesData.filter(device => !deviceIds.has(device.id));
      uniqueDevices.forEach(device => deviceIds.add(device.id));
      
      allDevices = [...allDevices, ...uniqueDevices];
      hasMoreDevices = hasMore && devicesData.length > 0;
      page++;
      
      console.log(`تم تحميل ${allDevices.length} جهاز حتى الآن...`);
    }
    
    // 4. حساب إحصائيات لوحة التحكم
    const stats = calculateDashboardStats(allClients, allDevices, allAgentsData, currentUser);
    
    // 5. حفظ البيانات في التخزين المؤقت
    saveToCache('clients', allClients);
    saveToCache('devices', allDevices);
    saveToCache('agents', allAgentsData);
    
    // 6. تحديث الحالة
    set({
      clients: allClients,
      devices: allDevices,
      agents: allAgentsData,
      dashboardStats: stats,
      loading: false,
      currentPage: 0,
      hasMoreData: false, // تم تحميل جميع البيانات
      lastUpdatedTimestamp: Date.now(),
      isInitialized: true, // تعيين حالة التهيئة إلى true
      error: null,
    });
    
    console.log(`تم الانتهاء من تحميل جميع البيانات: ${allClients.length} عميل و ${allDevices.length} جهاز.`);
    
    return { allClients, allDevices, allAgentsData };
  } catch (err) {
    console.error('خطأ في تحميل جميع البيانات:', err);
    throw err;
  }
}