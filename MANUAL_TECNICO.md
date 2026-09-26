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

Desde la Fase 1 (`20260927100000_fase1_efectos_importacion.sql`, probada por `supabase/tests/fase1.sql`):

- `importar_efectos()` carga todas las filas de una planilla en una sola transacción: o entran todas las revisadas o ninguna. Un número de efecto ya cargado no se pisa (vuelve como duplicado). Agrupa los procedimientos por fecha y domicilio, da de alta los informes del gabinete mencionados y guarda en cada efecto el archivo, la hoja y la fila de origen. Cada importación queda en la tabla `importacion` con el conteo de filas.
- Alias de responsables: un efecto importado con responsable «AGUS» guarda ese alias en `responsable_alias`. Se asigna a la persona (`responsable`) cuando exactamente una cuenta habilitada tiene ese alias, sea al importar o al invitarla después. Si dos cuentas comparten alias, no se asigna a ninguna.
- `aplicar_incidencia()` marca una situación procesal sobre varias fichas de una vez, sin duplicar. La vista `efecto_estado_procesal` resume la más grave de cada efecto (propia o de su procedimiento) y las piezas la heredan por `pieza_estado_procesal`.
- `buscar()` busca en piezas, efectos, personas, mensajes y contrataciones, y también por teléfonos (solo dígitos, desde 6) y por cómo figura agendada una persona.

Desde la Fase 2 (`20260928100000_fase2_contrataciones_mensajes.sql` y `20260928110000_fase2_completar_contratacion.sql`, probadas por `supabase/tests/fase2.sql`):

- `importar_contratacion()` carga una hoja de EXPEDIENTES DE CONTRATACIÓN (la contratación, sus pasos y sus ofertas) en una sola transacción. El identificador es único por causa sin distinguir mayúsculas ni espacios (índice `contratacion_identificador_unico`). Si la contratación ya tiene trámite, vuelve como duplicada; si estaba cargada sin trámite, se completa llenando solo los datos vacíos y avisa si el expediente no coincide. Cada paso guarda `fecha_texto` tal cual figura; `fecha` y `fecha_precision` solo se completan cuando la fecha es inequívoca.
- `importar_conversacion()` carga una transcripción (conversación y mensajes) en una sola transacción. El disparador `t_mensaje_literal` calcula `hash_contenido` (SHA-256) y bloquea cualquier cambio de texto, emisor, receptor, fecha, orden o tipo; solo se pueden cambiar `relevante` y `observacion`. Las notas al pie de la transcripción entran como `observacion`, nunca en el texto.
- Vista `conversacion_resumen`: mensajes, relevantes y primera y última fecha por conversación.
- `mensaje` está en la publicación de Realtime: la app escucha solo los `UPDATE` de la conversación abierta (marcar relevante, observación).
- Un mismo vínculo (origen, destino, tipo) no se carga dos veces (índice `vinculo_unico`). Mensaje → contratación se guarda como `prueba_de`; mensaje → pieza, como `relacionado`.

Lectores y generador del lado de la app (con pruebas en `src/lib/*.test.ts`):

- `lib/contrataciones.ts`: lee una hoja con el formato de la planilla (encabezado PROCEDIMIENTO · Fs. · FECHA · FIRMANTE · OBSERVACIONES), une las filas combinadas al paso de arriba (el link suele venir en la fila siguiente), arma el cuadro de ofertas con los pasos que empiezan con «Oferta» y propone como sugerencia los montos escritos (uno solo por oferta). Repone la «/» que Excel no admite en el nombre de la hoja.
- `lib/conversaciones.ts`: saca el texto de un .docx (párrafos y notas al pie, sin librerías) y lee las dos formas de transcripción del equipo y el .txt de WhatsApp. Lo que no entiende queda en la lista de líneas omitidas, a la vista.
- `lib/informe.ts`: arma el .docx con la librería `docx` siguiendo la plantilla PLANTILLA PARA REALIZAR INFORMES CELULARES (Palatino Linotype 11, justificado, interlineado 1,5, A4 con márgenes de 2,54 cm). Lo que falta sale como `[completar: …]` en cursiva. La librería se descarga recién cuando alguien pide un informe.

### Estructura del repositorio

