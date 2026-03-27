-- Drop existing constraints to avoid conflicts
ALTER TABLE IF EXISTS clients DROP CONSTRAINT IF EXISTS fk_agent_id;
ALTER TABLE IF EXISTS clients DROP CONSTRAINT IF EXISTS fk_created_by;

-- Recreate clients table with a single relationship
CREATE OR REPLACE FUNCTION recreate_clients_table() RETURNS void AS $$
BEGIN
    -- Create a temporary table to hold the data
    CREATE TEMP TABLE temp_clients AS SELECT * FROM clients;
    
    -- Drop the original table
    DROP TABLE clients CASCADE;
    
    -- Recreate the table with a single relationship
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
        
        -- Single foreign key relationship
        CONSTRAINT fk_agent_id FOREIGN KEY (agent_id) 
            REFERENCES agents(id) ON DELETE CASCADE
    );
    
    -- Copy data back
    INSERT INTO clients SELECT * FROM temp_clients;
    
    -- Drop the temporary table
    DROP TABLE temp_clients;
    
    -- Recreate indexes and policies
    CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON clients(agent_id);
    
    -- Update RLS policies
    DROP POLICY IF EXISTS "Enable all for admin on clients" ON clients;
    DROP POLICY IF EXISTS "Agents can view their clients" ON clients;
    
    CREATE POLICY "Enable all for admin on clients" 
        ON clients FOR ALL 
        USING (is_admin());
        
    CREATE POLICY "Agents can view their clients" 
        ON clients FOR SELECT 
        USING (agent_id = auth.uid());
        
    -- Add comments
    COMMENT ON TABLE clients IS 'Clients table with simplified relationships';
    COMMENT ON COLUMN clients.agent_id IS 'The agent who manages this client';
    COMMENT ON COLUMN clients.created_by IS 'For internal reference only, no foreign key';
    
    -- Notify that the operation was successful
    RAISE NOTICE 'Successfully recreated clients table with simplified relationships';
    
    -- Update the created_by to be the same as agent_id for existing records
    UPDATE clients SET created_by = agent_id WHERE created_by IS NULL;
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error recreating clients table: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT recreate_clients_table();

-- Drop the function after use
DROP FUNCTION IF EXISTS recreate_clients_table();

-- Update the agents table to prevent duplicate emails
CREATE OR REPLACE FUNCTION ensure_unique_agent_email() 
RETURNS TRIGGER AS $$
BEGIN
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM agents WHERE email = NEW.email AND id != NEW.id) THEN
        RAISE EXCEPTION 'Email already exists';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for checking email uniqueness
DROP TRIGGER IF EXISTS check_agent_email_trigger ON agents;
CREATE TRIGGER check_agent_email_trigger
BEFORE INSERT OR UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION ensure_unique_agent_email();

-- Clean up any existing duplicate emails (keep the first one created)
WITH duplicates AS (
    SELECT 
        email, 
        id as keep_id,
        ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at) as rn
    FROM agents
)
DELETE FROM agents
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
);

-- Add a unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_agent_email ON agents(LOWER(email));

-- Notify completion
SELECT 'Database relationships and constraints have been fixed successfully' as message;
