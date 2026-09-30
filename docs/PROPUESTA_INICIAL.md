# Propuesta inicial: Tablero de Prueba

Respuesta al Paso 1 del prompt maestro (sección 11). Fecha: 26/09/2026. Estado: **aprobada** el 26/09/2026, con estos ajustes del usuario: login con Google (todo el equipo usa cuenta de Google); los riesgos de la sección 5 se dejan de lado; el patrón/contraseña va como campo común del efecto; sin roles ni separación por causa (todo invitado ve todo). El resto del modelo se implementó tal como está acá.

Boceto visual: [`docs/diseno/boceto-indice-prueba.html`](diseno/boceto-indice-prueba.html) (se abre con doble clic en cualquier navegador).

---

## 1. Lectura del problema

La prueba del legajo ya existe y está en el Drive: lo que falta es el índice. Hoy lo que se sabe de cada pieza (qué es, de dónde sale, qué acredita, con qué se conecta y en qué situación procesal está) vive repartido en planillas que se pisan y se desactualizan. El cuadro Urribarri demostró que una fila por pieza, con cita y link, alcanza para encontrar rápido; le faltaba vincular piezas con hechos, personas y efectos, dejar rastro de quién cambió qué y proyectar cada pieza al juicio. La app es eso: un índice relacional, multi-causa y en tiempo real, que nunca toca el original y que separa el dato de la interpretación. Se mide con la prueba de fuego del mensaje Gervasoni–Meynet, y alcanza con que se pierda o se invente un dato una sola vez para que el equipo vuelva a la planilla.

## 2. Modelo de datos

```
CAUSA  (legajo, OGA, fiscales, delitos, estado, fecha de alta)
 ├─ CARÁTULA_HISTORIAL  (texto, desde, hasta)
 ├─ CAUSA_MIEMBRO       (quién trabaja en esta causa)
 │
 ├─ PROCEDIMIENTO  (allanamiento: fecha, domicilio, resolución que lo autorizó)
 │    └─ EFECTO  (papel o dispositivo; descripción del acta, inmutable una vez importada)
 │         ├─ CREDENCIAL_DISPOSITIVO   patrón/contraseña, en tabla aparte
 │         ├─ PIEZA ──────────────── ENLACE (Drive o ruta · etiqueta · SHA-256 · fecha de indexación)
 │         └─ CONVERSACIÓN ────────── MENSAJE (texto literal, inmutable) ── MARCA (resaltado, relevante)
 │
 ├─ INFORME  (pericial, forense, del gabinete: C6855, I0082_03…; lo citan efectos, piezas y conversaciones)
 │
 ├─ CONTRATACIÓN  (LP 05/2020 · Expte. 154782 · objeto · montos · adjudicatario)
 │    ├─ PASO_TRÁMITE  (descripción, fojas, fecha, firmante → PERSONA, cargo a esa fecha, link)
 │    └─ OFERTA        (oferente → EMPRESA, monto)
 │
 ├─ PERSONA_O_EMPRESA  (física o jurídica)
 │    ├─ IDENTIFICADOR  (teléfono, alias agendado en tal efecto, CUIT, DNI, mail)
 │    └─ ROL_EN_CAUSA   (imputado, testigo, perito…, con fecha desde y hasta)
 │
 ├─ INCIDENCIA_PROCESAL  (planteo de exclusión, apelación, casación: estado y resolución)
 │    └─ afecta a → procedimientos, efectos, piezas o informes
 │
 ├─ OFRECIMIENTO_ÍTEM  (pieza, Nº de ofrecimiento, entrega a la defensa, acuerdo probatorio,
 │                      se exhibe, quién la introduce → PERSONA, partes a exhibir, ubicación)
 └─ ACTO_PROCESAL  (audiencias y resoluciones, para la cronología)

Transversales a todas las fichas:
 ENTIDAD     ID global para toda ficha vinculable
 VÍNCULO     ficha ↔ ficha, con tipo ("responde a", "adjunto de", "menciona a", "prueba de") y nota
 TAREA       responsable, vencimiento, estado → cualquier ficha
 SUGERENCIA  valor propuesto por OCR, IA o importación; pendiente de validar; nunca pisa el dato
 AUDITORÍA   evento inmutable escrito por la base: quién, cuándo, valor anterior, valor nuevo
```

