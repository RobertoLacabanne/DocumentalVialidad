// Prepara el Supabase LOCAL con una causa de ejemplo, toda inventada, para
// sacar las capturas del manual de uso. Ningún dato sale de una causa real:
// el manual se publica y se reparte, así que las capturas no pueden mostrar
// nombres, CUIT ni montos verdaderos.
// Uso: npx supabase db reset && node scripts/preparar-local.mjs && node scripts/preparar-manual.mjs
// Nunca correr contra producción: solo apunta a 127.0.0.1.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
if (!env.API_URL?.includes('127.0.0.1')) {
  console.error('Este script solo corre contra el Supabase local.');
  process.exit(1);
}
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function q(p) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

const ROBER = 'rober@ejemplo.test';
const INES = 'ines@ejemplo.test';

// La causa de la semilla pasa a ser una causa de ejemplo.
const [causa] = await q(admin.from('causa').select('id').limit(1));
const C = causa.id;
await q(
  admin
    .from('causa')
    .update({
      legajo_fiscalia: '123456',
      numero_oga: '12345',
      caratula: 'CAUSA DE EJEMPLO S/ FRAUDE A LA ADMINISTRACIÓN PÚBLICA',
      objeto: 'Causa inventada para el manual de uso.',
      observaciones: null,
    })
    .eq('id', C),
);
await q(admin.from('acto_procesal').update({ titulo: 'Allanamientos', descripcion: 'Procedimientos de ejemplo.' }).eq('causa_id', C));
// La contratación de la semilla se archiva: la de ejemplo se carga entera, así su historial no muestra ids internos.
await q(admin.from('contratacion').update({ archivado_en: new Date().toISOString() }).eq('causa_id', C));
await q(admin.from('miembro').update({ nombre: 'Rober' }).eq('email', 'rober@ejemplo.test'));
await q(admin.from('miembro').update({ nombre: 'Inés' }).eq('email', 'ines@ejemplo.test'));

// Allanamientos, informe y efectos.
const [p1, p2] = await q(
  admin
    .from('procedimiento')
    .insert([
      { causa_id: C, fecha: '2025-03-12', domicilio: 'Calle Ejemplo 123', localidad: 'Paraná', lugar: 'Comercio Supuesto S.R.L.' },
      { causa_id: C, fecha: '2025-03-12', domicilio: 'Av. Muestra 456', localidad: 'Paraná', lugar: 'Domicilio de Pedro Muestra' },
    ])
    .select('id'),
);
const inf = await q(admin.from('informe').insert({ causa_id: C, numero: 'C0001', tipo: 'gabinete', organismo: 'Gabinete de Informática Forense' }).select('id').single());
const efectos = await q(
  admin
    .from('efecto')
    .insert(
      [
        { numero: '10001', soporte: 'papel', tipo_material: 'manuscritos', descripcion_acta: 'Agenda 2021 de tapa negra con anotaciones manuscritas.', estado: 'finalizado', responsable: ROBER, responsable_alias: 'ROBER', procedimiento_id: p1.id, fojas_aprox: 120, prioridad: 'alta', lugar_secuestro: 'Comercio Supuesto S.R.L.' },
        { numero: '10002', soporte: 'papel', tipo_material: 'facturacion_remitos', descripcion_acta: 'Carpeta con facturas y remitos emitidos a la Dirección de Ejemplo.', estado: 'en_proceso', responsable: INES, responsable_alias: 'INES', procedimiento_id: p1.id, fojas_aprox: 80, prioridad: 'media', lugar_secuestro: 'Comercio Supuesto S.R.L.' },
        { numero: '10003', soporte: 'papel', tipo_material: 'licitaciones_expedientes', descripcion_acta: 'Bibliorato con pliegos y ofertas de licitaciones.', estado: 'sin_iniciar', responsable_alias: 'CARLI', procedimiento_id: p1.id, fojas_aprox: 210, prioridad: 'alta', lugar_secuestro: 'Comercio Supuesto S.R.L.' },
        { numero: '10004', soporte: 'papel', tipo_material: 'documentacion_varia', descripcion_acta: 'Sobre con documentación varia y notas sueltas.', estado: 'escaneado', responsable: ROBER, responsable_alias: 'ROBER', procedimiento_id: p2.id, fojas_aprox: 35, lugar_secuestro: 'Domicilio de Pedro Muestra' },
        { numero: '10005', soporte: 'papel', tipo_material: 'bancario', descripcion_acta: 'Chequeras usadas con anotaciones.', estado: 'observado', responsable: INES, responsable_alias: 'INES', procedimiento_id: p2.id, fojas_aprox: 18, observaciones: 'Falta la cadena de custodia del sobre.', lugar_secuestro: 'Domicilio de Pedro Muestra' },
        { numero: '20001', soporte: 'digital', tipo_material: 'dispositivo', descripcion_acta: 'Teléfono celular marca Ejemplo, color negro.', estado: 'en_proceso', responsable: ROBER, responsable_alias: 'ROBER', procedimiento_id: p2.id, informe_id: inf.id, tiene_informe_gabinete: true, apto_analisis: 'si', propietario: 'Pedro Muestra', tenedor: 'Pedro Muestra', patron_contrasena: 'SI', lugar_secuestro: 'Domicilio de Pedro Muestra' },
        { numero: '20002', soporte: 'digital', tipo_material: 'dispositivo', descripcion_acta: 'Notebook gris con cargador.', estado: 'sin_iniciar', procedimiento_id: p1.id, apto_analisis: 'si', propietario: 'Comercio Supuesto S.R.L.', lugar_secuestro: 'Comercio Supuesto S.R.L.' },
        { numero: '20003', soporte: 'digital', tipo_material: 'dispositivo', descripcion_acta: 'Pendrive de 16 GB.', estado: 'finalizado', responsable: INES, responsable_alias: 'INES', procedimiento_id: p1.id, apto_analisis: 'no_requiere_analisis', lugar_secuestro: 'Comercio Supuesto S.R.L.' },
      ].map((e) => ({ causa_id: C, ...e })),
      { defaultToNull: false },
    )
    .select('id, numero'),
);
const ef = Object.fromEntries(efectos.map((e) => [e.numero, e.id]));

