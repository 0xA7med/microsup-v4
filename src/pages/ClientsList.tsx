// src/pages/ClientsList.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  Search, Smartphone, Laptop, Eye, ChevronRight, ChevronUp, ChevronDown, ChevronLeft,
  Copy, Check, Zap, AlertCircle, Clock, X, Filter, User, Users,
  RefreshCw, Info, Package // Added Package icon
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabaseClient'; // Ensure correct path
import { useAuthStore } from '../store/authStore';
import { useDataStore, shallow } from '../store/dataStore';

import { ImportedClientType } from '../types/client.types';
import { DeviceType } from '../types/device.types';

// --- Define DisplayClientType used within this component ---
type DisplayClientType = ImportedClientType & {
  deviceCount: number;
  devices: DeviceType[];
  mobileDevicesCount: number;
  computerDevicesCount: number;
  approvedDevicesCount: number;
  pendingDevicesCount: number;
  rejectedDevicesCount: number;
  earliestEndDate: string | null;
  subscriptionTypes: string[];
  totalPrice: number;
  mobilePrice: number;
  computerPrice: number;
  showDevices: boolean;
}

const SUBSCRIPTION_TYPES = [
  { value: 'monthly', label: 'شهري', labelEn: 'Monthly' },
  { value: 'semi_annual', label: 'نصف سنوي', labelEn: 'Biannual' },
  { value: 'annual', label: 'سنوي', labelEn: 'Annual' },
  { value: 'permanent', label: 'دائم', labelEn: 'Permanent' }
];

const VERSION_TYPES = [
  { value: 'computer', label: 'كمبيوتر', labelEn: 'Computer' },
  { value: 'android', label: 'اندرويد', labelEn: 'Mobile' }
];

const PAGE_SIZE = 50;