### Cambios respecto de tu propuesta, y por qué

1. **Procedimiento (allanamiento) como ficha propia.** Hoy la fecha, el domicilio y la resolución que autorizó el secuestro se repiten en cada efecto. Si cuelgan del procedimiento, se cargan una vez, los efectos se agrupan solos por allanamiento o domicilio, y un planteo contra el allanamiento alcanza de un saque a todo lo que se secuestró ahí.
2. **Informe como ficha propia.** C6855 o I0082_03 aparecen citados en muchas piezas. Como texto libre se escriben distinto cada vez y no se pueden filtrar. Como ficha tienen número, organismo, fecha y link, y desde el informe se ve todo lo que respalda.
3. **Incidencia procesal en lugar de un campo suelto de "estado procesal".** Una casación puede suspender la extracción de varios efectos a la vez. Se carga una vez (planteo, fecha, tribunal, estado, resolución) y se asigna a lo que afecta. La pieza hereda: su estado efectivo es el peor de la cadena pieza → efecto → procedimiento. Cuando se resuelve, se actualiza sola en todas. De acá salen las alertas del armado del juicio.
4. **Persona y empresa en una sola tabla, con los identificadores aparte.** La misma persona puede figurar con nombre en una planilla, como "Emiliano" en un celular y como un número en otro. Cada teléfono, alias agendado (con el dispositivo donde figura), CUIT, DNI o mail es un identificador. Un contacto que nadie identificó queda como identificador suelto: no se le asigna una persona por aproximación. El rol en la causa lleva fechas, porque cambia (un testigo que pasa a imputado).
5. **Un único mecanismo de vínculos.** En vez de una tabla intermedia por cada par (pieza-persona, pieza-contratación, mensaje-contratación, persona-empresa…), toda ficha vinculable tiene un ID global y un vínculo es "ficha A ↔ ficha B, de tal tipo, con tal nota". De ahí salen el grafo, las tareas vinculadas a cualquier cosa, la búsqueda global y la ficha de persona con todas sus apariciones.
6. **El mensaje no es una pieza.** Doscientos mil mensajes no pueden ser doscientas mil filas del índice. Las conversaciones y los mensajes viven aparte, con su lector. Cuando un mensaje importa se marca como relevante; si va al juicio, se promueve a pieza (2.1, 2.2 bajo la pieza-conversación Nº 2), que lo referencia sin copiar el texto.
7. **Sugerencias en una tabla aparte.** Lo que proponga el OCR, la importación o la IA no se escribe en el campo real: queda como sugerencia (qué campo, qué valor, de dónde salió) hasta que alguien la acepta o la descarta. Así el principio 3 lo garantiza la base de datos y no solo la pantalla.
8. **Número de orden con clave de orden calculada.** Se guarda el texto que ves ("2 bis") y una clave interna que ordena bien: 2 < 2.1 < 2.2 < 2 bis < 2 ter < 3. Además, cada ficha tiene un ID interno que no cambia nunca, aunque se renumere.
9. **Fechas con precisión.** Fecha desde, fecha hasta y precisión (día, mes, año, aproximada o sin fecha). Así "marzo de 2021" entra en la cronología sin inventarle el día.
10. **Patrón/contraseña en una tabla aparte.** Lo explico en los riesgos.
11. **Las reglas duras las hace cumplir la base, no la pantalla.** Triggers de Postgres que rechazan cualquier cambio en el texto literal de un mensaje o en la descripción del acta ya importada; auditoría escrita por triggers, que no depende de que el frontend se acuerde de registrar; borrar está prohibido por política, y "borrar" en la app es archivar.
12. **Control de versión por ficha.** Cada ficha lleva un número de versión. Al guardar un campo, la app manda la versión que vio; si otro la cambió en el medio, no pisa nada: te muestra qué cambió y quién lo cambió.
13. **Acceso por causa desde el día uno.** Mantengo "todos pueden todo", pero dentro de cada causa, con una lista de miembros. Para el 299113 están todos, así que en la práctica no cambia nada; el día que se cargue una causa de otro equipo, no queda abierta para cualquiera que tenga cuenta.
14. **Origen de la importación.** Cada fila importada guarda de qué planilla, hoja y fila salió. Sirve para comparar los conteos contra la fuente y para rastrear un error hasta su origen.

