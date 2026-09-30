// Ficha de un documento leído: su huella, de dónde es, las sugerencias por
// validar y el texto de cada página. El texto lo leyó una máquina: sirve
// para encontrar el documento, no para citarlo.
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronLeft, ChevronRight, Copy, ExternalLink, FilePlus2, Info, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { CampoEditable, Dato, Datos, Seccion, type ResultadoCampo } from '../componentes/Ficha';
import { Avatar, Chip, MarcaSugerencia } from '../componentes/marcas';
import { CerrarPanel, FilaPanel, PanelLateral } from '../componentes/PanelLateral';
import { useToast } from '../componentes/Toast';
import { useEfectos } from '../datos/causa';
import { useDirectorio, useHistorial } from '../datos/consultas';
import { usePaginas, type DocumentoVista } from '../datos/documentos';
import { traducirError, useGuardado } from '../datos/guardado';
import { ETIQUETA_METODO, tamanoLegible } from '../lib/documentos';
import { CAMPOS, valorLegible } from '../lib/etiquetas';
import { contiene, tramosResaltados } from '../lib/resaltar';
import { supabase } from '../lib/supabase';
import { haceCuanto } from '../lib/tiempo';
import type { Sugerencia } from '../lib/tipos';
import { FilaSugerencia } from './Documentos';
import s from './Documentos.module.css';
import sf from './FichaEfecto.module.css';

