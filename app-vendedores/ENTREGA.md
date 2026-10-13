# Equipo VDH (antes "Impecable") · estado de la app (publicada; última publicación 13/10/2026, main 8955d1c, sw v125)

Se entra desde el botón **Equipo VDH** de la barra del No Compra (la administración) o directo a `vendedores.html` (la app). Se instala con el botón **Instalar** del Perfil: el menú de Chrome dice "ya instalada" porque el No Compra abarca todo el sitio.

**En la rama, sin publicar (13/10 noche):** la reorganización que pidió Mauricio al probarla como vendedor (ver "Reorganización" más abajo) y la función `ideas-tablero` (sin desplegar).

## Qué hay

| Archivo | Qué es |
|---|---|
| `vendedores.html` + `vendedores.js` | La app del celular (Equipo VDH). Vendedor: Hoy · Fotos · Tareas · (Caja) · Ideas, con la campanita de avisos y el Perfil arriba (+ Test y Producto testigo). Supervisión: Revisar · Equipo · Cajas · Ideas · Perfil. |
| `impecable-admin.html` + `impecable-admin.js` | La administración: Cómo está el local · Orden · Cajas · Productos testigo · Ajustes (sólo el administrador). Misma entrada (PIN) que la app. |
| `impecable-comun.js`, `impecable.css` | Lo que comparten las dos (sesión, base, fotos, fechas; los estilos). |
| `vendedores.webmanifest`, `sw-vendedores.js`, `impecable-*.png` | Se instala como app aparte del No Compra (su nombre, su ícono, su service worker). Las notificaciones van por su propio service worker: el `sw.js` del No Compra no se tocó. |
| `app-vendedores/supabase/` | La base (migraciones 1 a 14), las Edge Functions y los armadores de los SQL. |

## SQL (los corre Mauricio, en este orden)

