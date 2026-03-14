DO $$
DECLARE
    seq_record RECORD;
BEGIN
    -- Este script busca todas las secuencias que pertenezcan a columnas de tablas en el esquema 'public'
    -- y las actualiza al valor máximo de la columna + 1.
    FOR seq_record IN 
        SELECT 
            tc.table_name, 
            tc.column_name, 
            pg_get_serial_sequence(quote_ident(tc.table_schema) || '.' || quote_ident(tc.table_name), tc.column_name) as seq_name
        FROM 
            information_schema.columns tc
        WHERE 
            tc.table_schema = 'public' 
            AND pg_get_serial_sequence(quote_ident(tc.table_schema) || '.' || quote_ident(tc.table_name), tc.column_name) IS NOT NULL
    LOOP
        EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, false)', 
            seq_record.seq_name, 
            seq_record.column_name, 
            seq_record.table_name);
    END LOOP;
END $$;
