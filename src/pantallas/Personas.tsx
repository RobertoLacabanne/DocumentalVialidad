import { Building2, Landmark, Plus, Search, Sparkles, UserRound } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { AvisoError, EstadoVacio, FilasEsqueleto } from '../componentes/estados';
import { Chip, EtiquetaEfecto } from '../componentes/marcas';
import { MenuExportar } from '../componentes/MenuExportar';
import { useEfectos, usePersonas, type PersonaVista } from '../datos/causa';
import { ROLES } from '../lib/etiquetas';
import { descargarCsv, descargarXlsx, nombreArchivo, type Columna } from '../lib/exportar';
import { claveNombre, esNombreVacio, mencionaA, nombrePropuesto, tipoSugerido } from '../lib/nombres';
import { CabeceraCausa } from './CabeceraCausa';
import { NuevaPersona, type Propuesta } from './DialogosPersona';
import { FichaPersona, etiquetaIdentificador, etiquetaRol } from './FichaPersona';
import { useCausaActual } from './Marco';
import s from './Personas.module.css';
import se from './Efectos.module.css';
import si from './Indice.module.css';

type Filtros = { texto: string; tipo: string; rol: string };
const SIN_FILTROS: Filtros = { texto: '', tipo: '', rol: '' };
const MAX_SUGERENCIAS = 6;

type Sugerencia = { clave: string; nombre: string; tipo: 'fisica' | 'juridica'; efectos: { id: string; numero: string; como: 'propietario' | 'tenedor' }[] };

