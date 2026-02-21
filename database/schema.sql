-- Esquema de Base de Datos para Framework Metadata-Driven Web
-- Motor: PostgreSQL
-- Refactorizado a PKs Numéricas

-- XSISTEMA: Configuración Global e Inicio
CREATE TABLE IF NOT EXISTS XSISTEMA (
    Idsistema INTEGER PRIMARY KEY,
    Titulo VARCHAR(255) NOT NULL,
    Icono VARCHAR(255),
    Imagen VARCHAR(255),
    Theme TEXT,
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updtype INTEGER DEFAULT 0
);

-- XICONS: Diccionario de Iconos
CREATE TABLE IF NOT EXISTS XICONS (
    IdIcon INTEGER PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updtype INTEGER DEFAULT 0
);

-- XFORMS: Definición de Menús y Formularios
CREATE TABLE IF NOT EXISTS XFORMS (
    Idform INTEGER PRIMARY KEY,
    IdSistema INTEGER,
    cform VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    tipo INTEGER DEFAULT 1, -- 0(prog) 1(gen) 2(oper) 3(cons) 4(conf) 5(sist)
    Idparent INTEGER,
    iconform INTEGER, -- Ref a XICONS
    Sactivate TEXT,
    enlace VARCHAR(255),
    FormHeader TEXT,
    FormFooter TEXT,
    Ventana BOOLEAN DEFAULT FALSE,
    nroform INTEGER DEFAULT 0,
    Sclose TEXT,
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updtype INTEGER DEFAULT 0,
    CONSTRAINT fk_xforms_idsistema FOREIGN KEY (IdSistema) REFERENCES XSISTEMA(Idsistema) ON DELETE SET NULL,
    CONSTRAINT fk_xforms_idparent FOREIGN KEY (Idparent) REFERENCES XFORMS(Idform) ON DELETE SET NULL,
    CONSTRAINT fk_xforms_iconform FOREIGN KEY (iconform) REFERENCES XICONS(IdIcon) ON DELETE SET NULL
);

-- XGRID: Definición de Grillas de Datos
CREATE TABLE IF NOT EXISTS XGRID (
    Idgrid INTEGER PRIMARY KEY,
    IDform INTEGER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    mayusculas BOOLEAN DEFAULT FALSE,
    recnoedit BOOLEAN DEFAULT FALSE,
    ocultabar BOOLEAN DEFAULT FALSE,
    readonlyg BOOLEAN DEFAULT FALSE,
    AltoFila INTEGER,
    rxpage INTEGER DEFAULT 50,
    VQUERY VARCHAR(100) NOT NULL,
    nroframe INTEGER DEFAULT 1,
    SDelete TEXT,
    SDeletePost TEXT,
    Sinsert TEXT,
    Sopen TEXT,
    Snewrecord TEXT,
    Sscroll TEXT,
    Scalcula TEXT,
    titulo VARCHAR(150),
    menuitems JSONB,
    Smenuitem TEXT,
    FieldGroup VARCHAR(100),
    Ssave TEXT,
    SSAVEPOST TEXT,
    sdraw TEXT,
    twoColumns BOOLEAN DEFAULT FALSE,
    gparent INTEGER, -- Manteniendo Maestro-Detalle Relacional
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updtype INTEGER DEFAULT 0,
    CONSTRAINT fk_xgrid_idform FOREIGN KEY (IDform) REFERENCES XFORMS(Idform) ON DELETE CASCADE,
    CONSTRAINT fk_xgrid_gparent FOREIGN KEY (gparent) REFERENCES XGRID(Idgrid) ON DELETE SET NULL
);

-- XTABLE (Simulación requerida por XFIELD/XCONTROLS, IDs numéricos)
CREATE TABLE IF NOT EXISTS XTABLE (
    idtable INTEGER PRIMARY KEY,
    nombre_table VARCHAR(100) NOT NULL,
    myquery TEXT NOT NULL,
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updtype INTEGER DEFAULT 0
);

-- XFIELD: Personalización de campos
CREATE TABLE IF NOT EXISTS XFIELD (
    idfield INTEGER PRIMARY KEY,
    idgrid INTEGER NOT NULL,
    campo VARCHAR(100) NOT NULL,
    titlefield VARCHAR(150),
    Cabeza VARCHAR(100),
    Ayuda VARCHAR(255),
    color VARCHAR(30),
    fontcolor VARCHAR(30),
    fontbold BOOLEAN DEFAULT FALSE,
    alinear VARCHAR(1) DEFAULT 'I', -- I, C, D
    tipod VARCHAR(1) DEFAULT 'C', -- C, D, F, I, B, W
    formato VARCHAR(50),
    valxdefecto VARCHAR(100),
    valcombo TEXT,
    datafield VARCHAR(100),
    oculto BOOLEAN DEFAULT FALSE,
    eoculto BOOLEAN DEFAULT FALSE,
    readonly BOOLEAN DEFAULT FALSE,
    TipoMemo INTEGER DEFAULT 1, -- 1: txt, 2: code, 3: html, 4: sql
    totalizar BOOLEAN DEFAULT FALSE,
    SValida TEXT,
    ancho INTEGER,
    posicion INTEGER DEFAULT 0,
    Sortable BOOLEAN DEFAULT TRUE,
    calculado BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT FALSE,
    noanymatch BOOLEAN DEFAULT FALSE,
    listfield VARCHAR(200),
    xdataset INTEGER, -- Ref a XTABLE
    obligatorio BOOLEAN DEFAULT FALSE,
    sqlcombo TEXT,
    f9 INTEGER, -- Ref a XFORMS
    noimport BOOLEAN DEFAULT FALSE,
    vunique BOOLEAN DEFAULT FALSE,
    altomemo INTEGER,
    agregar BOOLEAN DEFAULT FALSE,
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updtype INTEGER DEFAULT 0,
    CONSTRAINT fk_xfield_idgrid FOREIGN KEY (idgrid) REFERENCES XGRID(Idgrid) ON DELETE CASCADE,
    CONSTRAINT fk_xfield_f9 FOREIGN KEY (f9) REFERENCES XFORMS(Idform) ON DELETE SET NULL,
    CONSTRAINT fk_xfield_xdataset FOREIGN KEY (xdataset) REFERENCES XTABLE(idtable) ON DELETE SET NULL
);

-- XCONTROLS: Controles Adicionales
CREATE TABLE IF NOT EXISTS XCONTROLS (
    idcontrol INTEGER PRIMARY KEY,
    idform INTEGER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    texto VARCHAR(255),
    codigo1 TEXT,
    codigo2 TEXT,
    donde VARCHAR(100),
    alinear VARCHAR(20),
    ancho INTEGER,
    memo TEXT,
    icon VARCHAR(50),
    result BOOLEAN DEFAULT FALSE,
    xdataset INTEGER,
    datafield VARCHAR(100),
    nrocontrol INTEGER DEFAULT 0,
    vdefault VARCHAR(255),
    upduser VARCHAR(50),
    upddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updtype INTEGER DEFAULT 0,
    CONSTRAINT fk_xcontrols_idform FOREIGN KEY (idform) REFERENCES XFORMS(Idform) ON DELETE CASCADE,
    CONSTRAINT fk_xcontrols_xdataset FOREIGN KEY (xdataset) REFERENCES XTABLE(idtable) ON DELETE SET NULL
);
