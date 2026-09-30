// Comparación de nombres de personas y empresas entre planillas y directorio.
// Todo lo que sale de acá es una sugerencia: la persona del equipo confirma.

import { pareceEmpresa } from './etiquetas';

const MARCA_PJ = /\(\s*p\.?\s*j\.?\s*\)|\bpj\b/i;
const MARCA_PH = /\(\s*p\.?\s*h\.?\s*\)|\bph\b/i;

/** Clave para comparar: sin tildes, sin mayúsculas, sin puntuación ni la marca (PJ)/(PH). */
export function claveNombre(t: string): string {
  return t
    .replace(MARCA_PJ, ' ')
    .replace(MARCA_PH, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** Nombre para proponer al cargar: el texto tal cual, sin la marca (PJ)/(PH) ni espacios de más. */
export function nombrePropuesto(t: string): string {
  return t.replace(MARCA_PJ, ' ').replace(MARCA_PH, ' ').replace(/\s+/g, ' ').trim();
}

/** Tipo sugerido: la marca de la planilla manda; si no hay, se adivina por la razón social. */
export function tipoSugerido(t: string): 'fisica' | 'juridica' {
  if (MARCA_PJ.test(t)) return 'juridica';
  if (MARCA_PH.test(t)) return 'fisica';
  return pareceEmpresa(t) ? 'juridica' : 'fisica';
}

/** ¿El texto (un propietario, un tenedor) menciona a esta persona? Coincidencia por nombre, no identidad. */
export function mencionaA(texto: string | null | undefined, clave: string): boolean {
  if (!texto || clave.length < 4) return false;
  const t = ` ${claveNombre(texto)} `;
  return t.includes(` ${clave} `);
}

/** Valores que no son nombres de nadie: guiones, "sin dato", "no consta"… */
export function esNombreVacio(t: string): boolean {
  const c = claveNombre(t);
  return !c || c.length < 3 || /^(s ?d|sin datos?|no consta|desconocido|nn|n n|no|si|ninguno|idem|id)$/.test(c);
}
