import { describe, expect, it } from 'vitest';
import { enTandas, leerPaqueteTexto, limpiarTexto, motivoNoLeible, sha256Hex, textoDeItems, textoUtil } from './documentos';

describe('documentos leídos', () => {
  it('calcula la huella SHA-256 del contenido', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('limpia el texto sin cambiar ninguna palabra', () => {
    expect(limpiarTexto('FACTURA\u0000  N° 0024\r\n\r\n\r\n\r\n  CUIT:\t30-67454952-7  ')).toBe('FACTURA N° 0024\n\nCUIT: 30-67454952-7');
  });

  it('arma el texto de una página con los cortes de línea del PDF', () => {
    expect(textoDeItems([{ str: 'Licitación', hasEOL: false }, { str: 'Pública', hasEOL: true }, { str: 'LP 05/2020', hasEOL: false }])).toBe(
      'Licitación Pública\nLP 05/2020',
    );
  });

  it('distingue una capa de texto útil de una página que es solo imagen', () => {
    expect(textoUtil('  3 · 4 · 12/10 ')).toBe(false);
    expect(textoUtil('Remito de materiales viales entregado en la planta de Paraná')).toBe(true);
  });

  it('dice por qué no lee un archivo', () => {
    expect(motivoNoLeible('escaneo.pdf')).toBeNull();
    expect(motivoNoLeible('foto.TIF')).toMatch(/TIFF/);
    expect(motivoNoLeible('notas.docx')).toMatch(/texto/);
  });

  it('lee el paquete de texto de AppUFIL y avisa lo que queda afuera', () => {
    const { paquete, avisos } = leerPaqueteTexto({
      formato: 'tablero-texto/1',
      generado_por: 'AppUFIL',
      archivos: [
        { sha256: 'A'.repeat(64), nombre: 'Compras.pdf', ruta: 'EFECTO 48453/Compras.pdf', paginas: 2, texto: [{ nro: 1, texto: 'Factura\u0000 B', confianza: 88 }, { nro: 9, texto: 'fuera' }] },
        { sha256: 'a'.repeat(64), nombre: 'Repetido.pdf', paginas: 1, texto: [] },
        { sha256: 'corta', nombre: 'Mal.pdf', paginas: 1, texto: [] },
      ],
    });
    expect(paquete.archivos).toHaveLength(1);
    expect(paquete.archivos[0]).toMatchObject({ sha256: 'a'.repeat(64), paginas: 2, texto: [{ nro: 1, texto: 'Factura B', metodo: 'appufil', confianza: 88 }] });
    expect(avisos).toEqual([expect.stringMatching(/dos veces/), expect.stringMatching(/Mal\.pdf|archivo 3/)]);
    expect(() => leerPaqueteTexto({ archivos: [] })).toThrow(/paquete de texto/);
  });

  it('parte en tandas', () => {
    expect(enTandas([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
