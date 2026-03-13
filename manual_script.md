# Manual de Scripting Engine - Ghenesis Framework

Este manual describe cómo utilizar el motor de scripts dinámicos para personalizar el comportamiento y la apariencia de las grillas y formularios mediante metadatos.

## 0. Arquitectura de Seguridad y Privilegios
Ghenesis es un framework "Metadata-Driven" (impulsado por metadatos). Esto significa que la aplicación lee la estructura funcional y visual desde registros puros alojados en PostgreSQL en lugar de archivos pre-compilados.

Esta arquitectura implica ciertos acuerdos de responsabilidad a tomar en cuenta:
1. **Confianza Privilegiada a Nivel Desarrollador:** La Base de Datos se asume como la **única fuente inmaculada de la verdad**. El framework interpretará y ejecutará indiscriminadamente cualquier script JS o HTML que un usuario con privilegios de DB inyecte en las tablas de sistema (e.g., `xgrid.ejecuta`). 
   - **Protocolo Crítico:** Sólo perfiles estrictamente técnicos y administradores de alto nivel (como el Rol `DEVELOPER`) deben contar con acceso físico a las pantallas de Mantenimiento de Metadatos. Si un empleado malintencionado edita un script del sistema, compromete toda la red.
2. **Protección Cero Confianza a Nivel Usuario (Sandbox):** Para los operadores finales de la interfaz (Gestores, Ventas, RRHH), la arquitectura es robusta. Es imposible para un rol común saltarse validaciones realizando "hacking visual" del lado del cliente.
   - Todo comando de insersión (`ssave`/`sdelete`) se blinda contra inyección SQL utilizando Consultas Múltiples Parametrizadas.
   - Un usuario no puede obligar al backend a ejecutar una mutación de un campo o tabla si las reglas intrínsecas del metadato (como `readonly` global) lo tienen restringido, sin importar qué peticiones modifique con herramientas externas o de desarrollador.
3. **Sandbox en Servidor Seguro:** Todo script que sea requerido a operar estrictamente en la base del Servidor (Backend), como las funciones `sopen`, corre encapsulado empleando el módulo nativo `vm` (Virtual Machine sandbox) de Node.js. Esto inhibe la capacidad destructiva del script ante la infraestructura base de red o el hardware del sistema host.

---

## 1. Ubicación de los Scripts
Los scripts se configuran en la tabla `XGRID`, específicamente en el campo:
*   **`ejecuta`**: Contiene el código JavaScript que se ejecutará en respuesta a acciones de la UI.

## 2. Contexto del Sandbox
Cada script se ejecuta en un entorno seguro y recibe los siguientes objetos:

| Objeto | Descripción | Propiedades Útiles |
| :--- | :--- | :--- |
| `action` | ID de la acción disparada | String enviado desde `window.ghenesis.run('ID')` |
| `data` | Registros actuales | Array de objetos (filas visibles en el grid) |
| `selected` | Registro activo | Objeto de la fila seleccionada (azul) |
| `grid` | API de AG Grid | `grid.api`, `grid.columnApi` |
| `ui` | Bridge de Interfaz | `ui.alert()`, `ui.setStyle()`, `ui.setLabel()`, `ui.filter()` |
| `api` | Cliente Backend | Instancia de Axios para peticiones HTTP |

---

## 3. Control Dinámico de UI (`ui.setStyle`)
Permite modificar cualquier elemento de la pestaña activa.

### Elementos Soportados (Keys)
| Key | Elemento | Ubicación |
| :--- | :--- | :--- |
| `title` | Título del Módulo | Barra superior Grilla |
| `new` | Botón Nuevo | Barra Grilla |
| `edit` | Botón Editar | Barra Grilla |
| `delete` | Botón Borrar | Barra Grilla |
| `refresh` | Botón Actualizar | Barra Grilla |
| `export` | Botón Exportar | Barra Grilla |
| `options` | Botón Más Opciones | Barra Grilla |
| `formTitle` | Título Formulario | Cabecera del Form |
| `save` | Botón Guardar | Pie del Form |
| `cancel` | Botón Cancelar | Pie del Form (Edición) |
| `close` | Botón Cerrar | Pie del Form (Lectura) |

### Propiedades de Estilo
```javascript
ui.setStyle('key', {
    label: 'Nuevo Texto',           // Cambia el texto
    backgroundColor: '#HEX',        // Color de fondo
    color: 'colorName o #HEX',      // Color de texto/icono
    visible: true | false,          // Muestra/Oculta
    disabled: true | false,         // Habilita/Deshabilita
    borderColor: '#HEX'             // Color del borde
});
```

