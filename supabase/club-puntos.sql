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