```
src/
  styles/        tokens.css (único lugar de colores, tipografía, espaciado) y base.css
  componentes/   piezas del sistema de diseño: marcas, botones, tabla, panel, ficha, estados,
                 tarjeta de efecto, búsqueda global (Ctrl+K), menú de exportar
  pantallas/     acceso, causas, inicio, índice, efectos, contrataciones, personas, mensajes,
                 importadores (efectos, contrataciones, conversaciones), informe, equipo, fichas,
                 sistema de diseño (/diseno)
  datos/         sesión, consultas en tiempo real (consultas.ts, causa.ts, hechos.ts), guardado con
                 cola sin conexión, presencia
  lib/           orden jerárquico, cita, fechas, etiquetas, links de Drive, importación de
                 planillas, exportación, copia completa, comparación de nombres, lectura de
                 contrataciones y de transcripciones, informe .docx, resaltado (con pruebas)
supabase/
  migrations/    esquema
  seed.sql       datos reales del legajo 299113 (solo lo que figura en las fuentes)
  tests/         pruebas SQL de las reglas
e2e/             pruebas de punta a punta (dos navegadores a la vez, importación, Ctrl+K, Fase 2);
                 fixtures/generar-planillas.mjs arma planillas y una transcripción .docx sintéticas
                 con la forma de las reales
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
npm test               # lógica: orden, citas, fechas, links, importación, nombres, contrataciones,
                       # transcripciones, informe .docx, resaltado (55)
npm run db:test        # reglas de la base, Fase 1 y Fase 2 (75 comprobaciones)
npm run test:e2e       # dos personas a la vez, importaciones, tablero en vivo, Ctrl+K, mensajes
                       # relevantes en vivo, vínculos e informe descargado y verificado
node e2e/fixtures/generar-planillas.mjs   # planillas y transcripción sintéticas en e2e/fixtures/generadas/
npm run capturas       # capturas en 1440×900 y 390×844 en ./capturas (importa las planillas sintéticas)
```

Antes de publicar, probar también el build de producción: `npm run build && npx vite preview` y abrir http://localhost:4173.

## Puesta en marcha de producción

### Estado actual (26/09/2026, Fase 2)

| Pieza | Valor |
|---|---|
| Proyecto Supabase | `DocumentalVialidad`, ref `fpihhaaqgsukscnfrbry`, región us-west-2, organización «Rober» (plan gratuito) |
| URL de la API | `https://fpihhaaqgsukscnfrbry.supabase.co` |
| Esquema | Migraciones `20260926120000_esquema_inicial`, `20260926170000_ingreso_concurrente`, `20260927100000_fase1_efectos_importacion`, `20260928100000_fase2_contrataciones_mensajes` y `20260928110000_fase2_completar_contratacion` aplicadas y registradas en `supabase_migrations.schema_migrations`; semilla del 299113 cargada |
| Auth | Site URL y redirecciones configuradas; «Entrar con Google» activo (proyecto de Google Cloud «Tablero de Prueba», cliente web `283725982972-….apps.googleusercontent.com`) |
| Netlify | Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` cargadas y sitio publicado |
| Redirección para Google | `https://fpihhaaqgsukscnfrbry.supabase.co/auth/v1/callback` |

Las pruebas de `supabase/tests/reglas.sql` y de `supabase/tests/fase2.sql` también se corrieron contra producción, dentro de una transacción que se deshace (sin dejar rastro). Para correr un archivo de pruebas por la API de administración hay que sacarle las líneas que empiezan con `\` (son comandos de psql).

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
- Publicar desde esta computadora de trabajo: mover `.env.local` fuera de la carpeta antes de publicar (Vite lo leería y el sitio quedaría apuntando al Supabase local con acceso por contraseña) y volver a ponerlo después. Después de publicar, revisar que el JS del sitio contenga `fpihhaaqgsukscnfrbry` y no `127.0.0.1`.
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
- **Copia completa de la causa** (botón en **Inicio**): un .zip con `causa.json` (todas las tablas de la causa, incluido lo archivado y la `auditoria` completa) y una planilla CSV por tabla. Es la copia que puede guardar cualquiera del equipo en el Drive de la UFIL, sin credenciales. Sirve como resguardo legible y para auditar; para reconstruir la base entera se usa el volcado de arriba. La exportación semanal automática queda pendiente.
- **Restaurar en un proyecto nuevo:** crear el proyecto, aplicar `supabase/migrations/` (o `copia-esquema`), después `psql "<cadena de conexión>" -f copia-datos-AAAA-MM-DD.sql`. Revisar que la tabla `auditoria` quede con la misma cantidad de filas que en la copia.
- **Recuperar algo pisado por error:** está en `auditoria` (columna `cambios` o `antes`). La ficha muestra el historial; restaurar un valor es volver a cargarlo, y queda registrado.

## Límites a tener en cuenta (verificados el 26/09/2026)

- Supabase gratuito: 500 MB de base, 200 conexiones en tiempo real, pausa tras una semana sin uso, sin copias. Pro: desde US$ 25/mes.
- Netlify gratuito: 300 créditos por mes; si se agotan, el sitio queda pausado hasta el mes siguiente. Personal: US$ 9/mes.
- Correo de Supabase por defecto: solo a miembros del proyecto y 2 por hora. No afecta al acceso con Google.
