-- =====================================================================
-- registrar_ingreso(): el primer ingreso no choca consigo mismo.
--
-- Al volver de Google la app podía verificar la cuenta dos veces casi a la
-- vez. Con la lista de invitados vacía, las dos llamadas intentaban dar de
-- alta al primer miembro y la segunda fallaba con "duplicate key ...
-- miembro_email_key". Ahora el alta inicial se hace de a una (bloqueo
-- consultivo durante la transacción) y, por las dudas, sin fallar si el
-- correo ya existe.
-- =====================================================================
create or replace function public.registrar_ingreso()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nombre text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name');
  v_miembro public.miembro;
begin
  if auth.uid() is null or v_email = '' then
    return jsonb_build_object('habilitado', false);
  end if;

  if not exists (select 1 from public.miembro) then
    perform pg_advisory_xact_lock(hashtext('public.registrar_ingreso:primer_ingreso'));
    if not exists (select 1 from public.miembro) then
      insert into public.miembro (email, nombre, invitado_por)
      values (v_email, v_nombre, 'primer ingreso')
      on conflict (email) do nothing;
    end if;
  end if;

  update public.miembro
     set user_id = auth.uid(),
         ultimo_ingreso = now(),
         nombre = coalesce(nombre, v_nombre)
   where email = v_email and activo and archivado_en is null
  returning * into v_miembro;

  if v_miembro.id is null then
    return jsonb_build_object('habilitado', false, 'email', v_email);
  end if;
  return jsonb_build_object('habilitado', true, 'miembro', to_jsonb(v_miembro));
end
$$;

revoke execute on function public.registrar_ingreso() from public, anon;
grant execute on function public.registrar_ingreso() to authenticated;
