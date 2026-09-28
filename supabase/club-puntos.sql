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
