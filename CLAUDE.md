# PROMPT MAESTRO — "Tablero de Prueba" UFIL Paraná

> **Estado del proyecto** (se actualiza al cerrar cada paso o fase)
>
> - 26/09/2026. Paso 1 (sección 11) respondido en `docs/PROPUESTA_INICIAL.md`, con el boceto `docs/diseno/boceto-indice-prueba.html`. El usuario dio el OK y pidió arrancar.
> - 26/09/2026. Fase 0 construida y probada (34 pruebas SQL, 12 unitarias, 2 de punta a punta con dos sesiones; CI en GitHub Actions). Publicada en https://tablero-prueba-ufil.netlify.app (Netlify `tablero-prueba-ufil`, id 349bfd0f-2d95-45c5-92dd-841af40290bd). Producción en Supabase `DocumentalVialidad` (ref `fpihhaaqgsukscnfrbry`, us-west-2): esquema y semilla aplicados, variables en Netlify cargadas, «Entrar con Google» activo (cliente OAuth 283725982972-…, proyecto de Google Cloud «Tablero de Prueba»). La Fase 0 queda cerrada cuando el usuario entre por primera vez (queda habilitado solo) e invite al equipo. Las migraciones de cada fase se llevan a producción con `scripts/configurar-produccion.mjs`.
> - 26/09/2026. El usuario entró por primera vez (Fase 0 cerrada) e invitó a UFIL y a GONZA (dos cuentas con el mismo alias GONZA: fiscalbadano@ y gonzalobadano@).
> - 26/09/2026. Fase 1 construida, probada y publicada: Inicio, efectos (tablero arrastrable y tabla por allanamiento, ficha), personas y empresas, búsqueda global Ctrl+K, asistente de importación de planillas, exportar a Excel/CSV, copia completa en .zip, alias editable en Equipo. Migración `20260927100000_fase1_efectos_importacion` aplicada en producción. Pruebas: 57 SQL, 28 unitarias, 5 de punta a punta. Guion para el fiscal en `docs/GUION_FISCAL.md`. Falta que el usuario invite a AGUS, CARLI e INES con esos alias (sus efectos quedan esperando: 25, 18 y 19).
> - 26/09/2026. Causa 299113 cargada en producción a pedido del usuario (no podía descargar las planillas): LISTADO EFECTOS 52 de 52 y DISTRIBUCIÓN DE TAREAS 51 de 52 (queda afuera la fila 10, que solo dice «AGUS»). 103 efectos, 19 procedimientos, informes C6643 y C6855. Se bajaron los archivos originales del Drive y se verificaron con las sumas CRC del .xlsx (DISTRIBUCIÓN completo; de LISTADO, los textos exactos, con la grilla controlada contra las 581 celdas de texto que declara el archivo), se pasaron por la misma revisión de la app y la base se comparó campo por campo contra el origen: 0 diferencias. Registrado a nombre de ROBER. Nada de eso se guardó en el repositorio.
> - 26/09/2026. Fase 2 construida, probada y publicada: Contrataciones (trámite a fojas, cuadro de ofertas, prueba vinculada, alta y edición de pasos y ofertas), importador de EXPEDIENTES DE CONTRATACIÓN, Mensajes (lector tipo chat virtualizado, relevantes con la tecla R en tiempo real, observación, vínculos a contratación o pieza), importador de conversaciones (.docx, .txt de WhatsApp o texto pegado) e Informe de relevamiento en .docx con la plantilla del equipo. Migraciones `20260928100000_fase2_contrataciones_mensajes` y `20260928110000_fase2_completar_contratacion` aplicadas en producción. Pruebas: 75 SQL, 55 unitarias, 6 de punta a punta. Falta que el equipo importe la hoja LP 05/2020 y las 7 conversaciones de APUNTES LEG. 299113 con los asistentes.
> - Próximo: Fase 3 (punteo y ofrecimiento de prueba, alertas procesales en el armado del juicio, cronología exportable, grafo de relaciones).
>
> **Decisiones tomadas con el usuario** (valen por encima de lo que diga el resto de este archivo)
>
> - Norte del producto: una versión muy mejorada del cuadro Urribarri, fácil de usar, intuitiva y que de verdad le sirva a la fiscalía para trabajar. Ante la duda, gana la simpleza.
> - Login: todo el equipo y el fiscal usan cuenta de Google. Se entra con "Entrar con Google" y una lista de invitados (tabla `miembro`). No hay roles: todo invitado activo lee y escribe todo.
> - Riesgos de nube, datos personales y contraseñas de dispositivos: el usuario pidió no preocuparse. El patrón/contraseña va como campo común del efecto, igual que en la planilla.
> - Diseño: seguir siempre la skill `.claude/skills/diseno-con-identidad/SKILL.md` y los tokens de `src/styles/tokens.css`. Sacar capturas con `npm run capturas` (1440×900 y 390×844) después de cada cambio visual.
> - El usuario autorizó avanzar sin pedir confirmación («permito todo, no me preguntes»).
> - Importación: la carga real de las planillas la hace una persona del equipo con el asistente (vista previa, columnas, revisión, confirmar). Los datos reales nunca se copian al repositorio; las pruebas usan planillas sintéticas (`e2e/fixtures/generar-planillas.mjs`).
> - Alias: si dos cuentas habilitadas comparten alias, los efectos con ese alias no se asignan solos a ninguna (no se adivina); Equipo lo avisa. No se impuso alias único para no tocar las cuentas que ya cargó el usuario.
> - La columna «Patrón/Contraseña» de LISTADO EFECTOS dice si el patrón se conoce (SI, NO, Se desconoce): se transcribe tal cual en `patron_contrasena`.
> - Las menciones a casación o apelación en las observaciones se muestran como sugerencia al importar; la situación procesal la marca una persona.
> - Informe de relevamiento: se reproduce la plantilla PLANTILLA PARA REALIZAR INFORMES CELULARES (Palatino Linotype 11, justificado, interlineado 1,5). «Remitente» es quien envía, como en todas las transcripciones y los informes finales del equipo. Qué va en «Emisor» no está definido: el diálogo del informe lo deja elegir y por defecto sale `[completar: emisor]` (pregunta pendiente al usuario).
> - Transcripciones: el texto de cada mensaje se guarda literal; solo se quitan los rótulos («Mensaje:», «Audio francisco:») y las llamadas a notas al pie, cuyo texto pasa a la observación del mensaje. Las notas entre paréntesis del analista no se importan como mensajes y quedan listadas.
> - Contrataciones: el identificador sale del nombre de la hoja (con la «/» repuesta si Excel la cambió por «_»); los montos escritos en las observaciones se proponen sin tildar. Una contratación cargada sin trámite (la LP 05/2020 de la semilla) se completa al importar su hoja, sin pisar lo que ya tenía.

