# Módulo VDH — guía de integración al sistema No Compra

> Para Claude Code. Este paquete ya trae hecha y probada la parte de **base de datos y servidor**
> (Supabase). Falta construir las **pantallas**: la app del celular (vendedores y supervisores)
> y las secciones nuevas de No Compra. Antes de tocar nada, leé las secciones 1 a 3.

---

## 0. Cómo trabajar en este proyecto (reglas de Mau)

Si no existe, copiá estas reglas al `CLAUDE.md` de la carpeta del sistema No Compra:

- **Revisiones: como máximo 2 rondas** de prueba y arreglo por tarea. Después, cerrar y reportar. No hacer "árbitros" ni rondas extra sin que lo pida.
- **Si una prueba falla 2 veces por el mismo motivo, parar** y explicarle el problema en palabras simples, con las opciones, en vez de seguir intentando.
- **Si una tarea lleva más de 30 minutos, parar** y contarle cómo va antes de seguir.
- **Al terminar cada parte:** lista corta de qué quedó hecho, qué falta y qué tiene que probar él a mano.
- **Antes de cambios grandes, guardar una copia** de lo que ya funciona (commit o copia de la carpeta).
- **Ir por partes:** primero la base y las funciones (sección 4), después la app del vendedor, después la del supervisor,
  después No Compra. No arrancar la parte siguiente sin que él haya probado la anterior.
- **Prioridad: que funcione y sea simple.** No pulir ni agregar cosas que no pidió. Si algo de esta guía no tiene sentido
  con lo que ya existe en No Compra, preguntar antes de rehacerlo.
- Hablarle en español rioplatense, sin tecnicismos.

---

## 1. Qué es y para qué

App para los vendedores de los locales de VDH (ropa urbana de hombre, ~14 locales en Mar del Plata y GBA).
El objetivo central es que **cada vendedor se haga responsable del orden de sus módulos**:

- Cada vendedor tiene **módulos fijos** (≈5 por vendedor, ≈15 por local) y un sector del **depósito**.
- Los días de control saca **una foto por módulo desde la app**. La **IA revisa la foto al instante**
  (frontal incompleto, prendas mal dobladas, etc.) y **crea tareas** de lo que hay que corregir.
- Antes de enviar responde **4 preguntas sí/no**. El **supervisor confirma** el nivel con un toque.
- **Notificaciones**: aviso a la mañana, recordatorio a la tarde, aviso al supervisor si no cumple.
- **Tareas** (de la IA, del supervisor o del admin) con plazo, foto de "hecho" y "pedir más tiempo".
- **Registro y estadísticas** en No Compra: controles a tiempo, tareas hechas/fuera de plazo, nivel semanal.
- **Faltas**: el sistema *sugiere* advertencia → apercibimiento → suspensión. **Siempre decide una persona.**
- **Desafío semanal** (opcional): 5 preguntas de telas, molderías y Manual Retail. Es para aprender:
  no cuenta para faltas.
- **Control de caja** (opcional): fotos del cierre, la IA lee los montos, se calculan desvíos y se avisa.
- **Productos testigo**: sección de No Compra para cargar el conteo semanal (no va en el celular).

Piloto: **local Rivadavia** (Mar del Plata).

**Arquitectura en una línea:** la **app es para los vendedores** (y el supervisor del local); las **estadísticas,
la configuración y la vista "Cómo está el local" viven en el sistema No Compra**, para Mau, los supervisores y gerencia.

**Prioridad absoluta: SIMPLE.** Mau (el dueño) lo pidió muchas veces. Ante la duda, menos pantallas y menos campos.

---

## 2. Qué trae este paquete

