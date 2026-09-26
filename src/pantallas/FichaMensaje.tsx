import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, FileText, Link2, Lock, MessagesSquare, Plus, ScrollText, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { claseControl } from '../componentes/campos';
import { CampoEditable, Dato, Datos, Nada, Seccion } from '../componentes/Ficha';
import { Avatar, Chip, EtiquetaEfecto, Sello } from '../componentes/marcas';
import { CerrarPanel, FilaPanel, PanelLateral } from '../componentes/PanelLateral';
import { useToast } from '../componentes/Toast';
import { todas, type EfectoVista } from '../datos/causa';
import { useDirectorio, useHistorial } from '../datos/consultas';
import { traducirError, useGuardado } from '../datos/guardado';
import type { ContratacionVista, ConversacionVista, PiezaRef } from '../datos/hechos';
import { CAMPOS, valorLegible } from '../lib/etiquetas';
import { fechaCorta } from '../lib/informe';
import { supabase } from '../lib/supabase';
import { haceCuanto } from '../lib/tiempo';
import type { Mensaje, TipoMensaje, Vinculo } from '../lib/tipos';
import s from './FichaEfecto.module.css';
import sm from './Mensajes.module.css';

export const TIPO_MENSAJE: Record<TipoMensaje, string> = {
  texto: 'Texto',
  audio_transcripto: 'Audio transcripto',
  imagen: 'Imagen',
  archivo: 'Archivo',
  otro: 'Otro',
};

