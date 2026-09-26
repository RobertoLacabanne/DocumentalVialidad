-- =====================================================================
-- Tablero de Prueba · Esquema inicial (Fase 0)
-- UFIL Paraná · MPF Entre Ríos
-- =====================================================================
-- Reglas que garantiza la base de datos, sin depender de la pantalla:
--   * Nada se borra. No hay permiso de DELETE: archivar es completar
--     archivado_en, y se puede deshacer.
--   * Cada alta, edición, archivo y restauración queda en `auditoria`
--     (quién, cuándo, valor anterior y valor nuevo). El historial no se
--     puede modificar.
--   * El texto literal de los mensajes y la descripción del acta de un
--     efecto no se pueden modificar una vez cargados.
--   * Solo los miembros activos (lista de invitados) leen y escriben.
--     No hay roles: todo miembro puede todo.
--   * Lo que proponga una máquina (OCR, IA, importación) va a
--     `sugerencia` y nunca pisa un dato hasta que una persona lo acepta.
-- =====================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Búsqueda en castellano, sin distinguir tildes ni mayúsculas
-- ---------------------------------------------------------------------
create text search configuration public.es (copy = pg_catalog.spanish);
alter text search configuration public.es
  alter mapping for hword, hword_part, word with extensions.unaccent, spanish_stem;

create or replace function public.sin_tildes(texto text)
returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, texto) $$;

-- ---------------------------------------------------------------------
-- Clave de orden para números jerárquicos: 2 < 2.1 < 2.2 < 2 bis < 2 ter < 3
-- Cada segmento separado por punto se codifica como 6 dígitos de número
-- y 2 de sufijo latino. La misma lógica vive en src/lib/orden.ts.
-- ---------------------------------------------------------------------
create or replace function public.clave_orden(numero text)
returns text
language plpgsql immutable parallel safe
set search_path = ''
as $$
declare
  seg text;
  m text[];
  n bigint;
  sufijo int;
  resultado text := '';
begin
  if numero is null or btrim(numero) = '' then
    return null;
  end if;
  foreach seg in array string_to_array(replace(lower(btrim(numero)), ',', '.'), '.') loop
    seg := btrim(seg);
    m := regexp_match(seg, '^(\d+)\s*([a-z]*)');
    if m is null then
      n := 999999;
      sufijo := 99;
    else
      n := least(m[1]::bigint, 999999);
      sufijo := case m[2]
        when '' then 0
        when 'bis' then 2
        when 'ter' then 3
        when 'quater' then 4
        when 'quinquies' then 5
        when 'sexies' then 6
        when 'septies' then 7
        when 'octies' then 8
        when 'novies' then 9
        when 'decies' then 10
        else 50
      end;
    end if;
    resultado := resultado || lpad(n::text, 6, '0') || lpad(sufijo::text, 2, '0');
  end loop;
  return resultado;
end
$$;

-- =====================================================================
-- Tablas
-- =====================================================================

-- Registro global: toda ficha vinculable tiene acá su ID, así los
-- vínculos, las tareas, los enlaces y las sugerencias apuntan a cualquier
-- cosa con integridad referencial.
create table public.entidad (
  id uuid primary key,
  causa_id uuid,
  tipo text not null,
  creado_en timestamptz not null default now()
);
create index entidad_causa_idx on public.entidad (causa_id, tipo);

-- Lista de invitados. Quien no está acá (o está inactivo) no ve nada.
create table public.miembro (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and email like '%_@_%'),
  nombre text,
  alias text,
  activo boolean not null default true,
  user_id uuid unique,
  invitado_por text,
  ultimo_ingreso timestamptz
);

create table public.causa (
  id uuid primary key default gen_random_uuid(),
  legajo_fiscalia text not null unique,
  numero_oga text,
  caratula text not null check (btrim(caratula) <> ''),
  fiscales text,
  delitos text,
  objeto text,
  estado text not null default 'en_tramite'
    check (estado in ('en_tramite', 'elevada_a_juicio', 'en_juicio', 'archivada', 'concluida')),
  fecha_alta date not null default current_date,
  formato_cita text not null default
    'Efecto Nº {efecto} – {titulo} (Sobre Nº {sobre}), fs. {fojas}, informe {informe}, pieza Nº {numero}',
  observaciones text
);

