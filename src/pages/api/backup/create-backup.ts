import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) throw clientsError;

    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*');

    if (devicesError) throw devicesError;

    const backupData = {
      timestamp: new Date().toISOString(),
      clients,
      devices,
      metadata: {
        version: '1.0',
        createdBy: session.user.email,
        createdAt: new Date().toISOString(),
      }
    };

    const currentDate = format(new Date(), 'yyyy-MM-dd_HH-mm-ss', { locale: ar });
    const fileName = `microsup_backup_${currentDate}.json`;

    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(backupData);
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
}