---

## 4. API Fluida de Filtrado (`ui.filter`)
Esta es la forma recomendada de aplicar filtros desde código. Al usar esta API, el servidor recalcula automáticamente los **Totales** y actualiza el **Paginador**.

### Métodos Disponibles
| Método | Descripción | SQL Generado |
| :--- | :--- | :--- |
| `.igual('campo', val)` | Coincidencia exacta | `campo = val` |
| `.distinto('campo', val)` | Diferente de | `campo <> val` |
| `.mayor('campo', val)` | Mayor que | `campo > val` |
| `.mayorIgual('campo', val)` | Mayor o igual | `campo >= val` |
| `.menor('campo', val)` | Menor que | `campo < val` |
| `.menorIgual('campo', val)` | Menor o igual | `campo <= val` |
| `.contiene('campo', val)` | Búsqueda parcial | `campo ILIKE %val%` |
| `.aplicar()` | Ejecuta el filtro | (Recarga el Grid) |

---

## 5. Ejemplos Prácticos

### A. Procesar Datos con Loop
Recorrer todas las filas visibles y mostrar un resumen:
```javascript
if (action === "RESUMEN") {
    let msg = "Lista de Elementos:\n";
    data.forEach((fila, index) => {
        msg += (index + 1) + ". " + fila.nombre_columna + "\n";
    });
    ui.alert("Resumen", msg, "info");
}
```

### B. Validación y Cambio de Estilo Dinámico
Cambiar el botón de borrar a "PELIGRO" si se selecciona un registro crítico:
```javascript
if (action === "CHECK_CRITICAL") {
    if (selected && selected.es_critico === 'S') {
        ui.setStyle('delete', { 
            label: 'BORRADO CRÍTICO', 
            backgroundColor: 'red', 
            color: 'white' 
        });
    } else {
        ui.setStyle('delete', { 
            label: 'Borrar', 
            backgroundColor: '', 
            color: '' 
        });
    }
}
```

### C. Filtrado Avanzado Profesional (Servidor + Totales)
Este ejemplo muestra cómo filtrar por rango de fechas y categorías usando la **API Fluida**, asegurando que el total de la grilla sea correcto.

**Campo `cabecera` en `XGRID`:**
```html
<div style='display: flex; align-items: center; gap: 20px; background: #fff; padding: 12px 15px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 10px;'>
    
    <!-- Filtro de Fechas -->
    <div style='display: flex; gap: 10px;'>
        <input type='date' id='fecha_desde' placeholder='Desde'>
        <input type='date' id='fecha_hasta' placeholder='Hasta'>
    </div>

    <!-- Filtro de Categoría -->
    <select id='filtroTipoDinamico'>
        <option value='ALL'>Cargando...</option>
    </select>
    
    <button onclick="window.ghenesis.run('PROCESAR_FILTRO')">APLICAR</button>
</div>
```

**Campo `ejecuta` en `XGRID`:**
```javascript
if (action === 'INIT') {
    // 1. Poblar el combo al cargar
    api.post('/api/dynamic/run-query', {
        sql: "SELECT DISTINCT tipo FROM venta ORDER BY tipo"
    }).then(res => {
        const selector = document.getElementById('filtroTipoDinamico');
        let options = '<option value="ALL">-- Ver Todos --</option>';
        res.data.data.forEach(item => { options += `<option value="${item.tipo}">${item.tipo}</option>`; });
        selector.innerHTML = options;
    });
}

if (action === 'PROCESAR_FILTRO') {
    const tipo = document.getElementById('filtroTipoDinamico')?.value;
    const fDesde = document.getElementById('fecha_desde')?.value;
    const fHasta = document.getElementById('fecha_hasta')?.value;
    
    // USANDO API FLUIDA (Recomendado)
    // El servidor filtrará todo el universo de datos y recalculará las SUMAS
    ui.filter()
      .igual('tipo', tipo !== 'ALL' ? tipo : null)
      .mayorIgual('fecha', fDesde)
      .menorIgual('fecha', fHasta)
      .aplicar();
}
```

---

