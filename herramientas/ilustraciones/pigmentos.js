// Pigmentos de la serie. Son del arte, no de la interfaz: no van en tokens.css.
// `hex` es el tinte a densidad plena; en la pintura casi nunca pasa de la mitad.
// `gran` es cuánto se asienta en el grano del papel (0 nada, 1 mucho).
export const PIGMENTOS = {
  cerulo: { nombre: 'Celeste cerúleo', hex: '#4C9BD0', gran: 0.35, nota: 'Franja de la bandera; cielo y agua.' },
  ultramar: { nombre: 'Azul ultramar', hex: '#24407C', gran: 0.9, nota: 'Oscuros del agua y la canoa.' },
  tinta: { nombre: 'Tinta', hex: '#1E3350', gran: 0.6, nota: 'Igual a --color-texto; nunca negro.' },
  oro: { nombre: 'Oro del sol', hex: '#E3A52B', gran: 0.2, nota: 'Sol, reflejo y flores del espinillo.' },
  ocre: { nombre: 'Ocre', hex: '#C8933E', gran: 0.5, nota: 'Lomo de la barranca.' },
  siena: { nombre: 'Siena natural', hex: '#B5713A', gran: 0.8, nota: 'Cara de la barranca.' },
  sienaTostada: { nombre: 'Siena tostada', hex: '#8E5330', gran: 0.8, nota: 'Erosión y sombras cálidas.' },
  savia: { nombre: 'Verde savia', hex: '#6F9F3E', gran: 0.4, nota: 'Follaje nuevo, camalotes.' },
  oliva: { nombre: 'Oliva apagado', hex: '#7C8452', gran: 0.5, nota: 'Vegetación de ribera.' },
  verdeHondo: { nombre: 'Verde hondo', hex: '#47684A', gran: 0.6, nota: 'Sauces y sombras de ribera.' },
  violeta: { nombre: 'Violeta grisáceo', hex: '#8C86AD', gran: 0.7, nota: 'Sombras lejanas, ciudad sugerida.' },
  punzo: { nombre: 'Punzó del hilo', hex: '#C4243F', gran: 0.3, nota: 'El único rojo: el hilo de la bandera.' },
  punzoSombra: { nombre: 'Punzó en sombra', hex: '#A01C38', gran: 0.3, nota: 'El mismo punzó, más hondo, donde el hilo se carga.' },
};

export function rgbDe(nombre) {
  const p = PIGMENTOS[nombre];
  if (!p) throw new Error(`Pigmento desconocido: ${nombre}`);
  const h = p.hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
