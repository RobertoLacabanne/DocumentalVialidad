import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Boton } from '../componentes/Boton';
import { Entrada, Selector } from '../componentes/campos';
import { Dialogo, clasesDialogo } from '../componentes/Dialogo';
import { AvisoError } from '../componentes/estados';
import { useToast } from '../componentes/Toast';
import { traducirError } from '../datos/guardado';
import { idDeDrive, esUrlValida } from '../lib/drive';
import { TIPOS_PIEZA } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import type { Pieza } from '../lib/tipos';
import { COLUMNAS_PIEZA } from '../datos/consultas';

/** Alta rápida: lo mínimo para que la pieza exista. El resto se completa en la ficha. */
export function NuevaPieza({
  abierto,
  causaId,
  numeroSugerido,
  onCerrar,
  onCreada,
}: {
  abierto: boolean;
  causaId: string;
  numeroSugerido: string;
  onCerrar: () => void;
  onCreada: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const titulo = String(datos.get('titulo') ?? '').trim();
    const numero = String(datos.get('numero') ?? '').trim();
    const link = String(datos.get('link') ?? '').trim();
    if (link && !esUrlValida(link)) {
      setErrorLink('Pegá el link completo, que empiece con https://');
      return;
    }
    setErrorLink(null);
    setError(null);
    setEnviando(true);
    const { data, error: errorAlta } = await supabase
      .from('pieza')
      .insert({
        causa_id: causaId,
        numero_orden: numero || null,
        tipo: String(datos.get('tipo')),
        titulo,
      })
      .select(COLUMNAS_PIEZA)
      .single();
    if (errorAlta || !data) {
      setEnviando(false);
      setError(traducirError(errorAlta?.message ?? 'Error desconocido'));
      return;
    }
    const pieza = data as unknown as Pieza;
    qc.setQueryData<Pieza[]>(['piezas', causaId], (lista = []) => (lista.some((p) => p.id === pieza.id) ? lista : [...lista, pieza]));
    if (link) {
      const { error: errorEnlace } = await supabase.from('enlace').insert({
        causa_id: causaId,
        entidad_id: pieza.id,
        etiqueta: String(datos.get('etiqueta') || 'original escaneado'),
        url: link,
        drive_file_id: idDeDrive(link),
      });
      if (errorEnlace) avisar(`La pieza se creó, pero el link no se guardó: ${traducirError(errorEnlace.message)}`, { tono: 'aviso' });
    }
    setEnviando(false);
    avisar(`Pieza ${pieza.numero_orden ? `Nº ${pieza.numero_orden} ` : ''}cargada. El equipo ya la ve.`);
    onCreada(pieza.id);
  }

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nueva pieza"
      descripcion="Con el título alcanza para empezar. El resto lo completás en la ficha, y se guarda solo."
    >
      <form onSubmit={crear}>
        <div className={clasesDialogo.cuerpo}>
          <div className={clasesDialogo.dosColumnas}>
            <Entrada name="numero" etiqueta="Nº de orden" placeholder={`p. ej. ${numeroSugerido}`} autoComplete="off" ayuda="Admite 2.1, 2 bis…" />
            <Selector name="tipo" etiqueta="Tipo" defaultValue="documental_secuestrada">
              {TIPOS_PIEZA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </Selector>
          </div>
          <Entrada name="titulo" etiqueta="Título o asunto" required autoFocus autoComplete="off" placeholder="Como figura en el documento o el asunto del mail" />
          <div className={clasesDialogo.dosColumnas}>
            <Selector name="etiqueta" etiqueta="El link es" defaultValue="original escaneado">
              <option value="original escaneado">Original escaneado</option>
              <option value="transcripción">Transcripción</option>
              <option value="imagen forense">Imagen forense</option>
              <option value="carpeta">Carpeta</option>
              <option value="otro">Otro</option>
            </Selector>
            <Entrada name="link" etiqueta="Link de Drive (opcional)" type="url" inputMode="url" placeholder="https://drive.google.com/…" error={errorLink} />
          </div>
          {error && <AvisoError titulo="No se pudo cargar la pieza">{error}</AvisoError>}
        </div>
        <div className={clasesDialogo.pie}>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>
            Cargar pieza
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
