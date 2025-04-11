-- إضافة عمود approval_status إلى جدول devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES agents(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- إضافة تعليق على العمود
COMMENT ON COLUMN devices.approval_status IS 'حالة الموافقة على الجهاز: pending, approved, rejected';
COMMENT ON COLUMN devices.approval_date IS 'تاريخ الموافقة أو الرفض';
COMMENT ON COLUMN devices.approved_by IS 'معرف المندوب الذي قام بالموافقة أو الرفض';
COMMENT ON COLUMN devices.rejection_reason IS 'سبب الرفض إذا تم رفض الجهاز';
