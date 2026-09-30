import { ExternalLink, FileSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PIGMENTOS } from '../../herramientas/ilustraciones/pigmentos.js';
import { AvisoError, EstadoVacio } from '../componentes/estados';
import { ILUSTRACIONES, type IdIlustracion } from '../ilustraciones/catalogo';
import { Ilustracion } from '../ilustraciones/Ilustracion';
import s from './PaginaDiseno.module.css';

const VINETAS: IdIlustracion[] = [
  'vacio-indice',
  'vacio-efectos',
  'vacio-documentos',
  'vacio-mensajes',
  'vacio-sugerencias',
  'vacio-busqueda',
  'error-orilla',
  'proximamente-orilla',
];

const REGLAS = [
  'Son claras y luminosas: nada de fondos ni bandas oscuras, ni escenas nocturnas.',
  'El único rojo de la serie es el hilo, y solo aparece en el panorama del Acceso y en la portada del manual. El lacre sigue siendo de las alertas procesales.',
  'Viven solo donde no hay datos: acceso, estados vacíos, error, cabecera de Inicio y manual. Las pantallas de trabajo y las exportaciones no llevan arte.',
  'Sin personas, sin rostros, sin nombres, sin números de legajo, sin datos reales y sin texto adentro de la imagen.',
  'Son decorativas: alt vacío y aria-hidden. El sentido lo lleva el texto, y el texto nunca va encima de la pintura.',
  'Hay un solo movimiento: el hilo se tiende una vez al cargar el Acceso. Con movimiento reducido aparece ya tendido.',
  'Salen de la propia app, sin CDN. Se hornean con npm run ilustraciones y la versión va en el nombre del archivo.',
];

type Fila = { elemento: string; uso: string; fuente: { texto: string; url: string }; confianza: string };
const PROCEDENCIA: Fila[] = [
  { elemento: 'Bandera de Entre Ríos', uso: 'Solo la idea: el hilo punzó en diagonal, de arriba a la izquierda a abajo a la derecha.', fuente: { texto: 'argentina.gob.ar · símbolos de Entre Ríos', url: 'https://www.argentina.gob.ar/entre-rios/simbolos' }, confianza: 'Alta' },
  { elemento: 'Escudo de Entre Ríos', uso: 'No se dibuja: está regulado por ley.', fuente: { texto: 'argentina.gob.ar · símbolos de Entre Ríos', url: 'https://www.argentina.gob.ar/entre-rios/simbolos' }, confianza: 'Alta (número de ley: media)' },
  { elemento: 'Paraná: barranca sobre el río, «La Bajada»', uso: 'El panorama del Acceso.', fuente: { texto: 'Wikipedia · Paraná', url: 'https://es.wikipedia.org/wiki/Paran%C3%A1_(Argentina)' }, confianza: 'Alta' },
  { elemento: 'Entre dos ríos', uso: 'La franja de la cabecera de Inicio.', fuente: { texto: 'Britannica · Entre Ríos', url: 'https://www.britannica.com/place/Entre-Rios' }, confianza: 'Alta' },
  { elemento: 'Espinillo (árbol histórico)', uso: 'Flores de oro en la cresta y rama en una viñeta.', fuente: { texto: 'Senado de Entre Ríos · texto de la ley', url: 'https://www.senadoer.gob.ar/descargas/40664' }, confianza: 'Alta (número de ley: media)' },
  { elemento: 'Ceibo (flor característica)', uso: 'Solo el follaje: la flor es roja y el rojo es del hilo.', fuente: { texto: 'argentina.gob.ar · símbolos de Entre Ríos', url: 'https://www.argentina.gob.ar/entre-rios/simbolos' }, confianza: 'Alta (declaración legal: baja)' },
  { elemento: 'Camalote, sauce criollo y junco', uso: 'La ribera, el agua y las viñetas.', fuente: { texto: 'EcuRed · Delta del Paraná', url: 'https://www.ecured.cu/Delta_del_r%C3%ADo_Paran%C3%A1' }, confianza: 'Media' },
  { elemento: 'Canoa vacía', uso: 'El panorama y una viñeta, sin nadie adentro.', fuente: { texto: 'Turismo Entre Ríos · pesca en el Paraná', url: 'https://www.turismoentrerios.com/deporte/pescarioparana.htm' }, confianza: 'Media' },
];

const DESCARTADOS =
  'Quedaron afuera por no poder respaldarlos: el logo del MPF, el mate, el farol, la red de pesca, la garza y cualquier ave como «símbolo» (la Ley 11.078 declara monumentos naturales, no un ave provincial).';

