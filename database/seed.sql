-- Script Inicial (Semilla) Numérico para Ghenesis Framework
-- Ejecutar en PostgreSQL sobre la BD actual

-- 0. Limpiar todo el esquema existente para pruebas
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Aquí se debe ejecutar el schema.sql antes, o asumir que ya corrió.
-- Para desarrollo, a veces es mejor llamar schema.sql y luego seed.sql.

-- 1. Sistema Base
INSERT INTO XSISTEMA (Idsistema, Titulo, Icono, Imagen, Theme) VALUES 
(1, 'Ghenesis ERP', 'fa-globe', '/home-bg.jpg', ':root { --primary-color: #1976d2; }')
ON CONFLICT (Idsistema) DO NOTHING;

-- 2. Formularios (XFORMS)
INSERT INTO XFORMS (Idform, IdSistema, cform, descripcion, tipo, Idparent, nroform) VALUES 
(90, 1, 'Configuración', 'Configuración de Metadatos', 4, NULL, 90)
ON CONFLICT (Idform) DO NOTHING;

INSERT INTO XFORMS (Idform, IdSistema, cform, descripcion, tipo, Idparent, nroform, Ventana) VALUES 
(1, 1, 'Forms', 'Mantenimiento de Formularios', 4, 90, 1, FALSE),
(2, 1, 'Grids', 'Mantenimiento de Grillas', 4, 90, 2, FALSE),
(3, 1, 'Fields', 'Mantenimiento de Campos', 4, 90, 3, FALSE),
(4, 1, 'Controls', 'Mantenimiento de Controles Libres', 4, 90, 4, FALSE)
ON CONFLICT (Idform) DO NOTHING;

-- 3. Grillas dinámicas (XGRID)
INSERT INTO XGRID (Idgrid, IDform, nombre, VQUERY, titulo, nroframe, rxpage, gparent) VALUES
(1, 1, 'GridXForms', 'XFORMS', 'Listado de Formularios y Menús', 1, 50, NULL),
(2, 2, 'GridXGrids', 'XGRID', 'Listado de Componentes de Grilla', 1, 50, NULL),
(3, 3, 'GridXFields', 'XFIELD', 'Listado de Campos', 1, 50, NULL),
(4, 4, 'GridXControls', 'XCONTROLS', 'Listado de Controles', 1, 50, NULL)
ON CONFLICT (Idgrid) DO NOTHING;

-- Actualización Maestro-Detalle (GridXGrids es detalle de GridXForms, GridXFields de GridXGrids)
-- Mudamos las grillas subordinadas bajo el Formulario 1 para que se vean en edición anidada
UPDATE XGRID SET IDform = 1, gparent = 1 WHERE Idgrid = 2; 
UPDATE XGRID SET IDform = 1, gparent = 2 WHERE Idgrid = 3; 

-- 4. Diccionario de Datos del Sistema (XFIELD)
-- Poblando los campos para que el propio framework sea capaz de auto-administrarse

---------------------------------------------------------
-- Mantenimiento de Formularios (XFORMS) - Para la Grilla 1
---------------------------------------------------------
INSERT INTO XFIELD (idfield, idgrid, campo, titlefield, alinear, posicion, tipod, obligatorio, oculto, eoculto, ancho, TipoMemo) VALUES
(101, 1, 'idform', 'ID Formulario', 'I', 1, 'I', TRUE, FALSE, FALSE, 100, 1),
(102, 1, 'idsistema', 'ID Sistema', 'I', 2, 'I', FALSE, TRUE, FALSE, 100, 1),
(103, 1, 'cform', 'Alias Corto', 'I', 3, 'C', TRUE, FALSE, FALSE, 150, 1),
(104, 1, 'descripcion', 'Descripción Menú', 'I', 4, 'C', FALSE, FALSE, FALSE, 250, 1),
(105, 1, 'tipo', 'Sección (0..5)', 'I', 5, 'I', TRUE, FALSE, FALSE, 100, 1),
(106, 1, 'idparent', 'ID Padre (Árbol)', 'I', 6, 'I', FALSE, FALSE, FALSE, 100, 1),
(107, 1, 'iconform', 'ID Icono (XICONS)', 'I', 7, 'I', FALSE, TRUE, FALSE, 150, 1),
(108, 1, 'sactivate', 'Script sActivate', 'I', 8, 'W', FALSE, TRUE, FALSE, 100, 2),
(109, 1, 'enlace', 'URL Externa', 'I', 9, 'C', FALSE, TRUE, FALSE, 200, 1),
(110, 1, 'formheader', 'Diseño Cabecera', 'I', 10, 'W', FALSE, TRUE, FALSE, 100, 3),
(111, 1, 'formfooter', 'Diseño Pie', 'I', 11, 'W', FALSE, TRUE, FALSE, 100, 3),
(112, 1, 'ventana', 'Es Ventana Modal', 'C', 12, 'B', FALSE, TRUE, FALSE, 100, 1),
(113, 1, 'nroform', 'Orden Menú', 'D', 13, 'I', FALSE, FALSE, FALSE, 100, 1),
(114, 1, 'sclose', 'Script sClose', 'I', 14, 'W', FALSE, TRUE, FALSE, 100, 2)
ON CONFLICT (idfield) DO NOTHING;

