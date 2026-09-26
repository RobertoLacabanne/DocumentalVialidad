import { useQueryClient } from '@tanstack/react-query';
import { Archive, CalendarRange, ExternalLink, Plus, Printer, Sparkles } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { AreaTexto, Entrada, Selector } from '../componentes/campos';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { CampoEditable } from '../componentes/Ficha';
import { useToast } from '../componentes/Toast';
import { usePersonas } from '../datos/causa';
import { traducirError, useGuardado } from '../datos/guardado';
import { useContrataciones } from '../datos/hechos';
import { useActos, useCronologia, type ActoProcesal, type Hito } from '../datos/juicio';
import { agruparPorMes, clavesDePersona, etiquetaHito, fechaHito, mencionaPersona } from '../lib/cronologia';
import { PRECISIONES } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import { CabeceraCausa } from './CabeceraCausa';
import { useCausaActual } from './Marco';
import s from './Cronologia.module.css';
import si from './Indice.module.css';

const FILTROS_TIPO: { valor: string; etiqueta: string; tipos: string[] }[] = [
  { valor: 'pieza', etiqueta: 'Piezas', tipos: ['pieza'] },
  { valor: 'mensaje', etiqueta: 'Mensajes', tipos: ['mensaje'] },
  { valor: 'paso', etiqueta: 'Trámite', tipos: ['paso'] },
  { valor: 'allanamiento', etiqueta: 'Allanamientos', tipos: ['allanamiento'] },
  { valor: 'acto', etiqueta: 'Actos procesales', tipos: ['acto'] },
  { valor: 'planteo', etiqueta: 'Planteos', tipos: ['planteo', 'resolucion'] },
];

const TIPOS_ACTO = [
  { valor: 'audiencia', etiqueta: 'Audiencia' },
  { valor: 'resolucion', etiqueta: 'Resolución' },
  { valor: 'planteo', etiqueta: 'Planteo' },
  { valor: 'allanamiento', etiqueta: 'Allanamiento' },
  { valor: 'otro', etiqueta: 'Otro' },
];

function enlaceDe(h: Hito): string | null {
  if (h.tipo === 'pieza') return `../indice?pieza=${h.id}`;
  if (h.tipo === 'mensaje') return `../mensajes?mensaje=${h.id}`;
  if (h.tipo === 'paso' && h.referencia) return `../contrataciones?c=${h.referencia}`;
  if (h.tipo === 'allanamiento') return '../efectos';
  return null;
}

