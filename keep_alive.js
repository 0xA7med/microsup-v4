import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function keepAlive() {
  console.log('Sending keep-alive ping to Supabase...');
  const { data, error } = await supabase.from('agents').select('count', { count: 'exact', head: true });
  
  if (error) {
    console.error('Keep-alive failed:', error.message);
  } else {
    console.log('Keep-alive successful. Project is active.');
  }
}

keepAlive();
