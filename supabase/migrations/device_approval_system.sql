-- إضافة حقول نظام الموافقة إلى جدول الأجهزة
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- تحديث القيم الموجودة لتكون 'approved' للأجهزة الحالية
UPDATE devices SET approval_status = 'approved' WHERE approval_status IS NULL;

-- إضافة قيود للتأكد من أن القيم صالحة
ALTER TABLE devices ADD CONSTRAINT devices_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- إنشاء فهرس للبحث السريع حسب حالة الموافقة
CREATE INDEX IF NOT EXISTS idx_devices_approval_status ON devices(approval_status);

-- إنشاء جدول للإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_to VARCHAR(50) NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء مؤشر للبحث السريع بواسطة معرف المستخدم
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- إنشاء مؤشر للبحث السريع بواسطة حالة القراءة
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- إنشاء دالة لإضافة إشعار عند تغيير حالة الموافقة
CREATE OR REPLACE FUNCTION notify_device_approval_status_change()
RETURNS TRIGGER AS $$
DECLARE
  client_name TEXT;
  device_type_text TEXT;
  manager_id UUID;
  agent_id UUID;
BEGIN
  -- الحصول على اسم العميل ونوع الجهاز
  SELECT c.client_name, d.device_type INTO client_name, device_type_text
  FROM devices d
  JOIN clients c ON d.client_id = c.id
  WHERE d.id = NEW.id;

  -- إذا تم تغيير الحالة إلى 'approved' أو 'rejected'
  IF NEW.approval_status <> OLD.approval_status AND (NEW.approval_status = 'approved' OR NEW.approval_status = 'rejected') THEN
    -- الحصول على معرف المندوب الذي أضاف العميل
    SELECT created_by INTO agent_id
    FROM clients c
    JOIN devices d ON c.id = d.client_id
    WHERE d.id = NEW.id;

    -- إضافة إشعار للمندوب
    IF agent_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        related_to,
        related_id
      ) VALUES (
        agent_id,
        CASE 
          WHEN NEW.approval_status = 'approved' THEN 'تمت الموافقة على الجهاز'
          ELSE 'تم رفض الجهاز'
        END,
        CASE 
          WHEN NEW.approval_status = 'approved' THEN 'تمت الموافقة على جهاز ' || device_type_text || ' للعميل ' || client_name
          ELSE 'تم رفض جهاز ' || device_type_text || ' للعميل ' || client_name || '. السبب: ' || COALESCE(NEW.rejection_reason, 'غير محدد')
        END,
        'device',
        NEW.id
      );
    END IF;
  END IF;

  -- إذا تم إضافة جهاز جديد (حالة 'pending')
  IF NEW.approval_status = 'pending' AND TG_OP = 'INSERT' THEN
    -- إرسال إشعار لجميع المديرين
    FOR manager_id IN (SELECT id FROM auth.users WHERE user_metadata->>'role' = 'manager')
    LOOP
      INSERT INTO notifications (
        user_id,
        title,
        message,
        related_to,
        related_id
      ) VALUES (
        manager_id,
        'جهاز جديد بانتظار الموافقة',
        'تمت إضافة جهاز ' || device_type_text || ' جديد للعميل ' || client_name || ' وينتظر الموافقة',
        'device',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء محفز لإرسال الإشعارات عند تغيير حالة الموافقة
DROP TRIGGER IF EXISTS device_approval_status_change ON devices;
CREATE TRIGGER device_approval_status_change
AFTER INSERT OR UPDATE OF approval_status ON devices
FOR EACH ROW
EXECUTE FUNCTION notify_device_approval_status_change();
