# VDH · Sistema No Compra

Registro y seguimiento de clientes que salen del local **sin encontrar la prenda
que buscaban**.

El vendedor carga el pedido desde el celular o la PC del local. El registro cae
en una planilla de Google Sheets, y Atención al Cliente hace el seguimiento
hasta contactar al cliente cuando la prenda aparece.

```
Vendedor en el local
      │  formulario web (se instala en el celular)
      ▼
  submitForm()  ──►  Google Sheets  ──►  Panel de seguimiento
      │               A-I + Z + AA       Atención al Cliente
      │                   ▲
      │                   │  el CRM avisa cuando la venta se cierra
      │                   │  y el backend escribe R, T y V solo
      │              Webhook.gs
      │                   ▲
      └──► Kommo ─────────┘
           lead + contacto + nota
```

## Las tres vistas

| Vista | URL | Para quién |
|-------|-----|------------|
| Formulario de carga | [`/`](https://mauriciocamara85-star.github.io/sistema-no-compra/) | Vendedores de los 14 locales |
| Panel de seguimiento | [`/panel.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/panel.html) | Atención al Cliente (pide PIN) |
| Configuración | [`/config.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/config.html) | Encargados: el equipo y el objetivo de cada local (sin PIN) |

Las tres se sirven desde GitHub Pages y se publican con un `git push`. Las URLs
viejas de Apps Script (`.../exec` y `.../exec?v=panel`) siguen andando:
redirigen acá.

## La planilla

La pestaña `No Compra`, dividida por dueño de cada columna:

**A–I · las carga el vendedor** desde el formulario

| Col | Campo | Obligatorio |
|-----|-------|-------------|
| A | Fecha | automático |
| B | Sucursal | Sí |
| C | Vendedor | Sí |
| D | Nombre Cliente | No |
| E | WhatsApp | Sí |
| F | Mail | No |
| G | Producto Buscado | No |
| H | Talle | No |
| I | Observaciones | No |
| **Z** | **Motivo** (por qué no se lo llevó) | Sí |

> **¿Por qué el motivo está en la Z y no pegado a Observaciones?** Porque las
> columnas W (`Orden`) e Y (`Total`) ya están ocupadas: el equipo tiene ahí una
> tablita aparte con los totales por mes. Insertar una columna en el medio
> habría corrido esa tabla y las fórmulas. La Z es la primera libre de verdad.
> El encabezado lo escribe solo el backend, la primera vez que entra un
> registro con motivo.

**J–V · las completa Atención al Cliente** durante el seguimiento

| Col | Campo | Col | Campo |
|-----|-------|-----|-------|
| J | Nos contactamos? | Q | Resultado 2do Contacto |
| K | Agregado al What | R | Estado Actual |
| L | Responsable Seguim. | S | Observaciones Seguim. |
| M | Fecha 1er Contacto | T | Compró? |
| N | Resultado 1er Contacto | U | Producto Final |
| O | Fecha 2do Contacto | V | Monto Venta ($) |
| P | Canal 2do Contacto | | |

> **Nunca escribir en J–V ni en W–Y a ciegas.** Son datos vivos que el equipo
> carga a mano. `submitForm()` escribe únicamente A–I y la Z.

**AA · la escribe el sistema**

| Col | Campo | Quién |
|-----|-------|-------|
| AA | Lead Kommo | `anotarLead_`, al crear el lead |

Guarda el id que devuelve el CRM. Es lo que le permite al webhook saber, el
día que la venta se cierre en Kommo, a qué fila corresponde. Va al final por
el mismo motivo que el Motivo: no correr nada de lo que ya estaba.

**Las tres excepciones a la regla de arriba** son `R`, `T` y `V`, que ahora
también las escribe el backend cuando Kommo avisa que el lead cambió de etapa
(ver *La vuelta del CRM*). El resto de las columnas del seguimiento siguen
siendo del equipo y nadie más las toca.

La fila de encabezados se busca sola (`getFilaEncabezado_`), así que el código
no se rompe si la tabla arranca en otra fila.

## Vocabulario del seguimiento

Los valores salen de lo que ya usa el equipo. El servidor rechaza cualquier
otro, para que el panel no ensucie la planilla.

| Campo | Valores |
|-------|---------|
| Nos contactamos? | `si` · `no` |
| Resultado 1er Contacto | `Respondió - interesado` · `Respondió - no interesado` · `No respondió` |
| Estado Actual | `En seguimiento` · `Esperando respuesta` · `Cerrado - compró` · `Cerrado - no compró` · `Descartado` |
| Compró? | `Sí - local` · `Sí - online` · `No` |
| Motivo | `Sin talle` · `Sin stock` · `Precio` · `No le gustó` · `Fue a comparar` · `Otro` |

El texto de cada botón del formulario es **exactamente** el que queda escrito en
la planilla. Si se cambia uno hay que cambiar los dos lados (`MOTIVOS` en
`index.html` y `VOCAB.MOTIVO` en `src/Codigo.gs`), o el servidor rechaza el
registro.

**Pendiente** no es un estado de la planilla: es el registro que todavía nadie
tocó (sin *Estado Actual* y sin *Nos contactamos?*). Los pendientes con 3 días
o más se marcan en rojo en el panel.

## Locales

Los mismos **14** que la app de [Ranking VDH](https://github.com/mauriciocamara85-star),
escritos igual que ahí (en mayúsculas, como vienen del consolidador de ventas)
para que algún día se puedan cruzar los no-compra con las ventas de cada local:

CASEROS · DOT · FLORES · GRAND BOURG · ITUZAINGÓ · LOMAS DE ZAMORA · MORÓN ·
PACHECO · PARQUE BROWN · RIVADAVIA · SAN JUSTO 1 · SAN JUSTO SHOPPING ·
UNICENTER · VILLA DEL PARQUE

> Los registros viejos tienen los nombres anteriores (`MD2 - Mar del Plata
> Rivadavia`, `SUN - Unicenter`, y cuatro locales que ya no están: San Martín,
> Quilmes, Laferrere y Lanús). Se dejaron como estaban, así que el Resumen por
> sucursal va a mostrar los nombres viejos y los nuevos como filas distintas
> hasta que se decida normalizarlos.

## Estructura

```
                     ── la interfaz, en GitHub Pages ──
index.html           Formulario del vendedor
panel.html           Panel de seguimiento
config.html          Equipo y objetivos de cada local
estilos.css          Sistema de diseño compartido (violeta, claro/oscuro)
comun.js             Backend, tema, avisos, WhatsApp, PWA
manifest.json        Para instalarla en el celular
sw.js                Para que abra sin señal
icon-*.png           Íconos de la app

src/                 ── el backend, en Apps Script ──
  Codigo.gs          Carga, seguimiento, avisos
  Config.gs          Equipo, objetivos e historial de cambios
  Respaldo.gs        Copia diaria de la planilla
  Resumen.gs         Arma la pestaña Resumen (sucursal/vendedor/producto/motivo)
  Kommo.gs           Puente con el CRM: cada no-compra entra como lead
  Webhook.gs         La vuelta: Kommo avisa la venta y se escribe R, T y V
  Redirect.html      Manda los links viejos de Apps Script al sitio
  appsscript.json    Manifiesto del proyecto
```

## Puesta en marcha

1. Subir `src/` a [Apps Script](https://script.google.com), con
   `.\publicar.ps1 "primera carga"` o pegándolo a mano. `Redirect.html` va como
   archivo **HTML**, no pegado dentro del `.gs`.
2. Cargar las tres propiedades en **Configuración del proyecto → Propiedades
   de la secuencia de comandos**:

   | Propiedad | Valor |
   |-----------|-------|
   | `SHEET_ID` | ID de la planilla |
   | `PANEL_PIN` | PIN de Atención al Cliente |
   | `NOTIFICAR_A` | mail que recibe el aviso (vacío = sin aviso) |

3. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **yo**
   - Quién tiene acceso: **cualquier usuario**

> Cada cambio del **backend** necesita una nueva implementación
> (`.\publicar.ps1` lo hace). Los cambios de **interfaz** no: salen con un
> `git push`.

## Kommo (CRM)

Cada no-compra puede entrar a [Kommo](https://kommo.com) como **lead + contacto**,
para trabajarlo desde el CRM y meterlo después en campañas. Vive en
`src/Kommo.gs` y está **apagado** hasta que se carguen dos propiedades más:

| Propiedad | Valor |
|-----------|-------|
| `KOMMO_SUBDOMAIN` | El pedacito de la dirección: en `vdh.kommo.com` es `vdh` |
| `KOMMO_TOKEN` | Token de larga duración (ver abajo) |
| `KOMMO_PIPELINE_ID` | Opcional: a qué embudo entran. Vacío = el principal |
| `KOMMO_STATUS_ID` | Opcional: a qué etapa de ese embudo. Vacío = la primera |

**El token** sale de Kommo: Ajustes → Integraciones → crear una integración
privada → pestaña *Claves y permisos* → **Generar token de larga duración**
(de 1 día a 5 años). Se muestra una sola vez. Va en las propiedades del
script, nunca en el repo: el repo es público y ese token da acceso de
escritura a todo el CRM.

**Puesta en marcha**, una vez cargadas las propiedades:

```
kommoDiagnostico()   lee la cuenta y escribe en el log los embudos, sus
                     etapas y los campos con sus ids. No cambia nada.
kommoCrearCampos()   crea los campos de lead que falten (Sucursal, Vendedor,
                     Producto buscado, Talle, Motivo). Escribe en Kommo.
kommoProbar()        manda un lead de prueba para ver que llegue.
```

**Qué se manda:** el lead se llama `No Compra · <producto>`, el contacto lleva
el teléfono en formato internacional (`+549…`, así Kommo unifica duplicados) y
el mail. Los datos estructurados van a campos personalizados **y** a etiquetas:

- `No Compra` · `<sucursal>` · `Motivo: <motivo>`

Las etiquetas son lo que hace útil esto para campañas: no necesitan
configuración previa —Kommo las crea sola— y permiten armar una audiencia de
"todos los que se fueron por falta de talle en Unicenter" desde el primer día.

Además, cada lead se lleva una **nota** con el registro entero —local,
vendedor, qué buscaba, talle, motivo, contacto y las observaciones que escribió
el vendedor—. Las observaciones no tienen campo propio y suelen ser lo que
explica el caso ("lo quería en negro", "vuelve el sábado"): en la nota entran
siempre, sin configurar nada, y quien trabaja el lead ve todo sin abrir la
planilla.

> **Kommo nunca tumba una carga.** La planilla es la fuente de verdad. Si el
> CRM está caído o el token venció, el registro se guarda igual y el error
> queda en el log (`sincronizarCrm_`). Lo que no llegó a Kommo no se reintenta
> solo: está en la planilla para resubirlo.

### Permisos: si cambiás lo que el script hace, hay que reautorizar

La app web corre con los permisos que aceptaste **la última vez que autorizaste
el proyecto**, no con los que el código necesita hoy. Cuando se sumó Kommo, el
código empezó a salir a internet con `UrlFetchApp` — un permiso que la
autorización vieja no incluía. Resultado: la fila se guardaba bien y Kommo
fallaba con *"No cuentas con el permiso para llamar a UrlFetchApp.fetch"*.

Por eso `appsscript.json` declara los permisos a mano en `oauthScopes`
(`spreadsheets`, `script.external_request`, `script.send_mail`) en vez de
dejar que Apps Script los deduzca: así quedan a la vista y no dependen de
cuándo se autorizó.

**Después de publicar un cambio que agregue permisos hay que reautorizar:**
abrir el editor, correr cualquier función a mano (`kommoDiagnostico` sirve) y
aceptar la pantalla de permisos. Hasta que no se haga, la app publicada sigue
con los permisos viejos.

El mail y Kommo se mandan **fuera del candado** de la planilla. Son llamadas a
servicios de afuera y pueden tardar segundos; adentro del candado, un Kommo
lento dejaba a los otros locales esperando para guardar.

**Si el puente se rompe, el panel lo dice.** Un token vencido corta los leads
en silencio y el log de Apps Script no lo mira nadie, así que el último error
queda guardado (`KOMMO_ULTIMO_ERROR`) y sale como un cartel arriba de los
números del panel, que es la pantalla que Atención al Cliente abre todos los
días. El cartel desaparece solo cuando vuelve a entrar un lead bien. Cuando el
puente está apagado a propósito —todavía sin token— no se muestra nada.

## Equipo y objetivos

Cada local carga su gente una vez desde
[`/config.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/config.html)
y el formulario le muestra a esa gente en un desplegable. Vive en dos pestañas
de la misma planilla, que se crean solas la primera vez:

| Pestaña | Columnas |
|---------|----------|
| `Equipo` | Local · Vendedor · Activo · Agregado · Por |
| `Objetivos` | Local · Período (`dia`/`semana`/`mes`) · Meta |
| `Log` | Fecha · Acción · Local · Detalle · Quién |

Una fila de `Objetivos` con el **local vacío** vale como objetivo por defecto
para todos los que no tengan el suyo.

En esa misma pantalla está ahora el **cambio de tema** (claro/oscuro). Vivía
en la esquina de las tres cabeceras y es algo que se toca una vez: su lugar
es al lado de la otra cosa que se guarda en este dispositivo, que es el local.

**Quién carga a la gente: la gente.** El que no está en la lista escribe su
nombre en la pantalla de carga, toca **Anotarme** y queda en la lista del
local —`agregarVend`, sin PIN—: del toque siguiente en adelante aparece en el
desplegable de todos los celulares de la sucursal, escrito siempre igual. Si
no hay señal no se pierde: el nombre entra igual cuando se envía su primer
registro (`sumarVendedor_`). Por eso `/config.html` ya no tiene un campo para
cargar vendedores a mano; lo único que queda de la gente ahí es poder leer
quiénes son y sacar a alguien, escondido atrás de un botón: con nombres que
se escriben solos, el día que entra un "Jaun" alguien tiene que poder
limpiarlo.

**Por qué el nombre igual sale de una lista:** "Mau", "mau" y "Mauricio" son
tres personas distintas para cualquier conteo. Escribirlo a mano es la
excepción —una vez, la primera—, no la forma de todos los días.

**Por qué esto no tiene PIN.** El panel sí lo tiene, porque ahí están los
teléfonos de los clientes. Acá hay nombres de vendedores y números de meta.
Una clave para algo que se hace una sola vez es la clase de fricción que ya
mató a este sistema una vez.

En lugar de una puerta hay un **historial**: la pestaña `Log` anota qué
cambió, quién y cuándo. Sacar a alguien no borra la fila, la marca inactiva —
así el rastro queda entero y se deshace volviéndolo a agregar. Es la
diferencia entre impedir el error y poder deshacerlo.

> **Escribir el nombre a mano nunca deja de ser posible.** "No estoy en la
> lista" es la última opción del desplegable y está siempre, aunque el local
> tenga la lista completa. Si entra alguien nuevo un sábado y el encargado no
> está, sin esa salida el local dejaría de registrar.

**Y ese nombre se agrega solo a la lista** cuando esa persona guarda su primer
registro (`sumarVendedor_`). Es lo que hace que el sistema se arregle solo: se
escribe una vez y del registro siguiente en adelante sale del desplegable, en
todos los celulares del local y escrito siempre igual — que es justamente lo
que hace falta para poder contar. En el `Log` queda como agregado *desde el
formulario*, para distinguirlo de lo que cargó alguien a mano.

> **Un nombre desactivado no se reactiva solo.** Si el encargado sacó a
> alguien de la lista y esa persona sigue cargando desde su celular, el nombre
> no vuelve: deshacerle la decisión en silencio sería peor que el problema que
> resuelve. Para volver a habilitarlo está el botón de configuración, que es
> una persona decidiendo.

La lista se guarda en el celular y se refresca de fondo. No es una
optimización: es lo que sostiene que el formulario ande con el WiFi del
shopping caído. Sin señal usa la última que vio; si nunca hubo, se escribe a
mano.

**La grilla de los 14 locales se muestra una sola vez.** Con el local ya
elegido, abrir "Cambiar" lleva directo al desplegable de vendedores: el que
entra ahí viene a corregir su nombre, y hacerlo pasar otra vez por una pared
de catorce sucursales que ya contestó es tiempo perdido. Cambiar de local
sigue siendo posible desde la línea al pie de ese bloque.

## La vuelta del CRM

Hasta acá el camino era de ida. El resultado —si el cliente al final compró y
por cuánto— dependía de que alguien lo escribiera a mano en la planilla, y de
93 registros se completó en **9**. Por eso la tarjeta de "Recuperado" mostraba
cero aunque hubiera ventas.

Ahora Atención al Cliente trabaja **sólo en Kommo**, y cuando mueve el lead de
etapa el CRM avisa al backend, que escribe en la planilla:

| Etapa en Kommo | Qué escribe |
|----------------|-------------|
| `Closed - won` | `R` Cerrado - compró · `T` Sí - local · `V` el Presupuesto del lead |
| `Closed - lost` | `R` Cerrado - no compró · `T` No |
| `En seguimiento`, `Esperando respuesta`, `Descartado` | `R` con ese mismo valor |
| `Sin contactar`, `Leads Entrantes` | nada: es un registro que todavía nadie tocó |

Las etapas se traducen **por nombre, no por id**: están calcadas del
`VOCAB.ESTADO` de la planilla desde que se armó el embudo, y los ids cambian
en cada cuenta de Kommo. Las dos que Kommo no deja renombrar (`Closed - won` y
`Closed - lost`) tienen su traducción escrita en `ETAPAS_TRADUCIDAS`.

**Puesta en marcha**, una sola vez:

1. Desde el editor de Apps Script, correr **`urlWebhook()`**. Genera el token
   y escribe en el log la dirección completa.
2. En Kommo: **Ajustes → Integraciones → Sistema No Compra → Webhooks**, pegar
   esa dirección con el evento **"Estado del lead cambiado"**.

> **Por qué el token va en la dirección.** Los webhooks de Kommo no mandan
> encabezados propios, así que no hay otro lugar donde poner una clave. La app
> web está publicada como `ANYONE_ANONYMOUS` —tiene que estarlo para que la
> usen los locales—, o sea que sin token cualquiera que adivine la dirección
> podría marcar ventas falsas. Vive en las propiedades del script, nunca acá.

**Dos cuidados que tiene el código:**

- **Un aviso sin monto no pisa el importe.** Si el lead se cierra con el
  Presupuesto en cero, la columna `V` se deja como estaba: escribir un cero
  encima de un importe cargado a mano sería destruir el único dato que
  justifica el sistema.
- **Local u online no se puede distinguir por etapa.** Kommo no deja tener dos
  "ganado" ni renombrar los suyos, así que toda venta cerrada entra como
  `Sí - local`, que es el caso de este sistema. Si fue online se corrige a
  mano en la planilla.

**Cómo se ubica la fila.** Por el id del lead guardado en la `AA`, que es
exacto. Los registros cargados antes de que existiera esa columna no lo
tienen: ahí se le pregunta el teléfono a Kommo y se comparan los últimos 8
dígitos, porque la planilla guarda `2234979871` y Kommo `+5492234979871`.

## El tablero del local

El formulario es un tablero, y el orden es el mismo en el celular y en la PC:

```
Hoy en Rivadavia                            domingo 20 de septiembre
[ Registros hoy ]  [ Este mes ]  [ Recuperado este mes ]
[ 1 El cliente  ]  [ 2 Qué buscaba ]  [ 3 Por qué se fue ]
[ El equipo ───────────────────────────────────────────── ]
Se guarda en la planilla…                        [ Guardar ]
```

Los números son **del local que está cargando** y salen de
`{"accion":"metricas","local":"RIVADAVIA"}`, que no pide PIN por el mismo
motivo que el equipo y los objetivos: son cuentas del propio local, no hay un
dato de ningún cliente adentro.

**En la PC entra todo sin scrollear, y eso manda sobre el resto de las
decisiones.** Por eso los tres pasos van uno al lado del otro y no apilados
—apilados el formulario mide 550px y con las tarjetas arriba no entra en una
notebook—, por eso la barra de guardar deja de ser fija y se planta al final,
y por eso hay tres escalones de compactado por alto de ventana (960, 730). El
último saca texto de ayuda, nunca datos: ninguna tarjeta pierde su pie.
Medido: entra entero de 660px de ventana para arriba.

En el celular es una sola columna y el orden lo fija `order`, no el html: la
caja `.col-form` se deshace con `display:contents`.

| Tarjeta | De dónde sale |
|---------|---------------|
| Registros hoy | Columnas A y B: los del local con fecha de hoy |
| Este mes | Lo mismo, del 1° a hoy. El pie muestra el total histórico |
| Recuperado este mes | Columnas T (`Compró?`) y V (`Monto Venta ($)`) |
| El equipo | Columna H (`Vendedor`), contada por persona, más la lista de la pestaña `Equipo` para que aparezcan también los que este mes todavía no cargaron |

Las tarjetas son de **otro material** que los paneles del formulario: violeta
oscuro en los dos temas, como el rail. Antes usaban el mismo `--surface` que
los pasos y sólo se diferenciaban por el tamaño. La regla que queda se ve sin
explicarla —lo que es tablero (la navegación y los números) es oscuro, la hoja
donde se trabaja es clara— y de paso no le roba el violeta lleno al botón de
guardar, que es lo único que se toca. Los tokens de texto se redeclaran dentro
de `.kpi`: los `--txt` normales están pensados contra `--bg`.

**El objetivo no tiene tarjeta propia.** La tenía, y contra un objetivo diario
decía exactamente lo mismo que "Registros hoy" en la tarjeta de al lado: dos
veces el mismo número, uno con barra y otro sin. Ahora la meta de la pestaña
`Objetivos` se le pega a la tarjeta del período que mide —el día, la semana o
el mes— y la barra aparece ahí (`conObjetivo()`).

> **La tarjeta de plata depende de que alguien cierre el círculo.** T y V las
> llena Atención al Cliente a mano durante el seguimiento. Si nadie las
> completa, el local puede haber cargado cien clientes y la tarjeta va a decir
> cero. Por eso el pie dice *"sin ventas cargadas todavía"* en vez de un `$ 0`
> pelado, que se lee como que el sistema no sirvió.

El recuperado se corta por la **fecha del registro**, no por la de la venta:
la planilla no guarda cuándo se cerró la compra. "Recuperado este mes" quiere
decir *de lo que se registró este mes, esto ya volvió*.

Los números se guardan en el celular igual que el equipo, así el que abre la
app sin señal ve los últimos en vez de cuatro rayitas, y el registro recién
cargado se suma en el acto sin esperar al servidor (`sumarAlTablero()`).

Del lado del backend hay una **caché de 30 segundos por local**: son 14 locales
abriendo el formulario todo el día y cada apertura lee la planilla entera.
`submitForm()` borra la del local que acaba de cargar (`olvidarMetricas_`),
así el vendedor ve su número subir y no el de hace medio minuto.

> Los registros viejos tienen los nombres anteriores de los locales
> (`MD2 - Mar del Plata Rivadavia`), así que no entran en la cuenta de
> `RIVADAVIA`. Es el mismo corte que ya tenía el Resumen por sucursal.

## La navegación

Las tres pantallas comparten un solo rail (`.rail` en `estilos.css`), con el
mismo marcado y dos formas: columna a la izquierda arriba de 900px —la PC del
local, donde la app queda abierta todo el día— y barra abajo en el celular, al
alcance del pulgar. En 380px de ancho una columna lateral le come el lugar a
los campos, y los vendedores cargan parados en el local.

Parado es un **panel oscuro flotante** con la marca arriba, las secciones en
el medio y, en el formulario, quién está cargando abajo de todo. Es oscuro en
los dos temas y tiene sus propios tokens (`--rail-bg`, `--rail-txt`): en un
tablero la navegación es el marco y el contenido es la hoja, y un marco
oscuro contra una hoja clara es lo que hace que la hoja se lea como la hoja.

El hueco que el rail le reserva al contenido lo pone `body.hay-rail`, no un
grid: la cabecera pegajosa y la barra de guardar viven afuera del `.marco` y
tienen que correrse igual. El panel de seguimiento se pone esa clase recién
cuando alguien pasa el PIN, porque hasta ahí no hay rail.

En el formulario, arriba de 900px la cabecera **desaparece entera**: la marca
está en el rail, la identidad también y el tema se mudó a Configuración. Son
61px que le hacían falta al formulario para entrar completo arriba del botón,
sin scrollear, en la PC del local. Las otras dos pantallas la conservan: ahí
adentro hay cosas que no están en el rail (quién configura, actualizar,
salir).

### Quién está cargando

Dos datos con dos tratos distintos:

- **El local** se elige una vez por dispositivo, son 14 y no entran cómodos en
  un desplegable: es lo único que abre un bloque (`#bloqueLocal`), y al elegir
  se cierra solo.
- **El vendedor** cambia todo el tiempo, así que su desplegable está SIEMPRE
  puesto y elegir un nombre *es* el cambio: no hay que abrir, buscar ni
  confirmar nada. La última opción de la lista abre el campo de texto, para el
  que todavía no está en el equipo del local.

El control existe dos veces —adentro de la barra de identidad en el celular y
abajo del rail en la PC, `.quien`— porque el navegador no mueve un nodo de un
lado al otro. Lo que manda no es el html sino la variable `vendedor`;
`pintarQuien()` sincroniza las dos copias y `fijarVendedor()` es el único
lugar donde se guarda.

En el celular la barra de guardar se apoya **arriba** del rail acostado. El
aire de seguridad del iPhone lo reserva el rail, que es el que toca el borde;
si lo reservaran los dos quedaría un escalón vacío entre las dos barras.

## Respaldo automático

`instalarRespaldo()`, una vez desde el editor. Deja una copia diaria de la
planilla a las 4 de la mañana en la carpeta `Respaldos · No Compra` del Drive,
conservando las últimas 14 — dos semanas, que alcanzan para notar un desastre
y volver atrás. Se apaga con `quitarRespaldo()`.

> Un respaldo que falla en silencio es **peor** que no tener respaldo, porque
> da tranquilidad falsa. Cada corrida deja su resultado en las propiedades del
> script y el panel lo muestra, igual que muestra el estado de Kommo.

Necesita dos permisos que el resto del sistema no usa —Drive y disparadores—,
así que la primera vez va a pedir autorización. Ver *Permisos* más arriba.

## Versión visible

El pie del formulario muestra su versión (`v2026.09.20`) y el backend devuelve
la suya con `{"accion":"version"}`. Cuando alguien dice *"a mí no me anda"*,
comparar las dos dice si ese celular tiene la app vieja cacheada. Las dos se
suben a mano al publicar: `VERSION` en `index.html` y en `src/Codigo.gs`.

## Antes de usarlo, cargar el PIN

`PANEL_PIN` está vacío. Mientras lo esté, **el panel no le devuelve datos a
nadie**: cualquier PIN que se ingrese va a fallar. El panel avisa exactamente
eso en vez de decir "PIN incorrecto", que era lo que decía antes y mandaba a
probar números para siempre.

## Configuración fuera del repo

El repo es **público**, así que el ID de la planilla, el PIN del panel y el mail
de avisos no viven acá: se guardan en las propiedades del script. Así el código
se puede compartir sin exponer a qué planilla apunta ni cómo entrar al panel.

## Sobre el acceso al panel

La aplicación está publicada con acceso **anónimo**: cualquiera con el link
entra. Eso es lo que permite que los vendedores carguen sin cuenta de Google,
pero significa que el panel — que muestra teléfonos y mails de clientes — queda
detrás de un PIN y nada más. El PIN se verifica en el servidor en cada llamada,
y sin PIN configurado el panel no devuelve datos.

Si más adelante Atención al Cliente tiene cuentas de Google Workspace, conviene
separar el panel en una segunda implementación con acceso restringido a esos
usuarios. Es el camino más sólido.

## Versionado

Para sincronizar desde la terminal en lugar de copiar y pegar, ver
[docs/clasp.md](docs/clasp.md).
