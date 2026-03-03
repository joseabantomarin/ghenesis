# Resumen del Proyecto Ghenesis

**Ghenesis** es un framework de aplicaciones empresariales basado en metadatos y un motor dinámico que interpreta la base de datos en tiempo real para construir la interfaz, reglas de negocio y lógica sin recompilar el núcleo.

## Componentes principales

- **Backend** (Node.js): API y motor principal que lee tablas de configuración y ejecuta scripts dinámicos. Se estructura bajo `backend/src` con controladores, servicios y middlewares.
- **Frontend** (Vite + React): Interfaz Material UI con pestañas dinámicas e integración con AG‑Grid. Ejecuta scripts en el cliente para validar, formatear y gestionar la UI.
- **Base de datos** (PostgreSQL): Contiene muchas tablas `X*` que definen formularios, grillas, campos, controles, consultas, reportes, etc.

## Arquitectura y funcionamiento

1. **Metadatos en tablas** (`XFORMS`, `XGRID`, `XFIELD`, `XCONTROLS`, etc.) describen el comportamiento y la apariencia de cada módulo.
2. **Hot Reload**: los cambios en la base de datos se reflejan inmediatamente en el cliente.
3. **Motor de scripting**: JavaScript aislado se almacena en campos como `sactivate`, `sdelete`, `sopen`, etc., para reaccionar a eventos (open, save, insert, scroll, etc.).
4. **Validaciones E2E** sincronizadas entre frontend y backend, con soporte de reglas como obligatorios, unicidad (`vunique`), mayúsculas, etc.
5. **UI inteligente**: `ui.setStyle` permite scripts cambiar estilos en tiempo real; controla iconos, botones, visibilidad y más.
6. **Datos dinámicos**: Tablas como `XTABLE` proveen datasets reutilizables para combos y filtros.
7. **Reportes**: Definidos en `XREPORTS` e implementados con FastReport, exportan a PDF según consultas y plantillas guardadas.
8. **Extras**: auditoría (`XAUDIT`), multilenguaje (`XIDIOMA`), archivos (`XEXPLORER`), consultas reutilizables (`XCONSULTS`), funciones (`XFUNCTIONS`).

## Objetivos y características clave

- Generación de UI a partir de metadatos.
- Ejecución de lógica `runtime` mediante scripts almacenados en la DB.
- Arquitectura modular con pestañas y submenús dinámicos.
- Capacidad para personalizar formularios, grillas y controles sin tocar código.
- Validación profunda y experiencia de usuario basada en Material UI.

## Mejoras recientes y funcionalidades avanzadas

A lo largo de las últimas actualizaciones el framework ha incorporado numerosas mejoras de estabilidad, UI y comportamiento metadata‑driven:

- **Estabilidad de Iconos y Menú**: filtros automáticos para campos calculados, iconos aleatorios por defecto, eliminación de FK entre `XFORMS` y `XICONS`.
- **Modo Mayúsculas Global**: forzado visual y transformación de entradas en grillas y formularios.
- **Master‑Detail optimizado**: el panel de detalle se oculta en edición y la grilla principal ocupa todo el alto.
- **Navegación con teclado mejorada**: flechas Arriba/Abajo guardan y mueven foco en edición de grilla.
- **Soporte para múltiples pestañas** con identificación única.

### Configuración de Sistema

- Creación del módulo `XSISTEMA` para ajustar parámetros globales (tema, atajos, logos, etc.).
- Mantenimiento completo en `XFORMS`, `XGRID` y `XFIELD` (id 111, sección Configuración).
- Atajos dinámicos controlados por `XSISTEMA.shortcuts` con logging y resolución de conflictos.

### Validaciones y Alertas

- Validaciones E2E sincronizadas (`obligatorio`, `vunique`) en backend (`saveGridData`) y frontend (`DynamicForm`).
- Alertas modernas con `AlertDialog` temático en lugar de `alert()`.
- Sistema visual de señalización: bordes maroon, animaciones de pulso y desenfoque en campos requeridos.

### Motor de scripting avanzado

- Sandbox seguro (`new Function`) con contexto `action`, `data`, `selected`, `grid`, `ui`, `api`, `runQuery`.
- Inyección de HTML dinámica (`cabecera`, `pie`) y puente `window.ghenesis.run` para disparar acciones desde DOM insertado.
- API backend `/api/dynamic/run-query` que sólo acepta `SELECT` y se expone a los scripts como `runQuery`.
- Control de UI con `ui.setStyle`/`ui.setLabel`; permite modificar etiquetas, colores, visibilidad y habilitado/deshabilitado.
- Interfaz de alertas profesional (`AlertDialog`) reemplaza `alert()` y se invoca con `ui.alert()` desde scripts.

### Formateo y datos

- Gestión de fechas estricta: conversiones a `DATE`, filtros inclusivos y editores de calendario.
- Motor de formateo numérico con máscaras Delphi/Pascal, alineación contable y soporte de prefijos/ sufijos.
- Soporte para totales de columnas (`totalizar` en `XFIELD`) con fila fija y estilo destacado.

### Hot Reload y renovación de metadatos

- Evaluación "al ingreso" de `XGRID`, `XFIELD`, `XCONTROLS` para reflejar cambios en caliente.
- Manejo robusto de campos `JSONB` en formularios/grillas.
- Limpieza de cabeceras dinámicas para evitar renders duplicados.

### Otros detalles

- Compatibilidad AG Grid (wrapper `setRowData`).
- Atajos  F2, mantenimiento de conflicto y cambios proactivos.
- Sistema de diseño de cabecer as con variables CSS (`--dynamic-header-*`).
- Optimización de espacio en pestañas, UI slim y densidad alta.
- Totalización automática y recálculo de columnas con filtros activos.

> El archivo `manual_script.md` ofrece un diccionario completo de objetos disponibles en los scripts, ejemplos de cabeceras HTML y pautas de estilo. Es la referencia obligada para extender el framework mediante metadatos.

## Estructura del repositorio

```
/ backend/         → servidor Node.js
/ frontend/        → aplicación cliente React/Vite
/ database/        → scripts SQL
/ backups/         → múltiples puntos de restauración históricos
README.md          → guía de instalación y conceptos
LOGICA_FRAMEWORK.md→ documentación detallada de metadatos
manual_script.md   → guía del motor de scripting
``` 

> Este proyecto es un motor completo para aplicaciones metadata-driven; se basa en PostgreSQL y Node/React, con un foco en flexibilidad y edición en caliente de formularios. El resumen anterior refleja los elementos esenciales que he identificado.