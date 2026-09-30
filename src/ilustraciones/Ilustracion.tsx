import type { CSSProperties } from 'react';
import { ILUSTRACIONES, type IdIlustracion } from './catalogo';

/**
 * Una ilustración de la serie. Es decorativa: no lleva texto ni dice nada que no diga ya la pantalla,
 * así que va sin descripción y oculta para los lectores de pantalla.
 * `prioridad` es solo para lo que se ve apenas se abre la página (el panorama del Acceso).
 */
export function Ilustracion({
  id,
  className,
  style,
  prioridad = false,
}: {
  id: IdIlustracion;
  className?: string;
  style?: CSSProperties;
  prioridad?: boolean;
}) {
  const d = ILUSTRACIONES[id];
  const base = `/ilustraciones/${d.archivo}`;
  return (
    <img
      className={className}
      style={style}
      src={`${base}.webp`}
      srcSet={`${base}.webp 1x, ${base}@2x.webp 2x`}
      width={d.ancho}
      height={d.alto}
      alt=""
      aria-hidden
      decoding="async"
      loading={prioridad ? 'eager' : 'lazy'}
      fetchPriority={prioridad ? 'high' : undefined}
      draggable={false}
    />
  );
}
