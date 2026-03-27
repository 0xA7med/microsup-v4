-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS backups CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Create agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID, -- Removed self-reference to avoid recursion
    password TEXT,
    approval_status VARCHAR(255)
);

-- Create backups table
CREATE TABLE backups (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    data JSONB NOT NULL,
    stats JSONB,
    notes TEXT
);

-- Create clients table with explicit constraint names
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    organization_name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    device_count INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    agent_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    phone2 TEXT,
    active_devices_count INTEGER DEFAULT 0,
    subscription_end TIMESTAMPTZ,
    subscription_type TEXT,
    subscription_start TIMESTAMPTZ,
    
    -- Add explicit constraints with names
    CONSTRAINT fk_agent_id FOREIGN KEY (agent_id) 
        REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) 
        REFERENCES agents(id) ON DELETE SET NULL
);

-- Create devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    activation_code TEXT NOT NULL,
    subscription_start DATE NOT NULL,
    subscription_end DATE NOT NULL,
    subscription_type TEXT NOT NULL DEFAULT 'monthly',
    device_type TEXT NOT NULL DEFAULT 'computer',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approval_status VARCHAR(20) DEFAULT 'pending',
    approval_date TIMESTAMP,
    approved_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    price NUMERIC DEFAULT 0,
    email VARCHAR(255)
);

-- Add indexes for better performance
CREATE INDEX idx_agents_email ON agents(email);
CREATE INDEX idx_clients_agent_id ON clients(agent_id);
CREATE INDEX idx_devices_client_id ON devices(client_id);
CREATE INDEX idx_devices_approval_status ON devices(approval_status);

-- Add comments to tables and columns
COMMENT ON TABLE agents IS 'Stores information about system agents and administrators';
COMMENT ON COLUMN agents.role IS 'Possible values: admin, agent, etc.';
COMMENT ON COLUMN clients.device_count IS 'Number of devices the client has';
COMMENT ON COLUMN devices.approval_status IS 'Possible values: pending, approved, rejected';

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user if not exists
INSERT INTO agents (email, name, role, phone, address, password, approval_status)
SELECT 'admin@example.com', 'Admin', 'admin', '123456789', 'System', '$2a$10$XFDq3wOMBl3JX.f90oxz8eXlgG6clBmOCY8JhDmG1XJbQ9YJ5z5yW', 'approved'
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'admin@example.com');

-- Disable RLS temporarily to avoid recursion issues
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE backups DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE devices DISABLE ROW LEVEL SECURITY;

-- Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if current user is the owner
CREATE OR REPLACE FUNCTION is_owner(agent_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() = agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Simple policies for agents table
CREATE POLICY "Enable read access for all users" ON agents FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON agents FOR INSERT WITH CHECK (true);

-- Simple policies for other tables
CREATE POLICY "Enable all for admin on backups" ON backups FOR ALL USING (is_admin());
CREATE POLICY "Enable all for admin on clients" ON clients FOR ALL USING (is_admin());
CREATE POLICY "Enable all for admin on devices" ON devices FOR ALL USING (is_admin());

-- Additional policies for non-admin users
CREATE POLICY "Agents can manage their own profile" 
  ON agents FOR ALL 
  USING (is_owner(id));

CREATE POLICY "Agents can view their clients" 
  ON clients FOR SELECT 
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can view their clients' devices" 
  ON devices FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = devices.client_id 
    AND clients.agent_id = auth.uid()
  ));