```
supabase/
  migrations/
    20261012000001_orden_esquema.sql      tablas, funciones, seguridad (RLS), vistas  ← el corazón
    20261012000002_orden_storage.sql      bucket de fotos y sus permisos (solo Supabase)
    20261012000003_orden_cron.sql         reloj automático con pg_cron (solo Supabase)
    20261012000004_orden_datos_iniciales.sql  reglas de orden, colores, exhibidores, local Rivadavia
    20261012000005_orden_preguntas.sql    61 preguntas del desafío (de los manuales de VDH)
    20261012000006_orden_cajas.sql        control de caja + limpieza de fotos viejas
  functions/
    _shared/comun.ts     clientes Supabase, CORS, descarga de fotos
    _shared/ia.ts        revisión de fotos de módulos con la API de Claude (+ ia_test.ts)
    _shared/caja_ia.ts   lectura de montos de fotos de caja
    _shared/envios.ts    web push y Telegram
    analizar-foto/       la llama la app después de cada foto de módulo
    leer-caja/           la llama la app después de cada foto de caja
    tick/                la llama pg_cron cada 15 min (genera, avisa, vence, escala, limpia)
    resumen-semanal/     lunes 08:30: resumen de la semana por Telegram
    resumen-cajas/       23:30: cómo dieron las cajas, al grupo de Telegram
  tests/
    00_stubs_local.sql   imita auth de Supabase para probar en un Postgres común
    01_prueba_flujo.sql  simula una semana en Rivadavia: 60 verificaciones
cliente/
  orden-api.ts           todas las llamadas que necesitan las pantallas (supabase-js v2)
  sw-push.js             código para el service worker (notificaciones)
```

**Estado:** el SQL corre limpio en Postgres 16 y pasa las 60 verificaciones de `01_prueba_flujo.sql`
(incluye las de una revisión independiente del código: los 11 problemas que encontró están corregidos y probados).
Las 5 Edge Functions pasan `deno check`, y las pruebas de la IA (`ia_test.ts`) pasan.
`orden-api.ts` compila con `tsc --strict`. Todavía **no se probó contra un Supabase real ni contra la API de Claude**
(ver sección 8).

---

## 3. Decisiones ya tomadas (no rediscutir sin Mau)

**Orden y fotos**
- Las fotos se sacan **solo desde la app** (cámara, no galería) y quedan con la hora del servidor.
- Las 4 preguntas de "Antes de enviar" se quedan. Salón: ¿dobladas y prolijas? ¿Frontales completos (4 prendas)?
  ¿Etiquetas adentro y con precio? ¿Limpio y sin faltantes? Depósito: dobladas A4 / rotulado / segmento y talle / limpieza.
- Niveles (sin porcentajes): **Impecable · Bien · A mejorar · Fuera de estándar**. 4 sí = Impecable, 3 = Bien, 2 = A mejorar, 1 o 0 = Fuera.
- El supervisor puede mover el nivel **un escalón**. Para moverlo más, tiene que dejar un comentario (lo valida la base).
- Si falta mercadería para un frontal, **se cambia por otro producto**. Nunca se deja incompleto, y no existe la excusa "sin stock".
- **No** hay ranking entre vendedores ni entre locales. En su lugar está **Ideas**: enlaces a tableros de Pinterest.
- Días de apertura configurables por local (no todos abren el domingo). Los días cerrados no piden ni cuentan nada.

**IA**
- Primera etapa: la IA marca **solo problemas puntuales a corregir**. Las sugerencias de estilo están apagadas (`ia_sugerencias`).
- Cada problema "a corregir" se convierte en **tarea** con plazo "hoy". Si el vendedor saca otra foto y ya está bien, la tarea **se cierra sola**.
- Con confianza baja, la IA **no** crea tareas (protección contra falsos positivos).
- Las **reglas de orden** viven en la tabla `orden_reglas` y se editan desde No Compra. La IA las lee en cada foto: **no hay que entrenar nada**.
- Si la IA falla, el vendedor **no queda trabado**: puede enviar igual y lo revisa el supervisor.
- **No** mencionar "prendas en el piso" (no pasa en los locales).

**Plazos y faltas**
- Tareas de la IA: vencen **el mismo día** a la hora límite (si queda menos de 1 h, pasan al próximo día que trabaja).
  Tareas del supervisor/admin: **mañana a la hora límite** por defecto. Los francos, vacaciones y días cerrados no cuentan.
- Botón **"Pedir más tiempo"** (una vez por tarea). Mientras espera respuesta, la tarea no vence.
- Falta sugerida cuando, en 30 días, hay **3 días con tareas fuera de plazo**, **3 días con controles sin mandar** o
  **2 días con algún control "Fuera de estándar"** (todo configurable). Se cuentan **días**, no cosas: un día malo **no** alcanza.