> Para pegar como primer mensaje en Claude Code, dentro de una carpeta de proyecto vacía. Guardalo también como `CLAUDE.md` en la raíz del repo: así cada sesión nueva arranca con el mismo contexto.

---

## 0. Quién sos y cómo vas a trabajar

Sos el desarrollador principal de una aplicación web interna para la **Unidad Fiscal de Investigación y Litigación de Paraná (Ministerio Público Fiscal de Entre Ríos)**. Del otro lado tenés a un escribiente que asiste a los Agentes Fiscales. Sabe usar tecnología pero no es programador, así que:

- Hablá en castellano rioplatense, con voseo. Explicá las decisiones técnicas en criollo y sin jerga innecesaria.
- Trabajá por fases (sección 9). Antes de escribir código en cada fase, presentá un plan corto y esperá el OK.
- Cuando termines una fase, dejá la app andando y decime exactamente cómo probarla. Hacé un commit por fase, con un mensaje en castellano.
- Si algo es ambiguo, hacé una sola pregunta concreta y avanzá con lo demás.
- Si una decisión mía es mala (técnica, de seguridad o de usabilidad), decímelo antes de ejecutarla.

## 1. El problema

En causas complejas de corrupción, el equipo junta cientos de piezas: documentación secuestrada en allanamientos, expedientes de contratación, informes periciales, extracciones de celulares y computadoras, e informes de organismos. Hoy todo eso vive disperso en carpetas de Google Drive y en varias planillas sueltas, que se superponen y quedan desactualizadas.

Hay un antecedente que funcionó muy bien y que hay que tomar como punto de partida. En la causa "Urribarri" (campaña e imprentas) se armó una planilla, "Resumen mails y documentos de campaña", que tenía una fila por pieza y estas columnas:

