import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, FileUp, Info, RotateCcw, TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Boton, clasesBoton } from '../componentes/Boton';
import { AvisoError } from '../componentes/estados';
import { Fojas, MarcaSugerencia } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useContrataciones } from '../datos/hechos';
import { traducirError } from '../datos/guardado';
import { formatoPesos, leerHojaContratacion, type ContratacionImportada, type Sugerencia } from '../lib/contrataciones';
import type { Celda } from '../lib/importacion';
import { supabase } from '../lib/supabase';
import { CabeceraCausa } from './CabeceraCausa';
import { Bloque, Cifra } from './Importar';
import { useCausaActual } from './Marco';
import s from './Importar.module.css';
import h from './ImportarHechos.module.css';
import si from './Indice.module.css';

type Paso = 'archivo' | 'revision' | 'hecho';
type Leida = Omit<ContratacionImportada, 'sugerencias'> & { elegida: boolean; montos: Record<number, boolean>; sugerencias: (Sugerencia & { usar: boolean })[] };
type Resultado = {
  identificador: string;
  ok: boolean;
  duplicada?: boolean;
  completada?: boolean;
  expedienteDistinto?: boolean;
  pasos?: number;
  ofertas?: number;
  error?: string;
};

const PASOS: { valor: Paso; etiqueta: string }[] = [
  { valor: 'archivo', etiqueta: 'Planilla' },
  { valor: 'revision', etiqueta: 'Revisión' },
  { valor: 'hecho', etiqueta: 'Listo' },
];

