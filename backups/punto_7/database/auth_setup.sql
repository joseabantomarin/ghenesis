-- Script de Seguridad para Ghenesis Framework
-- Tablas de Usuarios, Roles y su Metadatos para el Motor

-- 1. Tablas Físicas
CREATE TABLE IF NOT EXISTS XROLES (
    idrole SERIAL PRIMARY KEY,
    rolename VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS XUSER (
    iduser SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(100),
    email VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    idrole INTEGER REFERENCES XROLES(idrole) ON DELETE SET NULL,
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS XPERMISSIONS (
    idrole INTEGER NOT NULL,
    idform INTEGER NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT TRUE,
    can_update BOOLEAN DEFAULT TRUE,
    can_delete BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (idrole, idform)
);

-- 2. Datos Iniciales (Roles y Admin)
-- Nota: La contraseña para 'admin' será 'admin123' (el backend debe hashearla o podemos poner un hash inicial)
INSERT INTO XROLES (idrole, rolename, descripcion) VALUES 
(1, 'ADMINISTRADOR', 'Acceso total al sistema'),
(2, 'USUARIO', 'Acceso limitado a operaciones')
ON CONFLICT (idrole) DO NOTHING;

-- Contraseña 'admin123' hasheada con bcrypt (10 rounds)
INSERT INTO XUSER (iduser, username, password, fullname, email, active, idrole) VALUES
(1, 'admin', '$2b$10$OI/kPm4klDnxr94PeaVWV.Lmx7ph0AkIrQp8.5Hxhe536sduDfq0e', 'Administrador del Sistema', 'admin@ghenesis.com', TRUE, 1)
ON CONFLICT (iduser) DO UPDATE SET password = EXCLUDED.password;

-- 3. Metadatos (XFORMS, XGRID, XFIELD)
-- Categoría Padre: Configuración (Ya existe con ID 90 en seed.sql)

-- XFORMS
INSERT INTO XFORMS (Idform, IdSistema, cform, descripcion, tipo, Idparent, nroform) VALUES 
(101, 1, 'Usuarios', 'Mantenimiento de Usuarios', 4, 90, 101),
(102, 1, 'Roles', 'Mantenimiento de Roles', 4, 90, 102)
ON CONFLICT (Idform) DO NOTHING;

-- XGRID
INSERT INTO XGRID (Idgrid, IDform, nombre, VQUERY, titulo, nroframe, rxpage) VALUES
(101, 101, 'GridUsuarios', 'XUSER', 'Listado de Usuarios', 1, 50),
(102, 102, 'GridRoles', 'XROLES', 'Listado de Roles', 1, 50)
ON CONFLICT (Idgrid) DO NOTHING;

-- XFIELD para Usuarios
INSERT INTO XFIELD (idfield, idgrid, campo, titlefield, alinear, posicion, tipod, obligatorio, ancho) VALUES
(10101, 101, 'iduser', 'ID', 'I', 1, 'I', TRUE, 80),
(10102, 101, 'username', 'Usuario', 'I', 2, 'C', TRUE, 120),
(10103, 101, 'password', 'Contraseña', 'I', 3, 'W', TRUE, 150),
(10104, 101, 'fullname', 'Nombre Completo', 'I', 4, 'C', FALSE, 200),
(10105, 101, 'email', 'Correo', 'I', 5, 'C', FALSE, 180),
(10106, 101, 'idrole', 'Rol', 'I', 6, 'I', TRUE, 120),
(10107, 101, 'active', 'Activo', 'C', 7, 'B', FALSE, 80)
ON CONFLICT (idfield) DO NOTHING;

-- Configurar lookup dinámico para el campo Rol
UPDATE XFIELD SET sqlcombo = 'SELECT idrole, rolename FROM XROLES ORDER BY rolename' WHERE idfield = 10106;

-- XFIELD para Roles
INSERT INTO XFIELD (idfield, idgrid, campo, titlefield, alinear, posicion, tipod, obligatorio, ancho) VALUES
(10201, 102, 'idrole', 'ID', 'I', 1, 'I', TRUE, 80),
(10202, 102, 'rolename', 'Nombre Rol', 'I', 2, 'C', TRUE, 150),
(10203, 102, 'descripcion', 'Descripción', 'I', 3, 'C', FALSE, 250)
ON CONFLICT (idfield) DO NOTHING;

-- Ocultar password en la grilla pero mostrar en el form
UPDATE XFIELD SET oculto = TRUE WHERE idfield = 10103;
-- Hacer que el campo password sea tipo password en el form (podemos extender tipod o usar sactivate para cambiar el type del input)
-- Por ahora lo dejamos como W (Memo) para que se vea, pero luego lo pulimos.
