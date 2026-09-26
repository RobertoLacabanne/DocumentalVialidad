import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, FileText, FileUp, Info, RotateCcw, TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Boton, clasesBoton } from '../componentes/Boton';
import { AreaTexto, Entrada, Selector } from '../componentes/campos';
import { AvisoError } from '../componentes/estados';
import { MarcaSugerencia } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useEfectos } from '../datos/causa';
import { useConversaciones } from '../datos/hechos';
import { traducirError } from '../datos/guardado';
import { normalizar } from '../lib/importacion';
import { leerTranscripcion, separarNombres, textoDeDocx, type ConversacionLeida, type MensajeLeido } from '../lib/conversaciones';
import { supabase } from '../lib/supabase';
import { CabeceraCausa } from './CabeceraCausa';
import { TIPO_MENSAJE } from './FichaMensaje';
import { Bloque, Cifra } from './Importar';
import { useCausaActual } from './Marco';
import s from './Importar.module.css';
import h from './ImportarHechos.module.css';
import si from './Indice.module.css';

type Paso = 'transcripcion' | 'revision' | 'hecho';
type Cabecera = {
  titulo: string;
  participantes: string;
  titular_dispositivo: string;
  contacto_relevante: string;
  agendado_como: string;
  efecto_id: string;
  periodo_desde: string;
  periodo_hasta: string;
  observaciones: string;
};

const PASOS: { valor: Paso; etiqueta: string }[] = [
  { valor: 'transcripcion', etiqueta: 'Transcripción' },
  { valor: 'revision', etiqueta: 'Revisión' },
  { valor: 'hecho', etiqueta: 'Listo' },
];

