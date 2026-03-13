INSERT INTO xreports (nombre, descripcion, formato, upduser)
VALUES (
    'Reporte de Muestra (Ventas)',
    'Reporte de demostración integrado en la base de datos',
    '{"docProperties":{"pageFormat":"A4"},"header":{"height":100,"items":[{"type":"text","x":10,"y":10,"width":300,"height":30,"text":"REPORTE DESDE POSTGRESQL","fontSize":20,"bold":true,"textColor":"#962590"},{"type":"text","x":10,"y":40,"width":400,"height":20,"text":"Este diseño ha sido cargado dinámicamente desde la tabla xreports.","fontSize":11,"textColor":"#555555"}]},"content":{"items":[{"type":"text","x":10,"y":10,"width":200,"height":20,"text":"Cliente: [cliente_nombre]","fontSize":14,"bold":true},{"type":"text","x":10,"y":40,"width":200,"height":20,"text":"Total: [total_venta]","fontSize":14,"textColor":"#e91e63"}]}}',
    'system'
) RETURNING idreport, nombre;
