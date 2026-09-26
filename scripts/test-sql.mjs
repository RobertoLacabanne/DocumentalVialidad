// Corre las pruebas SQL de supabase/tests contra el Supabase local.
// Uso: npm run db:test   (requiere `npm run db:start` antes)
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const carpeta = 'supabase/tests';
const archivos = readdirSync(carpeta).filter((a) => a.endsWith('.sql')).sort();
let fallas = 0;

for (const archivo of archivos) {
  console.log(`\n▸ ${archivo}`);
  const r = spawnSync('psql', [url, '-X', '-q', '-o', '/dev/null', '-f', join(carpeta, archivo)], { encoding: 'utf8' });
  // psql manda los avisos (NOTICE) por stderr: los mostramos limpios.
  const avisos = (r.stderr ?? '').replace(/^psql:[^\n]*NOTICE:\s*/gm, '  ').replace(/^NOTICE:\s*/gm, '  ');
  process.stdout.write(avisos);
  process.stdout.write(r.stdout ?? '');
  if (r.status !== 0 || /ERROR|FALLÓ/.test(r.stderr ?? '')) fallas += 1;
}

if (fallas > 0) {
  console.error(`\n✗ ${fallas} archivo(s) con pruebas fallidas.`);
  process.exit(1);
}
