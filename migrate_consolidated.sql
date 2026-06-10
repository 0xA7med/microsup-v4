-- ==============================================================
-- MicroSUB MicroPOS V1 — Consolidated Database Schema (Reference)
-- ==============================================================
-- NOTE: The Supabase database already has its tables with real data.
-- This file is a REFERENCE documenting the intended schema.
-- Run it ONLY if recreating from scratch on a new project.
-- Uses CREATE TABLE IF NOT EXISTS — safe but unnecessary.
-- ==============================================================

-- ==============================================================
-- SECTION 1: Extensions
-- ==============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ==============================================================
-- SECTION 2: Tables (CREATE IF NOT EXISTS / idempotent)
-- ==============================================================

-- ----------------------------------------
-- 2.1 agents
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    full_name       TEXT,
    role            TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
    phone           TEXT,
    address         TEXT,
    password        TEXT,
    approval_status VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID REFERENCES agents(id) ON DELETE SET NULL
);

COMMENT ON TABLE agents IS 'System users — admins and agents';
COMMENT ON COLUMN agents.role IS 'admin or agent';
COMMENT ON COLUMN agents.approval_status IS 'pending, approved, or rejected';

-- ----------------------------------------
-- 2.2 clients
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name         TEXT NOT NULL,
    organization_name   TEXT,
    activity_type       TEXT,
    phone               TEXT NOT NULL,
    phone2              TEXT,
    address             TEXT,
    activation_code     TEXT,
    device_count        INTEGER DEFAULT 1,
    active_devices_count INTEGER DEFAULT 0,
    subscription_type   TEXT DEFAULT 'monthly',
    subscription_start  TIMESTAMPTZ,
    subscription_end    TIMESTAMPTZ,
    notes               TEXT,
    agent_id            UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_by          UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE clients IS 'Clients managed by agents';
COMMENT ON COLUMN clients.agent_id IS 'The agent who manages this client';

-- ----------------------------------------
-- 2.3 devices
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    activation_code   TEXT,
    device_type       TEXT DEFAULT 'computer',
    subscription_start DATE,
    subscription_end  DATE,
    subscription_type TEXT DEFAULT 'monthly',
    email             VARCHAR(255),
    price             NUMERIC DEFAULT 0,
    notes             TEXT,
    approval_status   VARCHAR(20) DEFAULT 'pending',
    approval_date     TIMESTAMP,
    approved_by       UUID REFERENCES agents(id) ON DELETE SET NULL,
    rejection_reason  TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE devices IS 'Devices assigned to clients';
COMMENT ON COLUMN devices.approval_status IS 'pending, approved, or rejected';

-- ----------------------------------------
-- 2.4 backups
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS backups (
    id          SERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    created_by  UUID REFERENCES agents(id) ON DELETE SET NULL,
    file_name   TEXT NOT NULL,
    data        JSONB NOT NULL,
    stats       JSONB,
    notes       TEXT
);

COMMENT ON TABLE backups IS 'System data backups (JSON snapshots)';

-- ----------------------------------------
-- 2.5 notifications
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    type        TEXT DEFAULT 'info',
    is_read     BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    read_at     TIMESTAMPTZ
);

COMMENT ON TABLE notifications IS 'In-app notifications for agents';

-- ----------------------------------------
-- 2.6 repairs
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS repairs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    description   TEXT,
    cost          DECIMAL(10,2) DEFAULT 0,
    status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at  TIMESTAMPTZ,
    completed_by  UUID REFERENCES agents(id) ON DELETE SET NULL
);

COMMENT ON TABLE repairs IS 'Device repair tracking';


