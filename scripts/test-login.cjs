/**
 * Test login debugging script
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, anonKey);
const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

(async () => {
  // First get the actual auth users to see their emails
  console.log('=== Auth Users ===');
  const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error('List error:', listErr.message);
    return;
  }
  users.forEach(u => {
    console.log(`  ${u.email} | confirmed: ${u.email_confirmed_at ? 'YES' : 'NO'} | id: ${u.id}`);
  });

  // Now try to login with each user using common passwords
  console.log('\n=== Login Tests ===');
  const emails = users.map(u => u.email);
  const testPasswords = ['admin123', '123456', 'password', 'admin', 'Agent@123', 'azwk3kyP', 'MM123456', 'test123', 'P@ssw0rd'];

  for (const email of emails) {
    console.log(`\n--- ${email} ---`);
    let found = false;
    for (const pw of testPasswords) {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: pw
      });
      if (error) {
        if (error.message.includes('Invalid login')) {
          // wrong password - expected for most tries
        } else {
          console.log(`  [!] "${pw}" -> ${error.message}`);
        }
      } else {
        console.log(`  ✅ "${pw}" -> LOGIN SUCCESS!`);
        found = true;
      }
    }
    if (!found) {
      console.log(`  ❌ NONE of the tested passwords worked`);
    }
  }

  // Also let's check what emails the agents table has
  console.log('\n=== Agents Table ===');
  const { data: agents } = await adminClient.from('agents').select('email, password');
  if (agents) {
    agents.forEach(a => {
      console.log(`  ${a.email} | has password? ${'password' in a ? (a.password ? 'YES: ' + a.password : 'empty') : 'COLUMN NOT FOUND'}`);
    });
  } else {
    console.log('  No agents found or no password column');
  }

  console.log('\n=== Done ===');
})();
