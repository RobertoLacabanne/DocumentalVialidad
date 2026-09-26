-- =====================================================================
-- Fase 2: contrataciones (trámite y ofertas) y mensajes (lector,
-- relevantes, informe). Importación atómica desde planillas y
-- transcripciones, sin completar nada por deducción.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Contrataciones: lo que traen las planillas del equipo
-- ---------------------------------------------------------------------
alter table public.contratacion
  add column fecha_inicio date,
  add column fecha_inicio_texto text,
  add column link text;

-- La fecha tal cual figura en el expediente ("entre el 11 y 17/3/2020",
-- "febrero 2020"). La columna fecha solo se llena cuando es inequívoca.
alter table public.paso_tramite add column fecha_texto text;

alter table public.oferta
  add column fojas text,
  add column orden integer;

create unique index contratacion_identificador_unico
  on public.contratacion (causa_id, upper(btrim(identificador)))
  where archivado_en is null;

-- Un mismo vínculo no se carga dos veces.
create unique index vinculo_unico
  on public.vinculo (origen_id, destino_id, tipo)
  where archivado_en is null;

-- ---------------------------------------------------------------------
-- Mensajes: fecha del mensaje (sin hora cuando la transcripción no la
-- trae) y protección de todo lo que es transcripción.
-- ---------------------------------------------------------------------
alter table public.mensaje add column fecha date;
create index mensaje_fecha_idx on public.mensaje (causa_id, fecha);
create index mensaje_orden_idx on public.mensaje (conversacion_id, orden);

-- Cuántos mensajes tiene cada conversación, cuántos están marcados y qué
-- período abarcan. Respeta los permisos de quien consulta.
create view public.conversacion_resumen
with (security_invoker = true)
as
select c.id as conversacion_id,
       c.causa_id,
       count(m.id) as mensajes,
       count(m.id) filter (where m.relevante) as relevantes,
       min(m.fecha) as primera_fecha,
       max(m.fecha) as ultima_fecha
  from public.conversacion c
  left join public.mensaje m on m.conversacion_id = c.id and m.archivado_en is null
 where c.archivado_en is null
 group by c.id, c.causa_id;

grant select on public.conversacion_resumen to authenticated;
revoke all on public.conversacion_resumen from anon;

create or replace function public.t_mensaje_literal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.hash_contenido := encode(extensions.digest(coalesce(new.contenido, ''), 'sha256'), 'hex');
    return new;
  end if;
  if new.contenido is distinct from old.contenido
     or new.emisor is distinct from old.emisor
     or new.receptor is distinct from old.receptor
     or new.fecha_hora is distinct from old.fecha_hora
     or new.fecha_hora_texto is distinct from old.fecha_hora_texto
     or new.fecha is distinct from old.fecha
     or new.orden is distinct from old.orden
     or new.tipo is distinct from old.tipo
     or new.hash_contenido is distinct from old.hash_contenido
     or new.conversacion_id is distinct from old.conversacion_id then
    raise exception 'La transcripción es literal: no se puede modificar. Se puede marcar como relevante u observar.';
  end if;
  return new;
end
$$;

-- La importación registra también contrataciones y conversaciones.
alter table public.importacion drop constraint importacion_destino_check;
alter table public.importacion
  add constraint importacion_destino_check check (destino in ('efectos', 'contrataciones', 'conversacion'));

-- ---------------------------------------------------------------------
-- importar_contratacion(): una hoja de la planilla = una contratación,
-- con sus pasos y sus ofertas, en una sola transacción.
-- p_datos = {identificador, expediente, tipo_procedimiento, objeto,
--            fecha_inicio, fecha_inicio_texto, presupuesto_oficial,
--            reserva_presupuestaria, pasos: [...], ofertas: [...]}
-- ---------------------------------------------------------------------
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
  v_existente uuid;
  f jsonb;
  v_pasos integer := 0;
  v_ofertas integer := 0;
  v_ident text := btrim(coalesce(p_datos ->> 'identificador', ''));