## 6. Tips de Desarrollo y Depuración de Errores (Anti-Crash)
1.  **Nombres de Campos**: Usa siempre el nombre físico de la columna en minúsculas (ej: `fila.idusuario`).
2.  **Filtrado por Cliente vs Servidor**: Evita usar `.filter()` sobre el array `data`, ya que `data` solo contiene la página actual. Usa siempre `ui.filter()...aplicar()` para que los totales sean correctos.
3.  **Encadenamiento**: Puedes llamar a múltiples `ui.setStyle` en la misma ejecución para reconfigurar toda la pantalla.
4.  **Actualización de Datos**: Utiliza siempre la validación `grid.api.setGridOption('rowData', data)` para asegurar compatibilidad con versiones recientes de AG Grid.
5.  **Sistema "Anti-Crash" (Manejo de Errores en Sandbox)**: El motor de scripts de Ghenesis (como `sscroll`, `sdraw`, `ejecuta`, o `ssave`) envuelve todo el bloque de código provisto por la base de datos dentro de un bloque estructurado `try/catch` de forma automática.
    - **Fluidez Garantizada:** Si cometes un error de sintaxis ("Compilation Error") o intentas acceder a una propiedad que no existe durante la ejecución (`RunTime Error`), la interfaz no presentará "pantallas blancas de la muerte". El hook interceptará el error y abortará la porción visual con gracia.
    - **Trazabilidad en Consola:** Cualquier fallo es automáticamente interceptado y volcado en la consola de tu navegador usando `console.error`. 
    - **Cómo Depurar**: Si notas que un evento dinámico (ej. la pintada roja de tu tabla o un recálculo) dejó de ejecutarse, simplemente abre la **Consola del Teclado (F12)** y busca los encabezados en rojo brillante `Ghenesis Script Error:` o `Error compilando sdraw de xgrid:`. Ahí Ghenesis escupirá el número de línea virtual y la variable exacta que te faltó declarar, acelerando la depuración en sistemas de producción.

---

## 7. Dibujo Condicional de Filas (sdraw)
A diferencia de `ejecuta` que se dispara sobre eventos click o de interfaz externa, el motor evalúa el script contenido en el campo **`sdraw`** de la tabla `XGRID` de manera hiper-reactiva **por cada fila individual** de la grilla conforme AG Grid la pinta, recarga o actualiza.

### A. Contexto del Sandbox para sdraw
El script `sdraw` es una función síncrona nativa de evaluación extremadamente rápida. Recibe:
*   **`data`**: El objeto JSON que representa los datos de la fila que AG Grid está a punto de dibujar.
*   **`style`**: Un objeto JavaScript vacío por defecto donde tú inyectarás las reglas de coloración CSS si las evaluaciones lógicas se cumplen.

### B. Ejemplo Práctico
Supongamos que en la grilla "Ventas" queremos que los registros se marquen en rojo brillante cuando el total sea inferior a 2000 dólares para alertar al administrador, o verde si excede los 10000 dólares.

**Código a inyectar en la columna `sdraw` (XGRID):**
```javascript
// Validar si el total es preocupante
if (data.total < 2000) { 
    style = { backgroundColor: '#ffebee', color: '#b71c1c' }; 
} 
// Validar si es una venta excelente usando Else If
else if (data.total > 10000) {
    style = { backgroundColor: '#e8f5e9', color: '#1b5e20' };
}
```

### C. Buenas Prácticas y Restricciones
1.  **Reactividad Pura:** No necesitas preocuparte de actualizar colores si editas en línea. Al ser un Callback inyectado dinámicamente, si el usuario edita el `total` de 5000 a 1500 presionando Enter en la grilla, AG Grid reevaluará tu `sdraw` en milisegundos y la fila adquirirá el tono rojo instantáneamente.
2.  **Sintaxis JavaScript Estándar CSS:** Cuando manipules la variable `style`, asegúrate de usar convención *camelCase* en lugar de guiones CSS puros (ej. usa `backgroundColor` en lugar de `background-color`).
3.  **Seguridad por Fallbacks:** Si un script tiene un error lógico (por ejemplo intentas usar un campo de base de datos mal escrito como `data.totalll`), el motor de Ghenesis atrapará la excepción mediante un `try/catch` nativo para evitar destruir los ciclos de renderizado del componente. AG Grid solo pintará la fila en blanco neutral sin corromper el ecosistema, protegiendo así al framework de inyecciones erróneas generadas por el desarrollador.

---

