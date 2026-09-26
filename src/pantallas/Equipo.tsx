import { useQueryClient } from '@tanstack/react-query';
import { Copy, Mail, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Boton, clasesBoton } from '../componentes/Boton';
import { Entrada } from '../componentes/campos';
import { AvisoError, Esqueleto } from '../componentes/estados';
import { Avatar } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useMiembros } from '../datos/consultas';
import { traducirError, useGuardado } from '../datos/guardado';
import { useYo } from '../datos/sesion';
import { aliasDe } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import { haceCuanto } from '../lib/tiempo';
import s from './Paginas.module.css';

export function Equipo() {
  const { data: miembros, isLoading, error } = useMiembros();
  const yo = useYo();
  const qc = useQueryClient();
  const { avisar } = useToast();
  const { guardarCampo } = useGuardado();
  const [enviando, setEnviando] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [invitado, setInvitado] = useState<{ email: string; alias: string } | null>(null);

  const direccion = window.location.origin;
  const mensaje = invitado
    ? `Hola ${invitado.alias}: ya podés entrar al Tablero de Prueba de la UFIL.\n\n1. Abrí ${direccion}\n2. Tocá «Entrar con Google» y elegí ${invitado.email}.\n\nAhí vas a ver el índice de prueba de la causa y lo que va cargando el equipo.`
    : '';

  async function invitar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const d = new FormData(formulario);
    const email = String(d.get('email')).trim().toLowerCase();
    const alias = String(d.get('alias')).trim().toUpperCase() || email.split('@')[0].toUpperCase();
    setEnviando(true);
    const { error: err } = await supabase.from('miembro').insert({
      email,
      alias,
      nombre: String(d.get('nombre')).trim() || null,
      invitado_por: yo.email,
    });
    setEnviando(false);
    if (err) {
      setErrorAlta(/duplicate/i.test(err.message) ? 'Esa persona ya está en la lista.' : traducirError(err.message));
      return;
    }
    setErrorAlta(null);
    formulario.reset();
    setInvitado({ email, alias });
    void qc.invalidateQueries({ queryKey: ['miembros'] });
    avisar(`${alias} ya puede entrar.`);
  }

  async function copiarMensaje() {
    try {
      await navigator.clipboard.writeText(mensaje);
      avisar('Mensaje copiado. Mandáselo por WhatsApp o por correo.');
    } catch {
      avisar('No se pudo copiar: seleccioná el texto y copialo.', { tono: 'aviso' });
    }
  }

  return (
    <main className={s.pagina}>
      <div className={s.contenedor}>
        <header className={s.cabecera}>
          <div>
            <span className={s.eyebrow}>Equipo</span>
            <h1 className={s.titulo}>Quiénes trabajan en el tablero</h1>
            <p className={s.bajada}>
              Todos pueden ver, cargar y editar todo. Para sumar a alguien, cargá su correo de Google y avisale: entra con
              «Entrar con Google».
            </p>
          </div>
        </header>

        <section className={s.tarjeta}>
          <div className={s.tarjetaCabecera}>
            <h2 className={s.tarjetaTitulo}>Invitar a una persona</h2>
          </div>
          <form className={s.formulario} onSubmit={invitar}>
            <Entrada name="email" type="email" etiqueta="Correo de Google" required placeholder="nombre@gmail.com" autoComplete="off" />
            <Entrada name="alias" etiqueta="Cómo figura en las planillas" placeholder="p. ej. CARLI" autoComplete="off" />
            <Entrada name="nombre" etiqueta="Nombre y apellido" autoComplete="off" />
            <Boton type="submit" variante="primario" icono={<UserPlus aria-hidden />} cargando={enviando}>
              Invitar
            </Boton>
          </form>
          {errorAlta && (
            <div style={{ padding: '0 var(--esp-5) var(--esp-5)' }}>
              <AvisoError titulo={errorAlta} />
            </div>
          )}
          {invitado && (
            <div className={s.invitacion}>
              <strong>Listo. Mandale este mensaje a {invitado.alias}:</strong>
              <pre>{mensaje}</pre>
              <div className={s.invitacionAcciones}>
                <Boton icono={<Copy aria-hidden />} onClick={() => void copiarMensaje()}>
                  Copiar mensaje
                </Boton>
                <a
                  className={clasesBoton()}
                  style={{ textDecoration: 'none' }}
                  href={`mailto:${invitado.email}?subject=${encodeURIComponent('Acceso al Tablero de Prueba')}&body=${encodeURIComponent(mensaje)}`}
                >
                  <Mail aria-hidden />
                  Abrir en el correo
                </a>
              </div>
            </div>
          )}
        </section>

        <section className={s.tarjeta}>
          <div className={s.tarjetaCabecera}>
            <h2 className={s.tarjetaTitulo}>Personas habilitadas</h2>
          </div>
          {error ? (
            <div style={{ padding: 'var(--esp-5)' }}>
              <AvisoError titulo="No pudimos traer el equipo">{(error as Error).message}</AvisoError>
            </div>
          ) : isLoading ? (
            <div style={{ padding: 'var(--esp-5)', display: 'grid', gap: 12 }}>
              <Esqueleto ancho="60%" />
              <Esqueleto ancho="45%" />
            </div>
          ) : (
            <ul className={s.miembros}>
              {miembros?.map((m) => (
                <li key={m.id} className={`${s.miembro} ${m.activo ? '' : s.inactivo}`}>
                  <Avatar texto={aliasDe(m)} email={m.email} />
                  <div>
                    <div className={s.miembroNombre}>
                      {aliasDe(m)}
                      {m.nombre && m.alias ? ` · ${m.nombre}` : ''}
                      {m.email === yo.email ? ' (vos)' : ''}
                    </div>
                    <div className={s.miembroCorreo}>{m.email}</div>
                  </div>
                  <span className={s.miembroEstado}>
                    {!m.activo ? 'Deshabilitado' : m.ultimo_ingreso ? `Entró ${haceCuanto(m.ultimo_ingreso)}` : 'Todavía no entró'}
                  </span>
                  {m.email !== yo.email ? (
                    <Boton
                      tamano="chico"
                      variante={m.activo ? 'fantasma' : 'secundario'}
                      onClick={async () => {
                        const r = await guardarCampo('miembro', m.id, 'activo', m.activo, !m.activo);
                        if (r.tipo === 'ok') {
                          void qc.invalidateQueries({ queryKey: ['miembros'] });
                          avisar(m.activo ? `${aliasDe(m)} ya no puede entrar.` : `${aliasDe(m)} puede volver a entrar.`);
                        }
                      }}
                    >
                      {m.activo ? 'Deshabilitar' : 'Habilitar'}
                    </Boton>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
