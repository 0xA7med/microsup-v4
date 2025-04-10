-- إضافة عمود رقم الهاتف الثاني إلى جدول العملاء
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
