# Arquitectura

El sistema está partido en dos, alojados en lugares distintos.

```
   GitHub Pages                        Apps Script
   (la interfaz)                       (el backend)

   index.html  ─── POST /exec ───►     doPost()
   panel.html                            │
                                         ▼
                                    Google Sheets
```

## La interfaz — GitHub Pages

`index.html` y `panel.html`, en la raíz del repo. Se sirven desde
`mauriciocamara85-star.github.io/sistema-no-compra/`.

Cada push a `main` las publica: no hay que implementar nada.

## El backend — Apps Script

`src/`, sincronizado con `clasp`. Es lo único que toca la planilla.

`doPost()` es la puerta de entrada desde GitHub Pages. Recibe JSON con un campo
`accion` y devuelve JSON:

| Acción | Qué hace |
|--------|----------|
| `submit` | Guarda un pedido nuevo |
| `registros` | Lista los pedidos para el panel |
| `seguimiento` | Escribe el seguimiento de un pedido |
| `resumen` | Totales por estado |

`doGet()` sigue existiendo y sirviendo las vistas desde Apps Script, así que las
URLs viejas no se rompen. Las copias de `src/Index.html` y `src/Panel.html` usan
`google.script.run`; las de la raíz usan `fetch`.

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
| `index.html` o `panel.html` | `git push` — listo en segundos |
| `src/` (el backend) | `.\publicar.ps1 "qué cambió"` |