`Nombre del documento / asunto del mail · Fecha · Remitente/autor · Destinatario · Contenido (resumen) · Pericia de origen (p. ej. I0082_03) · Número de orden (1, 2, 2.1, 2 bis, 2 ter…) · Observaciones · HIPERVÍNCULO al documento en Drive`

Ese cuadro sirvió para encontrar rápido cualquier documento y armar el debate. Pero tenía límites: no vinculaba piezas con hechos ni con personas, no mostraba estados ni responsables, no tenía búsqueda en el contenido, no guardaba quién cambió qué, y no servía para preparar el juicio (quién introduce cada pieza, si hay acuerdo probatorio, si se exhibe).

**Objetivo:** recrear ese modo de trabajo y mejorarlo en una app **reutilizable para cualquier legajo**. La primera causa que se carga es el Legajo 299113 (sección 7).

## 2. Qué tiene que ser la app

Es un **índice vivo de la prueba de una causa**, colaborativo y pensado para el juicio. No reemplaza al Drive: los archivos siguen donde están, y la app los ordena, los vincula y deja encontrarlos en dos clics.

La prueba de fuego: el fiscal pregunta "¿dónde está el mensaje de Gervasoni donde le dice a Meynet que se repartan la cotización?", y en menos de 30 segundos cualquiera del equipo lo encuentra, ve de qué efecto sale, qué informe forense lo respalda, con qué contratación se vincula y quién lo va a introducir en el debate.

## 3. Principios no negociables

1. **Integridad de la prueba.** La app nunca modifica un archivo original. Guarda solo referencias (link de Drive, ruta local) y, si tiene acceso al archivo, su hash SHA-256 y la fecha en que se indexó. Las transcripciones de mensajes son literales: se permite marcar y resaltar, pero no editar el texto transcripto.
2. **Separar el dato de la interpretación.** Cada ficha distingue los campos objetivos (qué dice el documento, quién lo firma, fecha, fojas) de las "Observaciones del analista". Esta diferencia tiene que verse en la interfaz.
3. **Nada inventado.** Si un dato falta, se muestra vacío o con un marcador visible del tipo `[completar]`. Ninguna función automática (OCR, IA, importación) completa por su cuenta datos filiatorios, fechas ni números. Todo lo que sugiera una máquina queda marcado como **"sugerencia pendiente de validar"** hasta que una persona lo confirme.
4. **Historial compartido.** Se registra cada alta, edición y borrado: quién, cuándo, valor anterior y valor nuevo. Nada se borra de verdad: se archiva. El objetivo no es controlar a nadie, sino que cualquiera del equipo pueda ver qué hizo el otro y recuperar algo si se pisó por error.
5. **Estado procesal de la prueba.** En esta causa ya hubo planteos de exclusión probatoria por el secuestro de material informático, y hay efectos con extracción suspendida por apelación o casación. Cada pieza debe poder marcarse con su situación ("admisibilidad cuestionada", "pendiente de resolución de casación", "excluida", etc.) y la app tiene que avisar cuando alguien intenta usarla en el armado del juicio.
6. **Trabajo en equipo en tiempo real.** Es el requisito central. Varias personas trabajan a la vez desde computadoras distintas y el fiscal consulta cuando quiere, desde donde quiera. Lo que carga uno queda guardado al instante en una base de datos compartida en la nube y le aparece al resto sin recargar la página. Si dos personas editan la misma ficha al mismo tiempo, no se pierde el trabajo de ninguna: avisale al segundo que la ficha cambió y mostrale qué cambió.
7. **Datos reales desde el primer día.** No hay demo ni datos ficticios. La app se usa directamente con la causa real.

## 4. Usuarios

Todos los usuarios tienen los mismos permisos: pueden ver, cargar y editar todo. No hay roles ni campos restringidos. Cada uno entra con su propia cuenta (correo) para que el historial muestre quién hizo cada cosa y para que la app no quede abierta a cualquiera que tenga el link. Agregar a un compañero nuevo tiene que ser simple: se lo invita por correo desde la app.

El equipo actual del legajo 299113 figura en las planillas como AGUS, INES, CARLI y ROBER, más el Fiscal. Los nombres completos y los correos van como `[completar]`.

