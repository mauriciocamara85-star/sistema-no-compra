# Impecable · estado de la app (rama `impecable`, sin publicar)

## Qué hay

| Archivo | Qué es |
|---|---|
| `vendedores.html` + `vendedores.js` | La app del celular (Impecable). Vendedor: Hoy · Tareas · Ideas · Perfil (+ Caja y Desafío). Supervisión: Revisar · Equipo · Cajas · Ideas · Perfil. |
| `impecable-admin.html` + `impecable-admin.js` | La administración: Cómo está el local · Orden · Cajas · Productos testigo · Ajustes (sólo el administrador). Misma entrada (PIN) que la app. |
| `impecable-comun.js`, `impecable.css` | Lo que comparten las dos (sesión, base, fotos, fechas; los estilos). |
| `vendedores.webmanifest`, `sw-vendedores.js`, `impecable-*.png` | Se instala como app aparte del No Compra (su nombre, su ícono, su service worker). Las notificaciones van por su propio service worker: el `sw.js` del No Compra no se tocó. |
| `app-vendedores/supabase/` | La base (migraciones 1 a 10), las Edge Functions y los armadores de los SQL. |

## SQL (los corre Mauricio, en este orden)

| SQL | Estado | Qué hace | ¿Se puede deshacer? |
|---|---|---|---|
| 90 | corrido 12/10 | La base de la app, Rivadavia y el login. | Sí (borrar las tablas `orden_*`/`testigo_*`), pero se pierden los datos cargados. |
| 91 | corrido 12/10 | Cada uno crea su PIN; "Supervisión". | Sí. |
| **93** | **para correr** | Los 14 locales en la app, el alta propia del vendedor (que se suma al equipo de la Carga de su local) y el apellido. | Sí: borrar los `orden_locales` nuevos que no tengan gente, y las personas dadas de alta (y su fila de `equipo` si se quiere). |
| **94** | **correr EL DÍA QUE EMPIEZAN** | Prende el reloj (pg_cron cada 15 min, resumen de cajas a las 23:30, resumen semanal los lunes 8:30). | Sí: `select cron.unschedule(jobname) from cron.job where jobname like 'orden-%';` |

(El 92 es de la otra parte del sistema: Difusiones del CRM.)

## Edge Functions

| Función | Estado |
|---|---|
| `entrar` | subida (12/10), versión con alta y apellido. Funciona con la base de hoy y con la del 93. |
| `analizar-foto` | subida (12/10). |
| `leer-caja`, `tick`, `resumen-semanal`, `resumen-cajas` | **para subir con OK** (antes del SQL 94). Pasan `deno check`. Comando: `npx supabase functions deploy leer-caja tick resumen-semanal resumen-cajas --project-ref gfjdjupuwxohkgchqykx --no-verify-jwt --workdir app-vendedores --use-api` |

No hace falta cargar secretos nuevos: usan `ANTHROPIC_API_KEY` y `VAPID_PRIVADA` (ya están), y el token de Telegram y la clave del reloj los leen de la base (SQL 94).

## Decisiones que tomé (todas reversibles)

- **Nombre: "Impecable"** (el que recomendé; no hubo respuesta). Cambiarlo es tocar `NOMBRE_APP` en `impecable-comun.js`, el `<title>`, el manifest y los íconos.
- **La administración es una página propia de la app** (`impecable-admin.html`), no una sección dentro del No Compra: sumar un botón a la barra del No Compra y la pestaña "Orden" en Estadísticas toca pantallas de otros (necesita OK).
- **Sin cola persistente de fotos sin señal**: si no hay señal, la foto queda en pantalla y "Reintentar" la manda (sin volver a subirla si ya había subido). Si se cierra la app, hay que sacarla de nuevo.
- **"No soy yo" borra la suscripción de avisos de ese celular**, para que el próximo que entre no reciba los avisos de otro. Al entrar, si el celular ya tenía avisos, se le asignan al que entró.
- **Telegram**: usa el bot del No Compra. Sólo le llega a quien tenga su `telegram_chat_id` cargado (Ajustes → Personas). Los resúmenes no fallan si no hay a quién mandar.
- **Gerencia**: entra por "Administrador", ve todo (app y administración) y no tiene botones para cambiar nada (además, la base no la deja).
- **El alta propia** es sólo como vendedor y en un local (nunca en "Administrador"). Arranca sin módulos. Freno: 5 altas por local por hora.

## Pendiente (necesita a Mauricio)

1. Correr el **SQL 93**.
2. OK para **subir las 4 funciones** que faltan; después, el día que empiecen, correr el **SQL 94**.
3. OK para **publicar** (merge a main) la rama.
4. OK para sumar **"Impecable" a la barra del No Compra** y la pestaña **"Orden" en Estadísticas** (son pantallas de otros).
5. **Borrar el vendedor de prueba "Prueba"** (lo pidió él; borrar datos necesita su OK).
6. Para los avisos por Telegram: el `chat_id` de cada supervisor y el grupo de las cajas (`TELEGRAM_GRUPO_CAJAS`).
7. Productos testigo: cómo se calcula el **Desvío** de la planilla (sigue pendiente, como en el README).
