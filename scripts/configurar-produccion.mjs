// Configura el Supabase de PRODUCCIÓN de punta a punta, usando solo la API
// de administración de Supabase (no hace falta la contraseña de la base):
//   1. usa el proyecto indicado, o crea uno nuevo si no se indica,
//   2. aplica las migraciones pendientes de supabase/migrations y la semilla,
//   3. configura las direcciones permitidas y, si se pasan, las claves de Google,
//   4. imprime las dos variables que van en Netlify.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_...          (Supabase → Account → Access Tokens)
//   SUPABASE_PROJECT_REF=fpihhaaqgsukscnfrbry   (proyecto de producción actual)
//   [GOOGLE_CLIENT_ID=...  GOOGLE_CLIENT_SECRET=...]
//   [SITE_URL=https://tablero-prueba-ufil.netlify.app]
//   node scripts/configurar-produccion.mjs
//
// Se puede correr más de una vez: cada migración se aplica una sola vez y la semilla no duplica.
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.supabase.com/v1';
const token = process.env.SUPABASE_ACCESS_TOKEN;
const sitio = (process.env.SITE_URL ?? 'https://tablero-prueba-ufil.netlify.app').replace(/\/$/, '');
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

let ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) {
  const orgs = await api('GET', '/organizations');
  if (!orgs.length) throw new Error('La cuenta de Supabase no tiene ninguna organización.');
  console.log(`Creando el proyecto en la organización «${orgs[0].name}» (São Paulo)…`);
  const proyecto = await api('POST', '/projects', {
    name: 'tablero-prueba',
    organization_id: orgs[0].id,
    db_pass: randomBytes(24).toString('base64url'),
    region: 'sa-east-1',
  });
  ref = proyecto.id ?? proyecto.ref;
  console.log(`Proyecto ${ref} creado.`);
}

process.stdout.write(`Esperando a que el proyecto ${ref} esté listo`);
for (;;) {
  const p = await api('GET', `/projects/${ref}`);
  if (p.status === 'ACTIVE_HEALTHY') break;
  process.stdout.write('.');
  await esperar(10_000);
}
console.log(' listo.');

const sql = (query) => api('POST', `/projects/${ref}/database/query`, { query });

await sql(`create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
const aplicadas = new Set((await sql('select version from supabase_migrations.schema_migrations')).map((f) => f.version));

for (const archivo of readdirSync('supabase/migrations').filter((a) => a.endsWith('.sql')).sort()) {
  const [version, ...resto] = archivo.replace('.sql', '').split('_');
  if (aplicadas.has(version)) {
    console.log(`· ${archivo}: ya aplicada`);
    continue;
  }
  await sql(readFileSync(join('supabase/migrations', archivo), 'utf8'));
  await sql(`insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${resto.join('_')}')`);
  console.log(`✓ ${archivo}: aplicada`);
}
await sql(readFileSync('supabase/seed.sql', 'utf8'));
console.log('✓ Semilla del legajo 299113 (no duplica).');

const auth = { site_url: sitio, uri_allow_list: `${sitio}/**,http://localhost:5173/**`, disable_signup: false };
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  Object.assign(auth, {
    external_google_enabled: true,
    external_google_client_id: process.env.GOOGLE_CLIENT_ID,
    external_google_secret: process.env.GOOGLE_CLIENT_SECRET,
  });
}
await api('PATCH', `/projects/${ref}/config/auth`, auth);
console.log(auth.external_google_enabled ? '✓ «Entrar con Google» activado.' : '✓ Direcciones configuradas (falta Google).');

const claves = await api('GET', `/projects/${ref}/api-keys`);
const anon = claves.find((k) => k.name === 'anon')?.api_key;
console.log('\nVariables para Netlify (Site configuration → Environment variables):');
console.log(`VITE_SUPABASE_URL=https://${ref}.supabase.co`);
console.log(`VITE_SUPABASE_ANON_KEY=${anon ?? '(buscala en Supabase → Project Settings → API)'}`);
console.log(`\nRedirección para Google Cloud: https://${ref}.supabase.co/auth/v1/callback`);
