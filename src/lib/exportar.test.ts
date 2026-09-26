import { describe, expect, it } from 'vitest';
import { aCsv } from './exportar';

describe('exportación a CSV', () => {
  it('usa punto y coma, BOM y escapa comillas, saltos y separadores', () => {
    const csv = aCsv(
      [{ n: '19', t: 'Agenda "2021"; manuscrita', f: null }],
      [
        { titulo: 'Nº', valor: (x) => x.n },
        { titulo: 'Título', valor: (x) => x.t },
        { titulo: 'Fojas', valor: (x) => x.f },
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Nº;Título;Fojas\r\n19;"Agenda ""2021""; manuscrita";');
  });
});
