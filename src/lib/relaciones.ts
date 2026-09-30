// Grafo de relaciones: quién se vincula con quién y por qué. Una línea por
// par; cada línea guarda sus motivos. Lo cargado por el equipo y lo que sale
// de las ofertas es firme; lo que sale de nombres en las conversaciones es
// una coincidencia a revisar y se dibuja punteado.

import { clavesDePersona, mencionaPersona } from './cronologia';

export type TipoNodo = 'fisica' | 'juridica' | 'contratacion';

export type Nodo = {
  id: string;
  tipo: TipoNodo;
  etiqueta: string;
  detalle: string | null;
  imputado: boolean;
};

export type ClaseMotivo = 'relacion' | 'oferta' | 'adjudicacion' | 'conversacion';

export type Motivo = {
  clase: ClaseMotivo;
  texto: string;
  /** Vínculo cargado por el equipo (se edita o se quita desde la ficha). */
  vinculoId?: string;
  fuente?: string | null;
  /** Conversación de donde sale la coincidencia. */
  conversacionId?: string;
};

export type Arista = {
  id: string;
  a: string;
  b: string;
  motivos: Motivo[];
  /** Solo coincidencias por nombre: se dibuja punteada. */
  porNombre: boolean;
  /** Lo que se escribe sobre la línea. */
  rotulo: string | null;
};

type PersonaEntrada = {
  id: string;
  nombre: string;
  tipo_persona: 'fisica' | 'juridica';
  cargo: string | null;
  roles: { rol: string }[];
  identificadores: { tipo: string; valor: string }[];
};
type VinculoEntrada = { id: string; origen_id: string; destino_id: string; nota: string | null; fuente?: string | null };
type ContratacionEntrada = {
  id: string;
  identificador: string;
  objeto: string | null;
  adjudicatario_id: string | null;
  ofertas: { oferente_id: string | null }[];
};
type ConversacionEntrada = {
  id: string;
  titulo: string;
  participantes: string | null;
  titular_dispositivo: string | null;
  contacto_relevante: string | null;
  agendado_como: string | null;
};

export type Opciones = { contrataciones: boolean; porNombre: boolean };

export type Grafo = { nodos: Nodo[]; aristas: Arista[]; aisladas: number };

const clavePar = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function armarGrafo(
  d: { personas: PersonaEntrada[]; vinculos: VinculoEntrada[]; contrataciones: ContratacionEntrada[]; conversaciones: ConversacionEntrada[] },
  o: Opciones,
): Grafo {
  const personas = new Map(d.personas.map((p) => [p.id, p]));
  const aristas = new Map<string, Arista>();
  const sumar = (a: string, b: string, m: Motivo) => {
    if (a === b) return;
    const k = clavePar(a, b);
    const previa = aristas.get(k) ?? { id: k, a: a < b ? a : b, b: a < b ? b : a, motivos: [], porNombre: true, rotulo: null };
    previa.motivos.push(m);
    aristas.set(k, previa);
  };

  for (const v of d.vinculos) {
    if (!personas.has(v.origen_id) || !personas.has(v.destino_id)) continue;
    sumar(v.origen_id, v.destino_id, { clase: 'relacion', texto: v.nota?.trim() || 'Relacionadas', vinculoId: v.id, fuente: v.fuente ?? null });
  }

  const contrataciones = new Map<string, ContratacionEntrada>();
  if (o.contrataciones) {
    for (const c of d.contrataciones) {
      const oferentes = new Set(c.ofertas.map((x) => x.oferente_id).filter((x): x is string => !!x && personas.has(x)));
      const adjudicatario = c.adjudicatario_id && personas.has(c.adjudicatario_id) ? c.adjudicatario_id : null;
      if (!oferentes.size && !adjudicatario) continue;
      contrataciones.set(c.id, c);
      for (const id of oferentes) {
        if (id !== adjudicatario) sumar(id, c.id, { clase: 'oferta', texto: `Ofertó en ${c.identificador}` });
      }
      if (adjudicatario) sumar(adjudicatario, c.id, { clase: 'adjudicacion', texto: `Adjudicataria de ${c.identificador}` });
    }
  }

  if (o.porNombre) {
    const claves = d.personas.map((p) => ({
      id: p.id,
      claves: clavesDePersona({ nombre: p.nombre, tipo_persona: p.tipo_persona, alias: p.identificadores.filter((i) => i.tipo === 'alias_agendado').map((i) => i.valor) }),
    }));
    for (const c of d.conversaciones) {
      const texto = [c.titulo, c.participantes, c.titular_dispositivo, c.contacto_relevante, c.agendado_como].filter(Boolean).join(' · ');
      const en = claves.filter((p) => mencionaPersona(texto, p.claves)).map((p) => p.id);
      for (let i = 0; i < en.length; i++) {
        for (let j = i + 1; j < en.length; j++) sumar(en[i], en[j], { clase: 'conversacion', texto: `Conversación «${c.titulo}»`, conversacionId: c.id });
      }
    }
  }

  for (const a of aristas.values()) {
    a.porNombre = a.motivos.every((m) => m.clase === 'conversacion');
    const relaciones = a.motivos.filter((m) => m.clase === 'relacion');
    const conversaciones = a.motivos.filter((m) => m.clase === 'conversacion').length;
    if (relaciones.length) a.rotulo = relaciones.map((m) => m.texto).join(' · ');
    else if (a.motivos.some((m) => m.clase === 'adjudicacion')) a.rotulo = 'adjudicataria';
    else if (a.motivos.some((m) => m.clase === 'oferta')) a.rotulo = 'ofertó';
    else a.rotulo = conversaciones > 1 ? `${conversaciones} conversaciones` : null;
  }

  const conectados = new Set<string>();
  for (const a of aristas.values()) {
    conectados.add(a.a);
    conectados.add(a.b);
  }
  const nodos: Nodo[] = [];
  for (const p of d.personas) {
    if (!conectados.has(p.id)) continue;
    nodos.push({ id: p.id, tipo: p.tipo_persona, etiqueta: p.nombre, detalle: p.cargo, imputado: p.roles.some((r) => r.rol === 'imputado') });
  }
  for (const c of contrataciones.values()) {
    if (conectados.has(c.id)) nodos.push({ id: c.id, tipo: 'contratacion', etiqueta: c.identificador, detalle: c.objeto, imputado: false });
  }
  return {
    nodos,
    aristas: [...aristas.values()].sort((x, y) => Number(x.porNombre) - Number(y.porNombre) || x.id.localeCompare(y.id)),
    aisladas: d.personas.length - nodos.filter((n) => n.tipo !== 'contratacion').length,
  };
}

/** Iniciales para el círculo: «Julián Pérez» → «JP»; «Proveedora Ejemplo SRL» → «PE». */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .replace(/\b(s\.?r\.?l|s\.?a\.?s?|srl|sas?)\.?$/i, '')
    .split(/\s+/)
    .filter((w) => /^[\p{L}\d]/u.test(w) && w.length > 1);
  return (palabras.slice(0, 2).map((w) => w[0]).join('') || nombre.slice(0, 2)).toUpperCase();
}

/** Corta el nombre para el rótulo del nodo sin partir palabras cuando se puede. */
export function rotuloCorto(t: string, max = 24): string {
  if (t.length <= max) return t;
  const corte = t.lastIndexOf(' ', max - 1);
  return `${t.slice(0, corte > max * 0.6 ? corte : max - 1)}…`;
}