// Personas y empresas.
const personas = await q(
  admin
    .from('persona')
    .insert(
      [
        { nombre: 'Laura Ejemplo', tipo_persona: 'fisica', cargo: 'Jefa de Suministros de la Dirección de Ejemplo' },
        { nombre: 'Pedro Muestra', tipo_persona: 'fisica', cargo: 'Titular de Comercio Supuesto S.R.L.' },
        { nombre: 'Carlos Modelo', tipo_persona: 'fisica', cargo: 'Presidente de Empresa Imaginaria S.A.' },
        { nombre: 'Ana Prueba', tipo_persona: 'fisica', cargo: 'Empleada administrativa' },
        { nombre: 'Comercio Supuesto S.R.L.', tipo_persona: 'juridica', cargo: null },
        { nombre: 'Empresa Imaginaria S.A.', tipo_persona: 'juridica', cargo: null },
      ].map((p) => ({ causa_id: C, ...p })),
    )
    .select('id, nombre'),
);
const pe = Object.fromEntries(personas.map((p) => [p.nombre, p.id]));
await q(
  admin.from('rol_en_causa').insert(
    [
      ['Laura Ejemplo', 'imputado'],
      ['Laura Ejemplo', 'funcionario_dpv'],
      ['Pedro Muestra', 'imputado'],
      ['Pedro Muestra', 'proveedor'],
      ['Carlos Modelo', 'proveedor'],
      ['Ana Prueba', 'testigo'],
      ['Comercio Supuesto S.R.L.', 'proveedor'],
      ['Empresa Imaginaria S.A.', 'proveedor'],
    ].map(([n, rol]) => ({ causa_id: C, persona_id: pe[n], rol })),
  ),
);
await q(
  admin.from('identificador').insert(
    [
      ['Pedro Muestra', 'telefono', '343 000-0001', ef['20001']],
      ['Pedro Muestra', 'alias_agendado', 'Pedro Repuestos', null],
      ['Laura Ejemplo', 'alias_agendado', 'Laura Suministros', null],
      ['Comercio Supuesto S.R.L.', 'cuit', '30-11111111-1', null],
      ['Empresa Imaginaria S.A.', 'cuit', '30-22222222-2', null],
    ].map(([n, tipo, valor, efecto_id]) => ({ causa_id: C, persona_id: pe[n], tipo, valor, efecto_id })),
  ),
);
await q(
  admin.from('vinculo').insert(
    [
      ['Pedro Muestra', 'Comercio Supuesto S.R.L.', 'Titular', 'Contrato social, fs. 12'],
      ['Carlos Modelo', 'Empresa Imaginaria S.A.', 'Presidente', 'Estatuto, fs. 4'],
    ].map(([a, b, nota, fuente]) => ({ causa_id: C, origen_id: pe[a], destino_id: pe[b], tipo: 'relacionado', nota, fuente })),
  ),
);

