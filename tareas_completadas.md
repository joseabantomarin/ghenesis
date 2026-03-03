# Tareas Completadas - Ghenesis Framework

## [2026-02-24] - Mejoras de Estabilidad, UI e Interfaz Metadata-Driven

### Backend & Base de Datos
- **Corrección de Error en Guardado de Iconos:** Se implementó un filtro automático en `DynamicController` para excluir campos marcados como `calculado = true` (ej: Vista Previa) de las sentencias SQL.
- **Desacoplamiento de Iconografía:** Se eliminó el *Foreign Key* físico entre `XFORMS` e `XICONS` para evitar fallos de integridad durante pruebas.
- **Resiliencia en Menú:** Se agregó lógica en `MetadataService` para asignar un icono aleatorio de `XICONS` si el formulario no tiene uno válido asignado.
- **Punto de Restauración V12:** Creación de backup completo de la base de datos y metadatos en `/backups`.

### Frontend & UI
- **Modo Mayúsculas Global:** Implementación del campo `mayusculas` de `XGRID`.
    - **Grilla:** Forzado visual con CSS y transformación de datos en `valueSetter` y `valueFormatter`.
    - **Formulario:** Transformación en tiempo real en el evento `onChange` y estilos CSS de mayúsculas en todos los inputs.
- **Optimización Master-Detail:** 
    - El panel de detalle se oculta automáticamente cuando la grilla maestra entra en modo edición.
    - La grilla maestra se expande al 100% del alto disponible para mejorar la visibilidad del formulario.
- **Navegación con Teclado Pro:** Mejora en el uso de flechas (Arriba/Abajo) en edición directa de grilla. Ahora guarda el cambio y mueve el foco/selección a la siguiente fila disponible.
- **Estabilidad de Pestañas:** Corrección de la lógica de identificación de pestañas para permitir múltiples formularios dinámicos abiertos simultáneamente.

## [2026-02-24] - Nuevo Módulo de Configuración de Sistema

- **Módulo XSISTEMA:** Se creó el mantenimiento completo para la tabla `XSISTEMA` incluyendo:
    - Registro en `XFORMS` (id: 111) colgado de la sección 'Configuración'.
    - Configuración de `XGRID` con query dinámica y soporte de mayúsculas.
    - Definición de `XFIELD` para control de títulos, iconos, logos y configuración de temas (JSON).
- **Actualización de Metadatos:** Se forzó el refresco de la caché para que el nuevo módulo aparezca inmediatamente en el menú lateral.

## [2026-02-24] - Validaciones de Datos y UI Premium
- **Integridad de Datos (E2E):** Implementación de validaciones automáticas en `saveGridData` (Backend) y `DynamicForm` (Frontend) para campos `obligatorio` y `vunique`.
- **Validaciones de Unicidad:** Verificación de duplicados en tiempo real contra la base de datos física, con inteligencia para ignorar el registro propio en ediciones (`UPDATE`).
- **Interfaz de Alerta Ghenesis:** Se reemplazaron los `alert()` nativos por un componente `AlertDialog` premium, sobrio y basado en el tema del sistema (fondos blancos, sombras suaves y tipografía profesional).
- **Sistema de Señalización Avanzada (Maroon Edition):**
    - Los campos obligatorios nacen con un borde sutil de color **maroon** para su identificación inmediata.
    - **Animación Post-Aviso:** Se implementó una secuencia lógica donde, tras cerrar el mensaje de error ("Entendido"), los campos vacíos disparan una animación de **pulso, resplandor y desenfoque** en tonos maroon para guiar al usuario.
- **Soporte Universal:** La lógica visual y de datos se integró en todos los controles: Texto, Números, Combos, Fechas, Memos (con redimensionamiento) y Checkboxes.

## [2026-02-24] - Implementación de Metadatos en Caliente (Hot Reload)

