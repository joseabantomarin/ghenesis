# Guía Rápida de Instalación - Ghenesis Framework

## 1. Instalar PostgreSQL en Mac (Sin usar Terminal/Brew)

La forma más sencilla y visual de instalar PostgreSQL en macOS es usando **Postgres.app**:

1. Ve a **[PostgresApp.com](https://postgresapp.com/)** y haz clic en "Download" (asegúrate de descargar la versión universal o la que corresponda a tu Mac con procesador Intel o Apple Silicon M1/M2/M3).
2. Abre el archivo `.dmg` descargado y arrastra el elefante azul ("Postgres") a tu carpeta de **Aplicaciones**.
3. Ve a tu carpeta de Aplicaciones, haz doble clic en **Postgres** para abrirlo.
4. Te pedirá permisos la primera vez que lo abres, acéptalos. Verás una ventana con un botón que dice **"Start"** (o "Initialize" si es la primera vez). Haz clic ahí.
5. ¡Listo! Ya tienes un servidor PostgreSQL corriendo en tu Mac en el puerto `5432`. El usuario por defecto suele ser tu nombre de usuario de Mac o `postgres`, y sin contraseña por defecto (puedes configurarla después).

**Para administrar la base de datos visualmente (Equivalente a SQL Server Management Studio o pgAdmin):**
* Descarga **[DBeaver Community](https://dbeaver.io/download/)** o **[Postico](https://eggerapps.at/postico2/)** (súper recomendado para Mac).
* Conéctate usando `localhost`, puerto `5432`.
* Crea una base de datos llamada `ghenesis_db`.
* Abre el archivo `database/schema.sql` en tu administrador y ejecútalo entero para crear las tablas `XFORMS`, `XGRID`, etc.

---

## 2. Instalar Node.js para el servidor V8/Javascript

Dado que vi que no tienes `npm` en la terminal, Node.js no está instalado:
1. Ve a **[Nodejs.org](https://nodejs.org/)** y descarga la versión **LTS** para macOS.
2. Instálalo como cualquier otro programa (siguiente, siguiente).
3. Esto instalará automáticamente el comando `npm`.

---

## 3. Levantar los Proyectos

Abre dos ventanas diferentes de la **Terminal** (búscala en Spotlight):

### Para el Backend (El Motor / API)
```bash
cd /Users/joseabanto/Applications/ghenesis/backend

# 1. Instalar las librerías base y el creador de PDFs (pdfmake)
npm install
npm install pdfmake

# 2. Correr el servidor
npm run dev
```

### Para el Frontend (La Interfaz Web)
```bash
cd /Users/joseabanto/Applications/ghenesis/frontend

# 1. Instalar las librerías de UI (React, Material UI)
npm install

# 2. Correr el servidor visual
npm run dev
```
Te dará una URL (generalmente `http://localhost:5173`) a la que puedes entrar desde Safari o Chrome.