create table public.caratula_historial (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  texto text not null,
  desde date not null default current_date,
  hasta date,
  observaciones text
);

create table public.procedimiento (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  fecha date,
  domicilio text,
  localidad text,
  lugar text,
  resolucion_autorizante text,
  observaciones text,
  origen jsonb
);

create table public.informe (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  numero text not null check (btrim(numero) <> ''),
  tipo text not null default 'forense'
    check (tipo in ('pericial', 'forense', 'gabinete', 'organismo', 'otro')),
  organismo text,
  fecha date,
  descripcion text,
  observaciones text,
  origen jsonb
);

create table public.efecto (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  procedimiento_id uuid references public.procedimiento (id),
  numero text not null check (btrim(numero) <> ''),
  numero_clave text collate "C" generated always as (public.clave_orden(numero)) stored,
  sobre text,
  numero_interno text,
  tipo_material text check (tipo_material in (
    'manuscritos', 'bancario', 'facturacion_remitos', 'licitaciones_expedientes',
    'dispositivo', 'documentacion_varia', 'otro')),
  descripcion_acta text,
  propietario text,
  tenedor text,
  resolucion_autorizante text,
  apto_analisis boolean,
  informe_id uuid references public.informe (id),
  ubicacion_fisica text,
  responsable text references public.miembro (email) on update cascade,
  estado text not null default 'sin_iniciar'
    check (estado in ('sin_iniciar', 'en_proceso', 'escaneado', 'finalizado', 'observado')),
  prioridad text check (prioridad in ('alta', 'media', 'baja')),
  fojas_aprox integer check (fojas_aprox >= 0),
  fecha_inicio date,
  fecha_fin date,
  link_escaneo text,
  patron_contrasena text,
  observaciones text,
  origen jsonb,
  busqueda tsvector generated always as (
    setweight(to_tsvector('public.es', coalesce(numero, '') || ' ' || coalesce(sobre, '') || ' ' || coalesce(numero_interno, '')), 'A') ||
    setweight(to_tsvector('public.es', coalesce(descripcion_acta, '')), 'B') ||
    setweight(to_tsvector('public.es', coalesce(propietario, '') || ' ' || coalesce(tenedor, '') || ' ' || coalesce(observaciones, '')), 'C')
  ) stored
);

create table public.conversacion (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  efecto_id uuid references public.efecto (id),
  informe_id uuid references public.informe (id),
  titulo text not null check (btrim(titulo) <> ''),
  participantes text,
  titular_dispositivo text,
  contacto_relevante text,
  agendado_como text,
  periodo_desde date,
  periodo_hasta date,
  observaciones text,
  origen jsonb
);

create table public.mensaje (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  conversacion_id uuid not null references public.conversacion (id),
  orden integer,
  fecha_hora timestamptz,
  fecha_hora_texto text,
  emisor text,
  receptor text,
  tipo text not null default 'texto'
    check (tipo in ('texto', 'audio_transcripto', 'imagen', 'archivo', 'otro')),
  contenido text,
  hash_contenido text,
  relevante boolean not null default false,
  observacion text,
  origen jsonb,
  busqueda tsvector generated always as (
    setweight(to_tsvector('public.es', coalesce(contenido, '')), 'A') ||
    setweight(to_tsvector('public.es', coalesce(emisor, '') || ' ' || coalesce(receptor, '')), 'B')
  ) stored
);

create table public.marca (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  mensaje_id uuid not null references public.mensaje (id),
  inicio integer not null check (inicio >= 0),
  fin integer not null,
  nota text,
  check (fin > inicio)
);

