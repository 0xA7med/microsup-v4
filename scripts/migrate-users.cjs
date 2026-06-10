/**
 * ──────────────────────────────────────────────────────────
 * MicroSUB MicroPOS V1 — Password Migration Script
 * ──────────────────────────────────────────────────────────
 *
 * Migrates existing agents (with plain-text passwords in the
 * `agents` table) to Supabase Auth (bcrypt-hashed passwords
 * in `auth.users`).
 *
 * Usage:
 *   1. Verify .env has VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
 *   2. cd <project-root>
 *   3. node scripts/migrate-users.cjs
 *
 * What it does:
 *   - Reads all agents from the `agents` table
 *   - For each agent, creates a corresponding `auth.users` entry
 *     with their existing password (email_confirm: true)
 *   - If an auth user already exists, updates their password
 *
 * After running, passwords are managed by Supabase Auth.
 * The app no longer compares passwords directly.
 * ──────────────────────────────────────────────────────────
 */

const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('   Make sure both are set before running this script.');
  process.exit(1);
}

async function migrate() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // ── Step 1: Fetch all agents ──
    console.log('📡 Fetching agents from database...');
    
    const { data: agents, error: fetchError } = await adminClient
      .from('agents')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    console.log(`   Found ${agents.length} agent(s) in database.\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // ── Step 2: Process each agent ──
    for (const agent of agents) {
      try {
        // Check if auth user already exists for this email
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });

        if (listError) throw listError;

        const existingUser = users.find(u => u.email === agent.email);

        if (existingUser) {
          // Auth user exists — update password if we have one
          if (agent.password) {
            await adminClient.auth.admin.updateUserById(existingUser.id, {
              password: agent.password
            });
            console.log(`  🔄  ${agent.email} → password updated in existing auth user`);
            updated++;
          } else {
            console.log(`  ⏭  ${agent.email} → auth user exists, no password stored (skipped)`);
            skipped++;
          }
        } else {
          // Auth user does not exist — create one
          if (!agent.password) {
            console.log(`  ⚠️  ${agent.email} → no password stored, cannot create auth user`);
            skipped++;
            continue;
          }

          const { data, error: createError } = await adminClient.auth.admin.createUser({
            email: agent.email,
            password: agent.password,
            email_confirm: true,
            user_metadata: {
              name: agent.name || '',
              role: agent.role || 'agent',
              phone: agent.phone || '',
            }
          });

          if (createError) throw createError;

          console.log(`  ✅  ${agent.email} → auth user created (${data.user.id})`);
          created++;
        }
      } catch (err) {
        console.error(`  ❌  ${agent.email} → ${err.message}`);
        errors++;
      }
    }

    // ── Summary ──
    console.log('\n' + '─'.repeat(40));
    console.log('  Migration Summary');
    console.log('─'.repeat(40));
    console.log(`  Auth users created:    ${created}`);
    console.log(`  Auth users updated:    ${updated}`);
    console.log(`  Skipped:               ${skipped}`);
    console.log(`  Errors:                ${errors}`);

    if (errors > 0) {
      console.log('\n⚠️  Some agents failed. Check the logs above and retry if needed.');
    }

    if (created > 0 || updated > 0) {
      console.log('\n✅ Passwords are now managed by Supabase Auth (bcrypt hashed).');
      console.log('\nRecommended next steps:');
      console.log('  1. Verify by signing in with an existing agent email + password');
      console.log('  2. Null out the password column:');
      console.log('     UPDATE public.agents SET password = NULL;');
      console.log('  3. After verifying everything works, drop the column:');
      console.log('     ALTER TABLE public.agents DROP COLUMN password;');
    }
  } catch (err) {
    console.error('\n💥 Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
