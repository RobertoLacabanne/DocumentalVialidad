// Documentos y escaneos: se arrastran los PDF (o la carpeta entera del
// Drive) y el texto de cada página queda buscable con Ctrl+K. El archivo se
// lee en la computadora de quien lo arrastra: no se sube ni se modifica.
import { useQueryClient } from '@tanstack/react-query';
import { Check, FileScan, FileText, FolderOpen, Image as IconoImagen, Inbox, Pause, Play, Search, Square, TriangleAlert, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { Chip, EtiquetaEfecto, MarcaSugerencia } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useEfectos, usePersonas } from '../datos/causa';
import { useDocumentos, usePaginaPorId, useSugerencias, type DocumentoVista } from '../datos/documentos';
import { traducirError } from '../datos/guardado';
import { useContrataciones, usePiezasRef } from '../datos/hechos';
import { TERMINADA, useLectura, type Tarea } from '../datos/lectura';
import { ETIQUETA_METODO, huellaCorta, tamanoLegible } from '../lib/documentos';
import { archivosElegidos, archivosSoltados } from '../lib/lector';
import { textoSugerencia } from '../lib/sugerencias';
import { supabase } from '../lib/supabase';
import type { Sugerencia } from '../lib/tipos';
import { fechaCorta } from '../lib/tiempo';
import { CabeceraCausa } from './CabeceraCausa';
import { TraerAppufil } from './DialogoAppufil';
import { FichaDocumento } from './FichaDocumento';
import { useCausaActual } from './Marco';
import s from './Documentos.module.css';
import se from './Efectos.module.css';
import si from './Indice.module.css';

type Vista = 'documentos' | 'sugerencias';