- **Modo prueba** (prendido por defecto): no se sugieren faltas. Mau quiere 2–3 semanas de prueba antes.
- La app **nunca sanciona sola**: sugiere y la persona confirma o descarta. Antes de usar las sanciones en serio, Mau las va a validar con un abogado laboral.

**Ver el local y fotos**
- En No Compra, al elegir un local, se ve **"Cómo está el local"**: la última foto de cada módulo y del depósito, con nivel,
  fecha, quién la sacó y tareas abiertas. Es la pantalla principal para Mau y para los dueños.
- Rol **`gerencia`** (ej. los dueños): ve todos los locales, fotos y estadísticas, pero **no cambia ni califica nada**.
- Las fotos se guardan **1 mes** (`dias_guardar_fotos` = 30, configurable, **mínimo 7 días**) y **solo se borran si el
  supervisor ya las controló**. Las de módulos con "A mejorar" o peor se guardan **90 días** (respaldan una posible falta),
  y las de caja, **60 días**. **La última foto de cada módulo nunca se borra**, para que "Cómo está el local" siempre
  tenga imagen. Los datos (niveles, tareas, estadísticas) no se borran nunca: solo las imágenes.

**Configuración**
- **Toda la configuración está en No Compra y la maneja solo el admin (Mau)**: qué está prendido, horarios, reglas,
  sectores, módulos, personas, locales. La app del celular **no tiene pestaña de configuración**.
  El vendedor solo edita su **perfil** (nombre y foto).
- Cada parte se prende por local: `desafio_activo` y `caja_activa` arrancan **apagados**. El piloto empieza solo con el orden.

**Notificaciones**
- Son clave. La app tiene que **insistir** en activarlas (pantalla de bienvenida). En iPhone solo funcionan si la app está
  **instalada en la pantalla de inicio** (iOS 16.4 o más): hay que explicarlo con un paso a paso de 3 dibujos.
- No Compra muestra quién **no** tiene las notificaciones activadas (`orden_v_personas.avisos_activos`).
  El resumen semanal también lo lista.
- Hay un tope de avisos "normales" por día (`max_avisos_dia`) para que no las silencien.
  Los importantes (prioridad 2) siempre salen.

**Desafío semanal**
- Le llega a cada vendedor **un día y a una hora al azar**, con 5 preguntas de opción múltiple. Las categorías se alternan
  por semana: **telas y molderías** / **cómo trabajamos en el local** (Manual Retail).
- **No se llama "evaluación"**: es un desafío o test liviano. Si le erra, no pasa nada. Después de cada respuesta ve la explicación.
- La dificultad sube sola: las primeras veces es fácil y después sube si le va bien. Lo que respondió mal vuelve a aparecer.
- El puntaje aparece en las estadísticas y **no cuenta para faltas**.

**Control de caja**
- Una carga por local y por día al cierre: fotos de **cierre del sistema**, **cierre de lote del posnet**, **Mercado Pago**
  y **Go Cuotas** (si hubo), más el **efectivo contado** escrito a mano.
- La IA **solo lee** los números para precargar el formulario: **la persona confirma**. La base compara lo cargado con lo
  leído y detecta **fotos de otro día**.
- Desvío = cierre de caja − real (positivo = falta plata), igual que la planilla "Control Diario".
- Alertas: desvío → al supervisor y a Mau en el momento. Local sin cargar 1 h después del cierre → al local y al supervisor.
  A la mañana siguiente sigue sin cargar → a Mau. El supervisor no la controló en 24 h → a Mau.
- El supervisor tiene que marcar cada día como **"controlada"**. Si hubo alertas, tiene que escribir qué pasó.
- Todas las noches sale un resumen al **grupo de Telegram**: "todas dieron bien" / "faltó cargar X" / "diferencia en Y".

---

## 4. Integración con lo que ya hay en No Compra

