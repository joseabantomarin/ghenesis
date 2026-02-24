# Estrategia de Diseño y Temas - Ghenesis Framework

Este documento define la lógica y los lineamientos que el asistente de IA debe seguir al momento de modificar el aspecto visual del framework. El objetivo es mantener siempre un estándar premium, profesional y coherente.

## Prompt Maestro de Personalización

Cuando se requiera cambiar el tema visual para un nuevo cliente o identidad de marca, utiliza el siguiente comando:

> "Aplica una paleta de colores profesional basada en el logo del cliente **verde+amarilo+naranja**. No uses los colores puros ni satures la vista; aplica un **promediado cromático** (armonía análoga) para que la transición entre los elementos de la interfaz sea fluida y profesional."

## Reglas de Oro del Diseño Ghenesis

1. **Jerarquía Cromática Profunda**:
   - **AppBar (`--primary-color`)**: Debe usar el tono más oscuro y sólido de la paleta. Es el ancla visual del sistema.
   - **Cabeceras (`--grid-header-bg`)**: Debe usar un tono medio que sea "primo hermano" del color del AppBar. La transición debe sentirse como un degradado natural, no como un cambio de color brusco.

2. **Higiene y Aire Visual**:
   - **Fondos de Menú (`--fondo-menu`)**: Nunca uses colores saturados. Debe ser una versión extremadamente lavada (casi blanca o gris muy tenue) que herede apenas un matiz de la paleta principal. Esto evita que la aplicación se sienta "pesada" o antigua.
   - **Selección de Filas**: Usa el color de acento con una opacidad muy baja (máximo 8-10%) para no dificultar la lectura del texto.

3. **Coherencia en Formularios**:
   - Los títulos de los inputs (`Labels`) deben usar el color de la cabecera de la grilla para que el usuario sienta que el "Modo Edición" es una extensión de la grilla de datos.
   - Tipografía siempre en negrita (`bold`) para los labels, asegurando legibilidad inmediata.

4. **Navegación Fluida**:
   - El color de la pestaña activa (`--active-tab-color`) debe coincidir con el de las cabeceras de la grilla para crear un hilo conductor visual desde la pestaña hasta los datos.

## Matriz de Variables de Referencia (CSS)

Cualquier cambio de tema debe actualizar estas variables en `theme.css`:

| Variable | Propósito | Estrategia de Color |
| :--- | :--- | :--- |
| `--primary-color` | AppBar y Botones Principales | Oscuro, Sólido, Corporativo. |
| `--grid-header-bg` | Cabeceras AG Grid y Labels | Medio, Armónico con el primario. |
| `--active-tab-color` | Pestaña seleccionada | Igual a `--grid-header-bg`. |
| `--fondo-menu` | Fondo lateral (Drawer) | Ultra-claro (Soft tint). |
| `--letra-menu` | Texto del menú | Gris muy oscuro con matiz del primario. |
