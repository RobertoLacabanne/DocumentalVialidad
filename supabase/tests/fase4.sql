-- =====================================================================
-- Pruebas de la Fase 4: documentos leídos (huella y texto por página),
-- búsqueda en los escaneos y sugerencias que una persona confirma.
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

-- Devuelve el mensaje de error de una sentencia, o null si no falló.
create function pg_temp.error_de(sentencia text) returns text
language plpgsql as $$
begin
  execute sentencia;
  return null;
exception when others then
  return sqlerrm;
end $$;

grant execute on all functions in schema pg_temp to authenticated;
select set_config('prueba.causa', id::text, false) from public.causa where legajo_fiscalia = '299113';
insert into public.miembro (email, alias, invitado_por) values ('f4@prueba.test', 'PRUEBAF4', 'prueba')
  on conflict (email) do update set activo = true;
select pg_temp.como('f4@prueba.test', '00000000-0000-0000-0000-00000000f401');

insert into public.efecto (causa_id, numero, soporte) values (current_setting('prueba.causa')::uuid, '99401', 'papel');
insert into public.contratacion (causa_id, identificador, expediente)
values (current_setting('prueba.causa')::uuid, 'LP 94/2099', '994001');

-- ---------------------------------------------------------------------
-- 1. Alta de un documento por su huella
-- ---------------------------------------------------------------------
create temp table d1 as
select public.registrar_documento(current_setting('prueba.causa')::uuid, jsonb_build_object(
  'sha256', repeat('ab', 32), 'nombre', 'Compras de prueba F4.pdf', 'ruta', 'EFECTO 99401/Compras de prueba F4.pdf',
  'bytes', 123456, 'tipo_mime', 'application/pdf', 'paginas', 2)) as r;
select set_config('prueba.doc', (select r ->> 'id' from d1), false);
select pg_temp.comprobar((select (r ->> 'ya_estaba')::boolean = false from d1), 'un archivo nuevo se da de alta');
select pg_temp.comprobar(
  (select (public.registrar_documento(current_setting('prueba.causa')::uuid,
            jsonb_build_object('sha256', upper(repeat('ab', 32)), 'nombre', 'Otro nombre.pdf', 'paginas', 2)) ->> 'ya_estaba')::boolean),
  'el mismo contenido con otro nombre es el mismo documento');
select pg_temp.comprobar(
  pg_temp.error_de($$select public.registrar_documento(current_setting('prueba.causa')::uuid,
                     '{"sha256": "no-es-una-huella", "nombre": "x.pdf"}'::jsonb)$$) like '%huella%',
  'una huella inválida no entra');

-- ---------------------------------------------------------------------
-- 2. Texto por página: no se pisa, y al terminar queda completo
-- ---------------------------------------------------------------------
select pg_temp.comprobar(
  (select (public.guardar_paginas(current_setting('prueba.doc')::uuid, jsonb_build_array(
      jsonb_build_object('nro', 1, 'texto', 'LICITACIÓN PÚBLICA LP 94/2099 · Expte. 994001 · Factura de prueba', 'metodo', 'ocr',
                         'motor', 'tesseract.js spa', 'confianza', 81.5))) ->> 'guardadas')::integer = 1),
  'la primera página se guarda');
select pg_temp.comprobar(
  (select estado = 'leyendo' and indexado_en is null from public.documento where id = current_setting('prueba.doc')::uuid),
  'con una de dos páginas, el documento sigue leyéndose');
select pg_temp.comprobar(
  (select (public.guardar_paginas(current_setting('prueba.doc')::uuid, jsonb_build_array(
      jsonb_build_object('nro', 1, 'texto', 'otro texto', 'metodo', 'ocr'))) ->> 'omitidas')::integer = 1),
  'una página ya leída no se pisa');
select pg_temp.comprobar(
  (select texto like 'LICITACIÓN%' from public.documento_pagina
    where documento_id = current_setting('prueba.doc')::uuid and nro = 1),
  'y conserva su texto');
