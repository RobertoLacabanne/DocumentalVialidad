// Configura el Supabase de PRODUCCIÓN de punta a punta:
//   1. crea el proyecto (región São Paulo) si no se indica uno existente,
//   2. aplica el esquema (supabase/migrations) y la semilla del legajo 299113,
//   3. activa "Entrar con Google" y las direcciones permitidas,
//   4. imprime las dos variables que van en Netlify.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_...            (Supabase → Account → Access Tokens)
//   GOOGLE_CLIENT_ID=...  GOOGLE_CLIENT_SECRET=...
//   [SUPABASE_PROJECT_REF=abcd...  SUPABASE_DB_PASSWORD=...]   (si el proyecto ya existe)
//   [SITE_URL=https://tablero-prueba-ufil.netlify.app]
//   node scripts/configurar-produccion.mjs
//
// Se puede correr más de una vez: el esquema no se reaplica y la semilla no duplica.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

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
let clave = process.env.SUPABASE_DB_PASSWORD;

if (!ref) {
  const orgs = await api('GET', '/organizations');
  if (!orgs.length) throw new Error('La cuenta de Supabase no tiene ninguna organización.');
  clave = randomBytes(18).toString('base64url');
  console.log(`Creando el proyecto en la organización «${orgs[0].name}» (São Paulo)…`);
  const proyecto = await api('POST', '/projects', {
    name: 'tablero-prueba',
    organization_id: orgs[0].id,
    db_pass: clave,
    region: 'sa-east-1',
  });
  ref = proyecto.id ?? proyecto.ref;
  writeFileSync('.env.produccion', `SUPABASE_PROJECT_REF=${ref}\nSUPABASE_DB_PASSWORD=${clave}\n`);
  console.log(`Proyecto ${ref} creado. La contraseña de la base quedó en .env.produccion (no se sube al repo).`);
}
if (!clave) throw new Error('Falta SUPABASE_DB_PASSWORD para el proyecto existente.');

process.stdout.write('Esperando a que el proyecto esté listo');
for (;;) {
  const p = await api('GET', `/projects/${ref}`);
  if (p.status === 'ACTIVE_HEALTHY') break;
  process.stdout.write('.');
  await esperar(10_000);
}
console.log(' listo.');

const cli = (args) =>
  execFileSync('npx', ['supabase', ...args], {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token, SUPABASE_DB_PASSWORD: clave },
  });
cli(['link', '--project-ref', ref, '-p', clave]);
cli(['db', 'push', '--include-seed', '-p', clave]);

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  await api('PATCH', `/projects/${ref}/config/auth`, {
    site_url: sitio,
    uri_allow_list: `${sitio}/**,http://localhost:5173/**`,
    external_google_enabled: true,
    external_google_client_id: process.env.GOOGLE_CLIENT_ID,
    external_google_secret: process.env.GOOGLE_CLIENT_SECRET,
    disable_signup: false,
  });
  console.log('«Entrar con Google» activado.');
} else {
  await api('PATCH', `/projects/${ref}/config/auth`, { site_url: sitio, uri_allow_list: `${sitio}/**,http://localhost:5173/**` });
  console.log('Direcciones configuradas. Falta Google: volvé a correr con GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.');
}

const claves = await api('GET', `/projects/${ref}/api-keys`);
const anon = claves.find((k) => k.name === 'anon')?.api_key;
console.log('\nCargá esto en Netlify (Site configuration → Environment variables):');
console.log(`VITE_SUPABASE_URL=https://${ref}.supabase.co`);
console.log(`VITE_SUPABASE_ANON_KEY=${anon ?? '(buscala en Supabase → Project Settings → API)'}`);
console.log(`\nRedirección para Google Cloud: https://${ref}.supabase.co/auth/v1/callback`);
