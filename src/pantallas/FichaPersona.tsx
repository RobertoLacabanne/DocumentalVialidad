import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Pencil, Plus, UserRound, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { claseControl } from '../componentes/campos';
import { CampoEditable, Dato, Datos, Nada, Parrafo, Seccion, type ResultadoCampo } from '../componentes/Ficha';
import { Avatar, Chip, EtiquetaEfecto, MarcaSugerencia } from '../componentes/marcas';
import { CerrarPanel, FilaPanel, PanelLateral } from '../componentes/PanelLateral';
import { useToast } from '../componentes/Toast';
import type { EfectoVista, PersonaVista } from '../datos/causa';
import { useDirectorio, useHistorial } from '../datos/consultas';
import { traducirError, useGuardado } from '../datos/guardado';
import { CAMPOS, ROLES, TIPOS_IDENTIFICADOR, valorLegible } from '../lib/etiquetas';
import { claveNombre, mencionaA } from '../lib/nombres';
import { supabase } from '../lib/supabase';
import { haceCuanto } from '../lib/tiempo';
import s from './FichaEfecto.module.css';
import sp from './Personas.module.css';

export const etiquetaRol = (rol: string) => ROLES.find((r) => r.valor === rol)?.etiqueta ?? rol;
export const etiquetaIdentificador = (tipo: string) => TIPOS_IDENTIFICADOR.find((t) => t.valor === tipo)?.etiqueta ?? tipo;

