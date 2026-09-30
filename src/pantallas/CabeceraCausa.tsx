import { Ilustracion } from '../ilustraciones/Ilustracion';
import type { IdIlustracion } from '../ilustraciones/catalogo';
import type { Causa } from '../lib/tipos';
import s from './Indice.module.css';

/**
 * Carátula de la causa, en serif, con legajo y OGA.
 * Con `ilustracion` (solo Inicio), la franja comparte la fila: se achica antes de que la carátula se parta.
 */
export function CabeceraCausa({ causa, ilustracion }: { causa: Causa; ilustracion?: IdIlustracion }) {
  const partes = /^(.*?)\s*(\(.*\))\s*$/.exec(causa.caratula);
  const texto = (
    <>
      <div className={s.causaMeta}>
        <span>
          Legajo Fiscalía <b>{causa.legajo_fiscalia}</b>
        </span>
        {causa.numero_oga && (
          <span>
            OGA <b>{causa.numero_oga}</b>
          </span>
        )}
        {causa.delitos && <span>{causa.delitos}</span>}
      </div>
      <h1 className={s.caratula}>
        {partes ? (
          <>
            {partes[1]}{' '}
            <span style={{ fontWeight: 'var(--peso-normal)', color: 'var(--color-texto-suave)' }}>{partes[2]}</span>
          </>
        ) : (
          causa.caratula
        )}
      </h1>
    </>
  );
  if (!ilustracion) return <header className={s.causa}>{texto}</header>;
  return (
    <header className={`${s.causa} ${s.conIlustracion}`}>
      <div className={s.causaTexto}>{texto}</div>
      <div className={s.causaFranja} aria-hidden>
        <Ilustracion id={ilustracion} className={s.causaIlustracion} />
      </div>
    </header>
  );
}
