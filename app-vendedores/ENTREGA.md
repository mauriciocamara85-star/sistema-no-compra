# Impecable · estado de la app (rama `impecable`, sin publicar)

## Qué hay

| Archivo | Qué es |
|---|---|
| `vendedores.html` + `vendedores.js` | La app del celular (Impecable). Vendedor: Hoy · Tareas · Ideas · Perfil (+ Caja y Desafío). Supervisión: Revisar · Equipo · Cajas · Ideas · Perfil. |
| `impecable-admin.html` + `impecable-admin.js` | La administración: Cómo está el local · Orden · Cajas · Productos testigo · Ajustes (sólo el administrador). Misma entrada (PIN) que la app. |
| `impecable-comun.js`, `impecable.css` | Lo que comparten las dos (sesión, base, fotos, fechas; los estilos). |
| `vendedores.webmanifest`, `sw-vendedores.js`, `impecable-*.png` | Se instala como app aparte del No Compra (su nombre, su ícono, su service worker). Las notificaciones van por su propio service worker: el `sw.js` del No Compra no se tocó. |
| `app-vendedores/supabase/` | La base (migraciones 1 a 12), las Edge Functions y los armadores de los SQL. |

## SQL (los corre Mauricio, en este orden)

| SQL | Estado | Qué hace | ¿Se puede deshacer? |
|---|---|---|---|
| 90 | corrido 12/10 | La base de la app, Rivadavia y el login. | Sí (borrar las tablas `orden_*`/`testigo_*`), pero se pierden los datos cargados. |
| 91 | corrido 12/10 | Cada uno crea su PIN; "Supervisión". | Sí. |
| 93 | corrido 13/10 (de madrugada) | Los 14 locales en la app, el alta propia del vendedor y el apellido. | Sí: borrar los `orden_locales` nuevos que no tengan gente. |
| 95 | corrido 13/10 (~01:10), verificado 13/13 | Nadie ve ni toca nada del local hasta que lo aprueban: ni quien se da de alta ni quien crea su PIN. Al aprobar a un vendedor, se suma a la Carga. Y los arreglos de base de la ronda 1. | Sí: agrega la columna `aprobado` y reemplaza funciones; no borra datos. |
| **96** | **correr YA** | **Fuera de la app, en el No Compra:** el historial (`log`) y los ajustes pasan a ser sólo de la gente de `usuarios` (hoy, vos). Hoy cualquier sesión de Impecable (aunque esté sin aprobar) lee el historial con datos de socios y puede cambiar los ajustes. El panel no cambia (no lee esas tablas con la sesión). Ensayado contra la base real con rollback: 6 de 6. | Sí: volver a crear las 4 reglas con `using (true)`. |
| **97** | **correr después del 96** | La aprobación, segunda vuelta (ronda 2 del árbitro): "No fue" para el PIN de alguien que ya estaba (borra ese PIN y la sesión del que lo creó, sin sacar a la persona real); "Borrar PIN" también cierra la sesión; un administrador nuevo espera aprobación; aprobar sólo sirve para quien espera; fotos de caja de hoy y ayer para el vendedor; gerencia con local no toca cajas; avisos de altas al administrador si el supervisor no entró. Ensayado con el 96 contra la base real con rollback: 9 de 9. | Sí: agrega 2 columnas y reemplaza funciones; sólo borra cuentas internas de Impecable de quien se rechaza. |
| **94** | **correr EL DÍA QUE EMPIEZAN** (después del 97) | Prende el reloj (pg_cron cada 15 min, resumen de cajas a las 23:30, resumen semanal los lunes 8:30). | Sí: `select cron.unschedule(jobname) from cron.job where jobname like 'orden-%';` |

(El 92 es de la otra parte del sistema: Difusiones del CRM.)

## Edge Functions

| Función | Estado |
|---|---|
| `entrar` | subida (12/10). **Volver a subir con OK** (no es urgente: la de hoy anda con el 95): ahora recupera una cuenta que creó y no llegó a anotar, y le dice a la app si la persona está aprobada. |
| `analizar-foto` | subida (12/10). |
| `leer-caja`, `tick`, `resumen-semanal`, `resumen-cajas` | **para subir con OK** (antes del SQL 94). Pasan `deno check`. Comando: `npx supabase functions deploy entrar leer-caja tick resumen-semanal resumen-cajas --project-ref gfjdjupuwxohkgchqykx --no-verify-jwt --workdir app-vendedores --use-api` |

No hace falta cargar secretos nuevos: usan `ANTHROPIC_API_KEY` y `VAPID_PRIVADA` (ya están), y el token de Telegram y la clave del reloj los leen de la base (SQL 94).

## Decisiones que tomé (todas reversibles)