| SQL | Estado | Qué hace | ¿Se puede deshacer? |
|---|---|---|---|
| 90 | corrido 12/10 | La base de la app, Rivadavia y el login. | Sí (borrar las tablas `orden_*`/`testigo_*`), pero se pierden los datos cargados. |
| 91 | corrido 12/10 | Cada uno crea su PIN; "Supervisión". | Sí. |
| 93 | corrido 13/10 (de madrugada) | Los 14 locales en la app, el alta propia del vendedor y el apellido. | Sí: borrar los `orden_locales` nuevos que no tengan gente. |
| 95 | corrido 13/10 (~01:10), verificado 13/13 | Nadie ve ni toca nada del local hasta que lo aprueban: ni quien se da de alta ni quien crea su PIN. Al aprobar a un vendedor, se suma a la Carga. Y los arreglos de base de la ronda 1. | Sí: agrega la columna `aprobado` y reemplaza funciones; no borra datos. |
| 96 | corrido 13/10 | **Fuera de la app, en el No Compra:** el historial (`log`) y los ajustes pasan a ser sólo de la gente de `usuarios` (hoy, vos). Hoy cualquier sesión de Impecable (aunque esté sin aprobar) lee el historial con datos de socios y puede cambiar los ajustes. El panel no cambia (no lee esas tablas con la sesión). Ensayado contra la base real con rollback: 6 de 6. | Sí: volver a crear las 4 reglas con `using (true)`. |
| 97 | corrido 13/10 | La aprobación, segunda vuelta (ronda 2 del árbitro): "No fue" para el PIN de alguien que ya estaba (borra ese PIN y la sesión del que lo creó, sin sacar a la persona real); "Borrar PIN" también cierra la sesión; un administrador nuevo espera aprobación; aprobar sólo sirve para quien espera; fotos de caja de hoy y ayer para el vendedor; gerencia con local no toca cajas; avisos de altas al administrador si el supervisor no entró. Ensayado con el 96 contra la base real con rollback: 9 de 9. | Sí: agrega 2 columnas y reemplaza funciones; sólo borra cuentas internas de Impecable de quien se rechaza. |
| 99 | corrido 13/10 (~12:30), verificado 8/8 (sólo lectura) | El mapa del local: cuántos módulos hay en cada pared y lo de adentro (la caja, los percheros); el reparto (qué módulo es de cada sector, quién lo tiene y quién lo cubre); los recordatorios de cada día. Revisado por el árbitro (sin bloqueantes; los importantes, corregidos). Base de prueba 33/33; ensayado contra la base real con rollback: 14 de 14 (no toca ningún módulo de Rivadavia hasta que se arme el mapa). | Sí: agrega una tabla (`orden_recordatorios`), dos columnas (`orden_config.mapa`, `orden_modulos.isla`) y cuatro funciones. No borra módulos: los que sobran al achicar se apagan; sólo se sacan sus controles pendientes sin foto. |
| 102 | corrido 13/10 (~15:56) | **Productos testigo desde los locales**: se programa en la administración (día, productos y locales, todos o los elegidos); el local llena la planilla en Impecable (PC o celular) con un video por producto; la vendida se escribe; diferencia y desvío se calculan; aviso "Mañana tienen producto testigo" y al supervisor y a vos si falta algo. **El mapa**: nombre para cada módulo ("Vidriera"), "Repartir parejo" (22 entre 3: 7, 7 y 8) del salón y del depósito, y el depósito en módulos numerados (con su forma). Base de prueba 58/58; ensayado contra la base real con rollback: 16 de 16. (El 100 y el 101 son de los usuarios del No Compra: no dependen de este.) | Sí: agrega columnas, una tabla chica (`testigo_videos_viejos`), un bucket (`testigo-videos`) y funciones; la "Cantidad enviada" deja de arrancar en 0. No borra datos. La primera vez que se guarda el mapa con el depósito, los 3 módulos de depósito de hoy (todos "1") pasan a 1, 2 y 3, cada uno en su sector y con su historia. |
| 94 | **corrido 13/10, antes de lo previsto**: el reloj está prendido, pero llama a `tick` y a los resúmenes, que NO están subidos (contestan 404), así que no genera nada. Se sube `tick` el día que empiecen. | Prende el reloj (pg_cron cada 15 min, resumen de cajas a las 23:30, resumen semanal los lunes 8:30). | Sí: `select cron.unschedule(jobname) from cron.job where jobname like 'orden-%';` |

| 103 | corrido 13/10 | Sólo trabaja quien está aprobado (`orden_trabaja`), y **Rivadavia listo para probar con "Prueba"**: sector 1 y depósito 2 a su cargo (eran de Lautaro: **devolvérselos al arrancar**), hora límite 20:30 (era 18:00), testigo de hoy, recordatorio, tarea y test. | Sí, a mano: volver los sectores a Lautaro y la hora a 18:00. |
| 104 | corrido 13/10 | Atención al cliente no aparece en la entrada de la app. | Sí. |
| 105 | corrido 13/10 | Test de conocimiento: grupos de preguntas, "Mandar un test ahora" con aviso, y los textos con "Equipo VDH" (el nivel "Impecable" de las fotos no cambia). | Sí: agrega columnas y una función. |
| 106 | **sin correr** (13/10) | "Repartir parejo" incluye los módulos del centro, al final de la numeración. Base de prueba 10/10; real con rollback 4/4. | Sí: cambia una sola función. |

(El 92 es de la otra parte del sistema: Difusiones del CRM. El 100 y el 101, de los usuarios del No Compra.)

## Edge Functions

