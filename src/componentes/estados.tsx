import { CircleAlert, Check, CloudOff, LoaderCircle } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Ilustracion } from '../ilustraciones/Ilustracion';
import type { IdIlustracion } from '../ilustraciones/catalogo';
import { haceCuanto } from '../lib/tiempo';
import s from './estados.module.css';

export function EstadoVacio({
  icono,
  ilustracion,
  titulo,
  children,
  accion,
}: {
  icono: ReactNode;
  /** Viñeta en acuarela que reemplaza al círculo con el ícono. Es decorativa: el texto dice todo. */
  ilustracion?: IdIlustracion;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className={s.vacio}>
      {ilustracion ? (
        <Ilustracion id={ilustracion} className={s.vacioIlustracion} />
      ) : (
        <span className={s.vacioIcono} aria-hidden>
          {icono}
        </span>
      )}
      <h3 className={s.vacioTitulo}>{titulo}</h3>
      {children && <p className={s.vacioTexto}>{children}</p>}
      {accion && <div className={s.vacioAccion}>{accion}</div>}
    </div>
  );
}

export function Esqueleto({ ancho = '100%', alto }: { ancho?: string | number; alto?: number }) {
  const estilo: CSSProperties = { width: ancho, height: alto };
  return <span className={s.esqueleto} style={estilo} aria-hidden />;
}

export function FilasEsqueleto({ filas = 6 }: { filas?: number }) {
  return (
    <div className={s.filasEsqueleto} role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div className={s.filaEsqueleto} key={i}>
          <Esqueleto ancho={44} alto={18} />
          <Esqueleto ancho={120} alto={16} />
          <Esqueleto ancho={`${60 + ((i * 17) % 35)}%`} />
          <Esqueleto ancho={80} />
          <Esqueleto ancho={90} />
        </div>
      ))}
    </div>
  );
}

export function AvisoError({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className={s.error} role="alert">
      <CircleAlert aria-hidden />
      <div>
        <div className={s.errorTitulo}>{titulo}</div>
        {children && <div>{children}</div>}
        {accion && <div style={{ marginTop: 'var(--esp-2)' }}>{accion}</div>}
      </div>
    </div>
  );
}

export type EstadoGuardado =
  | { tipo: 'guardado'; cuando: Date | null }
  | { tipo: 'guardando' }
  | { tipo: 'sin_conexion'; enCola: number }
  | { tipo: 'error'; mensaje: string };

/** "Guardado ✓ hace 2 s". Se actualiza solo cada pocos segundos. */
export function IndicadorGuardado({ estado }: { estado: EstadoGuardado }) {
  const [, refrescar] = useState(0);
  useEffect(() => {
    if (estado.tipo !== 'guardado') return;
    const t = window.setInterval(() => refrescar((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, [estado.tipo]);

  if (estado.tipo === 'guardando') {
    return (
      <span className={`${s.guardado} ${s.guardadoEnCurso}`} role="status">
        <LoaderCircle className={s.girando} aria-hidden />
        Guardando…
      </span>
    );
  }
  if (estado.tipo === 'sin_conexion') {
    return (
      <span className={`${s.guardado} ${s.guardadoSinConexion}`} role="status">
        <CloudOff aria-hidden />
        Sin conexión{estado.enCola > 0 ? ` · ${estado.enCola} ${estado.enCola === 1 ? 'cambio' : 'cambios'} en cola` : ''}
      </span>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <span className={`${s.guardado} ${s.guardadoError}`} role="status" title={estado.mensaje}>
        <CircleAlert aria-hidden />
        No se guardó
      </span>
    );
  }
  return (
    <span className={`${s.guardado} ${s.guardadoOk}`} role="status">
      <Check aria-hidden />
      {estado.cuando ? `Guardado · ${haceCuanto(estado.cuando)}` : 'Todo guardado'}
    </span>
  );
}
