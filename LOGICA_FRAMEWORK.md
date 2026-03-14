# Arquitectura de Metadatos y Lógica del Framework Ghenesis

Este documento define la estructura y el comportamiento del framework dinámico Ghenesis para su implementación en entorno Web.

Vamos a crear un llamado ghenesis en web
Es una aplicación web cuya estructura principal es:
- Un título de la aplicación 
- un menú izquierdo, con 5 elementos fijos: Programador, General, Operaciones, Reportes, Configuración (con submenús fijos: users, roles), Sistema (con submenús fijos: cambiar password, Cerrar sesión).
- Una área de pestañas al centro para el contenido principal, con la pestaña HOME por defecto donde se carga una imagen 
- Usa Lucide React para ponerle iconos a esos elementos fijos.
El framework trabaja con una base de datos en MYSQL, y toda la configuración se carga a partir de eso, por ejemplo para mostrar la página de inicio, existe la tabla 
XSISTEMA, con estos campos
Idsistema. Número Único
Titulo. Es el valor que se va a leer para ponerlo en la cabecera de la página web
Icono. String. sirve para mostrar icono en la pestaña del navegador. 
Imagen. String. Es un enlace que sirve para mostrar en la pestaña home
Theme. memo. sirve para definir variables globales desde donde vamos a leer para aplicar en los elementos. Por el momento aplicar un tema al título de la página principal. 

Menú principal.
El menú principal se crea dinámicamente sobre los elementos fijos a partir de la siguiente estructura. 
XFORMS. Tabla que uso para determinar menus y formularios de mi app
Idform. Numerico. Id del formulario
IdSistema. Numérico. Para relacionar con idsistema
cform. String. nombre corto del formulario
descripcion. String. descripcion larga (para displayar en el menu)
tipo. Integer. Se usa para ponerlo o agruparlo en las secciones fijas del menú: 0 (programador) 1 (general) 2 (operaciones) 3 (consultas) 4 (configuracion) 5 (sistema)
Idparent. Integer. para poder poner sub opciones en forma de arbol en el menu
iconform. Integer. icono fontawsome se relaciona con la tabla XICONS (ver más adelante)
Sactivate. MEMO. codigo script para cuando se activa el formulario
enlace. string. Si el formulario tiene este valor, abre directamente este enlace en la pestaña que le corresponde.
FormHeader. Memo. carga un diseño de formulario HTML en la cabecera de la pestaña
FormFooter. Memo. carga un diseño de formulario HTML en el pie de pagina de la pestaña .
Ventana. Boolean. Se usa para saber si ese formulario se va a cargar como pestaña o en una ventana emergente.
nroform. Integer. Lo uso para ordenar de arriba hacia abajo las opciones en el menu

upduser. campo que se actualiza cuando se hacen modificaciones (user)
upddate. campo que se actualiza cuando se hacen modificaciones (date)
updtype. campo que se actualiza cuando se hacen modificaciones (tipo: 0 agregar, 1, modificar, 2 borrar), nunca hago borrado fisico, primero marco con "2" si el registro esta borrado. 
Sclose. Memo. Codigo Script para cuando se cierra la ventana o pestaña mostrada.

XICONS. Es una tabla donde agrego por número mis iconos fontawsome
IdIcon. Integer. Número de icono
Nombre. String. Nombre que usa fontawsome para mostrarlo por ejemplo en mis menus.

Viene la parte más difícil de aplicar en el framework, yo necesito ejecutar scripts, 
Por ejemplo en esa misma base de datos donde está xform yo puedo tener una tabla llamada academia y otra cursos
Si creo un xform "registro de academias", en el sactivate quiero poder poner esto: 
Miconsulta="SELECT * FROM ACADEMIA"
Texto_en_pantalla=miconsulta[nombre]
O algo así. Asumiendo que texto_en_pantalla es un elemento creado con html

este script, que en el futuro puede ser más complejo se guarda en el campo sactivate y debe tener la capacidad de interpretar código en runtime (talvez usando JS o algún otro que sugieras) 