export function Personas() {
  const { causa } = useCausaActual();
  const { filas, cargando, error } = usePersonas(causa.id);
  const { filas: efectos } = useEfectos(causa.id);
  const [params, setParams] = useSearchParams();
  const abierta = params.get('persona');
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [creando, setCreando] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  const cambiar = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) => setFiltros((f) => ({ ...f, [clave]: valor }));

  const abrir = (id: string | null) => {
    const nuevos = new URLSearchParams(params);
    if (id) nuevos.set('persona', id);
    else nuevos.delete('persona');
    setParams(nuevos, { replace: true });
  };

  const conteoEfectos = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filas) {
      const clave = claveNombre(p.nombre);
      m.set(p.id, efectos.filter((e) => mencionaA(e.propietario, clave) || mencionaA(e.tenedor, clave)).length);
    }
    return m;
  }, [filas, efectos]);

  /** Nombres que figuran como propietario o tenedor de algún efecto y no están en el directorio. */
  const sugerencias = useMemo<Sugerencia[]>(() => {
    const claves = filas.map((p) => claveNombre(p.nombre));
    const mapa = new Map<string, Sugerencia>();
    for (const e of efectos) {
      for (const como of ['propietario', 'tenedor'] as const) {
        const texto = e[como];
        if (!texto || esNombreVacio(texto)) continue;
        const clave = claveNombre(texto);
        if (claves.some((c) => c === clave || mencionaA(texto, c))) continue;
        const previa = mapa.get(clave) ?? { clave, nombre: nombrePropuesto(texto), tipo: tipoSugerido(texto), efectos: [] };
        if (!previa.efectos.some((x) => x.id === e.id)) previa.efectos.push({ id: e.id, numero: e.numero, como });
        mapa.set(clave, previa);
      }
    }
    return [...mapa.values()].sort((a, b) => b.efectos.length - a.efectos.length || a.nombre.localeCompare(b.nombre, 'es'));
  }, [filas, efectos]);

  const visibles = useMemo(() => {
    const terminos = claveNombre(filtros.texto).split(' ').filter(Boolean);
    const digitos = filtros.texto.replace(/\D/g, '');
    return filas.filter((p) => {
      if (filtros.tipo && p.tipo_persona !== filtros.tipo) return false;
      if (filtros.rol && !p.roles.some((r) => r.rol === filtros.rol)) return false;
      if (terminos.length) {
        const texto = claveNombre([p.nombre, p.cargo, p.observaciones, ...p.identificadores.map((i) => i.valor)].filter(Boolean).join(' '));
        const porTexto = terminos.every((t) => texto.includes(t));
        const porNumero = digitos.length >= 4 && p.identificadores.some((i) => i.valor.replace(/\D/g, '').includes(digitos));
        if (!porTexto && !porNumero) return false;
      }
      return true;
    });
  }, [filas, filtros]);

  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(SIN_FILTROS);
  const personaAbierta = filas.find((p) => p.id === abierta) ?? null;

  const columnas: Columna<PersonaVista>[] = [
    { titulo: 'Nombre o razón social', valor: (p) => p.nombre, ancho: 34 },
    { titulo: 'Tipo', valor: (p) => (p.tipo_persona === 'juridica' ? 'Persona jurídica' : 'Persona humana'), ancho: 16 },
    { titulo: 'Cargo', valor: (p) => p.cargo, ancho: 26 },
    { titulo: 'Rol en la causa', valor: (p) => p.roles.map((r) => etiquetaRol(r.rol)).join(', '), ancho: 22 },
    { titulo: 'Teléfonos', valor: (p) => p.identificadores.filter((i) => i.tipo === 'telefono').map((i) => i.valor).join(', '), ancho: 24 },
    { titulo: 'CUIT / DNI', valor: (p) => p.identificadores.filter((i) => i.tipo === 'cuit' || i.tipo === 'dni').map((i) => i.valor).join(', '), ancho: 18 },
    { titulo: 'Agendado como', valor: (p) => p.identificadores.filter((i) => i.tipo === 'alias_agendado').map((i) => i.valor).join(', '), ancho: 22 },
    { titulo: 'Correo', valor: (p) => p.identificadores.filter((i) => i.tipo === 'email').map((i) => i.valor).join(', '), ancho: 24 },
    { titulo: 'Efectos donde figura (por nombre)', valor: (p) => conteoEfectos.get(p.id) ?? 0, ancho: 14 },
    { titulo: 'Observaciones', valor: (p) => p.observaciones, ancho: 36 },
  ];
  const archivo = nombreArchivo('Personas', causa.legajo_fiscalia);

  const tecla = (id: string) => (ev: KeyboardEvent<HTMLTableRowElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      abrir(id);
    }
  };

  const mostradas = verTodas ? sugerencias : sugerencias.slice(0, MAX_SUGERENCIAS);

  return (
    <div className={`${si.pantalla} ${personaAbierta ? si.conPanel : ''}`}>
      <div className={`${si.principal} ${se.desplazable}`}>
        <CabeceraCausa causa={causa} />

        <div className={si.vista}>
          <div>
            <h2 className={si.titulo}>Personas y empresas</h2>
            <p className={si.bajada}>Quién es quién en la causa, con sus teléfonos, CUIT y cómo figura agendado en los celulares.</p>
          </div>
          <div className={si.acciones}>
            <MenuExportar cantidad={visibles.length} onExcel={() => descargarXlsx(visibles, columnas, archivo, 'Personas')} onCsv={() => descargarCsv(visibles, columnas, archivo)} />
            <Boton
              variante="primario"
              icono={<Plus aria-hidden />}
              onClick={() => {
                setPropuesta(null);
                setCreando(true);
              }}
            >
              Nueva persona o empresa
            </Boton>
          </div>
        </div>

        <div className={si.filtros}>
          <label className={si.buscar}>
            <Search aria-hidden />
            <span className="visualmente-oculto">Buscar en el directorio</span>
            <input type="search" placeholder="Nombre, cargo, teléfono, CUIT…" value={filtros.texto} onChange={(e) => cambiar('texto', e.target.value)} />
          </label>
          <select aria-label="Filtrar por tipo" className={`${si.filtro} ${filtros.tipo ? si.filtroActivo : ''}`} value={filtros.tipo} onChange={(e) => cambiar('tipo', e.target.value)}>
            <option value="">Personas y empresas</option>
            <option value="fisica">Solo personas humanas</option>
            <option value="juridica">Solo personas jurídicas</option>
          </select>
          <select aria-label="Filtrar por rol" className={`${si.filtro} ${filtros.rol ? si.filtroActivo : ''}`} value={filtros.rol} onChange={(e) => cambiar('rol', e.target.value)}>
            <option value="">Rol: todos</option>
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
          {hayFiltros && (
            <button type="button" className={si.limpiar} onClick={() => setFiltros(SIN_FILTROS)}>
              Limpiar filtros
            </button>
          )}
        </div>

        <div className={se.contenido}>
          {sugerencias.length > 0 && !hayFiltros && (
            <section className={s.sugerencias} aria-label="Sugerencias para el directorio">
              <div className={s.sugerenciasCabecera}>
                <Sparkles aria-hidden />
                <div>
                  <h3 className={s.sugerenciasTitulo}>
                    {sugerencias.length === 1 ? 'Un nombre aparece' : `${sugerencias.length} nombres aparecen`} en los efectos y todavía no {sugerencias.length === 1 ? 'está' : 'están'} en el directorio
                  </h3>
                  <p className={s.sugerenciasBajada}>Salen de las columnas Propietario y Tenedor. Revisá cada uno antes de agregarlo: el tipo es una sugerencia.</p>
                </div>
              </div>
              <ul className={s.sugerenciasLista}>
                {mostradas.map((g) => (
                  <li key={g.clave} className={s.sugerencia}>
                    <span className={`${s.icono} ${g.tipo === 'juridica' ? s.iconoJuridica : ''}`} aria-hidden>
                      {g.tipo === 'juridica' ? <Building2 /> : <UserRound />}
                    </span>
                    <span className={s.sugerenciaTexto}>
                      <strong>{g.nombre}</strong>
                      <span className={s.sugerenciaDonde}>
                        {g.efectos.slice(0, 4).map((e) => (
                          <EtiquetaEfecto key={e.id} numero={e.numero} />
                        ))}
                        {g.efectos.length > 4 && <span>y {g.efectos.length - 4} más</span>}
                      </span>
                    </span>
                    <Boton
                      tamano="chico"
                      icono={<Plus aria-hidden />}
                      onClick={() => {
                        const como = g.efectos.every((e) => e.como === 'tenedor') ? 'tenedor' : 'propietario';
                        setPropuesta({
                          nombre: g.nombre,
                          tipo: g.tipo,
                          origen: `${g.efectos.length === 1 ? `el efecto Nº ${g.efectos[0].numero}` : `${g.efectos.length} efectos`} como ${como}`,
                        });
                        setCreando(true);
                      }}
                    >
                      Agregar
                    </Boton>
                  </li>
                ))}
              </ul>
              {sugerencias.length > MAX_SUGERENCIAS && (
                <button type="button" className={si.limpiar} onClick={() => setVerTodas((v) => !v)}>
                  {verTodas ? 'Ver menos' : `Ver las ${sugerencias.length}`}
                </button>
              )}
            </section>
          )}

          {error ? (
            <div style={{ padding: 'var(--esp-6)' }}>
              <AvisoError titulo="No pudimos traer el directorio">{error.message}</AvisoError>
            </div>
          ) : cargando ? (
            <FilasEsqueleto filas={6} />
          ) : filas.length === 0 ? (
            <div className={si.vacio}>
              <EstadoVacio
                icono={<Landmark />}
                titulo="El directorio está vacío"
                accion={
                  <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
                    Agregar la primera
                  </Boton>
                }
              >
                Cargá imputados, testigos, funcionarios y empresas con sus teléfonos y CUIT. Así, cuando alguien busque un número, la app le dice de quién es.
              </EstadoVacio>
            </div>
          ) : visibles.length === 0 ? (
            <div className={si.vacio}>
              <EstadoVacio icono={<Search />} titulo="Nadie coincide" accion={<Boton onClick={() => setFiltros(SIN_FILTROS)}>Limpiar filtros</Boton>}>
                Probá con otra parte del nombre o con los últimos dígitos del teléfono.
              </EstadoVacio>
            </div>
          ) : (
            <div className={se.marcoTabla}>
              <table className={`${se.tabla} ${s.tabla}`}>
                <thead>
                  <tr>
                    <th>Nombre o razón social</th>
                    <th style={{ width: 200 }}>Rol en la causa</th>
                    <th style={{ width: 280 }}>Teléfonos, CUIT, agendado como</th>
                    <th style={{ width: 120 }}>En efectos</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => {
                    const juridica = p.tipo_persona === 'juridica';
                    const n = conteoEfectos.get(p.id) ?? 0;
                    return (
                      <tr key={p.id} className={`${se.fila} ${p.id === abierta ? se.filaAbierta : ''}`} tabIndex={0} onClick={() => abrir(p.id)} onKeyDown={tecla(p.id)}>
                        <td data-movil="ancho">
                          <span className={s.nombre}>
                            <span className={`${s.icono} ${juridica ? s.iconoJuridica : ''}`} aria-hidden>
                              {juridica ? <Building2 /> : <UserRound />}
                            </span>
                            <span>
                              <strong>{p.nombre}</strong>
                              {p.cargo && <span className={s.cargo}>{p.cargo}</span>}
                            </span>
                          </span>
                        </td>
                        <td data-movil="ancho">
                          <span className={s.roles}>
                            {p.roles.length ? (
                              p.roles.map((r) => (
                                <Chip key={r.id} familia={r.rol === 'imputado' ? 'contratacion' : 'otros'}>
                                  {etiquetaRol(r.rol)}
                                </Chip>
                              ))
                            ) : (
                              <span className={se.tenue}>Sin rol</span>
                            )}
                          </span>
                        </td>
                        <td data-movil="ancho">
                          {p.identificadores.length ? (
                            <span className={s.identificadores}>
                              {p.identificadores.slice(0, 3).map((i) => (
                                <span key={i.id} title={etiquetaIdentificador(i.tipo)}>
                                  <span className={s.identificadorTipo}>{etiquetaIdentificador(i.tipo)}</span> <span className={s.valor}>{i.valor}</span>
                                </span>
                              ))}
                              {p.identificadores.length > 3 && <span className={se.tenue}>y {p.identificadores.length - 3} más</span>}
                            </span>
                          ) : (
                            <span className={se.tenue}>—</span>
                          )}
                        </td>
                        <td data-movil="oculto" className="cifras">
                          {n ? `${n} ${n === 1 ? 'efecto' : 'efectos'}` : <span className={se.tenue}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className={si.pie}>
          <span>
            {hayFiltros ? `${visibles.length} de ${filas.length}` : `${filas.length} en el directorio`} ·{' '}
            {filas.filter((p) => p.tipo_persona === 'juridica').length} personas jurídicas
          </span>
          <span className={si.enVivo}>En vivo: los cambios del equipo aparecen solos</span>
        </footer>
      </div>

      {personaAbierta && <FichaPersona key={personaAbierta.id} persona={personaAbierta} efectos={efectos} onCerrar={() => abrir(null)} />}

      <NuevaPersona
        abierto={creando}
        causaId={causa.id}
        existentes={filas}
        propuesta={propuesta}
        onCerrar={() => setCreando(false)}
        onCreada={(id) => {
          setCreando(false);
          setPropuesta(null);
          abrir(id);
        }}
      />
    </div>
  );
}
