import { FileSearch, History, LogOut, ShieldCheck, UsersRound } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { Entrada } from '../componentes/campos';
import { AvisoError } from '../componentes/estados';
import { useSesion } from '../datos/sesion';
import { accesoConClave } from '../lib/supabase';
import s from './Acceso.module.css';

function SelloMarca({ clase }: { clase?: string }) {
  return <img src="/sello.svg" alt="" className={clase ?? s.sello} />;
}

function Presentacion() {
  return (
    <section className={s.presentacion}>
      <div className={s.marca}>
        <SelloMarca />
        <div>
          <div className={s.marcaNombre}>Tablero de Prueba</div>
          <div className={s.marcaSub}>UFIL Paraná · Ministerio Público Fiscal de Entre Ríos</div>
        </div>
      </div>
      <div className={s.tesis}>
        <span className={s.eyebrow}>Índice vivo de la prueba</span>
        <h1 className={s.titular}>Toda la prueba de la causa, ordenada y a dos clics.</h1>
        <p className={s.bajada}>
          El cuadro de siempre, una fila por pieza, pero compartido en tiempo real, con vínculos, historial y la
          situación procesal de cada documento a la vista.
        </p>
        <ul className={s.rasgos}>
          <li>
            <FileSearch aria-hidden /> Cada pieza con su efecto, su informe y su link al Drive.
          </li>
          <li>
            <UsersRound aria-hidden /> Lo que carga un compañero aparece solo en tu pantalla.
          </li>
          <li>
            <History aria-hidden /> Nada se borra: queda quién cambió qué y cuándo.
          </li>
        </ul>
      </div>
      <p className={s.pie}>Los archivos siguen en el Drive de la UFIL. La app guarda las referencias.</p>
    </section>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Acceso() {
  const { entrarConGoogle, entrarConClave } = useSesion();
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function conClave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setYendo(true);
    const r = await entrarConClave(String(datos.get('email')), String(datos.get('clave')));
    setYendo(false);
    if (r) setError('No pudimos entrar con esos datos.');
  }

  return (
    <main className={s.pagina}>
      <Presentacion />
      <section className={s.lado}>
        <div className={s.tarjeta}>
          <div>
            <h2 className={s.tarjetaTitulo}>Entrar</h2>
            <p className={s.tarjetaTexto}>Usá la misma cuenta de Google con la que entrás al Drive de la UFIL.</p>
          </div>
          <Boton
            className={s.google}
            icono={<GoogleG />}
            cargando={yendo && !accesoConClave}
            onClick={() => {
              setYendo(true);
              void entrarConGoogle();
            }}
          >
            Entrar con Google
          </Boton>
          {accesoConClave && (
            <>
              <div className={s.separador}>solo para pruebas</div>
              <form className={s.formulario} onSubmit={conClave}>
                <Entrada name="email" type="email" etiqueta="Correo" autoComplete="username" required />
                <Entrada name="clave" type="password" etiqueta="Contraseña" autoComplete="current-password" required />
                {error && <AvisoError titulo={error} />}
                <Boton type="submit" variante="primario" cargando={yendo}>
                  Entrar con correo
                </Boton>
              </form>
            </>
          )}
          <p className={s.aviso}>
            <ShieldCheck aria-hidden style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />
            Solo entran las personas invitadas por el equipo.
          </p>
        </div>
      </section>
    </main>
  );
}

function Centro({ children }: { children: ReactNode }) {
  return <main className={s.centro}>{children}</main>;
}

export function Cargando() {
  return (
    <Centro>
      <div className={s.cargando} role="status">
        <SelloMarca clase={s.selloLatido} />
        Abriendo el tablero…
      </div>
    </Centro>
  );
}

export function SinInvitacion({ email }: { email: string }) {
  const { salir } = useSesion();
  return (
    <Centro>
      <div className={s.tarjeta}>
        <SelloMarca />
        <h2 className={s.tarjetaTitulo}>Todavía no estás habilitado</h2>
        <p className={s.tarjetaTexto}>
          Entraste como <strong>{email}</strong>, pero esa cuenta no está en la lista del equipo. Pedile a alguien que ya
          use el tablero que te invite desde <em>Equipo</em>, con este mismo correo.
        </p>
        <Boton icono={<LogOut aria-hidden />} onClick={() => void salir()}>
          Entrar con otra cuenta
        </Boton>
      </div>
    </Centro>
  );
}

export function ErrorDeSesion({ mensaje }: { mensaje: string }) {
  const { salir } = useSesion();
  return (
    <Centro>
      <div className={s.tarjeta}>
        <AvisoError titulo="No pudimos verificar tu cuenta">{mensaje}</AvisoError>
        <Boton onClick={() => window.location.reload()}>Probar de nuevo</Boton>
        <Boton variante="fantasma" onClick={() => void salir()}>
          Salir
        </Boton>
      </div>
    </Centro>
  );
}

export function SinConfigurar() {
  return (
    <main className={s.pagina}>
      <Presentacion />
      <section className={s.lado}>
        <div className={s.tarjeta}>
          <h2 className={s.tarjetaTitulo}>Falta conectar la base de datos</h2>
          <p className={s.tarjetaTexto}>
            La app ya está publicada, pero todavía no sabe a qué proyecto de Supabase conectarse. Hay que cargar dos
            variables en Netlify:
          </p>
          <ol className={s.pasos}>
            <li>
              <code>VITE_SUPABASE_URL</code>
            </li>
            <li>
              <code>VITE_SUPABASE_ANON_KEY</code>
            </li>
          </ol>
          <p className={s.tarjetaTexto}>El paso a paso está en el manual técnico del repositorio.</p>
          <Link to="/diseno">Mientras tanto, mirá el sistema de diseño →</Link>
        </div>
      </section>
    </main>
  );
}
