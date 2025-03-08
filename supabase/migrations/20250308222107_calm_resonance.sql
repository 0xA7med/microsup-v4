/*
  # Create admin user

  1. Changes
    - Create initial admin user with email admin@micropos.com
    - Insert corresponding record in agents table
    
  2. Security
    - Password will be hashed by Supabase Auth
    - User will be created in both auth.users and public.agents tables
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the admin user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'admin@micropos.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"System Admin","role":"admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Insert the admin user into public.agents
INSERT INTO public.agents (
  id,
  email,
  full_name,
  role,
  phone,
  address,
  created_at
)
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name',
  'admin',
  '+966500000000',
  'Riyadh, Saudi Arabia',
  created_at
FROM auth.users
WHERE email = 'admin@micropos.com'
ON CONFLICT (id) DO NOTHING;