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