| Función | Estado |
|---|---|
| `entrar` | subida de nuevo el 13/10: recupera una cuenta que creó y no llegó a anotar, y le dice a la app si la persona está aprobada. Probada en vivo: 10 de 10. |
| `analizar-foto` | subida (12/10). |
| `leer-caja` | subida el 13/10 (sin sesión: 403). |
| `ideas-tablero` | **nueva, sin desplegar**: trae las fotos de un tablero de Pinterest de Ideas (por su RSS público) para verlas adentro de la app. Sólo lee tableros cargados en Ideas y con la sesión de quien pregunta. Comando: `npx supabase functions deploy ideas-tablero --project-ref gfjdjupuwxohkgchqykx --no-verify-jwt --workdir app-vendedores --use-api` |
| `tick`, `resumen-semanal`, `resumen-cajas` | **SUBIDAS el 13/10 (15:59) para la prueba con "Prueba": el reloj está andando.** Lo que sigue es la nota de antes: **NO subir hasta el día que empiecen los chicos** (y después del SQL 102: `tick` ahora también manda "Mañana tienen producto testigo" y borra los videos viejos; si el 102 no está, sigue igual): con el SQL 94 ya corrido, subir `tick` prende los controles y los avisos. Pasan `deno check`. Comando: `npx supabase functions deploy entrar leer-caja tick resumen-semanal resumen-cajas --project-ref gfjdjupuwxohkgchqykx --no-verify-jwt --workdir app-vendedores --use-api` |

No hace falta cargar secretos nuevos: usan `ANTHROPIC_API_KEY` y `VAPID_PRIVADA` (ya están), y el token de Telegram y la clave del reloj los leen de la base (SQL 94).

## Decisiones que tomé (todas reversibles)

- **Nombre: "Equipo VDH"** (lo eligió él el 13/10; antes "Impecable"). Cambiaron sólo los textos (`NOMBRE_APP`, `<title>`, el manifest, la barra del No Compra); los archivos siguen llamándose `impecable-*`.
- **Reorganización (13/10, pedido de él al probarla como vendedor; en la rama, sin publicar):**
  - Pestañas Hoy · Fotos · Tareas · (Caja) · Ideas. Arriba, la **campanita** de los avisos (número rojo con los no leídos) y la **inicial**, que abre el Perfil; "No soy yo" e "Instalar" están adentro del Perfil.
  - **Hoy** es la lista de lo que falta hoy, para ir tachando (fotos, producto testigo, tareas, test y la caja desde las 19), y aparte la tarjeta de colores "Tu orden esta semana". Con todo hecho, un festejo (una vez por día y por teléfono).
  - **Fotos** es el croquis con las cámaras; la lista de módulos queda sólo para lo que no está en el croquis.
  - **Tareas**, sólo tareas. **Avisos**: tocar uno lleva a lo suyo; al verlos quedan leídos.
  - **Caja** en 4 renglones (Tarjeta, Mercado Pago, Go Cuotas, Efectivo): lo que dice el sistema, lo del comprobante y al momento "✓ Da" / "Faltan $X" / "Sobran $X" (la misma cuenta y tolerancia que la base). Los montos se mandan convertidos: antes "95.000" se guardaba como 95.
  - **Ventanitas propias** en vez de las del navegador (que mostraban "mauriciocamara85-star.github.io dice").
  - **Festejo** con papelitos al acertar todo el test.
  - **Ideas** con las fotos del tablero adentro (función `ideas-tablero`); en la administración no se aceptan enlaces de invitación al tablero (pin.it o con `invite_code`), porque dejan editarlo.
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
- **El mapa del local (SQL 99)**: se arma y se reparte en la computadora (No Compra → Impecable → Por local → "Cambiar la forma y la cantidad" / "Repartir los módulos"), por el supervisor del local o el administrador; la gerencia sólo mira. En el celular: el vendedor lo ve en "Fotos" (antes en "Hoy") con lo suyo de su color (toca su módulo con la cámara y saca la foto) y el supervisor lo ve en Equipo → "El mapa del local", para mirar. Los módulos del salón se agregan o se sacan desde el mapa (en Ajustes → Sectores ya no hay "Agregar módulo" para el salón; en el depósito sí). Entre todas las paredes, hasta 100 módulos (lo de adentro va del 101). Mientras no se arme el mapa de un local, los módulos se dibujan en las paredes a ojo y lo avisa.
- **La Caja es una pestaña (13/10, pedido de él)**: Hoy · Fotos · Tareas · Caja · Ideas, sólo en los locales con el control de caja prendido. Desde las 19 h, si la caja de hoy no está guardada, la pestaña muestra un puntito.
- **Productos testigo (SQL 102)**: desde la administración se programa el control (día, productos y locales). El local lo ve en Hoy ("Mañana tienen producto testigo" / "Hoy: producto testigo") y llena la planilla de él: enviada, stock sistema, vendida, real, dev. a fábrica, salieron, entraron y observaciones. Todo sale del sistema, salvo la real, que se cuenta.
  - **Desvío = (stock sistema − real) ÷ enviada, en %**: él pidió que se calcule solo, y es lo que le propuse (Last Chance: faltan 2 de 15 = 13,3 %). Cambiarlo es una línea de la vista `testigo_v_items` y de la app.
  - **El video**: se graba desde la app, hasta 20 segundos, sin sonido y a 640×480 (unos 2 MB). Si el celular no puede grabar adentro de la app, abre la cámara del teléfono (tope 20 MB). Mandar sin video se puede, pero lo pregunta. Se guardan 14 días; los que dieron diferencia, 90 (como las fotos con problemas). Los borra el reloj (`tick`).
  - Se carga el día del control (antes se ve, pero no se puede escribir). Mandarla pide stock sistema y real de todos los productos. Si falta o sobra algo, avisa al supervisor y al administrador.
