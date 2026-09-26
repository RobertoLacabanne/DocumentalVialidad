import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { alertasDe, contenidoListado, descripcionDe, listadoEnDocx, ordenarItems, type ItemOfrecido } from './ofrecimiento';

// Ítems sintéticos (datos inventados).
const base: ItemOfrecido = {
  id: 'x',
  clase: 'documental',
  numero: '1',
  descripcion: null,
  objeto: null,
  entregada_defensa: true,
  fecha_entrega: null,
  acuerdo_probatorio: null,
  incorporacion: null,
  introduce_id: null,
  partes_a_exhibir: null,
  requiere_escaneo: false,
  ubicacion_fisica: null,
  admision: 'pendiente',
  numero_auto: null,
  impugnada: false,
  motivo_impugnacion: null,
  imputados: [],
  todos_los_imputados: false,
  tambien_ofrecida_por: [],
  observaciones: null,
  pieza: null,
  persona: null,
};
const pieza = (extra: Partial<NonNullable<ItemOfrecido['pieza']>> = {}) => ({
  numero_orden: '19',
  titulo: 'Agenda 2021 de prueba',
  efecto_numero: '99001',
  informe_numero: 'C9001',
  sobre: null,
  fojas: '12',
  situacion: null,
  incidencia: null,
  ...extra,
});

describe('ofrecimiento', () => {
  it('avisa lo que falta para el juicio, lo procesal primero', () => {
    const i: ItemOfrecido = {
      ...base,
      entregada_defensa: false,
      incorporacion: 'exhibicion',
      pieza: pieza({ situacion: 'admisibilidad_cuestionada', incidencia: 'Planteo de prueba' }),
    };
    expect(alertasDe(i).map((a) => [a.tipo, a.grave])).toEqual([
      ['procesal', true],
      ['introduce', false],
      ['entrega', false],
    ]);
    expect(alertasDe(i)[0].texto).toBe('La pieza tiene la admisibilidad cuestionada («Planteo de prueba»).');
    // A un testigo no se le pide constancia de entrega.
    expect(alertasDe({ ...base, clase: 'testimonial', entregada_defensa: false, persona: { nombre: 'Testigo Uno', cargo: null } })).toEqual([]);
  });

  it('nombra la prueba con lo escrito a mano, o con la pieza o la persona', () => {
    expect(descripcionDe({ ...base, pieza: pieza() })).toBe('Agenda 2021 de prueba');
    expect(descripcionDe({ ...base, descripcion: 'Acta de secuestro de prueba', pieza: pieza() })).toBe('Acta de secuestro de prueba');
    expect(descripcionDe({ ...base, clase: 'testimonial', persona: { nombre: 'Testigo Uno', cargo: 'Jefe de Compras de prueba' } })).toBe(
      'Testigo Uno, Jefe de Compras de prueba',
    );
  });

  it('ordena como el escrito: por clase y por número jerárquico', () => {
    const items = [
      { clase: 'documental' as const, numero: '10' },
      { clase: 'testimonial' as const, numero: '2' },
      { clase: 'documental' as const, numero: '2 bis' },
      { clase: 'documental' as const, numero: '2' },
    ];
    expect(ordenarItems(items).map((i) => `${i.clase[0]}${i.numero}`)).toEqual(['t2', 'd2', 'd2 bis', 'd10']);
  });

  it('arma el listado por clase, con letras seguidas y sin inventar lo que falta', () => {
    const items: ItemOfrecido[] = [
      { ...base, id: 'a', numero: '1', pieza: pieza(), imputados: ['p1'], ubicacion_fisica: 'Caja 3' },
      { ...base, id: 'b', numero: '2', pieza: pieza({ titulo: 'Remito rechazado de prueba' }), admision: 'rechazada' },
      { ...base, id: 'c', clase: 'testimonial', numero: '1', persona: { nombre: 'Testigo Uno', cargo: 'Tec. de prueba' }, objeto: 'el trámite de la licitación.' },
      { ...base, id: 'd', clase: 'testimonial', numero: '2', persona: { nombre: 'Testigo Dos', cargo: null } },
    ];
    const bloques = contenidoListado(items, new Map([['p1', 'Imputado De Prueba']]), { legajo: '999999', caratula: 'NN S/ PRUEBA', sinRechazadas: true, conUbicacion: false });
    expect(bloques.map((b) => `${b.letra}.- ${b.titulo}`)).toEqual(['A.- TESTIMONIAL', 'B.- DOCUMENTAL']);
    expect(bloques[0].items).toEqual([
      { numero: '1', texto: 'Testigo Uno, Tec. de prueba, quien depondrá sobre el trámite de la licitación', falta: [] },
      { numero: '2', texto: 'Testigo Dos', falta: ['sobre qué declarará'] },
    ]);
    expect(bloques[1].items).toEqual([
      { numero: '1', texto: 'Agenda 2021 de prueba (Efecto Nº 99001, fs. 12, informe C9001). Vinculada a Imputado De Prueba', falta: [] },
    ]);
  });

  it('el listado sale en .docx con el formato de la fiscalía', async () => {
    const bloques = contenidoListado([{ ...base, clase: 'testimonial', persona: { nombre: 'Testigo Dos', cargo: null } }], new Map(), {
      legajo: '999999',
      caratula: 'NN S/ PRUEBA',
      sinRechazadas: false,
      conUbicacion: false,
    });
    const blob = await listadoEnDocx(bloques, { legajo: '999999', caratula: 'NN S/ PRUEBA', sinRechazadas: false, conUbicacion: false });
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
    expect(xml).toContain('OFRECIMIENTO DE PRUEBA');
    expect(xml).toContain('A.- TESTIMONIAL:');
    expect(xml).toContain('[completar: sobre qué declarará]');
    expect(xml).toContain('<w:jc w:val="both"/>');
  });
});