create table public.pieza (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  numero_orden text,
  orden_clave text collate "C" generated always as (public.clave_orden(numero_orden)) stored,
  tipo text not null default 'documental_secuestrada' check (tipo in (
    'documental_secuestrada', 'expediente_administrativo', 'informe_pericial',
    'extraccion_forense', 'mensaje_conversacion', 'correo_electronico',
    'informe_organismo', 'testimonial', 'audiovisual', 'otro')),
  titulo text not null check (btrim(titulo) <> ''),
  fecha_desde date,
  fecha_hasta date,
  fecha_precision text not null default 'sin_fecha'
    check (fecha_precision in ('dia', 'mes', 'anio', 'aproximada', 'sin_fecha')),
  autor text,
  destinatarios text,
  resumen text,
  observaciones_analista text,
  efecto_id uuid references public.efecto (id),
  sobre text,
  lugar_secuestro text,
  fecha_secuestro date,
  informe_id uuid references public.informe (id),
  fojas text,
  conversacion_id uuid references public.conversacion (id),
  mensaje_id uuid references public.mensaje (id),
  relevancia text check (relevancia in ('alta', 'media', 'baja', 'descartada')),
  estado_trabajo text not null default 'pendiente'
    check (estado_trabajo in ('pendiente', 'en_proceso', 'revisada')),
  responsable text references public.miembro (email) on update cascade,
  etiquetas text[] not null default '{}',
  origen jsonb,
  busqueda tsvector generated always as (
    setweight(to_tsvector('public.es', coalesce(numero_orden, '') || ' ' || coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('public.es', coalesce(autor, '') || ' ' || coalesce(destinatarios, '') || ' ' || coalesce(fojas, '') || ' ' || coalesce(sobre, '')), 'B') ||
    setweight(to_tsvector('public.es', coalesce(resumen, '')), 'C') ||
    setweight(to_tsvector('public.es', coalesce(observaciones_analista, '')), 'D')
  ) stored,
  check (fecha_hasta is null or fecha_desde is null or fecha_hasta >= fecha_desde)
);

create table public.enlace (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  entidad_id uuid not null references public.entidad (id),
  etiqueta text not null default 'original escaneado',
  url text,
  ruta_local text,
  drive_file_id text,
  nombre_archivo text,
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  indexado_en timestamptz,
  observaciones text,
  check (url is not null or ruta_local is not null)
);

create table public.persona (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  tipo_persona text not null default 'fisica' check (tipo_persona in ('fisica', 'juridica')),
  nombre text not null check (btrim(nombre) <> ''),
  cargo text,
  observaciones text,
  origen jsonb,
  busqueda tsvector generated always as (
    setweight(to_tsvector('public.es', coalesce(nombre, '')), 'A') ||
    setweight(to_tsvector('public.es', coalesce(cargo, '') || ' ' || coalesce(observaciones, '')), 'C')
  ) stored
);

create table public.identificador (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  persona_id uuid references public.persona (id),
  tipo text not null check (tipo in ('telefono', 'alias_agendado', 'cuit', 'dni', 'email', 'otro')),
  valor text not null check (btrim(valor) <> ''),
  efecto_id uuid references public.efecto (id),
  observaciones text,
  origen jsonb
);

create table public.rol_en_causa (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  persona_id uuid not null references public.persona (id),
  rol text not null check (rol in (
    'imputado', 'testigo', 'denunciante', 'funcionario_dpv', 'proveedor', 'perito', 'otro')),
  desde date,
  hasta date,
  observaciones text
);

create table public.contratacion (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  identificador text not null check (btrim(identificador) <> ''),
  expediente text,
  tipo_procedimiento text,
  objeto text,
  presupuesto_oficial numeric(16, 2),
  reserva_presupuestaria numeric(16, 2),
  monto_adjudicado numeric(16, 2),
  adjudicatario_id uuid references public.persona (id),
  fecha_apertura date,
  observaciones text,
  origen jsonb,
  busqueda tsvector generated always as (
    setweight(to_tsvector('public.es', coalesce(identificador, '') || ' ' || coalesce(expediente, '')), 'A') ||
    setweight(to_tsvector('public.es', coalesce(objeto, '') || ' ' || coalesce(tipo_procedimiento, '')), 'B') ||
    setweight(to_tsvector('public.es', coalesce(observaciones, '')), 'D')
  ) stored
);

create table public.paso_tramite (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  contratacion_id uuid not null references public.contratacion (id),
  orden integer,
  descripcion text not null check (btrim(descripcion) <> ''),
  fojas text,
  fecha date,
  fecha_precision text not null default 'dia'
    check (fecha_precision in ('dia', 'mes', 'anio', 'aproximada', 'sin_fecha')),
  firmante_id uuid references public.persona (id),
  firmante_texto text,
  cargo text,
  link text,
  observaciones text,
  origen jsonb
);

create table public.oferta (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  contratacion_id uuid not null references public.contratacion (id),
  oferente_id uuid references public.persona (id),
  oferente_texto text,
  monto numeric(16, 2),
  fecha date,
  link text,
  observaciones text,
  origen jsonb
);

-- Situación procesal: se carga una vez y alcanza a todo lo que afecta.
-- 'sin_efecto' = resuelta a favor: deja de generar alertas.
create table public.incidencia_procesal (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  titulo text not null check (btrim(titulo) <> ''),
  tipo text not null default 'planteo_exclusion'
    check (tipo in ('planteo_exclusion', 'nulidad', 'apelacion', 'casacion', 'otro')),
  situacion text not null default 'admisibilidad_cuestionada'
    check (situacion in ('admisibilidad_cuestionada', 'pendiente_resolucion', 'excluida', 'sin_efecto')),
  tribunal text,
  fecha_planteo date,
  fecha_resolucion date,
  resolucion text,
  observaciones text
);

create table public.incidencia_alcance (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  incidencia_id uuid not null references public.incidencia_procesal (id),
  entidad_id uuid not null references public.entidad (id)
);

create table public.ofrecimiento_item (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  pieza_id uuid not null references public.pieza (id),
  numero text,
  numero_clave text collate "C" generated always as (public.clave_orden(numero)) stored,
  entregada_defensa boolean not null default false,
  fecha_entrega date,
  constancia_entrega text,
  acuerdo_probatorio text check (acuerdo_probatorio in ('si', 'no', 'parcial')),
  se_exhibe boolean,
  introduce_id uuid references public.persona (id),
  partes_a_exhibir text,
  requiere_escaneo boolean not null default false,
  ubicacion_fisica text,
  observaciones text
);

create table public.acto_procesal (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  fecha date,
  fecha_precision text not null default 'dia'
    check (fecha_precision in ('dia', 'mes', 'anio', 'aproximada', 'sin_fecha')),
  tipo text not null default 'otro'
    check (tipo in ('allanamiento', 'resolucion', 'audiencia', 'planteo', 'otro')),
  titulo text not null check (btrim(titulo) <> ''),
  descripcion text,
  observaciones text
);

create table public.vinculo (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  origen_id uuid not null references public.entidad (id),
  destino_id uuid not null references public.entidad (id),
  tipo text not null default 'relacionado' check (tipo in (
    'relacionado', 'responde_a', 'adjunto_de', 'misma_operacion', 'menciona_a',
    'prueba_de', 'imputado_vinculado', 'otro')),
  nota text,
  check (origen_id <> destino_id)
);

create table public.tarea (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  titulo text not null check (btrim(titulo) <> ''),
  descripcion text,
  responsable text references public.miembro (email) on update cascade,
  vence date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'hecha')),
  entidad_id uuid references public.entidad (id),
  origen jsonb
);

