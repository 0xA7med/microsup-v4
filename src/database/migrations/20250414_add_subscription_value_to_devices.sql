-- إضافة عمود سعر الاشتراك إلى جدول الأجهزة

-- التحقق من وجود العمود قبل إضافته
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'devices' AND column_name = 'price') THEN
        -- إضافة عمود سعر الاشتراك كرقم عشري
        ALTER TABLE devices ADD COLUMN price DECIMAL(10, 2);
        
        -- إضافة تعليق للعمود
        COMMENT ON COLUMN devices.price IS 'قيمة الاشتراك للجهاز';
    END IF;
END
$$;
