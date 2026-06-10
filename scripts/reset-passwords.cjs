/**
 * Reset passwords for migrated auth users
 * Uses discovered passwords from CSV backup
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const adminClient = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  // Get all auth users
  const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error('List error:', listErr.message);
    process.exit(1);
  }

  // Update all user passwords from CSV backup
  const passwordMap = {
    'admin@micropos.com': 'admin123',
    'zeero4123@gmail.com': 'azwk3kyP',
    'mm@gmail.com': '123456789',
    'mohamedamer2004@gmail.com': '01002808714',
  };

  for (const user of users) {
    const email = user.email.toLowerCase();
    if (passwordMap[email]) {
      console.log(`Updating password for ${email}...`);
      const { error } = await adminClient.auth.admin.updateUserById(user.id, {
        password: passwordMap[email]
      });
      if (error) {
        console.error(`  ❌ Failed: ${error.message}`);
      } else {
        console.log(`  ✅ Password updated`);
      }
    }
    await sleep(500);
  }

  // Now verify: wait for rate limit to clear, then try login
  console.log('\nWaiting 5s for rate limit to clear...');
  await sleep(5000);

  console.log('=== Verification ===');
  const anonClient = createClient(url, process.env.VITE_SUPABASE_ANON_KEY);

  for (const [email, pw] of Object.entries(passwordMap)) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: pw
    });
    if (error) {
      console.log(`  ❌ ${email} -> ${error.message}`);
    } else {
      console.log(`  ✅ ${email} -> LOGIN OK (user: ${data.user?.email})`);
    }
    await sleep(1000);
  }

  console.log('\n=== Done ===');
})();
