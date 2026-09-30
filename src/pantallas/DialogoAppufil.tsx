// Traer el texto que ya leyó AppUFIL. El único contrato entre las dos
// aplicaciones es un archivo: AppUFIL sigue offline y el tablero no depende
// de él para funcionar.
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileJson, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Boton } from '../componentes/Boton';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { datosParaSugerir, type DocumentoVista } from '../datos/documentos';
import { traducirError } from '../datos/guardado';
import { enTandas, leerPaqueteTexto, type PaqueteTexto } from '../lib/documentos';
import { sugerirParaDocumento } from '../lib/sugerencias';
import { supabase } from '../lib/supabase';
import { useCausaActual } from './Marco';
import s from './Documentos.module.css';

type Resultado = { nuevos: number; yaEstaban: number; guardadas: number; omitidas: number; sugerencias: number; errores: string[] };

export function TraerAppufil({ abierto, causaId, existentes, onCerrar }: { abierto: boolean; causaId: string; existentes: DocumentoVista[]; onCerrar: () => void }) {
  const qc = useQueryClient();
  const { causa } = useCausaActual();
  const [leido, setLeido] = useState<{ paquete: PaqueteTexto; avisos: string[]; archivo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [avance, setAvance] = useState<{ hecho: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function cerrar() {
    if (avance) return;
    setLeido(null);
    setError(null);
    setResultado(null);
    setReemplazar(false);
    onCerrar();
  }

  async function elegir(f: File | undefined) {
    if (!f) return;
    setError(null);
    setResultado(null);
    try {
      const json = JSON.parse(await f.text()) as unknown;
      setLeido({ ...leerPaqueteTexto(json), archivo: f.name });
    } catch (e) {
      setLeido(null);
      setError(e instanceof SyntaxError ? 'El archivo no es un JSON válido.' : (e as Error).message);
    }
  }

  async function traer() {
    if (!leido) return;
    const r: Resultado = { nuevos: 0, yaEstaban: 0, guardadas: 0, omitidas: 0, sugerencias: 0, errores: [] };
    const archivos = leido.paquete.archivos;
    setAvance({ hecho: 0, total: archivos.length });
    const datos = await datosParaSugerir(causaId).catch(() => null);
    for (const [i, a] of archivos.entries()) {
      try {
        const { data: reg, error: e1 } = await supabase.rpc('registrar_documento', {
          p_causa: causaId,
          p_datos: { sha256: a.sha256, nombre: a.nombre, ruta: a.ruta, bytes: a.bytes, paginas: a.paginas, origen: 'appufil' },
        });
        if (e1) throw new Error(e1.message);
        const doc = reg as { id: string; ya_estaba: boolean };
        if (doc.ya_estaba) r.yaEstaban++;
        else r.nuevos++;
        for (const tanda of enTandas(a.texto, 100)) {
          const { data: g, error: e2 } = await supabase.rpc('guardar_paginas', { p_documento: doc.id, p_paginas: tanda, p_reemplazar: reemplazar });
          if (e2) throw new Error(e2.message);
          r.guardadas += (g as { guardadas: number }).guardadas;
          r.omitidas += (g as { omitidas: number }).omitidas;
        }
        if (datos) {
          const items = sugerirParaDocumento({ nombre: a.nombre, ruta: a.ruta, sha256: a.sha256, paginas: a.texto }, datos);
          if (items.length) {
            const { data: n } = await supabase.rpc('guardar_sugerencias', { p_causa: causaId, p_entidad: doc.id, p_items: items });
            r.sugerencias += (n as number | null) ?? 0;
          }
        }
      } catch (e) {
        r.errores.push(`${a.nombre}: ${traducirError((e as Error).message)}`);
      }
      setAvance({ hecho: i + 1, total: archivos.length });
    }
    setAvance(null);
    setResultado(r);
    for (const k of ['documentos', 'documentos-resumen', 'sugerencias']) void qc.invalidateQueries({ queryKey: [k, causaId] });
  }

  const conocidos = new Set(existentes.map((d) => d.sha256));
  const p = leido?.paquete;
  const yaEstaban = p ? p.archivos.filter((a) => conocidos.has(a.sha256)).length : 0;
  const paginas = p ? p.archivos.reduce((n, a) => n + a.texto.length, 0) : 0;
  const otroLegajo = p?.legajo && !p.legajo.replace(/\D/g, '').includes(causa.legajo_fiscalia.replace(/\D/g, ''));

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Traer texto de AppUFIL"
      descripcion="Si los escaneos ya se procesaron en AppUFIL, su texto se trae con un archivo: sin volver a hacer el OCR y sin conectar las dos aplicaciones."
    >
      <div className={clasesDialogo.cuerpo}>
        {!resultado && (
          <ol className={s.pasosAppufil}>
            <li>
              En la computadora de AppUFIL, bajá el script y corrélo sobre la base del legajo:
              <code className={s.comando}>python3 appufil-a-tablero.py datos/legajos/&lt;legajo&gt;/ufil.sqlite</code>
              <a className={s.botonEnlace} href="/herramientas/appufil-a-tablero.py" download>
                <Download aria-hidden /> Bajar el script
              </a>
              Lee la base sin modificarla y arma un archivo <em>texto-para-el-tablero-….json</em> con la huella y el texto de cada página.
            </li>
            <li>
              Traé ese archivo (en un pendrive, si AppUFIL está sin internet) y elegilo acá:
              <div>
                <Boton icono={<FileJson aria-hidden />} onClick={() => input.current?.click()}>
                  {leido ? 'Elegir otro archivo' : 'Elegir el archivo .json'}
                </Boton>
                <input
                  ref={input}
                  type="file"
                  accept=".json,application/json"
                  className="visualmente-oculto"
                  aria-label="Elegir el paquete de texto de AppUFIL"
                  onChange={(e) => {
                    void elegir(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            </li>
          </ol>
        )}
        {error && <AvisoError titulo={error} />}
        {p && !resultado && (
          <div className={s.resumenPaquete}>
            <p>
              <strong>{leido!.archivo}</strong>
              {p.generado_por && ` · generado por ${p.generado_por}`}
              {p.generado_en && ` el ${new Date(p.generado_en).toLocaleDateString('es-AR')}`}
            </p>
            <p>
              {p.archivos.length} {p.archivos.length === 1 ? 'archivo' : 'archivos'} · {paginas.toLocaleString('es-AR')} páginas con texto
              {yaEstaban > 0 && ` · ${yaEstaban} ya ${yaEstaban === 1 ? 'estaba leído' : 'estaban leídos'} en el tablero (se reconocen por la huella)`}
            </p>
            {otroLegajo && (
              <p className={s.avisoLegajo}>
                <TriangleAlert aria-hidden /> El paquete dice legajo «{p.legajo}» y estás en el legajo {causa.legajo_fiscalia}. Revisá que sea el correcto.
              </p>
            )}
            {leido!.avisos.length > 0 && (
              <ul className={s.avisos}>
                {leido!.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            {yaEstaban > 0 && (
              <label className={s.casilla}>
                <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
                Reemplazar el texto de las páginas que ya estaban leídas (AppUFIL suele leer mejor: endereza las hojas y compara dos lecturas)
              </label>
            )}
            {avance && (
              <div className={s.barra} role="progressbar" aria-valuemin={0} aria-valuemax={avance.total} aria-valuenow={avance.hecho} aria-label="Avance">
                <span style={{ width: `${Math.round((avance.hecho / avance.total) * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        {resultado && (
          <div className={s.resumenPaquete} role="status">
            <p>
              <strong>Listo.</strong> {resultado.nuevos} {resultado.nuevos === 1 ? 'documento nuevo' : 'documentos nuevos'}
              {resultado.yaEstaban > 0 && `, ${resultado.yaEstaban} que ya estaban`} · {resultado.guardadas.toLocaleString('es-AR')} páginas guardadas
              {resultado.omitidas > 0 && ` · ${resultado.omitidas} ya leídas que no se pisaron`}
              {resultado.sugerencias > 0 && ` · ${resultado.sugerencias} sugerencias para validar`}.
            </p>
            {resultado.errores.length > 0 && (
              <ul className={s.avisos}>
                {resultado.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className={clasesDialogo.pie}>
        <Boton variante="fantasma" onClick={cerrar} disabled={!!avance}>
          {resultado ? 'Cerrar' : 'Cancelar'}
        </Boton>
        {!resultado && (
          <Boton variante="primario" disabled={!p} cargando={!!avance} onClick={() => void traer()}>
            {avance ? `Trayendo ${avance.hecho} de ${avance.total}…` : `Traer ${p?.archivos.length ?? ''} ${p?.archivos.length === 1 ? 'archivo' : 'archivos'}`}
          </Boton>
        )}
      </div>
    </Dialogo>
  );
}
