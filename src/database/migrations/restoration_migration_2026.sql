-- System Restoration Migration (March 2026)
-- Target: Restore missing logic and set up basic security for the new Supabase instance.

-- 1. Create missing performance indexes from the improvements migration
CREATE INDEX IF NOT EXISTS idx_clients_subscription_end ON public.clients(subscription_end);
CREATE INDEX IF NOT EXISTS idx_clients_subscription_type ON public.clients(subscription_type);
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON public.clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_client_id ON public.devices(client_id);
CREATE INDEX IF NOT EXISTS idx_devices_created_at ON public.devices(created_at DESC);

-- 2. Restore Dashboard Statistics Function
CREATE OR REPLACE FUNCTION public.get_dashboard_statistics(user_id UUID, user_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
    filter_condition TEXT;
    today DATE := CURRENT_DATE;
    end_of_month DATE := DATE_TRUNC('MONTH', CURRENT_DATE) + INTERVAL '1 MONTH' - INTERVAL '1 DAY';
BEGIN
    -- Determine filter condition based on user role
    IF user_role = 'agent' THEN
        filter_condition := 'agent_id = ' || quote_literal(user_id);
    ELSE
        filter_condition := 'TRUE';
    END IF;

    EXECUTE format('
    WITH stats AS (
        SELECT
            COUNT(*) AS total_clients,
            SUM(CASE WHEN (subscription_end > NOW() OR subscription_type = ''permanent'' OR subscription_end IS NULL) THEN 1 ELSE 0 END) AS active_subscriptions,
            SUM(CASE WHEN subscription_end < NOW() AND subscription_type != ''permanent'' AND subscription_end IS NOT NULL THEN 1 ELSE 0 END) AS expired_subscriptions,
            SUM(CASE WHEN subscription_type = ''permanent'' THEN 1 ELSE 0 END) AS permanent_clients,
            SUM(CASE WHEN subscription_end BETWEEN NOW() AND %L AND subscription_end IS NOT NULL THEN 1 ELSE 0 END) AS expiring_this_month,
            COALESCE(AVG(COALESCE(device_count, 0)), 0) AS average_devices,
            COALESCE(SUM(COALESCE(device_count, 0)), 0) AS total_devices
        FROM clients
        WHERE %s
    ),
    agents_count AS (
        SELECT COUNT(*) AS total_agents
        FROM agents
        WHERE %s
    ),
    recent_clients AS (
        SELECT
            c.*,
            a.name AS agent_name,
            a.email AS agent_email
        FROM
            clients c
        LEFT JOIN
            agents a ON c.agent_id = a.id
        WHERE
            %s
        ORDER BY
            c.created_at DESC
        LIMIT 5
    )
    SELECT
        jsonb_build_object(
            ''total_clients'', (SELECT total_clients FROM stats),
            ''total_agents'', (SELECT total_agents FROM agents_count),
            ''active_subscriptions'', (SELECT active_subscriptions FROM stats),
            ''expired_subscriptions'', (SELECT expired_subscriptions FROM stats),
            ''permanent_clients'', (SELECT permanent_clients FROM stats),
            ''expiring_this_month'', (SELECT expiring_this_month FROM stats),
            ''average_devices'', (SELECT ROUND(average_devices) FROM stats),
            ''renewal_rate'', (SELECT CASE WHEN total_clients > 0 THEN ROUND((active_subscriptions::NUMERIC / total_clients) * 100) ELSE 0 END FROM stats),
            ''recent_clients'', (SELECT jsonb_agg(row_to_json(recent_clients)) FROM recent_clients)
        ) AS result;', end_of_month, filter_condition, 
        CASE WHEN user_role != 'agent' THEN 'TRUE' ELSE 'id = ' || quote_literal(user_id) END,
        filter_condition) INTO result;

    RETURN result;
END;
$$;

-- 3. Restore Agents List Function
CREATE OR REPLACE FUNCTION public.get_agents_list()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'email', email
    ))
    INTO result
    FROM agents;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissions (Allowing 'anon' or 'authenticated' based on project usage)
-- Since the project uses its own login logic, we'll allow access but we could restrict it further if needed.

-- Agents table
CREATE POLICY "Allow anonymous read access to agents" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Allow anonymous update to agents" ON public.agents FOR UPDATE USING (true);

-- Clients table
CREATE POLICY "Allow anonymous access to clients" ON public.clients FOR ALL USING (true);

-- Devices table
CREATE POLICY "Allow anonymous access to devices" ON public.devices FOR ALL USING (true);

-- Backups table
CREATE POLICY "Allow anonymous access to backups" ON public.backups FOR ALL USING (true);

-- 6. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics TO anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agents_list TO anon;
GRANT EXECUTE ON FUNCTION public.get_agents_list TO authenticated;

-- 7. Grant schema access (Supabase specific)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
