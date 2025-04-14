-- إضافة عمود activation_code إلى جدول clients
ALTER TABLE IF EXISTS "public"."clients"
ADD COLUMN IF NOT EXISTS "activation_code" TEXT;

-- تحديث عمود activation_code بقيم افتراضية للسجلات الموجودة
UPDATE "public"."clients"
SET "activation_code" = 
    UPPER(
        SUBSTRING(
            MD5(RANDOM()::TEXT || NOW()::TEXT) 
            FROM 1 FOR 8
        )
    )
WHERE "activation_code" IS NULL;

-- إضافة تعليق على العمود
COMMENT ON COLUMN "public"."clients"."activation_code" IS 'رمز تفعيل العميل';
