const db = require('../config/db');

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
        try {
            // Limpiamos la caché primero para evitar duplicados en cada refresh (F5)
            this.cache = {
                forms: {},
                grids: {},
                fields: {},
                controls: {},
                sistema: {}
            };

            const resForms = await db.query('SELECT * FROM XFORMS');
            resForms.rows.forEach(f => this.cache.forms[f.idform] = f);

            const resGrids = await db.query('SELECT * FROM XGRID');
            resGrids.rows.forEach(g => {
                if (!this.cache.grids[g.idform]) this.cache.grids[g.idform] = [];
                this.cache.grids[g.idform].push(g);
            });

            const resFields = await db.query('SELECT * FROM XFIELD ORDER BY posicion ASC');
            resFields.rows.forEach(f => {
                if (!this.cache.fields[f.idgrid]) this.cache.fields[f.idgrid] = [];
                this.cache.fields[f.idgrid].push(f);
            });

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
            throw err;
        }
    }

    // Refrescar caché bajo demanda
    async refresh() {
        this.isLoaded = false;
        await this.initCache();
    }

    // Devolver el modelo MVC dinámico completo para un formulario
    getFormMetadata(idform) {
        if (!this.isLoaded) throw new Error('Caché no iniciada');

        const form = this.cache.forms[idform];
        if (!form) return null;

        const grids = this.cache.grids[idform] || [];
        const controls = this.cache.controls[idform] || [];

        // Empaquetar grids con sus campos
        const gridsWithFields = grids.map(g => ({
            ...g,
            fields: this.cache.fields[g.idgrid] || []
        }));

        return {
            form,
            grids: gridsWithFields,
            controls
        };
    }

    // Obtener menú entero para pintar acordiones en Frontend
    getAppMenu() {
        if (!this.isLoaded) throw new Error('Caché no iniciada');
        return Object.values(this.cache.forms).sort((a, b) => a.nroform - b.nroform);
    }
    // Obtener configuración global del sistema
    getSistemaConfig() {
        return this.cache.sistema || {};
    }
}

// Singleton export
module.exports = new MetadataService();
