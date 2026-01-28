-- Test query to check client_integrations table structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'client_integrations'
ORDER BY ordinal_position;

-- Check unique constraints
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'client_integrations'
AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY');