create table public.sugerencia (
  id uuid primary key default gen_random_uuid(),
  causa_id uuid not null references public.causa (id),
  entidad_id uuid not null references public.entidad (id),
  campo text not null,
  valor_sugerido jsonb,
  fuente text not null check (fuente in ('ocr', 'ia', 'importacion', 'drive', 'otro')),
  detalle text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'descartada')),
  resuelta_por uuid,
  resuelta_en timestamptz
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  ocurrido_en timestamptz not null default now(),
  causa_id uuid,
  tabla text not null,
  registro_id uuid not null,
  accion text not null check (accion in ('alta', 'edicion', 'archivo', 'restauracion')),
  usuario_id uuid,
  usuario_email text,
  cambios jsonb not null default '{}'::jsonb,
  antes jsonb,
  despues jsonb
);
create index auditoria_registro_idx on public.auditoria (registro_id, ocurrido_en desc);
create index auditoria_causa_idx on public.auditoria (causa_id, ocurrido_en desc);

-- =====================================================================
-- Columnas comunes de toda ficha: sellos de tiempo, autor, versión y archivo
-- =====================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'miembro', 'causa', 'caratula_historial', 'procedimiento', 'informe', 'efecto',
    'conversacion', 'mensaje', 'marca', 'pieza', 'enlace', 'persona', 'identificador',
    'rol_en_causa', 'contratacion', 'paso_tramite', 'oferta', 'incidencia_procesal',
    'incidencia_alcance', 'ofrecimiento_item', 'acto_procesal', 'vinculo', 'tarea', 'sugerencia'
  ] loop
    execute format($f$
      alter table public.%I
        add column creado_en timestamptz not null default now(),
        add column creado_por uuid,
        add column actualizado_en timestamptz not null default now(),
        add column actualizado_por uuid,
        add column version integer not null default 1,
        add column archivado_en timestamptz,
        add column archivado_por uuid
    $f$, t);
  end loop;