## 3. Stack definitivo

Mantengo tu arquitectura (React + Supabase + Netlify, archivos en Drive) con estas precisiones:

- **Frontend:** React + TypeScript + Vite. Los datos se manejan con TanStack Query sobre el cliente de Supabase. Para la tabla, TanStack Table + TanStack Virtual: no traen estilo propio, así que la identidad visual es toda nuestra, y virtualizan 10.000 filas sin esfuerzo. Descarté AG Grid: es muy potente, pero impone su estética de planilla y la agrupación de filas es de la versión paga. Menús, diálogos y navegación por teclado con Radix UI (accesible de fábrica), estilado con nuestros tokens en CSS. Buscador `Ctrl+K` con cmdk. Íconos Lucide (lineales y consistentes). Cola de cambios sin conexión en IndexedDB.
- **Supabase:** Postgres, Auth, Realtime (cambios de tablas para los datos y Presence para "INES está viendo esta ficha"), Edge Functions y pg_cron para el backup semanal. Región São Paulo, por cercanía.
- **Búsqueda:** configuración de texto propia (castellano + `unaccent`), columnas `tsvector` con índices GIN y `pg_trgm` para nombres y alias mal tipeados. Los mensajes se buscan y se paginan en el servidor: nunca se bajan los 200.000 al navegador.
- **Esquema como código:** migraciones SQL versionadas en el repo. Si hay que restaurar o mudar la base, se recrea idéntica.
- **Exportaciones:** `.docx` generado en el navegador con la librería `docx` (justificado, interlineado 1,5, cuerpo 11); Excel y CSV desde la vista filtrada.
- **Tests:** Vitest para la lógica (orden jerárquico, citas, importación), Playwright con dos navegadores logueados a la vez para tiempo real y edición concurrente, y tests SQL para triggers y políticas de acceso.
- **Dos proyectos:** uno de pruebas y uno de producción. Nunca se prueba sobre la causa real.
- **Portabilidad:** Supabase es open source. Si el MPF exigiera servidores propios, se instala en uno del MPF sin reescribir la app.

### Costos (verificados el 26/09/2026 en las páginas oficiales)

| Servicio | Plan gratuito | Plan pago que recomiendo |
|---|---|---|
| Supabase | 500 MB de base, 1 GB de archivos, 5 GB de tráfico, 200 conexiones simultáneas en tiempo real. Se pausa tras 1 semana sin uso. Sin backups. Máximo 2 proyectos activos. | **Pro, desde US$ 25/mes** (incluye US$ 10 de cómputo, que cubren la instancia básica): 8 GB de disco, backups diarios con 7 días de retención, no se pausa. |
| Netlify | 300 créditos/mes. Cada deploy a producción consume 15 (unos 20 deploys por mes, sin contar tráfico). Si se agotan, el sitio queda pausado hasta el ciclo siguiente. | Personal, US$ 9/mes (1.000 créditos), solo si el gratuito queda corto. Pro cuesta US$ 20/mes (3.000 créditos). |

Recomendación: la Fase 0 arranca en los planes gratuitos. Supabase Pro desde el día en que entra el primer dato real (Fase 1), no por capacidad (la causa entra en 500 MB) sino porque una causa en trámite no puede vivir en una base sin backups que además se pausa sola. En Netlify alcanza el gratuito si juntamos los deploys a producción; las vistas previas por rama figuran como ilimitadas en el plan gratis. En estas semanas hay varios reportes en el foro de Netlify de sitios gratuitos que siguieron pausados después del reinicio de créditos, así que si en Fase 1 vemos que se consume, conviene pasar a Personal. **Total estimado: entre US$ 25 y US$ 34 por mes.**