export function FichaDocumento({
  documento: d,
  paginaInicial,
  sugerencias,
  onCerrar,
}: {
  documento: DocumentoVista;
  paginaInicial: number;
  sugerencias: Sugerencia[];
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const navegar = useNavigate();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const directorio = useDirectorio();
  const { data: historial = [] } = useHistorial(d.id);
  const { filas: efectos } = useEfectos(d.causa_id);
  const { data: paginas = [], isLoading } = usePaginas(d.id);
  const [nro, setNro] = useState(paginaInicial);
  const [busca, setBusca] = useState('');
  const [creando, setCreando] = useState(false);

  useEffect(() => setNro(paginaInicial), [paginaInicial]);

  const guardar =
    (campo: string) =>
    (nuevo: string | null, anterior: string | null): Promise<ResultadoCampo> =>
      guardarCampo('documento', d.id, campo, anterior, nuevo);

  const pagina = paginas.find((p) => p.nro === nro) ?? null;
  const total = d.paginas ?? paginas.length;
  const coincidencias = useMemo(() => (busca.trim().length >= 2 ? paginas.filter((p) => contiene(p.texto, busca)).map((p) => p.nro) : []), [paginas, busca]);
  const pendientes = sugerencias.filter((x) => x.estado === 'pendiente');
  const efecto = efectos.find((e) => e.id === d.efecto_id);

  async function copiarHuella() {
    try {
      await navigator.clipboard.writeText(d.sha256);
      avisar('Huella SHA-256 copiada.');
    } catch {
      avisar('No se pudo copiar: seleccioná la huella y copiala a mano.', { tono: 'aviso' });
    }
  }

  /** Crea una pieza del índice con este documento como «original escaneado», con su huella. */
  async function crearPieza() {
    setCreando(true);
    const titulo = d.nombre.replace(/\.[a-z0-9]{2,4}$/i, '');
    const { data: pieza, error } = await supabase
      .from('pieza')
      .insert({ causa_id: d.causa_id, titulo, tipo: 'documental_secuestrada', efecto_id: d.efecto_id, origen: { documento: d.id } })
      .select('id')
      .single();
    if (error || !pieza) {
      setCreando(false);
      avisar(traducirError(error?.message ?? 'Error desconocido'), { tono: 'error' });
      return;
    }
    const idPieza = (pieza as { id: string }).id;
    const { error: e2 } = await supabase.from('enlace').insert({
      causa_id: d.causa_id,
      entidad_id: idPieza,
      etiqueta: 'original escaneado',
      url: d.link,
      ruta_local: d.link ? null : (d.ruta ?? d.nombre),
      nombre_archivo: d.nombre,
      sha256: d.sha256,
      indexado_en: d.indexado_en,
    });
    const r = await guardarCampo('documento', d.id, 'pieza_id', null, idPieza);
    setCreando(false);
    if (e2 || r.tipo !== 'ok') avisar(`La pieza se creó, pero no se pudo completar el enlace: ${traducirError(e2?.message ?? 'otra persona cambió el documento')}`, { tono: 'aviso' });
    else avisar('Pieza creada: completá su número de orden en el índice.');
    void qc.invalidateQueries({ queryKey: ['piezas-ref', d.causa_id] });
    navegar(`../indice?pieza=${idPieza}`, { relative: 'path' });
  }

  async function archivar() {
    const { error } = await supabase.from('documento').update({ archivado_en: new Date().toISOString() }).eq('id', d.id);
    if (error) avisar(traducirError(error.message), { tono: 'error' });
    else {
      avisar('Se quitó de la lista. Queda en el historial y se puede restaurar.');
      void qc.invalidateQueries({ queryKey: ['documentos', d.causa_id] });
      onCerrar();
    }
  }

  const metodos = d.resumen?.metodos ?? [];

  return (
    <PanelLateral
      etiqueta={`Ficha del documento ${d.nombre}`}
      onCerrar={onCerrar}
      encabezado={
        <>
          <FilaPanel>
            <Chip familia="documental">Documento</Chip>
            {metodos.map((m) => (
              <Chip key={m} familia={m === 'ocr' ? 'pericial' : m === 'appufil' ? 'contratacion' : 'otros'}>
                {ETIQUETA_METODO[m]}
              </Chip>
            ))}
            <CerrarPanel onCerrar={onCerrar} />
          </FilaPanel>
          <h2 className={sf.titulo}>{d.nombre}</h2>
          <div className={sf.meta}>
            {d.ruta && d.ruta !== d.nombre ? `${d.ruta} · ` : ''}
            {tamanoLegible(d.bytes)} · {total} {total === 1 ? 'página' : 'páginas'}
          </div>
          <div className={sf.acciones}>
            {d.link && (
              <a className={s.botonEnlace} href={d.link} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Abrir en Drive
              </a>
            )}
            {d.pieza_id ? (
              <Boton onClick={() => navegar(`../indice?pieza=${d.pieza_id}`, { relative: 'path' })}>Ver la pieza</Boton>
            ) : (
              <Boton icono={<FilePlus2 aria-hidden />} cargando={creando} onClick={() => void crearPieza()}>
                Crear pieza con este documento
              </Boton>
            )}
          </div>
        </>
      }
    >
      {pendientes.length > 0 && (
        <Seccion titulo="Sugerencias para validar">
          <ul className={s.sugerenciasFicha}>
            {pendientes.map((x) => (
              <FilaSugerencia key={x.id} sugerencia={x} />
            ))}
          </ul>
        </Seccion>
      )}

      <Seccion titulo="Texto" naturaleza="dato">
        <p className={s.avisoOcr}>
          <Info aria-hidden />
          <span>
            Texto leído por máquina: sirve para encontrar el documento, no para citarlo. Puede tener errores, sobre todo en lo escrito a mano. Citá siempre el original.
          </span>
        </p>
        <div className={s.navegador}>
          <Boton tamano="chico" variante="fantasma" soloIcono aria-label="Página anterior" disabled={nro <= 1} onClick={() => setNro((n) => Math.max(1, n - 1))}>
            <ChevronLeft aria-hidden />
          </Boton>
          <label className={s.irA}>
            Pág.
            <input
              type="number"
              min={1}
              max={total}
              value={nro}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v <= total) setNro(v);
              }}
              aria-label="Número de página"
            />
            de {total}
          </label>
          <Boton tamano="chico" variante="fantasma" soloIcono aria-label="Página siguiente" disabled={nro >= total} onClick={() => setNro((n) => Math.min(total, n + 1))}>
            <ChevronRight aria-hidden />
          </Boton>
          <label className={s.buscarDoc}>
            <Search aria-hidden />
            <input type="search" placeholder="Buscar en este documento" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar en este documento" />
          </label>
        </div>
        {busca.trim().length >= 2 && (
          <div className={s.coincidencias}>
            {coincidencias.length ? (
              <>
                <span>
                  Aparece en {coincidencias.length} {coincidencias.length === 1 ? 'página' : 'páginas'}:
                </span>
                {coincidencias.slice(0, 40).map((n) => (
                  <button key={n} type="button" aria-pressed={n === nro} onClick={() => setNro(n)}>
                    {n}
                  </button>
                ))}
                {coincidencias.length > 40 && <span>y {coincidencias.length - 40} más</span>}
              </>
            ) : (
              <span>No aparece en el texto leído.</span>
            )}
          </div>
        )}
        {isLoading ? (
          <div className={s.hoja}>Cargando el texto…</div>
        ) : !pagina ? (
          <div className={`${s.hoja} ${s.hojaVacia}`}>{d.estado === 'leyendo' ? 'Esta página todavía no se leyó.' : 'Esta página no tiene texto guardado.'}</div>
        ) : (
          <>
            <div className={s.hoja} aria-label={`Texto de la página ${nro}`}>
              <span className={s.folio}>pág. {nro}</span>
              {pagina.texto?.trim() ? (
                tramosResaltados(pagina.texto, busca.trim().length >= 2 ? busca : '').map((t, i) => (t.marcado ? <mark key={i}>{t.texto}</mark> : <span key={i}>{t.texto}</span>))
              ) : (
                <span className={s.hojaVacia}>La máquina no encontró texto en esta página (puede ser una foto, un dibujo o letra manuscrita).</span>
              )}
            </div>
            <p className={s.lecturaPie}>
              {ETIQUETA_METODO[pagina.metodo]}
              {pagina.motor ? ` (${pagina.motor})` : ''}
              {pagina.confianza != null && ` · confianza ${Math.round(pagina.confianza)}%`} · {haceCuanto(pagina.leido_en)}
            </p>
          </>
        )}
      </Seccion>

      <Seccion titulo="Dónde está y de qué es">
        <div className={sf.campos}>
          <CampoEditable campo="link" etiqueta="Link del Drive" valor={d.link} ayuda="Pegá el link del archivo en el Drive para abrirlo desde acá." onGuardar={guardar('link')} />
          <CampoEditable
            campo="efecto_id"
            etiqueta="Efecto"
            tipo="opciones"
            valor={d.efecto_id}
            opciones={efectos.map((e) => ({ valor: e.id, etiqueta: `Nº ${e.numero}${e.descripcion_acta ? ` · ${e.descripcion_acta.slice(0, 48)}` : ''}` }))}
            onGuardar={guardar('efecto_id')}
          />
          {efecto?.descripcion_acta && <p className={sf.tenue}>{efecto.descripcion_acta}</p>}
        </div>
      </Seccion>

      <Seccion titulo="Huella del archivo" naturaleza="dato">
        <Datos>
          <Dato etiqueta="SHA-256">
            <span className={s.huellaEntera}>
              <code>{d.sha256}</code>
              <Boton tamano="chico" variante="fantasma" soloIcono aria-label="Copiar la huella" title="Copiar" onClick={() => void copiarHuella()}>
                <Copy aria-hidden />
              </Boton>
            </span>
          </Dato>
          <Dato etiqueta="Indexado">{d.indexado_en ? new Date(d.indexado_en).toLocaleString('es-AR') : <span className={sf.tenue}>todavía leyendo</span>}</Dato>
          <Dato etiqueta="Leyó">{directorio.aliasUsuario(d.creado_por)}</Dato>
          <Dato etiqueta="Origen">{d.origen === 'appufil' ? 'Paquete de texto de AppUFIL' : 'Leído en el navegador'}</Dato>
        </Datos>
        <p className={sf.tenue}>
          La huella identifica el contenido exacto del archivo. Si alguien lo vuelve a arrastrar, aunque tenga otro nombre, la app lo reconoce y no lo duplica.
        </p>
      </Seccion>

      <Seccion titulo="Observaciones del analista" naturaleza="interpretacion">
        <CampoEditable campo="observaciones" etiqueta="Observaciones" tipo="textoLargo" interpretacion valor={d.observaciones} onGuardar={guardar('observaciones')} />
      </Seccion>

      {sugerencias.some((x) => x.estado !== 'pendiente') && (
        <Seccion titulo="Sugerencias resueltas">
          <ul className={sf.lista}>
            {sugerencias
              .filter((x) => x.estado !== 'pendiente')
              .map((x) => (
                <li key={x.id}>
                  <span className={sf.tenue}>{x.estado === 'aceptada' ? 'Confirmada' : 'Descartada'}</span> {x.detalle}
                  <span className={sf.tenue}> · {directorio.aliasUsuario(x.resuelta_por)}</span>
                </li>
              ))}
          </ul>
        </Seccion>
      )}

      <Seccion titulo="Historial">
        <ol className={sf.historial}>
          {historial.slice(0, 12).map((e) => {
            const quien = e.usuario_email ? directorio.alias(e.usuario_email) : 'Sistema';
            return (
              <li key={e.id}>
                <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
                <div>
                  <b>{quien}</b> {e.accion === 'alta' && 'empezó a leerlo'}
                  {e.accion === 'archivo' && 'lo quitó de la lista'}
                  {e.accion === 'edicion' &&
                    Object.entries(e.cambios).map(([campo, v], i) => (
                      <span key={campo}>
                        {i > 0 && ' · '}
                        {campo === 'estado' && v.despues === 'completo' ? (
                          'terminó de leerse'
                        ) : (
                          <>
                            cambió <em>{CAMPOS[campo] ?? campo}</em>: <s>{valorLegible(campo, v.antes)}</s> → {valorLegible(campo, v.despues)}
                          </>
                        )}
                      </span>
                    ))}
                  <time dateTime={e.ocurrido_en}>{haceCuanto(e.ocurrido_en)}</time>
                </div>
              </li>
            );
          })}
        </ol>
        <div>
          <Boton tamano="chico" variante="fantasma" icono={<Archive aria-hidden />} onClick={() => void archivar()}>
            Quitar de la lista
          </Boton>
        </div>
      </Seccion>
      <div className={s.pieFicha}>
        <MarcaSugerencia>el archivo original no se subió ni se modificó</MarcaSugerencia>
      </div>
    </PanelLateral>
  );
}