Siguiendo con este ejemplo ya debo estar en capacidad de cargar mi aplicación y ver una grilla de datos (usando ag grid desde el inicio) con los campos en información de esa tabla. 

Todo estos conceptos ya los tengo desarrollados y ejecutándose con Delphi y unigui pero sé que se pueden aplicar con opensource.
Dame sugerencias para mejorar el framework.

En un formulario pueden haber varios query, para ello también tengo la configuración de querys en una tabla llamada XQUERY. Y al abrir un formulario muestra por defecto el primer query, los otros en diferentes pestañas. Lo que hace es mostrar una grilla de datos y algunos botones para editar o eliminar registros. Esa tabla xquery es más potente aún porque tiene campos Memo para escribir los scripts de los eventos del dataset creado: open, save, scroll, insert, delete, etc. Además de la grilla cada vez que doy a editar se crea dinámicamente un formulario de edición con los campos que detallo en el siguiente punto.
- tengo una tabla xfields donde configuro los campos que se muestran en la grilla y en la pantalla de edición. Por supuesto tengo campos como título, posición, ancho, ayuda, script_al_cambiar_valor, tipo de dato, etc. Todas esas características se crean al abrir una pestaña con la grilla, pero luego se guardan en un diccionario dframe que lo uso para saber si ya está cargado y no demorar la próxima vez que se lo llama 

XGRID (Tabla que normalmente muestra una grilla de datos (AGGRID). cada xform puede tener uno o varios de estos)
Id.GRID . INTEGER. Identificador Unico
IDform.Integer.  Relacion con el Xform padre
nombre. string. nombre del grid 
mayusculas. boolean. Si el ingreso en los campos quiero que sea exclusivamente en mayusculas.
recnoedit. boolean. Campo logico que me indica si se puede editar directamente en la grilla (false) o en una pantalla que edita datos de un solo registro (true)
ocultabar. boolean. Campo logico que me permite ocultar la barra de herramientas que va en la parte superior de la grilla (add, edit, delete, refresh)
readonlyg. boolean. Campo logico que me dice si los datos son de solo rectura.
AltoFila. integer. Altura de las filas o registros.
rxpage. integer. numero de registros por pagina (para paginar en caso de tener muchos registros), si es cero se carga todo
VQUERY. string. Nombre fisico de la tabla con la que se relaciona el grid. sirve para hacer actualizaciones a la tabla en la bd.
nroframe. integer. numero de frame o grilla, lo uso para crear en ese orden las grillas en diferentes pestañas
SDelete. Codigo Script que me sirve para manejar el comportamiento en caso de Beforedelete de la tabla. en el sistema es un dataset que se llama "DATA" 
SDeletePost. Codigo Script que me sirve para manejar el comportamiento en caso de Afterdelete de la tabla. 
Sinsert. Codigo Script que me sirve para manejar el comportamiento en caso de Insertar un nuevo registro
Sopen. Codigo Script que me sirve para manejar el comportamiento en caso de abrir la tabla (data.open)
Snewrecord. Codigo Script que me sirve para manejar el comportamiento onnewrecord de la tabla. lo uso para datos por defecto
Sscroll. Codigo Script que me sirve para manejar el comportamiento en caso hacer scroll en la grilla o moverme por los registros
Scalcula. Codigo Script que me sirve para manejar el comportamiento en caso de Campos calculados
titulo. Titulo de la grilla (es una descripcion que le pongo al caption de la pestaña que muestra el modulo)
menuitems. Lista que uso para agregar opciones a un boton fijo que tengo en la barra de herramientas del modulo, por ejemplo (ver mas, enviar email, etc)
Smenuitem. Codigo que se usa para programar el comportamiento de cada elemento que se ha definido en el campo menuitems
FieldGroup. Campo por el cual puedo agrupar los datos que se ven en el unidbgrid
Ssave. Codigo Script que me sirve para manejar el comportamiento en caso de beforepost (antes de guardar)
SSAVEPOST. Codigo Script que me sirve para manejar el comportamiento en caso de Afterpost (despues de guardar)
upduser. campo que se actualiza cuando se hacen modificaciones (user)
upddate. campo que se actualiza cuando se hacen modificaciones (date)
updtype. campo que se actualiza cuando se hacen modificaciones (tipo, misma logica que en xforms y en todo mi sistema, todas las tablas tienen estos campos)
sdraw. Codigo Script que me sirve para manejar el comportamiento al hacer ondrawcolumncells del unidbgrid, esto me sirve para pintar filas segun algunas condiciones.
twoColumns. para mostrar los datos de edicion en una sola columna o en dos (en dispositivos moviles, siempre se muestra una sola columna)
masterdetail. string. Formato "key_master:key_detail". Define explícitamente la relación maestro-detalle (Ej: "idacademia:idcurso").

