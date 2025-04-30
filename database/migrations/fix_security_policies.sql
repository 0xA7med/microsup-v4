-- إصلاح مشاكل أمان قاعدة البيانات في Supabase
-- هذا الملف يقوم بتفعيل سياسات أمان الصفوف (RLS) وإعادة ضبط صلاحيات المستخدمين

-- 1. تفعيل سياسات أمان الصفوف (RLS) على جميع الجداول الهامة
DO $$
DECLARE
    table_record RECORD;
BEGIN
    -- تفعيل RLS على جميع الجداول العامة
    FOR table_record IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        -- استثناء جداول النظام
        IF table_record.tablename NOT IN ('schema_migrations', 'spatial_ref_sys') THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_record.tablename);
            RAISE NOTICE 'تم تفعيل RLS على جدول %', table_record.tablename;
        END IF;
    END LOOP;
END $$;

-- 2. إنشاء سياسات أمان للجداول الرئيسية

-- سياسة أمان لجدول المستخدمين (auth.users)
-- ملاحظة: هذا الجدول يديره Supabase بشكل تلقائي، لكن يمكننا إضافة سياسات إضافية

-- سياسة أمان لجدول العملاء
DO $$
BEGIN
    -- إلغاء السياسات الموجودة مسبقاً
    DROP POLICY IF EXISTS "المستخدمون المصرح لهم يمكنهم مشاهدة العملاء" ON public.clients;
    DROP POLICY IF EXISTS "المسؤولون يمكنهم إدارة العملاء" ON public.clients;
    
    -- إنشاء سياسة للقراءة فقط للمستخدمين العاديين
    EXECUTE format('
        CREATE POLICY "المستخدمون المصرح لهم يمكنهم مشاهدة العملاء"
        ON public.clients FOR SELECT
        USING (auth.uid() IN (
            SELECT auth.uid() FROM auth.users
            WHERE auth.uid() IS NOT NULL
        ));
    ');
    
    -- إنشاء سياسة للإدارة الكاملة للمسؤولين فقط
    EXECUTE format('
        CREATE POLICY "المسؤولون يمكنهم إدارة العملاء"
        ON public.clients FOR ALL
        USING (
            auth.uid() IN (
                SELECT id FROM auth.users
                WHERE auth.jwt() ->> ''role'' = ''admin''
            )
        );
    ');
    
    RAISE NOTICE 'تم إنشاء سياسات الأمان لجدول العملاء';
END $$;

-- سياسة أمان لجدول الأجهزة
DO $$
BEGIN
    -- إلغاء السياسات الموجودة مسبقاً
    DROP POLICY IF EXISTS "المستخدمون المصرح لهم يمكنهم مشاهدة الأجهزة" ON public.devices;
    DROP POLICY IF EXISTS "المسؤولون يمكنهم إدارة الأجهزة" ON public.devices;
    
    -- إنشاء سياسة للقراءة فقط للمستخدمين العاديين
    EXECUTE format('
        CREATE POLICY "المستخدمون المصرح لهم يمكنهم مشاهدة الأجهزة"
        ON public.devices FOR SELECT
        USING (auth.uid() IN (
            SELECT auth.uid() FROM auth.users
            WHERE auth.uid() IS NOT NULL
        ));
    ');
    
    -- إنشاء سياسة للإدارة الكاملة للمسؤولين فقط
    EXECUTE format('
        CREATE POLICY "المسؤولون يمكنهم إدارة الأجهزة"
        ON public.devices FOR ALL
        USING (
            auth.uid() IN (
                SELECT id FROM auth.users
                WHERE auth.jwt() ->> ''role'' = ''admin''
            )
        );
    ');
    
    RAISE NOTICE 'تم إنشاء سياسات الأمان لجدول الأجهزة';
END $$;

-- 3. إعادة ضبط صلاحيات المستخدم المذكور
DO $$
BEGIN
    -- تغيير دور المستخدم من admin إلى user
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data::jsonb - 'role' || '{"role": "user"}'::jsonb
    WHERE email = 'milekem551@ingitel.com';
    
    RAISE NOTICE 'تم إعادة ضبط صلاحيات المستخدم milekem551@ingitel.com';
END $$;

-- 4. إنشاء دالة للتحقق من صلاحيات المستخدم
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- التحقق من أن المستخدم الحالي هو مسؤول حقيقي
    RETURN (
        SELECT EXISTS (
            SELECT 1
            FROM auth.users
            WHERE 
                id = auth.uid() AND
                raw_app_meta_data->>'role' = 'admin' AND
                email IN ('admin@example.com') -- قم بتغيير هذا إلى البريد الإلكتروني للمسؤول الحقيقي
        )
    );
END
$$;

-- 5. إنشاء وظيفة تشغيل (trigger) لمنع تعديل أدوار المستخدمين
CREATE OR REPLACE FUNCTION auth.prevent_role_escalation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- إذا كان هناك محاولة لتغيير دور المستخدم
    IF NEW.raw_app_meta_data->>'role' != OLD.raw_app_meta_data->>'role' THEN
        -- التحقق من أن المستخدم الحالي هو مسؤول حقيقي
        IF NOT auth.is_super_admin() THEN
            RAISE EXCEPTION 'غير مسموح بتغيير أدوار المستخدمين إلا للمسؤولين المصرح لهم';
        END IF;
    END IF;
    
    RETURN NEW;
END
$$;

-- إنشاء وظيفة التشغيل لمنع تعديل الأدوار
DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON auth.users;
CREATE TRIGGER prevent_role_escalation_trigger
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.prevent_role_escalation();

-- 6. إنشاء وظيفة لتعيين الدور الافتراضي للمستخدمين الجدد
CREATE OR REPLACE FUNCTION auth.set_default_role()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- تعيين دور المستخدم الجديد إلى 'user'
    NEW.raw_app_meta_data := 
        COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
        '{"role": "user"}'::jsonb;
    
    RETURN NEW;
END
$$;

-- إنشاء وظيفة التشغيل لتعيين الدور الافتراضي
DROP TRIGGER IF EXISTS set_default_role_trigger ON auth.users;
CREATE TRIGGER set_default_role_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.set_default_role();

-- ملاحظة هامة:
-- 1. قم بتغيير 'admin@example.com' إلى البريد الإلكتروني للمسؤول الحقيقي
-- 2. قم بتنفيذ هذا الملف فوراً لإصلاح مشاكل الأمان
-- 3. قم بتغيير كلمات المرور لجميع المستخدمين المسؤولين
-- 4. قم بمراجعة سجلات الوصول للتأكد من عدم وجود اختراقات سابقة