- **Evaluación al Ingreso (Hot Reload):** Se modificó el flujo de carga para que todas las configuraciones de `XGRID`, `XFIELD` y `XCONTROLS` se evalúen exactamente en el momento de abrir un formulario.
- **Estabilidad JSONB:** Se implementó una protección en el formulario y la grilla para manejar automáticamente campos de tipo objeto (JSON), convirtiéndolos a texto editable y evitando bloqueos de pantalla.
- **Motor de Atajos Universal:** 
    *   Se eliminaron todos los atajos "quemados" en el código.
    *   El sistema ahora responde dinámicamente a la configuración de `XSISTEMA.shortcuts`.
    *   Corrección de conflictos entre teclas (ej: F2 como Edit vs Add) priorizando siempre la configuración del usuario.
    *   Se agregaron logs de depuración en consola (`[Keyboard]`) para facilitar el soporte técnico.
- **Módulo XSISTEMA:** Implementación completa del mantenimiento de configuración global bajo la sección de Configuración.

## [2026-02-24] - Motor de Scripting & Control Dinámico de UI
- **Motor de Scripting (Sandbox 2.0):** Implementación de un entorno de ejecución seguro (`new Function`) que permite inyectar lógica JavaScript desde la base de datos (`XGRID.ejecuta`).
- **Infraestructura de Metadata:** Se expandió la tabla `XGRID` con los campos `cabecera`, `pie` y `ejecuta` para permitir personalización total sin tocar el código fuente.
- **Inyección de UI Personalizada:** Soporte para renderizado de HTML dinámico en la parte superior e inferior de la grilla, permitiendo crear botones, indicadores o dashboards a medida.
- **Puente de Comunicación (`Bridge`):** Creación del objeto global `window.ghenesis.run(action)` para conectar eventos del HTML inyectado con el motor de scripts.
- **Control Unificado de Estilos (`ui.setStyle`):**
    - Capacidad de manipular dinámicamente cualquier elemento del sistema (`new`, `edit`, `delete`, `save`, `title`, etc.) mediante scripts.
    - Control de propiedades: Texto (label), colores (background/text), visibilidad y estado habilitado/deshabilitado.
    - Persistencia reactiva: Los cambios realizados en la grilla se heredan automáticamente al abrir el formulario de edición.
- **Contexto de Datos Enriquecido:** Los scripts tienen acceso nativo a `data` (registros), `selected` (fila activa), `grid` (API del grid), `ui` (alertas y estilos) y `api` (llamadas Axios).
- **Documentación Técnica:** Creación de `manual_script.md` con el diccionario de elementos y ejemplos de uso.

## [2026-02-24] - Optimización de Espacio y UI Pro
- **Rediseño de Pestañas (Compact Pro):** 
    - Se optimizó el espacio vertical reduciendo las pestañas inactivas a 32px y la activa a 38px.
    - Implementación de efecto de **protuberancia** mediante elevación física, fondo blanco conectado al área de trabajo y sombra sutil.
    - Mejora de la densidad de información con tipografía de precisión (0.78rem) y espaciados mínimos para maximizar el área útil del grid.

## [2026-02-26] - Refinamiento de Formatos Numéricos y Totales Globales

### Formateo Profesional de Números
- **Utilidad Unificada:** Creación de `formatters.js` para estandarizar el tratamiento de números (`formatNumber`) en todo el sistema (Grilla, Totales, Formularios).
- **Lógica Inteligente de Visualización:**
    - **Modo Predeterminado:** Si el campo `formato` está vacío, se muestran 2 decimales para Float y 0 para Integer, sin separador de miles.
    - **Soporte de Patrones:** Capacidad para procesar prefijos (ej: `S/`), sufijos (ej: `%`), y separadores de miles (ej: `#,#.00`).
    - **Detección de Precisión:** El número de decimales se ajusta automáticamente según la definición en el patrón (ej: `.000` fuerza 3 decimales).
- **Edición Premium (Smart Edit):**
    - En el formulario de edición, los campos numéricos alternan entre **modo visual** (con formato/símbolos) y **modo edición** (número puro) al ganar/perder el foco.
    - Se cambió el tipo de input a `text` para permitir la visualización de formatos complejos sin errores de navegador.

