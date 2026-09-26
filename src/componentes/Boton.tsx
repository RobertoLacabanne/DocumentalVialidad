import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import s from './Boton.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'secundario' | 'primario' | 'fantasma' | 'peligro';
  tamano?: 'normal' | 'chico';
  icono?: ReactNode;
  cargando?: boolean;
  hecho?: boolean;
  soloIcono?: boolean;
};

export const Boton = forwardRef<HTMLButtonElement, Props>(function Boton(
  { variante = 'secundario', tamano = 'normal', icono, cargando, hecho, soloIcono, className, children, disabled, type = 'button', ...resto },
  ref,
) {
  const clases = [
    s.boton,
    variante !== 'secundario' && s[variante],
    tamano === 'chico' && s.chico,
    soloIcono && s.soloIcono,
    hecho && s.hecho,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={clases} disabled={disabled || cargando} aria-busy={cargando || undefined} {...resto}>
      {cargando ? <LoaderCircle className={s.girando} aria-hidden /> : icono}
      {children}
    </button>
  );
});

/** Clases de botón para usar en un enlace <a> (por ejemplo, "Abrir en Drive"). */
export function clasesBoton(variante: 'secundario' | 'primario' | 'fantasma' | 'peligro' = 'secundario', tamano: 'normal' | 'chico' = 'normal') {
  return [s.boton, variante !== 'secundario' && s[variante], tamano === 'chico' && s.chico].filter(Boolean).join(' ');
}