// Contrataciones.
const lp = await q(
  admin
    .from('contratacion')
    .insert({
      causa_id: C,
      identificador: 'LP 01/2021',
      expediente: '100001',
      tipo_procedimiento: 'Licitación pública',
      objeto: 'Adquisición de repuestos para motoniveladoras',
      fecha_inicio: '2021-03-01',
      fecha_apertura: '2021-05-19',
      presupuesto_oficial: 1250000,
      monto_adjudicado: 1180000,
      adjudicatario_id: pe['Comercio Supuesto S.R.L.'],
      observaciones: 'Según los mensajes, los oferentes se repartieron la cotización antes de la apertura.',
    })
    .select('id')
    .single(),
);
const pasos = [
  ['Pedido de compra de repuestos', '1', '2021-03-01', 'dia', 'Área de Mantenimiento'],
  ['Presupuesto oficial: $1.250.000', '20', '2021-03-01', 'mes', 'Laura Ejemplo'],
  ['Pliegos de condiciones particulares y generales', '38-56', null, 'sin_fecha', 'Laura Ejemplo'],
  ['Acta de apertura de sobres', '92', '2021-05-19', 'dia', 'Escribano delegado'],
  ['Dictamen de la comisión evaluadora', '140', '2021-05-28', 'dia', 'Comisión evaluadora'],
  ['Resolución de adjudicación', '160', '2021-06-10', 'dia', 'Director de Ejemplo'],
];
await q(
  admin.from('paso_tramite').insert(
    pasos.map(([descripcion, fojas, fecha, fecha_precision, firmante], i) => ({
      causa_id: C,
      contratacion_id: lp.id,
      orden: i + 1,
      descripcion,
      fojas,
      fecha,
      fecha_precision,
      firmante_texto: firmante,
      firmante_id: pe[firmante] ?? null,
    })),
  ),
);
await q(
  admin.from('oferta').insert([
    { causa_id: C, contratacion_id: lp.id, oferente_id: pe['Comercio Supuesto S.R.L.'], oferente_texto: 'Comercio Supuesto S.R.L. (Pedro Muestra)', monto: 1180000, fojas: '94-120', observaciones: 'Resultó adjudicada.', orden: 1 },
    { causa_id: C, contratacion_id: lp.id, oferente_id: pe['Empresa Imaginaria S.A.'], oferente_texto: 'Empresa Imaginaria S.A. (Carlos Modelo)', monto: 1320500, fojas: '121-139', orden: 2 },
    { causa_id: C, contratacion_id: lp.id, oferente_texto: 'Proveedora Ficticia', monto: null, observaciones: 'La oferta no trae el total: completarlo con el expediente.', orden: 3 },
  ]),
);
await q(admin.from('contratacion').insert({ causa_id: C, identificador: 'SC 12/2022', expediente: '100245', tipo_procedimiento: 'Solicitud de cotización', objeto: 'Adquisición de cubiertas para camionetas', presupuesto_oficial: 480000 }));