end
$$;

-- =====================================================================
-- Índices
-- =====================================================================
create index causa_legajo_idx on public.causa (legajo_fiscalia);
create index procedimiento_causa_idx on public.procedimiento (causa_id, fecha);
create index informe_causa_idx on public.informe (causa_id, numero);
create index efecto_causa_idx on public.efecto (causa_id, numero_clave);
create index efecto_procedimiento_idx on public.efecto (procedimiento_id);
create index efecto_busqueda_idx on public.efecto using gin (busqueda);
create index conversacion_causa_idx on public.conversacion (causa_id);
create index mensaje_conversacion_idx on public.mensaje (conversacion_id, fecha_hora, orden);
create index mensaje_causa_relevante_idx on public.mensaje (causa_id) where relevante;
create index mensaje_busqueda_idx on public.mensaje using gin (busqueda);
create index marca_mensaje_idx on public.marca (mensaje_id);
create index pieza_causa_orden_idx on public.pieza (causa_id, orden_clave);
create index pieza_efecto_idx on public.pieza (efecto_id);
create index pieza_informe_idx on public.pieza (informe_id);
create index pieza_busqueda_idx on public.pieza using gin (busqueda);
create index pieza_etiquetas_idx on public.pieza using gin (etiquetas);
create index pieza_titulo_trgm_idx on public.pieza
  using gin (public.sin_tildes(lower(titulo)) extensions.gin_trgm_ops);
create index enlace_entidad_idx on public.enlace (entidad_id);
create index persona_causa_idx on public.persona (causa_id);
create index persona_busqueda_idx on public.persona using gin (busqueda);
create index persona_nombre_trgm_idx on public.persona
  using gin (public.sin_tildes(lower(nombre)) extensions.gin_trgm_ops);
create index identificador_persona_idx on public.identificador (persona_id);
create index identificador_valor_trgm_idx on public.identificador
  using gin (public.sin_tildes(lower(valor)) extensions.gin_trgm_ops);
create index rol_persona_idx on public.rol_en_causa (persona_id);
create index contratacion_causa_idx on public.contratacion (causa_id, identificador);
create index contratacion_busqueda_idx on public.contratacion using gin (busqueda);
create index paso_contratacion_idx on public.paso_tramite (contratacion_id, orden, fecha);
create index oferta_contratacion_idx on public.oferta (contratacion_id);
create index incidencia_causa_idx on public.incidencia_procesal (causa_id);
create index alcance_entidad_idx on public.incidencia_alcance (entidad_id);
create index alcance_incidencia_idx on public.incidencia_alcance (incidencia_id);
create index ofrecimiento_causa_idx on public.ofrecimiento_item (causa_id, numero_clave);
create index acto_causa_idx on public.acto_procesal (causa_id, fecha);
create index vinculo_origen_idx on public.vinculo (origen_id);
create index vinculo_destino_idx on public.vinculo (destino_id);
create unique index vinculo_unico_idx on public.vinculo (origen_id, destino_id, tipo)
  where archivado_en is null;
create index tarea_causa_idx on public.tarea (causa_id, estado, vence);
create index sugerencia_entidad_idx on public.sugerencia (entidad_id) where estado = 'pendiente';

-- =====================================================================
-- Funciones de disparadores
-- =====================================================================

-- Sella autor, fecha y versión. La versión sube en cada edición.
create or replace function public.t_sellar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.creado_por := auth.uid();
    new.actualizado_en := now();
    new.actualizado_por := auth.uid();
    new.version := 1;
    if new.archivado_en is not null then
      new.archivado_por := auth.uid();
    end if;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.actualizado_en := now();
    new.actualizado_por := auth.uid();
    new.version := old.version + 1;
    if new.archivado_en is distinct from old.archivado_en then
      new.archivado_por := case when new.archivado_en is null then null else auth.uid() end;
    else
      new.archivado_por := old.archivado_por;
    end if;
  end if;
  return new;
