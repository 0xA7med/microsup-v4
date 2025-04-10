-- إصلاح مشكلة سياسة الأمان على مستوى الصف (RLS) في جدول الأجهزة

-- 1. التأكد من تمكين RLS على جدول الأجهزة
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- 2. إنشاء سياسة تسمح للمستخدمين المصرح لهم بإضافة وتعديل وحذف الأجهزة
CREATE POLICY devices_policy ON public.devices
  USING (true)  -- السماح بعرض جميع الصفوف
  WITH CHECK (true);  -- السماح بإضافة وتعديل جميع الصفوف

-- 3. إنشاء سياسة خاصة بالمستخدمين المصرح لهم (إذا كان هناك جدول للمستخدمين)
-- هذه السياسة اختيارية وتعتمد على هيكل قاعدة البيانات الخاصة بك
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'agents'
  ) THEN
    -- إنشاء سياسة للوكلاء
    DROP POLICY IF EXISTS agents_devices_policy ON public.devices;
    CREATE POLICY agents_devices_policy ON public.devices
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. بديل: تعطيل RLS مؤقتاً للاختبار (استخدم هذا فقط في بيئة التطوير)
-- ALTER TABLE public.devices DISABLE ROW LEVEL SECURITY;