export function ImportarConversacion() {
  const { causa } = useCausaActual();
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { filas: efectos } = useEfectos(causa.id);
  const { filas: existentes } = useConversaciones(causa.id);
  const [paso, setPaso] = useState<Paso>('transcripcion');
  const [archivo, setArchivo] = useState<string | null>(null);
  const [pegado, setPegado] = useState('');
  const [leida, setLeida] = useState<ConversacionLeida | null>(null);
  const [mensajes, setMensajes] = useState<MensajeLeido[]>([]);
  const [cabecera, setCabecera] = useState<Cabecera | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ conversacion: string; mensajes: number } | null>(null);
  const selector = useRef<HTMLInputElement>(null);

  function preparar(texto: string, nombre: string) {
    const c = leerTranscripcion(texto);
    if (!c.mensajes.length) throw new Error('No encontramos mensajes. Fijate que el texto tenga líneas como «Remitente: …» y «Mensaje: …», o «Nombre:» seguido del texto.');
    setArchivo(nombre);
    setLeida(c);
    setMensajes(c.mensajes);
    setCabecera({
      titulo: c.titulo,
      participantes: c.participantes ?? '',
      titular_dispositivo: '',
      contacto_relevante: c.contacto_relevante ?? '',
      agendado_como: c.agendado_como ?? '',
      efecto_id: '',
      periodo_desde: c.periodo_desde ?? '',
      periodo_hasta: c.periodo_hasta ?? '',
      observaciones: c.observaciones ?? '',
    });
    setPaso('revision');
  }

  async function elegir(file: File | undefined) {
    if (!file) return;
    setLeyendo(true);
    setError(null);
    try {
      let texto: string;
      if (/\.docx$/i.test(file.name)) texto = await textoDeDocx(await file.arrayBuffer());
      else if (/\.txt$/i.test(file.name)) texto = await file.text();
      else throw new Error('Tiene que ser un .docx o un .txt. Si es un documento de Google: Archivo → Descargar → Microsoft Word (.docx).');
      preparar(texto, file.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  function leerPegado() {
    setError(null);
    try {
      preparar(pegado, `Texto pegado el ${new Date().toLocaleDateString('es-AR')}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setEncima(false);
    void elegir(e.dataTransfer.files[0]);
  }

  const nombres = useMemo(() => (cabecera?.participantes ? separarNombres(cabecera.participantes) : []), [cabecera?.participantes]);
  const incluidos = mensajes.filter((m) => m.incluir);
  const cambiarMensaje = (orden: number, cambio: Partial<MensajeLeido>) => setMensajes((l) => l.map((m) => (m.orden === orden ? { ...m, ...cambio } : m)));
  const cambiarCabecera = (k: keyof Cabecera, v: string) => setCabecera((c) => (c ? { ...c, [k]: v } : c));

  async function importar() {
    if (!leida || !cabecera || !archivo) return;
    if (!cabecera.titulo.trim()) {
      avisar('Poné un título a la conversación.', { tono: 'aviso' });
      return;
    }
    setImportando(true);
    const vacio = (t: string) => t.trim() || null;
    const { data, error: err } = await supabase.rpc('importar_conversacion', {
      p_causa: causa.id,
      p_archivo: archivo,
      p_datos: {
        titulo: cabecera.titulo.trim(),
        participantes: vacio(cabecera.participantes),
        titular_dispositivo: vacio(cabecera.titular_dispositivo),
        contacto_relevante: vacio(cabecera.contacto_relevante),
        agendado_como: vacio(cabecera.agendado_como),
        efecto_id: vacio(cabecera.efecto_id),
        periodo_desde: vacio(cabecera.periodo_desde),
        periodo_hasta: vacio(cabecera.periodo_hasta),
        observaciones: vacio(cabecera.observaciones),
        lineas_origen: mensajes.length + leida.omitidas.length,
        mensajes: incluidos.map((m, i) => {
          const otro = nombres.length === 2 && m.emisor && nombres.includes(m.emisor) ? nombres.find((n) => n !== m.emisor) : undefined;
          return {
            orden: i + 1,
            linea: m.linea,
            fecha: m.fecha ?? null,
            fecha_texto: m.fecha_texto ?? null,
            emisor: m.emisor ?? null,
            receptor: otro ?? (nombres.length === 2 ? null : (m.receptor ?? null)),
            tipo: m.tipo,
            contenido: m.contenido,
            observacion: m.observacion ?? null,
          };
        }),
      },
    });
    setImportando(false);
    if (err) {
      avisar(`No se importó nada: ${traducirError(err.message)}`, { tono: 'error', duracion: 9000 });
      return;
    }
    setResultado(data as { conversacion: string; mensajes: number });
    setPaso('hecho');
    for (const k of ['conversaciones', 'conversaciones-resumen']) void qc.invalidateQueries({ queryKey: [k, causa.id] });
  }

  function reiniciar() {
    setPaso('transcripcion');
    setArchivo(null);
    setLeida(null);
    setMensajes([]);
    setCabecera(null);
    setResultado(null);
    setError(null);
    setPegado('');
    if (selector.current) selector.current.value = '';
  }

  const indicePaso = PASOS.findIndex((p) => p.valor === paso);
  const conAviso = mensajes.filter((m) => m.aviso);
  const parecida = cabecera
    ? existentes.find(
        (c) => normalizar(c.titulo) === normalizar(cabecera.titulo) || (archivo && (c.origen as { archivo?: string } | null)?.archivo === archivo),
      )
    : undefined;

  return (
    <div className={s.pantalla}>
      <CabeceraCausa causa={causa} />
      <div className={s.cuerpo}>
        <div className={s.encabezado}>
          <Link to="../mensajes" relative="path" className={s.volver}>
            <ArrowLeft aria-hidden /> Mensajes
          </Link>
          <h2 className={si.titulo}>Importar una conversación</h2>
          <p className={si.bajada}>Desde la transcripción del equipo (.docx) o el texto que exporta WhatsApp. El texto de cada mensaje se guarda literal y después no se puede editar.</p>
        </div>

        <ol className={s.pasos} aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p.valor} className={`${s.paso} ${i < indicePaso ? s.pasoHecho : ''} ${i === indicePaso ? s.pasoActual : ''}`} aria-current={i === indicePaso ? 'step' : undefined}>
              <span className={s.pasoNumero}>{i < indicePaso ? <Check aria-hidden /> : i + 1}</span>
              {p.etiqueta}
            </li>
          ))}
        </ol>

        {paso === 'transcripcion' && (
          <section className={s.tarjeta}>
            <label
              className={`${s.zona} ${encima ? s.zonaEncima : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setEncima(true);
              }}
              onDragLeave={() => setEncima(false)}
              onDrop={soltar}
            >
              <input ref={selector} type="file" accept=".docx,.txt" className="visualmente-oculto" onChange={(e) => void elegir(e.target.files?.[0])} />
              <span className={s.zonaIcono}>
                <FileUp aria-hidden />
              </span>
              <strong>{leyendo ? 'Leyendo la transcripción…' : 'Arrastrá el .docx acá o hacé clic para elegirlo'}</strong>
              <span className={s.tenue}>Word (.docx) o texto (.txt). Si es un documento de Google: Archivo → Descargar → Microsoft Word.</span>
            </label>
            <div className={h.o}>o</div>
            <div className={h.pegar}>
              <AreaTexto etiqueta="Pegá el texto de la conversación" value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder={'16/04/21\nRemitente: …\nMensaje: …'} />
              <div>
                <Boton icono={<FileText aria-hidden />} disabled={!pegado.trim()} onClick={leerPegado}>
                  Leer el texto pegado
                </Boton>
              </div>
            </div>
            {error && <AvisoError titulo="No pudimos leer la transcripción">{error}</AvisoError>}
          </section>
        )}

        {paso === 'revision' && leida && cabecera && (
          <section className={s.tarjeta}>
            <div className={s.archivo}>
              <FileText aria-hidden />
              <div>
                <strong>{archivo}</strong>
                <span className={s.tenue}>
                  {mensajes.length} {mensajes.length === 1 ? 'mensaje detectado' : 'mensajes detectados'} · {leida.omitidas.length}{' '}
                  {leida.omitidas.length === 1 ? 'línea que no es un mensaje' : 'líneas que no son mensajes'}
                </span>
              </div>
              <Boton tamano="chico" variante="fantasma" icono={<RotateCcw aria-hidden />} onClick={reiniciar}>
                Elegir otra
              </Boton>
            </div>

            <div className={h.datos}>
              <div className={h.datosAncho}>
                <Entrada etiqueta="Título" value={cabecera.titulo} onChange={(e) => cambiarCabecera('titulo', e.target.value)} ayuda="En el informe: «1. Conversación entre … y …»" required />
              </div>
              <Entrada etiqueta="Participantes" value={cabecera.participantes} onChange={(e) => cambiarCabecera('participantes', e.target.value)} ayuda="Separados por guion: «Gervasoni - Meynet»" />
              <Entrada etiqueta="Número de la conversación" value={cabecera.contacto_relevante} onChange={(e) => cambiarCabecera('contacto_relevante', e.target.value)} />
              <Entrada etiqueta="Agendado como" value={cabecera.agendado_como} onChange={(e) => cambiarCabecera('agendado_como', e.target.value)} />
              <Selector etiqueta="Efecto (teléfono)" value={cabecera.efecto_id} onChange={(e) => cambiarCabecera('efecto_id', e.target.value)}>
                <option value="">Sin definir por ahora</option>
                {[...efectos]
                  .sort((a, b) => Number(b.soporte === 'digital') - Number(a.soporte === 'digital'))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      Nº {e.numero}
                      {e.descripcion_acta ? ` · ${e.descripcion_acta.slice(0, 50)}` : ''}
                    </option>
                  ))}
              </Selector>
              <Entrada etiqueta="Titular del teléfono" value={cabecera.titular_dispositivo} onChange={(e) => cambiarCabecera('titular_dispositivo', e.target.value)} />
              <Entrada etiqueta="Período desde" type="date" value={cabecera.periodo_desde} onChange={(e) => cambiarCabecera('periodo_desde', e.target.value)} />
              <Entrada etiqueta="Período hasta" type="date" value={cabecera.periodo_hasta} onChange={(e) => cambiarCabecera('periodo_hasta', e.target.value)} />
              <div className={h.datosAncho}>
                <AreaTexto etiqueta="Notas del encabezado (del analista)" rows={2} value={cabecera.observaciones} onChange={(e) => cambiarCabecera('observaciones', e.target.value)} />
              </div>
            </div>
            {(leida.agendado_como || leida.contacto_relevante || leida.periodo_desde) && (
              <p className={h.origen}>
                <MarcaSugerencia>tomado del encabezado y de las fechas · revisalo</MarcaSugerencia>
              </p>
            )}

            <div className={s.balance}>
              <div className={s.balanceTotal}>
                <span className="cifras">{mensajes.length}</span>
                mensajes detectados
              </div>
              <div className={s.balanceDetalle}>
                <Cifra valor={incluidos.length} texto="se importan" tono="exito" />
                <Cifra valor={mensajes.length - incluidos.length} texto="destildados, no entran" />
                <Cifra valor={leida.omitidas.length} texto="líneas que no son mensajes" />
                <Cifra valor={conAviso.length + leida.avisos.length} texto="avisos para revisar" tono={conAviso.length + leida.avisos.length ? 'alerta' : undefined} />
              </div>
            </div>

            <div className={s.explicacion}>
              <Info aria-hidden />
              <p>
                El texto de cada mensaje queda como está en la transcripción. Destildá lo que no sea un mensaje (notas del analista, resúmenes repetidos) y corregí el remitente si
                la app no lo reconoció. Las notas al pie pasan a la observación del mensaje.
              </p>
            </div>

            {parecida && (
              <Bloque icono={<TriangleAlert aria-hidden />} tono="alerta" titulo="Puede que ya esté importada">
                <p>
                  Ya hay una conversación {normalizar(parecida.titulo) === normalizar(cabecera.titulo) ? 'con ese título' : 'importada de ese archivo'}: «{parecida.titulo}», con{' '}
                  {parecida.resumen?.mensajes ?? 0} mensajes. Si la importás de nuevo, va a quedar repetida.
                </p>
              </Bloque>
            )}

            {leida.avisos.length > 0 && (
              <Bloque icono={<TriangleAlert aria-hidden />} tono="alerta" titulo={`${leida.avisos.length} ${leida.avisos.length === 1 ? 'aviso' : 'avisos'} de la lectura`}>
                <ul className={s.listaFilas}>
                  {leida.avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </Bloque>
            )}

            <div className={h.tablaMarco} style={{ maxHeight: 560 }}>
              <table className={`${h.tabla} ${h.mensajes}`}>
                <thead>
                  <tr>
                    <th aria-label="Importar" />
                    <th style={{ width: 54 }}>Línea</th>
                    <th style={{ width: 120 }}>Fecha</th>
                    <th style={{ width: 160 }}>Remitente</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {mensajes.map((m) => (
                    <tr key={m.orden} className={m.incluir ? undefined : h.excluido}>
                      <td>
                        <input type="checkbox" checked={m.incluir} aria-label={`Importar el mensaje de la línea ${m.linea}`} onChange={(e) => cambiarMensaje(m.orden, { incluir: e.target.checked })} />
                      </td>
                      <td className={h.fila}>{m.linea}</td>
                      <td>{m.fecha_texto ?? <span className={s.tenue}>—</span>}</td>
                      <td>
                        <select className={h.emisor} value={m.emisor ?? ''} aria-label={`Remitente del mensaje de la línea ${m.linea}`} onChange={(e) => cambiarMensaje(m.orden, { emisor: e.target.value || undefined })}>
                          <option value="">Sin identificar</option>
                          {[...new Set([...nombres, ...(m.emisor ? [m.emisor] : [])])].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {m.tipo !== 'texto' && <span className={h.precision}>{TIPO_MENSAJE[m.tipo]}</span>}
                        <span className={h.contenido}>{m.contenido}</span>
                        {m.observacion && <span className={h.notaFila}>{m.observacion}</span>}
                        {m.aviso && <span className={h.avisoFila}>{m.aviso}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {leida.omitidas.length > 0 && (
              <details className={s.avisos}>
                <summary>
                  {leida.omitidas.length} {leida.omitidas.length === 1 ? 'línea no se importa' : 'líneas no se importan'} como mensaje
                </summary>
                <ul className={s.listaFilas}>
                  {leida.omitidas.map((o) => (
                    <li key={o.linea}>
                      <span className={s.filaNumero}>Línea {o.linea}</span>
                      <span>
                        «{o.texto}» · {o.motivo}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className={s.pie}>
              <Boton variante="fantasma" onClick={reiniciar}>
                <ArrowLeft aria-hidden /> Volver
              </Boton>
              <Boton variante="primario" cargando={importando} disabled={!incluidos.length || !cabecera.titulo.trim()} onClick={() => void importar()}>
                Importar {incluidos.length} {incluidos.length === 1 ? 'mensaje' : 'mensajes'}
              </Boton>
            </div>
          </section>
        )}

        {paso === 'hecho' && resultado && leida && (
          <section className={`${s.tarjeta} ${s.hecho}`}>
            <span className={s.hechoIcono}>
              <Check aria-hidden />
            </span>
            <h3 className={s.hechoTitulo}>{resultado.mensajes} mensajes importados</h3>
            <p className={s.hechoTexto}>
              De los {mensajes.length} mensajes detectados en «{archivo}» entraron {resultado.mensajes}. Cada uno guarda su huella SHA-256 y la línea de la que salió. Ahora marcá
              los relevantes y vinculalos a su contratación.
            </p>
            <div className={s.hechoAcciones}>
              <Link to={`../mensajes?conversacion=${resultado.conversacion}`} relative="path" className={clasesBoton('primario')} style={{ textDecoration: 'none' }}>
                Abrir la conversación <ArrowRight aria-hidden />
              </Link>
              <Boton icono={<FileUp aria-hidden />} onClick={reiniciar}>
                Importar otra
              </Boton>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
