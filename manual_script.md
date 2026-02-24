# Manual de Scripting Engine - Ghenesis Framework

Este manual describe cómo utilizar el motor de scripts dinámicos para personalizar el comportamiento y la apariencia de las grillas y formularios mediante metadatos.

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
| `ui` | Bridge de Interfaz | `ui.alert()`, `ui.setStyle()`, `ui.setLabel()` |
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

## 4. Ejemplos Prácticos

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

### C. Capturar Eventos desde HTML Personalizado
En el campo `cabecera` de `XGRID`:
```html
<button onclick="window.ghenesis.run('MI_ACCION')">Mi Botón</button>
```
En el campo `ejecuta` de `XGRID`:
```javascript
if (action === 'MI_ACCION') {
    ui.alert("¡Éxito!", "Acción disparada desde HTML personalizado", "success");
}
```

---

## 5. Tips de Desarrollo
1.  **Nombres de Campos**: Usa siempre el nombre físico de la columna en minúsculas (ej: `fila.idusuario`).
2.  **Depuración**: Usa `console.log(selected)` para ver la estructura de los datos en la consola del navegador (F12).
3.  **Encadenamiento**: Puedes llamar a múltiples `ui.setStyle` en la misma ejecución para reconfigurar toda la pantalla.
