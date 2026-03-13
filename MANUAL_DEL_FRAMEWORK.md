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
Las relaciones de tablas se auto-descubren y renderizan gracias a la propiedad `gparent` del `XGRID`.
- **Grillas Maestras (`gparent` ES NULL):** Se cargan por defecto al abrir o instanciar un Módulo (forma de Tabs superpuestas).
- **Grillas Detalle (`gparent` NO ES NULL):** Se mantienen ocultas hasta que el usuario intenta editar un registro en la grilla Padre. En el formulario de Edición, debajo de los campos de texto del Padre, aparecerán estas sub-grillas, las cuales se auto-filtran inyectándoles silenciosamente la Llave Primaria (PK) del registro Padre seleccionado.

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

---
*(Este manual será expandido iterativamente a medida que refactorizamos y pulimos el entorno del framework)*
