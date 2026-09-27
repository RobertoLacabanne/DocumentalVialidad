import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Check,
  ExternalLink,
  FileUp,
  MessagesSquare,
  PenLine,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Trophy,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boton, clasesBoton } from '../componentes/Boton';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { CampoEditable, Nada, Seccion, TextoInterpretacion } from '../componentes/Ficha';
import { Avatar, Chip, Falta, Fojas, Sello } from '../componentes/marcas';
import { usePersonas } from '../datos/causa';
import { useDirectorio, useHistorial } from '../datos/consultas';
import { useGuardado } from '../datos/guardado';
import { useContrataciones, useMensajesPorId, usePiezasRef, useVinculos, vinculosDe, type ContratacionVista } from '../datos/hechos';
import { diferenciaPorcentual, formatoPesos, montoEditable } from '../lib/contrataciones';
import { CAMPOS, valorLegible } from '../lib/etiquetas';
import { fechaCorta } from '../lib/informe';
import { haceCuanto } from '../lib/tiempo';
import type { Oferta, PasoTramite } from '../lib/tipos';
import { CabeceraCausa } from './CabeceraCausa';
import { DialogoOferta, DialogoPaso, NuevaContratacion, guardarMonto } from './DialogosContratacion';
import { useCausaActual } from './Marco';
import s from './Contrataciones.module.css';
import si from './Indice.module.css';

const PRECISION_CORTA: Record<string, string> = { mes: 'mes', anio: 'año', aproximada: 'aprox.', sin_fecha: 'sin fecha' };

