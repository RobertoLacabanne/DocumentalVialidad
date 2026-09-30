import { FileSearch, Plus, Search, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { MenuExportar } from '../componentes/MenuExportar';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { TablaPiezas, type FilaIndice } from '../componentes/TablaPiezas';
import { useDirectorio, useIndice } from '../datos/consultas';
import { useYo } from '../datos/sesion';
import { ESTADOS_TRABAJO, RELEVANCIAS, SITUACIONES, TIPOS_PIEZA, tipoPieza } from '../lib/etiquetas';
import { descargarCsv, descargarXlsx, nombreArchivo, type Columna } from '../lib/exportar';
import { fechaConPrecision } from '../lib/tiempo';
import { CabeceraCausa } from './CabeceraCausa';
import { FichaPieza } from './FichaPieza';
import { useCausaActual } from './Marco';
import { NuevaPieza } from './NuevaPieza';
import s from './Indice.module.css';

type Filtros = { texto: string; tipo: string; relevancia: string; responsable: string; soloAlertas: boolean };
const SIN_FILTROS: Filtros = { texto: '', tipo: '', relevancia: '', responsable: '', soloAlertas: false };

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function pasaFiltros(f: FilaIndice, filtros: Filtros, terminos: string[]) {
  if (filtros.tipo && f.tipo !== filtros.tipo) return false;
  if (filtros.relevancia === 'sin_evaluar' ? f.relevancia !== null : filtros.relevancia && f.relevancia !== filtros.relevancia)
    return false;
  if (filtros.responsable === 'sin_asignar' ? f.responsable !== null : filtros.responsable && f.responsable !== filtros.responsable)
    return false;
  if (filtros.soloAlertas && !f.situacion) return false;
  if (terminos.length) {
    const texto = normalizar(
      [f.numero_orden, f.titulo, f.autor, f.destinatarios, f.resumen, f.observaciones_analista, f.fojas, f.sobre, f.efecto_numero, f.informe_numero, ...f.etiquetas]
        .filter(Boolean)
        .join(' '),
    );
    if (!terminos.every((t) => texto.includes(t))) return false;
  }
  return true;
}

function leerDensidad(): 'comoda' | 'compacta' {
  try {
    return localStorage.getItem('tp-densidad') === 'compacta' ? 'compacta' : 'comoda';
  } catch {
    return 'comoda';
  }
}

export function Indice() {
  const { causa, viendoPorPieza } = useCausaActual();
  const yo = useYo();
  const { miembros } = useDirectorio();
  const { filas, cargando, error, reintentar, recienLlegadas, conectado } = useIndice(causa.id, yo.user_id);
  const [params, setParams] = useSearchParams();
  const seleccionada = params.get('pieza');
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [densidad, setDensidad] = useState<'comoda' | 'compacta'>(leerDensidad);
  const [creando, setCreando] = useState(false);
  const [editarAlAbrir, setEditarAlAbrir] = useState<string | null>(null);
  const buscador = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('tp-densidad', densidad);
    } catch {
      /* preferencia solo en memoria */
    }
  }, [densidad]);

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      const escribiendo = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === '/' && !escribiendo && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        buscador.current?.focus();
        buscador.current?.select();
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, []);

  const visibles = useMemo(() => {
    const terminos = normalizar(filtros.texto).split(/\s+/).filter(Boolean);
    return filas.filter((f) => pasaFiltros(f, filtros, terminos));
  }, [filas, filtros]);

  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(SIN_FILTROS);
  const conAlerta = filas.filter((f) => f.situacion).length;
  const piezaAbierta = filas.find((f) => f.id === seleccionada) ?? null;

  const seleccionar = (id: string | null) => {
    const nuevos = new URLSearchParams(params);
    if (id) nuevos.set('pieza', id);
    else nuevos.delete('pieza');
    setParams(nuevos, { replace: true });
  };

  const siguienteNumero = useMemo(() => {
    const enteros = filas.map((f) => Number.parseInt(f.numero_orden ?? '', 10)).filter((n) => Number.isFinite(n));
    return enteros.length ? String(Math.max(...enteros) + 1) : '1';
  }, [filas]);

  const cambiar = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) => setFiltros((f) => ({ ...f, [clave]: valor }));

  const columnasExportar: Columna<FilaIndice>[] = [
    { titulo: 'Nº de orden', valor: (f) => f.numero_orden, ancho: 10 },
    { titulo: 'Tipo', valor: (f) => tipoPieza(f.tipo).etiqueta, ancho: 20 },
    { titulo: 'Título', valor: (f) => f.titulo, ancho: 44 },
    { titulo: 'Fecha', valor: (f) => (f.fecha_desde ? fechaConPrecision(f.fecha_desde, f.fecha_precision) : ''), ancho: 14 },
    { titulo: 'Autor o remitente', valor: (f) => f.autor, ancho: 24 },
    { titulo: 'Destinatarios', valor: (f) => f.destinatarios, ancho: 24 },
    { titulo: 'Resumen', valor: (f) => f.resumen, ancho: 60 },
    { titulo: 'Efecto', valor: (f) => f.efecto_numero, ancho: 10 },
    { titulo: 'Sobre', valor: (f) => f.sobre, ancho: 10 },
    { titulo: 'Informe', valor: (f) => f.informe_numero, ancho: 12 },
    { titulo: 'Fojas', valor: (f) => f.fojas, ancho: 12 },
    { titulo: 'Relevancia', valor: (f) => RELEVANCIAS.find((r) => r.valor === f.relevancia)?.etiqueta ?? 'Sin evaluar', ancho: 12 },
    { titulo: 'Estado de trabajo', valor: (f) => ESTADOS_TRABAJO.find((e) => e.valor === f.estado_trabajo)?.etiqueta ?? '', ancho: 14 },
    { titulo: 'Responsable', valor: (f) => f.responsable_alias, ancho: 14 },
    { titulo: 'Situación procesal', valor: (f) => (f.situacion ? `${SITUACIONES[f.situacion.situacion]}: ${f.situacion.titulo}` : ''), ancho: 30 },
    { titulo: 'Observaciones del analista', valor: (f) => f.observaciones_analista, ancho: 40 },
    { titulo: 'Etiquetas', valor: (f) => f.etiquetas.join(', '), ancho: 20 },
  ];
  const archivo = nombreArchivo('Indice', causa.legajo_fiscalia);

  return (
    <div className={`${s.pantalla} ${piezaAbierta ? s.conPanel : ''}`}>
      <div className={s.principal}>
        <CabeceraCausa causa={causa} />

        <div className={s.vista}>
          <div>
            <h2 className={s.titulo}>Índice de prueba</h2>
            <p className={s.bajada}>Una fila por pieza, como el cuadro Urribarri, con su origen, su estado y quién la trabaja.</p>
          </div>
          <div className={s.acciones}>
            <MenuExportar
              cantidad={visibles.length}
              onExcel={() => descargarXlsx(visibles, columnasExportar, archivo, 'Índice de prueba')}
              onCsv={() => descargarCsv(visibles, columnasExportar, archivo)}
            />
            <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
              Nueva pieza
            </Boton>
          </div>
        </div>

        <div className={s.filtros}>
          <label className={s.buscar}>
            <Search aria-hidden />
            <span className="visualmente-oculto">Buscar en el índice</span>
            <input
              ref={buscador}
              id="buscar-indice"
              type="search"
              placeholder="Buscar en el índice…"
              value={filtros.texto}
              onChange={(e) => cambiar('texto', e.target.value)}
            />
            <kbd title="Apretá / para buscar en el índice">/</kbd>
          </label>
          <select
            aria-label="Filtrar por tipo"
            className={`${s.filtro} ${filtros.tipo ? s.filtroActivo : ''}`}
            value={filtros.tipo}
            onChange={(e) => cambiar('tipo', e.target.value)}
          >
            <option value="">Tipo: todos</option>
            {TIPOS_PIEZA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por relevancia"
            className={`${s.filtro} ${filtros.relevancia ? s.filtroActivo : ''}`}
            value={filtros.relevancia}
            onChange={(e) => cambiar('relevancia', e.target.value)}
          >
            <option value="">Relevancia: todas</option>
            {RELEVANCIAS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
            <option value="sin_evaluar">Sin evaluar</option>
          </select>
          <select
            aria-label="Filtrar por responsable"
            className={`${s.filtro} ${filtros.responsable ? s.filtroActivo : ''}`}
            value={filtros.responsable}
            onChange={(e) => cambiar('responsable', e.target.value)}
          >
            <option value="">Responsable: todos</option>
            {miembros.map((m) => (
              <option key={m.email} value={m.email}>
                {m.alias ?? m.nombre ?? m.email}
              </option>
            ))}
            <option value="sin_asignar">Sin asignar</option>
          </select>
          <button
            type="button"
            className={s.interruptor}
            aria-pressed={filtros.soloAlertas}
            onClick={() => cambiar('soloAlertas', !filtros.soloAlertas)}
            title="Mostrar solo piezas con admisibilidad cuestionada, pendientes de resolución o excluidas"
          >
            <TriangleAlert aria-hidden />
            Con alerta procesal{conAlerta ? ` · ${conAlerta}` : ''}
          </button>
          {hayFiltros && (
            <button type="button" className={s.limpiar} onClick={() => setFiltros(SIN_FILTROS)}>
              Limpiar filtros
            </button>
          )}
          <div className={s.derecha}>
            <div className={s.segmento} role="group" aria-label="Densidad de la tabla">
              <button type="button" aria-pressed={densidad === 'comoda'} onClick={() => setDensidad('comoda')}>
                Cómoda
              </button>
              <button type="button" aria-pressed={densidad === 'compacta'} onClick={() => setDensidad('compacta')}>
                Compacta
              </button>
            </div>
          </div>
        </div>

        <div className={s.tabla}>
          {error ? (
            <div style={{ padding: 'var(--esp-6)' }}>
              <AvisoError titulo="No pudimos traer el índice" accion={<Boton onClick={reintentar}>Probar de nuevo</Boton>}>
                {error.message}
              </AvisoError>
            </div>
          ) : cargando ? (
            <FilasEsqueleto filas={8} />
          ) : filas.length === 0 ? (
            <div className={s.vacio}>
              <EstadoVacio
                icono={<FileSearch />}
                ilustracion="vacio-indice"
                titulo="Todavía no hay piezas en esta causa"
                accion={
                  <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
                    Cargar la primera pieza
                  </Boton>
                }
              >
                Cargá cada documento, informe o conversación como una fila, con su número de orden y el link al Drive.
                Lo que cargues le aparece al resto del equipo al instante.
              </EstadoVacio>
            </div>
          ) : visibles.length === 0 ? (
            <div className={s.vacio}>
              <EstadoVacio
                icono={<Search />}
                ilustracion="vacio-busqueda"
                titulo="Ninguna pieza coincide"
                accion={<Boton onClick={() => setFiltros(SIN_FILTROS)}>Limpiar filtros</Boton>}
              >
                Probá con otra palabra o sacá algún filtro. La búsqueda no distingue tildes ni mayúsculas.
              </EstadoVacio>
            </div>
          ) : (
            <TablaPiezas
              filas={visibles}
              seleccionada={seleccionada}
              onSeleccionar={(id) => seleccionar(id)}
              densidad={densidad}
              viendo={viendoPorPieza}
              recienLlegadas={recienLlegadas}
            />
          )}
        </div>

        <footer className={s.pie}>
          <span>
            {hayFiltros ? `${visibles.length} de ${filas.length} piezas` : `${filas.length} ${filas.length === 1 ? 'pieza' : 'piezas'}`} · orden
            jerárquico por Nº
          </span>
          <span className={`${s.enVivo} ${conectado === 'desconectado' ? s.desconectado : ''}`}>
            {conectado === 'desconectado' ? 'Reconectando… los cambios de otros aparecen al volver' : 'En vivo: los cambios del equipo aparecen solos'}
          </span>
        </footer>
      </div>

      {piezaAbierta && (
        <FichaPieza
          key={piezaAbierta.id}
          pieza={piezaAbierta}
          causa={causa}
          editarAlAbrir={editarAlAbrir === piezaAbierta.id}
          onCerrar={() => seleccionar(null)}
        />
      )}

      <NuevaPieza
        abierto={creando}
        causaId={causa.id}
        numeroSugerido={siguienteNumero}
        onCerrar={() => setCreando(false)}
        onCreada={(id) => {
          setCreando(false);
          setEditarAlAbrir(id);
          seleccionar(id);
        }}
      />
    </div>
  );
}
