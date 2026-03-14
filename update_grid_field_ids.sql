DO $$
DECLARE
    r RECORD;
    new_id_grid INTEGER := 1;
    new_id_field INTEGER := 1;
BEGIN
    ---------------------------------------------------------
    -- 1. ACTUALIZAR IDGRID (xgrid)
    ---------------------------------------------------------
    -- Eliminar constraints si existen
    BEGIN
        ALTER TABLE xfield DROP CONSTRAINT IF EXISTS fk_xfield_idgrid;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
        ALTER TABLE xgrid DROP CONSTRAINT IF EXISTS fk_xgrid_gparent;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    CREATE TEMP TABLE idgrid_mapping (
        old_id INTEGER,
        new_id INTEGER
    );

    FOR r IN (SELECT idgrid FROM xgrid ORDER BY idgrid) LOOP
        INSERT INTO idgrid_mapping VALUES (r.idgrid, new_id_grid);
        new_id_grid := new_id_grid + 1;
    END LOOP;

    -- Usar IDs negativos temporalmente para evitar colisiones PK o FK
    UPDATE xgrid x SET gparent = -m.new_id
    FROM idgrid_mapping m WHERE x.gparent = m.old_id;

    UPDATE xgrid x SET idgrid = -m.new_id
    FROM idgrid_mapping m WHERE x.idgrid = m.old_id;

    UPDATE xfield x SET idgrid = -m.new_id
    FROM idgrid_mapping m WHERE x.idgrid = m.old_id;

    -- Voltear a positivo
    UPDATE xgrid SET gparent = ABS(gparent) WHERE gparent < 0;
    UPDATE xgrid SET idgrid = ABS(idgrid) WHERE idgrid < 0;
    UPDATE xfield SET idgrid = ABS(idgrid) WHERE idgrid < 0;

    DROP TABLE idgrid_mapping;


    ---------------------------------------------------------
    -- 2. ACTUALIZAR IDFIELD (xfield)
    ---------------------------------------------------------
    CREATE TEMP TABLE idfield_mapping (
        old_id INTEGER,
        new_id INTEGER
    );

    -- Ordenamos primero por el idgrid y luego por idfield actual (o posición) para que tenga sentido el orden
    FOR r IN (SELECT idfield FROM xfield ORDER BY idgrid, posicion, idfield) LOOP
        INSERT INTO idfield_mapping VALUES (r.idfield, new_id_field);
        new_id_field := new_id_field + 1;
    END LOOP;

    -- Mismo truco con IDs negativos
    UPDATE xfield x SET idfield = -m.new_id
    FROM idfield_mapping m WHERE x.idfield = m.old_id;

    -- Voltear a positivo
    UPDATE xfield SET idfield = ABS(idfield) WHERE idfield < 0;

    DROP TABLE idfield_mapping;

END
$$;
