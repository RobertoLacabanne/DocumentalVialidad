import { useQueryClient } from '@tanstack/react-query';
import { FileDown, Search, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Boton } from '../componentes/Boton';
import { AreaTexto, Entrada, Selector } from '../componentes/campos';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { EstadoProcesal, Sello } from '../componentes/marcas';
import type { FilaIndice } from '../componentes/TablaPiezas';
import { useToast } from '../componentes/Toast';
import type { PersonaVista } from '../datos/causa';
import { traducirError } from '../datos/guardado';
import type { ItemVista } from '../datos/juicio';
import { ROLES } from '../lib/etiquetas';
import { descargar } from '../lib/exportar';
import { contenidoListado, listadoEnDocx, type Clase } from '../lib/ofrecimiento';
import { contiene } from '../lib/resaltar';
import { supabase } from '../lib/supabase';
import type { Causa } from '../lib/tipos';
import s from './Juicio.module.css';

const refrescar = (qc: ReturnType<typeof useQueryClient>, causaId: string) => void qc.invalidateQueries({ queryKey: ['ofrecimiento', causaId] });

/** Suma piezas del índice al ofrecimiento. Si alguna tiene un problema procesal, lo dice antes de confirmar. */
export function AgregarPiezas({
  abierto,
  causaId,
  piezas,
  ofrecidas,
  onCerrar,
}: {
  abierto: boolean;
  causaId: string;
  piezas: FilaIndice[];
  ofrecidas: Set<string>;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [texto, setTexto] = useState('');
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const disponibles = useMemo(
    () => piezas.filter((p) => !ofrecidas.has(p.id) && (!texto.trim() || contiene(`${p.numero_orden ?? ''} ${p.titulo} ${p.efecto_numero ?? ''}`, texto))),
    [piezas, ofrecidas, texto],
  );
  const conProblema = elegidas.map((id) => piezas.find((p) => p.id === id)).filter((p): p is FilaIndice => Boolean(p?.situacion));
  const alternar = (id: string) => setElegidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  async function agregar() {
    setEnviando(true);
    const { data, error } = await supabase.rpc('agregar_al_ofrecimiento', { p_causa: causaId, p_clase: 'documental', p_piezas: elegidas, p_personas: [] });
    setEnviando(false);
    if (error) {
      avisar(traducirError(error.message), { tono: 'error' });
      return;
    }
    const r = data as { agregados: number; ya_estaban: string[] };
    refrescar(qc, causaId);
    avisar(`${r.agregados} ${r.agregados === 1 ? 'pieza sumada' : 'piezas sumadas'} al ofrecimiento${r.ya_estaban.length ? ` (${r.ya_estaban.length} ya estaban)` : ''}.`);
    setElegidas([]);
    onCerrar();
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Sumar piezas del índice" descripcion="Entran como prueba documental, al final de la lista y numeradas en el orden en que las elijas.">
      <div className={clasesDialogo.cuerpo}>
        <label className={s.buscarDialogo}>
          <Search aria-hidden />
          <input type="search" placeholder="Nº de orden, título o efecto…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar pieza" autoFocus />
        </label>
        <ul className={s.listaElegir}>
          {disponibles.slice(0, 200).map((p) => (
            <li key={p.id}>
              <label className={`${s.elegir} ${elegidas.includes(p.id) ? s.elegida : ''}`}>
                <input type="checkbox" checked={elegidas.includes(p.id)} onChange={() => alternar(p.id)} />
                <Sello numero={p.numero_orden} />
                <span className={s.elegirTexto}>{p.titulo}</span>
                {elegidas.includes(p.id) && <span className={s.orden}>{elegidas.indexOf(p.id) + 1}º</span>}
                {p.situacion && <EstadoProcesal situacion={p.situacion.situacion} detalle={p.situacion.titulo} />}
              </label>
            </li>
          ))}
          {disponibles.length === 0 && <li className={s.nadaQueElegir}>{piezas.length ? 'No quedan piezas sin ofrecer que coincidan.' : 'El índice todavía no tiene piezas.'}</li>}
        </ul>
        {conProblema.length > 0 && (
          <div className={s.avisoProcesal} role="alert">
            <TriangleAlert aria-hidden />
            <div>
              <strong>
                {conProblema.length === 1 ? 'Una de las elegidas tiene' : `${conProblema.length} de las elegidas tienen`} un problema procesal.
              </strong>
              <ul>
                {conProblema.map((p) => (
                  <li key={p.id}>
                    Nº {p.numero_orden ?? '—'} · {p.titulo}: {p.situacion!.titulo}
                  </li>
                ))}
              </ul>
              Si las sumás, quedan marcadas en rojo en el punteo hasta que se resuelva.
            </div>
          </div>
        )}
      </div>
      <div className={clasesDialogo.pie}>
        <Boton variante="fantasma" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton variante={conProblema.length ? 'peligro' : 'primario'} cargando={enviando} disabled={!elegidas.length} onClick={() => void agregar()}>
          {conProblema.length ? `Sumar igual ${elegidas.length}` : `Sumar ${elegidas.length || ''} ${elegidas.length === 1 ? 'pieza' : 'piezas'}`}
        </Boton>
      </div>
    </Dialogo>
  );
}

/** Suma testigos o peritos del directorio. */
export function AgregarPersonas({
  abierto,
  causaId,
  personas,
  ofrecidas,
  onCerrar,
}: {
  abierto: boolean;
  causaId: string;
  personas: PersonaVista[];
  ofrecidas: ItemVista[];
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [clase, setClase] = useState<Clase>('testimonial');
  const [texto, setTexto] = useState('');
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const yaEstan = new Set(ofrecidas.filter((i) => i.clase === clase && i.persona_id).map((i) => i.persona_id!));
  const rolBuscado = clase === 'pericial' ? 'perito' : 'testigo';
  const lista = personas
    .filter((p) => !yaEstan.has(p.id) && (!texto.trim() || contiene(`${p.nombre} ${p.cargo ?? ''}`, texto)))
    .sort((a, b) => Number(b.roles.some((r) => r.rol === rolBuscado)) - Number(a.roles.some((r) => r.rol === rolBuscado)) || a.nombre.localeCompare(b.nombre, 'es'));
  const etiquetaRol = (rol: string) => ROLES.find((r) => r.valor === rol)?.etiqueta ?? rol;

  async function agregar() {
    setEnviando(true);
    const { data, error } = await supabase.rpc('agregar_al_ofrecimiento', { p_causa: causaId, p_clase: clase, p_piezas: [], p_personas: elegidas });
    setEnviando(false);
    if (error) {
      avisar(traducirError(error.message), { tono: 'error' });
      return;
    }
    const r = data as { agregados: number };
    refrescar(qc, causaId);
    avisar(`${r.agregados} ${clase === 'pericial' ? (r.agregados === 1 ? 'perito sumado' : 'peritos sumados') : r.agregados === 1 ? 'testigo sumado' : 'testigos sumados'}. Completá sobre qué va a declarar cada uno.`);
    setElegidas([]);
    onCerrar();
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Sumar testigos o peritos" descripcion="Salen del directorio de Personas y empresas. Primero aparecen quienes ya tienen ese rol.">
      <div className={clasesDialogo.cuerpo}>
        <div className={s.segmentoClase} role="group" aria-label="Clase de prueba">
          <button type="button" aria-pressed={clase === 'testimonial'} onClick={() => setClase('testimonial')}>
            Testigos
          </button>
          <button type="button" aria-pressed={clase === 'pericial'} onClick={() => setClase('pericial')}>
            Peritos
          </button>
        </div>
        <label className={s.buscarDialogo}>
          <Search aria-hidden />
          <input type="search" placeholder="Nombre o cargo…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar persona" />
        </label>
        <ul className={s.listaElegir}>
          {lista.slice(0, 200).map((p) => (
            <li key={p.id}>
              <label className={`${s.elegir} ${elegidas.includes(p.id) ? s.elegida : ''}`}>
                <input type="checkbox" checked={elegidas.includes(p.id)} onChange={() => setElegidas((l) => (l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id]))} />
                <span className={s.elegirTexto}>
                  {p.nombre}
                  {p.cargo && <span className={s.tenue}> · {p.cargo}</span>}
                </span>
                {p.roles.length > 0 && <span className={s.tenue}>{p.roles.map((r) => etiquetaRol(r.rol)).join(', ')}</span>}
              </label>
            </li>
          ))}
          {lista.length === 0 && <li className={s.nadaQueElegir}>No hay personas para sumar. Cargalas primero en Personas y empresas.</li>}
        </ul>
      </div>
      <div className={clasesDialogo.pie}>
        <Boton variante="fantasma" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton variante="primario" cargando={enviando} disabled={!elegidas.length} onClick={() => void agregar()}>
          Sumar {elegidas.length || ''}
        </Boton>
      </div>
    </Dialogo>
  );
}

/** Prueba que no es una pieza del índice ni una persona: un oficio, un informe a pedir, un instrumento. */
export function OtraPrueba({ abierto, causaId, items, onCerrar }: { abierto: boolean; causaId: string; items: ItemVista[]; onCerrar: () => void }) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const clase = String(d.get('clase')) as Clase;
    const descripcion = String(d.get('descripcion') ?? '').trim();
    if (!descripcion) return;
    const numeros = items.filter((i) => i.clase === clase).map((i) => parseInt(i.numero ?? '', 10)).filter((n) => !Number.isNaN(n));
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.from('ofrecimiento_item').insert({
      causa_id: causaId,
      clase,
      descripcion,
      objeto: String(d.get('objeto') ?? '').trim() || null,
      numero: String(Math.max(0, ...numeros) + 1),
    });
    setEnviando(false);
    if (err) {
      setError(traducirError(err.message));
      return;
    }
    refrescar(qc, causaId);
    avisar('Prueba sumada al ofrecimiento.');
    onCerrar();
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Otra prueba" descripcion="Informativa, instrumental o documental que todavía no está en el índice.">
      <form onSubmit={crear}>
        <div className={clasesDialogo.cuerpo}>
          <Selector name="clase" etiqueta="Clase" defaultValue="informativa">
            <option value="informativa">Informativa</option>
            <option value="instrumental">Instrumental</option>
            <option value="documental">Documental</option>
            <option value="otra">Otra</option>
          </Selector>
          <AreaTexto name="descripcion" etiqueta="Cómo se nombra en el escrito" rows={3} required placeholder="Se libre oficio a … a efecto de que informe …" />
          <Entrada name="objeto" etiqueta="Qué se prueba (opcional)" autoComplete="off" />
          {error && <AvisoError titulo={error} />}
        </div>
        <div className={clasesDialogo.pie}>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>
            Sumar
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

/** Listado de la prueba ofrecida, en .docx, para el requerimiento de remisión a juicio. */
export function ListadoPrueba({
  abierto,
  causa,
  items,
  personas,
  onCerrar,
}: {
  abierto: boolean;
  causa: Causa;
  items: ItemVista[];
  personas: PersonaVista[];
  onCerrar: () => void;
}) {
  const { avisar } = useToast();
  const [sinRechazadas, setSinRechazadas] = useState(true);
  const [conUbicacion, setConUbicacion] = useState(false);
  const [armando, setArmando] = useState(false);
  const nombres = useMemo(() => new Map(personas.map((p) => [p.id, p.nombre])), [personas]);
  const opciones = { legajo: causa.legajo_fiscalia, caratula: causa.caratula, sinRechazadas, conUbicacion };
  const bloques = contenidoListado(items, nombres, opciones);
  const total = bloques.reduce((n, b) => n + b.items.length, 0);
  const faltantes = bloques.reduce((n, b) => n + b.items.filter((i) => i.falta.length).length, 0);

  async function bajar() {
    setArmando(true);
    try {
      descargar(await listadoEnDocx(bloques, opciones), `Ofrecimiento de prueba - Legajo ${causa.legajo_fiscalia}.docx`);
      avisar('Listado descargado. Revisalo en Word antes de incorporarlo al requerimiento.');
      onCerrar();
    } finally {
      setArmando(false);
    }
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Listado de prueba" descripcion="Para el requerimiento de remisión a juicio: por clase (testimonial, pericial, documental…), numerado, con el formato de la fiscalía.">
      <div className={clasesDialogo.cuerpo}>
        <ul className={s.resumenListado}>
          {bloques.map((b) => (
            <li key={b.clase}>
              <b>
                {b.letra}.- {b.titulo}
              </b>{' '}
              · {b.items.length} {b.items.length === 1 ? 'ítem' : 'ítems'}
            </li>
          ))}
          {bloques.length === 0 && <li>No hay prueba para listar.</li>}
        </ul>
        <label className={s.casilla}>
          <input type="checkbox" checked={sinRechazadas} onChange={(e) => setSinRechazadas(e.target.checked)} />
          Dejar afuera lo que el auto de apertura rechazó
        </label>
        <label className={s.casilla}>
          <input type="checkbox" checked={conUbicacion} onChange={(e) => setConUbicacion(e.target.checked)} />
          Agregar la ubicación física de cada pieza (para uso interno)
        </label>
        {faltantes > 0 && (
          <p className={s.tenue}>
            {faltantes} {faltantes === 1 ? 'ítem sale' : 'ítems salen'} con [completar] (falta la descripción o sobre qué declara el testigo).
          </p>
        )}
      </div>
      <div className={clasesDialogo.pie}>
        <Boton variante="fantasma" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton variante="primario" icono={<FileDown aria-hidden />} cargando={armando} disabled={!total} onClick={() => void bajar()}>
          Descargar .docx ({total})
        </Boton>
      </div>
    </Dialogo>
  );
}
