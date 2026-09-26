import {
  ChevronsUpDown,
  Clock,
  Gavel,
  House,
  ListTree,
  LogOut,
  MessagesSquare,
  Package,
  ScrollText,
  Search,
  UsersRound,
  Landmark,
} from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { BusquedaGlobal } from '../componentes/BusquedaGlobal';
import { IndicadorGuardado } from '../componentes/estados';
import { Avatar } from '../componentes/marcas';
import { useCausa } from '../datos/consultas';
import { useGuardado } from '../datos/guardado';
import { usePresencia, type Presente } from '../datos/presencia';
import { useSesion, useYo } from '../datos/sesion';
import { aliasDe } from '../lib/etiquetas';
import type { Causa } from '../lib/tipos';
import s from './Marco.module.css';

type Seccion = { ruta: string; etiqueta: string; icono: ReactNode; fase?: number };

export const SECCIONES: Seccion[] = [
  { ruta: 'inicio', etiqueta: 'Inicio', icono: <House aria-hidden /> },
  { ruta: 'indice', etiqueta: 'Índice de prueba', icono: <ListTree aria-hidden /> },
  { ruta: 'efectos', etiqueta: 'Efectos', icono: <Package aria-hidden /> },
  { ruta: 'contrataciones', etiqueta: 'Contrataciones', icono: <ScrollText aria-hidden /> },
  { ruta: 'personas', etiqueta: 'Personas y empresas', icono: <Landmark aria-hidden /> },
  { ruta: 'mensajes', etiqueta: 'Mensajes', icono: <MessagesSquare aria-hidden /> },
  { ruta: 'cronologia', etiqueta: 'Cronología', icono: <Clock aria-hidden /> },
  { ruta: 'juicio', etiqueta: 'Juicio', icono: <Gavel aria-hidden /> },
  { ruta: 'equipo', etiqueta: 'Equipo', icono: <UsersRound aria-hidden /> },
];

type ContextoCausa = { causa: Causa; presentes: Presente[]; viendoPorPieza: Record<string, { alias: string; email: string }[]> };
const CausaContexto = createContext<ContextoCausa | null>(null);

export function useCausaActual() {
  const c = useContext(CausaContexto);
  if (!c) throw new Error('useCausaActual fuera del Marco');
  return c;
}

const NOMBRE_VISTA: Record<string, string> = {
  ...Object.fromEntries(SECCIONES.map((x) => [x.ruta, x.etiqueta])),
  importar: 'Importar',
  'importar-contrataciones': 'Importar',
  'importar-conversacion': 'Importar',
};

export function Marco() {
  const { causaId } = useParams();
  const { data: causa, isLoading } = useCausa(causaId);
  const yo = useYo();
  const { salir } = useSesion();
  const { estado: guardado } = useGuardado();
  const ubicacion = useLocation();
  const [params] = useSearchParams();
  const vista = ubicacion.pathname.split('/')[3] ?? 'inicio';
  const [buscando, setBuscando] = useState(false);
  const cambiarBusqueda = useCallback((v: boolean) => setBuscando(v), []);
  const alias = aliasDe(yo);
  const { presentes, viendoPorPieza } = usePresencia(causaId ?? '', { email: yo.email, alias }, vista, params.get('pieza'));

  if (isLoading) return null;
  if (!causa) {
    return (
      <main style={{ padding: 'var(--esp-10)' }}>
        <p>No encontramos esa causa. <Link to="/">Volver a las causas</Link></p>
      </main>
    );
  }

  const otros = presentes.filter((p) => p.email !== yo.email);

  return (
    <CausaContexto.Provider value={{ causa, presentes, viendoPorPieza }}>
      <div className={s.marco}>
        <aside className={s.riel}>
          <Link to="/" className={s.marca} aria-label="Tablero de Prueba: todas las causas">
            <img src="/sello.svg" alt="" />
            <span className={s.marcaTexto}>
              <span className={s.marcaNombre}>Tablero de Prueba</span>
              <br />
              <span className={s.marcaSub}>UFIL Paraná</span>
            </span>
          </Link>

          <Link to="/" className={s.causa} title="Cambiar de causa">
            <span>
              <span className={s.causaRotulo}>Causa</span>
              <span className={s.causaNumero}>Legajo {causa.legajo_fiscalia}</span>
            </span>
            <ChevronsUpDown aria-hidden />
          </Link>

          <button type="button" className={s.buscar} onClick={() => setBuscando(true)}>
            <Search aria-hidden />
            <span className={s.buscarTexto}>Buscar en la causa</span>
            <kbd>Ctrl K</kbd>
          </button>

          <nav className={s.nav} aria-label="Secciones de la causa">
            {SECCIONES.map((x) => (
              <NavLink key={x.ruta} to={x.ruta} className={({ isActive }) => `${s.item} ${isActive ? s.activo : ''}`}>
                {x.icono}
                <span className={s.itemTexto}>{x.etiqueta}</span>
                {x.fase && <span className={s.fase} title={`Llega en la Fase ${x.fase}`}>F{x.fase}</span>}
              </NavLink>
            ))}
          </nav>

          <div className={s.bloque}>
            <span className={`rotulo ${s.bloqueRotulo}`}>En línea ahora</span>
            <ul className={s.presentes}>
              <li>
                <Avatar texto={alias} email={yo.email} tamano="chico" enLinea />
                {alias}
                <span className={s.donde}>vos</span>
              </li>
              {otros.map((p) => (
                <li key={p.email}>
                  <Avatar texto={p.alias} email={p.email} tamano="chico" enLinea />
                  {p.alias}
                  <span className={s.donde}>{NOMBRE_VISTA[p.vista] ?? ''}</span>
                </li>
              ))}
            </ul>
            {otros.length === 0 && <span className={s.solo}>Por ahora estás solo en esta causa.</span>}
          </div>

          <div className={s.pie}>
            <IndicadorGuardado estado={guardado} />
            <div className={s.yo}>
              <Avatar texto={alias} email={yo.email} tamano="chico" />
              <span className={s.yoNombre} title={yo.email}>
                {yo.nombre ?? alias}
              </span>
              <Boton variante="fantasma" tamano="chico" soloIcono aria-label="Salir" title="Salir" onClick={() => void salir()}>
                <LogOut aria-hidden />
              </Boton>
            </div>
          </div>
        </aside>

        <div className={s.contenido}>
          <Outlet />
        </div>
      </div>
      <BusquedaGlobal causaId={causa.id} abierta={buscando} onCambiar={cambiarBusqueda} />
    </CausaContexto.Provider>
  );
}