## 5. Modelo de datos (propuesta: ajustala y justificá los cambios)

**Causa (Legajo):** número de legajo de Fiscalía, número OGA, carátula (con historial, porque cambia), fiscal/es a cargo, delitos investigados, estado y fecha de alta. Todo lo demás cuelga de una causa. La app es multi-causa desde el día uno.

**Pieza de prueba** (el corazón, heredero directo del cuadro Urribarri):

- Número de orden jerárquico que admite sub-numeración (1, 2, 2.1, 2 bis…) y un ID interno inmutable.
- Tipo: documental secuestrada / expediente administrativo / informe pericial / extracción forense (celular, PC) / mensaje o conversación / correo electrónico / informe de organismo / testimonial / audiovisual / otro.
- Título o asunto, fecha del documento (con precisión: día exacto, mes o aproximada), autor o remitente, destinatario/s.
- Resumen del contenido (objetivo) y observaciones del analista (interpretación), en campos separados.
- Origen: efecto Nº, sobre Nº, lugar y fecha de secuestro, informe forense de origen (p. ej. "C6855") y fojas.
- Enlaces: uno o varios hipervínculos a Drive y ruta local opcional. Cada enlace lleva una etiqueta ("original escaneado", "transcripción", "imagen forense").
- Relevancia (alta, media, baja o descartada), estado de trabajo, responsable, etiquetas libres y estado procesal (principio 5).
- Vínculos (muchos a muchos) con hechos o contrataciones, personas y empresas, otras piezas ("responde a", "adjunto de", "misma operación que") y efectos.

**Efecto secuestrado:** número de efecto, sobre, tipo de material (manuscritos, bancario, facturación/remitos, licitaciones/expedientes, dispositivo, documentación varia), descripción textual según el acta (no editable después de importada), fecha y domicilio del procedimiento, allanamiento de origen, propietario, tenedor, resolución que autorizó el secuestro, si está apto para analizar, si tiene informe del gabinete (y cuál), ubicación física actual, responsable, estado (sin iniciar / en proceso / escaneado / finalizado / observado), prioridad, fojas aproximadas, fecha de inicio y fin, link del escaneo y observaciones. Del efecto se desprenden las piezas. Incluye también el campo "Patrón/Contraseña" del dispositivo, igual que en la planilla actual.

**Hecho / Contratación investigada:** identificador (p. ej. "LP 05/2020"), expediente administrativo, objeto, montos (presupuesto oficial, reserva, adjudicado), oferentes con su oferta, adjudicatario y cronología del trámite. Cada paso del trámite lleva descripción, fojas, fecha, firmante con su cargo, observaciones y link. Hoy esto se hace en una planilla con una hoja por licitación y hay que respetar esa lógica.

**Persona / Empresa:** nombre o razón social, rol en la causa (imputado, testigo, denunciante, funcionario DPV, proveedor, perito), cargo, alias o forma en que aparece agendado en los celulares, teléfonos, CUIT/DNI y vínculos con otras personas y empresas.

**Conversación / Mensaje** (para extracciones forenses): dispositivo o efecto de origen, informe de extracción, participantes, período, y los mensajes con fecha y hora, emisor, receptor, tipo (texto, audio transcripto, imagen, archivo) y contenido literal. Cada mensaje se puede marcar como relevante, con una observación que lo vincula a una contratación u otra pieza.

**Ofrecimiento para juicio** (heredero de la planilla "Prueba a mostrar en debate con testigos" de la causa Urribarri): pieza, número en el ofrecimiento, si se entregó a la defensa (fecha y constancia), acuerdo probatorio (sí/no/parcial), si se exhibe en el debate, con qué testigo o perito se introduce, qué partes se exhiben, si hay que escanearla, imputados vinculados y ubicación física.

**Tarea:** asignación, responsable, vencimiento, estado y vínculo con cualquier entidad.

**Auditoría:** tabla de eventos inmutable.

## 6. Pantallas y experiencia

La app tiene que resultar **hermosa, clara e intuitiva**, al nivel de una herramienta profesional moderna. Tiene que tener identidad propia: nada de la estética genérica de plantilla ni del "dashboard oscuro". Detalles en la sección 8.

