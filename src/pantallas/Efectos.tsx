import { FileUp, LayoutGrid, Package, Plus, Rows3, Search, TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boton, clasesBoton } from '../componentes/Boton';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { Avatar, EstadoProcesal, EtiquetaEfecto } from '../componentes/marcas';
import { MenuExportar } from '../componentes/MenuExportar';
import { TarjetaKanban } from '../componentes/TarjetaKanban';
import { useToast } from '../componentes/Toast';
import { useEfectos, type EfectoVista } from '../datos/causa';
import { useDirectorio } from '../datos/consultas';
import { useGuardado } from '../datos/guardado';
import {
  APTO_ETIQUETA,
  COLUMNAS_TABLERO,
  ESTADOS_EFECTO,
  MATERIALES_ETIQUETA,
  PRIORIDAD_ETIQUETA,
  SITUACIONES,
  SOPORTE_ETIQUETA,
} from '../lib/etiquetas';
import { descargarCsv, descargarXlsx, nombreArchivo, type Columna } from '../lib/exportar';
import { claveNombre } from '../lib/nombres';
import { fechaCorta } from '../lib/tiempo';
import type { EstadoEfecto } from '../lib/tipos';
import { CabeceraCausa } from './CabeceraCausa';
import { DialogoIncidencia, NuevoEfecto } from './DialogosEfecto';
import { FichaEfecto, etiquetaProcedimiento } from './FichaEfecto';
import { useCausaActual } from './Marco';
import s from './Efectos.module.css';
import si from './Indice.module.css';

type Vista = 'tablero' | 'tabla';
type Filtros = { texto: string; soporte: string; responsable: string; procedimiento: string; soloAlertas: boolean };
const SIN_FILTROS: Filtros = { texto: '', soporte: '', responsable: '', procedimiento: '', soloAlertas: false };

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function leerVista(): Vista {
  try {
    return localStorage.getItem('tp-vista-efectos') === 'tabla' ? 'tabla' : 'tablero';
  } catch {
    return 'tablero';
  }
}

/** Clave de agrupamiento: el allanamiento si lo hay; si no, el origen escrito en la planilla. */
function grupoDe(e: EfectoVista): { clave: string; fecha: string | null; lugar: string } {
  if (e.procedimiento) return { clave: e.procedimiento.id, fecha: e.procedimiento.fecha, lugar: e.procedimiento.domicilio ?? 'Sin domicilio' };
  if (e.lugar_secuestro) return { clave: `origen:${claveNombre(e.lugar_secuestro)}`, fecha: null, lugar: e.lugar_secuestro.trim() };
  return { clave: 'sin-origen', fecha: null, lugar: 'Sin procedimiento ni origen cargado' };
}