1. **Lo que ya existe en No Compra** (repo `sistema-no-compra`, revisado el 12/10/2026) y cómo encajar:
   - **Locales:** `locales(codigo text pk, nombre, activo)`. Agregá a `orden_locales` una columna
     `codigo text unique references locales(codigo)` y usala para cruzar. `orden_locales` se queda con lo propio
     (días que abre, horarios, zona horaria).
   - **Usuarios:** `usuarios(uid → auth.users, mail, rol rol_usuario ('atencion','admin'), activo)`, con login por
     link al mail (`/auth/v1/otp` en `datos.js`). Mau, los supervisores y gerencia usan esa misma cuenta: vinculá
     `orden_personas.auth_user_id` con el mismo `uid` y poneles el rol de `orden_personas` que corresponda
     (`admin`, `supervisor` o `gerencia`).
   - **Vendedores:** en `equipo(id, local, vendedor)` son solo nombres, sin cuenta. Para esta app cada vendedor
     necesita su propio login (las fotos y tareas son personales). Agregá `orden_personas.equipo_id references equipo(id)`
     y creale una cuenta de Supabase Auth a cada uno (sección 4.6).
   - **Permisos:** todo se apoya en **5 funciones**: `orden_yo_id`, `orden_es_admin`, `orden_es_supervisor_de`,
     `orden_ve_local` y `orden_es_servicio`. Si conviene que `orden_es_admin` mire `usuarios.rol = 'admin'`,
     **adaptá solo esas 5**.
   - **Frontend:** No Compra es HTML + JavaScript sin framework, publicado en GitHub Pages, y llama a Supabase con
     `fetch` a través de `pedir()` y las RPC de `datos.js` (no usa supabase-js). **Pasá `cliente/orden-api.ts` a JS en ese
     mismo estilo:** qué RPC se llama y con qué parámetros es exactamente lo mismo.
   - **Una sola app instalada:** los vendedores ya tienen No Compra instalada en el celular. Sumá estas pantallas como
     páginas nuevas dentro de la misma PWA (mismo `manifest.json` y `sw.js`), no como otra app. Así no instalan nada
     nuevo y el permiso de notificaciones es uno solo.
   - **Notificaciones:** ya funcionan para VDH Club con la Edge Function `mandar-avisos` (VAPID propio, secreto
     `VAPID_PRIVADA`). **Reusá ese código y esas llaves** para mandar los `orden_avisos` en lugar de `npm:web-push`:
     reemplazá el envío push de `_shared/envios.ts` por el de `mandar-avisos`.
   - **Sin señal:** `datos.js` ya tiene una cola para lo que se carga sin señal (distingue "no llegó" de "rechazado").
     Usá el mismo mecanismo para las fotos: si no hay señal, se guardan en el teléfono y se suben solas.
   - **El repo es público:** está bien así porque la seguridad vive en la base (RLS y funciones), pero **nunca** subas
     claves (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, VAPID): van solo como secretos de Supabase.
   - Nombres: todo usa los prefijos `orden_` y `testigo_`, así que no choca con las tablas de No Compra.
2. Corré las migraciones en orden (`supabase db push` o el SQL Editor). La 4 crea el local Rivadavia con su equipo.
   Si ya existen, editala antes.
3. Antes de la migración 3, guardá los secretos en Vault (instrucciones en el archivo).
4. Variables de las Edge Functions (`supabase secrets set ...`):

   | Variable | Para qué |
   |---|---|
   | `ANTHROPIC_API_KEY` | API de Claude (cuenta en console.anthropic.com, aparte de la suscripción) |
   | `ORDEN_IA_MODELO` | opcional; por defecto `claude-sonnet-5-5`. Probar un modelo más barato si acierta igual |
   | `ORDEN_CRON_SECRET` | la misma clave que `orden_cron_secret` en Vault |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | web push (`npx web-push generate-vapid-keys`) |
   | `TELEGRAM_BOT_TOKEN` | bot para avisos a supervisores/admin y resúmenes |
   | `TELEGRAM_GRUPO_CAJAS` | id del grupo de encargados/supervisores (el bot tiene que estar en el grupo) |
   | `APP_URL` | URL de la app (para los links de Telegram) |