### Totales Globales (Server-Side)
- **Cálculo de Universo Completo:** El backend (`DynamicController`) ahora calcula el `SUM()` de las columnas totalizables sobre el conjunto de datos filtrado completo, ignorando la paginación.
- **Sincronización de Datos:** Los totales en el pie de la grilla reflejan ahora la realidad de toda la consulta en la base de datos y no solo de los registros visibles en pantalla.
- **Rendimiento Optimizado:** El conteo de registros (`COUNT`) y los totales se obtienen en una única llamada eficiente a la base de datos.

## [2026-02-26] - Gestión Profesional de Fechas

### Visualización y Filtrado de Precisión
- **Formateo Dinámico (XFIELD):** Implementación de `formatDate` en el motor de utilidades para respetar el campo `formato` de la metadata. Ahora las fechas se muestran según la preferencia del usuario (ej: `DD/MM/YYYY`, `YYYY-MM-DD`).
- **Filtro Nativo Optimizado:** 
    - Se eliminó el selector de hora/minutos de los filtros de la grilla. El selector ahora muestra exclusivamente el calendario para una selección de día más limpia.
    - **Normalización Automática:** Implementación de un `valueGetter` inteligente que trunca la hora de los datos antes de que lleguen al filtro, asegurando que el buscador trate las fechas como "días puros".
    - **Comparador a Medianoche:** Se ajustó la lógica de comparación para que las búsquedas operen a nivel de medianoche, evitando fallos por diferencias de segundos o milisegundos con los datos de la DB.
- **Resiliencia en Pintado:** Se configuró `cellDataType: 'date'` para permitir que AG Grid use componentes especializados de fecha, mejorando la experiencia de usuario y la estabilidad visual.

## [2026-02-26] - Personalización de Interfaz (UX)

### Control Total de Columnas
- **Redimensionamiento Libre:** Se eliminó la restricción de ancho mínimo basada en el valor de la metadata. Ahora el usuario puede reducir el ancho de cualquier columna hasta 1px para optimizar el espacio visual.
- **Motor de Persistencia de Interfaz (Save Interface):**
    - **Guardado Multi-Atributo:** La funcionalidad "Guardar interfaz" ahora persiste en la base de datos no solo el ancho y la posición, sino también el estado de **visibilidad** (oculto/visible) de cada columna.
    - **Feedback Profesional:** Integración con `AlertDialog` para notificar al usuario el éxito del guardado mediante una ventana modal sobria y elegante.
    - **Sincronización en Caliente:** El proceso de guardado dispara automáticamente un `refresh()` de metadatos en el backend, asegurando que los cambios sean oficiales inmediatamente para todas las sesiones.

### Punto de Restauración V14
- **Backup de Base de Datos:** Generación de `ghenesis_db_v14.sql` con el estado actual del sistema (se mantuvo en la raíz del proyecto debido a restricciones de permisos en la carpeta backups).
- **Snapshot de Funcionalidades:** Incluye todas las mejoras de formateo de fechas, filtros optimizados y persistencia de interfaz de usuario.

## [2026-02-26] - Automatización de Scripts y Filtros Pro

### Automatización y Ciclo de Vida
- **Evento INIT Global:** Implementación del evento `INIT` en `DynamicGrid.jsx` que se dispara automáticamente al cargar cualquier grilla. Esto permite la inicialización de componentes (combos, etiquetas) sin intervención del usuario.
- **Sincronización de DOM:** Ajuste de retardos (500ms) para asegurar que el HTML inyectado en `cabecera` esté listo antes de la ejecución del script.

### Mejoras en Grilla y AG Grid
- **Compatibilidad v31+:** Migración de `setRowData` a `setGridOption('rowData', data)` para evitar errores de API en versiones recientes de AG Grid.
- **Protección de Totales:** Se deshabilitó la edición de celdas en las filas ancladas (totales) para evitar inconsistencias de datos.

### Filtrado Inteligente de Fechas
- **Filtro de Texto en Fechas:** Se reemplazó el selector de calendario en los filtros de columna de fechas por una entrada de texto libre.
- **Búsqueda Parcial (Backend):** Implementación de `TO_CHAR` en `DynamicController.js` para permitir búsquedas parciales en fechas (ej: buscar "29" para encontrar todos los días 29, o "-02-" para febrero) comparando tanto contra el formato ISO como contra el formato visual.

