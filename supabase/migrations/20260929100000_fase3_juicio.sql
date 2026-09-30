-- =====================================================================
-- Fase 3: preparación del juicio. Ofrecimiento de prueba con la lógica
-- de la planilla «Prueba a mostrar en debate con testigos», alertas
-- procesales, cronología unificada y actos procesales.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ofrecimiento: cada ítem es una pieza del índice (documental), una
-- persona (testigo o perito) o una prueba descripta a mano (informativa,
-- instrumental). El número de orden es por clase, como en el escrito.
-- ---------------------------------------------------------------------
alter table public.ofrecimiento_item
  alter column pieza_id drop not null,
  add column clase text not null default 'documental'
    check (clase in ('testimonial', 'pericial', 'documental', 'informativa', 'instrumental', 'otra')),
  add column persona_id uuid references public.persona (id),
  add column descripcion text,
  add column objeto text,
  add column incorporacion text check (incorporacion in ('exhibicion', 'lectura', 'no_se_incorpora')),
  add column admision text not null default 'pendiente' check (admision in ('pendiente', 'admitida', 'rechazada')),
  add column numero_auto text,
  add column impugnada boolean not null default false,
  add column motivo_impugnacion text,
  add column imputados uuid[] not null default '{}',
  add column todos_los_imputados boolean not null default false,
  add column tambien_ofrecida_por text[] not null default '{}',
  add column origen jsonb,
  drop column se_exhibe,
  add constraint ofrecimiento_algo_ofrecido check (
    pieza_id is not null or persona_id is not null or nullif(btrim(descripcion), '') is not null);

-- Una pieza o una persona se ofrecen una sola vez (por clase, en el caso de las personas).
create unique index ofrecimiento_pieza_unica
  on public.ofrecimiento_item (causa_id, pieza_id)
  where pieza_id is not null and archivado_en is null;
create unique index ofrecimiento_persona_unica
  on public.ofrecimiento_item (causa_id, persona_id, clase)
  where persona_id is not null and archivado_en is null;
create index ofrecimiento_clase_idx on public.ofrecimiento_item (causa_id, clase, numero_clave);

-- ---------------------------------------------------------------------
-- Estado de cada ítem para el armado del juicio: la situación procesal
-- que hereda la pieza y lo que falta resolver. Lo usa la pantalla para
-- avisar, y las pruebas para comprobarlo.
-- ---------------------------------------------------------------------
create view public.ofrecimiento_estado
with (security_invoker = true)
as
select o.id as item_id,
       o.causa_id,
       ep.situacion,
       ep.titulo as incidencia,
       ep.via,
       (o.incorporacion = 'exhibicion' and o.introduce_id is null) as falta_quien_introduce,
       (not o.entregada_defensa and o.clase in ('documental', 'informativa', 'instrumental', 'otra')) as sin_entregar,
       o.impugnada,
       (o.admision = 'rechazada') as rechazada
  from public.ofrecimiento_item o
  left join public.pieza_estado_procesal ep on ep.pieza_id = o.pieza_id
 where o.archivado_en is null;

grant select on public.ofrecimiento_estado to authenticated;
revoke all on public.ofrecimiento_estado from anon;

