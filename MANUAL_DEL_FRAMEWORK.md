# Ghenesis: Manual del Programador

## 1. Visión General
Ghenesis es un framework para aplicaciones web empresariales **basado enteramente en metadatos**. A través de su ecosistema de tablas maestras (`XFORMS`, `XGRID`, `XFIELD`, etc.), es posible inicializar módulos, grillas interactivas, pantallas de edición, relaciones maestro-detalle y ejecuciones de código (scripting dinámico) **sin compilar ni reescribir código en el frontend o backend** para cada nueva pantalla.

## 2. Tecnologías Principales
- **Frontend**: React (Vite.js), Material UI (MUI), AG Grid (Data grids de alto rendimiento), CodeMirror (Editor con syntax-highlighting), y Tailwind/CSS propio.
- **Backend**: Node.js + Express, librerías Sandbox de inyección segura, y PG (PostgreSQL driver).
- **Base de Datos**: PostgreSQL, usado para el negocio per-se y para el "Diccionario de Datos" (configuración de la app).

## 3. Jerarquía y Diccionario de Metadatos
Todo elemento que renderiza la pantalla nace aquí:

1. **`XSISTEMA`:** Define toda la app. Título global, ícono de pestaña (favicon), logo en Home, y variables de estilo o `Theme` (colores CSS/Tokens configurables).
2. **`XFORMS`:** Las ventanas, módulos o pestañas que visualiza el usuario en su panel principal. Tienen un id (`idform`) y se encuadran en el menú vertical (Programador, General, Configuración, etc. según su `tipo`).
3. **`XGRID`:** Se relacionan de manera 1 a N con un módulo `XFORMS`. Producen las grillas de AG Grid leyendo dinámicamente sus configuraciones e inyectando botones de acción custom en su Toolbar.
4. **`XFIELD`:** Múltiples registros atados a 1 `XGRID`. Definen cada columna visible, inputs o selectboxes mostrados en el formulario de creación/edición, así como el tipo de campo (`Date`, `Boolean`, `Memo`, `Number`, `SQL Combo`, `Val Combo` cerrado, o `F9 Lookups`).

## 4. Estructura Maestro-Detalle (Master-Detail Automático)
Las relaciones de tablas se renderizan gracias a la propiedad `gparent` del `XGRID`.
- **Grillas Maestras (`gparent` ES NULL):** Se cargan por defecto al abrir o instanciar un Módulo (forma de Tabs superpuestas).
- **Grillas Detalle (`gparent` NO ES NULL):** Aparecen dentro del formulario de edición de su grilla padre.

### 4.1 Configuración de Enlace (Linking)
Existen dos formas de enlazar el detalle con el maestro:

1.  **Explícita (Recomendado):** Usando el campo **`masterdetail`** en la tabla `XGRID` de la grilla HIJA.
    - Formato: `campo_maestro:campo_detalle` (ej: `idform:idform` o `idacademia:idcurso`).
    - El sistema tomará el valor de `campo_maestro` del registro seleccionado y lo usará para filtrar y pre-poblar `campo_detalle` en la hija.
2.  **Automática (Heurística):** Si `masterdetail` está vacío, el sistema intenta detectar la PK del padre (ej: `id[nombre_tabla]`) y busca un campo con el mismo nombre en la hija.

## 5. El Sandbox y Scripting
La verdadera lógica de negocio "on-the-fly" se logra interceptando eventos del ciclo de vida e inyectando código en V8/Sandbox, o JS cliente puro.
**Principales gatillos de Script (`XGRID` y `XFORMS`):**
- **Sopen** / **Sactivate:** Validaciones o queries custom inyectables antes de abrir visualizaciones.
- **Ssave** / **Ssavepost:** Alteran, validan o calculan parámetros antes/después de un `POST / PUT` en el Backend de forma segura.
- **Sscroll** / **Scalcula:** Acciones por iteración de fila (Ejemplo: Campos Sumatorias o Celdas Calculadas condicionales).
- **Svalida** / **Snewrecord** (En `XFIELDS`/`XGRID`): Valores o funciones por defecto asignadas directo en el Cliente cuando el usuario ingresa información o se abre ventana de Creación.

## 6. Estandarización y Auditoría Inamovible
Todo registro en el ecosistema (y preferentemente tablas hijas creadas post-deployment) debe contemplar 3 campos mandatorios por seguridad, que Ghenesis detecta y alimenta automáticamente:

- **`upduser`**: Login del último usuario en tocar la fila.
- **`upddate`**: Fecha del evento en motor de BD.
- **`updtype`**: Mantiene referencialidad lógica y no física (`0`: Insertado, `1`: Actualizado, `2`: Eliminado en papelera).

## 7. Control de Acceso (RBAC)
Ghenesis implementa un sistema de control de acceso basado en niveles numéricos (`tipo`) en la tabla `XROLES`. Este nivel simplifica la lógica de seguridad y visibilidad sin depender únicamente del nombre del rol.

### 7.1 Jerarquía de Niveles
- **Nivel 0 - Developer:** Usuario raíz del sistema. Tiene visibilidad de herramientas de programación, depuración y registros marcados como eliminados (`updtype = 2`).
- **Nivel 1 - Administrador:** Gestión de usuarios y roles. También puede visualizar registros eliminados para tareas de auditoría.
- **Nivel 2 - Usuario Final:** Operatividad estándar. Su visibilidad está estrictamente dictada por la matriz de permisos configurada en `XPERMISSIONS`. No puede ver registros eliminados.
- **Nivel 3 - Invitado:** Restricciones máximas o perfiles de visualización básica.

### 7.2 Administración de Niveles
Desde el módulo **Configuración > Roles**, es posible asignar estos niveles a cada rol creado. El sistema propaga este nivel automáticamente al token JWT del usuario al iniciar sesión, permitiendo validaciones síncronas en el frontend.

## 8. Valores por Defecto Dinámicos (`valxdefecto`)
El campo `valxdefecto` en `XFIELD` permite inicializar registros con valores calculados automáticamente al momento de presionar "Nuevo".

### 8.1 Tipos de Expresiones Soportadas
1.  **Constantes**:
    *   `10`: Valor numérico.
    *   `'DISPONIBLE'`: Cadena de texto (requiere comillas simples).
2.  **Funciones Globales**:
    *   `date()`: Retorna la fecha actual en formato `YYYY-MM-DD`.
    *   `time()`: Retorna la hora actual en formato `HH:mm:ss`.
    *   `user()`: Retorna el objeto del usuario actual (ej: `user().username`).
3.  **Acceso a la Interfaz (UI)**:
    *   `ui.header.id_elemento`: Permite leer el valor de cualquier elemento HTML con el ID especificado que se encuentre en la cabecera del grid.
4.  **Contexto Maestro-Detalle**:
    *   `master.campo`: En grillas detalle, permite heredar valores del registro seleccionado en la grilla maestra.
5.  **Llamadas Asíncronas (API)**:
    *   `await api.get('/mi-ruta').then(r => r.data.valor)`: Permite inicializar campos consultando el backend en tiempo real.

### 8.2 Diferencia con `snewrecord`
Mientras que `snewrecord` es un script global para toda la fila, `valxdefecto` es una propiedad del campo. Se recomienda usar `valxdefecto` para inicializaciones estándar y dejar `snewrecord` para lógica de negocio compleja que involucre múltiples campos o validaciones de estado previas a la edición.

---
*(Este manual será expandido iterativamente a medida que refactorizamos y pulimos el entorno del framework)*
