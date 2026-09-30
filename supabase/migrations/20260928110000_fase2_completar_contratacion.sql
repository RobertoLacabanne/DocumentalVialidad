-- =====================================================================
-- Fase 2: una contratación que ya estaba cargada pero sin trámite (por
-- ejemplo, la LP 05/2020 de la semilla) se completa al importar su hoja,
-- en lugar de tomarse como repetida. Lo que ya tenía no se pisa: solo se
-- llenan los datos vacíos, y si el expediente no coincide se avisa.
-- =====================================================================

create or replace function public.importar_contratacion(
  p_causa uuid,
  p_archivo text,
  p_hoja text,
  p_datos jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_existente public.contratacion;
  f jsonb;
  v_pasos integer := 0;
  v_ofertas integer := 0;
  v_completada boolean := false;
  v_expediente_distinto boolean := false;
  v_ident text := btrim(coalesce(p_datos ->> 'identificador', ''));
  v_expediente text := nullif(btrim(p_datos ->> 'expediente'), '');
begin
  if v_ident = '' then
    raise exception 'La contratación no tiene identificador (hoja %).', p_hoja;
  end if;

  select c.* into v_existente
    from public.contratacion c
   where c.causa_id = p_causa and upper(btrim(c.identificador)) = upper(v_ident) and c.archivado_en is null;

  if v_existente.id is not null then
    if exists (select 1 from public.paso_tramite p where p.contratacion_id = v_existente.id and p.archivado_en is null)
       or exists (select 1 from public.oferta o where o.contratacion_id = v_existente.id and o.archivado_en is null) then
      return jsonb_build_object('duplicada', true, 'contratacion', v_existente.id, 'identificador', v_ident);
    end if;

    v_expediente_distinto := v_existente.expediente is not null and v_expediente is not null
                             and btrim(v_existente.expediente) <> v_expediente;
    update public.contratacion c set
      expediente = coalesce(c.expediente, v_expediente),
      tipo_procedimiento = coalesce(c.tipo_procedimiento, nullif(btrim(p_datos ->> 'tipo_procedimiento'), '')),
      objeto = coalesce(c.objeto, nullif(btrim(p_datos ->> 'objeto'), '')),
      fecha_inicio = coalesce(c.fecha_inicio, nullif(p_datos ->> 'fecha_inicio', '')::date),
      fecha_inicio_texto = coalesce(c.fecha_inicio_texto, nullif(btrim(p_datos ->> 'fecha_inicio_texto'), '')),
      presupuesto_oficial = coalesce(c.presupuesto_oficial, nullif(p_datos ->> 'presupuesto_oficial', '')::numeric),
      reserva_presupuestaria = coalesce(c.reserva_presupuestaria, nullif(p_datos ->> 'reserva_presupuestaria', '')::numeric),
      origen = coalesce(c.origen, '{}'::jsonb) || jsonb_build_object('archivo', p_archivo, 'hoja', p_hoja)
     where c.id = v_existente.id;
    v_id := v_existente.id;
    v_completada := true;
  else
    insert into public.contratacion (
      causa_id, identificador, expediente, tipo_procedimiento, objeto, fecha_inicio, fecha_inicio_texto,
      presupuesto_oficial, reserva_presupuestaria, observaciones, origen)
    values (
      p_causa, v_ident, v_expediente, nullif(btrim(p_datos ->> 'tipo_procedimiento'), ''),
      nullif(btrim(p_datos ->> 'objeto'), ''), nullif(p_datos ->> 'fecha_inicio', '')::date,
      nullif(btrim(p_datos ->> 'fecha_inicio_texto'), ''),
      nullif(p_datos ->> 'presupuesto_oficial', '')::numeric, nullif(p_datos ->> 'reserva_presupuestaria', '')::numeric,
      nullif(btrim(p_datos ->> 'observaciones'), ''),
      jsonb_build_object('archivo', p_archivo, 'hoja', p_hoja))
    returning id into v_id;
  end if;

  for f in select value from jsonb_array_elements(coalesce(p_datos -> 'pasos', '[]'::jsonb)) loop
    insert into public.paso_tramite (
      causa_id, contratacion_id, orden, descripcion, fojas, fecha, fecha_precision, fecha_texto,
      firmante_texto, link, observaciones, origen)
    values (
      p_causa, v_id, (f ->> 'orden')::integer, btrim(f ->> 'descripcion'), nullif(btrim(f ->> 'fojas'), ''),
      nullif(f ->> 'fecha', '')::date, coalesce(nullif(f ->> 'fecha_precision', ''), 'sin_fecha'),
      nullif(btrim(f ->> 'fecha_texto'), ''), nullif(btrim(f ->> 'firmante_texto'), ''),
      nullif(btrim(f ->> 'link'), ''), nullif(f ->> 'observaciones', ''),
      jsonb_build_object('archivo', p_archivo, 'hoja', p_hoja, 'fila', f ->> 'fila'));
    v_pasos := v_pasos + 1;
  end loop;

  for f in select value from jsonb_array_elements(coalesce(p_datos -> 'ofertas', '[]'::jsonb)) loop
    insert into public.oferta (
      causa_id, contratacion_id, orden, oferente_texto, monto, fojas, link, observaciones, origen)
    values (
      p_causa, v_id, (f ->> 'orden')::integer, nullif(btrim(f ->> 'oferente_texto'), ''),
      nullif(f ->> 'monto', '')::numeric, nullif(btrim(f ->> 'fojas'), ''), nullif(btrim(f ->> 'link'), ''),
      nullif(f ->> 'observaciones', ''),
      jsonb_build_object('archivo', p_archivo, 'hoja', p_hoja, 'fila', f ->> 'fila'));
    v_ofertas := v_ofertas + 1;
  end loop;

  insert into public.importacion (causa_id, destino, archivo, hoja, filas_origen, filas_importadas, filas_omitidas, resumen)
  values (p_causa, 'contrataciones', p_archivo, p_hoja, coalesce((p_datos ->> 'filas_origen')::integer, v_pasos), v_pasos,
          greatest(coalesce((p_datos ->> 'filas_origen')::integer, v_pasos) - v_pasos, 0),
          jsonb_build_object('contratacion', v_id, 'identificador', v_ident, 'ofertas', v_ofertas, 'completada', v_completada));

  return jsonb_build_object('duplicada', false, 'contratacion', v_id, 'pasos', v_pasos, 'ofertas', v_ofertas,
                            'completada', v_completada, 'expediente_distinto', v_expediente_distinto);
end
$$;

revoke execute on function public.importar_contratacion(uuid, text, text, jsonb) from public, anon;
grant execute on function public.importar_contratacion(uuid, text, text, jsonb) to authenticated;
