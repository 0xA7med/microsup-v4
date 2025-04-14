-- إضافة عمود قيمة الاشتراك إلى جدول العملاء

-- التحقق من وجود العمود قبل إضافته
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clients' AND column_name = 'subscription_value') THEN
        -- إضافة عمود قيمة الاشتراك كرقم عشري
        ALTER TABLE clients ADD COLUMN subscription_value DECIMAL(10, 2) DEFAULT 0;
        
        -- إضافة تعليق للعمود
        COMMENT ON COLUMN clients.subscription_value IS 'قيمة الاشتراك للعميل';
        
        -- إنشاء مؤشر لتحسين أداء الاستعلامات
        CREATE INDEX IF NOT EXISTS idx_clients_subscription_value ON clients(subscription_value);
    END IF;
END
$$;

-- إنشاء دالة لحساب إجمالي قيمة الاشتراكات حسب نوع الاشتراك
CREATE OR REPLACE FUNCTION calculate_total_value_by_subscription_type(subscription_type TEXT)
RETURNS DECIMAL AS $$
DECLARE
  total_value DECIMAL;
BEGIN
  SELECT COALESCE(SUM(subscription_value), 0) INTO total_value
  FROM clients
  WHERE subscription_type = calculate_total_value_by_subscription_type.subscription_type;
  
  RETURN total_value;
END;
$$ LANGUAGE plpgsql;