5. Deploy:
   ```
   supabase functions deploy analizar-foto
   supabase functions deploy leer-caja
   supabase functions deploy tick --no-verify-jwt
   supabase functions deploy resumen-semanal --no-verify-jwt
   supabase functions deploy resumen-cajas --no-verify-jwt
   ```
   Si `npm:web-push` da problemas en el runtime de Supabase, usar `jsr:@negrel/webpush`: solo cambia `_shared/envios.ts`.
6. **Usuarios:** crear un usuario de Supabase Auth por persona y vincularlo con `orden_personas.auth_user_id`.
   Sugerencia para que sea simple: email interno (`lautaro.rivadavia@vdh.local`) más un PIN de 6 dígitos como contraseña,
   y sesión que no expire.
7. **Plan de Supabase:** con 14 locales, las fotos superan el 1 GB del plan gratis, que además pausa el proyecto si no se usa.
   El plan Pro trae 100 GB (un mes de fotos de 14 locales ronda 1 GB). La limpieza automática (todos los días a las 03:00)
   borra las fotos de módulos ya controladas al mes, las que tuvieron problemas a los 90 días y las de caja a los 60 días,
   siempre dejando la última foto de cada módulo. Todo es configurable desde No Compra.

---

## 5. Pantallas a construir

Hay un **diseño de referencia** hecho con Mau ("Módulo VDH - Pantallas"). Le gustó mucho, así que hay que respetarlo:
fondo oscuro con acento lima, estilo iPhone y tipografía **Manrope**.

| Token | Color |
|---|---|
| Fondo | `#0E1116` |
| Tarjeta | `#171C24` · borde `#252B35` |
| Acento (lima) | `#C6F432` (texto encima: `#0E1116`) |
| Texto / secundario | `#F4F5F7` / `#8B94A3` |
| Impecable / Bien | lima / verde `#5BD68A` |
| A mejorar / Fuera de estándar | ámbar `#F5B84B` / rojo `#FF8A8A` |

Botones de al menos 44 px de alto. Textos en español rioplatense (vos), cortos.

### 5.1 App del celular — PWA instalable
Una sola app. Muestra pestañas distintas según el rol (`orden_personas.rol`).

**Vendedor** — pestañas: `Hoy · Tareas · Ideas · Perfil`
- **Bienvenida (una vez):** activar notificaciones, con el paso a paso para iPhone. Si no las activó, mostrar un banner fijo.
- **Hoy:** saludo, tarjeta lima "3 de 6 controles" con barra y "tu orden esta semana: Bien", y la lista de módulos y depósito
  con su estado (Listo / Corregir / Control sorpresa / Pendiente) y botón de cámara.
  `misControles()`, `miHistorial()`.
- **Foto:** cámara dentro de la app (`getUserMedia`) con un recuadro guía y la foto de referencia en miniatura.
  Después de sacarla: `fotoDeControl()` → tarjeta **"Revisión automática"** con el nivel sugerido y lo que hay que corregir.
  Cada foto se analiza **una sola vez**: para volver a revisar, se saca otra. Sin señal, la foto queda en cola y se sube sola.
  Botón "Repetir foto". Abajo, las 4 preguntas sí/no y "Enviar" (`enviarControl()`).
  Si la IA marcó algo, el botón dice "Corregí y sacá otra foto". Después del 2.º intento, mostrar también "Enviar igual".
- **Tareas:** avisos arriba; tareas con su origen ("detectada por la IA" / "pedida por Mau" / "pedida por el supervisor"),
  chip de vencimiento ("Vence hoy 18:00") y botones "No pude", "Hecha (+ foto)" y "Pedir más tiempo".
  `misTareas()`, `completarTarea()`, `noPudeTarea()`, `pedirMasTiempo()`, `misAvisos()`.
- **Desafío** (desde el aviso o desde Hoy): una pregunta por pantalla, 4 opciones grandes y la explicación después de responder.
  Al final, "Acertaste 4 de 5". `miDesafio()`, `responderDesafio()`.
- **Ideas:** tablero destacado "Frontales de la semana", la grilla de tableros y el botón **"Regla de colores"**
  (degradé del blanco al negro). `tableros()`, `reglaDeColores()`.
