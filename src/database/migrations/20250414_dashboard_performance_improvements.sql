-- تحسين أداء لوحة التحكم من خلال إنشاء وظيفة SQL تجمع كل الإحصائيات في استعلام واحد
-- هذا سيقلل بشكل كبير من عدد الاستعلامات وسيحسن وقت التحميل

-- التحقق من وجود عمود subscription_end وإضافته إذا لم يكن موجوداً
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'subscription_end') THEN
        ALTER TABLE public.clients ADD COLUMN subscription_end TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'subscription_type') THEN
        ALTER TABLE public.clients ADD COLUMN subscription_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'subscription_start') THEN
        ALTER TABLE public.clients ADD COLUMN subscription_start TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'device_count') THEN
        ALTER TABLE public.clients ADD COLUMN device_count INTEGER DEFAULT 0;
    END IF;
END
$$;

-- إنشاء فهارس لتحسين أداء الاستعلامات
CREATE INDEX IF NOT EXISTS idx_clients_subscription_end ON public.clients(subscription_end);
CREATE INDEX IF NOT EXISTS idx_clients_subscription_type ON public.clients(subscription_type);
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON public.clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at);

-- إنشاء وظيفة لجلب جميع إحصائيات لوحة التحكم في استعلام واحد
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
    -- تحديد شرط التصفية بناءً على دور المستخدم
    IF user_role = 'agent' THEN
        filter_condition := 'agent_id = ''' || user_id || '''';
    ELSE
        filter_condition := 'TRUE';
    END IF;

    -- استعلام واحد لجلب جميع الإحصائيات
    EXECUTE '
    WITH stats AS (
        SELECT
            COUNT(*) AS total_clients,
            SUM(CASE WHEN (subscription_end > NOW() OR subscription_type = ''permanent'' OR subscription_end IS NULL) THEN 1 ELSE 0 END) AS active_subscriptions,
            SUM(CASE WHEN subscription_end < NOW() AND subscription_type != ''permanent'' AND subscription_end IS NOT NULL THEN 1 ELSE 0 END) AS expired_subscriptions,
            SUM(CASE WHEN subscription_type = ''permanent'' THEN 1 ELSE 0 END) AS permanent_clients,
            SUM(CASE WHEN subscription_end BETWEEN NOW() AND ''' || end_of_month || ''' AND subscription_end IS NOT NULL THEN 1 ELSE 0 END) AS expiring_this_month,
            COALESCE(AVG(COALESCE(device_count, 0)), 0) AS average_devices,
            COALESCE(SUM(COALESCE(device_count, 0)), 0) AS total_devices
        FROM clients
        WHERE ' || filter_condition || '
    ),
    agents_count AS (
        SELECT COUNT(*) AS total_agents
        FROM agents
        WHERE ' || CASE WHEN user_role != 'agent' THEN 'TRUE' ELSE 'id = ''' || user_id || '''' END || '
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
            ' || filter_condition || '
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
        ) AS result;
    ' INTO result;

    RETURN result;
END;
$$;

-- إضافة تعليقات لتوثيق الوظيفة
COMMENT ON FUNCTION public.get_dashboard_statistics IS 'تجمع جميع إحصائيات لوحة التحكم في استعلام واحد لتحسين الأداء';

-- إنشاء وظيفة مساعدة للحصول على قائمة المندوبين
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

-- إضافة سياسة أمان للوظائف
ALTER FUNCTION public.get_dashboard_statistics SECURITY DEFINER;
ALTER FUNCTION public.get_agents_list SECURITY DEFINER;

-- إضافة سياسات RLS للوظائف
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agents_list TO authenticated;
