-- =====================================================================
-- Fase 1: efectos como vienen en las planillas, importaciones y búsqueda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Efecto: los campos que traen LISTADO EFECTOS y DISTRIBUCIÓN DE TAREAS
-- ---------------------------------------------------------------------
alter table public.efecto
  add column soporte text check (soporte in ('papel', 'digital')),
  add column requiere_escribiente boolean not null default true,
  add column responsable_alias text,
  add column lugar_secuestro text,
  add column tiene_informe_gabinete boolean,
  add column observaciones_gabinete text;

-- "¿Apto para analizar?" tiene tres respuestas en la planilla: SI, NO y NO REQUIERE ANÁLISIS.
alter table public.efecto
  alter column apto_analisis type text
  using case when apto_analisis is null then null when apto_analisis then 'si' else 'no' end;
alter table public.efecto
  add constraint efecto_apto_analisis_check check (apto_analisis in ('si', 'no', 'no_requiere_analisis'));

-- La búsqueda del efecto suma el lugar de secuestro y lo que dice el gabinete.
drop index if exists public.efecto_busqueda_idx;
alter table public.efecto drop column busqueda;
alter table public.efecto add column busqueda tsvector generated always as (
  setweight(to_tsvector('public.es', coalesce(numero, '') || ' ' || coalesce(sobre, '') || ' ' || coalesce(numero_interno, '')), 'A') ||
  setweight(to_tsvector('public.es', coalesce(descripcion_acta, '')), 'B') ||
  setweight(to_tsvector('public.es', coalesce(propietario, '') || ' ' || coalesce(tenedor, '') || ' ' || coalesce(lugar_secuestro, '')), 'C') ||
  setweight(to_tsvector('public.es', coalesce(observaciones, '') || ' ' || coalesce(observaciones_gabinete, '') || ' ' || coalesce(ubicacion_fisica, '')), 'D')
) stored;
create index efecto_busqueda_idx on public.efecto using gin (busqueda);
create index efecto_estado_idx on public.efecto (causa_id, estado);

-- ---------------------------------------------------------------------
-- Responsables por alias: las planillas dicen AGUS, INES, CARLI, ROBER.
-- Si hay un miembro con ese alias, el efecto queda asignado a esa persona;
-- si todavía no lo hay, queda el alias y se asigna solo cuando lo inviten.
-- ---------------------------------------------------------------------
create or replace function public.t_efecto_resolver_alias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.responsable is null and new.responsable_alias is not null and btrim(new.responsable_alias) <> '' then
    select m.email into new.responsable
      from public.miembro m
     where upper(btrim(m.alias)) = upper(btrim(new.responsable_alias))
       and m.activo and m.archivado_en is null
     limit 1;
  end if;
  return new;
end
$$;

create trigger c_resolver_alias before insert or update of responsable_alias on public.efecto
  for each row execute function public.t_efecto_resolver_alias();

create or replace function public.t_miembro_alias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.alias is not null and btrim(new.alias) <> '' and new.activo and new.archivado_en is null then
    update public.efecto
       set responsable = new.email
     where responsable is null
       and responsable_alias is not null
       and upper(btrim(responsable_alias)) = upper(btrim(new.alias));
  end if;
  return null;
end
$$;

create trigger x_vincular_alias after insert or update of alias, activo on public.miembro
  for each row execute function public.t_miembro_alias();

-- ---------------------------------------------------------------------
-- Registro de cada importación: de qué archivo, cuántas filas y qué pasó.
-- ---------------------------------------------------------------------
create table public.importacion (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  destino text not null check (destino in ('efectos')),
  archivo text not null,
  hoja text,
  filas_origen integer not null check (filas_origen >= 0),
  filas_importadas integer not null check (filas_importadas >= 0),
  filas_omitidas integer not null check (filas_omitidas >= 0),
  resumen jsonb not null default '{}'::jsonb
);
alter table public.importacion
  add column creado_en timestamptz not null default now(),
  add column creado_por uuid,
  add column actualizado_en timestamptz not null default now(),
  add column actualizado_por uuid,
  add column version integer not null default 1,
  add column archivado_en timestamptz,
  add column archivado_por uuid;
create index importacion_causa_idx on public.importacion (causa_id, creado_en desc);

create trigger b_sellar before insert or update on public.importacion
  for each row execute function public.t_sellar();
create trigger z_auditar after insert or update on public.importacion
  for each row execute function public.t_auditar();
create trigger y_entidad after insert on public.importacion
  for each row execute function public.t_registrar_entidad();
create trigger a_causa_fija before update on public.importacion
  for each row execute function public.t_causa_fija();

