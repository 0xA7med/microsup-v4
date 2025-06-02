-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agents table (matches auth.users)
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'agent')),
  phone text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  organization_name text NOT NULL,
  activity_type text NOT NULL,
  phone text NOT NULL,
  activation_code text NOT NULL,
  subscription_type text NOT NULL CHECK (subscription_type IN ('monthly', 'semi_annual', 'annual', 'permanent')),
  address text NOT NULL,
  device_count integer NOT NULL DEFAULT 1,
  software_version text NOT NULL CHECK (software_version IN ('computer', 'android')),
  subscription_start timestamptz NOT NULL,
  subscription_end timestamptz,
  notes text,
  agent_id uuid REFERENCES agents(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create devices table (added in later migration)
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  device_type text NOT NULL,
  serial_number text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES agents(id)
);

-- Create notifications table (added in later migration)
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create device_approval_status table (added in later migration)
CREATE TABLE IF NOT EXISTS device_approval_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  reviewed_by uuid REFERENCES agents(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_approval_status ENABLE ROW LEVEL SECURITY;

-- Agents table policies
-- Users can read their own data
CREATE POLICY "Agents can read own data"
  ON agents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can read all agents data
CREATE POLICY "Admins can read all agents"
  ON agents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can insert new agents
CREATE POLICY "Admins can insert agents"
  ON agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

-- Clients table policies
-- Agents can read their own clients
CREATE POLICY "Agents can read their clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid() OR
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

-- Agents can insert new clients
CREATE POLICY "Agents can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid() OR
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

-- Devices table policies
-- Users can read devices for their clients
CREATE POLICY "Users can read devices for their clients"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = devices.client_id 
      AND (clients.agent_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- Users can insert devices for their clients
CREATE POLICY "Users can insert devices for their clients"
  ON devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = devices.client_id 
      AND (clients.agent_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- Notifications table policies
-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own notifications
CREATE POLICY "Users can insert own notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Device approval status policies
-- Users can read approval status for their clients' devices
CREATE POLICY "Users can read approval status for their clients"
  ON device_approval_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devices d
      JOIN clients c ON d.client_id = c.id
      WHERE d.id = device_approval_status.device_id
      AND (c.agent_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- Admins can update approval status
CREATE POLICY "Admins can update approval status"
  ON device_approval_status
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update updated_at automatically
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_approval_status_updated_at
BEFORE UPDATE ON device_approval_status
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.agents (id, email, full_name, role, phone, address)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'address', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
