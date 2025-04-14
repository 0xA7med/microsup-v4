import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import formidable from 'formidable';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ClientImport {
  name: string;
  phone: string;
  phone2?: string;
  address?: string;
  business_type?: string;
  notes?: string;
  devices?: {
    device_name: string;
    subscription_type: string;
    subscription_start: string;
    subscription_end: string;
  }[];
}

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

    const clientsFile = files.clientsFile as formidable.File;
    if (!clientsFile) {
      return res.status(400).json({ error: 'No clients file provided' });
    }

    const fileBuffer = fs.readFileSync(clientsFile.filepath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    const clientsToImport: ClientImport[] = rawData.map((row: any) => ({
      name: row.name || row['الاسم'],
      phone: row.phone || row['رقم الهاتف'],
      phone2: row.phone2 || row['رقم الهاتف 2'] || null,
      address: row.address || row['العنوان'] || null,
      business_type: row.business_type || row['نوع النشاط'] || null,
      notes: row.notes || row['ملاحظات'] || null,
      devices: row.devices ? JSON.parse(row.devices) : [],
    }));

    const validClients = clientsToImport.filter(client => 
      client.name && client.phone && client.name.trim() !== '' && client.phone.trim() !== ''
    );

    if (validClients.length === 0) {
      return res.status(400).json({ error: 'No valid clients found in the file' });
    }

    let importedCount = 0;
    for (const client of validClients) {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: client.name,
          phone: client.phone,
          phone2: client.phone2 || null,
          address: client.address || null,
          business_type: client.business_type || null,
          notes: client.notes || null,
        })
        .select()
        .single();

      if (clientError) {
        console.error('Error importing client:', clientError);
        continue;
      }

      if (client.devices && client.devices.length > 0) {
        const devicesToInsert = client.devices.map(device => ({
          client_id: newClient.id,
          device_name: device.device_name,
          activation_code: uuidv4().substring(0, 8).toUpperCase(),
          subscription_type: device.subscription_type,
          subscription_start: device.subscription_start,
          subscription_end: device.subscription_end,
          is_active: true,
        }));

        const { error: devicesError } = await supabase
          .from('devices')
          .insert(devicesToInsert);

        if (devicesError) {
          console.error('Error importing devices for client:', devicesError);
        }
      }

      importedCount++;
    }

    res.status(200).json({ 
      success: true, 
      message: 'تم استيراد العملاء بنجاح',
      imported: importedCount,
      total: validClients.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import clients' });
  }
}