export function Cronologia() {
  const { causa } = useCausaActual();
  const { hitos, cargando, error } = useCronologia(causa.id);
  const { filas: personas } = usePersonas(causa.id);
  const { filas: contrataciones } = useContrataciones(causa.id);
  const actos = useActos(causa.id);
  const [tipos, setTipos] = useState<string[]>([]);
  const [persona, setPersona] = useState('');
  const [contratacion, setContratacion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [acto, setActo] = useState<ActoProcesal | 'nuevo' | null>(null);

  const claves = useMemo(() => {
    const p = personas.find((x) => x.id === persona);
    return p ? clavesDePersona({ nombre: p.nombre, tipo_persona: p.tipo_persona, alias: p.identificadores.filter((i) => i.tipo === 'alias_agendado').map((i) => i.valor) }) : [];
  }, [personas, persona]);

  const activos = FILTROS_TIPO.filter((f) => tipos.includes(f.valor)).flatMap((f) => f.tipos);
  const visibles = hitos.filter(
    (h) =>
      (!activos.length || activos.includes(h.tipo)) &&
      (!contratacion || h.relacionados.includes(contratacion)) &&
      (!persona || mencionaPersona(`${h.titulo} ${h.detalle ?? ''}`, claves)) &&
      (!desde || h.fecha >= desde) &&
      (!hasta || h.fecha <= hasta),
  );
  const grupos = agruparPorMes(visibles);
  const hayFiltros = Boolean(tipos.length || persona || contratacion || desde || hasta);
  const resumenFiltros = [
    tipos.length && FILTROS_TIPO.filter((f) => tipos.includes(f.valor)).map((f) => f.etiqueta).join(', '),
    persona && `menciones de ${personas.find((p) => p.id === persona)?.nombre}`,
    contratacion && contrataciones.find((c) => c.id === contratacion)?.identificador,
    desde && `desde ${desde.split('-').reverse().join('/')}`,
    hasta && `hasta ${hasta.split('-').reverse().join('/')}`,
  ].filter(Boolean);

  return (
    <div className={si.pantalla}>
      <div className={`${si.principal} ${s.pantalla}`}>
        <CabeceraCausa causa={causa} />
        <div className={`${si.vista} ${s.soloPantalla}`}>
          <div>
            <h2 className={si.titulo}>Cronología</h2>
            <p className={si.bajada}>Todo lo que tiene fecha, en una sola línea: piezas, mensajes relevantes, trámite de las contrataciones, allanamientos, actos procesales y planteos.</p>
          </div>
          <div className={si.acciones}>
            <Boton icono={<Plus aria-hidden />} onClick={() => setActo('nuevo')}>
              Acto procesal
            </Boton>
            <Boton variante="primario" icono={<Printer aria-hidden />} disabled={!visibles.length} onClick={() => window.print()}>
              Exportar PDF
            </Boton>
          </div>
        </div>

        <div className={`${s.filtros} ${s.soloPantalla}`}>
          <div className={s.tipos} role="group" aria-label="Qué mostrar">
            {FILTROS_TIPO.map((f) => {
              const n = hitos.filter((h) => f.tipos.includes(h.tipo)).length;
              return (
                <button
                  key={f.valor}
                  type="button"
                  className={`${s.tipo} ${s[`tipo_${f.valor}`]}`}
                  aria-pressed={tipos.includes(f.valor)}
                  onClick={() => setTipos((l) => (l.includes(f.valor) ? l.filter((x) => x !== f.valor) : [...l, f.valor]))}
                >
                  {f.etiqueta} <b className="cifras">{n}</b>
                </button>
              );
            })}
          </div>
          <div className={s.selectores}>
            <select aria-label="Filtrar por persona" className={`${si.filtro} ${persona ? si.filtroActivo : ''}`} value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="">Persona: todas</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select aria-label="Filtrar por contratación" className={`${si.filtro} ${contratacion ? si.filtroActivo : ''}`} value={contratacion} onChange={(e) => setContratacion(e.target.value)}>
              <option value="">Contratación: todas</option>
              {contrataciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.identificador}
                </option>
              ))}
            </select>
            <label className={s.fecha}>
              <span>Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className={s.fecha}>
              <span>Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            {hayFiltros && (
              <button
                type="button"
                className={si.limpiar}
                onClick={() => {
                  setTipos([]);
                  setPersona('');
                  setContratacion('');
                  setDesde('');
                  setHasta('');
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
          {persona && (
            <p className={s.nota}>
              <Sparkles aria-hidden /> Se muestran los hechos donde aparece su nombre, su apellido o cómo figura agendada: es una coincidencia por nombre, a revisar.
            </p>
          )}
        </div>

        <div className={s.cuerpo}>
          <header className={s.encabezadoImpresion}>
            <p>
              Legajo Fiscalía {causa.legajo_fiscalia} · {causa.caratula}
            </p>
            <h2>Cronología</h2>
            <p>
              {resumenFiltros.length ? `Filtros: ${resumenFiltros.join(' · ')}. ` : ''}
              {visibles.length} hechos. Emitida el {new Date().toLocaleDateString('es-AR')} desde el Tablero de Prueba.
            </p>
          </header>
          {error ? (
            <div style={{ padding: 'var(--esp-6)' }}>
              <AvisoError titulo="No pudimos armar la cronología">{error.message}</AvisoError>
            </div>
          ) : cargando ? (
            <FilasEsqueleto filas={6} />
          ) : visibles.length === 0 ? (
            <div className={s.vacio}>
              <EstadoVacio icono={<CalendarRange />} titulo={hitos.length ? 'Nada coincide con los filtros' : 'Todavía no hay nada con fecha'}>
                {hitos.length
                  ? 'Probá sacando algún filtro.'
                  : 'Aparecen solas las piezas con fecha, los mensajes marcados como relevantes, los pasos de las contrataciones y los allanamientos. Los actos procesales se cargan con «Acto procesal».'}
              </EstadoVacio>
            </div>
          ) : (
            <div className={s.linea}>
              {grupos.map((g) => (
                <section key={g.clave} className={s.mes} aria-label={g.titulo}>
                  <h3 className={s.mesTitulo}>{g.titulo}</h3>
                  <ol className={s.hitos}>
                    {g.hitos.map((h) => {
                      const f = fechaHito(h);
                      const enlace = enlaceDe(h);
                      const actoPropio = h.tipo === 'acto' ? actos.find((a) => a.id === h.id) : undefined;
                      return (
                        <li key={`${h.tipo}-${h.id}`} className={`${s.hito} ${s[`hito_${h.tipo}`] ?? ''}`}>
                          <div className={s.hitoFecha}>
                            <span>{f.dia}</span>
                            {f.aproximada && <span className={s.aprox}>aprox.</span>}
                          </div>
                          <div className={s.hitoCuerpo}>
                            <div className={s.hitoCabecera}>
                              <span className={s.hitoTipo}>{etiquetaHito(h.tipo)}</span>
                              <strong className={s.hitoTitulo}>{h.titulo}</strong>
                            </div>
                            {h.detalle && <p className={s.hitoDetalle}>{h.detalle}</p>}
                            {h.fecha_texto && h.tipo === 'paso' && <span className={s.tal}>Fecha en el expediente: «{h.fecha_texto}»</span>}
                            {enlace && (
                              <Link to={enlace} relative="path" className={`${s.abrir} ${s.soloPantalla}`}>
                                <ExternalLink aria-hidden /> Abrir
                              </Link>
                            )}
                            {actoPropio && (
                              <button type="button" className={`${s.abrir} ${s.soloPantalla}`} onClick={() => setActo(actoPropio)}>
                                Editar
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </div>
        <footer className={`${si.pie} ${s.soloPantalla}`}>
          <span>
            {hayFiltros ? `${visibles.length} de ${hitos.length}` : hitos.length} hechos con fecha
          </span>
          <span className={si.enVivo}>En vivo: los cambios del equipo aparecen solos</span>
        </footer>
      </div>

      <DialogoActo key={acto === 'nuevo' ? 'nuevo' : (acto?.id ?? 'ninguno')} abierto={acto !== null} causaId={causa.id} acto={acto === 'nuevo' ? null : acto} onCerrar={() => setActo(null)} />
    </div>
  );
}

function DialogoActo({ abierto, causaId, acto, onCerrar }: { abierto: boolean; causaId: string; acto: ActoProcesal | null; onCerrar: () => void }) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['actos', causaId] });
    void qc.invalidateQueries({ queryKey: ['cronologia', causaId] });
  };

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const valor = (k: string) => String(d.get(k) ?? '').trim() || null;
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.from('acto_procesal').insert({
      causa_id: causaId,
      fecha: valor('fecha'),
      fecha_precision: valor('fecha') ? String(d.get('fecha_precision')) : 'sin_fecha',
      tipo: String(d.get('tipo')),
      titulo: valor('titulo'),
      descripcion: valor('descripcion'),
      link: valor('link'),
    });
    setEnviando(false);
    if (err) {
      setError(traducirError(err.message));
      return;
    }
    refrescar();
    avisar('Acto procesal cargado en la cronología.');
    onCerrar();
  }

  async function archivar() {
    if (!acto) return;
    const { error: err } = await supabase.from('acto_procesal').update({ archivado_en: new Date().toISOString() }).eq('id', acto.id);
    if (err) avisar(traducirError(err.message), { tono: 'error' });
    else {
      refrescar();
      avisar('Se quitó el acto. Queda en el historial.');
      onCerrar();
    }
  }

  const guardar = (campo: string) => async (nuevo: string | null, anterior: string | null) => {
    const r = await guardarCampo('acto_procesal', acto!.id, campo, anterior, nuevo);
    refrescar();
    return r;
  };

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={acto ? 'Acto procesal' : 'Nuevo acto procesal'} descripcion={acto ? 'Los cambios se guardan solos.' : 'Audiencias, resoluciones, planteos: lo que no sale solo de las otras pantallas.'}>
      {acto ? (
        <>
          <div className={clasesDialogo.cuerpo}>
            <CampoEditable campo="titulo" etiqueta="Qué pasó" valor={acto.titulo} permitirVacio={false} onGuardar={guardar('titulo')} />
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <CampoEditable campo="fecha" etiqueta="Fecha" tipo="fecha" valor={acto.fecha} onGuardar={guardar('fecha')} />
              <CampoEditable campo="tipo" etiqueta="Tipo" tipo="opciones" permitirVacio={false} opciones={TIPOS_ACTO} valor={acto.tipo} onGuardar={guardar('tipo')} />
            </div>
            <CampoEditable campo="fecha_precision" etiqueta="Precisión de la fecha" tipo="opciones" permitirVacio={false} opciones={[...PRECISIONES]} valor={acto.fecha_precision} onGuardar={guardar('fecha_precision')} />
            <CampoEditable campo="descripcion" etiqueta="Detalle" tipo="textoLargo" valor={acto.descripcion} onGuardar={guardar('descripcion')} />
            <CampoEditable campo="link" etiqueta="Link al documento" valor={acto.link} onGuardar={guardar('link')} />
          </div>
          <div className={clasesDialogo.pie}>
            <Boton variante="fantasma" icono={<Archive aria-hidden />} onClick={() => void archivar()} style={{ marginRight: 'auto' }}>
              Quitar
            </Boton>
            <Boton variante="primario" onClick={onCerrar}>
              Listo
            </Boton>
          </div>
        </>
      ) : (
        <form onSubmit={crear}>
          <div className={clasesDialogo.cuerpo}>
            <Entrada name="titulo" etiqueta="Qué pasó" placeholder="Audiencia de control de la acusación" required autoFocus autoComplete="off" />
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <Entrada name="fecha" etiqueta="Fecha" type="date" />
              <Selector name="tipo" etiqueta="Tipo" defaultValue="audiencia">
                {TIPOS_ACTO.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </Selector>
            </div>
            <Selector name="fecha_precision" etiqueta="Precisión de la fecha" defaultValue="dia">
              {PRECISIONES.filter((p) => p.valor !== 'sin_fecha').map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </Selector>
            <AreaTexto name="descripcion" etiqueta="Detalle" rows={3} />
            <Entrada name="link" etiqueta="Link al documento" placeholder="https://drive.google.com/…" autoComplete="off" />
            {error && <AvisoError titulo={error} />}
          </div>
          <div className={clasesDialogo.pie}>
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={enviando}>
              Cargar
            </Boton>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
