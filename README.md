# VDH · Sistema No Compra

Registro de clientes que salen del local **sin encontrar la prenda que buscaban**.

El vendedor carga el pedido desde el celular o la PC del local. El registro cae en
una planilla de Google Sheets, y Atención al Cliente hace el seguimiento hasta
contactar al cliente cuando la prenda aparece.

```
Vendedor en el local
      │  formulario web
      ▼
  submitForm()  ──►  Google Sheets  ──►  Panel de seguimiento
      │                                   Atención al Cliente
      └──► aviso por mail a Atención al Cliente
```

## Las dos vistas

| Vista | URL | Para quién |
|-------|-----|------------|
| Formulario de carga | `.../exec` | Vendedores de los 16 locales |
| Panel de seguimiento | `.../exec?v=panel` | Atención al Cliente (pide PIN) |

## Datos que se registran

| Campo | Obligatorio | Detalle |
|-------|-------------|---------|
| Sucursal | Sí | 16 locales |
| WhatsApp | Sí | Canal principal de contacto |
| Vendedor | Sí | Quién tomó el pedido |
| Nombre | No | Nombre del cliente |
| Mail | No | Contacto alternativo |
| Producto | No | Prenda que buscaba |
| Talle | No | Talle buscado |
| Observaciones | No | Detalle útil para el seguimiento |

El sistema agrega por su cuenta: **Fecha**, **Estado**, **Atendido por** y
**Fecha contacto**.

## Estados del seguimiento

`Pendiente` → `Contactado` → `Vendido` · `Sin stock` · `No responde`

Todo pedido entra como **Pendiente**. En el panel, los pendientes con más de
3 días se marcan en rojo para que no se pierdan.

## Sucursales

MD2 Mar del Plata Rivadavia · MDQ Mar del Plata San Martín · SPB Shopping Parque
Brown · QUI Quilmes · GRB Grand Bourg · VPA Villa del Parque · ITB Ituzaingó ·
MOR Morón · FLO Flores · SUN Unicenter · SJU San Justo I · SJB San Justo Shopping ·
PCH Pacheco · LZB Lomas de Zamora BlackFish · LFL Laferrere Luro · LAN Lanús

## Estructura

```
src/
  Codigo.gs          Backend: carga, seguimiento, avisos, setup
  Index.html         Formulario del vendedor
  Panel.html         Panel de seguimiento de Atención al Cliente
  appsscript.json    Manifiesto del proyecto
```

## Puesta en marcha

1. Pegar el contenido de `src/` en el proyecto de
   [Apps Script](https://script.google.com)
2. En `Codigo.gs`, completar `CONFIG`:
   - `SHEET_ID` — dejar vacío si el script vive dentro de la planilla
   - `HOJA` — nombre exacto de la pestaña
   - `NOTIFICAR_A` — mail de Atención al Cliente (vacío = sin aviso)
3. Correr `setupHoja()` una vez — arma encabezados, el desplegable de Estado
   y los colores por estado
4. Correr `setPin('1234')` una vez, con el PIN que va a usar Atención al Cliente
5. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **yo**
   - Quién tiene acceso: **cualquier usuario**

> Cada vez que se cambia el código hay que crear una **nueva implementación**
> para que los locales vean los cambios.

## Sobre el acceso al panel

La aplicación está publicada con acceso **anónimo**: cualquiera con el link
entra. Eso es lo que permite que los vendedores carguen sin cuenta de Google,
pero significa que el panel — que muestra teléfonos y mails de clientes — queda
detrás de un PIN y nada más.

El PIN se guarda en las propiedades del script (nunca en el repo) y se verifica
en el servidor en cada llamada. Sin PIN configurado, el panel no devuelve datos.

Si más adelante Atención al Cliente pasa a tener cuentas de Google Workspace,
conviene separar el panel en una segunda implementación con acceso restringido
a esos usuarios. Es el camino más sólido.

## Versionado

Para sincronizar el código desde la terminal en lugar de copiar y pegar, ver
[docs/clasp.md](docs/clasp.md).

## Pendiente

`getHtml()` y `crearResumen()` existían en el proyecto original pero su código
no estaba en el disco. Están como stubs en `Codigo.gs` a la espera de que se
peguen desde el editor de Apps Script.
