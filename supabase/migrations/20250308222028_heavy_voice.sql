/*
  # Create admin user

  1. Changes
    - Create initial admin user with email admin@micropos.com
    
  2. Security
    - Password will be hashed by Supabase Auth
    - User will be created in both auth.users and public.agents tables
*/

-- Create admin user in auth.users (this is handled by Supabase Auth)
SELECT supabase_auth.create_user(
  '{
    "email": "admin@micropos.com",
    "password": "admin123",
    "email_confirmed_at": "now()",
    "user_metadata": {
      "full_name": "System Admin",
      "role": "admin"
    }
  }'::jsonb
);

-- Insert admin user data into public.agents
INSERT INTO public.agents (
  id,
  email,
  full_name,
  role,
  phone,
  address
)
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'role',
  '+966500000000',
  'Riyadh, Saudi Arabia'
FROM auth.users
WHERE email = 'admin@micropos.com'
ON CONFLICT (id) DO NOTHING;