- **Nombre: "Impecable"** (el que recomendé; no hubo respuesta). Cambiarlo es tocar `NOMBRE_APP` en `impecable-comun.js`, el `<title>`, el manifest y los íconos.
- **La administración es una página propia de la app** (`impecable-admin.html`), no una sección dentro del No Compra: sumar un botón a la barra del No Compra y la pestaña "Orden" en Estadísticas toca pantallas de otros (necesita OK).
- **Sin cola persistente de fotos sin señal**: si no hay señal, la foto queda en pantalla y "Reintentar" la manda (sin volver a subirla si ya había subido). Si se cierra la app, hay que sacarla de nuevo.
- **"No soy yo" borra la suscripción de avisos de ese celular**, para que el próximo que entre no reciba los avisos de otro. Al entrar, si el celular ya tenía avisos, se le asignan al que entró.
- **Telegram**: usa el bot del No Compra. Sólo le llega a quien tenga su `telegram_chat_id` cargado (Ajustes → Personas). Los resúmenes no fallan si no hay a quién mandar.
- **Gerencia**: entra por "Administrador", ve todo (app y administración) y no tiene botones para cambiar nada (además, la base no la deja).
- **El alta propia** es sólo como vendedor y en un local (nunca en "Administrador"). Arranca sin módulos y **esperando la aprobación**. Freno: 5 altas pendientes por local por hora (la gente que carga el administrador no cuenta).
- **Aprobación (revisión del árbitro, 13/10)**: quien se da de alta o crea su PIN por primera vez ve "Esperando la aprobación" y la base no le muestra nada. Al vendedor lo aprueba su supervisor (Equipo → "Esperan tu OK") o el administrador (también en Ajustes → Personas → "Aprobado"); a supervisores, gerencia y otros administradores, sólo un administrador. Vos no esperás mientras seas el único administrador. "Borrar PIN" obliga a aprobar de nuevo y cierra la sesión que tenía.
  - Quien se anotó solo: "Es de acá" / "No lo conozco" (lo saca).
  - Quien ya estaba (Lautaro, Nano…) y creó su PIN: "Sí, fue" / "No fue". El aviso pide confirmarlo en persona, porque cualquiera con el enlace puede crear el PIN de otro. "No fue" borra ese PIN y la sesión del que lo creó; la persona real sigue en la lista.
  - En "Esperan tu OK" sólo aparece quien ya entró o se anotó solo. Lautaro, Nano, Seba y Mel, mientras no entren, siguen en "Por vendedor" como siempre.
- **El freno del PIN quedó como lo pediste** (5 mal → 5 minutos, por persona). El árbitro avisó que así se puede dejar a alguien afuera a propósito y que un PIN de 4 números aguanta pocos días de prueba sistemática: es una decisión tuya, no lo toqué.

## Pendiente (necesita a Mauricio)

1. Correr el **SQL 96** (ya: es del No Compra, por eso va aparte) y después el **SQL 97**.
2. OK para **subir las 5 funciones** (`entrar` de nuevo y las 4 que faltan); después, el día que empiecen, correr el **SQL 94**.
3. OK para **publicar** (merge a main) la rama. Antes, el 96 y el 97 corridos: la app nueva lee columnas del 97.
4. OK para sumar **"Impecable" a la barra del No Compra** y la pestaña **"Orden" en Estadísticas** (son pantallas de otros).
5. **Borrar el vendedor de prueba "Prueba"** (lo pidió él; borrar datos necesita su OK).
6. Para los avisos por Telegram: el `chat_id` de cada supervisor y el grupo de las cajas (`TELEGRAM_GRUPO_CAJAS`).
7. Productos testigo: cómo se calcula el **Desvío** de la planilla (sigue pendiente, como en el README).

## Revisión del árbitro (2 rondas, 13/10)

- **Ronda 1**: 1 bloqueante (cualquiera con el enlace quedaba adentro del local) y 11 importantes. Corregidos en el SQL 95 y la app (e5702af).
- **Ronda 2**: confirmó cerrados la mayoría; encontró **1 bloqueante fuera de la app** (el historial y los ajustes del No Compra, abiertos a cualquier sesión) → **SQL 96**, y varios importantes de la aprobación → **SQL 97** y la app. No hubo ronda 3 (la regla es 2): lo corregido después de la ronda 2 lo probé yo (base de prueba 34/34 + las anteriores, pantallas 80/80, administración 31/31, ensayo contra la base real con rollback).
- **Quedan sin tocar (menores, a propósito)**: el archivo que queda suelto si se pierde la respuesta de una subida; reintentar una foto de caja la registra otra vez y vuelve a pedir la lectura de la IA (se paga); dos análisis de IA simultáneos de la misma foto se pagan dos veces; quien espera aprobación no puede activar los avisos todavía (entra solo al abrir la app); el freno del PIN (decisión tuya).
- **Fuera de esta app** (no lo toqué): las tablas `equipo` y `objetivos` y las funciones `club_*`/`agente_*` están abiertas a cualquiera sin sesión (así las diseñó el No Compra, con PIN en las funciones).