## 8. Ciclo de Vida de AG Grid (snewrecord, ssave, etc)
Ghenesis cuenta con ganchos hiper-reactivos embebidos en la base de datos (PostgreSQL) para interceptar acciones clave sobre cualquier grilla. Estos campos adicionales (`snewrecord`, `ssave`, `ssavepost`, `sscroll`, `sdelete`, `sdeletepost` en pre-configuración en tabla *XGRID*) ofrecen lógicas de control transaccional e interactividad fluida con el DOM de la aplicación.

### A. Contexto Global de Variables
Cualquier script en estos campos es inyectado con los siguientes objetos nativos de ecosistema:
- **`record`**: Objeto mutativo en tiempo real que representa el JSON del formulario de edición/creación actual.
- **`selected`**: Objeto de Solo Lectura con el JSON estructurado de la fila actual de la grilla que el cursor resaltó.
- **`action`**: El nombre del hook disparador (ej. `"SSAVEPOST"`).
- **`ui`**: Tu API universal para DOM y diseño. Controladores como `ui.setLabel()`, `ui.setStyle()`, `ui.alert()`, `ui.notify()`. Manipular DOM HTML clásico (`document.getElementById()`) es totalmente aceptado y soportado.

### B. Listado de Eventos (Event Hooks)

#### 1. `snewrecord` (Al Inicializar un Formulario Nuevo)
Se dispara al solicitar añadir un registro (Boton Nuevo, F2, Click Derecho Agregar). 
**Objetivo principal:** Inyectar variables por defecto (ej: fechas actuales, cantidades mínimas, booleanos) al objeto mutativo `record`.
```javascript
// Establecer valores por defecto (No necesitas refrescar UI, Ghenesis mapeará automáticamente):
record.fecha = new Date().toISOString().split('T')[0];
record.importe = 500;
record.cliente = 'Consumidor Final';
// Informar al usuario sutilmente
ui.alert('Borrador Listo', 'Datos incializados en sistema', 'info');
```

#### 2. `sscroll` (Al Moverse por la Rejilla)
Se lanza inmediatamente al cambiar de fila activa (seleccionar, cliquear o desplazarse por teclado).
**Objetivo principal:** Dinamismo e interactividad visual entre componentes (ej: pre-vistas de imágenes, alertas informativas, manipulaciones de botones o DOM inyectados en cabecera/pie).
```javascript
// Manipular el Nombre estandar del botón Guardar incorporando el identificador del registro:
if (selected) {
    ui.setLabel('save', 'Guardar Factura: $' + selected.importe);
    
    // Y simultáneamente manipular HTLM inyectado libre "ej: un <span id='totalSpan'>"
    let e = document.getElementById('totalSpan');
    if(e) e.innerHTML = 'Activa ID: ' + selected.id;
}
```

#### 3. `ssave` (Antes de Enviar Post a Servidor - Validate/Abort)
Reconoce la acción nativa de intentar grabar desde la ventana formulario o *inline edit*.
**Objetivo principal:** Validar la coherencia de datos.
**Superpoder:** Incluir un `return false;` frena en absoluto la conexión en red al backend, cancelando la mutación y evitando errores HTTP.
```javascript
if (record.importe < 0) {
    ui.alert('Acción Denegada', 'El importe contable no puede ser una cifra negativa.', 'error');
    // Impedir que Ghenesis prosiga a postear a la Base de Datos
    return false; 
}
```

#### 4. `ssavepost` (Confirmación Positiva de Grabación)
Se invoca solo después de que el backend completara el _Insert_ o _Update_ limpiamente y retornara Success 200.
**Objetivo principal:** Notificaciones finales automatizadas a usuarios o recargas en cascada adicionales.
```javascript
ui.alert('Transacción OK', 'La venta ha sido asentada de manera correcta', 'success');
```

#### 5. `sdelete` (Antes de Enviar Delete a Servidor - Delete/Abort)
Análogo al comportamiento protector de `ssave`.
```javascript
if (selected.importe > 5000) {
    ui.alert('Anulación', 'Importes sobre USD 5k requieren perfil administrador para anularse', 'warning');
    return false; // Se cancela la anulación en el origen
}
```

#### 6. `sdeletepost` (Confirmación Positiva de Borrado)
Se ejecuta estrictamente en las secuelas de un Borrado limpio con HTTP OK 200.
```javascript
ui.notify('Log de Auditoría de Sistemas: Registro eliminado exitosamente por usuario.');
```

---