- **Perfil:** nombre, foto, "mi historial" (nivel por semana, tareas, desafíos) y las faltas confirmadas con su descargo.
  `actualizarPerfil()`, `miHistorial()`.
- **Caja** (solo si `caja_activa`): 4 botones de foto (sistema, lote, MP, Go Cuotas) que precargan los montos,
  un campo "efectivo contado", y "Guardar". `cajaDeHoy()`, `fotoDeCaja()`, `guardarCaja()`.

**Supervisor** — pestañas: `Revisar · Equipo · Cajas · Ideas` (**sin** Config)
- **Revisar:** cola `porRevisar()` (primero lo dudoso). Por cada foto: nivel que sugiere la IA, chips de los 4 puntos,
  comentario y 4 botones de nivel (`revisarControl()`). Siguiente.
- **Equipo:** Esta semana / Mes. Por vendedor: controles a tiempo, tareas, nivel, desafío. "Sin hacer hoy" con botón "Recordar" (`recordar()`, como mucho uno por hora).
  Pedidos de más tiempo (`responderProrroga()`), faltas sugeridas (`faltasParaDecidir()`, `decidirFalta()`),
  "Nueva tarea" (`crearTarea()`) y "Cancelar tarea" con motivo (`cancelarTarea()`).
- **Cajas:** días cargados sin controlar, con alertas en rojo. Ver fotos y "Dar por controlada" (con nota si hubo alertas).
  Si alguien corrigió la caja después de cargarla, mostrar `historial` (quién, cuándo, valores anteriores).
  Los vendedores solo pueden tocar la caja de hoy y de ayer; los días anteriores, solo el supervisor.

### 5.2 Sistema No Compra — secciones nuevas (admin, supervisores y gerencia)
0. **Cómo está el local** (la pantalla principal de esta sección): se elige un local y aparece una grilla con
   **la última foto de cada módulo y de cada sector del depósito**, con el chip de nivel en color, la fecha
   ("hace 2 días"), el responsable y las tareas abiertas. Marcar en gris los que no tienen foto reciente
   (`sin_foto_reciente`). Al tocar una foto: la foto grande y las anteriores del módulo que todavía se guardan.
   Arriba, el resumen del local: nivel de la semana, controles a tiempo y tareas pendientes.
   `estadoLocal()`, `fotosDelModulo()`, `estadisticas()`. Tiene que verse bien en el celular, porque los dueños lo van a mirar ahí.
1. **Seguimiento:** filtros por local y semana/mes. Tabla por vendedor de `orden_v_persona_semana`, evolución del nivel,
   tareas por origen (IA / supervisor / admin) y quién no tiene avisos activados (`orden_v_personas`).
2. **Tareas:** crear tareas para una o varias personas, con plazo y "pide foto". Lista con filtros.
3. **Faltas:** sugeridas para decidir e historial por persona.
4. **Control de cajas:** una pestaña por local con la misma forma que la planilla "Control Diario"
   (MP / Tarjeta / Go Cuotas / Efectivo: cierre, real, desvío y observaciones). Totales del mes de `orden_v_cajas_mes`.
   Cada fila abre sus fotos.
5. **Productos testigo:** carga semanal por local (`testigo_semanas`, `testigo_items`) con la forma de la planilla
   (Item, Producto, Color, Enviada, Stock sistema, Cantidad real, Dev. a fábrica, Salieron, Entraron). Calculados en
   `testigo_v_items`: **Vendida**, **Diferencia** y **Desvío (pendiente, ver sección 9)**.
6. **Configuración de la app** (solo admin):
   - Locales: días que abre, horario.
   - Personas: rol, local, francos, Telegram.
   - Sectores (responsable y suplente) y módulos (con la foto de referencia y el exhibidor).
   - Horarios de avisos, días de control, sorpresas por semana, cambio de imagen.
   - Interruptores: IA, IA crea tareas, sugerencias de la IA, modo prueba, desafío, caja.
   - Umbrales de faltas.
   - Reglas de orden, regla de colores, exhibidores (cantidad mínima y máxima de prendas), tableros de Pinterest.
   - Banco de preguntas del desafío.
   Todo es CRUD directo sobre las tablas `orden_*`: la seguridad ya deja editar solo al admin.

