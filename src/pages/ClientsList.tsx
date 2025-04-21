import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import ReactDOM from 'react-dom';
import {
  Search,
  Smartphone,
  Laptop,
  Eye, ChevronRight, ChevronUp, ChevronDown, ChevronLeft,
  Copy, Check, Zap, AlertCircle, Clock, X, Filter
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ClientDetailsModal from '../components/ClientDetailsModal';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import { ClientType as ImportedClientType, Agent as ImportedAgent } from '../types/client.types';

// --- دالة تطبيع بيانات العميل ---
function normalizeClient(client: any): DisplayClientType {
  return {
    ...client,
    notes: client.notes ?? undefined,
  };
}

// Interface remains the same
interface DisplayClientType {
  id: string;
  client_name?: string;
  organization_name?: string;
  activity_type?: string;
  address?: string;
  phone?: string;
  phone2?: string;
  notes?: string | undefined;
  subscription_type?: string; // Note: This might be less relevant at the client level now
  subscription_start?: string | null; // Note: This might be less relevant at the client level now
  subscription_end?: string | null; // Note: This might be less relevant at the client level now
  agent_id?: string;
  deviceCount?: number;
  devices?: any[]; // Keep original devices for details modal
  mobileDevices?: any[];
  computerDevices?: any[];
  earliestEndDate?: string | null;
  subscriptionTypes?: string[]; // Combined from devices
  totalPrice?: number;
  mobilePrice?: number;
  computerPrice?: number;
  showDevices?: boolean;
  agent?: ImportedAgent | null | undefined;
  agents?: ImportedAgent[];
  created_by?: string;
  created_at?: string;
  activation_code?: string; // Note: This is device-specific, keep for search matching?
  device_type?: string; // Note: This is device-specific
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

// Chunking function remains useful for large ID lists during search
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const results: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}

const PAGE_SIZE = 50; // Define page size

export const ClientsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [copiedCodes, setCopiedCodes] = useState<{ [key: string]: boolean }>({});

  const copyActivationCode = useCallback((code: string, deviceId: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedCodes(prev => ({ ...prev, [deviceId]: true }));
        setTimeout(() => {
          setCopiedCodes(prev => {
            const newState = { ...prev };
            delete newState[deviceId];
            return newState;
          });
        }, 2000);
        toast.success(t('clientsList.copySuccess', 'تم نسخ رمز التفعيل'));
      })
      .catch((e: Error) => {
        toast.error(t('clientsList.copyError', 'فشل نسخ رمز التفعيل'));
      });
  }, [t]);

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const isFirstRender = useRef(true);
  const isFetchingRef = useRef(false);

  // --- State Management ---
  const [allFetchedClients, setAllFetchedClients] = useState<DisplayClientType[]>([]); // Holds ALL fetched data
  const [stableClients, setStableClients] = useState<DisplayClientType[]>([]); // Holds CURRENT PAGE data
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<'mobile' | 'computer' | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'created_at', direction: 'descending' }); // Default sort
  const [selectedClient, setSelectedClient] = useState<DisplayClientType | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [agents, setAgents] = useState<ImportedAgent[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingData, setIsLoadingData] = useState(false); // Renamed from isLoadingMore for clarity
  const [matchingDeviceIds, setMatchingDeviceIds] = useState<string[]>([]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- Data Processing and Pagination ---

  // Memoize processed data to avoid re-computation on every render
  const processedAndSortedClients = useMemo(() => {
    let clientsToProcess = [...allFetchedClients];

    // Apply Sorting Locally
    if (sortConfig) {
      clientsToProcess.sort((a, b) => {
        const { key, direction } = sortConfig;
        let valueA = (a as any)[key];
        let valueB = (b as any)[key];

        // Handle specific types or null/undefined
        if (key === 'earliestEndDate') {
             // Treat nulls based on direction (e.g., nulls last for ascending date)
             // Treat 'permanent' specifically if needed, or rely on null for sorting
             const dateA = valueA ? new Date(valueA).getTime() : (direction === 'ascending' ? Infinity : -Infinity);
             const dateB = valueB ? new Date(valueB).getTime() : (direction === 'ascending' ? Infinity : -Infinity);
             valueA = dateA;
             valueB = dateB;
        } else if (typeof valueA === 'string' && typeof valueB === 'string') {
          // Locale-sensitive string comparison
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
          // Consider using localeCompare for better multi-language sorting if needed:
          // return direction === 'ascending' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        } else {
           // Handle null/undefined consistently for numeric or other types
           if (valueA === undefined || valueA === null) valueA = (direction === 'ascending') ? -Infinity : Infinity;
           if (valueB === undefined || valueB === null) valueB = (direction === 'ascending') ? -Infinity : Infinity;
        }


        if (valueA < valueB) return direction === 'ascending' ? -1 : 1;
        if (valueA > valueB) return direction === 'ascending' ? 1 : -1;

         // Secondary sort by creation date (desc) if primary values are equal
         const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
         const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
         return createdAtB - createdAtA; // Descending order

      });
    }

    // --- فلترة العملاء "قريب الانتهاء" (أقل من أو يساوي 15 يوم) ---
    const now = new Date();
    const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

    if (activeFilter === 'expiring') {
      clientsToProcess = clientsToProcess.filter(client => {
        // دعم الأجهزة الدائمة (لا تُعرض)
        if (client.subscription_type === 'permanent' || client.subscription_end === null) return false;
        if (!client.subscription_end) return false;
        const endDate = new Date(client.subscription_end);
        const diff = endDate.getTime() - now.getTime();
        return diff > 0 && diff <= FIFTEEN_DAYS_MS;
      });
    }

    return clientsToProcess;
  }, [allFetchedClients, sortConfig, activeFilter]);

  // Effect to update stableClients (current page) when data, page, or sorting changes
  useEffect(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const newTotalPages = Math.ceil(processedAndSortedClients.length / PAGE_SIZE);

    setStableClients(processedAndSortedClients.slice(startIndex, endIndex));
    setTotalPages(newTotalPages || 1); // Ensure totalPages is at least 1

    // Adjust current page if it becomes invalid after data changes
    if (currentPage > newTotalPages && newTotalPages > 0) {
       setCurrentPage(newTotalPages);
    } else if (processedAndSortedClients.length === 0) {
        setCurrentPage(1); // Reset to page 1 if no data
    }

  }, [processedAndSortedClients, currentPage]);


  // --- Data Fetching ---
  const fetchAllClientsBatched = async (baseQuery: any, signal: AbortSignal): Promise<DisplayClientType[]> => {
    let allClients: DisplayClientType[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await baseQuery.range(from, from + batchSize - 1).abortSignal(signal);
      if (signal.aborted) throw new Error('Aborted');
      if (error) throw error;
      if (!data || data.length === 0) break;
      allClients = allClients.concat(data);
      if (data.length < batchSize) break; // آخر دفعة
      from += batchSize;
    }
    return allClients;
  };

  const fetchClients = useCallback(async (
      filterOverride?: string | null,
      deviceFilterOverride?: 'mobile' | 'computer' | null,
      searchTermOverride?: string | null
    ) => {
    if (isFetchingRef.current) {
      console.log('Fetch already in progress, skipping.');
      return;
    }
    isFetchingRef.current = true;
    setIsLoadingData(true);
    setStableClients([]); // Clear current page display immediately

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      await delay(100); // Short delay
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const effectiveFilter = filterOverride !== undefined ? filterOverride : activeFilter;
    const effectiveDeviceFilter = deviceFilterOverride !== undefined ? deviceFilterOverride : deviceFilter;
    const effectiveSearchTerm = searchTermOverride !== undefined ? searchTermOverride : searchTerm;

    // Reset temporary states for new fetch
    let localMatchingDeviceIds: string[] = [];

    console.log(`Fetching clients - Filter: ${effectiveFilter}, Device Filter: ${effectiveDeviceFilter}, Search: ${effectiveSearchTerm}`);

    try {
      let matchingClientIds: string[] | null = null; // Null means fetch all (or based on agent role)

      // 1. Determine Client IDs to fetch based on Search
      if (effectiveSearchTerm) {
        console.log('Searching for:', effectiveSearchTerm);
        matchingClientIds = []; // Initialize as empty, requires matches

        // 1.1 Search Devices
        const { data: deviceData, error: deviceError } = await supabase
          .from('devices')
          .select('id, client_id') // Only need IDs
          .or(`activation_code.ilike.%${effectiveSearchTerm}%,email.ilike.%${effectiveSearchTerm}%,notes.ilike.%${effectiveSearchTerm}%`)
          .abortSignal(signal);

        if (signal.aborted) throw new Error('Aborted');
        if (deviceError) console.error('Device search error:', deviceError);
        else if (deviceData?.length) {
            const deviceClientIds = [...new Set(deviceData.map(d => d.client_id))];
            localMatchingDeviceIds = deviceData.map(d => d.id); // Store matching device IDs
            (matchingClientIds as string[]).push(...deviceClientIds);
             console.log(`Found ${localMatchingDeviceIds.length} matching devices for ${deviceClientIds.length} clients.`);
        }

        // 1.2 Search Clients
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .or(`client_name.ilike.%${effectiveSearchTerm}%,organization_name.ilike.%${effectiveSearchTerm}%,phone.ilike.%${effectiveSearchTerm}%,phone2.ilike.%${effectiveSearchTerm}%,notes.ilike.%${effectiveSearchTerm}%`)
          .abortSignal(signal);

        if (signal.aborted) throw new Error('Aborted');
        if (clientError) console.error('Client search error:', clientError);
        else if (clientData?.length) {
          const clientIds = clientData.map(c => c.id);
          (matchingClientIds as string[]).push(...clientIds);
           console.log(`Found ${clientIds.length} matching clients.`);
        }

        // 1.3 Finalize Search IDs
        matchingClientIds = [...new Set(matchingClientIds as string[])];
         console.log(`Total unique clients from search: ${matchingClientIds.length}`);
        if (matchingClientIds.length === 0) {
          console.log('No clients match search term.');
          setAllFetchedClients([]);
          setMatchingDeviceIds([]);
          setIsLoadingData(false);
          isFetchingRef.current = false;
          return; // Exit early
        }
      }

      // Update state for matching device IDs from search
      setMatchingDeviceIds(localMatchingDeviceIds);


       // 2. Determine Client IDs based on Device Filter (if no search override)
       let deviceFilteredClientIds: string[] | null = null;
       if (effectiveDeviceFilter) {
         console.log(`Filtering by device type: ${effectiveDeviceFilter}`);
         const deviceType = effectiveDeviceFilter === 'mobile' ? 'android' : 'computer';
         const { data: deviceFilterData, error: deviceFilterError } = await supabase
           .from('devices')
           .select('id, client_id')
           .eq('device_type', deviceType)
           .abortSignal(signal);

         if (signal.aborted) throw new Error('Aborted');
         if (deviceFilterError) console.error('Device filter error:', deviceFilterError);
         else {
           deviceFilteredClientIds = []; // Requires matches
           if (deviceFilterData?.length) {
                deviceFilteredClientIds = [...new Set(deviceFilterData.map(d => d.client_id))];
              console.log(`Found ${deviceFilteredClientIds.length} clients with ${effectiveDeviceFilter} devices.`);

           }
             if (deviceFilteredClientIds.length === 0) {
               console.log(`No clients found for device filter: ${effectiveDeviceFilter}`);
               setAllFetchedClients([]);
               setMatchingDeviceIds([]);
               setIsLoadingData(false);
               isFetchingRef.current = false;
               return;
             }
         }
       }


      // 3. Combine ID filters (Search takes precedence, then device filter)
      let finalClientIds: string[] | null = matchingClientIds; // Start with search results
      if (finalClientIds === null && deviceFilteredClientIds !== null) {
        finalClientIds = deviceFilteredClientIds; // Use device filter if no search
      } else if (finalClientIds !== null && deviceFilteredClientIds !== null) {
        // Intersect search results and device filter results
        finalClientIds = finalClientIds.filter(id => deviceFilteredClientIds!.includes(id));
         console.log(`Clients after intersecting search and device filter: ${finalClientIds.length}`);
         if (finalClientIds.length === 0) {
            console.log('No clients match both search and device filter.');
             setAllFetchedClients([]);
             setMatchingDeviceIds([]); // Keep search match IDs though
             setIsLoadingData(false);
             isFetchingRef.current = false;
             return;
         }
      }

      // 4. Build Base Query
      // Select all needed fields, including relational data
       let query = supabase.from('clients').select(`
         *,
         devices (*),
         agent:agents (id, name)
       `);


      // 5. Apply Filters
      // 5.1 Agent Filter (Role-based or specific agent filter)
      if (effectiveFilter?.startsWith('agent_')) {
          const agentId = effectiveFilter.replace('agent_', '');
          console.log(`Filtering by agent ID: ${agentId}`);
          query = query.eq('agent_id', agentId);
      } else if (user?.role === 'agent' && user?.id) {
           console.log(`Filtering by logged-in agent ID: ${user.id}`);
           query = query.eq('agent_id', user.id);
      }

      // 5.2 Apply Combined Client ID Filter (from search/device filter)
       if (finalClientIds !== null) {
         console.log(`Applying final client ID filter (${finalClientIds.length} IDs)`);
          // Handle potentially large number of IDs by chunking
          if (finalClientIds.length > 200) {
              const batches = chunkArray(finalClientIds.filter(id => !!id), 200);
              let allClientsData: any[] = [];
              for (const [batchIdx, batch] of batches.entries()) {
                  if (!batch || batch.length === 0) continue;
                  console.log(`Fetching client data batch ${batchIdx + 1}/${batches.length}`);
                  const batchQuery = supabase.from('clients').select(`*, devices (*), agent:agents (id, name)`)
                                        .in('id', batch)
                                        // Re-apply agent filter if needed for correctness with chunking
                                        .eq(effectiveFilter?.startsWith('agent_') ? 'agent_id' : (user?.role === 'agent' ? 'agent_id' : 'id'), // Use a known column like 'id' if no agent filter
                                            effectiveFilter?.startsWith('agent_') ? effectiveFilter.replace('agent_', '') : (user?.role === 'agent' ? user.id : batch[0])) // Provide a value
                                        .abortSignal(signal);

                  const { data: batchData, error: batchError } = await batchQuery;
                  if (signal.aborted) throw new Error('Aborted');
                  if (batchError) {
                      console.error(`Error fetching client batch ${batchIdx + 1}:`, batchError);
                      throw batchError; // Propagate error
                  }
                  if (batchData) allClientsData.push(...batchData);
              }
              // Set query result to the combined batch data
              query = { data: allClientsData, error: null } as any; // Simulate query result structure
          } else if (finalClientIds.length > 0) {
            query = query.in('id', finalClientIds);
          } else {
             // Should have been handled earlier, but as a safeguard
             console.log("Final client ID list is empty, fetching no clients.");
              query = { data: [], error: null } as any;
          }

       }
        // 5.3 Other Filters (Subscription Status, No Devices etc.) - Apply *after* fetching
        // These often depend on device data, so filtering locally is more reliable.


      // 6. Execute Query (or use combined batch data)
      let clientsData: any[] = [];
      let fetchError: any = null;

       if (Array.isArray((query as any).data)) { // Check if it's already fetched batch data
           clientsData = (query as any).data;
       } else {
           console.log('Executing main Supabase query (batched)...');
           clientsData = await fetchAllClientsBatched(query, signal);
       }


      if (fetchError) {
        console.error('Error fetching clients:', fetchError);
        toast.error(t('errors.fetchClients', 'حدث خطأ أثناء جلب بيانات العملاء'));
        setAllFetchedClients([]);
        setIsLoadingData(false);
        isFetchingRef.current = false;
        return;
      }

      console.log(`Fetched ${clientsData.length} raw client records.`);

      // 7. Process Data and Apply Local Filters
      const showDevicesGlobally = !!effectiveSearchTerm || !!effectiveFilter || !!effectiveDeviceFilter;

      let processedClients = clientsData.map(client => {
        const devices = client.devices || [];
        const deviceCount = devices.length;
        const mobileDevices = devices.filter((d: any) => d.device_type === 'android');
        const computerDevices = devices.filter((d: any) => d.device_type === 'computer');

        let earliestEndDate: string | null = null;
        const subscriptionTypes: string[] = [];
        let totalPrice = 0;
        let mobilePrice = 0;
        let computerPrice = 0;

        if (deviceCount > 0) {
          const endDates = devices
            .map((d: any) => d.subscription_end ? new Date(d.subscription_end).getTime() : null)
            .filter((ts: number | null): ts is number => ts !== null) // Filter out nulls and ensure type
            .sort((a: number, b: number) => a - b); // Sort timestamps ascending

          if (endDates.length > 0) {
            earliestEndDate = new Date(endDates[0]).toISOString();
          }

          devices.forEach((d: any) => {
            if (d.subscription_type && !subscriptionTypes.includes(d.subscription_type)) {
              subscriptionTypes.push(d.subscription_type);
            }
            if (d.approval_status === 'approved') {
              const price = d.price || 0;
              totalPrice += price;
              if (d.device_type === 'android') mobilePrice += price;
              else if (d.device_type === 'computer') computerPrice += price;
            }
          });
        }

        return {
          ...client,
          deviceCount,
          devices, // Keep original devices array
          mobileDevices,
          computerDevices,
          earliestEndDate,
          subscriptionTypes,
          totalPrice,
          mobilePrice,
          computerPrice,
          // Set showDevices based on global flag or specific client match if needed later
          showDevices: showDevicesGlobally,
          agent: client.agent // Already selected
        };
      });

      // --- Apply Local Filters (that require processed data) ---
      const now = new Date();
      const soonDate = new Date();
      soonDate.setDate(now.getDate() + 7); // Example: expiring within 7 days

      if (effectiveFilter === 'active') {
          processedClients = processedClients.filter(c =>
              c.devices?.some((d: any) =>
                  d.approval_status === 'approved' &&
                  d.subscription_end &&
                  new Date(d.subscription_end) >= now
              ) || c.subscriptionTypes?.includes('permanent') // Include permanent approved
          );
          console.log(`Clients after local 'active' filter: ${processedClients.length}`);
      } else if (effectiveFilter === 'expired') {
          processedClients = processedClients.filter(c =>
              c.devices?.some((d: any) =>
                  d.approval_status === 'approved' &&
                  d.subscription_end &&
                  new Date(d.subscription_end) < now
              ) && !c.subscriptionTypes?.includes('permanent') // Exclude permanent
          );
           console.log(`Clients after local 'expired' filter: ${processedClients.length}`);
      } else if (effectiveFilter === 'expiring') {
          processedClients = processedClients.filter(c =>
              c.devices?.some((d: any) =>
                  d.approval_status === 'approved' &&
                  d.subscription_end &&
                  new Date(d.subscription_end) >= now &&
                  new Date(d.subscription_end) <= soonDate
              ) && !c.subscriptionTypes?.includes('permanent') // Exclude permanent
          );
           console.log(`Clients after local 'expiring' filter: ${processedClients.length}`);
      } else if (effectiveFilter === 'noDevices') {
          processedClients = processedClients.filter(c => c.deviceCount === 0);
           console.log(`Clients after local 'noDevices' filter: ${processedClients.length}`);
      } else if (effectiveFilter === 'allDevices'){
         // No filtering needed, just ensure devices are shown
          processedClients.forEach(c => c.showDevices = true);
          console.log('Showing all devices based on filter.');
      }


      console.log(`Final processed client count: ${processedClients.length}`);

      // 8. Update State
      // Use ReactDOM.flushSync for potentially smoother UI updates when resetting data
       ReactDOM.flushSync(() => {
            setAllFetchedClients(processedClients.map(normalizeClient)); // Update the full list
            setCurrentPage(1); // Reset to page 1 for new data/filters
        });
       // The useEffect watching processedAndSortedClients will handle setting stableClients

    } catch (error: any) {
      if (error.message !== 'Aborted' && error.name !== 'AbortError') {
        console.error('Unexpected error in fetchClients:', error);
        toast.error(t('errors.fetchClients', 'حدث خطأ أثناء جلب بيانات العملاء'));
         setAllFetchedClients([]); // Clear data on error
      } else {
         console.log("Fetch aborted successfully.");
      }
    } finally {
      setIsLoadingData(false);
      isFetchingRef.current = false;
       console.log("Fetch process finished.");
    }
  }, [
      activeFilter, deviceFilter, searchTerm, // Depend on filter/search state
      user, // Depend on user role/id
      t // Depend on translation function
     // Remove currentPage, sortConfig - they don't trigger a fetch, only local processing
   ]);

  // إصلاح خطأ notes: التأكد من أن جميع الكائنات من نوع DisplayClientType لا تحتوي على null في notes
  // --- تمت إزالة الدالة غير المستخدمة ---

   // --- Initial Load ---
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      console.log("Initial load: Fetching agents and initial clients.");
      const loadInitialData = async () => {
         try {
            setIsLoadingData(true); // Set loading true for initial fetch
            const { data: agentsData, error: agentsError } = await supabase
              .from('agents')
              .select('*');
            if (agentsError) throw agentsError;
            setAgents(agentsData || []);

            // Check URL params to set initial filters
             const params = new URLSearchParams(location.search);
             const agentIdParam = params.get('agent_id');
             const filterParam = params.get('filter');

             let initialFilter: string | null = null;
             let initialDeviceFilter: 'mobile' | 'computer' | null = null;

             if (agentIdParam) {
                 initialFilter = `agent_${agentIdParam}`;
             } else if (filterParam) {
                 switch (filterParam) {
                    case 'mobile':
                    case 'computer':
                         initialDeviceFilter = filterParam as 'mobile' | 'computer';
                         break;
                    case 'active':
                    case 'expired':
                    case 'expiring':
                    case 'permanent': // Note: 'permanent' filtering might need local logic adjustment
                    case 'noDevices':
                    case 'allDevices': // Added filter
                         initialFilter = filterParam;
                         break;
                     default:
                         break; // Keep filters null
                 }
             }

             // Set state *before* calling fetch
              setActiveFilter(initialFilter);
              setDeviceFilter(initialDeviceFilter);

              // Fetch initial client data based on derived filters
              await fetchClients(initialFilter, initialDeviceFilter, searchTerm); // Use initial values

          } catch (error: any) {
             if (error.name !== 'AbortError') {
                 console.error('Error loading initial data:', error);
                 toast.error(t('errors.loadData', 'حدث خطأ أثناء تحميل البيانات'));
                 setIsLoadingData(false); // Ensure loading is off on error
             }
         } finally {
             // setIsLoadingData(false); // FetchClients will set this false
         }
      };
      // Delay slightly to allow component to mount fully
       setTimeout(loadInitialData, 50);
    }

      // Cleanup abort controller
       return () => {
           if (abortControllerRef.current) {
               abortControllerRef.current.abort();
           }
       };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [location.search, t]); // Only re-run if URL search params change or language changes

  // --- تحديث قراءة الفلاتر من الـ URL وتطبيقها تلقائيًا ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // دعم جميع الفلاتر الممكنة
    const filterParam = params.get('filter'); // active, expired, expiring, all, ...
    const deviceFilterParam = params.get('deviceFilter'); // android, computer, ...

    // فلتر حالة الاشتراك
    if (filterParam && filterParam !== activeFilter) setActiveFilter(filterParam);
    if (!filterParam && activeFilter) setActiveFilter(null);

    // فلتر نوع الجهاز
    if (deviceFilterParam && deviceFilterParam !== deviceFilter) {
      if (deviceFilterParam === 'android') setDeviceFilter('mobile');
      else if (deviceFilterParam === 'computer') setDeviceFilter('computer');
      else setDeviceFilter(null);
    }
    if (!deviceFilterParam && deviceFilter) setDeviceFilter(null);

  }, [location.search]);

  // --- Search Debounce ---
   useEffect(() => {
       // Don't run on initial mount
       if (isFirstRender.current) return;

       const handler = setTimeout(() => {
           console.log("Search term changed, triggering fetch:", searchTerm);
           setCurrentPage(1); // Reset to page 1 on new search
           fetchClients(activeFilter, deviceFilter, searchTerm); // Fetch with current search term
       }, 500); // 500ms debounce

       return () => {
           clearTimeout(handler);
       };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [searchTerm]); // Re-run only when searchTerm changes


   // --- Real-time Subscriptions ---
    useEffect(() => {
        const handleDbChange = (payload: any) => {
            console.log('Database change detected:', payload.eventType, payload.table);
            // Re-fetch data with current filters/search
            // Add a small delay to potentially batch multiple rapid changes
            const debounceTimeout = setTimeout(() => {
                 fetchClients(activeFilter, deviceFilter, searchTerm);
             }, 1000); // 1 second delay

             return () => clearTimeout(debounceTimeout);
        };

        const clientsChannel = supabase
            .channel('clients-list-clients-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, handleDbChange)
            .subscribe();

        const devicesChannel = supabase
            .channel('clients-list-devices-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, handleDbChange)
            .subscribe();

         console.log("Subscribed to real-time updates for clients and devices.");

        return () => {
            console.log("Unsubscribing from real-time updates.");
            supabase.removeChannel(clientsChannel);
            supabase.removeChannel(devicesChannel);
        };
    // Re-subscribe if filters change, as fetch logic depends on them
    }, [fetchClients, activeFilter, deviceFilter, searchTerm]);



  // --- UI Handlers ---

  const handleFilterChange = useCallback((newFilter: string | null, newDeviceFilter: 'mobile' | 'computer' | null) => {
    setActiveFilter(newFilter);
    setDeviceFilter(newDeviceFilter);
    setCurrentPage(1); // Reset page
    // Fetch immediately with new filters
    fetchClients(newFilter, newDeviceFilter, searchTerm);
  }, [fetchClients, searchTerm]); // Include searchTerm


  const requestSort = useCallback((key: string) => {
    console.log("Sorting requested for key:", key);
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    // Reset to page 1 when sorting changes, common UX pattern
    setCurrentPage(1);
    setSortConfig({ key, direction });
    // No fetch needed, sorting is local via useMemo/useEffect
  }, [sortConfig]);

  const toggleShowDevices = useCallback((clientId: string) => {
    setAllFetchedClients(prevClients =>
      prevClients.map(client =>
        client.id === clientId
          ? { ...client, showDevices: !client.showDevices }
          : client
      )
    );
    // Note: This change will automatically reflect in stableClients via the processing pipeline
  }, []);

  const handleShowDetails = useCallback((client: DisplayClientType) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedClient(null);
  }, []);

  const handleSaveChanges = useCallback(async (updatedClient: DisplayClientType | ImportedClientType) => {
    // This function can handle both updates and potentially device additions/updates later
    console.log("Saving changes for client:", updatedClient.id);
    // Assume handleUpdateClient logic is called if it's just client fields
    // Or add specific logic for device changes if the modal handles that
    await handleUpdateClient(updatedClient); // Reuse existing update logic for now
    handleCloseModal();
    // Re-fetch data to ensure consistency after updates
     fetchClients(activeFilter, deviceFilter, searchTerm);
  }, [handleCloseModal, fetchClients, activeFilter, deviceFilter, searchTerm]); // Add deps


  const handleDeleteClient = useCallback(async (clientId: string) => {
    try {
        // Consider deleting associated devices or handling constraints
        console.log("Attempting to delete client and associated devices:", clientId);

         // 1. Delete associated devices (optional, depends on requirements)
         const { error: deviceError } = await supabase
             .from('devices')
             .delete()
             .eq('client_id', clientId);

         if (deviceError) {
             console.error("Error deleting associated devices:", deviceError);
             // Decide if you want to proceed with client deletion or stop
             // toast.error(t('clientsList.deleteDevicesError', 'Failed to delete associated devices.'));
             // return; // Stop if devices must be deleted first
         } else {
             console.log("Associated devices deleted (if any).");
         }


      // 2. Delete the client
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (clientError) throw clientError;

      toast.success(t('clientsList.deleteSuccess', 'تم حذف العميل بنجاح'));
      handleCloseModal();
      // No need to fetch here, let real-time update handle it, or remove locally:
       setAllFetchedClients(prev => prev.filter(c => c.id !== clientId));

    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast.error(t('clientsList.deleteError', 'حدث خطأ أثناء حذف العميل'));
    }
  }, [handleCloseModal, t]);

  const handleUpdateClient = useCallback(async (updatedClient: ImportedClientType | DisplayClientType) => {
    try {
       console.log("Updating client data:", updatedClient.id);
      const updateData: Partial<ImportedClientType> = {
        client_name: updatedClient.client_name,
        organization_name: updatedClient.organization_name,
        activity_type: updatedClient.activity_type,
        address: updatedClient.address,
        phone: updatedClient.phone,
        phone2: updatedClient.phone2,
        notes: updatedClient.notes,
        agent_id: updatedClient.agent_id
      };

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', updatedClient.id);

      if (error) throw error;

      toast.success(t('clientsList.updateSuccess', 'تم تحديث بيانات العميل بنجاح'));
      handleCloseModal(); // Close modal first

      // Option 1: Let real-time handle the update (may have delay)
      // Option 2: Update local state immediately for responsiveness
       setAllFetchedClients(prev => prev.map(c =>
           c.id === updatedClient.id ? { ...c, ...updateData, agent: agents.find(ag => ag.id === updatedClient.agent_id) ?? null } : c
       ));
       // Option 3: Re-fetch (simplest if real-time isn't reliable or immediate update is complex)
       // fetchClients(activeFilter, deviceFilter, searchTerm);


    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error(t('clientsList.updateError', 'حدث خطأ أثناء تحديث بيانات العميل'));
    }
  }, [handleCloseModal, t, agents]); // Add agents


  // --- Helper Functions ---
  const getSubscriptionTypeLabel = useCallback((value: string) => {
    const type = SUBSCRIPTION_TYPES.find(type => type.value === value);
    return type ? (i18n.language === 'ar' ? type.label : type.labelEn) : value;
  }, [i18n.language]);

  const formatDateForDisplay = useCallback((dateStr?: string | Date | null): string => {
    if (!dateStr) return '-';
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(date.getTime())) return '-';
      return format(date, 'yyyy/MM/dd');
    } catch (error: any) {
      console.error('Error formatting date:', error);
      return '-';
    }
  }, []);

  // --- Rendering ---

  const SkeletonRow = useCallback(() => (
    <tr className="animate-pulse">
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div></td>
      <td className="px-4 py-4 whitespace-nowrap"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div></td>
    </tr>
  ), []);

   // Memoize Filters rendering unless dependencies change
   const renderedFilters = useMemo(() => (
       <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl shadow-sm">
           <div
               className="flex justify-between items-center cursor-pointer mb-4" // Increased mb
               onClick={() => setFiltersOpen(!filtersOpen)}
           >
               <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
                   <Filter className="inline ltr:mr-2 rtl:ml-2 h-4 w-4" />
                   {t('clientsList.filters', 'فلترة العملاء')}
               </h2>
               {filtersOpen ? <ChevronUp /> : <ChevronDown />}
           </div>

           {filtersOpen && (
               <div className="space-y-4 animate-fade-in"> {/* Added animation */}
                   {/* Device Type Filter */}
                   <div>
                       <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                           {t('clientsList.deviceType', 'نوع الجهاز')}:
                       </h3>
                       <div className="flex flex-wrap gap-2">
                           <Button
                               onClick={() => handleFilterChange('allDevices', null)}
                               variant={activeFilter === 'allDevices' ? 'primary' : 'secondary'}
                               size="sm"
                               className="flex items-center gap-1"
                           >
                               <Eye className="w-3 h-3" />
                               <span>{t('clientsList.allDevicesFilter', 'جميع الاشتراكات')}</span>
                               {activeFilter === 'allDevices' && <Check className="w-3 h-3 ltr:ml-1 rtl:mr-1 text-white" />}
                           </Button>
                           <Button
                               onClick={() => handleFilterChange(null, deviceFilter === 'mobile' ? null : 'mobile')}
                               variant={deviceFilter === 'mobile' ? 'primary' : 'secondary'}
                               size="sm"
                               className="flex items-center gap-1"
                           >
                               <Smartphone className="w-3 h-3" />
                               <span>{t('clientsList.mobileFilter', 'اشتراكات الهاتف')}</span>
                               {deviceFilter === 'mobile' && <Check className="w-3 h-3 ltr:ml-1 rtl:mr-1 text-white" />}
                           </Button>
                           <Button
                               onClick={() => handleFilterChange(null, deviceFilter === 'computer' ? null : 'computer')}
                               variant={deviceFilter === 'computer' ? 'primary' : 'secondary'}
                               size="sm"
                               className="flex items-center gap-1"
                           >
                               <Laptop className="w-3 h-3" />
                               <span>{t('clientsList.computerFilter', 'اشتراكات الكمبيوتر')}</span>
                               {deviceFilter === 'computer' && <Check className="w-3 h-3 ltr:ml-1 rtl:mr-1 text-white" />}
                           </Button>
                       </div>
                   </div>

                   {/* Subscription Status Filter */}
                   <div>
                       <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                           {t('clientsList.subscriptionStatus', 'حالة الاشتراك')}:
                       </h3>
                       <div className="flex flex-wrap gap-2">
                           {[
                               { value: 'active', icon: Zap, label: t('clientsList.activeFilter', 'نشط') },
                               { value: 'expired', icon: AlertCircle, label: t('clientsList.expiredFilter', 'منتهي') },
                               { value: 'expiring', icon: Clock, label: t('clientsList.expiringFilter', 'قريب الانتهاء') },
                               { value: 'noDevices', icon: X, label: t('clientsList.noDevicesFilter', 'بدون أجهزة') }
                           ].map((filter) => (
                               <Button
                                   
                                   onClick={() => handleFilterChange(activeFilter === filter.value ? null : filter.value, null)}
                                   variant={activeFilter === filter.value ? 'primary' : 'secondary'}
                                   size="sm"
                                   className="flex items-center gap-1"
                               >
                                   <filter.icon className="w-3 h-3" />
                                   <span>{filter.label}</span>
                                   {activeFilter === filter.value && <Check className="w-3 h-3 ltr:ml-1 rtl:mr-1 text-white" />}
                               </Button>
                           ))}
                       </div>
                   </div>

                   {/* Agent Filter (Admins only) */}
                   {(user?.role === 'admin' || user?.role === 'super_admin') && agents.length > 0 && (
                       <div>
                           <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                               {t('clientsList.agents', 'المندوبين')}:
                           </h3>
                           <select
                               className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white bg-white"
                               value={activeFilter?.startsWith('agent_') ? activeFilter : ''}
                               onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange(e.target.value || null, null)} // Pass null if empty string
                           >
                               <option value="">{t('clientsList.selectAgent', 'الكل / اختر المندوب...')}</option>
                               {agents.map(agent => (
                                   <option key={agent.id} value={`agent_${agent.id}`}>
                                       {agent.name}
                                   </option>
                               ))}
                           </select>
                       </div>
                   )}

                   {/* Clear Filters Button */}
                   {(activeFilter || deviceFilter) && (
                       <div className="pt-2">
                           <Button
                               onClick={() => handleFilterChange(null, null)}
                               variant="danger" // Use danger variant for clearing
                               size="sm"
                               className="flex items-center gap-1"
                           >
                               <X className="w-4 h-4" />
                               {t('clientsList.clearFilters', 'إلغاء جميع الفلاتر')}
                           </Button>
                       </div>
                   )}
               </div>
           )}
       </div>
   ), [filtersOpen, t, activeFilter, deviceFilter, user, agents, handleFilterChange]);

  const handlePageInput = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem('pageNum') as HTMLInputElement).value;
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      setCurrentPage(num);
    }
  }, [totalPages]);

  // Memoize Search rendering
  const renderedSearch = useMemo(() => (
    <div className="relative mb-6">
      <span className="absolute ltr:left-3 rtl:right-3 top-3 text-gray-400">
        <Search className="h-5 w-5" />
      </span>
      <input
        type="text"
        placeholder={t('clientsList.searchPlaceholder', 'ابحث بالاسم، الهاتف، الملاحظات، البريد الإلكتروني، رمز التفعيل...')}
        className="w-full p-3 ltr:pl-10 rtl:pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
        value={searchTerm}
        onChange={() => setSearchTerm('')} // Removed e from here
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')} // Clear search term, useEffect will trigger fetch
          className="absolute ltr:right-3 rtl:left-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={t('clientsList.clearSearch', 'Clear search') as string}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  ), [searchTerm, t]);


  // --- Main Return ---
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('clientsList.title', 'قائمة العملاء')}</h1>
        <Button
            onClick={() => navigate('/dashboard')}
            variant="secondary"
            size="sm"
            className="flex items-center self-start md:self-center" // Adjust alignment
        >
            {isRTL ? <ChevronRight className="h-5 w-5 ml-1" /> : <ChevronLeft className="h-5 w-5 mr-1" />}
            <span>{t('common.backToDashboard', 'العودة للوحة التحكم')}</span>
        </Button>
      </div>

      {/* Filters and Search */}
      {renderedFilters}
      {/* Removed Active Filter Display - integrated into filter buttons/select */}
      {renderedSearch}

      {/* Table Area */}
      <div className="overflow-x-auto shadow-md rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          {/* Table Header */}
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
             {/* Header Row */}
            <tr>
              {/* Client Name */}
              <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-start cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[25%]" onClick={() => requestSort('client_name')}>
                <div className="flex items-center justify-start gap-1">
                  <span>{t('clientsList.clientName', 'اسم العميل')}</span>
                  {sortConfig?.key === 'client_name' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                </div>
              </th>
              {/* Phone */}
               <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]" onClick={() => requestSort('phone')}>
                 <div className="flex items-center justify-center gap-1">
                   <span>{t('clientsList.phone', 'الهاتف')}</span>
                   {sortConfig?.key === 'phone' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                 </div>
               </th>
               {/* Agent */}
               <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]" onClick={() => requestSort('agent_id')}>
                 <div className="flex items-center justify-center gap-1">
                   <span>{t('clientsList.agent', 'المندوب')}</span>
                   {/* Note: Sorting by agent_id might not be meaningful without joining agent name. Consider sorting by agent.name if possible or disabling sort here. */}
                   {sortConfig?.key === 'agent_id' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                 </div>
               </th>
               {/* Subscriptions (Device Count) */}
               <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[12%]" onClick={() => requestSort('deviceCount')}>
                 <div className="flex items-center justify-center gap-1">
                   <span>{t('clientsList.subscriptions', 'الاشتراكات')}</span>
                   {sortConfig?.key === 'deviceCount' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                 </div>
               </th>
               {/* Dues (Total Price) */}
               <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[12%]" onClick={() => requestSort('totalPrice')}>
                 <div className="flex items-center justify-center gap-1">
                   <span>{t('clientsList.dues', 'المستحقات')}</span>
                   {sortConfig?.key === 'totalPrice' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                 </div>
               </th>
               {/* Expiry Date */}
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-[15%]" onClick={() => requestSort('earliestEndDate')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>{t('clientsList.expiryDate', 'انتهاء الصلاحية')}</span>
                    {sortConfig?.key === 'earliestEndDate' && (sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                {/* Actions */}
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center w-[6%]">
                  {t('clientsList.actions', 'إجراءات')}
                </th>
              </tr>
          </thead>
          {/* Table Body */}
           <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoadingData ? (
              // Show skeleton rows covering the table width
              Array.from({ length: 10 }).map((_, index) => (
  <React.Fragment key={`skeleton-${index}`}>
    <SkeletonRow />
  </React.Fragment>
))
            ) : stableClients.length > 0 ? (
                stableClients.map(client => (
                <React.Fragment key={client.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 group">
                     {/* Client Name Cell */}
                     <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white align-top w-[25%]">
                       <div className="flex items-center justify-between">
                          <span
                            className="truncate max-w-[150px] md:max-w-[200px]"
                            title={client.client_name || client.organization_name || '-'}
                          >
                            {client.client_name || client.organization_name || '-'}
                          </span>
                         <button
                           onClick={() => toggleShowDevices(client.id)}
                           className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                           title={client.showDevices ? t('actions.hideDevices', 'إخفاء الاشتراكات') : t('actions.showDevices', 'عرض الاشتراكات') as string}
                         >
                           {client.showDevices ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                         </button>
                       </div>
                     </td>
                     {/* Phone */}
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top dir-ltr w-[15%]">
                        {client.phone || '-'}
                     </td>
                     {/* Agent */}
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top w-[15%]">
                       <div
                            className="truncate max-w-[100px] mx-auto"
                            title={typeof client.agent === 'object' && client.agent && 'name' in client.agent ? client.agent.name || '-' : '-'}
                        >
                            {typeof client.agent === 'object' && client.agent && 'name' in client.agent ? client.agent.name || '-' : '-'}
                        </div>
                     </td>
                     {/* Subscriptions */}
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top w-[12%]">
                        {client.deviceCount && client.deviceCount > 0 ? (
                           <div className="flex flex-col items-center space-y-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {client.deviceCount} {t('clientsList.deviceCount', 'اشتراك', { count: client.deviceCount })}
                                </span>
                                {/* Status Indicators */}
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                   {(() => {
                                        const approved = client.devices?.filter(d => d.approval_status === 'approved').length || 0;
                                        const pending = client.devices?.filter(d => d.approval_status !== 'approved' && d.approval_status !== 'rejected').length || 0;
                                        const rejected = client.devices?.filter(d => d.approval_status === 'rejected').length || 0;
                                        return (
                                            <>
                                            {approved > 0 && <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400" title={`${approved} ${t('devices.approved','مقبول')}`}><Check size={12} /><span className="text-xs">{approved}</span></span>}
                                            {pending > 0 && <span className="flex items-center gap-0.5 text-yellow-600 dark:text-yellow-400" title={`${pending} ${t('devices.pending','معلق')}`}><Clock size={12} /><span className="text-xs">{pending}</span></span>}
                                            {rejected > 0 && <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400" title={`${rejected} ${t('devices.rejected','مرفوض')}`}><X size={12} /><span className="text-xs">{rejected}</span></span>}
                                            </>
                                        );
                                   })()}
                                </div>
                            </div>
                        ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                {t('clientsList.noSubscriptions', 'لا يوجد')}
                            </span>
                        )}
                      </td>
                      {/* Dues */}
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top font-mono w-[12%]">
                         {client.totalPrice != null && client.totalPrice > 0 ? (
                           <span className={`font-semibold ${client.totalPrice > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                               {client.totalPrice.toLocaleString()} {t('common.currency', 'جنيه')}
                           </span>
                         ) : (
                             <span>0 {t('common.currency', 'جنيه')}</span>
                         )}
                     </td>
                     {/* Expiry Date */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center align-top w-[15%]">
                        {client.earliestEndDate ? (
                           <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${new Date(client.earliestEndDate) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                               {formatDateForDisplay(client.earliestEndDate)}
                           </span>
                        ) : client.subscriptionTypes?.includes('permanent') ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                {t('client.permanent', 'دائم')}
                            </span>
                        ) : client.deviceCount && client.deviceCount > 0 ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                {t('clientsList.noExpiryDate', 'غير محدد')}
                            </span>
                        ) : (
                            <span>-</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center align-top w-[6%]">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            onClick={() => handleShowDetails(client)}
                            variant="secondary"
                            size="sm"
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                            aria-label={t('actions.viewDetails', 'عرض التفاصيل') as string}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Add other actions like edit/delete if needed, maybe within the modal */}
                        </div>
                      </td>
                    </tr>
                    {/* Device Details Row (Conditional) */}
                     {client.showDevices && (
                         <tr className="bg-gray-50 dark:bg-gray-800/50">
                             <td colSpan={7} className="px-4 py-3">
                                 <div className="space-y-2">
                                     {client.devices && client.devices.length > 0 ? (
                                          client.devices
                                           // Optionally filter devices based on matchingDeviceIds if searchTerm is active
                                            .filter(device => !searchTerm || matchingDeviceIds.includes(device.id))
                                            // Optionally filter devices based on deviceFilter if active
                                             .filter(device => !deviceFilter || (deviceFilter === 'mobile' && device.device_type === 'android') || (deviceFilter === 'computer' && device.device_type === 'computer'))
                                            .map(device => (
                                             <div key={device.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded border ${
                                                 device.approval_status === 'approved' ? 'border-green-200 dark:border-green-700 bg-green-50/30 dark:bg-green-900/10' :
                                                 device.approval_status === 'rejected' ? 'border-red-200 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10' :
                                                 'border-yellow-200 dark:border-yellow-700 bg-yellow-50/30 dark:bg-yellow-900/10'
                                             }`}>
                                                 {/* Left Side: Type, Code, Status */}
                                                 <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${device.device_type === 'android' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'}`}>
                                                          {device.device_type === 'android' ? <Smartphone size={12} className="ltr:mr-1 rtl:ml-1"/> : <Laptop size={12} className="ltr:mr-1 rtl:ml-1"/>}
                                                          {device.device_type === 'android' ? t('devices.mobile','هاتف') : t('devices.computer','كمبيوتر')}
                                                      </span>
                                                      <div className="flex items-center font-mono text-gray-700 dark:text-gray-300" title={device.activation_code}>
                                                          <span className="truncate max-w-[100px] sm:max-w-[120px]">{device.activation_code}</span>
                                                          <button
                                                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); copyActivationCode(device.activation_code, device.id); }}
                                                              className="ml-1 p-0.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                                                              title={t('clientsList.copyCode', 'نسخ الرمز') as string}
                                                           >
                                                               {copiedCodes[device.id] ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                                           </button>
                                                      </div>
                                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                          device.approval_status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                                          device.approval_status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                                      }`}>
                                                          {device.approval_status === 'approved' ? t('devices.approved','مقبول') :
                                                           device.approval_status === 'rejected' ? t('devices.rejected','مرفوض') :
                                                           t('devices.pending','معلق')}
                                                      </span>
                                                      {device.email && <span className="text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={device.email}>{device.email}</span>}
                                                 </div>
                                                 {/* Right Side: Subscription, Price, Expiry */}
                                                 <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs self-end sm:self-center">
                                                     {device.subscription_type && (
                                                         <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                             {getSubscriptionTypeLabel(device.subscription_type)}
                                                         </span>
                                                     )}
                                                      <span className="font-medium text-gray-800 dark:text-gray-200">
                                                         {(device.price || 0).toLocaleString()} {t('common.currency', 'جنيه')}
                                                     </span>
                                                     <span className={`font-medium ${device.subscription_end && new Date(device.subscription_end) < new Date() && device.subscription_type !== 'permanent' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                          {device.subscription_type === 'permanent' ? t('client.permanent', 'دائم') : formatDateForDisplay(device.subscription_end)}
                                                      </span>
                                                 </div>
                                             </div>
                                         ))
                                     ) : (
                                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">{t('clientsList.noDevicesForClient', 'لا توجد اشتراكات مسجلة لهذا العميل.')}</p>
                                     )}
                                 </div>
                             </td>
                         </tr>
                     )}
                   </React.Fragment>
                 ))
            ) : (
              // No results row
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm || activeFilter || deviceFilter
                    ? t('clientsList.noClientsMatch', 'لا يوجد عملاء يطابقون معايير البحث أو الفلترة الحالية.')
                    : t('clientsList.noClientsYet', 'لم يتم إضافة عملاء بعد.')
                  }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
       {!isLoadingData && totalPages > 1 && (
           <div
             dir="rtl"
             className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4 w-full"
             data-component-name="ClientsList"
           >
               <div className="flex items-center gap-2">
                   {/* زر الصفحة السابقة (يسار في RTL) */}
                   <Button
                       onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                       disabled={currentPage === 1}
                       variant="secondary"
                       size="sm"
                       aria-label={t('pagination.prev', 'الصفحة السابقة') as string}
                   >
                       <ChevronRight className="h-4 w-4" />
                   </Button>
                   {/* أرقام الصفحات: 1 على اليمين، الأخيرة على اليسار */}
                   {(() => {
                       const pageButtons = [];
                       for (let page = 1; page <= totalPages; page++) {
                           // إظهار أول وآخر صفحتين وحول الصفحة الحالية
                           if (
                             page === 1 ||
                             page === totalPages ||
                             (page >= currentPage - 1 && page <= currentPage + 1)
                           ) {
                             pageButtons.push(
                               <span key={`page-${page}`} className="inline-block">
                                 <Button
                                   onClick={() => setCurrentPage(page)}
                                   variant={currentPage === page ? 'primary' : 'secondary'}
                                   size="sm"
                                   className="w-8 h-8 text-xs"
                                 >
                                   {page}
                                 </Button>
                               </span>
                             );
                           } else if (
                             page === currentPage - 2 ||
                             page === currentPage + 2
                           ) {
                             pageButtons.push(
                               <span key={`ellipsis-${page}`} className="px-1 text-gray-500">...</span>
                             );
                           }
                         }
                         return pageButtons;
                       })()}
                   {/* زر الصفحة التالية (يمين في RTL) */}
                   <Button
                       onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                       disabled={currentPage === totalPages}
                       variant="secondary"
                       size="sm"
                       aria-label={t('pagination.next', 'الصفحة التالية') as string}
                   >
                       <ChevronLeft className="h-4 w-4" />
                   </Button>
               </div>
               {/* إدخال رقم الصفحة مباشرة */}
               <form
                 onSubmit={handlePageInput}
                 className="flex items-center gap-2"
                 style={{ minWidth: 0 }}
               >
                 <label htmlFor="pageNumInput" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                   {t('pagination.goto', 'اذهب إلى صفحة:')}
                 </label>
                 <input
                   id="pageNumInput"
                   name="pageNum"
                   type="number"
                   min={1}
                   max={totalPages}
                   defaultValue={currentPage}
                   className="w-16 p-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                   dir="ltr"
                 />
                 <Button type="submit" size="sm" variant="secondary" className="px-2 py-1 text-xs">
                   {t('pagination.go', 'اذهب')}
                 </Button>
               </form>
               <span className="text-sm text-gray-600 dark:text-gray-400 mt-2 sm:mt-0">
                 {t('pagination.pageInfo', 'صفحة {{currentPage}} من {{totalPages}}', { currentPage, totalPages })}
                 {' - '}
                 {t('pagination.totalItems', 'إجمالي {{count}} عميل', { count: allFetchedClients.length })}
               </span>
           </div>
       )}

      {/* Client Details Modal */}
      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient as any} // Cast might be needed if types diverge
          agents={agents}
          versionTypes={VERSION_TYPES}
          subscriptionTypes={SUBSCRIPTION_TYPES}
          isOpen={showDetailsModal}
          onClose={handleCloseModal}
          onSave={handleSaveChanges} // Use the combined save handler
          onDelete={handleDeleteClient}
          currentUser={user}
          // Pass refresh function if modal needs to trigger data reload independently
           // onRefreshNeeded={() => fetchClients(activeFilter, deviceFilter, searchTerm)}
        />
      )}
    </div>
  );
};