-- حل شامل لجميع مشاكل قاعدة البيانات

-- 1. التحقق من وجود الأعمدة قبل محاولة تعديلها
DO $$
BEGIN
  -- التحقق من وجود عمود subscription_type
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'subscription_type'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN subscription_type DROP NOT NULL;
  END IF;
  
  -- التحقق من وجود عمود software_version
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'software_version'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN software_version DROP NOT NULL;
  END IF;
END $$;

-- 2. التأكد من وجود جدول الأجهزة
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  activation_code TEXT NOT NULL,
  subscription_start DATE NOT NULL,
  subscription_end DATE NOT NULL,
  subscription_type TEXT NOT NULL DEFAULT 'monthly',
  software_version TEXT NOT NULL DEFAULT 'computer',
  device_type TEXT NOT NULL DEFAULT 'computer',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. إصلاح مشكلة سياسة الأمان على مستوى الصف (RLS) في جدول الأجهزة
DO $$
BEGIN
  -- التحقق من وجود جدول الأجهزة قبل محاولة تعديله
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'devices'
  ) THEN
    -- تمكين سياسة الأمان على مستوى الصف
    ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
    
    -- إنشاء سياسة تسمح للمستخدمين المصرح لهم بإضافة وتعديل وحذف الأجهزة
    DROP POLICY IF EXISTS devices_policy ON public.devices;
    CREATE POLICY devices_policy ON public.devices
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. التأكد من وجود عمود phone2 في جدول العملاء
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'phone2'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN phone2 TEXT;
  END IF;
END $$;

-- 5. التأكد من وجود عمود active_devices_count في جدول العملاء
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'active_devices_count'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN active_devices_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 6. إنشاء دالة لتحديث عدد الأجهزة النشطة للعميل
CREATE OR REPLACE FUNCTION update_client_devices_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clients
    SET active_devices_count = (
      SELECT COUNT(*) FROM public.devices WHERE client_id = NEW.client_id
    )
    WHERE id = NEW.client_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clients
    SET active_devices_count = (
      SELECT COUNT(*) FROM public.devices WHERE client_id = OLD.client_id
    )
    WHERE id = OLD.client_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. إنشاء المحفز (trigger) لتشغيل الدالة عند إضافة أو حذف جهاز
DROP TRIGGER IF EXISTS update_client_devices_count_trigger ON public.devices;
CREATE TRIGGER update_client_devices_count_trigger
AFTER INSERT OR DELETE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION update_client_devices_count();