end
$$;

-- Da de alta la ficha en el registro global de entidades.
create or replace function public.t_registrar_entidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.entidad (id, causa_id, tipo)
  values (
    new.id,
    coalesce((to_jsonb(new) ->> 'causa_id')::uuid, case when tg_table_name = 'causa' then new.id end),
    tg_table_name
  )
  on conflict (id) do nothing;
  return null;
end
$$;

-- Escribe el historial. Solo registra los campos que cambiaron.
create or replace function public.t_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_despues jsonb := to_jsonb(new) - 'busqueda';
  v_cambios jsonb := '{}'::jsonb;
  v_accion text;
  k text;
  ignorar constant text[] := array[
    'actualizado_en', 'actualizado_por', 'version', 'archivado_por',
    'orden_clave', 'numero_clave', 'hash_contenido', 'ultimo_ingreso', 'user_id'];
begin
  if tg_op = 'INSERT' then
    v_accion := 'alta';
  else
    v_antes := to_jsonb(old) - 'busqueda';
    for k in select jsonb_object_keys(v_despues) loop
      if not (k = any (ignorar)) and (v_antes -> k) is distinct from (v_despues -> k) then
        v_cambios := v_cambios || jsonb_build_object(
          k, jsonb_build_object('antes', v_antes -> k, 'despues', v_despues -> k));
      end if;
    end loop;
    if v_cambios = '{}'::jsonb then
      return null;
    end if;
    if (v_antes ->> 'archivado_en') is null and (v_despues ->> 'archivado_en') is not null then
      v_accion := 'archivo';
    elsif (v_antes ->> 'archivado_en') is not null and (v_despues ->> 'archivado_en') is null then
      v_accion := 'restauracion';
    else
      v_accion := 'edicion';
    end if;
  end if;

  insert into public.auditoria (
    causa_id, tabla, registro_id, accion, usuario_id, usuario_email, cambios, antes, despues)
  values (
    coalesce((v_despues ->> 'causa_id')::uuid, case when tg_table_name = 'causa' then new.id end),
    tg_table_name,
    new.id,
    v_accion,
    auth.uid(),
    nullif(lower(auth.jwt() ->> 'email'), ''),
    v_cambios,
    v_antes,
    case when tg_op = 'INSERT' then v_despues end
  );
  return null;
end
$$;

create or replace function public.t_auditoria_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'El historial no se puede modificar ni borrar.';
end
$$;

-- El texto transcripto de un mensaje es literal: solo se marca u observa.
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
     or new.tipo is distinct from old.tipo
     or new.hash_contenido is distinct from old.hash_contenido
     or new.conversacion_id is distinct from old.conversacion_id then
    raise exception 'La transcripción es literal: no se puede modificar. Se puede marcar como relevante u observar.';
  end if;
  return new;
end
$$;

-- La descripción según el acta no se toca una vez cargada.
create or replace function public.t_efecto_acta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.descripcion_acta is not null and btrim(old.descripcion_acta) <> ''
     and new.descripcion_acta is distinct from old.descripcion_acta then
    raise exception 'La descripción según el acta no se puede modificar una vez cargada.';
  end if;
  return new;
end
$$;

-- Ninguna ficha cambia de causa.
create or replace function public.t_causa_fija()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) ->> 'causa_id') is distinct from (to_jsonb(old) ->> 'causa_id') then
    raise exception 'Una ficha no puede pasar a otra causa.';
  end if;
  return new;
end
$$;

-- La carátula lleva su propio historial con fechas.
create or replace function public.t_caratula_historial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.caratula_historial (causa_id, texto, desde) values (new.id, new.caratula, new.fecha_alta);
  elsif new.caratula is distinct from old.caratula then
    update public.caratula_historial set hasta = current_date
     where causa_id = new.id and hasta is null;
    insert into public.caratula_historial (causa_id, texto, desde) values (new.id, new.caratula, current_date);
  end if;
  return null;
end
$$;