// Una conversación extraída del teléfono (efecto 20001).
const conv = await q(
  admin
    .from('conversacion')
    .insert({
      causa_id: C,
      titulo: 'Conversación entre Laura Ejemplo y Pedro Muestra',
      participantes: 'Laura Ejemplo - Pedro Muestra',
      titular_dispositivo: 'Pedro Muestra',
      efecto_id: ef['20001'],
      informe_id: inf.id,
      contacto_relevante: '343 000-0002',
      agendado_como: 'Laura Suministros',
      periodo_desde: '2021-05-04',
      periodo_hasta: '2021-06-12',
    })
    .select('id')
    .single(),
);
const M = [
  ['2021-05-04T10:12:00-03:00', 'Laura Ejemplo', 'Pedro Muestra', 'texto', 'Pedro, buen día. Mañana te llega la invitación de la licitación 01. Arreglá con los otros la cotización.', true, 'Anticipa la invitación de la LP 01/2021 antes de que se difunda.'],
  ['2021-05-04T10:20:00-03:00', 'Pedro Muestra', 'Laura Ejemplo', 'texto', 'Dale, hablo con Carlos y le paso los precios.', true, 'Menciona el acuerdo con el otro oferente.'],
  ['2021-05-04T10:21:00-03:00', 'Laura Ejemplo', 'Pedro Muestra', 'texto', 'El presupuesto está en un millón doscientos cincuenta. No te pases.', true, 'Informa el presupuesto oficial antes de la apertura.'],
  ['2021-05-06T09:03:00-03:00', 'Pedro Muestra', 'Laura Ejemplo', 'audio_transcripto', '[AUDIO] Hola Laura, ya hablé con Carlos, él va a cotizar un poco más arriba así queda la mía como la más baja.', true, null],
  ['2021-05-06T09:15:00-03:00', 'Laura Ejemplo', 'Pedro Muestra', 'texto', 'Perfecto. Avisame cuando la presentes.', false, null],
  ['2021-05-19T13:40:00-03:00', 'Pedro Muestra', 'Laura Ejemplo', 'texto', 'Ya salió la apertura, quedamos primeros.', false, null],
  ['2021-06-10T11:05:00-03:00', 'Laura Ejemplo', 'Pedro Muestra', 'texto', 'Hoy firmaron la adjudicación.', false, null],
  ['2021-06-12T18:30:00-03:00', 'Pedro Muestra', 'Laura Ejemplo', 'imagen', '[IMAGEN] Foto de un comprobante de transferencia.', false, null],
];
const mensajes = await q(
  admin
    .from('mensaje')
    .insert(
      M.map(([fecha_hora, emisor, receptor, tipo, contenido, relevante, observacion], i) => ({
        causa_id: C,
        conversacion_id: conv.id,
        orden: i + 1,
        fecha_hora,
        fecha: fecha_hora.slice(0, 10),
        emisor,
        receptor,
        tipo,
        contenido,
        relevante,
        observacion,
      })),
    )
    .select('id, orden'),
);
const men = Object.fromEntries(mensajes.map((m) => [m.orden, m.id]));
await q(admin.from('vinculo').insert([1, 3].map((o) => ({ causa_id: C, origen_id: men[o], destino_id: lp.id, tipo: 'prueba_de' }))));

