// Clave de orden para números jerárquicos: 2 < 2.1 < 2.2 < 2 bis < 2 ter < 3.
// Es el espejo exacto de public.clave_orden() en la base: si cambia una, cambia la otra.

const SUFIJOS: Record<string, number> = {
  '': 0,
  bis: 2,
  ter: 3,
  quater: 4,
  quinquies: 5,
  sexies: 6,
  septies: 7,
  octies: 8,
  novies: 9,
  decies: 10,
};

export function claveOrden(numero: string | null | undefined): string | null {
  if (numero == null || numero.trim() === '') return null;
  return numero
    .trim()
    .toLowerCase()
    .replaceAll(',', '.')
    .split('.')
    .map((segmento) => {
      const m = /^(\d+)\s*([a-z]*)/.exec(segmento.trim());
      if (!m) return '99999999';
      const n = Math.min(Number(m[1]), 999999);
      const sufijo = SUFIJOS[m[2]] ?? 50;
      return String(n).padStart(6, '0') + String(sufijo).padStart(2, '0');
    })
    .join('');
}

export function compararOrden(a: string | null | undefined, b: string | null | undefined): number {
  const ka = claveOrden(a);
  const kb = claveOrden(b);
  if (ka === kb) return 0;
  if (ka === null) return 1;
  if (kb === null) return -1;
  return ka < kb ? -1 : 1;
}

/** Profundidad para la sangría: "2" → 0, "2.1" → 1, "2.1.3" → 2. */
export function nivelOrden(numero: string | null | undefined): number {
  if (!numero) return 0;
  return Math.max(0, numero.split('.').length - 1);
}