-- ==============================================================
-- SECTION 3: Indexes
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_agents_email        ON agents(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_agents_role         ON agents(role);
CREATE INDEX IF NOT EXISTS idx_clients_agent_id    ON clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by  ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_devices_client_id   ON devices(client_id);
CREATE INDEX IF NOT EXISTS idx_devices_approval    ON devices(approval_status);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read  ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_repairs_device_id   ON repairs(device_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status      ON repairs(status);


-- ==============================================================
-- SECTION 4: Functions & Triggers
-- ==============================================================

-- 4.1 Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Triggers for each table with updated_at
DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_devices_updated_at ON devices;
CREATE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_repairs_updated_at ON repairs;
CREATE TRIGGER trg_repairs_updated_at
    BEFORE UPDATE ON repairs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.3 Auto-create agent row on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.agents (id, email, name, full_name, role, phone, address)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'role', 'agent'),
        COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'address', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================
-- SECTION 5: Row-Level Security Policies
-- ==============================================================

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.agents
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------
-- 5.1 agents RLS
-- ----------------------------------------
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_select_authenticated" ON agents;
CREATE POLICY "agents_select_authenticated" ON agents
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "agents_insert_authenticated" ON agents;
CREATE POLICY "agents_insert_authenticated" ON agents
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "agents_update_own_or_admin" ON agents;
CREATE POLICY "agents_update_own_or_admin" ON agents
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR is_admin())
    WITH CHECK (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "agents_delete_admin_only" ON agents;
CREATE POLICY "agents_delete_admin_only" ON agents
    FOR DELETE TO authenticated
    USING (is_admin());

-- ----------------------------------------
-- 5.2 clients RLS
-- ----------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_own_or_admin" ON clients;
CREATE POLICY "clients_select_own_or_admin" ON clients
    FOR SELECT TO authenticated
    USING (agent_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "clients_insert_own_or_admin" ON clients;
CREATE POLICY "clients_insert_own_or_admin" ON clients
    FOR INSERT TO authenticated
    WITH CHECK (agent_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "clients_update_own_or_admin" ON clients;
CREATE POLICY "clients_update_own_or_admin" ON clients
    FOR UPDATE TO authenticated
    USING (agent_id = auth.uid() OR is_admin())
    WITH CHECK (agent_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "clients_delete_admin_only" ON clients;
CREATE POLICY "clients_delete_admin_only" ON clients
    FOR DELETE TO authenticated
    USING (is_admin());

-- ----------------------------------------
-- 5.3 devices RLS
-- ----------------------------------------
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "devices_select_own_or_admin" ON devices;
CREATE POLICY "devices_select_own_or_admin" ON devices
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = devices.client_id
            AND (clients.agent_id = auth.uid() OR is_admin())
        )
    );

DROP POLICY IF EXISTS "devices_insert_own_or_admin" ON devices;
CREATE POLICY "devices_insert_own_or_admin" ON devices
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = devices.client_id
            AND (clients.agent_id = auth.uid() OR is_admin())
        )
    );

DROP POLICY IF EXISTS "devices_update_own_or_admin" ON devices;
CREATE POLICY "devices_update_own_or_admin" ON devices
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = devices.client_id
            AND (clients.agent_id = auth.uid() OR is_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = devices.client_id
            AND (clients.agent_id = auth.uid() OR is_admin())
        )
    );

DROP POLICY IF EXISTS "devices_delete_admin_only" ON devices;
CREATE POLICY "devices_delete_admin_only" ON devices
    FOR DELETE TO authenticated
    USING (is_admin());

-- ----------------------------------------
-- 5.4 backups RLS
-- ----------------------------------------
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backups_select_admin_only" ON backups;
CREATE POLICY "backups_select_admin_only" ON backups
    FOR SELECT TO authenticated
    USING (is_admin());

DROP POLICY IF EXISTS "backups_insert_admin_only" ON backups;
CREATE POLICY "backups_insert_admin_only" ON backups
    FOR INSERT TO authenticated
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS "backups_delete_admin_only" ON backups;
CREATE POLICY "backups_delete_admin_only" ON backups
    FOR DELETE TO authenticated
    USING (is_admin());

-- ----------------------------------------
-- 5.5 notifications RLS
-- ----------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR is_admin())
    WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON notifications;
CREATE POLICY "notifications_delete_own_or_admin" ON notifications
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR is_admin());

-- ----------------------------------------
-- 5.6 repairs RLS
-- ----------------------------------------
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repairs_select_own_or_admin" ON repairs;
CREATE POLICY "repairs_select_own_or_admin" ON repairs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM devices d
            JOIN clients c ON c.id = d.client_id
            WHERE d.id = repairs.device_id
            AND (c.agent_id = auth.uid() OR is_admin())
        )
    );

DROP POLICY IF EXISTS "repairs_insert_admin_or_agent" ON repairs;
CREATE POLICY "repairs_insert_admin_or_agent" ON repairs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM devices d
            JOIN clients c ON c.id = d.client_id
            WHERE d.id = repairs.device_id
            AND (c.agent_id = auth.uid() OR is_admin())
        )
    );

DROP POLICY IF EXISTS "repairs_update_admin_only" ON repairs;
CREATE POLICY "repairs_update_admin_only" ON repairs
    FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS "repairs_delete_admin_only" ON repairs;
CREATE POLICY "repairs_delete_admin_only" ON repairs
    FOR DELETE TO authenticated
    USING (is_admin());


-- ==============================================================
-- SECTION 6: Final Comments
-- ==============================================================

COMMENT ON SCHEMA public IS 'MicroSUB MicroPOS V1 — Consolidated Schema';

-- ==============================================================
-- END OF MIGRATION
-- ==============================================================
