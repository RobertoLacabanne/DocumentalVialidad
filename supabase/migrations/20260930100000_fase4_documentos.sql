-- =====================================================================
-- Fase 4: el texto de los escaneos, buscable, y sugerencias a validar.
--
-- Los archivos siguen en el Drive: acá se guarda solo su huella SHA-256,
-- cuándo se leyeron y el texto de cada página (de la capa de texto del
-- PDF, del OCR hecho en el navegador o del que trae AppUFIL). Lo que una
-- máquina propone (a qué efecto, contratación o persona corresponde un
-- documento) va a `sugerencia` y no toca ningún dato hasta que una
-- persona lo confirma.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Documento: un archivo leído. El mismo contenido (misma huella) es el
-- mismo documento aunque venga con otro nombre o desde otra carpeta.
-- ---------------------------------------------------------------------
create table public.documento (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  nombre text not null check (btrim(nombre) <> ''),
  -- Ruta dentro de la carpeta que se arrastró ("EFECTO 48435/PARTE 1.pdf") o la que traía AppUFIL.
  ruta text,
  bytes bigint check (bytes >= 0),
  tipo_mime text,
  paginas integer check (paginas >= 0),
  origen text not null default 'navegador' check (origen in ('navegador', 'appufil')),
  estado text not null default 'leyendo' check (estado in ('leyendo', 'completo')),
  indexado_en timestamptz,
  link text,
  efecto_id uuid references public.efecto (id),
  pieza_id uuid references public.pieza (id),
  observaciones text
);
alter table public.documento
  add column creado_en timestamptz not null default now(),
  add column creado_por uuid,
  add column actualizado_en timestamptz not null default now(),
  add column actualizado_por uuid,
  add column version integer not null default 1,
  add column archivado_en timestamptz,
  add column archivado_por uuid;
create unique index documento_huella_unica on public.documento (causa_id, sha256) where archivado_en is null;
create index documento_causa_idx on public.documento (causa_id, creado_en desc);
create index documento_efecto_idx on public.documento (efecto_id);

create trigger b_sellar before insert or update on public.documento
  for each row execute function public.t_sellar();
create trigger z_auditar after insert or update on public.documento
  for each row execute function public.t_auditar();
create trigger y_entidad after insert on public.documento
  for each row execute function public.t_registrar_entidad();
create trigger a_causa_fija before update on public.documento
  for each row execute function public.t_causa_fija();

-- La huella identifica al archivo original: no se corrige a mano.
create or replace function public.t_documento_huella()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sha256 is distinct from old.sha256 or new.bytes is distinct from old.bytes then
    raise exception 'La huella de un documento no se modifica: si el archivo es otro, se lee como documento nuevo.';
  end if;
  return new;
end
$$;
create trigger a_huella before update on public.documento
  for each row execute function public.t_documento_huella();

alter table public.documento enable row level security;
create policy miembros_leen on public.documento for select to authenticated
  using ((select public.es_miembro()));
create policy miembros_cargan on public.documento for insert to authenticated
  with check ((select public.es_miembro()));
create policy miembros_editan on public.documento for update to authenticated
  using ((select public.es_miembro())) with check ((select public.es_miembro()));
revoke delete, truncate on public.documento from anon, authenticated;

-- ---------------------------------------------------------------------
-- Texto de cada página. Es un derivado del original (se puede volver a
-- leer), así que no pasa por el historial página por página: el
-- documento sí, con su alta y cuando termina de leerse.
-- ---------------------------------------------------------------------
create table public.documento_pagina (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  documento_id uuid not null references public.documento (id),
  nro integer not null check (nro >= 1),
  texto text,
  metodo text not null check (metodo in ('capa_texto', 'ocr', 'appufil')),
  motor text,
  confianza numeric(5, 2) check (confianza between 0 and 100),
  leido_en timestamptz not null default now(),
  leido_por uuid default auth.uid(),
  busqueda tsvector generated always as (to_tsvector('public.es', coalesce(texto, ''))) stored,
  unique (documento_id, nro)
);
create index documento_pagina_busqueda_idx on public.documento_pagina using gin (busqueda);
create index documento_pagina_causa_idx on public.documento_pagina (causa_id);

alter table public.documento_pagina enable row level security;
create policy miembros_leen on public.documento_pagina for select to authenticated
  using ((select public.es_miembro()));
create policy miembros_cargan on public.documento_pagina for insert to authenticated
  with check ((select public.es_miembro()));
create policy miembros_editan on public.documento_pagina for update to authenticated
  using ((select public.es_miembro())) with check ((select public.es_miembro()));
revoke delete, truncate on public.documento_pagina from anon, authenticated;