---

## 6. Cómo funciona por dentro (resumen)

- **`orden_tick()`** (cada 15 min, se puede correr las veces que sea sin duplicar): genera los controles programados
  (días de control), las sorpresas (día y módulo al azar por sector) y el depósito semanal; crea la tarea de cambio de imagen
  y los desafíos; manda el aviso de la mañana y el recordatorio de la tarde; vence controles y tareas; avisa a supervisores;
  avisa a admins de fotos sin revisar en 24 h y de quien no sube fotos hace 3 días; sugiere faltas.
- **Avisos:** todo se encola en `orden_avisos` (con `clave` única para no repetir) y la Edge Function `tick` los manda.
  Los vendedores los reciben por push; supervisores y admins, por push y Telegram. Siempre quedan visibles dentro de la app.
- **Asignación:** cada sector tiene responsable y suplente (Mel, el franquero, cubre a quien no está). Los francos fijos
  están en `orden_personas.dias_libres` y las vacaciones en `orden_ausencias`.
- **Seguridad:** RLS en todas las tablas. El vendedor ve solo lo suyo y escribe solo a través de funciones que validan todo.
  El banco de preguntas no es visible para vendedores (tiene las respuestas).

---

## 7. Fases sugeridas

1. **Piloto Rivadavia, 2–3 semanas, modo prueba:** orden de módulos, IA, tareas, avisos y revisión del supervisor.
   Medir: controles a tiempo, tareas en plazo y **cuánto acierta la IA** (comparar `nivel_ia` con `nivel_final`).
2. Ajustar las reglas y los umbrales con lo medido. Sacar el modo prueba y prender el desafío.
3. Prender el control de caja en Rivadavia. Después, en el resto de los locales.
4. Sumar las sugerencias de la IA (combinación de colores, cómo dejarlo más lindo).

---

## 8. Probar

```bash
# Postgres local (sin Supabase):
psql -v ON_ERROR_STOP=1 -d prueba \
  -f supabase/tests/00_stubs_local.sql \
  -f supabase/migrations/20261012000001_orden_esquema.sql \
  -f supabase/migrations/20261012000004_orden_datos_iniciales.sql \
  -f supabase/migrations/20261012000005_orden_preguntas.sql \
  -f supabase/migrations/20261012000006_orden_cajas.sql \
  -f supabase/tests/01_prueba_flujo.sql        # termina con "PRUEBA COMPLETA: todo OK"

deno test supabase/functions/_shared/ia_test.ts
```
**Pendiente de probar en real:**
- Las Edge Functions contra Supabase.
- La IA con fotos reales: el prompt está en `_shared/ia.ts`; ajustar con las fotos de referencia que va a pasar Mau.
- La lectura de cajas con fotos reales: pantallas fotografiadas con moiré y listas de Mercado Pago cortadas.
- El push en Android y en iPhone instalada.

**Costo de la IA:** una foto de 1280 px son ~1.600 tokens de imagen (el doble si va con foto de referencia), más ~1.500 de
texto y ~400 de respuesta. Calcular con el precio vigente del modelo elegido y el volumen real del piloto.

---

## 9. Preguntas abiertas para Mau

- **Productos testigo:** ¿cómo se calcula el **Desvío** de la planilla? (`testigo_v_items.desvio` está en null). ¿Quién lo carga, encargado o supervisor?
  Ojo: en el ejemplo, "Denim Vint" no cierra con Vendida = Enviada − Stock.
- **Rivadavia:** ¿abre los domingos? (la semilla dice que no, pero Mariana cubre domingos). ¿Quién es el supervisor?
  ¿Qué francos tiene cada uno?
- **Exhibidores:** cantidad mínima y máxima de prendas de cada tipo (Mau las va a pasar).
- **Regla de colores:** confirmar el orden propuesto (está en la migración 4).
- **Caja:** confirmar que "Efvo cierre caja" de la planilla es el **Saldo final en efectivo** del sistema.
  ¿Qué pantalla de Mercado Pago muestra el total del día? (si es solo la lista, puede quedar cortada).
- **Nombre** de la app y del desafío.
