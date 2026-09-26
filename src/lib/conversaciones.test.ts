import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { leerTranscripcion, prepararTexto, textoDeDocx } from './conversaciones';

// Transcripciones sintéticas con la misma forma que las del equipo (personas y datos inventados).
const rotulada = `CONVERSACIÓN DE WHATSAPP - 3430000001
Legajo N.° 999.999
Remitentes: Pérez - Gómez

16/04/21
Remitente: Pérez
Mensaje: Mañana te llega la cotización de prueba.
Y también te pido otro presupuesto para que acompañe
Remitente: Gómez
Mensaje: [AUDIO] Dale, yo me encargo (...)
04/12/21 sábado
(al otro día)
Remitente: Gómez 19:58 hs.
Mensaje: Paso en 5
Mensaje: [IMAGEN] le envía una imagen de un presupuesto
Remitente: Gomez123
Mensaje: Ok perfecto
02/12/22[^3]
Remitente: Pérez
Mensaje: Esa la ganaste compitiendo[^1], acordate
[^1]: Nota sintética uno.
[^3]: Nota sintética tres.`;

const libre = `CONVERSACIÓN DE WHATSAPP
Legajo N.° 999.999
Remitentes: Ruiz - Luna
importante: Luna figura agendado como “Luna Hormigones Prueba”. Nota sintética del analista.
______________________
Luna.
(...)Dale, está todo aprobado ya.
Ruiz 28/02/25
AUDIO Hola Luna, ¿hubo novedad del pago?
Luna:
Buen día
Te paso lo que me dijeron
Mensaje reenviado: Ya tiene la reserva
Imagen reenviada:
Audio luna: Ahora está en la parte jurídica
Ruiz:
AUDIO
¿Y eso cuánto demorará?
Audio Ruiz
Si hay que pagar la multa, que la paguen
11/03/2025
Luna:
Al día siguiente, el 12/03/25 Luna le avisa a Ruiz que el pago ya fue realizado:
Mensaje: Me avisaron que transfirieron hoy, avisame si está todo bien.
------------------------------------
12/03/25
Remitente: Luna
Mensaje: Me avisaron que transfirieron hoy, avisame si está todo bien.
Mensaje: Quedó pendiente:
- 7 unidades de prueba
- lo que sume el detalle`;

describe('leerTranscripcion: formato con rótulos', () => {
  const c = leerTranscripcion(rotulada);

  it('lee participantes, número y título desde el encabezado', () => {
    expect(c.nombres).toEqual(['Pérez', 'Gómez']);
    expect(c.contacto_relevante).toBe('3430000001');
    expect(c.titulo).toBe('Conversación entre Pérez y Gómez');
  });

  it('copia el texto tal cual y une las líneas sin rótulo al mensaje de arriba', () => {
    expect(c.mensajes[0]).toMatchObject({
      emisor: 'Pérez', receptor: 'Gómez', fecha: '2021-04-16', fecha_texto: '16/04/21', tipo: 'texto',
      contenido: 'Mañana te llega la cotización de prueba.\nY también te pido otro presupuesto para que acompañe',
    });
    expect(c.mensajes[1]).toMatchObject({ tipo: 'audio_transcripto', contenido: '[AUDIO] Dale, yo me encargo (...)' });
  });

  it('toma el día de la semana y la hora sin inventar nada', () => {
    expect(c.mensajes[2]).toMatchObject({ emisor: 'Gómez', fecha: '2021-12-04', fecha_texto: '04/12/21 sábado 19:58 hs.' });
    expect(c.mensajes[3].tipo).toBe('imagen');
    expect(c.omitidas).toEqual([{ linea: 12, texto: '(al otro día)', motivo: 'Nota entre paréntesis del analista.' }]);
  });

  it('avisa cuando un remitente no figura entre los participantes, sin corregirlo solo', () => {
    expect(c.mensajes[4].emisor).toBe('Gomez123');
    expect(c.mensajes[4].receptor).toBeUndefined();
    expect(c.avisos.some((a) => a.includes('«Gomez123» no figura'))).toBe(true);
  });

  it('pasa las notas al pie a la observación del mensaje y las saca del texto', () => {
    const m = c.mensajes[5];
    expect(m.contenido).toBe('Esa la ganaste compitiendo, acordate');
    expect(m.observacion).toBe('Nota al pie de la transcripción: Nota sintética tres.\nNota al pie de la transcripción: Nota sintética uno.');
    expect(c.periodo_desde).toBe('2021-04-16');
    expect(c.periodo_hasta).toBe('2022-12-02');
  });
});

