import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, FileText, Lock, Pencil, Plus, Smartphone, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boton, clasesBoton } from '../componentes/Boton';
import { CampoEditable, Dato, Datos, Nada, Parrafo, Seccion, type ResultadoCampo } from '../componentes/Ficha';
import { Avatar, Chip, EstadoProcesal, EtiquetaEfecto, Falta, Sello } from '../componentes/marcas';
import { CerrarPanel, FilaPanel, PanelLateral } from '../componentes/PanelLateral';
import { useToast } from '../componentes/Toast';
import type { EfectoVista } from '../datos/causa';
import { useDirectorio, useHistorial } from '../datos/consultas';
import { traducirError, useGuardado } from '../datos/guardado';
import {
  APTO_ETIQUETA,
  CAMPOS,
  COLUMNAS_TABLERO,
  ESTADOS_EFECTO,
  MATERIALES_ETIQUETA,
  PRIORIDAD_ETIQUETA,
  SITUACIONES,
  aliasDe,
  valorLegible,
} from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import { fechaCorta, haceCuanto } from '../lib/tiempo';
import type { Procedimiento } from '../lib/tipos';
import { DialogoIncidencia } from './DialogosEfecto';
import { NuevaPieza } from './NuevaPieza';
import s from './FichaEfecto.module.css';

export function etiquetaProcedimiento(p: Procedimiento | null | undefined) {
  if (!p) return null;
  return [p.fecha ? fechaCorta(p.fecha) : null, p.domicilio].filter(Boolean).join(' · ');
}

