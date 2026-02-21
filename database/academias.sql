-- 1. Crear Tablas Físicas
CREATE TABLE IF NOT EXISTS ACADEMIA (
    idacademia SERIAL PRIMARY KEY,
    nombre VARCHAR(150),
    direccion VARCHAR(250)
);

CREATE TABLE IF NOT EXISTS CURSOS (
    idcurso SERIAL PRIMARY KEY,
    idacademia INTEGER REFERENCES ACADEMIA(idacademia) ON DELETE CASCADE,
    nombre_curso VARCHAR(150),
    horas INTEGER
);

-- 2. Insertar Datos Dummys para Visualización
INSERT INTO ACADEMIA (idacademia, nombre, direccion) VALUES 
(1, 'Academia Ghenesis', 'Av. Siempre Viva 123'),
(2, 'Tech Code School', 'Calle Falsa 456')
ON CONFLICT (idacademia) DO NOTHING;

-- Asegurar secuencia de idacademia (por si acaso al insertar manual)
SELECT setval('academia_idacademia_seq', (SELECT MAX(idacademia) FROM ACADEMIA));

INSERT INTO CURSOS (idcurso, idacademia, nombre_curso, horas) VALUES 
(1, 1, 'Programación Node.js', 40),
(2, 1, 'Frontend con React', 60),
(3, 2, 'Bases de Datos SQL', 30)
ON CONFLICT (idcurso) DO NOTHING;
SELECT setval('cursos_idcurso_seq', (SELECT MAX(idcurso) FROM CURSOS));

-- 3. Inyectar Metadatos del Módulo en Ghenesis

-- XFORMS: Módulo "Academias" (Idform = 10) bajo la sección Operaciones (tipo 2) o General (tipo 1). 
-- Definimos el Script `sactivate` que se ejecutará en Backend al abrir el módulo.
INSERT INTO XFORMS (Idform, IdSistema, cform, descripcion, tipo, Idparent, nroform, sactivate) VALUES 
(10, 1, 'Academias', 'Gestión de Academias y Cursos', 1, NULL, 10, 
'
    // Este código se ejecuta en el V8 Sandbox del Backend (Node.js) al cargar el módulo
    const result_acad = await db.query(''SELECT COUNT(*) as total FROM ACADEMIA'');
    const result_cur = await db.query(''SELECT COUNT(*) as total FROM CURSOS'');
    
    const countA = result_acad.rows[0].total;
    const countC = result_cur.rows[0].total;
    
    return {
        mensaje: ''Bienvenido al Módulo de Academias. Estadísticas calculadas en Backend:'',
        valor: countA + '' Academias y '' + countC + '' Cursos registrados.''
    };
')
ON CONFLICT (Idform) DO NOTHING;

-- XGRID: 
-- Maestro: Grilla de Academias (Idgrid = 10)
-- Detalle: Grilla de Cursos (Idgrid = 11) asignada al padre (gparent = 10)
INSERT INTO XGRID (Idgrid, IDform, nombre, VQUERY, titulo, nroframe, rxpage, gparent) VALUES
(10, 10, 'GridAcademias', 'ACADEMIA', 'Listado de Academias', 1, 50, NULL),
(11, 10, 'GridCursos', 'CURSOS', 'Cursos Impartidos', 1, 50, 10)
ON CONFLICT (Idgrid) DO NOTHING;

-- XFIELD: Campos para ACADEMIA (Idgrid = 10)
INSERT INTO XFIELD (idfield, idgrid, campo, titlefield, alinear, posicion, tipod, obligatorio, oculto, eoculto, ancho) VALUES
(1001, 10, 'idacademia', 'ID Academia', 'I', 1, 'I', TRUE, FALSE, FALSE, 100),
(1002, 10, 'nombre', 'Nombre de Academia', 'I', 2, 'C', TRUE, FALSE, FALSE, 250),
(1003, 10, 'direccion', 'Dirección Principal', 'I', 3, 'C', FALSE, FALSE, FALSE, 300)
ON CONFLICT (idfield) DO NOTHING;

-- XFIELD: Campos para CURSOS (Idgrid = 11)
INSERT INTO XFIELD (idfield, idgrid, campo, titlefield, alinear, posicion, tipod, obligatorio, oculto, eoculto, ancho) VALUES
(1101, 11, 'idcurso', 'ID Curso', 'I', 1, 'I', TRUE, FALSE, FALSE, 100),
(1102, 11, 'idacademia', 'ID FK Academia', 'I', 2, 'I', TRUE, TRUE, FALSE, 100),
(1103, 11, 'nombre_curso', 'Nombre del Curso', 'I', 3, 'C', TRUE, FALSE, FALSE, 250),
(1104, 11, 'horas', 'Horas Totales', 'D', 4, 'I', FALSE, FALSE, FALSE, 120)
ON CONFLICT (idfield) DO NOTHING;