describe('leerTranscripcion: formato libre', () => {
  const c = leerTranscripcion(libre);
  const textos = c.mensajes.map((m) => [m.emisor, m.tipo, m.contenido]);

  it('toma el agendado del encabezado y deja las notas como observaciones de la conversación', () => {
    expect(c.agendado_como).toBe('Luna Hormigones Prueba');
    expect(c.observaciones).toContain('Nota sintética del analista');
  });

  it('reconoce nombres con dos puntos, con punto, con fecha y los audios de cada uno', () => {
    expect(textos.slice(0, 9)).toEqual([
      ['Luna', 'texto', '(...)Dale, está todo aprobado ya.'],
      ['Ruiz', 'audio_transcripto', 'AUDIO Hola Luna, ¿hubo novedad del pago?'],
      ['Luna', 'texto', 'Buen día'],
      ['Luna', 'texto', 'Te paso lo que me dijeron'],
      ['Luna', 'texto', 'Mensaje reenviado: Ya tiene la reserva'],
      ['Luna', 'imagen', 'Imagen reenviada:'],
      ['Luna', 'audio_transcripto', 'Ahora está en la parte jurídica'],
      ['Ruiz', 'audio_transcripto', '¿Y eso cuánto demorará?'],
      ['Ruiz', 'audio_transcripto', 'Si hay que pagar la multa, que la paguen'],
    ]);
    expect(c.mensajes[1]).toMatchObject({ fecha: '2025-02-28', receptor: 'Luna' });
  });

  it('destilda lo que parece una nota del analista y avisa los mensajes repetidos', () => {
    const nota = c.mensajes.find((m) => m.contenido.startsWith('Al día siguiente'))!;
    expect(nota).toMatchObject({ incluir: false, aviso: 'Parece una nota del analista, no un mensaje.' });
    const repetido = c.mensajes.filter((m) => m.contenido.startsWith('Me avisaron'));
    expect(repetido).toHaveLength(2);
    expect(repetido[1].aviso).toMatch(/^Mismo texto que el mensaje de la línea \d+/);
    expect(repetido[1].fecha).toBe('2025-03-12');
  });

  it('las viñetas continúan el mensaje', () => {
    expect(c.mensajes[c.mensajes.length - 1].contenido).toBe('Quedó pendiente:\n- 7 unidades de prueba\n- lo que sume el detalle');
  });
});

describe('exportación de WhatsApp y texto de Drive', () => {
  it('lee el .txt que exporta WhatsApp, con hora', () => {
    const c = leerTranscripcion('11/3/25, 10:35 - Persona Uno: Hola\n11/3/25, 10:36 - Persona Dos: Qué tal\nsegunda línea');
    expect(c.mensajes.map((m) => [m.fecha, m.fecha_texto, m.emisor, m.contenido])).toEqual([
      ['2025-03-11', '11/3/25 10:35', 'Persona Uno', 'Hola'],
      ['2025-03-11', '11/3/25 10:36', 'Persona Dos', 'Qué tal\nsegunda línea'],
    ]);
  });

  it('limpia los escapes del texto de Drive y ubica las notas al pie finales', () => {
    expect(prepararTexto('Mensaje: \\[AUDIO\\] Todo bien\\! lucha [1](#footnote1)\n\n1 Nota final')).toEqual([
      'Mensaje: [AUDIO] Todo bien! lucha [^1]',
      '',
      '[^1]: Nota final',
    ]);
  });
});

describe('textoDeDocx', () => {
  it('saca el texto de los párrafos y las notas al pie de un .docx', async () => {
    const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const documento = `<?xml version="1.0"?><w:document ${w}><w:body>
      <w:p><w:r><w:t>Remitentes: Pérez - Gómez</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">Mensaje: Precio &amp; plazo </w:t></w:r><w:r><w:footnoteReference w:id="2"/></w:r><w:r><w:t>, dale</w:t></w:r></w:p>
      <w:p/>
      <w:p><w:r><w:t>línea uno</w:t><w:br/><w:t>línea dos</w:t></w:r></w:p>
    </w:body></w:document>`;
    const notas = `<?xml version="1.0"?><w:footnotes ${w}>
      <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
      <w:footnote w:id="2"><w:p><w:r><w:t>Aclaración del analista.</w:t></w:r></w:p></w:footnote>
    </w:footnotes>`;
    const zip = zipSync({ 'word/document.xml': strToU8(documento), 'word/footnotes.xml': strToU8(notas) });
    expect((await textoDeDocx(zip)).split('\n')).toEqual([
      'Remitentes: Pérez - Gómez',
      'Mensaje: Precio & plazo [^2], dale',
      '',
      'línea uno',
      'línea dos',
      '[^2]: Aclaración del analista.',
    ]);
  });

  it('rechaza un archivo que no es .docx', async () => {
    await expect(textoDeDocx(strToU8('hola'))).rejects.toThrow(/no es un .docx válido/);
  });
});