### UI y UX
- **Compactación de Cabecera:** Reducción del padding y optimización del tamaño de controles en la cabecera personalizada para maximizar el área de datos.
- **Documentación:** Actualización del manual de scripting con ejemplos de inicialización automática y filtrado avanzado.
## [2026-02-27] - Estabilización de UI y API Fluida de Filtrado

### Correciones de Estabilidad
- **Resolución de Pantalla en Blanco:** Se corrigió un `ReferenceError` crítico en `DynamicGrid.jsx` mediante la reorganización completa del orden de los hooks de React. Se aseguró que todas las funciones (`fetchData`) y estados estén inicializados antes de ser referenciados en los efectos de ciclo de vida.
- **Sincronización de Ciclo de Vida:** Restauración del efecto de carga inicial de datos y su correcta vinculación con las dependencias de filtrado y paginación.

### Motor de Scripting & Filtros PRO (API Fluida)
- **Implementación de API Fluida (`ui.filter`):** 
    - Creación de un "Builder" de filtros encadenable en el puente de scripting.
    - Métodos soportados: `.igual()`, `.distinto()`, `.mayor()`, `.mayorIgual()`, `.menor()`, `.menorIgual()`, `.contiene()` y `.aplicar()`.
    - Esta API permite que los scripts personalizados apliquen filtros complejos de forma legible y elegante.
- **Sincronización de Totales y Paginador:** 
    - Al usar la nueva API, el sistema ahora fuerza una recarga desde el servidor.
    - **Resultado:** Los totales calculados en el pie de la grilla y el contador del paginador ("Reg. X de N") se actualizan automáticamente para reflejar el conjunto de datos filtrado.

### Backend Inteligente (Filtros Dinámicos)
- **Sistema de Operadores por Sufijo:** El `DynamicController` ahora reconoce automáticamente sufijos en los parámetros de búsqueda para mapearlos a operadores SQL:
    - `_ge` (>=), `_le` (<=), `_gt` (>), `_lt` (<), `_ne` (<>), `_like` (ILIKE).
- **Filtrado Automático de Campos:** Cualquier parámetro enviado desde el frontend que coincida con un nombre de campo de la grilla (sin importar mayúsculas/minúsculas) se aplica ahora como un filtro de base de datos real.
- **Soporte en sopen:** Se habilitó el retorno de totales (`aggregates`) desde los scripts `sopen` para mantener la consistencia visual en tablas virtuales o procesadas por código.

### Mejoras de UX & Sincronización
- **Totales Reactivos en Edición Inline:** Se implementó un modo de carga "silencioso" (`silent fetch`) en la grilla. Ahora, al editar una celda directamente en AG Grid, el sistema guarda el cambio y refresca los totales del servidor automáticamente sin mostrar un spinner disruptivo. Esto garantiza que las sumas del pie sean siempre exactas tras cualquier cambio de datos.
- **Implementación de PoC Multi-Módulo:** Creación exitosa de módulos especializados (Facturas/Boletas) usando la misma tabla base y discriminando datos mediante scripts `sopen` dinámicos.

## [2026-02-27] - Reparación de Parseo de Fechas (AG Grid)

### Correcciones Profundas de AG Grid
- **Edición Inline de Fechas Funcional:** Se corrigió un fallo crítico en `DynamicGrid.jsx` donde AG Grid revertía silenciosamente las ediciones de fechas manuales debido a conflictos de Tipado (`cellDataType: 'text'` vs la salida `Date` del editor).
- **Desactivación de Coerción Estricta:** Se apagó el forzado de tipo para columnas de fecha (`cellDataType: false`), permitiendo así que el `agDateCellEditor` nativo y las funciones de parseo trabajen correctamente.
- **Gestión Precisa de Zonas Horarias (UTC):**
    - Se solucionó un desfase donde el calendario de AG Grid enviaba fechas en Meridiano de Greenwich (Midnight UTC), lo que provocaba que se guardara "el día anterior" en zonas horarias locales (ej. UTC-5).
    - El nuevo algoritmo `valueSetter` detecta inyecciones de fecha a las "00:00:00.000 UTC" exactas y aplica conversiones seguras utilizando `getUTCFullYear()` para asegurar coherencia absoluta.
