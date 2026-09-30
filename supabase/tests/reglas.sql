-- =====================================================================
-- Pruebas de las reglas que garantiza la base.
-- Se corre con `npm run db:test` contra el Supabase local.
-- Todo ocurre dentro de una transacción que se deshace al final.
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
    json_build_object('sub', uid, 'email', email, 'role', 'authenticated',
                      'user_metadata', json_build_object('full_name', initcap(split_part(email, '@', 1))))::text,
    true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.como_sistema() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated;
select set_config('prueba.causa', id::text, false) from public.causa where legajo_fiscalia = '299113';

-- ---------------------------------------------------------------------
-- 1. Orden jerárquico
-- ---------------------------------------------------------------------
select pg_temp.comprobar(
  (select array_agg(n order by public.clave_orden(n))
     from unnest(array['3', '2 ter', '10', '2.1', '2 bis', '2', '2.2', '1', '2.10']) n)
  = array['1', '2', '2.1', '2.2', '2.10', '2 bis', '2 ter', '3', '10'],
  'el número de orden ordena 1 < 2 < 2.1 < 2.2 < 2.10 < 2 bis < 2 ter < 3 < 10');

-- ---------------------------------------------------------------------
-- 2. Primer ingreso y lista de invitados
-- Partimos de una lista vacía, aunque la base local tenga cuentas de
-- prueba: como todo corre en una transacción, al final se deshace.
-- ---------------------------------------------------------------------
update public.pieza set responsable = null where responsable is not null;
update public.efecto set responsable = null where responsable is not null;
update public.tarea set responsable = null where responsable is not null;
delete from public.miembro;
select pg_temp.comprobar((select count(*) from public.miembro) = 0, 'la lista de invitados arranca vacía');

select pg_temp.como('rober@ejemplo.com', '00000000-0000-0000-0000-000000000001');
select pg_temp.comprobar((public.registrar_ingreso() ->> 'habilitado')::boolean,
  'quien entra primero queda habilitado');

select pg_temp.como('intruso@ejemplo.com', '00000000-0000-0000-0000-000000000009');
select pg_temp.comprobar(not (public.registrar_ingreso() ->> 'habilitado')::boolean,
  'una cuenta no invitada no queda habilitada');
select pg_temp.comprobar((select count(*) from public.causa) = 0,
  'una cuenta no invitada no ve ninguna causa');
do $$
begin
  insert into public.pieza (causa_id, titulo) values (current_setting('prueba.causa')::uuid, 'intento');
  raise exception 'FALLÓ: un no invitado pudo cargar';
exception when insufficient_privilege then
  raise notice 'ok · una cuenta no invitada no puede cargar';
end $$;

select pg_temp.como('rober@ejemplo.com', '00000000-0000-0000-0000-000000000001');
insert into public.miembro (email, alias, invitado_por) values ('ines@ejemplo.com', 'INES', 'rober@ejemplo.com');
select pg_temp.como('ines@ejemplo.com', '00000000-0000-0000-0000-000000000002');
select pg_temp.comprobar((public.registrar_ingreso() ->> 'habilitado')::boolean,
  'una persona invitada por un miembro queda habilitada');
select pg_temp.comprobar((select count(*) from public.causa) = 1, 'un miembro ve la causa 299113');

-- ---------------------------------------------------------------------
-- 3. Alta, historial y guardado por campo
-- ---------------------------------------------------------------------
insert into public.pieza (causa_id, numero_orden, tipo, titulo, relevancia)
select id, '19', 'documental_secuestrada', 'Agenda 2021 (prueba SQL)', 'baja'
  from public.causa where legajo_fiscalia = '299113';

select pg_temp.comprobar(
  (select usuario_email = 'ines@ejemplo.com' and accion = 'alta'
     from public.auditoria where tabla = 'pieza' order by id desc limit 1),
  'el alta queda en el historial con el correo de quien cargó');

select pg_temp.comprobar(
  exists (select 1 from public.entidad e join public.pieza p on p.id = e.id where p.titulo = 'Agenda 2021 (prueba SQL)'),
  'la pieza queda registrada como entidad vinculable');

