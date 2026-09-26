import { Sparkles, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { MARCADOR_FALTA } from '../lib/cita';
import { RELEVANCIAS, SITUACIONES, inicialesDe, tipoPieza, tonoDe, type Familia } from '../lib/etiquetas';
import type { Relevancia as ValorRelevancia, SituacionProcesal, TipoPieza } from '../lib/tipos';
import s from './marcas.module.css';

const unir = (...clases: (string | false | null | undefined)[]) => clases.filter(Boolean).join(' ');

export function Chip({ familia, children }: { familia: Familia; children: ReactNode }) {
  return <span className={unir(s.chip, s[familia])}>{children}</span>;
}

export function ChipTipo({ tipo, esMensaje }: { tipo: TipoPieza; esMensaje?: boolean }) {
  const t = tipoPieza(tipo);
  const etiqueta = tipo === 'mensaje_conversacion' ? (esMensaje ? 'Mensaje' : 'Conversación') : t.etiqueta;
  return <Chip familia={t.familia}>{etiqueta}</Chip>;
}

/** Número de orden en estilo foliado. */
export function Sello({ numero, grande }: { numero: string | null | undefined; grande?: boolean }) {
  const vacio = !numero;
  return (
    <span className={unir(s.sello, grande && s.selloGrande, vacio && s.selloVacio)} title={vacio ? 'Sin número de orden' : undefined}>
      <i>Nº</i>
      {numero || '—'}
    </span>
  );
}

/** Fojas del expediente, con el mismo sello foliado. */
export function Fojas({ fojas }: { fojas: string | null | undefined }) {
  if (!fojas) return <span className={unir(s.sello, s.selloVacio)} title="Sin fojas"><i>fs.</i>—</span>;
  return (
    <span className={s.sello}>
      <i>fs.</i>
      {fojas}
    </span>
  );
}

/** Número de efecto como etiqueta de secuestro. */
export function EtiquetaEfecto({ numero }: { numero: string | null | undefined }) {
  return <span className={s.efecto}>EF.{numero ? ` ${numero}` : ''}</span>;
}

/** Marcador visible de dato faltante. La app nunca rellena lo que falta. */
export function Falta({ texto = MARCADOR_FALTA }: { texto?: string }) {
  return <span className={s.falta}>{texto}</span>;
}

/** Algo que propuso una máquina y todavía no confirmó una persona. */
export function MarcaSugerencia({ children = 'sugerencia · pendiente de validar' }: { children?: ReactNode }) {
  return (
    <span className={s.sugerencia}>
      <Sparkles aria-hidden />
      {children}
    </span>
  );
}

export function Relevancia({ valor }: { valor: ValorRelevancia | null }) {
  const r = RELEVANCIAS.find((x) => x.valor === valor);
  const barras = r?.barras ?? 0;
  return (
    <span className={unir(s.relevancia, !r && s.sinEvaluar, valor === 'descartada' && s.descartada)}>
      <span className={s.barras} aria-hidden>
        {[1, 2, 3].map((n) => (
          <b key={n} className={n <= barras ? s.llena : undefined} />
        ))}
      </span>
      {r?.etiqueta ?? 'Sin evaluar'}
    </span>
  );
}

export function EstadoProcesal({ situacion, detalle }: { situacion: SituacionProcesal; detalle?: string }) {
  return (
    <span className={unir(s.procesal, s[situacion])} title={detalle}>
      <TriangleAlert aria-hidden />
      {SITUACIONES[situacion]}
    </span>
  );
}

export function Avatar({
  texto,
  email,
  enLinea,
  tamano = 'normal',
  titulo,
}: {
  texto: string;
  email?: string | null;
  enLinea?: boolean;
  tamano?: 'chico' | 'normal' | 'grande';
  titulo?: string;
}) {
  const tono = `tono${tonoDe(email ?? texto)}` as const;
  return (
    <span
      className={unir(s.avatar, s[tono], tamano === 'chico' && s.avatarChico, tamano === 'grande' && s.avatarGrande, enLinea && s.enLinea)}
      title={titulo ?? texto}
      aria-label={titulo ?? texto}
    >
      {inicialesDe(texto)}
    </span>
  );
}

export function PilaAvatares({ children }: { children: ReactNode }) {
  return <span className={s.pila}>{children}</span>;
}
