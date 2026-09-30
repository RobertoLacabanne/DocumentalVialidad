import { useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, ExternalLink, TriangleAlert, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { CampoEditable, Seccion, type ResultadoCampo } from '../componentes/Ficha';
import { Avatar, Chip, Sello } from '../componentes/marcas';
import { CerrarPanel, FilaPanel, PanelLateral } from '../componentes/PanelLateral';
import { useToast } from '../componentes/Toast';
import type { PersonaVista } from '../datos/causa';
import { useDirectorio, useHistorial } from '../datos/consultas';
import { traducirError, useGuardado } from '../datos/guardado';
import type { ItemVista } from '../datos/juicio';
import { CAMPOS, valorLegible } from '../lib/etiquetas';
import { ACUERDOS, ADMISIONES, INCORPORACIONES, alertasDe, citaDe, descripcionDe, esDePersona, etiquetaClase, referenciaDe } from '../lib/ofrecimiento';
import { supabase } from '../lib/supabase';
import { haceCuanto } from '../lib/tiempo';
import s from './FichaEfecto.module.css';
import sj from './Juicio.module.css';

const SI_NO = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'no', etiqueta: 'No' },
];
const aBool = (v: unknown) => (v === true || v === 'si' ? true : v === false || v === 'no' ? false : null);
const aLista = (t: string | null) =>
  (t ?? '')
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function FichaOfrecimiento({
  item,
  personas,
  formatoCita,
  onCerrar,
}: {
  item: ItemVista;
  personas: PersonaVista[];
  formatoCita: string | null;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const directorio = useDirectorio();
  const { data: historial = [] } = useHistorial(item.id);
  const guardar = (campo: string) => (nuevo: string | null, anterior: string | null) => guardarCampo('ofrecimiento_item', item.id, campo, anterior, nuevo);
  const guardarBool =
    (campo: 'entregada_defensa' | 'requiere_escaneo' | 'impugnada' | 'todos_los_imputados') =>
    (nuevo: string | null, anterior: unknown): Promise<ResultadoCampo> =>
      guardarCampo('ofrecimiento_item', item.id, campo, aBool(anterior) ?? item[campo], nuevo === 'si');

  const alertas = alertasDe(item);
  const cita = citaDe(item, formatoCita);
  const referencia = referenciaDe(item);
  const deTestigo = esDePersona(item.clase);
  const imputados = personas.filter((p) => p.roles.some((r) => r.rol === 'imputado'));
  const quienes = [...personas].sort(
    (a, b) =>
      Number(b.roles.some((r) => r.rol === 'testigo' || r.rol === 'perito')) - Number(a.roles.some((r) => r.rol === 'testigo' || r.rol === 'perito')) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );

  async function alternarImputado(id: string) {
    const nuevos = item.imputados.includes(id) ? item.imputados.filter((x) => x !== id) : [...item.imputados, id];
    const r = await guardarCampo('ofrecimiento_item', item.id, 'imputados', item.imputados, nuevos);
    if (r.tipo === 'conflicto') avisar(`${r.quien} cambió los imputados mientras tanto. Volvé a marcar.`, { tono: 'aviso' });
    else if (r.tipo === 'error') avisar(r.mensaje, { tono: 'error' });
  }

  async function quitar() {
    const { error } = await supabase.from('ofrecimiento_item').update({ archivado_en: new Date().toISOString() }).eq('id', item.id);
    if (error) avisar(traducirError(error.message), { tono: 'error' });
    else {
      void qc.invalidateQueries({ queryKey: ['ofrecimiento', item.causa_id] });
      avisar('Se quitó del ofrecimiento. Queda en el historial. Si querés correr los números, usá «Renumerar».');
      onCerrar();
    }
  }

  return (
    <PanelLateral
      etiqueta="Ficha del ofrecimiento"
      onCerrar={onCerrar}
      encabezado={
        <>
          <FilaPanel>
            <Sello numero={item.numero} />
            <Chip familia={deTestigo ? 'persona' : 'documental'}>{etiquetaClase(item.clase)}</Chip>
            {item.admision !== 'pendiente' && <Chip familia="otros">{item.admision === 'admitida' ? `Admitida${item.numero_auto ? ` · Nº ${item.numero_auto}` : ''}` : 'Rechazada'}</Chip>}
            <CerrarPanel onCerrar={onCerrar} />
          </FilaPanel>
          <h2 className={s.titulo}>{descripcionDe(item) ?? 'Prueba sin descripción'}</h2>
          {referencia && <div className={s.meta}>{referencia}</div>}
          {alertas.length > 0 && (
            <ul className={sj.alertasFicha} aria-label="Avisos para el juicio">
              {alertas.map((a) => (
                <li key={a.tipo} className={a.grave ? sj.alertaGrave : sj.alertaLeve}>
                  <TriangleAlert aria-hidden /> {a.texto}
                </li>
              ))}
            </ul>
          )}
        </>
      }
    >
      <Seccion titulo="La prueba" naturaleza="dato">
        {item.piezaFila && (
          <div className={sj.origen}>
            <Link to={`../indice?pieza=${item.piezaFila.id}`} relative="path" className={sj.origenLink}>
              <Sello numero={item.piezaFila.numero_orden} /> {item.piezaFila.titulo} <ExternalLink aria-hidden />
            </Link>
            {cita && (
              <Boton
                tamano="chico"
                variante="fantasma"
                icono={<Copy aria-hidden />}
                onClick={() => {
                  void navigator.clipboard?.writeText(cita);
                  avisar('Cita copiada.');
                }}
              >
                Copiar cita
              </Boton>
            )}
          </div>
        )}
        {item.personaFila && (
          <div className={sj.origen}>
            <Link to={`../personas?persona=${item.personaFila.id}`} relative="path" className={sj.origenLink}>
              <UserRound aria-hidden /> {item.personaFila.nombre}
              {item.personaFila.cargo && <span className={s.tenue}> · {item.personaFila.cargo}</span>} <ExternalLink aria-hidden />
            </Link>
          </div>
        )}
        <div className={s.campos}>
          <CampoEditable
            campo="descripcion"
            etiqueta="Cómo se nombra en el escrito"
            tipo="textoLargo"
            valor={item.descripcion}
            ayuda={item.pieza || item.persona ? 'Si queda vacío, se usa el título de la pieza o el nombre de la persona.' : undefined}
            onGuardar={guardar('descripcion')}
          />
          <CampoEditable
            campo="objeto"
            etiqueta={deTestigo ? 'Sobre qué va a declarar' : 'Qué se prueba (objeto)'}
            tipo="textoLargo"
            valor={item.objeto}
            onGuardar={guardar('objeto')}
          />
          <div className={s.dosCampos}>
            <CampoEditable campo="numero" etiqueta="Nº en el ofrecimiento" valor={item.numero} onGuardar={guardar('numero')} />
            <CampoEditable campo="ubicacion_fisica" etiqueta="Ubicación física" valor={item.ubicacion_fisica} onGuardar={guardar('ubicacion_fisica')} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="En el debate">
        <div className={s.campos}>
          <div className={s.dosCampos}>
            <CampoEditable campo="incorporacion" etiqueta="Cómo se incorpora" tipo="opciones" opciones={INCORPORACIONES} valor={item.incorporacion} onGuardar={guardar('incorporacion')} />
            <CampoEditable
              campo="introduce_id"
              etiqueta="Con quién se introduce"
              tipo="opciones"
              opciones={quienes.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
              valor={item.introduce_id}
              onGuardar={guardar('introduce_id')}
            />
          </div>
          <CampoEditable campo="partes_a_exhibir" etiqueta="Qué partes se exhiben" valor={item.partes_a_exhibir} onGuardar={guardar('partes_a_exhibir')} />
          <CampoEditable campo="requiere_escaneo" etiqueta="¿Hay que escanearla?" tipo="opciones" permitirVacio={false} opciones={SI_NO} valor={item.requiere_escaneo ? 'si' : 'no'} onGuardar={guardarBool('requiere_escaneo')} />
        </div>
      </Seccion>

      <Seccion titulo="Con la defensa">
        <div className={s.campos}>
          {!deTestigo && (
            <div className={s.dosCampos}>
              <CampoEditable campo="entregada_defensa" etiqueta="¿Se entregó?" tipo="opciones" permitirVacio={false} opciones={SI_NO} valor={item.entregada_defensa ? 'si' : 'no'} onGuardar={guardarBool('entregada_defensa')} />
              <CampoEditable campo="fecha_entrega" etiqueta="Fecha de entrega" tipo="fecha" valor={item.fecha_entrega} onGuardar={guardar('fecha_entrega')} />
            </div>
          )}
          {!deTestigo && <CampoEditable campo="constancia_entrega" etiqueta="Constancia" valor={item.constancia_entrega} onGuardar={guardar('constancia_entrega')} />}
          <div className={s.dosCampos}>
            <CampoEditable campo="acuerdo_probatorio" etiqueta="Acuerdo probatorio" tipo="opciones" opciones={ACUERDOS} valor={item.acuerdo_probatorio} onGuardar={guardar('acuerdo_probatorio')} />
            <CampoEditable campo="impugnada" etiqueta="¿La impugnó la defensa?" tipo="opciones" permitirVacio={false} opciones={SI_NO} valor={item.impugnada ? 'si' : 'no'} onGuardar={guardarBool('impugnada')} />
          </div>
          {item.impugnada && <CampoEditable campo="motivo_impugnacion" etiqueta="Motivo (pertinencia)" tipo="textoLargo" valor={item.motivo_impugnacion} onGuardar={guardar('motivo_impugnacion')} />}
          <CampoEditable
            campo="tambien_ofrecida_por"
            etiqueta="También la ofrece"
            valor={item.tambien_ofrecida_por.join('; ') || null}
            ayuda="Las defensas separadas por punto y coma: «Barrandeguy - Díaz; Velázquez»"
            onGuardar={(nuevo, anterior) =>
              guardarCampo('ofrecimiento_item', item.id, 'tambien_ofrecida_por', Array.isArray(anterior) ? anterior : item.tambien_ofrecida_por, aLista(nuevo))
            }
          />
        </div>
      </Seccion>

      <Seccion titulo="Auto de apertura">
        <div className={s.dosCampos}>
          <CampoEditable campo="admision" etiqueta="Admisión" tipo="opciones" permitirVacio={false} opciones={ADMISIONES} valor={item.admision} onGuardar={guardar('admision')} />
          <CampoEditable campo="numero_auto" etiqueta="Nº según el auto" valor={item.numero_auto} onGuardar={guardar('numero_auto')} />
        </div>
      </Seccion>

      <Seccion titulo="Imputados vinculados">
        <label className={sj.casilla}>
          <input
            type="checkbox"
            checked={item.todos_los_imputados}
            onChange={(e) => void guardarBool('todos_los_imputados')(e.target.checked ? 'si' : 'no', item.todos_los_imputados)}
          />
          Todos
        </label>
        {!item.todos_los_imputados &&
          (imputados.length ? (
            <div className={sj.imputados}>
              {imputados.map((p) => (
                <label key={p.id} className={sj.casilla}>
                  <input type="checkbox" checked={item.imputados.includes(p.id)} onChange={() => void alternarImputado(p.id)} />
                  {p.nombre}
                </label>
              ))}
            </div>
          ) : (
            <span className={s.tenue}>No hay personas con el rol de imputado en el directorio. Se cargan desde Personas y empresas.</span>
          ))}
      </Seccion>

      <Seccion titulo="Notas del equipo" naturaleza="interpretacion">
        <CampoEditable campo="observaciones" etiqueta="Observaciones" tipo="textoLargo" interpretacion valor={item.observaciones} onGuardar={guardar('observaciones')} />
      </Seccion>

      <Seccion titulo="Historial">
        <ol className={s.historial}>
          {historial.slice(0, 10).map((e) => {
            const quien = e.usuario_email ? directorio.alias(e.usuario_email) : 'Sistema';
            return (
              <li key={e.id}>
                <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
                <div>
                  <b>{quien}</b> {e.accion === 'alta' && 'la sumó al ofrecimiento'}
                  {e.accion === 'archivo' && 'la quitó'}
                  {e.accion === 'edicion' &&
                    Object.entries(e.cambios).map(([campo, v], i) => (
                      <span key={campo}>
                        {i > 0 && ' · '}cambió <em>{CAMPOS[campo] ?? campo}</em>
                        {!campo.endsWith('_id') && campo !== 'imputados' && (
                          <>
                            : <s>{valorLegible(campo, v.antes)}</s> → {valorLegible(campo, v.despues)}
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
          <Boton variante="fantasma" icono={<Archive aria-hidden />} onClick={() => void quitar()}>
            Quitar del ofrecimiento
          </Boton>
        </div>
      </Seccion>
    </PanelLateral>
  );
}