select pg_temp.comprobar(
  (public.guardar_campo('pieza', (select id from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
                        'relevancia', '"baja"', '"media"') ->> 'ok')::boolean,
  'guardar un campo sin conflicto funciona');

select pg_temp.comprobar(
  (select cambios = '{"relevancia": {"antes": "baja", "despues": "media"}}'::jsonb
     from public.auditoria where tabla = 'pieza' order by id desc limit 1),
  'el historial guarda solo el campo que cambió, con valor anterior y nuevo');

select pg_temp.comprobar(
  (select version = 2 from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
  'la versión de la ficha sube con cada edición');

select pg_temp.comprobar(
  not (public.guardar_campo('pieza', (select id from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
                            'relevancia', '"baja"', '"alta"') ->> 'ok')::boolean,
  'si otro cambió el campo, el guardado no pisa y avisa');

select pg_temp.comprobar(
  (select relevancia = 'media' from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
  'después de un conflicto el valor del otro queda intacto');

select pg_temp.comprobar(
  (public.guardar_campo('pieza', (select id from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
                        'fecha_desde', null, '"2021-03-15"') ->> 'ok')::boolean,
  'guardar una fecha desde vacío funciona');

select pg_temp.comprobar(
  (select fecha_desde = date '2021-03-15' from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
  'la fecha queda con su tipo correcto');

do $$
begin
  perform public.guardar_campo('pieza', (select id from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
                               'causa_id', null, '"00000000-0000-0000-0000-000000000000"');
  raise exception 'FALLÓ: se pudo editar causa_id';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · los campos de sistema no se editan a mano';
end $$;

-- ---------------------------------------------------------------------
-- 4. Nada se borra: se archiva y se restaura
-- ---------------------------------------------------------------------
do $$
begin
  delete from public.pieza where titulo = 'Agenda 2021 (prueba SQL)';
  raise exception 'FALLÓ: se pudo borrar una pieza';
exception when insufficient_privilege then
  raise notice 'ok · borrar una pieza está prohibido';
end $$;

select public.guardar_campo('pieza', (select id from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
                            'archivado_en', null, to_jsonb(now()));
select pg_temp.comprobar(
  (select accion = 'archivo' from public.auditoria where tabla = 'pieza' order by id desc limit 1),
  'archivar queda registrado como archivo');
select pg_temp.comprobar(
  (select archivado_por = '00000000-0000-0000-0000-000000000002' from public.pieza where titulo = 'Agenda 2021 (prueba SQL)'),
  'queda registrado quién archivó');

update public.pieza set archivado_en = null where titulo = 'Agenda 2021 (prueba SQL)';
select pg_temp.comprobar(
  (select accion = 'restauracion' from public.auditoria where tabla = 'pieza' order by id desc limit 1),
  'restaurar queda registrado como restauración');

-- ---------------------------------------------------------------------
-- 5. Transcripciones literales y acta del efecto
-- ---------------------------------------------------------------------
insert into public.conversacion (causa_id, titulo)
select id, 'Conversación de prueba' from public.causa where legajo_fiscalia = '299113';
insert into public.mensaje (causa_id, conversacion_id, emisor, receptor, contenido)
select c.causa_id, c.id, 'Emisor', 'Receptor', 'Texto literal con tildes: cotización'
  from public.conversacion c where c.titulo = 'Conversación de prueba';

select pg_temp.comprobar(
  (select hash_contenido = encode(extensions.digest('Texto literal con tildes: cotización', 'sha256'), 'hex')
     from public.mensaje where emisor = 'Emisor'),
  'cada mensaje guarda el SHA-256 de su texto al cargarse');

do $$
begin
  update public.mensaje set contenido = 'texto alterado' where emisor = 'Emisor';
  raise exception 'FALLÓ: se pudo alterar una transcripción';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · el texto transcripto no se puede modificar';
end $$;

update public.mensaje set relevante = true, observacion = 'Vincular con LP 05/2020' where emisor = 'Emisor';
select pg_temp.comprobar((select relevante from public.mensaje where emisor = 'Emisor'),
  'un mensaje sí se puede marcar como relevante y observar');

insert into public.efecto (causa_id, numero, descripcion_acta)
select id, '99999', 'Descripción textual según el acta' from public.causa where legajo_fiscalia = '299113';
do $$
begin
  update public.efecto set descripcion_acta = 'otra cosa' where numero = '99999';
  raise exception 'FALLÓ: se pudo cambiar la descripción del acta';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · la descripción según el acta no se modifica';
end $$;

-- ---------------------------------------------------------------------
-- 6. Búsqueda sin tildes ni mayúsculas
-- ---------------------------------------------------------------------
select pg_temp.comprobar(
  exists (select 1 from public.buscar((select id from public.causa where legajo_fiscalia = '299113'), 'COTIZACION')
           where tipo = 'mensaje' and fragmento like '%⟦cotización⟧%'),
  'la búsqueda encuentra "cotización" escribiendo COTIZACION y resalta el término');

select pg_temp.comprobar(
  exists (select 1 from public.buscar((select id from public.causa where legajo_fiscalia = '299113'), 'agenda')
           where tipo = 'pieza'),
  'la búsqueda encuentra fichas por el título');

-- ---------------------------------------------------------------------
-- 7. Situación procesal heredada
-- ---------------------------------------------------------------------
insert into public.pieza (causa_id, numero_orden, titulo, efecto_id)
select e.causa_id, '20', 'Pieza del efecto cuestionado', e.id from public.efecto e where e.numero = '99999';
insert into public.incidencia_procesal (causa_id, titulo, tipo, situacion)
select id, 'Casación por extracción', 'casacion', 'pendiente_resolucion'
  from public.causa where legajo_fiscalia = '299113';
insert into public.incidencia_alcance (causa_id, incidencia_id, entidad_id)
select i.causa_id, i.id, e.id
  from public.incidencia_procesal i, public.efecto e
 where i.titulo = 'Casación por extracción' and e.numero = '99999';

select pg_temp.comprobar(
  (select situacion = 'pendiente_resolucion' and via = 'efecto'
     from public.pieza_estado_procesal ep join public.pieza p on p.id = ep.pieza_id
    where p.titulo = 'Pieza del efecto cuestionado'),
  'una pieza hereda la situación procesal de su efecto');

update public.incidencia_procesal set situacion = 'sin_efecto' where titulo = 'Casación por extracción';
select pg_temp.comprobar(
  not exists (select 1 from public.pieza_estado_procesal ep join public.pieza p on p.id = ep.pieza_id
               where p.titulo = 'Pieza del efecto cuestionado'),
  'cuando la incidencia se resuelve a favor, la alerta desaparece sola');

-- ---------------------------------------------------------------------
-- 8. El historial es inmutable, incluso para el administrador
-- ---------------------------------------------------------------------
select pg_temp.como_sistema();
do $$
begin
  update public.auditoria set usuario_email = 'otro' where id = (select max(id) from public.auditoria);
  raise exception 'FALLÓ: se pudo modificar el historial';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · el historial no se puede modificar';
end $$;
do $$
begin
  delete from public.auditoria where id = (select max(id) from public.auditoria);
  raise exception 'FALLÓ: se pudo borrar el historial';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · el historial no se puede borrar';
end $$;

select pg_temp.comprobar(
  (select count(*) = 1 from public.caratula_historial ch join public.causa c on c.id = ch.causa_id
    where c.legajo_fiscalia = '299113'),
  'la carátula arranca con una sola entrada de historial');
update public.causa set caratula = caratula || ' (prueba)' where legajo_fiscalia = '299113';
select pg_temp.comprobar(
  (select count(*) = 2 and count(*) filter (where hasta is null) = 1
     from public.caratula_historial ch join public.causa c on c.id = ch.causa_id
    where c.legajo_fiscalia = '299113'),
  'cambiar la carátula cierra la anterior y abre una nueva en su historial');

rollback;
\echo 'Todas las pruebas de la base pasaron.'
