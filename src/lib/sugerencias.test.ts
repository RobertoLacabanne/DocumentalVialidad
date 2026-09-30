import { describe, expect, it } from 'vitest';
import { claveProcedimiento, sugerirParaDocumento, textoSugerencia } from './sugerencias';

const causa = {
  efectos: [
    { id: 'e1', numero: '48435' },
    { id: 'e2', numero: '48453' },
  ],
  contrataciones: [
    { id: 'c1', identificador: 'LP 05/2020', expediente: '154782' },
    { id: 'c2', identificador: 'CD 12/2021', expediente: null },
  ],
  personas: [{ id: 'p1', nombre: 'Proveedora Ejemplo SRL', identificadores: [{ tipo: 'cuit', valor: '30-67454952-7' }] }],
  enlaces: [{ entidad_id: 'pz1', sha256: 'f'.repeat(64), nombre_archivo: 'Agenda 2021.pdf' }],
  piezas: [{ id: 'pz1', numero_orden: '19', titulo: 'Agenda 2021' }],
};

describe('sugerencias para un documento', () => {
  it('reconoce el mismo procedimiento escrito de distintas formas', () => {
    expect(claveProcedimiento('LP 05/2020')).toBe('LP-5-2020');
    expect(claveProcedimiento('Licitación Pública Nº 5/20')).toBe('LP-5-2020');
    expect(claveProcedimiento('L.P. 05-2020')).toBe('LP-5-2020');
    expect(claveProcedimiento('Contratación Directa N° 12/2021')).toBe('CD-12-2021');
    expect(claveProcedimiento('código postal 3100')).toBeNull();
  });

  it('propone el efecto por la carpeta y lo que menciona el texto, sin repetir', () => {
    const s = sugerirParaDocumento(
      {
        nombre: 'PARTE 1.pdf',
        ruta: 'EFECTO 48435/PARTE 1.pdf',
        sha256: 'a'.repeat(64),
        paginas: [
          { nro: 1, texto: 'Ref. Licitación Pública Nº 5/20 · Expte. 154.782\nCUIT: 30-67454952-7' },
          { nro: 2, texto: 'Se remite el efecto N° 48453 y otra vez LP 05/2020' },
        ],
      },
      causa,
    );
    expect(s.map((x) => [x.campo, x.valor.tipo ?? '', x.valor.id, x.fuente])).toEqual([
      ['efecto_id', '', 'e1', 'carpeta'],
      ['vinculo', 'contratacion', 'c1', 'texto'],
      ['vinculo', 'persona', 'p1', 'texto'],
      ['vinculo', 'efecto', 'e2', 'texto'],
    ]);
    expect(s[0].detalle).toBe('La carpeta dice «EFECTO 48435»');
    expect(s[1].detalle).toBe('Pág. 1: «Ref. Licitación Pública Nº 5/20 · Expte. 154.782 CUIT: 30-674…»');
    expect(s[2].detalle).toMatch(/^Pág\. 1: CUIT 30-67454952-7 \(Proveedora Ejemplo SRL\)$/);
  });

  it('reconoce una pieza del índice por la huella o por el nombre del archivo', () => {
    const porHuella = sugerirParaDocumento({ nombre: 'x.pdf', sha256: 'f'.repeat(64), paginas: [] }, causa);
    expect(porHuella).toEqual([expect.objectContaining({ campo: 'pieza_id', valor: { id: 'pz1' }, detalle: expect.stringMatching(/misma huella/) })]);
    const porNombre = sugerirParaDocumento({ nombre: 'agenda 2021.PDF', sha256: 'b'.repeat(64), paginas: [] }, causa);
    expect(porNombre[0].detalle).toMatch(/se llama igual/);
  });

  it('no inventa: números que no son de la causa no sugieren nada, y lo ya confirmado no se vuelve a proponer', () => {
    expect(sugerirParaDocumento({ nombre: 'EFECTO 99999.pdf', sha256: 'c'.repeat(64), paginas: [{ nro: 1, texto: 'LP 77/2019 · CUIT 20-11111111-2' }] }, causa)).toEqual([]);
    expect(
      sugerirParaDocumento({ nombre: 'a.pdf', ruta: 'EFECTO 48435/a.pdf', sha256: 'd'.repeat(64), paginas: [], actual: { efecto_id: 'e1' } }, causa),
    ).toEqual([]);
  });

  it('se lee en castellano en la bandeja', () => {
    const nombres = { efecto: () => '48435', contratacion: () => 'LP 05/2020', persona: () => 'Proveedora Ejemplo SRL', pieza: () => 'Nº 19' };
    expect(textoSugerencia({ campo: 'efecto_id', valor_sugerido: { id: 'e1' } }, nombres)).toBe('Es del efecto Nº 48435');
    expect(textoSugerencia({ campo: 'vinculo', valor_sugerido: { id: 'c1', tipo: 'contratacion' } }, nombres)).toBe('Menciona la contratación LP 05/2020');
  });
});
