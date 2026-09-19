# VDH · Sistema No Compra

Registro y seguimiento de clientes que salen del local **sin encontrar la prenda
que buscaban**.

El vendedor carga el pedido desde el celular o la PC del local. El registro cae
en una planilla de Google Sheets, y Atención al Cliente hace el seguimiento
hasta contactar al cliente cuando la prenda aparece.

```
Vendedor en el local
      │  formulario web
      ▼
  submitForm()  ──►  Google Sheets  ──►  Panel de seguimiento
      │                  A-I              Atención al Cliente
      │                                   completa J-V
      └──► aviso por mail a Atención al Cliente
```

## Las dos vistas

| Vista | URL | Para quién |
|-------|-----|------------|
| Formulario de carga | `.../exec` | Vendedores de los 16 locales |
| Panel de seguimiento | `.../exec?v=panel` | Atención al Cliente (pide PIN) |

## La planilla

La pestaña `No Compra` tiene **22 columnas en uso**, divididas en dos mitades
con dueños distintos:

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

> **Nunca escribir en J–V a ciegas.** Son datos vivos que el equipo carga a
> mano. `submitForm()` escribe únicamente A–I; el resto queda vacío.

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

**Pendiente** no es un estado de la planilla: es el registro que todavía nadie
tocó (sin *Estado Actual* y sin *Nos contactamos?*). Los pendientes con 3 días
o más se marcan en rojo en el panel.

## Sucursales

MD2 Mar del Plata Rivadavia · MDQ Mar del Plata San Martín · SPB Shopping Parque
Brown · QUI Quilmes · GRB Grand Bourg · VPA Villa del Parque · ITB Ituzaingó ·
MOR Morón · FLO Flores · SUN Unicenter · SJU San Justo I · SJB San Justo Shopping ·
PCH Pacheco · LZB Lomas de Zamora BlackFish · LFL Laferrere Luro · LAN Lanús

## Estructura

```
src/
  Codigo.gs          Backend: carga, seguimiento, avisos
  Resumen.gs         Arma la pestaña Resumen (conteos por sucursal/vendedor/producto)
  Index.html         Formulario del vendedor
  Panel.html         Panel de seguimiento
  appsscript.json    Manifiesto del proyecto
```

## Puesta en marcha

1. Pegar el contenido de `src/` en el proyecto de
   [Apps Script](https://script.google.com). Los `.html` van como archivos
   **HTML**, no pegados dentro del `.gs`.
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

> Cada cambio de código necesita una **nueva implementación** para que los
> locales lo vean.

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