- **Robustez en Escritura Manual:** El input soporta, procesa y autocompleta con seguridad la inserción humana de formatos variados: `DD/MM/YYYY`, `DD-MM-YYYY` y atajos de año de dos dígitos (`DD/MM/YY`).
- **Soporte de Vaciado de Celda:** Las fechas ahora se pueden borrar completamente de la celda de la grilla estableciendo el valor como `null` nativo en base de datos.
- **Visibilidad de Errores (Anti Fallos Silenciosos):** Se añadieron alertas (`alert()`) explícitas tanto a la detección de fechas inválidas o absurdas, como a posibles rechazos provenientes del Backend al hacer actualizaciones en línea.

### Implementación del Motor de Ciclo de Vida en Metadata (Eventos snewrecord, ssave, etc)
- Se habilitó PostgreSQL (`xgrid`) inyectando las 6 columnas nativas solicitadas: `snewrecord`, `ssave`, `ssavepost`, `sscroll`, `sdelete`, y `sdeletepost` que contienen scripts dinámicos en JavaScript.
- Se reestructuró `ScriptingEngine.js` inyectando un nuevo parámetro clave (`record`) al sandbox de evaluación nativo, permitiéndole a lenguajes externos interceptar el documento actual, evaluar lógicas e inhabilitar peticiones a DB abortando los commits (`return false`).
- Se expuso la API Frontend completa (`setLabel`, `setStyle`, `filter`) al contexto de React subyacente de `dispatchGridEvent`. Ahora _sscroll_ tiene poder total sobre el DOM y React Hooks para modificar labels de botones del formulario (ej. alterar el valor del botón Guardar por "Guardar {importe}") u objetos personalizados HTML de las pestañas (`cabecera`/`pie`) tal cual se hacía en el framework legado.

### Manipulación Dinámica DOM y Estilos desde Metadata
- Se actualizó `DynamicGrid.jsx` para que el `dispatchGridEvent` inyecte la API UI completa (`setLabel`, `setStyle`, `filter`) al sandbox. Ello permite a rutinas de base de datos como `sscroll` alterar interactiva y libremente cualquier componente HTML en la cabecera o pie de los formularios inyectados.
- Se implementó un Dashboard en HTML Nativo incrustado mediante metadato (`pie`) en Ventas (`112`) que se redibuja en hiper-tiempo real y es administrado exclusivamente por `sscroll` conforme se cambian registros desde el teclado.

## [2026-02-27] - Arreglo Visual de Componentes Complementarios en Grilla
- **Restauración de Alturas en Paginador y Ayuda:** Se corrigió un problema visual introducido al reordenar la disposición de `cabecera`, `pie` y paginador. Al estar dentro de un contenedor en columna (Flexbox), los elementos perdían su tamaño natural porque eran encogidos al máximo. Se agregó el parámetro `flexShrink: 0` tanto a la barra de ayuda como a la barra del paginador para proteger su altura original y evitar el colapso que impedía presionarlos.

### Punto de Restauración V15
- **Backup de Base de Datos y Scripts:** Generación del respaldo `ghenesis_db_v15.sql` conteniendo todas las lógicas y metadatos implementados hasta la fecha.
- **Registro Cumplido:** Resguardo completo de las correcciones de fecha en AG Grid, la inyección del API Fluido (`ui.filter()`), el control visual del layout (`uiStyles` vía `sopen`), y las guías actualizadas de arquitectura de seguridad en el sandbox del Servidor Node y Motor React.

