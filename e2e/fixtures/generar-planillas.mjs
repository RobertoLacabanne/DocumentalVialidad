// Genera planillas y una transcripción SINTÉTICAS con la misma forma que las reales (título arriba,
// encabezados en otra fila, dos columnas OBSERVACIONES, filas raras).
// Ningún dato es real: los nombres, domicilios y números están inventados.
// Uso: node e2e/fixtures/generar-planillas.mjs [carpeta] [--base=90000]
// Con --base los números de efecto arrancan en otro lado (las pruebas usan uno distinto en cada corrida).
import writeXlsxFile from 'write-excel-file/node';
import { Document, FootnoteReferenceRun, Packer, Paragraph, TextRun } from 'docx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'e2e/fixtures/generadas';
const base = Number((process.argv.find((a) => a.startsWith('--base=')) ?? '--base=90000').slice(7));
const n = (x) => base + x; // 90001 → base + 1
mkdirSync(carpeta, { recursive: true });

const c = (v) => (v === null || v === undefined ? null : { value: v });

// Dispositivos, como LISTADO EFECTOS: fila 1 título, fila 2 encabezados.
const dispositivos = [
  [c('LISTADO DE EFECTOS (planilla de prueba)')],
  [
    null,
    c('N° de Efecto'),
    c('Descripción'),
    c('RESPONSABLE'),
    c('ESTADO'),
    c('APTO PARA ANALIZAR? '),
    c('OBSERVACIONES'),
    c('Fecha de procedimiento y domicilio'),
    c('Propietario (PJ/PH)'),
    c('Tenedor'),
    c('Patrón/Contraseña'),
    c('Autorización para ingreso'),
    c('Informe del gabinete'),
    c('Observaciones'),
    c('Ubicación actual'),
  ],
  [null, c(n(1)), c('Teléfono celular marca Ficticia modelo X1 color negro'), c('RUTA'), c('EN PROCESO'), c('SI'), c(''), c('03/02/2026 Calle Inventada 123 (Oficina de prueba)'), c('Empresa Imaginaria SRL (PJ)'), c('Juana Ejemplo'), c('1234'), c('Res. 000/26'), c('SI'), c('Informe C9001 entregado'), c('Gabinete')],
  [null, c(n(2)), c('Notebook marca Ficticia gris'), c('SIN ASIGNAR'), c('SIN INICIAR'), c('NO'), c('Pendiente de casación'), c('03/02/2026 Calle Inventada 123 (Oficina de prueba)'), c('Empresa Imaginaria SRL (PJ)'), c(''), c(''), c('Res. 000/26'), c('NO'), c(''), c('Fiscalía')],
  [null, c(n(3)), c('Pendrive 16 GB'), c('NO REQUIERE ESCRIBIENTE'), c('FINALIZADO'), c('NO REQUIERE ANÁLISIS'), c(''), c('10/02/26. Vivienda de calle Supuesta 456'), c('Pedro Muestra (PH)'), c('Pedro Muestra'), c(''), c(''), c('NO'), c(''), c('Fiscalía')],
  [null, c(n(4)), c('Tablet marca Ficticia'), c('RUTA'), c('A MEDIAS'), c('SI'), c(''), c('10/02/26. Vivienda de calle Supuesta 456'), c('Pedro Muestra (PH)'), c(''), c(''), c(''), c(''), c(''), c('')],
  [null, null, c('Cargador sin número'), c('RUTA'), c(''), c(''), c(''), c(''), c(''), c(''), c(''), c(''), c(''), c(''), c('')],
  [null, c(n(2)), c('Notebook repetida en la planilla'), c(''), c('SIN INICIAR'), c(''), c(''), c(''), c(''), c(''), c(''), c(''), c(''), c(''), c('')],
  [],
];