XFIELD (tabla que da personalizacion a cada campo de la grilla de datos)
idfield. Identificador unico.
idgrid. campo que relaciona con la grilla respectiva
campo. nombre del campo en la tabla fisica de la bd.
titlefield. titulo que tendra el campo en la columna (en la grilla) o como titulo en el form de edicion.
Cabeza. se pueden poner varios titlefield por una sola cabeza, por ejemplo debajo de cabeza="direccion" puede haber "via, descripcion, numero, referencia"
Ayuda. es un texto corto que se muestra en la parte inferior de la grilla para saber que es cada campo (como una descripcion larga)
color. color de la columna en la grilla de datos.
fontcolor. color de la letra de ese campo en la grilla
fontbold. valor logico que indica si la letra del campo se muestra en negrita.
alinear. string. I: izquierda, C: centro, D: derecha.
tipod: Tipo de dato que uso segun mi diseño de base de datos: trabaja con C: Caracter, D; Date, F: Float, I: Integer, B: Boolean, W: Memo
formato: Sobre todo en caso de los numeros me sirve para dar formato a como se visualizan ejemplo "#,#0.00"
valxdefecto. Valor inicial para el campo al insertar un registro. Soporta expresiones dinámicas:
- **Literales**: `100`, `'ACTIVO'` (cadenas entre comillas simples).
- **Funciones**: `date()` (fecha actual ISO), `time()` (hora actual HH:mm:ss), `user()` (datos del usuario logueado).
- **Interfaz**: `ui.header.id_elemento` (lee valor de un input en la cabecera).
- **Contexto**: `master.campo` (valor del registro padre).
- **Scripts**: `await api.get('/url').then(...)` (soporta promesas asíncronas).
valcombo. Valores del combo, esto lo uso para crear listas simples rapidamente, por ejemplo sexo: Masculino, Femenino. segun eso automaticamente el campo se crea de tipo combobox
datafield. string. Campo relacionado con la tabla xtable que se verá mas adelante.
oculto. Si necesito que el campo se cree pero esté en modo oculto. Esto lo oculta solo en la grilla
eoculto. Esto oculta el campo y su valor solo en el formulario de edicion.
readonly. si el campo es de solo lectura
TipoMemo. Lo uso para saber si el memo se abre en forms especiales que tengo para editar: 1: txt, 2: code scripting, 3: editor con formato (html), 4: SQL
totalizar. Si es true (usado en campos numericos), esa columna totaliza los valores en la parete inferior (summary)
SValida. Codigo script que me permite validar el comportamiento al cambiar valores del campo)
ancho. Ancho para mostrar en la grilla, un dni tiene diferente ancho de una descripcion y esta diferente ancho de un importe.
posicion. Posicion en la grilla. al crearlo dinamicamente lo abro order by posicion y los campos se crean en ese orden hacia la derecha en la grilla y en ese orden y hacia abajo en el form de edicion
Sortable. Campo logico que me permite determinar si al hacer click en el titulo de la columna los datos se van a ordenar, un nuevo click cambia el orden ascendente/descendente
calculado. Me permite definir campos calculados. si es true es porque el campo es calculado y sus valores lo controlo desde el script scalcula del xgrid.
locked. Cuando quiero que este bloqueado para edicion (es parecido a readonly) solo que lo uso en el form de edicion.
listfield. Lista de campos a mostrar, segun los xtable que veremos mas adelante.
xdataset. el nombre del dataset definido en los xtable (ver mas adelante)
obligatorio. Campo logocio con el cual indico si el llenado de un campo es obligatorio, Cuando no se llena se pinta de color rojo en el formulario de edicion.
sqlcombo. Es un script o sql directo que me permite obtener una lista desde la bd, por ejemplo, para el campo ciudad: "select nombre_ciudad from tciudades". Esto crea un campo unicombobox automaticamente
f9. Su valor string indica el nombre de algun xform que se abre al dar click en la lupa que se crea automaticaente en el campo, de esa manera puedo abrir otro form desde el campo, para no tener que cerrar y abrir modulos innecesariamente
noimport. Tengo programado un modulo que automaticamente hace importacion/exportacion de datos de la grilla a excel. este campo me sirve para indicar si no considera a este campo en el proceso
vunique. Valor logico para indicar si el campo es de valor unico como un dni, de esa forma al momento de guardar me advierte si se estan duplicando datos en esa columna
altomemo. En el formulario de edicion me permite darle personalizacion para ver en diferentes altos los campo memo que por defectotiene 3 lineas
agregar. Cuando es true, en el formulario de edicion aparece el edit con un boton + (para agregar)
noanymatch. Valor logico que lo uso para busquedas exactas en un combobox.
upduser. campo de actualizacion user
upddate. campo de actualizacion date
updtype. campo de actualizacion type

