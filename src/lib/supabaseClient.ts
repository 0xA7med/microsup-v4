import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// دوال النسخ الاحتياطي
export const createBackup = async () => {
  try {
    // جلب بيانات العملاء
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) throw clientsError;

    // جلب بيانات الأجهزة
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*');

    if (devicesError) throw devicesError;

    // جلب بيانات الوكلاء
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*');

    if (agentsError) throw agentsError;

    // إنشاء كائن النسخ الاحتياطي
    const backupData = {
      version: '4.0.0',
      timestamp: new Date().toISOString(),
      clients: clients || [],
      devices: devices || [],
      agents: agents || []
    };

    // حفظ معلومات النسخ الاحتياطي في قاعدة البيانات
    const stats = {
      clients: clients?.length || 0,
      devices: devices?.length || 0,
      agents: agents?.length || 0
    };

    const { error } = await supabase.from('backups').insert({
      data: backupData,
      stats: stats,
      file_name: `microsup_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`
    });

    if (error) throw error;

    return backupData;
  } catch (error) {
    console.error('خطأ في إنشاء النسخ الاحتياطي:', error);
    throw error;
  }
};

export const restoreBackup = async (backupData: any) => {
  try {
    // حذف البيانات الحالية
    await supabase.from('devices').delete().neq('id', 0);
    await supabase.from('clients').delete().neq('id', 0);
    await supabase.from('agents').delete().neq('id', 0);

    // استعادة بيانات العملاء
    for (const client of backupData.clients) {
      // تنظيف البيانات للتأكد من توافقها مع قاعدة البيانات
      const cleanClient = {
        client_name: client.client_name,
        organization_name: client.organization_name,
        activity_type: client.activity_type,
        phone: client.phone,
        phone2: client.phone2 || null,
        address: client.address,
        notes: client.notes || null,
        agent_id: client.agent_id
      };

      // إدراج العميل واسترجاع المعرف الجديد
      const { data: insertedClient, error: clientError } = await supabase
        .from('clients')
        .insert(cleanClient)
        .select('id');

      if (clientError) throw clientError;

      // استعادة أجهزة هذا العميل
      const clientDevices = backupData.devices.filter(
        (d: any) => d.client_id === client.id
      );

      for (const device of clientDevices) {
        const cleanDevice = {
          client_id: insertedClient?.[0]?.id,
          activation_code: device.activation_code,
          subscription_start: device.subscription_start,
          subscription_end: device.subscription_end,
          subscription_type: device.subscription_type,
          device_type: device.device_type,
          notes: device.notes || null,
          approval_status: device.approval_status || 'pending'
        };

        await supabase.from('devices').insert(cleanDevice);
      }
    }

    // استعادة بيانات الوكلاء إذا كانت موجودة
    if (backupData.agents && backupData.agents.length > 0) {
      for (const agent of backupData.agents) {
        const cleanAgent = {
          agent_name: agent.agent_name,
          phone: agent.phone,
          address: agent.address || null,
          notes: agent.notes || null
        };

        await supabase.from('agents').insert(cleanAgent);
      }
    }
  } catch (error) {
    console.error('خطأ في استعادة النسخ الاحتياطي:', error);
    throw error;
  }
};

export const getBackupHistory = async () => {
  try {
    const { data, error } = await supabase
      .from('backups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('خطأ في جلب سجل النسخ الاحتياطي:', error);
    throw error;
  }
};
