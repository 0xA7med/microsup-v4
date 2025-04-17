-- إضافة عمود البريد الإلكتروني إلى جدول الأجهزة إذا لم يكن موجودًا
DO $$
BEGIN
    -- التحقق من وجود العمود قبل إضافته
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'email'
    ) THEN
        -- إضافة عمود البريد الإلكتروني
        ALTER TABLE devices ADD COLUMN email VARCHAR(255);
    END IF;
END
$$;
