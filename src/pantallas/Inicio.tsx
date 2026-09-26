import { Archive, ArrowRight, Check, FileUp, Landmark, ListTree, Package, TriangleAlert, UserPlus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { Esqueleto } from '../componentes/estados';
import { Avatar, EstadoProcesal } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useActividad, useAlcances, useEfectos, useIncidencias, type EfectoVista } from '../datos/causa';
import { useDirectorio, useIndice } from '../datos/consultas';
import { useYo } from '../datos/sesion';
import { CAMPOS, COLUMNAS_TABLERO, ESTADOS_EFECTO, valorLegible } from '../lib/etiquetas';
import { descargar, nombreArchivo } from '../lib/exportar';
import { haceCuanto } from '../lib/tiempo';
import type { EventoHistorial } from '../lib/tipos';
import { CabeceraCausa } from './CabeceraCausa';
import { useCausaActual } from './Marco';
import s from './Inicio.module.css';

const HECHOS = new Set(['escaneado', 'finalizado']);

function saludo(nombre: string) {
  const h = new Date().getHours();
  return `${h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'}, ${nombre}`;
}

export function Inicio() {
  const { causa } = useCausaActual();
  const yo = useYo();
  const directorio = useDirectorio();
  const { avisar } = useToast();
  const { filas: efectos, cargando } = useEfectos(causa.id);
  const { filas: piezas } = useIndice(causa.id, yo.user_id);
  const { data: incidencias = [] } = useIncidencias(causa.id);
  const { data: actividad = [], isLoading: cargandoActividad } = useActividad(causa.id, 80);
  const alcances = useAlcances(causa.id);
  const grupos = useMemo(() => agrupar(actividad).slice(0, 12), [actividad]);
  const [copiando, setCopiando] = useState<string | null>(null);

  const trabajables = efectos.filter((e) => e.requiere_escribiente);
  const hechos = trabajables.filter((e) => HECHOS.has(e.estado)).length;
  const porEstado = COLUMNAS_TABLERO.map((c) => ({ ...c, cantidad: trabajables.filter((e) => e.estado === c.valor).length }));
  const porcentaje = trabajables.length ? Math.round((hechos / trabajables.length) * 100) : 0;
  const papel = efectos.filter((e) => e.soporte === 'papel').length;
  const dispositivos = efectos.filter((e) => e.soporte === 'digital').length;

  const porResponsable = useMemo(() => {
    const mapa = new Map<string, { clave: string; alias: string; email: string | null; invitado: boolean; total: number; hechos: number; enCurso: number }>();
    for (const e of trabajables) {
      const clave = e.responsable ?? (e.responsable_alias ? `alias:${e.responsable_alias}` : null);
      if (!clave) continue;
      const previo = mapa.get(clave) ?? {
        clave,
        alias: e.responsable ? directorio.alias(e.responsable) : e.responsable_alias!,
        email: e.responsable,
        invitado: Boolean(e.responsable),
        total: 0,
        hechos: 0,
        enCurso: 0,
      };
      previo.total++;
      if (HECHOS.has(e.estado)) previo.hechos++;
      if (e.estado === 'en_proceso') previo.enCurso++;
      mapa.set(clave, previo);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total || a.alias.localeCompare(b.alias, 'es'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efectos, directorio]);

  const sinAsignar = trabajables.filter((e) => !e.responsable && !e.responsable_alias);
  const observados = efectos.filter((e) => e.estado === 'observado');
  const aliasEnEquipo = new Set(directorio.miembros.filter((m) => m.alias && m.activo).map((m) => m.alias!.trim().toUpperCase()));
  const sinInvitar = porResponsable.filter((r) => !r.invitado);
  const piezasSinEvaluar = piezas.filter((p) => !p.relevancia).length;

  const vigentes = incidencias.filter((i) => i.situacion !== 'sin_efecto');
  const alcance = (incidenciaId: string) => alcances.get(incidenciaId) ?? 0;

  async function bajarCopia() {
    setCopiando('Preparando…');
    try {
      const { copiaCompleta } = await import('../lib/copia');
      const { zip, conteo } = await copiaCompleta(causa.id, (_tabla, i, total) => setCopiando(`Copiando ${i} de ${total}…`));
      descargar(zip, `${nombreArchivo('Copia-completa', causa.legajo_fiscalia)}.zip`);
      const registros = Object.entries(conteo).reduce((n, [t, c]) => (t === 'auditoria' ? n : n + c), 0);
      avisar(`Copia descargada: ${registros} registros y ${conteo.auditoria ?? 0} cambios del historial.`);
    } catch (e) {
      avisar(`No se pudo armar la copia: ${(e as Error).message}`, { tono: 'error' });
    } finally {
      setCopiando(null);
    }
  }

  const nombre = yo.alias ? yo.alias.charAt(0) + yo.alias.slice(1).toLowerCase() : (yo.nombre?.split(' ')[0] ?? '');

  return (
    <div className={s.pantalla}>
      <CabeceraCausa causa={causa} />

      <div className={s.cuerpo}>
        <p className={s.saludo}>{saludo(nombre)}. Así viene la causa hoy.</p>

        <section className={s.avance} aria-label="Avance de los efectos">
          <div className={s.avanceCabecera}>
            <div>
              <span className="rotulo">Avance de los efectos</span>
              {cargando ? (
                <Esqueleto ancho={280} alto={40} />
              ) : trabajables.length ? (
                <h2 className={s.cifra}>
                  <span className="cifras">{hechos}</span>
                  <span className={s.cifraDe}> de {trabajables.length}</span>
                  <span className={s.cifraTexto}> escaneados o terminados</span>
                </h2>
              ) : (
                <h2 className={s.cifra}>
                  <span className={s.cifraTexto}>Todavía no hay efectos cargados</span>
                </h2>
              )}
              {efectos.length > 0 && (
                <p className={s.avanceDetalle}>
                  {papel} de documentación en papel · {dispositivos} dispositivos
                  {efectos.length - trabajables.length > 0 && ` · ${efectos.length - trabajables.length} no requieren escribiente`}
                </p>
              )}
            </div>
            {trabajables.length > 0 && (
              <span className={s.porcentaje} aria-label={`${porcentaje} por ciento`}>
                {porcentaje}
                <small>%</small>
              </span>
            )}
          </div>

          {trabajables.length > 0 ? (
            <>
              <div className={s.barra} role="img" aria-label={porEstado.map((e) => `${e.etiqueta}: ${e.cantidad}`).join(', ')}>
                {porEstado
                  .filter((e) => e.cantidad)
                  .map((e) => (
                    <span key={e.valor} className={`${s.tramo} ${s[`tramo_${e.valor}`]}`} style={{ flexGrow: e.cantidad }} title={`${e.etiqueta}: ${e.cantidad}`} />
                  ))}
              </div>
              <ul className={s.leyenda}>
                {porEstado.map((e) => (
                  <li key={e.valor}>
                    <Link to={`../efectos`} relative="path" className={s.leyendaItem}>
                      <span className={`${s.punto} ${s[`tramo_${e.valor}`]}`} />
                      {e.etiqueta}
                      <b className="cifras">{e.cantidad}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            !cargando && (
              <div className={s.arranque}>
                <p>Empezá trayendo la planilla de efectos del Drive: en cuatro pasos quedan todos cargados, agrupados por allanamiento y asignados.</p>
                <Link to="../importar" relative="path" className={s.botonPrimario}>
                  <FileUp aria-hidden /> Importar la planilla
                </Link>
              </div>
            )
          )}
        </section>

        <div className={s.grilla}>
          <Tarjeta titulo="Por responsable" enlace={{ a: '../efectos', texto: 'Ver el tablero' }}>
            {porResponsable.length === 0 ? (
              <p className={s.tenue}>Cuando asignes efectos, acá se ve cuánto lleva cada uno.</p>
            ) : (
              <ul className={s.personas}>
                {porResponsable.map((r) => (
                  <li key={r.clave}>
                    <Avatar texto={r.alias} email={r.email ?? r.alias} tamano="chico" />
                    <span className={s.personaNombre}>
                      {r.alias}
                      {!r.invitado && <span className={s.tenue}>{aliasEnEquipo.has(r.alias.toUpperCase()) ? ' · alias repetido' : ' · sin invitar'}</span>}
                    </span>
                    <span className={s.miniBarra} aria-hidden>
                      <span style={{ width: `${(r.hechos / r.total) * 100}%` }} />
                    </span>
                    <span className={`${s.personaCuenta} cifras`}>
                      {r.hechos}/{r.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Alertas procesales" tono={vigentes.length ? 'peligro' : undefined}>
            {vigentes.length === 0 ? (
              <p className={s.limpio}>
                <Check aria-hidden /> Ninguna prueba cuestionada por ahora.
              </p>
            ) : (
              <ul className={s.alertas}>
                {vigentes.map((i) => (
                  <li key={i.id}>
                    <EstadoProcesal situacion={i.situacion as Exclude<typeof i.situacion, 'sin_efecto'>} />
                    <span className={s.alertaTitulo}>{i.titulo}</span>
                    <span className={s.tenue}>
                      Alcanza a {alcance(i.id)} {alcance(i.id) === 1 ? 'ficha' : 'fichas'}; sus piezas la heredan
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Pendientes">
            <ul className={s.pendientes}>
              <Pendiente
                icono={<Package aria-hidden />}
                cantidad={sinAsignar.length}
                texto={sinAsignar.length === 1 ? 'efecto sin responsable' : 'efectos sin responsable'}
                a="../efectos"
              />
              <Pendiente icono={<TriangleAlert aria-hidden />} cantidad={observados.length} texto={observados.length === 1 ? 'efecto observado' : 'efectos observados'} a="../efectos" />
              <Pendiente
                icono={<ListTree aria-hidden />}
                cantidad={piezasSinEvaluar}
                texto={piezasSinEvaluar === 1 ? 'pieza sin evaluar su relevancia' : 'piezas sin evaluar su relevancia'}
                a="../indice"
              />
              {sinInvitar.map((r) => (
                <Pendiente
                  key={r.clave}
                  icono={<UserPlus aria-hidden />}
                  cantidad={r.total}
                  texto={
                    aliasEnEquipo.has(r.alias.toUpperCase())
                      ? `${r.total === 1 ? 'efecto' : 'efectos'} de ${r.alias} sin asignar: ese alias está en más de una cuenta`
                      : `${r.total === 1 ? 'efecto espera' : 'efectos esperan'} a ${r.alias}, que no está invitado`
                  }
                  a="../equipo"
                />
              ))}
            </ul>
            {!sinAsignar.length && !observados.length && !piezasSinEvaluar && !sinInvitar.length && (
              <p className={s.limpio}>
                <Check aria-hidden /> Nada pendiente. Buen trabajo.
              </p>
            )}
          </Tarjeta>
        </div>

        <div className={s.grillaAncha}>
          <Tarjeta titulo="Lo último que pasó">
            {cargandoActividad ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <Esqueleto alto={16} />
                <Esqueleto alto={16} ancho="80%" />
                <Esqueleto alto={16} ancho="60%" />
              </div>
            ) : grupos.length === 0 ? (
              <p className={s.tenue}>Todavía no hubo movimiento en esta causa.</p>
            ) : (
              <ol className={s.actividad}>
                {grupos.map((g) => (
                  <Evento key={g[0].id} eventos={g} quien={g[0].usuario_email ? directorio.alias(g[0].usuario_email) : 'Sistema'} efectos={efectos} />
                ))}
              </ol>
            )}
          </Tarjeta>

          <div className={s.columnaAtajos}>
            <Tarjeta titulo="Ir a">
              <nav className={s.atajos}>
                <Link to="../indice" relative="path">
                  <ListTree aria-hidden /> Índice de prueba <b className="cifras">{piezas.length}</b>
                </Link>
                <Link to="../efectos" relative="path">
                  <Package aria-hidden /> Efectos <b className="cifras">{efectos.length}</b>
                </Link>
                <Link to="../personas" relative="path">
                  <Landmark aria-hidden /> Personas y empresas
                </Link>
                <Link to="../importar" relative="path">
                  <FileUp aria-hidden /> Importar una planilla
                </Link>
              </nav>
            </Tarjeta>
            <Tarjeta titulo="Copia de resguardo">
              <p className={s.tenue}>Todo lo de esta causa en un .zip: planillas para Excel y el historial completo de cambios. Guardala en el Drive de la UFIL.</p>
              <Boton icono={<Archive aria-hidden />} cargando={Boolean(copiando)} onClick={() => void bajarCopia()}>
                {copiando ?? 'Descargar copia completa'}
              </Boton>
            </Tarjeta>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, tono, enlace, children }: { titulo: string; tono?: 'peligro'; enlace?: { a: string; texto: string }; children: ReactNode }) {
  return (
    <section className={`${s.tarjeta} ${tono === 'peligro' ? s.tarjetaPeligro : ''}`} aria-label={titulo}>
      <header className={s.tarjetaCabecera}>
        <h3>{titulo}</h3>
        {enlace && (
          <Link to={enlace.a} relative="path" className={s.tarjetaEnlace}>
            {enlace.texto} <ArrowRight aria-hidden />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Pendiente({ icono, cantidad, texto, a }: { icono: ReactNode; cantidad: number; texto: string; a: string }) {
  if (!cantidad) return null;
  return (
    <li>
      <Link to={a} relative="path" className={s.pendiente}>
        {icono}
        <b className="cifras">{cantidad}</b> {texto}
        <ArrowRight aria-hidden className={s.flecha} />
      </Link>
    </li>
  );
}

const NOMBRE_TABLA: Record<string, string> = {
  pieza: 'la pieza',
  efecto: 'el efecto',
  persona: 'a',
  procedimiento: 'el procedimiento',
  informe: 'el informe',
  incidencia_procesal: 'la situación procesal',
  incidencia_alcance: 'una situación procesal en una ficha',
  identificador: 'un teléfono o identificador',
  rol_en_causa: 'un rol en la causa',
  miembro: 'a',
  causa: 'la causa',
};
const PLURAL_TABLA: Record<string, [string, string]> = {
  efecto: ['efecto', 'efectos'],
  pieza: ['pieza', 'piezas'],
  procedimiento: ['procedimiento', 'procedimientos'],
  informe: ['informe', 'informes'],
  persona: ['persona', 'personas'],
  identificador: ['identificador', 'identificadores'],
  incidencia_alcance: ['ficha con situación procesal', 'fichas con situación procesal'],
};

/** Junta altas seguidas de la misma persona en la misma tabla (una importación trae decenas). */
function agrupar(eventos: EventoHistorial[]): EventoHistorial[][] {
  // Lo que cargó una importación ya está contado en «importó N efectos»: no se repite.
  const importaciones = new Set(eventos.filter((e) => e.tabla === 'importacion').map((e) => `${e.usuario_email}|${e.ocurrido_en}`));
  const grupos: EventoHistorial[][] = [];
  for (const e of eventos) {
    if (e.tabla !== 'importacion' && e.accion === 'alta' && importaciones.has(`${e.usuario_email}|${e.ocurrido_en}`)) continue;
    const ultimo = grupos[grupos.length - 1];
    const previo = ultimo?.[0];
    if (previo && e.accion === 'alta' && previo.accion === 'alta' && previo.tabla === e.tabla && previo.usuario_email === e.usuario_email && PLURAL_TABLA[e.tabla]) {
      ultimo.push(e);
    } else grupos.push([e]);
  }
  return grupos;
}

function Evento({ eventos, quien, efectos }: { eventos: EventoHistorial[]; quien: string; efectos: EfectoVista[] }) {
  const e = eventos[0];
  const d = (e.despues ?? e.antes ?? {}) as Record<string, unknown>;
  let sujeto = NOMBRE_TABLA[e.tabla] ?? 'un registro';
  let enlace: string | null = null;
  if (e.tabla === 'efecto') {
    sujeto = `el efecto Nº ${String(d.numero ?? efectos.find((x) => x.id === e.registro_id)?.numero ?? '')}`;
    enlace = `../efectos?efecto=${e.registro_id}`;
  } else if (e.tabla === 'pieza') {
    sujeto = d.numero_orden ? `la pieza Nº ${String(d.numero_orden)}` : `la pieza «${String(d.titulo ?? '')}»`;
    enlace = `../indice?pieza=${e.registro_id}`;
  } else if (e.tabla === 'persona') {
    sujeto = String(d.nombre ?? 'una persona');
    enlace = `../personas?persona=${e.registro_id}`;
  } else if (e.tabla === 'miembro') {
    sujeto = String(d.alias ?? d.email ?? 'alguien');
  } else if (e.tabla === 'incidencia_procesal') {
    sujeto = `«${String(d.titulo ?? '')}»`;
  } else if (e.tabla === 'informe') {
    sujeto = `el informe ${String(d.numero ?? '')}`;
  } else if (e.tabla === 'procedimiento') {
    sujeto = `el procedimiento de ${String(d.domicilio ?? 'domicilio sin cargar')}`;
  }

  let frase: ReactNode;
  if (eventos.length > 1) {
    const [, plural] = PLURAL_TABLA[e.tabla];
    const numeros = e.tabla === 'efecto' ? eventos.map((x) => String((x.despues as Record<string, unknown> | null)?.numero ?? '')).filter(Boolean) : [];
    frase = (
      <>
        cargó <b>{eventos.length}</b> {plural}
        {numeros.length > 0 && (
          <span className={s.tenue}>
            {' '}
            (Nº {numeros.slice(-4).reverse().join(', ')}
            {numeros.length > 4 ? '…' : ''})
          </span>
        )}
      </>
    );
    enlace = e.tabla === 'efecto' ? '../efectos' : e.tabla === 'pieza' ? '../indice' : e.tabla === 'persona' ? '../personas' : null;
  } else if (e.tabla === 'importacion' && e.accion === 'alta') {
    frase = (
      <>
        importó <b>{String(d.filas_importadas ?? '')}</b> efectos de «{String(d.archivo ?? '')}»
      </>
    );
    enlace = '../efectos';
  } else if (e.accion === 'alta') {
    frase = e.tabla === 'miembro' ? <>invitó a {sujeto}</> : e.tabla === 'persona' ? <>agregó a {sujeto} al directorio</> : <>cargó {sujeto}</>;
  } else if (e.accion === 'archivo') {
    frase = <>archivó {sujeto}</>;
  } else if (e.accion === 'restauracion') {
    frase = <>restauró {sujeto}</>;
  } else {
    const cambios = Object.entries(e.cambios ?? {});
    const estado = cambios.find(([c]) => c === 'estado');
    if (e.tabla === 'efecto' && estado && cambios.length === 1) {
      frase = (
        <>
          pasó {sujeto} a <b>{ESTADOS_EFECTO[String(estado[1].despues)] ?? String(estado[1].despues)}</b>
        </>
      );
    } else {
      const [campo, v] = cambios[0] ?? ['', { antes: null, despues: null }];
      frase = (
        <>
          cambió <em>{CAMPOS[campo] ?? campo}</em> de {sujeto}
          {cambios.length === 1 && campo !== 'observaciones' && campo !== 'resumen' ? <> a «{valorLegible(campo, v.despues)}»</> : null}
          {cambios.length > 1 ? ` y ${cambios.length - 1} campo${cambios.length > 2 ? 's' : ''} más` : ''}
        </>
      );
    }
  }

  const contenido = (
    <>
      <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
      <span className={s.eventoTexto}>
        <b>{quien}</b> {frase}
      </span>
      <time dateTime={e.ocurrido_en} className={s.eventoCuando}>
        {haceCuanto(e.ocurrido_en)}
      </time>
    </>
  );
  return (
    <li>
      {enlace ? (
        <Link to={enlace} relative="path" className={s.evento}>
          {contenido}
        </Link>
      ) : (
        <span className={s.evento}>{contenido}</span>
      )}
    </li>
  );
}
