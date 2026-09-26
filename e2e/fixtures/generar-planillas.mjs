// Genera planillas SINTÉTICAS con la misma forma que las reales (título arriba,
// encabezados en otra fila, dos columnas OBSERVACIONES, filas raras).
// Ningún dato es real: los nombres, domicilios y números están inventados.
// Uso: node e2e/fixtures/generar-planillas.mjs [carpeta] [--base=90000]
// Con --base los números de efecto arrancan en otro lado (las pruebas usan uno distinto en cada corrida).
import writeXlsxFile from 'write-excel-file/node';
import { mkdirSync } from 'node:fs';
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
console.log(`Planillas de prueba en ${carpeta}`);
