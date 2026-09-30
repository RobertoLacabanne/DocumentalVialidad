export interface Pigmento {
  nombre: string;
  hex: string;
  gran: number;
  nota: string;
}
export const PIGMENTOS: Record<string, Pigmento>;
export function rgbDe(nombre: string): number[];