-- ---------------------------------------------------------------------
-- agregar_al_ofrecimiento(): suma piezas o personas al final de su
-- clase, numeradas en orden, en una sola transacción. Lo que ya estaba
-- ofrecido no se duplica (vuelve en «ya_estaban»).
-- ---------------------------------------------------------------------
create or replace function public.agregar_al_ofrecimiento(
  p_causa uuid,
  p_clase text,
  p_piezas uuid[] default '{}',
  p_personas uuid[] default '{}'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_siguiente integer;
  v_id uuid;
  v_agregados integer := 0;
  v_ya uuid[] := '{}';
begin
  -- Un solo alta a la vez por causa y clase, para que los números no se pisen.
  perform pg_advisory_xact_lock(hashtext(p_causa::text || p_clase));

  select coalesce(max(nullif(regexp_replace(o.numero, '\D.*$', ''), '')::integer), 0) + 1
    into v_siguiente
    from public.ofrecimiento_item o
   where o.causa_id = p_causa and o.clase = p_clase and o.archivado_en is null;

  foreach v_id in array coalesce(p_piezas, '{}') loop
    if exists (select 1 from public.ofrecimiento_item o
                where o.causa_id = p_causa and o.pieza_id = v_id and o.archivado_en is null) then
      v_ya := v_ya || v_id;
      continue;
    end if;
    insert into public.ofrecimiento_item (causa_id, clase, pieza_id, numero, ubicacion_fisica)
    select p_causa, p_clase, p.id, v_siguiente::text, e.ubicacion_fisica
      from public.pieza p
      left join public.efecto e on e.id = p.efecto_id
     where p.id = v_id and p.causa_id = p_causa and p.archivado_en is null;
    if found then
      v_siguiente := v_siguiente + 1;
      v_agregados := v_agregados + 1;
    end if;
  end loop;

  foreach v_id in array coalesce(p_personas, '{}') loop
    if exists (select 1 from public.ofrecimiento_item o
                where o.causa_id = p_causa and o.persona_id = v_id and o.clase = p_clase and o.archivado_en is null) then
      v_ya := v_ya || v_id;
      continue;
    end if;
    insert into public.ofrecimiento_item (causa_id, clase, persona_id, numero, entregada_defensa)
    select p_causa, p_clase, pe.id, v_siguiente::text, false
      from public.persona pe
     where pe.id = v_id and pe.causa_id = p_causa and pe.archivado_en is null;
    if found then
      v_siguiente := v_siguiente + 1;
      v_agregados := v_agregados + 1;
    end if;
  end loop;

  return jsonb_build_object('agregados', v_agregados, 'ya_estaban', to_jsonb(v_ya));
end
$$;

revoke execute on function public.agregar_al_ofrecimiento(uuid, text, uuid[], uuid[]) from public, anon;
grant execute on function public.agregar_al_ofrecimiento(uuid, text, uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- renumerar_ofrecimiento(): vuelve a numerar 1, 2, 3… una clase, en el
-- orden en que está (sirve después de quitar ítems). Queda en el historial.
-- ---------------------------------------------------------------------
create or replace function public.renumerar_ofrecimiento(p_causa uuid, p_clase text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cambios integer := 0;
  r record;
begin
  perform pg_advisory_xact_lock(hashtext(p_causa::text || p_clase));
  for r in
    select o.id, o.numero, row_number() over (order by o.numero_clave nulls last, o.creado_en) as nuevo
      from public.ofrecimiento_item o
     where o.causa_id = p_causa and o.clase = p_clase and o.archivado_en is null
  loop
    if r.numero is distinct from r.nuevo::text then
      update public.ofrecimiento_item set numero = r.nuevo::text where id = r.id;
      v_cambios := v_cambios + 1;
    end if;
  end loop;
  return v_cambios;
end
$$;

revoke execute on function public.renumerar_ofrecimiento(uuid, text) from public, anon;
grant execute on function public.renumerar_ofrecimiento(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Actos procesales: link al documento.
-- ---------------------------------------------------------------------
alter table public.acto_procesal add column link text;

-- ---------------------------------------------------------------------
-- Relaciones entre personas y empresas (socio, familiar, empleado…): se
-- cargan como vínculo 'relacionado' con la relación en la nota y de dónde
-- surge en fuente, para que el grafo no afirme nada sin respaldo.
-- ---------------------------------------------------------------------
alter table public.vinculo add column fuente text;

-- ---------------------------------------------------------------------
-- cronologia(): una sola línea de tiempo con las piezas, los mensajes
-- marcados como relevantes, los pasos de las contrataciones, los
-- allanamientos, los actos procesales y los planteos. Solo entra lo que
-- tiene fecha; «relacionados» trae las contrataciones vinculadas para
-- poder filtrar.
-- ---------------------------------------------------------------------
create or replace function public.cronologia(p_causa uuid)
returns table (
  tipo text,
  id uuid,
  fecha date,
  fecha_precision text,
  fecha_texto text,
  titulo text,
  detalle text,
  referencia uuid,
  relacionados uuid[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with vinculos as (
    select v.origen_id as propio, v.destino_id as otro from public.vinculo v
     where v.causa_id = p_causa and v.archivado_en is null
    union all
    select v.destino_id, v.origen_id from public.vinculo v
     where v.causa_id = p_causa and v.archivado_en is null
  ),
  relacion as (
    select vi.propio, array_agg(distinct vi.otro) as otros from vinculos vi group by vi.propio
  )
  select 'pieza', p.id, p.fecha_desde, p.fecha_precision, null::text,
         coalesce('Nº ' || p.numero_orden || ' · ', '') || p.titulo,
         concat_ws(' · ', nullif(p.autor, ''), nullif(p.resumen, '')),
         p.efecto_id, coalesce(r.otros, '{}')
    from public.pieza p
    left join relacion r on r.propio = p.id
   where p.causa_id = p_causa and p.archivado_en is null and p.fecha_desde is not null
  union all
  select 'mensaje', m.id, m.fecha, 'dia', m.fecha_hora_texto,
         coalesce(m.emisor, '¿?') || ' → ' || coalesce(m.receptor, '¿?'),
         m.contenido, m.conversacion_id, coalesce(r.otros, '{}')
    from public.mensaje m
    left join relacion r on r.propio = m.id
   where m.causa_id = p_causa and m.archivado_en is null and m.relevante and m.fecha is not null
  union all
  select 'paso', pt.id, pt.fecha, pt.fecha_precision, pt.fecha_texto,
         c.identificador || ' · ' || pt.descripcion,
         concat_ws(' · ', 'fs. ' || nullif(pt.fojas, ''), nullif(pt.firmante_texto, '')),
         c.id, array[c.id]
    from public.paso_tramite pt
    join public.contratacion c on c.id = pt.contratacion_id and c.archivado_en is null
   where pt.causa_id = p_causa and pt.archivado_en is null and pt.fecha is not null
  union all
  select 'allanamiento', pr.id, pr.fecha, 'dia', null,
         'Allanamiento · ' || coalesce(pr.domicilio, 'domicilio sin cargar'),
         concat_ws(' · ', nullif(pr.lugar, ''), nullif(pr.resolucion_autorizante, '')),
         null::uuid, '{}'::uuid[]
    from public.procedimiento pr
   where pr.causa_id = p_causa and pr.archivado_en is null and pr.fecha is not null
  union all
  select 'acto', a.id, a.fecha, a.fecha_precision, null, a.titulo, a.descripcion, null::uuid, '{}'::uuid[]
    from public.acto_procesal a
   where a.causa_id = p_causa and a.archivado_en is null and a.fecha is not null
  union all
  select 'planteo', i.id, i.fecha_planteo, 'dia', null, 'Planteo · ' || i.titulo, i.tribunal, null::uuid, '{}'::uuid[]
    from public.incidencia_procesal i
   where i.causa_id = p_causa and i.archivado_en is null and i.fecha_planteo is not null
  union all
  select 'resolucion', i.id, i.fecha_resolucion, 'dia', null, 'Resolución · ' || i.titulo,
         concat_ws(' · ', nullif(i.tribunal, ''), nullif(i.resolucion, '')), null::uuid, '{}'::uuid[]
    from public.incidencia_procesal i
   where i.causa_id = p_causa and i.archivado_en is null and i.fecha_resolucion is not null
$$;

revoke execute on function public.cronologia(uuid) from public, anon;
grant execute on function public.cronologia(uuid) to authenticated;
