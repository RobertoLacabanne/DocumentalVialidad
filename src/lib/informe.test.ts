import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { armarInforme, fechaDelMensaje, nombreDelInforme, type DatosInforme } from './informe';

// Datos sintéticos: la causa y las personas son inventadas.
const base: DatosInforme = {
  legajo: '999999',
  caratula: 'NN S/ CAUSA DE PRUEBA',
  dispositivo: 'teléfono celular marca Prueba, modelo X',
  efecto: '99001',
  informe: null,
  titular: 'Persona Uno',
  contacto: '3430000001',
  agendado: 'Uno Prueba',
  desde: '2021-04-16',
  hasta: '2021-05-07',
  campoEmisor: 'completar',
  conversaciones: [
    {
      titulo: 'Conversación entre Persona Uno y Persona Dos',
      mensajes: [
        {
          fecha: '2021-04-16', fecha_texto: '16/04/21', emisor: 'Persona Dos', receptor: 'Persona Uno',
          contenido: 'Precio & plazo, "literal"\nsegunda línea', observacion: 'Menciona la cotización.',
          vinculos: ['LP 99/2020 (Expte. 999999)'],
        },
        { fecha: null, fecha_texto: null, emisor: 'Persona Uno', receptor: 'Persona Dos', contenido: 'Sin fecha' },
      ],
    },
  ],
};

async function xml(d: DatosInforme) {
  const { Packer } = await import('docx');
  const zip = unzipSync(new Uint8Array(await Packer.toBuffer(await armarInforme(d))));
  return { documento: strFromU8(zip['word/document.xml']), estilos: strFromU8(zip['word/styles.xml']) };
}
const entidades: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const soloTexto = (x: string) =>
  [...x.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((p) =>
    [...p[0].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:br\/>/g)]
      .map((t) => (t[1] === undefined ? '\n' : t[1].replace(/&\w+;/g, (e) => entidades[e] ?? e)))
      .join(''),
  );

describe('informe de relevamiento de mensajes', () => {
  it('respeta el formato de la fiscalía: Palatino 11, justificado, interlineado 1,5, A4', async () => {
    const { documento, estilos } = await xml(base);
    expect(estilos).toContain('w:ascii="Palatino Linotype"');
    expect(estilos).toMatch(/<w:sz w:val="22"\/>/);
    expect(documento).toContain('<w:jc w:val="both"/>');
    expect(documento).toMatch(/<w:spacing [^>]*w:line="360"/);
    expect(documento).toMatch(/<w:pgSz w:w="11906" w:h="16838"/);
  });

  it('sigue el texto de la plantilla y marca lo que falta sin inventarlo', async () => {
    const parrafos = soloTexto((await xml(base)).documento);
    expect(parrafos[0]).toBe('Ref.: Legajo N.º 999999, caratulado: “NN S/ CAUSA DE PRUEBA”');
    expect(parrafos[1]).toBe('INFORME DE RELEVAMIENTO DE MENSAJES');
    expect(parrafos[2]).toContain('registrado bajo el número de efecto 99001, cuya información se extrajo mediante el informe de extracción forense [completar: número de informe] del Gabinete');
    expect(parrafos[3]).toBe(
      'El teléfono analizado pertenece a Persona Uno, y posee como relevante las conversaciones con el número telefónico 3430000001, el cual se encontraba agendado como Uno Prueba en el periodo comprendido entre 16/04/2021 y 07/05/2021.',
    );
    expect(parrafos[4]).toBe('TRANSCRIPCIÓN DE LOS MENSAJES');
    expect(parrafos[5]).toBe('1. Conversación entre Persona Uno y Persona Dos');
  });

  it('copia el mensaje literal y arma cada bloque como la plantilla', async () => {
    const parrafos = soloTexto((await xml(base)).documento);
    expect(parrafos.slice(6, 12)).toEqual([
      'Fecha: 16/04/2021',
      'Emisor: [completar: emisor]',
      'Remitente: Persona Dos',
      'Mensaje: Precio & plazo, "literal"\nsegunda línea',
      'OBSERVACIONES: Menciona la cotización.\nSe vincula con: LP 99/2020 (Expte. 999999).',
      '-'.repeat(88),
    ]);
    expect(parrafos.slice(12, 16)).toEqual([
      'Fecha: [completar: fecha]',
      'Emisor: [completar: emisor]',
      'Remitente: Persona Uno',
      'Mensaje: Sin fecha',
    ]);
  });

  it('el rótulo «Emisor» se completa solo si se elige qué va ahí', async () => {
    const recibe = soloTexto((await xml({ ...base, campoEmisor: 'recibe' })).documento);
    expect(recibe[7]).toBe('Emisor: Persona Uno');
    const envia = soloTexto((await xml({ ...base, campoEmisor: 'envia' })).documento);
    expect(envia[7]).toBe('Emisor: Persona Dos');
  });

  it('agrega la hora cuando la transcripción la trae', () => {
    expect(fechaDelMensaje({ fecha: '2025-02-18', fecha_texto: '18/02/25 19:58 hs.', contenido: '' })).toBe('18/02/2025, 19:58 hs.');
    expect(fechaDelMensaje({ fecha: null, fecha_texto: 'entre marzo y abril', contenido: '' })).toBe('entre marzo y abril');
    expect(nombreDelInforme(base)).toBe('Informe de relevamiento de mensajes - Efecto 99001.docx');
  });
});
