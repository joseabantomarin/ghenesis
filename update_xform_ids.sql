DO $$
DECLARE
    r RECORD;
    new_id INTEGER := 1;
BEGIN
    -- Eliminar constraint si existe
    BEGIN
        ALTER TABLE xcontrols DROP CONSTRAINT IF EXISTS fk_xcontrols_idform;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Crear tabla temporal de mapeo
    CREATE TEMP TABLE id_mapping (
        old_id INTEGER,
        new_id INTEGER
    );

    -- Llenar mapeo de IDs para mantener el orden actual de idform
    FOR r IN (SELECT idform FROM xforms ORDER BY idform) LOOP
        INSERT INTO id_mapping VALUES (r.idform, new_id);
        new_id := new_id + 1;
    END LOOP;

    -- 1. Mover IDs a negativo para evitar conflictos de llave primaria o única
    
    -- Actualizar idparent en xforms
    UPDATE xforms x
    SET idparent = -m.new_id
    FROM id_mapping m
    WHERE x.idparent = m.old_id;

    -- Actualizar idform en xforms
    UPDATE xforms x
    SET idform = -m.new_id
    FROM id_mapping m
    WHERE x.idform = m.old_id;

    -- Actualizar idform en xgrid
    UPDATE xgrid x
    SET idform = -m.new_id
    FROM id_mapping m
    WHERE x.idform = m.old_id;

    -- Actualizar idform en xcontrols
    UPDATE xcontrols x
    SET idform = -m.new_id
    FROM id_mapping m
    WHERE x.idform = m.old_id;

    -- Actualizar idform en xpermissions
    UPDATE xpermissions x
    SET idform = -m.new_id
    FROM id_mapping m
    WHERE x.idform = m.old_id;


    -- 2. Voltear a positivo 
    UPDATE xforms SET idparent = ABS(idparent) WHERE idparent < 0;
    UPDATE xforms SET idform = ABS(idform) WHERE idform < 0;
    UPDATE xgrid SET idform = ABS(idform) WHERE idform < 0;
    UPDATE xcontrols SET idform = ABS(idform) WHERE idform < 0;
    UPDATE xpermissions SET idform = ABS(idform) WHERE idform < 0;

    DROP TABLE id_mapping;
END
$$;
