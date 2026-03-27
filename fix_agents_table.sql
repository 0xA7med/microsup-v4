-- إصلاح هيكل جدول agents
BEGIN;

-- 1. إزالة العلاقات الخارجية من جدول clients
ALTER TABLE IF EXISTS clients DROP CONSTRAINT IF EXISTS fk_agent_id;
ALTER TABLE IF EXISTS clients DROP CONSTRAINT IF EXISTS fk_created_by;

-- 2. إعادة تسمية الجدول الحالي كنسخة احتياطية
ALTER TABLE IF EXISTS agents RENAME TO agents_backup;

-- 3. إنشاء الجدول الجديد مع الهيكل الصحيح
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    password TEXT
);

-- 4. نسخ البيانات من الجدول القديم مع تعيين القيم الافتراضية للأعمدة الجديدة
INSERT INTO agents (id, email, name, full_name, role, phone, address, created_at, updated_at, password)
SELECT 
    id, 
    email, 
    COALESCE(name, '') as name,
    COALESCE(name, '') as full_name,
    COALESCE(role, 'agent') as role,
    phone,
    address,
    COALESCE(created_at, NOW()) as created_at,
    NOW() as updated_at,
    password
FROM agents_backup;

-- 5. إنشاء فهارس
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(LOWER(email));

-- 6. إعادة إنشاء العلاقات مع جدول clients
ALTER TABLE clients 
    ADD CONSTRAINT fk_agent_id 
    FOREIGN KEY (agent_id) 
    REFERENCES agents(id) 
    ON DELETE CASCADE;

-- 7. تحديث سياسات RLS
DROP POLICY IF EXISTS "Enable all for admin" ON agents;
DROP POLICY IF EXISTS "Enable read access for all users" ON agents;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON agents;
DROP POLICY IF EXISTS "Agents can manage their own profile" ON agents;

-- سياسات RLS الجديدة
CREATE POLICY "Enable read access for all users" 
    ON agents FOR SELECT 
    USING (true);

CREATE POLICY "Enable insert for authenticated users" 
    ON agents FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Agents can manage their own profile" 
    ON agents FOR ALL 
    USING (id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- 8. تحديث حقل created_by في جدول clients
UPDATE clients SET created_by = agent_id WHERE created_by IS NULL;

-- 9. إضافة القيد لـ created_by بعد تحديث جميع القيم
ALTER TABLE clients
    ADD CONSTRAINT fk_created_by 
    FOREIGN KEY (created_by) 
    REFERENCES agents(id) 
    ON DELETE SET NULL;

-- 10. إنشاء دالة لتعيين updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. إنشاء trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_agents_modtime ON agents;
CREATE TRIGGER update_agents_modtime
BEFORE UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- 12. تنظيف (اختياري بعد التأكد من صحة البيانات)
-- DROP TABLE IF EXISTS agents_backup;

COMMIT;

-- رسالة نجاح
SELECT 'تم تحديث هيكل جدول agents بنجاح' as message;
