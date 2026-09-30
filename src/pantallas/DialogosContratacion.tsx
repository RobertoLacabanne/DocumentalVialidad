import { useQueryClient } from '@tanstack/react-query';
import { Archive } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Boton } from '../componentes/Boton';
import { AreaTexto, Entrada } from '../componentes/campos';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { CampoEditable, type ResultadoCampo } from '../componentes/Ficha';
import { useToast } from '../componentes/Toast';
import type { ContratacionVista } from '../datos/hechos';
import { traducirError, useGuardado } from '../datos/guardado';
import { fechaDelTramite, montoDeTexto, montoEditable } from '../lib/contrataciones';
import { PRECISIONES } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import type { Oferta, PasoTramite } from '../lib/tipos';

const refrescar = (qc: ReturnType<typeof useQueryClient>, causaId: string) => {
  for (const k of ['contrataciones', 'pasos', 'ofertas']) void qc.invalidateQueries({ queryKey: [k, causaId] });
};

/** Guarda un monto escrito como en el expediente. El valor anterior es el número guardado. */
export function guardarMonto(
  guardarCampo: ReturnType<typeof useGuardado>['guardarCampo'],
  tabla: string,
  id: string,
  campo: string,
  actual: number | null,
) {
  return async (nuevo: string | null, anterior: unknown): Promise<ResultadoCampo> => {
    const n = montoDeTexto(nuevo);
    if (n === undefined) return { tipo: 'error', mensaje: 'Escribilo como en el expediente: 18.415.263,50' };
    const previo = typeof anterior === 'number' ? anterior : typeof anterior === 'string' ? (montoDeTexto(anterior) ?? null) : actual;
    return guardarCampo(tabla, id, campo, previo, n);
  };
}