XREPORTS. Tabla donde se definen los reportes del sistema. Estos reportes se diseñan y crean con fastreport. Fastreport tiene la capacidad de guardar su diseño, eso va en el campo RFormato. Fastreport tambien puede conectarse a datasets y mostrar reportes, tablas, informes, maestro detalle, tarjetas, graficos, codigo de barras, etc. Todo ello lo genera y lo exporta a un pdf que es lo que el usuario ve finalmente
Id. Identificador unico del reporte.
number. Numero que lo uso para ordenar en un arbol que se visualiza desde el sistema.
Description. La descripcion del reporte o de la rama del arbol (en caso de ser padre de una categoria)
parent. Los reportes pueden tener padres, para definir estructura de categorias.
imageindex. icono (fontawsome) segun la tabla xicons, para mostrar con buen aspecto en el arbol desplegado
disabled. Cuando un reporte está desplegado.
codigo. Codigo script que se evalua antes de abrir el reporte
Title. Titulo del reporte (el que va a ir en la hoja)
consulta. Consulta o query que puede definirse
Rformato. Formato Fr3 en el que fastreport guarda el reporte diseñado (normalmente esto lo diseño con una aplicación de escritorio creada para ese fin)

XROLES (Tabla que define los niveles de acceso al sistema)
Idrole. Identificador único del rol.
Rolename. Nombre del rol (ej: ADMINISTRADOR, DEVELOPER).
Descripcion. Texto explicativo del alcance del rol.
Tipo. Integer. Define la jerarquía técnica de acceso:
- **0 (Developer)**: Acceso total, herramientas de programación y visualización de registros eliminados.
- **1 (Administrador)**: Gestión completa de usuarios y roles, visualización de registros eliminados.
- **2 (Usuario Final)**: Acceso restringido según la matriz de permisos.
- **3 (Invitado)**: Roles de solo lectura o acceso base.

