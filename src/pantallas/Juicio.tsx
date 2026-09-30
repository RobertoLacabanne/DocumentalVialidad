import * as Menu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Download, FileSpreadsheet, FileText, Gavel, ListOrdered, Plus, Search, TriangleAlert, UserRound } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { EstadoProcesal, Sello } from '../componentes/marcas';
import sm from '../componentes/Menu.module.css';
import { useToast } from '../componentes/Toast';
import { usePersonas } from '../datos/causa';
import { useIndice } from '../datos/consultas';
import { traducirError } from '../datos/guardado';
import { useOfrecimiento, type ItemVista } from '../datos/juicio';
import { useYo } from '../datos/sesion';
import { descargarXlsx, nombreArchivo, type Columna } from '../lib/exportar';
import { fechaCorta } from '../lib/informe';
import { ACUERDOS, CLASES, INCORPORACIONES, alertasDe, citaDe, descripcionDe, esDePersona, ordenarItems, referenciaDe, type Alerta } from '../lib/ofrecimiento';
import { contiene } from '../lib/resaltar';
import { supabase } from '../lib/supabase';
import { CabeceraCausa } from './CabeceraCausa';
import { AgregarPersonas, AgregarPiezas, ListadoPrueba, OtraPrueba } from './DialogosJuicio';
import { FichaOfrecimiento } from './FichaOfrecimiento';
import { useCausaActual } from './Marco';
import s from './Juicio.module.css';
import si from './Indice.module.css';

type Filtro = Alerta['tipo'] | null;
const FILTROS: { tipo: Alerta['tipo']; etiqueta: string; grave?: boolean }[] = [
  { tipo: 'procesal', etiqueta: 'con problema procesal', grave: true },
  { tipo: 'rechazada', etiqueta: 'rechazadas en el auto', grave: true },
  { tipo: 'introduce', etiqueta: 'sin quién la introduce' },
  { tipo: 'entrega', etiqueta: 'sin entregar a la defensa' },
  { tipo: 'impugnada', etiqueta: 'impugnadas' },
];

