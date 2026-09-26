import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CircleAlert, FileSpreadsheet, FileUp, Info, RotateCcw, TriangleAlert, UserPlus } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Boton, clasesBoton } from '../componentes/Boton';
import { AvisoError } from '../componentes/estados';
import { EtiquetaEfecto, MarcaSugerencia } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useEfectos } from '../datos/causa';
import { useDirectorio } from '../datos/consultas';
import { traducirError } from '../datos/guardado';
import { CAMPOS_IMPORTACION, autoMapear, detectarEncabezado, normalizar, revisar, texto, type Campo, type Celda, type Mapeo } from '../lib/importacion';
import { supabase } from '../lib/supabase';
import { CabeceraCausa } from './CabeceraCausa';
import { useCausaActual } from './Marco';
import s from './Importar.module.css';
import si from './Indice.module.css';

type Hoja = { nombre: string; filas: Celda[][] };
type Archivo = { nombre: string; hojas: Hoja[] };
type Paso = 'archivo' | 'columnas' | 'revision' | 'hecho';
type Resultado = { importadas: number; duplicadas: { numero: string; fila: string }[]; procedimientos_creados: number; informes_creados: number };

const PASOS: { valor: Paso; etiqueta: string }[] = [
  { valor: 'archivo', etiqueta: 'Planilla' },
  { valor: 'columnas', etiqueta: 'Columnas' },
  { valor: 'revision', etiqueta: 'Revisión' },
  { valor: 'hecho', etiqueta: 'Listo' },
];

const letra = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));

async function leerArchivo(archivo: File): Promise<Archivo> {
  if (/\.xlsx$/i.test(archivo.name)) {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const hojas = await readXlsxFile(archivo);
    return { nombre: archivo.name, hojas: hojas.map((h) => ({ nombre: h.sheet, filas: h.data as unknown as Celda[][] })) };
  }
  if (/\.(csv|txt)$/i.test(archivo.name)) {
    const bytes = await archivo.arrayBuffer();
    let contenido = new TextDecoder('utf-8').decode(bytes);
    if (contenido.includes('�')) contenido = new TextDecoder('windows-1252').decode(bytes);
    const { default: Papa } = await import('papaparse');
    const r = Papa.parse<string[]>(contenido.replace(/^﻿/, ''), { skipEmptyLines: false });
    return { nombre: archivo.name, hojas: [{ nombre: 'CSV', filas: r.data }] };
  }
  throw new Error('Solo se pueden importar planillas .xlsx o .csv. Si está en Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx).');
}

/** Papel o dispositivos, según las columnas y el título de la hoja. Es una sugerencia: se puede cambiar. */
function soporteProbable(filas: Celda[][], encabezado: number): 'papel' | 'digital' {
  const titulos = (filas[encabezado] ?? []).map((c) => normalizar(texto(c)));
  const arriba = filas.slice(0, encabezado).flat().map((c) => normalizar(texto(c))).join(' ');
  if (titulos.some((t) => /patron|contrasena|gabinete|tenedor/.test(t))) return 'digital';
  if (/papel/.test(arriba) || titulos.some((t) => /escaneo/.test(t))) return 'papel';
  if (/dispositivo|celular|telefono/.test(arriba)) return 'digital';
  return 'papel';
}

