/**
 * Formatea un número según un patrón de XFIELD.
 * Ejemplo: "S/ #,#.000" -> "S/ 1,234.567"
 * @param {number|string} value - El valor a formatear
 * @param {string} formatPattern - El patrón de formato
 * @param {boolean} isFloat - Si es un número decimal (por defecto true)
 * @returns {string} - El valor formateado
 */
export const formatNumber = (value, formatPattern, isFloat = true) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    const pattern = formatPattern || '';

    // Determinar número de decimales
    const partsArray = pattern.split('.');
    const detectedDecimals = partsArray.length > 1 ? partsArray[1].replace(/[^0]/g, '').length : (isFloat ? 2 : 0);

    // Extraer símbolo (prefijo o sufijo)
    const symbolMatch = pattern.match(/([^#0,.\s]+)/);
    const symbol = symbolMatch ? symbolMatch[1].trim() : '';
    const isSuffix = pattern.trim().endsWith(symbol);

    // Formatear el número (Usamos en-US para miles=coma y decimal=punto como en el patrón usual)
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: detectedDecimals,
        maximumFractionDigits: detectedDecimals,
        useGrouping: pattern.includes(',') // Solo miles si el patrón explícitamente tiene una coma
    });

    if (!symbol) return formatted;
    return isSuffix ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
};

/**
 * Formatea una fecha según un patrón de XFIELD (ej. DD/MM/YYYY)
 */
export const formatDate = (value, formatPattern) => {
    if (value === null || value === undefined || value === '') return '';

    let d;
    if (value instanceof Date) {
        d = value;
    } else {
        const dateStr = String(value);
        // Si el usuario está escribiendo una fecha parcial (ej: "202"), no intentar parsear
        // porque disparará fechas incorrectas (ej: año 0202). Esperar a tener al menos 8 caracteres.
        if (dateStr.length < 8) return value;

        // 1. Intentar parsear YYYY-MM-DD (ISO Date) como LOCAL para evitar desfase de zona horaria
        const ymdMatch = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        // 2. Intentar parsear DD/MM/YYYY como LOCAL
        const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);

        if (ymdMatch) {
            d = new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
        } else if (dmyMatch) {
            d = new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
        } else {
            // Si es un ISO completo (timestamp con Z o +HH:mm), el constructor nativo está bien
            d = new Date(value);
        }
    }

    if (isNaN(d.getTime())) return value;

    const pattern = formatPattern || 'YYYY-MM-DD';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return pattern
        .toUpperCase()
        .replace(/YYYY/g, year)
        .replace(/MM/g, month)
        .replace(/DD/g, day);
};

