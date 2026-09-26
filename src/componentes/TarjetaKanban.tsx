import { FileText, Smartphone } from 'lucide-react';
import type { DragEvent, ReactNode } from 'react';
import { SITUACIONES } from '../lib/etiquetas';
import type { SituacionProcesal } from '../lib/tipos';
import { Avatar, Chip, EtiquetaEfecto, Falta } from './marcas';
import s from './TarjetaKanban.module.css';

/** Tarjeta de efecto para el tablero por estado. Se arrastra entre columnas. */
export function TarjetaKanban({
  id,
  numero,
  soporte,
  material,
  descripcion,
  fojas,
  responsable,
  sinEscribiente,
  situacion,
  prioridadAlta,
  seleccionada,
  piezas,
  onAbrir,
}: {
  id?: string;
  numero: string;
  soporte?: 'papel' | 'digital' | null;
  material: string | null;
  descripcion: string | null;
  fojas: number | null;
  responsable: { alias: string; email: string | null } | null;
  sinEscribiente?: boolean;
  situacion: SituacionProcesal | null;
  prioridadAlta?: boolean;
  seleccionada?: boolean;
  piezas?: number;
  onAbrir?: () => void;
}) {
  let pie: ReactNode = <span className={`${s.semaforo} ${s.semaforoLimpio}`}>Sin incidencias</span>;
  if (situacion) pie = <span className={`${s.semaforo} ${s.semaforoAlerta}`}>{SITUACIONES[situacion]}</span>;
  const arrastrar = (e: DragEvent<HTMLButtonElement>) => {
    if (!id) return;
    e.dataTransfer.setData('text/efecto', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <button
      type="button"
      className={`${s.tarjeta} ${situacion ? s.conAlerta : ''} ${seleccionada ? s.seleccionada : ''}`}
      onClick={onAbrir}
      draggable={Boolean(id)}
      onDragStart={arrastrar}
      data-efecto={numero}
    >
      <span className={s.arriba}>
        <EtiquetaEfecto numero={numero} />
        {soporte && (
          <span className={s.soporte} title={soporte === 'papel' ? 'Documentación en papel' : 'Dispositivo'}>
            {soporte === 'papel' ? <FileText aria-hidden /> : <Smartphone aria-hidden />}
          </span>
        )}
        {prioridadAlta && <span className={s.prioridad}>Prioridad alta</span>}
      </span>
      {material ? <Chip familia={soporte === 'digital' ? 'pericial' : 'documental'}>{material}</Chip> : null}
      <span className={s.descripcion}>{descripcion || <Falta texto="[descripción según acta]" />}</span>
      <span className={s.abajo}>
        {pie}
        <span className="cifras">{piezas ? `${piezas} ${piezas === 1 ? 'pieza' : 'piezas'}` : fojas != null ? `${fojas} fs.` : ''}</span>
        {responsable ? (
          <Avatar texto={responsable.alias} email={responsable.email ?? responsable.alias} tamano="chico" titulo={responsable.alias} />
        ) : sinEscribiente ? (
          <span title="No requiere escribiente">—</span>
        ) : (
          <span className={s.sinAsignar}>Sin asignar</span>
        )}
      </span>
    </button>
  );
}
