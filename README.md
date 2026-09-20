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
      │               A-I + Z            Atención al Cliente
      │                                  completa J-V
      └──► aviso por mail a Atención al Cliente
```

## Las dos vistas

| Vista | URL | Para quién |
|-------|-----|------------|
| Formulario de carga | [`/`](https://mauriciocamara85-star.github.io/sistema-no-compra/) | Vendedores de los 14 locales |
| Panel de seguimiento | [`/panel.html`](https://mauriciocamara85-star.github.io/sistema-no-compra/panel.html) | Atención al Cliente (pide PIN) |

Las dos se sirven desde GitHub Pages y se publican con un `git push`. Las URLs
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
estilos.css          Sistema de diseño compartido (naranja, claro/oscuro)
comun.js             Backend, tema, avisos, WhatsApp, PWA
manifest.json        Para instalarla en el celular
sw.js                Para que abra sin señal
icon-*.png           Íconos de la app

src/                 ── el backend, en Apps Script ──
  Codigo.gs          Carga, seguimiento, avisos
  Resumen.gs         Arma la pestaña Resumen (sucursal/vendedor/producto/motivo)
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