1. **Inicio de la causa:** carátula, números clave (piezas, efectos por estado, avance por responsable, pendientes y vencimientos), actividad reciente del equipo y accesos directos. Reemplaza la planilla "AVANCE DE TAREAS".
2. **Índice de prueba:** la tabla principal, que es la evolución del cuadro Urribarri. Tiene que andar rápido con miles de filas, con columnas configurables, filtros combinables (tipo, relevancia, persona, contratación, efecto, responsable, estado procesal), orden jerárquico por número y vista agrupada. Al hacer clic en una fila se abre un panel lateral con la ficha completa y botones para "Abrir en Drive" y "Copiar cita" (sección 6.8).
3. **Ficha de pieza:** vista de lectura cómoda y modo edición, con vínculos navegables y el historial de cambios de esa pieza.
4. **Efectos:** tablero kanban por estado y vista de tabla, agrupables por allanamiento o domicilio. Cada tarjeta muestra el responsable y un semáforo de estado procesal. Reemplaza "DISTRIBUCIÓN DE TAREAS" y "LISTADO EFECTOS".
5. **Contrataciones:** una ficha por licitación, con la línea de tiempo del trámite (fojas, firmantes), el cuadro comparativo de ofertas y las piezas y mensajes vinculados. Es la vista que muestra el hecho completo.
6. **Personas y empresas:** directorio, ficha con todas sus apariciones (piezas, mensajes, contrataciones) y un **grafo de relaciones** simple y legible.
7. **Mensajes:** lector de conversaciones tipo chat con fecha, emisor y marcado de relevantes. Desde acá se genera el **"Informe de relevamiento de mensajes"** siguiendo la plantilla que ya usa el equipo (sección 7.3).
8. **Cronología:** línea de tiempo unificada de piezas, mensajes, pasos de contrataciones y actos procesales, filtrable por persona o contratación. Debe exportar a PDF para mostrarle al fiscal.
9. **Preparación del juicio:** el punteo de prueba (ofrecimiento), con alertas cuando una pieza tiene la admisibilidad cuestionada, falta el testigo que la introduce o no se entregó a la defensa. Exporta el listado para el requerimiento de remisión a juicio.
10. **Búsqueda global** (atajo `Ctrl+K`): busca en todo, incluido el texto de los mensajes y, más adelante, el texto OCR de los escaneos. Los resultados salen agrupados por tipo y con el término resaltado.

**Cita estándar**, para copiar y pegar en escritos: `Efecto Nº 48435 – Agenda 2021 (Sobre Nº …), fs. …, informe C6855, pieza Nº 19` o el formato que definamos. Tiene que ser configurable.

**Exportaciones:** cualquier vista filtrada a Excel/CSV, y los informes a `.docx` o `.rtf` con justificado, interlineado 1,5 y cuerpo 11, que es el formato de la fiscalía.

**Importación:** asistente para cargar desde las planillas existentes (CSV o XLSX). Primero muestra una vista previa, después pide mapear columnas, luego reporta duplicados y recién entonces confirma.

## 7. Datos semilla del Legajo 299113 (causa Vialidad)

> Tomado del Drive de la UFIL al 26/09/2026. **No inventes nada de lo que falta.**

### 7.1 Identificación

- Legajo Fiscalía 299113. OGA 34445.
- Carátula: "NN S/ FRAUDE A LA ADMINISTRACIÓN PÚBLICA (DENUNCIA DE DONDA EXEQUIEL MATÍAS)".
- Objeto: sobreprecios, direccionamiento y dádivas en contrataciones de la Dirección Provincial de Vialidad (DPV). Contrataciones investigadas: `[completar listado; según lo trabajado serían 16]`.
- Allanamientos: 28/10/2025 (DPV, domicilios y comercios en Paraná, Santa Fe, Córdoba y CABA) y 10/08/2026 (seis procedimientos).

### 7.2 Fuentes existentes a importar (exportar a CSV/XLSX antes de empezar)

