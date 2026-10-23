-- ════════════════════════════════════════════════════════════════════════
-- Migración 55 (SQL 162, 23/10/2026, pedido de Mauricio): el que dio de
-- alta otro entra apenas crea su PIN, sin esperar aprobación.
--   · Para el cambio de Ventas al sistema (lunes 26/10) se cargan de una los
--     encargados y vendedores de los 14 locales, con la lista que pasan los
--     supervisores: "son 40… hay que sacar esa parte de que yo los apruebe".
--   · Vale para todo el que dio de alta otro: un administrador, su encargado
--     o la lista. Crea su PIN y entra, en el Sistema VDH y en Equipo VDH (las
--     dos entran por la función entrar, con el mismo PIN).
--   · El que se anotó solo (alta_propia) sigue como antes: crea su PIN y
--     espera el OK de su supervisor o de un administrador.
--   · El riesgo que se acepta: alguien del local podría crear el PIN de un
--     compañero antes que él. Si pasa, se le borra el PIN y lo crea de nuevo.
--   · Sólo cambia ese pedazo de orden_login_probar; el resto queda igual.
-- ════════════════════════════════════════════════════════════════════════

create or replace function orden_login_probar(p_persona uuid, p_pin text, p_apellido text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins; v_creado boolean := false; v_ap text; v_vend boolean;
        v_rol int; v_dig int; v_espera interval;
begin
  select * into p from orden_personas where id = p_persona and activo;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  -- SQL 135: con la casilla de Atención, 6 números.
  v_rol := orden_pin_digitos(p.rol, p.tambien_atencion);
  select * into k from orden_pins where persona_id = p.id for update;
  if not found then
    insert into orden_pins (persona_id, hash) values (p.id, null) returning * into k;
  end if;
  /* Con cuántos números se prueba: el que ya tiene PIN, con los de su PIN (los de antes, 4); el que lo crea, con los de su rol. */
  v_dig := case when k.hash is null then v_rol else coalesce(k.digitos, 4) end;

  if k.hash is null then
    if coalesce(p_pin, '') !~ ('^[0-9]{' || v_rol || '}$') then
      return jsonb_build_object('ok', false, 'crear', true, 'digitos', v_rol, 'porque', 'El PIN tiene que tener ' || v_rol || ' números.');
    end if;
    /* Al crear su PIN, el que no tenía apellido lo deja (si lo mandó y sirve).
       Se anota que lo puso al crear el PIN: si después resulta que no era él,
       se lo saca. */
    if nullif(trim(coalesce(p.apellido, '')), '') is null and p_apellido is not null then
      v_ap := orden_nombre_prolijo(p_apellido);
      if v_ap is null then
        return jsonb_build_object('ok', false, 'crear', true, 'porque', 'Revisá el apellido: sólo letras, de 2 a 30.');
      end if;
      update orden_personas set apellido = v_ap, inicial = left(v_ap, 1), apellido_por_pin = true where id = p.id returning * into p;
    end if;
    update orden_pins set hash = crypt(p_pin, gen_salt('bf', 8)), digitos = v_rol, fallos = 0, bloqueado_hasta = null,
                          nivel_freno = 0, cambiado_en = now()
     where persona_id = p.id returning * into k;
    v_dig := v_rol;
    v_creado := true;
    /* SQL 162: si a esta persona la dio de alta otro (un administrador, su
       encargado o la lista de cada local), crear el PIN alcanza para entrar.
       El que se anotó solo espera el OK de su supervisor o de un
       administrador: cualquiera con el enlace podría crearlo en nombre de
       otro. Un administrador también, salvo que no haya otro. */
    if p.alta_propia
       and (p.rol <> 'admin'
            or exists (select 1 from orden_personas o where o.rol = 'admin' and o.activo and o.aprobado
                         and o.auth_user_id is not null and o.id <> p.id)) then
      update orden_personas set aprobado = false where id = p.id returning * into p;
      v_vend := p.rol = 'vendedor';
      perform orden_avisar_responsables(p.local_id, case when v_vend then 'supervisores' else 'admins' end, 'alta_pendiente',
        orden_nombre_lista(p.nombre, p.inicial) || ' creó su PIN en ' || coalesce((select nombre from orden_locales where id = p.local_id), 'Equipo VDH'),
        case when v_vend
             then 'Confirmá en persona que fue quien lo creó y aprobalo en Equipo. Si no fue, tocá "No fue": se borra ese PIN.'
             else 'Confirmá en persona que fue quien lo creó y aprobalo en la administración (Ajustes → Personas). Si no fue, tocá "Borrar PIN".' end,
        case when v_vend then '/equipo' else '/perfil' end,
        'aprobar:' || p.id || ':' || floor(extract(epoch from now())), 2::smallint);
    else
      update orden_personas set aprobado = true where id = p.id returning * into p;
    end if;
  elsif k.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'espera', ceil(extract(epoch from k.bloqueado_hasta - now()))::int,
                              'porque', 'Pusiste mal el PIN muchas veces. Esperá ' || orden_texto_espera(k.bloqueado_hasta - now()) || ' y probá de nuevo.');
  elsif not (coalesce(p_pin, '') ~ ('^[0-9]{' || v_dig || '}$') and crypt(p_pin, k.hash) = k.hash) then
    if v_rol = 6 then
      /* Admin, Atención y gerencia (y el vendedor que atiende clientes): cada
         5 mal seguidos, más espera (5 min, 30 min, 24 h). A las 24 h se avisa
         a los administradores. */
      if k.fallos + 1 >= 5 then
        v_espera := case when k.nivel_freno = 0 then interval '5 minutes' when k.nivel_freno = 1 then interval '30 minutes' else interval '24 hours' end;
        update orden_pins set fallos = 0, nivel_freno = least(nivel_freno + 1, 3), bloqueado_hasta = now() + v_espera
         where persona_id = p.id returning * into k;
        if k.nivel_freno >= 3 then
          perform orden_avisar_responsables(null, 'admins', 'pin_probando',
            'Alguien está probando PINs de ' || orden_nombre_lista(p.nombre, p.inicial),
            'Pusieron mal su PIN muchas veces seguidas: quedó trabado 24 horas. Si no fue esa persona, borrale el PIN y que cree uno nuevo.',
            '/perfil', 'pin-probando:' || p.id || ':' || to_char(now(), 'YYYYMMDDHH24'), 2::smallint);
        end if;
        return jsonb_build_object('ok', false, 'espera', ceil(extract(epoch from v_espera))::int,
                                  'porque', 'Pusiste mal el PIN 5 veces. Esperá ' || orden_texto_espera(v_espera) || ' y probá de nuevo.');
      end if;
      update orden_pins set fallos = fallos + 1 where persona_id = p.id returning * into k;
      return jsonb_build_object('ok', false, 'restantes', 5 - k.fallos, 'porque', 'PIN incorrecto.');
    end if;
    -- PIN mal: se anota. Al 5.º seguido, 5 minutos de espera (y vuelve a contar de cero).
    update orden_pins
       set fallos = case when fallos + 1 >= 5 then 0 else fallos + 1 end,
           bloqueado_hasta = case when fallos + 1 >= 5 then now() + interval '5 minutes' end
     where persona_id = p.id
    returning * into k;
    if k.bloqueado_hasta is not null then
      return jsonb_build_object('ok', false, 'espera', 300,
                                'porque', 'Pusiste mal el PIN 5 veces. Esperá 5 minutos y probá de nuevo.');
    end if;
    return jsonb_build_object('ok', false, 'restantes', 5 - k.fallos, 'porque', 'PIN incorrecto.');
  end if;

  if not v_creado then
    update orden_pins set fallos = 0, bloqueado_hasta = null, nivel_freno = 0 where persona_id = p.id;
  end if;
  return jsonb_build_object('ok', true, 'creado', v_creado, 'persona_id', p.id, 'auth_user_id', p.auth_user_id,
                            'mail', orden_mail_cuenta(p.id), 'clave', k.clave_cuenta,
                            'nombre', p.nombre, 'rol', p.rol, 'local_id', p.local_id, 'aprobado', p.aprobado,
                            /* Su PIN tiene menos números de los que pide su rol: la app le pide uno nuevo ya. */
                            'cambiar_pin', v_dig < v_rol, 'digitos', v_rol);
end $$;
