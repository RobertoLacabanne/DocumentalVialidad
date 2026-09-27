# Tablero de Prueba

El índice vivo de la prueba de una causa, para la Unidad Fiscal de Investigación y Litigación de Paraná. Es el cuadro de siempre (una fila por pieza, con su número de orden, su cita y el link al Drive) pero compartido en tiempo real, con historial y con la situación procesal de cada documento a la vista. Suma el tablero de los efectos secuestrados, las contrataciones investigadas con su trámite a fojas, un lector de las conversaciones extraídas de los teléfonos que arma el informe de relevamiento, el directorio de personas y empresas con su grafo de relaciones, la cronología de la causa, la preparación del juicio con los avisos procesales, el texto de los escaneos para buscar adentro y un buscador que encuentra cualquier cosa de la causa.

**Dirección:** https://tablero-prueba-ufil.netlify.app

Los archivos siguen en el Drive de la UFIL. El tablero no los toca: guarda los links, los ordena y deja encontrarlos en dos clics.

## Cómo entrar

1. Abrí la dirección desde cualquier computadora o desde el celular.
2. Tocá **Entrar con Google** y elegí la misma cuenta con la que entrás al Drive de la UFIL.
3. Si te dice «Todavía no estás habilitado», pedile a alguien del equipo que te invite (ver más abajo).

## Qué hay en cada pantalla

- **Inicio:** cómo viene la causa. El avance de los efectos, cuánto lleva cada uno, las alertas procesales, lo pendiente y lo último que pasó. Desde acá se baja la copia completa de la causa.
- **Índice de prueba:** una fila por pieza, como el cuadro Urribarri.
- **Efectos:** cada cosa secuestrada. En **Tablero** se arrastran las tarjetas entre columnas (Sin iniciar, En proceso, Escaneado, Finalizado, Observado); en **Por allanamiento** se ven agrupadas por procedimiento, y se pueden marcar varias para cargarles una situación procesal de una vez.
- **Documentos:** los escaneos leídos. Se arrastran los PDF (o la carpeta entera del Drive) y el texto de cada página queda buscable con `Ctrl + K`. El archivo se lee en tu computadora: no se sube ni se modifica. Acá también está la bandeja de **sugerencias** para validar.
- **Contrataciones:** una ficha por licitación con el trámite paso a paso (fojas, fecha tal cual figura, firmante), el cuadro comparativo de ofertas con la menor marcada y la diferencia contra el presupuesto oficial, y los mensajes y piezas que la prueban.
- **Personas y empresas:** el directorio de la causa, con teléfonos, CUIT y cómo figura cada uno agendado en los celulares. Con **Relaciones** se ve el grafo: quién es socio, familiar o empleado de quién, qué empresas ofertaron en cada contratación y quiénes aparecen juntos en una conversación.
- **Mensajes:** las conversaciones de los teléfonos, como un chat, en orden y con la fecha de cada mensaje. Se marcan los relevantes, se les escribe la observación y se vinculan a su contratación. Desde acá sale el **Informe de relevamiento de mensajes** en Word.
- **Cronología:** todo lo que tiene fecha en una sola línea de tiempo (piezas, mensajes relevantes, pasos de las contrataciones, allanamientos, actos procesales, planteos y resoluciones), filtrable por tipo, persona, contratación y fechas. **Exportar PDF** la imprime para mostrársela al fiscal.
- **Juicio:** el punteo de la prueba para el debate, heredero de «Prueba a mostrar en debate con testigos». Avisa lo que falta resolver y sale el listado para la remisión a juicio en Word.
- **Equipo:** quién está habilitado y con qué alias figura en las planillas.

## Cómo importar las planillas de efectos

Sirve para LISTADO EFECTOS, DISTRIBUCIÓN DE TAREAS y cualquier planilla con columnas parecidas.

1. Bajá la planilla del Drive como Excel. Si es un archivo de Google Sheets (como DISTRIBUCIÓN DE TAREAS): **Archivo → Descargar → Microsoft Excel (.xlsx)**. Si ya es un .xlsx (como LISTADO EFECTOS), bajala tal cual.
2. En **Efectos**, tocá **Importar planilla** y arrastrá el archivo.
3. **Planilla:** el tablero encuentra solo la fila de títulos y si son papeles o dispositivos. Revisá la vista previa.
4. **Columnas:** cada columna ya viene relacionada con su campo. Cambiá lo que haga falta; lo que marques «No importar» queda afuera.
5. **Revisión:** antes de guardar, te dice cuántas filas entran, cuáles ya estaban cargadas, cuáles están repetidas, cuáles tienen un valor que no reconoce (por ejemplo, un estado mal escrito) y cuáles no tienen número de efecto. Nada se corrige por deducción: si algo no cierra, corregilo en la planilla y volvé a subirla, o importá el resto y cargá esas filas a mano.
6. **Importar.** Los efectos quedan agrupados por allanamiento (fecha y domicilio), vinculados a su informe del gabinete si la planilla lo menciona, y cada uno recuerda de qué archivo y fila salió.