export function ImportarContrataciones() {
  const { causa } = useCausaActual();
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { filas: existentes } = useContrataciones(causa.id);
  const [paso, setPaso] = useState<Paso>('archivo');
  const [archivo, setArchivo] = useState<string | null>(null);
  const [leidas, setLeidas] = useState<Leida[]>([]);
  const [otras, setOtras] = useState<string[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const selector = useRef<HTMLInputElement>(null);

  // Una contratación cargada sin trámite (como la de la semilla) no es repetida: se completa.
  const cargadas = useMemo(() => new Map(existentes.map((c) => [c.identificador.trim().toUpperCase(), c])), [existentes]);
  const existente = (c: Pick<ContratacionImportada, 'identificador'>) => cargadas.get(c.identificador.trim().toUpperCase());
  const esDuplicada = (c: Pick<ContratacionImportada, 'identificador'>) => {
    const e = existente(c);
    return Boolean(e && (e.pasos.length || e.ofertas.length));
  };
  const seCompleta = (c: Pick<ContratacionImportada, 'identificador'>) => Boolean(existente(c)) && !esDuplicada(c);

  async function elegir(file: File | undefined) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setError('Tiene que ser una planilla .xlsx. Si está en Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx).');
      return;
    }
    setLeyendo(true);
    setError(null);
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const hojas = await readXlsxFile(file);
      const encontradas: Leida[] = [];
      const sinTramite: string[] = [];
      for (const hoja of hojas) {
        const c = leerHojaContratacion(hoja.sheet, hoja.data as unknown as Celda[][]);
        if (!c) sinTramite.push(hoja.sheet);
        else encontradas.push({ ...c, elegida: true, montos: {}, sugerencias: c.sugerencias.map((x) => ({ ...x, usar: false })) });
      }
      if (!encontradas.length) throw new Error('Ninguna hoja tiene la tabla del trámite (columnas PROCEDIMIENTO, Fs. y FECHA).');
      setArchivo(file.name);
      setLeidas(encontradas);
      setOtras(sinTramite);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setEncima(false);
    void elegir(e.dataTransfer.files[0]);
  }

  const cambiar = (i: number, f: (c: Leida) => Leida) => setLeidas((l) => l.map((c, j) => (j === i ? f(c) : c)));
  const aImportar = leidas.filter((c) => c.elegida && c.identificador.trim() && !esDuplicada(c));

  async function importar() {
    if (!archivo) return;
    setImportando(true);
    const salida: Resultado[] = [];
    for (const c of aImportar) {
      const presupuesto = c.sugerencias.find((x) => x.campo === 'presupuesto_oficial' && x.usar);
      const reserva = c.sugerencias.find((x) => x.campo === 'reserva_presupuestaria' && x.usar);
      const { data, error: err } = await supabase.rpc('importar_contratacion', {
        p_causa: causa.id,
        p_archivo: archivo,
        p_hoja: c.hoja,
        p_datos: {
          identificador: c.identificador.trim(),
          expediente: c.expediente ?? null,
          tipo_procedimiento: c.tipo_procedimiento ?? null,
          fecha_inicio: c.fecha_inicio ?? null,
          fecha_inicio_texto: c.fecha_inicio_texto ?? null,
          presupuesto_oficial: presupuesto?.monto ?? null,
          reserva_presupuestaria: reserva?.monto ?? null,
          filas_origen: c.filasOrigen,
          pasos: c.pasos,
          ofertas: c.ofertas.map((o) => ({ ...o, monto: c.montos[o.orden] ? o.monto_sugerido : null })),
        },
      });
      if (err) salida.push({ identificador: c.identificador, ok: false, error: traducirError(err.message) });
      else {
        const r = data as { duplicada: boolean; completada?: boolean; expediente_distinto?: boolean; pasos?: number; ofertas?: number };
        salida.push({
          identificador: c.identificador,
          ok: !r.duplicada,
          duplicada: r.duplicada,
          completada: r.completada,
          expedienteDistinto: r.expediente_distinto,
          pasos: r.pasos,
          ofertas: r.ofertas,
        });
      }
    }
    setImportando(false);
    setResultados(salida);
    setPaso('hecho');
    for (const k of ['contrataciones', 'pasos', 'ofertas']) void qc.invalidateQueries({ queryKey: [k, causa.id] });
    if (salida.some((r) => r.error)) avisar('Alguna contratación no se pudo importar. Mirá el detalle.', { tono: 'aviso', duracion: 9000 });
  }

  function reiniciar() {
    setPaso('archivo');
    setArchivo(null);
    setLeidas([]);
    setOtras([]);
    setResultados([]);
    setError(null);
    if (selector.current) selector.current.value = '';
  }

  const indicePaso = PASOS.findIndex((p) => p.valor === paso);
  const importadas = resultados.filter((r) => r.ok);

  return (
    <div className={s.pantalla}>
      <CabeceraCausa causa={causa} />
      <div className={s.cuerpo}>
        <div className={s.encabezado}>
          <Link to="../contrataciones" relative="path" className={s.volver}>
            <ArrowLeft aria-hidden /> Contrataciones
          </Link>
          <h2 className={si.titulo}>Importar expedientes de contratación</h2>
          <p className={si.bajada}>Una hoja por licitación, con el trámite paso a paso, como EXPEDIENTES DE CONTRATACIÓN. Se transcribe tal cual; los montos que aparecen escritos se proponen y los confirmás vos.</p>
        </div>

        <ol className={s.pasos} aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p.valor} className={`${s.paso} ${i < indicePaso ? s.pasoHecho : ''} ${i === indicePaso ? s.pasoActual : ''}`} aria-current={i === indicePaso ? 'step' : undefined}>
              <span className={s.pasoNumero}>{i < indicePaso ? <Check aria-hidden /> : i + 1}</span>
              {p.etiqueta}
            </li>
          ))}
        </ol>

        {paso === 'archivo' && (
          <section className={s.tarjeta}>
            {!archivo ? (
              <label
                className={`${s.zona} ${encima ? s.zonaEncima : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setEncima(true);
                }}
                onDragLeave={() => setEncima(false)}
                onDrop={soltar}
              >
                <input ref={selector} type="file" accept=".xlsx" className="visualmente-oculto" onChange={(e) => void elegir(e.target.files?.[0])} />
                <span className={s.zonaIcono}>
                  <FileUp aria-hidden />
                </span>
                <strong>{leyendo ? 'Leyendo la planilla…' : 'Arrastrá la planilla acá o hacé clic para elegirla'}</strong>
                <span className={s.tenue}>Excel (.xlsx). Si está en Google Sheets: Archivo → Descargar → Microsoft Excel.</span>
              </label>
            ) : (
              <>
                <div className={s.archivo}>
                  <FileSpreadsheet aria-hidden />
                  <div>
                    <strong>{archivo}</strong>
                    <span className={s.tenue}>
                      {leidas.length} {leidas.length === 1 ? 'contratación encontrada' : 'contrataciones encontradas'}
                      {otras.length > 0 && ` · ${otras.length} ${otras.length === 1 ? 'hoja' : 'hojas'} sin trámite`}
                    </span>
                  </div>
                  <Boton tamano="chico" variante="fantasma" icono={<RotateCcw aria-hidden />} onClick={reiniciar}>
                    Elegir otra
                  </Boton>
                </div>
                <ul className={h.hojas}>
                  {leidas.map((c, i) => {
                    const dup = esDuplicada(c);
                    return (
                      <li key={c.hoja} className={`${h.hoja} ${dup ? h.hojaApagada : ''}`}>
                        <label className={h.hojaElegir}>
                          <input type="checkbox" checked={c.elegida && !dup} disabled={dup} onChange={(e) => cambiar(i, (x) => ({ ...x, elegida: e.target.checked }))} />
                          <span className={h.hojaNombre}>{c.identificador}</span>
                        </label>
                        <span className={h.hojaDetalle}>
                          {c.expediente ? `Expte. ${c.expediente}` : 'sin expediente'} · {c.pasos.length} pasos · {c.ofertas.length} ofertas
                          {c.fecha_inicio_texto && ` · inicio ${c.fecha_inicio_texto}`}
                        </span>
                        {dup && <span className={h.hojaAviso}>ya está cargada con su trámite: no se toca</span>}
                        {seCompleta(c) && <span className={h.hojaCompleta}>ya estaba cargada sin trámite: se completa</span>}
                      </li>
                    );
                  })}
                </ul>
                {otras.length > 0 && <p className={s.tenue}>No tienen la tabla del trámite y quedan afuera: {otras.join(', ')}.</p>}
              </>
            )}
            {error && <AvisoError titulo="No pudimos leer la planilla">{error}</AvisoError>}
            <div className={s.pie}>
              <span />
              <Boton variante="primario" disabled={!aImportar.length} onClick={() => setPaso('revision')}>
                Seguir: revisar <ArrowRight aria-hidden />
              </Boton>
            </div>
          </section>
        )}

        {paso === 'revision' && (
          <section className={s.tarjeta}>
            <div className={s.balance}>
              <div className={s.balanceTotal}>
                <span className="cifras">{aImportar.length}</span>
                {aImportar.length === 1 ? 'contratación para importar' : 'contrataciones para importar'}
              </div>
              <div className={s.balanceDetalle}>
                <Cifra valor={aImportar.reduce((n, c) => n + c.pasos.length, 0)} texto="pasos del trámite" tono="exito" />
                <Cifra valor={aImportar.reduce((n, c) => n + c.ofertas.length, 0)} texto="ofertas" tono="exito" />
                <Cifra valor={aImportar.reduce((n, c) => n + c.avisos.length, 0)} texto="avisos" tono={aImportar.some((c) => c.avisos.length) ? 'alerta' : undefined} />
              </div>
            </div>
            <div className={s.explicacion}>
              <Info aria-hidden />
              <p>
                Las fechas ambiguas («entre el 11 y 17/3/2020», «febrero 2020») se guardan tal cual, sin inventar el día. Los montos que la app encontró escritos en las
                observaciones quedan sin marcar: tildá solo los que coinciden con el expediente.
              </p>
            </div>

            {aImportar.map((c) => {
              const i = leidas.indexOf(c);
              return (
                <article key={c.hoja} className={h.contratacion}>
                  <header className={h.contratacionCabecera}>
                    <input
                      className={h.contratacionNombre}
                      value={c.identificador}
                      aria-label={`Identificador de la hoja ${c.hoja}`}
                      title="Identificador de la contratación: podés corregirlo"
                      onChange={(e) => cambiar(i, (x) => ({ ...x, identificador: e.target.value }))}
                    />
                    <span className={s.tenue}>
                      {[c.tipo_procedimiento, c.expediente && `Expte. ${c.expediente}`, c.fecha_inicio_texto && `inicio ${c.fecha_inicio_texto}`].filter(Boolean).join(' · ')}
                    </span>
                  </header>

                  <div className={h.tablaMarco}>
                    <table className={h.tabla}>
                      <thead>
                        <tr>
                          <th style={{ width: 48 }}>Fila</th>
                          <th style={{ width: 90 }}>Fs.</th>
                          <th style={{ width: 150 }}>Fecha</th>
                          <th>Procedimiento</th>
                          <th style={{ width: 180 }}>Firmante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.pasos.map((p) => (
                          <tr key={p.orden}>
                            <td className={h.fila}>{p.fila}</td>
                            <td>{p.fojas ? <Fojas fojas={p.fojas} /> : <span className={s.tenue}>—</span>}</td>
                            <td>
                              {p.fecha_texto ?? <span className={s.tenue}>—</span>}
                              {p.fecha_precision !== 'dia' && p.fecha_texto && <span className={h.precision}>{p.fecha_precision === 'mes' ? 'mes' : p.fecha_precision === 'anio' ? 'año' : 'tal cual'}</span>}
                            </td>
                            <td>
                              <strong className={h.pasoNombre}>{p.descripcion}</strong>
                              {p.observaciones && <span className={h.pasoObs}>{p.observaciones}</span>}
                              {p.link && <span className={h.pasoLink}>con link</span>}
                            </td>
                            <td>{p.firmante_texto ?? <span className={s.tenue}>—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(c.ofertas.some((o) => o.monto_sugerido !== undefined) || c.sugerencias.length > 0) && (
                    <div className={h.montos}>
                      <MarcaSugerencia>montos encontrados en el texto · confirmá cada uno</MarcaSugerencia>
                      {c.sugerencias.map((x, k) => (
                        <label key={x.campo} className={h.monto}>
                          <input
                            type="checkbox"
                            checked={x.usar}
                            onChange={(e) => cambiar(i, (y) => ({ ...y, sugerencias: y.sugerencias.map((z, m) => (m === k ? { ...z, usar: e.target.checked } : z)) }))}
                          />
                          <span>
                            {x.campo === 'presupuesto_oficial' ? 'Presupuesto oficial' : 'Reserva presupuestaria'}: <b className="cifras">{formatoPesos(x.monto)}</b>
                            <span className={s.tenue}> · de «{x.fuente}» (fila {x.fila})</span>
                          </span>
                        </label>
                      ))}
                      {c.ofertas
                        .filter((o) => o.monto_sugerido !== undefined)
                        .map((o) => (
                          <label key={o.orden} className={h.monto}>
                            <input type="checkbox" checked={Boolean(c.montos[o.orden])} onChange={(e) => cambiar(i, (y) => ({ ...y, montos: { ...y.montos, [o.orden]: e.target.checked } }))} />
                            <span>
                              Oferta de {o.oferente_texto}: <b className="cifras">{formatoPesos(o.monto_sugerido)}</b>
                              <span className={s.tenue}> · «{o.observaciones?.split('\n')[0]}»</span>
                            </span>
                          </label>
                        ))}
                    </div>
                  )}

                  {c.avisos.length > 0 && (
                    <Bloque icono={<TriangleAlert aria-hidden />} tono="alerta" titulo="Para revisar">
                      <ul className={s.listaFilas}>
                        {c.avisos.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </Bloque>
                  )}
                </article>
              );
            })}

            <div className={s.pie}>
              <Boton variante="fantasma" onClick={() => setPaso('archivo')}>
                <ArrowLeft aria-hidden /> Volver
              </Boton>
              <Boton variante="primario" cargando={importando} disabled={!aImportar.length} onClick={() => void importar()}>
                Importar {aImportar.length} {aImportar.length === 1 ? 'contratación' : 'contrataciones'}
              </Boton>
            </div>
          </section>
        )}

        {paso === 'hecho' && (
          <section className={`${s.tarjeta} ${s.hecho}`}>
            <span className={s.hechoIcono}>
              <Check aria-hidden />
            </span>
            <h3 className={s.hechoTitulo}>
              {importadas.length} {importadas.length === 1 ? 'contratación importada' : 'contrataciones importadas'}
            </h3>
            <ul className={h.resultados}>
              {resultados.map((r) => (
                <li key={r.identificador}>
                  <b>{r.identificador}</b>:{' '}
                  {r.ok
                    ? `${r.pasos} pasos y ${r.ofertas} ofertas${r.completada ? ', en la que ya estaba cargada' : ''}${
                        r.expedienteDistinto ? '. Ojo: el expediente de la planilla no coincide con el cargado; se dejó el cargado' : ''
                      }`
                    : r.duplicada
                      ? 'otra persona le cargó el trámite mientras tanto; no se tocó'
                      : `no se importó (${r.error})`}
                </li>
              ))}
            </ul>
            <p className={s.hechoTexto}>Cada paso recuerda de qué hoja y fila salió. Los montos que no confirmaste quedan para completar desde la ficha.</p>
            <div className={s.hechoAcciones}>
              <Link to="../contrataciones" relative="path" className={clasesBoton('primario')} style={{ textDecoration: 'none' }}>
                Ver las contrataciones <ArrowRight aria-hidden />
              </Link>
              <Boton icono={<FileUp aria-hidden />} onClick={reiniciar}>
                Importar otra planilla
              </Boton>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
