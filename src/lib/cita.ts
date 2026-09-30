// Cita estándar para copiar y pegar en escritos. El formato es configurable
// por causa (causa.formato_cita). Lo que falta se marca como [completar]:
// la cita nunca inventa un dato.

export const FORMATO_CITA_POR_DEFECTO =
  'Efecto Nº {efecto} – {titulo} (Sobre Nº {sobre}), fs. {fojas}, informe {informe}, pieza Nº {numero}';

export const MARCADOR_FALTA = '[completar]';

export type DatosCita = {
  efecto?: string | null;
  titulo?: string | null;
  sobre?: string | null;
  fojas?: string | null;
  informe?: string | null;
  numero?: string | null;
  fecha?: string | null;
  autor?: string | null;
};

export function armarCita(formato: string | null | undefined, datos: DatosCita): string {
  const plantilla = formato && formato.trim() !== '' ? formato : FORMATO_CITA_POR_DEFECTO;
  return plantilla.replace(/\{(\w+)\}/g, (_, clave: string) => {
    const valor = datos[clave as keyof DatosCita];
    return valor != null && String(valor).trim() !== '' ? String(valor).trim() : MARCADOR_FALTA;
  });
}
