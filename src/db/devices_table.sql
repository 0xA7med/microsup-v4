-- إنشاء جدول الأجهزة
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  activation_code TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'computer',
  software_version TEXT NOT NULL DEFAULT 'computer',
  subscription_start DATE NOT NULL,
  subscription_end DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء مؤشر للبحث السريع بواسطة معرف العميل
CREATE INDEX IF NOT EXISTS idx_devices_client_id ON devices(client_id);

-- إنشاء دالة لتحديث تاريخ التحديث تلقائيًا
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء محفز لتحديث تاريخ التحديث تلقائيًا
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- إنشاء دالة لترحيل البيانات من جدول العملاء إلى جدول الأجهزة
-- يجب تنفيذ هذه الدالة مرة واحدة فقط بعد إنشاء الجدول
CREATE OR REPLACE FUNCTION migrate_client_devices()
RETURNS void AS $$
BEGIN
  -- إدراج سجلات الأجهزة من جدول العملاء
  INSERT INTO devices (
    client_id,
    activation_code,
    device_type,
    software_version,
    subscription_start,
    subscription_end
  )
  SELECT
    id AS client_id,
    activation_code,
    'computer' AS device_type,
    software_version,
    subscription_start::DATE,
    subscription_end::DATE
  FROM
    clients
  WHERE
    activation_code IS NOT NULL
    AND activation_code != '';
    
  -- تحديث عدد الأجهزة النشطة لكل عميل
  UPDATE clients
  SET active_devices_count = (
    SELECT COUNT(*)
    FROM devices
    WHERE devices.client_id = clients.id
  );
END;
$$ LANGUAGE plpgsql;

-- تعديل جدول العملاء
-- ملاحظة: يجب تنفيذ هذا الجزء بعد ترحيل البيانات
-- ALTER TABLE clients
-- ADD COLUMN IF NOT EXISTS active_devices_count INTEGER DEFAULT 0;
-- 
-- ALTER TABLE clients
-- DROP COLUMN IF EXISTS activation_code,
-- DROP COLUMN IF EXISTS subscription_start,
-- DROP COLUMN IF EXISTS subscription_end,
-- DROP COLUMN IF EXISTS device_count,
-- DROP COLUMN IF EXISTS software_version;
