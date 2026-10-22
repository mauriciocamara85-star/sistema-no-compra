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
| 106 | corrido 13/10 (noche) | "Repartir parejo" incluye los módulos del centro, al final de la numeración. Base de prueba 10/10; real con rollback 4/4. | Sí: cambia una sola función. |
| 107–109 | (de la otra sesión) | Los usuarios del No Compra, parte 3. | — |
| 110 | corrido 13/10 (noche) | El PIN de 6 números para administración, Atención y gerencia, con el freno escalonado (5 min, 30 min, 24 h y aviso) y `orden_pin_reiniciar`; cambiarlo pide el PIN de ahora (acordado con la otra sesión). Base de prueba 32/32; real con rollback. | Sí: agrega 2 columnas y funciones; no borra ningún PIN. |
| 111 | corrido 13/10 | (1) Los tableros de Ideas no guardan el enlace de "Compartir" de Pinterest (pin.it o con `invite_code`), que deja sumarse a editar el tablero: al de invitación le saca el código, un pin.it lo rechaza. (2) La caja deja borrar un monto ya guardado para corregirlo (vacío lo borra; si una app vieja no manda el campo, queda). (3) Los avisos de las fotos llevan a la pestaña Fotos (si también hay tareas, a Hoy). Cambia frases exactas de `orden_caja_guardar`, `orden_tick` y `orden_recordar` como están en la base, y si no las encuentra frena con un error. Base de prueba 23/23 (con el 106); real con rollback 10/10. | Sí: agrega un trigger y cambia 3 funciones. No borra datos. |
| 112 | corrido 13/10 (noche), verificado | **El croquis del local**: la entrada (en el salón y en el depósito) donde está, y el 1 al lado, hacia la izquierda; huecos y cosas fijas en las paredes (probadores, una columna); módulos dobles; lo del centro donde está y cosas fijas adentro (mostrador, escalera). Cada módulo se queda en su lugar con su historia: al guardar, la base los renumera (`orden_mapa_ordenar_`, que sólo la usa `orden_croquis_guardar`) y arma el mapa como siempre. El dibujo va en `orden_config.mapa.croquis`; la cantidad por pared sigue estando (las apps viejas siguen andando). Base de prueba 34/34; real con rollback 11/11 (Rivadavia quedó igual). | Sí: agrega 2 funciones; sin el croquis guardado el mapa se dibuja como antes. Los números que cambiaron quedan cambiados. |
| 113 | corrido 14/10, verificado | (1) **Los vendedores también ven el observador** (pedido de Mauricio): hoy un vendedor sólo ve sus propios controles, así que los módulos de los compañeros le saldrían "sin foto". Dos funciones para mirar el local entero, sólo para quien es del local (o administración y gerencia): `orden_visor_estado` y `orden_visor_historia`. No cambian ninguna regla de las tablas. (2) **El aviso de una tarea a alguien de franco** (o fuera del horario del local) queda "programado" para la apertura de su próximo día de trabajo; cada 10 minutos la base pasa a "pendiente" los que llegaron a su hora y el reloj los manda. Cambia `orden_crear_tarea` (se frena si no es la que se espera), agrega `enviar_desde` a `orden_avisos`, el valor 'programado' y un trabajo del reloj (`orden-avisos-programados`). Base de prueba 15/15; real con rollback 8/8 ("Prueba" ve los 27 módulos; la base quedó igual). La app anda igual antes y después de correrlo. | Sí: borrar las 4 funciones nuevas, volver `orden_crear_tarea` a la de la migración 1, `select cron.unschedule('orden-avisos-programados')` y pasar a 'pendiente' los 'programado'. La columna y el valor nuevo pueden quedar. |
| 114 | **sin correr** (14/10) | **"Qué hay en este módulo", separado del nombre** (recomendación aceptada: "sí, sumalo"). El nombre dice dónde está ("Vidriera") y "qué hay" lo que tiene ("Remeras"), que cambia con la temporada: antes escribir "Remeras" borraba "Vidriera". Agrega `orden_modulos.contenido` (hasta 60 letras) y `orden_modulo_contenido` (el supervisor del local y el administrador; también en lo de adentro, sin cambiar su nombre). Base de prueba 8/8; real con rollback 6/6. Sin correrlo, la app avisa "Falta correr el SQL 114" al guardar qué hay. | Sí: borrar la función y la columna (se pierde lo escrito). |

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

