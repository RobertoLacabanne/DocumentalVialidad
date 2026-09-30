// Prepara el Supabase LOCAL para probar la app: crea dos cuentas con
// contraseña, las habilita en la lista de invitados y, con --ejemplos,
// carga piezas de ejemplo en la causa 299113.
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

export const CUENTAS = [
  { email: 'rober@ejemplo.test', alias: 'ROBER', nombre: 'Rober (prueba local)' },
  { email: 'ines@ejemplo.test', alias: 'INES', nombre: 'Ines (prueba local)' },
];
export const CLAVE = 'clave-local-123';

for (const c of CUENTAS) {
  const { error } = await admin.auth.admin.createUser({
    email: c.email,
    password: CLAVE,
    email_confirm: true,
    user_metadata: { full_name: c.nombre },
  });
  if (error && !/already/i.test(error.message)) throw error;
  const { error: e2 } = await admin.from('miembro').upsert({ email: c.email, alias: c.alias, nombre: c.nombre, invitado_por: 'preparar-local' }, { onConflict: 'email' });
  if (e2) throw e2;
}
console.log(`Cuentas locales listas (${CUENTAS.map((c) => c.email).join(', ')}), contraseña: ${CLAVE}`);

if (process.argv.includes('--ejemplos')) {
  const { data: causa } = await admin.from('causa').select('id').eq('legajo_fiscalia', '299113').single();
  const { data: efectos } = await admin
    .from('efecto')
    .insert([
      { causa_id: causa.id, numero: '48435' },
      { causa_id: causa.id, numero: '48436' },
    ])
    .select('id,numero');
  const ef = Object.fromEntries((efectos ?? []).map((e) => [e.numero, e.id]));
  const { data: informe } = await admin.from('informe').insert({ causa_id: causa.id, numero: 'C6855' }).select('id').single();
  const piezas = [
    { numero_orden: '1', tipo: 'expediente_administrativo', titulo: 'Expte. 154782 – LP 05/2020', autor: 'Dirección Provincial de Vialidad', relevancia: 'alta', responsable: 'ines@ejemplo.test' },
    { numero_orden: '2', tipo: 'mensaje_conversacion', titulo: 'Conversación Meynet – Gervasoni', autor: 'Meynet', destinatarios: 'Gervasoni', relevancia: 'alta', responsable: 'rober@ejemplo.test' },
    { numero_orden: '2.1', tipo: 'mensaje_conversacion', titulo: 'Mensaje sobre el reparto de la cotización', autor: 'Gervasoni', destinatarios: 'Meynet', relevancia: 'alta', responsable: 'rober@ejemplo.test' },
    { numero_orden: '3', tipo: 'mensaje_conversacion', titulo: 'Conversación Meynet – Difiori', autor: 'Meynet', destinatarios: 'Difiori', relevancia: 'media' },
    { numero_orden: '4', tipo: 'mensaje_conversacion', titulo: 'Conversación Meynet – Fernández (Equivial)', autor: 'Meynet', destinatarios: 'Fernández', relevancia: 'media' },
    { numero_orden: '14', tipo: 'otro', titulo: 'Acta de allanamiento – DPV', fecha_desde: '2025-10-28', fecha_precision: 'dia', relevancia: 'alta', responsable: 'ines@ejemplo.test' },
    { numero_orden: '19', tipo: 'documental_secuestrada', titulo: 'Agenda 2021', efecto_id: ef['48435'], informe_id: informe.id, relevancia: 'media', responsable: 'ines@ejemplo.test' },
    { numero_orden: '23', tipo: 'documental_secuestrada', titulo: 'Documentación del Efecto 48436', efecto_id: ef['48436'] },
  ].map((p) => ({ causa_id: causa.id, ...p }));
  const { error } = await admin.from('pieza').insert(piezas, { defaultToNull: false });
  if (error) throw error;
  const { data: extraccion } = await admin
    .from('pieza')
    .insert({ causa_id: causa.id, numero_orden: '11', tipo: 'extraccion_forense', titulo: 'Extracción de teléfono celular', relevancia: 'alta', responsable: 'rober@ejemplo.test' })
    .select('id')
    .single();
  const { data: inc } = await admin
    .from('incidencia_procesal')
    .insert({ causa_id: causa.id, titulo: 'Extracción suspendida (ejemplo local)', tipo: 'casacion', situacion: 'pendiente_resolucion' })
    .select('id')
    .single();
  await admin.from('incidencia_alcance').insert({ causa_id: causa.id, incidencia_id: inc.id, entidad_id: extraccion.id });
  // Personas inventadas para probar el juicio y el grafo de relaciones.
  const { data: personas, error: ep } = await admin
    .from('persona')
    .insert(
      [
        { causa_id: causa.id, nombre: 'Imputado Ejemplo Local', tipo_persona: 'fisica', cargo: 'Funcionario de prueba' },
        { causa_id: causa.id, nombre: 'Testigo Ejemplo Local', tipo_persona: 'fisica', cargo: 'Empleado de prueba' },
        { causa_id: causa.id, nombre: 'Proveedora Ejemplo SRL', tipo_persona: 'juridica', cargo: null },
        { causa_id: causa.id, nombre: 'Constructora Ejemplo SA', tipo_persona: 'juridica', cargo: null },
      ],
      { defaultToNull: false },
    )
    .select('id,nombre');
  if (ep) throw ep;
  const pe = Object.fromEntries((personas ?? []).map((p) => [p.nombre, p.id]));
  const { error: er } = await admin.from('rol_en_causa').insert([
    { causa_id: causa.id, persona_id: pe['Imputado Ejemplo Local'], rol: 'imputado' },
    { causa_id: causa.id, persona_id: pe['Testigo Ejemplo Local'], rol: 'testigo' },
    { causa_id: causa.id, persona_id: pe['Proveedora Ejemplo SRL'], rol: 'proveedor' },
    { causa_id: causa.id, persona_id: pe['Constructora Ejemplo SA'], rol: 'proveedor' },
  ]);
  if (er) throw er;
  const { error: ev } = await admin.from('vinculo').insert({
    causa_id: causa.id,
    origen_id: pe['Imputado Ejemplo Local'],
    destino_id: pe['Proveedora Ejemplo SRL'],
    tipo: 'relacionado',
    nota: 'Socio (ejemplo local)',
    fuente: 'Contrato social (ejemplo local)',
  });
  if (ev) throw ev;
  // Una contratación, dos ofertas y una conversación inventadas, para que el grafo tenga de dónde dibujar.
  const { data: lp, error: ec } = await admin
    .from('contratacion')
    .insert({ causa_id: causa.id, identificador: 'LP 99/2026', objeto: 'Obra de ejemplo local', adjudicatario_id: pe['Proveedora Ejemplo SRL'] }, { defaultToNull: false })
    .select('id')
    .single();
  if (ec) throw ec;
  const { error: eo } = await admin.from('oferta').insert([
    { causa_id: causa.id, contratacion_id: lp.id, oferente_id: pe['Proveedora Ejemplo SRL'], orden: 1 },
    { causa_id: causa.id, contratacion_id: lp.id, oferente_id: pe['Constructora Ejemplo SA'], orden: 2 },
  ]);
  if (eo) throw eo;
  const { error: ecv } = await admin.from('conversacion').insert(
    { causa_id: causa.id, titulo: 'Imputado Ejemplo – Testigo Ejemplo (ejemplo local)', participantes: 'Imputado Ejemplo Local, Testigo Ejemplo Local' },
    { defaultToNull: false },
  );
  if (ecv) throw ecv;
  console.log('Piezas y personas de ejemplo cargadas en el Supabase local.');
}
