-- =====================================================================
-- Pruebas de la Fase 1: importación de efectos, alias de responsables,
-- situación procesal en bloque y búsqueda por identificadores.
-- Todo corre en una transacción que se deshace al final.
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

-- Un miembro con alias PRUEBAF1 y otro todavía sin alias.
insert into public.miembro (email, alias, invitado_por) values ('rober.f1@prueba.test', 'PRUEBAF1', 'prueba')
  on conflict (email) do update set alias = 'PRUEBAF1', activo = true;
insert into public.miembro (email, invitado_por) values ('carli.f1@prueba.test', 'prueba')
  on conflict (email) do nothing;
select pg_temp.como('rober.f1@prueba.test', '00000000-0000-0000-0000-00000000f101');

-- ---------------------------------------------------------------------
-- 1. Importación de efectos
-- ---------------------------------------------------------------------
create temp table resultado as
select public.importar_efectos(
  current_setting('prueba.causa')::uuid,
  'LISTADO DE PRUEBA.xlsx', 'Hoja 1',
  jsonb_build_array(
    jsonb_build_object('fila', 3, 'numero', '99001', 'soporte', 'digital', 'tipo_material', 'dispositivo',
      'descripcion_acta', '(01) CPU de prueba', 'responsable_alias', 'PRUEBAF1', 'estado', 'sin_iniciar',
      'apto_analisis', 'si', 'procedimiento_fecha', '2025-10-28', 'procedimiento_domicilio', 'Domicilio de prueba 1',
      'resolucion_autorizante', 'Res. de prueba', 'tiene_informe_gabinete', true,
      'observaciones_gabinete', 'Informe C9999', 'informe_numero', 'C9999'),
    jsonb_build_object('fila', 4, 'numero', '99002', 'soporte', 'digital', 'tipo_material', 'dispositivo',
      'descripcion_acta', '(01) teléfono de prueba', 'responsable_alias', 'CARLIF1', 'estado', 'finalizado',
      'apto_analisis', 'no_requiere_analisis', 'procedimiento_fecha', '2025-10-28', 'procedimiento_domicilio', 'Domicilio de prueba 1',
      'observaciones', 'Esperando resolución de casación'),
    jsonb_build_object('fila', 5, 'numero', '99003', 'soporte', 'digital', 'requiere_escribiente', false,
      'descripcion_acta', '(01) notebook de prueba', 'procedimiento_fecha', '2026-08-10', 'procedimiento_domicilio', 'Domicilio de prueba 2'),
    jsonb_build_object('fila', 6, 'numero', '99001', 'descripcion_acta', 'repetido en el mismo archivo')
  ),
  4) as r;

select pg_temp.comprobar((select (r ->> 'importadas')::int = 3 from resultado), 'importa las filas nuevas (3 de 4)');
select pg_temp.comprobar((select jsonb_array_length(r -> 'duplicadas') = 1 from resultado),
  'un número repetido en el archivo queda como duplicado y no se pisa');
select pg_temp.comprobar((select (r ->> 'procedimientos_creados')::int = 2 from resultado),
  'agrupa los procedimientos por fecha y domicilio (2 procedimientos para 3 efectos)');
select pg_temp.comprobar((select (r ->> 'informes_creados')::int = 1 from resultado), 'da de alta el informe mencionado (C9999)');
select pg_temp.comprobar(
  (select e.origen ->> 'archivo' = 'LISTADO DE PRUEBA.xlsx' and (e.origen ->> 'fila')::int = 3
     from public.efecto e where e.numero = '99001'),
  'cada efecto guarda de qué planilla y fila salió');
select pg_temp.comprobar(
  (select e.responsable = 'rober.f1@prueba.test' from public.efecto e where e.numero = '99001'),
  'el alias PRUEBAF1 queda asignado al miembro con ese alias');
select pg_temp.comprobar(
  (select e.responsable is null and e.responsable_alias = 'CARLIF1' from public.efecto e where e.numero = '99002'),
  'un alias sin miembro todavía queda guardado como alias');
select pg_temp.comprobar(
  (select e.informe_id is not null from public.efecto e where e.numero = '99001'),
  'el efecto queda vinculado a su informe del gabinete');
select pg_temp.comprobar(
  (select e.estado = 'sin_iniciar' and not e.requiere_escribiente from public.efecto e where e.numero = '99003'),
  'sin estado en la planilla queda «sin iniciar»; «no requiere escribiente» se respeta');
select pg_temp.comprobar(
  (select filas_origen = 4 and filas_importadas = 3 and filas_omitidas = 1
     from public.importacion where archivo = 'LISTADO DE PRUEBA.xlsx'),
  'la importación queda registrada con el conteo de filas');

do $$
begin
  perform public.importar_efectos(current_setting('prueba.causa')::uuid, 'x.xlsx', null,
    jsonb_build_array(jsonb_build_object('fila', 9, 'numero', '')), 1);
  raise exception 'FALLÓ: aceptó una fila sin número';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · una fila sin número de efecto frena toda la importación (no se carga a medias)';