## El modo observador del croquis (14/10, PUBLICADO: main 08d0838, sw v132)

Pedido de Mauricio: "entender rápido cómo está armado el local", ver la foto de cada módulo y dejar sugerencias. Sólo
presentación e interacción: no cambia cómo se arma el local ni los datos. Un commit por etapa:

- **A. El observador y la vista de frente de cada módulo** (`croquis-visor.js` y `croquis-visor.css`, nuevos). El local con volumen (2.5D con CSS, sin 3D de verdad), paredes oscuras, piso de cerámica, muebles de nogal con la ropa a la vista (colgada en las paredes, doblada en las mesas, cajas en el depósito), la vidriera vidriada y la vereda. La miniatura de la foto en el frente de cada módulo (los del frente, arriba). Tocar un módulo hace zoom hasta su vista de frente: la foto grande (se carga recién ahí), quién lo tiene y quién lo cubre, la fecha, el nivel, lo que vio la IA; la vuelta es la animación inversa. Sin foto: "Pedirle la foto a…" (una tarea con foto). En la app reemplaza a Equipo → "El mapa del local" (supervisión, celular); en la administración, Por local → "Modo observador", con "Armar el croquis" (la maqueta se aplana y se abre el editor).
- **B. Ver por vendedor, por estado del orden o por antigüedad de la foto.** Sólo cambian los colores (el halo, la base y el borde del número); por vendedor, los de siempre. Leyenda a la vista con cuántos hay en cada uno, y un puntito ámbar en los sin foto reciente.
- **C. Adentro del módulo:** la foto de ahora junto a la de referencia "Así se arma en VDH" (la de Ajustes → Sectores), tocar una la agranda; un deslizador del historial ("Cómo estaba antes") que cambia la foto, el pie y lo que dijo la IA.
- **D. Resaltar:** tocar a alguien de la leyenda ilumina lo suyo y atenúa el resto (también "Sin foto", "Más de 7 días"…).
- **E. Dirección visual:** acercar y alejar (dos dedos, la rueda, + y −, "Centrar"), "Inclinado | Desde arriba" (desde arriba es el estilo de la segunda imagen de referencia), "Modo liviano", el editor del croquis con imán a la grilla y a las paredes, levantar y rebote, y el plano 2D de siempre con piso y sombras suaves. Dos rondas de pulido con fotos en celular (390×844) y PC (1366×768).
- **F. Dejar sugerencia:** texto, para cuándo y "que la devuelva con una foto nueva". Le llega al que tiene el módulo como una tarea (`orden_crear_tarea`, lo mismo que "Nueva tarea"): ni a otro ni dos veces. "Qué hay en este módulo" (Remeras, Buzos…) se escribe ahí y se lee arriba del módulo.
- **Rendimiento:** probado con el procesador 4 veces más lento y sin placa de video: abre en menos de 1 s y la animación de entrar a un módulo va a 25–33 cuadros por segundo (mediana; la primera vez, menos). La maqueta de Rivadavia son 290 elementos.
- **Pruebas:** `probar-visor.js` (85, con una base de mentira y fotos genéricas), app 147, administración 92, testigo 30, cámara.

**Decisiones que tomé (reversibles):**
- Por defecto se ve **inclinado** (lo pide el texto); "Desde arriba" queda a un toque y se recuerda la elección de vista en cada teléfono.
- Los niveles se llaman como en la app (Impecable, Bien, A mejorar, Fuera de estándar), no "excelente / bueno / regular / malo".
- **Sin foto, "Pedirle la foto"** manda una tarea con foto: sacar o subir la foto directo desde el observador necesita una función nueva en la base (abajo).
- "Qué hay en este módulo" usa el nombre propio del módulo (el mismo de "Repartir y ponerles nombre"). Lo del centro no se renombra desde el observador: su nombre es el que lo ubica en el croquis.
- Las miniaturas, por ahora, se arman en el teléfono la primera vez (240 px) y quedan guardadas en ese aparato: las próximas veces el plano abre sin bajar las fotos grandes. La foto grande se baja sólo al entrar al módulo.
- "Cambiarlo más adelante" del PIN de 6 se sacó (la otra sesión ya publicó la entrada de 6 del No Compra).

