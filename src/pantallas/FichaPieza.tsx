import { useQueryClient } from '@tanstack/react-query';
import { Archive, Check, Copy, ExternalLink, FolderOpen, Link as IconoLink, Pencil, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Boton, clasesBoton } from '../componentes/Boton';
import { Entrada, Selector } from '../componentes/campos';
import { AvisoError } from '../componentes/estados';
import { CampoEditable, Dato, Datos, Nada, Parrafo, Seccion, TextoInterpretacion, type ResultadoCampo } from '../componentes/Ficha';
import { Avatar, ChipTipo, EstadoProcesal, EtiquetaEfecto, Falta, Relevancia, Sello } from '../componentes/marcas';
import { CerrarPanel, FilaPanel, PanelLateral } from '../componentes/PanelLateral';
import type { FilaIndice } from '../componentes/TablaPiezas';
import { useToast } from '../componentes/Toast';
import { useDirectorio, useEnlaces, useHistorial } from '../datos/consultas';
import { traducirError, useGuardado } from '../datos/guardado';
import { useYo } from '../datos/sesion';
import { armarCita } from '../lib/cita';
import { esCarpetaDeDrive, esUrlValida, idDeDrive } from '../lib/drive';
import { CAMPOS, ESTADOS_TRABAJO, PRECISIONES, RELEVANCIAS, TIPOS_PIEZA, aliasDe, valorLegible } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import { fechaConPrecision, haceCuanto } from '../lib/tiempo';
import type { Causa, EventoHistorial } from '../lib/tipos';
import s from './FichaPieza.module.css';

const VIA: Record<string, string> = {
  pieza: 'cargada en esta pieza',
  efecto: 'heredada de su efecto',
  procedimiento: 'heredada del procedimiento del efecto',
  informe: 'heredada de su informe',
};