export function FichaEfecto({
  efecto,
  procedimientos,
  onCerrar,
}: {
  efecto: EfectoVista;
  procedimientos: Procedimiento[];
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const directorio = useDirectorio();
  const { data: historial = [] } = useHistorial(efecto.id);
  const [editando, setEditando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [creandoPieza, setCreandoPieza] = useState(false);

  const piezas = useQuery({
    queryKey: ['piezas-efecto', efecto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pieza')
        .select('id,numero_orden,titulo,tipo')
        .eq('efecto_id', efecto.id)
        .is('archivado_en', null)
        .order('orden_clave', { nullsFirst: false });
      if (error) throw new Error(error.message);
      return data as { id: string; numero_orden: string | null; titulo: string; tipo: string }[];
    },
  });

  const incidencias = useQuery({
    queryKey: ['incidencias-efecto', efecto.id, efecto.procedimiento_id],
    queryFn: async () => {
      const ids = [efecto.id, efecto.procedimiento_id].filter(Boolean) as string[];
      const { data, error } = await supabase
        .from('incidencia_alcance')
        .select('id,entidad_id,incidencia:incidencia_procesal(id,titulo,situacion,tipo)')
        .in('entidad_id', ids)
        .is('archivado_en', null);
      if (error) throw new Error(error.message);
      return data as unknown as { id: string; entidad_id: string; incidencia: { id: string; titulo: string; situacion: string; tipo: string } }[];
    },
  });

  const guardar =
    (campo: string) =>
    (nuevo: string | null, anterior: string | null): Promise<ResultadoCampo> =>
      guardarCampo('efecto', efecto.id, campo, anterior, nuevo);

  const guardarBooleano =
    (campo: 'requiere_escribiente' | 'tiene_informe_gabinete', actual: boolean | null) =>
    (nuevo: string | null): Promise<ResultadoCampo> =>
      guardarCampo('efecto', efecto.id, campo, actual, nuevo === null ? null : nuevo === 'si');

  async function guardarFojas(nuevo: string | null): Promise<ResultadoCampo> {
    if (nuevo !== null && !/^\d+$/.test(nuevo)) return { tipo: 'error', mensaje: 'Escribí un número entero de fojas.' };
    return guardarCampo('efecto', efecto.id, 'fojas_aprox', efecto.fojas_aprox, nuevo === null ? null : Number(nuevo));
  }

  async function guardarInforme(numero: string | null): Promise<ResultadoCampo> {
    let id: string | null = null;
    if (numero) {
      const n = numero.toUpperCase();
      const { data, error } = await supabase.from('informe').select('id').eq('causa_id', efecto.causa_id).eq('numero', n).is('archivado_en', null).limit(1);
      if (error) return { tipo: 'error', mensaje: traducirError(error.message) };
      id = (data?.[0] as { id: string } | undefined)?.id ?? null;
      if (!id) {
        const alta = await supabase.from('informe').insert({ causa_id: efecto.causa_id, numero: n, tipo: 'gabinete' }).select('id').single();
        if (alta.error) return { tipo: 'error', mensaje: traducirError(alta.error.message) };
        id = (alta.data as { id: string }).id;
      }
    }
    return guardarCampo('efecto', efecto.id, 'informe_id', efecto.informe_id, id);
  }

  async function quitarIncidencia(alcanceId: string) {
    const { error } = await supabase.from('incidencia_alcance').update({ archivado_en: new Date().toISOString() }).eq('id', alcanceId);
    if (error) avisar(traducirError(error.message), { tono: 'error' });
    else {
      void qc.invalidateQueries({ queryKey: ['incidencias-efecto', efecto.id] });
      void qc.invalidateQueries({ queryKey: ['estado-procesal-efectos', efecto.causa_id] });
      avisar('Se quitó la situación procesal de este efecto.');
    }
  }

  const responsableAlias = efecto.responsable ? directorio.alias(efecto.responsable) : efecto.responsable_alias;
  const siNo = (v: boolean | null) => (v === null ? null : v ? 'si' : 'no');
  const opcionesSiNo = [
    { valor: 'si', etiqueta: 'Sí' },
    { valor: 'no', etiqueta: 'No' },
  ];

  return (
    <PanelLateral
      etiqueta={`Ficha del efecto ${efecto.numero}`}
      onCerrar={onCerrar}
      encabezado={
        <>
          <FilaPanel>
            <EtiquetaEfecto numero={efecto.numero} />
            {efecto.soporte && (
              <Chip familia={efecto.soporte === 'digital' ? 'pericial' : 'documental'}>
                {efecto.soporte === 'digital' ? 'Dispositivo' : 'Papel'}
              </Chip>
            )}
            {efecto.situacion && <EstadoProcesal situacion={efecto.situacion.situacion} detalle={efecto.situacion.titulo} />}
            <CerrarPanel onCerrar={onCerrar} />
          </FilaPanel>
          <h2 className={s.titulo}>Efecto Nº {efecto.numero}</h2>
          <div className={s.meta}>
            <span className={`${s.estado} ${s[`estado_${efecto.estado}`]}`}>{ESTADOS_EFECTO[efecto.estado]}</span>
            {efecto.tipo_material && <span>{MATERIALES_ETIQUETA[efecto.tipo_material] ?? efecto.tipo_material}</span>}
            {responsableAlias ? <span>A cargo de {responsableAlias}</span> : !efecto.requiere_escribiente ? <span>No requiere escribiente</span> : <span>Sin asignar</span>}
          </div>
          <div className={s.acciones}>
            {efecto.link_escaneo ? (
              <a className={clasesBoton('primario')} href={efecto.link_escaneo} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <ExternalLink aria-hidden /> Abrir escaneo
              </a>
            ) : null}
            <Boton icono={editando ? <Check aria-hidden /> : <Pencil aria-hidden />} variante={editando ? 'primario' : 'secundario'} onClick={() => setEditando((e) => !e)}>
              {editando ? 'Listo' : 'Editar'}
            </Boton>
            <Boton icono={<Plus aria-hidden />} onClick={() => setCreandoPieza(true)}>
              Nueva pieza de este efecto
            </Boton>
          </div>
        </>
      }
    >
      <Seccion titulo="Descripción según el acta" naturaleza="dato">
        {efecto.descripcion_acta ? (
          <div className={s.acta}>
            <span className={s.actaRotulo}>
              <Lock aria-hidden /> Texto del acta · no se modifica
            </span>
            <p>{efecto.descripcion_acta}</p>
          </div>
        ) : editando ? (
          <CampoEditable
            campo="descripcion_acta"
            etiqueta="Descripción según el acta"
            tipo="textoLargo"
            valor={null}
            ayuda="Copiala tal cual del acta. Una vez guardada, no se puede cambiar."
            onGuardar={guardar('descripcion_acta')}
          />
        ) : (
          <Parrafo>
            <Falta texto="[descripción según acta]" />
          </Parrafo>
        )}
      </Seccion>

      <Seccion titulo="Procedimiento y secuestro" naturaleza="dato">
        {editando ? (
          <div className={s.campos}>
            <CampoEditable
              campo="procedimiento_id"
              etiqueta="Procedimiento (allanamiento)"
              tipo="opciones"
              valor={efecto.procedimiento_id}
              opciones={procedimientos.map((p) => ({ valor: p.id, etiqueta: etiquetaProcedimiento(p) ?? 'Sin datos' }))}
              onGuardar={guardar('procedimiento_id')}
            />
            <CampoEditable campo="lugar_secuestro" etiqueta="Origen / lugar de secuestro" valor={efecto.lugar_secuestro} onGuardar={guardar('lugar_secuestro')} />
            <div className={s.dosCampos}>
              <CampoEditable campo="propietario" etiqueta="Propietario" valor={efecto.propietario} onGuardar={guardar('propietario')} />
              <CampoEditable campo="tenedor" etiqueta="Tenedor" valor={efecto.tenedor} onGuardar={guardar('tenedor')} />
            </div>
            <div className={s.dosCampos}>
              <CampoEditable campo="sobre" etiqueta="Sobre Nº" valor={efecto.sobre} onGuardar={guardar('sobre')} />
              <CampoEditable campo="numero_interno" etiqueta="Nº interno" valor={efecto.numero_interno} onGuardar={guardar('numero_interno')} />
            </div>
            <CampoEditable campo="resolucion_autorizante" etiqueta="Autorización (resolución)" valor={efecto.resolucion_autorizante} onGuardar={guardar('resolucion_autorizante')} />
            {efecto.soporte !== 'papel' && (
              <CampoEditable campo="patron_contrasena" etiqueta="Patrón / contraseña" valor={efecto.patron_contrasena} onGuardar={guardar('patron_contrasena')} />
            )}
          </div>
        ) : (
          <Datos>
            <Dato etiqueta="Procedimiento">{etiquetaProcedimiento(efecto.procedimiento) ?? (efecto.lugar_secuestro ? efecto.lugar_secuestro : <Falta />)}</Dato>
            {efecto.procedimiento && efecto.lugar_secuestro && <Dato etiqueta="Origen">{efecto.lugar_secuestro}</Dato>}
            <Dato etiqueta="Propietario">{efecto.propietario ?? <Nada />}</Dato>
            <Dato etiqueta="Tenedor">{efecto.tenedor ?? <Nada />}</Dato>
            {(efecto.sobre || efecto.numero_interno) && (
              <Dato etiqueta="Sobre / Nº interno">{[efecto.sobre && `Sobre ${efecto.sobre}`, efecto.numero_interno && `Nº interno ${efecto.numero_interno}`].filter(Boolean).join(' · ')}</Dato>
            )}
            <Dato etiqueta="Autorización">{efecto.resolucion_autorizante ?? <Nada />}</Dato>
            {efecto.soporte !== 'papel' && <Dato etiqueta="Patrón / contraseña">{efecto.patron_contrasena ?? <Nada />}</Dato>}
          </Datos>
        )}
      </Seccion>

      <Seccion titulo="Trabajo">
        {editando ? (
          <div className={s.campos}>
            <div className={s.dosCampos}>
              <CampoEditable
                campo="estado"
                etiqueta="Estado"
                tipo="opciones"
                permitirVacio={false}
                valor={efecto.estado}
                opciones={COLUMNAS_TABLERO.map((c) => ({ valor: c.valor, etiqueta: c.etiqueta }))}
                onGuardar={guardar('estado')}
              />
              <CampoEditable
                campo="responsable"
                etiqueta="Responsable"
                tipo="opciones"
                valor={efecto.responsable}
                opciones={directorio.miembros.filter((m) => m.activo).map((m) => ({ valor: m.email, etiqueta: aliasDe(m) }))}
                ayuda={!efecto.responsable && efecto.responsable_alias ? `En la planilla figura ${efecto.responsable_alias}: se asigna solo cuando lo invites con ese alias.` : undefined}
                onGuardar={guardar('responsable')}
              />
            </div>
            <div className={s.dosCampos}>
              <CampoEditable
                campo="requiere_escribiente"
                etiqueta="¿Requiere escribiente?"
                tipo="opciones"
                permitirVacio={false}
                valor={siNo(efecto.requiere_escribiente)}
                opciones={opcionesSiNo}
                onGuardar={guardarBooleano('requiere_escribiente', efecto.requiere_escribiente)}
              />
              <CampoEditable
                campo="apto_analisis"
                etiqueta="¿Apto para analizar?"
                tipo="opciones"
                valor={efecto.apto_analisis}
                opciones={Object.entries(APTO_ETIQUETA).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
                onGuardar={guardar('apto_analisis')}
              />
            </div>
            <div className={s.dosCampos}>
              <CampoEditable
                campo="prioridad"
                etiqueta="Prioridad"
                tipo="opciones"
                valor={efecto.prioridad}
                opciones={Object.entries(PRIORIDAD_ETIQUETA).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
                onGuardar={guardar('prioridad')}
              />
              <CampoEditable campo="fojas_aprox" etiqueta="Fojas aprox." valor={efecto.fojas_aprox?.toString() ?? null} onGuardar={guardarFojas} />
            </div>
            <div className={s.dosCampos}>
              <CampoEditable campo="fecha_inicio" etiqueta="Fecha de inicio" tipo="fecha" valor={efecto.fecha_inicio} onGuardar={guardar('fecha_inicio')} />
              <CampoEditable campo="fecha_fin" etiqueta="Fecha de fin" tipo="fecha" valor={efecto.fecha_fin} onGuardar={guardar('fecha_fin')} />
            </div>
            <CampoEditable campo="ubicacion_fisica" etiqueta="Ubicación actual" valor={efecto.ubicacion_fisica} onGuardar={guardar('ubicacion_fisica')} />
            <CampoEditable campo="link_escaneo" etiqueta="Link del escaneo" valor={efecto.link_escaneo} onGuardar={guardar('link_escaneo')} />
            <CampoEditable campo="observaciones" etiqueta="Observaciones" tipo="textoLargo" valor={efecto.observaciones} onGuardar={guardar('observaciones')} />
          </div>
        ) : (
          <>
            <Datos>
              <Dato etiqueta="Responsable">
                {responsableAlias ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Avatar texto={responsableAlias} email={efecto.responsable ?? responsableAlias} tamano="chico" />
                    {responsableAlias}
                    {!efecto.responsable && <span className={s.tenue}>(todavía no invitado)</span>}
                  </span>
                ) : efecto.requiere_escribiente ? (
                  <span className={s.alerta}>Sin asignar</span>
                ) : (
                  'No requiere escribiente'
                )}
              </Dato>
              <Dato etiqueta="Apto">{efecto.apto_analisis ? APTO_ETIQUETA[efecto.apto_analisis] : <Nada />}</Dato>
              <Dato etiqueta="Prioridad">{efecto.prioridad ? PRIORIDAD_ETIQUETA[efecto.prioridad] : <Nada />}</Dato>
              <Dato etiqueta="Fojas">{efecto.fojas_aprox ?? <Nada />}</Dato>
              <Dato etiqueta="Ubicación">{efecto.ubicacion_fisica ?? <Nada />}</Dato>
              {(efecto.fecha_inicio || efecto.fecha_fin) && (
                <Dato etiqueta="Fechas">
                  {[efecto.fecha_inicio && `desde ${fechaCorta(efecto.fecha_inicio)}`, efecto.fecha_fin && `hasta ${fechaCorta(efecto.fecha_fin)}`].filter(Boolean).join(' ')}
                </Dato>
              )}
            </Datos>
            {efecto.observaciones && <Parrafo>{efecto.observaciones}</Parrafo>}
          </>
        )}
      </Seccion>

      {efecto.soporte !== 'papel' && (
        <Seccion titulo="Gabinete de Informática Forense" naturaleza="dato">
          {editando ? (
            <div className={s.campos}>
              <div className={s.dosCampos}>
                <CampoEditable
                  campo="tiene_informe_gabinete"
                  etiqueta="¿Tiene informe del gabinete?"
                  tipo="opciones"
                  valor={siNo(efecto.tiene_informe_gabinete)}
                  opciones={opcionesSiNo}
                  onGuardar={guardarBooleano('tiene_informe_gabinete', efecto.tiene_informe_gabinete)}
                />
                <CampoEditable campo="informe_id" etiqueta="Nº de informe" valor={efecto.informe_numero} ayuda="Por ejemplo C6855." onGuardar={guardarInforme} />
              </div>
              <CampoEditable campo="observaciones_gabinete" etiqueta="Observaciones del gabinete" tipo="textoLargo" valor={efecto.observaciones_gabinete} onGuardar={guardar('observaciones_gabinete')} />
            </div>
          ) : (
            <Datos>
              <Dato etiqueta="Informe">
                {efecto.informe_numero ?? (efecto.tiene_informe_gabinete === true ? 'Sí (sin número cargado)' : efecto.tiene_informe_gabinete === false ? 'No' : <Nada />)}
              </Dato>
              <Dato etiqueta="Observaciones">{efecto.observaciones_gabinete ?? <Nada />}</Dato>
            </Datos>
          )}
        </Seccion>
      )}

      <Seccion titulo="Estado procesal">
        {incidencias.data?.length ? (
          <ul className={s.lista}>
            {incidencias.data.map((a) => (
              <li key={a.id}>
                {a.incidencia.situacion !== 'sin_efecto' ? (
                  <EstadoProcesal situacion={a.incidencia.situacion as keyof typeof SITUACIONES} />
                ) : (
                  <span className={s.tenue}>Resuelta a favor</span>
                )}
                <span>
                  {a.incidencia.titulo}
                  {a.entidad_id !== efecto.id && <span className={s.tenue}> · alcanza a todo el procedimiento</span>}
                </span>
                {a.entidad_id === efecto.id && (
                  <Boton tamano="chico" variante="fantasma" soloIcono aria-label="Quitar de este efecto" title="Quitar de este efecto" onClick={() => void quitarIncidencia(a.id)}>
                    <X aria-hidden />
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span className={s.limpio}>
            <Check aria-hidden /> Sin incidencias registradas
          </span>
        )}
        <div>
          <Boton tamano="chico" icono={<TriangleAlert aria-hidden />} onClick={() => setMarcando(true)}>
            Marcar situación procesal
          </Boton>
        </div>
      </Seccion>

      <Seccion titulo={`Piezas de este efecto${piezas.data?.length ? ` · ${piezas.data.length}` : ''}`}>
        {piezas.data?.length ? (
          <ul className={s.piezas}>
            {piezas.data.map((p) => (
              <li key={p.id}>
                <Link to={`../indice?pieza=${p.id}`} relative="path" className={s.pieza}>
                  <Sello numero={p.numero_orden} />
                  <span>{p.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <span className={s.tenue}>Todavía no se cargó ninguna pieza de este efecto.</span>
        )}
      </Seccion>

      <Seccion titulo="Historial">
        {efecto.origen?.archivo && (
          <p className={s.origen}>
            {efecto.soporte === 'papel' ? <FileText aria-hidden /> : <Smartphone aria-hidden />}
            Importado de «{efecto.origen.archivo}»{efecto.origen.fila ? `, fila ${efecto.origen.fila}` : ''}.
          </p>
        )}
        <ol className={s.historial}>
          {historial.slice(0, 15).map((e) => {
            const quien = e.usuario_email ? directorio.alias(e.usuario_email) : 'Sistema';
            return (
              <li key={e.id}>
                <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
                <div>
                  <b>{quien}</b>{' '}
                  {e.accion === 'alta' && 'cargó el efecto'}
                  {e.accion === 'archivo' && 'archivó el efecto'}
                  {e.accion === 'restauracion' && 'restauró el efecto'}
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
      </Seccion>

      <DialogoIncidencia
        abierto={marcando}
        causaId={efecto.causa_id}
        entidades={[efecto.id]}
        descripcionAlcance={`el efecto Nº ${efecto.numero}`}
        onCerrar={() => {
          setMarcando(false);
          void qc.invalidateQueries({ queryKey: ['incidencias-efecto', efecto.id] });
        }}
      />
      <NuevaPieza
        abierto={creandoPieza}
        causaId={efecto.causa_id}
        numeroSugerido=""
        efecto={{ id: efecto.id, numero: efecto.numero }}
        onCerrar={() => setCreandoPieza(false)}
        onCreada={() => {
          setCreandoPieza(false);
          void qc.invalidateQueries({ queryKey: ['piezas-efecto', efecto.id] });
        }}
      />
    </PanelLateral>
  );
}