---------------------------------------------------------
-- Mantenimiento de Grillas (XGRID) - Para la Grilla 2
---------------------------------------------------------
INSERT INTO XFIELD (idfield, idgrid, campo, titlefield, alinear, posicion, tipod, obligatorio, oculto, eoculto, ancho, TipoMemo) VALUES
(201, 2, 'idgrid', 'ID Grid', 'I', 1, 'I', TRUE, FALSE, FALSE, 100, 1),
(202, 2, 'idform', 'Pertenece a ID Form', 'I', 2, 'I', TRUE, FALSE, FALSE, 100, 1),
(203, 2, 'nombre', 'Nombre Objeto VCL', 'I', 3, 'C', TRUE, FALSE, FALSE, 150, 1),
(204, 2, 'vquery', 'Tabla SQL (vquery)', 'I', 4, 'C', TRUE, FALSE, FALSE, 150, 1),
(205, 2, 'titulo', 'Título Pestaña/Grid', 'I', 5, 'C', FALSE, FALSE, FALSE, 200, 1),
(206, 2, 'mayusculas', 'Forzar Mayúsculas', 'C', 6, 'B', FALSE, TRUE, FALSE, 100, 1),
(207, 2, 'recnoedit', 'Edición Grilla', 'C', 7, 'B', FALSE, TRUE, FALSE, 100, 1),
(208, 2, 'ocultabar', 'Ocultar Toolbar', 'C', 8, 'B', FALSE, TRUE, FALSE, 100, 1),
(209, 2, 'readonlyg', 'Solo Lectura', 'C', 9, 'B', FALSE, FALSE, FALSE, 100, 1),
(210, 2, 'rxpage', 'Lim./Paginación', 'D', 10, 'I', FALSE, FALSE, FALSE, 100, 1),
(211, 2, 'nroframe', 'Orden Pestaña', 'D', 11, 'I', FALSE, FALSE, FALSE, 100, 1),
(212, 2, 'gparent', 'ID Grid Padre', 'I', 12, 'I', FALSE, TRUE, FALSE, 100, 1),
(213, 2, 'twocolumns', 'Forzar 2 Columnas', 'C', 13, 'B', FALSE, TRUE, FALSE, 100, 1),
(214, 2, 'sopen', 'Script sOpen', 'I', 14, 'W', FALSE, TRUE, FALSE, 100, 2),
(215, 2, 'snewrecord', 'Script sNewRecord', 'I', 15, 'W', FALSE, TRUE, FALSE, 100, 2),
(216, 2, 'scaldula', 'Script sCalcula', 'I', 16, 'W', FALSE, TRUE, FALSE, 100, 2),
(217, 2, 'ssave', 'Script sSave', 'I', 17, 'W', FALSE, TRUE, FALSE, 100, 2)
ON CONFLICT (idfield) DO NOTHING;

---------------------------------------------------------
-- Mantenimiento de Campos (XFIELD) - Para la Grilla 3
---------------------------------------------------------
INSERT INTO XFIELD (idfield, idgrid, campo, titlefield, alinear, posicion, tipod, obligatorio, oculto, eoculto, ancho, TipoMemo) VALUES
(301, 3, 'idfield', 'ID Campo', 'I', 1, 'I', TRUE, FALSE, FALSE, 100, 1),
(302, 3, 'idgrid', 'Pertenece a ID Grid', 'I', 2, 'I', TRUE, FALSE, FALSE, 100, 1),
(303, 3, 'campo', 'Campo (DBF)', 'I', 3, 'C', TRUE, FALSE, FALSE, 150, 1),
(304, 3, 'titlefield', 'Etiqueta Header', 'I', 4, 'C', FALSE, FALSE, FALSE, 150, 1),
(305, 3, 'tipod', 'Tipo (C,I,F,D,B,W)', 'C', 5, 'C', TRUE, FALSE, FALSE, 100, 1),
(306, 3, 'ancho', 'Ancho Pixeles', 'D', 6, 'I', FALSE, FALSE, FALSE, 100, 1),
(307, 3, 'posicion', 'Orden Pintado', 'D', 7, 'I', FALSE, FALSE, FALSE, 100, 1),
(308, 3, 'alinear', 'Alinear (I,C,D)', 'C', 8, 'C', FALSE, TRUE, FALSE, 80, 1),
(309, 3, 'valcombo', 'Lista Opciones CSV', 'I', 9, 'W', FALSE, TRUE, FALSE, 150, 1),
(310, 3, 'valxdefecto', 'Valor Default', 'I', 10, 'C', FALSE, TRUE, FALSE, 100, 1),
(311, 3, 'oculto', 'Oculto en Grilla', 'C', 11, 'B', FALSE, FALSE, FALSE, 100, 1),
(312, 3, 'eoculto', 'Oculto en Form', 'C', 12, 'B', FALSE, FALSE, FALSE, 100, 1),
(313, 3, 'readonly', 'Bloquear Edición', 'C', 13, 'B', FALSE, FALSE, FALSE, 100, 1),
(314, 3, 'obligatorio', 'Es Requerido', 'C', 14, 'B', FALSE, FALSE, FALSE, 100, 1),
(315, 3, 'svalida', 'Script sValida', 'I', 15, 'W', FALSE, TRUE, FALSE, 100, 2),
(316, 3, 'f9', 'FK a XFORMS', 'I', 16, 'I', FALSE, TRUE, FALSE, 100, 1)
ON CONFLICT (idfield) DO NOTHING;

-- FIN SCRIPT
