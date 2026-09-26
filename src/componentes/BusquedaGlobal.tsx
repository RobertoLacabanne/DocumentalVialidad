import * as RadixDialog from '@radix-ui/react-dialog';
import { FileScan, FileText, Landmark, LoaderCircle, MessagesSquare, Package, ScrollText, ScanText, Search } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MATERIALES_ETIQUETA, SOPORTE_ETIQUETA, tipoPieza } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import type { TipoPieza } from '../lib/tipos';
import s from './BusquedaGlobal.module.css';

type Resultado = { tipo: string; id: string; titulo: string; detalle: string; fragmento: string; rango: number };

const GRUPOS: { tipo: string; titulo: string; icono: ReactNode; ruta?: (id: string) => string }[] = [
  { tipo: 'efecto', titulo: 'Efectos', icono: <Package aria-hidden />, ruta: (id) => `efectos?efecto=${id}` },
  { tipo: 'pieza', titulo: 'Piezas del índice', icono: <FileText aria-hidden />, ruta: (id) => `indice?pieza=${id}` },
  { tipo: 'persona', titulo: 'Personas y empresas', icono: <Landmark aria-hidden />, ruta: (id) => `personas?persona=${id}` },
  { tipo: 'mensaje', titulo: 'Mensajes', icono: <MessagesSquare aria-hidden />, ruta: (id) => `mensajes?mensaje=${id}` },
  { tipo: 'contratacion', titulo: 'Contrataciones', icono: <ScrollText aria-hidden />, ruta: (id) => `contrataciones?c=${id}` },
  { tipo: 'pagina', titulo: 'Texto de los escaneos', icono: <ScanText aria-hidden />, ruta: (id) => `documentos?pagina=${id}` },
  { tipo: 'documento', titulo: 'Documentos', icono: <FileScan aria-hidden />, ruta: (id) => `documentos?doc=${id}` },
];

const CLAVE_RECIENTES = 'tp-busquedas';

function leerRecientes(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]') as string[]).slice(0, 5);
  } catch {
    return [];
  }
}
function guardarReciente(texto: string) {
  try {
    const lista = [texto, ...leerRecientes().filter((t) => t !== texto)].slice(0, 5);
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
  } catch {
    /* sin almacenamiento local */
  }
}

