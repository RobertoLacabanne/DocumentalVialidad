import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowLeft,
  AudioLines,
  Bookmark,
  BookmarkCheck,
  FileDown,
  FileUp,
  Image as ImageIcon,
  MessagesSquare,
  Paperclip,
  ScrollText,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boton, clasesBoton } from '../componentes/Boton';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { EtiquetaEfecto } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useEfectos } from '../datos/causa';
import { useGuardado } from '../datos/guardado';
import {
  useAplicarMensaje,
  useContrataciones,
  useConversaciones,
  useMensajes,
  usePiezasRef,
  useVinculos,
  type ConversacionVista,
} from '../datos/hechos';
import { separarNombres } from '../lib/conversaciones';
import { tonoDe } from '../lib/etiquetas';
import { normalizar } from '../lib/importacion';
import { fechaCorta } from '../lib/informe';
import { contiene, tramosResaltados } from '../lib/resaltar';
import { supabase } from '../lib/supabase';
import type { Mensaje, Vinculo } from '../lib/tipos';
import { CabeceraCausa } from './CabeceraCausa';
import { DatosConversacion, FichaMensaje, TIPO_MENSAJE } from './FichaMensaje';
import { InformeMensajes } from './InformeMensajes';
import { useCausaActual } from './Marco';
import s from './Mensajes.module.css';
import si from './Indice.module.css';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function diaLargo(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[f.getUTCDay()]} ${d} de ${MESES[m - 1]} de ${a}`;
}

/** Quién va a la derecha, como el dueño del teléfono en WhatsApp. Solo es una forma de mostrar. */
function ladoDerecho(c: ConversacionVista): string | null {
  const nombres = c.participantes ? separarNombres(c.participantes) : [];
  if (nombres.length === 2 && c.agendado_como) {
    const agendado = normalizar(c.agendado_como);
    const otro = nombres.find((n) => agendado.includes(normalizar(n)));
    if (otro) return nombres.find((n) => n !== otro) ?? null;
  }
  if (c.titular_dispositivo) {
    const titular = normalizar(c.titular_dispositivo);
    const propio = nombres.find((n) => titular.includes(normalizar(n)));
    if (propio) return propio;
  }
  return nombres[1] ?? null;
}

type Fila = { tipo: 'dia'; clave: string; texto: string } | { tipo: 'mensaje'; m: Mensaje };

export function Mensajes() {
  const { causa } = useCausaActual();
  const { filas: conversaciones, cargando, error } = useConversaciones(causa.id);
  const { filas: contrataciones } = useContrataciones(causa.id);
  const { filas: efectos } = useEfectos(causa.id);
  const piezas = usePiezasRef(causa.id);
  const vinculos = useVinculos(causa.id);
  const [params, setParams] = useSearchParams();
  const [buscarLista, setBuscarLista] = useState('');
  const [informe, setInforme] = useState(false);
  const idConversacion = params.get('conversacion');
  const idMensaje = params.get('mensaje');
  const verDatos = params.get('datos') === '1';

  // Si llega solo el mensaje (desde la búsqueda o una contratación), se busca su conversación.
  const origenMensaje = useQuery({
    queryKey: ['conversacion-de-mensaje', idMensaje],
    enabled: Boolean(idMensaje) && !idConversacion,
    queryFn: async () => {
      const { data, error: err } = await supabase.from('mensaje').select('conversacion_id').eq('id', idMensaje!).single();
      if (err) throw new Error(err.message);
      return (data as { conversacion_id: string }).conversacion_id;
    },
  });
  useEffect(() => {
    if (origenMensaje.data && !idConversacion) {
      const nuevos = new URLSearchParams(params);
      nuevos.set('conversacion', origenMensaje.data);
      setParams(nuevos, { replace: true });
    }
  }, [origenMensaje.data, idConversacion, params, setParams]);

  const cambiar = (cambios: Record<string, string | null>) => {
    const nuevos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevos.set(k, v);
      else nuevos.delete(k);
    }
    setParams(nuevos, { replace: true });
  };

  const actual = conversaciones.find((c) => c.id === idConversacion) ?? null;
  const visibles = conversaciones.filter((c) => !buscarLista || contiene([c.titulo, c.participantes, c.agendado_como, c.contacto_relevante].join(' '), buscarLista));
  const efectoDe = (id: string | null) => (id ? efectos.find((e) => e.id === id) ?? null : null);

  const conPanel = Boolean(actual && (idMensaje || verDatos));

  return (
    <div className={`${si.pantalla} ${conPanel ? si.conPanel : ''}`}>
      <div className={`${si.principal} ${s.pantalla} ${actual ? s.leyendo : ''}`}>
        <CabeceraCausa causa={causa} />
        <div className={`${si.vista} ${s.vista}`}>
          <div>
            <h2 className={si.titulo}>Mensajes</h2>
            <p className={si.bajada}>Las conversaciones extraídas de los teléfonos, tal cual se transcribieron. Marcá lo relevante y vinculalo a la contratación.</p>
          </div>
          <div className={si.acciones}>
            <Link to="../importar-conversacion" relative="path" className={clasesBoton('primario')} style={{ textDecoration: 'none' }}>
              <FileUp aria-hidden /> Importar conversación
            </Link>
          </div>
        </div>

        {error ? (
          <div style={{ padding: 'var(--esp-6)' }}>
            <AvisoError titulo="No pudimos traer las conversaciones">{error.message}</AvisoError>
          </div>
        ) : cargando ? (
          <FilasEsqueleto filas={5} />
        ) : conversaciones.length === 0 ? (
          <div className={s.vacio}>
            <EstadoVacio
              icono={<MessagesSquare />}
              ilustracion="vacio-mensajes"
              titulo="Todavía no hay conversaciones"
              accion={
                <Link to="../importar-conversacion" relative="path" className={clasesBoton('primario')} style={{ textDecoration: 'none' }}>
                  <FileUp aria-hidden /> Importar la primera
                </Link>
              }
            >
              Subí la transcripción en .docx (como las de APUNTES LEG. 299113) o pegá el texto. La app separa fecha, remitente y mensaje, y te muestra todo antes de guardar.
            </EstadoVacio>
          </div>
        ) : (
          <div className={`${s.cuerpo} ${actual ? s.conLector : ''}`}>
            <nav className={s.lista} aria-label="Conversaciones">
              <label className={`${si.buscar} ${s.buscar}`}>
                <Search aria-hidden />
                <span className="visualmente-oculto">Buscar conversación</span>
                <input type="search" placeholder="Nombre, número, agendado…" value={buscarLista} onChange={(e) => setBuscarLista(e.target.value)} />
              </label>
              <ul>
                {visibles.map((c) => {
                  const e = efectoDe(c.efecto_id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`${s.item} ${c.id === idConversacion ? s.itemActivo : ''}`}
                        aria-current={c.id === idConversacion ? 'true' : undefined}
                        onClick={() => cambiar({ conversacion: c.id, mensaje: null, datos: null })}
                      >
                        <span className={s.itemTitulo}>{c.titulo}</span>
                        <span className={s.itemMeta}>
                          {e && <EtiquetaEfecto numero={e.numero} />}
                          <span>{c.resumen?.mensajes ?? 0} mensajes</span>
                          {(c.resumen?.relevantes ?? 0) > 0 && (
                            <span className={s.itemRelevantes}>
                              <BookmarkCheck aria-hidden /> {c.resumen!.relevantes}
                            </span>
                          )}
                        </span>
                        {c.resumen?.primera_fecha && (
                          <span className={s.itemPeriodo}>
                            {fechaCorta(c.resumen.primera_fecha)} – {fechaCorta(c.resumen.ultima_fecha)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {visibles.length === 0 && <li className={s.sinCoincidencias}>Ninguna coincide con «{buscarLista}».</li>}
              </ul>
            </nav>

            {actual ? (
              <Lector
                key={actual.id}
                conversacion={actual}
                efecto={efectoDe(actual.efecto_id)}
                vinculos={vinculos}
                contrataciones={contrataciones.map((c) => ({ id: c.id, identificador: c.identificador }))}
                piezas={piezas.map((p) => ({ id: p.id, numero: p.numero_orden }))}
                mensajeElegido={idMensaje}
                onElegir={(id) => cambiar({ mensaje: id, datos: null })}
                onVolver={() => cambiar({ conversacion: null, mensaje: null, datos: null })}
                onDatos={() => cambiar({ datos: '1', mensaje: null })}
                onInforme={() => setInforme(true)}
              />
            ) : (
              <div className={s.elegir}>
                <EstadoVacio icono={<MessagesSquare />} titulo="Elegí una conversación">
                  Se abre como un chat, en orden y con la fecha de cada mensaje. Con la tecla R marcás un mensaje como relevante.
                </EstadoVacio>
              </div>
            )}
          </div>
        )}
      </div>

      {actual && idMensaje && (
        <MensajeAbierto
          conversacion={actual}
          idMensaje={idMensaje}
          contrataciones={contrataciones}
          piezas={piezas}
          vinculos={vinculos}
          onCerrar={() => cambiar({ mensaje: null })}
        />
      )}
      {actual && verDatos && !idMensaje && <DatosConversacion key={actual.id} conversacion={actual} efectos={efectos} onCerrar={() => cambiar({ datos: null })} />}
      {actual && (
        <InformeMensajes
          key={`${actual.id}-${informe}`}
          abierto={informe}
          causa={causa}
          conversacion={actual}
          conversaciones={conversaciones}
          efectos={efectos}
          contrataciones={contrataciones}
          piezas={piezas}
          vinculos={vinculos}
          onCerrar={() => setInforme(false)}
        />
      )}
    </div>
  );
}

/** Marca o desmarca un mensaje como relevante al instante; si otra persona lo cambió, avisa. */
function useAlternarRelevante() {
  const { guardarCampo } = useGuardado();
  const aplicar = useAplicarMensaje();
  const { avisar } = useToast();
  return async (m: Mensaje) => {
    aplicar({ ...m, relevante: !m.relevante });
    const r = await guardarCampo('mensaje', m.id, 'relevante', m.relevante, !m.relevante);
    if (r.tipo === 'error') {
      aplicar(m);
      avisar(r.mensaje, { tono: 'error' });
    } else if (r.tipo === 'conflicto') {
      avisar(`${r.quien} ya lo había cambiado. Quedó como lo dejó.`, { tono: 'aviso' });
    }
  };
}

function MensajeAbierto({
  conversacion,
  idMensaje,
  contrataciones,
  piezas,
  vinculos,
  onCerrar,
}: {
  conversacion: ConversacionVista;
  idMensaje: string;
  contrataciones: Parameters<typeof FichaMensaje>[0]['contrataciones'];
  piezas: Parameters<typeof FichaMensaje>[0]['piezas'];
  vinculos: Vinculo[];
  onCerrar: () => void;
}) {
  const { mensajes } = useMensajes(conversacion.id);
  const alternar = useAlternarRelevante();
  const m = mensajes.find((x) => x.id === idMensaje);
  if (!m) return null;
  return (
    <FichaMensaje
      key={m.id}
      mensaje={m}
      conversacion={conversacion}
      contrataciones={contrataciones}
      piezas={piezas}
      vinculos={vinculos}
      onRelevante={(x) => void alternar(x)}
      onCerrar={onCerrar}
    />
  );
}

function Lector({
  conversacion,
  efecto,
  vinculos,
  contrataciones,
  piezas,
  mensajeElegido,
  onElegir,
  onVolver,
  onDatos,
  onInforme,
}: {
  conversacion: ConversacionVista;
  efecto: { numero: string } | null;
  vinculos: Vinculo[];
  contrataciones: { id: string; identificador: string }[];
  piezas: { id: string; numero: string | null }[];
  mensajeElegido: string | null;
  onElegir: (id: string) => void;
  onVolver: () => void;
  onDatos: () => void;
  onInforme: () => void;
}) {
  const { mensajes, cargando, error } = useMensajes(conversacion.id);
  const alternar = useAlternarRelevante();
  const [texto, setTexto] = useState('');
  const [soloRelevantes, setSoloRelevantes] = useState(false);
  const marco = useRef<HTMLDivElement>(null);
  const derecha = useMemo(() => ladoDerecho(conversacion), [conversacion]);

  const etiquetasVinculo = useMemo(() => {
    const c = new Map(contrataciones.map((x) => [x.id, x.identificador]));
    const p = new Map(piezas.map((x) => [x.id, x.numero ? `Pieza Nº ${x.numero}` : 'Pieza']));
    const m = new Map<string, { texto: string; tipo: 'contratacion' | 'pieza' }[]>();
    for (const v of vinculos) {
      for (const [propio, otro] of [
        [v.origen_id, v.destino_id],
        [v.destino_id, v.origen_id],
      ]) {
        const etiqueta = c.get(otro) ? { texto: c.get(otro)!, tipo: 'contratacion' as const } : p.get(otro) ? { texto: p.get(otro)!, tipo: 'pieza' as const } : null;
        if (etiqueta) m.set(propio, [...(m.get(propio) ?? []), etiqueta]);
      }
    }
    return m;
  }, [vinculos, contrataciones, piezas]);

  const filtrados = useMemo(
    () => mensajes.filter((m) => (!soloRelevantes || m.relevante) && (!texto.trim() || contiene(m.contenido, texto) || contiene(m.emisor, texto))),
    [mensajes, soloRelevantes, texto],
  );

  const filas = useMemo<Fila[]>(() => {
    const salida: Fila[] = [];
    let ultimo = '';
    for (const m of filtrados) {
      const clave = m.fecha ?? m.fecha_hora_texto?.split(' ')[0] ?? '';
      if (clave !== ultimo) {
        salida.push({ tipo: 'dia', clave: `dia-${clave}-${m.id}`, texto: m.fecha ? diaLargo(m.fecha) : m.fecha_hora_texto ? `«${m.fecha_hora_texto}»` : 'Sin fecha' });
        ultimo = clave;
      }
      salida.push({ tipo: 'mensaje', m });
    }
    return salida;
  }, [filtrados]);

  const virtual = useVirtualizer({
    count: filas.length,
    getScrollElement: () => marco.current,
    estimateSize: (i) => (filas[i]?.tipo === 'dia' ? 44 : 92),
    overscan: 10,
    getItemKey: (i) => {
      const f = filas[i];
      return f ? (f.tipo === 'dia' ? f.clave : f.m.id) : i;
    },
  });

  // Al llegar con un mensaje elegido (desde la búsqueda o una contratación), se lo muestra centrado.
  const yaCentrado = useRef<string | null>(null);
  useEffect(() => {
    if (!mensajeElegido || yaCentrado.current === mensajeElegido || !filas.length) return;
    const i = filas.findIndex((f) => f.tipo === 'mensaje' && f.m.id === mensajeElegido);
    if (i >= 0) {
      yaCentrado.current = mensajeElegido;
      virtual.scrollToIndex(i, { align: 'center' });
    }
  }, [mensajeElegido, filas, virtual]);

  const tecla = (m: Mensaje) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onElegir(m.id);
    } else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      void alternar(m);
    }
  };

  const total = conversacion.resumen?.mensajes ?? mensajes.length;
  const relevantes = mensajes.filter((m) => m.relevante).length;

  return (
    <section className={s.lector} aria-label={conversacion.titulo}>
      <header className={s.lectorCabecera}>
        <button type="button" className={s.volver} onClick={onVolver}>
          <ArrowLeft aria-hidden /> Conversaciones
        </button>
        <div className={s.lectorTitulo}>
          <h3>{conversacion.titulo}</h3>
          <div className={s.lectorMeta}>
            {efecto && <EtiquetaEfecto numero={efecto.numero} />}
            {conversacion.contacto_relevante && <span>Nº {conversacion.contacto_relevante}</span>}
            {conversacion.agendado_como && <span>agendado como «{conversacion.agendado_como}»</span>}
            <span className="cifras">
              {total} mensajes · {relevantes} relevantes
            </span>
          </div>
        </div>
        <div className={s.lectorAcciones}>
          <Boton tamano="chico" icono={<Settings2 aria-hidden />} onClick={onDatos}>
            Datos de la conversación
          </Boton>
          <Boton tamano="chico" variante="primario" icono={<FileDown aria-hidden />} onClick={onInforme}>
            Informe .docx
          </Boton>
        </div>
      </header>

      <div className={s.herramientas}>
        <label className={`${si.buscar} ${s.buscarChat}`}>
          <Search aria-hidden />
          <span className="visualmente-oculto">Buscar en la conversación</span>
          <input type="search" placeholder="Buscar en esta conversación…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          {texto && (
            <button type="button" className={s.limpiarBusqueda} onClick={() => setTexto('')} aria-label="Borrar la búsqueda">
              <X aria-hidden />
            </button>
          )}
        </label>
        <div className={si.segmento} role="group" aria-label="Qué mensajes mostrar">
          <button type="button" aria-pressed={!soloRelevantes} onClick={() => setSoloRelevantes(false)}>
            Todos
          </button>
          <button type="button" aria-pressed={soloRelevantes} onClick={() => setSoloRelevantes(true)}>
            Relevantes
          </button>
        </div>
        {(texto || soloRelevantes) && (
          <span className={s.conteo}>
            {filtrados.length} de {mensajes.length}
          </span>
        )}
      </div>

      <div ref={marco} className={s.chat}>
        {error ? (
          <div style={{ padding: 'var(--esp-6)' }}>
            <AvisoError titulo="No pudimos traer los mensajes">{error.message}</AvisoError>
          </div>
        ) : cargando ? (
          <FilasEsqueleto filas={6} />
        ) : filas.length === 0 ? (
          <div className={s.chatVacio}>
            <EstadoVacio icono={soloRelevantes ? <Bookmark /> : <Search />} ilustracion={soloRelevantes && !texto ? undefined : 'vacio-busqueda'} titulo={soloRelevantes && !texto ? 'Ningún mensaje marcado todavía' : 'No hay mensajes que coincidan'}>
              {soloRelevantes && !texto ? 'Pasá el mouse por un mensaje y tocá el marcador, o elegilo y apretá R.' : 'Probá con otra palabra. La búsqueda no distingue tildes.'}
            </EstadoVacio>
          </div>
        ) : (
          <div className={s.chatLienzo} style={{ height: virtual.getTotalSize() }}>
            {virtual.getVirtualItems().map((item) => {
              const f = filas[item.index];
              if (!f) return null;
              if (f.tipo === 'dia') {
                return (
                  <div key={item.key} data-index={item.index} ref={virtual.measureElement} className={s.dia} style={{ transform: `translateY(${item.start}px)` }}>
                    <span>{f.texto}</span>
                  </div>
                );
              }
              const m = f.m;
              const propio = Boolean(derecha && m.emisor && normalizar(m.emisor) === normalizar(derecha));
              const etiquetas = etiquetasVinculo.get(m.id) ?? [];
              const hora = m.fecha_hora_texto && /\d{1,2}[:.]\d{2}/.exec(m.fecha_hora_texto)?.[0];
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtual.measureElement}
                  className={`${s.filaMensaje} ${propio ? s.derecha : ''}`}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <div
                    className={`${s.burbuja} ${m.relevante ? s.relevante : ''} ${m.id === mensajeElegido ? s.elegido : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`Mensaje de ${m.emisor ?? 'emisor sin identificar'}${m.relevante ? ', marcado como relevante' : ''}`}
                    onClick={() => onElegir(m.id)}
                    onKeyDown={tecla(m)}
                  >
                    <span className={`${s.emisor} ${s[`tono${tonoDe(m.emisor)}`]}`}>{m.emisor ?? 'Sin identificar'}</span>
                    {m.tipo !== 'texto' && (
                      <span className={s.tipo}>
                        {m.tipo === 'audio_transcripto' ? <AudioLines aria-hidden /> : m.tipo === 'imagen' ? <ImageIcon aria-hidden /> : <Paperclip aria-hidden />}
                        {TIPO_MENSAJE[m.tipo]}
                      </span>
                    )}
                    <p className={s.contenido}>
                      {texto.trim()
                        ? tramosResaltados(m.contenido ?? '', texto).map((t, i) => (t.marcado ? <mark key={i}>{t.texto}</mark> : <Fragment key={i}>{t.texto}</Fragment>))
                        : m.contenido}
                    </p>
                    {m.observacion && <p className={s.observacion}>{m.observacion}</p>}
                    <span className={s.pie}>
                      {etiquetas.map((e) => (
                        <span key={e.texto} className={s.vinculoChip}>
                          {e.tipo === 'contratacion' ? <ScrollText aria-hidden /> : null}
                          {e.texto}
                        </span>
                      ))}
                      {hora && <span className={s.hora}>{hora}</span>}
                    </span>
                    <button
                      type="button"
                      className={`${s.marcar} ${m.relevante ? s.marcado : ''}`}
                      aria-label={m.relevante ? 'Quitar la marca de relevante' : 'Marcar como relevante'}
                      aria-pressed={m.relevante}
                      title={m.relevante ? 'Quitar la marca (R)' : 'Marcar como relevante (R)'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void alternar(m);
                      }}
                    >
                      {m.relevante ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

