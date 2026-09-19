# VDH · Sistema No Compra

Registro de clientes que salen del local **sin encontrar la prenda que buscaban**.

El vendedor carga el pedido desde el celular o la PC del local. El registro cae en
una planilla de Google Sheets que Atención al Cliente revisa para contactar al
cliente cuando la prenda aparece.

## Cómo funciona

```
Vendedor en el local
      │
      │  formulario web (Apps Script)
      ▼
  submitForm()  ──►  Google Sheets  ──►  Atención al Cliente
                                           contacta por WhatsApp/mail
```

## Datos que se registran

| Campo         | Obligatorio | Detalle                          |
|---------------|-------------|----------------------------------|
| Sucursal      | Sí          | 16 locales                       |
| WhatsApp      | Sí          | Canal principal de contacto      |
| Vendedor      | Sí          | Quién tomó el pedido             |
| Nombre        | No          | Nombre del cliente               |
| Mail          | No          | Contacto alternativo             |
| Producto      | No          | Prenda que buscaba               |
| Talle         | No          | Talle buscado                    |
| Observaciones | No          | Detalle útil para el seguimiento |

## Sucursales

MD2 Mar del Plata Rivadavia · MDQ Mar del Plata San Martín · SPB Shopping Parque
Brown · QUI Quilmes · GRB Grand Bourg · VPA Villa del Parque · ITB Ituzaingó ·
MOR Morón · FLO Flores · SUN Unicenter · SJU San Justo I · SJB San Justo Shopping ·
PCH Pacheco · LZB Lomas de Zamora BlackFish · LFL Laferrere Luro · LAN Lanús

## Estructura

```
src/
  Codigo.gs          Backend: doGet, submitForm, helpers
  Index.html         Formulario (HTML + CSS + JS en un archivo)
  appsscript.json    Manifiesto del proyecto
```

## Despliegue

El proyecto vive en Google Apps Script. Para publicarlo:

1. Abrir el proyecto en [script.google.com](https://script.google.com)
2. Pegar el contenido de `src/` en los archivos correspondientes
3. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **yo**
   - Quién tiene acceso: **cualquier usuario**

Para sincronizar desde la terminal en lugar de copiar y pegar, hace falta
`clasp` (requiere Node.js). Ver [docs/clasp.md](docs/clasp.md).

## Configuración

En `src/Codigo.gs`, el bloque `CONFIG` define la planilla destino y el nombre
de la pestaña. `COLUMNAS` tiene que coincidir con el encabezado real de la hoja.