Importar dos veces la misma planilla no duplica nada: lo que ya está cargado no se toca.

**Responsables:** si en la planilla figura AGUS, CARLI o INES y esa persona todavía no está en el equipo, el efecto queda con ese nombre y se le asigna solo cuando la invites en **Equipo** con el mismo alias. Si un alias está en dos cuentas, no se asigna a ninguna hasta que quede en una sola (Equipo lo avisa).

## Cómo importar EXPEDIENTES DE CONTRATACIÓN

1. Bajá la planilla como Excel: **Archivo → Descargar → Microsoft Excel (.xlsx)**.
2. En **Contrataciones**, tocá **Importar planilla** y arrastrá el archivo. Cada hoja con la tabla del trámite (PROCEDIMIENTO, Fs., FECHA, FIRMANTE, OBSERVACIONES) es una contratación; las hojas que no la tienen quedan afuera y se nombran.
3. **Revisión:** ves cada contratación con todos sus pasos. El identificador sale del nombre de la hoja y se puede corregir (Excel no deja poner «/» en el nombre de una hoja, así que «LP 05_2020» se toma como «LP 05/2020» y te lo avisa). Las fechas ambiguas («entre el 11 y 17/3/2020», «febrero 2020») se guardan tal cual, sin inventar el día.
4. **Montos:** los que la app encuentra escritos en las observaciones (presupuesto, reserva, cada oferta) aparecen sin tildar. Tildá solo los que coinciden con el expediente. Si una oferta menciona dos montos, no propone ninguno.
5. **Importar.** Cada paso recuerda de qué hoja y fila salió. Si la contratación ya estaba cargada sin trámite (como la LP 05/2020), se completa sin pisar lo que tenía; si ya tiene su trámite, no se toca.

Los montos que falten se completan tocando la oferta en la ficha, escritos como en el expediente (18.415.263,50).

## Cómo leer escaneos para buscar adentro

1. Bajá del Drive el PDF o la carpeta entera (en el Drive: clic derecho sobre la carpeta → **Descargar**, y descomprimí el .zip).
2. En **Documentos**, arrastrá los archivos o la carpeta, o usá **Leer escaneos** / **Elegir carpeta**.
3. La app calcula la **huella SHA-256** de cada archivo y lee cada página: si el PDF ya trae texto, lo toma tal cual; si la página es una imagen, le hace **OCR en castellano**. Arriba ves el avance. Podés seguir trabajando en otra pantalla (el riel muestra el progreso), pero no cierres la pestaña.
4. Si se corta, volvé a arrastrar el archivo: lo reconoce por la huella y sigue desde la página donde quedó. Si lo arrastra otra persona, tampoco se duplica.
5. Listo: `Ctrl + K` encuentra las palabras de los escaneos, y al elegir un resultado se abre la página con el término resaltado.

**Qué esperar del OCR:** lee bien lo impreso (facturas, remitos, expedientes); lo escrito a mano (las agendas, por ejemplo) casi no lo lee. El texto leído por máquina sirve para **encontrar** el documento, no para citarlo: citá siempre el original. Para volúmenes grandes conviene AppUFIL, que lee mejor (endereza las hojas y compara dos lecturas).

## Sugerencias para validar

Al leer un documento, la app propone de qué efecto es (si la carpeta o el archivo se llaman «EFECTO 48435»), qué contratación menciona (por el identificador, como «Licitación Pública Nº 5/20», o por el número de expediente), qué persona (por el CUIT) y si ya es una pieza del índice (por la huella o el nombre del archivo). **Nada se aplica solo:** en **Documentos → Sugerencias** (o en la ficha del documento) alguien la confirma y queda con su nombre, o la descarta y no vuelve a aparecer. El menú muestra cuántas hay pendientes.

## Cómo traer el texto de AppUFIL

Si los escaneos ya se procesaron en AppUFIL, no hace falta volver a leerlos:

1. En **Documentos → Traer texto de AppUFIL**, bajá el script `appufil-a-tablero.py`.
2. En la computadora de AppUFIL, corrélo sobre la base del legajo: `python3 appufil-a-tablero.py datos/legajos/<legajo>/ufil.sqlite`. Lee la base sin modificarla y arma un archivo `texto-para-el-tablero-….json`.
3. Llevá ese archivo (en un pendrive, si AppUFIL está sin internet) y elegilo en el mismo diálogo. Se reconocen por la huella los documentos que ya estaban; podés elegir reemplazar su texto por el de AppUFIL.

