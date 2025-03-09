-- إضافة عمود approval_status إلى جدول agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';

-- تحديث القيم الموجودة لتكون 'approved' للمستخدمين الحاليين
UPDATE agents SET approval_status = 'approved' WHERE approval_status IS NULL;

-- إضافة قيود للتأكد من أن القيم صالحة
ALTER TABLE agents ADD CONSTRAINT approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));
