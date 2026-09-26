import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Boton } from '../componentes/Boton';
import { Entrada, Selector } from '../componentes/campos';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { useToast } from '../componentes/Toast';
import type { PersonaVista } from '../datos/causa';
import { traducirError } from '../datos/guardado';
import { supabase } from '../lib/supabase';
import type { Vinculo } from '../lib/tipos';

export const RELACIONES_FRECUENTES = [
  'Socio',
  'Socio gerente',
  'Presidente del directorio',
  'Apoderado',
  'Empleado',
  'Contador',
  'Familiar',
  'Cónyuge o pareja',
  'Proveedor',
  'Contacto frecuente',
];

/** Busca si ya hay una relación cargada entre dos fichas, en cualquier sentido. */
export const relacionEntre = (vinculos: Vinculo[], a: string, b: string) =>
  vinculos.find((v) => v.tipo === 'relacionado' && ((v.origen_id === a && v.destino_id === b) || (v.origen_id === b && v.destino_id === a)));

/** Alta de una relación entre dos personas o empresas: qué relación tienen y de dónde surge. */
export function NuevaRelacion({
  abierto,
  causaId,
  personas,
  vinculos,
  inicial,
  onCerrar,
}: {
  abierto: boolean;
  causaId: string;
  personas: PersonaVista[];
  vinculos: Vinculo[];
  inicial?: string | null;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const a = String(d.get('a'));
    const b = String(d.get('b'));
    const nota = String(d.get('nota')).replace(/\s+/g, ' ').trim();
    const fuente = String(d.get('fuente') ?? '').trim() || null;
    if (!a || !b) return setError('Elegí las dos personas o empresas.');
    if (a === b) return setError('Elegí dos fichas distintas.');
    const previa = relacionEntre(vinculos, a, b);
    if (previa) return setError(`Ya hay una relación cargada entre las dos («${previa.nota ?? 'relacionadas'}»). Cambiala desde la ficha.`);
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.from('vinculo').insert({ causa_id: causaId, origen_id: a, destino_id: b, tipo: 'relacionado', nota, fuente });
    setEnviando(false);
    if (err) return setError(traducirError(err.message));
    void qc.invalidateQueries({ queryKey: ['vinculos', causaId] });
    const nombre = (id: string) => personas.find((p) => p.id === id)?.nombre ?? '';
    avisar(`Quedó cargada: ${nombre(a)} — ${nombre(b)}.`);
    onCerrar();
  }

  const ordenadas = [...personas].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  const opciones = ordenadas.map((p) => (
    <option key={p.id} value={p.id}>
      {p.nombre}
    </option>
  ));

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={() => {
        setError(null);
        onCerrar();
      }}
      titulo="Nueva relación"
      descripcion="Una relación entre dos personas o empresas del directorio. Anotá de dónde surge, así cualquiera puede ir a verificarla."
    >
      <form onSubmit={crear} key={`${abierto}-${inicial ?? ''}`}>
        <div className={clasesDialogo.cuerpo}>
          <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <Selector name="a" etiqueta="Entre" defaultValue={inicial ?? ''} required>
              <option value="" disabled>
                Elegí una ficha
              </option>
              {opciones}
            </Selector>
            <Selector name="b" etiqueta="Y" defaultValue="" required>
              <option value="" disabled>
                Elegí la otra
              </option>
              {opciones}
            </Selector>
          </div>
          <Entrada name="nota" etiqueta="Qué relación tienen" list="relaciones-frecuentes" placeholder="p. ej. Socio gerente" required autoComplete="off" />
          <datalist id="relaciones-frecuentes">
            {RELACIONES_FRECUENTES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <Entrada name="fuente" etiqueta="De dónde surge" placeholder="p. ej. Contrato social, efecto Nº 48435, fs. 12" autoComplete="off" />
          {error && <AvisoError titulo={error} />}
        </div>
        <div className={clasesDialogo.pie}>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>
            Cargar relación
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