**Necesita tu OK (tocan la base o las fotos guardadas; no hice nada todavía):**
1. **Miniaturas guardadas** (para que el plano abra rápido también la primera vez en cada teléfono y en los 14 locales): al sacar una foto, la app sube también una de 240 px al lado (`…foto.mini.jpg`, unos 15 KB); un ajuste en `tick` para que el borrado de fotos viejas borre también su miniatura; y, si querés, armar las de las fotos que ya están. No necesita SQL; sí subir de nuevo `tick`.
2. **La marca sobre la foto** (círculo o flecha) en la sugerencia: la tarea necesita dónde guardarla → SQL 113 (una columna `marca jsonb` en `orden_tareas` y que `orden_crear_tarea` la acepte). Reversible.
3. **Propuesta de acomodo** (un borrador del croquis al lado del de verdad, que se aprueba): SQL 114 (guardar los borradores con quién los hizo y una función para aprobarlos, que usa la misma de guardar el croquis). Reversible.
4. **Sacar o subir la foto directo desde el observador** (sin pedírsela a nadie): una función que cree el control del módulo en el momento → SQL 115. Reversible.

**Control final (un árbitro Opus, esfuerzo alto, que usó la app en celular y PC): sin bloqueantes.** Marcó 8 importantes y 16 menores. Corregí los importantes y la mayoría de los menores, y los probé (observador 97, app 148, administración 93, testigo 30, cámara):
- Tocar el número de un módulo abría a veces el de al lado (y la sugerencia le podía llegar a otro): ahora abre el suyo (probado tocando los 24).
- Dos "atrás" seguidos dejaban el observador sin "atrás": ahora vuelven a Equipo.
- En el celular los nombres se tapaban: se leen al acercar, y enteros en "Qué hay en cada módulo" (tocar uno lo abre).
- El imán metía lo de adentro encima de los módulos de la pared: ahora pega el borde, y sólo imanta el eje que se movió.
- Una sugerencia repetida a propósito se descartaba: ahora es otra tarea (la búsqueda de "ya llegó" es sólo al reintentar después de un corte).
- Enter y Espacio abren el módulo; el foco queda en la ficha y vuelve al módulo al cerrarla.
- Aviso cuando el croquis del local no está armado (los módulos "a ojo").
- Los botones lima salían grises y la × chica (CSS); la ficha en la PC en dos columnas ("Dejar sugerencia" sin desplazar); letra más grande en el plano; "Desde arriba" se recuerda; el teclado del celular ya no saca el zoom; local sin módulos sin controles; textos del celular; el contador de tareas; las escuchas se limpian; las miniaturas viejas se borran; el historial baja cada foto una sola vez.
- **Quedan (anotados):** la primera vez en cada teléfono el plano baja las fotos grandes para armar las miniaturas (se arregla con las miniaturas guardadas: punto 1 de arriba); una foto que ya no está guardada se ve como "sin foto" pero en "Estado" cuenta su nivel; "Qué hay en este módulo" y el nombre propio son lo mismo (ver abajo).

**Lo que decidió Mauricio (14/10):** los vendedores también lo ven (desde Fotos → "Ver el local", sólo para mirar: SQL 113); si el que tiene el módulo está de franco, el aviso le llega su próximo día de trabajo (SQL 113; vale para todas las tareas que manda el supervisor, porque salen por el mismo lado, y también fuera del horario del local); arranca inclinado y "Ver por" vendedor (ya era así); 3D, más adelante. Separar el nombre y "qué hay": "sí, sumalo" (SQL 114). En el croquis se lee "qué hay" arriba de cada módulo (si no tiene, su nombre); en la vista del módulo, el nombre y aparte "Qué hay: …"; en la administración, el campo "Qué hay" en la ventana de cada módulo.

