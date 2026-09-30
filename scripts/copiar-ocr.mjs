// Copia a public/ocr lo que el OCR necesita en el navegador (el trabajador de
// tesseract.js, su núcleo en WebAssembly y los datos del castellano), para
// servirlo desde la propia app y no depender de un CDN que la red de la
// fiscalía podría bloquear. Corre después de `npm install` y antes del build.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const destino = 'public/ocr';
const archivos = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Solo las variantes LSTM (el motor que se usa); el navegador baja una sola, según lo que soporte.
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'lang/spa.traineddata.gz'],
];

let faltan = 0;
for (const [origen, nombre] of archivos) {
  if (!existsSync(origen)) {
    console.warn(`Falta ${origen}: el OCR del navegador no va a andar hasta instalar las dependencias.`);
    faltan += 1;
    continue;
  }
  const a = join(destino, nombre);
  mkdirSync(dirname(a), { recursive: true });
  copyFileSync(origen, a);
}
if (!faltan) console.log(`OCR listo en ${destino}/ (tesseract.js + castellano).`);