export function Juicio() {
  const { causa } = useCausaActual();
  const yo = useYo();
  const { avisar } = useToast();
  const { filas: piezas } = useIndice(causa.id, yo.user_id);
  const { filas: personas } = usePersonas(causa.id);
  const { items, cargando, error } = useOfrecimiento(causa.id, piezas, personas);
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [texto, setTexto] = useState('');
  const [dialogo, setDialogo] = useState<'piezas' | 'personas' | 'otra' | 'listado' | null>(null);
  const abierto = params.get('item');

  const abrir = (id: string | null) => {
    const nuevos = new URLSearchParams(params);
    if (id) nuevos.set('item', id);
    else nuevos.delete('item');
    setParams(nuevos, { replace: true });
  };

  const conAlertas = useMemo(() => ordenarItems(items).map((i) => ({ item: i, alertas: alertasDe(i) })), [items]);
  const cuenta = (t: Alerta['tipo']) => conAlertas.filter((x) => x.alertas.some((a) => a.tipo === t)).length;
  const visibles = conAlertas.filter(
    (x) => (!filtro || x.alertas.some((a) => a.tipo === filtro)) && (!texto.trim() || contiene(`${x.item.numero ?? ''} ${descripcionDe(x.item) ?? ''} ${x.item.objeto ?? ''}`, texto)),
  );
  const nombres = useMemo(() => new Map(personas.map((p) => [p.id, p.nombre])), [personas]);
  const ofrecidas = useMemo(() => new Set(items.filter((i) => i.pieza_id).map((i) => i.pieza_id!)), [items]);
  const itemAbierto = items.find((i) => i.id === abierto) ?? null;

  async function renumerar(clase: string) {
    const { data, error: err } = await supabase.rpc('renumerar_ofrecimiento', { p_causa: causa.id, p_clase: clase });
    if (err) avisar(traducirError(err.message), { tono: 'error' });
    else avisar(data ? `Se renumeraron ${data} ${data === 1 ? 'ítem' : 'ítems'}.` : 'Los números ya estaban seguidos.');
  }

  const imputadosDe = (i: ItemVista) => (i.todos_los_imputados ? 'Todos' : i.imputados.map((id) => nombres.get(id)).filter(Boolean).join(', '));
  const incorporacionDe = (i: ItemVista) => {
    const base = INCORPORACIONES.find((x) => x.valor === i.incorporacion)?.etiqueta;
    if (!base) return null;
    return i.incorporacion === 'exhibicion' && i.introduce_id ? `${base} con ${nombres.get(i.introduce_id) ?? '¿?'}` : base;
  };

  const columnas: Columna<ItemVista>[] = [
    { titulo: 'PRUEBA', valor: (i) => descripcionDe(i), ancho: 60 },
    { titulo: 'CLASE', valor: (i) => CLASES.find((c) => c.valor === i.clase)?.etiqueta, ancho: 14 },
    { titulo: 'NÚMERO', valor: (i) => i.numero, ancho: 9 },
    { titulo: 'ENTREGADO?', valor: (i) => (esDePersona(i.clase) ? '' : i.entregada_defensa ? `SI${i.fecha_entrega ? ` ${fechaCorta(i.fecha_entrega)}` : ''}` : ''), ancho: 14 },
    { titulo: 'CONSTANCIA', valor: (i) => i.constancia_entrega, ancho: 20 },
    { titulo: 'ACUERDO PROBATORIO', valor: (i) => ACUERDOS.find((a) => a.valor === i.acuerdo_probatorio)?.etiqueta ?? (i.impugnada ? 'Impugnada' : ''), ancho: 14 },
    { titulo: 'SI SE EXHIBE EN DEBATE, QUÉ PIEZAS Y CON QUIÉN', valor: (i) => [incorporacionDe(i), i.partes_a_exhibir].filter(Boolean).join(' · '), ancho: 36 },
    { titulo: 'ESCANEAR?', valor: (i) => (i.requiere_escaneo ? 'Sí' : 'No'), ancho: 10 },
    { titulo: 'OBJETO', valor: (i) => i.objeto, ancho: 36 },
    { titulo: 'IMPUTADO/S VINCULADO/S', valor: imputadosDe, ancho: 24 },
    { titulo: 'UBICACIÓN', valor: (i) => i.ubicacion_fisica, ancho: 22 },
    { titulo: 'Nº SEGÚN AUTO DE REMISIÓN', valor: (i) => (i.admision === 'rechazada' ? 'X' : i.numero_auto), ancho: 14 },
    { titulo: 'PERTINENCIA', valor: (i) => (i.impugnada ? `impugnada${i.motivo_impugnacion ? `: ${i.motivo_impugnacion}` : ''}` : ''), ancho: 30 },
    { titulo: 'OFRECIDA TAMBIÉN POR', valor: (i) => i.tambien_ofrecida_por.join('; '), ancho: 24 },
    { titulo: 'SITUACIÓN PROCESAL', valor: (i) => i.pieza?.incidencia ?? '', ancho: 30 },
    { titulo: 'CITA', valor: (i) => citaDe(i, causa.formato_cita), ancho: 50 },
  ];

  const tecla = (id: string) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrir(id);
    }
  };

  return (
    <div className={`${si.pantalla} ${itemAbierto ? si.conPanel : ''}`}>
      <div className={`${si.principal} ${s.pantalla}`}>
        <CabeceraCausa causa={causa} />
        <div className={si.vista}>
          <div>
            <h2 className={si.titulo}>Preparación del juicio</h2>
            <p className={si.bajada}>El punteo de la prueba para el debate, con lo que falta resolver y los avisos procesales a la vista.</p>
          </div>
          <div className={si.acciones}>
            <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setDialogo('piezas')}>
              Sumar piezas
            </Boton>
            <Boton icono={<UserRound aria-hidden />} onClick={() => setDialogo('personas')}>
              Testigos o peritos
            </Boton>
            <Boton variante="fantasma" icono={<Plus aria-hidden />} onClick={() => setDialogo('otra')}>
              Otra prueba
            </Boton>
            <Menu.Root>
              <Menu.Trigger asChild>
                <Boton icono={<Download aria-hidden />} disabled={!items.length}>
                  Exportar <ChevronDown aria-hidden style={{ width: 14, height: 14 }} />
                </Boton>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content className={sm.contenido} align="end" sideOffset={6}>
                  <Menu.Item className={sm.item} onSelect={() => setDialogo('listado')}>
                    <FileText aria-hidden /> Listado para la remisión (.docx)
                  </Menu.Item>
                  <Menu.Item
                    className={sm.item}
                    onSelect={() => void descargarXlsx(visibles.map((x) => x.item), columnas, nombreArchivo('Punteo de prueba', causa.legajo_fiscalia), 'Punteo')}
                  >
                    <FileSpreadsheet aria-hidden /> Planilla del punteo (Excel)
                  </Menu.Item>
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </div>

        {items.length > 0 && (
          <div className={s.barra}>
            <div className={s.avisos} role="group" aria-label="Filtrar por aviso">
              {FILTROS.map((f) => {
                const n = cuenta(f.tipo);
                return (
                  <button
                    key={f.tipo}
                    type="button"
                    className={`${s.aviso} ${f.grave && n ? s.avisoGrave : ''} ${n ? '' : s.avisoCero}`}
                    aria-pressed={filtro === f.tipo}
                    disabled={!n && filtro !== f.tipo}
                    onClick={() => setFiltro((v) => (v === f.tipo ? null : f.tipo))}
                  >
                    <b className="cifras">{n}</b> {f.etiqueta}
                  </button>
                );
              })}
            </div>
            <label className={`${si.buscar} ${s.buscar}`}>
              <Search aria-hidden />
              <span className="visualmente-oculto">Buscar en el ofrecimiento</span>
              <input type="search" placeholder="Nº, prueba u objeto…" value={texto} onChange={(e) => setTexto(e.target.value)} />
            </label>
          </div>
        )}

        <div className={s.cuerpo}>
          {error ? (
            <div style={{ padding: 'var(--esp-6)' }}>
              <AvisoError titulo="No pudimos traer el ofrecimiento">{error.message}</AvisoError>
            </div>
          ) : cargando ? (
            <FilasEsqueleto filas={6} />
          ) : items.length === 0 ? (
            <div className={s.vacio}>
              <EstadoVacio
                icono={<Gavel />}
                titulo="Todavía no hay prueba ofrecida"
                accion={
                  <div className={si.acciones}>
                    <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setDialogo('piezas')}>
                      Sumar piezas del índice
                    </Boton>
                    <Boton icono={<UserRound aria-hidden />} onClick={() => setDialogo('personas')}>
                      Sumar testigos o peritos
                    </Boton>
                  </div>
                }
              >
                Es el heredero de «Prueba a mostrar en debate con testigos»: número, si se entregó a la defensa, acuerdo probatorio, si se exhibe y con quién, imputados
                vinculados y ubicación. Si una pieza tiene la admisibilidad cuestionada, se avisa antes de sumarla.
              </EstadoVacio>
            </div>
          ) : (
            <div className={s.marco}>
              {CLASES.map((c) => {
                const deLaClase = visibles.filter((x) => x.item.clase === c.valor);
                const total = items.filter((i) => i.clase === c.valor).length;
                if (!total) return null;
                return (
                  <section key={c.valor} className={s.grupo} aria-label={c.etiqueta}>
                    <header className={s.grupoCabecera}>
                      <h3>{c.etiqueta}</h3>
                      <span className={s.grupoCuenta}>{filtro || texto ? `${deLaClase.length} de ${total}` : total}</span>
                      <Boton tamano="chico" variante="fantasma" icono={<ListOrdered aria-hidden />} onClick={() => void renumerar(c.valor)} title="Numerar 1, 2, 3… en el orden actual">
                        Renumerar
                      </Boton>
                    </header>
                    {deLaClase.length === 0 ? (
                      <p className={s.grupoVacio}>Ninguna con ese aviso.</p>
                    ) : (
                      <div className={s.tablaMarco}>
                        <table className={s.tabla}>
                          <thead>
                            <tr>
                              <th style={{ width: 70 }}>Nº</th>
                              <th>Prueba</th>
                              {!c.persona && <th style={{ width: 110 }}>Entregada</th>}
                              <th style={{ width: 96 }}>Acuerdo</th>
                              <th style={{ width: 190 }}>En el debate</th>
                              <th style={{ width: 150 }}>Imputados</th>
                              <th style={{ width: 110 }}>Auto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deLaClase.map(({ item: i, alertas }) => {
                              const graves = alertas.filter((a) => a.grave);
                              const leves = alertas.filter((a) => !a.grave);
                              return (
                                <tr
                                  key={i.id}
                                  className={`${s.fila} ${i.id === abierto ? s.filaAbierta : ''} ${graves.length ? s.filaGrave : ''} ${i.admision === 'rechazada' ? s.filaRechazada : ''}`}
                                  tabIndex={0}
                                  onClick={() => abrir(i.id)}
                                  onKeyDown={tecla(i.id)}
                                >
                                  <td data-etiqueta="Nº">
                                    <Sello numero={i.numero} />
                                  </td>
                                  <td data-etiqueta="Prueba" className={s.celdaPrueba}>
                                    <span className={s.descripcion}>{descripcionDe(i) ?? <span className={s.falta}>[completar: descripción]</span>}</span>
                                    <span className={s.detalles}>
                                      {referenciaDe(i) && <span>{referenciaDe(i)}</span>}
                                      {c.persona && (i.objeto ? <span>sobre {i.objeto}</span> : <span className={s.falta}>[completar: sobre qué declara]</span>)}
                                      {i.pieza?.situacion && <EstadoProcesal situacion={i.pieza.situacion} detalle={i.pieza.incidencia ?? undefined} />}
                                      {leves.map((a) => (
                                        <span key={a.tipo} className={s.leve} title={a.texto}>
                                          <TriangleAlert aria-hidden />
                                          {a.tipo === 'introduce' ? 'falta quién la introduce' : a.tipo === 'entrega' ? 'sin entregar' : 'impugnada'}
                                        </span>
                                      ))}
                                    </span>
                                  </td>
                                  {!c.persona && (
                                    <td data-etiqueta="Entregada">
                                      {i.entregada_defensa ? <span className={s.si}>Sí{i.fecha_entrega ? ` · ${fechaCorta(i.fecha_entrega)}` : ''}</span> : <span className={s.no}>No</span>}
                                    </td>
                                  )}
                                  <td data-etiqueta="Acuerdo">{ACUERDOS.find((a) => a.valor === i.acuerdo_probatorio)?.etiqueta ?? <span className={s.tenue}>—</span>}</td>
                                  <td data-etiqueta="En el debate">{incorporacionDe(i) ?? <span className={s.tenue}>Sin definir</span>}</td>
                                  <td data-etiqueta="Imputados">{imputadosDe(i) || <span className={s.tenue}>—</span>}</td>
                                  <td data-etiqueta="Auto">
                                    {i.admision === 'admitida' ? (
                                      <span className={s.si}>Admitida{i.numero_auto ? ` · ${i.numero_auto}` : ''}</span>
                                    ) : i.admision === 'rechazada' ? (
                                      <span className={s.rechazada}>Rechazada</span>
                                    ) : (
                                      <span className={s.tenue}>Pendiente</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <footer className={si.pie}>
          <span>
            {items.length} {items.length === 1 ? 'ítem ofrecido' : 'ítems ofrecidos'} · {items.filter((i) => i.admision === 'admitida').length} admitidos
          </span>
          <span className={si.enVivo}>En vivo: los cambios del equipo aparecen solos</span>
        </footer>
      </div>

      {itemAbierto && <FichaOfrecimiento key={itemAbierto.id} item={itemAbierto} personas={personas} formatoCita={causa.formato_cita} onCerrar={() => abrir(null)} />}

      <AgregarPiezas key={`p-${dialogo === 'piezas'}`} abierto={dialogo === 'piezas'} causaId={causa.id} piezas={piezas} ofrecidas={ofrecidas} onCerrar={() => setDialogo(null)} />
      <AgregarPersonas key={`t-${dialogo === 'personas'}`} abierto={dialogo === 'personas'} causaId={causa.id} personas={personas} ofrecidas={items} onCerrar={() => setDialogo(null)} />
      <OtraPrueba abierto={dialogo === 'otra'} causaId={causa.id} items={items} onCerrar={() => setDialogo(null)} />
      <ListadoPrueba key={`l-${dialogo === 'listado'}`} abierto={dialogo === 'listado'} causa={causa} items={items} personas={personas} onCerrar={() => setDialogo(null)} />
    </div>
  );
}
