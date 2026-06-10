import { supabase } from '../lib/supabase';

export interface BackupData {
  clients: any[];
  devices: any[];
  timestamp: string;
  version: string;
}

export const createBackup = async (): Promise<BackupData> => {
  try {
    // استرجاع بيانات العملاء
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');
    
    if (clientsError) throw clientsError;

    // استرجاع بيانات الأجهزة
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*');
    
    if (devicesError) throw devicesError;

    // إنشاء كائن النسخة الاحتياطية
    const backupData: BackupData = {
      clients: clients || [],
      devices: devices || [],
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    return backupData;
  } catch (error) {
    console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
    throw new Error('فشل في إنشاء النسخة الاحتياطية');
  }
};

export const restoreBackup = async (backupData: BackupData): Promise<void> => {
  try {
    // التحقق من صحة بيانات النسخة الاحتياطية
    if (!backupData.clients || !backupData.devices || !backupData.timestamp || !backupData.version) {
      throw new Error('بيانات النسخة الاحتياطية غير صالحة');
    }

    // حذف البيانات الحالية
    const { error: deleteClientsError } = await supabase
      .from('clients')
      .delete()
      .not('id', 'is', null);
    
    if (deleteClientsError) throw deleteClientsError;

    const { error: deleteDevicesError } = await supabase
      .from('devices')
      .delete()
      .not('id', 'is', null);
    
    if (deleteDevicesError) throw deleteDevicesError;

    // إعادة إدخال بيانات العملاء
    if (backupData.clients.length > 0) {
      const { error: insertClientsError } = await supabase
        .from('clients')
        .insert(backupData.clients);
      
      if (insertClientsError) throw insertClientsError;
    }

    // إعادة إدخال بيانات الأجهزة
    if (backupData.devices.length > 0) {
      const { error: insertDevicesError } = await supabase
        .from('devices')
        .insert(backupData.devices);
      
      if (insertDevicesError) throw insertDevicesError;
    }
  } catch (error) {
    console.error('خطأ في استعادة النسخة الاحتياطية:', error);
    throw new Error('فشل في استعادة النسخة الاحتياطية');
  }
};
