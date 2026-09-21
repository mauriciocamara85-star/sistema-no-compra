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

## Las cinco vistas

| Vista | URL | Para quién |
|-------|-----|------------|
| Formulario de carga | [`/`](https://mauriciocamara85-star.github.io/sistema-no-compra/) | Vendedores de los 14 locales |
| Panel de seguimiento | [`/panel.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/panel.html) | Atención al Cliente (pide PIN) |
| Motivos | [`/motivos.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/motivos.html) | Compras: por qué se va la gente, qué producto y qué talle faltó (sin PIN) |
| Resultados | [`/resultados.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/resultados.html) | Todos: si el sistema está sirviendo — cuánto se carga, cuánto se sigue y cuánto vuelve (sin PIN) |
| Configuración | [`/config.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/config.html) | Encargados: el equipo y el objetivo de cada local (sin PIN, salvo el aviso por mail) |

Las cinco se sirven desde GitHub Pages y se publican con un `git push`. Las URLs
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
motivos.html         Por qué se va la gente sin comprar (Compras)
resultados.html      El embudo del sistema: cargado → contactado → cobrado
config.html          Objetivos de cada local, el general y el aviso por mail
estilos.css          Sistema de diseño compartido (violeta, claro/oscuro)
comun.js             Backend, tema, avisos, WhatsApp, PWA
manifest.json        Para instalarla en el celular
sw.js                Para que abra sin señal
icon-*.png           Íconos de la app

src/                 ── el backend, en Apps Script ──
  Codigo.gs          Carga, seguimiento, avisos
  Config.gs          Equipo, objetivos, aviso por mail e historial de cambios
  Motivos.gs         Cuenta los motivos, y qué producto y talle faltaron
  Resultados.gs      El embudo: cuánto se carga, se sigue y se cobra
  Telegram.gs        El aviso por Telegram, con botón de WhatsApp
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

   Hay una cuarta, opcional: `DESDE`, la fecha desde la que cuentan los
   números. Ver [Desde cuándo cuentan los números](#desde-cuándo-cuentan-los-números).

   `NOTIFICAR_A` y `DESDE` son las dos que además se pueden cambiar desde
   `/config.html` con el PIN del panel, sin abrir Apps Script.

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

## El aviso por Telegram

Cada no-compra cae en un **grupo de Telegram**, con un botón abajo del mensaje
que abre el chat de WhatsApp con el cliente.

**Por qué, además del mail.** El mail del local no lo mira nadie; Telegram
suena en el celular en el momento, que es cuando el cliente todavía está a
tiro de un mensaje. Va a un grupo y no a una persona: Atención al Cliente
entra y sale sin que haya que tocar la configuración, y el que se suma ve lo
que pasó antes.

**No lo reemplaza.** Son dos avisos independientes: con `NOTIFICAR_A` vacío no
hay mail, sin `TELEGRAM_TOKEN` o `TELEGRAM_CHAT` no hay Telegram. Se pueden
tener los dos, uno o ninguno.

| Propiedad | Valor |
|-----------|-------|
| `TELEGRAM_TOKEN` | el que devuelve @BotFather |
| `TELEGRAM_CHAT` | id del grupo (negativo) o de la persona |

Se configura desde `/config.html` con el PIN, en dos pasos, porque **nadie
sabe de memoria el `chat_id` de un grupo**: se pega el token, se toca *Buscar
el grupo* y se elige por nombre. Al guardar **manda un mensaje de prueba**, y
si no sale no guarda nada: enterarse de que el aviso está roto cuando un
cliente no recibió el llamado es tarde.

> **Las dos trampas de `getUpdates`.** La primera: Telegram sólo devuelve los
> mensajes de las últimas 24 horas, así que sin uno reciente la lista vuelve
> vacía aunque el bot esté bien puesto. La segunda, peor porque no se ve: con
> el **modo privacidad** —prendido de fábrica— una mención con `@` puede no
> llegarle nunca al bot. Por eso la pantalla pide un **comando con barra**
> (`/start@el_bot`), que le llega siempre. También quedó afuera por defecto
> `my_chat_member`, el evento de "agregaron el bot al grupo": hay que pedirlo
> con `allowed_updates`, y sólo sirve para los grupos donde el bot entra
> después de haberlo pedido.

> **Si igual no aparece**, `telegramDiagnostico()` desde el editor separa las
> cuatro causas —token, webhook, privacidad o sin mensajes— e imprime cuál es.
> Con el id que devuelve, `telegramUsarChat(id)` deja todo andando sin pasar
> por la pantalla.

**El token no vuelve nunca al navegador.** `getConfig` dice si hay uno puesto
y a qué grupo llega, no cuál es — el mismo criterio que el de Kommo. Y el
último error queda guardado (`TELEGRAM_ULTIMO_ERROR`) para que la pantalla
pueda decir que un aviso dejó de salir.

No hace falta reautorizar el proyecto: `script.external_request` ya estaba
declarado desde que existe el puente con Kommo.

## Corregir lo que cargaste mal

Abajo del formulario está **"Lo último que cargaste"**: los últimos tres
registros de esa persona, con un botón que los trae de vuelta al mismo
formulario para arreglarlos. Dura **24 horas** (`CORREGIR_HORAS`).

**Por qué no hay una búsqueda.** El vendedor corrige lo suyo y reciente,
nunca una lista. Si esta pantalla pudiera buscar, los teléfonos de todos los
clientes saldrían de atrás del PIN sin que nadie lo decida: el backend es
anónimo y el nombre de cualquier vendedor se saca de la lista del local, que
tampoco pide PIN.

**Por eso el servidor no devuelve nada.** El celular se acuerda de lo que él
mismo mandó —la fila y la fecha que le contestó `submitForm`— y guarda eso en
`nc_ultimos`. `corregirRegistro` **sólo escribe**: su respuesta no incluye el
contenido de la fila ni siquiera con el cambio ya hecho. No se agregó ninguna
forma nueva de leer datos de clientes.

Para tocar una fila tienen que coincidir **cuatro cosas** —número de fila,
fecha exacta, local y vendedor— y ser de las últimas 24 horas. No es un
candado, porque quien quiera ensuciar la planilla ya puede hacerlo con
`submit`; es lo que convierte el vandalismo a ciegas en algo que hay que
acertar.

**Sólo se reescriben las columnas del vendedor** (D–I y la Z del motivo). La
fecha, el local y el nombre de quien cargó quedan como estaban, y J–V —el
seguimiento de Atención al Cliente— no se tocan nunca.

**La lista es de cada persona, no del aparato.** El celular del local lo usan
todos: se muestra sólo lo que cargó el vendedor que está seleccionado ahora.

**El CRM se entera** (`kommoCorregir_`). Si el teléfono estaba mal y sólo se
arreglara la planilla, Atención al Cliente igual llamaría al número viejo,
porque llama desde Kommo. Se actualiza el contacto (teléfono, mail, nombre),
los campos del lead (producto, talle, motivo) y queda una nota con lo que
cambió. Acá **sí** se pisa el contacto, al revés de lo que hace `kommoEnviar_`
con un cliente que ya existía: allá el dato viejo puede estar mejor que lo que
anotó un vendedor apurado; acá el vendedor está diciendo "me equivoqué".

Una corrección **no se encola** si no hay señal. Lo que está en la planilla es
lo que se cargó la primera vez, que no está roto: es mejor reintentar que
dejar una cola de correcciones pisándose sobre la misma fila.

## Resultados: ¿esto está sirviendo?

`/resultados.html`. Es la única pantalla que mide **al sistema** y no a los
clientes: si la cadena —cargar, contactar, cerrar— se completa o se corta en
el medio.

**El número que la hizo existir.** La primera vez que se usó quedaron **139
registros cargados y 8 con seguimiento hecho**. Nadie lo supo hasta que
alguien los contó a mano, meses después, y para entonces el sistema ya estaba
muerto. El agujero no era que los vendedores no cargaran: era que lo cargado
no se trabajaba y **ninguna pantalla lo decía**.

Por eso el embudo tiene cuatro escalones y no uno:

| Escalón | Quién lo mueve |
|---|---|
| Cargados | los vendedores |
| Contactados | Atención al Cliente ← *acá se cortó* |
| Compraron | el cliente que volvió |
| Recuperado | cuánta plata |

**Cada escalón se mide contra lo CARGADO**, no contra el anterior: lo que
importa no es qué tan bien viene cada tramo por separado, sino cuánto del
total original sobrevive hasta el final. Un "18 de 20 contactados" se ve
sano; "18 de 139" es lo que pasó de verdad.

**Si se contactó menos de la mitad, ese escalón se pinta en rojo.** Es el
síntoma exacto que mató al sistema la primera vez, y tiene que gritar.

Arriba de todo, lo único que pide una acción: **cuántos clientes están
esperando que nadie llamó**, cuántos hace más de 3 días y hace cuánto el más
viejo, con el link al panel. El resto de la pantalla informa; ese bloque pide.

**Abierta, sin PIN y sin modo supervisor**, por decisión de Mauricio: quiere
que las vea todo el mundo, incluidos los vendedores. Y se puede, porque son
conteos, porcentajes y totales en pesos — ningún dato de ningún cliente.

## Motivos: por qué se va la gente

`/motivos.html`, cuarto ítem del rail. Es la **única pantalla que no le sirve
al local: le sirve a Compras.** El local ya sabe lo que le faltó hoy; lo que
nadie sabía es qué le falta a la cadena entera, y eso es lo que decide qué se
compra el mes que viene.

Tres bloques:

| Bloque | Contesta |
|---|---|
| **Por qué se fueron** | el ranking de motivos con su porcentaje. Tocar uno filtra lo de abajo |
| **Qué faltó** | los productos y los talles más pedidos, del motivo elegido o de todos |
| **Por local** | dónde se está yendo la gente y por qué en cada uno (sólo en la vista general) |

**Arranca en la cadena entera, con un selector para bajar a un local.**
Compras toma dos decisiones distintas y necesita las dos vistas: *qué compro*
se contesta con el total de la cadena, *a dónde lo mando* se contesta por
local. El general va por defecto porque es la decisión más cara.

**No pide PIN.** Acá no hay un dato de ningún cliente: hay motivos, productos
y talles contados. Es el mismo criterio del tablero del local. El PIN sigue
cuidando lo único que hay que cuidar, que es la lista con los teléfonos. Por
eso tampoco va adentro de Configuración, que además es donde se *cambian*
cosas y esto es donde se *mira*.

**Dice cuántos registros quedaron afuera.** Los que no tienen motivo cargado
se cuentan aparte y la pantalla lo aclara al pie, junto con la fecha desde la
que cuenta. Un porcentaje calculado sobre la mitad de los registros, sin decir
de qué mitad, es peor que no tener el número.

**Los talles se parten con criterio:** `S / M` y `s, m` son dos talles, pero
`95/100` es uno solo. Se corta por coma, o por barra **con espacios a los
lados** —que es como los junta el formulario—; una barra pegada es parte del
talle, que es como se venden los cinturones (`partirTalles_`).

Va a abrir vacía las primeras semanas y eso está previsto: el estado vacío
explica desde cuándo se cuenta y qué lo llena, en vez de decir "sin datos".

## Desde cuándo cuentan los números

El sistema se usó unas semanas entre abril y julio de 2026 y se dejó de usar:
quedaron **139 registros de los que apenas 8 tuvieron seguimiento**, casi
ninguno con motivo cargado —la columna es posterior— y con los nombres viejos
de los locales. Contarlos junto con los nuevos no informa nada: los
porcentajes de Motivos los dominarían filas vacías y el panel abriría con 131
"pendientes" de abril que ya no tiene sentido llamar.

Por eso hay una **línea de arranque** y lo anterior no se cuenta. **Nada se
borra:** las filas viejas siguen enteras en la planilla, con su seguimiento y
su plata. Es un filtro de lectura y se deshace cambiando una fecha.

Se aplica en todo lo que cuenta o lista: las tarjetas del local, el ranking
del equipo, la pantalla de Motivos y la lista del panel.

| Dónde vive | Qué pasa |
|---|---|
| Propiedad `DESDE` sin cargar | rige `ARRANQUE_POR_DEFECTO` (`src/Codigo.gs`), la fecha del primer día |
| `DESDE` con una fecha (`2026-09-21`) | cuenta de ahí en adelante |
| `DESDE` **en vacío** | cuenta todo, incluida la etapa vieja |

Se cambia desde `/config.html` con el PIN del panel, **sin publicar**: la
fecha real del relanzamiento no es la que quedó en el código, es la que se
acuerde con los locales. Pide PIN por lo que hace, no por ser un ajuste:
correrla para adelante le esconde a Atención al Cliente clientes que están
esperando que los llamen.

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
para todos los que no tengan el suyo. En la pantalla es la fila **Todos los
locales**, arriba de las catorce: se configura igual que cualquier otra y lo
único que le falta es la gente. Antes había que escribirla a mano en la
planilla y no había forma de enterarse de que existía.

**Cómo se resuelve el objetivo de un local:** primero el suyo; si no tiene, el
general; si tampoco hay, ninguno. Poner un local en **0** borra su fila y lo
devuelve al general — no lo deja en cero.

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

## El aviso por mail

Cada registro nuevo dispara un mail con el cliente, el producto y un botón
para escribirle por WhatsApp. A dónde va lo dice la propiedad `NOTIFICAR_A`, y
**vacío significa que no se manda nada** — que es como estuvo todo este
tiempo, sin que se notara desde ninguna pantalla.

Ahora se ve y se cambia desde `/config.html`, abajo de los locales. Es lo
**único de esa pantalla que pide el PIN**, y no por proteger un ajuste: ese
mail lleva adentro el nombre, el teléfono y el mail del cliente, o sea el
mismo dato que el panel esconde detrás de una clave. Sin PIN, cualquiera con
la dirección del backend —que está en un repo público— podría mandarse a su
casilla los datos de cada persona que pasa por los locales, y nadie se
enteraría: el sistema seguiría andando igual.

Leerlo, en cambio, no pide nada. Saber a quién le llega —o que no le llega a
nadie— es justo lo que alguien viene a mirar ahí.

Se aceptan hasta cinco casillas separadas por coma. Vaciar el campo apaga el
aviso. Todo cambio queda en el `Log`.

El cuerpo del mail va en **violeta**, como la app. Era naranja `#F97316`, el
de Ranking VDH. Los violetas del mail son más oscuros que los de la pantalla
(`#5B21B6` el título, `#6D28D9` el botón) porque ahí el fondo lo pone el
cliente de correo y siempre es claro: el violeta de la app daría 3,1:1 contra
blanco.

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
| El equipo | Columna H (`Vendedor`), contada por persona, más la lista de la pestaña `Equipo` para que aparezcan también los que este mes todavía no cargaron. Cada uno lleva además **la plata que volvió por lo que cargó** (columnas T y V de sus registros) |

**"Lau · 4" dice cuánto trabajó; "Lau · 4 · $85.000 recuperados" dice para qué
sirvió.** Lo primero se parece a un control de asistencia, lo segundo a un
resultado, y es la diferencia entre que alguien siga cargando o deje de
hacerlo. La plata se calcula en la misma pasada que ya hacía `getMetricas`.

Hay que leerla por lo que es: **la venta la suele cerrar Atención al Cliente
semanas después**, así que eso no es "lo que vendió" el vendedor. Es lo que
volvió porque se tomó el trabajo de cargar a un cliente que se iba con las
manos vacías — que es justamente el trabajo que no se ve. Aparece sólo cuando
hay plata: un `$0` abajo de cada nombre sería un cartel de fracaso en una
lista que está para lo contrario.

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

El pie del formulario muestra su versión (`v2026.09.21`) y el backend devuelve
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

De las tres, el mail de avisos es la única que se puede cambiar sin abrir Apps
Script: se hace desde `/config.html` con el PIN del panel.

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