// Piezas del índice.
const piezas = await q(
  admin
    .from('pieza')
    .insert(
      [
        { numero_orden: '1', tipo: 'expediente_administrativo', titulo: 'Expte. 100001 – LP 01/2021', autor: 'Dirección de Ejemplo', relevancia: 'alta', responsable: INES, fojas: '1-160' },
        { numero_orden: '2', tipo: 'mensaje_conversacion', titulo: 'Conversación Laura Ejemplo – Pedro Muestra', autor: 'Pedro Muestra', destinatarios: 'Laura Ejemplo', relevancia: 'alta', responsable: ROBER, efecto_id: ef['20001'], informe_id: inf.id },
        { numero_orden: '2.1', tipo: 'mensaje_conversacion', titulo: 'Mensaje que anticipa la invitación de la LP 01/2021', autor: 'Laura Ejemplo', destinatarios: 'Pedro Muestra', fecha_desde: '2021-05-04', fecha_precision: 'dia', relevancia: 'alta', responsable: ROBER, efecto_id: ef['20001'], informe_id: inf.id },
        { numero_orden: '3', tipo: 'documental_secuestrada', titulo: 'Agenda 2021 con anotaciones de precios', fecha_desde: '2021-01-01', fecha_precision: 'anio', relevancia: 'alta', responsable: ROBER, efecto_id: ef['10001'], sobre: 'Rótulo Nº 3', fojas: '12-15', lugar_secuestro: 'Comercio Supuesto S.R.L.', fecha_secuestro: '2025-03-12', resumen: 'Agenda con anotaciones manuscritas de precios de repuestos junto a las iniciales de dos oferentes.', observaciones_analista: 'Los precios anotados coinciden con los que se cotizaron en la LP 01/2021.' },
        { numero_orden: '4', tipo: 'documental_secuestrada', titulo: 'Factura 0001-00000123 de Comercio Supuesto S.R.L.', fecha_desde: '2021-06-18', fecha_precision: 'dia', autor: 'Comercio Supuesto S.R.L.', destinatarios: 'Dirección de Ejemplo', relevancia: 'media', responsable: INES, efecto_id: ef['10002'], sobre: 'Rótulo Nº 4' },
        { numero_orden: '5', tipo: 'extraccion_forense', titulo: 'Extracción del teléfono (informe C0001)', relevancia: 'alta', responsable: ROBER, efecto_id: ef['20001'], informe_id: inf.id },
        { numero_orden: '6', tipo: 'otro', titulo: 'Acta de allanamiento – Calle Ejemplo 123', fecha_desde: '2025-03-12', fecha_precision: 'dia', relevancia: 'alta', responsable: INES },
        { numero_orden: '7', tipo: 'documental_secuestrada', titulo: 'Pliego de la LP 01/2021 con anotaciones', relevancia: 'media', efecto_id: ef['10003'] },
        { numero_orden: '8', tipo: 'informe_organismo', titulo: 'Informe del registro de proveedores', fecha_desde: '2025-08-01', fecha_precision: 'mes', autor: 'Registro de Proveedores', relevancia: 'baja' },
      ].map((p) => ({ causa_id: C, ...p })),
      { defaultToNull: false },
    )
    .select('id, numero_orden'),
);
const pz = Object.fromEntries(piezas.map((p) => [p.numero_orden, p.id]));
await q(admin.from('vinculo').insert([{ causa_id: C, origen_id: pz['3'], destino_id: lp.id, tipo: 'prueba_de' }, { causa_id: C, origen_id: pz['4'], destino_id: lp.id, tipo: 'prueba_de' }]));

// Situación procesal: la extracción del teléfono está apelada.
const inc = await q(
  admin
    .from('incidencia_procesal')
    .insert({ causa_id: C, titulo: 'Apelación contra la autorización de acceso al teléfono', tipo: 'apelacion', situacion: 'pendiente_resolucion', tribunal: 'Vocal de ejemplo', fecha_planteo: '2025-07-01' })
    .select('id')
    .single(),
);
await q(admin.from('incidencia_alcance').insert({ causa_id: C, incidencia_id: inc.id, entidad_id: ef['20001'] }));

// Actos procesales.
await q(
  admin.from('acto_procesal').insert([
    { causa_id: C, fecha: '2025-06-10', fecha_precision: 'dia', tipo: 'audiencia', titulo: 'Audiencia de extracción de datos', descripcion: 'La Fiscalía pide acceder a los dispositivos secuestrados.' },
    { causa_id: C, fecha: '2025-06-24', fecha_precision: 'dia', tipo: 'resolucion', titulo: 'Se autoriza el acceso a los dispositivos', descripcion: 'Autorización con límites de tiempo y de objeto.' },
    { causa_id: C, fecha: '2025-07-01', fecha_precision: 'dia', tipo: 'planteo', titulo: 'Apelación de la defensa', descripcion: 'Contra la autorización de acceso al teléfono.' },
  ]),
);

// Ofrecimiento de prueba para el juicio.
await q(
  admin.from('ofrecimiento_item').insert([
    { causa_id: C, clase: 'testimonial', numero: '1', persona_id: pe['Ana Prueba'], objeto: 'la recepción de las ofertas de la LP 01/2021.' },
    { causa_id: C, clase: 'documental', numero: '1', pieza_id: pz['3'], incorporacion: 'exhibicion', introduce_id: pe['Ana Prueba'], entregada_defensa: true, fecha_entrega: '2025-09-01', acuerdo_probatorio: 'no' },
    { causa_id: C, clase: 'documental', numero: '2', pieza_id: pz['4'], incorporacion: 'lectura', entregada_defensa: false },
    { causa_id: C, clase: 'documental', numero: '3', pieza_id: pz['5'], incorporacion: 'exhibicion' },
  ], { defaultToNull: false }),
);

console.log('Causa de ejemplo lista para las capturas del manual (Legajo 123456).');
