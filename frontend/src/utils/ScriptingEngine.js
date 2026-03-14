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

/**
 * evalExpression - Evaluates a simple expression or function call
 * Used for valxdefecto and other dynamic field properties.
 */
export const evalExpression = async (expression, context = {}) => {
    if (expression === undefined || expression === null || String(expression).trim() === '') return null;

    const strExpr = String(expression).trim();

    // 1. Literal dynamic strings with single quotes
    if (strExpr.startsWith("'") && strExpr.endsWith("'")) {
        return strExpr.slice(1, -1);
    }

    // 2. Pure numbers
    if (!isNaN(strExpr) && strExpr !== '') {
        return Number(strExpr);
    }

    // 3. Evaluation logic
    const { ui, master, record, api } = context;

    // Helper built-in functions
    const date = () => new Date().toISOString().split('T')[0];
    const time = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
    const user = () => context.user || {};

    try {
        // We use an async function to allow 'await' if the user provides a more complex snippet
        // or if they call an async api function.
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        
        const sandbox = new AsyncFunction('ui', 'master', 'record', 'api', 'date', 'time', 'user', `
            "use strict";
            try {
                // If it's a simple function call like date() or a property access, the return works.
                // If they want to use await, they should be able to.
                return ${strExpr};
            } catch (err) {
                console.warn("Expression eval failed:", err);
                return null;
            }
        `);

        const result = await sandbox(ui, master, record, api, date, time, user);
        return result !== undefined ? result : null;
    } catch (err) {
        // If it's not a valid expression or fails compilation, return original
        return expression;
    }
};