// --- Main Component ---
export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // --- Zustand Store Subscription ---
   const {
    clients: allClientsFromStore,
    devices: allDevicesFromStore,
    agents: allAgentsFromStore,
    loading: isLoadingStore,
    error: storeError,
    fetchData,
  } = useDataStore(
    state => ({
      clients: state.clients,
      devices: state.devices,
      agents: state.agents,
      loading: state.loading,
      error: state.error,
      fetchData: state.fetchData,
    }),
    shallow
  );

  // --- Local UI State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null); // 'active', 'expired', etc. OR 'allWithDevices'
  const [deviceFilter, setDeviceFilter] = useState<'mobile' | 'computer' | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: keyof DisplayClientType | 'agentName'; direction: 'ascending' | 'descending' }>({ key: 'created_at', direction: 'descending' });
  const [selectedClient, setSelectedClient] = useState<DisplayClientType | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedCodes, setCopiedCodes] = useState<{ [key: string]: boolean }>({});
  const [processedClients, setProcessedClients] = useState<DisplayClientType[]>([]);
  const [paginatedClients, setPaginatedClients] = useState<DisplayClientType[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [userExpandedClients, setUserExpandedClients] = useState<Set<string>>(new Set());

  const initialFetchTriggered = useRef(false);

  // --- Fetch Initial Data via Store ---
  useEffect(() => {
    if (!isLoadingStore && !initialFetchTriggered.current) {
      // console.log("ClientsList: Triggering initial fetchData from store effect.");
      fetchData(false, user);
      initialFetchTriggered.current = true;
    }
  }, [fetchData, user, isLoadingStore]);

  // --- Process Filters from URL ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filterParam = params.get('filter');
    const deviceFilterParam = params.get('deviceFilter');
    const agentIdParam = params.get('agent_id');

    let currentActiveFilter: string | null = null;
    let currentDeviceFilter: 'mobile' | 'computer' | null = null;

    if (agentIdParam) currentActiveFilter = `agent_${agentIdParam}`;
    else if (filterParam) currentActiveFilter = filterParam; // Catches 'active', 'expired', 'allWithDevices', etc.

    if (deviceFilterParam === 'mobile' || deviceFilterParam === 'computer') {
      currentDeviceFilter = deviceFilterParam;
    }

    let filtersChanged = false;
    setActiveFilter(prev => { if (prev !== currentActiveFilter) { filtersChanged = true; return currentActiveFilter; } return prev; });
    setDeviceFilter(prev => { if (prev !== currentDeviceFilter) { filtersChanged = true; return currentDeviceFilter; } return prev; });

    if (filtersChanged) {
      setCurrentPage(1);
      setUserExpandedClients(new Set());
    }
  }, [location.search]);

  // --- Client-Side Data Processing (Filtering, Sorting, Device Expansion) ---
  useMemo(() => {
    // console.log("ClientsList: Recalculating processedClients...");
    if (!allClientsFromStore || !allDevicesFromStore) { setProcessedClients([]); return; }

    // Determine if *any* filter affecting the client list itself is active
    const isClientListFilterActive = !!(searchTerm || activeFilter || deviceFilter);

    // 1. Enrich Client Data
    const enrichedClients: DisplayClientType[] = allClientsFromStore
      .filter(client => user?.role !== 'agent' || client.agent_id === user.id)
      .map(client => {
        const clientDevices = allDevicesFromStore.filter(d => d.client_id === client.id);
        const deviceCount = clientDevices.length;
        const mobileDevices = clientDevices.filter(d => d.device_type !== 'computer');
        const computerDevices = clientDevices.filter(d => d.device_type === 'computer');
        const approvedDevices = clientDevices.filter(d => d.approval_status === 'approved');
        const pendingDevices = clientDevices.filter(d => d.approval_status === 'pending');
        const rejectedDevices = clientDevices.filter(d => d.approval_status === 'rejected');

        let earliestEndDate: string | null = null;
        const subscriptionTypes: string[] = [];
        let totalPrice = 0;
        let mobilePrice = 0;
        let computerPrice = 0;
        const endDates: number[] = [];

        approvedDevices.forEach(d => {
          const price = parseFloat(String(d.price ?? '0')) || 0;
          totalPrice += price;
          if (d.device_type !== 'computer') mobilePrice += price; else computerPrice += price;
          if (d.subscription_type && !subscriptionTypes.includes(d.subscription_type)) { subscriptionTypes.push(d.subscription_type); }
          if (d.subscription_type !== 'permanent' && d.subscription_end) { try { const ed = new Date(d.subscription_end); if (!isNaN(ed.getTime())) endDates.push(ed.getTime()); } catch { /* Ign */ } }
        });
        if (endDates.length > 0) earliestEndDate = new Date(Math.min(...endDates)).toISOString();

        return { ...client, deviceCount, devices: clientDevices, mobileDevicesCount: mobileDevices.length, computerDevicesCount: computerDevices.length, approvedDevicesCount: approvedDevices.length, pendingDevicesCount: pendingDevices.length, rejectedDevicesCount: rejectedDevices.length, earliestEndDate, subscriptionTypes, totalPrice, mobilePrice, computerPrice, showDevices: userExpandedClients.has(client.id) };
      });

    // 2. Apply Search Filter
    let filteredClients = enrichedClients;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredClients = enrichedClients.filter(client => (client.client_name?.toLowerCase().includes(lowerSearchTerm) || client.organization_name?.toLowerCase().includes(lowerSearchTerm) || client.phone?.includes(lowerSearchTerm) || client.phone2?.includes(lowerSearchTerm) || client.notes?.toLowerCase().includes(lowerSearchTerm) || client.devices.some(device => device.activation_code?.toLowerCase().includes(lowerSearchTerm) || device.email?.toLowerCase().includes(lowerSearchTerm) || device.notes?.toLowerCase().includes(lowerSearchTerm))));
    }

    // 3. Apply Active Filter (Status, Agent, etc.)
    const now = new Date();
    const fifteenDaysLater = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    if (activeFilter) {
      if (activeFilter === 'active') { filteredClients = filteredClients.filter(c => c.devices.some(d => d.approval_status === 'approved' && (d.subscription_type === 'permanent' || (d.subscription_end && new Date(d.subscription_end) >= now)))); }
      else if (activeFilter === 'expired') { filteredClients = filteredClients.filter(c => c.devices.some(d => d.approval_status === 'approved' && d.subscription_type !== 'permanent' && d.subscription_end && new Date(d.subscription_end) < now)); }
      else if (activeFilter === 'expiring') { filteredClients = filteredClients.filter(c => c.devices.some(d => d.approval_status === 'approved' && d.subscription_type !== 'permanent' && d.subscription_end && new Date(d.subscription_end) >= now && new Date(d.subscription_end) <= fifteenDaysLater)); }
      else if (activeFilter === 'noDevices') { filteredClients = filteredClients.filter(c => c.deviceCount === 0); }
      else if (activeFilter === 'allWithDevices') { filteredClients = filteredClients.filter(c => c.deviceCount > 0); } // <-- Logic for the new filter
      else if (activeFilter === 'approved') { filteredClients = filteredClients.filter(c => c.approvedDevicesCount > 0); }
      else if (activeFilter === 'pending') { filteredClients = filteredClients.filter(c => c.pendingDevicesCount > 0); }
      else if (activeFilter === 'rejected') { filteredClients = filteredClients.filter(c => c.rejectedDevicesCount > 0); }
      else if (activeFilter.startsWith('agent_')) { const agentId = activeFilter.replace('agent_', ''); filteredClients = filteredClients.filter(c => c.agent_id === agentId); }
    }

    // 4. Apply Device Type Filter
    if (deviceFilter) { filteredClients = filteredClients.filter(client => client.devices.some(device => (deviceFilter === 'mobile' ? device.device_type !== 'computer' : device.device_type === 'computer'))); }

    // 5. Determine which clients should have devices shown automatically
    if (isClientListFilterActive) { // Expand devices if any filter/search is active
     // filteredClients = filteredClients.map(client => ({ ...client, showDevices: Boolean(userExpandedClients.has(client.id)) }));
      filteredClients = filteredClients.map(client => ({ ...client, showDevices: true || userExpandedClients.has(client.id) }));

    }

    // 6. Apply Sorting
    if (sortConfig) {
      filteredClients.sort((a, b) => {
        const { key, direction } = sortConfig;
        let valueA: any, valueB: any;
        if (key === 'agentName') { valueA = a.agent?.name?.toLowerCase() || ''; valueB = b.agent?.name?.toLowerCase() || ''; }
        else { valueA = a[key as keyof DisplayClientType]; valueB = b[key as keyof DisplayClientType]; }
        let comparison = 0; const asc = direction === 'ascending';
        if (valueA === null || valueA === undefined) valueA = asc ? Infinity : -Infinity;
        if (valueB === null || valueB === undefined) valueB = asc ? Infinity : -Infinity;
        if (key === 'earliestEndDate') { const timeA = (valueA === Infinity || valueA === -Infinity || isNaN(new Date(valueA as string).getTime())) ? valueA : new Date(valueA as string).getTime(); const timeB = (valueB === Infinity || valueB === -Infinity || isNaN(new Date(valueB as string).getTime())) ? valueB : new Date(valueB as string).getTime(); comparison = timeA - timeB; }
        else if (typeof valueA === 'string' && typeof valueB === 'string') { comparison = valueA.localeCompare(valueB); }
        else if (typeof valueA === 'number' && typeof valueB === 'number') { comparison = valueA - valueB; }
        else { if (valueA < valueB) comparison = -1; if (valueA > valueB) comparison = 1; }
        return asc ? comparison : comparison * -1;
      });
    }

    // 7. Update Processed State
    // console.log(`ClientsList: Finished processing. ${filteredClients.length} clients match criteria.`);
    setProcessedClients(filteredClients);

  }, [allClientsFromStore, allDevicesFromStore, searchTerm, activeFilter, deviceFilter, sortConfig, user, userExpandedClients]);


  // --- Client-Side Pagination ---
  useEffect(() => {
    const newTotalPages = Math.ceil(processedClients.length / PAGE_SIZE);
    setTotalPages(newTotalPages || 1);
    let adjustedCurrentPage = currentPage;
    if (currentPage > newTotalPages && newTotalPages > 0) { adjustedCurrentPage = newTotalPages; setCurrentPage(newTotalPages); }
    else if (processedClients.length === 0 && currentPage !== 1) { adjustedCurrentPage = 1; setCurrentPage(1); }
    const startIndex = (adjustedCurrentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    setPaginatedClients(processedClients.slice(startIndex, endIndex));
  }, [processedClients, currentPage]);


  // --- UI Handlers ---
  const handleFilterChange = useCallback((newFilter: string | null, newDeviceFilter: 'mobile' | 'computer' | null) => {
    const params = new URLSearchParams(location.search);
    if (newFilter) { if (newFilter.startsWith('agent_')) { params.set('agent_id', newFilter.replace('agent_', '')); params.delete('filter'); } else { params.set('filter', newFilter); params.delete('agent_id'); } }
    else { params.delete('filter'); params.delete('agent_id'); }
    if (newDeviceFilter) params.set('deviceFilter', newDeviceFilter); else params.delete('deviceFilter');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [navigate, location.pathname, location.search]);

  const requestSort = useCallback((key: keyof DisplayClientType | 'agentName') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
    setCurrentPage(1); setSortConfig({ key, direction });
  }, [sortConfig]);

  const toggleShowDevices = useCallback((clientId: string) => {
     setUserExpandedClients(prev => { const newSet = new Set(prev); if (newSet.has(clientId)) { newSet.delete(clientId); } else { newSet.add(clientId); } return newSet; });
   }, []);

  const handleShowDetails = useCallback((client: DisplayClientType) => { setSelectedClient(client); setShowDetailsModal(true); }, []);
  const handleCloseModal = useCallback(() => { setShowDetailsModal(false); setSelectedClient(null); }, []);

  const handleUpdateClient = useCallback(async (updatedClient: ImportedClientType) => {
    try {
      const updateData: Partial<ImportedClientType> = { client_name: updatedClient.client_name, organization_name: updatedClient.organization_name, activity_type: updatedClient.activity_type, address: updatedClient.address, phone: updatedClient.phone, phone2: updatedClient.phone2, notes: updatedClient.notes, agent_id: updatedClient.agent_id };
      const { error } = await supabase.from('clients').update(updateData).eq('id', updatedClient.id);
      if (error) throw error;
      toast.success(t('clientsList.updateSuccess', 'تم تحديث بيانات العميل بنجاح'));
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error(t('clientsList.updateError', 'حدث خطأ أثناء تحديث بيانات العميل'));
      throw error;
    }
  }, [t]);

  const handleSaveChanges = useCallback(async (updatedData: any) => {
    const isClientUpdate = 'client_name' in updatedData; let success = false;
    try {
        if (isClientUpdate) { await handleUpdateClient(updatedData as ImportedClientType); success = true; }
        else {
            const { id: deviceId, client_id, ...deviceUpdateData } = updatedData;
            if (!deviceUpdateData.client_id && client_id) { deviceUpdateData.client_id = client_id; }
            const { error } = await supabase.from('devices').update(deviceUpdateData).eq('id', deviceId); if (error) throw error;
            toast.success(t('devices.updateSuccess', 'تم تحديث بيانات الجهاز بنجاح')); success = true;
        }
    } catch (error) { console.error("Error saving changes:", error); }
    if (success) { handleCloseModal(); await fetchData(true, user); }
  }, [handleCloseModal, fetchData, user, t, handleUpdateClient]);

  const handleDeleteClient = useCallback(async (clientId: string) => {
    if (!window.confirm(t('clientsList.confirmDelete', 'هل أنت متأكد من حذف هذا العميل وجميع اشتراكاته المرتبطة به؟'))) { return; }
    try {
        const { error: deviceError } = await supabase.from('devices').delete().eq('client_id', clientId); if (deviceError) throw new Error(t('clientsList.deleteDevicesError', 'فشل حذف الاشتراكات المرتبطة.'));
        const { error: clientError } = await supabase.from('clients').delete().eq('id', clientId); if (clientError) throw clientError;
        toast.success(t('clientsList.deleteSuccess', 'تم حذف العميل واشتراكاته بنجاح')); handleCloseModal(); await fetchData(true, user);
    } catch (error: any) { console.error('Error deleting client:', error); toast.error(error.message || t('clientsList.deleteError', 'حدث خطأ أثناء حذف العميل')); }
  }, [handleCloseModal, t, fetchData, user]);

  // --- Helper Functions ---
  const getSubscriptionTypeLabel = useCallback((value: string) => {
    const type = SUBSCRIPTION_TYPES.find(type => type.value === value);
    // Provide fallback directly in t() call if needed elsewhere, or handle here
    return type ? (i18n.language === 'ar' ? type.label : type.labelEn) : value;
  }, [i18n.language]);

  const formatDateForDisplay = useCallback((dateStr?: string | Date | null): string => {
    if (!dateStr) return '-';
    try { const date = new Date(dateStr); if (isNaN(date.getTime())) return '-'; return format(date, 'yyyy/MM/dd'); } catch { return '-'; }
  }, []);

   const copyActivationCode = useCallback((code: string | null | undefined, deviceId: string) => {
       if (!code) { toast.error(t('clientsList.copyCodeMissing', 'لا يوجد رمز تفعيل للنسخ')); return; }
        navigator.clipboard.writeText(code)
        .then(() => { setCopiedCodes(prev => ({ ...prev, [deviceId]: true })); setTimeout(() => setCopiedCodes(prev => { const n = { ...prev }; delete n[deviceId]; return n; }), 2000); toast.success(t('clientsList.copySuccess', 'تم نسخ رمز التفعيل')); })
        .catch(() => toast.error(t('clientsList.copyError', 'فشل نسخ رمز التفعيل')));
  }, [t]);

  const handlePageInput = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const inputEl = e.currentTarget.elements.namedItem('pageNum') as HTMLInputElement; const num = parseInt(inputEl.value, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) { setCurrentPage(num); inputEl.value = ''; }
    else { toast.error(t('pagination.invalidPage', 'رقم الصفحة غير صالح')); }
  }, [totalPages, t]);

  const filterDevicesForDisplay = useCallback((devices: DeviceType[]): DeviceType[] => {
      if (!searchTerm && !deviceFilter) { return devices; }
      return devices.filter(device => {
          let matchesSearch = true; 
          let matchesDeviceType = true;
          
          if (searchTerm) { 
            const l = searchTerm.toLowerCase(); 
            matchesSearch = Boolean(device.activation_code?.toLowerCase().includes(l) || device.email?.toLowerCase().includes(l) || device.notes?.toLowerCase().includes(l)); 
          }
          
          if (deviceFilter) { 
            const isMobile = device.device_type !== 'computer'; 
            matchesDeviceType = (deviceFilter === 'mobile') ? isMobile : !isMobile; 
          }
          
          return matchesSearch && matchesDeviceType;
      });
  }, [searchTerm, deviceFilter]);

  // --- Rendering ---

  const SkeletonRow = useCallback(() => (
    <tr className="animate-pulse">
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div></td>
      <td className="px-4 py-4"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div></td>
    </tr>
  ), []);

   const renderedFilters = useMemo(() => (
    <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl shadow-sm">
           <div className="flex justify-between items-center cursor-pointer mb-4" onClick={() => setFiltersOpen(!filtersOpen)}>
               <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2"><Filter size={16}/>{t('clientsList.filters', 'الفلاتر')}</h2>
               {filtersOpen ? <ChevronUp /> : <ChevronDown />}
           </div>
           {filtersOpen && (
               <div className="space-y-4 animate-fade-in">
                    {/* Device Type Filter */}
                   <div>
                       <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('clientsList.deviceType', 'نوع الجهاز')}:</h3>
                       <div className="flex flex-wrap gap-2">
                       <Button onClick={() => handleFilterChange('allWithDevices', deviceFilter)} variant="secondary" size="sm" className="flex items-center gap-1">
                         <Package size={14}/>
                         <span>{t('clientsList.allDevicesFilter', 'جميع الاجهزة')}</span>
                         {activeFilter === 'allWithDevices' && <Check size={14} className="ltr:ml-1 rtl:mr-1"/>}
                       </Button>
                           <Button onClick={() => handleFilterChange(activeFilter, deviceFilter === 'mobile' ? null : 'mobile')} variant={deviceFilter === 'mobile' ? 'primary' : 'secondary'} size="sm" className="flex items-center gap-1"><Smartphone size={14}/><span>{t('clientsList.mobileFilter', 'الهاتف')}</span>{deviceFilter === 'mobile' && <Check size={14} className="ltr:ml-1 rtl:mr-1"/>}</Button>
                           <Button onClick={() => handleFilterChange(activeFilter, deviceFilter === 'computer' ? null : 'computer')} variant={deviceFilter === 'computer' ? 'primary' : 'secondary'} size="sm" className="flex items-center gap-1"><Laptop size={14}/><span>{t('clientsList.computerFilter', 'الكمبيوتر')}</span>{deviceFilter === 'computer' && <Check size={14} className="ltr:ml-1 rtl:mr-1"/>}</Button>
                       </div>
                   </div>
                   {/* Subscription Status Filter */}
                   <div>
                       <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('clientsList.subscriptionStatus', 'حالة الاشتراك')}:</h3>
                       <div className="flex flex-wrap gap-2">
                           {/* New "All Devices" Filter Button */}
                           {/* --- Other Status Filters --- */}
                           {[
                             { value: 'active', icon: Zap, label: t('clientsList.activeFilter', 'نشط') },
                             { value: 'expired', icon: AlertCircle, label: t('clientsList.expiredFilter', 'منتهي') },
                             { value: 'expiring', icon: Clock, label: t('clientsList.expiringFilter', 'قريب الانتهاء') },
                             { value: 'noDevices', icon: User, label: t('clientsList.noDevicesFilter', 'بدون أجهزة') }
                           ].map((filter) => (
                             <Button key={filter.value} onClick={() => handleFilterChange(activeFilter === filter.value ? null : filter.value, deviceFilter)} variant={activeFilter === filter.value ? 'primary' : 'secondary'} size="sm" className="flex items-center gap-1"><filter.icon size={14}/><span>{filter.label}</span>{activeFilter === filter.value && <Check size={14} className="ltr:ml-1 rtl:mr-1"/>}</Button>
                           ))}
                       </div>
                   </div>
                   {/* Approval Status Filter */}
                   <div>
                       <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('clientsList.approvalStatus', 'حالة الموافقة')}:</h3>
                       <div className="flex flex-wrap gap-2">
                           {[
                             { value: 'approved', icon: Check, label: t('clientsList.approvedFilter', 'المقبول') },
                             { value: 'pending', icon: Clock, label: t('clientsList.pendingFilter', 'المعلق') },
                             { value: 'rejected', icon: X, label: t('clientsList.rejectedFilter', 'المرفوض') }
                           ].map((filter) => (
                             <Button key={filter.value} onClick={() => handleFilterChange(activeFilter === filter.value ? null : filter.value, deviceFilter)} variant={activeFilter === filter.value ? 'primary' : 'secondary'} size="sm" className="flex items-center gap-1"><filter.icon size={14}/><span>{filter.label}</span>{activeFilter === filter.value && <Check size={14} className="ltr:ml-1 rtl:mr-1"/>}</Button>
                           ))}
                       </div>
                   </div>
                   {/* Agent Filter */}
                    {(user?.role === 'admin' || user?.role === 'super_admin') && allAgentsFromStore.length > 0 && (
                       <div>
                           <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">{t('clientsList.agents', 'المندوبين')}: <Users size={14}/></h3>
                           <select className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white bg-white" value={activeFilter?.startsWith('agent_') ? activeFilter : ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange(e.target.value || null, deviceFilter)}>
                               <option value="">{t('clientsList.selectAgent', 'الكل / اختر المندوب...')}</option>
                               {allAgentsFromStore.map(agent => (<option key={agent.id} value={`agent_${agent.id}`}>{agent.name}</option>))}
                           </select>
                       </div>
                   )}
                   {/* Clear Filters Button */}
                   {(activeFilter || deviceFilter) && (<div className="pt-2"><Button onClick={() => handleFilterChange(null, null)} variant="outline" size="sm" className="flex items-center gap-1 text-red-600 dark:text-red-400 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X size={16}/>{t('clientsList.clearFilters', 'إلغاء جميع الفلاتر')}</Button></div>)}
               </div>
           )}
       </div>
   ), [filtersOpen, t, activeFilter, deviceFilter, user, allAgentsFromStore, handleFilterChange]);

  const renderedSearch = useMemo(() => (
    <div className="relative mb-6">
      <span className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 text-gray-400"><Search size={20}/></span>
      <input type="text" placeholder={t('clientsList.searchPlaceholder', 'ابحث بالاسم، الهاتف، الملاحظات، البريد الإلكتروني، رمز التفعيل...')} className="w-full p-3 ltr:pl-10 rtl:pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white" value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
      {searchTerm && (<button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="absolute ltr:right-3 rtl:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label={t('clientsList.clearSearch', 'مسح البحث') as string}><X size={20}/></button>)}
    </div>
  ), [searchTerm, t]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 rounded-2xl shadow-lg min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('clientsList.title', 'قائمة العملاء')}</h1>
         <div className="flex gap-2">
             <Button onClick={() => fetchData(true, user)} variant="secondary" size="sm" disabled={isLoadingStore} className="flex items-center"><RefreshCw className={`w-4 h-4 ltr:mr-1 rtl:ml-1 ${isLoadingStore ? 'animate-spin' : ''}`}/><span>{t('actions.refresh', 'تحديث البيانات')}</span></Button>
             <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm" className="flex items-center">{isRTL ? <ChevronRight size={18} className="ml-1"/> : <ChevronLeft size={18} className="mr-1"/>}<span>{t('common.backToDashboard', 'العودة للوحة التحكم')}</span></Button>
         </div>
      </div>

      {renderedFilters}
      {renderedSearch}

      {storeError && !isLoadingStore && (<div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold">{t('common.error', 'خطأ!')} </strong><span className="block sm:inline">{t('errors.fetchClients', 'حدث خطأ أثناء جلب بيانات العملاء.')} {storeError}</span></div>)}

      <div className="overflow-x-auto shadow-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-start cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[25%]" onClick={() => requestSort('client_name')}><div className="flex items-center justify-start gap-1"><span>{t('clientsList.clientName', 'اسم العميل')}</span>{sortConfig?.key === 'client_name' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div></th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]" onClick={() => requestSort('phone')}><div className="flex items-center justify-center gap-1"><span>{t('clientsList.phone', 'الهاتف')}</span>{sortConfig?.key === 'phone' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div></th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]" onClick={() => requestSort('agentName')}><div className="flex items-center justify-center gap-1"><span>{t('clientsList.agent', 'المندوب')}</span>{sortConfig?.key === 'agentName' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div></th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[12%]" onClick={() => requestSort('deviceCount')}><div className="flex items-center justify-center gap-1"><span>{t('clientsList.subscriptions', 'الاشتراكات')}</span>{sortConfig?.key === 'deviceCount' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div></th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[12%]" onClick={() => requestSort('totalPrice')}><div className="flex items-center justify-center gap-1"><span>{t('clientsList.dues', 'المستحقات')}</span>{sortConfig?.key === 'totalPrice' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div></th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]" onClick={() => requestSort('earliestEndDate')}><div className="flex items-center justify-center gap-1"><span>{t('clientsList.expiryDate', 'انتهاء الصلاحية')}</span>{sortConfig?.key === 'earliestEndDate' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div></th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center w-[6%]">{t('clientsList.actions', 'إجراءات')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
             {isLoadingStore && paginatedClients.length === 0 && (
               Array.from({ length: 10 }).map((_, index) => <SkeletonRow key={`skeleton-${index}`}/>)
             )}
             {!isLoadingStore && paginatedClients.length === 0 && (
               <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">{searchTerm || activeFilter || deviceFilter ? t('clientsList.noClientsMatch', 'لا يوجد عملاء يطابقون المعايير.') : t('clientsList.noClientsYet', 'لا يوجد عملاء بعد.')}</td></tr>
             )}
             {!isLoadingStore && paginatedClients.map(client => {
                 const devicesToDisplay = client.showDevices ? filterDevicesForDisplay(client.devices) : [];
                 const now = new Date();

                 return [
                     <tr key={`client-${client.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors duration-150 group">
                       {/* Client Name */}
                       <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white align-top w-[25%]">
                         <div className="flex items-center justify-between">
                           <span className="truncate max-w-[150px] md:max-w-[200px]" title={client.client_name||''}>{client.client_name||'-'}</span>
                           {client.deviceCount > 0 && (
                             <button onClick={() => toggleShowDevices(client.id)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" title={client.showDevices?t('actions.hideDevices', 'إخفاء الاشتراكات'):t('actions.showDevices', 'عرض الاشتراكات')}>
                               {client.showDevices ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                             </button>
                           )}
                         </div>
                       </td>
                       {/* Phone */}
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top dir-ltr w-[15%]">{client.phone || '-'}</td>
                       {/* Agent */}
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top w-[15%]"><div className="truncate max-w-[100px] mx-auto" title={client.agent?.name||'-'}>{client.agent?.name||'-'}</div></td>
                       {/* Subscriptions */}
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top w-[12%]">{client.deviceCount>0?(<div className="flex flex-col items-center space-y-1"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-1">{client.deviceCount} {t('clientsList.deviceCount', 'اشتراك', { count: client.deviceCount })}</span><div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Use t() with fallbacks for device status */}
                           {client.approvedDevicesCount > 0 && <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400" title={`${client.approvedDevicesCount} ${t('devices.approved','مقبول')}`}><Check size={12}/><span className="text-xs">{client.approvedDevicesCount}</span></span>}
                           {client.pendingDevicesCount > 0 && <span className="flex items-center gap-0.5 text-yellow-600 dark:text-yellow-400" title={`${client.pendingDevicesCount} ${t('devices.pending','معلق')}`}><Clock size={12}/><span className="text-xs">{client.pendingDevicesCount}</span></span>}
                           {client.rejectedDevicesCount > 0 && <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400" title={`${client.rejectedDevicesCount} ${t('devices.rejected','مرفوض')}`}><X size={12}/><span className="text-xs">{client.rejectedDevicesCount}</span></span>}
                           </div></div>):(<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">{t('clientsList.noSubscriptions', 'لا يوجد')}</span>)}</td>
                       {/* Dues */}
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top font-mono w-[12%]">{client.totalPrice > 0 ? (<span className={`font-semibold ${client.totalPrice > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>{client.totalPrice.toLocaleString()} {t('common.currency', 'جنيه')}</span>) : (<span>0 {t('common.currency', 'جنيه')}</span>)}</td>
                       {/* Expiry Date */}
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top w-[15%]">
                            {client.earliestEndDate?(<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${new Date(client.earliestEndDate)<now?'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200':'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>{formatDateForDisplay(client.earliestEndDate)}</span>)
                            :client.subscriptionTypes.includes('permanent')&&client.approvedDevicesCount>0?(<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">{t('client.permanent', 'دائم')}</span>) // Use t() with fallback
                            :client.approvedDevicesCount > 0 ? (<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('clientsList.noExpiryDate', 'غير محدد')}</span>) // Use t() with fallback
                            :(<span>-</span>)}
                       </td>
                       {/* Actions */}
                       <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center align-top w-[6%]"><div className="flex items-center justify-center gap-1"><Button onClick={()=>handleShowDetails(client)} variant="ghost" size="icon" className="text-primary-600 hover:bg-primary-100 dark:text-primary-400 dark:hover:bg-gray-700" aria-label={t('actions.viewDetails', 'عرض التفاصيل') as string}><Eye size={16}/></Button></div></td>
                     </tr>,
                     client.showDevices && (
                       <tr key={`devices-${client.id}`}>
                         <td colSpan={7} className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                           <div className="space-y-2 max-h-60 overflow-y-auto p-1 relative">
                             {client.devices.length === 0 && (<p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">{t('clientsList.noDevicesForClient', 'لا توجد اشتراكات مسجلة لهذا العميل.')}</p>)}
                             {client.devices.length > 0 && devicesToDisplay.length === 0 && (<p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2 flex items-center justify-center gap-1"><Info size={14} /> {t('clientsList.noDevicesMatchFilter', 'لا توجد أجهزة مطابقة للفلتر/البحث لهذا العميل.')}</p>)}
                             {devicesToDisplay.map((device) => (
                               <div key={device.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded border ${device.approval_status==='approved'?'border-green-200 dark:border-green-700 bg-green-50/30 dark:bg-green-900/20':device.approval_status==='rejected'?'border-red-200 dark:border-red-700 bg-red-50/30 dark:bg-red-900/20':'border-yellow-200 dark:border-yellow-700 bg-yellow-50/30 dark:bg-yellow-900/20'}`}>
                                 {/* Left Side */}
                                 <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${device.device_type==='android'?'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300':'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'}`}>
                                        {device.device_type==='android'?<Smartphone size={12} className="ltr:mr-1 rtl:ml-1"/>:<Laptop size={12} className="ltr:mr-1 rtl:ml-1"/>}
                                        {device.device_type==='android'?t('devices.mobile','هاتف'):t('devices.computer','كمبيوتر')} {/* Use t() with fallbacks */}
                                    </span>
                                    <div className="flex items-center font-mono text-gray-700 dark:text-gray-300" title={device.activation_code||''}>
                                        <span className="truncate max-w-[100px] sm:max-w-[120px]">{device.activation_code||'-'}</span>
                                        {device.activation_code&&(<button onClick={()=>copyActivationCode(device.activation_code,device.id)} className="ml-1 p-0.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400" title={t('clientsList.copyCode', 'نسخ الرمز') as string}>{copiedCodes[device.id]?<Check size={14} className="text-green-500"/>:<Copy size={14}/>}</button>)}
                                    </div>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${device.approval_status==='approved'?'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300':device.approval_status==='rejected'?'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300':'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                        {/* Use t() with fallbacks for status */}
                                        {device.approval_status==='approved'?t('devices.approved','مقبول'):device.approval_status==='rejected'?t('devices.rejected','مرفوض'):t('devices.pending','معلق')}
                                    </span>
                                    {device.email&&<span className="text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={device.email}>{device.email}</span>}
                                 </div>
                                 {/* Right Side */}
                                 <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs self-end sm:self-center">
                                    {device.subscription_type&&(<span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200 whitespace-nowrap">{getSubscriptionTypeLabel(device.subscription_type)}</span>)}
                                    <span className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{(parseFloat(String(device.price ?? '0')) || 0).toLocaleString()} {t('common.currency', 'جنيه')}</span>
                                    <span className={`font-medium whitespace-nowrap ${device.subscription_end&&new Date(device.subscription_end)<now&&device.subscription_type!=='permanent'?'text-red-600 dark:text-red-400':'text-gray-600 dark:text-gray-400'}`}>
                                        {device.subscription_type==='permanent'?t('client.permanent', 'دائم'):formatDateForDisplay(device.subscription_end)} {/* Use t() with fallback */}
                                    </span>
                                 </div>
                               </div>
                             ))}
                           </div>
                         </td>
                       </tr>
                     )
                 ].filter(Boolean);
               })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!isLoadingStore && processedClients.length > 0 && totalPages > 1 && (
        <div dir={isRTL ? "rtl" : "ltr"} className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
            <span className="text-sm text-gray-600 dark:text-gray-400 order-1 sm:order-none">{t('pagination.pageInfo', 'صفحة {{currentPage}} من {{totalPages}}', { currentPage, totalPages })} {' - '} {t('pagination.totalItemsFiltered', 'إجمالي {{count}} عميل مطابق', { count: processedClients.length })}</span>
            <div className="flex items-center gap-2 order-2 sm:order-none">
                <Button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} variant="secondary" size="sm" aria-label={t('pagination.prev', 'السابق') as string}>
                  {isRTL ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
                </Button>
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden md:inline">{currentPage} / {totalPages}</span>
                <Button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} variant="secondary" size="sm" aria-label={t('pagination.next', 'التالي') as string}>
                  {isRTL ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
                </Button>
            </div>
            <form onSubmit={handlePageInput} className="flex items-center gap-2 order-3 sm:order-none" style={{ minWidth: 0 }}>
                <input aria-label={t('pagination.goto', 'اذهب إلى صفحة:') as string} name="pageNum" type="number" min={1} max={totalPages} placeholder={`${currentPage}`} className="w-16 p-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" dir="ltr"/>
                <Button type="submit" size="sm" variant="secondary">{t('pagination.go', 'اذهب')}</Button>
            </form>
        </div>
      )}

      {/* Client Details Modal */}
      {selectedClient && (
        <ClientDetailsModal client={selectedClient} agents={allAgentsFromStore} versionTypes={VERSION_TYPES} subscriptionTypes={SUBSCRIPTION_TYPES} isOpen={showDetailsModal} onClose={handleCloseModal} onSave={handleSaveChanges} onDelete={handleDeleteClient} currentUser={user}/>
      )}
    </div>
  );
};