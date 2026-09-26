import { useQueryClient } from '@tanstack/react-query';
import { FolderOpen, LogOut, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton';
import { Entrada } from '../componentes/campos';
import { AvisoError, EstadoVacio, Esqueleto } from '../componentes/estados';
import { Avatar } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import { useCausas, useConteoPiezas } from '../datos/consultas';
import { traducirError } from '../datos/guardado';
import { useSesion, useYo } from '../datos/sesion';
import { aliasDe } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import s from './Paginas.module.css';

export function Causas() {
  const { data: causas, isLoading, error } = useCausas();
  const { data: conteo } = useConteoPiezas();
  const yo = useYo();
  const { salir } = useSesion();
  const navegar = useNavigate();
  const [creando, setCreando] = useState(false);

  // Con una sola causa, se entra directo: es lo que va a pasar casi siempre.
  useEffect(() => {
    if (causas?.length === 1 && !sessionStorage.getItem('tp-vio-causas')) {
      sessionStorage.setItem('tp-vio-causas', '1');
      navegar(`/causa/${causas[0].id}/inicio`, { replace: true });
    }
  }, [causas, navegar]);

  return (
    <main className={s.pagina} style={{ height: '100vh' }}>
      <div className={s.contenedor}>
        <header className={s.cabecera}>
          <div>
            <span className={s.eyebrow}>Tablero de Prueba · UFIL Paraná</span>
            <h1 className={`${s.titulo} ${s.tituloSerif}`}>Causas</h1>
            <p className={s.bajada}>Cada causa tiene su propio índice de prueba, sus efectos y su historial.</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--esp-2)', alignItems: 'center' }}>
            <Avatar texto={aliasDe(yo)} email={yo.email} titulo={yo.email} />
            <Boton variante="fantasma" icono={<LogOut aria-hidden />} onClick={() => void salir()}>
              Salir
            </Boton>
            <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando((c) => !c)}>
              Nueva causa
            </Boton>
          </div>
        </header>

        {creando && <NuevaCausa onListo={() => setCreando(false)} />}

        {error ? (
          <AvisoError titulo="No pudimos traer las causas">{(error as Error).message}</AvisoError>
        ) : isLoading ? (
          <div className={s.causas}>
            {[1, 2].map((n) => (
              <div key={n} className={s.causa}>
                <Esqueleto ancho={96} alto={56} />
                <div style={{ display: 'grid', gap: 8 }}>
                  <Esqueleto ancho="70%" alto={18} />
                  <Esqueleto ancho="40%" />
                </div>
              </div>
            ))}
          </div>
        ) : !causas?.length ? (
          <EstadoVacio
            icono={<FolderOpen />}
            titulo="Todavía no hay causas cargadas"
            accion={
              <Boton variante="primario" icono={<Plus aria-hidden />} onClick={() => setCreando(true)}>
                Cargar la primera causa
              </Boton>
            }
          >
            Empezá por el legajo, el número de OGA y la carátula. Después vas a poder cargar su prueba.
          </EstadoVacio>
        ) : (
          <div className={s.causas}>
            {causas.map((c) => (
              <Link key={c.id} to={`/causa/${c.id}/inicio`} className={s.causa}>
                <span className={s.legajo}>
                  <span className={s.legajoRotulo}>Legajo</span>
                  <span className={s.legajoNumero}>{c.legajo_fiscalia}</span>
                </span>
                <span>
                  <span className={s.caratula}>{c.caratula}</span>
                  <span className={s.causaMeta}>
                    {c.numero_oga && <span>OGA {c.numero_oga}</span>}
                    {c.objeto && <span>{c.objeto}</span>}
                  </span>
                </span>
                <span className={s.conteo}>
                  <b>{conteo?.get(c.id) ?? 0}</b>
                  piezas
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function NuevaCausa({ onListo }: { onListo: () => void }) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setEnviando(true);
    const { error: err } = await supabase.from('causa').insert({
      legajo_fiscalia: String(d.get('legajo')).trim(),
      numero_oga: String(d.get('oga')).trim() || null,
      caratula: String(d.get('caratula')).trim(),
    });
    setEnviando(false);
    if (err) {
      setError(traducirError(err.message));
      return;
    }
    void qc.invalidateQueries({ queryKey: ['causas'] });
    avisar('Causa creada.');
    onListo();
  }

  return (
    <section className={s.tarjeta}>
      <div className={s.tarjetaCabecera}>
        <h2 className={s.tarjetaTitulo}>Nueva causa</h2>
      </div>
      <form className={`${s.formulario} ${s.formularioCausa}`} onSubmit={crear}>
        <Entrada name="legajo" etiqueta="Legajo Fiscalía" required inputMode="numeric" autoFocus />
        <Entrada name="oga" etiqueta="Nº OGA" inputMode="numeric" />
        <Entrada name="caratula" etiqueta="Carátula" required placeholder="Como figura en el legajo" />
        <Boton type="submit" variante="primario" cargando={enviando}>
          Crear
        </Boton>
      </form>
      {error && (
        <div style={{ padding: '0 var(--esp-5) var(--esp-5)' }}>
          <AvisoError titulo={error} />
        </div>
      )}
    </section>
  );
}