select pg_temp.comprobar(
  pg_temp.error_de($$select public.guardar_paginas(current_setting('prueba.doc')::uuid,
                     '[{"nro": 3, "texto": "x", "metodo": "ocr"}]'::jsonb)$$) like '%no existe%',
  'una página que el archivo no tiene no entra');
select public.guardar_paginas(current_setting('prueba.doc')::uuid, jsonb_build_array(
  jsonb_build_object('nro', 2, 'texto', 'Remito firmado por Proveedora Prueba F4', 'metodo', 'capa_texto', 'motor', 'pdf.js')));
select pg_temp.comprobar(
  (select estado = 'completo' and indexado_en is not null from public.documento where id = current_setting('prueba.doc')::uuid),
  'con todas las páginas leídas queda completo, con la fecha de indexado');
select pg_temp.comprobar(
  (select leidas = 2 and con_texto = 2 and confianza_ocr = 81.5 and metodos @> array['ocr', 'capa_texto']
     from public.documento_resumen where documento_id = current_setting('prueba.doc')::uuid),
  'el resumen dice cuánto se leyó y cómo');
select public.guardar_paginas(current_setting('prueba.doc')::uuid, jsonb_build_array(
  jsonb_build_object('nro', 1, 'texto', 'LICITACIÓN PÚBLICA LP 94/2099 releída', 'metodo', 'appufil')), true);
select pg_temp.comprobar(
  (select metodo = 'appufil' and texto like '%releída' from public.documento_pagina
    where documento_id = current_setting('prueba.doc')::uuid and nro = 1),
  'se puede reemplazar el texto si se pide expresamente');

-- ---------------------------------------------------------------------
-- 3. La huella no se corrige y el documento lleva historial
-- ---------------------------------------------------------------------
select pg_temp.comprobar(
  pg_temp.error_de(format($$update public.documento set sha256 = %L where id = %L$$, repeat('cd', 32), current_setting('prueba.doc'))) like '%huella%',
  'la huella de un documento no se modifica');
select pg_temp.comprobar(
  pg_temp.error_de($$select public.guardar_campo('documento', current_setting('prueba.doc')::uuid, 'sha256',
                     to_jsonb(repeat('ab', 32)), to_jsonb(repeat('cd', 32)))$$) like '%no se edita%',
  'ni desde la ficha');
select pg_temp.comprobar(
  (select (public.guardar_campo('documento', current_setting('prueba.doc')::uuid, 'link', null::jsonb,
            to_jsonb('https://drive.google.com/file/d/prueba/view'::text)) ->> 'ok')::boolean),
  'el link de Drive se carga desde la ficha');
select pg_temp.comprobar(
  (select count(*) filter (where accion = 'alta') = 1 and count(*) filter (where accion = 'edicion') >= 2
     from public.auditoria where registro_id = current_setting('prueba.doc')::uuid),
  'el alta, el fin de la lectura y el link quedan en el historial');

-- ---------------------------------------------------------------------
-- 4. Búsqueda en los escaneos
-- ---------------------------------------------------------------------
select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, 'remito proveedora')
           where tipo = 'pagina' and titulo = 'Compras de prueba F4.pdf · pág. 2' and fragmento like '%⟦%'),
  'la búsqueda encuentra el texto de una página y marca el término');
select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, 'licitacion publica')
           where tipo = 'pagina' and detalle = 'Leído por AppUFIL'),
  'sin tildes y diciendo de dónde salió el texto');
select pg_temp.comprobar(
  exists (select 1 from public.buscar(current_setting('prueba.causa')::uuid, 'compras de prueba f4') where tipo = 'documento'),
  'y encuentra el documento por su nombre');

-- ---------------------------------------------------------------------
-- 5. Sugerencias: no se repiten y solo se aplican al confirmarlas
-- ---------------------------------------------------------------------
create temp table s1 as
select public.guardar_sugerencias(current_setting('prueba.causa')::uuid, current_setting('prueba.doc')::uuid, jsonb_build_array(
  jsonb_build_object('campo', 'efecto_id', 'valor', jsonb_build_object('id', (select id from public.efecto where numero = '99401')),
                     'fuente', 'carpeta', 'detalle', 'La carpeta se llama «EFECTO 99401»'),
  jsonb_build_object('campo', 'vinculo', 'valor', jsonb_build_object('tipo', 'contratacion', 'id', (select id from public.contratacion where identificador = 'LP 94/2099')),
                     'fuente', 'texto', 'detalle', 'Pág. 1: «LP 94/2099»'))) as n;