export function FichaPieza({
  pieza,
  causa,
  editarAlAbrir,
  onCerrar,
}: {
  pieza: FilaIndice;
  causa: Causa;
  editarAlAbrir: boolean;
  onCerrar: () => void;
}) {
  const yo = useYo();
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const directorio = useDirectorio();
  const { data: historial = [] } = useHistorial(pieza.id);
  const { data: enlaces = [] } = useEnlaces(pieza.id);
  const [editando, setEditando] = useState(editarAlAbrir);
  const [citaCopiada, setCitaCopiada] = useState(false);
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);
  const [avisoCambio, setAvisoCambio] = useState<EventoHistorial | null>(null);
  const ultimoVisto = useRef<number | null>(null);

  // Aviso cuando otra persona cambia esta ficha mientras la tengo abierta.
  useEffect(() => {
    const ultimo = historial[0];
    if (!ultimo) return;
    if (ultimoVisto.current === null) {
      ultimoVisto.current = ultimo.id;
      return;
    }
    if (ultimo.id > ultimoVisto.current) {
      ultimoVisto.current = ultimo.id;
      if (ultimo.usuario_email && ultimo.usuario_email !== yo.email && ultimo.accion === 'edicion') setAvisoCambio(ultimo);
    }
  }, [historial, yo.email]);

  const guardar =
    (campo: string) =>
    (nuevo: string | null, anterior: string | null): Promise<ResultadoCampo> =>
      guardarCampo('pieza', pieza.id, campo, anterior, nuevo);

  async function guardarReferencia(tabla: 'efecto' | 'informe', numero: string | null): Promise<ResultadoCampo> {
    const campo = tabla === 'efecto' ? 'efecto_id' : 'informe_id';
    const anteriorId = tabla === 'efecto' ? pieza.efecto_id : pieza.informe_id;
    let nuevoId: string | null = null;
    if (numero) {
      const { data, error } = await supabase.from(tabla).select('id').eq('causa_id', causa.id).eq('numero', numero).is('archivado_en', null).limit(1);
      if (error) return { tipo: 'error', mensaje: traducirError(error.message) };
      nuevoId = (data?.[0] as { id: string } | undefined)?.id ?? null;
      if (!nuevoId) {
        const alta = await supabase.from(tabla).insert({ causa_id: causa.id, numero }).select('id').single();
        if (alta.error) return { tipo: 'error', mensaje: traducirError(alta.error.message) };
        nuevoId = (alta.data as { id: string }).id;
        void qc.invalidateQueries({ queryKey: [tabla === 'efecto' ? 'efectos-ref' : 'informes-ref', causa.id] });
        avisar(tabla === 'efecto' ? `Se dio de alta el efecto Nº ${numero}.` : `Se dio de alta el informe ${numero}.`);
      }
    }
    const r = await guardarCampo('pieza', pieza.id, campo, anteriorId, nuevoId);
    if (r.tipo === 'conflicto') {
      const refs = qc.getQueryData<{ id: string; numero: string }[]>([tabla === 'efecto' ? 'efectos-ref' : 'informes-ref', causa.id]) ?? [];
      return { ...r, actual: refs.find((x) => x.id === r.actual)?.numero ?? r.actual };
    }
    return r;
  }

  async function guardarFecha(nuevo: string | null, anterior: string | null) {
    const r = await guardarCampo('pieza', pieza.id, 'fecha_desde', anterior, nuevo);
    if (r.tipo === 'ok' && nuevo && pieza.fecha_precision === 'sin_fecha') {
      await guardarCampo('pieza', pieza.id, 'fecha_precision', 'sin_fecha', 'dia');
    }
    return r;
  }

  const cita = armarCita(causa.formato_cita, {
    efecto: pieza.efecto_numero,
    titulo: pieza.titulo,
    sobre: pieza.sobre,
    fojas: pieza.fojas,
    informe: pieza.informe_numero,
    numero: pieza.numero_orden,
  });

  async function copiarCita() {
    try {
      await navigator.clipboard.writeText(cita);
      setCitaCopiada(true);
      avisar('Cita copiada. Pegala en el escrito.');
      window.setTimeout(() => setCitaCopiada(false), 2000);
    } catch {
      avisar('No se pudo copiar automáticamente: seleccioná el texto de la cita y copialo.', { tono: 'aviso' });
    }
  }

  async function archivar() {
    const r = await guardarCampo('pieza', pieza.id, 'archivado_en', null, new Date().toISOString());
    if (r.tipo !== 'ok') {
      avisar(r.tipo === 'error' ? r.mensaje : 'Alguien la modificó recién. Probá de nuevo.', { tono: 'error' });
      return;
    }
    onCerrar();
    avisar(`Pieza ${pieza.numero_orden ? `Nº ${pieza.numero_orden}` : ''} archivada.`, {
      duracion: 8000,
      accion: {
        texto: 'Deshacer',
        alHacer: () => {
          void supabase
            .from('pieza')
            .update({ archivado_en: null })
            .eq('id', pieza.id)
            .then(({ error }) => {
              if (error) avisar(traducirError(error.message), { tono: 'error' });
              else void qc.invalidateQueries({ queryKey: ['piezas', causa.id] });
            });
        },
      },
    });
  }

  const creador = directorio.aliasUsuario(pieza.creado_por);
  const primerEnlace = enlaces.find((e) => e.url);

  return (
    <PanelLateral
      etiqueta={`Ficha de la pieza ${pieza.numero_orden ?? ''}`}
      onCerrar={onCerrar}
      encabezado={
        <>
          <FilaPanel>
            <Sello numero={pieza.numero_orden} grande />
            <ChipTipo tipo={pieza.tipo} esMensaje={Boolean(pieza.mensaje_id)} />
            {pieza.situacion && <EstadoProcesal situacion={pieza.situacion.situacion} detalle={pieza.situacion.titulo} />}
            <CerrarPanel onCerrar={onCerrar} />
          </FilaPanel>
          <h2 className={s.titulo}>{pieza.titulo}</h2>
          <div className={s.meta}>
            Cargada por {creador} · {haceCuanto(pieza.creado_en)}
            {pieza.version > 1 && ` · editada ${haceCuanto(pieza.actualizado_en)}`}
          </div>
          <div className={s.acciones}>
            {primerEnlace?.url ? (
              <a className={clasesBoton('primario')} href={primerEnlace.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <ExternalLink aria-hidden />
                Abrir en Drive
              </a>
            ) : (
              <Boton icono={<ExternalLink aria-hidden />} disabled title="Agregá un link en Enlaces">
                Sin link
              </Boton>
            )}
            <Boton icono={citaCopiada ? <Check aria-hidden /> : <Copy aria-hidden />} hecho={citaCopiada} onClick={() => void copiarCita()}>
              {citaCopiada ? 'Copiada' : 'Copiar cita'}
            </Boton>
            <Boton
              icono={editando ? <Check aria-hidden /> : <Pencil aria-hidden />}
              variante={editando ? 'primario' : 'secundario'}
              onClick={() => setEditando((e) => !e)}
            >
              {editando ? 'Listo' : 'Editar'}
            </Boton>
          </div>
        </>
      }
    >
      {avisoCambio && (
        <div className={s.aviso} role="status">
          <Avatar texto={directorio.alias(avisoCambio.usuario_email)} email={avisoCambio.usuario_email} tamano="chico" />
          <span>
            <b>{directorio.alias(avisoCambio.usuario_email)}</b> acaba de cambiar{' '}
            {Object.entries(avisoCambio.cambios)
              .map(([campo, v]) => `${CAMPOS[campo] ?? campo}: ${valorLegible(campo, v.antes)} → ${valorLegible(campo, v.despues)}`)
              .join(' · ')}
          </span>
          <button type="button" onClick={() => setAvisoCambio(null)}>
            Entendido
          </button>
        </div>
      )}

      {editando ? (
        <>
          <Seccion titulo="Datos del documento" naturaleza="dato">
            <div className={s.campos}>
              <CampoEditable campo="titulo" etiqueta="Título o asunto" valor={pieza.titulo} permitirVacio={false} onGuardar={guardar('titulo')} />
              <div className={s.dosCampos}>
                <CampoEditable campo="numero_orden" etiqueta="Nº de orden" valor={pieza.numero_orden} onGuardar={guardar('numero_orden')} ayuda="Admite 2.1, 2 bis…" />
                <CampoEditable
                  campo="tipo"
                  etiqueta="Tipo"
                  tipo="opciones"
                  permitirVacio={false}
                  valor={pieza.tipo}
                  opciones={TIPOS_PIEZA.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
                  onGuardar={guardar('tipo')}
                />
              </div>
              <div className={s.dosCampos}>
                <CampoEditable campo="fecha_desde" etiqueta="Fecha del documento" tipo="fecha" valor={pieza.fecha_desde} onGuardar={guardarFecha} />
                <CampoEditable
                  campo="fecha_precision"
                  etiqueta="Precisión de la fecha"
                  tipo="opciones"
                  permitirVacio={false}
                  valor={pieza.fecha_precision}
                  opciones={PRECISIONES.map((p) => ({ valor: p.valor, etiqueta: p.etiqueta }))}
                  onGuardar={guardar('fecha_precision')}
                />
              </div>
              <div className={s.dosCampos}>
                <CampoEditable campo="autor" etiqueta="Autor o remitente" valor={pieza.autor} onGuardar={guardar('autor')} />
                <CampoEditable campo="destinatarios" etiqueta="Destinatarios" valor={pieza.destinatarios} onGuardar={guardar('destinatarios')} />
              </div>
              <CampoEditable campo="fojas" etiqueta="Fojas" valor={pieza.fojas} onGuardar={guardar('fojas')} ayuda="Como figuran: 12, 12/14, 12 vta." />
              <CampoEditable campo="resumen" etiqueta="Resumen del contenido" tipo="textoLargo" valor={pieza.resumen} onGuardar={guardar('resumen')} ayuda="Qué dice el documento, sin interpretar." />
            </div>
          </Seccion>

          <Seccion titulo="Origen" naturaleza="dato">
            <div className={s.campos}>
              <div className={s.dosCampos}>
                <CampoEditable
                  campo="efecto_id"
                  etiqueta="Efecto Nº"
                  valor={pieza.efecto_numero}
                  onGuardar={(n) => guardarReferencia('efecto', n)}
                  ayuda="Si no existe, se da de alta."
                />
                <CampoEditable campo="sobre" etiqueta="Sobre Nº" valor={pieza.sobre} onGuardar={guardar('sobre')} />
              </div>
              <div className={s.dosCampos}>
                <CampoEditable
                  campo="informe_id"
                  etiqueta="Informe de origen"
                  valor={pieza.informe_numero}
                  onGuardar={(n) => guardarReferencia('informe', n)}
                  ayuda="Por ejemplo C6855."
                />
                <CampoEditable campo="fecha_secuestro" etiqueta="Fecha de secuestro" tipo="fecha" valor={pieza.fecha_secuestro} onGuardar={guardar('fecha_secuestro')} />
              </div>
              <CampoEditable campo="lugar_secuestro" etiqueta="Lugar de secuestro" valor={pieza.lugar_secuestro} onGuardar={guardar('lugar_secuestro')} />
            </div>
          </Seccion>
        </>
      ) : (
        <>
          <Seccion titulo="Datos del documento" naturaleza="dato">
            <Datos>
              <Dato etiqueta="Fecha">
                {pieza.fecha_desde && pieza.fecha_precision !== 'sin_fecha' ? (
                  <span className="cifras">{fechaConPrecision(pieza.fecha_desde, pieza.fecha_precision)}</span>
                ) : (
                  <Falta />
                )}
              </Dato>
              <Dato etiqueta="Autor">{pieza.autor ?? <Falta />}</Dato>
              <Dato etiqueta="Destinatarios">{pieza.destinatarios ?? <Nada />}</Dato>
              <Dato etiqueta="Fojas">{pieza.fojas ? <span className="cifras">{pieza.fojas}</span> : <Falta />}</Dato>
            </Datos>
            {pieza.resumen ? <Parrafo>{pieza.resumen}</Parrafo> : <Parrafo>Resumen del contenido: <Falta /></Parrafo>}
          </Seccion>

          <Seccion titulo="Origen" naturaleza="dato">
            <Datos>
              <Dato etiqueta="Efecto">{pieza.efecto_numero ? <EtiquetaEfecto numero={pieza.efecto_numero} /> : <Falta />}</Dato>
              <Dato etiqueta="Sobre">{pieza.sobre ?? <Falta />}</Dato>
              <Dato etiqueta="Informe">{pieza.informe_numero ?? <Nada />}</Dato>
              <Dato etiqueta="Secuestro">
                {pieza.lugar_secuestro || pieza.fecha_secuestro ? (
                  [pieza.lugar_secuestro, pieza.fecha_secuestro && fechaConPrecision(pieza.fecha_secuestro, 'dia')].filter(Boolean).join(' · ')
                ) : (
                  <Nada />
                )}
              </Dato>
            </Datos>
          </Seccion>
        </>
      )}

      <Seccion titulo="Enlaces">
        <Enlaces causaId={causa.id} piezaId={pieza.id} enlaces={enlaces} />
      </Seccion>

      <Seccion titulo="Observaciones del analista" naturaleza="interpretacion">
        {editando ? (
          <CampoEditable
            campo="observaciones_analista"
            etiqueta="Interpretación"
            tipo="textoLargo"
            interpretacion
            valor={pieza.observaciones_analista}
            onGuardar={guardar('observaciones_analista')}
            ayuda="Por qué importa, con qué hecho o contratación se conecta."
          />
        ) : pieza.observaciones_analista ? (
          <TextoInterpretacion>{pieza.observaciones_analista}</TextoInterpretacion>
        ) : (
          <TextoInterpretacion>Todavía no hay observaciones. Tocá «Editar» para escribir por qué importa esta pieza.</TextoInterpretacion>
        )}
      </Seccion>

      <Seccion titulo="Trabajo">
        {editando ? (
          <div className={s.campos}>
            <div className={s.dosCampos}>
              <CampoEditable
                campo="relevancia"
                etiqueta="Relevancia"
                tipo="opciones"
                valor={pieza.relevancia}
                opciones={RELEVANCIAS.map((r) => ({ valor: r.valor, etiqueta: r.etiqueta }))}
                onGuardar={guardar('relevancia')}
              />
              <CampoEditable
                campo="estado_trabajo"
                etiqueta="Estado"
                tipo="opciones"
                permitirVacio={false}
                valor={pieza.estado_trabajo}
                opciones={ESTADOS_TRABAJO.map((e) => ({ valor: e.valor, etiqueta: e.etiqueta }))}
                onGuardar={guardar('estado_trabajo')}
              />
            </div>
            <CampoEditable
              campo="responsable"
              etiqueta="Responsable"
              tipo="opciones"
              valor={pieza.responsable}
              opciones={directorio.miembros.filter((m) => m.activo).map((m) => ({ valor: m.email, etiqueta: aliasDe(m) }))}
              onGuardar={guardar('responsable')}
            />
            <CampoEditable
              campo="etiquetas"
              etiqueta="Etiquetas"
              valor={pieza.etiquetas.join(', ')}
              ayuda="Separadas por coma."
              onGuardar={(nuevo) =>
                guardarCampo(
                  'pieza',
                  pieza.id,
                  'etiquetas',
                  pieza.etiquetas,
                  (nuevo ?? '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
        ) : (
          <Datos>
            <Dato etiqueta="Relevancia">
              <Relevancia valor={pieza.relevancia} />
            </Dato>
            <Dato etiqueta="Estado">{ESTADOS_TRABAJO.find((e) => e.valor === pieza.estado_trabajo)?.etiqueta}</Dato>
            <Dato etiqueta="Responsable">
              {pieza.responsable ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Avatar texto={directorio.alias(pieza.responsable)} email={pieza.responsable} tamano="chico" />
                  {directorio.alias(pieza.responsable)}
                </span>
              ) : (
                <Nada />
              )}
            </Dato>
            <Dato etiqueta="Etiquetas">{pieza.etiquetas.length ? pieza.etiquetas.join(', ') : <Nada />}</Dato>
          </Datos>
        )}
      </Seccion>

      <Seccion titulo="Estado procesal">
        {pieza.situacion ? (
          <>
            <EstadoProcesal situacion={pieza.situacion.situacion} />
            <span className={s.via}>
              {pieza.situacion.titulo} · {VIA[pieza.situacion.via]}
            </span>
          </>
        ) : (
          <span className={s.estadoLimpio}>
            <Check aria-hidden /> Sin incidencias registradas
          </span>
        )}
      </Seccion>

      <Seccion titulo="Cita para escritos">
        <div className={s.cita}>{cita}</div>
      </Seccion>

      <Seccion titulo="Historial">
        <Historial eventos={historial} />
      </Seccion>

      <Seccion titulo="Archivo">
        {confirmarArchivo ? (
          <div className={s.confirmar}>
            <span>La pieza sale del índice pero no se borra: queda en el historial y se puede restaurar.</span>
            <Boton tamano="chico" variante="peligro" icono={<Archive aria-hidden />} onClick={() => void archivar()}>
              Archivar
            </Boton>
            <Boton tamano="chico" variante="fantasma" onClick={() => setConfirmarArchivo(false)}>
              Cancelar
            </Boton>
          </div>
        ) : (
          <div>
            <Boton tamano="chico" variante="fantasma" icono={<Archive aria-hidden />} onClick={() => setConfirmarArchivo(true)}>
              Archivar esta pieza
            </Boton>
          </div>
        )}
      </Seccion>
    </PanelLateral>
  );
}

function Enlaces({ causaId, piezaId, enlaces }: { causaId: string; piezaId: string; enlaces: ReturnType<typeof useEnlaces>['data'] & object }) {
  const { avisar } = useToast();
  const qc = useQueryClient();
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function agregar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const url = String(datos.get('url') ?? '').trim();
    if (!esUrlValida(url)) {
      setError('Pegá el link completo, que empiece con https://');
      return;
    }
    setEnviando(true);
    const { error: err } = await supabase.from('enlace').insert({
      causa_id: causaId,
      entidad_id: piezaId,
      etiqueta: String(datos.get('etiqueta')),
      url,
      drive_file_id: idDeDrive(url),
    });
    setEnviando(false);
    if (err) {
      setError(traducirError(err.message));
      return;
    }
    setError(null);
    setAgregando(false);
    void qc.invalidateQueries({ queryKey: ['enlaces', piezaId] });
    avisar('Link agregado.');
  }

  return (
    <div className={s.enlaces}>
      {enlaces.length === 0 && !agregando && <span className={s.vacioChico}>Todavía no hay links. Agregá el del Drive para abrirla en un clic.</span>}
      {enlaces.map((en) =>
        en.url ? (
          <a key={en.id} className={s.enlace} href={en.url} target="_blank" rel="noreferrer">
            <span className={s.enlaceEtiqueta}>{en.etiqueta}</span>
            <span className={s.enlaceDestino}>
              {esCarpetaDeDrive(en.url) ? <FolderOpen aria-hidden /> : <IconoLink aria-hidden />}
              {en.nombre_archivo ?? (en.url.includes('google.com') ? (esCarpetaDeDrive(en.url) ? 'Carpeta en Google Drive' : 'Archivo en Google Drive') : en.url)}
            </span>
            <span className={s.hash}>{en.sha256 ? `SHA-256 ${en.sha256.slice(0, 16)}…` : 'SHA-256: se toma de Drive al vincular con el selector (próximamente)'}</span>
          </a>
        ) : (
          <div key={en.id} className={s.enlace}>
            <span className={s.enlaceEtiqueta}>{en.etiqueta}</span>
            <span>{en.ruta_local}</span>
          </div>
        ),
      )}
      {agregando ? (
        <form className={s.nuevoEnlace} onSubmit={agregar}>
          <Selector name="etiqueta" etiqueta="Es" defaultValue="original escaneado">
            <option value="original escaneado">Original escaneado</option>
            <option value="transcripción">Transcripción</option>
            <option value="imagen forense">Imagen forense</option>
            <option value="carpeta">Carpeta</option>
            <option value="otro">Otro</option>
          </Selector>
          <Entrada name="url" etiqueta="Link" type="url" placeholder="https://drive.google.com/…" autoFocus error={error} />
          <Boton type="submit" variante="primario" cargando={enviando}>
            Agregar
          </Boton>
        </form>
      ) : (
        <div>
          <Boton tamano="chico" icono={<Plus aria-hidden />} onClick={() => setAgregando(true)}>
            Agregar link
          </Boton>
        </div>
      )}
      {error && !agregando && <AvisoError titulo={error} />}
    </div>
  );
}

function Historial({ eventos }: { eventos: EventoHistorial[] }) {
  const directorio = useDirectorio();
  if (!eventos.length) return <span className={s.vacioChico}>Sin movimientos todavía.</span>;
  return (
    <ol className={s.historial}>
      {eventos.slice(0, 20).map((e) => {
        const quien = e.usuario_email ? directorio.alias(e.usuario_email) : 'Sistema';
        return (
          <li key={e.id}>
            <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
            <div>
              <b>{quien}</b>{' '}
              {e.accion === 'alta' && 'cargó la ficha'}
              {e.accion === 'archivo' && 'archivó la ficha'}
              {e.accion === 'restauracion' && 'restauró la ficha'}
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
  );
}
