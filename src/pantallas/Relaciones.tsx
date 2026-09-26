// Grafo de relaciones de la causa: personas, empresas y, si se quiere, las
// contrataciones donde ofertaron. Se carga aparte (d3-force) para no pesar
// en el directorio.
import { Focus, Minus, Network, Plus, Waypoints } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as EventoPuntero } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { EstadoVacio } from '../componentes/estados';
import { MarcaSugerencia } from '../componentes/marcas';
import type { PersonaVista } from '../datos/causa';
import { useContrataciones, useConversaciones, useVinculos } from '../datos/hechos';
import { disponer, encuadrar, type Punto } from '../lib/disposicion';
import { armarGrafo, iniciales, rotuloCorto, type Arista, type Nodo } from '../lib/relaciones';
import { NuevaRelacion } from './DialogoRelacion';
import s from './Relaciones.module.css';

type Vista = { x: number; y: number; k: number };
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.6;
const limitar = (k: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));

export default function Relaciones({
  causaId,
  personas,
  abierta,
  conPanel,
  onAbrir,
}: {
  causaId: string;
  personas: PersonaVista[];
  abierta: string | null;
  conPanel: boolean;
  onAbrir: (id: string) => void;
}) {
  const navegar = useNavigate();
  const vinculos = useVinculos(causaId);
  const { filas: contrataciones } = useContrataciones(causaId);
  const { filas: conversaciones } = useConversaciones(causaId);
  const [conContrataciones, setConContrataciones] = useState(true);
  const [porNombre, setPorNombre] = useState(true);
  const [creando, setCreando] = useState(false);
  const [resaltada, setResaltada] = useState<string | null>(null);

  const grafo = useMemo(
    () => armarGrafo({ personas, vinculos, contrataciones, conversaciones }, { contrataciones: conContrataciones, porNombre }),
    [personas, vinculos, contrataciones, conversaciones, conContrataciones, porNombre],
  );

  // Posiciones: se recalculan cuando cambia qué está conectado con qué. Cada disposición guarda
  // a qué grafo corresponde, para no encuadrar con posiciones viejas. Lo movido a mano se respeta.
  const firma = grafo.nodos.map((n) => n.id).join(',') + '/' + grafo.aristas.map((a) => a.id).join(',');
  const [disposicion, setDisposicion] = useState<{ firma: string; pos: Map<string, Punto> }>({ firma: '', pos: new Map() });
  const posiciones = disposicion.pos;
  const movidas = useRef(new Map<string, Punto>());
  useEffect(() => {
    setDisposicion({ firma, pos: disponer(grafo.nodos, grafo.aristas, movidas.current) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  const lienzo = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ ancho: e.contentRect.width, alto: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [vista, setVista] = useState<Vista>({ x: 0, y: 0, k: 1 });
  const centrar = () => setVista(encuadrar([...posiciones.values()], tam.ancho, tam.alto));
  const encuadrado = useRef('');
  useEffect(() => {
    // Encuadra al abrir y cuando cambia el tamaño del recuadro o lo que se dibuja; no mientras se arrastra.
    const clave = `${disposicion.firma}|${Math.round(tam.ancho)}x${Math.round(tam.alto)}`;
    if (!tam.ancho || disposicion.firma !== firma || !disposicion.pos.size || encuadrado.current === clave) return;
    encuadrado.current = clave;
    setVista(encuadrar([...disposicion.pos.values()], tam.ancho, tam.alto));
  }, [disposicion, tam, firma]);

  const zoomEn = (factor: number, cx = tam.ancho / 2, cy = tam.alto / 2) =>
    setVista((v) => {
      const k = limitar(v.k * factor);
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });

  // Rueda del mouse: zoom alrededor del puntero (listener no pasivo para poder frenar el scroll).
  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setVista((v) => {
        const k = limitar(v.k * factor);
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
      });
    };
    el.addEventListener('wheel', rueda, { passive: false });
    return () => el.removeEventListener('wheel', rueda);
  }, []);

  // Arrastre: fondo = mover el dibujo; nodo = moverlo a él; dos dedos = zoom.
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<
    | { tipo: 'fondo'; x0: number; y0: number; v0: Vista }
    | { tipo: 'nodo'; id: string; x0: number; y0: number; p0: Punto; movio: boolean }
    | { tipo: 'pellizco'; d0: number; v0: Vista; cx: number; cy: number }
    | null
  >(null);

  const alBajar = (e: EventoPuntero<HTMLDivElement>) => {
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      const r = e.currentTarget.getBoundingClientRect();
      gesto.current = { tipo: 'pellizco', d0: Math.hypot(a.x - b.x, a.y - b.y), v0: vista, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
      return;
    }
    const nodo = (e.target as Element).closest<SVGGElement>('[data-nodo]');
    if (nodo) {
      const id = nodo.dataset.nodo!;
      gesto.current = { tipo: 'nodo', id, x0: e.clientX, y0: e.clientY, p0: posiciones.get(id) ?? { x: 0, y: 0 }, movio: false };
    } else {
      gesto.current = { tipo: 'fondo', x0: e.clientX, y0: e.clientY, v0: vista };
    }
  };

  const alMover = (e: EventoPuntero<HTMLDivElement>) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g) return;
    if (g.tipo === 'pellizco' && punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      const k = limitar((g.v0.k * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(g.d0, 1));
      setVista({ k, x: g.cx - ((g.cx - g.v0.x) * k) / g.v0.k, y: g.cy - ((g.cy - g.v0.y) * k) / g.v0.k });
    } else if (g.tipo === 'fondo') {
      setVista({ ...g.v0, x: g.v0.x + e.clientX - g.x0, y: g.v0.y + e.clientY - g.y0 });
    } else if (g.tipo === 'nodo') {
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (!g.movio && Math.hypot(dx, dy) < 5) return;
      g.movio = true;
      const punto = { x: g.p0.x + dx / vista.k, y: g.p0.y + dy / vista.k };
      movidas.current.set(g.id, punto);
      setDisposicion((d) => ({ ...d, pos: new Map(d.pos).set(g.id, punto) }));
    }
  };

  const alSoltar = (e: EventoPuntero<HTMLDivElement>) => {
    punteros.current.delete(e.pointerId);
    const g = gesto.current;
    if (g?.tipo === 'nodo' && !g.movio) elegir(g.id);
    gesto.current = null;
  };

  const porId = useMemo(() => new Map(grafo.nodos.map((n) => [n.id, n])), [grafo.nodos]);
  const elegir = (id: string) => {
    const n = porId.get(id);
    if (!n) return;
    if (n.tipo === 'contratacion') navegar(`../contrataciones?c=${id}`, { relative: 'path' });
    else onAbrir(id);
  };
  const tecla = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elegir(id);
    }
  };

  const foco = resaltada ?? abierta;
  const vecinos = useMemo(() => {
    if (!foco || !porId.has(foco)) return null;
    const v = new Set([foco]);
    for (const a of grafo.aristas) {
      if (a.a === foco) v.add(a.b);
      if (a.b === foco) v.add(a.a);
    }
    return v;
  }, [foco, grafo.aristas, porId]);

  const listadas = vecinos && foco ? grafo.aristas.filter((a) => a.a === foco || a.b === foco) : grafo.aristas;
  const firmes = grafo.aristas.filter((a) => !a.porNombre).length;
  const nombreDe = (id: string) => porId.get(id)?.etiqueta ?? '—';

  const vacio = grafo.nodos.length === 0;

  return (
    <div className={`${s.relaciones} ${conPanel ? s.conPanel : ''}`}>
      <div className={s.barra}>
        <div className={s.capas} role="group" aria-label="Qué más se dibuja, además de las relaciones cargadas">
          <span className={s.capasRotulo}>Sumar al dibujo</span>
          <button type="button" className={`${s.capa} ${s.capaContratacion}`} aria-pressed={conContrataciones} onClick={() => setConContrataciones((v) => !v)}>
            Ofertas y adjudicaciones
          </button>
          <button type="button" className={`${s.capa} ${s.capaNombre}`} aria-pressed={porNombre} onClick={() => setPorNombre((v) => !v)}>
            Juntos en conversaciones
          </button>
        </div>
        <Boton tamano="chico" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
          Nueva relación
        </Boton>
      </div>

      <div className={s.cuerpo}>
        <div className={s.marco}>
          {vacio ? (
            <div className={s.vacio}>
              <EstadoVacio
                icono={<Network />}
                titulo="Todavía no hay relaciones para dibujar"
                accion={
                  <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
                    Cargar una relación
                  </Boton>
                }
              >
                Cargá quién es socio, familiar o empleado de quién. Las ofertas de las contrataciones y las conversaciones importadas se suman solas.
              </EstadoVacio>
            </div>
          ) : null}
          <div
            ref={lienzo}
            className={`${s.lienzo} ${vacio ? s.oculto : ''}`}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
          >
            <svg width="100%" height="100%" role="group" aria-label={`Grafo con ${grafo.nodos.length} fichas y ${grafo.aristas.length} relaciones`}>
              <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`} style={{ ['--escala' as string]: Math.min(1.6, Math.max(1, 0.8 / vista.k)) }}>
                {grafo.aristas.map((a) => (
                  <Linea key={a.id} arista={a} desde={posiciones.get(a.a)} hasta={posiciones.get(a.b)} tenue={!!vecinos && !(vecinos.has(a.a) && vecinos.has(a.b) && (a.a === foco || a.b === foco))} />
                ))}
                {grafo.nodos.map((n) => (
                  <Ficha
                    key={n.id}
                    nodo={n}
                    punto={posiciones.get(n.id)}
                    tenue={!!vecinos && !vecinos.has(n.id)}
                    elegida={n.id === abierta}
                    onFoco={setResaltada}
                    onTecla={tecla(n.id)}
                  />
                ))}
              </g>
            </svg>
            <div className={s.zoom} onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" aria-label="Acercar" title="Acercar" onClick={() => zoomEn(1.25)}>
                <Plus aria-hidden />
              </button>
              <button type="button" aria-label="Alejar" title="Alejar" onClick={() => zoomEn(0.8)}>
                <Minus aria-hidden />
              </button>
              <button type="button" aria-label="Ver todo" title="Ver todo" onClick={centrar}>
                <Focus aria-hidden />
              </button>
            </div>
            <ul className={s.leyenda} aria-label="Referencias">
              <li>
                <span className={s.refPersona} aria-hidden /> Persona
              </li>
              <li>
                <span className={s.refEmpresa} aria-hidden /> Empresa
              </li>
              <li>
                <span className={s.refImputado} aria-hidden /> Imputado
              </li>
              {conContrataciones && (
                <li>
                  <span className={s.refContratacion} aria-hidden /> Contratación
                </li>
              )}
              {porNombre && (
                <li>
                  <span className={s.refPunteada} aria-hidden /> Coincidencia por nombre
                </li>
              )}
            </ul>
          </div>
        </div>

        {!vacio && (
          <aside className={s.lista} aria-label="Relaciones en lista">
            <div className={s.listaCabecera}>
              <Waypoints aria-hidden />
              <div>
                <h3>{foco && vecinos ? nombreDe(foco) : 'Quién con quién'}</h3>
                <p>
                  {foco && vecinos
                    ? `${listadas.length} ${listadas.length === 1 ? 'relación' : 'relaciones'}`
                    : `${firmes} ${firmes === 1 ? 'firme' : 'firmes'} · ${grafo.aristas.length - firmes} por nombre${grafo.aisladas ? ` · ${grafo.aisladas} sin relaciones (no se dibujan)` : ''}`}
                </p>
              </div>
            </div>
            <ol className={s.items}>
              {listadas.map((a) => (
                <li key={a.id} className={a.porNombre ? s.itemNombre : ''}>
                  <div className={s.par}>
                    <button type="button" onClick={() => elegir(a.a)}>
                      {nombreDe(a.a)}
                    </button>
                    <span aria-hidden>—</span>
                    <button type="button" onClick={() => elegir(a.b)}>
                      {nombreDe(a.b)}
                    </button>
                  </div>
                  <ul className={s.motivos}>
                    {a.motivos.map((m, i) => (
                      <li key={i}>
                        {m.texto}
                        {m.fuente && <span className={s.fuente}> · surge de {m.fuente}</span>}
                      </li>
                    ))}
                  </ul>
                  {a.porNombre && <MarcaSugerencia>coincidencia por nombre · a confirmar</MarcaSugerencia>}
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>

      <NuevaRelacion abierto={creando} causaId={causaId} personas={personas} vinculos={vinculos} inicial={abierta} onCerrar={() => setCreando(false)} />
    </div>
  );
}

function Linea({ arista, desde, hasta, tenue }: { arista: Arista; desde?: Punto; hasta?: Punto; tenue: boolean }) {
  if (!desde || !hasta) return null;
  const clase = arista.motivos.some((m) => m.clase === 'relacion')
    ? s.aristaRelacion
    : arista.motivos.some((m) => m.clase === 'adjudicacion')
      ? s.aristaAdjudicacion
      : arista.motivos.some((m) => m.clase === 'oferta')
        ? s.aristaOferta
        : s.aristaNombre;
  const mx = (desde.x + hasta.x) / 2;
  const my = (desde.y + hasta.y) / 2;
  return (
    <g className={`${s.arista} ${clase} ${tenue ? s.tenue : ''}`}>
      <title>{arista.motivos.map((m) => m.texto).join('\n')}</title>
      <line x1={desde.x} y1={desde.y} x2={hasta.x} y2={hasta.y} />
      {arista.rotulo && (
        <text x={mx} y={my} dy="-0.45em" textAnchor="middle">
          {rotuloCorto(arista.rotulo, 28)}
        </text>
      )}
    </g>
  );
}

function Ficha({
  nodo,
  punto,
  tenue,
  elegida,
  onFoco,
  onTecla,
}: {
  nodo: Nodo;
  punto?: Punto;
  tenue: boolean;
  elegida: boolean;
  onFoco: (id: string | null) => void;
  onTecla: (e: KeyboardEvent<SVGGElement>) => void;
}) {
  if (!punto) return null;
  const clase = nodo.tipo === 'contratacion' ? s.nodoContratacion : nodo.tipo === 'juridica' ? s.nodoEmpresa : s.nodoPersona;
  const ancho = nodo.tipo === 'contratacion' ? Math.max(64, nodo.etiqueta.length * 7.2 + 20) : 44;
  const que = nodo.tipo === 'contratacion' ? 'Contratación' : nodo.tipo === 'juridica' ? 'Empresa' : 'Persona';
  return (
    <g
      data-nodo={nodo.id}
      className={`${s.nodo} ${clase} ${tenue ? s.tenue : ''} ${elegida ? s.elegida : ''}`}
      transform={`translate(${punto.x} ${punto.y})`}
      tabIndex={0}
      role="button"
      aria-label={`${que}: ${nodo.etiqueta}${nodo.imputado ? ' (imputado)' : ''}. Abrir la ficha.`}
      onMouseEnter={() => onFoco(nodo.id)}
      onMouseLeave={() => onFoco(null)}
      onFocus={() => onFoco(nodo.id)}
      onBlur={() => onFoco(null)}
      onKeyDown={onTecla}
    >
      <title>{nodo.detalle ? `${nodo.etiqueta} — ${nodo.detalle}` : nodo.etiqueta}</title>
      {nodo.imputado && (nodo.tipo === 'fisica' ? <circle className={s.anillo} r={27} /> : <rect className={s.anillo} x={-27} y={-27} width={54} height={54} rx={14} />)}
      {nodo.tipo === 'fisica' && <circle className={s.forma} r={22} />}
      {nodo.tipo === 'juridica' && <rect className={s.forma} x={-22} y={-22} width={44} height={44} rx={10} />}
      {nodo.tipo === 'contratacion' && <rect className={s.forma} x={-ancho / 2} y={-14} width={ancho} height={28} rx={3} />}
      <text className={s.sigla} dy="0.35em" textAnchor="middle">
        {nodo.tipo === 'contratacion' ? nodo.etiqueta : iniciales(nodo.etiqueta)}
      </text>
      {nodo.tipo !== 'contratacion' && (
        <text className={s.nombre} y={nodo.imputado ? 44 : 38} textAnchor="middle">
          {rotuloCorto(nodo.etiqueta)}
        </text>
      )}
    </g>
  );
}