## 9. Estructura Visual de Componentes Inyectados (Layout)
Ghenesis renderiza la grilla y sus elementos decorativos (`cabecera`, `pie`) en un contenedor **Flexbox vertical**. Para garantizar que el diseño de tus paneles (Dashboards/Totales) se mantenga fiel y no se colapse independientemente de la resolución o de la cantidad de registros:

1. **Orden de Renderizado:**
   - La **`cabecera`** inyectada se dibuja al inicio, sobre la grilla.
   - El componente de **Grilla** ocupa el centro y reclama todo el espacio restante disponible visualmente.
   - El componente de **Ayuda**.
   - El **Paginador** del sistema.
   - El **`pie`** inyectado se lee y dibuja siempre al puro final de la pantalla (debajo del paginador).

2. **Propiedades Anti-Colapso:** 
   El framework protege nativamente la **altura (height)** de los contenedores secundarios como el Paginador y el componente de Ayuda aplicando la regla CSS `flex-shrink: 0`. Esto asegura que nunca se vean comprimidos, aplastados o inoperables en pantallas de tamaño pequeño o cuando la tabla contenga abundantes datos. Los componentes `cabecera` y `pie` también asumen sus dimensiones originales declaradas en el HTML de la base de datos sin reducirse.

3. **Modificación Dinámica de Dimensiones mediante `sopen`:**
   Si la grilla tiene un componente `pie` y necesitas ajustar la altura que la propia grilla asume en pantalla, el evento de inicialización en el backend (`sopen` en la tabla `xforms` o `xgrid`) te permite enviar propiedades de diseño globales inyectadas de forma nativa a React.

   **Ejemplo en `sopen`:**
   El motor interpretará el array `uiStyles` que envíes al abrir y lo aplicará directamente a la envoltura (layout principal) de la grilla. De esta forma, puedes reducir el tamaño del listado para hacerle espacio a dashboards extremadamente grandes.
   ```javascript
   return {
       wrapQuery: "SELECT * FROM public.venta",
       wrapParams: [],
       // Configura y Fuerza estilos en el frontend
       uiStyles: { 
           grid: { 
               // Puedes usar variables combinadas (calc), porcentajes o viewport (vh)
               minHeight: 'calc(100% - 240px)' 
           } 
       }
   };
   ```

---

## 10. Seguridad y Parámetros Dinámicos en sopen (`wrapParams`)
El parámetro `wrapParams` se utiliza para pasar los **valores dinámicos** de forma segura a tu consulta SQL (`wrapQuery`). 

Es el estándar de seguridad en bases de datos (especialmente en PostgreSQL) para **evitar ataques de inyección SQL** y para evitar el error común de tener que concatenar manualmente variables, comillas simples o lidiar con fechas y caracteres extraños en tu consulta de texto.

### ¿Cómo funciona?

En lugar de construir tu consulta sumando los valores perjudicialmente:
```javascript
// FORMA INCORRECTA Y PELIGROSA:
var idCliente = 15;
return {
    wrapQuery: "SELECT * FROM public.venta WHERE id_cliente = " + idCliente + " AND estado = 'PAGADO'"
};
```

Utilizas comodines numéricos (`$1`, `$2`, `$3`, etc.) dentro del `wrapQuery`, y luego usas el `wrapParams` (que es un arreglo) para decirle al motor qué valor le corresponde a cada comodín en el exacto mismo orden:

```javascript
// FORMA CORRECTA Y SEGURA:
var idObtenido = 15;
var estadoObtenido = 'PAGADO';

return {
    wrapQuery: "SELECT * FROM public.venta WHERE id_cliente = $1 AND estado = $2",
    wrapParams: [idObtenido, estadoObtenido], // El 15 reemplaza a $1, el 'PAGADO' reemplaza a $2
    uiStyles: { /* ... */ }
};
```

### Casos de Uso Recomendados para `wrapParams`
Usar `wrapParams` es indispensable cuando tu consulta depende de variables del sistema definidas en el momento en el que el usuario abre el módulo. Ejemplos clásicos:

1. **Filtrar datos por el usuario logueado:** Mostrar solo las facturas del empleado que ha iniciado sesión (`userData.id`).
2. **Filtrar por fecha actual:** Limitar los registros mostrados en pantalla solo a las transacciones sucedidas en el día en curso utilizando variables de tiempo de JavaScript antes de enviarlas al motor de base de datos.
3. **Módulos pre-filtrados compartidos:** Si la misma gran tabla (ej: Clientes) se usa para mostrar un submódulo de "Solo Clientes VIP", le inyectas discretamente el parámetro `$1` correspondiente a `VIP` empleando `wrapParams` en `sopen` sin que la capa superior (Usuario) esté al tanto ni pueda vulnerar la condición global.