## Cómo importar una conversación

1. Abrí la transcripción en el Drive (por ejemplo, desde APUNTES LEG. 299113) y bajala como Word: **Archivo → Descargar → Microsoft Word (.docx)**. También sirve el .txt que exporta WhatsApp, o pegar el texto.
2. En **Mensajes**, tocá **Importar conversación** y arrastrá el archivo.
3. **Revisión:** la app separa fecha, remitente y mensaje, y te muestra todo en una tabla. Entiende las dos formas que usa el equipo («Remitente: …» / «Mensaje: …» y «Nombre:» seguido del texto), los audios e imágenes, y la hora cuando figura. Las notas entre paréntesis del analista, como «(al otro día)», no se importan como mensajes; las **notas al pie** pasan a la observación del mensaje. Destildá lo que no sea un mensaje (resúmenes del analista, tramos repetidos: la app avisa cuando ve el mismo texto dos veces) y corregí el remitente si no lo reconoció.
4. Completá los datos del encabezado (título, participantes, efecto, titular, número, cómo estaba agendado): son los que usa el informe.
5. **Importar.** El texto de cada mensaje queda **literal** y ya no se puede editar: se guarda con su huella SHA-256.

**Desde un reporte de UFED:** en UFED Reader, exportá el reporte a **Excel (.xlsx)** y arrastralo en el mismo lugar. La app encuentra la hoja de chats, reconoce las columnas (Body/Mensaje, From/De, fecha y hora…) y te muestra cuáles tomó: si alguna no es, la cambiás. Cada chat se revisa e importa como una conversación, con la fecha tal cual figura en el reporte; después podés seguir con otro chat del mismo reporte. Si las fechas pueden leerse como día/mes o mes/día, avisa.

## Cómo marcar mensajes y sacar el informe

1. En **Mensajes**, abrí la conversación. Pasá el mouse por un mensaje y tocá el marcador, o elegilo y apretá **R**: queda marcado como relevante para todo el equipo al instante.
2. Tocá el mensaje para abrir su ficha: ahí escribís la **observación** (por qué es relevante) y lo **vinculás** a la contratación o a la pieza que prueba. El vínculo aparece también en la ficha de la contratación.
3. Con **Relevantes** ves solo los marcados; el buscador de la conversación no distingue tildes.
4. Tocá **Informe .docx**. Sale con la plantilla del equipo (Palatino 11, justificado, interlineado 1,5): referencia del legajo, los dos párrafos de introducción, la transcripción por conversación y en orden, y cada mensaje con Fecha, Emisor (el titular del teléfono, que se carga en «Datos de la conversación»), Remitente (quien lo envía), Mensaje y OBSERVACIONES (con la contratación vinculada). Si el teléfono tiene otras conversaciones, se pueden sumar al mismo informe.
5. Lo que falte (dispositivo, informe del gabinete, titular…) sale como `[completar: …]`. Se carga desde **Datos de la conversación**. Revisá el documento en Word antes de firmarlo.

## Cómo armar el ofrecimiento de prueba

1. En **Juicio**, tocá **Sumar piezas** y elegí las del índice en el orden en que las querés numerar. Si alguna tiene un problema procesal (admisibilidad cuestionada, pendiente de resolución, excluida), el tablero lo dice **antes** de confirmar y el botón pasa a decir «Sumar igual».
2. Con **Testigos o peritos** sumás personas del directorio (primero aparecen las que ya tienen ese rol). **Otra prueba** sirve para informativa o instrumental que no está en el índice.
3. Tocá cada fila para completar su ficha: cómo se nombra en el escrito, qué se prueba o sobre qué declara, si se exhibe y con quién se introduce, si se entregó a la defensa, el acuerdo probatorio, los imputados vinculados y, después de la audiencia, qué dijo el auto de apertura.
4. Arriba están los avisos: **con problema procesal** (rojo lacre), **rechazadas en el auto**, **sin quién la introduce**, **sin entregar a la defensa** e **impugnadas**. Tocá uno para ver solo esas filas.
5. **Exportar → Listado para la remisión (.docx)** arma el ofrecimiento por clase (A.- TESTIMONIAL, B.- DOCUMENTAL…), numerado y con el formato de la fiscalía. Lo que falte sale como `[completar: …]`. **Planilla del punteo** baja la tabla completa a Excel, con las columnas del cuadro Urribarri.

Si se quita una prueba, **Renumerar** corre los números para que no queden salteados.

## Cómo cargar una relación entre personas

