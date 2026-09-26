import { describe, expect, it } from 'vitest';
import { chatAConversacion, detectarReporte, fechaISODe, leerReporteUfed, mapeoDeEncabezado } from './ufed';

// Una exportación sintética con la forma habitual: título arriba, encabezados en la
// segunda fila y las columnas del chat solo en su primera fila (celdas combinadas).
const hojaChats = {
  nombre: 'Chats',
  filas: [
    ['Chats (2)'],
    ['#', 'Chat #', 'Participants', 'Source', 'Instant Message #', 'From', 'To', 'Body', 'Timestamp: Date', 'Timestamp: Time', 'Attachment #1'],
    [1, 1, 'Ficticio, Muestra', 'WhatsApp', 1, 'Ficticio', 'Muestra', 'Hoy te llega la invitación, arreglá la cotización', '16/04/2021', '10:23:45(UTC-3)', null],
    [2, null, null, null, 2, 'Muestra', 'Ficticio', 'Dale, lo coordinamos entre los tres', '16/04/2021', '10:25:01(UTC-3)', null],
    [3, null, null, null, 3, 'Ficticio', 'Muestra', null, '04/05/2021', '19:58:00(UTC-3)', 'IMG-20210504-WA0003.jpg'],
    [4, null, null, null, null, null, null, null, null, null, null],
    [5, 2, 'Ficticio, Otro', 'SMS', 1, 'Otro', 'Ficticio', 'Llamame cuando puedas\nes urgente', '20/05/2021', '08:00:00', null],
  ],
};

describe('reportes de UFED', () => {
  it('reconoce las columnas en inglés y en castellano', () => {
    expect(mapeoDeEncabezado(['#', 'Chat #', 'From', 'To', 'Body', 'Timestamp: Date', 'Timestamp: Time'])).toMatchObject({ chat: 1, emisor: 2, receptor: 3, cuerpo: 4, fecha: 5, hora: 6 });
    expect(mapeoDeEncabezado(['N° de chat', 'De', 'Para', 'Mensaje', 'Marca de tiempo', 'Aplicación'])).toMatchObject({ chat: 0, emisor: 1, receptor: 2, cuerpo: 3, fecha_hora: 4, aplicacion: 5 });
  });

  it('encuentra la hoja y la fila de encabezados aunque haya un título arriba', () => {
    const r = detectarReporte([{ nombre: 'Resumen', filas: [['Informe'], ['Dispositivo', 'Modelo']] }, hojaChats]);
    expect(r).toMatchObject({ hoja: 'Chats', encabezado: 1 });
  });

  it('agrupa por chat, arrastra los datos del chat y conserva el texto literal', () => {
    const r = leerReporteUfed([hojaChats]);
    expect(r.chats.map((c) => [c.titulo, c.mensajes.length, c.desde, c.hasta])).toEqual([
      ['WhatsApp · Ficticio, Muestra', 3, '2021-04-16', '2021-05-04'],
      ['SMS · Ficticio, Otro', 1, '2021-05-20', '2021-05-20'],
    ]);
    const [primero, , adjunto] = r.chats[0].mensajes;
    expect(primero).toMatchObject({ linea: 3, emisor: 'Ficticio', receptor: 'Muestra', fecha: '2021-04-16', fecha_texto: '16/04/2021 10:23:45(UTC-3)', tipo: 'texto' });
    expect(adjunto).toMatchObject({ tipo: 'imagen', contenido: '[adjunto: IMG-20210504-WA0003.jpg]' });
    expect(r.chats[1].mensajes[0].contenido).toBe('Llamame cuando puedas\nes urgente');
    expect(r.omitidas).toEqual([expect.objectContaining({ linea: 6 })]);
    expect(r.avisos).toEqual([]);
  });

  it('no adivina el orden de las fechas: si es ambiguo, avisa', () => {
    const ambigua = { nombre: 'Chats', filas: [['From', 'Body', 'Date'], ['A', 'hola', '03/04/2021']] };
    const r = leerReporteUfed([ambigua]);
    expect(r.avisos[0]).toMatch(/día\/mes o mes\/día/);
    expect(r.chats[0].mensajes[0].fecha).toBe('2021-04-03');
    expect(fechaISODe('5/13/2025 10:23:45 AM', 'md')).toBe('2025-05-13');
    expect(fechaISODe('2025-05-13 10:23', 'dm')).toBe('2025-05-13');
    expect(fechaISODe('31/02/2025', 'dm')).toBeUndefined();
  });

  it('respeta el mapeo que elige la persona', () => {
    const rara = { nombre: 'Hoja1', filas: [['Quién', 'Qué dijo', 'Cuándo'], ['Ficticio', 'texto de prueba', '16/04/2021']] };
    expect(() => leerReporteUfed([rara])).toThrow(/Body/);
    const r = leerReporteUfed([rara], { hoja: 'Hoja1', encabezado: 0, mapeo: { emisor: 0, cuerpo: 1, fecha: 2 } });
    expect(r.chats[0].mensajes[0]).toMatchObject({ emisor: 'Ficticio', contenido: 'texto de prueba', fecha: '2021-04-16' });
  });

  it('arma la conversación para el asistente', () => {
    const r = leerReporteUfed([hojaChats]);
    const c = chatAConversacion(r.chats[0], r);
    expect(c).toMatchObject({ titulo: 'WhatsApp · Ficticio, Muestra', participantes: 'Ficticio, Muestra', nombres: ['Ficticio', 'Muestra'], periodo_desde: '2021-04-16' });
  });
});
