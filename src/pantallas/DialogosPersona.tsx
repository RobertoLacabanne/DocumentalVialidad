import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Boton } from '../componentes/Boton';
import { AreaTexto, Entrada, Selector } from '../componentes/campos';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { MarcaSugerencia } from '../componentes/marcas';
import { useToast } from '../componentes/Toast';
import type { PersonaVista } from '../datos/causa';
import { traducirError } from '../datos/guardado';
import { ROLES, TIPOS_IDENTIFICADOR } from '../lib/etiquetas';
import { claveNombre } from '../lib/nombres';
import { supabase } from '../lib/supabase';

export type Propuesta = { nombre: string; tipo: 'fisica' | 'juridica'; origen: string };

/** Alta de una persona o empresa. Si viene de una sugerencia, llega precargada y se marca como tal hasta confirmar. */
export function NuevaPersona({
  abierto,
  causaId,
  existentes,
  propuesta,
  onCerrar,
  onCreada,
}: {
  abierto: boolean;
  causaId: string;
  existentes: PersonaVista[];
  propuesta: Propuesta | null;
  onCerrar: () => void;
  onCreada: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const nombre = String(d.get('nombre')).replace(/\s+/g, ' ').trim();
    const clave = claveNombre(nombre);
    const repetida = existentes.find((p) => claveNombre(p.nombre) === clave);
    if (repetida) {
      setError(`«${repetida.nombre}» ya está en el directorio.`);
      return;
    }
    setEnviando(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('persona')
      .insert({
        causa_id: causaId,
        nombre,
        tipo_persona: String(d.get('tipo')),
        cargo: String(d.get('cargo') ?? '').trim() || null,
        observaciones: String(d.get('observaciones') ?? '').trim() || null,
        origen: propuesta ? { sugerido_desde: propuesta.origen } : null,
      })
      .select('id')
      .single();
    if (err || !data) {
      setEnviando(false);
      setError(traducirError(err?.message ?? 'Error desconocido'));
      return;
    }
    const id = (data as { id: string }).id;
    const rol = String(d.get('rol') ?? '');
    const valor = String(d.get('valor') ?? '').trim();
    const extras = [];
    if (rol) extras.push(supabase.from('rol_en_causa').insert({ causa_id: causaId, persona_id: id, rol }));
    if (valor) extras.push(supabase.from('identificador').insert({ causa_id: causaId, persona_id: id, tipo: String(d.get('tipo_identificador')), valor }));
    const resultados = await Promise.all(extras);
    setEnviando(false);
    const fallo = resultados.find((r) => r.error);
    if (fallo?.error) avisar(`Se cargó, pero no el rol o el identificador: ${traducirError(fallo.error.message)}`, { tono: 'aviso' });
    else avisar(`${nombre} quedó en el directorio.`);
    for (const k of ['personas', 'roles', 'identificadores']) void qc.invalidateQueries({ queryKey: [k, causaId] });
    onCreada(id);
  }

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={propuesta ? 'Agregar al directorio' : 'Nueva persona o empresa'}
      descripcion={propuesta ? `Aparece en ${propuesta.origen}. Revisá el nombre y el tipo antes de confirmar.` : 'Después podés sumarle más teléfonos, CUIT o roles desde su ficha.'}
    >
      <form onSubmit={crear} key={propuesta?.nombre ?? 'nueva'}>
        <div className={clasesDialogo.cuerpo}>
          <Entrada name="nombre" etiqueta="Nombre o razón social" required autoFocus autoComplete="off" defaultValue={propuesta?.nombre ?? ''} />
          <div className={clasesDialogo.dosColumnas} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <Selector name="tipo" etiqueta="Tipo" defaultValue={propuesta?.tipo ?? 'fisica'}>
              <option value="fisica">Persona humana</option>
              <option value="juridica">Persona jurídica u organismo</option>
            </Selector>
            <Selector name="rol" etiqueta="Rol en la causa" defaultValue="">
              <option value="">Sin definir por ahora</option>
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </Selector>
          </div>
          {propuesta && (
            <div>
              <MarcaSugerencia>tipo sugerido por la app · confirmalo</MarcaSugerencia>
            </div>
          )}
          <Entrada name="cargo" etiqueta="Cargo o función" placeholder="p. ej. Jefe de Compras DPV" autoComplete="off" />
          <div className={clasesDialogo.dosColumnas}>
            <Selector name="tipo_identificador" etiqueta="Identificador" defaultValue="telefono">
              {TIPOS_IDENTIFICADOR.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </Selector>
            <Entrada name="valor" etiqueta="Valor" placeholder="Opcional" autoComplete="off" />
          </div>
          <AreaTexto name="observaciones" etiqueta="Observaciones" />
          {error && <AvisoError titulo={error} />}
        </div>
        <div className={clasesDialogo.pie}>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>
            {propuesta ? 'Confirmar y agregar' : 'Agregar'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