alter table public.importacion enable row level security;
create policy miembros_leen on public.importacion for select to authenticated
  using ((select public.es_miembro()));
create policy miembros_cargan on public.importacion for insert to authenticated
  with check ((select public.es_miembro()));
revoke delete, truncate on public.importacion from anon, authenticated;

-- Dos personas del equipo no pueden compartir alias: la asignación automática
-- de los efectos importados depende de que el alias identifique a una sola.
create unique index if not exists miembro_alias_unico
  on public.miembro (upper(btrim(alias)))
  where alias is not null and archivado_en is null;

-- ---------------------------------------------------------------------
-- importar_efectos(): carga todas las filas en una sola transacción.
-- Las filas llegan ya revisadas por la persona en el asistente. No se
-- pisa nada: un número de efecto que ya existe queda como duplicado.
-- Agrupa procedimientos por fecha y domicilio, y vincula informes por número.
-- ---------------------------------------------------------------------
create or replace function public.importar_efectos(
  p_causa uuid,
  p_archivo text,
  p_hoja text,
  p_filas jsonb,
  p_filas_origen integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f jsonb;
  v_proc uuid;
  v_informe uuid;
  v_importadas integer := 0;
  v_duplicadas jsonb := '[]'::jsonb;
  v_procedimientos integer := 0;
  v_informes integer := 0;
  v_importacion uuid;
  v_fecha date;
  v_domicilio text;
begin
  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Las filas tienen que venir como lista.';
  end if;

  for f in select value from jsonb_array_elements(p_filas) loop
    if coalesce(btrim(f ->> 'numero'), '') = '' then
      raise exception 'Hay una fila sin número de efecto (fila % de la planilla).', f ->> 'fila';
    end if;

    if exists (
      select 1 from public.efecto e
       where e.causa_id = p_causa and e.numero = btrim(f ->> 'numero') and e.archivado_en is null
    ) then
      v_duplicadas := v_duplicadas || jsonb_build_array(jsonb_build_object('numero', btrim(f ->> 'numero'), 'fila', f ->> 'fila'));
      continue;
    end if;

    v_proc := null;
    v_fecha := nullif(f ->> 'procedimiento_fecha', '')::date;
    v_domicilio := nullif(btrim(coalesce(f ->> 'procedimiento_domicilio', '')), '');
    if v_fecha is not null or v_domicilio is not null then
      select p.id into v_proc
        from public.procedimiento p
       where p.causa_id = p_causa
         and p.fecha is not distinct from v_fecha
         and p.domicilio is not distinct from v_domicilio
         and p.archivado_en is null
       limit 1;
      if v_proc is null then
        insert into public.procedimiento (causa_id, fecha, domicilio, resolucion_autorizante, origen)
        values (p_causa, v_fecha, v_domicilio, nullif(f ->> 'resolucion_autorizante', ''),
                jsonb_build_object('archivo', p_archivo, 'hoja', p_hoja, 'fila', f ->> 'fila'))
        returning id into v_proc;
        v_procedimientos := v_procedimientos + 1;
      end if;
    end if;

    v_informe := null;
    if coalesce(btrim(f ->> 'informe_numero'), '') <> '' then
      select i.id into v_informe
        from public.informe i
       where i.causa_id = p_causa and upper(i.numero) = upper(btrim(f ->> 'informe_numero')) and i.archivado_en is null
       limit 1;
      if v_informe is null then
        insert into public.informe (causa_id, numero, tipo, organismo)
        values (p_causa, upper(btrim(f ->> 'informe_numero')), 'gabinete', 'Gabinete de Informática Forense')
        returning id into v_informe;
        v_informes := v_informes + 1;
      end if;
    end if;

    insert into public.efecto (
      causa_id, procedimiento_id, numero, numero_interno, sobre, soporte, tipo_material,
      descripcion_acta, propietario, tenedor, resolucion_autorizante, apto_analisis,
      informe_id, tiene_informe_gabinete, observaciones_gabinete, ubicacion_fisica,
      responsable_alias, requiere_escribiente, estado, prioridad, fojas_aprox,
      fecha_inicio, fecha_fin, link_escaneo, lugar_secuestro, patron_contrasena,
      observaciones, origen)
    values (
      p_causa, v_proc, btrim(f ->> 'numero'), nullif(f ->> 'numero_interno', ''), nullif(f ->> 'sobre', ''),
      nullif(f ->> 'soporte', ''), nullif(f ->> 'tipo_material', ''),
      nullif(f ->> 'descripcion_acta', ''), nullif(f ->> 'propietario', ''), nullif(f ->> 'tenedor', ''),
      nullif(f ->> 'resolucion_autorizante', ''), nullif(f ->> 'apto_analisis', ''),
      v_informe, (f ->> 'tiene_informe_gabinete')::boolean, nullif(f ->> 'observaciones_gabinete', ''),
      nullif(f ->> 'ubicacion_fisica', ''),
      nullif(f ->> 'responsable_alias', ''), coalesce((f ->> 'requiere_escribiente')::boolean, true),
      coalesce(nullif(f ->> 'estado', ''), 'sin_iniciar'), nullif(f ->> 'prioridad', ''),
      nullif(f ->> 'fojas_aprox', '')::integer,
      nullif(f ->> 'fecha_inicio', '')::date, nullif(f ->> 'fecha_fin', '')::date,
      nullif(f ->> 'link_escaneo', ''), nullif(f ->> 'lugar_secuestro', ''), nullif(f ->> 'patron_contrasena', ''),
      nullif(f ->> 'observaciones', ''),
      jsonb_build_object('archivo', p_archivo, 'hoja', p_hoja, 'fila', f ->> 'fila'));
    v_importadas := v_importadas + 1;
  end loop;

  insert into public.importacion (causa_id, destino, archivo, hoja, filas_origen, filas_importadas, filas_omitidas, resumen)
  values (
    p_causa, 'efectos', p_archivo, p_hoja, p_filas_origen, v_importadas,
    p_filas_origen - v_importadas,
    jsonb_build_object(
      'duplicadas', v_duplicadas,
      'procedimientos_creados', v_procedimientos,
      'informes_creados', v_informes))
  returning id into v_importacion;

  return jsonb_build_object(
    'importacion', v_importacion,
    'importadas', v_importadas,
    'duplicadas', v_duplicadas,
    'procedimientos_creados', v_procedimientos,
    'informes_creados', v_informes);
end
$$;

revoke execute on function public.importar_efectos(uuid, text, text, jsonb, integer) from public, anon;
grant execute on function public.importar_efectos(uuid, text, text, jsonb, integer) to authenticated;

-- ---------------------------------------------------------------------
-- Aplicar una situación procesal a varias fichas de una vez
-- (por ejemplo, todos los efectos alcanzados por una casación).
-- ---------------------------------------------------------------------
create or replace function public.aplicar_incidencia(p_incidencia uuid, p_entidades uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_causa uuid;
  v_agregadas integer;
begin
  select causa_id into v_causa from public.incidencia_procesal where id = p_incidencia;
  if v_causa is null then
    raise exception 'No se encontró la situación procesal.';
  end if;
  insert into public.incidencia_alcance (causa_id, incidencia_id, entidad_id)
  select v_causa, p_incidencia, e
    from unnest(p_entidades) as e
   where not exists (
     select 1 from public.incidencia_alcance a
      where a.incidencia_id = p_incidencia and a.entidad_id = e and a.archivado_en is null);
  get diagnostics v_agregadas = row_count;
  return v_agregadas;
end
$$;

revoke execute on function public.aplicar_incidencia(uuid, uuid[]) from public, anon;
grant execute on function public.aplicar_incidencia(uuid, uuid[]) to authenticated;

-- Situación procesal efectiva de cada efecto (propia o de su procedimiento).
create view public.efecto_estado_procesal
with (security_invoker = true)
as
with alcance as (
  select a.entidad_id, i.id as incidencia_id, i.titulo, i.situacion,
         case i.situacion when 'excluida' then 3 when 'pendiente_resolucion' then 2 when 'admisibilidad_cuestionada' then 1 else 0 end as gravedad
    from public.incidencia_alcance a
    join public.incidencia_procesal i on i.id = a.incidencia_id
   where a.archivado_en is null and i.archivado_en is null and i.situacion <> 'sin_efecto'
),
cadena as (
  select e.id as efecto_id, e.causa_id, e.id as entidad_id, 'efecto'::text as via from public.efecto e
  union all
  select e.id, e.causa_id, e.procedimiento_id, 'procedimiento' from public.efecto e where e.procedimiento_id is not null
)
select distinct on (c.efecto_id)
       c.efecto_id, c.causa_id, a.situacion, a.gravedad, a.titulo, a.incidencia_id, c.via
  from cadena c
  join alcance a on a.entidad_id = c.entidad_id
 order by c.efecto_id, a.gravedad desc;

-- ---------------------------------------------------------------------
-- Búsqueda global: también por teléfonos, alias agendados, CUIT y DNI.
-- ---------------------------------------------------------------------
create or replace function public.buscar(p_causa uuid, p_texto text, p_limite integer default 40)
returns table (tipo text, id uuid, titulo text, detalle text, fragmento text, rango real)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('public.es', p_texto) as consulta,
           public.sin_tildes(lower(btrim(p_texto))) as plano,
           regexp_replace(p_texto, '\D', '', 'g') as digitos
  )
  select * from (
    select 'pieza'::text, p.id,
           coalesce('Nº ' || p.numero_orden || ' · ', '') || p.titulo,
           p.tipo,
           ts_headline('public.es', coalesce(nullif(p.resumen, ''), p.titulo), q.consulta,
                       'StartSel=⟦, StopSel=⟧, MaxWords=26, MinWords=8, MaxFragments=1'),
           ts_rank(p.busqueda, q.consulta) + 0.1
      from public.pieza p, q
     where p.causa_id = p_causa and p.archivado_en is null
       and (p.busqueda @@ q.consulta or public.sin_tildes(lower(p.titulo)) like '%' || q.plano || '%')
    union all
    select 'mensaje', m.id,
           coalesce(m.emisor, '¿?') || ' → ' || coalesce(m.receptor, '¿?'),
           c.titulo,
           ts_headline('public.es', coalesce(m.contenido, ''), q.consulta,
                       'StartSel=⟦, StopSel=⟧, MaxWords=26, MinWords=8, MaxFragments=1'),
           ts_rank(m.busqueda, q.consulta)
      from public.mensaje m
      join public.conversacion c on c.id = m.conversacion_id, q
     where m.causa_id = p_causa and m.archivado_en is null and m.busqueda @@ q.consulta
    union all
    select 'efecto', e.id,
           'Efecto Nº ' || e.numero,
           coalesce(e.soporte, '') || coalesce(' · ' || e.tipo_material, ''),
           ts_headline('public.es',
                       concat_ws(' · ', e.descripcion_acta, e.propietario, e.tenedor, e.lugar_secuestro,
                                 e.observaciones, e.observaciones_gabinete, e.ubicacion_fisica),
                       q.consulta, 'StartSel=⟦, StopSel=⟧, MaxWords=26, MinWords=8, MaxFragments=2, FragmentDelimiter=" … "'),
           ts_rank(e.busqueda, q.consulta) + case when e.numero = btrim(p_texto) then 1 else 0.1 end
      from public.efecto e, q
     where e.causa_id = p_causa and e.archivado_en is null
       and (e.busqueda @@ q.consulta or e.numero = btrim(p_texto))
    union all
    select 'persona', pe.id, pe.nombre, coalesce(pe.cargo, ''), pe.nombre,
           greatest(ts_rank(pe.busqueda, q.consulta),
                    extensions.similarity(public.sin_tildes(lower(pe.nombre)), q.plano))
      from public.persona pe, q
     where pe.causa_id = p_causa and pe.archivado_en is null
       and (pe.busqueda @@ q.consulta
            or extensions.similarity(public.sin_tildes(lower(pe.nombre)), q.plano) > 0.3)
    union all
    select distinct on (pe.id) 'persona', pe.id, pe.nombre, 'figura como ' || i.valor, i.valor, 0.9::real
      from public.identificador i
      join public.persona pe on pe.id = i.persona_id, q
     where i.causa_id = p_causa and i.archivado_en is null and pe.archivado_en is null
       and (public.sin_tildes(lower(i.valor)) like '%' || q.plano || '%'
            or (length(q.digitos) >= 6 and regexp_replace(i.valor, '\D', '', 'g') like '%' || q.digitos || '%'))
    union all
    select 'contratacion', co.id,
           co.identificador || coalesce(' · Expte. ' || co.expediente, ''),
           coalesce(co.tipo_procedimiento, ''),
           ts_headline('public.es', coalesce(co.objeto, co.identificador), q.consulta,
                       'StartSel=⟦, StopSel=⟧, MaxWords=26, MinWords=8, MaxFragments=1'),
           ts_rank(co.busqueda, q.consulta) + 0.1
      from public.contratacion co, q
     where co.causa_id = p_causa and co.archivado_en is null
       and (co.busqueda @@ q.consulta or public.sin_tildes(lower(co.identificador)) like '%' || q.plano || '%')
  ) r (tipo, id, titulo, detalle, fragmento, rango)
  order by r.rango desc
  limit p_limite
$$;

revoke execute on function public.buscar(uuid, text, integer) from public, anon;
grant execute on function public.buscar(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- editables: la importación y los nuevos campos se editan desde la app.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.importacion;
  end if;
end
$$;