## [2026-02-28] - Combos con Búsqueda Interactiva
- **Combos en Formulario:** Reemplazo de los combos nativos en `DynamicForm.jsx` por componentes `Autocomplete` de Material-UI, permitiendo a los usuarios buscar y filtrar opciones interactivamente simplemente tecleando letras al tener el campo enfocado.
- **Auto-selección de Datos:** Se implementó una lógica de `onFocus` inteligente en todo el `DynamicForm`. Al colocar el ratón/tabular sobre cualquier input (sea de fechas, numérico, autocompletar, texto libre), todo su contenido pre-existente se sombrea o "selecciona" proactivamente, ahorrando al usuario la tarea de darle a "Retroceso" antes de empezar un reemplazo veloz del dato.
- **Soporte Avanzado de SQLCombo Transaccional:** Se optimizó globalmente desde la caché en memoria del `MetadataService` (Backend) la forma en que `sqlcombo` procesa las configuraciones de origen de datos (p.ej.: `SELECT id, nombre FROM x...`). Se construyen listas planas y diccionarios hash `[id: nombre]`. Como impacto, los combos de Autocomplete (`DynamicForm`) e inclusive la grilla AG Grid (`DynamicGrid`) ahora permiten referenciar, graficar y mostrar al mortal palabras textuales (labels/nombres), pero preservan y envían puramente por debajo la Clave Foránea (`ID` numérico) a la base de datos subyacente de manera invisible.

## [2026-02-28] - Patrón Sombra (Shadow Column) Directa (Datafield)
- **Delegación Bi-Direccional Visual -> Física (`datafield`):** Se implementó de manera robusta y definitiva la arquitectura de llaves foráneas ("Idea 1"). En esta estrategia, la interfaz de UI dibuja y navega puramente sobre el campo descriptivo entregado por la vista (ej. `nombre_cliente = Juan` desde `qventa`), pero al momento de guardar cambios o insertar, el Frontend asocia automáticamente el ID transparente a su columna física hermana (`cliente = 15`) definida en `XFIELD.datafield`.
- **Intercepción de Backend Limpia:** `DynamicController` fue fuertemente sanitizado. Ahora, al realizar sentencias `INSERT/UPDATE` filtra todos los campos virtuales mapeados para no causar desbordamientos en la base de datos (Ej: Omitir enviar `nombre_cliente` a la tabla `venta`), mientras permite que la clave foránea real asuma su lugar limpio sin necesidad de mutaciones riesgosas o transformaciones de tipos fallidas.
- **Tolerancia a Nulos y Edición Inline Re-Activada:** Se reparó un parche de Postgres fundamental donde el tipado `typeof null` excluía del `UPDATE` dinámico la acción de dejar en vacío las columnas por el usuario. La Grilla inline asimila transacciones de forma segura y lanza alertas nativas (`alert()`) si el motor Postgres devuelve advertencias en vez de colapsar la solicitud de red en silencio.

## [2026-03-01] - Corrección de Combos Dinámicos (Type-Ahead) en Grid y Form

### Problema Resuelto
- Los combos con `sqlcombo` (búsqueda interactiva) mostraban por defecto 100 registros iniciales, pero al escribir en el campo de búsqueda los registros anteriores no se reemplazaban correctamente por los resultados filtrados. Además, respuestas de búsquedas anteriores podían sobrescribir resultados más recientes (race condition), y el formulario de edición parpadeaba al buscar.

### Solución Implementada — Request Counter + Loading State
- **Protección Anti Race-Condition (`requestIdRef`):** Se implementó un contador de peticiones en ambos componentes (`AsyncComboEditor` en `DynamicGrid.jsx` y `fetchRemoteOptions` en `DynamicForm.jsx`). Cada búsqueda incrementa un ID. Cuando llega la respuesta del servidor, solo se aplica si su ID coincide con la petición más reciente. Esto descarta automáticamente respuestas obsoletas de búsquedas anteriores.
- **Clearing Post-Debounce:** Las opciones anteriores se limpian justo cuando el fetch real se dispara (después del debounce de 300ms), no en cada keystroke. Esto es necesario para que el filtrado funcione correctamente.
- **Loading UX ("Buscando..."):** Se agregó `loadingText="Buscando..."` a ambos Autocomplete (grid y form). Como `setOptions([])` y `setLoading(true)` se ejecutan simultáneamente (React 18 batching), MUI muestra un spinner con texto en lugar de un dropdown vacío — eliminando el parpadeo perceptible.
- **Comportamiento uniforme:** La lógica es exactamente la misma en el combo del grid (edición inline) y en el combo del formulario de edición.

