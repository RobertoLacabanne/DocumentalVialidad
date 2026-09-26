# Manual técnico

Para quien mantiene el Tablero de Prueba. El README es para el equipo; esto es para instalar, publicar, respaldar y restaurar.

## Arquitectura

| Pieza | Qué hace |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite. Tabla virtualizada con TanStack Table y TanStack Virtual. Estilos propios con CSS Modules y tokens en `src/styles/tokens.css`. |
| **Base de datos** | Supabase (Postgres 17). Esquema versionado en `supabase/migrations/`. |
| **Acceso** | Supabase Auth con Google. Solo leen y escriben los correos de la tabla `miembro` (lista de invitados), vía políticas RLS. |
| **Tiempo real** | Supabase Realtime: cambios de tablas (`postgres_changes`) y presencia (quién está viendo qué ficha). |
| **Publicación** | Netlify, sitio `tablero-prueba-ufil` (https://tablero-prueba-ufil.netlify.app). |
| **Archivos** | Siguen en el Google Drive de la UFIL. La app guarda links. |

### Reglas que garantiza la base (no la pantalla)

Están en `supabase/migrations/20260926120000_esquema_inicial.sql` y las prueba `supabase/tests/reglas.sql`:

- No hay permiso de `DELETE` para nadie de la app. Archivar = completar `archivado_en`.
- Cada alta, edición, archivo y restauración queda en `auditoria` (disparadores), con valor anterior y nuevo. La tabla no se puede modificar ni borrar, ni siquiera como administrador.
- El texto literal de `mensaje` y la `descripcion_acta` de `efecto` no se modifican una vez cargados.
- `guardar_campo()` guarda un campo solo si nadie lo cambió desde que la persona lo vio; si no, devuelve la ficha actual para mostrar el conflicto.
- `registrar_ingreso()`: si la lista de invitados está vacía, la primera persona que entra queda habilitada. Después, solo entran los invitados.
- Lo que sugiera una máquina va a `sugerencia`, nunca al dato.

### Estructura del repositorio

```
src/
  styles/        tokens.css (único lugar de colores, tipografía, espaciado) y base.css
  componentes/   piezas del sistema de diseño: marcas, botones, tabla, panel, ficha, estados
  pantallas/     acceso, causas, índice, ficha de pieza, equipo, sistema de diseño (/diseno)
  datos/         sesión, consultas en tiempo real, guardado con cola sin conexión, presencia
  lib/           orden jerárquico, cita, fechas, etiquetas, links de Drive (con pruebas)
supabase/
  migrations/    esquema
  seed.sql       datos reales del legajo 299113 (solo lo que figura en las fuentes)
  tests/         pruebas SQL de las reglas
e2e/             pruebas con dos navegadores a la vez
scripts/         preparar-local, capturas, test-sql, configurar-produccion
```

## Desarrollo local

Requisitos: Node 22 y Docker.

```bash
npm install
npm run db:start                        # Supabase local (Postgres, Auth, Realtime)
node scripts/preparar-local.mjs         # cuentas de prueba rober@ / ines@ejemplo.test
node scripts/preparar-local.mjs --ejemplos   # además, piezas de ejemplo
cp .env.example .env.local              # y completar con `npx supabase status -o env`
npm run dev                             # http://localhost:5173
```

En `.env.local` local conviene `VITE_ACCESO_CON_CLAVE=true` para entrar con correo y contraseña (solo desarrollo). **En producción esa variable no se define.**

### Pruebas

```bash
npm run typecheck      # tipos
npm test               # lógica: orden jerárquico, citas, fechas, links de Drive
npm run db:test        # reglas de la base (34 comprobaciones)
npm run test:e2e       # dos personas a la vez: tiempo real, presencia, conflicto, historial
npm run capturas       # capturas en 1440×900 y 390×844 en ./capturas
```

Antes de publicar, probar también el build de producción: `npm run build && npx vite preview` y abrir http://localhost:4173.

## Puesta en marcha de producción

### Estado actual (26/09/2026)

| Pieza | Valor |
|---|---|
| Proyecto Supabase | `DocumentalVialidad`, ref `fpihhaaqgsukscnfrbry`, región us-west-2, organización «Rober» (plan gratuito) |
| URL de la API | `https://fpihhaaqgsukscnfrbry.supabase.co` |
| Esquema | Migraciones `20260926120000_esquema_inicial` y `20260926170000_ingreso_concurrente` aplicadas y registradas en `supabase_migrations.schema_migrations`; semilla del 299113 cargada |
| Auth | Site URL y redirecciones configuradas; «Entrar con Google» activo (proyecto de Google Cloud «Tablero de Prueba», cliente web `283725982972-….apps.googleusercontent.com`) |
| Netlify | Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` cargadas y sitio publicado |
| Redirección para Google | `https://fpihhaaqgsukscnfrbry.supabase.co/auth/v1/callback` |

Las 34 pruebas de `supabase/tests/reglas.sql` también se corrieron contra producción, dentro de una transacción que se deshace (sin dejar rastro).

### Con el script (recomendado)

Usa solo la API de administración de Supabase: no hace falta la contraseña de la base.

```bash
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=fpihhaaqgsukscnfrbry \
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
node scripts/configurar-produccion.mjs
```

Aplica las migraciones nuevas (cada una una sola vez), vuelve a pasar la semilla (no duplica), configura las direcciones y Google, y muestra las variables para Netlify. Sin `SUPABASE_PROJECT_REF` crea un proyecto nuevo en São Paulo. **Para cada migración nueva de una fase, correr este script es la forma de llevarla a producción.**

### Google Cloud: cliente para «Entrar con Google»

1. Entrar a https://console.cloud.google.com con la cuenta que va a administrar la app y crear un proyecto («Tablero de Prueba»).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo **Externo**; nombre «Tablero de Prueba UFIL»; correo de asistencia; permisos básicos (correo, perfil, openid). Publicar la app (**En producción**): con permisos básicos no requiere verificación y evita el tope de usuarios de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**:
   - Orígenes autorizados: `https://tablero-prueba-ufil.netlify.app`
   - URI de redireccionamiento: `https://fpihhaaqgsukscnfrbry.supabase.co/auth/v1/callback`
4. Copiar el ID de cliente y el secreto.

### Supabase, a mano (si no se usa el script)

1. Crear el proyecto (región South America – São Paulo).
2. **SQL Editor**: pegar y ejecutar `supabase/migrations/20260926120000_esquema_inicial.sql`, y después `supabase/seed.sql`.
3. **Authentication → URL Configuration**: Site URL `https://tablero-prueba-ufil.netlify.app`; Redirect URLs `https://tablero-prueba-ufil.netlify.app/**`.
4. **Authentication → Sign In / Providers → Google**: activar y pegar ID y secreto.
5. **Project Settings → API**: copiar la URL del proyecto y la clave `anon` (pública).

### Netlify

- Sitio: `tablero-prueba-ufil`, equipo `rlacabanne14`.
- **Site configuration → Environment variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. No definir `VITE_ACCESO_CON_CLAVE`.
- Para publicar en cada cambio: **Site configuration → Build & deploy → Link repository** con `RobertoLacabanne/DocumentalVialidad`, rama de producción `main`. `netlify.toml` ya trae el comando de build y la redirección de rutas.
- Cuidado con los créditos del plan gratuito: cada publicación a producción consume 15 de 300 por mes (y el equipo los comparte con los demás sitios). Conviene juntar cambios y publicar desde `main`; las vistas previas de las ramas figuran como ilimitadas.

### Primer ingreso

La primera persona que entra con Google queda habilitada automáticamente (la lista de invitados está vacía). Desde **Equipo** invita al resto.

## Copias de seguridad y restauración

- **Supabase Pro** hace una copia diaria y la guarda 7 días (**Database → Backups**). El plan gratuito **no hace copias**: por eso conviene Pro desde que entra información real.
- **Copia propia** (a demanda o semanal, desde cualquier computadora con el repo y la contraseña de la base, que se resetea en Supabase → Project Settings → Database):
  ```bash
  npx supabase link --project-ref fpihhaaqgsukscnfrbry
  npx supabase db dump --linked --data-only -f copia-datos-$(date +%F).sql
  npx supabase db dump --linked -f copia-esquema-$(date +%F).sql
  ```
  El botón «Descargar copia completa de la causa» (JSON y CSV) y la exportación semanal automática llegan en la Fase 1.
- **Restaurar en un proyecto nuevo:** crear el proyecto, aplicar `supabase/migrations/` (o `copia-esquema`), después `psql "<cadena de conexión>" -f copia-datos-AAAA-MM-DD.sql`. Revisar que la tabla `auditoria` quede con la misma cantidad de filas que en la copia.
- **Recuperar algo pisado por error:** está en `auditoria` (columna `cambios` o `antes`). La ficha muestra el historial; restaurar un valor es volver a cargarlo, y queda registrado.

## Límites a tener en cuenta (verificados el 26/09/2026)

- Supabase gratuito: 500 MB de base, 200 conexiones en tiempo real, pausa tras una semana sin uso, sin copias. Pro: desde US$ 25/mes.
- Netlify gratuito: 300 créditos por mes; si se agotan, el sitio queda pausado hasta el mes siguiente. Personal: US$ 9/mes.
- Correo de Supabase por defecto: solo a miembros del proyecto y 2 por hora. No afecta al acceso con Google.