---

## 11. Configuración de Listas y Combos Interactivos
Ghenesis cuenta con combos de despliegue potentes impulsados por el sistema de metadatos de campos (`XFIELD`). Estos combos aplican automáticamente en vistas de Grilla y de Formulario integrando capacidades nativas modernas como **búsqueda interactiva conforme escribes (Type-Ahead)** y **auto-seleccionar** el dato viejo tan pronto recibes el foco para optimizar tu tipeo.

Puedes configurar un campo en `XFIELD` para que sea un combo de dos maneras: manual (`valcombo`) o dinámica por base de datos (`sqlcombo`).

### A. Combos Estáticos (`valcombo`)
Escribe literalmente tus opciones separándolas por una coma (`,`). Ghenesis armará la lista bajo el capó. Ideal para estados cerrados pequeños:
*   En `valcombo`: `Pagado, Pendiente, Cancelado`

### B. Combos Dinámicos Avanzados (`sqlcombo`)
Si requieres leer un catálogo dinámico y extenso (como Clientes, Zonas, o Productos) puedes escribir una consulta select.
*   En `sqlcombo`: `SELECT nombre FROM zonas ORDER BY nombre`

**Diccionario Llave / Valor (Llave Foránea):**
Ghenesis soporta nativamente la arquitectura relacional clásica donde tu base de datos central almacena el **ID** (`INT/UUID`), pero tú deseas que el humano vea y filtre en pantalla escribiendo el **Nombre** (`VARCHAR`).

Para activar esta funcionalidad, tu consulta de `sqlcombo` debe devolver **estrictamente dos columnas**:
1.  **La primera:** El valor real (El código/ID que vas a insertar a la Base de Datos).
2.  **La segunda:** La Etiqueta (Label visual o descripción a pintar en pantalla).

**Ejemplo Práctico en `sqlcombo`:**
```sql
SELECT id_rol, nombre_rol FROM roles ORDER BY nombre_rol
```

**Beneficio Transparente:**
*   El Autocomplete te dejará teclear libremente "Administrador" usando el motor Type-Ahead.
*   Tanto la grilla como el formulario dibujarán la palabra "Administrador".
*   Cuando oprimas `<Enter>` o `<Guardar>`, Ghenesis mandará un número (e.g. `2`) a tu tabla transaccional final blindando la integridad referencial.

---

## 12. Patrón Sombra (Shadow Column) para Combos Dinámicos en Grid
Ghenesis soporta manejar grillas complejas donde el dato real a guardar en la base de datos transaccional es una clave foránea (ej. un número entero `cliente = 15`), pero la interfaz debe permitir al usuario ver, filtrar y seleccionar opciones basándose en el texto descriptivo correspondiente (ej. `nombre_cliente = Juan`).

### Metodología de Implementación: Vistas + Datafield
Para lograr que la tabla se comporte de forma intuitiva sin inyectar joins complejos en cada guardado, el framework maneja internamente la "sincronización de espejo" usando el campo de metadatos **`datafield`**.

**Pasos (Ejemplo Tabla Ventas cruzada con Personas):**
1. **Configurar la Tabla Base (XGRID):**
   - El campo `nombre` contendrá la tabla transaccional real (Ej. `venta`), que será utilizada por el Backend al momento de realizar las acciones puras contra la base de datos (CRUD: Insert, Update, Delete).
   - El campo `vquery` será una Vista en tu base de datos (Ej. `qventa`), la cual cruza la llave primaria con los campos textuales que necesitas renderizar, generando columnas resultantes nuevas como `nombre_cliente`.
   - Modifica el script del evento `sopen` para que al pedir la lista inicial, se seleccione siempre sobre tu vista general `qventa` y no sobre la tabla pelada `venta`.

