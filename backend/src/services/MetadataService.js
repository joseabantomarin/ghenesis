const db = require('../config/db');
const ScriptingService = require('./ScriptingService');

class MetadataService {
    constructor() {
        this.cache = {
            forms: {},
            grids: {},
            fields: {},
            controls: {},
            sistema: {}
        };
        this.isLoaded = false;
    }

    // Cargar toda la configuración esencial en memoria para ser súper rápidos
    async initCache() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            try {
                // Limpiamos la caché primero para evitar duplicados en cada refresh (F5)
                this.cache = {
                    forms: {},
                    grids: {},
                    fields: {},
                    controls: {},
                    sistema: {}
                };

                const resForms = await db.query(`
                SELECT f.*, 
                       COALESCE(i.nombre, (SELECT nombre FROM xicons ORDER BY RANDOM() LIMIT 1)) as iconname 
                FROM XFORMS f 
                LEFT JOIN XICONS i ON f.iconform = i.idicon
            `);
                resForms.rows.forEach(f => this.cache.forms[f.idform] = f);

                const resGrids = await db.query('SELECT * FROM XGRID');
                resGrids.rows.forEach(g => {
                    if (!this.cache.grids[g.idform]) this.cache.grids[g.idform] = [];
                    this.cache.grids[g.idform].push(g);
                });

                const resFields = await db.query('SELECT * FROM XFIELD ORDER BY posicion ASC');
                for (let f of resFields.rows) {
                    if (f.sqlcombo && f.sqlcombo.trim() !== '') {
                        try {
                            let comboRes;
                            let comboQuery = f.sqlcombo.trim();
                            let comboParams = [];

                            // Detectamos si es un Script completo en lugar de un select tradicional
                            if (comboQuery.toLowerCase().includes('return') && comboQuery.includes('wrapQuery')) {
                                // Localizamos el Grid y Form para inyectarlo al Sandbox
                                let parentGrid = null;
                                for (let formId in this.cache.grids) {
                                    let match = this.cache.grids[formId].find(g => g.idgrid === f.idgrid);
                                    if (match) { parentGrid = match; break; }
                                }
                                const parentForm = parentGrid ? this.cache.forms[parentGrid.idform] : null;

                                const scriptResult = await ScriptingService.runScript(comboQuery, {
                                    form: parentForm,
                                    grid: parentGrid,
                                    field: f
                                });

                                if (scriptResult && scriptResult.wrapQuery) {
                                    comboQuery = scriptResult.wrapQuery;
                                    comboParams = scriptResult.wrapParams || [];
                                } else {
                                    throw new Error('El script de sqlcombo no retornó un objeto válido con wrapQuery.');
                                }
                            }
                            let cacheQuery = comboQuery;
                            // Optimización: Si el usuario quitó el límite, no jalamos 30mil reg a memoria en el arranque
                            if (!/LIMIT\s+\d+/i.test(cacheQuery)) {
                                cacheQuery = `SELECT * FROM (${comboQuery}) AS sub_init_combo LIMIT 101`;
                            }

                            comboRes = await db.query(cacheQuery, comboParams);
                            if (comboRes && comboRes.rows && comboRes.rows.length > 0) {
                                const rowCount = comboRes.rows.length;
                                const keys = Object.keys(comboRes.rows[0]);
                                const colVal = keys[0];
                                const colLabel = keys.length > 1 ? keys[1] : keys[0];

                                f.comboDataKeyVal = {};

                                // Si hay más de 100 registros, no mandamos la lista completa (comboDataList)
                                // para evitar saturar el JSON de metadata y el scroll del navegador.
                                // Solo mandamos la lista si es pequeña (Catálogo maestro pequeño).
                                if (rowCount <= 100) {
                                    f.comboDataList = comboRes.rows.map(row => {
                                        const val = String(row[colVal] || '');
                                        const label = String(row[colLabel] || '');
                                        f.comboDataKeyVal[val] = label;
                                        return { value: val, label: label };
                                    });
                                    f.valcombo = f.comboDataList.map(item => item.value).filter(Boolean).join(',');
                                } else {
                                    // Para tablas grandes, solo construimos el mapeo de los primeros 100
                                    // para visualización inicial si fuera necesario, pero marcamos la f.async = true
                                    f.comboDataList = [];
                                    f.isLargeCombo = true;
                                    comboRes.rows.slice(0, 100).forEach(row => {
                                        f.comboDataKeyVal[String(row[colVal] || '')] = String(row[colLabel] || '');
                                    });
                                }
                            }
                        } catch (e) {
                            console.error(`Error ejecutando sqlcombo en grilla ${f.idgrid} campo ${f.campo}:`, e.message);
                        }
                    }

                    if (!this.cache.fields[f.idgrid]) this.cache.fields[f.idgrid] = [];
                    this.cache.fields[f.idgrid].push(f);
                }

                const resControls = await db.query('SELECT * FROM XCONTROLS ORDER BY nrocontrol ASC');
                resControls.rows.forEach(c => {
                    if (!this.cache.controls[c.idform]) this.cache.controls[c.idform] = [];
                    this.cache.controls[c.idform].push(c);
                });

                const resSistema = await db.query('SELECT * FROM XSISTEMA LIMIT 1');
                if (resSistema.rows.length > 0) {
                    this.cache.sistema = resSistema.rows[0];
                }

                this.isLoaded = true;
            } catch (err) {
                console.error('❌ Error al cargar metadatos:', err);
                this.initPromise = null;
                throw err;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    // Refrescar caché bajo demanda
    async refresh() {
        this.isLoaded = false;
        await this.initCache();
    }

    // Devolver el modelo MVC dinámico completo para un formulario
    async getFormMetadata(idform) {
        if (!this.isLoaded) await this.initCache();

        const form = this.cache.forms[idform];
        if (!form) return null;

        const grids = this.cache.grids[idform] || [];
        const controls = this.cache.controls[idform] || [];

        // Empaquetar grids con sus campos y configuración de sistema
        const gridsWithFields = grids.map(g => ({
            ...g,
            fields: this.cache.fields[g.idgrid] || [],
            sistema: this.cache.sistema
        }));

        return {
            form,
            grids: gridsWithFields,
            controls,
            sistema: this.cache.sistema
        };
    }

    // Obtener menú entero para pintar acordiones en Frontend
    async getAppMenu() {
        if (!this.isLoaded) await this.initCache();
        return Object.values(this.cache.forms).sort((a, b) => a.nroform - b.nroform);
    }
    // Obtener configuración global del sistema
    async getSistemaConfig(fresh = false) {
        if (fresh) {
            const res = await db.query('SELECT * FROM XSISTEMA LIMIT 1');
            if (res.rows.length > 0) {
                this.cache.sistema = res.rows[0];
            }
        }
        if (!this.isLoaded && !fresh) await this.initCache();
        return this.cache.sistema || {};
    }
}

// Singleton export
module.exports = new MetadataService();