// Papel, como DISTRIBUCIÓN DE TAREAS: filas vacías arriba, título, vacía, encabezados.
const papel = [
  [],
  [],
  [],
  [c('DISTRIBUCION DE DOC PAPEL (planilla de prueba)')],
  [],
  [c('NUMERO DE EFECTO'), c('Nº INTERNO'), c('DESCRIPCION'), c('RESPONSABLE'), c('LINK DEL ESCANEO'), c('ORIGEN'), c('ESTADO'), c('OBSERVACIONES')],
  [c(n(1001)), c(1), c('Carpeta con remitos de prueba'), c('RUTA'), c(''), c('LOCAL IMAGINARIO'), c('SIN INICIAR'), c('')],
  [c(n(1002)), c(2), c('Cuaderno con anotaciones de prueba'), c('RUTA'), c('https://drive.google.com/drive/folders/prueba'), c('LOCAL IMAGINARIO'), c('FINALIZADO'), c('')],
  [null, null, null, c('RUTA'), null, null, null, null],
  [c(n(1003)), c(3), c('Talonario de facturas de prueba'), c('INES'), c(''), c('DOMICILIO SUPUESTO'), c('SIN INICIAR'), c('')],
];

await writeXlsxFile(dispositivos, { sheet: 'Hoja 1' }).toFile(join(carpeta, 'efectos-dispositivos-prueba.xlsx'));
await writeXlsxFile(papel, { sheet: 'Hoja de control de horas' }).toFile(join(carpeta, 'efectos-papel-prueba.xlsx'));
// Contrataciones, como EXPEDIENTES DE CONTRATACIÓN: una hoja por licitación.
const lp = `LP ${n(1)}/2020`;
const cp = `CP ${n(2)}/2021`;
const hojaContratacion = (titulo, expediente, inicio, pasos) => [
  [c(titulo)],
  [c('Nro de expediente'), null, c(expediente)],
  [c('fecha de inicio '), null, c(inicio)],
  [c('PROCEDIMIENTO'), c('Fs.'), c('FECHA '), c('FIRMANTE'), c('OBSERVACIONES')],
  ...pasos.map((f) => f.map(c)),
];
const licitacion = hojaContratacion('LICITACIÓN PÚBLICA de prueba', n(500), '26/2/2020', [
  ['Pedido de compra de repuestos de prueba', 1, '21/2/2020', 'Ing. Ficticio Uno (Director de Prueba)', null],
  ['Informe técnico de prueba', 20, 'febrero 2020', 'Tec. Ficticia Dos', 'Informa que hay partida'],
  ['Pase a la oficina de prueba', '21 vta', 'entre el 11 y 17/3/2020', 'Tec. Ficticia Dos', null],
  ['Presupuesto oficial de la contratación', '34-37', '11/05/2020', 'Ing. Ficticio Uno', '$16.163.917,90 (adjunta listado)'],
  [null, null, null, null, 'https://drive.google.com/file/d/presupuesto-prueba'],
  ['Informe de viabilidad presupuestaria', 68, '22/5/2020', 'Cr. Ficticio Tres', 'reserva preventiva del gasto por la suma de $16.163.917,90.'],
  ['Oferta Empresa Imaginaria SRL', '94-134', null, null, 'Oferta economica  $18.415.263'],
  [null, null, null, null, 'https://drive.google.com/file/d/oferta1-prueba'],
  ['Oferta Comercio Supuesto (Pedro Muestra)', '136-194', null, null, 'oferta econ $17.951.672,50.'],
  [null, null, null, null, 'https://drive.google.com/file/d/oferta2-prueba'],
  ['Oferta Proveedora Ejemplo SA', '195-240', null, null, 'Cotiza $19.020.000 y $250.000 de flete'],
  ['Dictamen de la comisión de preadjudicación', '241-245', '30/6/2020', 'Comisión de prueba', null],
]);
const concurso = hojaContratacion('Concurso de precios de prueba', n(501), '3/3/2021', [
  ['Solicitud de cotización de prueba', 1, '3/3/2021', 'Jefe de Compras de Prueba', null],
  ['Oferta Empresa Imaginaria SRL', '10-12', '15/3/2021', null, null],
]);
await writeXlsxFile([
  // Excel no admite «/» en el nombre de la hoja: se usa «_», como puede llegar de Google Sheets.
  { data: licitacion, sheet: lp.replace('/', '_') },
  { data: concurso, sheet: cp.replace('/', '_') },
  { data: [[c('Hoja de notas sueltas')]], sheet: 'Notas' },
]).toFile(join(carpeta, 'contrataciones-prueba.xlsx'));