| Planilla o documento actual | Qué contiene | Va a |
|---|---|---|
| `LISTADO EFECTOS` (carpeta ANÁLISIS DE DISPOSITIVOS ELECTRÓNICOS) | 52 dispositivos: efecto, descripción, responsable, estado, apto para analizar, fecha y domicilio del procedimiento, propietario, tenedor, patrón, autorización, informe del gabinete, ubicación | Efectos (dispositivos) |
| `DISTRIBUCIÓN DE TAREAS` y `AVANCE DE TAREAS` (carpeta DOCUMENTAL ESCANEADA) | Documentación en papel: efecto, Nº interno, descripción, responsable, link del escaneo, origen, estado, observaciones, prioridad, fojas | Efectos (papel) + Tareas |
| `EXPEDIENTES DE CONTRATACIÓN` (una hoja por licitación, p. ej. "LP 05/2020", Expte. 154782) | Paso del trámite, fojas, fecha, firmante, observaciones, links a ofertas | Contrataciones |
| `APUNTES LEG. 299113` (Google Doc) | Conversaciones relevantes extraídas (Meynet–Difiori, Meynet–Gervasoni, Meynet–Fernández de Equivial, Meynet–Acevedo, Meynet–Schonhals, Meynet–"Emiliano", Forlín–"Francisco") con links a los .docx completos, y personas mencionadas no allanadas | Conversaciones + Personas |
| Carpetas `EFECTO 48435`, `48436`, `48438`, `48446`, `48452`, `48453`… | Escaneos | Enlaces de las piezas |
| `Tabla comparativa de precios` | Comparativa de precios | Contrataciones (fase 3) |

### 7.3 Plantilla vigente del informe de mensajes

El informe que genera la app tiene que reproducir esta estructura:

Encabezado `Ref.: Legajo N.º …, caratulado: "…"`, seguido del título **INFORME DE RELEVAMIENTO DE MENSAJES**. Después va un párrafo introductorio que indica dispositivo, número de efecto, número de informe de extracción del Gabinete de Informática Forense, titular del teléfono, número o contacto relevante, cómo estaba agendado y período. Luego, **TRANSCRIPCIÓN DE LOS MENSAJES**, organizada por conversación y, dentro de cada una, en orden cronológico. Cada mensaje lleva Fecha, Emisor, Remitente, Mensaje (literal) y **OBSERVACIONES**, donde se justifica su vínculo con una contratación, un expediente u otra documental.

## 8. Identidad visual

> Antes de tocar cualquier interfaz, cargá y seguí la skill `diseno-con-identidad` (`.claude/skills/diseno-con-identidad/SKILL.md`), sobre todo el ciclo de capturas con Playwright y la checklist final.

Buscá un estilo **"expediente moderno"**: sobrio e institucional, pero cálido y con carácter. Tiene que verse cuidado, no pobre.

- **Paleta clara.** Fondo tipo papel (≈ `#FAF9F6`), superficies blancas, texto en tinta azul profunda (≈ `#1E3350`) y un acento "lacre" (≈ `#A63D2A`) reservado para alertas procesales. **Chips pastel por tipo de pieza** (documental, pericial, mensaje, contratación, persona), con contraste AA. Encabezados de tabla en gris suave, al estilo Google Sheets. **Nada de fondos ni bandas oscuras.** El modo oscuro es opcional y va al final.
- **Tipografía.** Roboto o Inter para interfaz y tablas, con cifras tabulares. Una serif editorial (Source Serif 4 o similar) solo para títulos de causa y fichas, para darle tono jurídico.
- **Detalles de identidad.** Números de orden y de efecto en un estilo "foliado", como sellos o etiquetas. Íconos lineales consistentes. Microinteracciones sutiles. Estados vacíos que expliquen qué hacer.
- **Usabilidad.** Densidad de información regulable (cómoda o compacta). Todo accesible por teclado. Pensada para monitores de oficina, pero usable en notebook. Tiene que poder usarla bien alguien que nunca vio la app, sin capacitación.
- Armá primero un **pequeño sistema de diseño** con tokens de color, tipografía, espaciado y los componentes base (chip, tabla, panel lateral, ficha, tarjeta kanban) y mostrámelo antes de construir las pantallas.

## 9. Arquitectura y fases

**Arquitectura propuesta** (podés contraproponer con fundamentos):

