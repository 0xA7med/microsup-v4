-- استعلام لاستخراج هيكل الجدالات مع أعمدة كل جدول
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    c.udt_name,
    c.is_identity,
    tc.constraint_type,
    kcu.ordinal_position
FROM 
    information_schema.tables t
    JOIN information_schema.columns c 
        ON t.table_name = c.table_name
    LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
    LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_name = tc.table_name
WHERE 
    t.table_schema = 'public'
    AND t.table_name IN ('agents', 'backups', 'clients', 'devices')
ORDER BY 
    t.table_name,
    c.ordinal_position;
