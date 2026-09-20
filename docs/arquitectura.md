# Arquitectura

El sistema está partido en dos, alojados en lugares distintos.

```
   GitHub Pages                        Apps Script
   (la interfaz)                       (el backend)

   index.html  ─── POST /exec ───►     doPost()
   panel.html                            │
   estilos.css                           ▼
   comun.js                         Google Sheets
   sw.js + manifest.json
```

## La interfaz — GitHub Pages

En la raíz del repo, servida desde
`mauriciocamara85-star.github.io/sistema-no-compra/`.

| Archivo | Qué es |
|---------|--------|
| `index.html` | Formulario de carga del vendedor |
| `panel.html` | Panel de seguimiento (pide PIN) |
| `estilos.css` | Sistema de diseño que comparten las dos |
| `comun.js` | Lo que comparten: backend, tema, avisos, WhatsApp, PWA |
| `manifest.json`, `sw.js`, `icon-*.png` | Lo que la vuelve instalable |

Cada push a `main` las publica: no hay que implementar nada.

## Se instala en el celular

`manifest.json` + `sw.js` hacen que la app se pueda agregar a la pantalla de
inicio y que **abra sin señal**. El service worker va a la red primero, así que
un `git push` se ve en los locales enseguida; el caché es sólo red de
contención.

Lo que se carga sin conexión queda en una cola en el celular (`nc_cola` en
localStorage) y se manda solo cuando vuelve la señal. Antes, un fallo de red
perdía el registro.

## El backend — Apps Script

`src/`, sincronizado con `clasp`. Es lo único que toca la planilla.

`doPost()` es la puerta de entrada desde GitHub Pages. Recibe JSON con un campo
`accion` y devuelve JSON:

| Acción | Qué hace |
|--------|----------|
| `submit` | Guarda un pedido nuevo |
| `registros` | Lista los pedidos para el panel |
| `seguimiento` | Escribe el seguimiento de un pedido |
| `resumen` | Totales por estado, plata recuperada y conteo por motivo |

`doGet()` ya no sirve ninguna vista: **redirige** a GitHub Pages (`src/Redirect.html`),
para que los links viejos de Apps Script sigan funcionando.

Antes había copias del formulario y del panel en `src/Index.html` y
`src/Panel.html`, con `google.script.run` en lugar de `fetch`. Eran copias de
verdad: cada cambio de interfaz había que hacerlo dos veces y terminaron
desincronizadas. Se retiraron; ahora hay una sola interfaz.

## Por qué `text/plain`

Las llamadas mandan `Content-Type: text/plain`, no `application/json`.

Con `application/json` el navegador hace primero un pedido de permiso
(*preflight*, un `OPTIONS`). Apps Script no responde a ese pedido, así que la
llamada fallaría siempre. Con `text/plain` el navegador lo considera un pedido
simple y lo manda directo.

El backend igual lo parsea como JSON: el `Content-Type` sólo define cómo se
comporta el navegador, no qué contiene el cuerpo.

## Publicar cambios

| Qué tocaste | Cómo lo publicás |
|-------------|------------------|
| Cualquier archivo de la raíz (interfaz) | `git push` — listo en segundos |
| `src/` (el backend) | `.\publicar.ps1 "qué cambió"` |

Al cambiar un archivo de la interfaz conviene subir la versión del caché en
`sw.js` (`const CACHE = 'no-compra-vN'`): ese cambio de nombre es lo que borra
la copia vieja en los celulares que ya tienen la app instalada.