/** Convierte los ⟦resaltados⟧ que devuelve la base en <mark>, sin inyectar HTML. */
export function Resaltado({ texto }: { texto: string }) {
  const partes = texto.split(/(⟦[^⟧]*⟧)/g).filter(Boolean);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('⟦') ? <mark key={i}>{p.slice(1, -1)}</mark> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

function detalleLegible(r: Resultado): string {
  if (r.tipo === 'pieza') return tipoPieza(r.detalle as TipoPieza).etiqueta;
  if (r.tipo === 'efecto') {
    const [soporte, material] = r.detalle.split(' · ');
    return [SOPORTE_ETIQUETA[soporte] ?? soporte, material && material !== 'dispositivo' ? MATERIALES_ETIQUETA[material] ?? material : null].filter(Boolean).join(' · ');
  }
  return r.detalle;
}

export function BusquedaGlobal({ causaId, abierta, onCambiar }: { causaId: string; abierta: boolean; onCambiar: (v: boolean) => void }) {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activo, setActivo] = useState(0);
  const [recientes, setRecientes] = useState<string[]>(leerRecientes);
  const lista = useRef<HTMLDivElement>(null);
  const pedido = useRef(0);

  useEffect(() => {
    const atajo = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onCambiar(true);
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, [onCambiar]);

  useEffect(() => {
    if (abierta) setRecientes(leerRecientes());
  }, [abierta]);

  useEffect(() => {
    const t = texto.trim();
    if (t.length < 2) {
      setResultados(null);
      setBuscando(false);
      return;
    }
    const n = ++pedido.current;
    setBuscando(true);
    const espera = window.setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('buscar', { p_causa: causaId, p_texto: t, p_limite: 40 });
      if (n !== pedido.current) return;
      setBuscando(false);
      if (err) {
        setError(err.message);
        setResultados([]);
      } else {
        setError(null);
        setResultados(data as Resultado[]);
        setActivo(0);
      }
    }, 180);
    return () => window.clearTimeout(espera);
  }, [texto, causaId]);

  /** Resultados en el orden en que se muestran (agrupados), para moverse con las flechas. */
  const ordenados = useMemo(() => {
    if (!resultados) return [];
    return GRUPOS.flatMap((g) => resultados.filter((r) => r.tipo === g.tipo).map((r) => ({ ...r, grupo: g })));
  }, [resultados]);

  function ir(i: number) {
    const r = ordenados[i];
    if (!r?.grupo.ruta) return;
    guardarReciente(texto.trim());
    onCambiar(false);
    setTexto('');
    navegar(`/causa/${causaId}/${r.grupo.ruta(r.id)}`);
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, ordenados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ir(activo);
    }
  }

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  let indice = -1;

  return (
    <RadixDialog.Root open={abierta} onOpenChange={onCambiar}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={s.fondo} />
        <RadixDialog.Content className={s.caja} aria-describedby={undefined}>
          <RadixDialog.Title className="visualmente-oculto">Buscar en toda la causa</RadixDialog.Title>
          <div className={s.entrada}>
            {buscando ? <LoaderCircle aria-hidden className={s.girando} /> : <Search aria-hidden />}
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={tecla}
              placeholder="Buscá un Nº de efecto, un nombre, un teléfono, una palabra…"
              aria-label="Buscar en toda la causa"
              aria-controls="resultados-busqueda"
              aria-activedescendant={ordenados.length ? `resultado-${activo}` : undefined}
            />
            <kbd>Esc</kbd>
          </div>

          <div className={s.lista} ref={lista} id="resultados-busqueda" role="listbox" aria-label="Resultados">
            {!resultados ? (
              <div className={s.ayuda}>
                {recientes.length > 0 && (
                  <div className={s.recientes}>
                    <span className="rotulo">Búsquedas recientes</span>
                    <div className={s.chips}>
                      {recientes.map((r) => (
                        <button key={r} type="button" onClick={() => setTexto(r)}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p>
                  Busca a la vez en el índice, los efectos y el directorio. Encuentra a una persona por el teléfono o por cómo la tenían agendada, y
                  no distingue tildes ni mayúsculas.
                </p>
              </div>
            ) : error ? (
              <p className={s.nada}>No se pudo buscar: {error}</p>
            ) : ordenados.length === 0 ? (
              <p className={s.nada}>Nada coincide con «{texto.trim()}». Probá con menos palabras o con otra forma de escribirlo.</p>
            ) : (
              GRUPOS.map((g) => {
                const del = ordenados.filter((r) => r.tipo === g.tipo);
                if (!del.length) return null;
                return (
                  <div key={g.tipo} className={s.grupo} role="group" aria-label={g.titulo}>
                    <div className={s.grupoTitulo}>
                      {g.icono}
                      {g.titulo}
                      <span>{del.length}</span>
                    </div>
                    {del.map((r) => {
                      indice++;
                      const i = indice;
                      return (
                        <button
                          key={`${r.tipo}-${r.id}-${i}`}
                          id={`resultado-${i}`}
                          data-indice={i}
                          type="button"
                          role="option"
                          aria-selected={i === activo}
                          className={`${s.resultado} ${i === activo ? s.activo : ''}`}
                          onMouseMove={() => setActivo(i)}
                          onClick={() => ir(i)}
                          disabled={!g.ruta}
                          title={g.ruta ? undefined : 'Esta sección todavía no se abre desde la búsqueda'}
                        >
                          <span className={s.resultadoTitulo}>{r.titulo}</span>
                          {r.detalle && <span className={s.resultadoDetalle}>{detalleLegible(r)}</span>}
                          {r.fragmento && r.fragmento !== r.titulo && (
                            <span className={s.fragmento}>
                              <Resaltado texto={r.fragmento} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          <div className={s.pie}>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> moverse
            </span>
            <span>
              <kbd>Enter</kbd> abrir
            </span>
            <span className={s.pieDerecha}>
              <kbd>Ctrl</kbd>
              <kbd>K</kbd> desde cualquier pantalla
            </span>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