**Para que decida Mau (ya contestado arriba):**
- ¿Los **vendedores** también ven el observador (para mirar, sin sugerencias)? Hoy lo ven el supervisor, el administrador y la gerencia.
- Si el que tiene el módulo está de franco, ¿la sugerencia le llega igual a él o al que lo cubre?
- ¿Vista por defecto inclinada o desde arriba? ¿Y "Ver por" arranca en Vendedor o en Estado (el árbitro sugiere Estado para ver "de un vistazo cómo está el orden")?
- **3D de verdad** (con una librería como three.js: girar el local, caminarlo): se ve más real, pero pesa más en los teléfonos de los locales y es otra forma de dibujar todo. Lo estimo en 3 a 5 días, con riesgo medio (rendimiento en celulares viejos). Lo de ahora ya tiene volumen y anda liviano.
- Nombre y "qué hay" separados (hoy son lo mismo): necesita un campo nuevo en la base.

## El croquis como una foto (14/10, rama croquis-real, SIN publicar; sw v134, impecable-v15; sin SQL)

Pedido de Mauricio: "más parecido a la foto" (su referencia de Pinterest: un local de ropa visto desde arriba), que el
mapa de Por local y el observador "sean lo mismo", poder poner los probadores, la puerta del depósito, la galería
enfrente y mover las piezas, "algo bien tecnológico donde se vea el color de cada módulo, como si fuera un neón", y
"si pongo buzos, que aparezcan unos buzitos".

- **Un solo dibujo** (`impecable-comun.js`) para el mapa de Por local, el editor, Fotos del vendedor y la tapa de cada mueble del observador: piso de cerámica con luces (cemento en el depósito), paredes oscuras con la cara de adentro clara, la vidriera de vidrio y muebles de nogal (estantes de metal en el depósito).
- **La ropa de "qué hay"** (o del nombre, si es de ropa): 15 siluetas (remera, musculosa, buzo, sweater, campera, camisa, jean, pantalón, bermuda, vestido, pollera, zapatilla, gorra, medias, accesorios), mezcladas si dice varias ("Remeras y buzos"). Sin "qué hay", ropa colgada; en el depósito, cajas o la ropa de su categoría.
- **El neón:** la luz del color de quien tiene el módulo sobre el piso, del lado del salón, y el tubo encendido; el número va montado sobre la línea y "qué hay" adentro, a lo largo. Lo apagado (en el celular, lo de los demás), sin luz.
- **Las piezas:** probadores (con cortina, del lado del salón), caja, mesa, perchero, maniquí, planta, columna, escalera, espejo, banco, la puerta del depósito y "otra cosa". En el observador tienen volumen: el maniquí parado, la planta con copa, los escalones. Las de antes (sólo con nombre) sacan el tipo del nombre ("Mostrador" es la caja).
- **El editor:** una bandeja con las piezas (se tocan, aparecen en un lugar libre y se arrastran); en un lugar de la pared, las piezas de pared y cuántos lugares ocupa (1, 2 o 3; también un hueco); "Enfrente de la vidriera": vereda, galería o shopping.
- **Sin SQL:** `orden_croquis_guardar` guarda el croquis como viene (sólo cuenta los módulos). Lo nuevo va en el mismo croquis: `{h, k, a}` en las paredes, `tipo` en los muebles, `frente`.
- **Pruebas:** app 156, administración 100, observador 105 (con la medición de fluidez), testigo 30, cámara. Fotos del antes y el después: `scratchpad/foto-croquis.js antes|despues`; página privada: https://claude.ai/artifact/URUhmLQdnV1pSgn5uRk4pt

**Control final (árbitro Opus, esfuerzo alto, usó la app en celular y PC): APROBADO, sin bloqueantes.** Corregí:
- *Importante:* en el celular, la marca (cámara, ✓, !) tapaba el número en los módulos más anchos que altos: ahora va en la punta del módulo, sobre la pared, y el número del otro lado (probado en un local cuadrado y uno de calle).
- *Importante:* un lugar que pasaba a "Hueco" se quedaba con lo que ocupaban los probadores y no se podía cambiar: el hueco también dice cuánto ocupa.
- *Menores:* "qué hay" ya no se pierde en los módulos con marca ni lo tapa el número; los muebles nuevos no caen encima de otros; "Calzado" ya no dibuja pantalones ni "media manga" medias, y se reconocen tops, bodies, mallas, pijamas y polerones; "Entrada" entera en una pared de costado; unos probadores de antes no aparecen dos veces en el menú; en el celular la lista de muebles deja lugar al nombre.
- *Queda:* un administrador con la versión vieja guardada en el navegador, si guarda el croquis, pierde lo nuevo (el tipo de pieza y cuántos lugares ocupa) hasta que su computadora tome la v134. Tocar una pieza en el observador a veces abre el módulo que queda delante (por la perspectiva).

