// Links de Google Drive: se guarda el link tal cual y, si se puede, el ID del archivo.
// El nombre del archivo NO se puede leer sin permiso de Drive: queda para el selector de Google.

export function idDeDrive(url: string): string | null {
  const patrones = [/\/file\/d\/([\w-]{10,})/, /\/folders\/([\w-]{10,})/, /[?&]id=([\w-]{10,})/, /\/document\/d\/([\w-]{10,})/, /\/spreadsheets\/d\/([\w-]{10,})/];
  for (const p of patrones) {
    const m = p.exec(url);
    if (m) return m[1];
  }
  return null;
}

export function esUrlValida(texto: string): boolean {
  try {
    const u = new URL(texto.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function esCarpetaDeDrive(url: string): boolean {
  return /\/folders\//.test(url);
}
