import type { ReactNode } from 'react';
import { SITUACIONES } from '../lib/etiquetas';
import type { SituacionProcesal } from '../lib/tipos';
import { Avatar, Chip, EtiquetaEfecto, Falta } from './marcas';
import s from './TarjetaKanban.module.css';

/** Tarjeta de efecto para el tablero por estado. */
export function TarjetaKanban({
  numero,
  material,
  descripcion,
  fojas,
  responsable,
  situacion,
  prioridadAlta,
  onAbrir,
}: {
  numero: string;
  material: string | null;
  descripcion: string | null;
  fojas: number | null;
  responsable: { alias: string; email: string } | null;
  situacion: SituacionProcesal | null;
  prioridadAlta?: boolean;
  onAbrir?: () => void;
}) {
  let pie: ReactNode = <span className={`${s.semaforo} ${s.semaforoLimpio}`}>Sin incidencias</span>;
  if (situacion) pie = <span className={`${s.semaforo} ${s.semaforoAlerta}`}>{SITUACIONES[situacion]}</span>;
  return (
    <button type="button" className={`${s.tarjeta} ${situacion ? s.conAlerta : ''}`} onClick={onAbrir}>
      <span className={s.arriba}>
        <EtiquetaEfecto numero={numero} />
        {prioridadAlta && <span className={s.prioridad}>Prioridad alta</span>}
      </span>
      {material ? <Chip familia="documental">{material}</Chip> : null}
      <span className={s.descripcion}>{descripcion || <Falta texto="[descripción según acta]" />}</span>
      <span className={s.abajo}>
        {pie}
        <span>{fojas != null ? `${fojas} fs. aprox.` : 'fs. —'}</span>
        {responsable ? <Avatar texto={responsable.alias} email={responsable.email} tamano="chico" /> : <span>Sin asignar</span>}
      </span>
    </button>
  );
}
