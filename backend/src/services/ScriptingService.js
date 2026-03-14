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

        // Objeto para capturar comandos de UI asíncronos o síncronos dentro del script
        const capturedUI = { alert: null, notify: null };

        try {
            const sandbox = {
                db,
                console,
                params: contextParams,
                ui: {
                    alert: (title, message, severity = 'info') => {
                        capturedUI.alert = { title, message, severity };
                    },
                    notify: (msg) => {
                        capturedUI.notify = msg;
                    }
                }
            };
            vm.createContext(sandbox);

            // Envolvemos el código de Sactivate/Snewrecord que escribió el programador
            const wrapper = `
                (async function(params, ui) {
                    try {
                        ${scriptCode}
                    } catch (e) {
                        return { _error: e.message };
                    }
                })
            `;

            // Compila
            const asyncExecutable = vm.runInContext(wrapper, sandbox);

            // Ejecuta
            const executionResult = await asyncExecutable(contextParams, sandbox.ui);

            // Si el script retornó un error interno lo lanzamos
            if (executionResult && executionResult._error) {
                throw new Error(executionResult._error);
            }

            // Mezclar el resultado del return con lo capturado por el objeto ui
            // Priorizamos el return explícito si existe y es un objeto
            let finalResult = executionResult;
            if (typeof executionResult !== 'object' || executionResult === null) {
                finalResult = {};
            }

            return {
                ...finalResult,
                alert: finalResult.alert || capturedUI.alert,
                notify: finalResult.notify || capturedUI.notify
            };

        } catch (error) {
            console.error('❌ Error executing Sandbox Script:', error);
            // Si es un error de sintaxis (ej: por etiquetas HTML en el script), damos un mensaje claro
            if (error instanceof SyntaxError || error.message.includes('Unexpected token')) {
                throw new Error(`Error de Sintaxis en el Script (posiblemente contiene HTML o caracteres inválidos): ${error.message}`);
            }
            throw new Error(`Script Execution Error: ${error.message}`);
        }
    }
}

module.exports = ScriptingService;