## El croquis con imágenes, "Desde arriba" como la foto y mover los de las paredes (14/10, PUBLICADO: 20a64f6 = v135; el arrastre, v136)

Pedidos de Mauricio (14/10): imágenes realistas de cada pieza ("tenemos créditos, hay que aprovecharlos", con sus fotos
de los módulos de referencia), "vista como la foto: desde arriba con perspectiva", la entrada de dos lugares para
centrarla ("el 1 es el módulo siguiente a la puerta") y "los de los costados se tienen que poder mover fácil, como los
del medio".

- **Imágenes** (`croquis-img/`, 20 WebP, 672 KB): hechas con Higgsfield (GPT Image 2.5, fondo transparente, unos 30
  créditos), vistas desde arriba y con el estilo de los locales (marco de hierro oxidado, estante de madera, riel negro
  tipo escalera, piso de cemento, paredes gris oliva). Ropa doblada por prenda, ropa colgada (sin "qué hay"), depósito,
  perchero, probadores, mesa, maniquí, planta, caja, escalera y el piso. Recortadas y achicadas con
  `scratchpad/sprites/procesar.js`. Las guarda el celular (sw-vendedores). Sin la carpeta (`CROQUIS_IMG` vacío) vuelven
  los dibujos.
- **"Desde arriba" como la foto:** con perspectiva y paredes altas; se ven las paredes por dentro y el frente de cada
  módulo con su foto.
- **La entrada (y la puerta del depósito) de 1 a 3 lugares:** "Ancho de la entrada", al lado de "Mover la entrada".
- **Mover los de las paredes:** se arrastra uno (con el mouse) hasta otro lugar de cualquier pared y los dos cambian de
  lugar; o, en el menú del lugar, "Cambiar de lugar con otro" y se toca adónde va (anda igual en el celular). Cada
  módulo se lleva su responsable, sus fotos y qué hay; al guardar se numeran desde la entrada.
- **Con el dedo:** sobre un lugar de una pared, la pantalla no se desliza (para desplazar, el piso o los costados);
  mantenerlo apretado lo levanta. **No se pudo comprobar** en Chrome sin pantalla que al soltarlo cambie de lugar (falló
  3 veces la prueba; regla: no hay tercera vuelta): probarlo en un celular de verdad; mientras, "Cambiar de lugar con otro".
- **Pruebas:** app 156, administración 110, observador 105 (con el procesador 4 veces más lento, 61 a 69 cuadros por
  segundo), testigo 30, cámara.

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
- **El mapa del local (SQL 99)**: se arma y se reparte en la computadora (No Compra → Impecable → Por local → "Armar el croquis" / "Repartir y ponerles nombre"), por el supervisor del local o el administrador; la gerencia sólo mira. En el celular: el vendedor lo ve en "Fotos" (antes en "Hoy") con lo suyo de su color (toca su módulo con la cámara y saca la foto) y el supervisor lo ve en Equipo → "El mapa del local", para mirar. Los módulos del salón se agregan o se sacan desde el mapa (en Ajustes → Sectores ya no hay "Agregar módulo" para el salón; en el depósito sí). Entre todas las paredes, hasta 100 módulos (lo de adentro va del 101). Mientras no se arme el mapa de un local, los módulos se dibujan en las paredes a ojo y lo avisa.
- **La Caja es una pestaña (13/10, pedido de él)**: Hoy · Fotos · Tareas · Caja · Ideas, sólo en los locales con el control de caja prendido. Desde las 19 h, si la caja de hoy no está guardada, la pestaña muestra un puntito.
- **Productos testigo (SQL 102)**: desde la administración se programa el control (día, productos y locales). El local lo ve en Hoy ("Mañana tienen producto testigo" / "Hoy: producto testigo") y llena la planilla de él: enviada, stock sistema, vendida, real, dev. a fábrica, salieron, entraron y observaciones. Todo sale del sistema, salvo la real, que se cuenta.
  - **Desvío = (stock sistema − real) ÷ enviada, en %**: él pidió que se calcule solo, y es lo que le propuse (Last Chance: faltan 2 de 15 = 13,3 %). Cambiarlo es una línea de la vista `testigo_v_items` y de la app.
  - **El video**: se graba desde la app, hasta 20 segundos, con sonido (desde el 22/10; si no dejan usar el micrófono, sin sonido) y a 640×480 (unos 2 MB). Si el celular no puede grabar adentro de la app, abre la cámara del teléfono (tope 20 MB). Mandar sin video se puede, pero lo pregunta. Se guardan 14 días; los que dieron diferencia, 90 (como las fotos con problemas). Los borra el reloj (`tick`).
  - Se carga el día del control (antes se ve, pero no se puede escribir). Mandarla pide stock sistema y real de todos los productos. Si falta o sobra algo, avisa al supervisor y al administrador.
