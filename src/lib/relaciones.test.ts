import { describe, expect, it } from 'vitest';
import { cruces, disponer, encuadrar } from './disposicion';
import { armarGrafo, iniciales, rotuloCorto } from './relaciones';

const persona = (id: string, nombre: string, extra: Partial<{ tipo_persona: 'fisica' | 'juridica'; rol: string; alias: string }> = {}) => ({
  id,
  nombre,
  tipo_persona: extra.tipo_persona ?? ('fisica' as const),
  cargo: null,
  roles: extra.rol ? [{ rol: extra.rol }] : [],
  identificadores: extra.alias ? [{ tipo: 'alias_agendado', valor: extra.alias }] : [],
});

const datos = {
  personas: [
    persona('a', 'Julián Pérez Prueba', { rol: 'imputado' }),
    persona('b', 'Proveedora Ejemplo SRL', { tipo_persona: 'juridica' }),
    persona('c', 'Marta Gómez Ejemplo', { alias: 'Marti Obra' }),
    persona('d', 'Nadie Conectado'),
  ],
  vinculos: [
    { id: 'v1', origen_id: 'a', destino_id: 'b', nota: 'Socio gerente', fuente: 'Contrato social, efecto 99001' },
    // Un vínculo con una pieza no es una relación entre personas.
    { id: 'v2', origen_id: 'a', destino_id: 'pieza-1', nota: null },
  ],
  contrataciones: [
    { id: 'lp1', identificador: 'LP 01/2099', objeto: 'Bacheo', adjudicatario_id: 'b', ofertas: [{ oferente_id: 'b' }, { oferente_id: null }] },
    { id: 'lp2', identificador: 'LP 02/2099', objeto: null, adjudicatario_id: null, ofertas: [] },
  ],
  conversaciones: [
    { id: 'cv1', titulo: 'Pérez Prueba – Marti Obra', participantes: null, titular_dispositivo: 'Pérez Prueba', contacto_relevante: null, agendado_como: 'Marti Obra' },
    { id: 'cv2', titulo: 'Chat del grupo', participantes: 'Prueba, Gómez Ejemplo', titular_dispositivo: null, contacto_relevante: null, agendado_como: null },
  ],
};

describe('grafo de relaciones', () => {
  it('une lo cargado por el equipo, las ofertas y las conversaciones, una línea por par', () => {
    const g = armarGrafo(datos, { contrataciones: true, porNombre: true });
    expect(g.nodos.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'lp1']);
    expect(g.aisladas).toBe(1);

    const ab = g.aristas.find((x) => x.id === 'a|b')!;
    expect(ab.porNombre).toBe(false);
    expect(ab.rotulo).toBe('Socio gerente');
    expect(ab.motivos[0]).toMatchObject({ clase: 'relacion', vinculoId: 'v1', fuente: 'Contrato social, efecto 99001' });

    const blp = g.aristas.find((x) => x.id === 'b|lp1')!;
    expect(blp.motivos.map((m) => m.clase)).toEqual(['adjudicacion']);
    expect(blp.rotulo).toBe('adjudicataria');

    // Aparecen juntas en dos conversaciones (una por el alias agendado): punteada, a revisar.
    const ac = g.aristas.find((x) => x.id === 'a|c')!;
    expect(ac.porNombre).toBe(true);
    expect(ac.motivos).toHaveLength(2);
    expect(ac.rotulo).toBe('2 conversaciones');
    // Lo firme va primero en la lista.
    expect(g.aristas.at(-1)!.porNombre).toBe(true);
  });

  it('sin contrataciones ni coincidencias, queda solo lo cargado a mano', () => {
    const g = armarGrafo(datos, { contrataciones: false, porNombre: false });
    expect(g.aristas.map((a) => a.id)).toEqual(['a|b']);
    expect(g.nodos.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(g.aisladas).toBe(2);
  });

  it('ubica los nodos sin encimarlos y siempre igual', () => {
    const g = armarGrafo(datos, { contrataciones: true, porNombre: true });
    const p1 = disponer(g.nodos, g.aristas);
    const p2 = disponer(g.nodos, g.aristas);
    expect([...p1.entries()]).toEqual([...p2.entries()]);
    const puntos = [...p1.values()];
    for (let i = 0; i < puntos.length; i++) {
      for (let j = i + 1; j < puntos.length; j++) expect(Math.hypot(puntos[i].x - puntos[j].x, puntos[i].y - puntos[j].y)).toBeGreaterThan(60);
    }
    // El grafo de ejemplo se puede dibujar sin cruzar líneas: la disposición elegida no las cruza.
    expect(cruces(g.aristas, p1)).toBe(0);
    const e = encuadrar(puntos, 800, 600);
    expect(e.k).toBeGreaterThan(0.3);
  });

  it('arma iniciales y rótulos cortos', () => {
    expect(iniciales('Julián Pérez Prueba')).toBe('JP');
    expect(iniciales('Proveedora Ejemplo SRL')).toBe('PE');
    expect(rotuloCorto('Dirección Provincial de Vialidad de Entre Ríos')).toBe('Dirección Provincial de…');
  });
});
