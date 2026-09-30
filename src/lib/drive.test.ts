import { describe, expect, it } from 'vitest';
import { esCarpetaDeDrive, esUrlValida, idDeDrive } from './drive';

describe('links de Drive', () => {
  it('saca el ID de un archivo, una carpeta o un documento', () => {
    expect(idDeDrive('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')).toBe('1AbCdEfGhIjKlMnOp');
    expect(idDeDrive('https://drive.google.com/drive/folders/0BxYz_123456789ab')).toBe('0BxYz_123456789ab');
    expect(idDeDrive('https://drive.google.com/open?id=1QwErTyUiOpAsDfGh')).toBe('1QwErTyUiOpAsDfGh');
    expect(idDeDrive('https://docs.google.com/document/d/1ZxCvBnMaSdFgHjKl/edit')).toBe('1ZxCvBnMaSdFgHjKl');
    expect(idDeDrive('https://ejemplo.com/archivo.pdf')).toBeNull();
  });

  it('valida links y reconoce carpetas', () => {
    expect(esUrlValida('https://drive.google.com/x')).toBe(true);
    expect(esUrlValida('drive.google.com/x')).toBe(false);
    expect(esCarpetaDeDrive('https://drive.google.com/drive/folders/abc')).toBe(true);
  });
});
