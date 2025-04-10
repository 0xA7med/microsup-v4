-- إزالة قيود NOT NULL من عمود activation_code في جدول العملاء
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'activation_code'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN activation_code DROP NOT NULL;
  END IF;
END $$;

-- تحديث العملاء الحاليين لجعل قيمة activation_code فارغة
UPDATE public.clients SET activation_code = NULL WHERE activation_code IS NOT NULL;
