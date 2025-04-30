-- إعادة ضبط وإنشاء سياسات الأمان في قاعدة البيانات
-- هذا الملف يقوم بحذف جميع السياسات الموجودة وإنشاء سياسات جديدة بشكل صحيح

-- 1. حذف جميع السياسات الموجودة
DO $$
DECLARE
    policy_record RECORD;
    table_record RECORD;
BEGIN
    -- حذف جميع السياسات من جميع الجداول العامة
    FOR table_record IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        -- استثناء جداول النظام
        IF table_record.tablename NOT IN ('schema_migrations', 'spatial_ref_sys') THEN
            -- الحصول على جميع السياسات لهذا الجدول
            FOR policy_record IN 
                SELECT policyname FROM pg_policies 
                WHERE schemaname = 'public' AND tablename = table_record.tablename
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 
                    policy_record.policyname, table_record.tablename);
                RAISE NOTICE 'تم حذف السياسة % من الجدول %', 
                    policy_record.policyname, table_record.tablename;
            END LOOP;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'تم حذف جميع السياسات بنجاح';
END $$;

-- 2. تفعيل سياسات أمان الصفوف (RLS) على جميع الجداول
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

-- 3. إنشاء الأدوار (roles) في النظام
DO $$
BEGIN
    -- إنشاء دور للمسؤولين
    DROP ROLE IF EXISTS app_admin;
    CREATE ROLE app_admin;
    
    -- إنشاء دور للمستخدمين العاديين
    DROP ROLE IF EXISTS app_user;
    CREATE ROLE app_user;
    
    -- إنشاء دور للوكلاء
    DROP ROLE IF EXISTS app_agent;
    CREATE ROLE app_agent;
    
    -- إنشاء دور للضيوف
    DROP ROLE IF EXISTS app_anonymous;
    CREATE ROLE app_anonymous;
    
    RAISE NOTICE 'تم إنشاء الأدوار بنجاح';
END $$;