export function Documentos() {
  const { causa } = useCausaActual();
  const { filas, cargando, error } = useDocumentos(causa.id);
  const sugerencias = useSugerencias(causa.id);
  const lectura = useLectura();
  const [params, setParams] = useSearchParams();
  const vista: Vista = params.get('vista') === 'sugerencias' ? 'sugerencias' : 'documentos';
  const idPagina = params.get('pagina');
  const { data: desdeBusqueda } = usePaginaPorId(idPagina);
  const abierto = params.get('doc') ?? desdeBusqueda?.documento_id ?? null;
  const paginaInicial = Number(params.get('pag')) || desdeBusqueda?.nro || 1;
  const [texto, setTexto] = useState('');
  const [encima, setEncima] = useState(false);
  const [appufil, setAppufil] = useState(false);
  const archivosInput = useRef<HTMLInputElement>(null);
  const carpetaInput = useRef<HTMLInputElement>(null);

  const cambiarParams = (cambios: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    setParams(n, { replace: true });
  };
  const abrir = (id: string | null, pag?: number) => cambiarParams({ doc: id, pag: pag ? String(pag) : null, pagina: null });

  const pendientes = sugerencias.filter((x) => x.estado === 'pendiente');
  const pendientesPorDoc = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of pendientes) m.set(x.entidad_id, (m.get(x.entidad_id) ?? 0) + 1);
    return m;
  }, [pendientes]);

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return t ? filas.filter((d) => `${d.ruta ?? ''} ${d.nombre}`.toLowerCase().includes(t)) : filas;
  }, [filas, texto]);

  async function soltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setEncima(false);
    lectura.agregar(await archivosSoltados(e.dataTransfer));
  }

  const documentoAbierto = filas.find((d) => d.id === abierto) ?? null;
  const totalPaginas = filas.reduce((a, d) => a + (d.resumen?.leidas ?? 0), 0);

  return (
    <div className={`${si.pantalla} ${documentoAbierto ? si.conPanel : ''}`}>
      <div
        className={`${si.principal} ${se.desplazable} ${s.zona} ${encima ? s.zonaEncima : ''}`}
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes('Files')) {
            e.preventDefault();
            setEncima(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setEncima(false);
        }}
        onDrop={(e) => void soltar(e)}
      >
        <CabeceraCausa causa={causa} />

        <div className={si.vista}>
          <div>
            <h2 className={si.titulo}>Documentos y escaneos</h2>
            <p className={si.bajada}>El texto de cada escaneo, para encontrarlo con Ctrl+K. Los archivos no se suben: se leen en tu computadora y solo se guarda el texto.</p>
          </div>
          <div className={si.acciones}>
            <div className={`${si.segmento} ${se.vistas}`} role="group" aria-label="Qué ver">
              <button type="button" aria-pressed={vista === 'documentos'} onClick={() => cambiarParams({ vista: null })}>
                <FileText aria-hidden />
                Documentos
              </button>
              <button type="button" aria-pressed={vista === 'sugerencias'} onClick={() => cambiarParams({ vista: 'sugerencias' })}>
                <Inbox aria-hidden />
                Sugerencias{pendientes.length > 0 && <span className={s.cuenta}>{pendientes.length}</span>}
              </button>
            </div>
            <Boton onClick={() => setAppufil(true)}>Traer texto de AppUFIL</Boton>
            <Boton icono={<FolderOpen aria-hidden />} onClick={() => carpetaInput.current?.click()}>
              Elegir carpeta
            </Boton>
            <Boton variante="primario" icono={<Upload aria-hidden />} onClick={() => archivosInput.current?.click()}>
              Leer escaneos
            </Boton>
            <input
              ref={archivosInput}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,application/pdf,image/*"
              className="visualmente-oculto"
              aria-label="Elegir archivos para leer"
              onChange={(e) => {
                lectura.agregar(archivosElegidos(e.target.files));
                e.target.value = '';
              }}
            />
            <input
              ref={carpetaInput}
              type="file"
              multiple
              className="visualmente-oculto"
              aria-label="Elegir una carpeta para leer"
              {...({ webkitdirectory: '' } as Record<string, string>)}
              onChange={(e) => {
                lectura.agregar(archivosElegidos(e.target.files));
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {lectura.tareas.length > 0 && <Cola />}

        {vista === 'sugerencias' ? (
          <Bandeja sugerencias={sugerencias} documentos={filas} onAbrir={(id) => abrir(id)} />
        ) : (
          <>
            {filas.length > 0 && (
              <div className={si.filtros}>
                <label className={si.buscar}>
                  <Search aria-hidden />
                  <span className="visualmente-oculto">Buscar por nombre o carpeta</span>
                  <input type="search" placeholder="Nombre del archivo o carpeta…" value={texto} onChange={(e) => setTexto(e.target.value)} />
                </label>
                <span className={s.pista}>Para buscar adentro del texto usá Ctrl+K.</span>
              </div>
            )}
            <div className={se.contenido}>
              {error ? (
                <div style={{ padding: 'var(--esp-6)' }}>
                  <AvisoError titulo="No pudimos traer los documentos">{error.message}</AvisoError>
                </div>
              ) : cargando ? (
                <FilasEsqueleto filas={5} />
              ) : filas.length === 0 ? (
                lectura.tareas.length === 0 && (
                  <div className={s.vacio}>
                    <EstadoVacio
                      icono={<FileScan />}
                      ilustracion="vacio-documentos"
                      titulo="Soltá acá los escaneos"
                      accion={
                        <div className={s.vacioAcciones}>
                          <Boton variante="primario" icono={<Upload aria-hidden />} onClick={() => archivosInput.current?.click()}>
                            Leer escaneos
                          </Boton>
                          <Boton icono={<FolderOpen aria-hidden />} onClick={() => carpetaInput.current?.click()}>
                            Elegir carpeta
                          </Boton>
                        </div>
                      }
                    >
                      Arrastrá los PDF o la carpeta entera bajada del Drive (por ejemplo, «EFECTO 48435»). Si el PDF trae texto, se toma tal cual; si es una imagen, se lee con
                      OCR en castellano. Lo impreso se lee bien; lo escrito a mano, casi nada.
                    </EstadoVacio>
                  </div>
                )
              ) : visibles.length === 0 ? (
                <div className={si.vacio}>
                  <EstadoVacio icono={<Search />} ilustracion="vacio-busqueda" titulo="Ningún documento coincide" accion={<Boton onClick={() => setTexto('')}>Limpiar</Boton>}>
                    Probá con otra parte del nombre o de la carpeta.
                  </EstadoVacio>
                </div>
              ) : (
                <TablaDocumentos filas={visibles} abierto={abierto} sugerencias={pendientesPorDoc} onAbrir={(id) => abrir(id)} />
              )}
            </div>
          </>
        )}

        <footer className={si.pie}>
          <span>
            {filas.length} {filas.length === 1 ? 'documento' : 'documentos'} · {totalPaginas.toLocaleString('es-AR')} páginas con texto buscable
          </span>
          <span className={si.enVivo}>En vivo: lo que lee otra persona aparece solo</span>
        </footer>

        {encima && (
          <div className={s.soltar} aria-hidden>
            <Upload />
            <strong>Soltá los PDF o la carpeta</strong>
            <span>Se leen acá, en esta computadora. No se sube ningún archivo.</span>
          </div>
        )}
      </div>

      {documentoAbierto && (
        <FichaDocumento
          key={documentoAbierto.id}
          documento={documentoAbierto}
          paginaInicial={abierto === documentoAbierto.id ? paginaInicial : 1}
          sugerencias={sugerencias.filter((x) => x.entidad_id === documentoAbierto.id)}
          onCerrar={() => abrir(null)}
        />
      )}
      <TraerAppufil abierto={appufil} causaId={causa.id} existentes={filas} onCerrar={() => setAppufil(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------
// La cola de lectura de esta computadora.
// ---------------------------------------------------------------------
const ESTADO: Record<Tarea['estado'], string> = {
  esperando: 'En espera',
  huella: 'Calculando la huella',
  leyendo: 'Leyendo',
  sugiriendo: 'Buscando sugerencias',
  listo: 'Listo',
  ya_estaba: 'Ya estaba',
  omitido: 'No se lee',
  error: 'Error',
  cancelado: 'Cancelado',
};

function Cola() {
  const l = useLectura();
  const activas = l.tareas.filter((t) => !TERMINADA(t.estado));
  const terminadas = l.tareas.length - activas.length;
  const paginas = l.tareas.reduce((a, t) => a + t.leidas, 0);
  return (
    <section className={s.cola} aria-label="Lectura en curso">
      <div className={s.colaCabecera}>
        <div>
          <h3 className={s.colaTitulo}>{l.enCurso ? 'Leyendo en esta computadora' : l.pausado ? 'Lectura en pausa' : 'Lectura terminada'}</h3>
          <p className={s.colaBajada}>
            {terminadas} de {l.tareas.length} {l.tareas.length === 1 ? 'archivo' : 'archivos'} · {paginas.toLocaleString('es-AR')} páginas leídas
            {l.enCurso && ' · Podés seguir trabajando en otra pantalla; no cierres esta pestaña.'}
          </p>
        </div>
        <div className={s.colaAcciones}>
          {l.enCurso && !l.pausado && (
            <Boton tamano="chico" icono={<Pause aria-hidden />} onClick={l.pausar}>
              Pausar
            </Boton>
          )}
          {l.pausado && (
            <Boton tamano="chico" variante="primario" icono={<Play aria-hidden />} onClick={l.seguir}>
              Seguir
            </Boton>
          )}
          {(l.enCurso || l.pausado) && (
            <Boton tamano="chico" variante="fantasma" icono={<Square aria-hidden />} onClick={l.cancelar}>
              Cancelar
            </Boton>
          )}
          {terminadas > 0 && (
            <Boton tamano="chico" variante="fantasma" onClick={l.limpiar}>
              Limpiar terminadas
            </Boton>
          )}
        </div>
      </div>
      <ul className={s.tareas}>
        {l.tareas.map((t) => {
          const avance = t.paginas ? Math.round((t.leidas / t.paginas) * 100) : 0;
          return (
            <li key={t.id} className={`${s.tarea} ${s[`tarea_${t.estado}`] ?? ''}`}>
              <span className={s.tareaIcono} aria-hidden>
                {/\.pdf$/i.test(t.nombre) ? <FileText /> : <IconoImagen />}
              </span>
              <div className={s.tareaCuerpo}>
                <div className={s.tareaFila}>
                  <strong className={s.tareaNombre} title={t.ruta}>
                    {t.ruta}
                  </strong>
                  <span className={s.tareaEstado}>
                    {t.estado === 'listo' && <Check aria-hidden />}
                    {t.estado === 'error' && <TriangleAlert aria-hidden />}
                    {ESTADO[t.estado]}
                    {t.estado === 'leyendo' && t.paginas > 0 && ` · pág. ${t.leidas} de ${t.paginas}`}
                  </span>
                </div>
                {(t.estado === 'leyendo' || t.estado === 'sugiriendo' || (t.estado === 'esperando' && t.leidas > 0)) && (
                  <div className={s.barra} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} aria-label={`Avance de ${t.nombre}`}>
                    <span style={{ width: `${avance}%` }} />
                  </div>
                )}
                <div className={s.tareaDetalle}>
                  {tamanoLegible(t.bytes)}
                  {t.porCapa > 0 && ` · ${t.porCapa} con texto del PDF`}
                  {t.porOcr > 0 && ` · ${t.porOcr} por OCR`}
                  {t.estado === 'listo' && t.sugerencias ? ` · ${t.sugerencias} ${t.sugerencias === 1 ? 'sugerencia nueva' : 'sugerencias nuevas'}` : ''}
                  {t.mensaje && <span className={s.tareaMensaje}> · {t.mensaje}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------
// Tabla de documentos leídos.
// ---------------------------------------------------------------------
function TablaDocumentos({ filas, abierto, sugerencias, onAbrir }: { filas: DocumentoVista[]; abierto: string | null; sugerencias: Map<string, number>; onAbrir: (id: string) => void }) {
  const { causa } = useCausaActual();
  const { filas: efectos } = useEfectos(causa.id);
  const numeroEfecto = useMemo(() => new Map(efectos.map((e) => [e.id, e.numero])), [efectos]);
  const tecla = (id: string) => (ev: KeyboardEvent<HTMLTableRowElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onAbrir(id);
    }
  };
  return (
    <div className={se.marcoTabla}>
      <table className={`${se.tabla} ${s.tabla}`}>
        <thead>
          <tr>
            <th>Documento</th>
            <th style={{ width: 130 }}>Efecto</th>
            <th style={{ width: 170 }}>Páginas</th>
            <th style={{ width: 210 }}>Cómo se leyó</th>
            <th style={{ width: 150 }}>Huella</th>
            <th style={{ width: 110 }}>Indexado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((d) => {
            const r = d.resumen;
            const leidas = r?.leidas ?? 0;
            const avance = d.paginas ? Math.min(100, Math.round((leidas / d.paginas) * 100)) : 0;
            const pend = sugerencias.get(d.id) ?? 0;
            const carpeta = d.ruta && d.ruta !== d.nombre ? d.ruta.slice(0, d.ruta.length - d.nombre.length).replace(/\/$/, '') : null;
            return (
              <tr key={d.id} className={`${se.fila} ${d.id === abierto ? se.filaAbierta : ''}`} tabIndex={0} onClick={() => onAbrir(d.id)} onKeyDown={tecla(d.id)}>
                <td data-movil="ancho">
                  <span className={s.nombre}>
                    <span className={s.icono} aria-hidden>
                      {/pdf/i.test(d.tipo_mime ?? d.nombre) || /\.pdf$/i.test(d.nombre) ? <FileText /> : <IconoImagen />}
                    </span>
                    <span>
                      <strong>{d.nombre}</strong>
                      {carpeta && <span className={s.carpeta}>{carpeta}</span>}
                      <span className={s.metaMovil}>
                        {leidas.toLocaleString('es-AR')} de {d.paginas?.toLocaleString('es-AR') ?? '¿?'} págs.
                        {(r?.metodos ?? []).map((m) => ` · ${ETIQUETA_METODO[m]}`).join('')}
                        {d.efecto_id && ` · Efecto Nº ${numeroEfecto.get(d.efecto_id) ?? ''}`}
                      </span>
                      {pend > 0 && (
                        <span className={s.pendiente}>
                          <MarcaSugerencia>
                            {pend} {pend === 1 ? 'sugerencia' : 'sugerencias'} para validar
                          </MarcaSugerencia>
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td data-movil="oculto">{d.efecto_id ? <EtiquetaEfecto numero={numeroEfecto.get(d.efecto_id)} /> : <span className={se.tenue}>—</span>}</td>
                <td data-movil="oculto">
                  <span className="cifras">
                    {leidas.toLocaleString('es-AR')} de {d.paginas?.toLocaleString('es-AR') ?? '¿?'}
                  </span>
                  {d.estado === 'leyendo' && (
                    <span className={s.barra} aria-hidden>
                      <span style={{ width: `${avance}%` }} />
                    </span>
                  )}
                  {r && leidas > 0 && r.con_texto < leidas && <span className={s.sinTexto}>{leidas - r.con_texto} casi sin texto</span>}
                </td>
                <td data-movil="oculto">
                  <span className={s.metodos}>
                    {(r?.metodos ?? []).map((m) => (
                      <Chip key={m} familia={m === 'ocr' ? 'pericial' : m === 'appufil' ? 'contratacion' : 'documental'}>
                        {ETIQUETA_METODO[m]}
                        {m === 'ocr' && r?.confianza_ocr != null && ` · ${Math.round(r.confianza_ocr)}%`}
                      </Chip>
                    ))}
                  </span>
                </td>
                <td data-movil="oculto">
                  <code className={s.huella} title={d.sha256}>
                    {huellaCorta(d.sha256)}
                  </code>
                </td>
                <td data-movil="oculto" className="cifras">
                  {d.indexado_en ? fechaCorta(d.indexado_en) : <span className={se.tenue}>leyendo</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------
// Bandeja de sugerencias: una persona confirma o descarta.
// ---------------------------------------------------------------------
const FUENTE: Record<string, string> = { carpeta: 'Por la carpeta', texto: 'Por el texto', otro: 'Por el enlace', appufil: 'AppUFIL' };

export function useNombresSugerencia() {
  const { causa } = useCausaActual();
  const { filas: efectos } = useEfectos(causa.id);
  const { filas: contrataciones } = useContrataciones(causa.id);
  const { filas: personas } = usePersonas(causa.id);
  const piezas = usePiezasRef(causa.id);
  return useMemo(() => {
    const e = new Map(efectos.map((x) => [x.id, x.numero]));
    const c = new Map(contrataciones.map((x) => [x.id, x.identificador]));
    const p = new Map(personas.map((x) => [x.id, x.nombre]));
    const pz = new Map(piezas.map((x) => [x.id, x.numero_orden ? `Nº ${x.numero_orden}` : `«${x.titulo}»`]));
    return { efecto: (id: string) => e.get(id), contratacion: (id: string) => c.get(id), persona: (id: string) => p.get(id), pieza: (id: string) => pz.get(id) };
  }, [efectos, contrataciones, personas, piezas]);
}

export function FilaSugerencia({ sugerencia, documento, onAbrir }: { sugerencia: Sugerencia; documento?: string; onAbrir?: () => void }) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const nombres = useNombresSugerencia();
  const [enviando, setEnviando] = useState<'si' | 'no' | null>(null);

  async function resolver(aceptar: boolean) {
    setEnviando(aceptar ? 'si' : 'no');
    const { error } = await supabase.rpc('resolver_sugerencia', { p_id: sugerencia.id, p_aceptar: aceptar });
    setEnviando(null);
    if (error) {
      avisar(traducirError(error.message), { tono: 'error' });
      return;
    }
    avisar(aceptar ? 'Confirmada: quedó aplicada.' : 'Descartada: no va a volver a aparecer.');
    for (const k of ['sugerencias', 'documentos', 'vinculos']) void qc.invalidateQueries({ queryKey: [k, sugerencia.causa_id] });
  }

  return (
    <li className={s.sugerencia}>
      <div className={s.sugerenciaCuerpo}>
        {documento && (
          <button type="button" className={s.sugerenciaDoc} onClick={onAbrir}>
            {documento}
          </button>
        )}
        <strong className={s.sugerenciaTexto}>{textoSugerencia(sugerencia, nombres)}</strong>
        {sugerencia.detalle && <span className={s.sugerenciaDetalle}>{sugerencia.detalle}</span>}
        <span className={s.sugerenciaFuente}>
          <MarcaSugerencia>{FUENTE[sugerencia.fuente] ?? 'Sugerencia'} · pendiente de validar</MarcaSugerencia>
        </span>
      </div>
      <div className={s.sugerenciaAcciones}>
        <Boton tamano="chico" variante="primario" icono={<Check aria-hidden />} cargando={enviando === 'si'} onClick={() => void resolver(true)}>
          Confirmar
        </Boton>
        <Boton tamano="chico" variante="fantasma" icono={<X aria-hidden />} cargando={enviando === 'no'} onClick={() => void resolver(false)}>
          Descartar
        </Boton>
      </div>
    </li>
  );
}

function Bandeja({ sugerencias, documentos, onAbrir }: { sugerencias: Sugerencia[]; documentos: DocumentoVista[]; onAbrir: (id: string) => void }) {
  const directorio = useMemo(() => new Map(documentos.map((d) => [d.id, d])), [documentos]);
  const pendientes = sugerencias
    .filter((x) => x.estado === 'pendiente' && directorio.has(x.entidad_id))
    .sort((a, b) => (directorio.get(a.entidad_id)?.nombre ?? '').localeCompare(directorio.get(b.entidad_id)?.nombre ?? '', 'es', { numeric: true }));
  const resueltas = sugerencias.filter((x) => x.estado !== 'pendiente' && directorio.has(x.entidad_id)).length;
  return (
    <div className={`${se.contenido} ${s.bandeja}`}>
      <p className={s.bandejaIntro}>
        Lo que la app encontró al leer los documentos: de qué efecto parecen ser, qué contratación, persona o efecto mencionan. <strong>Nada se aplica solo</strong>: al
        confirmar, queda la asociación con tu nombre; al descartar, no vuelve a aparecer.
      </p>
      {pendientes.length === 0 ? (
        <div className={si.vacio}>
          <EstadoVacio icono={<Inbox />} ilustracion="vacio-sugerencias" titulo="No hay sugerencias pendientes">
            {resueltas ? `Ya se resolvieron ${resueltas}. ` : ''}Cuando se lea un documento nuevo, lo que encuentre la app aparece acá para que alguien lo confirme.
          </EstadoVacio>
        </div>
      ) : (
        <ul className={s.sugerencias}>
          {pendientes.map((x) => (
            <FilaSugerencia key={x.id} sugerencia={x} documento={directorio.get(x.entidad_id)?.ruta ?? directorio.get(x.entidad_id)?.nombre} onAbrir={() => onAbrir(x.entidad_id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