- **Nombres de los módulos (SQL 102)**: en Por local → "Repartir y ponerles nombre", tocando el módulo ("Vidriera", "Estantería de remeras"). Se ve en el mapa (en las paredes de costado, de costado y recortado si es largo) y en la lista del vendedor. Vacío vuelve a "Módulo 7" / "Depósito 3".
- **Repartir parejo (SQL 102)**: divide los módulos (del salón o del depósito) entre los sectores que tienen responsable, en bloques seguidos y en orden; si no da justo, los últimos llevan uno más. Lo de adentro (la caja) no se toca. Se puede seguir a mano tocando cada módulo.
- **El depósito en módulos (SQL 102)**: en "Armar el croquis", la forma (largo o cuadrado) y cuántos módulos (cada uno, una foto). Se numeran 1, 2, 3… en todo el local, como las paredes. En Ajustes → Sectores, el N.º y el "Activo" de todos los módulos quedan sólo para ver: se manejan en el mapa.
- **El croquis (SQL 112, 13/10 noche, pedido de él: "que quede muy parecido a lo real")**: en Por local → "Armar el croquis" (antes "Cambiar la forma y la cantidad"). Se toca un lugar de una pared: Módulo / Módulo doble / Hueco / Algo fijo (con nombre) / "+ Un lugar" a cada lado / Sacar. "Mover la entrada" muestra + verdes entre los lugares. Lo del centro y las cosas fijas de adentro se arrastran (con el dedo o el mouse); "Acomodar solos" los vuelve a la fila del medio. Los números de arriba son los **lugares** de cada pared. Si sacás un módulo y después ponés un lugar, vuelve el último que sacaste (con su historia). En el depósito, cambiar la cantidad o la forma lo vuelve a acomodar alrededor (la puerta queda). Antes de guardar avisa cuántos cambian de número. Sin el SQL 112 corrido, "Guardar" dice que falta (no se pierde nada).
- **Sin croquis guardado, todo queda como estaba**: la entrada de siempre (abajo a la izquierda) no se dibuja y el 1 sigue en el mismo lugar. Si alguien cambia la cantidad con una app vieja, el croquis guardado deja de coincidir y se vuelve al de siempre.
- **Los recordatorios de cada día (SQL 99)**: Ajustes → "Recordatorios por día", por local. Ese día les aparecen a los vendedores arriba en "Hoy" (el supervisor no tiene "Hoy").
- **Lo de adentro (la caja, los percheros) pide foto como un módulo más**: tiene su responsable y entra en los controles, las sorpresas y el nivel. Si la caja no tiene que pedir foto, se cambia (pregunta abierta para Mauricio).
- **Al achicar el mapa**, los controles de hoy en adelante que todavía no tienen foto, de lo que se apaga, se sacan (los que tienen foto quedan). **Al repartir** (mover un módulo o cambiar quién tiene o cubre un sector), esos controles pasan a quien le toca ahora.
- El N.º y el "Activo" de los módulos del salón se manejan desde el mapa: en Ajustes → Sectores quedan sólo para ver. Si se apaga un sector del salón, al guardar el mapa sus módulos vuelven a la pared en un sector activo (los mismos, nunca dos con el mismo número).
- **El freno del PIN quedó como lo pediste** (5 mal → 5 minutos, por persona). El árbitro avisó que así se puede dejar a alguien afuera a propósito y que un PIN de 4 números aguanta pocos días de prueba sistemática: es una decisión tuya, no lo toqué.

