import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import s from './campos.module.css';

type Envoltura = { etiqueta?: ReactNode; ayuda?: ReactNode; error?: ReactNode };

function Grupo({ id, etiqueta, ayuda, error, children }: Envoltura & { id: string; children: ReactNode }) {
  return (
    <div className={s.grupo}>
      {etiqueta && (
        <label className={s.etiqueta} htmlFor={id}>
          {etiqueta}
        </label>
      )}
      {children}
      {error ? <span className={s.error}>{error}</span> : ayuda ? <span className={s.ayuda}>{ayuda}</span> : null}
    </div>
  );
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Envoltura>(function Entrada(
  { etiqueta, ayuda, error, id, className, ...resto },
  ref,
) {
  const auto = useId();
  const idFinal = id ?? auto;
  return (
    <Grupo id={idFinal} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <input ref={ref} id={idFinal} className={[s.control, className].filter(Boolean).join(' ')} aria-invalid={error ? true : undefined} {...resto} />
    </Grupo>
  );
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Envoltura>(function AreaTexto(
  { etiqueta, ayuda, error, id, className, ...resto },
  ref,
) {
  const auto = useId();
  const idFinal = id ?? auto;
  return (
    <Grupo id={idFinal} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <textarea ref={ref} id={idFinal} className={[s.control, className].filter(Boolean).join(' ')} aria-invalid={error ? true : undefined} {...resto} />
    </Grupo>
  );
});

export const Selector = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Envoltura>(function Selector(
  { etiqueta, ayuda, error, id, className, children, ...resto },
  ref,
) {
  const auto = useId();
  const idFinal = id ?? auto;
  return (
    <Grupo id={idFinal} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <select ref={ref} id={idFinal} className={[s.control, className].filter(Boolean).join(' ')} aria-invalid={error ? true : undefined} {...resto}>
        {children}
      </select>
    </Grupo>
  );
});

export const claseControl = s.control;
