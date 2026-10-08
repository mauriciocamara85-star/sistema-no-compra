-- ══════════════════════════════════════════════════════════════════════════
-- VDH · HERMES MIRA LOS NO COMPRA
--
-- Correr en el editor SQL de Supabase. Al final muestra LA LLAVE DE HERMES:
-- copiala en ese momento (no se vuelve a mostrar) y pegala en el texto
-- "Hermes - tarea para pegarle.txt" del Escritorio, donde dice
-- PEGÁ_ACÁ_LA_LLAVE. Después le pegás ese texto a Hermes en su chat.
--
-- Cómo funciona: Hermes (en Hostinger) no recibe llamadas de afuera, así que
-- él pregunta cada 15 minutos con su llave, y la base le da los No Compra
-- que entraron desde la última vez. SÓLO la prenda —código, talle, color—,
-- el local, el motivo y la nota del local: nunca el nombre, el teléfono ni
-- el mail del cliente. Con eso cruza el stock de la tienda y de la fábrica.
--
--   hermes_llave         la huella (sha256) de la llave, nunca la llave; y
--                        hasta qué registro ya le dimos
--   hermes_llave_nueva   genera la llave (o una nueva, si se perdió: la
--                        anterior deja de servir)
--   hermes_no_compra     lo que llama Hermes
--
-- Para cortarle el acceso:  delete from hermes_llave;
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists hermes_llave (
  id         smallint primary key default 1 check (id = 1),
  huella     text not null,
  creada     timestamptz not null default now(),
  ultimo_id  bigint not null default 0,
  ultima_vez timestamptz
);
alter table hermes_llave enable row level security;
revoke all on table hermes_llave from anon, authenticated;

/* Una llave nueva: la devuelve UNA vez y guarda sólo su huella. Arranca
   desde el último registro: Hermes ve lo que entra de acá en adelante. */
create or replace function hermes_llave_nueva()
returns text language plpgsql volatile security definer set search_path = public as $$
declare llave text := 'vdh_hermes_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into hermes_llave (id, huella, ultimo_id)
  values (1, encode(extensions.digest(llave, 'sha256'), 'hex'), coalesce((select max(id) from registros), 0))
  on conflict (id) do update set huella = excluded.huella, creada = now();
  return llave;
end;
$$;
revoke all on function hermes_llave_nueva() from public, anon, authenticated;

/* Lo que pregunta Hermes. Sin p_desde: lo nuevo desde la última vez (y
   avanza). Con p_desde: lo que entró desde esa fecha, sin avanzar (para
   probar o para recuperar algo). */
create or replace function hermes_no_compra(p_llave text, p_desde timestamptz default null, p_limite integer default 50)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  h hermes_llave;
  filas jsonb;
  hasta bigint;
begin
  select * into h from hermes_llave where id = 1;
  if not found or h.huella <> encode(extensions.digest(coalesce(p_llave, ''), 'sha256'), 'hex') then
    raise exception 'Llave incorrecta.' using errcode = '28000';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) - 'orden' order by x.orden), '[]'::jsonb), max(x.orden)
    into filas, hasta
    from (
      select r.id as orden, r.id,
             to_char(r.creado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
             r.sucursal as local,
             nullif(trim(r.producto), '') as producto,
             nullif(trim(r.producto_codigo), '') as codigo,
             nullif(trim(r.talle), '') as talle,
             nullif(trim(r.color), '') as color,
             r.motivo::text as motivo,
             nullif(trim(r.obs), '') as nota
        from registros r
       where (p_desde is null and r.id > h.ultimo_id)
          or (p_desde is not null and r.creado >= p_desde)
       order by r.id
       limit greatest(1, least(coalesce(p_limite, 50), 200))
    ) x;
  update hermes_llave
     set ultima_vez = now(),
         ultimo_id = case when p_desde is null then greatest(ultimo_id, coalesce(hasta, ultimo_id)) else ultimo_id end
   where id = 1;
  return jsonb_build_object('cuantos', jsonb_array_length(filas), 'nuevos', filas);
end;
$$;
grant execute on function hermes_no_compra(text, timestamptz, integer) to anon, authenticated;

/* LA LLAVE DE HERMES: copiala ahora. Si la perdés, volvé a correr sólo esta
   línea y la anterior deja de servir. */
select hermes_llave_nueva() as "La llave de Hermes (copiala ahora: no se vuelve a mostrar)";
