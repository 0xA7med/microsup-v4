/*
  # Initial Schema Setup for MicroPOS Manager

  1. Tables
    - users
      - Stores admin and agent information
      - Contains authentication and profile data
    - clients
      - Stores client/customer information
      - Links to agent who registered them
      
  2. Security
    - RLS policies for both tables
    - Admins can access all data
    - Agents can only access their own data and clients
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'agent')),
  phone text,
  address text,
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
  agent_id uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policies for clients table
CREATE POLICY "Admins can read all clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Agents can read own clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'agent'));

CREATE POLICY "Admins can update any client"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Agents can update own clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid());