-- إنشاء جدول backups لتخزين معلومات النسخ الاحتياطي
CREATE TABLE IF NOT EXISTS public.backups (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    data JSONB NOT NULL,
    stats JSONB,
    notes TEXT
);

-- إضافة السياسات اللازمة
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون المصرح لهم يمكنهم قراءة النسخ الاحتياطي"
    ON public.backups FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "المستخدمون المصرح لهم يمكنهم إنشاء النسخ الاحتياطي"
    ON public.backups FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- إنشاء دالة لاستعادة النسخ الاحتياطي
CREATE OR REPLACE FUNCTION public.restore_backup(data JSONB)
RETURNS VOID AS $$
BEGIN
    -- حذف البيانات الحالية
    DELETE FROM public.devices WHERE id != 0;
    DELETE FROM public.clients WHERE id != 0;
    DELETE FROM public.agents WHERE id != 0;

    -- استعادة بيانات العملاء
    INSERT INTO public.clients (
        client_name, organization_name, activity_type, phone, phone2, address,
        notes, agent_id, subscription_type, subscription_start, subscription_end
    )
    SELECT 
        client_name, organization_name, activity_type, phone, phone2, address,
        notes, agent_id, subscription_type, subscription_start, subscription_end
    FROM jsonb_array_elements(data->'clients')
    WHERE (data->'clients') IS NOT NULL;

    -- استعادة بيانات الأجهزة
    INSERT INTO public.devices (
        client_id, activation_code, subscription_start, subscription_end,
        subscription_type, device_type, notes, approval_status
    )
    SELECT 
        client_id, activation_code, subscription_start, subscription_end,
        subscription_type, device_type, notes, approval_status
    FROM jsonb_array_elements(data->'devices')
    WHERE (data->'devices') IS NOT NULL;

    -- استعادة بيانات الوكلاء
    INSERT INTO public.agents (
        agent_name, phone, address, notes
    )
    SELECT 
        agent_name, phone, address, notes
    FROM jsonb_array_elements(data->'agents')
    WHERE (data->'agents') IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إضافة صلاحيات للدالة
GRANT EXECUTE ON FUNCTION public.restore_backup(JSONB) TO authenticated;