-- =====================================================================
-- Disparadores
-- =====================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'miembro', 'causa', 'caratula_historial', 'procedimiento', 'informe', 'efecto',
    'conversacion', 'mensaje', 'marca', 'pieza', 'enlace', 'persona', 'identificador',
    'rol_en_causa', 'contratacion', 'paso_tramite', 'oferta', 'incidencia_procesal',
    'incidencia_alcance', 'ofrecimiento_item', 'acto_procesal', 'vinculo', 'tarea', 'sugerencia'
  ] loop
    execute format('create trigger b_sellar before insert or update on public.%I
                    for each row execute function public.t_sellar()', t);
    execute format('create trigger z_auditar after insert or update on public.%I
                    for each row execute function public.t_auditar()', t);
    if t not in ('miembro', 'caratula_historial') then
      execute format('create trigger y_entidad after insert on public.%I
                      for each row execute function public.t_registrar_entidad()', t);
    end if;
    if t not in ('miembro', 'causa') then
      execute format('create trigger a_causa_fija before update on public.%I
                      for each row execute function public.t_causa_fija()', t);
    end if;
  end loop;
end
$$;

create trigger a_literal before insert or update on public.mensaje
  for each row execute function public.t_mensaje_literal();
create trigger a_acta before update on public.efecto
  for each row execute function public.t_efecto_acta();
create trigger x_caratula after insert or update of caratula on public.causa
  for each row execute function public.t_caratula_historial();
create trigger auditoria_inmutable before update or delete on public.auditoria
  for each row execute function public.t_auditoria_inmutable();
create trigger auditoria_sin_truncar before truncate on public.auditoria
  for each statement execute function public.t_auditoria_inmutable();

-- =====================================================================
-- Acceso: solo miembros activos. No hay roles ni DELETE.
-- =====================================================================
create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembro
     where email = lower(coalesce(auth.jwt() ->> 'email', ''))
       and activo
       and archivado_en is null
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'miembro', 'causa', 'caratula_historial', 'procedimiento', 'informe', 'efecto',
    'conversacion', 'mensaje', 'marca', 'pieza', 'enlace', 'persona', 'identificador',
    'rol_en_causa', 'contratacion', 'paso_tramite', 'oferta', 'incidencia_procesal',
    'incidencia_alcance', 'ofrecimiento_item', 'acto_procesal', 'vinculo', 'tarea', 'sugerencia'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy miembros_leen on public.%I for select to authenticated
                    using ((select public.es_miembro()))', t);
    execute format('create policy miembros_cargan on public.%I for insert to authenticated
                    with check ((select public.es_miembro()))', t);
    execute format('create policy miembros_editan on public.%I for update to authenticated
                    using ((select public.es_miembro())) with check ((select public.es_miembro()))', t);
  end loop;
end
$$;

alter table public.entidad enable row level security;
create policy miembros_leen on public.entidad for select to authenticated
  using ((select public.es_miembro()));

alter table public.auditoria enable row level security;
create policy miembros_leen on public.auditoria for select to authenticated
  using ((select public.es_miembro()));

revoke delete, truncate on all tables in schema public from anon, authenticated;
revoke insert, update on public.entidad, public.auditoria from anon, authenticated;

-- =====================================================================
-- Vista: situación procesal efectiva de cada pieza.
-- Hereda de su efecto, del procedimiento del efecto y de su informe;
-- gana la situación más grave.
-- =====================================================================
create view public.pieza_estado_procesal
with (security_invoker = true)
as
with alcance as (
  select a.entidad_id,
         i.id as incidencia_id,
         i.titulo,
         i.situacion,
         case i.situacion
           when 'excluida' then 3
           when 'pendiente_resolucion' then 2
           when 'admisibilidad_cuestionada' then 1
           else 0
         end as gravedad
    from public.incidencia_alcance a
    join public.incidencia_procesal i on i.id = a.incidencia_id
   where a.archivado_en is null
     and i.archivado_en is null
     and i.situacion <> 'sin_efecto'
),
cadena as (
  select p.id as pieza_id, p.causa_id, p.id as entidad_id, 'pieza'::text as via from public.pieza p
  union all
  select p.id, p.causa_id, p.efecto_id, 'efecto' from public.pieza p where p.efecto_id is not null
  union all
  select p.id, p.causa_id, e.procedimiento_id, 'procedimiento'
    from public.pieza p join public.efecto e on e.id = p.efecto_id
   where e.procedimiento_id is not null
  union all
  select p.id, p.causa_id, p.informe_id, 'informe' from public.pieza p where p.informe_id is not null
)
select distinct on (c.pieza_id)
       c.pieza_id,
       c.causa_id,
       a.situacion,
       a.gravedad,
       a.titulo,
       a.incidencia_id,
       c.via
  from cadena c
  join alcance a on a.entidad_id = c.entidad_id
 order by c.pieza_id, a.gravedad desc;

-- =====================================================================
-- Funciones que llama la app
-- =====================================================================

-- Se llama al entrar. Vincula la cuenta con la invitación y responde si
-- la persona está habilitada. Si todavía no hay ningún miembro, quien
-- entra primero queda habilitado (así no hace falta tocar SQL para empezar).
create or replace function public.registrar_ingreso()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nombre text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name');
  v_miembro public.miembro;
begin
  if auth.uid() is null or v_email = '' then
    return jsonb_build_object('habilitado', false);
  end if;

  if not exists (select 1 from public.miembro) then
    insert into public.miembro (email, nombre, invitado_por)
    values (v_email, v_nombre, 'primer ingreso');
  end if;

  update public.miembro
     set user_id = auth.uid(),
         ultimo_ingreso = now(),
         nombre = coalesce(nombre, v_nombre)
   where email = v_email and activo and archivado_en is null
  returning * into v_miembro;

  if v_miembro.id is null then
    return jsonb_build_object('habilitado', false, 'email', v_email);
  end if;
  return jsonb_build_object('habilitado', true, 'miembro', to_jsonb(v_miembro));
end
$$;

-- Guarda un solo campo, solo si nadie lo cambió desde que la persona lo
-- vio. Si otro lo cambió, no pisa nada y devuelve la ficha actual para
-- mostrar qué cambió.
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
    'ofrecimiento_item', 'acto_procesal', 'vinculo', 'tarea', 'sugerencia'];
  prohibidos constant text[] := array[
    'id', 'causa_id', 'creado_en', 'creado_por', 'actualizado_en', 'actualizado_por',
    'version', 'archivado_por', 'busqueda', 'orden_clave', 'numero_clave', 'hash_contenido',
    'user_id', 'ultimo_ingreso'];
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

-- Búsqueda global: fichas, mensajes, efectos, personas y contrataciones.
-- Los términos encontrados vienen entre ⟦ y ⟧ para resaltarlos.
create or replace function public.buscar(p_causa uuid, p_texto text, p_limite integer default 40)
returns table (tipo text, id uuid, titulo text, detalle text, fragmento text, rango real)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('public.es', p_texto) as consulta,
           public.sin_tildes(lower(btrim(p_texto))) as plano
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
           coalesce(e.tipo_material, ''),
           ts_headline('public.es', coalesce(e.descripcion_acta, e.numero), q.consulta,
                       'StartSel=⟦, StopSel=⟧, MaxWords=26, MinWords=8, MaxFragments=1'),
           ts_rank(e.busqueda, q.consulta) + 0.1
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

revoke execute on function public.registrar_ingreso() from public, anon;
revoke execute on function public.guardar_campo(text, uuid, text, jsonb, jsonb) from public, anon;
revoke execute on function public.buscar(uuid, text, integer) from public, anon;
revoke execute on function public.es_miembro() from public, anon;
grant execute on function public.registrar_ingreso() to authenticated;
grant execute on function public.guardar_campo(text, uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.buscar(uuid, text, integer) to authenticated;
grant execute on function public.es_miembro() to authenticated;

-- =====================================================================
-- Tiempo real: los cambios de estas tablas llegan solos a las pantallas.
-- (Los mensajes quedan afuera hasta la Fase 2, para no inundar el canal
-- durante importaciones grandes.)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.miembro, public.causa, public.procedimiento, public.informe, public.efecto,
      public.conversacion, public.pieza, public.enlace, public.persona, public.identificador,
      public.contratacion, public.paso_tramite, public.oferta, public.incidencia_procesal,
      public.incidencia_alcance, public.ofrecimiento_item, public.acto_procesal,
      public.vinculo, public.tarea, public.sugerencia, public.auditoria;
  end if;
end
$$;