## 2026-03-01: Corrección de combos en el grid — distinción sqlcombo con/sin datafield

**Problema:** El combo inline del grid usaba `AsyncComboEditor` (popup con búsqueda type-ahead) para TODOS los campos con `sqlcombo`, sin distinguir si tenían `datafield` o no. Esto causaba:
1. Para campos como `idrole` (sin datafield, lista corta): el combo no guardaba correctamente y era innecesariamente complejo.
2. El click en opciones del combo popup no registraba porque MUI renderizaba el dropdown en un Portal fuera del popup de AG Grid.
3. El filtro de columna para campos combo sobre columnas INTEGER generaba error 500 en el backend.

**Solución aplicada:**
- **Distinción cellEditor por tipo:**
  - `sqlcombo` + `datafield` (shadow column) → `AsyncComboEditor` popup con búsqueda server-side LIKE
  - `sqlcombo` sin `datafield` (lista finita) → `agSelectCellEditor` nativo de AG Grid con valores pre-cargados de `comboDataList`
  - `valcombo` → `agSelectCellEditor` con valores estáticos
- **`disablePortal` en Autocomplete:** Fix crítico — MUI renderizaba el dropdown en un Portal al `<body>`, fuera del popup de AG Grid. Cada click en una opción causaba que AG Grid cerrara el editor antes de que `onChange` se disparara. Con `disablePortal`, el dropdown se renderiza dentro del popup y los clicks funcionan.
- **`setDataValue` + `api.stopEditing()`:** En vez de depender del mecanismo `getValue()`/`stopEditing()` que fallaba con el popup editor, se escribe el valor directamente en AG Grid vía `node.setDataValue()` y se cierra con `api.stopEditing()`. Esto dispara `onCellValueChanged` → `handleCellValueChanged` → propaga al datafield → guarda en BD.
- **Filtros combo sin datafield excluidos del backend:** El `filterValueGetter` devuelve el label (texto) para filtrado client-side, pero la columna real es INTEGER. Enviar ese filtro al backend generaba `WHERE idrole ILIKE '%ADMIN%'` → error 500. Ahora `handleFilterChanged` excluye campos con `comboDataKeyVal` sin `datafield` del filter model enviado al servidor.

**Archivos modificados:** `DynamicGrid.jsx` (AsyncComboEditor, cellEditor logic, handleFilterChanged)

## 2026-03-01: Preservar posición de columnas al mover (maintainColumnOrder)

**Problema:** Al mover una columna arrastrándola y luego hacer click dentro del grid, la columna volvía a su posición original. AG Grid v35 re-aplica el orden de `columnDefs` al re-renderizar.

**Archivo modificado:** `DynamicGrid.jsx` (prop `maintainColumnOrder`)

## [2026-03-01] - Integración Estable de CodeMirror 5 (Tema Eclipse)

- **Downgrade Estratégico a CodeMirror 5:** Se reemplazó la problemática versión 6 de CodeMirror por la versión 5 clásica y estable para solucionar inconsistencias graves de interfaz (pantallas en blanco, problemas de layout, campos ineditables y robo de enfoque causados por incompatibilidades con modales de Material-UI).
- **Tema Nativo Eclipse:** Se configuró el editor para utilizar el tema visual clásico "Eclipse", cumpliendo con la exigencia estética exacta solicitada (fondo blanco, identificadores morados) sin necesidad de parches forzados.
- **Soporte Multi-Lenguaje Ampliado:** Se habilitó el soporte completo de resaltado de sintaxis para JavaScript, SQL y HTML (incluyendo dependencias `xml`, `css` y el modo `htmlmixed`) en el componente `MemoEditorDialog.jsx`.
- **Estabilidad de UI en Modales:** El componente ahora rinde perfectamente en altura 100% y se corrigieron todos los bloqueos de teclado e interacción derivados del secuestro de foco de MUI.