export function Contrataciones() {
  const { causa } = useCausaActual();
  const { filas, cargando, error } = useContrataciones(causa.id);
  const [params, setParams] = useSearchParams();
  const [texto, setTexto] = useState('');
  const [creando, setCreando] = useState(false);
  const elegida = params.get('c');

  const abrir = (id: string | null) => {
    const nuevos = new URLSearchParams(params);
    if (id) nuevos.set('c', id);
    else nuevos.delete('c');
    setParams(nuevos, { replace: true });
  };

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter((c) => [c.identificador, c.expediente, c.objeto, c.tipo_procedimiento, ...c.ofertas.map((o) => o.oferente_texto)].some((x) => x?.toLowerCase().includes(t)));
  }, [filas, texto]);

  const actual = filas.find((c) => c.id === elegida) ?? null;

  return (
    <div className={`${si.pantalla}`}>
      <div className={`${si.principal} ${s.pantalla}`}>
        <CabeceraCausa causa={causa} />
        <div className={si.vista}>
          <div>
            <h2 className={si.titulo}>Contrataciones</h2>
            <p className={si.bajada}>Cada licitación con su trámite a fojas, el cuadro de ofertas y la prueba que la respalda.</p>
          </div>
          <div className={si.acciones}>
            <Link to="../importar-contrataciones" relative="path" className={clasesBoton()} style={{ textDecoration: 'none' }}>
              <FileUp aria-hidden /> Importar planilla
            </Link>
            <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
              Nueva contratación
            </Boton>
          </div>
        </div>

        {error ? (
          <div style={{ padding: 'var(--esp-6)' }}>
            <AvisoError titulo="No pudimos traer las contrataciones">{error.message}</AvisoError>
          </div>
        ) : cargando ? (
          <FilasEsqueleto filas={5} />
        ) : filas.length === 0 ? (
          <div className={s.vacio}>
            <EstadoVacio
              icono={<ScrollText />}
              titulo="Todavía no hay contrataciones"
              accion={
                <div className={si.acciones}>
                  <Link to="../importar-contrataciones" relative="path" className={clasesBoton('primario')} style={{ textDecoration: 'none' }}>
                    <FileUp aria-hidden /> Importar EXPEDIENTES DE CONTRATACIÓN
                  </Link>
                  <Boton icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
                    Cargar una a mano
                  </Boton>
                </div>
              }
            >
              La planilla tiene una hoja por licitación, con el trámite paso a paso. La app la lee tal cual y te muestra qué entra antes de guardar.
            </EstadoVacio>
          </div>
        ) : (
          <div className={`${s.cuerpo} ${actual ? s.conDetalle : ''}`}>
            <nav className={s.lista} aria-label="Contrataciones de la causa">
              <label className={`${si.buscar} ${s.buscar}`}>
                <Search aria-hidden />
                <span className="visualmente-oculto">Buscar contratación</span>
                <input type="search" placeholder="LP, expediente, oferente…" value={texto} onChange={(e) => setTexto(e.target.value)} />
              </label>
              <ul>
                {visibles.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={`${s.item} ${c.id === elegida ? s.itemActivo : ''}`} aria-current={c.id === elegida ? 'true' : undefined} onClick={() => abrir(c.id)}>
                      <span className={s.itemCabecera}>
                        <span className={s.itemIdentificador}>{c.identificador}</span>
                        {c.expediente && <span className={s.itemExpediente}>Expte. {c.expediente}</span>}
                      </span>
                      {c.objeto && <span className={s.itemObjeto}>{c.objeto}</span>}
                      <span className={s.itemMeta}>
                        <span>
                          {c.pasos.length} {c.pasos.length === 1 ? 'paso' : 'pasos'}
                        </span>
                        <span>
                          {c.ofertas.length} {c.ofertas.length === 1 ? 'oferta' : 'ofertas'}
                        </span>
                        {c.presupuesto_oficial !== null && <span className="cifras">{formatoPesos(c.presupuesto_oficial)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                {visibles.length === 0 && <li className={s.sinCoincidencias}>Ninguna coincide con «{texto}».</li>}
              </ul>
            </nav>

            {actual ? (
              <Detalle key={actual.id} c={actual} onVolver={() => abrir(null)} />
            ) : (
              <div className={s.elegir}>
                <EstadoVacio icono={<ScrollText />} titulo="Elegí una contratación">
                  Vas a ver el trámite completo a fojas, el cuadro comparativo de ofertas y los mensajes y piezas que la prueban.
                </EstadoVacio>
              </div>
            )}
          </div>
        )}
      </div>

      <NuevaContratacion abierto={creando} causaId={causa.id} existentes={filas} onCerrar={() => setCreando(false)} onCreada={(id) => { setCreando(false); abrir(id); }} />
    </div>
  );
}

function Detalle({ c, onVolver }: { c: ContratacionVista; onVolver: () => void }) {
  const { guardarCampo } = useGuardado();
  const [editando, setEditando] = useState(false);
  const [paso, setPaso] = useState<PasoTramite | 'nuevo' | null>(null);
  const [oferta, setOferta] = useState<Oferta | 'nueva' | null>(null);
  const guardar = (campo: string) => (nuevo: string | null, anterior: string | null) => guardarCampo('contratacion', c.id, campo, anterior, nuevo);
  const { filas: personas } = usePersonas(c.causa_id);
  const adjudicatario = c.adjudicatario_id ? personas.find((p) => p.id === c.adjudicatario_id) : undefined;

  return (
    <article className={s.detalle} aria-label={`Contratación ${c.identificador}`}>
      <button type="button" className={s.volver} onClick={onVolver}>
        <ArrowLeft aria-hidden /> Todas las contrataciones
      </button>

      <header className={s.cabecera}>
        <div className={s.cabeceraTexto}>
          <span className="rotulo">{c.tipo_procedimiento ?? 'Contratación'}</span>
          <h3 className={s.identificador}>{c.identificador}</h3>
          <div className={s.meta}>
            {c.expediente ? (
              <span className={s.expediente}>
                <i>Expte.</i> {c.expediente}
              </span>
            ) : (
              <Falta texto="[completar: expediente]" />
            )}
            {(c.fecha_inicio || c.fecha_inicio_texto) && (
              <span className={s.metaDato}>
                <CalendarDays aria-hidden /> Inicio: {c.fecha_inicio ? fechaCorta(c.fecha_inicio) : c.fecha_inicio_texto}
              </span>
            )}
            {c.fecha_apertura && (
              <span className={s.metaDato}>
                <CalendarCheck aria-hidden /> Apertura: {fechaCorta(c.fecha_apertura)}
              </span>
            )}
            {c.link && (
              <a href={c.link} target="_blank" rel="noreferrer" className={s.metaDato}>
                <ExternalLink aria-hidden /> Abrir el expediente
              </a>
            )}
          </div>
          {!editando && (c.objeto ? <p className={s.objeto}>{c.objeto}</p> : <p className={s.objetoVacio}>Sin objeto cargado. Tocá «Editar datos» para completarlo.</p>)}
        </div>
        <Boton icono={editando ? <Check aria-hidden /> : <Pencil aria-hidden />} variante={editando ? 'primario' : 'secundario'} onClick={() => setEditando((v) => !v)}>
          {editando ? 'Listo' : 'Editar datos'}
        </Boton>
      </header>

      {editando ? (
        <section className={s.edicion} aria-label="Datos de la contratación">
          <div className={s.edicionFila}>
            <CampoEditable campo="identificador" etiqueta="Identificador" valor={c.identificador} permitirVacio={false} onGuardar={guardar('identificador')} />
            <CampoEditable campo="expediente" etiqueta="Expediente" valor={c.expediente} onGuardar={guardar('expediente')} />
            <CampoEditable campo="tipo_procedimiento" etiqueta="Tipo de procedimiento" valor={c.tipo_procedimiento} onGuardar={guardar('tipo_procedimiento')} />
          </div>
          <CampoEditable campo="objeto" etiqueta="Objeto" tipo="textoLargo" valor={c.objeto} onGuardar={guardar('objeto')} />
          <div className={s.edicionFila}>
            <CampoEditable campo="presupuesto_oficial" etiqueta="Presupuesto oficial ($)" valor={montoEditable(c.presupuesto_oficial) || null} onGuardar={guardarMonto(guardarCampo, 'contratacion', c.id, 'presupuesto_oficial', c.presupuesto_oficial)} />
            <CampoEditable campo="reserva_presupuestaria" etiqueta="Reserva presupuestaria ($)" valor={montoEditable(c.reserva_presupuestaria) || null} onGuardar={guardarMonto(guardarCampo, 'contratacion', c.id, 'reserva_presupuestaria', c.reserva_presupuestaria)} />
            <CampoEditable campo="monto_adjudicado" etiqueta="Monto adjudicado ($)" valor={montoEditable(c.monto_adjudicado) || null} onGuardar={guardarMonto(guardarCampo, 'contratacion', c.id, 'monto_adjudicado', c.monto_adjudicado)} />
          </div>
          <div className={s.edicionFila}>
            <CampoEditable campo="fecha_inicio" etiqueta="Fecha de inicio" tipo="fecha" valor={c.fecha_inicio} onGuardar={guardar('fecha_inicio')} />
            <CampoEditable campo="fecha_apertura" etiqueta="Apertura de sobres" tipo="fecha" valor={c.fecha_apertura} onGuardar={guardar('fecha_apertura')} />
            <CampoEditable campo="link" etiqueta="Link al expediente" valor={c.link} onGuardar={guardar('link')} />
          </div>
          <CampoEditable campo="observaciones" etiqueta="Observaciones del analista" tipo="textoLargo" interpretacion valor={c.observaciones} onGuardar={guardar('observaciones')} />
        </section>
      ) : (
        <>
          <dl className={s.montos}>
            <Monto etiqueta="Presupuesto oficial" valor={c.presupuesto_oficial} />
            <Monto etiqueta="Reserva presupuestaria" valor={c.reserva_presupuestaria} />
            <Monto etiqueta="Adjudicado" valor={c.monto_adjudicado}>
              {adjudicatario && (
                <Link to={`../personas?persona=${adjudicatario.id}`} relative="path" className={s.adjudicatario}>
                  {adjudicatario.nombre}
                </Link>
              )}
            </Monto>
          </dl>
          {c.observaciones && (
            <div className={s.analisis}>
              <Seccion titulo="Observaciones del analista" naturaleza="interpretacion">
                <TextoInterpretacion>{c.observaciones}</TextoInterpretacion>
              </Seccion>
            </div>
          )}
        </>
      )}

      <Ofertas c={c} onEditar={(o) => setOferta(o)} onNueva={() => setOferta('nueva')} />

      <div className={s.columnas}>
        <section className={s.bloque} aria-label="Trámite">
          <div className={s.bloqueCabecera}>
            <h4 className={s.bloqueTitulo}>Trámite</h4>
            <span className={s.bloqueCuenta}>{c.pasos.length} pasos</span>
            <Boton tamano="chico" icono={<Plus aria-hidden />} onClick={() => setPaso('nuevo')}>
              Agregar paso
            </Boton>
          </div>
          {c.pasos.length === 0 ? (
            <p className={s.bloqueVacio}>Sin pasos cargados. Cada paso lleva la foja, la fecha tal cual figura y quién firma.</p>
          ) : (
            <ol className={s.tramite}>
              {c.pasos.map((p) => (
                <li key={p.id} className={s.paso}>
                  <div className={s.pasoFecha}>
                    {p.fecha_texto ?? (p.fecha ? fechaCorta(p.fecha) : <span className={s.tenue}>sin fecha</span>)}
                    {p.fecha_precision !== 'dia' && p.fecha_texto && <span className={s.precision}>{PRECISION_CORTA[p.fecha_precision]}</span>}
                  </div>
                  <div className={s.pasoCuerpo}>
                    <div className={s.pasoTitulo}>
                      <Fojas fojas={p.fojas} />
                      <strong>{p.descripcion}</strong>
                      <button type="button" className={s.pasoEditar} onClick={() => setPaso(p)} aria-label={`Editar el paso ${p.descripcion}`} title="Editar">
                        <Pencil aria-hidden />
                      </button>
                    </div>
                    {(p.firmante_texto || p.cargo) && (
                      <span className={s.firmante}>
                        <PenLine aria-hidden /> {[p.firmante_texto, p.cargo].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {p.observaciones && <p className={s.pasoObservaciones}>{p.observaciones}</p>}
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noreferrer" className={s.enlace}>
                        <ExternalLink aria-hidden /> Ver el documento
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className={s.lateral}>
          <PruebaVinculada c={c} />
          <Historial id={c.id} />
        </div>
      </div>

      <DialogoPaso key={paso === 'nuevo' ? 'nuevo' : (paso?.id ?? 'ninguno')} abierto={paso !== null} contratacion={c} paso={paso === 'nuevo' ? null : paso} onCerrar={() => setPaso(null)} />
      <DialogoOferta key={oferta === 'nueva' ? 'nueva' : (oferta?.id ?? 'ninguna')} abierto={oferta !== null} contratacion={c} oferta={oferta === 'nueva' ? null : oferta} onCerrar={() => setOferta(null)} />
    </article>
  );
}

function Monto({ etiqueta, valor, children }: { etiqueta: string; valor: number | null; children?: ReactNode }) {
  return (
    <div className={s.monto}>
      <dt>{etiqueta}</dt>
      <dd className="cifras">{valor === null ? <Falta /> : formatoPesos(valor)}</dd>
      {children && <dd className={s.montoDetalle}>{children}</dd>}
    </div>
  );
}

function Ofertas({ c, onEditar, onNueva }: { c: ContratacionVista; onEditar: (o: Oferta) => void; onNueva: () => void }) {
  const conMonto = c.ofertas.filter((o) => o.monto !== null);
  const menor = conMonto.length > 1 ? Math.min(...conMonto.map((o) => o.monto!)) : null;
  return (
    <section className={s.bloque} aria-label="Cuadro de ofertas">
      <div className={s.bloqueCabecera}>
        <h4 className={s.bloqueTitulo}>Cuadro de ofertas</h4>
        <span className={s.bloqueCuenta}>{c.ofertas.length}</span>
        <Boton tamano="chico" icono={<Plus aria-hidden />} onClick={onNueva}>
          Agregar
        </Boton>
      </div>
      {c.ofertas.length === 0 ? (
        <p className={s.bloqueVacio}>Sin ofertas cargadas.</p>
      ) : (
        <table className={s.ofertas}>
          <thead>
            <tr>
              <th>Oferente</th>
              <th className={s.derecha}>Monto ofertado</th>
              <th className={s.derecha} title="Diferencia contra el presupuesto oficial">
                vs. presupuesto oficial
              </th>
            </tr>
          </thead>
          <tbody>
            {c.ofertas.map((o) => {
              const dif = diferenciaPorcentual(o.monto, c.presupuesto_oficial);
              const esMenor = menor !== null && o.monto === menor;
              return (
                <tr key={o.id} className={esMenor ? s.menor : undefined} tabIndex={0} onClick={() => onEditar(o)} onKeyDown={(e) => (e.key === 'Enter' ? onEditar(o) : undefined)}>
                  <td>
                    <span className={s.oferente}>{o.oferente_texto ?? <Falta texto="[completar: oferente]" />}</span>
                    {o.observaciones && <span className={s.ofertaObservaciones}>{o.observaciones}</span>}
                    <span className={s.ofertaMeta}>
                      {o.fojas && <Fojas fojas={o.fojas} />}
                      {esMenor && (
                        <span className={s.menorChip}>
                          <Trophy aria-hidden /> menor oferta
                        </span>
                      )}
                      {o.link && (
                        <a href={o.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={s.enlace}>
                          <ExternalLink aria-hidden /> ver
                        </a>
                      )}
                    </span>
                  </td>
                  <td className={`${s.derecha} cifras`}>{o.monto === null ? <Falta /> : formatoPesos(o.monto)}</td>
                  <td className={`${s.derecha} cifras ${dif !== null && dif > 0 ? s.arriba : ''}`}>
                    {dif === null ? <Nada /> : `${dif > 0 ? '+' : ''}${dif.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {c.ofertas.some((o) => o.monto === null) && <p className={s.nota}>Los montos que faltan se completan tocando la oferta. La app no los deduce de las observaciones sin que alguien los confirme.</p>}
    </section>
  );
}

function PruebaVinculada({ c }: { c: ContratacionVista }) {
  const vinculos = useVinculos(c.causa_id);
  const piezas = usePiezasRef(c.causa_id);
  const propios = vinculosDe(vinculos, c.id);
  const mapaPiezas = new Map(piezas.map((p) => [p.id, p]));
  const idsPiezas = propios.filter((v) => mapaPiezas.has(v.otro)).map((v) => v.otro);
  const idsResto = propios.filter((v) => !mapaPiezas.has(v.otro)).map((v) => v.otro);
  const mensajes = useMensajesPorId(idsResto);
  return (
    <section className={s.bloque} aria-label="Prueba vinculada">
      <div className={s.bloqueCabecera}>
        <h4 className={s.bloqueTitulo}>Prueba vinculada</h4>
        <span className={s.bloqueCuenta}>{mensajes.length + idsPiezas.length}</span>
      </div>
      {mensajes.length === 0 && idsPiezas.length === 0 ? (
        <p className={s.bloqueVacio}>
          Todavía no hay mensajes ni piezas vinculados. Desde{' '}
          <Link to="../mensajes" relative="path">
            Mensajes
          </Link>
          , abrí un mensaje y vinculalo a {c.identificador}.
        </p>
      ) : (
        <ul className={s.prueba}>
          {mensajes.map((m) => (
            <li key={m.id}>
              <Link to={`../mensajes?mensaje=${m.id}`} relative="path" className={s.pruebaMensaje}>
                <span className={s.pruebaCabecera}>
                  <MessagesSquare aria-hidden />
                  <strong>{m.emisor ?? '¿?'}</strong> → {m.receptor ?? '¿?'}
                  <span className={s.tenue}>{m.fecha ? fechaCorta(m.fecha) : m.fecha_hora_texto}</span>
                </span>
                <span className={s.pruebaTexto}>{m.contenido}</span>
              </Link>
            </li>
          ))}
          {idsPiezas.map((id) => {
            const p = mapaPiezas.get(id)!;
            return (
              <li key={id}>
                <Link to={`../indice?pieza=${id}`} relative="path" className={s.pruebaPieza}>
                  <Sello numero={p.numero_orden} />
                  <span>{p.titulo}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Historial({ id }: { id: string }) {
  const { data: historial = [] } = useHistorial(id);
  const directorio = useDirectorio();
  if (!historial.length) return null;
  return (
    <section className={s.bloque} aria-label="Historial">
      <div className={s.bloqueCabecera}>
        <h4 className={s.bloqueTitulo}>Historial</h4>
      </div>
      <ol className={s.historial}>
        {historial.slice(0, 8).map((e) => {
          const quien = e.usuario_email ? directorio.alias(e.usuario_email) : 'Sistema';
          return (
            <li key={e.id}>
              <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
              <div>
                <b>{quien}</b> {e.accion === 'alta' && 'la cargó'}
                {e.accion === 'archivo' && 'la archivó'}
                {e.accion === 'edicion' &&
                  Object.entries(e.cambios).map(([campo, v], i) => (
                    <span key={campo}>
                      {i > 0 && ' · '}cambió <em>{CAMPOS[campo] ?? campo}</em>: <s>{valorLegible(campo, v.antes)}</s> → {valorLegible(campo, v.despues)}
                    </span>
                  ))}
                <time dateTime={e.ocurrido_en}>{haceCuanto(e.ocurrido_en)}</time>
              </div>
            </li>
          );
        })}
      </ol>
      <Chip familia="contratacion">{historial.length} cambios registrados</Chip>
    </section>
  );
}