export function Efectos() {
  const { causa } = useCausaActual();
  const directorio = useDirectorio();
  const { guardarCampo } = useGuardado();
  const { avisar } = useToast();
  const { filas, procedimientos, cargando, error, reintentar } = useEfectos(causa.id);
  const [params, setParams] = useSearchParams();
  const abierto = params.get('efecto');
  const [vista, setVistaEstado] = useState<Vista>(leerVista);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [sobre, setSobre] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [marcando, setMarcando] = useState(false);
  const [creando, setCreando] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);

  const setVista = (v: Vista) => {
    setVistaEstado(v);
    try {
      localStorage.setItem('tp-vista-efectos', v);
    } catch {
      /* preferencia solo en memoria */
    }
  };

  const cambiar = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) => setFiltros((f) => ({ ...f, [clave]: valor }));

  const visibles = useMemo(() => {
    const terminos = normalizar(filtros.texto).split(/\s+/).filter(Boolean);
    return filas.filter((e) => {
      if (filtros.soporte && e.soporte !== filtros.soporte) return false;
      if (filtros.responsable === 'sin_asignar') {
        if (e.responsable || e.responsable_alias || !e.requiere_escribiente) return false;
      } else if (filtros.responsable && e.responsable !== filtros.responsable) return false;
      if (filtros.procedimiento && grupoDe(e).clave !== filtros.procedimiento) return false;
      if (filtros.soloAlertas && !e.situacion) return false;
      if (terminos.length) {
        const texto = normalizar(
          [
            e.numero,
            e.descripcion_acta,
            e.propietario,
            e.tenedor,
            e.lugar_secuestro,
            e.observaciones,
            e.observaciones_gabinete,
            e.ubicacion_fisica,
            e.numero_interno,
            e.sobre,
            e.informe_numero,
            e.responsable_alias,
            e.procedimiento?.domicilio,
          ]
            .filter(Boolean)
            .join(' '),
        );
        if (!terminos.every((t) => texto.includes(t))) return false;
      }
      return true;
    });
  }, [filas, filtros]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { clave: string; fecha: string | null; lugar: string; efectos: EfectoVista[] }>();
    for (const e of visibles) {
      const g = grupoDe(e);
      if (!mapa.has(g.clave)) mapa.set(g.clave, { ...g, efectos: [] });
      mapa.get(g.clave)!.efectos.push(e);
    }
    return [...mapa.values()].sort((a, b) => {
      if (a.clave === 'sin-origen') return 1;
      if (b.clave === 'sin-origen') return -1;
      if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
      if (a.fecha) return -1;
      if (b.fecha) return 1;
      return a.lugar.localeCompare(b.lugar, 'es');
    });
  }, [visibles]);

  const opcionesGrupo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const e of filas) {
      const g = grupoDe(e);
      if (!mapa.has(g.clave)) mapa.set(g.clave, [g.fecha ? fechaCorta(g.fecha) : null, g.lugar].filter(Boolean).join(' · '));
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [filas]);

  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(SIN_FILTROS);
  const conAlerta = filas.filter((e) => e.situacion).length;
  const efectoAbierto = filas.find((e) => e.id === abierto) ?? null;

  const abrir = (id: string | null) => {
    const nuevos = new URLSearchParams(params);
    if (id) nuevos.set('efecto', id);
    else nuevos.delete('efecto');
    setParams(nuevos, { replace: true });
  };

  const responsableDe = (e: EfectoVista) => {
    if (e.responsable) return { alias: directorio.alias(e.responsable), email: e.responsable };
    if (e.responsable_alias) return { alias: e.responsable_alias, email: null };
    return null;
  };

  async function mover(id: string, estado: EstadoEfecto) {
    const e = filas.find((x) => x.id === id);
    if (!e || e.estado === estado) return;
    const r = await guardarCampo('efecto', id, 'estado', e.estado, estado);
    if (r.tipo === 'ok') avisar(`Efecto Nº ${e.numero}: ${ESTADOS_EFECTO[estado].toLowerCase()}.`);
    else if (r.tipo === 'conflicto') avisar(`${r.quien} ya había movido el efecto Nº ${e.numero}. Quedó como lo dejó.`, { tono: 'aviso' });
    else avisar(r.mensaje, { tono: 'error' });
  }

  const soltar = (estado: EstadoEfecto) => (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    setSobre(null);
    const id = ev.dataTransfer.getData('text/efecto');
    if (id) void mover(id, estado);
  };

  const alternar = (ids: string[], marcar: boolean) =>
    setMarcados((prev) => {
      const nuevo = new Set(prev);
      for (const id of ids) {
        if (marcar) nuevo.add(id);
        else nuevo.delete(id);
      }
      return nuevo;
    });

  const teclaFila = (id: string) => (ev: KeyboardEvent<HTMLTableRowElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      abrir(id);
    }
  };

  const columnasExportar: Columna<EfectoVista>[] = [
    { titulo: 'Nº de efecto', valor: (e) => e.numero, ancho: 12 },
    { titulo: 'Soporte', valor: (e) => (e.soporte ? SOPORTE_ETIQUETA[e.soporte] : ''), ancho: 12 },
    { titulo: 'Tipo de material', valor: (e) => (e.tipo_material ? MATERIALES_ETIQUETA[e.tipo_material] ?? e.tipo_material : ''), ancho: 18 },
    { titulo: 'Descripción según el acta', valor: (e) => e.descripcion_acta, ancho: 60 },
    { titulo: 'Procedimiento', valor: (e) => etiquetaProcedimiento(e.procedimiento) ?? e.lugar_secuestro, ancho: 40 },
    { titulo: 'Propietario', valor: (e) => e.propietario, ancho: 24 },
    { titulo: 'Tenedor', valor: (e) => e.tenedor, ancho: 24 },
    { titulo: 'Estado', valor: (e) => ESTADOS_EFECTO[e.estado], ancho: 14 },
    { titulo: 'Responsable', valor: (e) => responsableDe(e)?.alias ?? (e.requiere_escribiente ? 'Sin asignar' : 'No requiere escribiente'), ancho: 16 },
    { titulo: '¿Apto para analizar?', valor: (e) => (e.apto_analisis ? APTO_ETIQUETA[e.apto_analisis] : ''), ancho: 20 },
    { titulo: 'Prioridad', valor: (e) => (e.prioridad ? PRIORIDAD_ETIQUETA[e.prioridad] : ''), ancho: 10 },
    { titulo: 'Fojas aprox.', valor: (e) => e.fojas_aprox, ancho: 10 },
    { titulo: 'Informe del gabinete', valor: (e) => e.informe_numero ?? (e.tiene_informe_gabinete ? 'Sí' : e.tiene_informe_gabinete === false ? 'No' : ''), ancho: 14 },
    { titulo: 'Observaciones del gabinete', valor: (e) => e.observaciones_gabinete, ancho: 36 },
    { titulo: 'Ubicación', valor: (e) => e.ubicacion_fisica, ancho: 18 },
    { titulo: 'Link del escaneo', valor: (e) => e.link_escaneo, ancho: 30 },
    { titulo: 'Situación procesal', valor: (e) => (e.situacion ? `${SITUACIONES[e.situacion.situacion]}: ${e.situacion.titulo}` : ''), ancho: 30 },
    { titulo: 'Piezas cargadas', valor: (e) => e.piezas, ancho: 10 },
    { titulo: 'Observaciones', valor: (e) => e.observaciones, ancho: 36 },
  ];
  const archivo = nombreArchivo('Efectos', causa.legajo_fiscalia);

  const marcadosVisibles = visibles.filter((e) => marcados.has(e.id));

  return (
    <div className={`${si.pantalla} ${efectoAbierto ? si.conPanel : ''}`}>
      <div className={`${si.principal} ${s.desplazable}`}>
        <CabeceraCausa causa={causa} />

        <div className={si.vista}>
          <div>
            <h2 className={si.titulo}>Efectos secuestrados</h2>
            <p className={si.bajada}>Cada cosa secuestrada, de qué allanamiento salió, en qué estado está y quién la trabaja.</p>
          </div>
          <div className={si.acciones}>
            <div className={`${si.segmento} ${s.vistas}`} role="group" aria-label="Cómo ver los efectos">
              <button type="button" aria-pressed={vista === 'tablero'} onClick={() => setVista('tablero')}>
                <LayoutGrid aria-hidden />
                Tablero
              </button>
              <button type="button" aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>
                <Rows3 aria-hidden />
                Por allanamiento
              </button>
            </div>
            <MenuExportar
              cantidad={visibles.length}
              onExcel={() => descargarXlsx(visibles, columnasExportar, archivo, 'Efectos')}
              onCsv={() => descargarCsv(visibles, columnasExportar, archivo)}
            />
            <Link to="../importar" relative="path" className={clasesBoton('secundario')} style={{ textDecoration: 'none' }}>
              <FileUp aria-hidden /> Importar planilla
            </Link>
            <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
              Nuevo efecto
            </Boton>
          </div>
        </div>

        <div className={si.filtros}>
          <label className={si.buscar}>
            <Search aria-hidden />
            <span className="visualmente-oculto">Buscar en los efectos</span>
            <input
              ref={buscador}
              type="search"
              placeholder="Nº, descripción, propietario, observaciones…"
              value={filtros.texto}
              onChange={(e) => cambiar('texto', e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por soporte"
            className={`${si.filtro} ${filtros.soporte ? si.filtroActivo : ''}`}
            value={filtros.soporte}
            onChange={(e) => cambiar('soporte', e.target.value)}
          >
            <option value="">Papel y dispositivos</option>
            <option value="papel">Solo papel</option>
            <option value="digital">Solo dispositivos</option>
          </select>
          <select
            aria-label="Filtrar por responsable"
            className={`${si.filtro} ${filtros.responsable ? si.filtroActivo : ''}`}
            value={filtros.responsable}
            onChange={(e) => cambiar('responsable', e.target.value)}
          >
            <option value="">Responsable: todos</option>
            {directorio.miembros.map((m) => (
              <option key={m.email} value={m.email}>
                {directorio.alias(m.email)}
              </option>
            ))}
            <option value="sin_asignar">Sin asignar</option>
          </select>
          <select
            aria-label="Filtrar por procedimiento"
            className={`${si.filtro} ${filtros.procedimiento ? si.filtroActivo : ''}`}
            value={filtros.procedimiento}
            onChange={(e) => cambiar('procedimiento', e.target.value)}
            style={{ maxWidth: 260 }}
          >
            <option value="">Procedimiento: todos</option>
            {opcionesGrupo.map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={si.interruptor}
            aria-pressed={filtros.soloAlertas}
            onClick={() => cambiar('soloAlertas', !filtros.soloAlertas)}
            title="Mostrar solo efectos con admisibilidad cuestionada, pendientes de resolución o excluidos"
          >
            <TriangleAlert aria-hidden />
            Con alerta procesal{conAlerta ? ` · ${conAlerta}` : ''}
          </button>
          {hayFiltros && (
            <button type="button" className={si.limpiar} onClick={() => setFiltros(SIN_FILTROS)}>
              Limpiar filtros
            </button>
          )}
        </div>

        {vista === 'tabla' && marcadosVisibles.length > 0 && (
          <div className={s.seleccion} role="status">
            <span>
              {marcadosVisibles.length} {marcadosVisibles.length === 1 ? 'efecto marcado' : 'efectos marcados'}
            </span>
            <Boton tamano="chico" icono={<TriangleAlert aria-hidden />} onClick={() => setMarcando(true)}>
              Marcar situación procesal
            </Boton>
            <button type="button" className={si.limpiar} onClick={() => setMarcados(new Set())}>
              Desmarcar
            </button>
          </div>
        )}

        <div className={s.contenido}>
          {error ? (
            <div style={{ padding: 'var(--esp-6)' }}>
              <AvisoError titulo="No pudimos traer los efectos" accion={<Boton onClick={reintentar}>Probar de nuevo</Boton>}>
                {error.message}
              </AvisoError>
            </div>
          ) : cargando ? (
            <FilasEsqueleto filas={8} />
          ) : filas.length === 0 ? (
            <div className={si.vacio}>
              <EstadoVacio
                icono={<Package />}
                titulo="Todavía no hay efectos cargados"
                accion={
                  <Link to="../importar" relative="path" className={clasesBoton('primario')} style={{ textDecoration: 'none' }}>
                    <FileUp aria-hidden /> Importar la planilla de efectos
                  </Link>
                }
              >
                Traé la planilla del Drive (LISTADO EFECTOS o DISTRIBUCIÓN DE TAREAS) y en cuatro pasos quedan todos los efectos cargados,
                agrupados por allanamiento. También podés cargarlos de a uno con «Nuevo efecto».
              </EstadoVacio>
            </div>
          ) : visibles.length === 0 ? (
            <div className={si.vacio}>
              <EstadoVacio icono={<Search />} titulo="Ningún efecto coincide" accion={<Boton onClick={() => setFiltros(SIN_FILTROS)}>Limpiar filtros</Boton>}>
                Probá con otra palabra o sacá algún filtro. La búsqueda no distingue tildes ni mayúsculas.
              </EstadoVacio>
            </div>
          ) : vista === 'tablero' ? (
            <div className={s.tablero}>
              {COLUMNAS_TABLERO.map((col) => {
                const enColumna = visibles.filter((e) => e.estado === col.valor);
                return (
                  <div
                    key={col.valor}
                    className={`${s.columna} ${sobre === col.valor ? s.columnaActiva : ''}`}
                    onDragOver={(ev) => {
                      if (!ev.dataTransfer.types.includes('text/efecto')) return;
                      ev.preventDefault();
                      ev.dataTransfer.dropEffect = 'move';
                      if (sobre !== col.valor) setSobre(col.valor);
                    }}
                    onDragLeave={(ev) => {
                      if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setSobre(null);
                    }}
                    onDrop={soltar(col.valor)}
                    data-columna={col.valor}
                  >
                    <div className={s.columnaCabecera}>
                      <span className={s.columnaTitulo}>{col.etiqueta}</span>
                      <span className={s.cuenta}>{enColumna.length}</span>
                    </div>
                    <div className={s.columnaLista}>
                      {enColumna.length === 0 ? (
                        <div className={s.columnaVacia}>Arrastrá acá un efecto</div>
                      ) : (
                        enColumna.map((e) => (
                          <TarjetaKanban
                            key={e.id}
                            id={e.id}
                            numero={e.numero}
                            soporte={e.soporte}
                            material={e.tipo_material && e.tipo_material !== 'dispositivo' ? MATERIALES_ETIQUETA[e.tipo_material] ?? e.tipo_material : null}
                            descripcion={e.descripcion_acta}
                            fojas={e.fojas_aprox}
                            responsable={responsableDe(e)}
                            sinEscribiente={!e.requiere_escribiente}
                            situacion={e.situacion?.situacion ?? null}
                            prioridadAlta={e.prioridad === 'alta'}
                            seleccionada={e.id === abierto}
                            piezas={e.piezas}
                            onAbrir={() => abrir(e.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={s.marcoTabla}>
              <table className={s.tabla}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <span className="visualmente-oculto">Marcar</span>
                    </th>
                    <th style={{ width: 96 }}>Efecto</th>
                    <th>Descripción según el acta</th>
                    <th style={{ width: 180 }}>Propietario / tenedor</th>
                    <th style={{ width: 128 }}>Estado</th>
                    <th style={{ width: 150 }}>Responsable</th>
                    <th style={{ width: 200 }}>Situación procesal</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => {
                    const ids = g.efectos.map((e) => e.id);
                    const todos = ids.every((id) => marcados.has(id));
                    const algunos = !todos && ids.some((id) => marcados.has(id));
                    return (
                      <FilasGrupo
                        key={g.clave}
                        fecha={g.fecha}
                        lugar={g.lugar}
                        cantidad={g.efectos.length}
                        todos={todos}
                        algunos={algunos}
                        onMarcarTodos={(v) => alternar(ids, v)}
                      >
                        {g.efectos.map((e) => {
                          const resp = responsableDe(e);
                          return (
                            <tr
                              key={e.id}
                              className={`${s.fila} ${e.id === abierto ? s.filaAbierta : ''} ${e.situacion ? s.filaAlerta : ''}`}
                              tabIndex={0}
                              onClick={() => abrir(e.id)}
                              onKeyDown={teclaFila(e.id)}
                              data-efecto={e.numero}
                            >
                              <td onClick={(ev) => ev.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className={s.casilla}
                                  aria-label={`Marcar efecto ${e.numero}`}
                                  checked={marcados.has(e.id)}
                                  onChange={(ev) => alternar([e.id], ev.target.checked)}
                                />
                              </td>
                              <td>
                                <EtiquetaEfecto numero={e.numero} />
                              </td>
                              <td data-movil="ancho">
                                <span className={s.descripcion}>{e.descripcion_acta ?? <span className={s.tenue}>[descripción según acta]</span>}</span>
                              </td>
                              <td data-movil="oculto">
                                {e.propietario ?? e.tenedor ?? <span className={s.tenue}>—</span>}
                                {e.propietario && e.tenedor && e.tenedor !== e.propietario && <div className={s.tenue}>Tenedor: {e.tenedor}</div>}
                              </td>
                              <td data-movil="esquina">
                                <span className={`${s.estadoChip} ${s[`estado_${e.estado}`] ?? ''}`}>{ESTADOS_EFECTO[e.estado]}</span>
                              </td>
                              <td data-movil="oculto">
                                {resp ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <Avatar texto={resp.alias} email={resp.email ?? resp.alias} tamano="chico" />
                                    {resp.alias}
                                  </span>
                                ) : e.requiere_escribiente ? (
                                  <span className={s.tenue}>Sin asignar</span>
                                ) : (
                                  <span className={s.tenue}>No requiere</span>
                                )}
                              </td>
                              <td data-movil="ancho">
                                {e.situacion ? (
                                  <EstadoProcesal situacion={e.situacion.situacion} detalle={e.situacion.titulo} />
                                ) : (
                                  <span className={s.tenue}>Sin incidencias</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </FilasGrupo>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className={si.pie}>
          <span>
            {hayFiltros ? `${visibles.length} de ${filas.length} efectos` : `${filas.length} ${filas.length === 1 ? 'efecto' : 'efectos'}`}
            {vista === 'tablero' ? ' · arrastrá una tarjeta para cambiarle el estado' : ` · ${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'}`}
          </span>
          <span className={si.enVivo}>En vivo: los cambios del equipo aparecen solos</span>
        </footer>
      </div>

      {efectoAbierto && <FichaEfecto key={efectoAbierto.id} efecto={efectoAbierto} procedimientos={procedimientos} onCerrar={() => abrir(null)} />}

      <NuevoEfecto
        abierto={creando}
        causaId={causa.id}
        onCerrar={() => setCreando(false)}
        onCreado={(id) => {
          setCreando(false);
          abrir(id);
        }}
      />
      <DialogoIncidencia
        abierto={marcando}
        causaId={causa.id}
        entidades={marcadosVisibles.map((e) => e.id)}
        descripcionAlcance={
          marcadosVisibles.length === 1 ? `el efecto Nº ${marcadosVisibles[0].numero}` : `${marcadosVisibles.length} efectos`
        }
        onCerrar={() => {
          setMarcando(false);
          setMarcados(new Set());
        }}
      />
    </div>
  );
}

function FilasGrupo({
  fecha,
  lugar,
  cantidad,
  todos,
  algunos,
  onMarcarTodos,
  children,
}: {
  fecha: string | null;
  lugar: string;
  cantidad: number;
  todos: boolean;
  algunos: boolean;
  onMarcarTodos: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <>
      <tr className={s.grupo}>
        <td>
          <input
            type="checkbox"
            className={s.casilla}
            aria-label={`Marcar los ${cantidad} efectos de ${lugar}`}
            checked={todos}
            ref={(el) => {
              if (el) el.indeterminate = algunos;
            }}
            onChange={(ev) => onMarcarTodos(ev.target.checked)}
          />
        </td>
        <td colSpan={6}>
          <span className={s.grupoTitulo}>
            {fecha && <span className={s.grupoFecha}>{fechaCorta(fecha)}</span>}
            <span className={s.grupoLugar}>{lugar}</span>
            <span className={s.grupoCuenta}>
              {cantidad} {cantidad === 1 ? 'efecto' : 'efectos'}
            </span>
          </span>
        </td>
      </tr>
      {children}
    </>
  );
}