- **Nombres de los módulos (SQL 102)**: en Por local → "Repartir y ponerles nombre", tocando el módulo ("Vidriera", "Estantería de remeras"). Se ve en el mapa (en las paredes de costado, de costado y recortado si es largo) y en la lista del vendedor. Vacío vuelve a "Módulo 7" / "Depósito 3".
- **Repartir parejo (SQL 102)**: divide los módulos (del salón o del depósito) entre los sectores que tienen responsable, en bloques seguidos y en orden; si no da justo, los últimos llevan uno más. Lo de adentro (la caja) no se toca. Se puede seguir a mano tocando cada módulo.
- **El depósito en módulos (SQL 102)**: en "Cambiar la forma y la cantidad", la forma (largo o cuadrado) y cuántos módulos (cada uno, una foto). Se numeran 1, 2, 3… en todo el local, como las paredes. En Ajustes → Sectores, el N.º y el "Activo" de todos los módulos quedan sólo para ver: se manejan en el mapa.
- **Los recordatorios de cada día (SQL 99)**: Ajustes → "Recordatorios por día", por local. Ese día les aparecen a los vendedores arriba en "Hoy" (el supervisor no tiene "Hoy").
- **Lo de adentro (la caja, los percheros) pide foto como un módulo más**: tiene su responsable y entra en los controles, las sorpresas y el nivel. Si la caja no tiene que pedir foto, se cambia (pregunta abierta para Mauricio).
- **Al achicar el mapa**, los controles de hoy en adelante que todavía no tienen foto, de lo que se apaga, se sacan (los que tienen foto quedan). **Al repartir** (mover un módulo o cambiar quién tiene o cubre un sector), esos controles pasan a quien le toca ahora.
- El N.º y el "Activo" de los módulos del salón se manejan desde el mapa: en Ajustes → Sectores quedan sólo para ver. Si se apaga un sector del salón, al guardar el mapa sus módulos vuelven a la pared en un sector activo (los mismos, nunca dos con el mismo número).
- **El freno del PIN quedó como lo pediste** (5 mal → 5 minutos, por persona). El árbitro avisó que así se puede dejar a alguien afuera a propósito y que un PIN de 4 números aguanta pocos días de prueba sistemática: es una decisión tuya, no lo toqué.

## Pendiente (necesita a Mauricio)