Otro límite verificado: el correo que Supabase manda por defecto solo llega a los miembros del proyecto y tiene un tope de 2 mensajes por hora. Si el login es por correo, hace falta configurar un servidor de correo propio (ver la pregunta del punto 6).

Fuentes: [supabase.com/pricing](https://supabase.com/pricing), [netlify.com/pricing](https://www.netlify.com/pricing/), [docs de Netlify sobre créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [docs de Supabase sobre SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [foro de Netlify](https://answers.netlify.com/t/free-plan-site-stuck-paused-despite-full-credit-balance-300-300/169986), [API de Drive (checksums)](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

## 4. Propuesta visual

Boceto: [`docs/diseno/boceto-indice-prueba.html`](diseno/boceto-indice-prueba.html).

**Paleta** (todos los pares de texto y fondo verificados por encima de AA 4,5:1)

| Token | Hex | Uso |
|---|---|---|
| Papel | `#FAF9F6` | Fondo general |
| Superficie | `#FFFFFF` | Tablas, fichas, paneles |
| Cabecera | `#F2F1EC` | Encabezados de tabla, al estilo planilla |
| Línea | `#E4E1D8` | Bordes y divisiones |
| Tinta | `#1E3350` | Texto principal y botón primario (12,1:1 sobre papel) |
| Tinta 2 | `#4A5B73` | Texto secundario (6,9:1) |
| Tinta 3 | `#667387` | Rótulos y ayudas (4,8:1) |
| Enlace | `#2F5A93` | Links, foco y selección |
| Lacre | `#A63D2A` | **Solo** alertas procesales (6,3:1) |
| Verde archivo | `#2F6B4A` | Guardado y presencia |

**Chips por familia de pieza** (fondo pastel / texto), contraste entre 6,4 y 7,6:1: Documental `#F4EAD5 / #6A4B12` · Pericial y forense `#E2E9F6 / #2C4C80` · Mensajes y correos `#DCF0EE / #1D5D58` · Contratación `#E5EEDC / #3B5A28` · Persona o empresa `#ECE5F6 / #56408C` · Otros `#EEEBE5 / #4D4840`. El color marca la familia y el texto dice el tipo exacto, así alcanzan seis colores para diez tipos.

**Tipografía:** Inter para interfaz y tablas, con cifras tabulares; la elegí sobre Roboto porque se lee mejor en tamaños chicos. Source Serif 4 para carátulas y títulos de ficha, y en itálica para las observaciones del analista: la interpretación nunca se ve igual que el dato.

**Cómo se ve el Índice de prueba:** riel izquierdo claro con la marca, el selector de causa, las secciones, quién está en línea y el indicador "Guardado · hace 2 s". Arriba, la carátula en serif con legajo y OGA. Debajo, el título de la vista con "Importar planilla", "Exportar" y "Nueva pieza"; una barra con la búsqueda (`Ctrl+K`), los filtros combinables en forma de píldoras (el de estado procesal muestra cuántas piezas tienen alerta), agrupar, columnas y el selector de densidad cómoda o compacta. La tabla tiene encabezado gris tipo planilla, el Nº en un sello foliado con sangría para la sub-numeración, chip de tipo, título con autor y destinatario debajo, fecha con su precisión, origen con la etiqueta de secuestro del efecto, estado procesal, relevancia en barras, responsable y vínculos. Una fila con problema procesal lleva una franja de lacre a la izquierda. Al hacer clic se abre la ficha a la derecha: sello, tipo, título en serif, "Abrir en Drive", "Copiar cita" y "Editar"; después, los datos objetivos, el origen, los enlaces con su hash, las observaciones del analista sobre fondo de nota, el estado procesal con lo que hereda, la cita lista para copiar y el historial. Los datos faltantes se ven como `[completar]` y lo que sugiere una máquina, en azul punteado.

## 5. Riesgos y cómo los mitigo

**Seguridad y datos personales**

- Vamos a subir a una nube comercial datos de una investigación penal en curso: nombres, DNI, teléfonos, conversaciones privadas y claves de dispositivos. No sé si el MPF tiene una política sobre esto y no te lo puedo afirmar. Te recomiendo consultarlo con el área de informática antes de la Fase 1; no frena la Fase 0, que no lleva datos reales. Si la respuesta fuera "servidores propios", la app se muda sin reescribirse.
- **Patrón/contraseña de dispositivos.** Guardarlo en la misma tabla que el resto lo expone en exportaciones, backups en CSV, búsquedas y pantallas compartidas. Propongo tabla aparte, oculto por defecto con un botón "ver" que queda registrado en el historial, y excluido de exportaciones y búsqueda. Todos siguen teniendo el mismo permiso; lo que cambia es que no se filtra por accidente.
- La clave pública de Supabase viaja en la app (es normal): la seguridad depende de las políticas de acceso, así que van con tests propios.
- En PC compartidas, cerrar sesión borra la copia local sin conexión.

**Pérdida o alteración de datos**

- Plan gratuito sin backups y con pausa automática: Pro desde la Fase 1, más el backup semanal propio (JSON + CSV) y el botón de copia completa.
- Borrado por error: no existe el borrado físico; todo se archiva y el historial guarda el valor anterior, con un botón de restaurar.
- Dos personas en la misma ficha: guardado por campo con control de versión; si hay choque, no se pisa y se muestra qué cambió.
- Cola sin conexión: al volver internet, cada cambio se reaplica contra la versión vigente; si choca, pregunta en lugar de pisar.
- Transcripciones: un trigger en la base rechaza cualquier edición y cada mensaje guarda su hash al importarse.
- Dependencia de una sola cuenta: si Supabase y Netlify quedan a nombre de una persona que se va o pierde el acceso, la app se cae. Propongo un correo del equipo como dueño de las cuentas, con dos administradores.

**Técnicos**

- Nombre del archivo desde un link de Drive: con archivos privados **no se puede sin pedir permiso**. La alternativa con el permiso más acotado que existe es el selector de archivos de Google (permiso `drive.file`: solo los archivos que la persona elige). Con eso la app completa el nombre y además toma el SHA-256 que calcula el propio Drive. Sin ese permiso queda pegar el link y escribir el nombre.
- Importación de planillas reales (celdas combinadas, fechas como texto, una hoja por licitación): asistente con vista previa, mapeo, reporte de duplicados y conteo de filas de la fuente contra las importadas.
- Rendimiento con 200.000 mensajes: búsqueda y paginado en el servidor, con índices.

**Adopción**

- Si cargar en la app es más lento que en la planilla, no se usa: carga por teclado, pegar el link de Drive, nada obligatorio salvo título y tipo, e importación de lo que ya existe.
- Doble carga durante la transición: fijar una fecha de corte a partir de la cual las planillas quedan de solo lectura. La exportación a Excel queda siempre disponible.
- El fiscal: vista de consulta cómoda desde el celular y el guion de 5 minutos.
- Sin capacitación: estados vacíos que explican qué hacer y nombres de pantallas iguales a los de las planillas actuales.

## 6. La pregunta para arrancar la Fase 0

**¿Todos los del equipo, y el fiscal, entran al Drive de la UFIL con una cuenta de Google (Gmail o institucional)?**

- Si es que sí: login con "Entrar con Google" y una lista de invitados que administran ustedes desde la app. No hay contraseñas ni servidor de correo, y la misma cuenta habilita el selector de Drive que completa nombre y hash.
- Si es que no: login con un código de 6 dígitos por correo (más confiable que el link mágico, que los filtros de correo institucional suelen romper), con un servidor de correo propio.
