const db = require('../config/db');

class SequenceService {
    /**
     * Sincroniza todas las secuencias de la base de datos con el valor máximo de sus columnas.
     * Esto hace que el SERIAL de Postgres se comporte como el AUTO_INCREMENT de MySQL
     * incluso después de importaciones masivas de datos.
     */
    async syncAllSequences() {
        const sql = `
            DO $$
            DECLARE
                seq_record RECORD;
            BEGIN
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
        `;
        try {
            await db.query(sql);
            console.log('✅ Todas las secuencias de la base de datos han sido sincronizadas.');
            return { success: true };
        } catch (error) {
            console.error('❌ Error sincronizando secuencias:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new SequenceService();
