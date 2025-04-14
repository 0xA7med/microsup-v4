-- إضافة عمود price إلى جدول devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;

-- إنشاء دالة لحساب إجمالي القيمة المدفوعة لكل عميل
CREATE OR REPLACE FUNCTION calculate_client_total_price(client_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_price DECIMAL;
BEGIN
  SELECT COALESCE(SUM(price), 0) INTO total_price
  FROM devices
  WHERE client_id = calculate_client_total_price.client_id;
  
  RETURN total_price;
END;
$$ LANGUAGE plpgsql;

-- إنشاء وظيفة لحساب إجمالي القيمة المدفوعة حسب نوع الجهاز
CREATE OR REPLACE FUNCTION calculate_total_price_by_device_type(device_type TEXT)
RETURNS DECIMAL AS $$
DECLARE
  total_price DECIMAL;
BEGIN
  SELECT COALESCE(SUM(price), 0) INTO total_price
  FROM devices
  WHERE device_type = calculate_total_price_by_device_type.device_type;
  
  RETURN total_price;
END;
$$ LANGUAGE plpgsql;

-- إضافة مؤشر لتحسين أداء الاستعلامات على عمود price
CREATE INDEX IF NOT EXISTS idx_devices_price ON devices(price);

-- إضافة مؤشر لتحسين أداء الاستعلامات على عمود device_type
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);

-- إضافة سياسة RLS للسماح بتحديث عمود price
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_select_policy ON devices;
CREATE POLICY devices_select_policy ON devices
  FOR SELECT
  USING (auth.uid() = agent_id);

DROP POLICY IF EXISTS devices_insert_policy ON devices;
CREATE POLICY devices_insert_policy ON devices
  FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

DROP POLICY IF EXISTS devices_update_policy ON devices;
CREATE POLICY devices_update_policy ON devices
  FOR UPDATE
  USING (auth.uid() = agent_id);

DROP POLICY IF EXISTS devices_delete_policy ON devices;
CREATE POLICY devices_delete_policy ON devices
  FOR DELETE
  USING (auth.uid() = agent_id);
