-- الحل المثالي لتنظيف قاعدة البيانات وإزالة العناصر الزائدة

-- 1. التأكد من وجود جدول الأجهزة
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

-- 2. التأكد من وجود عمود phone2 في جدول العملاء
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

-- 3. التأكد من وجود عمود active_devices_count في جدول العملاء
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

-- 4. نقل بيانات الاشتراك من جدول العملاء إلى جدول الأجهزة
DO $$
DECLARE
  client_record RECORD;
BEGIN
  -- التحقق من وجود الأعمدة المطلوبة في جدول العملاء
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name IN ('activation_code', 'subscription_start', 'subscription_end', 'subscription_type')
  ) THEN
    -- نقل البيانات لكل عميل
    FOR client_record IN SELECT id, activation_code, subscription_start, subscription_end, subscription_type, software_version FROM public.clients 
                         WHERE activation_code IS NOT NULL 
                         AND subscription_start IS NOT NULL 
                         AND subscription_end IS NOT NULL
    LOOP
      -- إنشاء جهاز جديد لكل عميل
      INSERT INTO public.devices (
        client_id, 
        activation_code, 
        subscription_start, 
        subscription_end, 
        subscription_type,
        software_version,
        device_type
      ) VALUES (
        client_record.id,
        client_record.activation_code,
        client_record.subscription_start,
        client_record.subscription_end,
        client_record.subscription_type,
        COALESCE(client_record.software_version, 'computer'),
        'computer'
      ) ON CONFLICT DO NOTHING; -- تجنب الإدخالات المكررة
    END LOOP;
  END IF;
END $$;

-- 5. تحديث عدد الأجهزة النشطة لكل عميل
UPDATE public.clients
SET active_devices_count = (
  SELECT COUNT(*) FROM public.devices WHERE client_id = clients.id
);

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

-- 8. إزالة الأعمدة الزائدة من جدول العملاء بعد نقل البيانات
DO $$
BEGIN
  -- التحقق من وجود الأعمدة قبل محاولة إزالتها
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'activation_code'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN activation_code;
  END IF;
  
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'subscription_start'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN subscription_start;
  END IF;
  
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'subscription_end'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN subscription_end;
  END IF;
  
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'subscription_type'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN subscription_type;
  END IF;
  
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'software_version'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN software_version;
  END IF;
END $$;