export function Importar() {
  const { causa } = useCausaActual();
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { miembros } = useDirectorio();
  const { filas: efectos } = useEfectos(causa.id);
  const [paso, setPaso] = useState<Paso>('archivo');
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [hoja, setHoja] = useState(0);
  const [encabezado, setEncabezado] = useState(0);
  const [soporte, setSoporte] = useState<'papel' | 'digital'>('papel');
  const [mapeo, setMapeo] = useState<Mapeo>({});
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const selector = useRef<HTMLInputElement>(null);

  const filas = archivo?.hojas[hoja]?.filas ?? [];
  const titulos = (filas[encabezado] ?? []).map((c) => texto(c));
  const anchoTabla = Math.max(titulos.length, ...filas.slice(encabezado, encabezado + 12).map((f) => f.length));

  function prepararHoja(a: Archivo, i: number) {
    const f = a.hojas[i].filas;
    const enc = detectarEncabezado(f);
    setHoja(i);
    setEncabezado(enc);
    setSoporte(soporteProbable(f, enc));
    setMapeo(autoMapear(f[enc] ?? []));
  }

  async function elegir(file: File | undefined) {
    if (!file) return;
    setLeyendo(true);
    setError(null);
    try {
      const a = await leerArchivo(file);
      if (!a.hojas.length) throw new Error('La planilla no tiene hojas.');
      const conDatos = a.hojas.findIndex((h) => autoMapear(h.filas[detectarEncabezado(h.filas)] ?? []).numero !== undefined);
      setArchivo(a);
      prepararHoja(a, conDatos >= 0 ? conDatos : 0);
    } catch (e) {
      setError((e as Error).message);
      setArchivo(null);
    } finally {
      setLeyendo(false);
    }
  }

  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setEncima(false);
    void elegir(e.dataTransfer.files[0]);
  }

  const numerosExistentes = useMemo(() => new Set(efectos.map((e) => e.numero)), [efectos]);
  const aliasMiembros = useMemo(() => new Set(miembros.filter((m) => m.alias).map((m) => m.alias!.toUpperCase())), [miembros]);
  const enRevision = paso === 'revision';
  const revisionViva = useMemo(
    () => (enRevision ? revisar(filas, encabezado + 1, mapeo, soporte, numerosExistentes, aliasMiembros) : null),
    [enRevision, filas, encabezado, mapeo, soporte, numerosExistentes, aliasMiembros],
  );
  // Al importar, la revisión se congela: el resumen final compara contra lo que se vio, no contra lo que llegó después.
  const [revisionFinal, setRevisionFinal] = useState<ReturnType<typeof revisar> | null>(null);
  const revision = paso === 'hecho' ? revisionFinal : revisionViva;

  const asignar = (columna: number, campo: Campo | '') =>
    setMapeo((m) => {
      const nuevo: Mapeo = {};
      for (const [c, i] of Object.entries(m) as [Campo, number][]) if (i !== columna && c !== campo) nuevo[c] = i;
      if (campo) nuevo[campo] = columna;
      return nuevo;
    });
  const campoDe = (columna: number) => (Object.entries(mapeo) as [Campo, number][]).find(([, i]) => i === columna)?.[0] ?? '';

  async function importar() {
    if (!revision || !archivo) return;
    setImportando(true);
    const { data, error: err } = await supabase.rpc('importar_efectos', {
      p_causa: causa.id,
      p_archivo: archivo.nombre,
      p_hoja: archivo.hojas[hoja].nombre,
      p_filas: revision.aImportar,
      p_filas_origen: revision.filasOrigen,
    });
    setImportando(false);
    if (err) {
      avisar(`No se importó nada: ${traducirError(err.message)}`, { tono: 'error', duracion: 9000 });
      return;
    }
    setRevisionFinal(revision);
    setResultado(data as Resultado);
    setPaso('hecho');
    for (const k of ['efectos', 'procedimientos', 'informes-ref', 'estado-procesal-efectos']) void qc.invalidateQueries({ queryKey: [k, causa.id] });
  }

  function reiniciar() {
    setPaso('archivo');
    setArchivo(null);
    setMapeo({});
    setResultado(null);
    setError(null);
    if (selector.current) selector.current.value = '';
  }

  const indicePaso = PASOS.findIndex((p) => p.valor === paso);
  const repetidasOmitidas = revision ? revision.validas.length - revision.aImportar.length - revision.yaExistentes.length : 0;

  return (
    <div className={s.pantalla}>
      <CabeceraCausa causa={causa} />
      <div className={s.cuerpo}>
        <div className={s.encabezado}>
          <Link to="../efectos" relative="path" className={s.volver}>
            <ArrowLeft aria-hidden /> Efectos
          </Link>
          <h2 className={si.titulo}>Importar una planilla de efectos</h2>
          <p className={si.bajada}>
            Sirve para LISTADO EFECTOS, DISTRIBUCIÓN DE TAREAS o cualquier planilla parecida. Antes de guardar, ves exactamente qué entra y qué no.
          </p>
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
                <input ref={selector} type="file" accept=".xlsx,.csv" className="visualmente-oculto" onChange={(e) => void elegir(e.target.files?.[0])} />
                <span className={s.zonaIcono}>
                  <FileUp aria-hidden />
                </span>
                <strong>{leyendo ? 'Leyendo la planilla…' : 'Arrastrá la planilla acá o hacé clic para elegirla'}</strong>
                <span className={s.tenue}>Excel (.xlsx) o CSV. Si está en Google Sheets: Archivo → Descargar → Microsoft Excel.</span>
              </label>
            ) : (
              <>
                <div className={s.archivo}>
                  <FileSpreadsheet aria-hidden />
                  <div>
                    <strong>{archivo.nombre}</strong>
                    <span className={s.tenue}>
                      {archivo.hojas.length} {archivo.hojas.length === 1 ? 'hoja' : 'hojas'} · la fila {encabezado + 1} tiene los títulos
                    </span>
                  </div>
                  <Boton tamano="chico" variante="fantasma" icono={<RotateCcw aria-hidden />} onClick={reiniciar}>
                    Elegir otra
                  </Boton>
                </div>

                <div className={s.opciones}>
                  {archivo.hojas.length > 1 && (
                    <label className={s.opcion}>
                      <span>Hoja</span>
                      <select className={si.filtro} value={hoja} onChange={(e) => prepararHoja(archivo, Number(e.target.value))}>
                        {archivo.hojas.map((h, i) => (
                          <option key={h.nombre} value={i}>
                            {h.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className={s.opcion}>
                    <span>Fila de títulos</span>
                    <select
                      className={si.filtro}
                      value={encabezado}
                      onChange={(e) => {
                        const enc = Number(e.target.value);
                        setEncabezado(enc);
                        setMapeo(autoMapear(filas[enc] ?? []));
                      }}
                    >
                      {filas.slice(0, 20).map((f, i) => (
                        <option key={i} value={i}>
                          Fila {i + 1}
                          {f.some((c) => texto(c)) ? `: ${f.map((c) => texto(c)).filter(Boolean).slice(0, 3).join(' · ').slice(0, 50)}` : ' (vacía)'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className={s.opcion}>
                    <legend>¿Qué hay en esta planilla?</legend>
                    <div className={si.segmento} role="group">
                      <button type="button" aria-pressed={soporte === 'papel'} onClick={() => setSoporte('papel')}>
                        Documentación en papel
                      </button>
                      <button type="button" aria-pressed={soporte === 'digital'} onClick={() => setSoporte('digital')}>
                        Dispositivos
                      </button>
                    </div>
                  </fieldset>
                </div>

                <div className={s.vistaPrevia}>
                  <table>
                    <thead>
                      <tr>
                        <th className={s.numFila}>#</th>
                        {Array.from({ length: anchoTabla }, (_, i) => (
                          <th key={i}>
                            <span className={s.letra}>{letra(i)}</span>
                            {titulos[i] || <span className={s.tenue}>sin título</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filas.slice(encabezado + 1, encabezado + 9).map((f, r) => (
                        <tr key={r}>
                          <td className={s.numFila}>{encabezado + r + 2}</td>
                          {Array.from({ length: anchoTabla }, (_, i) => (
                            <td key={i}>{texto(f[i])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={s.tenue}>
                  Primeras filas de «{archivo.hojas[hoja].nombre}», tal como están en el archivo. Hay {Math.max(filas.length - encabezado - 1, 0)} filas debajo de los títulos.
                </p>
              </>
            )}
            {error && <AvisoError titulo="No pudimos leer la planilla">{error}</AvisoError>}
            <div className={s.pie}>
              <span />
              <Boton variante="primario" disabled={!archivo} onClick={() => setPaso('columnas')}>
                Seguir: revisar columnas <ArrowRight aria-hidden />
              </Boton>
            </div>
          </section>
        )}

        {paso === 'columnas' && archivo && (
          <section className={s.tarjeta}>
            <div className={s.explicacion}>
              <Info aria-hidden />
              <p>
                La app ya relacionó las columnas que reconoció. Revisá que cada una vaya al lugar correcto; lo que marques «No importar» queda afuera. El Nº
                de efecto es obligatorio.
              </p>
            </div>
            <div className={s.mapeo}>
              <div className={`${s.mapeoFila} ${s.mapeoCabecera}`}>
                <span>Columna de la planilla</span>
                <span>Ejemplo</span>
                <span>Va a</span>
              </div>
              {titulos.map((t, i) => {
                const ejemplo = filas
                  .slice(encabezado + 1)
                  .map((f) => texto(f[i]))
                  .find(Boolean);
                const campo = campoDe(i);
                if (!t && !ejemplo) return null;
                return (
                  <div key={i} className={`${s.mapeoFila} ${campo ? '' : s.mapeoIgnorada}`}>
                    <span className={s.mapeoTitulo}>
                      <span className={s.letra}>{letra(i)}</span>
                      {t || <span className={s.tenue}>sin título</span>}
                    </span>
                    <span className={s.mapeoEjemplo} title={ejemplo}>
                      {ejemplo ?? <span className={s.tenue}>vacía</span>}
                    </span>
                    <select className={si.filtro} aria-label={`Destino de la columna ${t || letra(i)}`} value={campo} onChange={(e) => asignar(i, e.target.value as Campo | '')}>
                      <option value="">No importar</option>
                      {CAMPOS_IMPORTACION.filter((c) => soporte === 'digital' || !['patron_contrasena', 'tiene_informe_gabinete', 'observaciones_gabinete'].includes(c.campo)).map((c) => (
                        <option key={c.campo} value={c.campo}>
                          {c.etiqueta}
                          {c.obligatorio ? ' (obligatorio)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {mapeo.numero === undefined && <AvisoError titulo="Falta indicar qué columna tiene el Nº de efecto." />}
            <div className={s.pie}>
              <Boton variante="fantasma" onClick={() => setPaso('archivo')}>
                <ArrowLeft aria-hidden /> Volver
              </Boton>
              <Boton variante="primario" disabled={mapeo.numero === undefined} onClick={() => setPaso('revision')}>
                Seguir: ver qué entra <ArrowRight aria-hidden />
              </Boton>
            </div>
          </section>
        )}

        {paso === 'revision' && revision && (
          <section className={s.tarjeta}>
            <div className={s.balance}>
              <div className={s.balanceTotal}>
                <span className="cifras">{revision.filasOrigen}</span>
                filas con datos en la planilla
              </div>
              <div className={s.balanceDetalle}>
                <Cifra valor={revision.aImportar.length} texto="se importan" tono="exito" />
                <Cifra valor={revision.yaExistentes.length} texto="ya estaban cargados" />
                <Cifra valor={repetidasOmitidas} texto="repetidos en el archivo" />
                <Cifra valor={revision.conErrores.length} texto="con errores, no entran" tono={revision.conErrores.length ? 'peligro' : undefined} />
                <Cifra valor={revision.sinNumero.length} texto="sin Nº de efecto" tono={revision.sinNumero.length ? 'alerta' : undefined} />
              </div>
              {revision.aImportar.length > 0 && (
                <p className={s.tenue}>
                  {revision.procedimientos > 0 &&
                    `Se agrupan en ${revision.procedimientos} ${revision.procedimientos === 1 ? 'procedimiento' : 'procedimientos'} por fecha y domicilio. `}
                  {revision.informes.length > 0 &&
                    `${revision.informes.length === 1 ? 'Se vincula 1 informe' : `Se vinculan ${revision.informes.length} informes`} del gabinete (${revision.informes.join(', ')}).`}
                </p>
              )}
            </div>

            {revision.conErrores.length > 0 && (
              <Bloque icono={<CircleAlert aria-hidden />} tono="peligro" titulo={`${revision.conErrores.length} ${revision.conErrores.length === 1 ? 'fila tiene' : 'filas tienen'} valores que no reconocemos`}>
                <p>No se cambia nada por deducción. Corregilas en la planilla y volvé a subirla, o importá el resto y cargá esas a mano.</p>
                <ul className={s.listaFilas}>
                  {revision.conErrores.map((r) => (
                    <li key={r.fila}>
                      <span className={s.filaNumero}>Fila {r.fila}</span>
                      <EtiquetaEfecto numero={r.numero} />
                      <span>{r.errores.join(' ')}</span>
                    </li>
                  ))}
                </ul>
              </Bloque>
            )}

            {revision.sinNumero.length > 0 && (
              <Bloque icono={<TriangleAlert aria-hidden />} tono="alerta" titulo={`${revision.sinNumero.length} ${revision.sinNumero.length === 1 ? 'fila tiene' : 'filas tienen'} datos pero no Nº de efecto`}>
                <p>Quedan afuera. Si corresponden a un efecto, completá el número en la planilla.</p>
                <ul className={s.listaFilas}>
                  {revision.sinNumero.map((r) => (
                    <li key={r.fila}>
                      <span className={s.filaNumero}>Fila {r.fila}</span>
                      <span>{r.contenido || 'sin contenido legible'}</span>
                    </li>
                  ))}
                </ul>
              </Bloque>
            )}

            {(revision.yaExistentes.length > 0 || revision.repetidasEnArchivo.length > 0) && (
              <Bloque icono={<Info aria-hidden />} titulo="Duplicados">
                {revision.yaExistentes.length > 0 && (
                  <p>
                    Ya están cargados y no se tocan:{' '}
                    <span className={s.efectos}>
                      {revision.yaExistentes.map((v) => (
                        <EtiquetaEfecto key={v.fila} numero={v.numero} />
                      ))}
                    </span>
                  </p>
                )}
                {revision.repetidasEnArchivo.map((r) => (
                  <p key={r.numero}>
                    El Nº {r.numero} aparece en las filas {r.filas.join(', ')}: se toma la fila {r.filas[0]} y las demás quedan afuera.
                  </p>
                ))}
              </Bloque>
            )}

            {revision.aliasSinMiembro.length > 0 && (
              <Bloque icono={<UserPlus aria-hidden />} titulo="Responsables que todavía no están en el equipo">
                <p>
                  {revision.aliasSinMiembro.join(', ')}: sus efectos quedan a su nombre y se les asignan solos cuando los invites en Equipo con ese mismo alias.
                </p>
              </Bloque>
            )}

            {revision.mencionesProcesales.length > 0 && (
              <Bloque icono={<TriangleAlert aria-hidden />} titulo="Observaciones que mencionan planteos procesales">
                <MarcaSugerencia>revisar · no se marca nada solo</MarcaSugerencia>
                <p>
                  Estas filas hablan de casación, apelación, nulidad o exclusión. Después de importar, si corresponde, marcá la situación procesal desde Efectos:{' '}
                  <span className={s.efectos}>
                    {revision.mencionesProcesales.map((v) => (
                      <EtiquetaEfecto key={v.fila} numero={v.numero} />
                    ))}
                  </span>
                </p>
              </Bloque>
            )}

            {revision.avisos.length > 0 && (
              <details className={s.avisos}>
                <summary>
                  {revision.avisos.length} {revision.avisos.length === 1 ? 'aviso menor' : 'avisos menores'}
                </summary>
                <ul className={s.listaFilas}>
                  {revision.avisos.map((a, i) => (
                    <li key={i}>
                      <span className={s.filaNumero}>Fila {a.fila}</span>
                      <EtiquetaEfecto numero={a.numero} />
                      <span>{a.texto}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className={s.pie}>
              <Boton variante="fantasma" onClick={() => setPaso('columnas')}>
                <ArrowLeft aria-hidden /> Volver
              </Boton>
              <Boton variante="primario" disabled={!revision.aImportar.length} cargando={importando} onClick={() => void importar()}>
                {revision.aImportar.length
                  ? `Importar ${revision.aImportar.length} ${revision.aImportar.length === 1 ? 'efecto' : 'efectos'}`
                  : 'No hay efectos nuevos para importar'}
              </Boton>
            </div>
          </section>
        )}

        {paso === 'hecho' && resultado && revision && archivo && (
          <section className={`${s.tarjeta} ${s.hecho}`}>
            <span className={s.hechoIcono}>
              <Check aria-hidden />
            </span>
            <h3 className={s.hechoTitulo}>
              {resultado.importadas} {resultado.importadas === 1 ? 'efecto importado' : 'efectos importados'}
            </h3>
            <p className={s.hechoTexto}>
              De las {revision.filasOrigen} filas con datos de «{archivo.nombre}» entraron {resultado.importadas}
              {revision.filasOrigen - resultado.importadas > 0 && `; ${revision.filasOrigen - resultado.importadas} quedaron afuera por los motivos que viste en la revisión`}
              {resultado.duplicadas.length > 0 && ` (${resultado.duplicadas.length} los cargó otra persona mientras tanto)`}.
              {resultado.procedimientos_creados > 0 && ` Se crearon ${resultado.procedimientos_creados} procedimientos`}
              {resultado.informes_creados > 0 && ` y ${resultado.informes_creados} informes del gabinete`}
              {resultado.procedimientos_creados > 0 || resultado.informes_creados > 0 ? '.' : ''} Cada efecto recuerda de qué archivo y fila salió.
            </p>
            <div className={s.hechoAcciones}>
              <Link to="../efectos" relative="path" className={clasesBoton('primario')} style={{ textDecoration: 'none' }}>
                Ver los efectos <ArrowRight aria-hidden />
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

function Cifra({ valor, texto: t, tono }: { valor: number; texto: string; tono?: 'exito' | 'peligro' | 'alerta' }) {
  return (
    <span className={`${s.cifra} ${tono ? s[`cifra_${tono}`] : ''} ${valor ? '' : s.cifraCero}`}>
      <b className="cifras">{valor}</b>
      {t}
    </span>
  );
}

function Bloque({ icono, titulo, tono, children }: { icono: ReactNode; titulo: string; tono?: 'peligro' | 'alerta'; children: ReactNode }) {
  return (
    <div className={`${s.bloque} ${tono ? s[`bloque_${tono}`] : ''}`}>
      <div className={s.bloqueTitulo}>
        {icono}
        <strong>{titulo}</strong>
      </div>
      <div className={s.bloqueCuerpo}>{children}</div>
    </div>
  );
}
