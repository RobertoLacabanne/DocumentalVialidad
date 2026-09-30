// PDF sintéticos para las pruebas del lector de documentos: uno con capa de
// texto (lo lee pdf.js tal cual) y otro que es solo una imagen (obliga al
// OCR). Se arman a mano, byte por byte, sin librerías.

const enc = (s) => Buffer.from(s, 'latin1');

function armarPdf(objetos) {
  // objetos: Buffer por objeto, numerados desde 1 en el orden dado.
  const partes = [enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets = [];
  let largo = partes[0].length;
  objetos.forEach((cuerpo, i) => {
    offsets.push(largo);
    const obj = Buffer.concat([enc(`${i + 1} 0 obj\n`), cuerpo, enc('\nendobj\n')]);
    partes.push(obj);
    largo += obj.length;
  });
  const xref = [`xref\n0 ${objetos.length + 1}\n`, '0000000000 65535 f \n', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  partes.push(enc(`${xref}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${largo}\n%%EOF\n`));
  return Buffer.concat(partes);
}

const escapar = (t) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Un PDF con una página por cada lista de renglones, en Helvetica 12. Admite tildes (WinAnsi). */
export function pdfConTexto(paginas) {
  const n = paginas.length;
  // 1 catálogo, 2 páginas, 3 fuente, luego por página: objeto página + contenido.
  const kids = paginas.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  const objetos = [
    enc('<< /Type /Catalog /Pages 2 0 R >>'),
    enc(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`),
    enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
  ];
  paginas.forEach((renglones, i) => {
    const flujo = enc(`BT /F1 12 Tf 16 TL 72 770 Td ${renglones.map((r) => `(${escapar(r)}) Tj T*`).join(' ')} ET`);
    objetos.push(enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`));
    objetos.push(Buffer.concat([enc(`<< /Length ${flujo.length} >>\nstream\n`), flujo, enc('\nendstream')]));
  });
  return armarPdf(objetos);
}

/** Un PDF de una página que es solo una imagen JPEG (como sale de un escáner sin OCR). */
export function pdfConImagen(jpeg, ancho, alto) {
  const flujo = enc('q 595 0 0 842 0 0 cm /Im1 Do Q');
  return armarPdf([
    enc('<< /Type /Catalog /Pages 2 0 R >>'),
    enc('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>'),
    Buffer.concat([
      enc(`<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      Buffer.from(jpeg),
      enc('\nendstream'),
    ]),
    Buffer.concat([enc(`<< /Length ${flujo.length} >>\nstream\n`), flujo, enc('\nendstream')]),
  ]);
}