2. **Configurar la Columna Virtual (XFIELD):**
   - Localiza/Habilita el campo falso generado por tu vista (Ej. `nombre_cliente`).
   - Declara este campo como el combo dinámico metiendo tu script en la propiedad `sqlcombo`. Esto enseñará a React a crear una lista desplegable. Tu script SIEMPRE debe devolver `id` y `nombre`:
     ```sql
     return { wrapQuery: "SELECT id, nombre FROM persona ORDER BY nombre" }
     ```
   - En esta misma fila (campo `nombre_cliente`), ubica la columna de metadatos que dice **`datafield`** y escríbele el nombre de la columna real de base de datos a la que pertenece esa información. En nuestro ejemplo, escribe `cliente`.
   - **(Opcional pero Recomendado)**: Ve a la definición de la columna física verdadera (`cliente`) y ocúltala de la vista (`oculto = true`) y de la edición (`eoculto = true`) en caso de que exista, pues ya el usuario trabajará con el clon virtual y no querremos confundirlo mostrándoles números sueltos.

**Cómo funciona tras bambalinas:**
* **Frontend interactivo:** El usuario verá "Juan" en su combo. Como tú seteaste `datafield = 'cliente'`, al momento de guardar el formulario o editar inline, React extrae el ID real `15` y secretamente reconstruye el paquete de cambios forzando `cliente = 15`.
---

## 13. Sistema de Borrado Lógico (Soft Delete)

El framework Ghenesis implementa un sistema de borrado lógico por defecto para todas las tablas. Esto permite recuperar registros eliminados accidentalmente y mantener un registro de auditoría de los cambios.

### 13.1 Campo `updtype`
Todas las tablas gestionadas por el framework deben tener un campo numérico llamado `updtype`. Si el campo no existe, el framework lo creará automáticamente al intentar guardar o borrar datos. Los valores posibles son:
- **0**: Registro nuevo.
- **1**: Registro modificado.
- **2**: Registro eliminado (Borrado Lógico).

### 13.2 Funcionamiento en Grillas
- Por defecto, las grillas filtran y ocultan automáticamente todos los registros donde `updtype = 2`.
- Al presionar el botón "Borrar" (o `Ctrl+Supr`), el registro no se elimina físicamente, sino que su valor de `updtype` cambia a 2.

### 13.3 Operaciones Masivas (Bulk Operations)
Ghenesis permite realizar operaciones sobre múltiples filas seleccionadas mediante los checkboxes:
- **Borrado Lógico Masivo**: Selecciona varias filas y presiona "Borrar". El sistema te pedirá confirmación indicando el número total de registros que serán movidos a la papelera.
- **Restauración Masiva**: En la vista de registros eliminados, selecciona los registros deseados y presiona **"Restaurar"**. Todos los registros seleccionados volverán a estar activos simultáneamente.
- **Borrado Físico Masivo**: Permite vaciar la papelera eliminando definitivamente múltiples registros seleccionados de una sola vez.

> [!NOTE]
> Todas las operaciones masivas utilizan un sistema inteligente de detección de clave primaria que garantiza la integridad de los datos, incluso en tablas con nombres de ID personalizados (ej. `idestudiante`).

## 14. Selección y Atajos de Copiado (Clipboard Avanzado)
Ghenesis incorpora un sistema de selección múltiple y gestión de portapapeles diseñado para la productividad masiva y la integración con herramientas externas como Microsoft Excel.

### A. Sistema de Selección Híbrida
Las grillas presentan una columna fija a la izquierda con cuadraditos (checkboxes) que permiten un control dual:

1.  **Selección Múltiple (Checkboxes):**
    *   **Individual:** Al hacer clic en el checkbox de una fila, esta se suma o resta de la selección actual sin afectar a las demás.
    *   **Masiva (Header):** El checkbox en la cabecera permite seleccionar o deseleccionar todas las filas visibles en la página actual.
2.  **Selección Única (Clic en Datos):**
    *   Al hacer clic en cualquier celda de datos (fuera del checkbox), el sistema automáticamente **limpia** cualquier selección previa y marca **únicamente** la fila actual. Esto permite una navegación rápida sin dejar "residuos" de selecciones anteriores.
3.  **Rangos (Shift + Clic):**
    *   Puedes seleccionar bloques continuos haciendo clic en una fila y luego pulsando `Shift + Clic` en otra.

### B. Atajos de Teclado Profesionales
El framework separa el copiado de registros completos del copiado de datos puntuales para evitar la limpieza manual de información tras pegar:

| Atajo | Acción | Resultado |
| :--- | :--- | :--- |
| **`Cmd + C`** (Mac) / **`Ctrl + C`** (Win) | **Copiar Fila(s)** | Copia el contenido completo de la fila actual (todas sus columnas visibles). Si hay varias filas seleccionadas con checks, las copia todas en bloque. |
| **`Cmd + K`** (Mac) / **`Ctrl + K`** (Win) | **Copiar Celda** | Copia **únicamente el valor** de la celda donde está el foco del cursor. Ideal para llevarse un ID, un código o un monto específico. |

