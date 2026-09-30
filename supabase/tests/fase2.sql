-- =====================================================================
-- Pruebas de la Fase 2: importación de contrataciones y conversaciones,
-- texto literal de los mensajes, relevantes y vínculos.
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
insert into public.miembro (email, alias, invitado_por) values ('f2@prueba.test', 'PRUEBAF2', 'prueba')
  on conflict (email) do update set activo = true;
select pg_temp.como('f2@prueba.test', '00000000-0000-0000-0000-00000000f201');

-- ---------------------------------------------------------------------
-- 1. Contrataciones
-- ---------------------------------------------------------------------
create temp table r1 as
select public.importar_contratacion(current_setting('prueba.causa')::uuid, 'CONTRATACIONES PRUEBA.xlsx', 'LP 99/2020',
  jsonb_build_object(
    'identificador', 'LP 99/2020', 'expediente', '999999', 'tipo_procedimiento', 'Licitación',
    'fecha_inicio', '2020-02-26', 'fecha_inicio_texto', '26/2/2020', 'presupuesto_oficial', 1000.50,
    'filas_origen', 4,
    'pasos', jsonb_build_array(
      jsonb_build_object('orden', 1, 'fila', 5, 'descripcion', 'Pedido de compra de prueba', 'fojas', '1',
                         'fecha', '2020-02-21', 'fecha_precision', 'dia', 'fecha_texto', '21/2/2020',
                         'firmante_texto', 'Firmante de prueba (Director)'),
      jsonb_build_object('orden', 2, 'fila', 6, 'descripcion', 'Pase de prueba', 'fojas', '21 vta',
                         'fecha_precision', 'aproximada', 'fecha_texto', 'entre el 11 y 17/3/2020'),
      jsonb_build_object('orden', 3, 'fila', 7, 'descripcion', 'Oferta Oferente Uno', 'fojas', '94-134',
                         'observaciones', 'oferta econ $ 1.100', 'link', 'https://drive.google.com/prueba1')),
    'ofertas', jsonb_build_array(
      jsonb_build_object('orden', 1, 'fila', 7, 'oferente_texto', 'Oferente Uno', 'monto', 1100, 'fojas', '94-134',
                         'link', 'https://drive.google.com/prueba1')))) as r;

select pg_temp.comprobar((select (r ->> 'pasos')::int = 3 and (r ->> 'ofertas')::int = 1 from r1),
  'una hoja entra como una contratación con sus 3 pasos y su oferta');
select pg_temp.comprobar(
  (select fecha is null and fecha_precision = 'aproximada' and fecha_texto = 'entre el 11 y 17/3/2020'
     from public.paso_tramite where descripcion = 'Pase de prueba'),
  'una fecha ambigua se guarda tal cual, sin inventar el día');
select pg_temp.comprobar(
  (select (origen ->> 'fila')::int = 5 and origen ->> 'hoja' = 'LP 99/2020' from public.paso_tramite where descripcion = 'Pedido de compra de prueba'),
  'cada paso recuerda de qué hoja y fila salió');
select pg_temp.comprobar(
  (select (r ->> 'duplicada')::boolean from (select public.importar_contratacion(current_setting('prueba.causa')::uuid,
     'otra.xlsx', 'lp 99/2020', jsonb_build_object('identificador', 'lp 99/2020 ', 'pasos', '[]'::jsonb)) as r) x),
  'importar otra vez la misma contratación no la duplica (sin importar mayúsculas ni espacios)');
select pg_temp.comprobar(
  (select count(*) = 1 from public.importacion where destino = 'contrataciones' and hoja = 'LP 99/2020'),
  'la importación de la contratación queda registrada');

-- Una contratación cargada sin trámite (como la de la semilla) se completa, sin pisar lo que tenía.
insert into public.contratacion (causa_id, identificador, expediente)
values (current_setting('prueba.causa')::uuid, 'LP 98/2020', '111');
create temp table r1b as
select public.importar_contratacion(current_setting('prueba.causa')::uuid, 'CONTRATACIONES PRUEBA.xlsx', 'LP 98_2020',
  jsonb_build_object('identificador', 'LP 98/2020', 'expediente', '222', 'tipo_procedimiento', 'Licitación', 'filas_origen', 1,
    'pasos', jsonb_build_array(jsonb_build_object('orden', 1, 'fila', 5, 'descripcion', 'Paso único de prueba')))) as r;
select pg_temp.comprobar(
  (select (r ->> 'duplicada')::boolean = false and (r ->> 'completada')::boolean and (r ->> 'expediente_distinto')::boolean
          and (r ->> 'pasos')::int = 1 from r1b),
  'una contratación cargada sin trámite se completa al importar su hoja, y avisa si el expediente no coincide');
select pg_temp.comprobar(
  (select count(*) = 1 and min(expediente) = '111' and min(tipo_procedimiento) = 'Licitación'
     from public.contratacion where identificador = 'LP 98/2020' and archivado_en is null),
  'no se duplica y lo que ya tenía no se pisa: solo se llenan los datos vacíos');

