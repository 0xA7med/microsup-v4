-- إنشاء جدول الأجهزة إذا لم يكن موجوداً
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

-- إنشاء مؤشر للبحث السريع بواسطة معرف العميل
CREATE INDEX IF NOT EXISTS idx_devices_client_id ON public.devices(client_id);

-- إضافة عمود لعدد الأجهزة النشطة في جدول العملاء إذا لم يكن موجوداً
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

-- إنشاء دالة لتحديث عدد الأجهزة النشطة للعميل
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

-- إنشاء المحفز (trigger) لتشغيل الدالة عند إضافة أو حذف جهاز
DROP TRIGGER IF EXISTS update_client_devices_count_trigger ON public.devices;
CREATE TRIGGER update_client_devices_count_trigger
AFTER INSERT OR DELETE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION update_client_devices_count();