export function FichaPersona({ persona, efectos, onCerrar }: { persona: PersonaVista; efectos: EfectoVista[]; onCerrar: () => void }) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const directorio = useDirectorio();
  const { data: historial = [] } = useHistorial(persona.id);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState<'rol' | 'identificador' | null>(null);

  const clave = claveNombre(persona.nombre);
  const enEfectos = efectos.filter((e) => mencionaA(e.propietario, clave) || mencionaA(e.tenedor, clave));

  const enPiezas = useQuery({
    queryKey: ['apariciones-persona', persona.id, persona.nombre],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar', { p_causa: persona.causa_id, p_texto: persona.nombre, p_limite: 30 });
      if (error) throw new Error(error.message);
      return (data as { tipo: string; id: string; titulo: string }[]).filter((r) => r.tipo === 'pieza').slice(0, 12);
    },
    enabled: clave.length >= 4,
  });

  const guardar =
    (campo: string) =>
    (nuevo: string | null, anterior: string | null): Promise<ResultadoCampo> =>
      guardarCampo('persona', persona.id, campo, anterior, nuevo);

  const refrescar = () => {
    for (const k of ['roles', 'identificadores']) void qc.invalidateQueries({ queryKey: [k, persona.causa_id] });
  };

  async function archivar(tabla: 'rol_en_causa' | 'identificador', id: string, texto: string) {
    const { error } = await supabase.from(tabla).update({ archivado_en: new Date().toISOString() }).eq('id', id);
    if (error) avisar(traducirError(error.message), { tono: 'error' });
    else {
      refrescar();
      avisar(texto);
    }
  }

  async function agregarRol(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const rol = String(new FormData(form).get('rol'));
    if (persona.roles.some((r) => r.rol === rol)) {
      avisar(`Ya figura como ${etiquetaRol(rol).toLowerCase()}.`, { tono: 'aviso' });
      return;
    }
    setEnviando('rol');
    const { error } = await supabase.from('rol_en_causa').insert({ causa_id: persona.causa_id, persona_id: persona.id, rol });
    setEnviando(null);
    if (error) avisar(traducirError(error.message), { tono: 'error' });
    else refrescar();
  }

  async function agregarIdentificador(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const valor = String(d.get('valor')).trim();
    if (!valor) return;
    setEnviando('identificador');
    const { error } = await supabase.from('identificador').insert({ causa_id: persona.causa_id, persona_id: persona.id, tipo: String(d.get('tipo')), valor });
    setEnviando(null);
    if (error) avisar(traducirError(error.message), { tono: 'error' });
    else {
      form.reset();
      refrescar();
    }
  }

  const juridica = persona.tipo_persona === 'juridica';
  const sugeridoDesde = (persona.origen as { sugerido_desde?: string } | null)?.sugerido_desde ?? null;

  return (
    <PanelLateral
      etiqueta={`Ficha de ${persona.nombre}`}
      onCerrar={onCerrar}
      encabezado={
        <>
          <FilaPanel>
            <Chip familia="persona">{juridica ? 'Persona jurídica' : 'Persona humana'}</Chip>
            {persona.roles.map((r) => (
              <Chip key={r.id} familia={r.rol === 'imputado' ? 'contratacion' : 'otros'}>
                {etiquetaRol(r.rol)}
              </Chip>
            ))}
            <CerrarPanel onCerrar={onCerrar} />
          </FilaPanel>
          <h2 className={s.titulo} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`${sp.icono} ${juridica ? sp.iconoJuridica : ''}`} aria-hidden>
              {juridica ? <Building2 /> : <UserRound />}
            </span>
            {persona.nombre}
          </h2>
          {persona.cargo && <div className={s.meta}>{persona.cargo}</div>}
          <div className={s.acciones}>
            <Boton icono={editando ? <Check aria-hidden /> : <Pencil aria-hidden />} variante={editando ? 'primario' : 'secundario'} onClick={() => setEditando((v) => !v)}>
              {editando ? 'Listo' : 'Editar'}
            </Boton>
          </div>
        </>
      }
    >
      <Seccion titulo="Datos">
        {editando ? (
          <div className={s.campos}>
            <CampoEditable campo="nombre" etiqueta="Nombre o razón social" valor={persona.nombre} permitirVacio={false} onGuardar={guardar('nombre')} />
            <div className={s.dosCampos}>
              <CampoEditable
                campo="tipo_persona"
                etiqueta="Tipo"
                tipo="opciones"
                permitirVacio={false}
                valor={persona.tipo_persona}
                opciones={[
                  { valor: 'fisica', etiqueta: 'Persona humana' },
                  { valor: 'juridica', etiqueta: 'Persona jurídica' },
                ]}
                onGuardar={guardar('tipo_persona')}
              />
              <CampoEditable campo="cargo" etiqueta="Cargo o función" valor={persona.cargo} onGuardar={guardar('cargo')} />
            </div>
            <CampoEditable campo="observaciones" etiqueta="Observaciones" tipo="textoLargo" valor={persona.observaciones} onGuardar={guardar('observaciones')} />
          </div>
        ) : (
          <>
            <Datos>
              <Dato etiqueta="Tipo">{juridica ? 'Persona jurídica' : 'Persona humana'}</Dato>
              <Dato etiqueta="Cargo">{persona.cargo ?? <Nada />}</Dato>
            </Datos>
            {persona.observaciones && <Parrafo>{persona.observaciones}</Parrafo>}
          </>
        )}
      </Seccion>

      <Seccion titulo="Rol en la causa">
        {persona.roles.length ? (
          <ul className={s.lista}>
            {persona.roles.map((r) => (
              <li key={r.id}>
                <strong>{etiquetaRol(r.rol)}</strong>
                {r.observaciones && <span className={s.tenue}>{r.observaciones}</span>}
                <Boton
                  tamano="chico"
                  variante="fantasma"
                  soloIcono
                  aria-label={`Quitar el rol ${etiquetaRol(r.rol)}`}
                  title="Quitar este rol"
                  onClick={() => void archivar('rol_en_causa', r.id, `Se quitó el rol ${etiquetaRol(r.rol).toLowerCase()}.`)}
                >
                  <X aria-hidden />
                </Boton>
              </li>
            ))}
          </ul>
        ) : (
          <span className={s.tenue}>Todavía sin rol definido.</span>
        )}
        <form className={sp.agregar} onSubmit={agregarRol}>
          <select name="rol" className={claseControl} aria-label="Rol a agregar" defaultValue="testigo">
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
          <Boton type="submit" tamano="chico" icono={<Plus aria-hidden />} cargando={enviando === 'rol'}>
            Agregar rol
          </Boton>
        </form>
      </Seccion>

      <Seccion titulo="Teléfonos, CUIT y cómo está agendado" naturaleza="dato">
        {persona.identificadores.length ? (
          <ul className={s.lista}>
            {persona.identificadores.map((i) => (
              <li key={i.id}>
                <span className={s.tenue} style={{ minWidth: 96 }}>
                  {etiquetaIdentificador(i.tipo)}
                </span>
                <span className={sp.valor}>{i.valor}</span>
                <Boton
                  tamano="chico"
                  variante="fantasma"
                  soloIcono
                  aria-label={`Quitar ${i.valor}`}
                  title="Quitar"
                  onClick={() => void archivar('identificador', i.id, `Se quitó ${i.valor}.`)}
                >
                  <X aria-hidden />
                </Boton>
              </li>
            ))}
          </ul>
        ) : (
          <span className={s.tenue}>Sin teléfonos, CUIT ni alias cargados. Con ellos, la búsqueda la encuentra aunque figure agendada con otro nombre.</span>
        )}
        <form className={sp.agregar} onSubmit={agregarIdentificador}>
          <select name="tipo" className={claseControl} aria-label="Tipo de identificador" defaultValue="telefono">
            {TIPOS_IDENTIFICADOR.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
          <input name="valor" className={claseControl} aria-label="Valor" placeholder="343 154 000000" autoComplete="off" />
          <Boton type="submit" tamano="chico" icono={<Plus aria-hidden />} cargando={enviando === 'identificador'}>
            Agregar
          </Boton>
        </form>
      </Seccion>

      <Seccion titulo="Dónde aparece">
        <div>
          <MarcaSugerencia>coincidencia por nombre · a confirmar</MarcaSugerencia>
        </div>
        {enEfectos.length === 0 && !enPiezas.data?.length ? (
          <span className={s.tenue}>No encontramos su nombre en efectos ni en piezas.</span>
        ) : (
          <ul className={s.piezas}>
            {enEfectos.map((e) => (
              <li key={e.id}>
                <Link to={`../efectos?efecto=${e.id}`} relative="path" className={s.pieza}>
                  <EtiquetaEfecto numero={e.numero} />
                  <span>
                    {mencionaA(e.propietario, clave) ? 'Propietario' : 'Tenedor'} · {e.descripcion_acta ?? 'sin descripción'}
                  </span>
                </Link>
              </li>
            ))}
            {enPiezas.data?.map((p) => (
              <li key={p.id}>
                <Link to={`../indice?pieza=${p.id}`} relative="path" className={s.pieza}>
                  <Chip familia="documental">Pieza</Chip>
                  <span>{p.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Historial">
        {sugeridoDesde && <p className={s.origen}>Se agregó a partir de una sugerencia: aparecía en {sugeridoDesde}.</p>}
        <ol className={s.historial}>
          {historial.slice(0, 12).map((e) => {
            const quien = e.usuario_email ? directorio.alias(e.usuario_email) : 'Sistema';
            return (
              <li key={e.id}>
                <Avatar texto={quien} email={e.usuario_email} tamano="chico" />
                <div>
                  <b>{quien}</b> {e.accion === 'alta' && 'la agregó al directorio'}
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
      </Seccion>
    </PanelLateral>
  );
}