-- ---------------------------------------------------------------------
-- 2. Conversaciones y mensajes
-- ---------------------------------------------------------------------
create temp table r2 as
select public.importar_conversacion(current_setting('prueba.causa')::uuid, 'Conversación de prueba.docx',
  jsonb_build_object(
    'titulo', 'Conversación entre Persona Uno y Persona Dos', 'participantes', 'Persona Uno - Persona Dos',
    'agendado_como', 'Uno Prueba', 'lineas_origen', 3,
    'mensajes', jsonb_build_array(
      jsonb_build_object('orden', 1, 'linea', 10, 'fecha', '2025-03-11', 'fecha_texto', '11/03/25', 'emisor', 'Persona Uno',
                         'tipo', 'texto', 'contenido', 'Mensaje literal de prueba, con sus errores de tipeo',
                         'observacion', 'Nota al pie de la transcripción: aclaración de prueba'),
      jsonb_build_object('orden', 2, 'linea', 12, 'fecha', '2025-03-11', 'fecha_texto', '11/03/25', 'emisor', 'Persona Dos',
                         'tipo', 'audio_transcripto', 'contenido', '[AUDIO] Transcripción de prueba sobre la licitación 99/2020')))) as r;

select pg_temp.comprobar((select (r ->> 'mensajes')::int = 2 from r2), 'la conversación entra con sus mensajes');
select pg_temp.comprobar(
  (select observacion = 'Nota al pie de la transcripción: aclaración de prueba'
          and contenido = 'Mensaje literal de prueba, con sus errores de tipeo'
     from public.mensaje where orden = 1 and conversacion_id = (select (r ->> 'conversacion')::uuid from r2)),
  'las notas al pie entran como observación y el texto queda intacto');
select pg_temp.comprobar(
  (select hash_contenido = encode(extensions.digest(contenido, 'sha256'), 'hex') from public.mensaje where orden = 1
     and conversacion_id = (select (r ->> 'conversacion')::uuid from r2)),
  'cada mensaje guarda la huella SHA-256 de su texto');

do $$
begin
  update public.mensaje set contenido = 'texto cambiado' where orden = 1
    and conversacion_id = (select (r ->> 'conversacion')::uuid from r2);
  raise exception 'FALLÓ: se pudo cambiar el texto de un mensaje';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · el texto de un mensaje no se puede cambiar';
end $$;

do $$
begin
  update public.mensaje set fecha = '2025-03-12' where orden = 1
    and conversacion_id = (select (r ->> 'conversacion')::uuid from r2);
  raise exception 'FALLÓ: se pudo cambiar la fecha de un mensaje';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok · la fecha y el orden de un mensaje tampoco se cambian';
end $$;

select pg_temp.comprobar(
  (select (public.guardar_campo('mensaje', m.id, 'relevante', 'false'::jsonb, 'true'::jsonb) ->> 'ok')::boolean
     from public.mensaje m where m.orden = 2 and m.conversacion_id = (select (r ->> 'conversacion')::uuid from r2)),
  'un mensaje se puede marcar como relevante');
select pg_temp.comprobar(
  (select (public.guardar_campo('mensaje', m.id, 'observacion', null::jsonb, to_jsonb('Vinculado a la LP 99/2020'::text)) ->> 'ok')::boolean
     from public.mensaje m where m.orden = 2 and m.conversacion_id = (select (r ->> 'conversacion')::uuid from r2)),
  'y se le puede escribir una observación, aparte del texto literal');

-- ---------------------------------------------------------------------
-- 3. Vínculo mensaje → contratación
-- ---------------------------------------------------------------------
insert into public.vinculo (causa_id, origen_id, destino_id, tipo)
select current_setting('prueba.causa')::uuid, m.id, c.id, 'prueba_de'
  from public.mensaje m, public.contratacion c
 where m.orden = 2 and m.conversacion_id = (select (r ->> 'conversacion')::uuid from r2) and c.identificador = 'LP 99/2020';
select pg_temp.comprobar(
  exists (select 1 from public.vinculo v join public.contratacion c on c.id = v.destino_id where c.identificador = 'LP 99/2020'),
  'un mensaje se vincula a una contratación');
do $$
begin
  insert into public.vinculo (causa_id, origen_id, destino_id, tipo)
  select v.causa_id, v.origen_id, v.destino_id, v.tipo from public.vinculo v
    join public.contratacion c on c.id = v.destino_id where c.identificador = 'LP 99/2020';
  raise exception 'FALLÓ: aceptó el mismo vínculo dos veces';
exception when unique_violation then
  raise notice 'ok · el mismo vínculo no se carga dos veces';
end $$;

select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, 'licitacion 99/2020') where tipo = 'mensaje'),
  'la búsqueda encuentra mensajes por su texto, sin tildes');
select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, 'LP 99/2020') where tipo = 'contratacion'),
  'la búsqueda encuentra contrataciones por su identificador');

rollback;
\echo 'Todas las pruebas de la Fase 2 pasaron.'