// Distancia entre dos colores (CIE76) para mostrar que el punzó del hilo no se confunde con el lacre.
function aLab(hex: string): [number, number, number] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const X = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047;
  const Y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const Z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const matiz = (l: [number, number, number]) => Math.round(((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360);

function PunzoYLacre() {
  const [lacre, setLacre] = useState('');
  useEffect(() => {
    setLacre(getComputedStyle(document.documentElement).getPropertyValue('--color-peligro').trim().toUpperCase());
  }, []);
  const punzo = PIGMENTOS.punzo.hex.toUpperCase();
  const a = lacre ? aLab(lacre) : null;
  const b = aLab(punzo);
  const dE = a ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null;
  return (
    <div className={s.punzoLacre}>
      <div className={s.punzoMuestras}>
        <div style={{ background: 'var(--color-peligro)' }}>
          Lacre
          <small>{lacre}</small>
        </div>
        <div style={{ background: punzo }}>
          Punzó del hilo
          <small>{punzo}</small>
        </div>
      </div>
      <p className={s.seccionBajada}>
        {a && dE !== null
          ? `Distancia de color (CIE76) ${dE.toFixed(0)}; matiz ${matiz(a)}° el lacre y ${matiz(b)}° el punzó, que es más frío y más carmín. `
          : ''}
        Son los pigmentos a densidad plena: en el hilo, pintado con veladuras, el punzó queda todavía más claro. El lacre marca un problema procesal; el punzó es la
        franja de la bandera hecha hilo de expediente.
      </p>
    </div>
  );
}

export function SeccionIlustraciones() {
  return (
    <>
      <div className={s.grupo}>
        <span className={s.grupoTitulo}>La Bajada · panorama con el hilo (tamaño real 1200 × 500)</span>
        <div className={s.panoramaDemo}>
          <Ilustracion id="bajada" className={s.panoramaDemoImg} />
          <Ilustracion id="hilo-bajada" className={s.panoramaDemoImg} />
        </div>
      </div>

      <div className={s.grupo}>
        <span className={s.grupoTitulo}>Entre dos ríos · franja de Inicio (560 × 96)</span>
        <div className={s.franjaDemo}>
          <Ilustracion id="entre-dos-rios" />
        </div>
      </div>

      <div className={s.grupo}>
        <span className={s.grupoTitulo}>Viñetas (160 × 120)</span>
        <div className={s.galeriaIlus}>
          {VINETAS.map((id) => (
            <figure key={id} className={s.tarjetaIlus}>
              <Ilustracion id={id} />
              <figcaption>
                <code>{id}</code>
                <span>{ILUSTRACIONES[id].uso}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className={s.grupo}>
        <span className={s.grupoTitulo}>Dentro de los componentes</span>
        <div className={s.estados}>
          <div>
            <EstadoVacio icono={<FileSearch />} ilustracion="vacio-indice" titulo="Todavía no hay piezas">
              El estado vacío reemplaza el círculo con el ícono por la viñeta; el texto dice todo lo que hace falta.
            </EstadoVacio>
          </div>
          <div style={{ padding: 'var(--esp-5)' }}>
            <Ilustracion id="error-orilla" style={{ display: 'block', marginBottom: 'var(--esp-2)' }} />
            <AvisoError titulo="Algo falló al mostrar esta pantalla">Un error nunca se trivializa con un dibujo simpático: la orilla es serena y el texto explica qué pasó.</AvisoError>
          </div>
        </div>
      </div>

      <div className={s.grupo}>
        <span className={s.grupoTitulo}>Pigmentos (en herramientas/ilustraciones/pigmentos.js, no en tokens.css)</span>
        <div className={s.muestras}>
          {Object.entries(PIGMENTOS).map(([clave, p]) => (
            <div key={clave} className={s.muestra}>
              <div className={s.color} style={{ background: p.hex }} />
              <div className={s.muestraNombre}>{p.nombre}</div>
              <div className={s.muestraDato}>
                <span>{p.hex}</span>
                <span>{p.nota}</span>
              </div>
            </div>
          ))}
        </div>
        <p className={s.seccionBajada}>
          El blanco es el papel (<code>--color-fondo</code>): se reserva, no se pinta. Nada de negro: los oscuros salen del ultramar y la tinta.
        </p>
      </div>

      <div className={s.grupo}>
        <span className={s.grupoTitulo}>El punzó del hilo frente al lacre</span>
        <PunzoYLacre />
      </div>

      <div className={s.grupo}>
        <span className={s.grupoTitulo}>Reglas de uso</span>
        <ul className={s.reglasIlus}>
          {REGLAS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className={s.grupo}>
        <span className={s.grupoTitulo}>Procedencia de cada elemento cultural</span>
        <div className={s.tablaIlusMarco}>
          <table className={s.tablaIlus}>
            <thead>
              <tr>
                <th>Elemento</th>
                <th>En la serie</th>
                <th>Fuente</th>
                <th>Confianza</th>
              </tr>
            </thead>
            <tbody>
              {PROCEDENCIA.map((f) => (
                <tr key={f.elemento}>
                  <td>{f.elemento}</td>
                  <td>{f.uso}</td>
                  <td>
                    <a href={f.fuente.url} target="_blank" rel="noreferrer">
                      {f.fuente.texto} <ExternalLink aria-hidden />
                    </a>
                  </td>
                  <td>{f.confianza}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.seccionBajada}>{DESCARTADOS} El detalle está en docs/ilustraciones/FUENTES.md.</p>
      </div>
    </>
  );
}
