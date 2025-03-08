/*
  # Create agents table and policies

  1. New Tables
    - `agents`
      - `id` (uuid, primary key) - matches auth.users.id
      - `email` (text, unique)
      - `full_name` (text)
      - `role` (text) - either 'admin' or 'agent'
      - `phone` (text)
      - `address` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `agents` table
    - Add policies for:
      - Authenticated users can read their own data
      - Admins can read all agents data
      - Admins can create new agents
*/

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'agent')),
  phone text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own data
CREATE POLICY "Users can read own data"
  ON agents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow admins to read all agents data
CREATE POLICY "Admins can read all agents"
  ON agents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to create new agents
CREATE POLICY "Admins can create agents"
  ON agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'
    )
  );