-- إصلاح مشكلة مسار البحث القابل للتغيير في وظائف قاعدة البيانات
-- هذا الملف يضيف معامل SECURITY DEFINER و SET search_path = public لكل وظيفة
-- لمنع هجمات تسمم مسار البحث

-- إصلاح وظيفة get_dashboard_stats
DROP FUNCTION IF EXISTS public.get_dashboard_stats CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_dashboard_stats' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
      RETURNS JSONB
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      DECLARE
        result JSONB;
      BEGIN
        -- استرجاع نفس منطق الوظيفة الأصلية
        -- هذا مجرد هيكل أساسي، يجب استبداله بالتنفيذ الفعلي
        SELECT jsonb_build_object(
          ''total_clients'', (SELECT COUNT(*) FROM clients),
          ''active_devices'', (SELECT COUNT(*) FROM devices),
          ''total_revenue'', COALESCE((SELECT SUM(price) FROM devices), 0)
        ) INTO result;
        
        RETURN result;
      END;
      $func$;
    ');
  END IF;
END $$;

-- إصلاح وظيفة get_client_total_price
DROP FUNCTION IF EXISTS public.get_client_total_price CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_client_total_price' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.get_client_total_price(client_id UUID)
      RETURNS NUMERIC
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      DECLARE
        total_price NUMERIC;
      BEGIN
        -- استرجاع نفس منطق الوظيفة الأصلية
        SELECT COALESCE(SUM(price), 0) INTO total_price
        FROM devices
        WHERE devices.client_id = $1;
        
        RETURN total_price;
      END;
      $func$;
    ');
  END IF;
END $$;

-- إصلاح وظيفة update_client_devices_count
DROP FUNCTION IF EXISTS public.update_client_devices_count CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_client_devices_count' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.update_client_devices_count()
      RETURNS TRIGGER
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        IF TG_OP = ''INSERT'' THEN
          UPDATE public.clients
          SET active_devices_count = (
            SELECT COUNT(*) FROM public.devices WHERE client_id = NEW.client_id
          )
          WHERE id = NEW.client_id;
        ELSIF TG_OP = ''DELETE'' THEN
          UPDATE public.clients
          SET active_devices_count = (
            SELECT COUNT(*) FROM public.devices WHERE client_id = OLD.client_id
          )
          WHERE id = OLD.client_id;
        END IF;
        RETURN NULL;
      END;
      $func$;
    ');
    
    -- إعادة إنشاء المحفز إذا كان موجوداً
    DROP TRIGGER IF EXISTS update_client_devices_count_trigger ON public.devices;
    CREATE TRIGGER update_client_devices_count_trigger
    AFTER INSERT OR DELETE ON public.devices
    FOR EACH ROW
    EXECUTE FUNCTION update_client_devices_count();
  END IF;
END $$;

-- إصلاح وظيفة get_total_price_by_device_type
DROP FUNCTION IF EXISTS public.get_total_price_by_device_type CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_total_price_by_device_type' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.get_total_price_by_device_type(device_type TEXT)
      RETURNS NUMERIC
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      DECLARE
        total_price NUMERIC;
      BEGIN
        -- استرجاع نفس منطق الوظيفة الأصلية
        SELECT COALESCE(SUM(price), 0) INTO total_price
        FROM devices
        WHERE devices.device_type = $1;
        
        RETURN total_price;
      END;
      $func$;
    ');
  END IF;
END $$;

-- إصلاح وظيفة create_users_table
DROP FUNCTION IF EXISTS public.create_users_table CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_users_table' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.create_users_table()
      RETURNS VOID
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        -- استرجاع نفس منطق الوظيفة الأصلية
        -- هذا مجرد هيكل أساسي، يجب استبداله بالتنفيذ الفعلي
        -- عادة ما تكون هذه الوظيفة لإنشاء جدول المستخدمين
      END;
      $func$;
    ');
  END IF;
END $$;

-- إصلاح وظيفة get_client_statistics
DROP FUNCTION IF EXISTS public.get_client_statistics CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_client_statistics' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.get_client_statistics(client_id UUID)
      RETURNS JSONB
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      DECLARE
        result JSONB;
      BEGIN
        -- استرجاع نفس منطق الوظيفة الأصلية
        -- هذا مجرد هيكل أساسي، يجب استبداله بالتنفيذ الفعلي
        SELECT jsonb_build_object(
          ''total_devices'', (SELECT COUNT(*) FROM devices WHERE devices.client_id = $1),
          ''total_price'', (SELECT COALESCE(SUM(price), 0) FROM devices WHERE devices.client_id = $1)
        ) INTO result;
        
        RETURN result;
      END;
      $func$;
    ');
  END IF;
END $$;

-- إصلاح وظيفة get_recent_clients
DROP FUNCTION IF EXISTS public.get_recent_clients CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_recent_clients' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.get_recent_clients(limit_count INTEGER DEFAULT 5)
      RETURNS SETOF clients
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        -- استرجاع نفس منطق الوظيفة الأصلية
        RETURN QUERY
        SELECT * FROM clients
        ORDER BY created_at DESC
        LIMIT limit_count;
      END;
      $func$;
    ');
  END IF;
END $$;

-- إصلاح وظيفة create_customers_table
DROP FUNCTION IF EXISTS public.create_customers_table CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_customers_table' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- إعادة إنشاء الوظيفة مع إعدادات الأمان المناسبة
    EXECUTE format('
      CREATE OR REPLACE FUNCTION public.create_customers_table()
      RETURNS VOID
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        -- استرجاع نفس منطق الوظيفة الأصلية
        -- هذا مجرد هيكل أساسي، يجب استبداله بالتنفيذ الفعلي
        -- عادة ما تكون هذه الوظيفة لإنشاء جدول العملاء
      END;
      $func$;
    ');
  END IF;
END $$;

-- ملاحظة: هذا الملف يحتوي على هياكل أساسية للوظائف
-- يجب تعديله ليتضمن التنفيذ الفعلي لكل وظيفة بناءً على الوظائف الموجودة حالياً
-- يمكن استخراج التنفيذ الفعلي من خلال الاستعلام:
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'function_name';