export function FichaMensaje({
  mensaje,
  conversacion,
  contrataciones,
  piezas,
  vinculos,
  onRelevante,
  onCerrar,
}: {
  mensaje: Mensaje;
  conversacion: ConversacionVista;
  contrataciones: ContratacionVista[];
  piezas: PiezaRef[];
  vinculos: Vinculo[];
  onRelevante: (m: Mensaje) => void;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const directorio = useDirectorio();
  const { data: historial = [] } = useHistorial(mensaje.id);
  const [enviando, setEnviando] = useState<'contratacion' | 'pieza' | null>(null);

  const mapaContrataciones = new Map(contrataciones.map((c) => [c.id, c]));
  const mapaPiezas = new Map(piezas.map((p) => [p.id, p]));
  const propios = vinculos.filter((v) => v.origen_id === mensaje.id || v.destino_id === mensaje.id);
  const otro = (v: Vinculo) => (v.origen_id === mensaje.id ? v.destino_id : v.origen_id);

  async function vincular(e: FormEvent<HTMLFormElement>, que: 'contratacion' | 'pieza') {
    e.preventDefault();
    const form = e.currentTarget;
    const destino = String(new FormData(form).get('destino') ?? '');
    if (!destino) return;
    if (propios.some((v) => otro(v) === destino)) {
      avisar('Ya estaba vinculado.', { tono: 'aviso' });
      return;
    }
    setEnviando(que);
    const { error } = await supabase
      .from('vinculo')
      .insert({ causa_id: mensaje.causa_id, origen_id: mensaje.id, destino_id: destino, tipo: que === 'contratacion' ? 'prueba_de' : 'relacionado' });
    setEnviando(null);
    if (error) avisar(/duplicate key/i.test(error.message) ? 'Ya estaba vinculado.' : traducirError(error.message), { tono: 'error' });
    else {
      form.reset();
      void qc.invalidateQueries({ queryKey: ['vinculos', mensaje.causa_id] });
      const c = mapaContrataciones.get(destino);
      avisar(c ? `Vinculado a ${c.identificador}.` : 'Vinculado a la pieza.');
    }
  }

  async function desvincular(v: Vinculo) {
    const { error } = await supabase.from('vinculo').update({ archivado_en: new Date().toISOString() }).eq('id', v.id);
    if (error) avisar(traducirError(error.message), { tono: 'error' });
    else {
      void qc.invalidateQueries({ queryKey: ['vinculos', mensaje.causa_id] });
      avisar('Se quitó el vínculo.');
    }
  }

  const origen = mensaje.origen as { archivo?: string; linea?: string | number } | null;
  const fecha = mensaje.fecha ? fechaCorta(mensaje.fecha) : null;

  return (
    <PanelLateral
      etiqueta="Ficha del mensaje"
      onCerrar={onCerrar}
      encabezado={
        <>
          <FilaPanel>
            <Chip familia="mensaje">Mensaje</Chip>
            {mensaje.tipo !== 'texto' && <Chip familia="otros">{TIPO_MENSAJE[mensaje.tipo]}</Chip>}
            {mensaje.relevante && (
              <span className={sm.relevanteChip}>
                <BookmarkCheck aria-hidden /> Relevante
              </span>
            )}
            <CerrarPanel onCerrar={onCerrar} />
          </FilaPanel>
          <h2 className={s.titulo}>
            {mensaje.emisor ?? 'Emisor sin identificar'} <span className={sm.flecha}>→</span> {mensaje.receptor ?? '¿?'}
          </h2>
          <div className={s.meta}>
            {[fecha, mensaje.fecha_hora_texto && mensaje.fecha_hora_texto !== fecha ? `«${mensaje.fecha_hora_texto}»` : null, conversacion.titulo].filter(Boolean).join(' · ')}
          </div>
          <div className={s.acciones}>
            <Boton variante={mensaje.relevante ? 'primario' : 'secundario'} icono={mensaje.relevante ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />} onClick={() => onRelevante(mensaje)}>
              {mensaje.relevante ? 'Marcado como relevante' : 'Marcar como relevante'}
            </Boton>
          </div>
        </>
      }
    >
      <Seccion titulo="Texto literal" naturaleza="dato">
        <blockquote className={sm.literal}>{mensaje.contenido || <Nada />}</blockquote>
        <p className={sm.huella}>
          <Lock aria-hidden /> Transcripción literal: no se edita. Huella SHA-256 {mensaje.hash_contenido?.slice(0, 12)}…
        </p>
      </Seccion>

      <Seccion titulo="Observación del analista" naturaleza="interpretacion">
        <CampoEditable
          campo="observacion"
          etiqueta="Por qué es relevante y con qué se vincula"
          tipo="textoLargo"
          interpretacion
          valor={mensaje.observacion}
          ayuda="Va a la columna OBSERVACIONES del informe."
          onGuardar={(nuevo, anterior) => guardarCampo('mensaje', mensaje.id, 'observacion', anterior, nuevo)}
        />
      </Seccion>

      <Seccion titulo="Vínculos">
        {propios.length ? (
          <ul className={s.lista}>
            {propios.map((v) => {
              const id = otro(v);
              const c = mapaContrataciones.get(id);
              const p = mapaPiezas.get(id);
              return (
                <li key={v.id}>
                  {c ? (
                    <Link to={`../contrataciones?c=${c.id}`} relative="path" className={sm.vinculo}>
                      <ScrollText aria-hidden /> <strong>{c.identificador}</strong>
                      {c.expediente && <span className={s.tenue}>Expte. {c.expediente}</span>}
                    </Link>
                  ) : p ? (
                    <Link to={`../indice?pieza=${p.id}`} relative="path" className={sm.vinculo}>
                      <Sello numero={p.numero_orden} /> <span>{p.titulo}</span>
                    </Link>
                  ) : (
                    <span className={s.tenue}>
                      <Link2 aria-hidden /> Otra ficha
                    </span>
                  )}
                  <Boton tamano="chico" variante="fantasma" soloIcono aria-label="Quitar el vínculo" title="Quitar el vínculo" onClick={() => void desvincular(v)}>
                    <X aria-hidden />
                  </Boton>
                </li>
              );
            })}
          </ul>
        ) : (
          <span className={s.tenue}>Sin vínculos. Vinculalo a la contratación o a la pieza que prueba.</span>
        )}
        <form className={sm.agregar} onSubmit={(e) => void vincular(e, 'contratacion')}>
          <select name="destino" className={claseControl} aria-label="Contratación a vincular" defaultValue="">
            <option value="" disabled>
              {contrataciones.length ? 'Elegí una contratación…' : 'No hay contrataciones cargadas'}
            </option>
            {contrataciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.identificador}
                {c.expediente ? ` · Expte. ${c.expediente}` : ''}
              </option>
            ))}
          </select>
          <Boton type="submit" tamano="chico" icono={<Plus aria-hidden />} cargando={enviando === 'contratacion'} disabled={!contrataciones.length}>
            Vincular
          </Boton>
        </form>
        {piezas.length > 0 && (
          <form className={sm.agregar} onSubmit={(e) => void vincular(e, 'pieza')}>
            <select name="destino" className={claseControl} aria-label="Pieza a vincular" defaultValue="">
              <option value="" disabled>
                Elegí una pieza del índice…
              </option>
              {piezas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero_orden ? `Nº ${p.numero_orden} · ` : ''}
                  {p.titulo.slice(0, 70)}
                </option>
              ))}
            </select>
            <Boton type="submit" tamano="chico" icono={<Plus aria-hidden />} cargando={enviando === 'pieza'}>
              Vincular
            </Boton>
          </form>
        )}
      </Seccion>

      <Seccion titulo="Origen" naturaleza="dato">
        <Datos>
          <Dato etiqueta="Tipo">{TIPO_MENSAJE[mensaje.tipo]}</Dato>
          <Dato etiqueta="Fecha tal cual">{mensaje.fecha_hora_texto ?? <Nada />}</Dato>
          <Dato etiqueta="Orden">{mensaje.orden ?? <Nada />}</Dato>
          <Dato etiqueta="Archivo">{origen?.archivo ? `${origen.archivo}${origen.linea ? `, línea ${origen.linea}` : ''}` : <Nada />}</Dato>
        </Datos>
      </Seccion>

      {historial.length > 0 && (
        <Seccion titulo="Historial">
          <ol className={s.historial}>
            {historial.slice(0, 10).map((e) => {
              const quien = e.usuario_email ? directorio.alias(e.usuario_email) : 'Sistema';
              return (
                <li key={e.id}>
                  <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
                  <div>
                    <b>{quien}</b> {e.accion === 'alta' && 'lo importó'}
                    {e.accion === 'edicion' &&
                      Object.entries(e.cambios).map(([campo, v], i) => (
                        <span key={campo}>
                          {i > 0 && ' · '}
                          {campo === 'relevante' ? (v.despues ? 'lo marcó como relevante' : 'le sacó la marca de relevante') : (
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
        </Seccion>
      )}
    </PanelLateral>
  );
}

/** Datos de la conversación que usa el informe: dispositivo, titular, número, agendado y período. */
export function DatosConversacion({
  conversacion,
  efectos,
  onCerrar,
}: {
  conversacion: ConversacionVista;
  efectos: EfectoVista[];
  onCerrar: () => void;
}) {
  const { guardarCampo } = useGuardado();
  const informes = useQuery({
    queryKey: ['informes-ref', conversacion.causa_id],
    queryFn: () => todas<{ id: string; numero: string }>('informe', conversacion.causa_id, 'id,numero'),
  });
  const guardar = (campo: string) => (nuevo: string | null, anterior: string | null) => guardarCampo('conversacion', conversacion.id, campo, anterior, nuevo);
  const efecto = efectos.find((e) => e.id === conversacion.efecto_id) ?? null;
  const dispositivos = [...efectos].sort((a, b) => Number(b.soporte === 'digital') - Number(a.soporte === 'digital'));
  const origen = conversacion.origen as { archivo?: string } | null;

  return (
    <PanelLateral
      etiqueta="Datos de la conversación"
      onCerrar={onCerrar}
      encabezado={
        <>
          <FilaPanel>
            <Chip familia="mensaje">Conversación</Chip>
            <CerrarPanel onCerrar={onCerrar} />
          </FilaPanel>
          <h2 className={s.titulo}>{conversacion.titulo}</h2>
          <div className={s.meta}>Estos datos arman el encabezado del informe de relevamiento. Lo que falte sale como [completar].</div>
        </>
      }
    >
      <Seccion titulo="Conversación" naturaleza="dato">
        <div className={s.campos}>
          <CampoEditable campo="titulo" etiqueta="Título" valor={conversacion.titulo} permitirVacio={false} onGuardar={guardar('titulo')} ayuda="En el informe: «1. Conversación entre … y …»" />
          <CampoEditable campo="participantes" etiqueta="Participantes" valor={conversacion.participantes} onGuardar={guardar('participantes')} />
          <div className={s.dosCampos}>
            <CampoEditable campo="periodo_desde" etiqueta="Período desde" tipo="fecha" valor={conversacion.periodo_desde} onGuardar={guardar('periodo_desde')} />
            <CampoEditable campo="periodo_hasta" etiqueta="Período hasta" tipo="fecha" valor={conversacion.periodo_hasta} onGuardar={guardar('periodo_hasta')} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Teléfono analizado" naturaleza="dato">
        <div className={s.campos}>
          <CampoEditable
            campo="efecto_id"
            etiqueta="Efecto"
            tipo="opciones"
            valor={conversacion.efecto_id}
            opciones={dispositivos.map((e) => ({ valor: e.id, etiqueta: `Nº ${e.numero}${e.descripcion_acta ? ` · ${e.descripcion_acta.slice(0, 60)}` : ''}` }))}
            onGuardar={guardar('efecto_id')}
          />
          {efecto && (
            <p className={sm.segunActa}>
              <EtiquetaEfecto numero={efecto.numero} /> {efecto.descripcion_acta ?? 'sin descripción en el acta'}
              {(efecto.propietario || efecto.tenedor) && (
                <span className={s.tenue}>
                  {' '}
                  · Propietario: {efecto.propietario ?? '—'} · Tenedor: {efecto.tenedor ?? '—'}
                </span>
              )}
            </p>
          )}
          <CampoEditable
            campo="informe_id"
            etiqueta="Informe de extracción del Gabinete"
            tipo="opciones"
            valor={conversacion.informe_id}
            opciones={(informes.data ?? []).map((i) => ({ valor: i.id, etiqueta: i.numero }))}
            onGuardar={guardar('informe_id')}
            ayuda={efecto?.informe_numero && !conversacion.informe_id ? `El efecto figura con el informe ${efecto.informe_numero}.` : undefined}
          />
          <CampoEditable campo="titular_dispositivo" etiqueta="Titular del teléfono" valor={conversacion.titular_dispositivo} onGuardar={guardar('titular_dispositivo')} ayuda="En el informe: «El teléfono analizado pertenece a …»" />
          <div className={s.dosCampos}>
            <CampoEditable campo="contacto_relevante" etiqueta="Número de la conversación" valor={conversacion.contacto_relevante} onGuardar={guardar('contacto_relevante')} />
            <CampoEditable campo="agendado_como" etiqueta="Agendado como" valor={conversacion.agendado_como} onGuardar={guardar('agendado_como')} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Notas del analista" naturaleza="interpretacion">
        <CampoEditable campo="observaciones" etiqueta="Observaciones" tipo="textoLargo" interpretacion valor={conversacion.observaciones} onGuardar={guardar('observaciones')} />
      </Seccion>

      {origen?.archivo && (
        <Seccion titulo="Origen">
          <p className={s.origen}>
            <FileText aria-hidden /> Importada de «{origen.archivo}».{' '}
            {conversacion.resumen && (
              <>
                <MessagesSquare aria-hidden /> {conversacion.resumen.mensajes} mensajes.
              </>
            )}
          </p>
        </Seccion>
      )}
    </PanelLateral>
  );
}
