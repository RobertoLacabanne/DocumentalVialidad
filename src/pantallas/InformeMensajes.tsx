import { useQuery } from '@tanstack/react-query';
import { FileDown, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Boton } from '../componentes/Boton';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { Falta } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { todas, type EfectoVista } from '../datos/causa';
import type { ContratacionVista, ConversacionVista, PiezaRef } from '../datos/hechos';
import { fechaCorta, informeEnDocx, nombreDelInforme, type DatosInforme } from '../lib/informe';
import { supabase } from '../lib/supabase';
import type { Causa, Mensaje, Vinculo } from '../lib/tipos';
import s from './Mensajes.module.css';

/** Arma el informe con los mensajes marcados como relevantes de una o más conversaciones del mismo teléfono. */
export function InformeMensajes({
  abierto,
  causa,
  conversacion,
  conversaciones,
  efectos,
  contrataciones,
  piezas,
  vinculos,
  onCerrar,
}: {
  abierto: boolean;
  causa: Causa;
  conversacion: ConversacionVista;
  conversaciones: ConversacionVista[];
  efectos: EfectoVista[];
  contrataciones: ContratacionVista[];
  piezas: PiezaRef[];
  vinculos: Vinculo[];
  onCerrar: () => void;
}) {
  const { avisar } = useToast();
  const hermanas = useMemo(
    () => (conversacion.efecto_id ? conversaciones.filter((c) => c.efecto_id === conversacion.efecto_id) : [conversacion]),
    [conversacion, conversaciones],
  );
  const [elegidas, setElegidas] = useState<string[]>([conversacion.id]);
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const informes = useQuery({
    queryKey: ['informes-ref', causa.id],
    queryFn: () => todas<{ id: string; numero: string }>('informe', causa.id, 'id,numero'),
    enabled: abierto,
  });
  const efecto = efectos.find((e) => e.id === conversacion.efecto_id) ?? null;
  const informe = (informes.data ?? []).find((i) => i.id === conversacion.informe_id)?.numero ?? null;
  const elegidasVista = hermanas.filter((c) => elegidas.includes(c.id));
  const relevantes = elegidasVista.reduce((n, c) => n + (c.resumen?.relevantes ?? 0), 0);
  const desde = conversacion.periodo_desde ?? conversacion.resumen?.primera_fecha ?? null;
  const hasta = conversacion.periodo_hasta ?? conversacion.resumen?.ultima_fecha ?? null;
  const periodoDeducido = !conversacion.periodo_desde && Boolean(conversacion.resumen?.primera_fecha);

  const datos: [string, string | null][] = [
    ['Dispositivo (según el acta)', efecto?.descripcion_acta ?? null],
    ['Nº de efecto', efecto?.numero ?? null],
    ['Informe de extracción', informe],
    ['Titular del teléfono', conversacion.titular_dispositivo],
    ['Número de la conversación', conversacion.contacto_relevante],
    ['Agendado como', conversacion.agendado_como],
    ['Período', desde || hasta ? `${fechaCorta(desde) ?? '[completar]'} a ${fechaCorta(hasta) ?? '[completar]'}` : null],
  ];

  async function descargar() {
    setArmando(true);
    setError(null);
    try {
      const mapaC = new Map(contrataciones.map((c) => [c.id, c]));
      const mapaP = new Map(piezas.map((p) => [p.id, p]));
      const textoVinculos = (id: string) =>
        vinculos
          .filter((v) => v.origen_id === id || v.destino_id === id)
          .map((v) => (v.origen_id === id ? v.destino_id : v.origen_id))
          .map((otro) => {
            const c = mapaC.get(otro);
            if (c) return `${c.identificador}${c.expediente ? ` (Expte. ${c.expediente})` : ''}`;
            const p = mapaP.get(otro);
            return p ? `pieza${p.numero_orden ? ` Nº ${p.numero_orden}` : ''}, ${p.titulo}` : null;
          })
          .filter((t): t is string => Boolean(t));

      const bloques = [];
      for (const c of elegidasVista) {
        const { data, error: err } = await supabase
          .from('mensaje')
          .select('id,orden,fecha,fecha_hora_texto,emisor,receptor,contenido,observacion')
          .eq('conversacion_id', c.id)
          .eq('relevante', true)
          .is('archivado_en', null)
          .order('orden', { ascending: true });
        if (err) throw new Error(err.message);
        const mensajes = (data ?? []) as Pick<Mensaje, 'id' | 'orden' | 'fecha' | 'fecha_hora_texto' | 'emisor' | 'receptor' | 'contenido' | 'observacion'>[];
        if (mensajes.length)
          bloques.push({
            titulo: c.titulo,
            mensajes: mensajes.map((m) => ({
              fecha: m.fecha,
              fecha_texto: m.fecha_hora_texto,
              emisor: m.emisor,
              receptor: m.receptor,
              contenido: m.contenido,
              observacion: m.observacion,
              vinculos: textoVinculos(m.id),
            })),
          });
      }
      const d: DatosInforme = {
        legajo: causa.legajo_fiscalia,
        caratula: causa.caratula,
        dispositivo: efecto?.descripcion_acta,
        efecto: efecto?.numero,
        informe,
        titular: conversacion.titular_dispositivo,
        contacto: conversacion.contacto_relevante,
        agendado: conversacion.agendado_como,
        desde,
        hasta,
        conversaciones: bloques,
      };
      const blob = await informeEnDocx(d);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreDelInforme(d);
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      avisar('Informe descargado. Revisalo en Word antes de firmarlo.');
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setArmando(false);
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Informe de relevamiento de mensajes"
      descripcion="Sigue la plantilla del equipo: Palatino 11, justificado, interlineado 1,5. Van los mensajes marcados como relevantes, en orden, con su observación."
    >
      <div className={clasesDialogo.cuerpo}>
        {hermanas.length > 1 && (
          <fieldset className={s.informeGrupo}>
            <legend>Conversaciones del mismo teléfono</legend>
            {hermanas.map((c) => (
              <label key={c.id} className={s.informeOpcion}>
                <input
                  type="checkbox"
                  checked={elegidas.includes(c.id)}
                  onChange={(e) => setElegidas((l) => (e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id)))}
                />
                <span>
                  {c.titulo} <span className={s.tenue}>· {c.resumen?.relevantes ?? 0} relevantes</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <dl className={s.informeDatos}>
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta}>
              <dt>{etiqueta}</dt>
              <dd>{valor ?? <Falta />}</dd>
            </div>
          ))}
        </dl>
        {periodoDeducido && <p className={s.tenue}>El período sale de las fechas del primer y del último mensaje. Si el informe abarca otro, cargalo en «Datos de la conversación».</p>}
        {datos.some(([, v]) => !v) && <p className={s.tenue}>Lo que falta sale como [completar] en el documento. Se carga desde «Datos de la conversación».</p>}

        <p className={s.tenue}>En cada mensaje, «Emisor» es el titular del teléfono y «Remitente», quien lo envía.</p>

        {relevantes === 0 && (
          <p className={s.informeAviso}>
            <TriangleAlert aria-hidden /> Todavía no hay mensajes marcados como relevantes en {elegidasVista.length === 1 ? 'esta conversación' : 'las conversaciones elegidas'}.
          </p>
        )}
        {error && <AvisoError titulo="No se pudo armar el informe">{error}</AvisoError>}
      </div>
      <div className={clasesDialogo.pie}>
        <Boton variante="fantasma" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton variante="primario" icono={<FileDown aria-hidden />} cargando={armando} disabled={relevantes === 0 || elegidas.length === 0} onClick={() => void descargar()}>
          Descargar .docx ({relevantes} {relevantes === 1 ? 'mensaje' : 'mensajes'})
        </Boton>
      </div>
    </Dialogo>
  );
}
