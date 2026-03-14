const MetadataService = require('../services/MetadataService');
const ScriptingService = require('../services/ScriptingService');
const db = require('../config/db');

exports.getMenu = async (req, res) => {
    try {
        // Al pedir el menú (típicamente al pulsar F5 o cargar el sistema cerrado), forzamos
        // la recarga de toda la estructura de la base de datos para no depender del reinicio de Node.
        await MetadataService.refresh();
        const menu = await MetadataService.getAppMenu();
        res.json({ success: true, data: menu });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getFormDefinition = async (req, res) => {
    try {
        const idform = Number(req.params.idform);

        // Refrescar caché bajo demanda al entrar a un formulario para evaluar cambios en metadatos
        await MetadataService.refresh();

        const metadata = await MetadataService.getFormMetadata(idform);

        if (!metadata) {
            return res.status(404).json({ success: false, error: 'Formulario no encontrado en metadatos' });
        }

        res.json({ success: true, data: metadata });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const ensureUpdtypeColumn = async (physicalTable) => {
    if (!physicalTable) return;
    try {
        // Verificar si la columna updtype existe
        const checkSql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'updtype'
        `;
        const res = await db.query(checkSql, [physicalTable.toLowerCase()]);

        if (res.rows.length === 0) {
            // Verificar si es una tabla para evitar errores en vistas
            const tableCheck = await db.query(`SELECT table_type FROM information_schema.tables WHERE table_name = $1`, [physicalTable.toLowerCase()]);
            if (tableCheck.rows.length > 0 && tableCheck.rows[0].table_type === 'BASE TABLE') {
                console.log(`🔨 Añadiendo columna 'updtype' a la tabla ${physicalTable}...`);
                await db.query(`ALTER TABLE ${physicalTable} ADD COLUMN updtype SMALLINT DEFAULT 0`);
            }
        }
    } catch (error) {
        console.error(`❌ Error asegurando columna updtype en ${physicalTable}:`, error.message);
    }
};

exports.getSistemaConfig = async (req, res) => {
    try {
        const config = await MetadataService.getSistemaConfig();
        res.json({ success: true, data: config });
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
            for (const colId in filters) {
                const fieldDef = gridMeta.fields.find(f => f.campo === colId);
                if (!fieldDef) continue;

                const filterObj = filters[colId];
                const dbColName = colId;

                const applySingleFilter = (obj) => {
                    if (obj.filterType === 'text') {
                        if (fieldDef.tipod === 'D' || fieldDef.tipod === 'T') {
                            const visualFormat = (fieldDef.formato || 'DD/MM/YYYY').toUpperCase();
                            whereClauses.push(`(to_char(${dbColName}, 'YYYY-MM-DD') ILIKE $${paramIndex} OR to_char(${dbColName}, '${visualFormat}') ILIKE $${paramIndex})`);
                        } else if (fieldDef.tipod === 'I' || fieldDef.tipod === 'F') {
                            whereClauses.push(`CAST(${dbColName} AS TEXT) ILIKE $${paramIndex}`);
                        } else {
                            whereClauses.push(`${dbColName} ILIKE $${paramIndex}`);
                        }
                        queryParams.push(`%${obj.filter}%`);
                        paramIndex++;
                    } else if (obj.filterType === 'number') {
                        const type = obj.type || 'equals';
                        const cleanVal = (v) => (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v);
                        const val = cleanVal(obj.filter);

                        if (type === 'inRange') {
                            const valTo = cleanVal(obj.filterTo);
                            whereClauses.push(`${dbColName}::numeric BETWEEN $${paramIndex}::numeric AND $${paramIndex + 1}::numeric`);
                            queryParams.push(val, valTo);
                            paramIndex += 2;
                        } else if (type === 'equals') {
                            const hasDecimals = String(obj.filter).includes('.') || String(obj.filter).includes(',');
                            if (!hasDecimals) {
                                whereClauses.push(`TRUNC(${dbColName}::numeric) = $${paramIndex}::numeric`);
                            } else {
                                whereClauses.push(`${dbColName}::numeric = $${paramIndex}::numeric`);
                            }
                            queryParams.push(val);
                            paramIndex++;
                        } else {
                            const operatorsMap = {
                                'notEqual': '!=',
                                'lessThan': '<',
                                'lessThanOrEqual': '<=',
                                'greaterThan': '>',
                                'greaterThanOrEqual': '>='
                            };
                            const op = operatorsMap[type] || '=';
                            whereClauses.push(`${dbColName}::numeric ${op} $${paramIndex}::numeric`);
                            queryParams.push(val);
                            paramIndex++;
                        }
                    } else if (obj.filterType === 'date') {
                        const dateVal = obj.dateFrom ? obj.dateFrom.split(' ')[0] : null;
                        if (dateVal) {
                            const op = obj.type === 'lessThan' ? '<' : (obj.type === 'greaterThan' ? '>' : '=');
                            whereClauses.push(`${dbColName}::date ${op} $${paramIndex}`);
                            queryParams.push(dateVal);
                            paramIndex++;
                        }
                    }
                };

                // Soporte para filtros múltiples de AG Grid (AND / OR)
                if (filterObj.operator && (filterObj.condition1 || filterObj.condition2)) {
                    const currentFilterClauses = [];
                    const currentFilterParams = [];
                    let currentParamIndex = paramIndex;

                    const applyCondition = (conditionObj) => {
                        if (!conditionObj) return;

                        const originalWhereClausesLength = whereClauses.length;
                        const originalQueryParamsLength = queryParams.length;
                        const originalParamIndex = paramIndex;

                        applySingleFilter(conditionObj);

                        // Extract the clauses and params added by this condition
                        const addedClauses = whereClauses.slice(originalWhereClausesLength);
                        const addedParams = queryParams.slice(originalQueryParamsLength);

                        currentFilterClauses.push(...addedClauses);
                        currentFilterParams.push(...addedParams);

                        // Restore global state for the next condition or filter
                        whereClauses.splice(originalWhereClausesLength, whereClauses.length - originalWhereClausesLength);
                        queryParams.splice(originalQueryParamsLength, queryParams.length - originalQueryParamsLength);
                        paramIndex = originalParamIndex;
                    };

                    applyCondition(filterObj.condition1);
                    applyCondition(filterObj.condition2);

                    if (currentFilterClauses.length > 0) {
                        const combinedClause = `(${currentFilterClauses.join(` ${filterObj.operator.toUpperCase()} `)})`;
                        whereClauses.push(combinedClause.replace(/\$(\d+)/g, (_, num) => {
                            const newIndex = currentParamIndex + (parseInt(num, 10) - 1);
                            return `$${newIndex}`;
                        }));
                        queryParams.push(...currentFilterParams);
                        paramIndex += currentFilterParams.length;
                    }
                } else {
                    applySingleFilter(filterObj);
                }
            }
        } catch (e) {
            console.error("❌ Error parseando filtros de cabecera:", e);
        }
    }

    // --- SISTEMA FLUIDO DE FILTROS EXTERNOS ---
    const systemParams = ['page', 'limit', 'sortField', 'sortOrder', 'filters', 'search', 'masterField', 'masterValue', 'masterRecordPayload'];
    const operators = {
        '_ge': '>=',
        '_le': '<=',
        '_gt': '>',
        '_lt': '<',
        '_ne': '<>',
        '_like': 'ILIKE'
    };

    Object.keys(reqQuery).forEach(key => {
        if (systemParams.includes(key)) return;

        // Identificar si la clave tiene un operador al final (ej: fecha_ge)
        let operator = '=';
        let fieldName = key;

        for (const [suffix, op] of Object.entries(operators)) {
            if (key.toLowerCase().endsWith(suffix)) {
                operator = op;
                fieldName = key.slice(0, -suffix.length);
                break;
            }
        }

        const fieldDef = (gridMeta.fields || []).find(f => f.campo.toLowerCase() === fieldName.toLowerCase());
        if (fieldDef) {
            const value = reqQuery[key];
            if (value !== undefined && value !== null && value !== '' && value !== 'null') {
                const dbField = fieldDef.campo;

                if (operator === 'ILIKE') {
                    if (fieldDef.tipod === 'I' || fieldDef.tipod === 'F') {
                        whereClauses.push(`CAST(${dbField} AS TEXT) ILIKE $${paramIndex}`);
                    } else {
                        whereClauses.push(`${dbField} ILIKE $${paramIndex}`);
                    }
                    queryParams.push(`%${value}%`);
                } else {
                    whereClauses.push(`${dbField} ${operator} $${paramIndex}`);
                    queryParams.push(value);
                }
                paramIndex++;
            }
        }
    });

    // --- SISTEMA DE BORRADO LÓGICO (Soft Delete) ---
    // Solo aplicamos el filtro si la tabla es física y presumiblemente tiene updtype
    // o si el campo está explícitamente en la definición de la grilla.
    const hasUpdtype = (gridMeta.fields || []).some(f => f.campo.toLowerCase() === 'updtype') || gridMeta.nombre;
    
    if (hasUpdtype) {
        const showDeleted = reqQuery.showDeleted === 'true';
        if (showDeleted) {
            whereClauses.push(`updtype = 2`);
        } else {
            whereClauses.push(`(updtype IS NULL OR updtype <> 2)`);
        }
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    // Recuperamos el Count y los Totales MIENTRAS mantenemos el filtro (antes de paginacion y orden)
    const totalizableFields = (gridMeta.fields || []).filter(f => f.totalizar && (f.tipod === 'I' || f.tipod === 'F'));

    let statsSql = `SELECT COUNT(*) as count`;
    if (totalizableFields.length > 0) {
        const sumClauses = totalizableFields.map(f => `SUM(${f.campo}) as total_${f.campo}`);
        statsSql += `, ${sumClauses.join(', ')}`;
    }
    statsSql += ` FROM (${sql}) AS stats_query`;

    const statsRes = await db.query(statsSql, queryParams);
    const finalTotalRecords = statsRes?.rows?.[0]?.count ? parseInt(statsRes.rows[0].count) : 0;

    const aggregates = {};
    if (totalizableFields.length > 0 && statsRes.rows[0]) {
        totalizableFields.forEach(f => {
            aggregates[f.campo] = parseFloat(statsRes.rows[0][`total_${f.campo}`]) || 0;
        });
    }

    // Agregar ORDENAMIENTO (ORDER BY) si viene del cliente
    // ... (rest of the code)
    const { sortField, sortOrder } = reqQuery;
    if (sortField) {
        const field = gridMeta.fields.find(f => f.campo === sortField);
        if (field) {
            const order = (sortOrder || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const dbSortField = sortField;
            const isNumeric = (field.tipod === 'I' || field.tipod === 'F');

            // Para campos Numéricos (I o F) que no sean delegados de texto, tratar los NULL como ceros
            if (isNumeric) {
                sql += ` ORDER BY COALESCE(${dbSortField}, 0) ${order}`;
            } else {
                sql += ` ORDER BY ${dbSortField} ${order}`;
            }
        }
    } else {
        // ORDEN PREDETERMINADO: Para evitar que las filas "salten" al final tras un update (común en Postgres)
        // Buscamos la PK definida en metadatos o el primer ID de la tabla.
        const pkField = (gridMeta.fields || []).find(f => f.pk === true)?.campo;
        if (pkField) {
            sql += ` ORDER BY ${pkField} ASC`;
        } else {
            // Intentar detectar un campo ID por nombre común (idform, idgrid, etc.)
            const pkHierarchy = ['idacademia', 'idcurso', 'idform', 'idgrid', 'idfield', 'idcontrol', 'idreport', 'idtable', 'iduser', 'idrole', 'idsistema', 'id'];
            const fallbackId = pkHierarchy.find(key => (gridMeta.fields || []).some(f => f.campo.toLowerCase() === key));
            
            if (fallbackId) {
                sql += ` ORDER BY ${fallbackId} ASC`;
            } else if ((gridMeta.fields || []).length > 0) {
                // Último recurso: ordenar por el primer campo de la grilla
                sql += ` ORDER BY ${(gridMeta.fields || [])[0].campo} ASC`;
            }
        }
    }

    // Agregar paginación al SQL original
    let page = parseInt(reqQuery.page) || 1;
    const parsedLimit = parseInt(reqQuery.limit);
    let limit = (!isNaN(parsedLimit) && parsedLimit >= 0) ? parsedLimit : (gridMeta.rxpage || 50);

    // --- LOCALIZAR REGISTRO: Calcular en qué página está un registro específico ---
    const locateField = reqQuery.locateField;
    const locateValue = reqQuery.locateValue;
    if (locateField && locateValue && limit > 0) {
        try {
            const locateSql = `SELECT rn FROM (SELECT ROW_NUMBER() OVER() as rn, * FROM (${sql}) AS locate_inner) AS locate_outer WHERE "${locateField}"::text = $${paramIndex}`;
            const locateParams = [...queryParams, String(locateValue)];
            const locateRes = await db.query(locateSql, locateParams);
            if (locateRes.rows.length > 0) {
                const rowNum = parseInt(locateRes.rows[0].rn);
                page = Math.ceil(rowNum / limit);
            }
        } catch (e) {
            console.error('Error localizando registro:', e.message);
            // Si falla, usamos la página original
        }
    }

    const offset = (page - 1) * limit;

    if (limit > 0) {
        const pIndex = paramIndex;
        sql += ` LIMIT $${pIndex} OFFSET $${pIndex + 1}`;
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
            totalPages: Math.ceil(finalTotalRecords / (limit || 1)),
            aggregates // <- Totales calculados en el servidor sobre el universo filtrado
        }
    };
};

// Data endpoint (El que trae los valores de la Base de datos física usando XGRID.vquery)
exports.getGridData = async (req, res) => {
    try {
        const idform = Number(req.params.idform);
        const idgrid = Number(req.params.idgrid);

        const metadata = await MetadataService.getFormMetadata(idform);
        if (!metadata) return res.status(404).json({ error: 'Módulo no existe' });

        const gridMeta = metadata.grids.find(g => g.idgrid === idgrid);
        if (!gridMeta) return res.status(404).json({ error: 'Grilla no configurada' });

        // Intentar asegurar columna updtype
        if (gridMeta.nombre) {
            await ensureUpdtypeColumn(gridMeta.nombre);
        }

        // Parámetros por si el sopen los necesita puros
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || gridMeta.rxpage || 50;
        const offset = (page - 1) * limit;

        // --- INTERCEPTOR SOPEN ---
        if (gridMeta.sopen) {
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
                ...req.query, // Exponer todos los parámetros de la URL (incluyendo extraParams y search)
                page, limit, offset,
                masterField: req.query.masterField,
                masterValue: req.query.masterValue,
                masterRecord: decodedMasterRecord,
                sortField: req.query.sortField,
                sortOrder: req.query.sortOrder
            };

            const sopenResult = await ScriptingService.runScript(gridMeta.sopen, contextParams);

            // Si el script retorna un objeto de Query Wrapping dinámico:
            if (sopenResult && sopenResult.wrapQuery) {
                try {
                    const wrappedResult = await buildWrappedQuery(sopenResult.wrapQuery, sopenResult.wrapParams || [], req.query, gridMeta);
                    return res.json({
                        success: true,
                        data: wrappedResult.data,
                        meta: {
                            ...wrappedResult.meta,
                            uiStyles: sopenResult.uiStyles || undefined
                        }
                    });
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
                    totalPages: Math.ceil((sopenResult?.total || sopenResult?.length || 0) / (limit || 1)),
                    aggregates: sopenResult?.aggregates || {}, // ← Soporte para totales en scripts directos
                    uiStyles: sopenResult?.uiStyles || undefined // ← Soporte para inyectar UI global desde sopen
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
        const { data, isUpdate, recordId, pkField: clientPkField } = req.body;

        const metadata = await MetadataService.getFormMetadata(idform);
        if (!metadata) return res.status(404).json({ error: 'Módulo no existe' });

        const gridMeta = metadata.grids.find(g => g.idgrid === idgrid);
        if (!gridMeta) return res.status(404).json({ error: 'Grilla no configurada' });

        // vquery normalmente es una vista, para guardar necesitamos saber la tabla real
        // Replicando la arquitectura Delphi: XGRID.nombre contiene la tabla física pura
        const physicalTable = gridMeta.nombre;

        // --- FILTRADO DE COLUMNAS PARA GUARDADO ---
        // Excluimos:
        // 1. Campos marcados como 'calculado' en los metadatos (XFIELD)
        // 2. Propiedades internas de AG Grid/JS que empiecen con _
        // 3. Objetos complejos que no sean valores primitivos
        const calculatedFields = (gridMeta.fields || []).filter(f => f.calculado).map(f => f.campo.toLowerCase());

        // --- VALIDACIONES DE NEGOCIO (OBLIGATORIO Y UNIQUE) ---
        for (const field of gridMeta.fields) {
            const val = data[field.campo];

            // 1. Validar Obligatorio (Backend Lock)
            if (field.obligatorio && (val === undefined || val === null || val === '')) {
                return res.json({ success: false, error: `El campo '${field.titlefield || field.campo}' es obligatorio.` });
            }

            // 2. Validar Unique (vunique)
            if (field.vunique && val !== null && val !== undefined && val !== '') {
                // Identificar PK para excluir el registro actual en caso de UPDATE
                let pkField = clientPkField || null;
                if (!pkField) {
                    const metaPkField = gridMeta.fields.find(f => f.pk === true);
                    pkField = metaPkField ? metaPkField.campo : null;
                }

                let checkSql = `SELECT COUNT(*) FROM ${physicalTable} WHERE ${field.campo} = $1`;
                let checkParams = [val];

                // Si es un UPDATE, no debemos contar el registro que estamos editando
                if (isUpdate && recordId && pkField) {
                    checkSql += ` AND ${pkField} <> $2`;
                    checkParams.push(recordId);
                }

                try {
                    const checkRes = await db.query(checkSql, checkParams);
                    if (parseInt(checkRes.rows[0].count) > 0) {
                        return res.json({
                            success: false,
                            error: `Validación de Duplicidad: El valor '${val}' ya está registrado en '${field.titlefield || field.campo}'.`
                        });
                    }
                } catch (err) {
                    console.error("Error validando unicidad:", err.message);
                    // Si falla el check (ej: vquery es un select complejo), continuamos pero logueamos
                }
            }
        }


        // Mapeo Datafield (Campos Virtuales -> Columnas Físicas)
        const skipColumns = new Set();
        const dataToSave = { ...data };

        gridMeta.fields.forEach(field => {
            if (field.datafield && field.datafield.trim() !== '') {
                // Solo registramos el campo virtual puro para no intentarlo guardar y evitar fallar, 
                // la responsabilidad de sincronizar el campo físico recae puramente en React.
                skipColumns.add(field.campo.toLowerCase());
            }
        });

        // Filtrar columnas para el INSERT/UPDATE
        const columns = Object.keys(dataToSave).filter(col => {
            const colLower = col.toLowerCase();
            const val = dataToSave[col];
            return val !== undefined &&
                (typeof val !== 'object' || val === null || val instanceof Date) &&
                !col.startsWith('_') &&
                col.toLowerCase() !== 'updtype' &&
                !col.startsWith('__') &&
                !calculatedFields.includes(colLower) &&
                !skipColumns.has(colLower);
        });

        // Sanitizar valores: strings vacías → null
        columns.forEach(col => {
            if (dataToSave[col] === '') dataToSave[col] = null;
        });


        let sql = '';
        const params = [];

        if (isUpdate && recordId) {
            // Detección de PK (insensible a mayúsculas)
            let pkField = clientPkField || null;
            if (!pkField) {
                const metaPkField = gridMeta.fields.find(f => f.pk === true);
                pkField = metaPkField ? metaPkField.campo : null;
            }
            if (!pkField) {
                pkField = columns.find(c => c.toLowerCase().startsWith('id') || c.toLowerCase().endsWith('id')) || columns[0];
            }

            // Retiramos la llave primaria del SET (comparación insensitive)
            const updateCols = columns.filter(c => c.toLowerCase() !== pkField.toLowerCase());

            const setStatements = updateCols.map((col, idx) => `${col} = $${idx + 1}`);
            updateCols.forEach(col => params.push(dataToSave[col]));
            params.push(1); // updtype = 1: Modificado
            params.push(recordId);
            sql = `UPDATE ${physicalTable} SET ${setStatements.join(', ')}, updtype = $${updateCols.length + 1} WHERE ${pkField} = $${updateCols.length + 2}`;

        } else {
            // INSERT: Detectar PK para el RETURNING
            let pkField = clientPkField || null;
            if (!pkField) {
                const metaPkField = gridMeta.fields.find(f => f.pk === true);
                pkField = metaPkField ? metaPkField.campo : null;
            }
            if (!pkField) {
                pkField = columns.find(c => c.toLowerCase().startsWith('id') || c.toLowerCase().endsWith('id')) || columns[0];
            }

            columns.forEach(col => params.push(dataToSave[col]));
            params.push(0); // 0: Recién ingresado (updtype)

            const placeholders = columns.map((_, idx) => `$${idx + 1}`);
            sql = `INSERT INTO ${physicalTable} (${columns.join(', ')}, updtype) VALUES (${placeholders.join(', ')}, $${columns.length + 1}) RETURNING ${pkField}`;
        }

        const result = await db.query(sql, params);

        res.json({
            success: true,
            message: 'Guardado correctamente',
            data: data
        });

    } catch (error) {
        console.error('❌ Error en saveGridData:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            detail: error.detail || 'Error interno del servidor'
        });
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

        const metadata = await MetadataService.getFormMetadata(idform);
        if (!metadata) return res.status(404).json({ error: 'Módulo no existe' });

        const gridMeta = metadata.grids.find(g => g.idgrid === idgrid);
        if (!gridMeta) return res.status(404).json({ error: 'Grilla no configurada' });

        // Replicando arquitectura Delphi: La tabla real reside en gridMeta.nombre
        const physicalTable = gridMeta.nombre;
        const allowedFields = gridMeta.fields.map(f => f.campo);
        const pkField = allowedFields.find(c => c.startsWith('id') || c.endsWith('id')) || allowedFields[0];

        // Asegurar columna updtype
        await ensureUpdtypeColumn(physicalTable);

        // Borrado lógico: Cambiar updtype a 2
        // Soporte para múltiples IDs (separados por coma)
        const sql = `UPDATE ${physicalTable} SET updtype = 2 WHERE ${pkField}::text = ANY(STRING_TO_ARRAY($1, ','))`;

        await db.query(sql, [id]);

        res.json({ success: true, message: 'Registro(s) movido(s) a papelera' });

    } catch (error) {
        console.error('Error eliminando base de datos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// RESTAURAR REGISTRO (updtype -> 1)
exports.restoreGridData = async (req, res) => {
    try {
        const { idform, idgrid, id } = req.params;
        const metadata = await MetadataService.getFormMetadata(idform);
        const gridMeta = metadata.grids.find(g => g.idgrid === Number(idgrid));
        const physicalTable = gridMeta.nombre;
        const allowedFields = gridMeta.fields.map(f => f.campo);
        const pkField = allowedFields.find(c => c.startsWith('id') || c.endsWith('id')) || allowedFields[0];

        // Soporte para múltiples IDs
        await db.query(`UPDATE ${physicalTable} SET updtype = 1 WHERE ${pkField}::text = ANY(STRING_TO_ARRAY($1, ','))`, [id]);
        res.json({ success: true, message: 'Registro(s) restaurado(s) correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// BORRADO DEFINITIVO (Physical Delete)
exports.permanentDeleteGridData = async (req, res) => {
    try {
        const { idform, idgrid, id } = req.params;
        const metadata = await MetadataService.getFormMetadata(idform);
        const gridMeta = metadata.grids.find(g => g.idgrid === Number(idgrid));
        const physicalTable = gridMeta.nombre;
        const allowedFields = gridMeta.fields.map(f => f.campo);
        const pkField = allowedFields.find(c => c.startsWith('id') || c.endsWith('id')) || allowedFields[0];

        // Soporte para múltiples IDs
        await db.query(`DELETE FROM ${physicalTable} WHERE ${pkField}::text = ANY(STRING_TO_ARRAY($1, ','))`, [id]);
        res.json({ success: true, message: 'Registro(s) eliminado(s) físicamente del sistema' });
    } catch (error) {
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

        const metadata = await MetadataService.getFormMetadata(idform);
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
// ------------------------------------------------------------------------------------------------ //
// Guardar configuración de interfaz (anchos y posiciones de columnas)
// ------------------------------------------------------------------------------------------------ //
exports.saveInterface = async (req, res) => {
    try {
        const { idgrid, columns } = req.body; // columns: [{ campo, ancho, posicion }]

        if (!idgrid || !columns || !Array.isArray(columns)) {
            return res.status(400).json({ success: false, error: 'Datos de interfaz incompletos' });
        }

        // Transacción para asegurar que todos se actualicen o ninguno
        await db.query('BEGIN');

        try {
            for (const col of columns) {
                await db.query(
                    'UPDATE XFIELD SET ancho = $1, posicion = $2, oculto = $3 WHERE idgrid = $4 AND campo = $5',
                    [col.ancho, col.posicion, col.oculto ? true : false, idgrid, col.campo]
                );
            }
            await db.query('COMMIT');
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }

        // Refrescar caché de metadatos para que el backend reconozca los nuevos anchos/posiciones
        await MetadataService.refresh();

        res.json({ success: true, message: 'Configuración de interfaz guardada correctamente' });
    } catch (error) {
        console.error('❌ Error al guardar interfaz:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
// ------------------------------------------------------------------------------------------------ //
// EJECUTOR DE CONSULTAS SQL LIBRES (Solo SELECT)
// ------------------------------------------------------------------------------------------------ //
exports.runQuery = async (req, res) => {
    try {
        const { sql, params } = req.body;

        if (!sql) {
            return res.status(400).json({ success: false, error: 'No se proporcionó SQL' });
        }

        // Seguridad básica: Solo permitir SELECT
        const trimmedSql = sql.trim().toUpperCase();
        if (!trimmedSql.startsWith('SELECT')) {
            return res.status(403).json({ success: false, error: 'Solo se permiten consultas de lectura (SELECT)' });
        }

        const result = await db.query(sql, params || []);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('❌ Error en runQuery:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ------------------------------------------------------------------------------------------------ //
// EJECUTOR DE BÚSQUEDA INTERACTIVA DE COMBOS (TYPE-AHEAD)
// ------------------------------------------------------------------------------------------------ //
exports.searchComboData = async (req, res) => {
    try {
        const { idform, idgrid, campo } = req.params;
        const { q } = req.query; // El término de búsqueda tippeado

        const metadata = await MetadataService.getFormMetadata(idform);
        const gridMeta = metadata?.grids?.find(g => g.idgrid === Number(idgrid));
        const fieldMeta = gridMeta?.fields?.find(f => f.campo === campo);

        if (!fieldMeta || !fieldMeta.sqlcombo) {
            return res.status(404).json({ success: false, error: 'Configuración o sqlcombo no encontrado' });
        }

        let comboQuery = fieldMeta.sqlcombo.trim();
        let comboParams = [];

        if (comboQuery.toLowerCase().includes('return') && comboQuery.includes('wrapQuery')) {
            const scriptResult = await ScriptingService.runScript(comboQuery, {
                form: metadata.form,
                grid: gridMeta,
                field: fieldMeta
            });

            if (scriptResult && scriptResult.wrapQuery) {
                comboQuery = scriptResult.wrapQuery;
                comboParams = scriptResult.wrapParams || [];
            } else {
                return res.status(500).json({ success: false, error: 'El script retornó un wrapQuery inválido.' });
            }
        }

        // Removemos cualquier límite hardcodeado anterior
        const baseQuery = comboQuery.replace(/LIMIT\s+\d+/i, '');

        // Sondeo rápido para detectar nombres de columnas originados
        const probeRes = await db.query(`SELECT * FROM (${baseQuery}) as probe LIMIT 1`, comboParams);
        if (probeRes.rows.length === 0) return res.json({ success: true, data: [] });

        const keys = Object.keys(probeRes.rows[0]);
        const colVal = keys[0];
        const colLabel = keys.length > 1 ? keys[1] : keys[0];

        let searchSql = '';
        let params = [...comboParams];
        if (q && q.trim() !== '') {
            // Restaurar búsqueda secuencial estricta (ej: "cruz chavez" -> "%cruz%chavez%")
            const searchPattern = `%${q.trim().replace(/\s+/g, '%')}%`;
            searchSql = `SELECT * FROM (${baseQuery}) AS sub WHERE UPPER(CAST(sub."${colLabel}" AS TEXT)) LIKE UPPER($${params.length + 1}) LIMIT 100`;
            params.push(searchPattern);
        } else {
            searchSql = `SELECT * FROM (${baseQuery}) AS sub LIMIT 100`;
        }

        const result = await db.query(searchSql, params);
        const mappedData = result.rows.map(row => ({
            value: String(row[colVal] || ''),
            label: String(row[colLabel] || '')
        }));

        res.json({ success: true, data: mappedData });

    } catch (error) {
        console.error('❌ Error en searchComboData:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
