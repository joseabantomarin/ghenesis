const MetadataService = require('../services/MetadataService');
const ScriptingService = require('../services/ScriptingService');
const db = require('../config/db');

exports.getMenu = async (req, res) => {
    try {
        // Al pedir el menú (típicamente al pulsar F5 o cargar el sistema cerrado), forzamos
        // la recarga de toda la estructura de la base de datos para no depender del reinicio de Node.
        await MetadataService.refresh();
        const menu = MetadataService.getAppMenu();
        res.json({ success: true, data: menu });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getFormDefinition = (req, res) => {
    try {
        const idform = Number(req.params.idform);
        const metadata = MetadataService.getFormMetadata(idform);

        if (!metadata) {
            return res.status(404).json({ success: false, error: 'Formulario no encontrado en metadatos' });
        }

        res.json({ success: true, data: metadata });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Función Auxiliar para envolver consultas (Query Wrapping)
// Recibe un Query Base y le aplica Paginación, Búsqueda, Filtrado Maestro-Detalle y Ordenamiento
const buildWrappedQuery = async (baseSql, baseParams, reqQuery, gridMeta) => {
    let sql = `SELECT * FROM (${baseSql}) AS wrapped_query`;
    const queryParams = [...baseParams];
    let paramIndex = queryParams.length + 1;
    const whereClauses = [];

    // Filtro Maestro-Detalle
    const masterField = reqQuery.masterField;
    const masterValue = reqQuery.masterValue;
    if (masterField && masterValue !== undefined) {
        whereClauses.push(`${masterField} = $${paramIndex}`);
        queryParams.push(masterValue);
        paramIndex++;
    }

    // Búsqueda Global (Search Text)
    const searchText = reqQuery.search;
    if (searchText && searchText.trim() !== '') {
        const textFields = gridMeta.fields
            .filter(f => f.tipod === 'C' || f.tipod === 'W')
            .map(f => f.campo);

        if (textFields.length > 0) {
            const searchClauses = textFields.map(field => `${field} ILIKE $${paramIndex}`);
            whereClauses.push(`(${searchClauses.join(' OR ')})`);
            queryParams.push(`%${searchText}%`);
            paramIndex++;
        }
    }

    // Filtros de Cabecera de Columna (AG Grid)
    if (reqQuery.filters) {
        try {
            const filters = JSON.parse(reqQuery.filters);
            Object.keys(filters).forEach(colId => {
                const isValidField = gridMeta.fields.some(f => f.campo === colId);
                if (isValidField) {
                    const filterObj = filters[colId];
                    if (filterObj.filterType === 'text') {
                        // AG Grid 'contains' match
                        whereClauses.push(`${colId} ILIKE $${paramIndex}`);
                        queryParams.push(`%${filterObj.filter}%`);
                        paramIndex++;
                    } else if (filterObj.filterType === 'number') {
                        // AG Grid number match ('equals' default)
                        whereClauses.push(`${colId} = $${paramIndex}`);
                        queryParams.push(filterObj.filter);
                        paramIndex++;
                    }
                }
            });
        } catch (e) {
            console.error("❌ Error parseando filtros de cabecera:", e);
        }
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    // Recuperamos el Count MIENTRAS mantenemos el filtro (antes de paginacion y orden)
    const finalCountSql = `SELECT COUNT(*) FROM (${sql}) AS count_query`;
    const finalCountRes = await db.query(finalCountSql, queryParams);
    const finalTotalRecords = finalCountRes?.rows?.[0]?.count ? parseInt(finalCountRes.rows[0].count) : 0;

    // Agregar ORDENAMIENTO (ORDER BY) si viene del cliente
    const { sortField, sortOrder } = reqQuery;
    if (sortField) {
        const isValidField = gridMeta.fields.some(f => f.campo === sortField);
        if (isValidField) {
            const order = (sortOrder || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            sql += ` ORDER BY ${sortField} ${order}`;
        }
    }

    // Agregar paginación al SQL original
    const page = parseInt(reqQuery.page) || 1;
    let limit = parseInt(reqQuery.limit) || gridMeta.rxpage || 50;
    const offset = (page - 1) * limit;

    if (limit > 0) {
        sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
    }

    let rawData;
    try {
        rawData = await db.query(sql, queryParams);
    } catch (e) {
        console.error(`❌ Error SQL en query dinámica envuelta:`, e.message);
        throw e;
    }

    return {
        data: rawData.rows,
        meta: {
            page,
            limit,
            total: finalTotalRecords,
            totalPages: Math.ceil(finalTotalRecords / (limit || 1))
        }
    };
};

// Data endpoint (El que trae los valores de la Base de datos física usando XGRID.vquery)
exports.getGridData = async (req, res) => {
    try {
        const idform = Number(req.params.idform);
        const idgrid = Number(req.params.idgrid);

        const metadata = MetadataService.getFormMetadata(idform);
        if (!metadata) return res.status(404).json({ error: 'Módulo no existe' });

        const gridMeta = metadata.grids.find(g => g.idgrid === idgrid);
        if (!gridMeta) return res.status(404).json({ error: 'Grilla no configurada' });

        // Parámetros por si el sopen los necesita puros
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || gridMeta.rxpage || 50;
        const offset = (page - 1) * limit;

        // --- INTERCEPTOR SOPEN ---
        if (gridMeta.sopen) {
            console.log(`⚡ Leyendo datos vía sopen para Grilla ${idgrid}...`);

            // Parsear el registro padre entero si la grilla hija lo recibe
            let decodedMasterRecord = null;
            if (req.query.masterRecordPayload) {
                try {
                    decodedMasterRecord = JSON.parse(req.query.masterRecordPayload);
                } catch (e) {
                    console.error("No se pudo parsear masterRecordPayload", e);
                }
            }

            const contextParams = {
                page, limit, offset,
                search: req.query.search,
                masterField: req.query.masterField,
                masterValue: req.query.masterValue,
                masterRecord: decodedMasterRecord, // <- Se expuso todo el objeto padre al SandBox
                sortField: req.query.sortField,
                sortOrder: req.query.sortOrder
            };

            const sopenResult = await ScriptingService.runScript(gridMeta.sopen, contextParams);

            // Si el script retorna un objeto de Query Wrapping dinámico:
            if (sopenResult && sopenResult.wrapQuery) {
                console.log(`⚡ Aplicando Query Wrapping al SQL de Sopen...`);
                try {
                    const wrappedResult = await buildWrappedQuery(sopenResult.wrapQuery, sopenResult.wrapParams || [], req.query, gridMeta);
                    return res.json({ success: true, ...wrappedResult });
                } catch (e) {
                    return res.status(500).json({ success: false, error: 'Error ejecutando sopen WrapQuery: ' + e.message });
                }
            }

            // Fallback original: El script retornó la data pura
            return res.json({
                success: true,
                data: sopenResult?.data || sopenResult || [],
                meta: {
                    page,
                    limit,
                    total: sopenResult?.total || (sopenResult?.data?.length || sopenResult?.length || 0),
                    totalPages: Math.ceil((sopenResult?.total || sopenResult?.length || 0) / (limit || 1))
                }
            });
        }
        // -------------------------

        // FLUJO ESTANDAR (sin sopen): Usar la tabla o vista configurada en VQUERY
        const physicalTableOrView = gridMeta.vquery;
        if (!physicalTableOrView) return res.status(500).json({ error: 'No se definió VQUERY ni sopen' });

        try {
            const wrappedResult = await buildWrappedQuery(`SELECT * FROM ${physicalTableOrView}`, [], req.query, gridMeta);
            return res.json({ success: true, ...wrappedResult });
        } catch (e) {
            return res.status(500).json({ success: false, error: 'Error de BD: ' + e.message });
        }

    } catch (error) {
        console.error('Error fetching grid data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.refreshCache = async (req, res) => {
    try {
        await MetadataService.refresh();
        res.json({ success: true, message: 'Caché de metadatos recargado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Guardado Dinámico (INSERT / UPDATE)
exports.saveGridData = async (req, res) => {
    try {
        const idform = Number(req.params.idform);
        const idgrid = Number(req.params.idgrid);
        const { data, isUpdate, recordId } = req.body;

        const metadata = MetadataService.getFormMetadata(idform);
        if (!metadata) return res.status(404).json({ error: 'Módulo no existe' });

        const gridMeta = metadata.grids.find(g => g.idgrid === idgrid);
        if (!gridMeta) return res.status(404).json({ error: 'Grilla no configurada' });

        // vquery normalmente es una vista, para guardar necesitamos saber la tabla real
        // En una arquitectura compleja tendrias un "XTABLE" asociado. 
        // Para este MVP vamos a usar vquery si no tiene espacios (y asumiendo que es tabla) o extraer el nombre:
        const physicalTable = gridMeta.vquery; // Temporalmente usamos vquery

        // Generación dinámica segura del Query:
        // Aseguramos que SÓLO se guarden los campos detectados en la configuración (metadatos)
        // Esto evita errores si librerías como AG-Grid inyectan propiedades virtuales en el registro (ej _rowId)
        const allowedFields = gridMeta.fields.map(f => f.campo);

        const columns = Object.keys(data).filter(col =>
            data[col] !== undefined &&
            typeof data[col] !== 'object' &&
            allowedFields.includes(col)
        );

        console.log("== DEBUG GUARDADO ==");
        console.log("allowedFields:", allowedFields);
        console.log("data keys:", Object.keys(data));
        console.log("data bools:", Object.keys(data).filter(k => typeof data[k] === 'boolean').map(k => k + '=' + data[k]));
        console.log("final columns:", columns);

        let sql = '';
        const params = [];

        if (isUpdate && recordId) {
            // UPDATE table SET col1=$1, col2=$2 WHERE PK=$3
            const pkField = columns.find(c => c.startsWith('id') || c.endsWith('id')) || columns[0];

            // Retiramos la llave primaria del SET para no sobrescribirla
            const updateCols = columns.filter(c => c !== pkField);

            const setStatements = updateCols.map((col, idx) => `${col} = $${idx + 1}`);
            updateCols.forEach(col => params.push(data[col]));

            params.push(recordId); // El último parámetro es el ID (PK)

            sql = `UPDATE ${physicalTable} SET ${setStatements.join(', ')} WHERE ${pkField} = $${params.length}`;

        } else {
            // INSERT INTO table (col1, col2) VALUES ($1, $2)
            const placeholders = columns.map((_, idx) => `$${idx + 1}`);
            columns.forEach(col => params.push(data[col]));

            sql = `INSERT INTO ${physicalTable} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
        }

        console.log("Ejecutando Consulta Dinámica Guardado:", sql);
        console.log("Valores:", params);

        await db.query(sql, params);

        res.json({
            success: true,
            message: 'Guardado correctamente',
            debug: { columns, sql, params, dataBools: Object.keys(data).filter(k => typeof data[k] === 'boolean').map(k => k + '=' + data[k]) }
        });

    } catch (error) {
        console.error('Error insertando/actualizando base de datos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ------------------------------------------------------------------------------------------------ //
// BORRADO DINÁMICO (DELETE)
// ------------------------------------------------------------------------------------------------ //
exports.deleteGridData = async (req, res) => {
    try {
        const idform = Number(req.params.idform);
        const idgrid = Number(req.params.idgrid);
        const { id } = req.params;

        const metadata = MetadataService.getFormMetadata(idform);
        if (!metadata) return res.status(404).json({ error: 'Módulo no existe' });

        const gridMeta = metadata.grids.find(g => g.idgrid === idgrid);
        if (!gridMeta) return res.status(404).json({ error: 'Grilla no configurada' });

        const physicalTable = gridMeta.vquery;
        // Identificar el campo Primary Key (PK) buscando 'id' o usando el primer campo oculto/int
        const allowedFields = gridMeta.fields.map(f => f.campo);
        const pkField = allowedFields.find(c => c.startsWith('id') || c.endsWith('id')) || allowedFields[0];

        const sql = `DELETE FROM ${physicalTable} WHERE ${pkField} = $1`;
        console.log(`Ejecutando Eliminar: ${sql} [${id}]`);

        await db.query(sql, [id]);

        res.json({ success: true, message: 'Registro eliminado exitosamente' });

    } catch (error) {
        console.error('Error eliminando base de datos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ------------------------------------------------------------------------------------------------ //
// EJECUTOR DE SCRIPTS (SANDBOX ENGINE)
// Permite correr código JS (ej: Sactivate, Snewrecord) guardado en la base de datos (XFORMS/XGRID)
// ------------------------------------------------------------------------------------------------ //
exports.executeScript = async (req, res) => {
    try {
        const idform = Number(req.params.idform);
        const { event } = req.params; // ej. 'sactivate'
        const contextParams = req.body || {}; // Parámetros que envíe el cliente (ej. id de fila)

        const metadata = MetadataService.getFormMetadata(idform);
        if (!metadata) return res.status(404).json({ success: false, error: 'Módulo no existe' });

        // Evaluamos si el script está a nivel FORMS (ej. sactivate) o necesitamos buscar en grids
        let scriptCode = null;

        if (event === 'sactivate' || event === 'screate') {
            scriptCode = metadata.form[event];
        } else {
            // Si el evento no es de form (ej. snewrecord, scalcula), tendríamos que saber
            // el idgrid. Por ahora, asumimos que estamos procesando eventos a nivel Form.
            // Para expandirlo, se podría pasar idgrid como query param (?idgrid=x) o en body.
            const idgrid = contextParams.idgrid ? Number(contextParams.idgrid) : null;
            if (idgrid) {
                const gridMeta = metadata.grids.find(g => g.idgrid === idgrid);
                if (gridMeta && gridMeta[event]) scriptCode = gridMeta[event];
            }
        }

        if (!scriptCode || typeof scriptCode !== 'string' || scriptCode.trim() === '') {
            // No hay script configurado, retornamos OK silencioso para no romper flujos en el frontend
            return res.json({ success: true, message: `No hay script definido para el evento ${event}` });
        }

        console.log(`⚡ Ejecutando Script Dinámico [${event}] en Sandbox para Formulario ${idform}`);

        // Invocamos el Motor V8 seguro
        const result = await ScriptingService.runScript(scriptCode, contextParams);

        res.json({
            success: true,
            event: event,
            data: result
        });

    } catch (error) {
        console.error(`❌ Error en Controller executeScript:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
};