// Transcripción de una conversación, como los .docx de APUNTES (personas inventadas).
const p = (texto, nota) =>
  new Paragraph({ children: [new TextRun(texto), ...(nota ? [new FootnoteReferenceRun(nota)] : [])] });
const conversacion = [
  `CONVERSACIÓN DE WHATSAPP - 34300${n(1)}`,
  'Legajo N.° 999.999',
  'Remitentes: Ficticio - Muestra',
  'importante: Muestra figura agendado como “Pedro Repuestos Prueba”.',
  '_______________________________________',
  '16/04/21',
  'Remitente: Ficticio',
  `Mensaje: Hoy te llega la invitación de la ${lp}, arreglá con los otros la cotización.`,
  'Y conseguime otro presupuesto para que te acompañe',
  'Remitente: Muestra',
  'Mensaje: [AUDIO] Dale, yo me encargo, lo coordinamos entre los tres (...)',
  '04/05/21 martes',
  '(al otro día)',
  'Remitente: Ficticio',
  ['Mensaje: Esa la ganaste compitiendo, acordate', 1],
  'Mensaje: [IMAGEN] le envía una imagen del presupuesto de prueba',
  'Remitente: Muestra 19:58 hs.',
  'Mensaje: Ok perfecto, mañana paso por la oficina',
];
const docx = new Document({
  footnotes: { 1: { children: [new Paragraph('Nota sintética del analista: esta la ganó en precios.')] } },
  sections: [{ children: conversacion.map((l) => (Array.isArray(l) ? p(l[0], l[1]) : p(l))) }],
});
writeFileSync(join(carpeta, 'conversacion-prueba.docx'), await Packer.toBuffer(docx));

// Reporte de extracción con la forma habitual de UFED exportado a Excel: título arriba, encabezados en
// inglés en la segunda fila y los datos del chat solo en su primera fila (celdas combinadas). Todo inventado.
const ufed = [
  [c('Chats (2)')],
  ['#', 'Chat #', 'Participants', 'Source', 'Instant Message #', 'From', 'To', 'Body', 'Timestamp: Date', 'Timestamp: Time', 'Attachment #1'].map(c),
  [1, 1, 'Ficticio, Muestra', 'WhatsApp', 1, 'Ficticio', 'Muestra', `Mañana sale la invitación de la ${lp}, arreglá con los otros`, '16/04/2021', '10:23:45(UTC-3)', null].map(c),
  [2, null, null, null, 2, 'Muestra', 'Ficticio', 'Dale, lo coordinamos entre los tres', '16/04/2021', '10:25:01(UTC-3)', null].map(c),
  [3, null, null, null, 3, 'Ficticio', 'Muestra', null, '04/05/2021', '19:58:00(UTC-3)', 'IMG-20210504-WA0003.jpg'].map(c),
  [4, null, null, null, null, null, null, null, null, null, null].map(c),
  [5, 2, 'Ficticio, Otro', 'SMS', 1, 'Otro', 'Ficticio', `Reporte UFED ${base}: llamame cuando puedas`, '20/05/2021', '08:00:00', null].map(c),
];
await writeXlsxFile(ufed, { sheet: 'Chats' }).toFile(join(carpeta, 'reporte-ufed-prueba.xlsx'));

console.log(`Planillas de prueba en ${carpeta} (contrataciones ${lp} y ${cp})`);