## Pendiente (necesita a Mauricio)

1. ~~Correr el SQL 96 y el 97~~ (hecho el 13/10). ~~Correr el SQL 99 y publicar el mapa~~ (hecho el 13/10, sw v119). ~~Correr el SQL 102~~ (hecho; publicado el 13/10, sw v121). ~~Correr el SQL 106~~ (hecho). ~~Correr el SQL 111 y publicar la reorganización~~ (hecho, v127; `ideas-tablero` subida). ~~Publicar el PIN de 6~~ (v128). **Correr el SQL 110** (PIN de 6) y el **SQL 112** (croquis); su OK para publicar el croquis (sw No Compra v129, Equipo VDH impecable-v11). Cargar el tablero en Ajustes → Ideas (`https://ar.pinterest.com/Mauu_Camara/vdh-ideas/`, Destacado y Activo).
1b. **Al arrancar de verdad**: devolverle a Lautaro el sector 1 y el depósito 2, y la hora límite a 18:00 (el SQL 103 los dejó para "Prueba").
2. El día que empiecen los chicos: subir **`tick`, `resumen-semanal` y `resumen-cajas`** (el 94 ya está). Las otras 2 ya están subidas. Antes: (`entrar` de nuevo y las 4 que faltan); después, el día que empiecen, correr el **SQL 94**.
3. ~~Publicar~~ (hecho el 13/10, 41f1594).
4. ~~"Impecable" en la barra del No Compra~~ (hecho: entre Socios y Config.). La pestaña "Orden" en Estadísticas no se hizo (él eligió sólo el botón).
5. **Borrar el vendedor de prueba "Prueba"**: el 13/10 dijo "dejalo por ahora".
6. Para los avisos por Telegram: el `chat_id` de cada supervisor y el grupo de las cajas (`TELEGRAM_GRUPO_CAJAS`).
7. Productos testigo: cómo se calcula el **Desvío** de la planilla (sigue pendiente, como en el README).
8. **El modo observador**: tu OK para publicarlo (sw No Compra v132, Equipo VDH impecable-v13) y para lo de arriba que toca la base o las fotos guardadas.

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

## Revisión de la reorganización (2 rondas, 13/10 noche)

- **Ronda 1**: 1 bloqueante (con las fotos vencidas sin mandar, Hoy las tachaba como hechas y festejaba), 6 importantes (con mala señal decía "¡Listo por hoy!"; la campanita trabada en "9+"; en la caja, un comprobante vacío no avisaba nada aunque la base lo marca; el "atrás" de Android cerraba la app; el enlace de invitación del tablero viajaba a los celulares; Ideas sin fotos ni enlace con un pin.it) y 10 menores. Todos corregidos (a8cb503).
- **Ronda 2**: 16 de 17 cerrados; el del enlace, a medias (la columna `url` la lee cualquiera con sesión) → **SQL 111**. Dos importantes nuevos que trajo el arreglo del "atrás" (se acumulaban "atrás" muertos; con Avisos o el Perfil abiertos, una notificación llevaba a otro lado) y 4 menores: corregidos. No hubo ronda 3 (la regla es 2): lo corregido después lo probé yo (app 129/129, testigo 30, administración 76, foto, base de prueba 16/16, real con rollback 7/7).
- **Las mejoras que aprobó después ("sí, hacé todas las mejoras")**: el "atrás" de Android en las pantallas completas (cámara, revisión de la foto, producto testigo, test, pasos de la entrada y las del supervisor) hace lo mismo que su "‹ Volver"; el festejo del día no espera la caja ("¡Terminaste lo tuyo de hoy!"); la caja deja borrar un monto; los avisos de fotos a Fotos (SQL 111). Probado: app 134/134, testigo 30, administración 76, foto.
- **Quedaban sin tocar antes de aprobarlas**: el "atrás" en la cámara, el producto testigo, el test y el login sigue saliendo de la app; en los locales con caja, el festejo del día sólo puede salir después de guardar la caja de la noche; los avisos de controles de la base llevan a `/hoy` (podrían ir a `/fotos`); sin señal, Ideas entera dice "Sin conexión" aunque las fotos ya estén en memoria; la base no deja borrar un monto de caja ya guardado; Pinterest manda sólo los últimos ~25 pines por tablero.
