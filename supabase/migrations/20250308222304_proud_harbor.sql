/*
  # Fix agents table RLS policies

  1. Changes
    - Drop existing problematic policies
    - Create new, properly structured RLS policies for agents table
    
  2. Security
    - Enable RLS on agents table
    - Add policies for:
      - Admins to manage all agents
      - Agents to read their own data
*/

-- Enable RLS on agents table if not already enabled
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admin can create agents" ON public.agents;
DROP POLICY IF EXISTS "Admins can read all agents" ON public.agents;
DROP POLICY IF EXISTS "Users can read own data" ON public.agents;

-- Create new policies without circular references
CREATE POLICY "Admins can manage all agents"
ON public.agents
FOR ALL
TO authenticated
USING (role = 'admin')
WITH CHECK (role = 'admin');

CREATE POLICY "Agents can read own data"
ON public.agents
FOR SELECT
TO authenticated
USING (auth.uid() = id);