begin
  if v_ident = '' then
    raise exception 'La contratación no tiene identificador (hoja %).', p_hoja;
  end if;

  select c.id into v_existente
    from public.contratacion c
   where c.causa_id = p_causa and upper(btrim(c.identificador)) = upper(v_ident) and c.archivado_en is null;
  if v_existente is not null then
    return jsonb_build_object('duplicada', true, 'contratacion', v_existente, 'identificador', v_ident);
  end if;

  insert into public.contratacion (
    causa_id, identificador, expediente, tipo_procedimiento, objeto, fecha_inicio, fecha_inicio_texto,
    presupuesto_oficial, reserva_presupuestaria, observaciones, origen)
  values (
    p_causa, v_ident, nullif(btrim(p_datos ->> 'expediente'), ''), nullif(btrim(p_datos ->> 'tipo_procedimiento'), ''),
    nullif(btrim(p_datos ->> 'objeto'), ''), nullif(p_datos ->> 'fecha_inicio', '')::date,
    nullif(btrim(p_datos ->> 'fecha_inicio_texto'), ''),
    nullif(p_datos ->> 'presupuesto_oficial', '')::numeric, nullif(p_datos ->> 'reserva_presupuestaria', '')::numeric,
    nullif(btrim(p_datos ->> 'observaciones'), ''),
    jsonb_build_object('archivo', p_archivo, 'hoja', p_hoja))
  returning id into v_id;

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
          jsonb_build_object('contratacion', v_id, 'identificador', v_ident, 'ofertas', v_ofertas));

  return jsonb_build_object('duplicada', false, 'contratacion', v_id, 'pasos', v_pasos, 'ofertas', v_ofertas);
end
$$;

revoke execute on function public.importar_contratacion(uuid, text, text, jsonb) from public, anon;
grant execute on function public.importar_contratacion(uuid, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- importar_conversacion(): una transcripción = una conversación con sus
-- mensajes literales, en una sola transacción. Las notas al pie de la
-- transcripción entran como observación del mensaje, nunca en su texto.
-- ---------------------------------------------------------------------
create or replace function public.importar_conversacion(p_causa uuid, p_archivo text, p_datos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  f jsonb;
  v_mensajes integer := 0;
begin
  if coalesce(btrim(p_datos ->> 'titulo'), '') = '' then
    raise exception 'La conversación necesita un título.';
  end if;
  if jsonb_array_length(coalesce(p_datos -> 'mensajes', '[]'::jsonb)) = 0 then
    raise exception 'La conversación no tiene mensajes.';
  end if;

  insert into public.conversacion (
    causa_id, efecto_id, informe_id, titulo, participantes, titular_dispositivo, contacto_relevante,
    agendado_como, periodo_desde, periodo_hasta, observaciones, origen)
  values (
    p_causa, nullif(p_datos ->> 'efecto_id', '')::uuid, nullif(p_datos ->> 'informe_id', '')::uuid,
    btrim(p_datos ->> 'titulo'), nullif(btrim(p_datos ->> 'participantes'), ''),
    nullif(btrim(p_datos ->> 'titular_dispositivo'), ''), nullif(btrim(p_datos ->> 'contacto_relevante'), ''),
    nullif(btrim(p_datos ->> 'agendado_como'), ''), nullif(p_datos ->> 'periodo_desde', '')::date,
    nullif(p_datos ->> 'periodo_hasta', '')::date, nullif(p_datos ->> 'observaciones', ''),
    jsonb_build_object('archivo', p_archivo))
  returning id into v_id;

  for f in select value from jsonb_array_elements(p_datos -> 'mensajes') loop
    insert into public.mensaje (
      causa_id, conversacion_id, orden, fecha, fecha_hora_texto, emisor, receptor, tipo, contenido, observacion, origen)
    values (
      p_causa, v_id, (f ->> 'orden')::integer, nullif(f ->> 'fecha', '')::date, nullif(f ->> 'fecha_texto', ''),
      nullif(btrim(f ->> 'emisor'), ''), nullif(btrim(f ->> 'receptor'), ''),
      coalesce(nullif(f ->> 'tipo', ''), 'texto'), f ->> 'contenido', nullif(f ->> 'observacion', ''),
      jsonb_build_object('archivo', p_archivo, 'linea', f ->> 'linea'));
    v_mensajes := v_mensajes + 1;
  end loop;

  insert into public.importacion (causa_id, destino, archivo, filas_origen, filas_importadas, filas_omitidas, resumen)
  values (p_causa, 'conversacion', p_archivo, coalesce((p_datos ->> 'lineas_origen')::integer, v_mensajes), v_mensajes,
          greatest(coalesce((p_datos ->> 'lineas_origen')::integer, v_mensajes) - v_mensajes, 0),
          jsonb_build_object('conversacion', v_id));

  return jsonb_build_object('conversacion', v_id, 'mensajes', v_mensajes);
end
$$;

revoke execute on function public.importar_conversacion(uuid, text, jsonb) from public, anon;
grant execute on function public.importar_conversacion(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Tiempo real: el marcado de mensajes relevantes llega solo al resto.
-- (Se escuchan solo los cambios de los mensajes, no las altas masivas.)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mensaje;
  end if;
end
$$;