1. En **Personas y empresas**, tocá **Relaciones** y después **Nueva relación** (o, desde la ficha de una persona, **Agregar relación**).
2. Elegí las dos fichas, escribí qué relación tienen (socio, familiar, empleado…) y **de dónde surge** (contrato social, efecto, fojas): así cualquiera puede ir a verificarla.
3. En el grafo, las líneas llenas son lo firme (lo cargado por el equipo y las ofertas de las contrataciones). Las **punteadas** salen de nombres que aparecen juntos en una conversación: son una coincidencia a confirmar, no una identificación.

Tocá un nodo para abrir la ficha de esa persona: ahí se ven sus relaciones y dónde aparece (contrataciones, juicio, efectos, piezas, conversaciones y mensajes).

## Cómo cargar una pieza

1. En **Índice de prueba**, tocá **Nueva pieza**.
2. Completá el número de orden (admite 2.1, 2 bis, 2 ter…), el tipo y el título. Si tenés el link del Drive, pegalo.
3. Tocá **Cargar pieza**. Se abre la ficha en modo edición: completá lo que tengas. **Cada campo se guarda solo** cuando pasás al siguiente; abajo a la izquierda ves «Guardado · hace 2 s».
4. Lo que no sepas, dejalo vacío: el tablero lo muestra como `[completar]`. Nunca inventa datos.

Lo que cargás le aparece al resto del equipo al instante, sin recargar la página.

## Lo que conviene saber

- **Dato e interpretación van separados.** Arriba en la ficha están los datos del documento (qué dice, quién firma, fecha, fojas). Las **Observaciones del analista** van aparte, en letra cursiva sobre fondo de nota.
- **Si dos personas tocan el mismo campo a la vez**, el tablero no pisa a nadie: al segundo le avisa quién lo cambió y qué dice ahora, y deja elegir entre guardar lo suyo igual o quedarse con lo del otro.
- **Nada se borra.** «Archivar» saca la pieza del índice, pero queda en el historial y se puede restaurar. Cada ficha muestra quién cambió qué y cuándo.
- **El rojo lacre aparece solo cuando hay un problema procesal** (admisibilidad cuestionada, pendiente de resolución, excluida).
- **Copiar cita** arma la referencia para pegar en un escrito: `Efecto Nº 48435 – Agenda 2021 (Sobre Nº …), fs. …, informe C6855, pieza Nº 19`.
- **Buscar:** `Ctrl + K` abre el buscador de toda la causa desde cualquier pantalla: piezas, efectos, personas (también por teléfono o por cómo estaba agendada), contrataciones y el texto de los mensajes. Al elegir un mensaje se abre la conversación en ese punto. En el índice, la tecla `/` va al filtro de la tabla. No distingue tildes ni mayúsculas.
- **Exportar:** en Índice, Efectos y Personas, **Exportar** baja a Excel o CSV exactamente lo que estás viendo, con los filtros aplicados.
- **Densidad:** arriba a la derecha elegís entre vista cómoda o compacta.
- **Sin internet:** si se corta, lo que cargás queda en cola y se guarda solo cuando vuelve la conexión.

## Cómo invitar a un compañero

1. Entrá a **Equipo** (en el menú de la izquierda).
2. Cargá su correo de Google y cómo figura en las planillas (por ejemplo, CARLI). Arriba del formulario, el tablero te muestra qué alias de las planillas todavía no tienen a nadie.
3. Tocá **Invitar** y mandale el mensaje que te arma el tablero, por WhatsApp o por correo.

Desde la misma pantalla se puede cambiar el alias de alguien (con el lápiz que aparece al pasar por su nombre) o deshabilitar a quien ya no trabaja en la causa.

## Qué hay y qué viene

| Fase | Qué trae | Estado |
|---|---|---|
| 0 | Base: acceso con Google, índice de prueba, ficha, historial, tiempo real, sistema de diseño | Lista |
| 1 | Inicio, efectos (tablero y por allanamiento), personas y empresas, búsqueda global, importación de planillas, exportar a Excel, copia completa | Lista |
| 2 | Contrataciones con trámite y ofertas, lector de mensajes, relevantes y vínculos, informe de relevamiento en .docx | Lista |
| 3 | Preparación del juicio con avisos procesales y listado para la remisión, cronología exportable a PDF, grafo de relaciones | Lista |
| 4 | Texto de los escaneos (capa del PDF y OCR en el navegador), búsqueda adentro, texto de AppUFIL, sugerencias para validar, reportes de UFED en Excel | Lista |

## Si algo no anda

- Recargá la página. Lo guardado no se pierde.
- Si dice «Sin conexión», esperá a que vuelva internet: los cambios se guardan solos.
- Si sigue fallando, avisale a Rober con una captura de pantalla.

La parte técnica (instalación, base de datos, copias de seguridad) está en [MANUAL_TECNICO.md](MANUAL_TECNICO.md). El guion para presentarle el tablero al fiscal está en [docs/GUION_FISCAL.md](docs/GUION_FISCAL.md).
