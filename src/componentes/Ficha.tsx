import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { valorLegible } from '../lib/etiquetas';
import { Boton } from './Boton';
import { claseControl } from './campos';
import s from './Ficha.module.css';

export function Seccion({
  titulo,
  naturaleza,
  children,
}: {
  titulo: string;
  naturaleza?: 'dato' | 'interpretacion';
  children: ReactNode;
}) {
  return (
    <section className={`${s.seccion} ${naturaleza === 'interpretacion' ? s.interpretacion : ''}`} aria-label={titulo}>
      <h4 className={s.seccionTitulo}>
        {titulo}
        {naturaleza === 'dato' && <span className={`${s.naturaleza} ${s.natDato}`}>dato objetivo</span>}
        {naturaleza === 'interpretacion' && <span className={`${s.naturaleza} ${s.natInterpretacion}`}>interpretación</span>}
      </h4>
      {children}
    </section>
  );
}

export function Datos({ children }: { children: ReactNode }) {
  return <dl className={s.datos}>{children}</dl>;
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <>
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function Nada() {
  return <span className={s.nada}>—</span>;
}

export function Parrafo({ children }: { children: ReactNode }) {
  return <p className={s.parrafo}>{children}</p>;
}

export function TextoInterpretacion({ children }: { children: ReactNode }) {
  return <p className={s.textoInterpretacion}>{children}</p>;
}

export type ResultadoCampo = { tipo: 'ok' } | { tipo: 'conflicto'; actual: unknown; quien: string } | { tipo: 'error'; mensaje: string };

type Opcion = { valor: string; etiqueta: string };

/**
 * Campo que se guarda solo. Guarda al salir del campo (texto) o al elegir (opciones, fechas).
 * Si otra persona cambió el mismo campo mientras tanto, no pisa: muestra qué cambió y deja elegir.
 */
export function CampoEditable({
  campo,
  etiqueta,
  valor,
  tipo = 'texto',
  opciones,
  permitirVacio = true,
  interpretacion,
  ayuda,
  onGuardar,
}: {
  campo: string;
  etiqueta: string;
  valor: string | null;
  tipo?: 'texto' | 'textoLargo' | 'fecha' | 'opciones';
  opciones?: Opcion[];
  permitirVacio?: boolean;
  interpretacion?: boolean;
  ayuda?: string;
  onGuardar: (nuevo: string | null, anterior: string | null) => Promise<ResultadoCampo>;
}) {
  const id = useId();
  const [borrador, setBorrador] = useState(valor ?? '');
  const [enfocado, setEnfocado] = useState(false);
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto');
  const [conflicto, setConflicto] = useState<{ actual: unknown; quien: string; mio: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = useRef<string | null>(valor);

  // Si el valor cambia en el servidor y no estoy escribiendo, me actualizo.
  useEffect(() => {
    if (!enfocado && !conflicto) {
      setBorrador(valor ?? '');
      base.current = valor;
    }
  }, [valor, enfocado, conflicto]);

  const normalizar = (v: string) => (v.trim() === '' ? null : tipo === 'textoLargo' ? v : v.trim());

  async function guardar(texto: string, anterior: string | null) {
    const nuevo = normalizar(texto);
    if (nuevo === anterior) return;
    if (nuevo === null && !permitirVacio) {
      setError('Este dato no puede quedar vacío.');
      setBorrador(anterior ?? '');
      return;
    }
    setError(null);
    setEstado('guardando');
    const r = await onGuardar(nuevo, anterior);
    if (r.tipo === 'ok') {
      base.current = nuevo;
      setConflicto(null);
      setEstado('guardado');
      window.setTimeout(() => setEstado((e) => (e === 'guardado' ? 'quieto' : e)), 2400);
    } else if (r.tipo === 'conflicto') {
      setEstado('quieto');
      setConflicto({ actual: r.actual, quien: r.quien, mio: nuevo });
    } else {
      setEstado('quieto');
      setError(r.mensaje);
    }
  }

  const alEnfocar = () => {
    setEnfocado(true);
    base.current = valor;
  };
  const alSalir = () => {
    setEnfocado(false);
    if (tipo === 'texto' || tipo === 'textoLargo') void guardar(borrador, base.current);
  };

  const control =
    tipo === 'opciones' ? (
      <select
        id={id}
        className={claseControl}
        value={borrador}
        onFocus={alEnfocar}
        onBlur={() => setEnfocado(false)}
        onChange={(e) => {
          setBorrador(e.target.value);
          void guardar(e.target.value, base.current);
        }}
      >
        {permitirVacio && <option value="">Sin definir</option>}
        {opciones?.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    ) : tipo === 'fecha' ? (
      <input
        id={id}
        type="date"
        className={claseControl}
        value={borrador}
        onFocus={alEnfocar}
        onBlur={() => setEnfocado(false)}
        onChange={(e) => {
          setBorrador(e.target.value);
          void guardar(e.target.value, base.current);
        }}
      />
    ) : tipo === 'textoLargo' ? (
      <textarea
        id={id}
        className={claseControl}
        value={borrador}
        rows={4}
        onFocus={alEnfocar}
        onBlur={alSalir}
        onChange={(e) => setBorrador(e.target.value)}
      />
    ) : (
      <input
        id={id}
        className={claseControl}
        value={borrador}
        onFocus={alEnfocar}
        onBlur={alSalir}
        onChange={(e) => setBorrador(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setBorrador(base.current ?? '');
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    );

  return (
    <div className={`${s.campo} ${interpretacion ? s.interpretacionCampo : ''}`} data-campo={campo}>
      <div className={s.campoCabecera}>
        <label className={s.campoEtiqueta} htmlFor={id}>
          {etiqueta}
        </label>
        <span className={`${s.campoEstado} ${estado === 'guardado' ? s.campoGuardado : ''}`} aria-live="polite">
          {estado === 'guardando' && (
            <>
              <LoaderCircle className={s.girando} aria-hidden /> Guardando
            </>
          )}
          {estado === 'guardado' && (
            <>
              <Check aria-hidden /> Guardado
            </>
          )}
        </span>
      </div>
      {control}
      {ayuda && !error && !conflicto && <span className={s.campoEstado}>{ayuda}</span>}
      {error && (
        <span className={s.campoEstado} style={{ color: 'var(--color-peligro-texto)' }} role="alert">
          {error}
        </span>
      )}
      {conflicto && (
        <div className={s.conflicto} role="alert">
          <span>
            <strong>{conflicto.quien}</strong> cambió este campo mientras lo editabas. Ahora dice:{' '}
            <strong>{valorLegible(campo, conflicto.actual)}</strong>. Tu cambio todavía no se guardó.
          </span>
          <div className={s.conflictoAcciones}>
            <Boton
              tamano="chico"
              variante="primario"
              onClick={() => void guardar(conflicto.mio ?? '', (conflicto.actual as string | null) ?? null)}
            >
              Guardar el mío igual
            </Boton>
            <Boton
              tamano="chico"
              onClick={() => {
                const actual = (conflicto.actual as string | null) ?? null;
                base.current = actual;
                setBorrador(actual ?? '');
                setConflicto(null);
              }}
            >
              Quedarme con el de {conflicto.quien}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
