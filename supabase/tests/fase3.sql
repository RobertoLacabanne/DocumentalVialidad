-- =====================================================================
-- Pruebas de la Fase 3: ofrecimiento de prueba, alertas procesales y
-- cronología. Todo corre en una transacción que se deshace al final.
-- =====================================================================
\set ON_ERROR_STOP on
\set QUIET on
begin;

create function pg_temp.comprobar(condicion boolean, mensaje text) returns void
language plpgsql as $$
begin
  if condicion is distinct from true then
    raise exception 'FALLÓ: %', mensaje;
  end if;
  raise notice 'ok · %', mensaje;
end $$;

create function pg_temp.como(email text, uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated;
select set_config('prueba.causa', id::text, false) from public.causa where legajo_fiscalia = '299113';
insert into public.miembro (email, alias, invitado_por) values ('f3@prueba.test', 'PRUEBAF3', 'prueba')
  on conflict (email) do update set activo = true;
select pg_temp.como('f3@prueba.test', '00000000-0000-0000-0000-00000000f301');

-- Datos de prueba: un efecto con planteo de exclusión, dos piezas (una sale de ese efecto) y un testigo.
insert into public.efecto (causa_id, numero, soporte, ubicacion_fisica)
values (current_setting('prueba.causa')::uuid, '99301', 'digital', 'Caja de prueba 3');
insert into public.pieza (causa_id, numero_orden, titulo, fecha_desde, fecha_precision, efecto_id)
select current_setting('prueba.causa')::uuid, '930', 'Pieza de prueba cuestionada', '2021-05-04', 'dia', e.id
  from public.efecto e where e.numero = '99301';
insert into public.pieza (causa_id, numero_orden, titulo, fecha_desde, fecha_precision)
values (current_setting('prueba.causa')::uuid, '931', 'Pieza de prueba limpia', '2020-02-21', 'dia');
insert into public.persona (causa_id, nombre) values (current_setting('prueba.causa')::uuid, 'Testigo De Prueba F3');
insert into public.incidencia_procesal (causa_id, titulo, situacion, fecha_planteo)
values (current_setting('prueba.causa')::uuid, 'Planteo de prueba F3', 'admisibilidad_cuestionada', '2026-01-10');
select public.aplicar_incidencia(
  (select id from public.incidencia_procesal where titulo = 'Planteo de prueba F3'),
  array[(select id from public.efecto where numero = '99301')]);

-- Si la causa ya tiene un ofrecimiento cargado, se aparta mientras dura la
-- prueba (la transacción se deshace al final y queda como estaba).
update public.ofrecimiento_item set archivado_en = now()
 where causa_id = current_setting('prueba.causa')::uuid and archivado_en is null;

-- ---------------------------------------------------------------------
-- 1. Ofrecimiento
-- ---------------------------------------------------------------------
create temp table r1 as
select public.agregar_al_ofrecimiento(current_setting('prueba.causa')::uuid, 'documental',
  array[(select id from public.pieza where numero_orden = '931'), (select id from public.pieza where numero_orden = '930')]) as r;
select pg_temp.comprobar((select (r ->> 'agregados')::int = 2 from r1), 'dos piezas entran al ofrecimiento de una vez');
select pg_temp.comprobar(
  (select array_agg(o.numero order by p.numero_orden) = array['2', '1']
     from public.ofrecimiento_item o join public.pieza p on p.id = o.pieza_id where p.numero_orden in ('930', '931')
      and o.causa_id = current_setting('prueba.causa')::uuid and o.archivado_en is null
      and (select count(*) from public.ofrecimiento_item x where x.causa_id = o.causa_id and x.clase = 'documental' and x.archivado_en is null) = 2),
  'se numeran en el orden en que se eligieron, dentro de su clase');
select pg_temp.comprobar(
  (select ubicacion_fisica = 'Caja de prueba 3' from public.ofrecimiento_item o join public.pieza p on p.id = o.pieza_id where p.numero_orden = '930'),
  'la ubicación física se toma del efecto de la pieza');
select pg_temp.comprobar(
  (select jsonb_array_length(r -> 'ya_estaban') = 1 and (r ->> 'agregados')::int = 0
     from (select public.agregar_al_ofrecimiento(current_setting('prueba.causa')::uuid, 'documental',
             array[(select id from public.pieza where numero_orden = '930')]) as r) x),
  'una pieza ya ofrecida no se duplica');

select public.agregar_al_ofrecimiento(current_setting('prueba.causa')::uuid, 'testimonial', '{}',
  array[(select id from public.persona where nombre = 'Testigo De Prueba F3')]);
select pg_temp.comprobar(
  (select numero = '1' and not entregada_defensa from public.ofrecimiento_item
    where persona_id = (select id from public.persona where nombre = 'Testigo De Prueba F3')),
  'los testigos llevan su propia numeración');

-- ---------------------------------------------------------------------
-- 2. Alertas para el armado del juicio
-- ---------------------------------------------------------------------
select pg_temp.comprobar(
  (select e.situacion = 'admisibilidad_cuestionada' and e.via = 'efecto'
     from public.ofrecimiento_estado e join public.ofrecimiento_item o on o.id = e.item_id
     join public.pieza p on p.id = o.pieza_id where p.numero_orden = '930'),
  'la pieza que sale de un efecto cuestionado avisa en el ofrecimiento');
select pg_temp.comprobar(
  (select e.situacion is null and e.sin_entregar
     from public.ofrecimiento_estado e join public.ofrecimiento_item o on o.id = e.item_id
     join public.pieza p on p.id = o.pieza_id where p.numero_orden = '931'),
  'la pieza sin planteos solo avisa que falta entregarla a la defensa');
select pg_temp.comprobar(
  (select not e.sin_entregar from public.ofrecimiento_estado e join public.ofrecimiento_item o on o.id = e.item_id
    where o.persona_id = (select id from public.persona where nombre = 'Testigo De Prueba F3')),
  'a un testigo no se le pide constancia de entrega');

select public.guardar_campo('ofrecimiento_item', o.id, 'incorporacion', null::jsonb, to_jsonb('exhibicion'::text))
  from public.ofrecimiento_item o join public.pieza p on p.id = o.pieza_id where p.numero_orden = '931';
select pg_temp.comprobar(
  (select e.falta_quien_introduce from public.ofrecimiento_estado e join public.ofrecimiento_item o on o.id = e.item_id
     join public.pieza p on p.id = o.pieza_id where p.numero_orden = '931'),
  'si se exhibe y nadie la introduce, avisa');
select public.guardar_campo('ofrecimiento_item', o.id, 'introduce_id', null::jsonb,
         to_jsonb((select id from public.persona where nombre = 'Testigo De Prueba F3')))
  from public.ofrecimiento_item o join public.pieza p on p.id = o.pieza_id where p.numero_orden = '931';
select public.guardar_campo('ofrecimiento_item', o.id, 'entregada_defensa', 'false'::jsonb, 'true'::jsonb)
  from public.ofrecimiento_item o join public.pieza p on p.id = o.pieza_id where p.numero_orden = '931';
select pg_temp.comprobar(
  (select not e.falta_quien_introduce and not e.sin_entregar from public.ofrecimiento_estado e
     join public.ofrecimiento_item o on o.id = e.item_id join public.pieza p on p.id = o.pieza_id where p.numero_orden = '931'),
  'con quien la introduce y la constancia de entrega, deja de avisar');

select pg_temp.comprobar(
  (select (public.guardar_campo('ofrecimiento_item', o.id, 'imputados', '[]'::jsonb,
            jsonb_build_array((select id from public.persona where nombre = 'Testigo De Prueba F3'))) ->> 'ok')::boolean
     from public.ofrecimiento_item o join public.pieza p on p.id = o.pieza_id where p.numero_orden = '931'),
  'los imputados vinculados se guardan como lista');

-- ---------------------------------------------------------------------
-- 3. Renumerar después de quitar un ítem
-- ---------------------------------------------------------------------
update public.ofrecimiento_item set archivado_en = now()
 where pieza_id = (select id from public.pieza where numero_orden = '931');
select pg_temp.comprobar(
  (select public.renumerar_ofrecimiento(current_setting('prueba.causa')::uuid, 'documental') = 1),
  'renumerar corre los números que quedaron salteados');
select pg_temp.comprobar(
  (select numero = '1' from public.ofrecimiento_item o join public.pieza p on p.id = o.pieza_id where p.numero_orden = '930'),
  'la que era la 2 pasa a ser la 1');

-- ---------------------------------------------------------------------
-- 4. Cronología
-- ---------------------------------------------------------------------
insert into public.acto_procesal (causa_id, fecha, tipo, titulo)
values (current_setting('prueba.causa')::uuid, '2026-02-01', 'audiencia', 'Audiencia de prueba F3');
select pg_temp.comprobar(
  (select count(*) filter (where tipo = 'pieza' and titulo like 'Nº 930 ·%') = 1
      and count(*) filter (where tipo = 'acto' and titulo = 'Audiencia de prueba F3') = 1
      and count(*) filter (where tipo = 'planteo' and titulo = 'Planteo · Planteo de prueba F3') = 1
     from public.cronologia(current_setting('prueba.causa')::uuid)),
  'la cronología junta piezas, actos procesales y planteos');
select pg_temp.comprobar(
  not exists (select 1 from public.cronologia(current_setting('prueba.causa')::uuid) where fecha is null),
  'en la cronología solo entra lo que tiene fecha');

-- ---------------------------------------------------------------------
-- 5. Relaciones entre personas (grafo): qué relación y de dónde surge
-- ---------------------------------------------------------------------
insert into public.persona (causa_id, nombre, tipo_persona)
values (current_setting('prueba.causa')::uuid, 'Empresa De Prueba F3', 'juridica');
insert into public.vinculo (causa_id, origen_id, destino_id, tipo, nota, fuente)
select current_setting('prueba.causa')::uuid, t.id, e.id, 'relacionado', 'Socio', 'Contrato social de prueba'
  from public.persona t, public.persona e
 where t.nombre = 'Testigo De Prueba F3' and e.nombre = 'Empresa De Prueba F3';
select pg_temp.comprobar(
  (select (public.guardar_campo('vinculo', v.id, 'fuente', to_jsonb('Contrato social de prueba'::text),
            to_jsonb('Contrato social de prueba, fs. 3'::text)) ->> 'ok')::boolean
     from public.vinculo v where v.nota = 'Socio' and v.causa_id = current_setting('prueba.causa')::uuid),
  'de dónde surge una relación se edita como cualquier campo');
select pg_temp.comprobar(
  exists (select 1 from public.auditoria a join public.vinculo v on v.id = a.registro_id
           where v.nota = 'Socio' and a.accion = 'edicion' and a.cambios ? 'fuente'),
  'y queda en el historial');

rollback;
\echo 'Todas las pruebas de la Fase 3 pasaron.'