export function NuevaContratacion({
  abierto,
  causaId,
  existentes,
  onCerrar,
  onCreada,
}: {
  abierto: boolean;
  causaId: string;
  existentes: ContratacionVista[];
  onCerrar: () => void;
  onCreada: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const identificador = String(d.get('identificador')).replace(/\s+/g, ' ').trim();
    if (existentes.some((c) => c.identificador.trim().toUpperCase() === identificador.toUpperCase())) {
      setError(`«${identificador}» ya está cargada.`);
      return;
    }
    setEnviando(true);
    setError(null);
    const valor = (k: string) => String(d.get(k) ?? '').trim() || null;
    const { data, error: err } = await supabase
      .from('contratacion')
      .insert({
        causa_id: causaId,
        identificador,
        expediente: valor('expediente'),
        tipo_procedimiento: valor('tipo_procedimiento'),
        objeto: valor('objeto'),
      })
      .select('id')
      .single();
    setEnviando(false);
    if (err || !data) {
      setError(traducirError(err?.message ?? 'Error desconocido'));
      return;
    }
    avisar(`${identificador} quedó cargada. Sumale los pasos del trámite y las ofertas.`);
    refrescar(qc, causaId);
    onCreada((data as { id: string }).id);
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Nueva contratación" descripcion="Después le agregás los pasos del trámite, a fojas, y el cuadro de ofertas.">
      <form onSubmit={crear}>
        <div className={clasesDialogo.cuerpo}>
          <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
            <Entrada name="identificador" etiqueta="Identificador" placeholder="LP 05/2020" required autoFocus autoComplete="off" />
            <Entrada name="expediente" etiqueta="Expediente" placeholder="154782" autoComplete="off" />
          </div>
          <Entrada name="tipo_procedimiento" etiqueta="Tipo de procedimiento" placeholder="Licitación pública, concurso de precios…" autoComplete="off" />
          <AreaTexto name="objeto" etiqueta="Objeto" rows={3} placeholder="Qué se contrata, tal como lo dice el expediente" />
          {error && <AvisoError titulo={error} />}
        </div>
        <div className={clasesDialogo.pie}>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>
            Cargar contratación
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

/** Alta de un paso del trámite, o edición con guardado automático si ya existe. */
export function DialogoPaso({
  abierto,
  contratacion,
  paso,
  onCerrar,
}: {
  abierto: boolean;
  contratacion: ContratacionVista;
  paso: PasoTramite | null;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const valor = (k: string) => String(d.get(k) ?? '').trim() || null;
    const fechaTexto = valor('fecha_texto');
    const f = fechaDelTramite(fechaTexto);
    setEnviando(true);
    setError(null);
    const orden = Math.max(0, ...contratacion.pasos.map((p) => p.orden ?? 0)) + 1;
    const { error: err } = await supabase.from('paso_tramite').insert({
      causa_id: contratacion.causa_id,
      contratacion_id: contratacion.id,
      orden,
      descripcion: valor('descripcion'),
      fojas: valor('fojas'),
      fecha: f.fecha ?? null,
      fecha_precision: f.precision,
      fecha_texto: fechaTexto,
      firmante_texto: valor('firmante_texto'),
      cargo: valor('cargo'),
      link: valor('link'),
      observaciones: valor('observaciones'),
    });
    setEnviando(false);
    if (err) {
      setError(traducirError(err.message));
      return;
    }
    refrescar(qc, contratacion.causa_id);
    avisar('Paso agregado al trámite.');
    onCerrar();
  }

  async function archivar() {
    if (!paso) return;
    const { error: err } = await supabase.from('paso_tramite').update({ archivado_en: new Date().toISOString() }).eq('id', paso.id);
    if (err) avisar(traducirError(err.message), { tono: 'error' });
    else {
      refrescar(qc, contratacion.causa_id);
      avisar('Se quitó el paso. Queda en el historial por si hay que recuperarlo.');
      onCerrar();
    }
  }

  const guardar = (campo: string) => (nuevo: string | null, anterior: string | null) => guardarCampo('paso_tramite', paso!.id, campo, anterior, nuevo);

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={paso ? 'Paso del trámite' : 'Agregar un paso'}
      descripcion={paso ? 'Los cambios se guardan solos al salir de cada campo.' : `Se suma al final del trámite de ${contratacion.identificador}.`}
    >
      {paso ? (
        <>
          <div className={clasesDialogo.cuerpo}>
            <CampoEditable campo="descripcion" etiqueta="Procedimiento" valor={paso.descripcion} permitirVacio={false} onGuardar={guardar('descripcion')} />
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 0.6fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <CampoEditable campo="fojas" etiqueta="Fojas" valor={paso.fojas} onGuardar={guardar('fojas')} />
              <CampoEditable campo="fecha_texto" etiqueta="Fecha, tal cual figura" valor={paso.fecha_texto} onGuardar={guardar('fecha_texto')} />
            </div>
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <CampoEditable campo="fecha" etiqueta="Fecha para ordenar" tipo="fecha" valor={paso.fecha} onGuardar={guardar('fecha')} />
              <CampoEditable campo="fecha_precision" etiqueta="Precisión" tipo="opciones" permitirVacio={false} opciones={[...PRECISIONES]} valor={paso.fecha_precision} onGuardar={guardar('fecha_precision')} />
            </div>
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <CampoEditable campo="firmante_texto" etiqueta="Firmante" valor={paso.firmante_texto} onGuardar={guardar('firmante_texto')} />
              <CampoEditable campo="cargo" etiqueta="Cargo" valor={paso.cargo} onGuardar={guardar('cargo')} />
            </div>
            <CampoEditable campo="link" etiqueta="Link al documento" valor={paso.link} onGuardar={guardar('link')} />
            <CampoEditable campo="observaciones" etiqueta="Observaciones" tipo="textoLargo" valor={paso.observaciones} onGuardar={guardar('observaciones')} />
          </div>
          <div className={clasesDialogo.pie}>
            <Boton variante="fantasma" icono={<Archive aria-hidden />} onClick={() => void archivar()} style={{ marginRight: 'auto' }}>
              Quitar este paso
            </Boton>
            <Boton variante="primario" onClick={onCerrar}>
              Listo
            </Boton>
          </div>
        </>
      ) : (
        <form onSubmit={crear}>
          <div className={clasesDialogo.cuerpo}>
            <Entrada name="descripcion" etiqueta="Procedimiento" placeholder="Informe de viabilidad presupuestaria" required autoFocus autoComplete="off" />
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 0.6fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <Entrada name="fojas" etiqueta="Fojas" placeholder="34-37" autoComplete="off" />
              <Entrada name="fecha_texto" etiqueta="Fecha" placeholder="22/5/2020" autoComplete="off" ayuda="Tal cual figura. Si es aproximada, escribila así." />
            </div>
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <Entrada name="firmante_texto" etiqueta="Firmante" autoComplete="off" />
              <Entrada name="cargo" etiqueta="Cargo" autoComplete="off" />
            </div>
            <Entrada name="link" etiqueta="Link al documento" placeholder="https://drive.google.com/…" autoComplete="off" />
            <AreaTexto name="observaciones" etiqueta="Observaciones" rows={3} />
            {error && <AvisoError titulo={error} />}
          </div>
          <div className={clasesDialogo.pie}>
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={enviando}>
              Agregar paso
            </Boton>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

/** Alta de una oferta, o edición con guardado automático si ya existe. */
export function DialogoOferta({
  abierto,
  contratacion,
  oferta,
  onCerrar,
}: {
  abierto: boolean;
  contratacion: ContratacionVista;
  oferta: Oferta | null;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const valor = (k: string) => String(d.get(k) ?? '').trim() || null;
    const monto = montoDeTexto(valor('monto'));
    if (monto === undefined) {
      setError('El monto no se entiende. Escribilo como en el expediente: 18.415.263,50');
      return;
    }
    setEnviando(true);
    setError(null);
    const orden = Math.max(0, ...contratacion.ofertas.map((o) => o.orden ?? 0)) + 1;
    const { error: err } = await supabase.from('oferta').insert({
      causa_id: contratacion.causa_id,
      contratacion_id: contratacion.id,
      orden,
      oferente_texto: valor('oferente_texto'),
      monto,
      fojas: valor('fojas'),
      link: valor('link'),
      observaciones: valor('observaciones'),
    });
    setEnviando(false);
    if (err) {
      setError(traducirError(err.message));
      return;
    }
    refrescar(qc, contratacion.causa_id);
    avisar('Oferta agregada al cuadro.');
    onCerrar();
  }

  async function archivar() {
    if (!oferta) return;
    const { error: err } = await supabase.from('oferta').update({ archivado_en: new Date().toISOString() }).eq('id', oferta.id);
    if (err) avisar(traducirError(err.message), { tono: 'error' });
    else {
      refrescar(qc, contratacion.causa_id);
      avisar('Se quitó la oferta. Queda en el historial.');
      onCerrar();
    }
  }

  const guardar = (campo: string) => (nuevo: string | null, anterior: string | null) => guardarCampo('oferta', oferta!.id, campo, anterior, nuevo);

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={oferta ? 'Oferta' : 'Agregar una oferta'}
      descripcion={oferta ? 'Los cambios se guardan solos al salir de cada campo.' : `Se suma al cuadro de ofertas de ${contratacion.identificador}.`}
    >
      {oferta ? (
        <>
          <div className={clasesDialogo.cuerpo}>
            <CampoEditable campo="oferente_texto" etiqueta="Oferente" valor={oferta.oferente_texto} onGuardar={guardar('oferente_texto')} />
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.6fr)', alignItems: 'start' }}>
              <CampoEditable
                campo="monto"
                etiqueta="Monto ofertado ($)"
                valor={montoEditable(oferta.monto) || null}
                ayuda="Como en el expediente: 18.415.263,50"
                onGuardar={guardarMonto(guardarCampo, 'oferta', oferta.id, 'monto', oferta.monto)}
              />
              <CampoEditable campo="fojas" etiqueta="Fojas" valor={oferta.fojas} onGuardar={guardar('fojas')} />
            </div>
            <CampoEditable campo="link" etiqueta="Link a la oferta" valor={oferta.link} onGuardar={guardar('link')} />
            <CampoEditable campo="observaciones" etiqueta="Observaciones" tipo="textoLargo" valor={oferta.observaciones} onGuardar={guardar('observaciones')} />
          </div>
          <div className={clasesDialogo.pie}>
            <Boton variante="fantasma" icono={<Archive aria-hidden />} onClick={() => void archivar()} style={{ marginRight: 'auto' }}>
              Quitar esta oferta
            </Boton>
            <Boton variante="primario" onClick={onCerrar}>
              Listo
            </Boton>
          </div>
        </>
      ) : (
        <form onSubmit={crear}>
          <div className={clasesDialogo.cuerpo}>
            <Entrada name="oferente_texto" etiqueta="Oferente" placeholder="Razón social, y la persona si figura" required autoFocus autoComplete="off" />
            <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.6fr)', alignItems: 'start' }}>
              <Entrada name="monto" etiqueta="Monto ofertado ($)" placeholder="18.415.263,50" inputMode="decimal" autoComplete="off" />
              <Entrada name="fojas" etiqueta="Fojas" placeholder="94-134" autoComplete="off" />
            </div>
            <Entrada name="link" etiqueta="Link a la oferta" placeholder="https://drive.google.com/…" autoComplete="off" />
            <AreaTexto name="observaciones" etiqueta="Observaciones" rows={3} />
            {error && <AvisoError titulo={error} />}
          </div>
          <div className={clasesDialogo.pie}>
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" cargando={enviando}>
              Agregar oferta
            </Boton>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
