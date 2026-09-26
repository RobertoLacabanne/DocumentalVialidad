import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Boton } from '../componentes/Boton';
import { AreaTexto, Entrada, Selector } from '../componentes/campos';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { EstadoProcesal } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useIncidencias } from '../datos/causa';
import { useDirectorio } from '../datos/consultas';
import { traducirError } from '../datos/guardado';
import { TIPOS_INCIDENCIA, aliasDe } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import s from './Dialogos.module.css';

export function NuevoEfecto({ abierto, causaId, onCerrar, onCreado }: { abierto: boolean; causaId: string; onCerrar: () => void; onCreado: (id: string) => void }) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { miembros } = useDirectorio();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const numero = String(d.get('numero')).trim();
    const { data: existe } = await supabase.from('efecto').select('id').eq('causa_id', causaId).eq('numero', numero).is('archivado_en', null).limit(1);
    if (existe?.length) {
      setError(`El efecto Nº ${numero} ya está cargado.`);
      return;
    }
    setEnviando(true);
    const soporte = String(d.get('soporte'));
    const { data, error: err } = await supabase
      .from('efecto')
      .insert({
        causa_id: causaId,
        numero,
        soporte,
        tipo_material: soporte === 'digital' ? 'dispositivo' : null,
        descripcion_acta: String(d.get('descripcion')).trim() || null,
        responsable: String(d.get('responsable')) || null,
      })
      .select('id')
      .single();
    setEnviando(false);
    if (err || !data) {
      setError(traducirError(err?.message ?? 'Error desconocido'));
      return;
    }
    void qc.invalidateQueries({ queryKey: ['efectos', causaId] });
    avisar(`Efecto Nº ${numero} cargado.`);
    onCreado((data as { id: string }).id);
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Nuevo efecto" descripcion="Para muchos efectos a la vez, conviene importar la planilla.">
      <form onSubmit={crear}>
        <div className={clasesDialogo.cuerpo}>
          <div className={clasesDialogo.dosColumnas}>
            <Entrada name="numero" etiqueta="Nº de efecto" required inputMode="numeric" autoFocus autoComplete="off" />
            <Selector name="soporte" etiqueta="Qué es" defaultValue="papel">
              <option value="papel">Documentación en papel</option>
              <option value="digital">Dispositivo</option>
            </Selector>
          </div>
          <AreaTexto
            name="descripcion"
            etiqueta="Descripción según el acta"
            ayuda="Copiala tal cual figura en el acta: una vez guardada no se modifica."
          />
          <Selector name="responsable" etiqueta="Responsable" defaultValue="">
            <option value="">Sin asignar</option>
            {miembros.filter((m) => m.activo).map((m) => (
              <option key={m.email} value={m.email}>
                {aliasDe(m)}
              </option>
            ))}
          </Selector>
          {error && <AvisoError titulo={error} />}
        </div>
        <div className={clasesDialogo.pie}>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>
            Cargar efecto
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * Marca una situación procesal (casación, apelación, exclusión…) sobre varias fichas a la vez.
 * Se elige una existente o se crea una nueva.
 */
export function DialogoIncidencia({
  abierto,
  causaId,
  entidades,
  descripcionAlcance,
  onCerrar,
}: {
  abierto: boolean;
  causaId: string;
  entidades: string[];
  descripcionAlcance: string;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { data: incidencias = [] } = useIncidencias(causaId);
  const vigentes = incidencias.filter((i) => i.situacion !== 'sin_efecto');
  const [eleccion, setEleccion] = useState<string>('nueva');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setEnviando(true);
    setError(null);
    let incidencia = eleccion;
    if (eleccion === 'nueva') {
      const { data, error: err } = await supabase
        .from('incidencia_procesal')
        .insert({
          causa_id: causaId,
          titulo: String(d.get('titulo')).trim(),
          tipo: String(d.get('tipo')),
          situacion: String(d.get('situacion')),
          tribunal: String(d.get('tribunal')).trim() || null,
          fecha_planteo: String(d.get('fecha')) || null,
        })
        .select('id')
        .single();
      if (err || !data) {
        setEnviando(false);
        setError(traducirError(err?.message ?? 'Error desconocido'));
        return;
      }
      incidencia = (data as { id: string }).id;
    }
    const { data: agregadas, error: err2 } = await supabase.rpc('aplicar_incidencia', { p_incidencia: incidencia, p_entidades: entidades });
    setEnviando(false);
    if (err2) {
      setError(traducirError(err2.message));
      return;
    }
    for (const k of ['estado-procesal-efectos', 'estado-procesal', 'incidencias']) void qc.invalidateQueries({ queryKey: [k, causaId] });
    avisar(agregadas ? `Situación procesal marcada en ${descripcionAlcance}.` : 'Esas fichas ya tenían esa situación procesal.');
    onCerrar();
  }

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Marcar situación procesal"
      descripcion={`Se aplica a ${descripcionAlcance}. Sus piezas la heredan y el armado del juicio va a avisar.`}
    >
      <form onSubmit={aplicar}>
        <div className={clasesDialogo.cuerpo}>
          {vigentes.length > 0 && (
            <fieldset className={s.opciones}>
              <legend className={s.leyenda}>Usar una que ya está cargada</legend>
              {vigentes.map((i) => (
                <label key={i.id} className={s.opcion}>
                  <input type="radio" name="eleccion" value={i.id} checked={eleccion === i.id} onChange={() => setEleccion(i.id)} />
                  <span className={s.opcionTexto}>
                    <strong>{i.titulo}</strong>
                    {i.situacion !== 'sin_efecto' && <EstadoProcesal situacion={i.situacion} />}
                  </span>
                </label>
              ))}
              <label className={s.opcion}>
                <input type="radio" name="eleccion" value="nueva" checked={eleccion === 'nueva'} onChange={() => setEleccion('nueva')} />
                <span className={s.opcionTexto}>
                  <strong>Cargar una nueva</strong>
                </span>
              </label>
            </fieldset>
          )}
          {eleccion === 'nueva' && (
            <>
              <Entrada name="titulo" etiqueta="Qué es" required autoFocus placeholder="p. ej. Casación contra la extracción de dispositivos" />
              <div className={clasesDialogo.dosColumnas}>
                <Selector name="tipo" etiqueta="Tipo" defaultValue="casacion">
                  {TIPOS_INCIDENCIA.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </Selector>
                <Selector name="situacion" etiqueta="Situación" defaultValue="pendiente_resolucion">
                  <option value="admisibilidad_cuestionada">Admisibilidad cuestionada</option>
                  <option value="pendiente_resolucion">Pendiente de resolución</option>
                  <option value="excluida">Excluida</option>
                </Selector>
              </div>
              <div className={clasesDialogo.dosColumnas}>
                <Entrada name="fecha" type="date" etiqueta="Fecha del planteo" />
                <Entrada name="tribunal" etiqueta="Tribunal" placeholder="Opcional" />
              </div>
            </>
          )}
          {error && <AvisoError titulo={error} />}
        </div>
        <div className={clasesDialogo.pie}>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={enviando} disabled={!entidades.length}>
            Marcar
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
