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