-- Cuánto se leyó de cada documento y cómo.
create view public.documento_resumen with (security_invoker = true) as
select d.id as documento_id,
       d.causa_id,
       count(p.id)::integer as leidas,
       (count(p.id) filter (where length(btrim(coalesce(p.texto, ''))) >= 20))::integer as con_texto,
       round(avg(p.confianza) filter (where p.metodo = 'ocr'), 1) as confianza_ocr,
       coalesce(array_agg(distinct p.metodo) filter (where p.metodo is not null), '{}') as metodos,
       coalesce(sum(length(coalesce(p.texto, ''))), 0)::integer as caracteres
  from public.documento d
  left join public.documento_pagina p on p.documento_id = d.id
 group by d.id, d.causa_id;

-- ---------------------------------------------------------------------
-- registrar_documento(): da de alta un archivo leído, o devuelve el que
-- ya estaba con esa huella (para seguir leyendo donde se quedó).
-- ---------------------------------------------------------------------
create or replace function public.registrar_documento(p_causa uuid, p_datos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sha text := lower(btrim(p_datos ->> 'sha256'));
  v_doc public.documento;
  v_leidas integer;
begin
  if v_sha !~ '^[0-9a-f]{64}$' then
    raise exception 'La huella SHA-256 del archivo no es válida.';
  end if;
  select * into v_doc from public.documento
   where causa_id = p_causa and sha256 = v_sha and archivado_en is null;
  if not found then
    begin
      insert into public.documento (causa_id, sha256, nombre, ruta, bytes, tipo_mime, paginas, origen)
      values (
        p_causa, v_sha, btrim(p_datos ->> 'nombre'), nullif(btrim(p_datos ->> 'ruta'), ''),
        nullif(p_datos ->> 'bytes', '')::bigint, nullif(p_datos ->> 'tipo_mime', ''),
        nullif(p_datos ->> 'paginas', '')::integer, coalesce(nullif(p_datos ->> 'origen', ''), 'navegador'))
      returning * into v_doc;
      return jsonb_build_object('id', v_doc.id, 'ya_estaba', false, 'nombre', v_doc.nombre, 'leidas', 0, 'paginas', v_doc.paginas);
    exception when unique_violation then
      -- Otra persona lo registró en el mismo instante: se sigue con ese.
      select * into v_doc from public.documento
       where causa_id = p_causa and sha256 = v_sha and archivado_en is null;
    end;
  end if;
  select count(*) into v_leidas from public.documento_pagina where documento_id = v_doc.id;
  return jsonb_build_object('id', v_doc.id, 'ya_estaba', true, 'nombre', v_doc.nombre, 'leidas', v_leidas,
                            'paginas', v_doc.paginas, 'estado', v_doc.estado);
end
$$;
revoke execute on function public.registrar_documento(uuid, jsonb) from public, anon;
grant execute on function public.registrar_documento(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- guardar_paginas(): guarda el texto de varias páginas. Lo que ya estaba
-- leído no se pisa, salvo que se pida expresamente. Cuando están todas,
-- el documento queda completo con su fecha de indexado.
-- ---------------------------------------------------------------------
create or replace function public.guardar_paginas(p_documento uuid, p_paginas jsonb, p_reemplazar boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.documento;
  f jsonb;
  v_nro integer;
  v_filas integer;
  v_guardadas integer := 0;
  v_omitidas integer := 0;
  v_leidas integer;
  v_completo boolean := false;
begin
  select * into v_doc from public.documento where id = p_documento and archivado_en is null for update;
  if not found then
    raise exception 'No se encontró el documento.';
  end if;
  for f in select value from jsonb_array_elements(coalesce(p_paginas, '[]'::jsonb)) loop
    v_nro := (f ->> 'nro')::integer;
    if v_nro is null or v_nro < 1 or (v_doc.paginas is not null and v_nro > v_doc.paginas) then
      raise exception 'La página % no existe en «%».', coalesce(v_nro::text, '¿?'), v_doc.nombre;
    end if;
    if p_reemplazar then
      insert into public.documento_pagina (causa_id, documento_id, nro, texto, metodo, motor, confianza)
      values (v_doc.causa_id, v_doc.id, v_nro, f ->> 'texto', f ->> 'metodo', f ->> 'motor', nullif(f ->> 'confianza', '')::numeric)
      on conflict (documento_id, nro) do update
        set texto = excluded.texto, metodo = excluded.metodo, motor = excluded.motor,
            confianza = excluded.confianza, leido_en = now(), leido_por = auth.uid();
      v_guardadas := v_guardadas + 1;
    else
      insert into public.documento_pagina (causa_id, documento_id, nro, texto, metodo, motor, confianza)
      values (v_doc.causa_id, v_doc.id, v_nro, f ->> 'texto', f ->> 'metodo', f ->> 'motor', nullif(f ->> 'confianza', '')::numeric)
      on conflict (documento_id, nro) do nothing;
      get diagnostics v_filas = row_count;
      v_guardadas := v_guardadas + v_filas;
      v_omitidas := v_omitidas + (1 - v_filas);
    end if;
  end loop;
  select count(*) into v_leidas from public.documento_pagina where documento_id = v_doc.id;
  if v_doc.paginas is not null and v_leidas >= v_doc.paginas then
    v_completo := true;
    if v_doc.estado <> 'completo' then
      update public.documento set estado = 'completo', indexado_en = now() where id = v_doc.id;
    end if;
  end if;
  return jsonb_build_object('guardadas', v_guardadas, 'omitidas', v_omitidas, 'leidas', v_leidas, 'completo', v_completo);
end
$$;
revoke execute on function public.guardar_paginas(uuid, jsonb, boolean) from public, anon;
grant execute on function public.guardar_paginas(uuid, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Sugerencias: de dónde salen y sin repetirse. Una sugerencia descartada
-- no vuelve a aparecer si el documento se lee de nuevo.
-- ---------------------------------------------------------------------
alter table public.sugerencia drop constraint if exists sugerencia_fuente_check;
alter table public.sugerencia add constraint sugerencia_fuente_check
  check (fuente in ('ocr', 'ia', 'importacion', 'drive', 'otro', 'texto', 'carpeta', 'appufil'));
create unique index sugerencia_unica on public.sugerencia (entidad_id, campo, valor_sugerido)
  where archivado_en is null;

create or replace function public.guardar_sugerencias(p_causa uuid, p_entidad uuid, p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f jsonb;
  v_filas integer;
  v_nuevas integer := 0;
begin
  if not exists (select 1 from public.entidad where id = p_entidad and causa_id = p_causa) then
    raise exception 'La ficha no es de esta causa.';
  end if;
  for f in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if f ->> 'campo' not in ('efecto_id', 'pieza_id', 'vinculo') then
      raise exception 'No se sugiere el campo %.', f ->> 'campo';
    end if;
    insert into public.sugerencia (causa_id, entidad_id, campo, valor_sugerido, fuente, detalle)
    values (p_causa, p_entidad, f ->> 'campo', f -> 'valor', f ->> 'fuente', f ->> 'detalle')
    on conflict (entidad_id, campo, valor_sugerido) where archivado_en is null do nothing;
    get diagnostics v_filas = row_count;
    v_nuevas := v_nuevas + v_filas;
  end loop;
  return v_nuevas;
end
$$;
revoke execute on function public.guardar_sugerencias(uuid, uuid, jsonb) from public, anon;
grant execute on function public.guardar_sugerencias(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- resolver_sugerencia(): una persona la confirma (y recién ahí se aplica)
-- o la descarta. Queda quién y cuándo.
-- ---------------------------------------------------------------------
create or replace function public.resolver_sugerencia(p_id uuid, p_aceptar boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_s public.sugerencia;
  v_tipo text;
  v_destino uuid;
  v_actual uuid;
begin
  select * into v_s from public.sugerencia where id = p_id and archivado_en is null for update;
  if not found then
    raise exception 'No se encontró la sugerencia.';
  end if;
  if v_s.estado <> 'pendiente' then
    raise exception 'Esa sugerencia ya se resolvió.';
  end if;
  if p_aceptar then
    select tipo into v_tipo from public.entidad where id = v_s.entidad_id;
    v_destino := (v_s.valor_sugerido ->> 'id')::uuid;
    if v_s.campo in ('efecto_id', 'pieza_id') then
      if v_tipo <> 'documento' then
        raise exception 'Esa sugerencia no se aplica a esta ficha.';
      end if;
      execute format('select %I from public.documento where id = $1', v_s.campo) into v_actual using v_s.entidad_id;
      if v_actual is not null and v_actual <> v_destino then
        raise exception 'El documento ya está asociado a otra ficha: cambialo desde su ficha si corresponde.';
      end if;
      execute format('update public.documento set %I = $1 where id = $2', v_s.campo) using v_destino, v_s.entidad_id;
    elsif v_s.campo = 'vinculo' then
      if not exists (
        select 1 from public.vinculo
         where archivado_en is null and tipo = 'relacionado'
           and ((origen_id = v_s.entidad_id and destino_id = v_destino)
             or (origen_id = v_destino and destino_id = v_s.entidad_id))
      ) then
        insert into public.vinculo (causa_id, origen_id, destino_id, tipo, nota)
        values (v_s.causa_id, v_s.entidad_id, v_destino, 'relacionado', coalesce(v_s.detalle, 'Sugerido por el texto del documento'));
      end if;
    end if;
  end if;
  update public.sugerencia
     set estado = case when p_aceptar then 'aceptada' else 'descartada' end,
         resuelta_por = auth.uid(), resuelta_en = now()
   where id = p_id;
  return jsonb_build_object('estado', case when p_aceptar then 'aceptada' else 'descartada' end);
end
$$;
revoke execute on function public.resolver_sugerencia(uuid, boolean) from public, anon;
grant execute on function public.resolver_sugerencia(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- guardar_campo(): el documento también se edita desde su ficha (link,
-- observaciones, efecto). Misma función, con `documento` en la lista.
-- ---------------------------------------------------------------------
create or replace function public.guardar_campo(
  p_tabla text,
  p_id uuid,
  p_campo text,
  p_valor_anterior jsonb,
  p_valor_nuevo jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  editables constant text[] := array[
    'miembro', 'causa', 'procedimiento', 'informe', 'efecto', 'conversacion', 'mensaje',
    'marca', 'pieza', 'enlace', 'persona', 'identificador', 'rol_en_causa', 'contratacion',
    'paso_tramite', 'oferta', 'incidencia_procesal', 'incidencia_alcance',
    'ofrecimiento_item', 'acto_procesal', 'vinculo', 'tarea', 'sugerencia', 'documento'];
  prohibidos constant text[] := array[
    'id', 'causa_id', 'creado_en', 'creado_por', 'actualizado_en', 'actualizado_por',
    'version', 'archivado_por', 'busqueda', 'orden_clave', 'numero_clave', 'hash_contenido',
    'user_id', 'ultimo_ingreso', 'sha256', 'bytes', 'indexado_en'];
  v_filas integer;
  v_fila jsonb;
begin
  if not (p_tabla = any (editables)) then
    raise exception 'La tabla % no se edita desde la app.', p_tabla;
  end if;
  if p_campo = any (prohibidos) then
    raise exception 'El campo % no se edita a mano.', p_campo;
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = p_tabla and column_name = p_campo
  ) then
    raise exception 'El campo %.% no existe.', p_tabla, p_campo;
  end if;

  execute format(
    'update public.%1$I t
        set %2$I = (jsonb_populate_record(null::public.%1$I, jsonb_build_object(%3$L, $1))).%2$I
      where t.id = $2 and to_jsonb(t.%2$I) is not distinct from $3',
    p_tabla, p_campo, p_campo)
  using p_valor_nuevo, p_id, p_valor_anterior;
  get diagnostics v_filas = row_count;

  execute format('select to_jsonb(t) - ''busqueda'' from public.%I t where t.id = $1', p_tabla)
    into v_fila
    using p_id;
  if v_fila is null then
    raise exception 'No se encontró la ficha o no tenés acceso.';
  end if;

  return jsonb_build_object('ok', v_filas = 1, 'fila', v_fila);
end
$$;

-- ---------------------------------------------------------------------
-- Búsqueda global: suma los documentos (por nombre) y el texto de sus
-- páginas. Primero se eligen las páginas que más coinciden y recién
-- después se arma el fragmento, para que ande con miles de páginas.
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
  ),
  paginas as (
    select dp.id, dp.documento_id, dp.nro, dp.texto, dp.metodo, ts_rank(dp.busqueda, q.consulta) as rango
      from public.documento_pagina dp
      join public.documento d on d.id = dp.documento_id, q
     where dp.causa_id = p_causa and d.archivado_en is null and dp.busqueda @@ q.consulta
     order by rango desc
     limit p_limite
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
    union all
    select 'documento', d.id, d.nombre, coalesce(d.ruta, ''), d.nombre, 0.5::real
      from public.documento d, q
     where d.causa_id = p_causa and d.archivado_en is null and length(q.plano) >= 3
       and public.sin_tildes(lower(coalesce(d.ruta, d.nombre))) like '%' || q.plano || '%'
    union all
    select 'pagina', pg.id,
           d.nombre || ' · pág. ' || pg.nro,
           case pg.metodo when 'ocr' then 'Leído por OCR' when 'appufil' then 'Leído por AppUFIL' else 'Texto del PDF' end,
           ts_headline('public.es', coalesce(pg.texto, ''), q.consulta,
                       'StartSel=⟦, StopSel=⟧, MaxWords=26, MinWords=8, MaxFragments=1'),
           pg.rango * 0.9
      from paginas pg
      join public.documento d on d.id = pg.documento_id, q
  ) r (tipo, id, titulo, detalle, fragmento, rango)
  order by r.rango desc
  limit p_limite
$$;
revoke execute on function public.buscar(uuid, text, integer) from public, anon;
grant execute on function public.buscar(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- Tiempo real: el alta y el fin de lectura de cada documento llegan
-- solos al resto (las páginas no, para no inundar el canal).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.documento;
  end if;
end
$$;