### C. Compatibilidad con Excel / Hojas de Cálculo
Cuando utilizas el copiado de filas (`Cmd + C`), Ghenesis genera un formato de **Valores Separados por Tabuladores (TSV)**. 
*   **Limpieza Automática:** El sistema ignora columnas técnicas (como los checkboxes de selección o botones de acción) para que los datos pegados sean puros.
*   **Pegado Directo:** Al pegar en Excel o Google Sheets, cada campo se ubicará automáticamente en su celda correspondiente, respetando el orden visual de la grilla.

---

## 15. Vistas Alternativas (Enlaces y Dashboards HTML)

Ghenesis permite que un módulo, en lugar de mostrar la rejilla de datos estándar, se convierta en una ventana de contenido externo o un Dashboard personalizado altamente interactivo.

### 15.1 Modo Enlace (iFrame Externo)
Ideal para integrar herramientas externas (ej. Tableau, PowerBI, Wikis) directamente dentro del framework.
- **Configuración (`XFORMS`)**:
    - **`enlace`**: Ingresa la URL completa.
    - El sistema renderizará un `iframe` a pantalla completa eliminando la rejilla de datos.

### 15.2 Modo Ventana (Dashboard / Custom UI)
Permite crear interfaces completas usando HTML5 y JavaScript.
- **Configuración (`XFORMS`)**: `ventana = true`.
- **Contenido (`XGRID`)**:
    - **`cabecera`**: Código HTML y CSS.
    - **`ejecuta`**: Código JavaScript de inicialización e interactividad.

### 15.3 Ejemplo de Dashboard Premium Interactivo

**HTML (`cabecera`)**:
```html
<div class="dashboard-container">
  <div class="stats-grid">
    <div class="stat-card" id="card-revenue">
      <div class="stat-label">Ingresos Totales</div>
      <div class="stat-value" id="val-revenue">$ 0.00</div>
    </div>
  </div>
  <div id="activity-log"></div>
  <button id="btn-notify">Test de Alerta</button>
</div>
```

**JavaScript (`ejecuta`)**:
```javascript
// Los scripts se ejecutan al cargar la pestaña
setTimeout(() => {
    // 1. Inicializar datos dinámicos
    document.getElementById("val-revenue").innerHTML = "$ 48,250";
    
    // 2. Vincular eventos al DOM del dashboard
    const btn = document.getElementById("btn-notify");
    if (btn) {
        btn.onclick = () => {
            // Acceso a la API de Ghenesis
            ui.alert("Mensaje Emergente", "¡Esto funciona!", "success");
            ui.notify("Notificación enviada");
        };
    }
}, 300);
```

---

## 16. Modo Reporte (Banded Reporting - Estilo FastReport.js)

Ghenesis permite la integración de motores de reportes basados en bandas (Banded Reports) mediante la tabla `xreports`.

### 16.1 La tabla `xreports`
Este almacén de metadatos guarda la definición técnica del reporte:
- **`formato`**: Contiene el XML o JSON de la plantilla (ej: un archivo `.frx` de FastReport).
- **`ejecuta`**: Script que prepara el JSON de datos desde PostgreSQL antes de enviarlo al motor de renderizado.

### 16.2 Configuración del Módulo
Para que una pestaña de Ghenesis se comporte como un visor de reportes:
1. En `xforms`, marcar **`reporte = true`**.
2. Asociar el **`idreport`** correspondiente de la tabla `xreports`.

### 16.3 Capacidades del Visualizador (Viewer)
El componente `DynamicReport` detecta automáticamente este modo y ofrece:
- **Exportación Directa**: PDF, Excel, HTML.
- **Paginación Virtual**: Navegación por hojas.
- **Parametrización**: Posibilidad de inyectar filtros desde el script `ejecuta`.

### 16.4 Diseñador Integrado (Designer)
Habilitando el modo de diseño, el desarrollador (o usuario con permisos) puede manipular:
- **Páginas y Bandas**: Page Header, Column Header, Data Band, Group Footer.
- **Árbol de Datos**: Arrastrar campos del dataset JSON directamente al lienzo.
- **Guardado Automático**: Al presionar guardar, el metadato se actualiza en la tabla `xreports` sin necesidad de subir archivos manuales por FTP/SSH.