## Otras tablas
Por otro lado tengo estas otras tablas:
XSISTEMA. Para configurar el nombre de la aplicación, el icono que se muestra en la web, los iconos para las categorias general, operaciones, reportes, config, system; un codigo inicial al hacer login
XEXPLORER	Es donde guardo el nombre de los archivos o files que sube el usuario, ya que a cualquier nivel de registro es posible adjuntar files, talvez esto es un poco peligroso o abrumador, dame sugerencias.
XFUNCTIONS	Scripts generales, funciones del engine, librerías personalizadas
XIDIOMA	Diccionario multilenguaje para traducciones dinámicas (estilo i18n)
XAUDIT	Registro detallado de cambios, antes/después, auditoría avanzada

## 1. Jerarquía de Componentes
La aplicación se construye de forma ascendente a partir de los metadatos almacenados en la base de datos:

1.  **Módulo (XFORMS)**: Nivel superior (Pestaña del Navegador/App).
2.  **Grilla (XGRID)**: Un módulo puede tener una o varias grillas.
3.  **Campo (XFIELD)**: Define las columnas de la grilla y los inputs del formulario.
4.  **Control (XCONTROLS)**: Elementos de UI adicionales (botones, etiquetas, etc.) a nivel de formulario.

## 2. Lógica de Renderización de Grillas (Master-Detail)

### 2.1 Clasificación por Jerarquía (`gparent`)
La propiedad `gparent` es el eje de la interfaz y los datos:
*   **Grillas Maestras (`gparent` es NULL)**:
    *   Se cargan inmediatamente al abrir el módulo.
    *   Si hay más de una grilla maestra en un `idform`, se muestran en un sistema de **Pestañas (Tabs)** superiores.
*   **Grillas Detalle (`gparent` NO es NULL)**:
    *   No se muestran al abrir el módulo.
    *   Aparecen **dentro del formulario de edición** de su grilla padre.
    *   Están anidadas visualmente debajo de los campos de edición.

### 2.2 Relación de Datos (Linking)
Para el filtrado y pre-población de datos en grillas detalle:
1.  **Prioridad Explícita (`masterdetail`)**: El sistema busca este campo en los metadatos de la grilla hija. Si existe y tiene el formato `key_master:key_detail`, usa `key_master` para leer el valor del padre y `key_detail` para filtrar el hijo.
2.  **Auto-Detection (Heurística)**: Si no hay configuración explícita, identifica la **Primary Key (PK)** del padre y busca coincidencia de nombre en el hijo.
3.  **Pre-población**: Al agregar un nuevo registro en el detalle, el campo de enlace se pre-llena automáticamente con la llave del maestro.

## 3. Comportamiento de Edición

### 3.1 Diccionario de Datos Dinámico
*   Al abrir una pestaña de edición, el sistema lee los `XFIELD` asociados a ese `idgrid`.
*   **Prioridad de Orden**: Los campos se ordenan por su posición (`posicion`).
*   **Visibilidad**: 
    *   `oculto = true`: Campo procesado pero no visible en la grilla.
    *   `eoculto = true`: Campo no visible en el formulario de edición.

### 3.2 Generación de Inputs
Los tipos de dato (`tipod`) se mapean automáticamente:
*   `C`, `I`, `F`: TextField (Texto o Númerico).
*   `B`: Checkbox.
*   `W`: Multiline TextField (Memo).
*   `D`: DatePicker.
*   `valcombo` o `sqlcombo`: ComboBox (Dropdown).

## 4. Motor de Scripting (Sandbox)
El framework permite ejecutar lógica personalizada en eventos específicos mediante JavaScript:
*   **Servidor (V8 Sandbox)**: Scripts de carga de datos (`sopen`), guardado (`ssave`, `ssavepost`) o activación de formulario (`sactivate`).
*   **Cliente (Runtime)**: Acciones inmediatas como validación de campos (`svalida`) o valores por defecto (`snewrecord`).

## 5. Auditoría Estándar
Todas las tablas de metadatos y datos físicos deben mantener los campos:
*   `upduser`: Nombre del usuario que realizó la última acción.
*   `upddate`: Fecha y hora de la modificación.
*   `updtype`: Estado del registro (0: Insertado, 1: Modificado, 2: Borrado Lógico).
