import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createServerSupabaseClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const form = new formidable.IncomingForm();
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const backupFile = files.backupFile as formidable.File;
    if (!backupFile) {
      return res.status(400).json({ error: 'No backup file provided' });
    }

    const fileContent = fs.readFileSync(backupFile.filepath, 'utf8');
    const backupData = JSON.parse(fileContent);

    if (!backupData.clients || !backupData.devices || !backupData.metadata) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    const { error: deleteDevicesError } = await supabase
      .from('devices')
      .delete()
      .neq('id', 0);

    if (deleteDevicesError) throw deleteDevicesError;

    const { error: deleteClientsError } = await supabase
      .from('clients')
      .delete()
      .neq('id', 0);

    if (deleteClientsError) throw deleteClientsError;

    if (backupData.clients.length > 0) {
      const { error: insertClientsError } = await supabase
        .from('clients')
        .insert(backupData.clients);

      if (insertClientsError) throw insertClientsError;
    }

    if (backupData.devices.length > 0) {
      const { error: insertDevicesError } = await supabase
        .from('devices')
        .insert(backupData.devices);

      if (insertDevicesError) throw insertDevicesError;
    }

    res.status(200).json({ 
      success: true, 
      message: 'تم استعادة النسخة الاحتياطية بنجاح',
      stats: {
        clients: backupData.clients.length,
        devices: backupData.devices.length,
      }
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
}