-- 4. إنشاء سياسات أمان لجدول العملاء (clients)
DO $$
BEGIN
    -- سياسة للمسؤولين: يمكنهم القيام بجميع العمليات
    EXECUTE format('
        CREATE POLICY "المسؤولون يمكنهم إدارة العملاء"
        ON public.clients FOR ALL
        TO app_admin
        USING (true);
    ');
    
    -- سياسة للوكلاء: يمكنهم رؤية وتعديل العملاء التابعين لهم فقط
    EXECUTE format('
        CREATE POLICY "الوكلاء يمكنهم إدارة العملاء التابعين لهم"
        ON public.clients FOR ALL
        TO app_agent
        USING (
            auth.uid() IN (
                SELECT id FROM auth.users
                WHERE raw_app_meta_data->>''role'' = ''agent''
            )
            AND (agent_id = auth.uid() OR created_by = auth.uid())
        );
    ');
    
    -- سياسة للمستخدمين العاديين: القراءة فقط
    EXECUTE format('
        CREATE POLICY "المستخدمون العاديون يمكنهم مشاهدة العملاء فقط"
        ON public.clients FOR SELECT
        TO app_user
        USING (true);
    ');
    
    RAISE NOTICE 'تم إنشاء سياسات الأمان لجدول العملاء';
END $$;

-- 5. إنشاء سياسات أمان لجدول الأجهزة (devices)
DO $$
BEGIN
    -- سياسة للمسؤولين: يمكنهم القيام بجميع العمليات
    EXECUTE format('
        CREATE POLICY "المسؤولون يمكنهم إدارة الأجهزة"
        ON public.devices FOR ALL
        TO app_admin
        USING (true);
    ');
    
    -- سياسة للوكلاء: يمكنهم رؤية وتعديل الأجهزة التابعة لعملائهم فقط
    EXECUTE format('
        CREATE POLICY "الوكلاء يمكنهم إدارة أجهزة عملائهم"
        ON public.devices FOR ALL
        TO app_agent
        USING (
            client_id IN (
                SELECT id FROM public.clients
                WHERE agent_id = auth.uid() OR created_by = auth.uid()
            )
        );
    ');
    
    -- سياسة للمستخدمين العاديين: القراءة فقط
    EXECUTE format('
        CREATE POLICY "المستخدمون العاديون يمكنهم مشاهدة الأجهزة فقط"
        ON public.devices FOR SELECT
        TO app_user
        USING (true);
    ');
    
    RAISE NOTICE 'تم إنشاء سياسات الأمان لجدول الأجهزة';
END $$;

-- 6. إنشاء سياسات أمان لجدول الوكلاء (agents)
DO $$
BEGIN
    -- سياسة للمسؤولين: يمكنهم القيام بجميع العمليات
    EXECUTE format('
        CREATE POLICY "المسؤولون يمكنهم إدارة الوكلاء"
        ON public.agents FOR ALL
        TO app_admin
        USING (true);
    ');
    
    -- سياسة للوكلاء: يمكنهم رؤية وتعديل بياناتهم الشخصية فقط
    EXECUTE format('
        CREATE POLICY "الوكلاء يمكنهم إدارة بياناتهم الشخصية"
        ON public.agents FOR ALL
        TO app_agent
        USING (id = auth.uid());
    ');
    
    -- سياسة للمستخدمين العاديين: القراءة فقط للبيانات العامة
    EXECUTE format('
        CREATE POLICY "المستخدمون العاديون يمكنهم مشاهدة بيانات الوكلاء العامة"
        ON public.agents FOR SELECT
        TO app_user
        USING (true);
    ');
    
    RAISE NOTICE 'تم إنشاء سياسات الأمان لجدول الوكلاء';
END $$;

-- 7. إنشاء سياسات أمان لجدول المستخدمين (users) إذا كان موجوداً
DO $$
BEGIN
    -- التحقق من وجود جدول المستخدمين
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'users'
    ) THEN
        -- سياسة للمسؤولين: يمكنهم القيام بجميع العمليات
        EXECUTE format('
            CREATE POLICY "المسؤولون يمكنهم إدارة المستخدمين"
            ON public.users FOR ALL
            TO app_admin
            USING (true);
        ');
        
        -- سياسة للمستخدمين: يمكنهم رؤية وتعديل بياناتهم الشخصية فقط
        EXECUTE format('
            CREATE POLICY "المستخدمون يمكنهم إدارة بياناتهم الشخصية"
            ON public.users FOR ALL
            TO app_user, app_agent
            USING (id = auth.uid());
        ');
        
        RAISE NOTICE 'تم إنشاء سياسات الأمان لجدول المستخدمين';
    ELSE
        RAISE NOTICE 'جدول المستخدمين غير موجود، تم تخطي إنشاء سياسات له';
    END IF;
END $$;

-- 8. إنشاء سياسات أمان لجدول النسخ الاحتياطية (backups) إذا كان موجوداً
DO $$
BEGIN
    -- التحقق من وجود جدول النسخ الاحتياطية
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'backups'
    ) THEN
        -- سياسة للمسؤولين فقط: يمكنهم القيام بجميع العمليات
        EXECUTE format('
            CREATE POLICY "المسؤولون فقط يمكنهم إدارة النسخ الاحتياطية"
            ON public.backups FOR ALL
            TO app_admin
            USING (true);
        ');
        
        RAISE NOTICE 'تم إنشاء سياسات الأمان لجدول النسخ الاحتياطية';
    ELSE
        RAISE NOTICE 'جدول النسخ الاحتياطية غير موجود، تم تخطي إنشاء سياسات له';
    END IF;
END $$;

-- 9. تعيين الأدوار للمستخدمين بناءً على البيانات الموجودة
DO $$
BEGIN
    -- تعيين دور المسؤول للمستخدمين المسؤولين
    EXECUTE format('
        GRANT app_admin TO authenticated;
    ');
    
    -- تعيين دور المستخدم العادي للمستخدمين العاديين
    EXECUTE format('
        GRANT app_user TO authenticated;
    ');
    
    -- تعيين دور الوكيل للوكلاء
    EXECUTE format('
        GRANT app_agent TO authenticated;
    ');
    
    -- تعيين دور الضيف للمستخدمين غير المسجلين
    EXECUTE format('
        GRANT app_anonymous TO anon;
    ');
    
    RAISE NOTICE 'تم تعيين الأدوار للمستخدمين بنجاح';
END $$;

-- 10. إنشاء دالة للتحقق من صلاحيات المستخدم
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- التحقق من أن المستخدم الحالي مسجل الدخول
    IF auth.uid() IS NULL THEN
        RETURN 'anonymous';
    END IF;
    
    -- استرجاع دور المستخدم من البيانات الوصفية
    RETURN coalesce(
        (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
        'user'  -- القيمة الافتراضية إذا لم يكن هناك دور محدد
    );
END
$$;

-- 11. إنشاء دالة لتحديث دور المستخدم (للمسؤولين فقط)
CREATE OR REPLACE FUNCTION auth.update_user_role(user_id UUID, new_role TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- التحقق من أن المستخدم الحالي هو مسؤول
    IF auth.get_user_role() != 'admin' THEN
        RAISE EXCEPTION 'غير مصرح لك بتغيير أدوار المستخدمين';
        RETURN FALSE;
    END IF;
    
    -- التحقق من صحة الدور الجديد
    IF new_role NOT IN ('admin', 'agent', 'user') THEN
        RAISE EXCEPTION 'الدور غير صالح. الأدوار المسموح بها هي: admin, agent, user';
        RETURN FALSE;
    END IF;
    
    -- تحديث دور المستخدم
    UPDATE auth.users
    SET raw_app_meta_data = 
        raw_app_meta_data - 'role' || 
        jsonb_build_object('role', new_role)
    WHERE id = user_id;
    
    RETURN FOUND;
END
$$;

-- 12. إنشاء محفز (trigger) لتعيين الدور الافتراضي للمستخدمين الجدد
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

-- إنشاء المحفز
DROP TRIGGER IF EXISTS set_default_role_trigger ON auth.users;
CREATE TRIGGER set_default_role_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.set_default_role();

-- 13. إعادة ضبط صلاحيات المستخدم المخترق
DO $$
BEGIN
    -- تغيير دور المستخدم من admin إلى user
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data::jsonb - 'role' || '{"role": "user"}'::jsonb
    WHERE email = 'milekem551@ingitel.com';
    
    RAISE NOTICE 'تم إعادة ضبط صلاحيات المستخدم milekem551@ingitel.com';
END $$;

-- 14. تعيين المسؤول الرئيسي
DO $$
BEGIN
    -- تغيير المستخدم التالي إلى مسؤول رئيسي
    -- قم بتغيير عنوان البريد الإلكتروني إلى بريدك الإلكتروني
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data::jsonb - 'role' || '{"role": "admin"}'::jsonb
    WHERE email = 'zeero4123@gmail.com';  -- قم بتغيير هذا إلى البريد الإلكتروني للمسؤول الحقيقي
    
    RAISE NOTICE 'تم تعيين المسؤول الرئيسي بنجاح';
END $$;

-- ملاحظة هامة:
-- 1. قم بتغيير 'admin@example.com' إلى البريد الإلكتروني للمسؤول الحقيقي
-- 2. قم بتنفيذ هذا الملف فوراً لإصلاح مشاكل الأمان
-- 3. قم بتغيير كلمات المرور لجميع المستخدمين المسؤولين
-- 4. قم بمراجعة سجلات الوصول للتأكد من عدم وجود اختراقات سابقة
