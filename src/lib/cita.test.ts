import { describe, expect, it } from 'vitest';
import { armarCita } from './cita';

describe('cita estándar', () => {
  it('arma la cita del ejemplo del prompt', () => {
    expect(
      armarCita(null, {
        efecto: '48435',
        titulo: 'Agenda 2021',
        sobre: '3',
        fojas: '12/14',
        informe: 'C6855',
        numero: '19',
      }),
    ).toBe('Efecto Nº 48435 – Agenda 2021 (Sobre Nº 3), fs. 12/14, informe C6855, pieza Nº 19');
  });

  it('marca lo que falta en lugar de inventarlo', () => {
    expect(armarCita(null, { efecto: '48435', titulo: 'Agenda 2021', informe: 'C6855', numero: '19' })).toBe(
      'Efecto Nº 48435 – Agenda 2021 (Sobre Nº [completar]), fs. [completar], informe C6855, pieza Nº 19',
    );
  });

  it('respeta un formato propio de la causa', () => {
    expect(armarCita('{titulo}, fs. {fojas}', { titulo: 'Acta', fojas: '' })).toBe('Acta, fs. [completar]');
  });
});