end $$;

-- ---------------------------------------------------------------------
-- 2. Al invitar a CARLIF1 con su alias, sus efectos se le asignan solos
-- ---------------------------------------------------------------------
update public.miembro set alias = 'CARLIF1' where email = 'carli.f1@prueba.test';
select pg_temp.comprobar(
  (select e.responsable = 'carli.f1@prueba.test' from public.efecto e where e.numero = '99002'),
  'al cargar el alias de un miembro, los efectos con ese alias pasan a su nombre');
select pg_temp.comprobar(
  exists (select 1 from public.auditoria a join public.efecto e on e.id = a.registro_id
           where e.numero = '99002' and a.cambios ? 'responsable'),
  'esa asignación queda en el historial del efecto');

-- Un alias compartido por dos cuentas no asigna a ninguna: queda el alias, sin adivinar.
insert into public.miembro (email, alias, invitado_por) values
  ('doble.a@prueba.test', 'DOBLEF1', 'prueba'), ('doble.b@prueba.test', 'doblef1', 'prueba');
select public.importar_efectos(current_setting('prueba.causa')::uuid, 'DOBLE.xlsx', null,
  jsonb_build_array(jsonb_build_object('fila', 3, 'numero', '99010', 'soporte', 'papel', 'responsable_alias', 'DOBLEF1')), 1);
select pg_temp.comprobar(
  (select e.responsable is null and e.responsable_alias = 'DOBLEF1' from public.efecto e where e.numero = '99010'),
  'si dos cuentas comparten alias, el efecto no se asigna solo a ninguna');
update public.miembro set activo = false where email = 'doble.b@prueba.test';
update public.miembro set alias = 'DOBLEF1' where email = 'doble.a@prueba.test';
select pg_temp.comprobar(
  (select e.responsable = 'doble.a@prueba.test' from public.efecto e where e.numero = '99010'),
  'cuando el alias queda en una sola cuenta habilitada, se asigna');

-- ---------------------------------------------------------------------
-- 3. Situación procesal en bloque
-- ---------------------------------------------------------------------
insert into public.incidencia_procesal (causa_id, titulo, tipo, situacion)
values (current_setting('prueba.causa')::uuid, 'Casación de prueba', 'casacion', 'pendiente_resolucion');
select pg_temp.comprobar(
  public.aplicar_incidencia(
    (select id from public.incidencia_procesal where titulo = 'Casación de prueba'),
    array(select id from public.efecto where numero in ('99002', '99003'))) = 2,
  'una situación procesal se aplica a varios efectos de una vez');
select pg_temp.comprobar(
  public.aplicar_incidencia(
    (select id from public.incidencia_procesal where titulo = 'Casación de prueba'),
    array(select id from public.efecto where numero in ('99002'))) = 0,
  'aplicarla dos veces no la duplica');
select pg_temp.comprobar(
  (select count(*) = 2 from public.efecto_estado_procesal ep join public.efecto e on e.id = ep.efecto_id
    where e.numero in ('99002', '99003') and ep.situacion = 'pendiente_resolucion'),
  'los efectos alcanzados muestran la situación procesal');

insert into public.pieza (causa_id, numero_orden, titulo, efecto_id)
select causa_id, '901', 'Pieza del efecto 99003', id from public.efecto where numero = '99003';
select pg_temp.comprobar(
  (select situacion = 'pendiente_resolucion' from public.pieza_estado_procesal ep
     join public.pieza p on p.id = ep.pieza_id where p.titulo = 'Pieza del efecto 99003'),
  'las piezas del efecto heredan esa situación');

-- ---------------------------------------------------------------------
-- 4. Búsqueda por teléfonos y alias agendados
-- ---------------------------------------------------------------------
insert into public.persona (causa_id, nombre) values (current_setting('prueba.causa')::uuid, 'Persona de prueba F1');
insert into public.identificador (causa_id, persona_id, tipo, valor)
select causa_id, id, 'telefono', '343 555-0101' from public.persona where nombre = 'Persona de prueba F1';
insert into public.identificador (causa_id, persona_id, tipo, valor)
select causa_id, id, 'alias_agendado', 'Emilianito prueba' from public.persona where nombre = 'Persona de prueba F1';

select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, '3435550101')
           where tipo = 'persona' and titulo = 'Persona de prueba F1'),
  'la búsqueda encuentra a una persona por su teléfono, aunque se escriba sin espacios ni guiones');
select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, 'emilianito')
           where tipo = 'persona'),
  'la búsqueda encuentra a una persona por cómo figura agendada');
select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, '99001') where tipo = 'efecto'),
  'la búsqueda encuentra un efecto por su número');
select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, 'casacion') where tipo = 'efecto'),
  'la búsqueda encuentra efectos por sus observaciones, sin tildes');

rollback;
\echo 'Todas las pruebas de la Fase 1 pasaron.'