select pg_temp.comprobar((select n = 2 from s1), 'las sugerencias entran como pendientes');
select pg_temp.comprobar(
  (select public.guardar_sugerencias(current_setting('prueba.causa')::uuid, current_setting('prueba.doc')::uuid, jsonb_build_array(
     jsonb_build_object('campo', 'efecto_id', 'valor', jsonb_build_object('id', (select id from public.efecto where numero = '99401')),
                        'fuente', 'carpeta', 'detalle', 'otra vez'))) = 0),
  'la misma sugerencia no se carga dos veces');
select pg_temp.comprobar(
  (select efecto_id is null from public.documento where id = current_setting('prueba.doc')::uuid),
  'mientras nadie la confirma, el documento no cambia');

select public.resolver_sugerencia(
  (select id from public.sugerencia where entidad_id = current_setting('prueba.doc')::uuid and campo = 'efecto_id'), true);
select pg_temp.comprobar(
  (select d.efecto_id = e.id from public.documento d, public.efecto e
    where d.id = current_setting('prueba.doc')::uuid and e.numero = '99401'),
  'al confirmarla, el documento queda asociado al efecto');
select pg_temp.comprobar(
  (select estado = 'aceptada' and resuelta_por = '00000000-0000-0000-0000-00000000f401' and resuelta_en is not null
     from public.sugerencia where entidad_id = current_setting('prueba.doc')::uuid and campo = 'efecto_id'),
  'y queda quién la confirmó y cuándo');
select pg_temp.comprobar(
  pg_temp.error_de($$select public.resolver_sugerencia(
    (select id from public.sugerencia where entidad_id = current_setting('prueba.doc')::uuid and campo = 'efecto_id'), false)$$) like '%ya se resolvió%',
  'una sugerencia resuelta no se vuelve a resolver');

select public.resolver_sugerencia(
  (select id from public.sugerencia where entidad_id = current_setting('prueba.doc')::uuid and campo = 'vinculo'), false);
select pg_temp.comprobar(
  not exists (select 1 from public.vinculo where origen_id = current_setting('prueba.doc')::uuid),
  'descartada, no crea ningún vínculo');
select pg_temp.comprobar(
  (select public.guardar_sugerencias(current_setting('prueba.causa')::uuid, current_setting('prueba.doc')::uuid, jsonb_build_array(
     jsonb_build_object('campo', 'vinculo', 'valor', jsonb_build_object('tipo', 'contratacion', 'id', (select id from public.contratacion where identificador = 'LP 94/2099')),
                        'fuente', 'texto', 'detalle', 'Pág. 1 releída'))) = 0),
  'y si el documento se vuelve a leer, lo descartado no reaparece');

select public.guardar_sugerencias(current_setting('prueba.causa')::uuid, current_setting('prueba.doc')::uuid, jsonb_build_array(
  jsonb_build_object('campo', 'vinculo', 'valor', jsonb_build_object('tipo', 'efecto', 'id', (select id from public.efecto where numero = '99401')),
                     'fuente', 'texto', 'detalle', 'Pág. 2: «efecto 99401»')));
select public.resolver_sugerencia(
  (select id from public.sugerencia where entidad_id = current_setting('prueba.doc')::uuid and detalle = 'Pág. 2: «efecto 99401»'), true);
select pg_temp.comprobar(
  exists (select 1 from public.vinculo v join public.efecto e on e.id = v.destino_id
           where v.origen_id = current_setting('prueba.doc')::uuid and e.numero = '99401' and v.nota = 'Pág. 2: «efecto 99401»'),
  'confirmar un vínculo lo crea, con de dónde salió');

rollback;
\echo 'Todas las pruebas de la Fase 4 pasaron.'
