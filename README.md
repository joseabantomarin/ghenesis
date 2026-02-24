# Ghenesis Framework - Metadata-Driven Application Engine

**Ghenesis** es un ecosistema de desarrollo de aplicaciones empresariales basado al 100% en **Metadatos**. No es solo un generador de código; es un motor que interpreta la base de datos en tiempo real para construir interfaces, validar reglas de negocio y ejecutar lógica personalizada sin necesidad de recompilar el núcleo del sistema.

---

## 🚀 ¿Qué hace único a Ghenesis?

### 1. Arquitectura Basada en Metadatos (Hot Reload)
Toda la interfaz del usuario se define en tablas maestras (`XFORMS`, `XGRID`, `XFIELD`). Cambiar un título, mover un campo de posición o cambiar un icono es tan simple como editar una fila en la base de datos. Los cambios se reflejan al instante (Hot Reload) en el navegador del usuario.

### 2. Motor de Scripting Dinámico (Sandbox 2.0)
Incluye un motor de ejecución de JavaScript aislado. Puedes inyectar lógica compleja directamente desde la base de datos para responder a eventos del usuario, realizar cálculos masivos sobre los datos del grid o interactuar con APIs externas, todo dentro de un entorno seguro.

### 3. Control de UI Inteligente (`ui.setStyle`)
Un sistema único de manipulación de interfaz que permite a tus scripts cambiar radicalmente la apariencia del sistema en tiempo real. ¿Necesitas que el botón de borrar desaparezca y el de guardar se vuelva rojo bajo cierta condición? Con `ui.setStyle`, el código tiene control total sobre el diseño Material UI del framework.

### 4. Validadores E2E y Reglas de Negocio
Ghenesis implementa una capa de validación profunda que sincroniza el frontend y el backend automáticamente. Soporta validación de campos obligatorios, unicidad física (`vunique`), y transformaciones automáticas como el Modo Mayúsculas Global.

### 5. UI Premium y Experiencia Pro
Diseñado bajo los estándares de Material UI, con una gestión de pestañas dinámica inspirada en IDEs profesionales, diseño ultra-compacto para maximizar el área de trabajo y un sistema de señalización de errores animado (Maroon Edition) que guía al usuario de forma intuitiva.

---

## 🛠 Guía Rápida de Instalación

### 1. Instalar PostgreSQL en Mac
La forma más sencilla es usando **Postgres.app**:
1. Descarga en **[PostgresApp.com](https://postgresapp.com/)**.
2. Arrastra a **Aplicaciones**.
3. Abre y haz clic en **"Start"**. El puerto por defecto es `5432` (o configura el `5433` si usas Docker).

**Administración Visual:**
* Usa **DBeaver Community** o **Postico**.
* Ejecuta `database/schema.sql` para preparar las tablas del motor.

### 2. Instalar Node.js
1. Descarga la versión **LTS** en **[Nodejs.org](https://nodejs.org/)**.
2. Instálalo para habilitar el comando `npm`.

### 3. Levantar los Proyectos

#### Backend (API / Motor)
```bash
cd backend
npm install
npm run dev
```

#### Frontend (Interfaz)
```bash
cd frontend
npm install
npm run dev
```
Accede vía `http://localhost:5173`.

---

## 📖 Documentación Relacionada
*   `manual_script.md`: Guía completa para programar en el Scripting Engine.
*   `tareas_completadas.md`: Registro histórico de hitos y actualizaciones.
