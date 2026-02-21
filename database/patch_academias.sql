-- Parche para arreglar el Maestro-Detalle y agregar más datos a Cursos

-- 1. Establecer 'idacademia' como el campo de enlace (Master Field) entre XGRID 10 y 11
UPDATE XGRID SET FieldGroup = 'idacademia' WHERE Idgrid = 11;

-- 2. Actualizar el script SOPEN explícitamente usando comillas dobles escapadas para SQL
UPDATE XGRID SET sopen = '
    if (!params.masterValue) {
        return { data: [], total: 0 };
    }
    const result = await db.query(
        ''SELECT * FROM CURSOS WHERE idacademia = $1 ORDER BY idcurso DESC LIMIT $2 OFFSET $3'', 
        [params.masterValue, params.limit || 50, params.offset || 0]
    );
    const countResult = await db.query(
        ''SELECT COUNT(*) as exact_count FROM CURSOS WHERE idacademia = $1'', 
        [params.masterValue]
    );
    return {
        data: result.rows,
        total: parseInt(countResult.rows[0].exact_count)
    };
' WHERE Idgrid = 11;

-- 3. Insertar más datos de prueba (Cursos para la academia 1 y 2)
INSERT INTO CURSOS (idcurso, idacademia, nombre_curso, horas) VALUES 
(4, 1, 'Docker y Kubernetes Módulo 1', 20),
(5, 1, 'TypeScript Avanzado 2024', 45),
(6, 1, 'Microservicios con NestJS', 50),
(7, 2, 'Fundamentos de Python', 30),
(8, 2, 'Machine Learning Básico', 60),
(9, 2, 'Data Science for Beginners', 40),
(10, 2, 'C# y .NET Core Módulo Base', 55)
ON CONFLICT (idcurso) DO NOTHING;

SELECT setval('cursos_idcurso_seq', (SELECT MAX(idcurso) FROM CURSOS));
