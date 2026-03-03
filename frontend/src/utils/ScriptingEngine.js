/**
 * ScriptingEngine - Sandboxed execution for Ghenesis Scripts
 * 
 * Provides a controlled context for executing JavaScript stored in the database.
 */
export const runGridScript = async (scriptCode, context) => {
    if (!scriptCode || scriptCode.trim() === '') return;

    const { action, grid, data, selected, record, ui, api } = context;

    try {
        /**
         * The sandbox function receives:
         * @param {string} action - The string identifier passed from the UI
         * @param {object} grid - { api, columnApi } from AG Grid
         * @param {array} data - All records currently in the grid
         * @param {object} selected - The currently selected record
         * @param {object} record - The transaction payload record being manipulated (e.g. at save, new)
         * @param {object} ui - Bridge for UI interactions (alert, notifications, setLabel)
         * @param {object} api - Axios instance for backend requests
         */
        const sandbox = new Function('action', 'grid', 'data', 'selected', 'record', 'ui', 'api', `
            "use strict";
            try {
                ${scriptCode}
            } catch (err) {
                console.error("Ghenesis Script Error:", err);
                if (ui && ui.alert) {
                    ui.alert("Error en Script", err.message, "error");
                }
            }
        `);

        return sandbox(action, grid, data, selected, record, ui, api);
    } catch (err) {
        console.error("Ghenesis Script Compilation Error:", err);
        if (ui && ui.alert) {
            ui.alert("Error de Compilación", "El código del script tiene errores de sintaxis: " + err.message, "error");
        }
    }
};
