-- VDH Club · LOS PUNTOS
--
-- Se corren en este orden: primero la parte 13 (el motor, corrida el
-- 27/09/2026) y después la 14 (la tarjeta sabe del límite anual). Va después de
-- club.sql, que es la versión con sellos: esto la reemplaza.
--
-- Antes de correrse, cada parte se ensayó contra la base de verdad adentro de
-- una transacción que termina en ROLLBACK. El ensayo de la 13 encontró que
-- Postgres no deja cambiar el tipo de una columna que usa una vista; leyendo
-- no se veía.


-- ─────────────────────────── PARTE 13 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · DE SELLOS A PUNTOS
--
-- Correr entero en el editor SQL de Supabase. Es el motor nuevo del Club.
--
-- Después de correr esto, la tarjeta y la caja van a mostrar cosas raras
-- hasta que actualice las dos páginas: cambia la FORMA de lo que devuelven
-- las funciones, no sólo los números. No hay socios todavía, así que no hay
-- nada que romper — pero no lo corras el día que salga la app.
--
-- ══════════════════════════════════════════════════════════════════════════
-- POR QUÉ SE CAMBIA
-- ══════════════════════════════════════════════════════════════════════════
--
-- El sello premia igual al que compra medias que al que compra una campera.
-- En una cafetería da lo mismo porque todos los tickets son parecidos; acá
-- un ticket es $30.000 y otro $250.000, y el que gasta ocho veces más se da
-- cuenta de que recibe lo mismo.
--
-- La decisión de guardar el importe desde el primer día —aunque la regla de
-- entonces no lo mirara— es lo que hace que esto sea encender una regla y no
-- una migración.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LA ECONOMÍA, DECIDIDA CON NÚMEROS REALES (27/09/2026)
-- ══════════════════════════════════════════════════════════════════════════
--
--   1 punto = $100 de compra          ticket promedio VDH: $80.000
--                                     o sea ~800 puntos por compra
--
--   Accesorio  1.500 pts  = $150.000  cuesta $3.500 →  2,3% de la venta
--   Perfume    2.500 pts  = $250.000  cuesta $5.000 →  2,0%
--   Remera     3.500 pts  = $350.000  cuesta $5.000 →  1,4%
--
-- El costo del premio es el COSTO de VDH, no el precio de vidriera: un
-- perfume que se vende a $24.000 cuesta $5.000. Por eso el premio es un
-- producto y nunca un descuento — un descuento de $24.000 cuesta $24.000.
-- Esa diferencia es todo el negocio del programa.
--
-- El accesorio es el más caro en porcentaje Y ESTÁ BIEN QUE LO SEA: es el
-- único escalón que se alcanza rápido, y sin un primer canje el programa es
-- una promesa y no una costumbre. Por eso además tiene límite anual.
--
-- Con el bono de bienvenida (500 puntos) el primer canje cae en la segunda
-- compra. Ese es el momento en que el cliente entiende que esto es de
-- verdad, y es el que decide si el programa vive.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LO QUE NO SE COPIÓ DE LA COMPETENCIA
-- ══════════════════════════════════════════════════════════════════════════
--
-- Rachas y ranking. Son mecánicas de cafetería, donde alguien pasa veinte
-- veces por mes. Acá un cliente vuelve dos o cuatro veces al año: una racha
-- no existe, y un ranking además muestra quién gasta más que quién.
--
-- Reseñas de Google a cambio de puntos. Google lo prohíbe explícitamente y
-- puede borrar las reseñas y restringir la ficha del negocio. Una ficha
-- restringida en Maps duele mucho más de lo que suma el programa.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · LAS REGLAS
-- ══════════════════════════════════════════════════════════════════════════

insert into club_reglas (clave, valor) values
  ('pesos_por_punto',   '100'),   -- $100 de compra = 1 punto
  ('bienvenida_puntos', '500'),   -- de regalo al anotarse
  ('vence_meses',       '12'),    -- sin comprar por 12 meses, se vencen todos
  ('exige_ticket',      'si'),    -- el número de BlueSoft es obligatorio
  ('tope_importe',      '1000000')-- arriba de esto la caja pregunta antes
on conflict (clave) do update set valor = excluded.valor;

/* Las de los sellos quedan en null. No se borran: si algún día alguien
   consulta por qué una tarjeta vieja decía "de 10", la fila estuvo. */
update club_reglas set valor = null where clave in ('meta_sellos', 'premio');


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · LA COLUMNA
--
-- `sellos` pasa a llamarse `puntos`. No es cosmético: son dos cosas
-- distintas —un sello es un evento, un punto es una moneda— y dejar el
-- nombre viejo garantizaba que dentro de seis meses alguien leyera "sellos"
-- y entendiera otra cosa.
--
-- Y pasa a `integer`: una compra de $5.000.000 son 50.000 puntos, y en
-- smallint (máximo 32.767) eso explota en la caja con el cliente adelante.
-- ══════════════════════════════════════════════════════════════════════════

/* La vista se va PRIMERO. Postgres no deja cambiar el tipo de una columna
   que usa una vista, y v_club_clientes la usa: sin esto el script se frena
   acá con "cannot alter type of a column used by a view". Lo encontró el
   ensayo, no la lectura. Se vuelve a crear en la sección 5. */
drop view if exists v_club_clientes;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_name = 'club_movimientos' and column_name = 'sellos') then
    alter table club_movimientos rename column sellos to puntos;
  end if;
end $$;

alter table club_movimientos alter column puntos type integer;
alter table club_movimientos alter column puntos set default 0;

/* Un canje AHORA SÍ resta. Era la regla contraria y estaba bien para sellos:
   llevarte el perfume de las 5 no podía alejarte de la remera de las 10.
   Con puntos es al revés —el punto es una moneda y gastarla la gasta— y esa
   restricción impedía guardar el movimiento en negativo. */
alter table club_movimientos drop constraint if exists canje_no_resta;

/* Y un premio se puede canjear MUCHAS veces. El índice único por (cliente,
   hito) era el que impedía llevarse dos perfumes con los mismos cinco
   sellos; con puntos, el que tiene 5.000 puntos se lleva dos perfumes y
   está perfecto, porque los pagó. El límite ahora vive en el premio. */
drop index if exists club_mov_hito_unico;

/* Qué premio se llevó. La columna `hito` queda para los movimientos viejos
   de prueba y no se usa más. */
alter table club_movimientos add column if not exists premio smallint;

/* Para los movimientos que no son ni compra ni canje: el bono de bienvenida,
   el vencimiento, una corrección a mano.

   Va como columna de texto y no como valor nuevo del enum `club_tipo_mov`
   por una razón práctica: Postgres no deja usar un valor de enum recién
   agregado dentro de la misma transacción, y el editor de Supabase corre
   todo el archivo en una sola. Sería una trampa para el que corra esto. */
alter table club_movimientos add column if not exists concepto text;

create index if not exists club_mov_concepto on club_movimientos (cliente, concepto)
  where concepto is not null and anulado is null;

comment on column club_movimientos.puntos is
  'Suma en las compras, resta en los canjes y en los vencimientos. El saldo es la suma de esta columna.';


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · EL CATÁLOGO DE PREMIOS
--
-- Reemplaza a club_hitos. La diferencia de fondo: un hito era un ESCALÓN del
-- camino (a las 5 compras), un premio es un PRECIO (cuesta 2.500 puntos). Se
-- puede canjear muchas veces mientras alcance el saldo.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_premios (
  id      smallint primary key,
  nombre  text not null,
  /* La letra chica, que tiene que estar escrita ANTES de que alguien venga a
     reclamar: "modelos seleccionados" es lo que evita que un día alguien
     canjee la prenda más cara del local. */
  detalle text,
  puntos  integer not null check (puntos > 0),

  /* Cuánto vale en la vidriera. Es lo que ve el cliente, y es la mitad del
     premio: "canjeaste $24.000" pesa más que "canjeaste 2.500 puntos". */
  valor numeric(12,2),

  /* Lo que le cuesta a VDH. ESTO NO SALE NUNCA A LA TARJETA. Está acá para
     que el panel pueda decir cuánto cuesta el programa de verdad, y nada
     más. Si algún día aparece en una respuesta al cliente, es un error. */
  costo numeric(12,2),

  /* Cuántas veces por año lo puede canjear el mismo socio. null = sin
     límite. El accesorio lo tiene porque es el escalón barato: sin límite,
     el que compra seguido se lleva una gorra por mes. */
  limite_anual smallint,

  orden  smallint not null default 0,
  activo boolean  not null default true
);

insert into club_premios (id, nombre, detalle, puntos, valor, costo, limite_anual, orden) values
  (1, 'Accesorio VDH', 'Gorra, medias o billetera, de los modelos del local.',
      1500, 12000, 3500, 1, 1),
  (2, 'Perfume VDH', 'Cualquiera de la línea.',
      2500, 24000, 5000, null, 2),
  (3, 'Remera VDH', 'Modelos seleccionados.',
      3500, 32000, 5000, null, 3)
on conflict (id) do update set
  nombre = excluded.nombre, detalle = excluded.detalle, puntos = excluded.puntos,
  valor = excluded.valor, costo = excluded.costo,
  limite_anual = excluded.limite_anual, orden = excluded.orden;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · LOS NIVELES
--
-- El nivel se calcula con XP —los puntos GANADOS en los últimos 12 meses— y
-- no con el saldo. Es la decisión que hace que el sistema no se contradiga:
-- si el nivel saliera del saldo, canjear un premio te bajaría de categoría,
-- o sea que el programa castigaría exactamente lo que quiere que pase.
--
-- Y la ventana de 12 meses es móvil: el nivel se mantiene comprando, no se
-- hereda para siempre. Sin eso, en tres años son todos Platino y el costo
-- del programa sube solo sin que nadie lo haya decidido.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_niveles (
  nombre     text primary key,
  desde_xp   integer not null,
  multiplica numeric(3,2) not null default 1 check (multiplica >= 1),
  orden      smallint not null
);

insert into club_niveles (nombre, desde_xp, multiplica, orden) values
  ('Plata',       0, 1.00, 1),   -- todos
  ('Oro',      4000, 1.20, 2),   -- $400.000 en 12 meses (~5 compras)
  ('Platino', 10000, 1.50, 3)    -- $1.000.000 en 12 meses (~12 compras)
on conflict (nombre) do update set
  desde_xp = excluded.desde_xp, multiplica = excluded.multiplica, orden = excluded.orden;


-- ══════════════════════════════════════════════════════════════════════════
-- 5 · LA VISTA: SALDO, XP Y NIVEL
--
-- El saldo sigue sin guardarse en ninguna columna: se cuenta sumando los
-- movimientos. Un contador guardado y un historial son dos fuentes de la
-- misma verdad, y el día que no coinciden no hay forma de saber cuál miente.
-- ══════════════════════════════════════════════════════════════════════════

drop view if exists v_club_clientes;
create view v_club_clientes as
  select c.*,
         coalesce(m.saldo, 0)::integer   as puntos,
         coalesce(m.xp, 0)::integer      as xp,
         coalesce(m.compras, 0)::integer as compras,
         coalesce(m.gastado, 0)::numeric as gastado,
         m.ultima_compra,
         (coalesce(m.compras, 0) > 0) as confirmado,
         coalesce(n.nombre, 'Plata')    as nivel,
         coalesce(n.multiplica, 1)      as multiplica
    from club_clientes c
    left join lateral (
      select sum(puntos) as saldo,
             /* XP: sólo lo GANADO comprando, y sólo lo de los últimos doce
                meses. Los canjes no restan XP a propósito. */
             sum(puntos) filter (
               where tipo = 'compra' and creado > now() - interval '12 months'
             ) as xp,
             count(*)    filter (where tipo = 'compra') as compras,
             sum(importe) filter (where tipo = 'compra') as gastado,
             max(creado) filter (where tipo = 'compra') as ultima_compra
        from club_movimientos
       where cliente = c.id and anulado is null
    ) m on true
    left join lateral (
      select nv.nombre, nv.multiplica
        from club_niveles nv
       where nv.desde_xp <= coalesce(m.xp, 0)
       order by nv.desde_xp desc
       limit 1
    ) n on true;


-- ══════════════════════════════════════════════════════════════════════════
-- 6 · EL BONO DE BIENVENIDA
--
-- Va como disparador y no dentro de club_alta: así lo recibe el que se anota
-- por el QR, el que se anota desde el mostrador y el que se anote mañana por
-- donde sea, sin tener que acordarse de agregarlo en cada lugar.
--
-- No convierte al socio en "confirmado" —eso sigue siendo tener una compra—
-- así que alguien anotando socios falsos desde afuera no cuesta un peso
-- hasta que alguno compre.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public
as $bv$
declare
  n integer;
begin
  select nullif(valor, '')::integer into n from club_reglas where clave = 'bienvenida_puntos';
  if coalesce(n, 0) > 0 then
    insert into club_movimientos (cliente, tipo, concepto, puntos, obs)
    values (new.id, 'ajuste', 'bienvenida', n, 'Bono de bienvenida');
  end if;
  return new;
end;
$bv$;

drop trigger if exists club_bienvenida_tg on club_clientes;
create trigger club_bienvenida_tg
  after insert on club_clientes
  for each row execute function club_bienvenida();


-- ══════════════════════════════════════════════════════════════════════════
-- 7 · SUMAR UNA COMPRA
--
-- Ahora el importe es OBLIGATORIO, y ese es el riesgo operativo de todo
-- esto: con sellos el vendedor apretaba un botón; con puntos tiene que
-- tipear un número, y si lo tipea mal el cliente tiene mal los puntos y eso
-- se discute en el mostrador con gente esperando.
--
-- Por eso hay tres frenos: el importe no puede faltar, el ticket de BlueSoft
-- tampoco (se puede apagar con la regla `exige_ticket`), y arriba del tope
-- la caja pregunta antes de guardar — un cero de más en $80.000 son 8.000
-- puntos regalados, que son tres premios.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_sumar_compra(
  p_pin       text,
  p_codigo    text,
  p_local     text,
  p_vendedor  text,
  p_ticket    text default null,
  p_importe   numeric default null,
  p_confirmar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cs$
declare
  c      v_club_clientes%rowtype;
  vieja  club_movimientos%rowtype;
  porpto numeric;
  tope   numeric;
  gana   integer;
  nid    bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into c from v_club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('sumado', false, 'porque', 'No encontré esa tarjeta.');
  end if;
  if length(trim(coalesce(p_local, ''))) = 0 then
    raise exception 'Falta el local.';
  end if;

  if p_importe is null or p_importe <= 0 then
    return jsonb_build_object('sumado', false,
      'porque', 'Falta el importe de la compra. Los puntos salen de ahí.');
  end if;

  if (select coalesce(valor, 'si') from club_reglas where clave = 'exige_ticket') = 'si'
     and length(trim(coalesce(p_ticket, ''))) = 0 then
    return jsonb_build_object('sumado', false,
      'porque', 'Falta el número de ticket de BlueSoft.');
  end if;

  /* El tope. No bloquea: pregunta. Un bloqueo duro es un cliente esperando
     mientras el vendedor no puede cargar una compra que existe. */
  select nullif(valor, '')::numeric into tope from club_reglas where clave = 'tope_importe';
  if tope is not null and p_importe > tope and not coalesce(p_confirmar, false) then
    return jsonb_build_object('sumado', false, 'revisar', true,
      'porque', 'Son ' || replace(to_char(p_importe, 'FM999,999,999'), ',', '.') ||
                ' pesos. Si está bien, confirmalo.');
  end if;

  /* Mismo ticket y mismo local, sin anular: casi siempre es el mismo vendedor
     apretando dos veces. Se avisa con los datos del anterior para que se vea
     si fue eso o si de verdad es otra compra.

     Nota: `p_confirmar` es uno solo para las dos preguntas —el monto grande
     y el ticket repetido—, así que confirmar un monto grande se saltea
     también el aviso de repetido. Es a propósito: dos banderas distintas
     significan dos carteles distintos en la caja para algo que pasa una vez
     cada mil compras, y el vendedor está mirando el ticket cuando confirma.
     Si alguna vez molesta, se parte en dos. */
  if length(trim(coalesce(p_ticket, ''))) > 0 and not coalesce(p_confirmar, false) then
    select * into vieja from club_movimientos
     where anulado is null
       and upper(trim(ticket)) = upper(trim(p_ticket))
       and upper(trim(coalesce(local, ''))) = upper(trim(p_local))
     limit 1;
    if found then
      return jsonb_build_object('sumado', false, 'duplicado', true,
        'porque', 'Ese ticket ya está cargado en ' || trim(p_local) || '.',
        'anterior', jsonb_build_object('cuando', vieja.creado, 'vendedor', vieja.vendedor,
                                       'importe', vieja.importe, 'puntos', vieja.puntos));
    end if;
  end if;

  select nullif(valor, '')::numeric into porpto from club_reglas where clave = 'pesos_por_punto';
  porpto := coalesce(porpto, 100);

  /* Primero los puntos de la compra, después el multiplicador del nivel, y
     recién ahí se redondea. Redondeando dos veces se pierde un punto por
     compra, que no es nada hasta que alguien lo suma y no le da. */
  gana := floor((p_importe / porpto) * coalesce(c.multiplica, 1));

  insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe)
  values (c.id, 'compra', gana, trim(p_local),
          nullif(trim(coalesce(p_vendedor, '')), ''),
          nullif(trim(coalesce(p_ticket, '')), ''),
          p_importe)
  returning id into nid;

  return jsonb_build_object(
    'sumado', true, 'movimiento', nid,
    'nombre', c.nombre,
    'gana', gana,
    'multiplica', c.multiplica,
    'nivel', c.nivel,
    'puntos', c.puntos + gana);
end;
$cs$;

grant execute on function club_sumar_compra(text, text, text, text, text, numeric, boolean)
  to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 8 · CANJEAR UN PREMIO
--
-- Acá sí hace falta un candado. Dos locales entregando el mismo premio en el
-- mismo segundo leen los dos el mismo saldo y los dos entregan: el cliente
-- se lleva dos perfumes con puntos para uno. Con `for update` sobre la fila
-- del cliente, el segundo espera al primero y ve el saldo ya descontado.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_canjear_premio(
  p_pin text, p_codigo text, p_premio smallint, p_local text, p_vendedor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cp$
declare
  cid    bigint;
  c      v_club_clientes%rowtype;
  pr     club_premios%rowtype;
  usados integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select id into cid from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null
   for update;
  if cid is null then
    return jsonb_build_object('canjeado', false, 'porque', 'No encontré esa tarjeta.');
  end if;

  select * into pr from club_premios where id = p_premio and activo;
  if not found then
    return jsonb_build_object('canjeado', false, 'porque', 'Ese premio no está disponible.');
  end if;

  select * into c from v_club_clientes where id = cid;

  if c.puntos < pr.puntos then
    return jsonb_build_object('canjeado', false,
      'porque', 'Le faltan ' || (pr.puntos - c.puntos)::text || ' puntos.');
  end if;

  if pr.limite_anual is not null then
    select count(*) into usados from club_movimientos
     where cliente = cid and tipo = 'canje' and premio = pr.id
       and anulado is null and creado > now() - interval '12 months';
    if usados >= pr.limite_anual then
      return jsonb_build_object('canjeado', false,
        'porque', 'Ya se llevó ' || pr.nombre || ' este año.');
    end if;
  end if;

  insert into club_movimientos (cliente, tipo, puntos, premio, local, vendedor, obs)
  values (cid, 'canje', -pr.puntos, pr.id,
          nullif(trim(coalesce(p_local, '')), ''),
          nullif(trim(coalesce(p_vendedor, '')), ''),
          pr.nombre);

  return jsonb_build_object('canjeado', true, 'premio', pr.nombre,
                            'gasto', pr.puntos, 'puntos', c.puntos - pr.puntos);
end;
$cp$;

grant execute on function club_canjear_premio(text, text, smallint, text, text)
  to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 9 · LA TARJETA
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $ct$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          /* Lo que falta para el siguiente. Null en el último: "te faltan
             X para Platino" cuando ya sos Platino es ruido. */
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        /* El catálogo. SIN el costo: eso es de VDH y no del cliente. */
        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor,
                   'alcanzado', c.puntos >= p.puntos,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p where p.activo), '[]'::jsonb),

        /* El movimiento de la cuenta. Con los puntos, sin el importe: el
           código ES la credencial y quien lo tenga ve esto, así que cuánto
           gastó alguien no va. Que vea "+800 en Rivadavia" alcanza para
           reconocer su compra. */
        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb),

        /* Compatibilidad, mientras la app vieja siga publicada. Se saca en
           cuanto tarjeta.html y caja.html estén actualizadas. */
        'sellos', c.puntos,
        'hitos', '[]'::jsonb
      ) from c
    ) end
$ct$;

grant execute on function club_tarjeta(text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 10 · LO QUE MIRA EL VENDEDOR
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_buscar(p_pin text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cb$
declare
  dig text;
  txt text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  dig := regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g');
  txt := lower(trim(coalesce(p_texto, '')));
  if length(txt) < 3 then
    return jsonb_build_object('corto', true,
      'porque', 'Escribí el teléfono entero o al menos 3 letras del nombre.');
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'codigo', codigo, 'nombre', nombre, 'telefono', telefono,
             'mail', mail, 'puntos', puntos, 'nivel', nivel,
             'compras', compras, 'confirmado', confirmado)
           order by confirmado desc, creado desc)
      from (
        select * from v_club_clientes
         where baja is null
           and ( (length(dig) >= 8 and regexp_replace(telefono, '[^0-9]', '', 'g') = dig)
              or (length(dig) = 12 and codigo = dig)
              or (length(txt) >= 3 and lower(nombre) like '%' || txt || '%')
              or (position('@' in txt) > 1 and lower(coalesce(mail, '')) = txt) )
         order by creado desc
         limit 10
      ) t
  ), '[]'::jsonb);
end;
$cb$;

grant execute on function club_buscar(text, text) to anon, authenticated;


create or replace function club_movimientos_de(p_pin text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cm$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'cuando', m.creado, 'local', m.local, 'vendedor', m.vendedor,
             'ticket', m.ticket, 'importe', m.importe, 'puntos', m.puntos,
             'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs,
             'anulado', m.anulado, 'motivo', m.motivo_anul)
           order by m.creado desc)
      from (
        select * from club_movimientos
         where cliente = (select id from club_clientes
                           where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g'))
         order by creado desc limit 20
      ) m
  ), '[]'::jsonb);
end;
$cm$;

grant execute on function club_movimientos_de(text, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 11 · EL VENCIMIENTO
--
-- Doce meses sin comprar y se vencen TODOS los puntos, de una vez.
--
-- Se hace escribiendo un movimiento en negativo y no restando al calcular,
-- por una razón que no es obvia: si el saldo se "apagara" mirando la fecha
-- de la última compra, el día que ese cliente vuelve a comprar la última
-- compra pasa a ser hoy y los puntos viejos RESUCITAN. Con un movimiento
-- guardado, lo vencido quedó vencido y además se ve en el historial cuando
-- el cliente pregunte.
--
-- La corre el mismo Action que ya corre todos los días.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_vencer()
returns jsonb
language plpgsql
security definer
set search_path = public
as $vc$
declare
  meses integer;
  n     integer := 0;
  total integer := 0;
  r     record;
begin
  select nullif(valor, '')::integer into meses from club_reglas where clave = 'vence_meses';
  if coalesce(meses, 0) <= 0 then
    return jsonb_build_object('vencidos', 0, 'porque', 'No vencen.');
  end if;

  for r in
    select v.id, v.puntos
      from v_club_clientes v
     where v.puntos > 0
       and coalesce(v.ultima_compra, v.creado) < now() - (meses || ' months')::interval
  loop
    insert into club_movimientos (cliente, tipo, concepto, puntos, obs)
    values (r.id, 'ajuste', 'vencimiento', -r.puntos,
            'Vencidos por ' || meses || ' meses sin comprar');
    n := n + 1;
    total := total + r.puntos;
  end loop;

  return jsonb_build_object('vencidos', n, 'puntos', total);
end;
$vc$;

/* Sólo el servidor. Un cliente no tiene por qué poder disparar esto.

   OJO CON EL "from public": una función nace con permiso de ejecución para
   PUBLIC, que son todos. Revocársela nada más que a anon y a authenticated
   no saca nada, porque el permiso les llega por PUBLIC. Y esta función le
   borra los puntos a quien corresponda: dejarla abierta es dejar que
   cualquiera con la clave pública —que viaja en el código de la app— vacíe
   el club entero de una llamada. */
revoke all on function club_vencer() from public, anon, authenticated;
grant execute on function club_vencer() to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- 12 · LO QUE CUESTA EL PROGRAMA
--
-- El número que hay que mirar todos los meses. "Puntos circulantes" no es
-- una deuda contable —nadie firmó nada— pero sí es EXPOSICIÓN: premios que
-- se pueden venir a buscar mañana. Y el costo real es el costo de VDH de lo
-- entregado sobre lo que esos socios facturaron.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_costo(p_pin text, p_meses integer default 12)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cc$
declare
  desde timestamptz;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  desde := now() - (greatest(coalesce(p_meses, 12), 1) || ' months')::interval;

  return jsonb_build_object(
    'desde', desde,
    'socios',    (select count(*) from v_club_clientes where confirmado),
    'facturado', (select coalesce(sum(importe), 0) from club_movimientos
                   where tipo = 'compra' and anulado is null and creado > desde),
    'emitidos',  (select coalesce(sum(puntos), 0) from club_movimientos
                   where puntos > 0 and anulado is null and creado > desde),
    'canjeados', (select coalesce(-sum(puntos), 0) from club_movimientos
                   where tipo = 'canje' and anulado is null and creado > desde),
    /* Los puntos que están dando vueltas: premios que pueden venir a buscar
       mañana. No es una deuda contable —nadie firmó nada— pero es el número
       que hay que mirar todos los meses. */
    'circulantes', (select coalesce(sum(puntos), 0) from v_club_clientes),
    /* Lo que de verdad salió del bolsillo: el costo VDH de los premios
       entregados. Dividido por lo facturado, ése es EL número del programa. */
    'costo_premios', (select coalesce(sum(p.costo), 0)
                        from club_movimientos m join club_premios p on p.id = m.premio
                       where m.tipo = 'canje' and m.anulado is null and m.creado > desde)
  );
end;
$cc$;

/* Pide PIN adentro, pero igual se le saca el permiso de PUBLIC: acá adentro
   está lo que le cuesta cada premio a VDH. */
revoke all on function club_costo(text, integer) from public;
grant execute on function club_costo(text, integer) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 13 · SE VAN LOS SELLOS
--
-- Al final de todo, para que ninguna función que se acaba de redefinir se
-- quede apuntando a algo que ya no está.
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists club_canjear_hito(text, text, smallint, text, text);
drop table if exists club_hitos;


-- ══════════════════════════════════════════════════════════════════════════
-- 14 · LAS TABLAS NUEVAS, CERRADAS
--
-- Igual que las otras: nada se lee ni se escribe directo. El catálogo lo ve
-- el cliente a través de club_tarjeta, que verifica el código — y así el
-- costo de cada premio nunca sale del servidor.
-- ══════════════════════════════════════════════════════════════════════════

alter table club_premios enable row level security;
alter table club_niveles enable row level security;
revoke all on club_premios from anon, authenticated;
revoke all on club_niveles from anon, authenticated;
revoke all on v_club_clientes from anon, authenticated;

grant select on club_premios to service_role;
grant select on club_niveles to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- 15 · LIMPIAR LAS PRUEBAS  (opcional, descomentar si hace falta)
--
-- Los movimientos de prueba quedaron con 1 punto cada uno, que era el sello.
-- Si hay tarjetas de prueba con sellos viejos y molesta verlas, esto las
-- recalcula desde el importe. Sólo toca lo que tenga importe cargado.
-- ══════════════════════════════════════════════════════════════════════════

-- update club_movimientos
--    set puntos = floor(importe / 100)
--  where tipo = 'compra' and anulado is null and importe is not null and puntos = 1;


-- ══════════════════════════════════════════════════════════════════════════
-- LISTO. Para ver que quedó bien:
-- ══════════════════════════════════════════════════════════════════════════

select 'reglas' as que, clave, valor from club_reglas where valor is not null
union all
select 'premio', nombre, puntos::text from club_premios where activo
union all
select 'nivel',  nombre, desde_xp::text || ' xp · ' || multiplica::text || 'x' from club_niveles
order by 1, 2;


-- ─────────────────────────── PARTE 14 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LA TARJETA SABE DEL LÍMITE ANUAL
--
-- Correr entero en el editor SQL de Supabase. Cambia UNA función.
--
-- El accesorio se puede llevar una vez por año, y eso la caja ya lo hacía
-- respetar. Pero la tarjeta sólo miraba si alcanzaban los puntos: a quien ya
-- se lo había llevado le seguía diciendo "Te alcanza", y en el local se lo
-- rechazaban. Es exactamente la promesa que no se cumple que un programa de
-- puntos no se puede permitir. Apareció mirando la tarjeta de una socia de
-- prueba, no leyendo el código.
--
-- De paso se van las dos llaves de compatibilidad (`sellos` y `hitos`) que
-- quedaron mientras la app vieja seguía publicada.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $ct$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        /* El catálogo. SIN el costo: eso es de VDH y no del cliente.

           `agotado`: ya se llevó este premio las veces que permite por año.
           Y `alcanzado` ahora quiere decir "se lo pueden dar HOY": puntos
           suficientes Y no agotado. Es la misma cuenta que hace
           club_canjear_premio, así la tarjeta y la caja nunca dicen cosas
           distintas. */
        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        /* El movimiento de la cuenta. Con los puntos, sin el importe: el
           código ES la credencial y quien lo tenga ve esto, así que cuánto
           gastó alguien no va. */
        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb)
      ) from c
    ) end
$ct$;

grant execute on function club_tarjeta(text) to anon, authenticated;


-- ─────────────────────────── PARTE 15 ───────────────────────────
-- Puntos dobles y la semana del cumpleaños. Reemplaza a la 14 (la incluye
-- entera): si la 14 no se corrió, alcanza con esta.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · PUNTOS DOBLES Y LA SEMANA DEL CUMPLEAÑOS
--
-- Correr entero en el editor SQL de Supabase. REEMPLAZA AL 14: si el 14 no
-- se corrió, no hace falta — todo lo que tenía está acá adentro.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LAS DOS COSAS QUE HACEN VOLVER
-- ══════════════════════════════════════════════════════════════════════════
--
-- 1. PUNTOS DOBLES. Mauricio los carga desde Configuración: "Hot Sale, del
--    1 al 3 de octubre, 2x". Esos días cada compra suma el doble.
--
-- 2. LA SEMANA DEL CUMPLEAÑOS. Del día del cumple a seis días después, las
--    compras de ESE socio suman el doble.
--
-- Por qué el cumpleaños es un multiplicador y no puntos de regalo: los
-- puntos regalados le llegan al cliente venga o no venga, y lo que se busca
-- es una excusa para que venga. Con el doble en su semana, el regalo existe
-- sólo si compra — o sea que cuesta sólo cuando trae una venta. Si además se
-- quiere regalar puntos el día del cumple, está la regla `cumple_puntos`
-- (hoy en 0), que se cambia con una línea.
--
-- ── Cómo se combinan ──
-- El nivel multiplica siempre (Oro 1,2x). Encima va el MAYOR entre los
-- puntos dobles vigentes y la semana del cumple, NO los dos a la vez: un
-- Platino (1,5x) en su cumple durante un 2x del Hot Sale suma 3x, no 6x. Sin
-- ese tope, el día que coinciden tres cosas el programa regala un premio
-- por compra.
--
-- ── El costo ──
-- Un 2x duplica el costo del programa ESOS días: del 2% al 4% de lo que
-- compran los socios. Está bien para una fecha fuerte; no está bien como
-- costumbre, y por eso los puntos dobles tienen fecha de fin obligatoria.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · LAS REGLAS DEL CUMPLEAÑOS
-- ══════════════════════════════════════════════════════════════════════════

insert into club_reglas (clave, valor) values
  ('cumple_multiplica', '2'),   -- las compras de su semana suman el doble
  ('cumple_dias',       '7'),   -- el día del cumple y los seis siguientes
  ('cumple_puntos',     '0')    -- puntos de regalo el día del cumple (apagado)
on conflict (clave) do nothing;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · EL CUMPLEAÑOS DE ESTE AÑO
--
-- Parece una línea y no lo es. El que nació un 29 de febrero, en un año que
-- no es bisiesto, festeja el 1 de marzo — make_date(año, 2, 29) directamente
-- explota. Y NO se puede resolver sumando "días desde el 1 de enero": en un
-- año bisiesto eso corre un día a todos los que cumplen después de febrero.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_cumple_en(p_cumple date, p_anio integer)
returns date
language sql
immutable
as $ce$
  select case
    when p_cumple is null then null
    when extract(month from p_cumple) = 2 and extract(day from p_cumple) = 29
         and extract(day from make_date(p_anio, 3, 1) - 1) <> 29
      then make_date(p_anio, 3, 1)
    else make_date(p_anio, extract(month from p_cumple)::int, extract(day from p_cumple)::int)
  end
$ce$;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · LOS PUNTOS DOBLES
--
-- Con fecha de fin OBLIGATORIA. Unos puntos dobles que quedan prendidos
-- porque nadie se acordó de apagarlos son el programa costando el doble para
-- siempre sin que nadie lo haya decidido.
--
-- Las fechas se guardan como instantes, pero se cargan como días de
-- Argentina: "del 1 al 3" quiere decir desde las 0:00 del 1 hasta las 0:00
-- del 4, hora de acá. La base está en UTC; sin la conversión, los puntos
-- dobles arrancarían a las 21 del día anterior.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_multiplicadores (
  id     bigint generated always as identity primary key,
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  factor numeric(3,2) not null check (factor > 1 and factor <= 3),
  desde  timestamptz not null,
  hasta  timestamptz not null,
  creado timestamptz not null default now(),
  por    text,
  baja   timestamptz,
  constraint multi_fechas check (hasta > desde)
);

create index if not exists club_multi_vivos on club_multiplicadores (desde, hasta)
  where baja is null;

alter table club_multiplicadores enable row level security;
revoke all on club_multiplicadores from anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · CUÁNTO SUMA HOY ESTE SOCIO
--
-- Una sola función para las tres pantallas: la caja la usa para sumar, la
-- tarjeta para decir "hoy sumás el doble" y la vista previa del vendedor
-- para mostrar cuánto va a sumar. Si cada una hiciera su cuenta, el día que
-- no coinciden el cliente ve un número y la caja carga otro.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_factor(p_cliente bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $cf$
declare
  hoy       date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  c         record;
  cm        numeric;
  dias      integer;
  ini       date;
  pr        record;
  extra     numeric := 1;
  motivo    text;
  hasta     date;
  de_cumple boolean := false;
begin
  select v.multiplica, v.cumple into c from v_club_clientes v where v.id = p_cliente;

  select nullif(valor, '')::numeric into cm   from club_reglas where clave = 'cumple_multiplica';
  select nullif(valor, '')::integer into dias from club_reglas where clave = 'cumple_dias';

  /* La semana del cumple. Se mira el de este año Y el del año pasado: el que
     cumple el 29 de diciembre sigue en su semana el 2 de enero, y mirando
     sólo este año se la cortaríamos en Año Nuevo. */
  if c.cumple is not null and coalesce(cm, 1) > 1 and coalesce(dias, 0) > 0 then
    ini := club_cumple_en(c.cumple, extract(year from hoy)::int);
    if not (hoy between ini and ini + dias - 1) then
      ini := club_cumple_en(c.cumple, extract(year from hoy)::int - 1);
    end if;
    if hoy between ini and ini + dias - 1 then
      extra := cm; motivo := 'Tu semana de cumple'; hasta := ini + dias - 1; de_cumple := true;
    end if;
  end if;

  /* Los puntos dobles vigentes. Si hubiera dos pisados, el más alto. */
  select m.nombre, m.factor,
         (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1 as ultimo
    into pr
    from club_multiplicadores m
   where m.baja is null and now() >= m.desde and now() < m.hasta
   order by m.factor desc, m.hasta desc
   limit 1;

  /* El mayor de los dos, no el producto. Ver el encabezado. */
  if pr.factor is not null and pr.factor > extra then
    extra := pr.factor; motivo := pr.nombre; hasta := pr.ultimo; de_cumple := false;
  end if;

  return jsonb_build_object(
    'total',  round(coalesce(c.multiplica, 1) * extra, 2),
    'nivel',  coalesce(c.multiplica, 1),
    'extra',  extra,
    'motivo', motivo,
    'hasta',  hasta,
    'cumple', de_cumple,
    /* Hoy es EL día, no la semana: para el "¡Feliz cumple!" de la tarjeta. */
    'es_cumple', c.cumple is not null
                 and club_cumple_en(c.cumple, extract(year from hoy)::int) = hoy);
end;
$cf$;

/* Por dentro nada más. Con un id cualquiera diría si hoy es la semana de
   cumpleaños de alguien, y eso no tiene por qué saberlo nadie de afuera.
   El "from public" es el que importa: una función nace abierta a todos. */
revoke all on function club_factor(bigint) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 5 · SUMAR UNA COMPRA, CON EL FACTOR DEL DÍA
--
-- Igual que en el 13, salvo la línea de los puntos: ahora multiplica por
-- club_factor() en vez de por el nivel solo, y devuelve el motivo para que
-- el vendedor pueda decir "hoy te sumó el doble por el Hot Sale".
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_sumar_compra(
  p_pin       text,
  p_codigo    text,
  p_local     text,
  p_vendedor  text,
  p_ticket    text default null,
  p_importe   numeric default null,
  p_confirmar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cs$
declare
  c      v_club_clientes%rowtype;
  vieja  club_movimientos%rowtype;
  porpto numeric;
  tope   numeric;
  f      jsonb;
  gana   integer;
  nid    bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into c from v_club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('sumado', false, 'porque', 'No encontré esa tarjeta.');
  end if;
  if length(trim(coalesce(p_local, ''))) = 0 then
    raise exception 'Falta el local.';
  end if;

  if p_importe is null or p_importe <= 0 then
    return jsonb_build_object('sumado', false,
      'porque', 'Falta el importe de la compra. Los puntos salen de ahí.');
  end if;

  if (select coalesce(valor, 'si') from club_reglas where clave = 'exige_ticket') = 'si'
     and length(trim(coalesce(p_ticket, ''))) = 0 then
    return jsonb_build_object('sumado', false,
      'porque', 'Falta el número de ticket de BlueSoft.');
  end if;

  /* El tope. No bloquea: pregunta. */
  select nullif(valor, '')::numeric into tope from club_reglas where clave = 'tope_importe';
  if tope is not null and p_importe > tope and not coalesce(p_confirmar, false) then
    return jsonb_build_object('sumado', false, 'revisar', true,
      'porque', 'Son ' || replace(to_char(p_importe, 'FM999,999,999'), ',', '.') ||
                ' pesos. Si está bien, confirmalo.');
  end if;

  /* Mismo ticket y mismo local, sin anular: casi siempre es el mismo vendedor
     apretando dos veces. `p_confirmar` es uno solo para las dos preguntas
     —el monto grande y el ticket repetido—; ver el 13. */
  if length(trim(coalesce(p_ticket, ''))) > 0 and not coalesce(p_confirmar, false) then
    select * into vieja from club_movimientos
     where anulado is null
       and upper(trim(ticket)) = upper(trim(p_ticket))
       and upper(trim(coalesce(local, ''))) = upper(trim(p_local))
     limit 1;
    if found then
      return jsonb_build_object('sumado', false, 'duplicado', true,
        'porque', 'Ese ticket ya está cargado en ' || trim(p_local) || '.',
        'anterior', jsonb_build_object('cuando', vieja.creado, 'vendedor', vieja.vendedor,
                                       'importe', vieja.importe, 'puntos', vieja.puntos));
    end if;
  end if;

  select nullif(valor, '')::numeric into porpto from club_reglas where clave = 'pesos_por_punto';
  porpto := coalesce(porpto, 100);

  f := club_factor(c.id);
  /* Se redondea una sola vez, al final. */
  gana := floor((p_importe / porpto) * (f->>'total')::numeric);

  insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
  values (c.id, 'compra', gana, trim(p_local),
          nullif(trim(coalesce(p_vendedor, '')), ''),
          nullif(trim(coalesce(p_ticket, '')), ''),
          p_importe,
          /* Por qué sumó lo que sumó, anotado en el movimiento. Tres meses
             después, "¿por qué esta compra me dio el doble?" tiene respuesta
             aunque los puntos dobles ya no existan. */
          case when (f->>'extra')::numeric > 1 then
            (f->>'motivo') || ' ' || replace(trim_scale((f->>'extra')::numeric)::text, '.', ',') || 'x'
          end)
  returning id into nid;

  return jsonb_build_object(
    'sumado', true, 'movimiento', nid,
    'nombre', c.nombre,
    'gana', gana,
    'multiplica', (f->>'total')::numeric,
    'nivel', c.nivel,
    'motivo', f->>'motivo',
    'extra', (f->>'extra')::numeric,
    'puntos', c.puntos + gana);
end;
$cs$;

grant execute on function club_sumar_compra(text, text, text, text, text, numeric, boolean)
  to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 6 · LA TARJETA
--
-- Lo del 14 (el límite anual: `agotado`, y `alcanzado` = se lo pueden dar
-- HOY) más `hoy`: cuánto suma este socio hoy y por qué.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $ct$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'hoy', club_factor(c.id),

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        /* El catálogo, SIN el costo. `alcanzado` = se lo pueden dar hoy:
           puntos suficientes y sin haber llegado al límite del año. Es la
           misma cuenta que club_canjear_premio. */
        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb)
      ) from c
    ) end
$ct$;

grant execute on function club_tarjeta(text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 7 · CARGAR LOS PUNTOS DOBLES DESDE CONFIGURACIÓN
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_multi_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ml$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'nombre', m.nombre, 'factor', m.factor,
             'desde', (m.desde at time zone 'America/Argentina/Buenos_Aires')::date,
             'hasta', (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1,
             'vigente', now() >= m.desde and now() < m.hasta,
             'futura',  now() < m.desde)
           order by m.desde desc)
      from (select * from club_multiplicadores
             where baja is null and hasta > now() - interval '60 days'
             order by desde desc limit 30) m
  ), '[]'::jsonb);
end;
$ml$;

grant execute on function club_multi_listar(text) to anon, authenticated;


create or replace function club_multi_guardar(
  p_pin text, p_id bigint, p_nombre text, p_factor numeric,
  p_desde text, p_hasta text, p_por text default null, p_avisar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mg$
declare
  d1  date;
  d2  date;
  ini timestamptz;
  fin timestamptz;
  nom text := nullif(trim(coalesce(p_nombre, '')), '');
  nid bigint;
  cuantos integer := 0;
  /* "2" y "1,5": sin los ceros que sobran. to_char con FM deja "2."
     colgando, numeric a texto deja "2.00", y sacar ceros de la derecha a
     mano convierte un 10 en un 1. trim_scale es exactamente esto. */
  fx  text := replace(trim_scale(p_factor)::text, '.', ',');
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  if nom is null then
    return jsonb_build_object('ok', false, 'porque', 'Ponele un nombre: es lo que ven los socios.');
  end if;
  if length(nom) > 60 then
    return jsonb_build_object('ok', false, 'porque', 'El nombre es muy largo. Hasta 60 letras.');
  end if;
  if p_factor is null or p_factor <= 1 or p_factor > 3 then
    return jsonb_build_object('ok', false, 'porque', 'El multiplicador va entre 1,5 y 3.');
  end if;

  begin
    d1 := p_desde::date;
    d2 := p_hasta::date;
  exception when others then
    return jsonb_build_object('ok', false, 'porque', 'Revisá las fechas.');
  end;
  if d1 is null or d2 is null then
    return jsonb_build_object('ok', false, 'porque', 'Faltan las fechas. La de fin es obligatoria.');
  end if;
  if d2 < d1 then
    return jsonb_build_object('ok', false, 'porque', 'Termina antes de empezar.');
  end if;
  if d2 < (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    return jsonb_build_object('ok', false, 'porque', 'Esas fechas ya pasaron.');
  end if;
  /* Un tope a lo largo, por la misma razón que la fecha de fin: unos puntos
     dobles de tres meses ya no son una fecha especial, son otro programa. */
  if d2 - d1 > 31 then
    return jsonb_build_object('ok', false, 'porque', 'Hasta 31 días. Más que eso deja de ser una fecha especial.');
  end if;

  /* Días de Argentina → instantes. Ver la sección 3. */
  ini := d1::timestamp at time zone 'America/Argentina/Buenos_Aires';
  fin := (d2 + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';

  if p_id is null then
    insert into club_multiplicadores (nombre, factor, desde, hasta, por)
    values (nom, p_factor, ini, fin, nullif(trim(coalesce(p_por, '')), ''))
    returning id into nid;
  else
    update club_multiplicadores
       set nombre = nom, factor = p_factor, desde = ini, hasta = fin
     where id = p_id and baja is null
    returning id into nid;
    if nid is null then
      return jsonb_build_object('ok', false, 'porque', 'No lo encontré. Puede que lo hayan quitado.');
    end if;
  end if;

  /* El aviso al celular, si se pidió. Sale el día que arranca y a las 10 de
     la mañana, no a la medianoche: una notificación a las 0:00 despierta a
     alguien, y eso no se lo agradece nadie. Si ya arrancó, sale ahora. */
  if coalesce(p_avisar, false) then
    select count(*) into cuantos from club_suscripciones where muerto is null;
    if cuantos > 0 then
      insert into club_avisos (titulo, cuerpo, enlace, por, sale)
      values (
        nom || ': puntos x' || fx,
        case when d1 = d2
          then 'Solo por el ' || to_char(d1, 'DD/MM') || ', tus compras en VDH suman ' ||
               case when p_factor = 2 then 'el doble' when p_factor = 3 then 'el triple'
                    else fx || ' veces' end ||
               ' de puntos.'
          else 'Del ' || to_char(d1, 'DD/MM') || ' al ' || to_char(d2, 'DD/MM') ||
               ', tus compras en VDH suman ' ||
               case when p_factor = 2 then 'el doble' when p_factor = 3 then 'el triple'
                    else fx || ' veces' end ||
               ' de puntos.'
        end,
        'tarjeta.html',
        'Puntos dobles',
        greatest(now(), ini + interval '10 hours'));
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', nid, 'avisados', cuantos);
end;
$mg$;

grant execute on function club_multi_guardar(text, bigint, text, numeric, text, text, text, boolean)
  to anon, authenticated;


create or replace function club_multi_baja(p_pin text, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mb$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  /* No se borra: las compras que ya sumaron el doble dicen en su `obs` por
     qué. La fila queda, dada de baja. */
  update club_multiplicadores set baja = now() where id = p_id and baja is null;
  return jsonb_build_object('ok', found);
end;
$mb$;

grant execute on function club_multi_baja(text, bigint) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- LISTO
-- ══════════════════════════════════════════════════════════════════════════

select clave, valor from club_reglas
 where clave like 'cumple_%' or clave in ('pesos_por_punto', 'bienvenida_puntos', 'vence_meses')
 order by clave;


-- ─────────────────────────── PARTE 16 ───────────────────────────
-- El regalo de cumpleaños por nivel, los avisos personales y los premios
-- editables desde Configuración.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · EL REGALO DE CUMPLEAÑOS, LOS AVISOS PERSONALES Y LOS PREMIOS
--             EDITABLES
--
-- Correr entero en el editor SQL de Supabase, después del 15.
--
-- ══════════════════════════════════════════════════════════════════════════
-- EL CUMPLEAÑOS, COMO LO DECIDIÓ MAURICIO (27/09/2026)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Siete días antes del cumple le llega un aviso al celular: tiene un regalo
-- esperándolo. El regalo vale desde ese día hasta el día del cumple, así
-- tiene una semana entera para pasar por el local. No el día del cumple: ese
-- día nadie tiene tiempo de ir a buscar nada.
--
-- El regalo depende del nivel, y se cambia desde Configuración:
--
--   Plata     10% de descuento en su compra
--   Oro       20% de descuento en su compra
--   Platino   una remera VDH (modelos seleccionados)
--
-- Se usa UNA vez por cumpleaños y lo marca el vendedor desde la caja. El
-- descuento lo cobra BlueSoft —desde acá no se puede tocar un precio—, así
-- que el vendedor lo aplica allá y acá anota que lo usó.
--
-- Reemplaza a los puntos dobles en la semana del cumple del 15, que quedan
-- APAGADOS (cumple_multiplica = 1) pero no borrados: si algún día se
-- quieren las dos cosas, es una línea.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LOS AVISOS PERSONALES VAN EN OTRA TABLA, Y ES A PROPÓSITO
-- ══════════════════════════════════════════════════════════════════════════
--
-- Hasta acá todo aviso era para todos: los dos programas que los mandan
-- (la Edge Function y el Action de cada hora) agarran cada fila de
-- club_avisos y la mandan a TODAS las suscripciones.
--
-- Si el "Se viene tu cumple, Carolina" se agregara ahí con una columna
-- nueva que diga para quién es, cualquier versión de esos programas que
-- no supiera de la columna —una publicada un día antes que la otra, una
-- que alguien restaure de un respaldo— se lo mandaría a todos los socios.
--
-- En una tabla aparte eso no puede pasar: un programa que no la conoce, no
-- la lee. Lo peor que puede ocurrir es que el saludo se atrase.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · LAS REGLAS
-- ══════════════════════════════════════════════════════════════════════════

insert into club_reglas (clave, valor) values
  ('cumple_antes', '7')   -- el aviso y el regalo arrancan 7 días antes del cumple
on conflict (clave) do nothing;

/* Los puntos dobles en la semana del cumple, apagados. El regalo por nivel
   los reemplaza. */
update club_reglas set valor = '1' where clave = 'cumple_multiplica';


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · ¿ESTÁ EN SU SEMANA DE CUMPLE?
--
-- Devuelve el día del cumple de la semana en curso, o null si hoy no cae en
-- ninguna. Mira el cumpleaños de este año Y el del que viene: el que cumple
-- el 3 de enero está en su semana el 29 de diciembre, y mirando sólo este
-- año se la perderíamos entera.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_cumple_fin(p_cumple date, p_hoy date, p_antes integer)
returns date
language sql
immutable
as $cf$
  select f from (
    select club_cumple_en(p_cumple, extract(year from p_hoy)::int + d) as f
      from (values (0), (1)) a(d)
  ) x
  where p_cumple is not null
    and p_hoy between f - coalesce(p_antes, 7) and f
  order by f
  limit 1
$cf$;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · LOS REGALOS, POR NIVEL
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_regalos_cumple (
  nivel      text primary key references club_niveles(nombre) on update cascade,
  tipo       text not null check (tipo in ('descuento', 'producto')),
  porcentaje smallint check (porcentaje between 1 and 50),
  producto   text,
  detalle    text,
  /* Lo que le cuesta a VDH, para "El Club en números". En un descuento no
     se sabe de antemano —depende de lo que compre— y queda vacío. NUNCA
     sale a la tarjeta del cliente. */
  costo      numeric(12,2),
  constraint regalo_completo check (
    (tipo = 'descuento' and porcentaje is not null) or
    (tipo = 'producto'  and length(trim(coalesce(producto, ''))) > 0))
);

insert into club_regalos_cumple (nivel, tipo, porcentaje, producto, detalle, costo) values
  ('Plata',   'descuento', 10,   null,         null,                     null),
  ('Oro',     'descuento', 20,   null,         null,                     null),
  ('Platino', 'producto',  null, 'Remera VDH', 'Modelos seleccionados.', 5000)
on conflict (nivel) do nothing;

alter table club_regalos_cumple enable row level security;
revoke all on club_regalos_cumple from anon, authenticated;

/* Lo que costó cada cosa entregada, anotado en el movimiento. Hasta acá el
   costo salía del catálogo de premios; el regalo de cumple no está en el
   catálogo, y sin esto "El Club en números" daría de menos. */
alter table club_movimientos add column if not exists costo numeric(12,2);


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · EL REGALO DE ESTE SOCIO, HOY
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_regalo_cumple(p_cliente bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $rc$
declare
  hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  c     record;
  antes integer;
  fin   date;
  r     club_regalos_cumple%rowtype;
  usado boolean;
begin
  select v.cumple, v.nivel into c from v_club_clientes v where v.id = p_cliente;
  select nullif(valor, '')::integer into antes from club_reglas where clave = 'cumple_antes';
  antes := coalesce(antes, 7);

  fin := club_cumple_fin(c.cumple, hoy, antes);
  if fin is null then
    return jsonb_build_object('vale', false);
  end if;

  select * into r from club_regalos_cumple where nivel = c.nivel;
  if not found then
    return jsonb_build_object('vale', false);
  end if;

  /* Usado = hay un regalo de cumple entregado desde que arrancó ESTA
     semana. El del año pasado no cuenta. */
  usado := exists (
    select 1 from club_movimientos m
     where m.cliente = p_cliente and m.concepto = 'regalo_cumple' and m.anulado is null
       and m.creado >= ((fin - antes)::timestamp at time zone 'America/Argentina/Buenos_Aires'));

  /* Sin el costo: esto viaja a la tarjeta. */
  return jsonb_build_object(
    'vale',       true,
    'desde',      fin - antes,
    'hasta',      fin,
    'es_hoy',     hoy = fin,
    'tipo',       r.tipo,
    'porcentaje', r.porcentaje,
    'producto',   r.producto,
    'detalle',    r.detalle,
    'usado',      usado,
    'texto',      case when r.tipo = 'descuento'
                       then r.porcentaje || '% de descuento en tu compra'
                       else r.producto end);
end;
$rc$;

revoke all on function club_regalo_cumple(bigint) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 5 · ENTREGARLO, DESDE LA CAJA
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_entregar_cumple(
  p_pin text, p_codigo text, p_local text, p_vendedor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ec$
declare
  cid bigint;
  r   jsonb;
  cos numeric;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  /* El candado, como en el canje: dos locales marcándolo a la vez no le dan
     dos regalos. */
  select id into cid from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null
   for update;
  if cid is null then
    return jsonb_build_object('entregado', false, 'porque', 'No encontré esa tarjeta.');
  end if;

  r := club_regalo_cumple(cid);
  if not (r->>'vale')::boolean then
    return jsonb_build_object('entregado', false,
      'porque', 'No está en su semana de cumpleaños (o no tiene el cumple cargado).');
  end if;
  if (r->>'usado')::boolean then
    return jsonb_build_object('entregado', false, 'porque', 'Ya usó su regalo de este cumpleaños.');
  end if;

  select g.costo into cos from club_regalos_cumple g
    join v_club_clientes v on v.nivel = g.nivel where v.id = cid;

  insert into club_movimientos (cliente, tipo, concepto, puntos, local, vendedor, obs, costo)
  values (cid, 'canje', 'regalo_cumple', 0,
          nullif(trim(coalesce(p_local, '')), ''),
          nullif(trim(coalesce(p_vendedor, '')), ''),
          r->>'texto', cos);

  return jsonb_build_object('entregado', true, 'texto', r->>'texto', 'tipo', r->>'tipo');
end;
$ec$;

grant execute on function club_entregar_cumple(text, text, text, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 6 · CUÁNTO SUMA HOY: con la ventana nueva
--
-- Igual que en el 15, pero la semana del cumple ahora es la de los 7 días
-- antes. Con cumple_multiplica en 1 no suma nada extra; queda coherente por
-- si algún día se vuelve a prender.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_factor(p_cliente bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $cf$
declare
  hoy       date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  c         record;
  cm        numeric;
  antes     integer;
  fin       date;
  pr        record;
  extra     numeric := 1;
  motivo    text;
  hasta     date;
  de_cumple boolean := false;
begin
  select v.multiplica, v.cumple into c from v_club_clientes v where v.id = p_cliente;
  select nullif(valor, '')::numeric into cm    from club_reglas where clave = 'cumple_multiplica';
  select nullif(valor, '')::integer into antes from club_reglas where clave = 'cumple_antes';

  if c.cumple is not null and coalesce(cm, 1) > 1 then
    fin := club_cumple_fin(c.cumple, hoy, coalesce(antes, 7));
    if fin is not null then
      extra := cm; motivo := 'Tu semana de cumple'; hasta := fin; de_cumple := true;
    end if;
  end if;

  select m.nombre, m.factor,
         (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1 as ultimo
    into pr
    from club_multiplicadores m
   where m.baja is null and now() >= m.desde and now() < m.hasta
   order by m.factor desc, m.hasta desc
   limit 1;

  if pr.factor is not null and pr.factor > extra then
    extra := pr.factor; motivo := pr.nombre; hasta := pr.ultimo; de_cumple := false;
  end if;

  return jsonb_build_object(
    'total',  round(coalesce(c.multiplica, 1) * extra, 2),
    'nivel',  coalesce(c.multiplica, 1),
    'extra',  extra,
    'motivo', motivo,
    'hasta',  hasta,
    'cumple', de_cumple,
    'es_cumple', c.cumple is not null
                 and club_cumple_en(c.cumple, extract(year from hoy)::int) = hoy);
end;
$cf$;

revoke all on function club_factor(bigint) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 7 · LA TARJETA: lo del 15 más `cumple`
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $ct$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'hoy', club_factor(c.id),
        'cumple', club_regalo_cumple(c.id),

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb)
      ) from c
    ) end
$ct$;

grant execute on function club_tarjeta(text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 8 · LOS AVISOS PERSONALES
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_avisos_personales (
  id       bigint generated always as identity primary key,
  cliente  bigint not null references club_clientes(id) on delete cascade,
  /* De qué es ('cumple') y de cuál ('2026-10-12'): la pareja no se repite,
     y eso es lo que impide mandarle el mismo saludo dos veces aunque la
     tarea diaria corra dos veces el mismo día. */
  motivo   text not null,
  clave    text not null,
  titulo   text not null,
  cuerpo   text not null,
  enlace   text,
  sale     timestamptz not null,
  creado   timestamptz not null default now(),
  enviado  timestamptz,
  llegaron integer,
  fallaron integer,
  constraint aviso_personal_unico unique (cliente, motivo, clave)
);

create index if not exists club_avp_pendientes on club_avisos_personales (sale)
  where enviado is null;

alter table club_avisos_personales enable row level security;
revoke all on club_avisos_personales from anon, authenticated;


/* Los saludos de cumpleaños del día. Los deja en la cola para las 10 de la
   mañana; los manda el Action de cada hora.

   Se generan durante los primeros días de la semana y no sólo el primero:
   si la tarea diaria no corre un día —GitHub se cae, pasa—, al día
   siguiente el saludo sale igual, con un día menos para pasar. El último
   par de días ya no: un "tenés una semana" con dos días de margen es
   mentir. La restricción única hace que nunca salga dos veces. */
create or replace function club_cumple_avisar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $ca$
declare
  hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  antes integer;
  s     record;
  n     integer := 0;
  diez  timestamptz;
begin
  select nullif(valor, '')::integer into antes from club_reglas where clave = 'cumple_antes';
  antes := coalesce(antes, 7);
  diez := (hoy::timestamp + interval '10 hours') at time zone 'America/Argentina/Buenos_Aires';

  for s in
    select v.id, v.nombre, f.fin, g.tipo, g.porcentaje, g.producto
      from v_club_clientes v
      cross join lateral (select club_cumple_fin(v.cumple, hoy, antes) as fin) f
      join club_regalos_cumple g on g.nivel = v.nivel
     where v.baja is null and v.cumple is not null
       and f.fin is not null
       and hoy <= f.fin - 3
       /* Sólo a quien tiene los avisos prendidos: sin suscripción no hay a
          dónde mandarlo. Igual lo ve en la tarjeta si la abre. */
       and exists (select 1 from club_suscripciones su
                    where su.cliente = v.id and su.muerto is null)
  loop
    insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
    values (
      s.id, 'cumple', s.fin::text,
      'Se viene tu cumple, ' || split_part(trim(s.nombre), ' ', 1),
      'Tenés un regalo esperándote: ' ||
        case when s.tipo = 'descuento' then s.porcentaje || '% de descuento en tu compra'
             else s.producto end ||
        '. Pasá por cualquier local VDH hasta el ' || to_char(s.fin, 'DD/MM') || '.',
      'tarjeta.html',
      greatest(now(), diez))
    on conflict (cliente, motivo, clave) do nothing;
    if found then n := n + 1; end if;
  end loop;

  return jsonb_build_object('saludos', n);
end;
$ca$;

revoke all on function club_cumple_avisar() from public, anon, authenticated;
grant execute on function club_cumple_avisar() to service_role;


/* Lo que corre una vez por día, a las 6: vencer puntos y dejar los saludos
   de cumpleaños en la cola. Una sola llamada desde el Action del respaldo. */
create or replace function club_diario()
returns jsonb
language plpgsql
security definer
set search_path = public
as $cd$
begin
  return jsonb_build_object('vencer', club_vencer(), 'cumple', club_cumple_avisar());
end;
$cd$;

revoke all on function club_diario() from public, anon, authenticated;
grant execute on function club_diario() to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- 9 · EL COSTO, CONTANDO LOS REGALOS
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_costo(p_pin text, p_meses integer default 12)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cc$
declare
  desde timestamptz;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  desde := now() - (greatest(coalesce(p_meses, 12), 1) || ' months')::interval;

  return jsonb_build_object(
    'desde', desde,
    'socios',    (select count(*) from v_club_clientes where confirmado),
    'facturado', (select coalesce(sum(importe), 0) from club_movimientos
                   where tipo = 'compra' and anulado is null and creado > desde),
    'emitidos',  (select coalesce(sum(puntos), 0) from club_movimientos
                   where puntos > 0 and anulado is null and creado > desde),
    'canjeados', (select coalesce(-sum(puntos), 0) from club_movimientos
                   where tipo = 'canje' and anulado is null and creado > desde),
    'circulantes', (select coalesce(sum(puntos), 0) from v_club_clientes),
    /* El costo de lo entregado: el del movimiento si lo anotó (regalos de
       cumple, y lo que se entregue de acá en adelante), si no el del
       catálogo. */
    'costo_premios', (select coalesce(sum(coalesce(m.costo, p.costo)), 0)
                        from club_movimientos m left join club_premios p on p.id = m.premio
                       where m.tipo = 'canje' and m.anulado is null and m.creado > desde),
    'regalos_cumple', (select count(*) from club_movimientos
                        where concepto = 'regalo_cumple' and anulado is null and creado > desde)
  );
end;
$cc$;

revoke all on function club_costo(text, integer) from public;
grant execute on function club_costo(text, integer) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 10 · LOS PREMIOS, DESDE CONFIGURACIÓN
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_premios_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pl$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle, 'puntos', p.puntos,
             'valor', p.valor, 'costo', p.costo, 'limite_anual', p.limite_anual,
             'activo', p.activo,
             'entregados', (select count(*) from club_movimientos m
                             where m.premio = p.id and m.tipo = 'canje' and m.anulado is null))
           order by p.activo desc, p.orden, p.puntos)
      from club_premios p
  ), '[]'::jsonb);
end;
$pl$;

grant execute on function club_premios_listar(text) to anon, authenticated;


create or replace function club_premio_guardar(
  p_pin text, p_id smallint, p_nombre text, p_detalle text, p_puntos integer,
  p_valor numeric, p_costo numeric, p_limite smallint, p_activo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pg$
declare
  nom text := nullif(trim(coalesce(p_nombre, '')), '');
  nid smallint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if nom is null then
    return jsonb_build_object('ok', false, 'porque', 'Ponele un nombre: es lo que ve el socio.');
  end if;
  if p_puntos is null or p_puntos < 100 then
    return jsonb_build_object('ok', false, 'porque', 'Tiene que costar al menos 100 puntos.');
  end if;
  if p_limite is not null and p_limite < 1 then
    return jsonb_build_object('ok', false, 'porque', 'El límite por año va vacío o desde 1.');
  end if;

  if p_id is null then
    /* El id y el orden, a mano: la tabla nació con los tres primeros
       cargados con número y no tiene contador. El nuevo va al final. */
    select coalesce(max(id), 0) + 1 into nid from club_premios;
    insert into club_premios (id, nombre, detalle, puntos, valor, costo, limite_anual, orden, activo)
    values (nid, nom, nullif(trim(coalesce(p_detalle, '')), ''), p_puntos, p_valor, p_costo,
            p_limite, (select coalesce(max(orden), 0) + 1 from club_premios),
            coalesce(p_activo, true));
  else
    /* No se borra nunca: los canjes viejos apuntan acá. Se apaga. */
    update club_premios
       set nombre = nom, detalle = nullif(trim(coalesce(p_detalle, '')), ''),
           puntos = p_puntos, valor = p_valor, costo = p_costo,
           limite_anual = p_limite, activo = coalesce(p_activo, true)
     where id = p_id
    returning id into nid;
    if nid is null then
      return jsonb_build_object('ok', false, 'porque', 'No encontré ese premio.');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', nid);
end;
$pg$;

grant execute on function club_premio_guardar(text, smallint, text, text, integer, numeric, numeric, smallint, boolean)
  to anon, authenticated;


create or replace function club_regalos_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $rl$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'nivel', n.nombre, 'tipo', g.tipo, 'porcentaje', g.porcentaje,
             'producto', g.producto, 'detalle', g.detalle, 'costo', g.costo)
           order by n.orden)
      from club_niveles n left join club_regalos_cumple g on g.nivel = n.nombre
  ), '[]'::jsonb);
end;
$rl$;

grant execute on function club_regalos_listar(text) to anon, authenticated;


create or replace function club_regalo_guardar(
  p_pin text, p_nivel text, p_tipo text, p_porcentaje smallint,
  p_producto text, p_detalle text, p_costo numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $rg$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if not exists (select 1 from club_niveles where nombre = p_nivel) then
    return jsonb_build_object('ok', false, 'porque', 'Ese nivel no existe.');
  end if;
  if p_tipo = 'descuento' and (p_porcentaje is null or p_porcentaje < 1 or p_porcentaje > 50) then
    return jsonb_build_object('ok', false, 'porque', 'El descuento va de 1% a 50%.');
  end if;
  if p_tipo = 'producto' and length(trim(coalesce(p_producto, ''))) = 0 then
    return jsonb_build_object('ok', false, 'porque', 'Falta qué producto se lleva.');
  end if;
  if p_tipo not in ('descuento', 'producto') then
    return jsonb_build_object('ok', false, 'porque', 'Elegí descuento o producto.');
  end if;

  insert into club_regalos_cumple (nivel, tipo, porcentaje, producto, detalle, costo)
  values (p_nivel, p_tipo,
          case when p_tipo = 'descuento' then p_porcentaje end,
          case when p_tipo = 'producto' then trim(p_producto) end,
          case when p_tipo = 'producto' then nullif(trim(coalesce(p_detalle, '')), '') end,
          case when p_tipo = 'producto' then p_costo end)
  on conflict (nivel) do update set
    tipo = excluded.tipo, porcentaje = excluded.porcentaje, producto = excluded.producto,
    detalle = excluded.detalle, costo = excluded.costo;

  return jsonb_build_object('ok', true);
end;
$rg$;

grant execute on function club_regalo_guardar(text, text, text, smallint, text, text, numeric)
  to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- LISTO
-- ══════════════════════════════════════════════════════════════════════════

select nivel, tipo, coalesce(porcentaje || '%', producto) as regalo from club_regalos_cumple
 order by (select orden from club_niveles n where n.nombre = nivel);


-- ─────────────────────────── PARTE 17 ───────────────────────────
-- Los socios en Kommo, como contactos etiquetados.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LOS SOCIOS EN KOMMO
--
-- Correr entero en el editor SQL de Supabase, DESPUÉS del 16.
--
-- Decidido el 25/09/2026 y pedido así: "que toda la gente del club VDH
-- automáticamente vaya a un segmento, para después poder escribirles
-- promociones".
--
-- ══════════════════════════════════════════════════════════════════════════
-- CONTACTOS CON ETIQUETAS, NUNCA LEADS
-- ══════════════════════════════════════════════════════════════════════════
--
-- Un socio no es una oportunidad de venta: si cada alta creara un lead, el
-- embudo del No Compra se llenaría de gente que nunca se fue sin comprar y
-- dejaría de medir lo que mide. Y Kommo no deja borrar leads por API: un
-- error se limpia a mano, de a uno.
--
-- Las etiquetas:
--
--   VDH Club          todos los socios
--   Acepta promos     los que tildaron que quieren recibir novedades
--   Club Plata/Oro/Platino   el nivel de hoy, que se resincroniza solo
--
-- EL SEGMENTO PARA MANDAR PROMOCIONES SON LOS QUE TIENEN "VDH Club" Y
-- "Acepta promos". No es burocracia: si se le escribe a alguien que no lo
-- pidió y lo reporta, WhatsApp bloquea el número del local.
--
-- ══════════════════════════════════════════════════════════════════════════
-- NUNCA SE LE BORRA UNA ETIQUETA QUE NO SEA DEL CLUB
-- ══════════════════════════════════════════════════════════════════════════
--
-- Mucha gente ya está en Kommo —por un no-compra, por la tienda online— con
-- etiquetas que puso otro ("No Compra", "RIVADAVIA", "Motivo: Talle"). En
-- Kommo, mandar la lista de etiquetas de un contacto la REEMPLAZA entera:
-- hecho a la ligera, sincronizar el Club le borraría todo eso a cada uno.
--
-- Así que se AGREGA y se SACA de a una (tags_to_add / tags_to_delete), y
-- sólo se saca lo que es del Club: el nivel viejo, o "Acepta promos" si lo
-- revocó. Y después se VERIFICA leyendo el contacto: si Kommo no aplicó el
-- cambio, se hace de la otra forma —leer las que tiene, sumar, mandar la
-- lista completa—, que es más lenta pero no pierde nada.
--
-- ══════════════════════════════════════════════════════════════════════════
-- UNA BANDEJA PROPIA, APARTE DE LA DEL NO COMPRA
-- ══════════════════════════════════════════════════════════════════════════
--
-- La bandeja `salidas` está atada a los registros de no-compra (cada fila
-- apunta a uno) y anda. En vez de estirarla, el Club tiene la suya con la
-- misma mecánica: seis intentos con espera creciente, y lo que no sale queda
-- a la vista. Si Kommo está caído, el socio no se pierde: espera.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · LO QUE SE RECUERDA DE CADA SOCIO
-- ══════════════════════════════════════════════════════════════════════════

/* El id del contacto en Kommo: la segunda vez no hay que buscarlo. */
alter table club_clientes add column if not exists kommo_contacto bigint;

/* Las etiquetas del Club que tiene hoy en Kommo, como quedaron la última
   vez. Es lo que dice si hay que volver a mandar algo: si el nivel cambió,
   esto ya no coincide con lo que debería tener. */
alter table club_clientes add column if not exists kommo_etiquetas text;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · LAS ETIQUETAS QUE LE CORRESPONDEN HOY
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_kommo_etiquetas(p_cliente bigint)
returns text[]
language sql
stable
security definer
set search_path = public
as $ke$
  select array_remove(array[
           'VDH Club',
           case when v.acepta_promos and v.revocado is null then 'Acepta promos' end,
           'Club ' || v.nivel
         ], null)
    from v_club_clientes v where v.id = p_cliente
$ke$;

revoke all on function club_kommo_etiquetas(bigint) from public, anon, authenticated;

/* Todas las etiquetas que son del Club. Lo que no está acá, no se toca. */
create or replace function club_kommo_propias()
returns text[]
language sql
stable
as $kp$
  select array['VDH Club', 'Acepta promos'] ||
         coalesce((select array_agg('Club ' || nombre) from club_niveles), '{}')
$kp$;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · LA BANDEJA
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_salidas (
  id        bigint generated always as identity primary key,
  cliente   bigint not null references club_clientes(id) on delete cascade,
  estado    estado_salida not null default 'pendiente',
  intentos  smallint not null default 0,
  creado    timestamptz not null default now(),
  ultimo    timestamptz,
  error     text,
  resultado jsonb
);

/* Un socio no puede tener dos pendientes: el alta y la resincronización del
   día podrían encolarlo dos veces, y mandarlo dos veces es gastar llamadas.
   Uno hecho y otro pendiente sí puede: es el cambio de nivel de mañana. */
create unique index if not exists club_salidas_una_pendiente on club_salidas (cliente)
  where estado = 'pendiente';
create index if not exists club_salidas_cola on club_salidas (creado)
  where estado = 'pendiente';

alter table club_salidas enable row level security;
revoke all on club_salidas from anon, authenticated;


/* Dejar a un socio en la cola. Sin token de Kommo configurado no hace nada:
   el Club anda igual sin el CRM. */
create or replace function club_kommo_encolar(p_cliente bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $ce$
begin
  if secreto('KOMMO_TOKEN') is null then return false; end if;
  insert into club_salidas (cliente) values (p_cliente) on conflict do nothing;
  return found;
end;
$ce$;

revoke all on function club_kommo_encolar(bigint) from public, anon, authenticated;


/* Cada alta, a la cola. El disparador no llama a Kommo: sólo anota. Así un
   Kommo lento o caído no le traba el alta a nadie parado en el mostrador. */
create or replace function club_kommo_alta()
returns trigger
language plpgsql
security definer
set search_path = public
as $ka$
begin
  perform club_kommo_encolar(new.id);
  return new;
end;
$ka$;

drop trigger if exists club_kommo_alta_tg on club_clientes;
create trigger club_kommo_alta_tg
  after insert on club_clientes
  for each row execute function club_kommo_alta();


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · MANDAR UN SOCIO
-- ══════════════════════════════════════════════════════════════════════════

/* Las etiquetas que tiene un contacto en Kommo, leídas de verdad. */
create or replace function kommo_etiquetas_de(p_contacto bigint)
returns text[]
language plpgsql
security definer
set search_path = public
as $ed$
declare
  r jsonb;
begin
  r := kommo('GET', '/contacts/' || p_contacto);
  return coalesce((select array_agg(t->>'name')
                     from jsonb_array_elements(coalesce(r#>'{_embedded,tags}', '[]'::jsonb)) t), '{}');
end;
$ed$;

revoke all on function kommo_etiquetas_de(bigint) from public, anon, authenticated;


create or replace function mandar_club_kommo(p_cliente bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mk$
declare
  c        v_club_clientes%rowtype;
  tel      text;
  cid      bigint;
  nuevo    boolean := false;
  quiere   text[];
  sacar    text[];
  tiene    text[];
  cc       jsonb := '[]'::jsonb;
  id_campo bigint;
  r        jsonb;
  metodo   text := 'agregar';
  ya       bigint;
begin
  select * into c from v_club_clientes where id = p_cliente;
  if not found then raise exception 'No existe el socio %.', p_cliente; end if;
  /* De la TABLA y no de la vista: la vista se armó con "c.*" antes de que
     existiera esta columna, y Postgres fija la lista de columnas de una
     vista el día que la crea. Leída de la vista, no existe. */
  select kommo_contacto into ya from club_clientes where id = p_cliente;

  quiere := club_kommo_etiquetas(p_cliente);
  /* Lo del Club que NO le corresponde: el nivel que ya no tiene, o "Acepta
     promos" si lo revocó. Nada que no sea del Club entra acá. */
  sacar := array(select e from unnest(club_kommo_propias()) e where e <> all(quiere));

  tel := kommo_tel(c.telefono);

  -- ── El contacto: el que ya sabemos, el que ya estaba, o uno nuevo ──
  cid := ya;
  if cid is null then
    cid := kommo_buscar_contacto(tel);
  end if;

  if cid is null then
    id_campo := kommo_campo('contacts', '#PHONE');
    if tel is not null and id_campo is not null then
      cc := cc || jsonb_build_array(jsonb_build_object(
        'field_id', id_campo, 'values', jsonb_build_array(jsonb_build_object('value', tel))));
    end if;
    id_campo := kommo_campo('contacts', '#EMAIL');
    if c.mail is not null and id_campo is not null then
      cc := cc || jsonb_build_array(jsonb_build_object(
        'field_id', id_campo, 'values', jsonb_build_array(jsonb_build_object('value', c.mail))));
    end if;

    r := kommo('POST', '/contacts', jsonb_build_array(
      jsonb_build_object('name', c.nombre, 'request_id', 'club-' || p_cliente)
      || case when jsonb_array_length(cc) > 0 then jsonb_build_object('custom_fields_values', cc) else '{}'::jsonb end
      || jsonb_build_object('_embedded', jsonb_build_object('tags',
           (select jsonb_agg(jsonb_build_object('name', e)) from unnest(quiere) e)))));
    cid := (r#>>'{_embedded,contacts,0,id}')::bigint;
    if cid is null then raise exception 'Kommo no devolvió el contacto creado.'; end if;
    nuevo := true;
  else
    /* Ya estaba: se agrega lo que falta y se saca lo del Club que sobra, de
       a una. Sus otras etiquetas no se tocan. Ver el encabezado. */
    perform kommo('PATCH', '/contacts', jsonb_build_array(
      jsonb_build_object('id', cid,
        'tags_to_add', (select jsonb_agg(jsonb_build_object('name', e)) from unnest(quiere) e))
      || case when cardinality(sacar) > 0 then jsonb_build_object('tags_to_delete',
           (select jsonb_agg(jsonb_build_object('name', e)) from unnest(sacar) e)) else '{}'::jsonb end));
  end if;

  -- ── Verificar: leer el contacto y mirar que haya quedado bien ──
  tiene := kommo_etiquetas_de(cid);
  if not (tiene @> quiere) or (tiene && sacar) then
    /* No lo aplicó. Plan B: armar la lista completa —las que tenía, menos
       las del Club que sobran, más las que faltan— y mandarla entera. */
    metodo := 'lista completa';
    tiene := array(select distinct e from unnest(
               array(select e from unnest(tiene) e where e <> all(sacar)) || quiere) e);
    perform kommo('PATCH', '/contacts', jsonb_build_array(jsonb_build_object('id', cid,
      '_embedded', jsonb_build_object('tags',
        (select jsonb_agg(jsonb_build_object('name', e)) from unnest(tiene) e)))));
    tiene := kommo_etiquetas_de(cid);
    if not (tiene @> quiere) or (tiene && sacar) then
      raise exception 'Kommo no aplicó las etiquetas (quedaron: %).', array_to_string(tiene, ', ');
    end if;
  end if;

  -- ── La nota, sólo la primera vez ──
  /* Para quien atiende en Kommo: de dónde salió este contacto. Si falla no
     tumba nada: las etiquetas, que son lo que importa, ya están. */
  if ya is null then
    begin
      perform kommo('POST', '/contacts/' || cid || '/notes', jsonb_build_array(jsonb_build_object(
        'note_type', 'common',
        'params', jsonb_build_object('text',
          'Socio del VDH Club desde el ' || to_char(c.creado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') ||
          coalesce(' (se anotó en ' || c.local_alta || ')', '') || '.' ||
          case when c.acepta_promos and c.revocado is null
               then E'\nAceptó recibir novedades por WhatsApp el ' ||
                    to_char(c.consentimiento at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') || '.'
               else E'\nNO aceptó recibir promociones: no escribirle con ofertas.' end))));
    exception when others then
      null;
    end;
  end if;

  update club_clientes
     set kommo_contacto = cid,
         kommo_etiquetas = array_to_string(quiere, '|')
   where id = p_cliente;

  return jsonb_build_object('contacto', cid, 'nuevo', nuevo, 'etiquetas', quiere, 'como', metodo);
end;
$mk$;

revoke all on function mandar_club_kommo(bigint) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 5 · EL DESPACHADOR, CADA MINUTO
-- Calcado de despachar_salidas (reloj.sql): seis intentos, espera creciente,
-- de a veinte, y el fallo de uno no corta la vuelta.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function despachar_club_salidas()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $dc$
declare
  s      club_salidas%rowtype;
  res    jsonb;
  hechos integer := 0;
begin
  for s in
    select * from club_salidas
     where estado = 'pendiente'
       and intentos < 6
       and (ultimo is null or ultimo < now() - (power(2, intentos) * interval '1 minute'))
     order by creado
     limit 20
     for update skip locked
  loop
    begin
      res := mandar_club_kommo(s.cliente);
      update club_salidas
         set estado = 'hecho', intentos = intentos + 1, ultimo = now(), error = null, resultado = res
       where id = s.id;
      hechos := hechos + 1;
    exception when others then
      update club_salidas
         set intentos = intentos + 1, ultimo = now(), error = left(sqlerrm, 500),
             estado = case when intentos + 1 >= 6 then 'fallado'::estado_salida
                           else 'pendiente'::estado_salida end
       where id = s.id;
    end;
  end loop;
  return hechos;
end;
$dc$;

revoke all on function despachar_club_salidas() from public, anon, authenticated;

select cron.schedule('despachar-club', '* * * * *', 'select despachar_club_salidas()');


-- ══════════════════════════════════════════════════════════════════════════
-- 6 · LA RESINCRONIZACIÓN DE CADA DÍA
--
-- El nivel cambia solo: sube con las compras y baja cuando las compras de
-- hace un año salen de la ventana. Una vez por día se encola a todo socio
-- cuyas etiquetas en Kommo ya no son las que le corresponden.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_kommo_resincronizar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $kr$
declare
  n integer := 0;
  s record;
begin
  if secreto('KOMMO_TOKEN') is null then
    return jsonb_build_object('encolados', 0, 'porque', 'Sin Kommo configurado.');
  end if;
  for s in
    select k.id from club_clientes k
     where k.baja is null
       and coalesce(k.kommo_etiquetas, '') <> array_to_string(club_kommo_etiquetas(k.id), '|')
  loop
    if club_kommo_encolar(s.id) then n := n + 1; end if;
  end loop;
  return jsonb_build_object('encolados', n);
end;
$kr$;

revoke all on function club_kommo_resincronizar() from public, anon, authenticated;

/* La tarea diaria del 16, con Kommo. */
create or replace function club_diario()
returns jsonb
language plpgsql
security definer
set search_path = public
as $cd$
begin
  return jsonb_build_object(
    'vencer', club_vencer(),
    'cumple', club_cumple_avisar(),
    'kommo',  club_kommo_resincronizar());
end;
$cd$;

revoke all on function club_diario() from public, anon, authenticated;
grant execute on function club_diario() to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- 7 · CÓMO VA, PARA "EL CLUB EN NÚMEROS"
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_kommo_estado(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ks$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'activo',      secreto('KOMMO_TOKEN') is not null,
    'en_kommo',    (select count(*) from club_clientes where kommo_contacto is not null and baja is null),
    'socios',      (select count(*) from club_clientes where baja is null),
    'con_promos',  (select count(*) from club_clientes
                     where kommo_contacto is not null and baja is null
                       and acepta_promos and revocado is null),
    'pendientes',  (select count(*) from club_salidas where estado = 'pendiente'),
    'fallados',    (select count(*) from club_salidas s
                     where s.estado = 'fallado'
                       and not exists (select 1 from club_salidas h
                                        where h.cliente = s.cliente and h.estado = 'hecho'
                                          /* Por número de fila y no por hora: dos cosas de la
                                             misma transacción tienen la misma hora. */
                                          and h.id > s.id)),
    'ultimo_error', (select error from club_salidas where estado = 'fallado'
                      order by ultimo desc limit 1));
end;
$ks$;

grant execute on function club_kommo_estado(text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 8 · LOS QUE YA ESTÁN, A LA COLA
-- ══════════════════════════════════════════════════════════════════════════

select count(*) as encolados from club_clientes where baja is null and club_kommo_encolar(id);

select 'socios en la cola para Kommo' as que, count(*)::text as cuantos
  from club_salidas where estado = 'pendiente';


-- ─────────────────────────── PARTE 18 ───────────────────────────
-- El regalo al subir de nivel, y el 402 de Kommo en castellano.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · EL REGALO AL SUBIR DE NIVEL
--
-- Correr entero en el editor SQL de Supabase, después del 16 y 17.
--
-- Decidido por Mauricio el 27/09/2026: al llegar a Oro, 500 puntos de
-- regalo; al llegar a Platino, 1.000. Con una notificación al celular.
--
-- Hasta acá subir de nivel no se notaba: pasaba en silencio y el cliente
-- se enteraba —si se enteraba— la próxima vez que abría la tarjeta. Un
-- regalo en el momento es lo que convierte "subí de nivel" en algo que se
-- festeja, y es lo que hace que el siguiente valga la pena perseguirlo.
--
-- ── Cómo se detecta ──
-- Un disparador sobre cada compra que entra: mira el nivel con y sin esa
-- compra. Va como disparador y no adentro de club_sumar_compra para que
-- valga venga la compra de donde venga —la caja hoy, la tienda online
-- mañana— sin tener que acordarse de agregarlo en cada lugar.
--
-- ── Una vez por año por nivel ──
-- El nivel se mide con lo comprado en los últimos 12 meses, así que puede
-- bajar y volver a subir. Sin tope, el mismo socio cobraría el regalo de
-- Oro cada vez que cruza la raya. Se regala una vez cada 12 meses por nivel.
--
-- ── Los regalos no suben el nivel ──
-- Son puntos de ajuste, no de compra, y el nivel sólo cuenta compras. Sin
-- eso, el regalo de Oro podría empujar a alguien a Platino, que le daría el
-- de Platino, en cadena.
-- ══════════════════════════════════════════════════════════════════════════


/* El regalo de cada nivel. Se cambia con un update; Plata va en 0 porque es
   donde arranca todo el mundo. */
alter table club_niveles add column if not exists bono integer not null default 0
  check (bono >= 0);

update club_niveles set bono = 500  where nombre = 'Oro'     and bono = 0;
update club_niveles set bono = 1000 where nombre = 'Platino' and bono = 0;


create or replace function club_subio_nivel()
returns trigger
language plpgsql
security definer
set search_path = public
as $sn$
declare
  despues integer;
  antes   integer;
  nv      record;
  nombre  text;
begin
  if new.tipo <> 'compra' or new.anulado is not null or coalesce(new.puntos, 0) <= 0 then
    return new;
  end if;

  /* El XP con esta compra y sin ella. Es la misma cuenta que la vista:
     compras no anuladas de los últimos 12 meses. */
  select coalesce(sum(puntos), 0) into despues
    from club_movimientos
   where cliente = new.cliente and tipo = 'compra' and anulado is null
     and creado > now() - interval '12 months';
  antes := despues - new.puntos;

  /* Todos los niveles cruzados con esta compra, no sólo el último: una
     compra grande puede pasar de Plata a Platino de una, y los dos regalos
     están ganados. */
  for nv in
    select n.nombre, n.bono, n.multiplica
      from club_niveles n
     where n.desde_xp > antes and n.desde_xp <= despues and n.bono > 0
     order by n.desde_xp
  loop
    if exists (select 1 from club_movimientos m
                where m.cliente = new.cliente and m.concepto = 'bono_nivel'
                  and m.obs = 'Llegaste a ' || nv.nombre
                  and m.anulado is null and m.creado > now() - interval '12 months') then
      continue;
    end if;

    insert into club_movimientos (cliente, tipo, concepto, puntos, local, vendedor, obs)
    values (new.cliente, 'ajuste', 'bono_nivel', nv.bono, new.local, new.vendedor,
            'Llegaste a ' || nv.nombre);

    /* El aviso al celular, si tiene los avisos prendidos. Sale ya: lo manda
       el Action de cada hora. En la caja el vendedor ya se lo dice en el
       momento; esto es para que le quede. */
    if exists (select 1 from club_suscripciones su
                where su.cliente = new.cliente and su.muerto is null) then
      select split_part(trim(c.nombre), ' ', 1) into nombre from club_clientes c where c.id = new.cliente;
      insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
      values (new.cliente, 'nivel', nv.nombre || '-' || to_char(now(), 'YYYY-MM-DD'),
              '¡Pasaste a ' || nv.nombre || ', ' || nombre || '!',
              'Te regalamos ' || replace(to_char(nv.bono, 'FM999,999'), ',', '.') ||
              ' puntos. Desde ahora sumás ' || replace(trim_scale(nv.multiplica)::text, '.', ',') ||
              ' puntos por cada $100.',
              'tarjeta.html', now())
      on conflict (cliente, motivo, clave) do nothing;
    end if;
  end loop;

  return new;
end;
$sn$;

revoke all on function club_subio_nivel() from public, anon, authenticated;

drop trigger if exists club_subio_nivel_tg on club_movimientos;
create trigger club_subio_nivel_tg
  after insert on club_movimientos
  for each row execute function club_subio_nivel();



-- ══════════════════════════════════════════════════════════════════════════
-- Y UN ERROR QUE SE ENTIENDA CUANDO KOMMO PIDE PAGO
--
-- La función que habla con Kommo (la misma del No Compra), igual a la que
-- está andando, con un caso más: el 402.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.kommo(metodo text, ruta text, cuerpo jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  sub  text := secreto('KOMMO_SUBDOMAIN');
  tok  text := secreto('KOMMO_TOKEN');
  res  extensions.http_response;
  url  text;
begin
  if sub is null or tok is null then
    raise exception 'Falta configurar KOMMO_SUBDOMAIN o KOMMO_TOKEN.';
  end if;

  url := 'https://' || sub || '.kommo.com/api/v4' || ruta;

  perform paciencia();
  res := extensions.http((
    metodo,
    url,
    array[extensions.http_header('Authorization', 'Bearer ' || tok)],
    case when cuerpo is null then null else 'application/json' end,
    case when cuerpo is null then null else cuerpo::text end
  )::extensions.http_request);

  if res.status = 401 then
    raise exception 'Kommo rechazó el token (401). Venció o fue revocado: generá uno nuevo.';
  end if;
  /* 402: la cuenta de Kommo quedó sin plan pagado. Kommo sigue dejando LEER
     pero no crear ni cambiar nada, así que los contactos y los leads no
     entran. Pasó el 28/09/2026 con los primeros socios del Club, y el
     mensaje crudo decía 'Payment Required' en inglés en el medio de un JSON. */
  if res.status = 402 then
    raise exception 'La cuenta de Kommo no está paga (402): deja ver pero no crear ni cambiar contactos. Se reintenta solo cuando se regularice.';
  end if;
  if res.status >= 300 then
    raise exception 'Kommo respondió % · %', res.status, left(coalesce(res.content, ''), 300);
  end if;

  -- 204 sin cuerpo: Kommo contesta así cuando una búsqueda no encuentra nada.
  if res.content is null or length(trim(res.content)) = 0 then return null; end if;
  return res.content::jsonb;
end;
$function$;

revoke execute on function kommo(text, text, jsonb) from anon, authenticated, public;


-- ══════════════════════════════════════════════════════════════════════════
-- EL ESTADO DE KOMMO, TAMBIÉN MIENTRAS REINTENTA
--
-- Antes el error se veía recién cuando un socio agotaba los seis intentos:
-- durante la primera media hora Configuración decía "4 en camino" como si
-- todo anduviera. Ahora el último error se muestra apenas aparece.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_kommo_estado(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ks$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'activo',      secreto('KOMMO_TOKEN') is not null,
    'en_kommo',    (select count(*) from club_clientes where kommo_contacto is not null and baja is null),
    'socios',      (select count(*) from club_clientes where baja is null),
    'con_promos',  (select count(*) from club_clientes
                     where kommo_contacto is not null and baja is null
                       and acepta_promos and revocado is null),
    'pendientes',  (select count(*) from club_salidas where estado = 'pendiente'),
    'reintentando', (select count(*) from club_salidas where estado = 'pendiente' and error is not null),
    'fallados',    (select count(*) from club_salidas s
                     where s.estado = 'fallado'
                       and not exists (select 1 from club_salidas h
                                        where h.cliente = s.cliente and h.estado = 'hecho'
                                          and h.id > s.id)),
    'ultimo_error', (select error from club_salidas
                      where error is not null and estado in ('pendiente', 'fallado')
                      order by ultimo desc limit 1));
end;
$ks$;

grant execute on function club_kommo_estado(text) to anon, authenticated;


select nombre, desde_xp, multiplica, bono from club_niveles order by orden;


-- ─────────────────────────── PARTE 19 ───────────────────────────
-- Hora feliz y días de la semana en los puntos extra.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · HORA FELIZ Y DÍAS DE LA SEMANA
--
-- Correr entero en el editor SQL de Supabase, después del 18.
--
-- Pedido por Mauricio el 28/09/2026 mirando Fidelity: "Martes de doble
-- puntos" y "Hora feliz 18–20 h, +50% de puntos".
--
-- Los puntos dobles ya existían, pero sólo por días enteros ("Hot Sale, del
-- 1 al 3"). Ahora pueden ser además:
--
--   · de algunos días de la semana    "los martes"
--   · de un horario                   "de 18 a 20 h"
--   · las dos cosas                   "los martes, de 18 a 20 h"
--
-- Siempre dentro de un rango de fechas con fin obligatorio. El tope de 31
-- días se estira a 92 cuando es por días o por horario: "los martes de
-- octubre a diciembre" son trece días de promo en tres meses, no noventa.
--
-- Las horas son de Argentina, igual que las fechas. La base está en UTC.
-- ══════════════════════════════════════════════════════════════════════════


alter table club_multiplicadores add column if not exists dias smallint[];
alter table club_multiplicadores add column if not exists hora_desde time;
alter table club_multiplicadores add column if not exists hora_hasta time;

alter table club_multiplicadores drop constraint if exists multi_horas;
alter table club_multiplicadores add constraint multi_horas check (
  (hora_desde is null and hora_hasta is null) or
  (hora_desde is not null and hora_hasta is not null and hora_hasta > hora_desde));

/* 0 = domingo … 6 = sábado, como lo cuenta Postgres (extract dow). */
alter table club_multiplicadores drop constraint if exists multi_dias;
alter table club_multiplicadores add constraint multi_dias check (
  dias is null or (cardinality(dias) between 1 and 7 and dias <@ array[0,1,2,3,4,5,6]::smallint[]));


-- ══════════════════════════════════════════════════════════════════════════
-- ¿VALE AHORA?
-- Una sola cuenta para la caja, la tarjeta y Configuración.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_multi_vale(m club_multiplicadores, t timestamptz)
returns boolean
language sql
stable
as $mv$
  select m.baja is null and t >= m.desde and t < m.hasta
     and (m.dias is null
          or extract(dow from (t at time zone 'America/Argentina/Buenos_Aires'))::smallint = any(m.dias))
     and (m.hora_desde is null
          or ((t at time zone 'America/Argentina/Buenos_Aires')::time >= m.hora_desde
              and (t at time zone 'America/Argentina/Buenos_Aires')::time < m.hora_hasta))
$mv$;


-- ══════════════════════════════════════════════════════════════════════════
-- CUÁNDO, DICHO COMO LO DIRÍA UNA PERSONA
--
-- "los martes, de 18 a 20 h, del 01/10 al 31/10". Lo arma la base para
-- que Configuración, la tarjeta y el aviso al celular digan lo mismo.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_multi_cuando(m club_multiplicadores)
returns text
language plpgsql
stable
as $mc$
declare
  nombres text[] := array['domingos','lunes','martes','miércoles','jueves','viernes','sábados'];
  d1 date := (m.desde at time zone 'America/Argentina/Buenos_Aires')::date;
  d2 date := (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1;
  lista text[];
  partes text[] := '{}';
  hora text;
begin
  /* Los días, en orden de lunes a domingo, que es como se dicen. */
  if m.dias is not null and cardinality(m.dias) < 7 then
    lista := array(select nombres[x + 1] from unnest(m.dias) x
                    order by case when x = 0 then 7 else x end);
    partes := partes || ('los ' || case
      when cardinality(lista) = 1 then lista[1]
      else array_to_string(lista[1:cardinality(lista) - 1], ', ') || ' y ' || lista[cardinality(lista)] end);
  end if;

  /* "de 18 a 20 h"; con minutos sólo si los hay: "de 18:30 a 20 h". */
  if m.hora_desde is not null then
    hora := 'de ' ||
      case when extract(minute from m.hora_desde) = 0 then to_char(m.hora_desde, 'FMHH24')
           else to_char(m.hora_desde, 'FMHH24:MI') end || ' a ' ||
      case when extract(minute from m.hora_hasta) = 0 then to_char(m.hora_hasta, 'FMHH24')
           else to_char(m.hora_hasta, 'FMHH24:MI') end || ' h';
    partes := partes || hora;
  end if;

  partes := partes || (case when d1 = d2 then 'el ' || to_char(d1, 'DD/MM')
                            else 'del ' || to_char(d1, 'DD/MM') || ' al ' || to_char(d2, 'DD/MM') end);
  return array_to_string(partes, ', ');
end;
$mc$;


-- ══════════════════════════════════════════════════════════════════════════
-- CUÁNTO SUMA HOY: igual que en el 16, con días y horario
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_factor(p_cliente bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $cf$
declare
  hoy       date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  c         record;
  cm        numeric;
  antes     integer;
  fin       date;
  pr        record;
  extra     numeric := 1;
  motivo    text;
  hasta     date;
  hora_fin  time;
  de_cumple boolean := false;
begin
  select v.multiplica, v.cumple into c from v_club_clientes v where v.id = p_cliente;
  select nullif(valor, '')::numeric into cm    from club_reglas where clave = 'cumple_multiplica';
  select nullif(valor, '')::integer into antes from club_reglas where clave = 'cumple_antes';

  if c.cumple is not null and coalesce(cm, 1) > 1 then
    fin := club_cumple_fin(c.cumple, hoy, coalesce(antes, 7));
    if fin is not null then
      extra := cm; motivo := 'Tu semana de cumple'; hasta := fin; de_cumple := true;
    end if;
  end if;

  select m.nombre, m.factor, m.hora_hasta,
         (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1 as ultimo
    into pr
    from club_multiplicadores m
   where club_multi_vale(m, now())
   order by m.factor desc, m.hasta desc
   limit 1;

  if pr.factor is not null and pr.factor > extra then
    extra := pr.factor; motivo := pr.nombre; hasta := pr.ultimo; de_cumple := false;
    /* Una hora feliz termina hoy a esa hora, no el último día del rango:
       "hasta las 20 h" es lo que el cliente necesita saber. */
    hora_fin := pr.hora_hasta;
  end if;

  return jsonb_build_object(
    'total',  round(coalesce(c.multiplica, 1) * extra, 2),
    'nivel',  coalesce(c.multiplica, 1),
    'extra',  extra,
    'motivo', motivo,
    'hasta',  hasta,
    'hora_hasta', case when hora_fin is null then null
                       when extract(minute from hora_fin) = 0 then to_char(hora_fin, 'FMHH24')
                       else to_char(hora_fin, 'FMHH24:MI') end,
    'cumple', de_cumple,
    'es_cumple', c.cumple is not null
                 and club_cumple_en(c.cumple, extract(year from hoy)::int) = hoy);
end;
$cf$;

revoke all on function club_factor(bigint) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- CONFIGURACIÓN: LISTAR Y GUARDAR
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_multi_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ml$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'nombre', m.nombre, 'factor', m.factor,
             'desde', (m.desde at time zone 'America/Argentina/Buenos_Aires')::date,
             'hasta', (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1,
             'dias', m.dias,
             'hora_desde', to_char(m.hora_desde, 'HH24:MI'),
             'hora_hasta', to_char(m.hora_hasta, 'HH24:MI'),
             'cuando', club_multi_cuando(m),
             /* "vigente" es que el rango está en curso; "ahora", que además
                hoy es uno de sus días y es su horario. */
             'vigente', now() >= m.desde and now() < m.hasta,
             'ahora', club_multi_vale(m, now()),
             'futura',  now() < m.desde)
           order by m.desde desc)
      from (select * from club_multiplicadores
             where baja is null and hasta > now() - interval '60 days'
             order by desde desc limit 30) m
  ), '[]'::jsonb);
end;
$ml$;

grant execute on function club_multi_listar(text) to anon, authenticated;


/* Cambia la firma —tres parámetros más—, así que la vieja se borra: con las
   dos, PostgREST elige por los nombres que le llegan y una página vieja
   seguiría entrando por la otra. */
drop function if exists club_multi_guardar(text, bigint, text, numeric, text, text, text, boolean);

create or replace function club_multi_guardar(
  p_pin text, p_id bigint, p_nombre text, p_factor numeric,
  p_desde text, p_hasta text, p_por text default null, p_avisar boolean default false,
  p_dias smallint[] default null, p_hora_desde text default null, p_hora_hasta text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mg$
declare
  d1  date;
  d2  date;
  h1  time;
  h2  time;
  ds  smallint[];
  ini timestamptz;
  fin timestamptz;
  nom text := nullif(trim(coalesce(p_nombre, '')), '');
  nid bigint;
  cuantos integer := 0;
  tope integer;
  fx  text := replace(trim_scale(p_factor)::text, '.', ',');
  m   club_multiplicadores%rowtype;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  if nom is null then
    return jsonb_build_object('ok', false, 'porque', 'Ponele un nombre: es lo que ven los socios.');
  end if;
  if length(nom) > 60 then
    return jsonb_build_object('ok', false, 'porque', 'El nombre es muy largo. Hasta 60 letras.');
  end if;
  if p_factor is null or p_factor <= 1 or p_factor > 3 then
    return jsonb_build_object('ok', false, 'porque', 'El multiplicador va entre 1,5 y 3.');
  end if;

  begin
    d1 := p_desde::date;
    d2 := p_hasta::date;
    h1 := nullif(trim(coalesce(p_hora_desde, '')), '')::time;
    h2 := nullif(trim(coalesce(p_hora_hasta, '')), '')::time;
  exception when others then
    return jsonb_build_object('ok', false, 'porque', 'Revisá las fechas y los horarios.');
  end;
  if d1 is null or d2 is null then
    return jsonb_build_object('ok', false, 'porque', 'Faltan las fechas. La de fin es obligatoria.');
  end if;
  if d2 < d1 then
    return jsonb_build_object('ok', false, 'porque', 'Termina antes de empezar.');
  end if;
  if d2 < (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    return jsonb_build_object('ok', false, 'porque', 'Esas fechas ya pasaron.');
  end if;
  if (h1 is null) <> (h2 is null) then
    return jsonb_build_object('ok', false, 'porque', 'El horario necesita las dos horas: desde y hasta.');
  end if;
  if h1 is not null and h2 <= h1 then
    return jsonb_build_object('ok', false, 'porque', 'La hora de fin tiene que ser después de la de inicio.');
  end if;

  /* Todos los días marcados es lo mismo que ningún filtro. */
  ds := case when p_dias is null or cardinality(p_dias) = 0 or cardinality(p_dias) = 7 then null
             else array(select distinct x from unnest(p_dias) x order by x) end;
  if ds is not null and not (ds <@ array[0,1,2,3,4,5,6]::smallint[]) then
    return jsonb_build_object('ok', false, 'porque', 'Revisá los días.');
  end if;

  tope := case when ds is not null or h1 is not null then 92 else 31 end;
  if d2 - d1 > tope then
    return jsonb_build_object('ok', false, 'porque',
      case when tope = 31 then 'Hasta 31 días. Más que eso deja de ser una fecha especial.'
           else 'Hasta tres meses. Más que eso deja de ser una promo y pasa a ser la regla.' end);
  end if;

  ini := d1::timestamp at time zone 'America/Argentina/Buenos_Aires';
  fin := (d2 + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';

  if p_id is null then
    insert into club_multiplicadores (nombre, factor, desde, hasta, por, dias, hora_desde, hora_hasta)
    values (nom, p_factor, ini, fin, nullif(trim(coalesce(p_por, '')), ''), ds, h1, h2)
    returning id into nid;
  else
    update club_multiplicadores
       set nombre = nom, factor = p_factor, desde = ini, hasta = fin,
           dias = ds, hora_desde = h1, hora_hasta = h2
     where id = p_id and baja is null
    returning id into nid;
    if nid is null then
      return jsonb_build_object('ok', false, 'porque', 'No lo encontré. Puede que lo hayan quitado.');
    end if;
  end if;

  if coalesce(p_avisar, false) then
    select count(*) into cuantos from club_suscripciones where muerto is null;
    if cuantos > 0 then
      select * into m from club_multiplicadores where id = nid;
      insert into club_avisos (titulo, cuerpo, enlace, por, sale)
      values (
        nom || ': puntos x' || fx,
        /* "1,5 veces más" se lee como 2,5: los que no son redondos van en
           porcentaje, "un 50% más". */
        'Tus compras en VDH suman ' ||
          case when p_factor = 2 then 'el doble' when p_factor = 3 then 'el triple'
               else 'un ' || round((p_factor - 1) * 100)::int || '% más' end ||
          ' de puntos ' || club_multi_cuando(m) || '.',
        'tarjeta.html#promos',
        'Puntos dobles',
        greatest(now(), ini + interval '10 hours'));
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', nid, 'avisados', cuantos);
end;
$mg$;

grant execute on function club_multi_guardar(text, bigint, text, numeric, text, text, text, boolean, smallint[], text, text)
  to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- LO QUE VE EL SOCIO EN "PROMOS"
--
-- Los puntos extra en curso y los que arrancan en la próxima semana, sin
-- nada que no sea público: nombre, cuánto suman y cuándo. Sin PIN, como
-- las promociones: es lo que se quiere que vea todo el mundo.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_multi_publicos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $mp$
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', m.nombre, 'factor', m.factor,
           'cuando', club_multi_cuando(m),
           'ahora', club_multi_vale(m, now()))
         order by club_multi_vale(m, now()) desc, m.desde), '[]'::jsonb)
    from club_multiplicadores m
   where m.baja is null and m.hasta > now() and m.desde < now() + interval '7 days'
$mp$;

grant execute on function club_multi_publicos() to anon, authenticated;


select 'listo: días y horario en los puntos extra' as que;


-- ─────────────────────────── PARTE 20 ───────────────────────────
-- La tarjeta dice qué da cada nivel.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LA TARJETA DICE QUÉ DA CADA NIVEL
--
-- Correr entero en el editor SQL de Supabase, después del 19.
--
-- La función de la tarjeta, igual a la que está andando, con tres datos más
-- en el nivel: el regalo de cumpleaños de ese nivel, y cuánto suma y cuánto
-- regalan al llegar al siguiente. Para la tarjeta del nivel nueva
-- (28/09/2026), la que se inspiró en la app de Fidelity.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.club_tarjeta(p_codigo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'hoy', club_factor(c.id),
        'cumple', club_regalo_cumple(c.id),

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          /* Lo que da este nivel y lo que da el siguiente, para que la
             tarjeta pueda decirlo: si el cliente no sabe qué le da Oro,
             Oro no es algo que quiera. */
          'regalo_cumple', (select case when g.tipo = 'descuento'
                                        then g.porcentaje || '% de descuento en tu compra'
                                        else g.producto end
                              from club_regalos_cumple g where g.nivel = c.nivel),
          'sigue_multiplica', (select nv.multiplica from club_niveles nv
                                where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue_bono', (select nv.bono from club_niveles nv
                          where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb)
      ) from c
    ) end
$function$;

grant execute on function club_tarjeta(text) to anon, authenticated;


-- ─────────────────────────── PARTE 21 ───────────────────────────
-- Reseñas en Google, cada local las suyas.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · RESEÑAS EN GOOGLE, CADA LOCAL LAS SUYAS
--
-- Correr entero en el editor SQL de Supabase, después del 20.
--
-- Decidido con Mauricio el 29/09/2026: cada local junta sus propias
-- reseñas. No es una preferencia, es como funciona Google: una ficha por
-- local físico, y las reseñas atadas a la ficha. Y es lo que conviene: una
-- búsqueda de "ropa cerca" desde Flores compara la ficha de Flores con los
-- negocios de Flores.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LAS DOS REGLAS DE GOOGLE
-- ══════════════════════════════════════════════════════════════════════════
--
--   1. NADA A CAMBIO. Ni puntos, ni descuento. Pagar una reseña puede hacer
--      que Google las borre y restrinja la ficha.
--
--   2. A TODOS POR IGUAL. Pedírsela sólo a los conformes ("review gating")
--      también está prohibido. Por eso esto no mira nada del cliente: todo
--      el que compró recibe el pedido, con el mismo texto.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CÓMO SE PIDE
-- ══════════════════════════════════════════════════════════════════════════
--
-- Al día siguiente de una compra, a las 11, un aviso al celular con el
-- enlace de reseñas DEL LOCAL donde compró. Una vez cada 90 días por
-- cliente como máximo: alguien que compra seguido no puede recibir un
-- pedido por semana. Y en la tarjeta, durante los 7 días siguientes a la
-- compra, un botón con el mismo enlace.
--
-- El enlace de cada local se carga desde Configuración. El que no tiene
-- enlace, no pide nada.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · EL ENLACE DE CADA LOCAL Y LAS REGLAS
-- ══════════════════════════════════════════════════════════════════════════

alter table locales add column if not exists resena_url text;

insert into club_reglas (clave, valor) values
  ('resena_cada_dias', '90'),   -- a un mismo cliente, como mucho una vez cada 90 días
  ('resena_hora',      '11')    -- el día siguiente a la compra, a esta hora
on conflict (clave) do nothing;


/* Un enlace de Google y nada más: lo que se carga acá termina en el celular
   de los clientes, y un enlace cualquiera sería una puerta para mandarlos a
   cualquier lado. */
create or replace function club_resena_url_ok(u text)
returns boolean
language sql
immutable
as $ru$
  select u ~* '^https://(g\.page|www\.google\.[a-z.]+|google\.[a-z.]+|search\.google\.com|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|g\.co)/'
$ru$;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · CONFIGURACIÓN
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_resenas_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $rl$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'codigo', l.codigo,
             'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
             'url', l.resena_url,
             /* Cuántos pedidos salieron de ese local en los últimos 30 días:
                no dice cuántas reseñas dejaron —eso lo sabe Google—, pero
                sí si el pedido está saliendo. */
             'pedidos_30', (select count(*) from club_avisos_personales p
                             where p.motivo = 'resena'
                               and split_part(p.clave, '|', 1) = l.codigo
                               and p.creado > now() - interval '30 days'))
           order by l.codigo)
      from locales l where l.activo
  ), '[]'::jsonb);
end;
$rl$;

grant execute on function club_resenas_listar(text) to anon, authenticated;


create or replace function club_resena_guardar(p_pin text, p_codigo text, p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $rg$
declare
  u text := nullif(trim(coalesce(p_url, '')), '');
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if u is not null and not club_resena_url_ok(u) then
    return jsonb_build_object('ok', false, 'porque',
      'Tiene que ser el enlace de reseñas de Google (empieza con https://g.page/… o https://www.google…).');
  end if;
  update locales set resena_url = u where codigo = p_codigo;
  if not found then
    return jsonb_build_object('ok', false, 'porque', 'No encontré ese local.');
  end if;
  return jsonb_build_object('ok', true);
end;
$rg$;

grant execute on function club_resena_guardar(text, text, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · EL PEDIDO DEL DÍA SIGUIENTE
--
-- Corre en la tarea diaria de las 6. Toma las compras de AYER (en hora de
-- Argentina) hechas en un local con enlace, y deja un aviso personal para
-- las 11. Si el cliente compró dos veces ayer, la última manda.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_resenas_pedir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $rp$
declare
  hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  cada  integer;
  hora  integer;
  s     record;
  n     integer := 0;
begin
  select nullif(valor, '')::integer into cada from club_reglas where clave = 'resena_cada_dias';
  select nullif(valor, '')::integer into hora from club_reglas where clave = 'resena_hora';
  cada := coalesce(cada, 90);
  hora := coalesce(hora, 11);

  for s in
    select distinct on (m.cliente) m.cliente, l.codigo, l.resena_url,
           coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))) as local_nombre
      from club_movimientos m
      join locales l on upper(trim(l.codigo)) = upper(trim(m.local))
      join club_clientes c on c.id = m.cliente
     where m.tipo = 'compra' and m.anulado is null
       and (m.creado at time zone 'America/Argentina/Buenos_Aires')::date = hoy - 1
       and l.resena_url is not null and c.baja is null
       /* Con los avisos prendidos: sin suscripción no hay a dónde mandarlo.
          Igual lo ve en la tarjeta. */
       and exists (select 1 from club_suscripciones su where su.cliente = m.cliente and su.muerto is null)
       and not exists (select 1 from club_avisos_personales p
                        where p.cliente = m.cliente and p.motivo = 'resena'
                          and p.creado > now() - (cada || ' days')::interval)
     order by m.cliente, m.creado desc
  loop
    insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
    values (s.cliente, 'resena', s.codigo || '|' || (hoy - 1)::text,
            '¿Cómo te atendieron en ' || s.local_nombre || '?',
            'Contanos en Google cómo fue tu compra. Nos ayuda a que más gente nos encuentre.',
            s.resena_url,
            greatest(now(), (hoy::timestamp + make_interval(hours => hora)) at time zone 'America/Argentina/Buenos_Aires'))
    on conflict (cliente, motivo, clave) do nothing;
    if found then n := n + 1; end if;
  end loop;

  return jsonb_build_object('pedidos', n);
end;
$rp$;

revoke all on function club_resenas_pedir() from public, anon, authenticated;
grant execute on function club_resenas_pedir() to service_role;


/* La tarea diaria, con las reseñas. */
create or replace function club_diario()
returns jsonb
language plpgsql
security definer
set search_path = public
as $cd$
begin
  return jsonb_build_object(
    'vencer',  club_vencer(),
    'cumple',  club_cumple_avisar(),
    'kommo',   club_kommo_resincronizar(),
    'resenas', club_resenas_pedir());
end;
$cd$;

revoke all on function club_diario() from public, anon, authenticated;
grant execute on function club_diario() to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · LA TARJETA: el botón de reseña durante 7 días después de comprar
-- (la función que está andando, con un dato más: `resena`)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.club_tarjeta(p_codigo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'hoy', club_factor(c.id),
        'cumple', club_regalo_cumple(c.id),
        /* La última compra de los últimos 7 días en un local con enlace de
           reseñas: la tarjeta muestra "¿Qué tal tu compra en Flores?". */
        'resena', (select jsonb_build_object(
                      'local', l.codigo,
                      'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                      'url', l.resena_url,
                      'cuando', m.creado)
                     from club_movimientos m
                     join locales l on upper(trim(l.codigo)) = upper(trim(m.local))
                    where m.cliente = c.id and m.tipo = 'compra' and m.anulado is null
                      and m.creado > now() - interval '7 days'
                      and l.resena_url is not null
                    order by m.creado desc limit 1),

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          /* Lo que da este nivel y lo que da el siguiente, para que la
             tarjeta pueda decirlo: si el cliente no sabe qué le da Oro,
             Oro no es algo que quiera. */
          'regalo_cumple', (select case when g.tipo = 'descuento'
                                        then g.porcentaje || '% de descuento en tu compra'
                                        else g.producto end
                              from club_regalos_cumple g where g.nivel = c.nivel),
          'sigue_multiplica', (select nv.multiplica from club_niveles nv
                                where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue_bono', (select nv.bono from club_niveles nv
                          where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb)
      ) from c
    ) end
$function$;

grant execute on function club_tarjeta(text) to anon, authenticated;

select codigo, resena_url from locales order by codigo;


-- ─────────────────────────── PARTE 22 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LAS FOTOS DE LOS PREMIOS Y LA NOVEDAD DE INICIO
--
-- Correr entero en el editor SQL de Supabase, después del 21.
--
-- Para el diseño nuevo de la tarjeta (28/09/2026):
--
--   · Cada premio puede tener su foto. Se carga desde Configuración, igual
--     que la de las promos: la dirección de una imagen ya publicada (la de
--     la tienda online, por ejemplo). El que no tiene foto muestra su ícono.
--
--   · Inicio muestra UNA novedad: foto, una bajada ("Nueva colección"), un
--     título y a dónde lleva. Es una sola a propósito —Inicio es corto— y se
--     cambia o se saca desde Configuración.
--
--   · La tarjeta trae los locales que tienen enlace de reseñas, para el
--     "Tu opinión nos importa" de Inicio. El local que no tiene enlace no
--     aparece en la lista.
--
-- Deja cargadas la foto del perfume y la novedad de la campera, colgadas en
-- vdhclub.com. Las dos se cambian desde Configuración.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · LA DIRECCIÓN DE UNA FOTO
-- ══════════════════════════════════════════════════════════════════════════

/* Sólo https y sin nada raro adentro: la dirección termina escrita en la
   página de los clientes. Una foto no puede llevar a ningún lado, pero una
   comilla mal puesta sí podría romper la página. */
create or replace function club_foto_url_ok(u text)
returns boolean
language sql
immutable
as $fu$
  select u ~* '^https://[^\s"''<>()\\]+$' and length(u) <= 1000
$fu$;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · LA FOTO DE CADA PREMIO
-- ══════════════════════════════════════════════════════════════════════════

alter table club_premios add column if not exists imagen text;

create or replace function club_premios_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pl$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle, 'puntos', p.puntos,
             'valor', p.valor, 'costo', p.costo, 'limite_anual', p.limite_anual,
             'activo', p.activo, 'imagen', p.imagen,
             'entregados', (select count(*) from club_movimientos m
                             where m.premio = p.id and m.tipo = 'canje' and m.anulado is null))
           order by p.activo desc, p.orden, p.puntos)
      from club_premios p
  ), '[]'::jsonb);
end;
$pl$;

grant execute on function club_premios_listar(text) to anon, authenticated;


/* La foto va aparte del resto del premio: se cambia sola, desde su propio
   campo, y no obliga a volver a guardar los puntos y el costo. Vacía la
   saca. */
create or replace function club_premio_foto(p_pin text, p_id smallint, p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pf$
declare
  u text := nullif(trim(coalesce(p_url, '')), '');
  n integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if u is not null and not club_foto_url_ok(u) then
    return jsonb_build_object('ok', false, 'porque',
      'Esa dirección no sirve. Tiene que empezar con https:// y ser la de la imagen.');
  end if;
  update club_premios set imagen = u where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('ok', false, 'porque', 'No encontré ese premio.');
  end if;
  return jsonb_build_object('ok', true);
end;
$pf$;

revoke all on function club_premio_foto(text, smallint, text) from public;
grant execute on function club_premio_foto(text, smallint, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · LA NOVEDAD DE INICIO
-- ══════════════════════════════════════════════════════════════════════════

/* Una sola fila (id = 1). Sacarla la apaga y no la borra: la próxima vez
   se edita la misma. */
create table if not exists club_novedad (
  id         smallint primary key default 1 check (id = 1),
  bajada     text,
  titulo     text not null,
  imagen     text not null,
  enlace     text,
  activa     boolean not null default true,
  cambiada   timestamptz not null default now()
);

alter table club_novedad enable row level security;
revoke all on club_novedad from anon, authenticated;


create or replace function club_novedad_ver(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $nv$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return (select jsonb_build_object('bajada', bajada, 'titulo', titulo, 'imagen', imagen,
                                    'enlace', enlace, 'activa', activa, 'cambiada', cambiada)
            from club_novedad where id = 1);
end;
$nv$;

revoke all on function club_novedad_ver(text) from public;
grant execute on function club_novedad_ver(text) to anon, authenticated;


create or replace function club_novedad_guardar(
  p_pin text, p_bajada text, p_titulo text, p_imagen text, p_enlace text, p_activa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ng$
declare
  tit text := nullif(trim(coalesce(p_titulo, '')), '');
  baj text := nullif(trim(coalesce(p_bajada, '')), '');
  img text := nullif(trim(coalesce(p_imagen, '')), '');
  enl text := nullif(trim(coalesce(p_enlace, '')), '');
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  /* Apagarla no pide nada más: es el botón "Sacar de Inicio". */
  if p_activa is false then
    update club_novedad set activa = false, cambiada = now() where id = 1;
    return jsonb_build_object('ok', true);
  end if;
  if tit is null then
    return jsonb_build_object('ok', false, 'porque', 'Ponele un título: es lo que lee el cliente.');
  end if;
  if length(tit) > 60 then
    return jsonb_build_object('ok', false, 'porque', 'El título, hasta 60 letras: en el celular no entra más.');
  end if;
  if baj is not null and length(baj) > 30 then
    return jsonb_build_object('ok', false, 'porque', 'La bajada, hasta 30 letras (por ejemplo "Nueva colección").');
  end if;
  if img is null or not club_foto_url_ok(img) then
    return jsonb_build_object('ok', false, 'porque',
      'Falta la foto, o la dirección no sirve. Tiene que empezar con https:// y ser la de la imagen.');
  end if;
  if enl is not null and not club_foto_url_ok(enl) then
    return jsonb_build_object('ok', false, 'porque', 'El enlace tiene que empezar con https://.');
  end if;
  insert into club_novedad (id, bajada, titulo, imagen, enlace, activa, cambiada)
  values (1, baj, tit, img, enl, true, now())
  on conflict (id) do update
     set bajada = excluded.bajada, titulo = excluded.titulo, imagen = excluded.imagen,
         enlace = excluded.enlace, activa = true, cambiada = now();
  return jsonb_build_object('ok', true);
end;
$ng$;

revoke all on function club_novedad_guardar(text, text, text, text, text, boolean) from public;
grant execute on function club_novedad_guardar(text, text, text, text, text, boolean) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · LO QUE YA QUEDA CARGADO
-- ══════════════════════════════════════════════════════════════════════════

update club_premios set imagen = 'https://vdhclub.com/fotos/perfume-vdh-fusion.jpg'
 where imagen is null and nombre ilike 'perfume%';

insert into club_novedad (id, bajada, titulo, imagen, enlace)
values (1, 'Nueva colección', 'Llegó la primavera a VDH', 'https://vdhclub.com/fotos/novedad-ocean-pacific.jpg', 'https://vdh.com.ar/')
on conflict (id) do nothing;


-- ══════════════════════════════════════════════════════════════════════════
-- 5 · LA TARJETA: LA FOTO DE CADA PREMIO, LA NOVEDAD Y LOS LOCALES CON RESEÑAS
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.club_tarjeta(p_codigo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'hoy', club_factor(c.id),
        'cumple', club_regalo_cumple(c.id),
        /* La última compra de los últimos 7 días en un local con enlace de
           reseñas: la tarjeta muestra "¿Qué tal tu compra en Flores?". */
        'resena', (select jsonb_build_object(
                      'local', l.codigo,
                      'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                      'url', l.resena_url,
                      'cuando', m.creado)
                     from club_movimientos m
                     join locales l on upper(trim(l.codigo)) = upper(trim(m.local))
                    where m.cliente = c.id and m.tipo = 'compra' and m.anulado is null
                      and m.creado > now() - interval '7 days'
                      and l.resena_url is not null
                    order by m.creado desc limit 1),

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          /* Lo que da este nivel y lo que da el siguiente, para que la
             tarjeta pueda decirlo: si el cliente no sabe qué le da Oro,
             Oro no es algo que quiera. */
          'regalo_cumple', (select case when g.tipo = 'descuento'
                                        then g.porcentaje || '% de descuento en tu compra'
                                        else g.producto end
                              from club_regalos_cumple g where g.nivel = c.nivel),
          'sigue_multiplica', (select nv.multiplica from club_niveles nv
                                where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue_bono', (select nv.bono from club_niveles nv
                          where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor, 'imagen', p.imagen,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        /* La novedad de Inicio, si está prendida. */
        'novedad', (select jsonb_build_object('bajada', n.bajada, 'titulo', n.titulo,
                                              'imagen', n.imagen, 'enlace', n.enlace)
                      from club_novedad n where n.id = 1 and n.activa),

        /* Los locales que tienen enlace de reseñas, para elegir en Inicio. */
        'resenas_locales', coalesce((
          select jsonb_agg(jsonb_build_object('local', l.codigo, 'url', l.resena_url) order by l.codigo)
            from locales l
           where l.resena_url is not null and club_resena_url_ok(l.resena_url)), '[]'::jsonb),

        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb)
      ) from c
    ) end
$function$;

grant execute on function club_tarjeta(text) to anon, authenticated;

select id, nombre, imagen is not null as con_foto from club_premios order by orden;


-- ─────────────────────────── PARTE 23 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LOS NÚMEROS DEL CLUB
--
-- Correr entero en el editor SQL de Supabase, después del 22.
--
-- Para la pantalla "Club · Números" del No Compra (29/09/2026), tomada de lo
-- mejor de Puntito —el período elegible, los números arriba comparados con
-- el período anterior, los clientes por actividad— y con lo que ellos no
-- pueden tener porque manejan un solo local: los 14 locales comparados, los
-- vendedores, los socios a recuperar con su aviso, los puntos por vencer y
-- el costo a precio de costo, no de venta.
--
-- Tres funciones, las tres con PIN (la pantalla muestra nombres de socios):
--
--   club_estadisticas        todo el tablero, para un período y un local
--   club_movimientos_buscar  la lista de movimientos, con buscador y filtros
--   club_avisar_recuperar    el aviso a los socios que dejaron de venir
--
-- No cambia ninguna tabla. Sólo lee, salvo el aviso, que escribe en la cola
-- de avisos personales que ya existe (la manda el envío de cada hora).
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · EL RESUMEN DE UN PERÍODO
-- ══════════════════════════════════════════════════════════════════════════

/* Los números de arriba, para un rango de tiempo y un local (o todos). Es
   función aparte porque se pide tres veces: el período, el anterior —para
   el "vs. período anterior"— y cada uno de los 14 locales.

   Interna: la llama club_estadisticas, que ya pidió el PIN. De afuera no. */
create or replace function club_est_resumen(t0 timestamptz, t1 timestamptz, loc text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $er$
  with m as (
    select m.*
      from club_movimientos m
     where m.anulado is null and m.creado >= t0 and m.creado < t1
       and (loc is null or upper(trim(m.local)) = loc)
  ),
  c as (
    select cliente, count(*) as n from m where tipo = 'compra' group by cliente
  )
  select jsonb_build_object(
    /* Socios nuevos: los que se anotaron en el período. Con un local
       elegido, los que se anotaron EN ese local. */
    'nuevos', (select count(*) from club_clientes k
                where k.baja is null and k.creado >= t0 and k.creado < t1
                  and (loc is null or upper(trim(k.local_alta)) = loc)),
    'compras', (select count(*) from m where tipo = 'compra'),
    'facturado', (select coalesce(sum(importe), 0) from m where tipo = 'compra'),
    'clientes', (select count(*) from c),
    /* Los que compraron y NO era su primera compra: ya habían comprado
       antes, o compraron dos veces en el período. Es "volvieron". */
    'volvieron', (select count(*) from c
                   where c.n > 1
                      or exists (select 1 from club_movimientos x
                                  where x.cliente = c.cliente and x.tipo = 'compra'
                                    and x.anulado is null and x.creado < t0)),
    'puntos_compras', (select coalesce(sum(puntos), 0) from m where tipo = 'compra'),
    'puntos_regalo', (select coalesce(sum(puntos), 0) from m where tipo = 'ajuste' and puntos > 0),
    'canjes', (select count(*) from m where tipo = 'canje'),
    'puntos_canjeados', (select coalesce(-sum(puntos), 0) from m where tipo = 'canje'),
    'regalos_cumple', (select count(*) from m where concepto = 'regalo_cumple'),
    /* Lo que salió en premios y regalos, a COSTO: el del movimiento si se
       anotó, si no el del catálogo. */
    'costo', (select coalesce(sum(coalesce(m.costo, p.costo)), 0)
                from m left join club_premios p on p.id = m.premio
               where m.tipo = 'canje' or m.concepto = 'regalo_cumple')
  )
$er$;

revoke all on function club_est_resumen(timestamptz, timestamptz, text) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · EL TABLERO
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_estadisticas(p_pin text, p_desde date, p_hasta date, p_local text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ce$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  d0  date := coalesce(p_desde, hoy - 29);
  d1  date := coalesce(p_hasta, hoy);
  aux date;
  dias integer;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  t0 timestamptz; t1 timestamptz; a0 timestamptz;
  escala text;
  costo_punto numeric;
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  if d1 < d0 then aux := d0; d0 := d1; d1 := aux; end if;
  /* Tres años como mucho: más que eso no es un período, es la historia. */
  if d1 - d0 > 1100 then d0 := d1 - 1100; end if;
  dias := d1 - d0 + 1;
  t0 := d0::timestamp at time zone tz;
  t1 := (d1 + 1)::timestamp at time zone tz;
  a0 := (d0 - dias)::timestamp at time zone tz;      -- el período anterior, del mismo largo
  /* El gráfico por día: con más de tres meses serían puntos ilegibles. */
  escala := case when dias <= 92 then 'day' when dias <= 400 then 'week' else 'month' end;

  /* Cuánto cuesta un punto que se canjea, en promedio del catálogo activo:
     para pasar los puntos que los socios tienen guardados a plata. */
  select case when sum(puntos) > 0 then sum(costo) / sum(puntos) end
    into costo_punto
    from club_premios where activo and costo is not null and puntos > 0;

  with
  mov as (
    select m.*, (m.creado at time zone tz) as local_ts
      from club_movimientos m
     where m.anulado is null and m.creado >= t0 and m.creado < t1
       and (loc is null or upper(trim(m.local)) = loc)
  ),
  compras as (select * from mov where tipo = 'compra'),
  /* Los socios que se miran en "hoy": todos, o los anotados en el local. */
  socios as (
    select v.*
      from v_club_clientes v
     where v.baja is null
       and (loc is null or upper(trim(v.local_alta)) = loc)
  ),
  primera as (
    select cliente, min(creado) as cuando
      from club_movimientos where tipo = 'compra' and anulado is null
     group by cliente
  ),
  vivos as (
    select distinct cliente from club_suscripciones where muerto is null and cliente is not null
  ),
  a_recuperar as (
    select s.* from socios s
     where s.ultima_compra is not null
       and s.ultima_compra < now() - interval '60 days'
       and s.ultima_compra >= now() - interval '365 days'
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', d0, 'hasta', d1, 'dias', dias,
                                  'antes_desde', d0 - dias, 'antes_hasta', d0 - 1,
                                  'local', loc, 'escala', escala),
    'actual',   club_est_resumen(t0, t1, loc),
    'anterior', club_est_resumen(a0, t0, loc),

    /* Cada cuántos días vuelve a comprar un socio: el promedio de los
       espacios entre compras seguidas de un mismo socio, en el último año
       hasta el fin del período. */
    'frecuencia_dias', (
      select round(avg(extract(epoch from g.gap) / 86400))
        from (select creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null
                 and creado < t1 and creado >= t1 - interval '365 days'
                 and (loc is null or upper(trim(local)) = loc)) g
       where g.gap is not null),

    /* Hoy, no en el período: cuánto hace que compró cada socio. */
    'actividad', (
      select jsonb_build_object(
        'total', count(*),
        'ultimos_30', count(*) filter (where ultima_compra >= now() - interval '30 days'),
        'de_31_a_90', count(*) filter (where ultima_compra <  now() - interval '30 days'
                                         and ultima_compra >= now() - interval '90 days'),
        'mas_de_90',  count(*) filter (where ultima_compra <  now() - interval '90 days'),
        'nunca',      count(*) filter (where ultima_compra is null))
        from socios),

    /* Los que venían y dejaron: la última compra hace entre 60 días y un
       año. Más de un año ya es otro trabajo (y sus puntos vencieron). */
    'recuperar', (
      select jsonb_build_object(
        'total', count(*),
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        'con_avisos', count(*) filter (where exists (select 1 from vivos w where w.cliente = ar.id)),
        'avisados_30', count(*) filter (where exists (
                          select 1 from club_avisos_personales p
                           where p.cliente = ar.id and p.motivo = 'recuperar'
                             and p.creado > now() - interval '30 days')),
        'puntos', coalesce(sum(puntos), 0),
        'lista', coalesce((select jsonb_agg(z.x order by z.hace) from (
                   select jsonb_build_object('nombre', q.nombre, 'nivel', q.nivel, 'local', q.local_alta,
                            'puntos', q.puntos, 'gastado', q.gastado,
                            'dias', (now()::date - (q.ultima_compra at time zone tz)::date)) as x,
                          (now()::date - (q.ultima_compra at time zone tz)::date) as hace
                     from a_recuperar q
                    order by q.gastado desc nulls last limit 30) z), '[]'::jsonb))
        from a_recuperar ar),

    'niveles', (
      select jsonb_build_object(
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        /* Cerca de subir: tiene el 80% o más de lo que pide el siguiente. */
        'cerca', count(*) filter (where exists (
                   select 1 from club_niveles n
                    where n.desde_xp > s.xp and s.xp >= n.desde_xp * 0.8
                      and n.desde_xp = (select min(desde_xp) from club_niveles where desde_xp > s.xp))))
        from socios s),

    /* Los 14, siempre todos: es la comparación. */
    'por_local', (
      select coalesce(jsonb_agg(
               club_est_resumen(t0, t1, upper(trim(l.codigo))) ||
               jsonb_build_object('local', l.codigo,
                                  'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                                  'socios', (select count(*) from club_clientes k
                                              where k.baja is null
                                                and upper(trim(k.local_alta)) = upper(trim(l.codigo))))
               order by l.codigo), '[]'::jsonb)
        from locales l where l.activo),

    /* Quién carga las compras con tarjeta, y a cuántos socios les cargó la
       PRIMERA compra: los que "estrenó". El alta no guarda quién anotó al
       socio (se anotan solos con el QR, muchas veces), y la primera compra
       es la mejor seña de quién lo trajo al Club. */
    'vendedores', (
      select coalesce(jsonb_agg(v order by (v->>'compras')::int desc, v->>'vendedor'), '[]'::jsonb)
        from (select jsonb_build_object(
                       'vendedor', trim(c.vendedor),
                       'compras', count(*),
                       'facturado', coalesce(sum(c.importe), 0),
                       'clientes', count(distinct c.cliente),
                       'estrenados', count(*) filter (where p.cuando = c.creado)) as v
                from compras c
                left join primera p on p.cliente = c.cliente
               where nullif(trim(c.vendedor), '') is not null
               group by trim(c.vendedor)
               order by count(*) desc
               limit 25) z),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('f', s.f, 'compras', coalesce(x.n, 0),
                                                   'facturado', coalesce(x.plata, 0)) order by s.f), '[]'::jsonb)
        from (select distinct date_trunc(escala, g)::date as f
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g) s
        left join (select date_trunc(escala, local_ts)::date as f, count(*) as n, sum(importe) as plata
                     from compras group by 1) x on x.f = s.f),

    /* Por día de la semana: las compras y cuántas veces hubo ese día en el
       período, para sacar el promedio (un mes tiene cuatro o cinco lunes). */
    'por_semana', (
      select jsonb_agg(jsonb_build_object('d', w.d, 'veces', w.veces, 'compras', coalesce(x.n, 0)) order by w.d)
        from (select extract(isodow from g)::int as d, count(*) as veces
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g group by 1) w
        left join (select extract(isodow from local_ts)::int as d, count(*) as n
                     from compras group by 1) x on x.d = w.d),

    'por_hora', (
      select jsonb_agg(jsonb_build_object('h', h.h, 'compras', coalesce(x.n, 0)) order by h.h)
        from generate_series(0, 23) h(h)
        left join (select extract(hour from local_ts)::int as h, count(*) as n
                     from compras group by 1) x on x.h = h.h),

    'premios', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo,
               'canjes', (select count(*) from mov m where m.tipo = 'canje' and m.premio = p.id),
               'canjes_total', (select count(*) from club_movimientos m
                                 where m.tipo = 'canje' and m.premio = p.id and m.anulado is null),
               /* Cuántos socios podrían llevárselo hoy mismo. */
               'alcanza_hoy', (select count(*) from socios s where s.puntos >= p.puntos))
             order by p.orden, p.puntos), '[]'::jsonb)
        from club_premios p where p.activo),

    /* Los que cumplen en los próximos 7 días. El cumple de este año se arma
       con el mes y el día; sólo el 29 de febrero se corre al 28, que en un
       año no bisiesto no existe. (Una primera versión cortaba TODOS los días
       en 28 y el 29 y el 30 de cualquier mes daban "hoy" un día 28.) */
    'cumples', (
      select jsonb_build_object(
        'proximos', coalesce((select jsonb_agg(x order by x->>'falta') from (
            select jsonb_build_object('nombre', s.nombre, 'nivel', s.nivel, 'local', s.local_alta,
                     'dia', to_char(s.cumple, 'DD/MM'),
                     'falta', lpad(((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                                  case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366)::text, 3, '0')) as x
              from socios s
             where s.cumple is not null
               and ((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                     case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366) <= 7
             limit 40) z), '[]'::jsonb))),

    'ranking', (
      select coalesce(jsonb_agg(x order by (x->>'gastado')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre, 'nivel', v.nivel, 'local', k.local_alta,
                 'compras', count(*), 'gastado', coalesce(sum(c.importe), 0),
                 'puntos', v.puntos,
                 'ultima', max(c.creado)) as x
          from compras c
          join club_clientes k on k.id = c.cliente
          join v_club_clientes v on v.id = c.cliente
         group by k.id, k.nombre, v.nivel, k.local_alta, v.puntos
         order by coalesce(sum(c.importe), 0) desc
         limit 10) z),

    /* Lo que VDH les debe en premios: los puntos que tienen guardados,
       pasados a plata al costo promedio de un punto del catálogo. Y los que
       vencen en los próximos 60 días (12 meses sin comprar). */
    'pasivo', (
      select jsonb_build_object(
        'puntos', coalesce(sum(greatest(puntos, 0)), 0),
        'costo_punto', costo_punto,
        'costo', round(coalesce(sum(greatest(puntos, 0)), 0) * coalesce(costo_punto, 0)),
        'vencen_60', coalesce(sum(greatest(puntos, 0)) filter (
                        where coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'), 0),
        'vencen_60_socios', count(*) filter (
                        where puntos > 0
                          and coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'))
        from socios),

    'resenas', (
      select coalesce(jsonb_agg(jsonb_build_object('local', x.l, 'pedidos', x.n) order by x.n desc), '[]'::jsonb)
        from (select split_part(p.clave, '|', 1) as l, count(*) as n
                from club_avisos_personales p
               where p.motivo = 'resena' and p.creado >= t0 and p.creado < t1
                 and (loc is null or upper(split_part(p.clave, '|', 1)) = loc)
               group by 1) x),

    'recientes', (
      select coalesce(jsonb_agg(x order by x->>'cuando' desc), '[]'::jsonb) from (
        select jsonb_build_object('cuando', m.creado, 'nombre', k.nombre, 'tipo', m.tipo,
                                  'concepto', m.concepto, 'puntos', m.puntos, 'local', m.local,
                                  'obs', m.obs, 'importe', m.importe) as x
          from mov m join club_clientes k on k.id = m.cliente
         order by m.creado desc limit 12) z)
  )
  into r;

  return r;
end;
$ce$;

revoke all on function club_estadisticas(text, date, date, text) from public;
grant execute on function club_estadisticas(text, date, date, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · LA LISTA DE MOVIMIENTOS
-- ══════════════════════════════════════════════════════════════════════════

/* Con buscador (nombre, últimos números del código, ticket o vendedor) y
   filtro por tipo. Trae también los anulados, marcados: para encontrar
   "el que se anuló" hay que poder verlo. Los totales, sin anulados. Del
   código se muestran los últimos 4: la tarjeta entera se abre desde la
   caja, que es donde se usa. */
create or replace function club_movimientos_buscar(
  p_pin text, p_desde date, p_hasta date, p_local text,
  p_texto text, p_tipo text, p_limite integer, p_salto integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mb$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  t0 timestamptz := coalesce(p_desde, hoy - 29)::timestamp at time zone tz;
  t1 timestamptz := (coalesce(p_hasta, hoy) + 1)::timestamp at time zone tz;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  txt text := nullif(lower(trim(coalesce(p_texto, ''))), '');
  tip text := nullif(trim(coalesce(p_tipo, '')), '');
  lim integer := least(greatest(coalesce(p_limite, 25), 1), 2000);
  sal integer := greatest(coalesce(p_salto, 0), 0);
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  with f as (
    select m.*, k.nombre, k.codigo
      from club_movimientos m
      join club_clientes k on k.id = m.cliente
     where m.creado >= t0 and m.creado < t1
       and (loc is null or upper(trim(m.local)) = loc)
       and (tip is null or m.tipo::text = tip)
       and (txt is null
            or lower(k.nombre) like '%' || txt || '%'
            or right(k.codigo, 4) = txt
            or lower(coalesce(m.ticket, '')) like '%' || txt || '%'
            or lower(coalesce(m.vendedor, '')) like '%' || txt || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'suman', (select coalesce(sum(puntos), 0) from f where anulado is null and puntos > 0),
    'restan', (select coalesce(-sum(puntos), 0) from f where anulado is null and puntos < 0),
    'facturado', (select coalesce(sum(importe), 0) from f where anulado is null and tipo = 'compra'),
    'filas', coalesce((select jsonb_agg(x order by x->>'cuando' desc) from (
        select jsonb_build_object(
                 'id', f.id, 'cuando', f.creado, 'nombre', f.nombre, 'codigo4', right(f.codigo, 4),
                 'tipo', f.tipo, 'concepto', f.concepto, 'obs', f.obs, 'puntos', f.puntos,
                 'importe', f.importe, 'local', f.local, 'vendedor', f.vendedor,
                 'ticket', f.ticket, 'anulado', f.anulado is not null, 'motivo_anul', f.motivo_anul) as x
          from f order by f.creado desc, f.id desc
         limit lim offset sal) z), '[]'::jsonb))
  into r;
  return r;
end;
$mb$;

revoke all on function club_movimientos_buscar(text, date, date, text, text, text, integer, integer) from public;
grant execute on function club_movimientos_buscar(text, date, date, text, text, text, integer, integer) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · AVISARLES A LOS QUE DEJARON DE VENIR
-- ══════════════════════════════════════════════════════════════════════════

/* Un aviso personal a cada socio "a recuperar" (última compra hace entre 60
   días y un año) que tenga los avisos prendidos. Sale con el envío de cada
   hora. Una vez cada 30 días por socio como máximo: al que no volvió no se
   lo persigue. Los topes de largo son los de "Mandar un aviso". */
create or replace function club_avisar_recuperar(
  p_pin text, p_local text, p_titulo text, p_cuerpo text, p_enlace text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ar$
declare
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  tit text := nullif(trim(coalesce(p_titulo, '')), '');
  cue text := nullif(trim(coalesce(p_cuerpo, '')), '');
  enl text := nullif(trim(coalesce(p_enlace, '')), '');
  hoyclave text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
  n integer;
  sin integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if tit is null or length(tit) > 60 then
    return jsonb_build_object('ok', false, 'porque', 'El título va de 1 a 60 letras.');
  end if;
  if cue is null or length(cue) > 160 then
    return jsonb_build_object('ok', false, 'porque', 'El mensaje va de 1 a 160 letras.');
  end if;
  if enl is not null and not club_foto_url_ok(enl) then
    return jsonb_build_object('ok', false, 'porque', 'El enlace tiene que empezar con https://.');
  end if;

  with grupo as (
    select v.id from v_club_clientes v
     where v.baja is null
       and (loc is null or upper(trim(v.local_alta)) = loc)
       and v.ultima_compra is not null
       and v.ultima_compra <  now() - interval '60 days'
       and v.ultima_compra >= now() - interval '365 days'
  ),
  elegidos as (
    select g.id from grupo g
     where exists (select 1 from club_suscripciones s where s.cliente = g.id and s.muerto is null)
       and not exists (select 1 from club_avisos_personales p
                        where p.cliente = g.id and p.motivo = 'recuperar'
                          and p.creado > now() - interval '30 days')
  ),
  ins as (
    insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
    select e.id, 'recuperar', hoyclave, tit, cue, enl, now() from elegidos e
    on conflict (cliente, motivo, clave) do nothing
    returning 1
  )
  select (select count(*) from ins),
         (select count(*) from grupo g
           where not exists (select 1 from club_suscripciones s where s.cliente = g.id and s.muerto is null))
    into n, sin;

  return jsonb_build_object('ok', true, 'avisados', n, 'sin_avisos', sin);
end;
$ar$;

revoke all on function club_avisar_recuperar(text, text, text, text, text) from public;
grant execute on function club_avisar_recuperar(text, text, text, text, text) to anon, authenticated;


-- ─────────────────────────── PARTE 24 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LOS NÚMEROS DEL CLUB, QUE CIERREN
--
-- Correr entero en el editor SQL de Supabase, después del 23. Reemplaza las
-- tres funciones del 23 (mismos nombres y mismos parámetros).
--
-- Lo que cambia, mirando la pantalla con los datos de verdad (29/09/2026):
--
--   · "Sin local asignado": las compras sin local y los socios anotados
--     solos, con el QR, no caían en ningún local, y la tabla de los 14 no
--     sumaba lo mismo que el resumen. Ahora son una fila más, y también se
--     pueden elegir en el filtro de local.
--   · Los regalos de cumple se guardan como un "canje" de 0 puntos: el 23
--     los contaba como premios canjeados. Ahora van aparte, y el costo se
--     separa en premios y regalos.
--   · "Vuelven a comprar cada N días" se calculaba sobre el último año sin
--     importar el período. Ahora es sobre las compras DEL período (la
--     compra anterior del mismo socio puede ser de antes).
--   · La lista de quiénes "volvieron", para que se vea a quiénes cuenta.
--   · El detalle del costo por punto, para explicar la estimación de lo que
--     se debe en premios.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 0 · QUÉ LOCAL ES
-- ══════════════════════════════════════════════════════════════════════════

/* Si un local (el de una compra o el de un alta) entra en el filtro. Sin
   filtro, todo. '__SIN__' es "Sin local asignado": vacío, o un nombre que no
   es ninguno de los 14 (un local que cerró, un error de tipeo). */
create or replace function club_est_local_ok(p_local text, p_filtro text)
returns boolean
language sql
stable
security definer
set search_path = public
as $lo$
  select case
    when p_filtro is null then true
    when p_filtro = '__SIN__' then
      nullif(trim(coalesce(p_local, '')), '') is null
      or not exists (select 1 from locales l where l.activo and upper(trim(l.codigo)) = upper(trim(p_local)))
    else upper(trim(coalesce(p_local, ''))) = p_filtro
  end
$lo$;

revoke all on function club_est_local_ok(text, text) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · EL RESUMEN DE UN PERÍODO
-- ══════════════════════════════════════════════════════════════════════════

/* Los números de arriba, para un rango de tiempo y un local (o todos). Es
   función aparte porque se pide tres veces: el período, el anterior —para
   el "vs. período anterior"— y cada uno de los 14 locales.

   Interna: la llama club_estadisticas, que ya pidió el PIN. De afuera no. */
create or replace function club_est_resumen(t0 timestamptz, t1 timestamptz, loc text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $er$
  with m as (
    select m.*
      from club_movimientos m
     where m.anulado is null and m.creado >= t0 and m.creado < t1
       and club_est_local_ok(m.local, loc)
  ),
  c as (
    select cliente, count(*) as n from m where tipo = 'compra' group by cliente
  )
  select jsonb_build_object(
    /* Socios nuevos: los que se anotaron en el período. Con un local
       elegido, los que se anotaron EN ese local. */
    'nuevos', (select count(*) from club_clientes k
                where k.baja is null and k.creado >= t0 and k.creado < t1
                  and club_est_local_ok(k.local_alta, loc)),
    'compras', (select count(*) from m where tipo = 'compra'),
    'facturado', (select coalesce(sum(importe), 0) from m where tipo = 'compra'),
    'clientes', (select count(*) from c),
    /* Los que compraron y NO era su primera compra: ya habían comprado
       antes, o compraron dos veces en el período. Es "volvieron". */
    'volvieron', (select count(*) from c
                   where c.n > 1
                      or exists (select 1 from club_movimientos x
                                  where x.cliente = c.cliente and x.tipo = 'compra'
                                    and x.anulado is null and x.creado < t0)),
    'puntos_compras', (select coalesce(sum(puntos), 0) from m where tipo = 'compra'),
    'puntos_regalo', (select coalesce(sum(puntos), 0) from m where tipo = 'ajuste' and puntos > 0),
    /* Los premios. El regalo de cumple también se guarda como canje (de 0
       puntos) y va aparte: no es un premio que alguien eligió. */
    'canjes', (select count(*) from m where tipo = 'canje' and concepto is distinct from 'regalo_cumple'),
    'puntos_canjeados', (select coalesce(-sum(puntos), 0) from m where tipo = 'canje' and concepto is distinct from 'regalo_cumple'),
    'regalos_cumple', (select count(*) from m where concepto = 'regalo_cumple'),
    /* Lo que salió en premios y regalos, a COSTO: el del movimiento si se
       anotó, si no el del catálogo. */
    'costo', (select coalesce(sum(coalesce(m.costo, p.costo)), 0)
                from m left join club_premios p on p.id = m.premio
               where m.tipo = 'canje' or m.concepto = 'regalo_cumple'),
    'costo_premios', (select coalesce(sum(coalesce(m.costo, p.costo)), 0)
                        from m left join club_premios p on p.id = m.premio
                       where m.tipo = 'canje' and m.concepto is distinct from 'regalo_cumple'),
    'costo_regalos', (select coalesce(sum(m.costo), 0) from m where m.concepto = 'regalo_cumple')
  )
$er$;

revoke all on function club_est_resumen(timestamptz, timestamptz, text) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · EL TABLERO
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_estadisticas(p_pin text, p_desde date, p_hasta date, p_local text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ce$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  d0  date := coalesce(p_desde, hoy - 29);
  d1  date := coalesce(p_hasta, hoy);
  aux date;
  dias integer;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  t0 timestamptz; t1 timestamptz; a0 timestamptz;
  escala text;
  costo_punto numeric;
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  if d1 < d0 then aux := d0; d0 := d1; d1 := aux; end if;
  /* Tres años como mucho: más que eso no es un período, es la historia. */
  if d1 - d0 > 1100 then d0 := d1 - 1100; end if;
  dias := d1 - d0 + 1;
  t0 := d0::timestamp at time zone tz;
  t1 := (d1 + 1)::timestamp at time zone tz;
  a0 := (d0 - dias)::timestamp at time zone tz;      -- el período anterior, del mismo largo
  /* El gráfico por día: con más de tres meses serían puntos ilegibles. */
  escala := case when dias <= 92 then 'day' when dias <= 400 then 'week' else 'month' end;

  /* Cuánto cuesta un punto que se canjea, en promedio del catálogo activo:
     para pasar los puntos que los socios tienen guardados a plata. */
  select case when sum(puntos) > 0 then sum(costo) / sum(puntos) end
    into costo_punto
    from club_premios where activo and costo is not null and puntos > 0;

  with
  mov as (
    select m.*, (m.creado at time zone tz) as local_ts
      from club_movimientos m
     where m.anulado is null and m.creado >= t0 and m.creado < t1
       and club_est_local_ok(m.local, loc)
  ),
  compras as (select * from mov where tipo = 'compra'),
  /* Los socios que se miran en "hoy": todos, o los anotados en el local. */
  socios as (
    select v.*
      from v_club_clientes v
     where v.baja is null
       and club_est_local_ok(v.local_alta, loc)
  ),
  primera as (
    select cliente, min(creado) as cuando
      from club_movimientos where tipo = 'compra' and anulado is null
     group by cliente
  ),
  vivos as (
    select distinct cliente from club_suscripciones where muerto is null and cliente is not null
  ),
  a_recuperar as (
    select s.* from socios s
     where s.ultima_compra is not null
       and s.ultima_compra < now() - interval '60 days'
       and s.ultima_compra >= now() - interval '365 days'
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', d0, 'hasta', d1, 'dias', dias,
                                  'antes_desde', d0 - dias, 'antes_hasta', d0 - 1,
                                  'local', loc, 'escala', escala),
    'actual',   club_est_resumen(t0, t1, loc),
    'anterior', club_est_resumen(a0, t0, loc),

    /* Cada cuántos días vuelve a comprar un socio: para cada compra DEL
       período que no es la primera del socio, cuántos días pasaron desde la
       anterior (que puede ser de antes del período). El promedio. */
    'frecuencia_dias', (
      select round(avg(extract(epoch from g.gap) / 86400))
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),
    'frecuencia_casos', (
      select count(*)
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),

    /* Quiénes compraron en el período y si "volvieron": ya habían comprado
       antes, o compraron más de una vez en el período. Es la lista detrás
       del número. */
    'volvieron_lista', (
      select coalesce(jsonb_agg(x order by (x->>'volvio')::boolean desc, x->>'nombre'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre,
                 'compras', count(*),
                 'primera', (select min(x.creado) from club_movimientos x
                              where x.cliente = c.cliente and x.tipo = 'compra' and x.anulado is null),
                 'volvio', count(*) > 1 or exists (select 1 from club_movimientos x
                                                    where x.cliente = c.cliente and x.tipo = 'compra'
                                                      and x.anulado is null and x.creado < t0)) as x
          from compras c join club_clientes k on k.id = c.cliente
         group by c.cliente, k.nombre
         limit 200) z),

    /* Hoy, no en el período: cuánto hace que compró cada socio. */
    'actividad', (
      select jsonb_build_object(
        'total', count(*),
        'ultimos_30', count(*) filter (where ultima_compra >= now() - interval '30 days'),
        'de_31_a_90', count(*) filter (where ultima_compra <  now() - interval '30 days'
                                         and ultima_compra >= now() - interval '90 days'),
        'mas_de_90',  count(*) filter (where ultima_compra <  now() - interval '90 days'),
        'nunca',      count(*) filter (where ultima_compra is null))
        from socios),

    /* Los que venían y dejaron: la última compra hace entre 60 días y un
       año. Más de un año ya es otro trabajo (y sus puntos vencieron). */
    'recuperar', (
      select jsonb_build_object(
        'total', count(*),
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        'con_avisos', count(*) filter (where exists (select 1 from vivos w where w.cliente = ar.id)),
        'avisados_30', count(*) filter (where exists (
                          select 1 from club_avisos_personales p
                           where p.cliente = ar.id and p.motivo = 'recuperar'
                             and p.creado > now() - interval '30 days')),
        'puntos', coalesce(sum(puntos), 0),
        'lista', coalesce((select jsonb_agg(z.x order by z.hace) from (
                   select jsonb_build_object('nombre', q.nombre, 'nivel', q.nivel, 'local', q.local_alta,
                            'puntos', q.puntos, 'gastado', q.gastado,
                            'dias', (now()::date - (q.ultima_compra at time zone tz)::date)) as x,
                          (now()::date - (q.ultima_compra at time zone tz)::date) as hace
                     from a_recuperar q
                    order by q.gastado desc nulls last limit 30) z), '[]'::jsonb))
        from a_recuperar ar),

    'niveles', (
      select jsonb_build_object(
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        /* Cerca de subir: tiene el 80% o más de lo que pide el siguiente. */
        'cerca', count(*) filter (where exists (
                   select 1 from club_niveles n
                    where n.desde_xp > s.xp and s.xp >= n.desde_xp * 0.8
                      and n.desde_xp = (select min(desde_xp) from club_niveles where desde_xp > s.xp))))
        from socios s),

    /* Los 14, siempre todos: es la comparación. */
    'por_local', (
      select coalesce(jsonb_agg(
               club_est_resumen(t0, t1, upper(trim(l.codigo))) ||
               jsonb_build_object('local', l.codigo,
                                  'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                                  'socios', (select count(*) from club_clientes k
                                              where k.baja is null
                                                and upper(trim(k.local_alta)) = upper(trim(l.codigo))))
               order by l.codigo), '[]'::jsonb)
        from locales l where l.activo),

    /* "Sin local asignado": las compras sin local y los socios anotados
       solos. Con esta fila, la tabla suma lo mismo que el resumen. */
    'sin_local', club_est_resumen(t0, t1, '__SIN__') ||
                 jsonb_build_object('local', '__SIN__', 'nombre', 'Sin local asignado',
                                    'socios', (select count(*) from club_clientes k
                                                where k.baja is null and club_est_local_ok(k.local_alta, '__SIN__'))),

    /* Quién carga las compras con tarjeta, y a cuántos socios les cargó la
       PRIMERA compra: los que "estrenó". El alta no guarda quién anotó al
       socio (se anotan solos con el QR, muchas veces), y la primera compra
       es la mejor seña de quién lo trajo al Club. */
    'vendedores', (
      select coalesce(jsonb_agg(v order by (v->>'compras')::int desc, v->>'vendedor'), '[]'::jsonb)
        from (select jsonb_build_object(
                       'vendedor', trim(c.vendedor),
                       'compras', count(*),
                       'facturado', coalesce(sum(c.importe), 0),
                       'clientes', count(distinct c.cliente),
                       'estrenados', count(*) filter (where p.cuando = c.creado)) as v
                from compras c
                left join primera p on p.cliente = c.cliente
               where nullif(trim(c.vendedor), '') is not null
               group by trim(c.vendedor)
               order by count(*) desc
               limit 25) z),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('f', s.f, 'compras', coalesce(x.n, 0),
                                                   'facturado', coalesce(x.plata, 0)) order by s.f), '[]'::jsonb)
        from (select distinct date_trunc(escala, g)::date as f
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g) s
        left join (select date_trunc(escala, local_ts)::date as f, count(*) as n, sum(importe) as plata
                     from compras group by 1) x on x.f = s.f),

    /* Por día de la semana: las compras y cuántas veces hubo ese día en el
       período, para sacar el promedio (un mes tiene cuatro o cinco lunes). */
    'por_semana', (
      select jsonb_agg(jsonb_build_object('d', w.d, 'veces', w.veces, 'compras', coalesce(x.n, 0)) order by w.d)
        from (select extract(isodow from g)::int as d, count(*) as veces
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g group by 1) w
        left join (select extract(isodow from local_ts)::int as d, count(*) as n
                     from compras group by 1) x on x.d = w.d),

    'por_hora', (
      select jsonb_agg(jsonb_build_object('h', h.h, 'compras', coalesce(x.n, 0)) order by h.h)
        from generate_series(0, 23) h(h)
        left join (select extract(hour from local_ts)::int as h, count(*) as n
                     from compras group by 1) x on x.h = h.h),

    'premios', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo,
               'canjes', (select count(*) from mov m where m.tipo = 'canje' and m.premio = p.id),
               'canjes_total', (select count(*) from club_movimientos m
                                 where m.tipo = 'canje' and m.premio = p.id and m.anulado is null),
               /* Cuántos socios podrían llevárselo hoy mismo. */
               'alcanza_hoy', (select count(*) from socios s where s.puntos >= p.puntos))
             order by p.orden, p.puntos), '[]'::jsonb)
        from club_premios p where p.activo),

    /* Los que cumplen en los próximos 7 días. El cumple de este año se arma
       con el mes y el día; sólo el 29 de febrero se corre al 28, que en un
       año no bisiesto no existe. (Una primera versión cortaba TODOS los días
       en 28 y el 29 y el 30 de cualquier mes daban "hoy" un día 28.) */
    'cumples', (
      select jsonb_build_object(
        'proximos', coalesce((select jsonb_agg(x order by x->>'falta') from (
            select jsonb_build_object('nombre', s.nombre, 'nivel', s.nivel, 'local', s.local_alta,
                     'dia', to_char(s.cumple, 'DD/MM'),
                     'falta', lpad(((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                                  case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366)::text, 3, '0')) as x
              from socios s
             where s.cumple is not null
               and ((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                     case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366) <= 7
             limit 40) z), '[]'::jsonb))),

    'ranking', (
      select coalesce(jsonb_agg(x order by (x->>'gastado')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre, 'nivel', v.nivel, 'local', k.local_alta,
                 'compras', count(*), 'gastado', coalesce(sum(c.importe), 0),
                 'puntos', v.puntos,
                 'ultima', max(c.creado)) as x
          from compras c
          join club_clientes k on k.id = c.cliente
          join v_club_clientes v on v.id = c.cliente
         group by k.id, k.nombre, v.nivel, k.local_alta, v.puntos
         order by coalesce(sum(c.importe), 0) desc
         limit 10) z),

    /* Lo que VDH les debe en premios: los puntos que tienen guardados,
       pasados a plata al costo promedio de un punto del catálogo. Y los que
       vencen en los próximos 60 días (12 meses sin comprar). */
    'pasivo', (
      select jsonb_build_object(
        'catalogo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo)
                                               order by p.puntos), '[]'::jsonb)
                       from club_premios p where p.activo and p.costo is not null and p.puntos > 0),
        'puntos', coalesce(sum(greatest(puntos, 0)), 0),
        'costo_punto', costo_punto,
        'costo', round(coalesce(sum(greatest(puntos, 0)), 0) * coalesce(costo_punto, 0)),
        'vencen_60', coalesce(sum(greatest(puntos, 0)) filter (
                        where coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'), 0),
        'vencen_60_socios', count(*) filter (
                        where puntos > 0
                          and coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'))
        from socios),

    'resenas', (
      select coalesce(jsonb_agg(jsonb_build_object('local', x.l, 'pedidos', x.n) order by x.n desc), '[]'::jsonb)
        from (select split_part(p.clave, '|', 1) as l, count(*) as n
                from club_avisos_personales p
               where p.motivo = 'resena' and p.creado >= t0 and p.creado < t1
                 and (loc is null or upper(split_part(p.clave, '|', 1)) = loc)
               group by 1) x),

    'recientes', (
      select coalesce(jsonb_agg(x order by x->>'cuando' desc), '[]'::jsonb) from (
        select jsonb_build_object('cuando', m.creado, 'nombre', k.nombre, 'tipo', m.tipo,
                                  'concepto', m.concepto, 'puntos', m.puntos, 'local', m.local,
                                  'obs', m.obs, 'importe', m.importe) as x
          from mov m join club_clientes k on k.id = m.cliente
         order by m.creado desc limit 12) z)
  )
  into r;

  return r;
end;
$ce$;

revoke all on function club_estadisticas(text, date, date, text) from public;
grant execute on function club_estadisticas(text, date, date, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · LA LISTA DE MOVIMIENTOS
-- ══════════════════════════════════════════════════════════════════════════

/* Con buscador (nombre, últimos números del código, ticket o vendedor) y
   filtro por tipo. Trae también los anulados, marcados: para encontrar
   "el que se anuló" hay que poder verlo. Los totales, sin anulados. Del
   código se muestran los últimos 4: la tarjeta entera se abre desde la
   caja, que es donde se usa. */
create or replace function club_movimientos_buscar(
  p_pin text, p_desde date, p_hasta date, p_local text,
  p_texto text, p_tipo text, p_limite integer, p_salto integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mb$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  t0 timestamptz := coalesce(p_desde, hoy - 29)::timestamp at time zone tz;
  t1 timestamptz := (coalesce(p_hasta, hoy) + 1)::timestamp at time zone tz;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  txt text := nullif(lower(trim(coalesce(p_texto, ''))), '');
  tip text := nullif(trim(coalesce(p_tipo, '')), '');
  lim integer := least(greatest(coalesce(p_limite, 25), 1), 2000);
  sal integer := greatest(coalesce(p_salto, 0), 0);
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  with f as (
    select m.*, k.nombre, k.codigo
      from club_movimientos m
      join club_clientes k on k.id = m.cliente
     where m.creado >= t0 and m.creado < t1
       and club_est_local_ok(m.local, loc)
       and (tip is null or m.tipo::text = tip)
       and (txt is null
            or lower(k.nombre) like '%' || txt || '%'
            or right(k.codigo, 4) = txt
            or lower(coalesce(m.ticket, '')) like '%' || txt || '%'
            or lower(coalesce(m.vendedor, '')) like '%' || txt || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'suman', (select coalesce(sum(puntos), 0) from f where anulado is null and puntos > 0),
    'restan', (select coalesce(-sum(puntos), 0) from f where anulado is null and puntos < 0),
    'facturado', (select coalesce(sum(importe), 0) from f where anulado is null and tipo = 'compra'),
    'filas', coalesce((select jsonb_agg(x order by x->>'cuando' desc) from (
        select jsonb_build_object(
                 'id', f.id, 'cuando', f.creado, 'nombre', f.nombre, 'codigo4', right(f.codigo, 4),
                 'tipo', f.tipo, 'concepto', f.concepto, 'obs', f.obs, 'puntos', f.puntos,
                 'importe', f.importe, 'local', f.local, 'vendedor', f.vendedor,
                 'ticket', f.ticket, 'anulado', f.anulado is not null, 'motivo_anul', f.motivo_anul) as x
          from f order by f.creado desc, f.id desc
         limit lim offset sal) z), '[]'::jsonb))
  into r;
  return r;
end;
$mb$;

revoke all on function club_movimientos_buscar(text, date, date, text, text, text, integer, integer) from public;
grant execute on function club_movimientos_buscar(text, date, date, text, text, text, integer, integer) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · AVISARLES A LOS QUE DEJARON DE VENIR
-- ══════════════════════════════════════════════════════════════════════════

/* Un aviso personal a cada socio "a recuperar" (última compra hace entre 60
   días y un año) que tenga los avisos prendidos. Sale con el envío de cada
   hora. Una vez cada 30 días por socio como máximo: al que no volvió no se
   lo persigue. Los topes de largo son los de "Mandar un aviso". */
create or replace function club_avisar_recuperar(
  p_pin text, p_local text, p_titulo text, p_cuerpo text, p_enlace text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ar$
declare
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  tit text := nullif(trim(coalesce(p_titulo, '')), '');
  cue text := nullif(trim(coalesce(p_cuerpo, '')), '');
  enl text := nullif(trim(coalesce(p_enlace, '')), '');
  hoyclave text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
  n integer;
  sin integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if tit is null or length(tit) > 60 then
    return jsonb_build_object('ok', false, 'porque', 'El título va de 1 a 60 letras.');
  end if;
  if cue is null or length(cue) > 160 then
    return jsonb_build_object('ok', false, 'porque', 'El mensaje va de 1 a 160 letras.');
  end if;
  if enl is not null and not club_foto_url_ok(enl) then
    return jsonb_build_object('ok', false, 'porque', 'El enlace tiene que empezar con https://.');
  end if;

  with grupo as (
    select v.id from v_club_clientes v
     where v.baja is null
       and club_est_local_ok(v.local_alta, loc)
       and v.ultima_compra is not null
       and v.ultima_compra <  now() - interval '60 days'
       and v.ultima_compra >= now() - interval '365 days'
  ),
  elegidos as (
    select g.id from grupo g
     where exists (select 1 from club_suscripciones s where s.cliente = g.id and s.muerto is null)
       and not exists (select 1 from club_avisos_personales p
                        where p.cliente = g.id and p.motivo = 'recuperar'
                          and p.creado > now() - interval '30 days')
  ),
  ins as (
    insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
    select e.id, 'recuperar', hoyclave, tit, cue, enl, now() from elegidos e
    on conflict (cliente, motivo, clave) do nothing
    returning 1
  )
  select (select count(*) from ins),
         (select count(*) from grupo g
           where not exists (select 1 from club_suscripciones s where s.cliente = g.id and s.muerto is null))
    into n, sin;

  return jsonb_build_object('ok', true, 'avisados', n, 'sin_avisos', sin);
end;
$ar$;

revoke all on function club_avisar_recuperar(text, text, text, text, text) from public;
grant execute on function club_avisar_recuperar(text, text, text, text, text) to anon, authenticated;


-- ─────────────────────────── PARTE 25 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · MIS DATOS
--
-- Correr entero en el editor SQL de Supabase, después del 24.
--
-- El socio consulta y corrige sus datos desde la tarjeta (Inicio → "Mis
-- datos"). Decidido con Mauricio el 29/09/2026:
--
--   · Nombre y mail: los corrige él.
--   · Promociones por WhatsApp: las prende y las apaga él. Apagarlas anota
--     la revocación (es un consentimiento, y tiene que poder retirarse tan
--     fácil como se dio). El cambio va a Kommo por la cola de siempre.
--   · Cumpleaños: si nunca lo cargó, lo carga UNA vez. Si ya está, se
--     corrige en el local, con PIN y quedando anotado.
--   · Teléfono: se ve (enmascarado) pero NO se cambia desde el celular. El
--     teléfono abre la tarjeta (club_recuperar) y la tarjeta se abre con el
--     enlace, sin contraseña: dejarlo cambiar desde ahí sería dejar que
--     cualquiera que tenga el enlace de otro se quede con su tarjeta. Se
--     cambia en el local, como hasta ahora (club_cliente_editar).
--
-- Y una regla nueva para el regalo de cumpleaños: UNO cada 12 meses, aunque
-- se mueva la fecha. Hasta acá "usado" miraba sólo la semana del cumple de
-- este año: con la fecha corregida, el regalo volvía a aparecer.
--
-- Nada de esto toca los puntos, el nivel ni el historial.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · LO QUE VE EL SOCIO
-- ══════════════════════════════════════════════════════════════════════════

/* Con el código de la tarjeta, como club_tarjeta: quien tiene el código ya
   ve la tarjeta. El teléfono va enmascarado: sirve para reconocerlo, no
   para leerlo entero en la pantalla de otro. */
create or replace function club_mis_datos(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $md$
  select coalesce((
    select jsonb_build_object(
      'hay', true,
      'nombre', c.nombre,
      'mail', c.mail,
      'telefono', case when length(d.dig) >= 6
                       then left(d.dig, 2) || ' •••• ' || right(d.dig, 4)
                       else '••••' end,
      'cumple', c.cumple,
      'acepta_promos', c.acepta_promos,
      'desde', c.creado)
      from club_clientes c
      cross join lateral (select regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g') as dig) d
     where c.codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and c.baja is null), jsonb_build_object('hay', false))
$md$;

revoke all on function club_mis_datos(text) from public;
grant execute on function club_mis_datos(text) to anon, authenticated;


/* Una fecha de cumpleaños que tenga sentido: ni del futuro ni de alguien de
   cinco años, ni de antes de 1920. */
create or replace function club_cumple_ok(p date)
returns boolean
language sql
stable
as $co$
  select p is not null
     and p >= date '1920-01-01'
     and p <= ((now() at time zone 'America/Argentina/Buenos_Aires')::date - interval '5 years')::date
$co$;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · LO QUE GUARDA EL SOCIO
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_mis_datos_guardar(
  p_codigo text, p_nombre text, p_mail text, p_cumple date, p_acepta boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mg$
declare
  c    club_clientes%rowtype;
  nom  text := nullif(trim(coalesce(p_nombre, '')), '');
  mai  text := lower(nullif(trim(coalesce(p_mail, '')), ''));
  cam  text := '';
begin
  select * into c from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('ok', false, 'porque', 'No encontramos tu tarjeta. Recargá la página y probá de nuevo.');
  end if;

  if nom is null then
    return jsonb_build_object('ok', false, 'campo', 'nombre', 'porque', 'Tu nombre no puede quedar vacío.');
  end if;
  if length(nom) > 80 then
    return jsonb_build_object('ok', false, 'campo', 'nombre', 'porque', 'El nombre es muy largo: hasta 80 letras.');
  end if;
  if mai is not null and mai !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'campo', 'mail', 'porque', 'Ese mail no parece completo. Revisalo o dejalo vacío.');
  end if;

  /* El cumpleaños: una sola vez desde acá. */
  if p_cumple is not null and c.cumple is null then
    if not club_cumple_ok(p_cumple) then
      return jsonb_build_object('ok', false, 'campo', 'cumple', 'porque', 'Esa fecha de cumpleaños no parece correcta.');
    end if;
    cam := cam || ' · cumple: ' || to_char(p_cumple, 'DD/MM/YYYY');
  elsif p_cumple is not null and c.cumple is distinct from p_cumple then
    return jsonb_build_object('ok', false, 'campo', 'cumple',
      'porque', 'Tu cumpleaños ya está cargado. Para corregirlo, pedilo en la caja de cualquier local.');
  end if;

  if c.nombre is distinct from nom then cam := cam || ' · nombre: ' || c.nombre || ' → ' || nom; end if;
  if c.mail is distinct from mai then cam := cam || ' · mail: ' || coalesce(c.mail, '—') || ' → ' || coalesce(mai, '—'); end if;
  if p_acepta is not null and p_acepta is distinct from c.acepta_promos then
    cam := cam || case when p_acepta then ' · prendió las promos por WhatsApp' else ' · apagó las promos por WhatsApp' end;
  end if;

  if cam = '' then
    return jsonb_build_object('ok', true, 'cambios', false) || club_mis_datos(c.codigo);
  end if;

  insert into log (accion, detalle, quien)
  values ('club: el socio corrigió sus datos', 'tarjeta ' || c.codigo || cam, 'el socio, desde su tarjeta');

  update club_clientes
     set nombre = nom,
         mail = mai,
         cumple = coalesce(cumple, p_cumple),
         acepta_promos = coalesce(p_acepta, acepta_promos),
         consentimiento = case when p_acepta is true and not acepta_promos then now() else consentimiento end,
         consentimiento_via = case when p_acepta is true and not acepta_promos then 'tarjeta' else consentimiento_via end,
         revocado = case when p_acepta is true and not acepta_promos then null
                         when p_acepta is false and acepta_promos then now()
                         else revocado end
   where id = c.id;

  /* Kommo se entera por la cola de siempre: el nombre y la etiqueta de
     "acepta promos" viajan con el próximo envío. Sin Kommo, no hace nada. */
  perform club_kommo_encolar(c.id);

  return jsonb_build_object('ok', true, 'cambios', true) || club_mis_datos(c.codigo);
end;
$mg$;

revoke all on function club_mis_datos_guardar(text, text, text, date, boolean) from public;
grant execute on function club_mis_datos_guardar(text, text, text, date, boolean) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · EL CUMPLEAÑOS, EN EL LOCAL
-- ══════════════════════════════════════════════════════════════════════════

/* Leer (p_cambiar = false) o corregir el cumpleaños de un socio, con PIN.
   Corregirlo queda anotado con quién atendía. Vacío lo borra. */
create or replace function club_cliente_cumple(
  p_pin text, p_codigo text, p_cumple date, p_cambiar boolean, p_quien text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cc$
declare
  c club_clientes%rowtype;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  select * into c from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('ok', false, 'porque', 'No encontré esa tarjeta.');
  end if;
  if not coalesce(p_cambiar, false) or c.cumple is not distinct from p_cumple then
    return jsonb_build_object('ok', true, 'cumple', c.cumple, 'cambio', false);
  end if;
  if p_cumple is not null and not club_cumple_ok(p_cumple) then
    return jsonb_build_object('ok', false, 'porque', 'Esa fecha de cumpleaños no parece correcta.');
  end if;
  insert into log (accion, detalle, quien)
  values ('club: corregir cumpleaños',
          'tarjeta ' || c.codigo || ' · cumple: ' || coalesce(to_char(c.cumple, 'DD/MM/YYYY'), '—') ||
          ' → ' || coalesce(to_char(p_cumple, 'DD/MM/YYYY'), '—'),
          nullif(trim(coalesce(p_quien, '')), ''));
  update club_clientes set cumple = p_cumple where id = c.id;
  return jsonb_build_object('ok', true, 'cumple', p_cumple, 'cambio', true);
end;
$cc$;

revoke all on function club_cliente_cumple(text, text, date, boolean, text) from public;
grant execute on function club_cliente_cumple(text, text, date, boolean, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · UN REGALO DE CUMPLE CADA 12 MESES
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.club_regalo_cumple(p_cliente bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  c     record;
  antes integer;
  fin   date;
  r     club_regalos_cumple%rowtype;
  usado boolean;
begin
  select v.cumple, v.nivel into c from v_club_clientes v where v.id = p_cliente;
  select nullif(valor, '')::integer into antes from club_reglas where clave = 'cumple_antes';
  antes := coalesce(antes, 7);

  fin := club_cumple_fin(c.cumple, hoy, antes);
  if fin is null then
    return jsonb_build_object('vale', false);
  end if;

  select * into r from club_regalos_cumple where nivel = c.nivel;
  if not found then
    return jsonb_build_object('vale', false);
  end if;

  /* Usado = hay un regalo de cumple entregado desde que arrancó ESTA
     semana, o en los últimos 300 días. Lo segundo es la regla de "uno cada
     12 meses aunque se mueva la fecha": sin eso, corregir el cumpleaños
     volvía a mostrar el regalo. 300 y no 365 porque el del año pasado
     legítimo puede estar a 358 días (se entregó el último día de la semana
     del año pasado y hoy es el primero de la de este año). */
  usado := exists (
    select 1 from club_movimientos m
     where m.cliente = p_cliente and m.concepto = 'regalo_cumple' and m.anulado is null
       and (m.creado >= ((fin - antes)::timestamp at time zone 'America/Argentina/Buenos_Aires')
            or m.creado >= now() - interval '300 days'));

  /* Sin el costo: esto viaja a la tarjeta. */
  return jsonb_build_object(
    'vale',       true,
    'desde',      fin - antes,
    'hasta',      fin,
    'es_hoy',     hoy = fin,
    'tipo',       r.tipo,
    'porcentaje', r.porcentaje,
    'producto',   r.producto,
    'detalle',    r.detalle,
    'usado',      usado,
    'texto',      case when r.tipo = 'descuento'
                       then r.porcentaje || '% de descuento en tu compra'
                       else r.producto end);
end;
$function$;

revoke all on function club_regalo_cumple(bigint) from public, anon, authenticated;


-- ─────────────────────────── PARTE 26 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · NOMBRE Y APELLIDO, POR SEPARADO
--
-- Correr entero en el editor SQL de Supabase, después del 25.
--
-- Pedido de Mauricio (29/09/2026): al anotarse y en "Mis datos", el nombre
-- y el apellido van en dos campos. Sirve para saludar por el nombre sin
-- adivinar, y para que la tienda online (que trae nombre y apellido) pueda
-- reconocer al socio.
--
-- Cómo queda:
--   · club_clientes suma "nombres" y "apellido". La columna "nombre" sigue
--     siendo el nombre completo, que es lo que usan la tarjeta, la caja,
--     Kommo y las estadísticas: nada de eso cambia.
--   · Un disparador los mantiene sincronizados venga el cambio de donde
--     venga: si se cargan nombre y apellido, arma el completo; si se carga
--     sólo el completo (la caja, una página vieja), lo parte: la última
--     palabra es el apellido. Si queda mal partido ("Juan de la Cruz"), el
--     socio lo corrige en "Mis datos".
--   · Los socios que ya están se parten igual, una vez.
--   · El alta y "Mis datos" suman el apellido. Las versiones viejas siguen
--     andando: un celular con la página vieja guardada no se rompe.
-- ══════════════════════════════════════════════════════════════════════════

alter table club_clientes add column if not exists nombres  text;
alter table club_clientes add column if not exists apellido text;


/* "María José Pérez" → {María José, Pérez}. Una sola palabra: sin apellido. */
create or replace function club_partir_nombre(p text)
returns text[]
language sql
immutable
as $pn$
  select case
    when nullif(btrim(coalesce(p, '')), '') is null then array[null, null]::text[]
    when position(' ' in btrim(regexp_replace(p, '\s+', ' ', 'g'))) = 0 then array[btrim(p), null]::text[]
    else array[regexp_replace(btrim(regexp_replace(p, '\s+', ' ', 'g')), '\s+\S+$', ''),
               substring(btrim(regexp_replace(p, '\s+', ' ', 'g')) from '(\S+)$')]::text[]
  end
$pn$;


/* El disparador: nombre y apellido mandan si se cargaron; si no, se parte
   el completo. Un cambio que no toca ninguno de los tres pasa de largo. */
create or replace function club_nombre_sync()
returns trigger
language plpgsql
as $ns$
declare
  p text[];
begin
  if tg_op = 'UPDATE'
     and new.nombre   is not distinct from old.nombre
     and new.nombres  is not distinct from old.nombres
     and new.apellido is not distinct from old.apellido then
    return new;
  end if;
  if (tg_op = 'INSERT' and nullif(btrim(coalesce(new.apellido, '')), '') is not null)
     or (tg_op = 'UPDATE' and (new.nombres is distinct from old.nombres or new.apellido is distinct from old.apellido)) then
    new.nombres  := nullif(btrim(regexp_replace(coalesce(new.nombres, ''), '\s+', ' ', 'g')), '');
    new.apellido := nullif(btrim(regexp_replace(coalesce(new.apellido, ''), '\s+', ' ', 'g')), '');
    new.nombre   := btrim(coalesce(new.nombres, '') || ' ' || coalesce(new.apellido, ''));
  else
    p := club_partir_nombre(new.nombre);
    new.nombres := p[1];
    new.apellido := p[2];
  end if;
  return new;
end;
$ns$;

drop trigger if exists club_nombre_sync_tg on club_clientes;
create trigger club_nombre_sync_tg
  before insert or update on club_clientes
  for each row execute function club_nombre_sync();

/* Los que ya están, una vez. */
update club_clientes
   set nombres = (club_partir_nombre(nombre))[1], apellido = (club_partir_nombre(nombre))[2]
 where nombres is null and apellido is null;


-- ══════════════════════════════════════════════════════════════════════════
-- EL ALTA, CON EL APELLIDO
-- ══════════════════════════════════════════════════════════════════════════

/* La de seis argumentos se va: con las dos, PostgREST no sabría cuál
   llamar cuando llegan seis (la nueva también acepta seis, el apellido es
   opcional). Una página vieja sigue entrando por la nueva sin apellido, y
   el disparador parte el nombre. */
drop function if exists club_alta(text, text, text, date, boolean, text);

create or replace function club_alta(
  p_nombre   text,
  p_telefono text,
  p_local    text default null,
  p_cumple   date default null,
  p_acepta   boolean default false,
  p_mail     text default null,
  p_apellido text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ca$
declare
  tel   text;
  nom   text;
  nms   text;
  ape   text;
  mai   text;
  cod   text;
  nid   bigint;
begin
  nms := nullif(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
  tel := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
  mai := lower(nullif(trim(coalesce(p_mail, '')), ''));

  if nms is null then raise exception 'Falta tu nombre.'; end if;
  /* Con la página nueva el apellido llega siempre (aunque sea vacío): ahí
     es obligatorio. Una página vieja no lo manda y entra como antes. */
  if p_apellido is not null then
    ape := nullif(btrim(regexp_replace(p_apellido, '\s+', ' ', 'g')), '');
    if ape is null then raise exception 'Falta tu apellido.'; end if;
    if length(nms) > 40 or length(ape) > 40 then raise exception 'El nombre o el apellido es muy largo: hasta 40 letras cada uno.'; end if;
    nom := nms || ' ' || ape;
  else
    nom := nms;
  end if;
  if length(tel) < 8 then raise exception 'Ese WhatsApp no parece completo.'; end if;

  /* Un mail mal escrito no frena el alta: se guarda igual. Frenar a alguien
     parado en el mostrador por un campo OPCIONAL es exactamente al revés de
     para qué es opcional. Lo único que se rechaza es algo que claramente no
     es un mail, para no llenar la base de "no tengo". */
  if mai is not null and mai !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Ese mail no se entiende. Dejalo vacío si no lo tenés a mano.';
  end if;

  /* La misma regla que "Mis datos": una fecha que tenga sentido. */
  if p_cumple is not null and not club_cumple_ok(p_cumple) then
    raise exception 'Esa fecha de cumpleaños no parece correcta.';
  end if;

  if exists (select 1 from club_clientes
              where regexp_replace(telefono, '[^0-9]', '', 'g') = tel) then
    return jsonb_build_object('alta', false, 'ya_estaba', true,
      'porque', 'Ese número ya tiene tarjeta. Te la abrimos.');
  end if;

  cod := club_codigo();

  insert into club_clientes (
    codigo, nombre, nombres, apellido, telefono, mail, cumple, local_alta,
    acepta_promos, consentimiento, consentimiento_via
  ) values (
    cod, nom, case when ape is not null then nms end, ape, trim(p_telefono), mai, p_cumple,
    nullif(trim(coalesce(p_local, '')), ''),
    coalesce(p_acepta, false),
    case when coalesce(p_acepta, false) then now() else null end,
    case when coalesce(p_acepta, false)
         then 'alta web' || coalesce(' · ' || nullif(trim(coalesce(p_local, '')), ''), '')
         else null end
  )
  returning id into nid;

  return jsonb_build_object('alta', true, 'codigo', cod, 'nombre', nom);
end;
$ca$;

revoke all on function club_alta(text, text, text, date, boolean, text, text) from public;
grant execute on function club_alta(text, text, text, date, boolean, text, text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- MIS DATOS, CON EL APELLIDO
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_mis_datos(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $md$
  select coalesce((
    select jsonb_build_object(
      'hay', true,
      'nombre', c.nombre,
      'nombres', coalesce(c.nombres, (club_partir_nombre(c.nombre))[1]),
      'apellido', coalesce(c.apellido, (club_partir_nombre(c.nombre))[2]),
      'mail', c.mail,
      'telefono', case when length(d.dig) >= 6
                       then left(d.dig, 2) || ' •••• ' || right(d.dig, 4)
                       else '••••' end,
      'cumple', c.cumple,
      'acepta_promos', c.acepta_promos,
      'desde', c.creado)
      from club_clientes c
      cross join lateral (select regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g') as dig) d
     where c.codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and c.baja is null), jsonb_build_object('hay', false))
$md$;

revoke all on function club_mis_datos(text) from public;
grant execute on function club_mis_datos(text) to anon, authenticated;


/* La de "Mis datos" con nombre y apellido. Parámetros con otros nombres que
   la del 25 (p_nombres, p_apellido): conviven sin confundirse, y la vieja
   sigue sirviendo a un celular con la página anterior. */
create or replace function club_mis_datos_guardar(
  p_codigo text, p_nombres text, p_apellido text, p_mail text, p_cumple date, p_acepta boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mg$
declare
  c    club_clientes%rowtype;
  nms  text := nullif(btrim(regexp_replace(coalesce(p_nombres, ''), '\s+', ' ', 'g')), '');
  ape  text := nullif(btrim(regexp_replace(coalesce(p_apellido, ''), '\s+', ' ', 'g')), '');
  mai  text := lower(nullif(trim(coalesce(p_mail, '')), ''));
  cam  text := '';
begin
  select * into c from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('ok', false, 'porque', 'No encontramos tu tarjeta. Recargá la página y probá de nuevo.');
  end if;

  if nms is null then
    return jsonb_build_object('ok', false, 'campo', 'nombres', 'porque', 'Tu nombre no puede quedar vacío.');
  end if;
  if ape is null then
    return jsonb_build_object('ok', false, 'campo', 'apellido', 'porque', 'Tu apellido no puede quedar vacío.');
  end if;
  if length(nms) > 40 then
    return jsonb_build_object('ok', false, 'campo', 'nombres', 'porque', 'El nombre es muy largo: hasta 40 letras.');
  end if;
  if length(ape) > 40 then
    return jsonb_build_object('ok', false, 'campo', 'apellido', 'porque', 'El apellido es muy largo: hasta 40 letras.');
  end if;
  if mai is not null and mai !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'campo', 'mail', 'porque', 'Ese mail no parece completo. Revisalo o dejalo vacío.');
  end if;

  if p_cumple is not null and c.cumple is null then
    if not club_cumple_ok(p_cumple) then
      return jsonb_build_object('ok', false, 'campo', 'cumple', 'porque', 'Esa fecha de cumpleaños no parece correcta.');
    end if;
    cam := cam || ' · cumple: ' || to_char(p_cumple, 'DD/MM/YYYY');
  elsif p_cumple is not null and c.cumple is distinct from p_cumple then
    return jsonb_build_object('ok', false, 'campo', 'cumple',
      'porque', 'Tu cumpleaños ya está cargado. Para corregirlo, pedilo en la caja de cualquier local.');
  end if;

  if c.nombres is distinct from nms or c.apellido is distinct from ape then
    cam := cam || ' · nombre: ' || c.nombre || ' → ' || nms || ' ' || ape;
  end if;
  if c.mail is distinct from mai then cam := cam || ' · mail: ' || coalesce(c.mail, '—') || ' → ' || coalesce(mai, '—'); end if;
  if p_acepta is not null and p_acepta is distinct from c.acepta_promos then
    cam := cam || case when p_acepta then ' · prendió las promos por WhatsApp' else ' · apagó las promos por WhatsApp' end;
  end if;

  if cam = '' then
    return jsonb_build_object('ok', true, 'cambios', false) || club_mis_datos(c.codigo);
  end if;

  insert into log (accion, detalle, quien)
  values ('club: el socio corrigió sus datos', 'tarjeta ' || c.codigo || cam, 'el socio, desde su tarjeta');

  /* nombres y apellido: el disparador arma el nombre completo. */
  update club_clientes
     set nombres = nms,
         apellido = ape,
         mail = mai,
         cumple = coalesce(cumple, p_cumple),
         acepta_promos = coalesce(p_acepta, acepta_promos),
         consentimiento = case when p_acepta is true and not acepta_promos then now() else consentimiento end,
         consentimiento_via = case when p_acepta is true and not acepta_promos then 'tarjeta' else consentimiento_via end,
         revocado = case when p_acepta is true and not acepta_promos then null
                         when p_acepta is false and acepta_promos then now()
                         else revocado end
   where id = c.id;

  perform club_kommo_encolar(c.id);

  return jsonb_build_object('ok', true, 'cambios', true) || club_mis_datos(c.codigo);
end;
$mg$;

revoke all on function club_mis_datos_guardar(text, text, text, text, date, boolean) from public;
grant execute on function club_mis_datos_guardar(text, text, text, text, date, boolean) to anon, authenticated;

select nombre, nombres, apellido from club_clientes where baja is null order by id;


-- ─────────────────────────── PARTE 27 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · PUNTOS POR LAS COMPRAS DE LA TIENDA ONLINE
--
-- Correr entero en el editor SQL de Supabase, después del 26.
--
-- Pedido de Mauricio (29/09/2026): si un socio compra en vdh.com.ar, suma
-- puntos igual que en el local. Las reglas, acordadas con él:
--
--   · Se lo reconoce por el teléfono (los últimos 10 números) o por el mail
--     del pedido. Tiene que dar UN solo socio: si da dos, no se adivina.
--   · Suma lo pagado menos el envío, con el multiplicador de su nivel y los
--     puntos extra que corrían A LA HORA DEL PAGO (no a la de la lectura).
--   · Le llega el aviso "Sumaste X puntos por tu compra online".
--   · Si el pedido se cancela o se devuelve, la compra se anula. El saldo
--     puede quedar negativo (decidido: si no, cancelar después de canjear
--     sería una forma de llevarse un premio gratis).
--   · Cuentan los pedidos pagados desde que se corre esto, no los de antes.
--   · En las estadísticas es un local más: "Tienda online".
--
-- Quién lee la tienda: el GitHub Action de cada hora (vdh-respaldos), con
-- la llave de Tienda Nube en sus Secrets. Todo lo de acá es interno: la
-- página del cliente no puede llamar a nada de esto.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · DÓNDE QUEDA ANOTADO
-- ══════════════════════════════════════════════════════════════════════════

/* Una sola fila: desde cuándo cuentan los pedidos, hasta dónde se leyó y
   cuándo fue la última lectura. */
create table if not exists club_tienda_estado (
  id        smallint primary key default 1 check (id = 1),
  desde     timestamptz not null,
  visto     timestamptz,
  corrio    timestamptz,
  resultado jsonb
);
insert into club_tienda_estado (id, desde) values (1, now()) on conflict (id) do nothing;
alter table club_tienda_estado enable row level security;
revoke all on club_tienda_estado from anon, authenticated;

/* Cada pedido que ya se decidió, con qué se decidió. Es lo que impide que
   uno sume dos veces aunque la tienda lo mande veinte. Del pedido se guarda
   el número y nada más: ni el mail ni el teléfono de quien no es socio. */
create table if not exists club_tienda_pedidos (
  pedido     bigint primary key,
  numero     text not null,
  /* sumado · anulado · cancelado · sin_socio · varios_socios · anterior ·
     sin_monto · otra_moneda */
  estado     text not null,
  cliente    bigint references club_clientes(id) on delete set null,
  movimiento bigint references club_movimientos(id) on delete set null,
  importe    numeric,
  puntos     integer,
  pagado     timestamptz,
  por        text,
  creado     timestamptz not null default now(),
  cambiado   timestamptz not null default now()
);
alter table club_tienda_pedidos enable row level security;
revoke all on club_tienda_pedidos from anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · EL MULTIPLICADOR A UNA HORA DADA
-- ══════════════════════════════════════════════════════════════════════════

/* club_factor pero a la hora que se diga. Un pedido pagado el martes de
   puntos dobles a las 23:50 se lee a la 0:07 del miércoles: tiene que
   sumar doble igual. club_factor queda como esto mismo a la hora de ahora,
   así la cuenta está escrita una sola vez. */
create or replace function club_factor_en(p_cliente bigint, p_t timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hoy       date := (p_t at time zone 'America/Argentina/Buenos_Aires')::date;
  c         record;
  cm        numeric;
  antes     integer;
  fin       date;
  pr        record;
  extra     numeric := 1;
  motivo    text;
  hasta     date;
  hora_fin  time;
  de_cumple boolean := false;
begin
  select v.multiplica, v.cumple into c from v_club_clientes v where v.id = p_cliente;
  select nullif(valor, '')::numeric into cm    from club_reglas where clave = 'cumple_multiplica';
  select nullif(valor, '')::integer into antes from club_reglas where clave = 'cumple_antes';

  if c.cumple is not null and coalesce(cm, 1) > 1 then
    fin := club_cumple_fin(c.cumple, hoy, coalesce(antes, 7));
    if fin is not null then
      extra := cm; motivo := 'Tu semana de cumple'; hasta := fin; de_cumple := true;
    end if;
  end if;

  select m.nombre, m.factor, m.hora_hasta,
         (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1 as ultimo
    into pr
    from club_multiplicadores m
   where club_multi_vale(m, p_t)
   order by m.factor desc, m.hasta desc
   limit 1;

  if pr.factor is not null and pr.factor > extra then
    extra := pr.factor; motivo := pr.nombre; hasta := pr.ultimo; de_cumple := false;
    /* Una hora feliz termina hoy a esa hora, no el último día del rango:
       "hasta las 20 h" es lo que el cliente necesita saber. */
    hora_fin := pr.hora_hasta;
  end if;

  return jsonb_build_object(
    'total',  round(coalesce(c.multiplica, 1) * extra, 2),
    'nivel',  coalesce(c.multiplica, 1),
    'extra',  extra,
    'motivo', motivo,
    'hasta',  hasta,
    'hora_hasta', case when hora_fin is null then null
                       when extract(minute from hora_fin) = 0 then to_char(hora_fin, 'FMHH24')
                       else to_char(hora_fin, 'FMHH24:MI') end,
    'cumple', de_cumple,
    'es_cumple', c.cumple is not null
                 and club_cumple_en(c.cumple, extract(year from hoy)::int) = hoy);
end;
$function$;

revoke all on function club_factor_en(bigint, timestamptz) from public, anon, authenticated;

create or replace function club_factor(p_cliente bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $cf$
  select club_factor_en(p_cliente, now())
$cf$;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · UN PEDIDO
-- ══════════════════════════════════════════════════════════════════════════

/* "+54 9 11 2345-6789", "011 2345 6789" y "11 2345 6789" son el mismo
   teléfono: los últimos 10 números. Con menos de 10 no se compara. */
create or replace function club_tel10(p text)
returns text
language sql
immutable
as $t10$
  select case when length(d) >= 10 then right(d, 10) end
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$t10$;

create or replace function club_tienda_anotar(p_pedido bigint, p_numero text, p_estado text, p_pagado timestamptz)
returns void
language sql
security definer
set search_path = public
as $ta$
  insert into club_tienda_pedidos (pedido, numero, estado, pagado)
  values (p_pedido, p_numero, p_estado, p_pagado)
  on conflict (pedido) do update
    set estado = excluded.estado, pagado = excluded.pagado, cambiado = now()
$ta$;

revoke all on function club_tel10(text) from public, anon, authenticated;
revoke all on function club_tienda_anotar(bigint, text, text, timestamptz) from public, anon, authenticated;


/* Recibe un pedido tal como lo arma el Action y decide. Se puede llamar
   las veces que sea con el mismo pedido: la segunda no hace nada.

   Lo que espera: id, numero, pago (payment_status), estado (status),
   pagado (paid_at), total, envio (shipping_cost_customer), moneda,
   telefonos [..], mails [..]. */
create or replace function club_tienda_pedido(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $tp$
declare
  pid    bigint := nullif(p->>'id', '')::bigint;
  num    text   := coalesce(nullif(trim(p->>'numero'), ''), p->>'id');
  pago   text   := lower(coalesce(p->>'pago', ''));
  est    text   := lower(coalesce(p->>'estado', ''));
  pag    timestamptz := nullif(p->>'pagado', '')::timestamptz;
  desde  timestamptz;
  ya     club_tienda_pedidos%rowtype;
  base   numeric;
  tels   text[];
  mails  text[];
  cands  bigint[];
  cli    bigint;
  por    text;
  porpto numeric;
  f      jsonb;
  gana   integer;
  mid    bigint;
begin
  if pid is null then raise exception 'Un pedido sin id.'; end if;

  /* Dos corridas a la vez con el mismo pedido: la segunda espera a la
     primera, y cuando entra ya lo encuentra decidido. */
  perform pg_advisory_xact_lock(hashtext('club_tienda'), hashtext(pid::text));

  select * into ya from club_tienda_pedidos where pedido = pid;

  /* ── Se cayó: cancelado, devuelto o desconocido por la tarjeta ── */
  if est = 'cancelled' or pago in ('voided', 'refunded', 'chargeback') then
    if ya.estado = 'sumado' then
      update club_movimientos
         set anulado = now(), anulado_por = 'Tienda online',
             motivo_anul = 'Pedido #' || num || case when est = 'cancelled' then ' cancelado' else ' devuelto' end ||
                           ' en la tienda online'
       where id = ya.movimiento and anulado is null;
      update club_tienda_pedidos set estado = 'anulado', cambiado = now() where pedido = pid;
      /* La compra desaparece de su tarjeta y el saldo baja: sin un aviso,
         parece que le sacamos puntos porque sí. */
      if coalesce(ya.puntos, 0) > 0
         and exists (select 1 from club_suscripciones su where su.cliente = ya.cliente and su.muerto is null) then
        insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
        values (ya.cliente, 'tienda_anulada', num,
                'Se canceló tu pedido #' || num,
                'Descontamos los ' || replace(to_char(ya.puntos, 'FM999,999,999'), ',', '.') ||
                ' puntos que había sumado.',
                'tarjeta.html', now())
        on conflict (cliente, motivo, clave) do nothing;
      end if;
      return jsonb_build_object('pedido', num, 'hizo', 'anulado', 'puntos', -coalesce(ya.puntos, 0));
    end if;
    if ya.pedido is not null and ya.estado <> 'anulado' then
      update club_tienda_pedidos set estado = 'cancelado', cambiado = now() where pedido = pid;
    end if;
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'cancelado');
  end if;

  /* Ya decidido para siempre. Lo que NO está acá (sin_socio, varios_socios)
     se vuelve a mirar: si el cliente se anota después de comprar, el pedido
     que vuelva a aparecer ya lo encuentra. */
  if ya.estado in ('sumado', 'anulado', 'cancelado', 'anterior', 'sin_monto', 'otra_moneda') then
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'ya estaba: ' || ya.estado);
  end if;

  /* Pendiente, autorizado, abandonado: todavía no. Cuando se pague, la
     tienda lo marca como cambiado y vuelve a aparecer. */
  if pago <> 'paid' then
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'sin pagar');
  end if;
  pag := coalesce(pag, now());

  select t.desde into desde from club_tienda_estado t where t.id = 1;
  if pag < desde then
    perform club_tienda_anotar(pid, num, 'anterior', pag);
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'pagado antes de arrancar');
  end if;
  if upper(coalesce(nullif(trim(p->>'moneda'), ''), 'ARS')) <> 'ARS' then
    perform club_tienda_anotar(pid, num, 'otra_moneda', pag);
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'otra moneda');
  end if;

  base := coalesce(nullif(p->>'total', '')::numeric, 0) - coalesce(nullif(p->>'envio', '')::numeric, 0);
  if base <= 0 then
    perform club_tienda_anotar(pid, num, 'sin_monto', pag);
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'sin monto');
  end if;

  /* ── Quién es ── */
  select coalesce(array_agg(distinct club_tel10(x)) filter (where club_tel10(x) is not null), '{}')
    into tels
    from jsonb_array_elements_text(case when jsonb_typeof(p->'telefonos') = 'array' then p->'telefonos' else '[]'::jsonb end) x;
  select coalesce(array_agg(distinct lower(trim(x))) filter (where trim(x) ~ '^[^@[:space:]]+@[^@[:space:]]+$'), '{}')
    into mails
    from jsonb_array_elements_text(case when jsonb_typeof(p->'mails') = 'array' then p->'mails' else '[]'::jsonb end) x;

  select array_agg(c.id order by c.id) into cands
    from club_clientes c
   where c.baja is null
     and (club_tel10(c.telefono) = any(tels) or lower(trim(c.mail)) = any(mails));

  if coalesce(array_length(cands, 1), 0) = 0 then
    perform club_tienda_anotar(pid, num, 'sin_socio', pag);
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'no es socio');
  end if;
  /* El teléfono de uno y el mail de otro: no se adivina. */
  if array_length(cands, 1) > 1 then
    perform club_tienda_anotar(pid, num, 'varios_socios', pag);
    return jsonb_build_object('pedido', num, 'hizo', 'nada', 'porque', 'coincide con más de un socio');
  end if;
  cli := cands[1];

  select case when club_tel10(c.telefono) = any(tels) and lower(trim(c.mail)) = any(mails) then 'teléfono y mail'
              when club_tel10(c.telefono) = any(tels) then 'teléfono'
              else 'mail' end
    into por
    from club_clientes c where c.id = cli;

  /* ── Cuánto suma: la misma cuenta que la caja ── */
  select nullif(valor, '')::numeric into porpto from club_reglas where clave = 'pesos_por_punto';
  porpto := coalesce(porpto, 100);
  f := club_factor_en(cli, pag);
  gana := floor((base / porpto) * (f->>'total')::numeric);

  /* La compra queda con la fecha del PAGO: en las estadísticas es una venta
     de ese día, aunque se haya leído una hora después. */
  insert into club_movimientos (cliente, tipo, creado, puntos, local, ticket, importe, concepto, obs)
  values (cli, 'compra', least(pag, now()), gana, 'TIENDA ONLINE', 'TN-' || num, base, 'tienda_online',
          case when (f->>'extra')::numeric > 1 then
            (f->>'motivo') || ' ' || replace(trim_scale((f->>'extra')::numeric)::text, '.', ',') || 'x'
          end)
  returning id into mid;

  insert into club_tienda_pedidos (pedido, numero, estado, cliente, movimiento, importe, puntos, pagado, por)
  values (pid, num, 'sumado', cli, mid, base, gana, pag, por)
  on conflict (pedido) do update
    set estado = 'sumado', cliente = excluded.cliente, movimiento = excluded.movimiento,
        importe = excluded.importe, puntos = excluded.puntos, pagado = excluded.pagado,
        por = excluded.por, cambiado = now();

  /* El aviso, si tiene los avisos prendidos. Lo manda el mismo Action un
     momento después. */
  if gana > 0 and exists (select 1 from club_suscripciones su where su.cliente = cli and su.muerto is null) then
    insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
    values (cli, 'tienda', num,
            'Sumaste ' || replace(to_char(gana, 'FM999,999,999'), ',', '.') || ' puntos por tu compra online',
            'Pedido #' || num || '. Ya están en tu tarjeta.',
            'tarjeta.html', now())
    on conflict (cliente, motivo, clave) do nothing;
  end if;

  return jsonb_build_object('pedido', num, 'hizo', 'sumado', 'puntos', gana, 'por', por);
end;
$tp$;

revoke all on function club_tienda_pedido(jsonb) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · LAS ESTADÍSTICAS: "TIENDA ONLINE" ES UN LOCAL MÁS
-- ══════════════════════════════════════════════════════════════════════════

/* "Sin local asignado" deja de juntar la tienda: tiene su propia fila, y
   así la tabla sigue cerrando con el total. */
create or replace function club_est_local_ok(p_local text, p_filtro text)
returns boolean
language sql
stable
security definer
set search_path = public
as $lo$
  select case
    when p_filtro is null then true
    when p_filtro = '__SIN__' then
      (nullif(trim(coalesce(p_local, '')), '') is null
       or not exists (select 1 from locales l where l.activo and upper(trim(l.codigo)) = upper(trim(p_local))))
      and upper(trim(coalesce(p_local, ''))) <> 'TIENDA ONLINE'
    else upper(trim(coalesce(p_local, ''))) = p_filtro
  end
$lo$;

revoke all on function club_est_local_ok(text, text) from public, anon, authenticated;

create or replace function club_estadisticas(p_pin text, p_desde date, p_hasta date, p_local text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  d0  date := coalesce(p_desde, hoy - 29);
  d1  date := coalesce(p_hasta, hoy);
  aux date;
  dias integer;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  t0 timestamptz; t1 timestamptz; a0 timestamptz;
  escala text;
  costo_punto numeric;
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  if d1 < d0 then aux := d0; d0 := d1; d1 := aux; end if;
  /* Tres años como mucho: más que eso no es un período, es la historia. */
  if d1 - d0 > 1100 then d0 := d1 - 1100; end if;
  dias := d1 - d0 + 1;
  t0 := d0::timestamp at time zone tz;
  t1 := (d1 + 1)::timestamp at time zone tz;
  a0 := (d0 - dias)::timestamp at time zone tz;      -- el período anterior, del mismo largo
  /* El gráfico por día: con más de tres meses serían puntos ilegibles. */
  escala := case when dias <= 92 then 'day' when dias <= 400 then 'week' else 'month' end;

  /* Cuánto cuesta un punto que se canjea, en promedio del catálogo activo:
     para pasar los puntos que los socios tienen guardados a plata. */
  select case when sum(puntos) > 0 then sum(costo) / sum(puntos) end
    into costo_punto
    from club_premios where activo and costo is not null and puntos > 0;

  with
  mov as (
    select m.*, (m.creado at time zone tz) as local_ts
      from club_movimientos m
     where m.anulado is null and m.creado >= t0 and m.creado < t1
       and club_est_local_ok(m.local, loc)
  ),
  compras as (select * from mov where tipo = 'compra'),
  /* Los socios que se miran en "hoy": todos, o los anotados en el local. */
  socios as (
    select v.*
      from v_club_clientes v
     where v.baja is null
       and club_est_local_ok(v.local_alta, loc)
  ),
  primera as (
    select cliente, min(creado) as cuando
      from club_movimientos where tipo = 'compra' and anulado is null
     group by cliente
  ),
  vivos as (
    select distinct cliente from club_suscripciones where muerto is null and cliente is not null
  ),
  a_recuperar as (
    select s.* from socios s
     where s.ultima_compra is not null
       and s.ultima_compra < now() - interval '60 days'
       and s.ultima_compra >= now() - interval '365 days'
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', d0, 'hasta', d1, 'dias', dias,
                                  'antes_desde', d0 - dias, 'antes_hasta', d0 - 1,
                                  'local', loc, 'escala', escala),
    'actual',   club_est_resumen(t0, t1, loc),
    'anterior', club_est_resumen(a0, t0, loc),

    /* Cada cuántos días vuelve a comprar un socio: para cada compra DEL
       período que no es la primera del socio, cuántos días pasaron desde la
       anterior (que puede ser de antes del período). El promedio. */
    'frecuencia_dias', (
      select round(avg(extract(epoch from g.gap) / 86400))
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),
    'frecuencia_casos', (
      select count(*)
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),

    /* Quiénes compraron en el período y si "volvieron": ya habían comprado
       antes, o compraron más de una vez en el período. Es la lista detrás
       del número. */
    'volvieron_lista', (
      select coalesce(jsonb_agg(x order by (x->>'volvio')::boolean desc, x->>'nombre'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre,
                 'compras', count(*),
                 'primera', (select min(x.creado) from club_movimientos x
                              where x.cliente = c.cliente and x.tipo = 'compra' and x.anulado is null),
                 'volvio', count(*) > 1 or exists (select 1 from club_movimientos x
                                                    where x.cliente = c.cliente and x.tipo = 'compra'
                                                      and x.anulado is null and x.creado < t0)) as x
          from compras c join club_clientes k on k.id = c.cliente
         group by c.cliente, k.nombre
         limit 200) z),

    /* Hoy, no en el período: cuánto hace que compró cada socio. */
    'actividad', (
      select jsonb_build_object(
        'total', count(*),
        'ultimos_30', count(*) filter (where ultima_compra >= now() - interval '30 days'),
        'de_31_a_90', count(*) filter (where ultima_compra <  now() - interval '30 days'
                                         and ultima_compra >= now() - interval '90 days'),
        'mas_de_90',  count(*) filter (where ultima_compra <  now() - interval '90 days'),
        'nunca',      count(*) filter (where ultima_compra is null))
        from socios),

    /* Los que venían y dejaron: la última compra hace entre 60 días y un
       año. Más de un año ya es otro trabajo (y sus puntos vencieron). */
    'recuperar', (
      select jsonb_build_object(
        'total', count(*),
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        'con_avisos', count(*) filter (where exists (select 1 from vivos w where w.cliente = ar.id)),
        'avisados_30', count(*) filter (where exists (
                          select 1 from club_avisos_personales p
                           where p.cliente = ar.id and p.motivo = 'recuperar'
                             and p.creado > now() - interval '30 days')),
        'puntos', coalesce(sum(puntos), 0),
        'lista', coalesce((select jsonb_agg(z.x order by z.hace) from (
                   select jsonb_build_object('nombre', q.nombre, 'nivel', q.nivel, 'local', q.local_alta,
                            'puntos', q.puntos, 'gastado', q.gastado,
                            'dias', (now()::date - (q.ultima_compra at time zone tz)::date)) as x,
                          (now()::date - (q.ultima_compra at time zone tz)::date) as hace
                     from a_recuperar q
                    order by q.gastado desc nulls last limit 30) z), '[]'::jsonb))
        from a_recuperar ar),

    'niveles', (
      select jsonb_build_object(
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        /* Cerca de subir: tiene el 80% o más de lo que pide el siguiente. */
        'cerca', count(*) filter (where exists (
                   select 1 from club_niveles n
                    where n.desde_xp > s.xp and s.xp >= n.desde_xp * 0.8
                      and n.desde_xp = (select min(desde_xp) from club_niveles where desde_xp > s.xp))))
        from socios s),

    /* Los 14, siempre todos: es la comparación. */
    'por_local', (
      select coalesce(jsonb_agg(
               club_est_resumen(t0, t1, upper(trim(l.codigo))) ||
               jsonb_build_object('local', l.codigo,
                                  'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                                  'socios', (select count(*) from club_clientes k
                                              where k.baja is null
                                                and upper(trim(k.local_alta)) = upper(trim(l.codigo))))
               order by l.codigo), '[]'::jsonb)
        from locales l where l.activo),

    /* "Sin local asignado": las compras sin local y los socios anotados
       solos. Con esta fila, la tabla suma lo mismo que el resumen. */
    /* La tienda online: una fila propia, ni uno de los 14 ni "sin local".
       Lleva cuándo se leyó la tienda por última vez: si eso se atrasa,
       algo dejó de andar. Ver el 27. */
    'tienda', club_est_resumen(t0, t1, 'TIENDA ONLINE') ||
              jsonb_build_object('local', 'TIENDA ONLINE', 'nombre', 'Tienda online', 'socios', 0,
                                 'leida', (select t.corrio from club_tienda_estado t where t.id = 1)),

    'sin_local', club_est_resumen(t0, t1, '__SIN__') ||
                 jsonb_build_object('local', '__SIN__', 'nombre', 'Sin local asignado',
                                    'socios', (select count(*) from club_clientes k
                                                where k.baja is null and club_est_local_ok(k.local_alta, '__SIN__'))),

    /* Quién carga las compras con tarjeta, y a cuántos socios les cargó la
       PRIMERA compra: los que "estrenó". El alta no guarda quién anotó al
       socio (se anotan solos con el QR, muchas veces), y la primera compra
       es la mejor seña de quién lo trajo al Club. */
    'vendedores', (
      select coalesce(jsonb_agg(v order by (v->>'compras')::int desc, v->>'vendedor'), '[]'::jsonb)
        from (select jsonb_build_object(
                       'vendedor', trim(c.vendedor),
                       'compras', count(*),
                       'facturado', coalesce(sum(c.importe), 0),
                       'clientes', count(distinct c.cliente),
                       'estrenados', count(*) filter (where p.cuando = c.creado)) as v
                from compras c
                left join primera p on p.cliente = c.cliente
               where nullif(trim(c.vendedor), '') is not null
               group by trim(c.vendedor)
               order by count(*) desc
               limit 25) z),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('f', s.f, 'compras', coalesce(x.n, 0),
                                                   'facturado', coalesce(x.plata, 0)) order by s.f), '[]'::jsonb)
        from (select distinct date_trunc(escala, g)::date as f
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g) s
        left join (select date_trunc(escala, local_ts)::date as f, count(*) as n, sum(importe) as plata
                     from compras group by 1) x on x.f = s.f),

    /* Por día de la semana: las compras y cuántas veces hubo ese día en el
       período, para sacar el promedio (un mes tiene cuatro o cinco lunes). */
    'por_semana', (
      select jsonb_agg(jsonb_build_object('d', w.d, 'veces', w.veces, 'compras', coalesce(x.n, 0)) order by w.d)
        from (select extract(isodow from g)::int as d, count(*) as veces
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g group by 1) w
        left join (select extract(isodow from local_ts)::int as d, count(*) as n
                     from compras group by 1) x on x.d = w.d),

    'por_hora', (
      select jsonb_agg(jsonb_build_object('h', h.h, 'compras', coalesce(x.n, 0)) order by h.h)
        from generate_series(0, 23) h(h)
        left join (select extract(hour from local_ts)::int as h, count(*) as n
                     from compras group by 1) x on x.h = h.h),

    'premios', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo,
               'canjes', (select count(*) from mov m where m.tipo = 'canje' and m.premio = p.id),
               'canjes_total', (select count(*) from club_movimientos m
                                 where m.tipo = 'canje' and m.premio = p.id and m.anulado is null),
               /* Cuántos socios podrían llevárselo hoy mismo. */
               'alcanza_hoy', (select count(*) from socios s where s.puntos >= p.puntos))
             order by p.orden, p.puntos), '[]'::jsonb)
        from club_premios p where p.activo),

    /* Los que cumplen en los próximos 7 días. El cumple de este año se arma
       con el mes y el día; sólo el 29 de febrero se corre al 28, que en un
       año no bisiesto no existe. (Una primera versión cortaba TODOS los días
       en 28 y el 29 y el 30 de cualquier mes daban "hoy" un día 28.) */
    'cumples', (
      select jsonb_build_object(
        'proximos', coalesce((select jsonb_agg(x order by x->>'falta') from (
            select jsonb_build_object('nombre', s.nombre, 'nivel', s.nivel, 'local', s.local_alta,
                     'dia', to_char(s.cumple, 'DD/MM'),
                     'falta', lpad(((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                                  case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366)::text, 3, '0')) as x
              from socios s
             where s.cumple is not null
               and ((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                     case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366) <= 7
             limit 40) z), '[]'::jsonb))),

    'ranking', (
      select coalesce(jsonb_agg(x order by (x->>'gastado')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre, 'nivel', v.nivel, 'local', k.local_alta,
                 'compras', count(*), 'gastado', coalesce(sum(c.importe), 0),
                 'puntos', v.puntos,
                 'ultima', max(c.creado)) as x
          from compras c
          join club_clientes k on k.id = c.cliente
          join v_club_clientes v on v.id = c.cliente
         group by k.id, k.nombre, v.nivel, k.local_alta, v.puntos
         order by coalesce(sum(c.importe), 0) desc
         limit 10) z),

    /* Lo que VDH les debe en premios: los puntos que tienen guardados,
       pasados a plata al costo promedio de un punto del catálogo. Y los que
       vencen en los próximos 60 días (12 meses sin comprar). */
    'pasivo', (
      select jsonb_build_object(
        'catalogo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo)
                                               order by p.puntos), '[]'::jsonb)
                       from club_premios p where p.activo and p.costo is not null and p.puntos > 0),
        'puntos', coalesce(sum(greatest(puntos, 0)), 0),
        'costo_punto', costo_punto,
        'costo', round(coalesce(sum(greatest(puntos, 0)), 0) * coalesce(costo_punto, 0)),
        'vencen_60', coalesce(sum(greatest(puntos, 0)) filter (
                        where coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'), 0),
        'vencen_60_socios', count(*) filter (
                        where puntos > 0
                          and coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'))
        from socios),

    'resenas', (
      select coalesce(jsonb_agg(jsonb_build_object('local', x.l, 'pedidos', x.n) order by x.n desc), '[]'::jsonb)
        from (select split_part(p.clave, '|', 1) as l, count(*) as n
                from club_avisos_personales p
               where p.motivo = 'resena' and p.creado >= t0 and p.creado < t1
                 and (loc is null or upper(split_part(p.clave, '|', 1)) = loc)
               group by 1) x),

    'recientes', (
      select coalesce(jsonb_agg(x order by x->>'cuando' desc), '[]'::jsonb) from (
        select jsonb_build_object('cuando', m.creado, 'nombre', k.nombre, 'tipo', m.tipo,
                                  'concepto', m.concepto, 'puntos', m.puntos, 'local', m.local,
                                  'obs', m.obs, 'importe', m.importe) as x
          from mov m join club_clientes k on k.id = m.cliente
         order by m.creado desc limit 12) z)
  )
  into r;

  return r;
end;
$function$;


select desde as "Cuentan los pedidos pagados desde" from club_tienda_estado;


-- ─────────────────────────── PARTE 28 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · EL RELOJ DE CADA HORA
--
-- Correr entero en el editor SQL de Supabase, después del 27.
--
-- El Action de vdh-respaldos (avisos.yml) está programado cada hora, pero
-- GitHub lo corre cada 4 a 6 horas: estrangula los horarios de los
-- repositorios privados con poco movimiento. Medido del 26 al 29/09/2026.
-- Con eso, los puntos de la tienda online y los saludos de cumpleaños
-- salían con horas de atraso.
--
-- Lo que GitHub NO demora es un pedido directo ("workflow_dispatch"). Así
-- que el reloj pasa a ser la base: pg_cron, el mismo que ya despacha las
-- salidas cada minuto, le pide a GitHub que corra el Action a los 5 minutos
-- de cada hora. El horario propio del Action queda como respaldo.
--
-- La llave de GitHub vive en el Vault de Supabase con el nombre
-- github_despachar. Sin ella esto no hace nada y no falla.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_despachar_hora()
returns bigint
language plpgsql
security definer
set search_path = public
as $dh$
declare
  llave text;
  pedido bigint;
begin
  select decrypted_secret into llave from vault.decrypted_secrets where name = 'github_despachar';
  if llave is null or length(trim(llave)) = 0 then
    return null;
  end if;

  select net.http_post(
    url     := 'https://api.github.com/repos/mauriciocamara85-star/vdh-respaldos/actions/workflows/avisos.yml/dispatches',
    body    := '{"ref": "main"}'::jsonb,
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || trim(llave),
                 'Accept', 'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'User-Agent', 'vdh-club-supabase',
                 'Content-Type', 'application/json')
  ) into pedido;

  return pedido;
end;
$dh$;

revoke all on function club_despachar_hora() from public, anon, authenticated;

/* Con el mismo nombre, pg_cron lo reemplaza: correr esto dos veces deja una
   sola tarea. */
select cron.schedule('club-cada-hora', '5 * * * *', $cr$ select club_despachar_hora() $cr$);

select jobname as "Tarea", schedule as "Cuándo", active as "Activa"
  from cron.job where jobname = 'club-cada-hora';


-- ─────────────────────────── PARTE 29 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · EL RITMO DE CADA SOCIO, Y SU FICHA
--
-- Correr entero en el editor SQL de Supabase, después del 28.
--
-- Pedido de Mauricio (29/09/2026), sobre una captura de Tienda de Puntos:
-- "Solía comprar cada 18 días. Hace 42 días que no vuelve."
--
-- Hasta acá "para recuperar" era una regla para todos: 60 días sin comprar.
-- Pero 42 días es una alarma para el que venía cada 18, y 70 no es nada
-- para el que viene cada 90. Desde ahora cada socio se mide contra su
-- propio ritmo:
--
--   · Frecuencia = la mediana de días entre compras (días distintos: dos
--     compras el mismo día son una visita). Recién con 3 días de compra:
--     con menos no hay ritmo que medir.
--   · Con ritmo: hay que recuperarlo cuando lleva el DOBLE de su
--     frecuencia sin volver, nunca antes de 21 días y siempre a los 180.
--   · Sin ritmo: como hasta ahora, 60 días.
--   · Más de un año sin comprar ya no entra: eso no se recupera con un
--     aviso.
--
-- La regla vive en club_ritmo y la usan la lista de Números, el aviso a
-- todos y la ficha: los tres cuentan lo mismo.
--
-- Suma la ficha de un socio para el panel, el aviso a UNO solo, y el
-- registro de a quién se le escribió (para que dos personas no le
-- escriban al mismo el mismo día).
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · EL RITMO
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_ritmo(p_cliente bigint default null)
returns table (
  cliente     bigint,
  compras     integer,
  dias_compra integer,
  frecuencia  integer,
  ultima      date,
  dias_sin    integer,
  atraso      numeric,
  a_recuperar boolean
)
language sql
stable
security definer
set search_path = public
as $rt$
  with d as (
    select m.cliente, (m.creado at time zone 'America/Argentina/Buenos_Aires')::date as dia, count(*)::int as n
      from club_movimientos m
     where m.tipo = 'compra' and m.anulado is null
       and (p_cliente is null or m.cliente = p_cliente)
     group by 1, 2
  ),
  g as (
    select d.cliente, d.dia, d.n,
           d.dia - lag(d.dia) over (partition by d.cliente order by d.dia) as salto
      from d
  ),
  a as (
    select g.cliente, sum(g.n)::int as compras, count(*)::int as dias_compra, max(g.dia) as ultima,
           percentile_cont(0.5) within group (order by g.salto) as mediana
      from g
     group by g.cliente
  ),
  b as (
    select a.*,
           case when a.dias_compra >= 3 then greatest(1, round(a.mediana))::int end as frec,
           ((now() at time zone 'America/Argentina/Buenos_Aires')::date - a.ultima) as sin
      from a
  )
  select b.cliente, b.compras, b.dias_compra, b.frec, b.ultima, b.sin,
         round(b.sin::numeric / coalesce(b.frec, 60), 2),
         b.sin <= 365
         and case when b.frec is not null then b.sin >= least(greatest(2 * b.frec, 21), 180)
                  else b.sin > 60 end
    from b
$rt$;

revoke all on function club_ritmo(bigint) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · LA LISTA Y EL AVISO A TODOS, CON EL RITMO
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_estadisticas(p_pin text, p_desde date, p_hasta date, p_local text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  d0  date := coalesce(p_desde, hoy - 29);
  d1  date := coalesce(p_hasta, hoy);
  aux date;
  dias integer;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  t0 timestamptz; t1 timestamptz; a0 timestamptz;
  escala text;
  costo_punto numeric;
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  if d1 < d0 then aux := d0; d0 := d1; d1 := aux; end if;
  /* Tres años como mucho: más que eso no es un período, es la historia. */
  if d1 - d0 > 1100 then d0 := d1 - 1100; end if;
  dias := d1 - d0 + 1;
  t0 := d0::timestamp at time zone tz;
  t1 := (d1 + 1)::timestamp at time zone tz;
  a0 := (d0 - dias)::timestamp at time zone tz;      -- el período anterior, del mismo largo
  /* El gráfico por día: con más de tres meses serían puntos ilegibles. */
  escala := case when dias <= 92 then 'day' when dias <= 400 then 'week' else 'month' end;

  /* Cuánto cuesta un punto que se canjea, en promedio del catálogo activo:
     para pasar los puntos que los socios tienen guardados a plata. */
  select case when sum(puntos) > 0 then sum(costo) / sum(puntos) end
    into costo_punto
    from club_premios where activo and costo is not null and puntos > 0;

  with
  mov as (
    select m.*, (m.creado at time zone tz) as local_ts
      from club_movimientos m
     where m.anulado is null and m.creado >= t0 and m.creado < t1
       and club_est_local_ok(m.local, loc)
  ),
  compras as (select * from mov where tipo = 'compra'),
  /* Los socios que se miran en "hoy": todos, o los anotados en el local. */
  socios as (
    select v.*
      from v_club_clientes v
     where v.baja is null
       and club_est_local_ok(v.local_alta, loc)
  ),
  primera as (
    select cliente, min(creado) as cuando
      from club_movimientos where tipo = 'compra' and anulado is null
     group by cliente
  ),
  vivos as (
    select distinct cliente from club_suscripciones where muerto is null and cliente is not null
  ),
  /* Los que dejaron de venir, cada uno medido contra su propio ritmo.
     La regla está en club_ritmo (SQL 29), la misma que usa el aviso. */
  a_recuperar as (
    select s.*, r.frecuencia, r.dias_sin, r.atraso
      from socios s
      join club_ritmo() r on r.cliente = s.id
     where r.a_recuperar
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', d0, 'hasta', d1, 'dias', dias,
                                  'antes_desde', d0 - dias, 'antes_hasta', d0 - 1,
                                  'local', loc, 'escala', escala),
    'actual',   club_est_resumen(t0, t1, loc),
    'anterior', club_est_resumen(a0, t0, loc),

    /* Cada cuántos días vuelve a comprar un socio: para cada compra DEL
       período que no es la primera del socio, cuántos días pasaron desde la
       anterior (que puede ser de antes del período). El promedio. */
    'frecuencia_dias', (
      select round(avg(extract(epoch from g.gap) / 86400))
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),
    'frecuencia_casos', (
      select count(*)
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),

    /* Quiénes compraron en el período y si "volvieron": ya habían comprado
       antes, o compraron más de una vez en el período. Es la lista detrás
       del número. */
    'volvieron_lista', (
      select coalesce(jsonb_agg(x order by (x->>'volvio')::boolean desc, x->>'nombre'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre,
                 'compras', count(*),
                 'primera', (select min(x.creado) from club_movimientos x
                              where x.cliente = c.cliente and x.tipo = 'compra' and x.anulado is null),
                 'volvio', count(*) > 1 or exists (select 1 from club_movimientos x
                                                    where x.cliente = c.cliente and x.tipo = 'compra'
                                                      and x.anulado is null and x.creado < t0)) as x
          from compras c join club_clientes k on k.id = c.cliente
         group by c.cliente, k.nombre
         limit 200) z),

    /* Hoy, no en el período: cuánto hace que compró cada socio. */
    'actividad', (
      select jsonb_build_object(
        'total', count(*),
        'ultimos_30', count(*) filter (where ultima_compra >= now() - interval '30 days'),
        'de_31_a_90', count(*) filter (where ultima_compra <  now() - interval '30 days'
                                         and ultima_compra >= now() - interval '90 days'),
        'mas_de_90',  count(*) filter (where ultima_compra <  now() - interval '90 days'),
        'nunca',      count(*) filter (where ultima_compra is null))
        from socios),

    /* Los que venían y dejaron: la última compra hace entre 60 días y un
       año. Más de un año ya es otro trabajo (y sus puntos vencieron). */
    'recuperar', (
      select jsonb_build_object(
        'total', count(*),
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        'con_avisos', count(*) filter (where exists (select 1 from vivos w where w.cliente = ar.id)),
        'avisados_30', count(*) filter (where exists (
                          select 1 from club_avisos_personales p
                           where p.cliente = ar.id and p.motivo = 'recuperar'
                             and p.creado > now() - interval '30 days')),
        'puntos', coalesce(sum(puntos), 0),
        /* Primero el más atrasado respecto de SU ritmo: el que venía cada
           18 días y lleva 42 antes que el que venía cada 90 y lleva 70. */
        'lista', coalesce((select jsonb_agg(z.x order by z.atraso desc, z.gastado desc nulls last) from (
                   select jsonb_build_object('codigo', q.codigo, 'nombre', q.nombre, 'nivel', q.nivel,
                            'local', q.local_alta, 'puntos', q.puntos, 'gastado', q.gastado,
                            'compras', q.compras, 'frecuencia', q.frecuencia, 'dias', q.dias_sin) as x,
                          q.atraso, q.gastado
                     from a_recuperar q
                    order by q.atraso desc, q.gastado desc nulls last limit 30) z), '[]'::jsonb))
        from a_recuperar ar),

    'niveles', (
      select jsonb_build_object(
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        /* Cerca de subir: tiene el 80% o más de lo que pide el siguiente. */
        'cerca', count(*) filter (where exists (
                   select 1 from club_niveles n
                    where n.desde_xp > s.xp and s.xp >= n.desde_xp * 0.8
                      and n.desde_xp = (select min(desde_xp) from club_niveles where desde_xp > s.xp))))
        from socios s),

    /* Los 14, siempre todos: es la comparación. */
    'por_local', (
      select coalesce(jsonb_agg(
               club_est_resumen(t0, t1, upper(trim(l.codigo))) ||
               jsonb_build_object('local', l.codigo,
                                  'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                                  'socios', (select count(*) from club_clientes k
                                              where k.baja is null
                                                and upper(trim(k.local_alta)) = upper(trim(l.codigo))))
               order by l.codigo), '[]'::jsonb)
        from locales l where l.activo),

    /* "Sin local asignado": las compras sin local y los socios anotados
       solos. Con esta fila, la tabla suma lo mismo que el resumen. */
    /* La tienda online: una fila propia, ni uno de los 14 ni "sin local".
       Lleva cuándo se leyó la tienda por última vez: si eso se atrasa,
       algo dejó de andar. Ver el 27. */
    'tienda', club_est_resumen(t0, t1, 'TIENDA ONLINE') ||
              jsonb_build_object('local', 'TIENDA ONLINE', 'nombre', 'Tienda online', 'socios', 0,
                                 'leida', (select t.corrio from club_tienda_estado t where t.id = 1)),

    'sin_local', club_est_resumen(t0, t1, '__SIN__') ||
                 jsonb_build_object('local', '__SIN__', 'nombre', 'Sin local asignado',
                                    'socios', (select count(*) from club_clientes k
                                                where k.baja is null and club_est_local_ok(k.local_alta, '__SIN__'))),

    /* Quién carga las compras con tarjeta, y a cuántos socios les cargó la
       PRIMERA compra: los que "estrenó". El alta no guarda quién anotó al
       socio (se anotan solos con el QR, muchas veces), y la primera compra
       es la mejor seña de quién lo trajo al Club. */
    'vendedores', (
      select coalesce(jsonb_agg(v order by (v->>'compras')::int desc, v->>'vendedor'), '[]'::jsonb)
        from (select jsonb_build_object(
                       'vendedor', trim(c.vendedor),
                       'compras', count(*),
                       'facturado', coalesce(sum(c.importe), 0),
                       'clientes', count(distinct c.cliente),
                       'estrenados', count(*) filter (where p.cuando = c.creado)) as v
                from compras c
                left join primera p on p.cliente = c.cliente
               where nullif(trim(c.vendedor), '') is not null
               group by trim(c.vendedor)
               order by count(*) desc
               limit 25) z),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('f', s.f, 'compras', coalesce(x.n, 0),
                                                   'facturado', coalesce(x.plata, 0)) order by s.f), '[]'::jsonb)
        from (select distinct date_trunc(escala, g)::date as f
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g) s
        left join (select date_trunc(escala, local_ts)::date as f, count(*) as n, sum(importe) as plata
                     from compras group by 1) x on x.f = s.f),

    /* Por día de la semana: las compras y cuántas veces hubo ese día en el
       período, para sacar el promedio (un mes tiene cuatro o cinco lunes). */
    'por_semana', (
      select jsonb_agg(jsonb_build_object('d', w.d, 'veces', w.veces, 'compras', coalesce(x.n, 0)) order by w.d)
        from (select extract(isodow from g)::int as d, count(*) as veces
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g group by 1) w
        left join (select extract(isodow from local_ts)::int as d, count(*) as n
                     from compras group by 1) x on x.d = w.d),

    'por_hora', (
      select jsonb_agg(jsonb_build_object('h', h.h, 'compras', coalesce(x.n, 0)) order by h.h)
        from generate_series(0, 23) h(h)
        left join (select extract(hour from local_ts)::int as h, count(*) as n
                     from compras group by 1) x on x.h = h.h),

    'premios', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo,
               'canjes', (select count(*) from mov m where m.tipo = 'canje' and m.premio = p.id),
               'canjes_total', (select count(*) from club_movimientos m
                                 where m.tipo = 'canje' and m.premio = p.id and m.anulado is null),
               /* Cuántos socios podrían llevárselo hoy mismo. */
               'alcanza_hoy', (select count(*) from socios s where s.puntos >= p.puntos))
             order by p.orden, p.puntos), '[]'::jsonb)
        from club_premios p where p.activo),

    /* Los que cumplen en los próximos 7 días. El cumple de este año se arma
       con el mes y el día; sólo el 29 de febrero se corre al 28, que en un
       año no bisiesto no existe. (Una primera versión cortaba TODOS los días
       en 28 y el 29 y el 30 de cualquier mes daban "hoy" un día 28.) */
    'cumples', (
      select jsonb_build_object(
        'proximos', coalesce((select jsonb_agg(x order by x->>'falta') from (
            select jsonb_build_object('nombre', s.nombre, 'nivel', s.nivel, 'local', s.local_alta,
                     'dia', to_char(s.cumple, 'DD/MM'),
                     'falta', lpad(((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                                  case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366)::text, 3, '0')) as x
              from socios s
             where s.cumple is not null
               and ((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                     case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366) <= 7
             limit 40) z), '[]'::jsonb))),

    'ranking', (
      select coalesce(jsonb_agg(x order by (x->>'gastado')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre, 'nivel', v.nivel, 'local', k.local_alta,
                 'compras', count(*), 'gastado', coalesce(sum(c.importe), 0),
                 'puntos', v.puntos,
                 'ultima', max(c.creado)) as x
          from compras c
          join club_clientes k on k.id = c.cliente
          join v_club_clientes v on v.id = c.cliente
         group by k.id, k.nombre, v.nivel, k.local_alta, v.puntos
         order by coalesce(sum(c.importe), 0) desc
         limit 10) z),

    /* Lo que VDH les debe en premios: los puntos que tienen guardados,
       pasados a plata al costo promedio de un punto del catálogo. Y los que
       vencen en los próximos 60 días (12 meses sin comprar). */
    'pasivo', (
      select jsonb_build_object(
        'catalogo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo)
                                               order by p.puntos), '[]'::jsonb)
                       from club_premios p where p.activo and p.costo is not null and p.puntos > 0),
        'puntos', coalesce(sum(greatest(puntos, 0)), 0),
        'costo_punto', costo_punto,
        'costo', round(coalesce(sum(greatest(puntos, 0)), 0) * coalesce(costo_punto, 0)),
        'vencen_60', coalesce(sum(greatest(puntos, 0)) filter (
                        where coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'), 0),
        'vencen_60_socios', count(*) filter (
                        where puntos > 0
                          and coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'))
        from socios),

    'resenas', (
      select coalesce(jsonb_agg(jsonb_build_object('local', x.l, 'pedidos', x.n) order by x.n desc), '[]'::jsonb)
        from (select split_part(p.clave, '|', 1) as l, count(*) as n
                from club_avisos_personales p
               where p.motivo = 'resena' and p.creado >= t0 and p.creado < t1
                 and (loc is null or upper(split_part(p.clave, '|', 1)) = loc)
               group by 1) x),

    'recientes', (
      select coalesce(jsonb_agg(x order by x->>'cuando' desc), '[]'::jsonb) from (
        select jsonb_build_object('cuando', m.creado, 'nombre', k.nombre, 'tipo', m.tipo,
                                  'concepto', m.concepto, 'puntos', m.puntos, 'local', m.local,
                                  'obs', m.obs, 'importe', m.importe) as x
          from mov m join club_clientes k on k.id = m.cliente
         order by m.creado desc limit 12) z)
  )
  into r;

  return r;
end;
$function$;

create or replace function club_avisar_recuperar(p_pin text, p_local text, p_titulo text, p_cuerpo text, p_enlace text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  tit text := nullif(trim(coalesce(p_titulo, '')), '');
  cue text := nullif(trim(coalesce(p_cuerpo, '')), '');
  enl text := nullif(trim(coalesce(p_enlace, '')), '');
  hoyclave text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
  n integer;
  sin integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if tit is null or length(tit) > 60 then
    return jsonb_build_object('ok', false, 'porque', 'El título va de 1 a 60 letras.');
  end if;
  if cue is null or length(cue) > 160 then
    return jsonb_build_object('ok', false, 'porque', 'El mensaje va de 1 a 160 letras.');
  end if;
  if enl is not null and not club_foto_url_ok(enl) then
    return jsonb_build_object('ok', false, 'porque', 'El enlace tiene que empezar con https://.');
  end if;

  with grupo as (
    select v.id from v_club_clientes v
      join club_ritmo() r on r.cliente = v.id
     where v.baja is null
       and club_est_local_ok(v.local_alta, loc)
       and r.a_recuperar
  ),
  elegidos as (
    select g.id from grupo g
     where exists (select 1 from club_suscripciones s where s.cliente = g.id and s.muerto is null)
       and not exists (select 1 from club_avisos_personales p
                        where p.cliente = g.id and p.motivo = 'recuperar'
                          and p.creado > now() - interval '30 days')
  ),
  ins as (
    insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
    select e.id, 'recuperar', hoyclave, tit, cue, enl, now() from elegidos e
    on conflict (cliente, motivo, clave) do nothing
    returning 1
  )
  select (select count(*) from ins),
         (select count(*) from grupo g
           where not exists (select 1 from club_suscripciones s where s.cliente = g.id and s.muerto is null))
    into n, sin;

  return jsonb_build_object('ok', true, 'avisados', n, 'sin_avisos', sin);
end;
$function$;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · A QUIÉN SE LE ESCRIBIÓ
-- ══════════════════════════════════════════════════════════════════════════

/* Cada vez que desde el panel se le escribe a un socio para que vuelva:
   por WhatsApp (se anota al tocar el botón, no se sabe si lo mandó) o con
   un aviso al celular. Con catorce locales y un panel, sin esto dos
   personas le escriben al mismo el mismo día. */
create table if not exists club_contactos (
  id      bigint generated always as identity primary key,
  cliente bigint not null references club_clientes(id) on delete cascade,
  via     text not null check (via in ('whatsapp', 'aviso')),
  quien   text,
  creado  timestamptz not null default now()
);
create index if not exists club_contactos_cliente on club_contactos (cliente, creado desc);
alter table club_contactos enable row level security;
revoke all on club_contactos from anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 4 · LA FICHA
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_socio_ficha(p_pin text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $sf$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  v  v_club_clientes%rowtype;
  c  club_clientes%rowtype;
  r  record;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into v from v_club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('hay', false, 'porque', 'No encontré ese socio.');
  end if;
  select * into c from club_clientes where id = v.id;
  select * into r from club_ritmo(v.id);

  return jsonb_build_object(
    'hay', true,
    'codigo', v.codigo,
    'nombre', v.nombre,
    'nombres', coalesce(c.nombres, split_part(trim(v.nombre), ' ', 1)),
    'telefono', v.telefono,
    'desde', v.creado,
    'local', v.local_alta,
    'nivel', v.nivel,
    'puntos', v.puntos,
    'compras', v.compras,
    'gastado', v.gastado,
    'ultima_compra', v.ultima_compra,
    'dias_sin', r.dias_sin,
    'dias_compra', coalesce(r.dias_compra, 0),
    'frecuencia', r.frecuencia,
    'atraso', r.atraso,
    'a_recuperar', coalesce(r.a_recuperar, false),
    'acepta_promos', coalesce(v.acepta_promos, false),
    'con_avisos', exists (select 1 from club_suscripciones s where s.cliente = v.id and s.muerto is null),
    'avisado', (select max(p.creado) from club_avisos_personales p where p.cliente = v.id and p.motivo = 'recuperar'),
    /* El premio más grande que ya le alcanza: es el mejor motivo para
       volver que se le puede dar. */
    'premio', (select jsonb_build_object('nombre', p.nombre, 'puntos', p.puntos)
                 from club_premios p
                where p.activo and p.puntos > 0 and p.puntos <= v.puntos
                order by p.puntos desc limit 1),
    'contactos', coalesce((select jsonb_agg(jsonb_build_object('via', k.via, 'quien', k.quien, 'cuando', k.creado)
                                            order by k.creado desc, k.id desc)
                             from (select * from club_contactos where cliente = v.id order by creado desc, id desc limit 5) k),
                          '[]'::jsonb),
    'ultimas', coalesce((select jsonb_agg(jsonb_build_object('cuando', m.creado, 'local', m.local,
                                                             'importe', m.importe, 'puntos', m.puntos)
                                          order by m.creado desc)
                           from (select * from club_movimientos
                                  where cliente = v.id and tipo = 'compra' and anulado is null
                                  order by creado desc limit 6) m),
                        '[]'::jsonb));
end;
$sf$;

revoke all on function club_socio_ficha(text, text) from public;
grant execute on function club_socio_ficha(text, text) to anon, authenticated;


/* "Le escribí por WhatsApp". Se llama al tocar el botón. */
create or replace function club_contacto_anotar(p_pin text, p_codigo text, p_via text, p_quien text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ca$
declare
  cid bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_via not in ('whatsapp', 'aviso') then
    return jsonb_build_object('ok', false, 'porque', 'No sé qué es ' || coalesce(p_via, 'eso') || '.');
  end if;
  select id into cid from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if cid is null then
    return jsonb_build_object('ok', false, 'porque', 'No encontré ese socio.');
  end if;
  insert into club_contactos (cliente, via, quien)
  values (cid, p_via, nullif(trim(coalesce(p_quien, '')), ''));
  return jsonb_build_object('ok', true);
end;
$ca$;

revoke all on function club_contacto_anotar(text, text, text, text) from public;
grant execute on function club_contacto_anotar(text, text, text, text) to anon, authenticated;


/* Un aviso al celular de UN socio. Las mismas reglas que el aviso a
   todos: como mucho uno por mes a cada uno, contando los dos. */
create or replace function club_avisar_socio(
  p_pin text, p_codigo text, p_titulo text, p_cuerpo text,
  p_enlace text default null, p_quien text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $as$
declare
  tit text := nullif(trim(coalesce(p_titulo, '')), '');
  cue text := nullif(trim(coalesce(p_cuerpo, '')), '');
  enl text := nullif(trim(coalesce(p_enlace, '')), '');
  hoyclave text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
  cid bigint;
  ult timestamptz;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if tit is null or length(tit) > 60 then
    return jsonb_build_object('ok', false, 'porque', 'El título va de 1 a 60 letras.');
  end if;
  if cue is null or length(cue) > 160 then
    return jsonb_build_object('ok', false, 'porque', 'El mensaje va de 1 a 160 letras.');
  end if;
  if enl is not null and not club_foto_url_ok(enl) then
    return jsonb_build_object('ok', false, 'porque', 'El enlace tiene que empezar con https://.');
  end if;

  select id into cid from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if cid is null then
    return jsonb_build_object('ok', false, 'porque', 'No encontré ese socio.');
  end if;
  if not exists (select 1 from club_suscripciones s where s.cliente = cid and s.muerto is null) then
    return jsonb_build_object('ok', false, 'porque', 'No tiene los avisos prendidos en su celular.');
  end if;
  select max(creado) into ult from club_avisos_personales
   where cliente = cid and motivo = 'recuperar' and creado > now() - interval '30 days';
  if ult is not null then
    return jsonb_build_object('ok', false,
      'porque', 'Ya le mandamos uno el ' || to_char(ult at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') ||
                '. Como mucho uno por mes: si no, los apaga.');
  end if;

  insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
  values (cid, 'recuperar', hoyclave, tit, cue, enl, now())
  on conflict (cliente, motivo, clave) do nothing;
  insert into club_contactos (cliente, via, quien)
  values (cid, 'aviso', nullif(trim(coalesce(p_quien, '')), ''));

  return jsonb_build_object('ok', true);
end;
$as$;

revoke all on function club_avisar_socio(text, text, text, text, text, text) from public;
grant execute on function club_avisar_socio(text, text, text, text, text, text) to anon, authenticated;


select count(*) filter (where a_recuperar) as "Para recuperar hoy",
       count(*) filter (where frecuencia is not null) as "Con ritmo (3+ compras)"
  from club_ritmo();


-- ─────────────────────────── PARTE 33 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LA TARJETA DE INICIO: MISIONES, VENCIMIENTO, NIVELES Y CUPONES
--
-- Correr entero en el editor SQL de Supabase, después del 32.
--
-- Pedido de Mauricio (29/09/2026), sobre capturas de la app de King Of The
-- Kongo: el Inicio pasa a tener una tarjeta con los puntos y cuatro
-- accesos (Canjear, Movimientos, Mis cupones, Niveles), y abajo las
-- misiones de "Sumá más puntos". Acá está lo que la tarjeta necesita:
--
--   · MISIONES: cosas que dan puntos UNA sola vez. Completar el perfil
--     (mail y cumpleaños), activar los avisos, agregar la app a la
--     pantalla, la primera compra y —apagada de entrada— comprar un fin de
--     semana. Se cumplen solas: un disparador mira cada cambio. Los puntos
--     y cuáles están prendidas se cambian desde Configuración.
--     NO hay misión por dejar una reseña: Google prohíbe premiarlas.
--   · VENCIMIENTO: la fecha en que vencen sus puntos si no vuelve a
--     comprar (la misma cuenta que club_vencer).
--   · NIVELES: los tres, con lo que da cada uno.
--   · MIS CUPONES: los cupones de Beneficios dados a SU teléfono, y las
--     campañas que se marcaron "Mostrar en la app del Club".
--
-- A los socios que ya estaban se les dan las misiones que ya cumplieron.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1 · LAS MISIONES
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_misiones (
  clave  text primary key,
  titulo text not null,
  texto  text not null,
  puntos integer not null check (puntos > 0 and puntos <= 5000),
  activa boolean not null default true,
  orden  integer not null default 0,
  /* Qué hace el botón en la app: abrir Mis datos, la campanita, cómo
     instalar, o nada (las de comprar se cumplen en la caja). */
  accion text not null check (accion in ('datos', 'avisos', 'instalar', 'comprar'))
);
alter table club_misiones enable row level security;
revoke all on club_misiones from anon, authenticated;

/* Las de entrada. "on conflict do nothing": si Mauricio ya les cambió los
   puntos, correr esto otra vez no se los pisa. */
insert into club_misiones (clave, titulo, texto, puntos, activa, orden, accion) values
  ('perfil',         'Completá tu perfil',          'Cargá tu mail y tu cumpleaños en Mis datos.',                              250, true,  1, 'datos'),
  ('avisos',         'Activá los avisos',           'Enterate antes que nadie de las promos y de tus puntos.',                  200, true,  2, 'avisos'),
  ('instalar',       'Agregá la app a tu pantalla', 'Tené tu tarjeta a un toque, como cualquier app.',                          150, true,  3, 'instalar'),
  ('primera_compra', 'Hacé tu primera compra',      'Mostrá tu tarjeta en la caja de cualquier local, o comprá en vdh.com.ar.', 300, true,  4, 'comprar'),
  ('finde',          'Comprá un fin de semana',     'Una compra un sábado o un domingo, en cualquier local.',                   200, false, 5, 'comprar')
on conflict (clave) do nothing;

/* Cada misión se paga una vez por socio: el índice lo garantiza aunque dos
   cosas la cumplan en el mismo instante. */
create unique index if not exists club_mision_una_vez
  on club_movimientos (cliente, concepto)
  where concepto like 'mision:%' and anulado is null;


/* Dar una misión, si está prendida y no la tiene. Devuelve si la dio. */
create or replace function club_mision_dar(p_cliente bigint, p_clave text)
returns boolean
language plpgsql
security definer
set search_path = public
as $md$
declare
  m club_misiones%rowtype;
  n integer;
begin
  select * into m from club_misiones where clave = p_clave and activa;
  if not found then return false; end if;
  insert into club_movimientos (cliente, tipo, concepto, puntos, obs)
  values (p_cliente, 'ajuste', 'mision:' || m.clave, m.puntos, 'Misión cumplida: ' || m.titulo)
  on conflict (cliente, concepto) where concepto like 'mision:%' and anulado is null do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$md$;

/* Mirar qué misiones cumple un socio y darle las que falten. La de
   instalar no se puede mirar desde acá: la avisa la app. */
create or replace function club_misiones_revisar(p_cliente bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $mr$
declare
  c club_clientes%rowtype;
  n integer := 0;
begin
  select * into c from club_clientes where id = p_cliente and baja is null;
  if not found then return 0; end if;

  if nullif(trim(coalesce(c.mail, '')), '') is not null and c.cumple is not null then
    if club_mision_dar(c.id, 'perfil') then n := n + 1; end if;
  end if;
  if exists (select 1 from club_suscripciones s where s.cliente = c.id and s.muerto is null) then
    if club_mision_dar(c.id, 'avisos') then n := n + 1; end if;
  end if;
  if exists (select 1 from club_movimientos m where m.cliente = c.id and m.tipo = 'compra' and m.anulado is null) then
    if club_mision_dar(c.id, 'primera_compra') then n := n + 1; end if;
  end if;
  if exists (select 1 from club_movimientos m where m.cliente = c.id and m.tipo = 'compra' and m.anulado is null
                and extract(isodow from (m.creado at time zone 'America/Argentina/Buenos_Aires')) in (6, 7)) then
    if club_mision_dar(c.id, 'finde') then n := n + 1; end if;
  end if;
  return n;
end;
$mr$;

revoke all on function club_mision_dar(bigint, text) from public, anon, authenticated;
revoke all on function club_misiones_revisar(bigint) from public, anon, authenticated;


-- ── Los disparadores: las misiones se cumplen solas ──
create or replace function club_misiones_tg_cliente()
returns trigger language plpgsql security definer set search_path = public as $t1$
begin
  perform club_misiones_revisar(new.id);
  return null;
end;
$t1$;

create or replace function club_misiones_tg_suscripcion()
returns trigger language plpgsql security definer set search_path = public as $t2$
begin
  if new.cliente is not null and new.muerto is null then
    perform club_misiones_revisar(new.cliente);
  end if;
  return null;
end;
$t2$;

create or replace function club_misiones_tg_compra()
returns trigger language plpgsql security definer set search_path = public as $t3$
begin
  /* Sólo las compras: la misión misma es un "ajuste", y así no se llama
     a sí misma. */
  if new.tipo = 'compra' and new.anulado is null then
    perform club_misiones_revisar(new.cliente);
  end if;
  return null;
end;
$t3$;

drop trigger if exists club_misiones_tg on club_clientes;
create trigger club_misiones_tg after insert or update of mail, cumple on club_clientes
  for each row execute function club_misiones_tg_cliente();
drop trigger if exists club_misiones_tg on club_suscripciones;
create trigger club_misiones_tg after insert or update of cliente, muerto on club_suscripciones
  for each row execute function club_misiones_tg_suscripcion();
drop trigger if exists club_misiones_tg on club_movimientos;
create trigger club_misiones_tg after insert on club_movimientos
  for each row execute function club_misiones_tg_compra();


/* "La agregué a la pantalla": la app lo avisa cuando se abre instalada.
   Con el código de la tarjeta, como todo lo del socio. */
create or replace function club_mision_instalada(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mi$
declare
  cid bigint;
  dio boolean;
begin
  select id into cid from club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if cid is null then return jsonb_build_object('ok', false); end if;
  dio := club_mision_dar(cid, 'instalar');
  return jsonb_build_object('ok', true, 'dio', dio,
    'puntos', case when dio then (select puntos from club_misiones where clave = 'instalar') end);
end;
$mi$;

revoke all on function club_mision_instalada(text) from public;
grant execute on function club_mision_instalada(text) to anon, authenticated;


/* Las misiones de un socio, para la tarjeta: las prendidas, en orden, con
   si ya la cumplió. */
create or replace function club_misiones_de(p_cliente bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $mdd$
  select coalesce(jsonb_agg(jsonb_build_object(
           'clave', m.clave, 'titulo', m.titulo, 'texto', m.texto, 'puntos', m.puntos, 'accion', m.accion,
           'hecha', exists (select 1 from club_movimientos x
                             where x.cliente = p_cliente and x.concepto = 'mision:' || m.clave and x.anulado is null))
         order by m.orden, m.clave), '[]'::jsonb)
    from club_misiones m
   where m.activa
$mdd$;

revoke all on function club_misiones_de(bigint) from public, anon, authenticated;


-- ── Configuración: los puntos y cuáles están prendidas ──
create or replace function club_misiones_listar(p_pin text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $ml$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
            'clave', m.clave, 'titulo', m.titulo, 'texto', m.texto, 'puntos', m.puntos,
            'activa', m.activa, 'accion', m.accion,
            'cumplidas', (select count(*) from club_movimientos x where x.concepto = 'mision:' || m.clave and x.anulado is null))
          order by m.orden, m.clave) from club_misiones m), '[]'::jsonb);
end;
$ml$;

create or replace function club_mision_guardar(p_pin text, p_clave text, p_puntos integer, p_activa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mg$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_puntos is null or p_puntos < 1 or p_puntos > 5000 then
    return jsonb_build_object('ok', false, 'porque', 'Los puntos van de 1 a 5.000.');
  end if;
  update club_misiones set puntos = p_puntos, activa = coalesce(p_activa, activa) where clave = p_clave;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No existe esa misión.'); end if;
  /* Una misión que se prende ahora se les da a los que ya la cumplían. */
  if coalesce(p_activa, false) then
    perform club_misiones_revisar(id) from club_clientes where baja is null;
  end if;
  return jsonb_build_object('ok', true);
end;
$mg$;

revoke all on function club_misiones_listar(text) from public;
revoke all on function club_mision_guardar(text, text, integer, boolean) from public;
grant execute on function club_misiones_listar(text) to anon, authenticated;
grant execute on function club_mision_guardar(text, text, integer, boolean) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 2 · MIS CUPONES
-- ══════════════════════════════════════════════════════════════════════════

/* Una campaña se muestra en la app sólo si se marcó. Una campaña para un
   grupo (los de un evento, los de un local) no tiene por qué verla todo el
   Club. */
alter table beneficios add column if not exists en_app boolean not null default false;

create or replace view v_beneficios as
  select b.id, b.tipo, b.creado, b.registro, b.telefono, b.nombre, b.serie, b.pct, b.valor, b.cobrado, b.pago,
         b.vence, b.local, b.vendedor, b.usado, b.local_canje, b.vendedor_canje, b.monto_compra, b.anulado,
         b.anulado_por, b.motivo_anul, b.obs, b.codigo, b.creado_por, b.compra_minima, b.locales, b.acumulable,
         b.externo_id, b.canal_canje, b.creado_por_nombre,
         estado_de(b.*) as estado,
         case when b.vence is null then null::integer
              else b.vence - (now() at time zone 'America/Argentina/Buenos_Aires')::date end as dias,
         b.multiuso, b.usos_max, b.por_cliente, b.desde, b.tope,
         case when b.multiuso
              then (select count(*)::integer from beneficio_usos u where u.beneficio = b.id and u.anulado is null)
              else (case when b.usado is null then 0 else 1 end) end as usos,
         b.en_app
    from beneficios b;

/* Los cupones de un socio: los que le dieron a SU teléfono (comparado por
   los últimos 10 números) y las campañas marcadas para la app que todavía
   puede usar. */
create or replace function club_cupones_de(p_cliente bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $cu$
  with s as (
    select right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 10) as tel
      from club_clientes where id = p_cliente
  ),
  suyos as (
    select b.*, 'personal'::text as clase
      from v_beneficios b, s
     where b.tipo = 'descuento' and not b.multiuso and b.estado = 'disponible'
       and length(s.tel) = 10
       and right(regexp_replace(coalesce(b.telefono, ''), '[^0-9]', '', 'g'), 10) = s.tel
  ),
  campanas as (
    select b.*, 'campana'::text as clase
      from v_beneficios b, s
     where b.multiuso and b.en_app and b.estado = 'disponible'
       and (b.por_cliente is null
            or (select count(*) from beneficio_usos u
                 where u.beneficio = b.id and u.anulado is null and u.telefono = s.tel) < b.por_cliente)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', x.codigo, 'pct', x.pct, 'vence', x.vence, 'dias', x.dias, 'desde', x.desde,
           'compra_minima', x.compra_minima, 'tope', x.tope, 'locales', x.locales, 'acumulable', x.acumulable,
           'por_cliente', x.por_cliente, 'clase', x.clase)
         order by x.clase desc, x.vence nulls last), '[]'::jsonb)
    from (select * from suyos union all select * from campanas) x
$cu$;

revoke all on function club_cupones_de(bigint) from public, anon, authenticated;


/* Crear cupón: la campaña suma "mostrar en la app". La de 18 argumentos
   se va (con las dos, PostgREST no sabría cuál llamar). */
drop function if exists crear_cupon(text, text, smallint, integer, bigint, text, text, numeric, text[], boolean, text,
                                    boolean, text, integer, integer, date, date, numeric);

create or replace function crear_cupon(p_pin text, p_quien text, p_pct smallint, p_dias integer DEFAULT 30, p_registro bigint DEFAULT NULL::bigint, p_telefono text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text, p_compra_minima numeric DEFAULT NULL::numeric, p_locales text[] DEFAULT NULL::text[], p_acumulable boolean DEFAULT false, p_obs text DEFAULT NULL::text, p_campana boolean DEFAULT false, p_codigo text DEFAULT NULL::text, p_usos_max integer DEFAULT NULL::integer, p_por_cliente integer DEFAULT NULL::integer, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date, p_tope numeric DEFAULT NULL::numeric, p_en_app boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz      constant text := 'America/Argentina/Buenos_Aires';
  hoy     date := (now() at time zone tz)::date;
  r       registros%rowtype;
  llave   jsonb;
  tel     text;
  nom     text;
  quien   text;
  cod     text;
  nid     bigint;
  sueltos text[];
  hasta   date;
  camp    boolean := coalesce(p_campana, false);
begin
  llave := pin_ok(p_pin);
  if not (llave->>'ok')::boolean then
    return jsonb_build_object('creado', false, 'porque', llave->>'porque',
                              'espera', llave->'espera', 'pin', true);
  end if;

  quien := nullif(trim(coalesce(p_quien, '')), '');
  if quien is null then raise exception 'Falta quién está creando el cupón.'; end if;
  if p_pct is null or p_pct < 1 or p_pct > 100 then raise exception 'El descuento tiene que estar entre 1 y 100.'; end if;
  if p_compra_minima is not null and p_compra_minima <= 0 then raise exception 'La compra mínima tiene que ser mayor que cero.'; end if;
  if p_tope is not null and p_tope <= 0 then raise exception 'El tope de descuento tiene que ser mayor que cero.'; end if;

  /* Hasta cuándo: una fecha, o los días de siempre. */
  if p_hasta is not null then
    hasta := p_hasta;
  else
    if coalesce(p_dias, 0) < 1 then raise exception 'El cupón tiene que durar al menos un día.'; end if;
    hasta := hoy + coalesce(p_dias, 30);
  end if;
  if hasta < hoy then raise exception 'La fecha de fin ya pasó.'; end if;
  if p_desde is not null and p_desde > hasta then raise exception 'Empieza después de terminar: revisá las fechas.'; end if;

  if p_locales is not null then
    if array_length(p_locales, 1) is null then
      raise exception 'La lista de locales está vacía. Para todos, dejala sin poner.';
    end if;
    select array_agg(x) into sueltos
      from unnest(p_locales) as x
     where upper(trim(x)) not in (select upper(codigo) from locales where activo);
    if sueltos is not null then
      raise exception 'Estos locales no existen o están inactivos: %.', array_to_string(sueltos, ', ');
    end if;
  end if;

  -- ── La campaña ──
  if camp then
    cod := upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g'));
    if cod = '' then raise exception 'Falta el código del cupón.'; end if;
    if cod !~ '^[A-Z0-9-]{4,20}$' then
      raise exception 'El código va de 4 a 20 letras o números, sin espacios ni acentos.';
    end if;
    /* Con al menos una letra: un código de puros números se confundiría
       con el número de una Gift Card o con un teléfono al buscarlo. */
    if cod !~ '[A-Z]' then raise exception 'El código necesita al menos una letra.'; end if;
    if exists (select 1 from beneficios
                where upper(regexp_replace(coalesce(codigo, ''), '[^A-Za-z0-9]', '', 'g'))
                    = regexp_replace(cod, '[^A-Z0-9]', '', 'g')) then
      raise exception 'Ya hay un cupón con el código %. Elegí otro nombre.', cod;
    end if;
    if p_usos_max is not null and p_usos_max < 1 then raise exception 'El límite de usos tiene que ser 1 o más.'; end if;
    if p_por_cliente is not null and p_por_cliente < 1 then raise exception 'Los usos por cliente tienen que ser 1 o más.'; end if;

    insert into beneficios (
      tipo, pct, codigo, vence, desde, compra_minima, locales, acumulable, tope,
      multiuso, usos_max, por_cliente, creado_por, creado_por_nombre, obs, en_app
    ) values (
      'descuento', p_pct, cod, hasta, p_desde, p_compra_minima, p_locales, coalesce(p_acumulable, false), p_tope,
      true, p_usos_max, p_por_cliente, auth.uid(), quien, nullif(trim(coalesce(p_obs, '')), ''), coalesce(p_en_app, false)
    )
    returning id into nid;

    return jsonb_build_object('creado', true, 'id', nid, 'codigo', cod, 'pct', p_pct, 'campana', true);
  end if;

  -- ── El de una persona, como siempre ──
  tel := nullif(trim(coalesce(p_telefono, '')), '');
  nom := nullif(trim(coalesce(p_nombre, '')), '');
  if p_registro is not null then
    select * into r from registros where id = p_registro;
    if not found then raise exception 'No existe el registro %.', p_registro; end if;
    tel := r.whatsapp;
    nom := coalesce(nom, r.nombre);
  end if;
  if tel is not null then
    select id into nid from v_beneficios
     where tipo = 'descuento' and estado = 'disponible'
       and regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g') = regexp_replace(tel, '[^0-9]', '', 'g')
     limit 1;
    if nid is not null then
      return jsonb_build_object('creado', false, 'porque', 'ese cliente ya tiene un beneficio sin usar', 'id', nid);
    end if;
  end if;

  cod := generar_codigo();
  insert into beneficios (
    tipo, registro, telefono, nombre, pct, codigo, vence, desde,
    compra_minima, locales, acumulable, tope, creado_por, creado_por_nombre, obs
  ) values (
    'descuento', p_registro, tel, nom, p_pct, cod, hasta, p_desde,
    p_compra_minima, p_locales, coalesce(p_acumulable, false), p_tope, auth.uid(), quien, p_obs
  )
  returning id into nid;

  return jsonb_build_object('creado', true, 'id', nid, 'codigo', cod, 'pct', p_pct);
end;
$function$;

grant execute on function crear_cupon(text, text, smallint, integer, bigint, text, text, numeric, text[], boolean, text,
                                      boolean, text, integer, integer, date, date, numeric, boolean) to anon, authenticated;

/* Prender o apagar una campaña en la app, desde la lista de Beneficios. */
create or replace function beneficio_en_app(p_pin text, p_id bigint, p_en_app boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ea$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  update beneficios set en_app = coalesce(p_en_app, false) where id = p_id and multiuso;
  if not found then return jsonb_build_object('ok', false, 'porque', 'Sólo las campañas se muestran en la app.'); end if;
  return jsonb_build_object('ok', true, 'en_app', coalesce(p_en_app, false));
end;
$ea$;

revoke all on function beneficio_en_app(text, bigint, boolean) from public;
grant execute on function beneficio_en_app(text, bigint, boolean) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 3 · LA TARJETA, CON TODO ESO
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'hoy', club_factor(c.id),
        'cumple', club_regalo_cumple(c.id),
        /* La última compra de los últimos 7 días en un local con enlace de
           reseñas: la tarjeta muestra "¿Qué tal tu compra en Flores?". */
        'resena', (select jsonb_build_object(
                      'local', l.codigo,
                      'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                      'url', l.resena_url,
                      'cuando', m.creado)
                     from club_movimientos m
                     join locales l on upper(trim(l.codigo)) = upper(trim(m.local))
                    where m.cliente = c.id and m.tipo = 'compra' and m.anulado is null
                      and m.creado > now() - interval '7 days'
                      and l.resena_url is not null
                    order by m.creado desc limit 1),

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          /* Lo que da este nivel y lo que da el siguiente, para que la
             tarjeta pueda decirlo: si el cliente no sabe qué le da Oro,
             Oro no es algo que quiera. */
          'regalo_cumple', (select case when g.tipo = 'descuento'
                                        then g.porcentaje || '% de descuento en tu compra'
                                        else g.producto end
                              from club_regalos_cumple g where g.nivel = c.nivel),
          'sigue_multiplica', (select nv.multiplica from club_niveles nv
                                where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue_bono', (select nv.bono from club_niveles nv
                          where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor, 'imagen', p.imagen,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        /* La novedad de Inicio, si está prendida. */
        'novedad', (select jsonb_build_object('bajada', n.bajada, 'titulo', n.titulo,
                                              'imagen', n.imagen, 'enlace', n.enlace)
                      from club_novedad n where n.id = 1 and n.activa),

        /* Los locales que tienen enlace de reseñas, para elegir en Inicio. */
        'resenas_locales', coalesce((
          select jsonb_agg(jsonb_build_object('local', l.codigo, 'url', l.resena_url) order by l.codigo)
            from locales l
           where l.resena_url is not null and club_resena_url_ok(l.resena_url)), '[]'::jsonb),

        /* ── La tarjeta de Inicio (SQL 33) ── */
        /* Cuándo vencen sus puntos si no vuelve a comprar: la misma cuenta
           que club_vencer (12 meses desde la última compra, o desde el alta
           si nunca compró). Sin puntos, no hay nada que venza. */
        'vence_puntos', (select case when c.puntos > 0 and nullif(r.valor, '')::integer > 0
                                     then ((coalesce(c.ultima_compra, c.creado) + (r.valor || ' months')::interval)
                                           at time zone 'America/Argentina/Buenos_Aires')::date end
                           from club_reglas r where r.clave = 'vence_meses'),
        /* Los tres niveles, para la pantalla de Niveles. */
        'niveles', (select jsonb_agg(jsonb_build_object(
                             'nombre', nv.nombre, 'desde_xp', nv.desde_xp, 'multiplica', nv.multiplica, 'bono', nv.bono,
                             'regalo_cumple', (select case when g.tipo = 'descuento'
                                                           then g.porcentaje || '% de descuento en tu compra'
                                                           else g.producto end
                                                 from club_regalos_cumple g where g.nivel = nv.nombre))
                           order by nv.desde_xp)
                      from club_niveles nv),
        'misiones', club_misiones_de(c.id),
        'cupones', club_cupones_de(c.id),

        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   order by creado desc limit 8) m), '[]'::jsonb)
      ) from c
    ) end
$function$;


-- Los socios que ya estaban: las misiones que ya cumplieron.
select coalesce(sum(club_misiones_revisar(id)), 0) as "Misiones dadas a los que ya estaban"
  from club_clientes where baja is null;


-- ─────────────────────────── PARTE 34 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LA HISTORIA DE MOVIMIENTOS EN LA TARJETA
--
-- Correr en el editor SQL de Supabase, después del 33.
--
-- Pedido de Mauricio (29/09/2026), como la app de King Of The Kongo:
-- "Movimientos" abre una pantalla con tres solapas —Misiones, Movimientos y
-- Canjes—. Para que Movimientos y Canjes muestren la historia, la tarjeta
-- trae los últimos 60 movimientos en vez de 8. Nada más cambia.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'puntos', c.puntos,
        'xp', c.xp,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,

        'hoy', club_factor(c.id),
        'cumple', club_regalo_cumple(c.id),
        /* La última compra de los últimos 7 días en un local con enlace de
           reseñas: la tarjeta muestra "¿Qué tal tu compra en Flores?". */
        'resena', (select jsonb_build_object(
                      'local', l.codigo,
                      'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                      'url', l.resena_url,
                      'cuando', m.creado)
                     from club_movimientos m
                     join locales l on upper(trim(l.codigo)) = upper(trim(m.local))
                    where m.cliente = c.id and m.tipo = 'compra' and m.anulado is null
                      and m.creado > now() - interval '7 days'
                      and l.resena_url is not null
                    order by m.creado desc limit 1),

        'nivel', jsonb_build_object(
          'nombre', c.nivel,
          'multiplica', c.multiplica,
          /* Lo que da este nivel y lo que da el siguiente, para que la
             tarjeta pueda decirlo: si el cliente no sabe qué le da Oro,
             Oro no es algo que quiera. */
          'regalo_cumple', (select case when g.tipo = 'descuento'
                                        then g.porcentaje || '% de descuento en tu compra'
                                        else g.producto end
                              from club_regalos_cumple g where g.nivel = c.nivel),
          'sigue_multiplica', (select nv.multiplica from club_niveles nv
                                where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue_bono', (select nv.bono from club_niveles nv
                          where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'sigue', (select nv.nombre from club_niveles nv
                     where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'falta_xp', (select nv.desde_xp - c.xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1),
          'desde_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp <= c.xp order by nv.desde_xp desc limit 1),
          'hasta_xp', (select nv.desde_xp from club_niveles nv
                        where nv.desde_xp > c.xp order by nv.desde_xp limit 1)),

        'premios', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'nombre', p.nombre, 'detalle', p.detalle,
                   'puntos', p.puntos, 'valor', p.valor, 'imagen', p.imagen,
                   'agotado', u.agotado,
                   'alcanzado', c.puntos >= p.puntos and not u.agotado,
                   'falta', greatest(p.puntos - c.puntos, 0))
                 order by p.orden, p.puntos)
            from club_premios p
            cross join lateral (
              select (p.limite_anual is not null and count(*) >= p.limite_anual) as agotado
                from club_movimientos m
               where m.cliente = c.id and m.tipo = 'canje' and m.premio = p.id
                 and m.anulado is null and m.creado > now() - interval '12 months'
            ) u
           where p.activo), '[]'::jsonb),

        /* La novedad de Inicio, si está prendida. */
        'novedad', (select jsonb_build_object('bajada', n.bajada, 'titulo', n.titulo,
                                              'imagen', n.imagen, 'enlace', n.enlace)
                      from club_novedad n where n.id = 1 and n.activa),

        /* Los locales que tienen enlace de reseñas, para elegir en Inicio. */
        'resenas_locales', coalesce((
          select jsonb_agg(jsonb_build_object('local', l.codigo, 'url', l.resena_url) order by l.codigo)
            from locales l
           where l.resena_url is not null and club_resena_url_ok(l.resena_url)), '[]'::jsonb),

        /* ── La tarjeta de Inicio (SQL 33) ── */
        /* Cuándo vencen sus puntos si no vuelve a comprar: la misma cuenta
           que club_vencer (12 meses desde la última compra, o desde el alta
           si nunca compró). Sin puntos, no hay nada que venza. */
        'vence_puntos', (select case when c.puntos > 0 and nullif(r.valor, '')::integer > 0
                                     then ((coalesce(c.ultima_compra, c.creado) + (r.valor || ' months')::interval)
                                           at time zone 'America/Argentina/Buenos_Aires')::date end
                           from club_reglas r where r.clave = 'vence_meses'),
        /* Los tres niveles, para la pantalla de Niveles. */
        'niveles', (select jsonb_agg(jsonb_build_object(
                             'nombre', nv.nombre, 'desde_xp', nv.desde_xp, 'multiplica', nv.multiplica, 'bono', nv.bono,
                             'regalo_cumple', (select case when g.tipo = 'descuento'
                                                           then g.porcentaje || '% de descuento en tu compra'
                                                           else g.producto end
                                                 from club_regalos_cumple g where g.nivel = nv.nombre))
                           order by nv.desde_xp)
                      from club_niveles nv),
        'misiones', club_misiones_de(c.id),
        'cupones', club_cupones_de(c.id),

        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'cuando', m.creado, 'local', m.local, 'puntos', m.puntos,
                   'tipo', m.tipo, 'concepto', m.concepto, 'obs', m.obs)
                 order by m.creado desc)
            from (select creado, local, puntos, tipo, concepto, obs
                    from club_movimientos
                   where cliente = c.id and anulado is null
                   /* 60 y no 8 (SQL 34): la pantalla de Movimientos, con sus
                      solapas de Movimientos y Canjes, muestra la historia y
                      no sólo lo último. */
                   order by creado desc limit 60) m), '[]'::jsonb)
      ) from c
    ) end
$function$;

select 'Listo: la tarjeta trae hasta 60 movimientos.' as "SQL 34";


-- ─────────────────────────── PARTE 35 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LA CUENTA REGRESIVA
--
-- Correr entero en el editor SQL de Supabase, después del 34.
--
-- Pedido de Mauricio (29/09/2026), sobre capturas de Tienda de Puntos:
-- "Activo ahora · Termina en 02:28:58".
--
--   · PUNTOS EXTRA: la tarjeta y la lista de Promos saben el momento exacto
--     en que termina el que vale ahora. Una hora feliz termina hoy a su
--     hora; uno de ciertos días, a la medianoche del último día seguido; y
--     el resto, cuando vence.
--   · PROMOCIONES: un casillero nuevo en Configuración, "Mostrar cuenta
--     regresiva". Prendido, la promo lleva "Termina en…" hasta la
--     medianoche de su último día.
--
-- Y un arreglo: la lista de promos de Configuración no traía el enlace, así
-- que editar una promo que lo tenía lo borraba al guardar.
-- ══════════════════════════════════════════════════════════════════════════

alter table club_promos add column if not exists cuenta_regresiva boolean not null default false;


/* Cuándo termina la ventana de puntos extra que vale en el momento t. Nulo
   si en t no vale. */
create or replace function club_multi_termina(m club_multiplicadores, t timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $mt$
declare
  dia date;
  fin timestamptz;
begin
  if not club_multi_vale(m, t) then return null; end if;
  dia := (t at time zone 'America/Argentina/Buenos_Aires')::date;

  if m.hora_hasta is not null then
    /* Una hora feliz: hoy, a su hora (hora_hasta > hora_desde, nunca cruza
       la medianoche). */
    fin := (dia + m.hora_hasta) at time zone 'America/Argentina/Buenos_Aires';
  elsif m.dias is not null and cardinality(m.dias) < 7 then
    /* Ciertos días: sigue mientras los días que vienen también estén
       elegidos (un viernes-sábado-domingo termina el domingo a la noche). */
    while extract(dow from dia + 1)::smallint = any(m.dias) and dia - (t at time zone 'America/Argentina/Buenos_Aires')::date < 7 loop
      dia := dia + 1;
    end loop;
    fin := (dia + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
  else
    fin := m.hasta;
  end if;

  return least(fin, m.hasta);
end;
$mt$;

revoke all on function club_multi_termina(club_multiplicadores, timestamptz) from public, anon, authenticated;


create or replace function club_factor_en(p_cliente bigint, p_t timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hoy       date := (p_t at time zone 'America/Argentina/Buenos_Aires')::date;
  c         record;
  cm        numeric;
  antes     integer;
  fin       date;
  pr        record;
  extra     numeric := 1;
  motivo    text;
  hasta     date;
  hora_fin  time;
  de_cumple boolean := false;
  termina   timestamptz;
begin
  select v.multiplica, v.cumple into c from v_club_clientes v where v.id = p_cliente;
  select nullif(valor, '')::numeric into cm    from club_reglas where clave = 'cumple_multiplica';
  select nullif(valor, '')::integer into antes from club_reglas where clave = 'cumple_antes';

  if c.cumple is not null and coalesce(cm, 1) > 1 then
    fin := club_cumple_fin(c.cumple, hoy, coalesce(antes, 7));
    if fin is not null then
      extra := cm; motivo := 'Tu semana de cumple'; hasta := fin; de_cumple := true;
      termina := ((fin + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires');
    end if;
  end if;

  select m.nombre, m.factor, m.hora_hasta, club_multi_termina(m, p_t) as termina,
         (m.hasta at time zone 'America/Argentina/Buenos_Aires')::date - 1 as ultimo
    into pr
    from club_multiplicadores m
   where club_multi_vale(m, p_t)
   order by m.factor desc, m.hasta desc
   limit 1;

  if pr.factor is not null and pr.factor > extra then
    extra := pr.factor; motivo := pr.nombre; hasta := pr.ultimo; de_cumple := false;
    /* Una hora feliz termina hoy a esa hora, no el último día del rango:
       "hasta las 20 h" es lo que el cliente necesita saber. */
    hora_fin := pr.hora_hasta;
    termina := pr.termina;
  end if;

  return jsonb_build_object(
    'total',  round(coalesce(c.multiplica, 1) * extra, 2),
    'nivel',  coalesce(c.multiplica, 1),
    'extra',  extra,
    'motivo', motivo,
    'hasta',  hasta,
    'hora_hasta', case when hora_fin is null then null
                       when extract(minute from hora_fin) = 0 then to_char(hora_fin, 'FMHH24')
                       else to_char(hora_fin, 'FMHH24:MI') end,
    'cumple', de_cumple,
    /* El momento exacto en que se termina (SQL 35), para la cuenta
       regresiva de la tarjeta. */
    'termina', termina,
    'es_cumple', c.cumple is not null
                 and club_cumple_en(c.cumple, extract(year from hoy)::int) = hoy);
end;
$function$;


create or replace function club_multi_publicos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', m.nombre, 'factor', m.factor,
           'cuando', club_multi_cuando(m),
           'ahora', club_multi_vale(m, now()),
           'termina', club_multi_termina(m, now()))
         order by club_multi_vale(m, now()) desc, m.desde), '[]'::jsonb)
    from club_multiplicadores m
   where m.baja is null and m.hasta > now() and m.desde < now() + interval '7 days'
$function$;


drop function if exists club_promos_ver();
create function club_promos_ver()
 RETURNS TABLE(id bigint, texto text, imagen text, condiciones text, desde date, hasta date, enlace text,
               cuenta boolean, termina timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.texto, p.imagen, p.condiciones, p.desde, p.hasta, p.enlace,
         p.cuenta_regresiva,
         /* A la medianoche de su último día, en hora de Argentina. */
         ((p.hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
    from club_promos p
   where p.baja is null
     and p.desde <= current_date
     and p.hasta >= current_date
   order by p.desde desc, p.id desc;
$function$;

grant execute on function club_promos_ver() to anon, authenticated;


create or replace function club_promos_listar(p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id, 'texto', texto, 'imagen', imagen,
             'desde', to_char(desde, 'YYYY-MM-DD'),
             'hasta', to_char(hasta, 'YYYY-MM-DD'),
             'condiciones', condiciones,
             /* El enlace faltaba: al editar una promo que lo tenía, el
                formulario lo mostraba vacío y guardar lo borraba. */
             'enlace', enlace,
             'cuenta', cuenta_regresiva,
             'vigente', (hasta >= current_date and (desde is null or desde <= current_date)),
             'futura',  (desde is not null and desde > current_date),
             'vencida', (hasta < current_date))
           order by hasta desc, id desc)
      from club_promos where baja is null), '[]'::jsonb);
end;
$function$;


/* La firma cambia (p_cuenta al final): la vieja se borra, o la API no sabe
   cuál de las dos llamar. */
drop function if exists club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text);

create or replace function club_promo_guardar(p_pin text, p_id bigint, p_texto text, p_imagen text, p_desde text, p_hasta text, p_condiciones text, p_avisar boolean DEFAULT false, p_enlace text DEFAULT NULL::text, p_cuenta boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  txt text;
  img text;
  con text;
  enl text;
  d1  date;
  d2  date;
  nid bigint;
  arranca date;
  cuantos integer := 0;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  txt := nullif(trim(coalesce(p_texto, '')), '');
  img := nullif(trim(coalesce(p_imagen, '')), '');
  con := nullif(trim(coalesce(p_condiciones, '')), '');
  enl := nullif(trim(coalesce(p_enlace, '')), '');

  if txt is null then raise exception 'Falta qué dice la promoción.'; end if;
  if length(txt) > 140 then
    raise exception 'El texto es muy largo. Máximo 140 caracteres.';
  end if;

  /* https y no http: una imagen por http en una página https la bloquea el
     navegador SIN DECIR NADA, y el cartel se vería vacío. */
  if img is not null and img !~* '^https://' then
    raise exception 'La foto tiene que ser un enlace que empiece con https.';
  end if;

  /* Lo mismo con el enlace, y por un motivo más: una notificación que lleva
     a un sitio sin candado le muestra al cliente un cartel de peligro con
     la marca al lado. */
  if enl is not null and enl !~* '^https://' then
    raise exception 'El enlace tiene que empezar con https.';
  end if;

  begin
    d1 := nullif(trim(coalesce(p_desde, '')), '')::date;
    d2 := nullif(trim(coalesce(p_hasta, '')), '')::date;
  exception when others then
    raise exception 'Esa fecha no se entiende. Va como 2026-09-30.';
  end;

  if d2 is null then
    raise exception 'Falta hasta qué día vale. Una promo sin vencimiento se queda para siempre.';
  end if;
  if d1 is not null and d1 > d2 then
    raise exception 'El desde no puede ser posterior al hasta.';
  end if;
  if d2 < current_date then
    raise exception 'Esa fecha ya pasó: la promoción no la vería nadie.';
  end if;

  if p_id is null then
    insert into club_promos (texto, imagen, desde, hasta, condiciones, enlace, cuenta_regresiva)
    values (txt, img, coalesce(d1, current_date), d2, con, enl, coalesce(p_cuenta, false))
    returning id, desde into nid, arranca;
  else
    update club_promos
       set texto = txt, imagen = img, desde = d1, hasta = d2,
           condiciones = con, enlace = enl,
           /* Sin el dato (una pantalla vieja cacheada) queda como estaba. */
           cuenta_regresiva = coalesce(p_cuenta, cuenta_regresiva)
     where id = p_id and baja is null
    returning id, desde into nid, arranca;
    if nid is null then
      return jsonb_build_object('ok', false, 'porque', 'Esa promoción ya no existe.');
    end if;
  end if;

  /* ── El aviso ──
     Hereda de la promo el texto, la foto y el enlace. Sin enlace propio
     lleva a las promos de la app, que es lo que hacía siempre. */
  if coalesce(p_avisar, false) then
    select count(*) into cuantos from club_suscripciones where muerto is null;

    if cuantos > 0 then
      insert into club_avisos (titulo, cuerpo, enlace, imagen, por, promo, sale)
      values (
        'Nueva promo',
        txt,
        coalesce(enl, 'tarjeta.html#promos'),
        img,
        'Promoción',
        nid,
        greatest(now(), coalesce(arranca, current_date)::timestamptz)
      );
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', nid,
    'avisados', case when coalesce(p_avisar, false) then cuantos else 0 end);
end;
$function$;

revoke all on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean) from public;
grant execute on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean) to anon, authenticated;


select 'Listo: la cuenta regresiva en los puntos extra y en las promos.' as "SQL 35";


-- ─────────────────────────── PARTE 36 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · CONFIGURACIÓN ORDENADA: LO QUE SE MIRA
--
-- Correr en el editor SQL de Supabase, después del 35.
--
-- Pedido de Mauricio (30/09/2026): Configuración > Club VDH pasa a ser un
-- menú, y cada parte abre su pantalla. Dos pantallas nuevas necesitan datos
-- que no tenían de dónde salir:
--
--   · PUNTOS Y NIVELES: las reglas (cuánto vale un punto, cuándo vencen, el
--     regalo de bienvenida…) y los tres niveles, con cuántos socios hay en
--     cada uno. Para mirar: no se cambian desde la pantalla.
--   · INTEGRACIONES: cómo va la tienda online (compras que sumaron puntos,
--     pedidos que no coincidieron con ningún socio, el último revisado).
--
-- Una sola función, que sólo lee y pide PIN. No cambia ninguna regla.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_config_resumen(p_pin text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $cr$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'reglas', (select coalesce(jsonb_object_agg(clave, valor), '{}'::jsonb)
                 from club_reglas
                where clave in ('pesos_por_punto', 'vence_meses', 'bienvenida_puntos', 'cumple_antes',
                                'tope_importe', 'exige_ticket', 'resena_cada_dias')),
    'niveles', (select coalesce(jsonb_agg(jsonb_build_object(
                         'nombre', n.nombre, 'desde_xp', n.desde_xp, 'multiplica', n.multiplica, 'bono', n.bono,
                         'socios', (select count(*) from v_club_clientes v where v.nivel = n.nombre and v.baja is null))
                       order by n.desde_xp), '[]'::jsonb)
                  from club_niveles n),
    'tienda', (select jsonb_build_object(
                        'pedidos',      count(*),
                        'sumados_30',   count(*) filter (where estado = 'sumado' and creado > now() - interval '30 days'),
                        'puntos_30',    coalesce(sum(puntos) filter (where estado = 'sumado' and creado > now() - interval '30 days'), 0),
                        'sin_socio_30', count(*) filter (where estado in ('sin_socio', 'varios_socios') and creado > now() - interval '30 days'),
                        'ultimo',       max(creado))
                 from club_tienda_pedidos));
end;
$cr$;

revoke all on function club_config_resumen(text) from public;
grant execute on function club_config_resumen(text) to anon, authenticated;


select 'Listo: Configuración ya puede mostrar las reglas, los niveles y la tienda online.' as "SQL 36";


-- ─────────────────────────── PARTE 37 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · EL TIPO DE CLIENTE Y LA LISTA DE TODOS LOS SOCIOS
--
-- Correr en el editor SQL de Supabase, después del 36.
--
-- Pedido de Mauricio (29/09/2026), sobre Tienda de Puntos: que cada socio
-- tenga un tipo que se calcule solo, y verlo en Estadísticas y en Socios.
--
--   · NUEVO: se anotó hace menos de 30 días.
--   · DORMIDO: dejó de venir. Es la regla de "Para recuperar" (el doble de
--     su ritmo, o 60 días si compró pocas veces), más los que hace más de
--     un año que no compran.
--   · VIP: nivel Platino, o compró en 6 días distintos o más en el año.
--   · HABITUAL: compró en 3 a 5 días distintos en el año y sigue viniendo.
--   · OCASIONAL: compró una o dos veces en el año y sigue en fecha.
--   · SIN COMPRAS: se anotó hace más de 30 días y nunca compró.
--
-- Se cuentan días de compra y no tickets: dos tickets el mismo día son una
-- visita. Se prueba en ese orden y gana el primero: un Platino que dejó de
-- venir es Dormido, porque eso es lo que hay que hacer con él.
--
-- Trae además:
--   · club_socios_lista: todos los socios, con su tipo, filtro por tipo,
--     búsqueda, orden y páginas. Es la pastilla Socios.
--   · club_estadisticas: cuántos hay de cada tipo, y el código del socio en
--     "Los socios que más compraron" (para que tocar una fila abra la ficha).
--   · club_socio_ficha: el tipo del socio.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function club_tipos(p_cliente bigint default null)
returns table(cliente bigint, tipo text, dias_anio integer)
language sql
stable
security definer
set search_path = public
as $ct$
  with r as (select * from club_ritmo(p_cliente)),
  a as (
    select m.cliente,
           count(distinct (m.creado at time zone 'America/Argentina/Buenos_Aires')::date)::int as dias
      from club_movimientos m
     where m.tipo = 'compra' and m.anulado is null
       and m.creado > now() - interval '1 year'
       and (p_cliente is null or m.cliente = p_cliente)
     group by m.cliente
  )
  select v.id,
         case
           when v.creado > now() - interval '30 days'          then 'nuevo'
           when r.cliente is null                              then 'sin_compras'
           when r.a_recuperar or r.dias_sin > 365              then 'dormido'
           when v.nivel = 'Platino' or coalesce(a.dias, 0) >= 6 then 'vip'
           when coalesce(a.dias, 0) >= 3                       then 'habitual'
           else 'ocasional'
         end,
         coalesce(a.dias, 0)
    from v_club_clientes v
    left join r on r.cliente = v.id
    left join a on a.cliente = v.id
   where v.baja is null
     and (p_cliente is null or v.id = p_cliente)
$ct$;

-- Sólo la usan las otras funciones: desde afuera no se llama.
revoke all on function club_tipos(bigint) from public, anon, authenticated;


create or replace function club_socios_lista(p_pin text, p_local text default null, p_tipo text default null,
                                             p_texto text default null, p_orden text default null,
                                             p_limite integer default 50, p_salto integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $sl$
declare
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  tip text := nullif(trim(coalesce(p_tipo, '')), '');
  ord text := coalesce(nullif(trim(coalesce(p_orden, '')), ''), 'ultima');
  txt text := lower(trim(coalesce(p_texto, '')));
  dig text := regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g');
  lim integer := least(greatest(coalesce(p_limite, 50), 0), 500);
  sal integer := greatest(coalesce(p_salto, 0), 0);
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  /* Con una letra se encuentra a medio Club: recién con dos. Y el % y el _
     se buscan como letras, no como comodines. */
  if length(txt) < 2 then txt := ''; end if;
  txt := replace(replace(replace(txt, '\', '\\'), '%', '\%'), '_', '\_');
  if length(dig) < 4 then dig := ''; end if;

  with
  todos as (
    select v.id, v.codigo, v.nombre, v.telefono, v.mail, v.nivel, v.local_alta, v.puntos, v.compras,
           v.gastado, v.ultima_compra, v.creado, t.tipo
      from v_club_clientes v
      join club_tipos() t on t.cliente = v.id
     where v.baja is null
       and club_est_local_ok(v.local_alta, loc)
  ),
  /* Por nombre, mail, teléfono o los últimos números de la tarjeta. */
  buscados as (
    select * from todos
     where txt = ''
        or lower(nombre) like '%' || txt || '%'
        or lower(coalesce(mail, '')) like '%' || txt || '%'
        or (dig <> '' and (regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g') like '%' || dig || '%'
                           or codigo like '%' || dig))
  ),
  elegidos as (
    select b.*, row_number() over (order by
             case when ord = 'gastado' then b.gastado end desc nulls last,
             case when ord = 'puntos'  then b.puntos  end desc nulls last,
             case when ord = 'alta'    then b.creado  end desc,
             case when ord = 'nombre'  then lower(b.nombre) end asc,
             b.ultima_compra desc nulls last, b.creado desc, b.id desc) as n
      from buscados b
     where tip is null or b.tipo = tip
  )
  select jsonb_build_object(
    'total', (select count(*) from elegidos),
    /* Cuántos hay de cada tipo en el local elegido, sin mirar la búsqueda:
       son los números de las pastillas. */
    'cuantos', (select jsonb_build_object(
                  'todos',       count(*),
                  'nuevo',       count(*) filter (where tipo = 'nuevo'),
                  'habitual',    count(*) filter (where tipo = 'habitual'),
                  'vip',         count(*) filter (where tipo = 'vip'),
                  'ocasional',   count(*) filter (where tipo = 'ocasional'),
                  'dormido',     count(*) filter (where tipo = 'dormido'),
                  'sin_compras', count(*) filter (where tipo = 'sin_compras'))
                  from todos),
    'lista', coalesce((select jsonb_agg(jsonb_build_object(
                         'codigo', e.codigo, 'nombre', e.nombre, 'nivel', e.nivel, 'tipo', e.tipo,
                         'local', e.local_alta, 'puntos', e.puntos, 'compras', e.compras,
                         'gastado', e.gastado, 'ultima', e.ultima_compra, 'desde', e.creado)
                       order by e.n)
                         from elegidos e
                        where e.n > sal and e.n <= sal + lim), '[]'::jsonb))
    into r;

  return r;
end;
$sl$;

revoke all on function club_socios_lista(text, text, text, text, text, integer, integer) from public;
grant execute on function club_socios_lista(text, text, text, text, text, integer, integer) to anon, authenticated;


-- Estadísticas: cuántos de cada tipo, y el código en el ranking.
CREATE OR REPLACE FUNCTION public.club_estadisticas(p_pin text, p_desde date, p_hasta date, p_local text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  d0  date := coalesce(p_desde, hoy - 29);
  d1  date := coalesce(p_hasta, hoy);
  aux date;
  dias integer;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  t0 timestamptz; t1 timestamptz; a0 timestamptz;
  escala text;
  costo_punto numeric;
  r jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  if d1 < d0 then aux := d0; d0 := d1; d1 := aux; end if;
  /* Tres años como mucho: más que eso no es un período, es la historia. */
  if d1 - d0 > 1100 then d0 := d1 - 1100; end if;
  dias := d1 - d0 + 1;
  t0 := d0::timestamp at time zone tz;
  t1 := (d1 + 1)::timestamp at time zone tz;
  a0 := (d0 - dias)::timestamp at time zone tz;      -- el período anterior, del mismo largo
  /* El gráfico por día: con más de tres meses serían puntos ilegibles. */
  escala := case when dias <= 92 then 'day' when dias <= 400 then 'week' else 'month' end;

  /* Cuánto cuesta un punto que se canjea, en promedio del catálogo activo:
     para pasar los puntos que los socios tienen guardados a plata. */
  select case when sum(puntos) > 0 then sum(costo) / sum(puntos) end
    into costo_punto
    from club_premios where activo and costo is not null and puntos > 0;

  with
  mov as (
    select m.*, (m.creado at time zone tz) as local_ts
      from club_movimientos m
     where m.anulado is null and m.creado >= t0 and m.creado < t1
       and club_est_local_ok(m.local, loc)
  ),
  compras as (select * from mov where tipo = 'compra'),
  /* Los socios que se miran en "hoy": todos, o los anotados en el local. */
  socios as (
    select v.*
      from v_club_clientes v
     where v.baja is null
       and club_est_local_ok(v.local_alta, loc)
  ),
  primera as (
    select cliente, min(creado) as cuando
      from club_movimientos where tipo = 'compra' and anulado is null
     group by cliente
  ),
  vivos as (
    select distinct cliente from club_suscripciones where muerto is null and cliente is not null
  ),
  /* Los que dejaron de venir, cada uno medido contra su propio ritmo.
     La regla está en club_ritmo (SQL 29), la misma que usa el aviso. */
  a_recuperar as (
    select s.*, r.frecuencia, r.dias_sin, r.atraso
      from socios s
      join club_ritmo() r on r.cliente = s.id
     where r.a_recuperar
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', d0, 'hasta', d1, 'dias', dias,
                                  'antes_desde', d0 - dias, 'antes_hasta', d0 - 1,
                                  'local', loc, 'escala', escala),
    'actual',   club_est_resumen(t0, t1, loc),
    'anterior', club_est_resumen(a0, t0, loc),

    /* Cada cuántos días vuelve a comprar un socio: para cada compra DEL
       período que no es la primera del socio, cuántos días pasaron desde la
       anterior (que puede ser de antes del período). El promedio. */
    'frecuencia_dias', (
      select round(avg(extract(epoch from g.gap) / 86400))
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),
    'frecuencia_casos', (
      select count(*)
        from (select creado, local, creado - lag(creado) over (partition by cliente order by creado) as gap
                from club_movimientos
               where tipo = 'compra' and anulado is null and creado < t1) g
       where g.gap is not null and g.creado >= t0 and club_est_local_ok(g.local, loc)),

    /* Quiénes compraron en el período y si "volvieron": ya habían comprado
       antes, o compraron más de una vez en el período. Es la lista detrás
       del número. */
    'volvieron_lista', (
      select coalesce(jsonb_agg(x order by (x->>'volvio')::boolean desc, x->>'nombre'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nombre', k.nombre,
                 'compras', count(*),
                 'primera', (select min(x.creado) from club_movimientos x
                              where x.cliente = c.cliente and x.tipo = 'compra' and x.anulado is null),
                 'volvio', count(*) > 1 or exists (select 1 from club_movimientos x
                                                    where x.cliente = c.cliente and x.tipo = 'compra'
                                                      and x.anulado is null and x.creado < t0)) as x
          from compras c join club_clientes k on k.id = c.cliente
         group by c.cliente, k.nombre
         limit 200) z),

    /* Hoy, no en el período: cuánto hace que compró cada socio. */
    'actividad', (
      select jsonb_build_object(
        'total', count(*),
        'ultimos_30', count(*) filter (where ultima_compra >= now() - interval '30 days'),
        'de_31_a_90', count(*) filter (where ultima_compra <  now() - interval '30 days'
                                         and ultima_compra >= now() - interval '90 days'),
        'mas_de_90',  count(*) filter (where ultima_compra <  now() - interval '90 days'),
        'nunca',      count(*) filter (where ultima_compra is null))
        from socios),

    /* Los que venían y dejaron: la última compra hace entre 60 días y un
       año. Más de un año ya es otro trabajo (y sus puntos vencieron). */
    'recuperar', (
      select jsonb_build_object(
        'total', count(*),
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        'con_avisos', count(*) filter (where exists (select 1 from vivos w where w.cliente = ar.id)),
        'avisados_30', count(*) filter (where exists (
                          select 1 from club_avisos_personales p
                           where p.cliente = ar.id and p.motivo = 'recuperar'
                             and p.creado > now() - interval '30 days')),
        'puntos', coalesce(sum(puntos), 0),
        /* Primero el más atrasado respecto de SU ritmo: el que venía cada
           18 días y lleva 42 antes que el que venía cada 90 y lleva 70. */
        'lista', coalesce((select jsonb_agg(z.x order by z.atraso desc, z.gastado desc nulls last) from (
                   select jsonb_build_object('codigo', q.codigo, 'nombre', q.nombre, 'nivel', q.nivel,
                            'local', q.local_alta, 'puntos', q.puntos, 'gastado', q.gastado,
                            'compras', q.compras, 'frecuencia', q.frecuencia, 'dias', q.dias_sin) as x,
                          q.atraso, q.gastado
                     from a_recuperar q
                    order by q.atraso desc, q.gastado desc nulls last limit 30) z), '[]'::jsonb))
        from a_recuperar ar),

    /* El tipo de cliente de cada socio, hoy (SQL 37). La misma cuenta que
       la lista de Socios, así los números nunca se contradicen. */
    'tipos', (
      select jsonb_build_object(
        'nuevo',       count(*) filter (where t.tipo = 'nuevo'),
        'habitual',    count(*) filter (where t.tipo = 'habitual'),
        'vip',         count(*) filter (where t.tipo = 'vip'),
        'ocasional',   count(*) filter (where t.tipo = 'ocasional'),
        'dormido',     count(*) filter (where t.tipo = 'dormido'),
        'sin_compras', count(*) filter (where t.tipo = 'sin_compras'))
        from socios s join club_tipos() t on t.cliente = s.id),

    'niveles', (
      select jsonb_build_object(
        'plata', count(*) filter (where nivel = 'Plata'),
        'oro', count(*) filter (where nivel = 'Oro'),
        'platino', count(*) filter (where nivel = 'Platino'),
        /* Cerca de subir: tiene el 80% o más de lo que pide el siguiente. */
        'cerca', count(*) filter (where exists (
                   select 1 from club_niveles n
                    where n.desde_xp > s.xp and s.xp >= n.desde_xp * 0.8
                      and n.desde_xp = (select min(desde_xp) from club_niveles where desde_xp > s.xp))))
        from socios s),

    /* Los 14, siempre todos: es la comparación. */
    'por_local', (
      select coalesce(jsonb_agg(
               club_est_resumen(t0, t1, upper(trim(l.codigo))) ||
               jsonb_build_object('local', l.codigo,
                                  'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                                  'socios', (select count(*) from club_clientes k
                                              where k.baja is null
                                                and upper(trim(k.local_alta)) = upper(trim(l.codigo))))
               order by l.codigo), '[]'::jsonb)
        from locales l where l.activo),

    /* "Sin local asignado": las compras sin local y los socios anotados
       solos. Con esta fila, la tabla suma lo mismo que el resumen. */
    /* La tienda online: una fila propia, ni uno de los 14 ni "sin local".
       Lleva cuándo se leyó la tienda por última vez: si eso se atrasa,
       algo dejó de andar. Ver el 27. */
    'tienda', club_est_resumen(t0, t1, 'TIENDA ONLINE') ||
              jsonb_build_object('local', 'TIENDA ONLINE', 'nombre', 'Tienda online', 'socios', 0,
                                 'leida', (select t.corrio from club_tienda_estado t where t.id = 1)),

    'sin_local', club_est_resumen(t0, t1, '__SIN__') ||
                 jsonb_build_object('local', '__SIN__', 'nombre', 'Sin local asignado',
                                    'socios', (select count(*) from club_clientes k
                                                where k.baja is null and club_est_local_ok(k.local_alta, '__SIN__'))),

    /* Quién carga las compras con tarjeta, y a cuántos socios les cargó la
       PRIMERA compra: los que "estrenó". El alta no guarda quién anotó al
       socio (se anotan solos con el QR, muchas veces), y la primera compra
       es la mejor seña de quién lo trajo al Club. */
    'vendedores', (
      select coalesce(jsonb_agg(v order by (v->>'compras')::int desc, v->>'vendedor'), '[]'::jsonb)
        from (select jsonb_build_object(
                       'vendedor', trim(c.vendedor),
                       'compras', count(*),
                       'facturado', coalesce(sum(c.importe), 0),
                       'clientes', count(distinct c.cliente),
                       'estrenados', count(*) filter (where p.cuando = c.creado)) as v
                from compras c
                left join primera p on p.cliente = c.cliente
               where nullif(trim(c.vendedor), '') is not null
               group by trim(c.vendedor)
               order by count(*) desc
               limit 25) z),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('f', s.f, 'compras', coalesce(x.n, 0),
                                                   'facturado', coalesce(x.plata, 0)) order by s.f), '[]'::jsonb)
        from (select distinct date_trunc(escala, g)::date as f
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g) s
        left join (select date_trunc(escala, local_ts)::date as f, count(*) as n, sum(importe) as plata
                     from compras group by 1) x on x.f = s.f),

    /* Por día de la semana: las compras y cuántas veces hubo ese día en el
       período, para sacar el promedio (un mes tiene cuatro o cinco lunes). */
    'por_semana', (
      select jsonb_agg(jsonb_build_object('d', w.d, 'veces', w.veces, 'compras', coalesce(x.n, 0)) order by w.d)
        from (select extract(isodow from g)::int as d, count(*) as veces
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g group by 1) w
        left join (select extract(isodow from local_ts)::int as d, count(*) as n
                     from compras group by 1) x on x.d = w.d),

    'por_hora', (
      select jsonb_agg(jsonb_build_object('h', h.h, 'compras', coalesce(x.n, 0)) order by h.h)
        from generate_series(0, 23) h(h)
        left join (select extract(hour from local_ts)::int as h, count(*) as n
                     from compras group by 1) x on x.h = h.h),

    'premios', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo,
               'canjes', (select count(*) from mov m where m.tipo = 'canje' and m.premio = p.id),
               'canjes_total', (select count(*) from club_movimientos m
                                 where m.tipo = 'canje' and m.premio = p.id and m.anulado is null),
               /* Cuántos socios podrían llevárselo hoy mismo. */
               'alcanza_hoy', (select count(*) from socios s where s.puntos >= p.puntos))
             order by p.orden, p.puntos), '[]'::jsonb)
        from club_premios p where p.activo),

    /* Los que cumplen en los próximos 7 días. El cumple de este año se arma
       con el mes y el día; sólo el 29 de febrero se corre al 28, que en un
       año no bisiesto no existe. (Una primera versión cortaba TODOS los días
       en 28 y el 29 y el 30 de cualquier mes daban "hoy" un día 28.) */
    'cumples', (
      select jsonb_build_object(
        'proximos', coalesce((select jsonb_agg(x order by x->>'falta') from (
            select jsonb_build_object('nombre', s.nombre, 'nivel', s.nivel, 'local', s.local_alta,
                     'dia', to_char(s.cumple, 'DD/MM'),
                     'falta', lpad(((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                                  case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366)::text, 3, '0')) as x
              from socios s
             where s.cumple is not null
               and ((make_date(extract(year from hoy)::int, extract(month from s.cumple)::int,
                     case when extract(month from s.cumple) = 2 and extract(day from s.cumple) = 29 then 28 else extract(day from s.cumple)::int end) - hoy + 366) % 366) <= 7
             limit 40) z), '[]'::jsonb))),

    'ranking', (
      select coalesce(jsonb_agg(x order by (x->>'gastado')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'codigo', k.codigo, 'nombre', k.nombre, 'nivel', v.nivel, 'local', k.local_alta,
                 'compras', count(*), 'gastado', coalesce(sum(c.importe), 0),
                 'puntos', v.puntos,
                 'ultima', max(c.creado)) as x
          from compras c
          join club_clientes k on k.id = c.cliente
          join v_club_clientes v on v.id = c.cliente
         group by k.id, k.codigo, k.nombre, v.nivel, k.local_alta, v.puntos
         order by coalesce(sum(c.importe), 0) desc
         limit 10) z),

    /* Lo que VDH les debe en premios: los puntos que tienen guardados,
       pasados a plata al costo promedio de un punto del catálogo. Y los que
       vencen en los próximos 60 días (12 meses sin comprar). */
    'pasivo', (
      select jsonb_build_object(
        'catalogo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'puntos', p.puntos, 'costo', p.costo)
                                               order by p.puntos), '[]'::jsonb)
                       from club_premios p where p.activo and p.costo is not null and p.puntos > 0),
        'puntos', coalesce(sum(greatest(puntos, 0)), 0),
        'costo_punto', costo_punto,
        'costo', round(coalesce(sum(greatest(puntos, 0)), 0) * coalesce(costo_punto, 0)),
        'vencen_60', coalesce(sum(greatest(puntos, 0)) filter (
                        where coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'), 0),
        'vencen_60_socios', count(*) filter (
                        where puntos > 0
                          and coalesce(ultima_compra, creado) <  now() - interval '10 months'
                          and coalesce(ultima_compra, creado) >= now() - interval '12 months'))
        from socios),

    'resenas', (
      select coalesce(jsonb_agg(jsonb_build_object('local', x.l, 'pedidos', x.n) order by x.n desc), '[]'::jsonb)
        from (select split_part(p.clave, '|', 1) as l, count(*) as n
                from club_avisos_personales p
               where p.motivo = 'resena' and p.creado >= t0 and p.creado < t1
                 and (loc is null or upper(split_part(p.clave, '|', 1)) = loc)
               group by 1) x),

    'recientes', (
      select coalesce(jsonb_agg(x order by x->>'cuando' desc), '[]'::jsonb) from (
        select jsonb_build_object('cuando', m.creado, 'nombre', k.nombre, 'tipo', m.tipo,
                                  'concepto', m.concepto, 'puntos', m.puntos, 'local', m.local,
                                  'obs', m.obs, 'importe', m.importe) as x
          from mov m join club_clientes k on k.id = m.cliente
         order by m.creado desc limit 12) z)
  )
  into r;

  return r;
end;
$function$;


-- La ficha: el tipo del socio.
CREATE OR REPLACE FUNCTION public.club_socio_ficha(p_pin text, p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  v  v_club_clientes%rowtype;
  c  club_clientes%rowtype;
  r  record;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into v from v_club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('hay', false, 'porque', 'No encontré ese socio.');
  end if;
  select * into c from club_clientes where id = v.id;
  select * into r from club_ritmo(v.id);

  return jsonb_build_object(
    'hay', true,
    'codigo', v.codigo,
    'nombre', v.nombre,
    'nombres', coalesce(c.nombres, split_part(trim(v.nombre), ' ', 1)),
    'telefono', v.telefono,
    'desde', v.creado,
    'local', v.local_alta,
    'nivel', v.nivel,
    'tipo', (select t.tipo from club_tipos(v.id) t),
    'puntos', v.puntos,
    'compras', v.compras,
    'gastado', v.gastado,
    'ultima_compra', v.ultima_compra,
    'dias_sin', r.dias_sin,
    'dias_compra', coalesce(r.dias_compra, 0),
    'frecuencia', r.frecuencia,
    'atraso', r.atraso,
    'a_recuperar', coalesce(r.a_recuperar, false),
    'acepta_promos', coalesce(v.acepta_promos, false),
    'con_avisos', exists (select 1 from club_suscripciones s where s.cliente = v.id and s.muerto is null),
    'avisado', (select max(p.creado) from club_avisos_personales p where p.cliente = v.id and p.motivo = 'recuperar'),
    /* El premio más grande que ya le alcanza: es el mejor motivo para
       volver que se le puede dar. */
    'premio', (select jsonb_build_object('nombre', p.nombre, 'puntos', p.puntos)
                 from club_premios p
                where p.activo and p.puntos > 0 and p.puntos <= v.puntos
                order by p.puntos desc limit 1),
    'contactos', coalesce((select jsonb_agg(jsonb_build_object('via', k.via, 'quien', k.quien, 'cuando', k.creado)
                                            order by k.creado desc, k.id desc)
                             from (select * from club_contactos where cliente = v.id order by creado desc, id desc limit 5) k),
                          '[]'::jsonb),
    'ultimas', coalesce((select jsonb_agg(jsonb_build_object('cuando', m.creado, 'local', m.local,
                                                             'importe', m.importe, 'puntos', m.puntos)
                                          order by m.creado desc)
                           from (select * from club_movimientos
                                  where cliente = v.id and tipo = 'compra' and anulado is null
                                  order by creado desc limit 6) m),
                        '[]'::jsonb));
end;
$function$;


select 'Listo: cada socio tiene su tipo, y la pastilla Socios ya puede mostrarlos a todos.' as "SQL 37";


-- ─────────────────────────── PARTE 38 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · PROMOS QUE SIRVEN: "SOLO SOCIOS", "DÓNDE VALE" Y EL DÍA DE ACÁ
--
-- Correr en el editor SQL de Supabase, después del 37.
--
-- Pedido de Mauricio (30/09/2026), sobre lo que hacen Nike, H&M y Sephora:
-- que cada promo diga en dos segundos qué gano, dónde vale, hasta cuándo y
-- qué tengo que hacer. Dos datos nuevos por promo:
--
--   · SOLO SOCIOS: la promo es para los socios del Club. En la app lleva el
--     rótulo, y en Cobrar el vendedor la ve al escanear la tarjeta, para
--     aplicarla en BlueSoft (como el regalo de cumple).
--   · DÓNDE VALE: en todos los locales (lo de siempre, y lo que queda en
--     las promos que ya estaban), en los locales y en la tienda online, sólo
--     en la tienda online, o en algunos locales elegidos. Online hay que
--     elegirlo a propósito: nadie decidió que las promos de hoy valgan en
--     vdh.com.ar, y la app no lo puede prometer.
--
-- Y dos arreglos. Editar una promo con el "Desde" vacío (el formulario dice
-- "vacío: hoy") la dejaba sin fecha de inicio, y la app no la mostraba más
-- aunque Configuración dijera "Vigente". Ahora vacío es hoy.
--
-- Y la base está en hora UTC y "hoy" era el día de Londres. Una
-- promo que terminaba hoy desaparecía de la app a las 21 h —justo cuando la
-- cuenta regresiva decía "Termina en 2:59:59"— y una que empezaba mañana
-- aparecía hoy a las 21. Ahora "hoy" es el día de Argentina.
-- ══════════════════════════════════════════════════════════════════════════

alter table club_promos add column if not exists solo_socios boolean not null default false;
alter table club_promos add column if not exists donde text not null default 'locales';
alter table club_promos add column if not exists locales text[];

do $d$
begin
  if not exists (select 1 from pg_constraint where conname = 'club_promos_donde_ok') then
    alter table club_promos add constraint club_promos_donde_ok
      check (donde in ('locales', 'locales_online', 'online', 'algunos'));
  end if;
end
$d$;


-- ── Lo que ve el socio. Cambia lo que devuelve: hay que borrarla antes. ──
drop function if exists club_promos_ver();

create function club_promos_ver()
returns table(id bigint, texto text, imagen text, condiciones text, desde date, hasta date, enlace text,
              cuenta boolean, termina timestamptz, solo_socios boolean, donde text, locales text[])
language sql
stable
security definer
set search_path = public
as $pv$
  select p.id, p.texto, p.imagen, p.condiciones, p.desde, p.hasta, p.enlace,
         p.cuenta_regresiva,
         /* A la medianoche de su último día, en hora de Argentina. */
         ((p.hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
         p.solo_socios, p.donde, p.locales
    from club_promos p
   where p.baja is null
     and p.desde <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
     and p.hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
   /* Primero las de socios, después la que termina antes. */
   order by p.solo_socios desc, p.hasta, p.desde desc, p.id desc;
$pv$;

revoke all on function club_promos_ver() from public;
grant execute on function club_promos_ver() to anon, authenticated;


-- ── La lista de Configuración ──
create or replace function club_promos_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pl$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id, 'texto', texto, 'imagen', imagen,
             'desde', to_char(desde, 'YYYY-MM-DD'),
             'hasta', to_char(hasta, 'YYYY-MM-DD'),
             'condiciones', condiciones,
             'enlace', enlace,
             'cuenta', cuenta_regresiva,
             'solo_socios', solo_socios,
             'donde', donde,
             'locales', to_jsonb(locales),
             'vigente', (hasta >= hoy and (desde is null or desde <= hoy)),
             'futura',  (desde is not null and desde > hoy),
             'vencida', (hasta < hoy))
           order by hasta desc, id desc)
      from club_promos where baja is null), '[]'::jsonb);
end;
$pl$;


-- ── Guardar. Tres datos nuevos al final, con default: una pantalla vieja
--    que quedó en un celular sigue guardando bien y no los toca. ──
drop function if exists club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean);

create function club_promo_guardar(p_pin text, p_id bigint, p_texto text, p_imagen text, p_desde text, p_hasta text,
                                   p_condiciones text, p_avisar boolean default false, p_enlace text default null,
                                   p_cuenta boolean default null, p_solo_socios boolean default null,
                                   p_donde text default null, p_locales text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pg$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  txt text;
  img text;
  con text;
  enl text;
  dnd text;
  locs text[];
  d1  date;
  d2  date;
  nid bigint;
  arranca date;
  solo boolean;
  cuantos integer := 0;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  txt := nullif(trim(coalesce(p_texto, '')), '');
  img := nullif(trim(coalesce(p_imagen, '')), '');
  con := nullif(trim(coalesce(p_condiciones, '')), '');
  enl := nullif(trim(coalesce(p_enlace, '')), '');
  dnd := nullif(lower(trim(coalesce(p_donde, ''))), '');

  if txt is null then raise exception 'Falta qué dice la promoción.'; end if;
  if length(txt) > 140 then
    raise exception 'El texto es muy largo. Máximo 140 caracteres.';
  end if;

  /* https y no http: una imagen por http en una página https la bloquea el
     navegador SIN DECIR NADA, y el cartel se vería vacío. */
  if img is not null and img !~* '^https://' then
    raise exception 'La foto tiene que ser un enlace que empiece con https.';
  end if;

  /* Lo mismo con el enlace, y por un motivo más: una notificación que lleva
     a un sitio sin candado le muestra al cliente un cartel de peligro con
     la marca al lado. */
  if enl is not null and enl !~* '^https://' then
    raise exception 'El enlace tiene que empezar con https.';
  end if;

  /* Dónde vale. "algunos" necesita la lista, y cada uno tiene que ser un
     local de verdad: un nombre mal escrito haría que la caja de ese local
     nunca la vea. */
  if dnd is not null and dnd not in ('locales', 'locales_online', 'online', 'algunos') then
    raise exception 'No entiendo dónde vale la promo.';
  end if;
  if dnd = 'algunos' then
    select array_agg(distinct upper(trim(x)) order by upper(trim(x))) into locs
      from unnest(coalesce(p_locales, '{}'::text[])) x
     where nullif(trim(x), '') is not null;
    if locs is null then
      raise exception 'Elegí en qué locales vale.';
    end if;
    if exists (select 1 from unnest(locs) x
                where not exists (select 1 from locales l where l.activo and upper(trim(l.codigo)) = x)) then
      raise exception 'Uno de los locales elegidos no existe.';
    end if;
  end if;

  begin
    d1 := nullif(trim(coalesce(p_desde, '')), '')::date;
    d2 := nullif(trim(coalesce(p_hasta, '')), '')::date;
  exception when others then
    raise exception 'Esa fecha no se entiende. Va como 2026-09-30.';
  end;

  if d2 is null then
    raise exception 'Falta hasta qué día vale. Una promo sin vencimiento se queda para siempre.';
  end if;
  if d1 is not null and d1 > d2 then
    raise exception 'El desde no puede ser posterior al hasta.';
  end if;
  if d2 < hoy then
    raise exception 'Esa fecha ya pasó: la promoción no la vería nadie.';
  end if;

  if p_id is null then
    insert into club_promos (texto, imagen, desde, hasta, condiciones, enlace, cuenta_regresiva,
                             solo_socios, donde, locales)
    values (txt, img, coalesce(d1, hoy), d2, con, enl, coalesce(p_cuenta, false),
            coalesce(p_solo_socios, false), coalesce(dnd, 'locales'), locs)
    returning id, desde, solo_socios into nid, arranca, solo;
  else
    /* "Desde" vacío es hoy, también al editar. Antes quedaba vacío en la
       base, y la app —que pide desde <= hoy— no la mostraba nunca más,
       mientras Configuración la marcaba "Vigente". */
    update club_promos
       set texto = txt, imagen = img, desde = coalesce(d1, hoy), hasta = d2,
           condiciones = con, enlace = enl,
           /* Sin el dato (una pantalla vieja cacheada) queda como estaba. */
           cuenta_regresiva = coalesce(p_cuenta, cuenta_regresiva),
           solo_socios = coalesce(p_solo_socios, solo_socios),
           donde = coalesce(dnd, donde),
           locales = case when dnd is null then locales else locs end
     where id = p_id and baja is null
    returning id, desde, solo_socios into nid, arranca, solo;
    if nid is null then
      return jsonb_build_object('ok', false, 'porque', 'Esa promoción ya no existe.');
    end if;
  end if;

  /* ── El aviso ──
     Hereda de la promo el texto, la foto y el enlace. Sin enlace propio
     lleva a las promos de la app, que es lo que hacía siempre. La de socios
     lo dice en el título: es lo que hace que valga la pena abrirlo. */
  if coalesce(p_avisar, false) then
    select count(*) into cuantos from club_suscripciones where muerto is null;

    if cuantos > 0 then
      insert into club_avisos (titulo, cuerpo, enlace, imagen, por, promo, sale)
      values (
        case when solo then 'Solo para socios del Club' else 'Nueva promo' end,
        txt,
        coalesce(enl, 'tarjeta.html#promos'),
        img,
        'Promoción',
        nid,
        greatest(now(), (coalesce(arranca, hoy)::timestamp at time zone 'America/Argentina/Buenos_Aires'))
      );
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', nid,
    'avisados', case when coalesce(p_avisar, false) then cuantos else 0 end);
end;
$pg$;

revoke all on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[]) from public;
grant execute on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[]) to anon, authenticated;


select 'Listo: las promos dicen si son sólo para socios y dónde valen, y cambian de día a la medianoche de Argentina.' as "SQL 38";


-- ─────────────────────────── PARTE 39 ───────────────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · PROMOS POR NIVEL
--
-- Correr en el editor SQL de Supabase, después del 38.
--
-- Pedido de Mauricio (30/09/2026), sobre lo que hace Starbucks: promos que
-- son sólo para los niveles más altos ("Socios Oro y Platino", "Sólo
-- Platino"). Es lo que hace que subir de nivel valga algo más que un número.
--
--   · En la app, el que llega la ve primero, con su rótulo y "Mostrar mi
--     código". El que no llega la ve al final, con candado y cuánto le
--     falta: es un motivo para comprar y subir.
--   · En Cobrar, el vendedor la ve sólo si el socio llega al nivel.
--   · El aviso al celular les llega SÓLO a los socios de ese nivel (como
--     aviso personal, en menos de una hora): a un Plata no le suena el
--     teléfono por algo que no puede usar.
--
-- Un nivel implica "sólo socios". El primer nivel (Plata) es lo mismo que
-- "todos los socios", así que no se guarda como nivel.
-- ══════════════════════════════════════════════════════════════════════════

alter table club_promos add column if not exists desde_nivel text;


-- ── Lo que ve el socio. Cambia lo que devuelve: hay que borrarla antes. ──
drop function if exists club_promos_ver();

create function club_promos_ver()
returns table(id bigint, texto text, imagen text, condiciones text, desde date, hasta date, enlace text,
              cuenta boolean, termina timestamptz, solo_socios boolean, donde text, locales text[],
              desde_nivel text, nivel_xp integer, para text)
language sql
stable
security definer
set search_path = public
as $pv$
  select p.id, p.texto, p.imagen, p.condiciones, p.desde, p.hasta, p.enlace,
         p.cuenta_regresiva,
         /* A la medianoche de su último día, en hora de Argentina. */
         ((p.hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
         p.solo_socios, p.donde, p.locales,
         /* El nivel, lo que pide (para que la app y la caja comparen con el
            socio) y cómo se dice: "Oro y Platino". */
         p.desde_nivel, nv.desde_xp,
         (select string_agg(n.nombre, ' y ' order by n.desde_xp) from club_niveles n where n.desde_xp >= nv.desde_xp)
    from club_promos p
    left join club_niveles nv on nv.nombre = p.desde_nivel
   where p.baja is null
     and p.desde <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
     and p.hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
   /* Las de nivel, las de socios, y después la que termina antes. */
   order by (p.desde_nivel is not null) desc, p.solo_socios desc, p.hasta, p.desde desc, p.id desc;
$pv$;

revoke all on function club_promos_ver() from public;
grant execute on function club_promos_ver() to anon, authenticated;


-- ── La lista de Configuración ──
create or replace function club_promos_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pl$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id, 'texto', texto, 'imagen', imagen,
             'desde', to_char(desde, 'YYYY-MM-DD'),
             'hasta', to_char(hasta, 'YYYY-MM-DD'),
             'condiciones', condiciones,
             'enlace', enlace,
             'cuenta', cuenta_regresiva,
             'solo_socios', solo_socios,
             'donde', donde,
             'locales', to_jsonb(locales),
             'desde_nivel', desde_nivel,
             'vigente', (hasta >= hoy and (desde is null or desde <= hoy)),
             'futura',  (desde is not null and desde > hoy),
             'vencida', (hasta < hoy))
           order by hasta desc, id desc)
      from club_promos where baja is null), '[]'::jsonb);
end;
$pl$;


-- ── Guardar. El nivel va al final, con default: una pantalla vieja no lo
--    toca. Vacío ('') lo saca; null lo deja como estaba. ──
drop function if exists club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[]);

create function club_promo_guardar(p_pin text, p_id bigint, p_texto text, p_imagen text, p_desde text, p_hasta text,
                                   p_condiciones text, p_avisar boolean default false, p_enlace text default null,
                                   p_cuenta boolean default null, p_solo_socios boolean default null,
                                   p_donde text default null, p_locales text[] default null,
                                   p_desde_nivel text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pg$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  txt text;
  img text;
  con text;
  enl text;
  dnd text;
  locs text[];
  d1  date;
  d2  date;
  nid bigint;
  arranca date;
  solo boolean;
  nvl text;
  nvxp integer;
  toca_nivel boolean := p_desde_nivel is not null;
  /* Elegir un nivel, aunque sea el primero, es elegir "sólo socios". */
  pide_socios boolean := nullif(trim(coalesce(p_desde_nivel, '')), '') is not null;
  nivel text;
  para text;
  sale timestamptz;
  cuantos integer := 0;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  txt := nullif(trim(coalesce(p_texto, '')), '');
  img := nullif(trim(coalesce(p_imagen, '')), '');
  con := nullif(trim(coalesce(p_condiciones, '')), '');
  enl := nullif(trim(coalesce(p_enlace, '')), '');
  dnd := nullif(lower(trim(coalesce(p_donde, ''))), '');

  if txt is null then raise exception 'Falta qué dice la promoción.'; end if;
  if length(txt) > 140 then
    raise exception 'El texto es muy largo. Máximo 140 caracteres.';
  end if;

  /* https y no http: una imagen por http en una página https la bloquea el
     navegador SIN DECIR NADA, y el cartel se vería vacío. */
  if img is not null and img !~* '^https://' then
    raise exception 'La foto tiene que ser un enlace que empiece con https.';
  end if;

  /* Lo mismo con el enlace, y por un motivo más: una notificación que lleva
     a un sitio sin candado le muestra al cliente un cartel de peligro con
     la marca al lado. */
  if enl is not null and enl !~* '^https://' then
    raise exception 'El enlace tiene que empezar con https.';
  end if;

  /* Dónde vale. "algunos" necesita la lista, y cada uno tiene que ser un
     local de verdad: un nombre mal escrito haría que la caja de ese local
     nunca la vea. */
  if dnd is not null and dnd not in ('locales', 'locales_online', 'online', 'algunos') then
    raise exception 'No entiendo dónde vale la promo.';
  end if;
  if dnd = 'algunos' then
    select array_agg(distinct upper(trim(x)) order by upper(trim(x))) into locs
      from unnest(coalesce(p_locales, '{}'::text[])) x
     where nullif(trim(x), '') is not null;
    if locs is null then
      raise exception 'Elegí en qué locales vale.';
    end if;
    if exists (select 1 from unnest(locs) x
                where not exists (select 1 from locales l where l.activo and upper(trim(l.codigo)) = x)) then
      raise exception 'Uno de los locales elegidos no existe.';
    end if;
  end if;

  /* El nivel (SQL 39). El primero es "todos los socios": no se guarda. */
  if toca_nivel and nullif(trim(p_desde_nivel), '') is not null then
    select n.nombre, n.desde_xp into nvl, nvxp from club_niveles n where lower(n.nombre) = lower(trim(p_desde_nivel));
    if nvl is null then
      raise exception 'Ese nivel no existe.';
    end if;
    if nvxp <= (select min(desde_xp) from club_niveles) then nvl := null; end if;
  end if;

  begin
    d1 := nullif(trim(coalesce(p_desde, '')), '')::date;
    d2 := nullif(trim(coalesce(p_hasta, '')), '')::date;
  exception when others then
    raise exception 'Esa fecha no se entiende. Va como 2026-09-30.';
  end;

  if d2 is null then
    raise exception 'Falta hasta qué día vale. Una promo sin vencimiento se queda para siempre.';
  end if;
  if d1 is not null and d1 > d2 then
    raise exception 'El desde no puede ser posterior al hasta.';
  end if;
  if d2 < hoy then
    raise exception 'Esa fecha ya pasó: la promoción no la vería nadie.';
  end if;

  if p_id is null then
    insert into club_promos (texto, imagen, desde, hasta, condiciones, enlace, cuenta_regresiva,
                             solo_socios, donde, locales, desde_nivel)
    values (txt, img, coalesce(d1, hoy), d2, con, enl, coalesce(p_cuenta, false),
            coalesce(p_solo_socios, false) or pide_socios, coalesce(dnd, 'locales'), locs, nvl)
    returning id, desde, solo_socios, desde_nivel into nid, arranca, solo, nivel;
  else
    /* "Desde" vacío es hoy, también al editar (ver el 38). */
    update club_promos
       set texto = txt, imagen = img, desde = coalesce(d1, hoy), hasta = d2,
           condiciones = con, enlace = enl,
           /* Sin el dato (una pantalla vieja cacheada) queda como estaba. */
           cuenta_regresiva = coalesce(p_cuenta, cuenta_regresiva),
           desde_nivel = case when toca_nivel then nvl else desde_nivel end,
           /* Con nivel es de socios, siempre. */
           solo_socios = coalesce(p_solo_socios, solo_socios) or pide_socios
                         or (case when toca_nivel then nvl else desde_nivel end) is not null,
           donde = coalesce(dnd, donde),
           locales = case when dnd is null then locales else locs end
     where id = p_id and baja is null
    returning id, desde, solo_socios, desde_nivel into nid, arranca, solo, nivel;
    if nid is null then
      return jsonb_build_object('ok', false, 'porque', 'Esa promoción ya no existe.');
    end if;
  end if;

  /* ── El aviso ──
     Hereda de la promo el texto, la foto y el enlace. Sin enlace propio
     lleva a las promos de la app. La de socios lo dice en el título: es lo
     que hace que valga la pena abrirlo. */
  if coalesce(p_avisar, false) then
    sale := greatest(now(), (coalesce(arranca, hoy)::timestamp at time zone 'America/Argentina/Buenos_Aires'));

    if nivel is null then
      select count(*) into cuantos from club_suscripciones where muerto is null;
      if cuantos > 0 then
        insert into club_avisos (titulo, cuerpo, enlace, imagen, por, promo, sale)
        values (case when solo then 'Solo para socios del Club' else 'Nueva promo' end,
                txt, coalesce(enl, 'tarjeta.html#promos'), img, 'Promoción', nid, sale);
      end if;
    else
      /* Con nivel: un aviso personal a cada socio que llega, y a nadie más.
         La clave es la promo: guardarla de nuevo con "avisar" no le vuelve
         a sonar el teléfono al que ya lo recibió. */
      select n.desde_xp, (select string_agg(m.nombre, ' y ' order by m.desde_xp) from club_niveles m where m.desde_xp >= n.desde_xp)
        into nvxp, para
        from club_niveles n where n.nombre = nivel;
      insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
      select v.id, 'promo', 'promo:' || nid, left('Para socios ' || para, 60), txt,
             coalesce(enl, 'tarjeta.html#promos'), sale
        from v_club_clientes v
        join club_niveles n on n.nombre = v.nivel
       where v.baja is null and n.desde_xp >= nvxp
         and exists (select 1 from club_suscripciones s where s.cliente = v.id and s.muerto is null)
      on conflict (cliente, motivo, clave) do nothing;
      get diagnostics cuantos = row_count;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', nid,
    'avisados', case when coalesce(p_avisar, false) then cuantos else 0 end,
    /* Con nivel, el aviso es personal: sale en menos de una hora, no ya. */
    'personal', nivel is not null and coalesce(p_avisar, false),
    'para', para);
end;
$pg$;

revoke all on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[], text) from public;
grant execute on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[], text) to anon, authenticated;


select 'Listo: las promos pueden ser para un nivel, y el aviso les llega sólo a esos socios.' as "SQL 39";


-- ─────────────────────────── PARTE 40 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LAS PANTALLAS CON PIN QUE NO ABRÍAN
--
-- Correr en el editor SQL de Supabase, después del 39.
--
-- "Puntos y niveles" y "Misiones" (Configuración del Club) mostraban
-- "cannot execute SELECT FOR UPDATE in a read-only transaction" (01/10/2026).
--
-- Es la misma trampa que ya se había anotado en beneficios_listar: PostgREST
-- corre las funciones STABLE en una transacción de SOLO LECTURA, y pin_ok
-- necesita escribir —cuenta los intentos fallidos para frenar al que prueba
-- PINes—. Cualquier función que pida PIN tiene que ser VOLATILE.
--
-- Estaban mal cuatro: las dos de Configuración y las dos de Socios (la lista
-- y la ficha), que tenían el mismo defecto aunque nadie lo hubiera visto
-- todavía. No cambia lo que hacen ni lo que devuelven: sólo cómo las corre
-- la base.
-- ══════════════════════════════════════════════════════════════════════════

alter function club_config_resumen(text) volatile;
alter function club_misiones_listar(text) volatile;
alter function club_socio_ficha(text, text) volatile;
alter function club_socios_lista(text, text, text, text, text, integer, integer) volatile;


-- Ninguna función que pida PIN puede quedar en solo lectura.
select p.oid::regprocedure as "Todavía en solo lectura (tiene que salir vacío)"
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.provolatile <> 'v' and p.prosrc ~* 'pin_ok\s*\(';

select 'Listo: Puntos y niveles, Misiones y Socios abren con el PIN.' as "SQL 40";


-- ─────────────────────────── PARTE 41 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH Club · LA TIENDA ADENTRO DEL CLUB, Y LA PROMO DESTACADA
--
-- Correr en el editor SQL de Supabase, después del 40.
--
-- Pedido de Mauricio (02/10/2026): que "Tienda" deje de ser un enlace que
-- saca al cliente del Club justo cuando va a comprar. Adentro del Club se
-- ven los productos de vdh.com.ar con lo que la tienda no puede decir:
-- cuántos puntos le suma A ESE socio, con su nivel. Y las cuotas y la
-- transferencia, como en la tienda. El pago sigue en Tienda Nube.
--
--   · Los productos los trae de Tienda Nube el mismo Action de cada hora
--     que suma las compras online (tienda-productos.js, en vdh-respaldos),
--     y los deja acá con club_tienda_catalogo_cargar. Nadie carga nada a
--     mano: producto nuevo, agotado o precio cambiado se ve en una hora.
--   · Las cuotas y el descuento por transferencia también los lee de la
--     tienda. Si un día no puede leerlos, quedan los últimos que leyó.
--   · Sólo lo publicado y con stock. Sin datos de clientes: es lo mismo que
--     cualquiera ve en vdh.com.ar, por eso club_tienda_ver no pide nada.
--
-- Y la promo DESTACADA: una sola, la que va arriba de todo en Promos. Se
-- marca al guardar la promo en Configuración.
-- ══════════════════════════════════════════════════════════════════════════


-- ── Los productos ──
-- Se reemplazan enteros en cada corrida: lo que ya no está en la tienda (o
-- se agotó) desaparece solo.
create table if not exists club_tienda_productos (
  id        bigint primary key,           -- el de Tienda Nube
  nombre    text not null,
  url       text not null,
  foto      text,
  precio    numeric not null check (precio >= 0),
  oferta    numeric check (oferta is null or oferta >= 0),   -- el precio promocional, si hay
  tipo      text not null,                -- Remeras, Buzos… (las pastillas)
  campanas  text[] not null default '{}', -- "2DA AL 50% OFF", "Últimos talles"…
  colores   jsonb not null default '[]',  -- [{"n":"Negro","hay":true}]
  talles    jsonb not null default '[]',
  nuevo     boolean not null default false,
  orden     integer not null default 0
);
-- Sin políticas: nadie la lee directo. Se lee por club_tienda_ver.
alter table club_tienda_productos enable row level security;

alter table club_tienda_estado
  add column if not exists pago_cuotas        integer,
  add column if not exists pago_transferencia numeric,
  add column if not exists campanas           text[],
  add column if not exists catalogo_corrio    timestamptz,
  add column if not exists catalogo_resultado jsonb;


-- ── Cargar el catálogo (la usa SÓLO el Action) ──
create or replace function club_tienda_catalogo_cargar(p_productos jsonb, p_pago jsonb, p_campanas text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $
declare
  n integer := coalesce(jsonb_array_length(p_productos), 0);
begin
  /* Cero productos es una tienda que no contestó bien, no una tienda
     vacía: borrar el catálogo dejaría la pestaña en blanco. Se queda el de
     la corrida anterior. */
  if n = 0 then
    raise exception 'Llegaron cero productos: no toco el catálogo.';
  end if;

  delete from club_tienda_productos where true;
  insert into club_tienda_productos (id, nombre, url, foto, precio, oferta, tipo, campanas, colores, talles, nuevo, orden)
  select x.id, x.nombre, x.url, x.foto, x.precio, nullif(x.oferta, 0), coalesce(nullif(x.tipo, ''), 'Otros'),
         coalesce(x.campanas, '{}'), coalesce(x.colores, '[]'), coalesce(x.talles, '[]'), coalesce(x.nuevo, false), coalesce(x.orden, 0)
    from jsonb_to_recordset(p_productos) as x(id bigint, nombre text, url text, foto text, precio numeric, oferta numeric,
                                               tipo text, campanas text[], colores jsonb, talles jsonb, nuevo boolean, orden integer);

  /* Cuotas y transferencia: si esta vez no se pudieron leer, quedan las
     últimas que se leyeron. */
  update club_tienda_estado
     set pago_cuotas        = coalesce((p_pago->>'cuotas')::integer, pago_cuotas),
         pago_transferencia = coalesce((p_pago->>'transferencia')::numeric, pago_transferencia),
         campanas           = coalesce(p_campanas, '{}'),
         catalogo_corrio    = now(),
         catalogo_resultado = jsonb_build_object('productos', n, 'pago', p_pago)
   where id = 1;

  return jsonb_build_object('ok', true, 'productos', n);
end;
$;

revoke all on function club_tienda_catalogo_cargar(jsonb, jsonb, text[]) from public, anon, authenticated;


-- ── Lo que ve el socio ──
-- Sin PIN y sin escribir nada (por eso stable): son los productos públicos
-- de la tienda.
create or replace function club_tienda_ver()
returns jsonb
language sql
stable
security definer
set search_path = public
as $
  select jsonb_build_object(
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'url', p.url, 'foto', p.foto,
               'precio', p.precio, 'oferta', p.oferta, 'tipo', p.tipo,
               'campanas', to_jsonb(p.campanas), 'colores', p.colores, 'talles', p.talles,
               'nuevo', p.nuevo)
             order by p.orden, p.id)
        from club_tienda_productos p), '[]'::jsonb),
    'pago', jsonb_build_object('cuotas', e.pago_cuotas, 'transferencia', e.pago_transferencia),
    'campanas', to_jsonb(coalesce(e.campanas, '{}')),
    'actualizado', e.catalogo_corrio)
  from club_tienda_estado e
  where e.id = 1;
$;

revoke all on function club_tienda_ver() from public;
grant execute on function club_tienda_ver() to anon, authenticated;


-- ── La promo destacada ──
alter table club_promos add column if not exists destacada boolean not null default false;

-- Cambia lo que devuelve: hay que borrarla antes.
drop function if exists club_promos_ver();

create function club_promos_ver()
 RETURNS TABLE(id bigint, texto text, imagen text, condiciones text, desde date, hasta date, enlace text, cuenta boolean, termina timestamp with time zone, solo_socios boolean, donde text, locales text[], desde_nivel text, nivel_xp integer, para text, destacada boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.texto, p.imagen, p.condiciones, p.desde, p.hasta, p.enlace,
         p.cuenta_regresiva,
         /* A la medianoche de su último día, en hora de Argentina. */
         ((p.hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
         p.solo_socios, p.donde, p.locales,
         /* El nivel, lo que pide (para que la app y la caja comparen con el
            socio) y cómo se dice: "Oro y Platino". */
         p.desde_nivel, nv.desde_xp,
         (select string_agg(n.nombre, ' y ' order by n.desde_xp) from club_niveles n where n.desde_xp >= nv.desde_xp),
         p.destacada
    from club_promos p
    left join club_niveles nv on nv.nombre = p.desde_nivel
   where p.baja is null
     and p.desde <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
     and p.hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
   /* Las de nivel, las de socios, y después la que termina antes. */
   order by (p.desde_nivel is not null) desc, p.solo_socios desc, p.hasta, p.desde desc, p.id desc;
$function$;

revoke all on function club_promos_ver() from public;
grant execute on function club_promos_ver() to anon, authenticated;

-- Un parámetro más: se borra la firma vieja para que no queden dos.
drop function if exists club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[], text);

create function club_promo_guardar(p_pin text, p_id bigint, p_texto text, p_imagen text, p_desde text, p_hasta text, p_condiciones text, p_avisar boolean DEFAULT false, p_enlace text DEFAULT NULL::text, p_cuenta boolean DEFAULT NULL::boolean, p_solo_socios boolean DEFAULT NULL::boolean, p_donde text DEFAULT NULL::text, p_locales text[] DEFAULT NULL::text[], p_desde_nivel text DEFAULT NULL::text, p_destacada boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  txt text;
  img text;
  con text;
  enl text;
  dnd text;
  locs text[];
  d1  date;
  d2  date;
  nid bigint;
  arranca date;
  solo boolean;
  nvl text;
  nvxp integer;
  toca_nivel boolean := p_desde_nivel is not null;
  /* Elegir un nivel, aunque sea el primero, es elegir "sólo socios". */
  pide_socios boolean := nullif(trim(coalesce(p_desde_nivel, '')), '') is not null;
  nivel text;
  para text;
  sale timestamptz;
  cuantos integer := 0;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  txt := nullif(trim(coalesce(p_texto, '')), '');
  img := nullif(trim(coalesce(p_imagen, '')), '');
  con := nullif(trim(coalesce(p_condiciones, '')), '');
  enl := nullif(trim(coalesce(p_enlace, '')), '');
  dnd := nullif(lower(trim(coalesce(p_donde, ''))), '');

  if txt is null then raise exception 'Falta qué dice la promoción.'; end if;
  if length(txt) > 140 then
    raise exception 'El texto es muy largo. Máximo 140 caracteres.';
  end if;

  /* https y no http: una imagen por http en una página https la bloquea el
     navegador SIN DECIR NADA, y el cartel se vería vacío. */
  if img is not null and img !~* '^https://' then
    raise exception 'La foto tiene que ser un enlace que empiece con https.';
  end if;

  /* Lo mismo con el enlace, y por un motivo más: una notificación que lleva
     a un sitio sin candado le muestra al cliente un cartel de peligro con
     la marca al lado. */
  if enl is not null and enl !~* '^https://' then
    raise exception 'El enlace tiene que empezar con https.';
  end if;

  /* Dónde vale. "algunos" necesita la lista, y cada uno tiene que ser un
     local de verdad: un nombre mal escrito haría que la caja de ese local
     nunca la vea. */
  if dnd is not null and dnd not in ('locales', 'locales_online', 'online', 'algunos') then
    raise exception 'No entiendo dónde vale la promo.';
  end if;
  if dnd = 'algunos' then
    select array_agg(distinct upper(trim(x)) order by upper(trim(x))) into locs
      from unnest(coalesce(p_locales, '{}'::text[])) x
     where nullif(trim(x), '') is not null;
    if locs is null then
      raise exception 'Elegí en qué locales vale.';
    end if;
    if exists (select 1 from unnest(locs) x
                where not exists (select 1 from locales l where l.activo and upper(trim(l.codigo)) = x)) then
      raise exception 'Uno de los locales elegidos no existe.';
    end if;
  end if;

  /* El nivel (SQL 39). El primero es "todos los socios": no se guarda. */
  if toca_nivel and nullif(trim(p_desde_nivel), '') is not null then
    select n.nombre, n.desde_xp into nvl, nvxp from club_niveles n where lower(n.nombre) = lower(trim(p_desde_nivel));
    if nvl is null then
      raise exception 'Ese nivel no existe.';
    end if;
    if nvxp <= (select min(desde_xp) from club_niveles) then nvl := null; end if;
  end if;

  begin
    d1 := nullif(trim(coalesce(p_desde, '')), '')::date;
    d2 := nullif(trim(coalesce(p_hasta, '')), '')::date;
  exception when others then
    raise exception 'Esa fecha no se entiende. Va como 2026-09-30.';
  end;

  if d2 is null then
    raise exception 'Falta hasta qué día vale. Una promo sin vencimiento se queda para siempre.';
  end if;
  if d1 is not null and d1 > d2 then
    raise exception 'El desde no puede ser posterior al hasta.';
  end if;
  if d2 < hoy then
    raise exception 'Esa fecha ya pasó: la promoción no la vería nadie.';
  end if;

  if p_id is null then
    insert into club_promos (texto, imagen, desde, hasta, condiciones, enlace, cuenta_regresiva,
                             solo_socios, donde, locales, desde_nivel, destacada)
    values (txt, img, coalesce(d1, hoy), d2, con, enl, coalesce(p_cuenta, false),
            coalesce(p_solo_socios, false) or pide_socios, coalesce(dnd, 'locales'), locs, nvl,
            coalesce(p_destacada, false))
    returning id, desde, solo_socios, desde_nivel into nid, arranca, solo, nivel;
  else
    /* "Desde" vacío es hoy, también al editar (ver el 38). */
    update club_promos
       set texto = txt, imagen = img, desde = coalesce(d1, hoy), hasta = d2,
           condiciones = con, enlace = enl,
           /* Sin el dato (una pantalla vieja cacheada) queda como estaba. */
           cuenta_regresiva = coalesce(p_cuenta, cuenta_regresiva),
           desde_nivel = case when toca_nivel then nvl else desde_nivel end,
           /* Con nivel es de socios, siempre. */
           solo_socios = coalesce(p_solo_socios, solo_socios) or pide_socios
                         or (case when toca_nivel then nvl else desde_nivel end) is not null,
           donde = coalesce(dnd, donde),
           locales = case when dnd is null then locales else locs end,
           /* Sin el dato (una pantalla vieja cacheada) queda como estaba. */
           destacada = coalesce(p_destacada, destacada)
     where id = p_id and baja is null
    returning id, desde, solo_socios, desde_nivel into nid, arranca, solo, nivel;
    if nid is null then
      return jsonb_build_object('ok', false, 'porque', 'Esa promoción ya no existe.');
    end if;
  end if;

  /* La destacada (SQL 41) es UNA: la que va arriba de todo en Promos.
     Marcar una le saca la marca a la que la tenía. */
  if coalesce(p_destacada, false) then
    update club_promos set destacada = false where destacada and id <> nid;
  end if;

  /* ── El aviso ──
     Hereda de la promo el texto, la foto y el enlace. Sin enlace propio
     lleva a las promos de la app. La de socios lo dice en el título: es lo
     que hace que valga la pena abrirlo. */
  if coalesce(p_avisar, false) then
    sale := greatest(now(), (coalesce(arranca, hoy)::timestamp at time zone 'America/Argentina/Buenos_Aires'));

    if nivel is null then
      select count(*) into cuantos from club_suscripciones where muerto is null;
      if cuantos > 0 then
        insert into club_avisos (titulo, cuerpo, enlace, imagen, por, promo, sale)
        values (case when solo then 'Solo para socios del Club' else 'Nueva promo' end,
                txt, coalesce(enl, 'tarjeta.html#promos'), img, 'Promoción', nid, sale);
      end if;
    else
      /* Con nivel: un aviso personal a cada socio que llega, y a nadie más.
         La clave es la promo: guardarla de nuevo con "avisar" no le vuelve
         a sonar el teléfono al que ya lo recibió. */
      select n.desde_xp, (select string_agg(m.nombre, ' y ' order by m.desde_xp) from club_niveles m where m.desde_xp >= n.desde_xp)
        into nvxp, para
        from club_niveles n where n.nombre = nivel;
      insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
      select v.id, 'promo', 'promo:' || nid, left('Para socios ' || para, 60), txt,
             coalesce(enl, 'tarjeta.html#promos'), sale
        from v_club_clientes v
        join club_niveles n on n.nombre = v.nivel
       where v.baja is null and n.desde_xp >= nvxp
         and exists (select 1 from club_suscripciones s where s.cliente = v.id and s.muerto is null)
      on conflict (cliente, motivo, clave) do nothing;
      get diagnostics cuantos = row_count;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', nid,
    'avisados', case when coalesce(p_avisar, false) then cuantos else 0 end,
    /* Con nivel, el aviso es personal: sale en menos de una hora, no ya. */
    'personal', nivel is not null and coalesce(p_avisar, false),
    'para', para);
end;
$function$;

revoke all on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[], text, boolean) from public;
grant execute on function club_promo_guardar(text, bigint, text, text, text, text, text, boolean, text, boolean, boolean, text, text[], text, boolean) to anon, authenticated;

create or replace function club_promos_listar(p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id, 'texto', texto, 'imagen', imagen,
             'desde', to_char(desde, 'YYYY-MM-DD'),
             'hasta', to_char(hasta, 'YYYY-MM-DD'),
             'condiciones', condiciones,
             'enlace', enlace,
             'cuenta', cuenta_regresiva,
             'solo_socios', solo_socios,
             'donde', donde,
             'locales', to_jsonb(locales),
             'desde_nivel', desde_nivel,
             'destacada', destacada,
             'vigente', (hasta >= hoy and (desde is null or desde <= hoy)),
             'futura',  (desde is not null and desde > hoy),
             'vencida', (hasta < hoy))
           order by hasta desc, id desc)
      from club_promos where baja is null), '[]'::jsonb);
end;
$function$;


select 'Listo: la tienda adentro del Club (se llena sola en la próxima hora) y la promo destacada.' as "SQL 41";
