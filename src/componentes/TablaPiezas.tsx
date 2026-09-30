import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { RELEVANCIAS } from '../lib/etiquetas';
import { compararOrden, nivelOrden } from '../lib/orden';
import { fechaConPrecision } from '../lib/tiempo';
import type { EstadoProcesalPieza, Pieza } from '../lib/tipos';
import { Avatar, ChipTipo, EstadoProcesal, EtiquetaEfecto, Relevancia, Sello } from './marcas';
import s from './TablaPiezas.module.css';

export type FilaIndice = Pieza & {
  efecto_numero: string | null;
  informe_numero: string | null;
  situacion: EstadoProcesalPieza | null;
  responsable_alias: string | null;
};

export type PersonaViendo = { alias: string; email: string };

const col = createColumnHelper<FilaIndice>();

const PRECISION_VISIBLE: Record<string, string> = { mes: 'mes', anio: 'año', aproximada: 'aproximada' };

export function TablaPiezas({
  filas,
  seleccionada,
  onSeleccionar,
  densidad = 'comoda',
  viendo = {},
  recienLlegadas = new Set<string>(),
}: {
  filas: FilaIndice[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
  densidad?: 'comoda' | 'compacta';
  viendo?: Record<string, PersonaViendo[]>;
  recienLlegadas?: Set<string>;
}) {
  const [orden, setOrden] = useState<SortingState>([{ id: 'numero', desc: false }]);

  const columnas = useMemo(
    () => [
      col.accessor('numero_orden', {
        id: 'numero',
        header: 'Nº',
        sortingFn: (a, b) => compararOrden(a.original.numero_orden, b.original.numero_orden),
      }),
      col.accessor('tipo', { id: 'tipo', header: 'Tipo', enableSorting: false }),
      col.accessor('titulo', {
        id: 'titulo',
        header: 'Título / asunto',
        sortingFn: (a, b) => a.original.titulo.localeCompare(b.original.titulo, 'es'),
      }),
      col.accessor('fecha_desde', {
        id: 'fecha',
        header: 'Fecha',
        sortUndefined: 'last',
        sortingFn: (a, b) => (a.original.fecha_desde ?? '9999').localeCompare(b.original.fecha_desde ?? '9999'),
      }),
      col.accessor('efecto_numero', { id: 'origen', header: 'Origen', enableSorting: false }),
      col.accessor((f) => f.situacion?.gravedad ?? 0, {
        id: 'procesal',
        header: 'Estado procesal',
        sortDescFirst: true,
      }),
      col.accessor((f) => RELEVANCIAS.find((r) => r.valor === f.relevancia)?.barras ?? -1, {
        id: 'relevancia',
        header: 'Relevancia',
        sortDescFirst: true,
      }),
      col.accessor('responsable', { id: 'responsable', header: 'Resp.', enableSorting: false }),
    ],
    [],
  );

  const tabla = useReactTable({
    data: filas,
    columns: columnas,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (f) => f.id,
  });

  const filasOrdenadas = tabla.getRowModel().rows;
  const marco = useRef<HTMLDivElement>(null);
  const alturaCabecera = 35;

  const virtual = useVirtualizer({
    count: filasOrdenadas.length,
    getScrollElement: () => marco.current,
    estimateSize: () => (densidad === 'compacta' ? 36 : 62),
    overscan: 12,
    scrollMargin: alturaCabecera,
    getItemKey: (i) => filasOrdenadas[i]?.id ?? i,
  });

  useEffect(() => {
    virtual.measure();
  }, [densidad, virtual]);

  const indiceSeleccionado = filasOrdenadas.findIndex((f) => f.id === seleccionada);

  function moverSeleccion(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const siguiente = Math.min(
      filasOrdenadas.length - 1,
      Math.max(0, (indiceSeleccionado < 0 ? -1 : indiceSeleccionado) + (e.key === 'ArrowDown' ? 1 : -1)),
    );
    const fila = filasOrdenadas[siguiente];
    if (!fila) return;
    onSeleccionar(fila.id);
    virtual.scrollToIndex(siguiente, { align: 'auto' });
    window.requestAnimationFrame(() => {
      marco.current?.querySelector<HTMLElement>(`[data-id="${fila.id}"]`)?.focus();
    });
  }

  return (
    <div
      ref={marco}
      className={`${s.marco} ${densidad === 'compacta' ? s.compacta : ''}`}
      role="grid"
      aria-label="Índice de prueba"
      aria-rowcount={filasOrdenadas.length}
      onKeyDown={moverSeleccion}
    >
      <div className={s.cabecera} role="row">
        {tabla.getHeaderGroups()[0].headers.map((h) => {
          const puede = h.column.getCanSort();
          const sentido = h.column.getIsSorted();
          return (
            <div
              key={h.id}
              role="columnheader"
              aria-sort={sentido === 'asc' ? 'ascending' : sentido === 'desc' ? 'descending' : undefined}
              className={`${puede ? s.ordenable : ''} ${sentido ? s.ordenActivo : ''}`}
              onClick={puede ? h.column.getToggleSortingHandler() : undefined}
              title={puede ? 'Ordenar' : undefined}
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
              {sentido && <ArrowUp aria-hidden style={{ transform: sentido === 'desc' ? 'rotate(180deg)' : undefined }} />}
            </div>
          );
        })}
      </div>

      <div className={s.cuerpo} style={{ height: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map((item) => {
          const fila = filasOrdenadas[item.index];
          if (!fila) return null;
          const p = fila.original;
          const nivel = nivelOrden(p.numero_orden);
          const quienes = viendo[p.id] ?? [];
          const fecha = fechaConPrecision(p.fecha_desde, p.fecha_precision);
          const tieneOrigen = Boolean(p.efecto_numero || p.informe_numero || p.sobre || p.fojas);
          const clases = [
            s.fila,
            p.id === seleccionada && s.seleccionada,
            p.situacion && s.alerta,
            recienLlegadas.has(p.id) && s.nueva,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={item.key}
              data-index={item.index}
              data-id={p.id}
              ref={virtual.measureElement}
              role="row"
              aria-selected={p.id === seleccionada}
              tabIndex={p.id === seleccionada || (indiceSeleccionado < 0 && item.index === 0) ? 0 : -1}
              className={clases}
              style={{ transform: `translateY(${item.start - virtual.options.scrollMargin}px)` }}
              onClick={() => onSeleccionar(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSeleccionar(p.id);
                }
              }}
            >
              <div role="gridcell" className={`${s.celda} ${s.numero}`} data-area="num">
                {nivel > 0 && <span className={s.rama} style={{ marginLeft: (nivel - 1) * 14 }} aria-hidden />}
                <Sello numero={p.numero_orden} />
              </div>
              <div role="gridcell" className={s.celda} data-area="tipo">
                <ChipTipo tipo={p.tipo} esMensaje={Boolean(p.mensaje_id)} />
              </div>
              <div role="gridcell" className={s.celda} data-area="tit">
                <div className={s.titulo}>{p.titulo}</div>
                {(p.autor || p.destinatarios) && (
                  <div className={s.sub}>
                    {p.autor ?? '¿?'}
                    {p.destinatarios ? ` → ${p.destinatarios}` : ''}
                  </div>
                )}
                {quienes.length > 0 && (
                  <div className={s.viendo}>
                    {quienes.slice(0, 3).map((q) => (
                      <Avatar key={q.email} texto={q.alias} email={q.email} tamano="chico" />
                    ))}
                    {quienes.map((q) => q.alias).join(', ')} {quienes.length === 1 ? 'está viendo' : 'están viendo'}
                  </div>
                )}
              </div>
              <div role="gridcell" className={`${s.celda} ${s.cifras}`} data-area="fecha" data-vacio={!fecha}>
                {fecha || <span className={s.nada}>—</span>}
                {fecha && PRECISION_VISIBLE[p.fecha_precision] && (
                  <span className={s.precision}>{PRECISION_VISIBLE[p.fecha_precision]}</span>
                )}
              </div>
              <div role="gridcell" className={s.celda} data-area="orig" data-vacio={!tieneOrigen}>
                {tieneOrigen ? (
                  <div className={s.origen}>
                    {p.efecto_numero && <EtiquetaEfecto numero={p.efecto_numero} />}
                    {(p.sobre || p.fojas) && (
                      <span className={s.detalle}>
                        {[p.sobre && `Sobre ${p.sobre}`, p.fojas && `fs. ${p.fojas}`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {p.informe_numero && <span className={s.detalle}>Informe {p.informe_numero}</span>}
                  </div>
                ) : (
                  <span className={s.nada}>—</span>
                )}
              </div>
              <div role="gridcell" className={s.celda} data-area="proc" data-vacio={!p.situacion}>
                {p.situacion ? (
                  <EstadoProcesal situacion={p.situacion.situacion} detalle={p.situacion.titulo} />
                ) : (
                  <span className={s.nada}>—</span>
                )}
              </div>
              <div role="gridcell" className={s.celda} data-area="rel">
                <Relevancia valor={p.relevancia} />
              </div>
              <div role="gridcell" className={s.celda} data-area="resp" data-vacio={!p.responsable}>
                {p.responsable ? (
                  <Avatar texto={p.responsable_alias ?? p.responsable} email={p.responsable} />
                ) : (
                  <span className={s.nada}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
