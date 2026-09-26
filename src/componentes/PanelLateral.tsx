import { PanelRightClose } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Boton } from './Boton';
import s from './PanelLateral.module.css';

/** Panel lateral para la ficha. Se cierra con Esc o con el botón. */
export function PanelLateral({
  etiqueta,
  encabezado,
  children,
  onCerrar,
}: {
  etiqueta: string;
  encabezado: ReactNode;
  children: ReactNode;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <>
      <div className={s.fondo} onClick={onCerrar} aria-hidden />
      <aside ref={ref} className={s.panel} aria-label={etiqueta}>
        <div className={s.cabecera}>
          {encabezado}
        </div>
        <div className={s.cuerpo}>{children}</div>
      </aside>
    </>
  );
}

export function FilaPanel({ children }: { children: ReactNode }) {
  return <div className={s.fila}>{children}</div>;
}

export function CerrarPanel({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Boton variante="fantasma" soloIcono tamano="chico" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar la ficha (Esc)" title="Cerrar (Esc)">
      <PanelRightClose aria-hidden />
    </Boton>
  );
}
