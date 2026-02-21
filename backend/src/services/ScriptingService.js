const vm = require('vm');
const db = require('../config/db');

class ScriptingService {
    /**
     * Ejecuta código JavaScript que llega desde la base de datos dentro de un Sandbox (Caja de Arena).
     * @param {string} scriptCode - Código almacenado en la BD (ej. XFORMS.sactivate)
     * @param {object} contextParams - Variables adicionales (ej. { idform: 1, reqBody: {} })
     * @returns {Promise<any>} - El resultado del script
     */
    static async runScript(scriptCode, contextParams = {}) {
        if (!scriptCode || typeof scriptCode !== 'string' || scriptCode.trim() === '') {
            return { success: true, message: 'Script Vacío' };
        }

        try {
            const sandbox = {
                db,
                console,
                params: contextParams
            };
            vm.createContext(sandbox);

            // Enolvemos el código de Sactivate/Snewrecord que escribió el programador
            // para que tenga disponible "await", inyectándole los "params" recibidos.
            const wrapper = `
                (async function(params) {
                    ${scriptCode}
                })
            `;

            // Compila y obtiene la referencia a la función asíncrona virtual
            const asyncExecutable = vm.runInContext(wrapper, sandbox);

            // La ejecutamos inyectandole la huella del request web
            const executionResult = await asyncExecutable(contextParams);

            return executionResult;

        } catch (error) {
            console.error('❌ Error executing Sandbox Script:', error);
            throw new Error(`Script Execution Error: ${error.message}`);
        }
    }
}

module.exports = ScriptingService;