1. ~~Correr el SQL 96 y el 97~~ (hecho el 13/10). ~~Correr el SQL 99 y publicar el mapa~~ (hecho el 13/10, sw v119). ~~Correr el SQL 102~~ (hecho; publicado el 13/10, sw v121). **Correr el SQL 106**; después, su OK para publicar la reorganización y desplegar `ideas-tablero`.
1b. **Al arrancar de verdad**: devolverle a Lautaro el sector 1 y el depósito 2, y la hora límite a 18:00 (el SQL 103 los dejó para "Prueba").
2. El día que empiecen los chicos: subir **`tick`, `resumen-semanal` y `resumen-cajas`** (el 94 ya está). Las otras 2 ya están subidas. Antes: (`entrar` de nuevo y las 4 que faltan); después, el día que empiecen, correr el **SQL 94**.
3. ~~Publicar~~ (hecho el 13/10, 41f1594).
4. ~~"Impecable" en la barra del No Compra~~ (hecho: entre Socios y Config.). La pestaña "Orden" en Estadísticas no se hizo (él eligió sólo el botón).
5. **Borrar el vendedor de prueba "Prueba"**: el 13/10 dijo "dejalo por ahora".
6. Para los avisos por Telegram: el `chat_id` de cada supervisor y el grupo de las cajas (`TELEGRAM_GRUPO_CAJAS`).
7. Productos testigo: cómo se calcula el **Desvío** de la planilla (sigue pendiente, como en el README).

## Revisión del árbitro (2 rondas, 13/10)

- **Ronda 1**: 1 bloqueante (cualquiera con el enlace quedaba adentro del local) y 11 importantes. Corregidos en el SQL 95 y la app (e5702af).
- **Ronda 2**: confirmó cerrados la mayoría; encontró **1 bloqueante fuera de la app** (el historial y los ajustes del No Compra, abiertos a cualquier sesión) → **SQL 96**, y varios importantes de la aprobación → **SQL 97** y la app. No hubo ronda 3 (la regla es 2): lo corregido después de la ronda 2 lo probé yo (base de prueba 34/34 + las anteriores, pantallas 80/80, administración 31/31, ensayo contra la base real con rollback).
- **Quedan sin tocar (menores, a propósito)**: el archivo que queda suelto si se pierde la respuesta de una subida; reintentar una foto de caja la registra otra vez y vuelve a pedir la lectura de la IA (se paga); dos análisis de IA simultáneos de la misma foto se pagan dos veces; quien espera aprobación no puede activar los avisos todavía (entra solo al abrir la app); el freno del PIN (decisión tuya).
- **Fuera de esta app** (no lo toqué): las tablas `equipo` y `objetivos` y las funciones `club_*`/`agente_*` están abiertas a cualquiera sin sesión (así las diseñó el No Compra, con PIN en las funciones).

## Revisión del árbitro del SQL 102 (1 ronda, 13/10)

- **Sin bloqueantes.** Corregí los 3 importantes y los menores simples; no hubo ronda 2 (no hacía falta: sin bloqueantes). Lo corregido lo probé yo: base de prueba 68/68, app 89/89, administración 69/69, producto testigo 29/29, cámara OK, base real con rollback 16/16.
  1. Después de mandar, el vendedor podía seguir cambiando la planilla sin tope (y pisar lo que corregía la administración) → ahora carga desde el día del control, durante una semana y hasta mandarla; después corrige el supervisor o el administrador (`testigo_abierto_`).
  2. Programar otro día en la misma semana movía todo el control y trababa lo de hoy → un control por semana y local: otro día esa semana da un aviso claro.
  3. Repartir el depósito no pasaba los controles del depósito de la semana (se crean el lunes y vencen el viernes) y achicar dejaba pendientes de módulos apagados → ahora siguen al reparto (o se sacan) todos los que siguen abiertos.
  - Menores corregidos: videos sólo en la carpeta de un control de ese local; al grabar de nuevo no se manda a borrar un video de otro local; ya no hay "planilla vacía" (sin día, el local no la veía): se arma con "Programar un control", y "Agregar un producto" va por el mismo camino; fechas de la semana pasada a dos meses; la planilla de la administración avisa si un número no es entero (y la base no acepta negativos); el aviso del día antes lleva al supervisor a la administración; los nombres de los módulos, enteros en una línea abajo del mapa; el video grabado con la cámara del teléfono pide "unos 10 segundos".
  - Quedan (menores): un video que se sube pero no llega a anotarse queda suelto en el bucket; un .mov de iPhone grabado con la cámara del teléfono (no con la app) puede no verse en Chrome de Windows.