- **App web en la nube**, que se abre desde cualquier computadora con navegador, en la oficina o fuera de ella, sin instalar nada. El fiscal entra cuando quiere, desde su PC o su celular.
- **Base de datos compartida: Supabase** (Postgres). Usá **Realtime**, para que los cambios de un compañero aparezcan solos en las pantallas de los demás, y **Supabase Auth** con invitación por correo. Políticas RLS simples: cualquier usuario logueado puede leer y escribir todo.
- **Búsqueda de texto completo** en Postgres, configurada para castellano (`unaccent`, que no distinga tildes ni mayúsculas), sobre fichas, mensajes y, más adelante, el texto OCR.
- **Frontend:** React + TypeScript (Vite), con una librería de tablas virtualizadas. Deploy en **Netlify**, que es el flujo que ya uso, con variables de entorno para las claves de Supabase.
- **Archivos:** siguen en el Google Drive de la UFIL y la app guarda el link, igual que el cuadro Urribarri. Para el alta rápida, aceptá pegar un link de Drive o de una carpeta y completá el nombre del archivo solo, si se puede sin pedir permisos extra.
- **Guardado:** autosave de cada campo, con un indicador visible ("Guardado ✓ hace 2 s"). Si se corta internet, los cambios quedan en cola y se sincronizan al volver, con aviso.
- **Backup:** exportación completa semanal automática (JSON + CSV) y un botón "Descargar copia completa de la causa", además de los backups propios de Supabase. Documentá cómo restaurar.
- **Límites del plan gratuito:** revisá los límites de Supabase y de Netlify (en el plan gratuito de Supabase los proyectos se pausan tras un período sin uso). Decime si conviene un plan pago y cuánto cuesta, con precios verificados al día.
- Si existe el sistema de procesamiento documental de la UFIL (repositorio `AppUFIL`), en la fase 4 evaluá integrarlo como proveedor de OCR y extracción de texto, sin acoplarlo.

**Fases:**

- **Fase 0. Base:** repo, sistema de diseño, proyecto Supabase, login por correo, modelo de datos, historial de cambios y sincronización en tiempo real. Entregable: la app publicada en Netlify, con el look definitivo; dos personas logueadas en dos PC distintas ven al instante lo que carga la otra.
- **Fase 1. Primera versión de uso real:** causas, índice de prueba, ficha, efectos (kanban y tabla), personas, búsqueda global e importación de `LISTADO EFECTOS` y `DISTRIBUCIÓN DE TAREAS` del legajo 299113. Entregable: la causa 299113 cargada y el equipo trabajando en la app, más un guion de 5 minutos para presentársela al fiscal.
- **Fase 2. Hechos y mensajes:** contrataciones con su cronología de trámite y cuadro de ofertas, lector de conversaciones, marcado de mensajes relevantes y generación del informe de relevamiento en `.docx`/`.rtf`.
- **Fase 3. Juicio:** punteo y ofrecimiento de prueba, alertas procesales, cronología exportable, grafo de relaciones y exportación del listado de prueba para la remisión a juicio.
- **Fase 4. Automatización (opcional):** OCR de los escaneos (Tesseract en español u OCRmyPDF), indexación del texto en la búsqueda y sugerencias automáticas (a qué efecto o contratación pertenece un documento), siempre como "pendiente de validar". Parsers de reportes de extracción forense (UFED/Cellebrite en HTML, XLSX o PDF) para importar conversaciones.

## 10. Calidad

- Tests de lo crítico: sincronización entre dos sesiones simultáneas, edición concurrente de la misma ficha, historial de cambios, importación sin pérdida de datos (comparar la cantidad de filas y los campos contra la planilla de origen), que las transcripciones no se alteren y que las exportaciones respeten el formato.
- Un `README` en castellano para el equipo: cómo entrar, cómo cargar una pieza, cómo importar una planilla y a quién llamar si no anda. Aparte, un `MANUAL_TECNICO.md` para deploy, backup y restauración.
- Rendimiento: el índice tiene que responder de forma fluida con 10.000 piezas y 200.000 mensajes.

## 11. Primer paso

No escribas código todavía. Respondeme con:

1. Tu lectura del problema en 5 líneas.
2. El modelo de datos final, en un diagrama simple, con los cambios que le harías a mi propuesta.
3. El stack definitivo y por qué.
4. Una propuesta visual concreta: paleta con hex, tipografías y cómo se vería la pantalla "Índice de prueba", descripta o en un boceto HTML estático.
5. Los riesgos que ves (técnicos, de pérdida de datos, de adopción por el equipo) y cómo los mitigarías.
6. La única pregunta que necesitás que te conteste para arrancar la Fase 0.
