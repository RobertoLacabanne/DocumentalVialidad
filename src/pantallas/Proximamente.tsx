import { useParams } from 'react-router-dom';
import { EstadoVacio } from '../componentes/estados';
import { SECCIONES } from './Marco';
import s from './Paginas.module.css';

const QUE_TRAE: Record<string, string[]> = {
  inicio: ['Números clave de la causa y avance por responsable', 'Pendientes y vencimientos', 'Actividad reciente del equipo'],
  efectos: ['Tablero por estado (sin iniciar, en proceso, escaneado, finalizado, observado)', 'Vista de tabla agrupable por allanamiento', 'Importación de LISTADO EFECTOS y DISTRIBUCIÓN DE TAREAS'],
  personas: ['Directorio de personas y empresas', 'Todas las apariciones de cada una', 'Alias y teléfonos como figuran en los celulares'],
  contrataciones: ['Una ficha por licitación con la cronología del trámite', 'Cuadro comparativo de ofertas', 'Piezas y mensajes vinculados'],
  mensajes: ['Lector de conversaciones tipo chat', 'Marcado de mensajes relevantes', 'Informe de relevamiento en .docx'],
  cronologia: ['Línea de tiempo de piezas, mensajes y trámites', 'Filtro por persona o contratación', 'Exportación a PDF'],
  juicio: ['Punteo y ofrecimiento de prueba', 'Alertas por admisibilidad y testigos', 'Listado para la remisión a juicio'],
};

export function Proximamente() {
  const { seccion = '' } = useParams();
  const datos = SECCIONES.find((x) => x.ruta === seccion);
  if (!datos) return null;
  return (
    <div className={s.proximamente}>
      <EstadoVacio icono={datos.icono} titulo={`${datos.etiqueta} llega en la Fase ${datos.fase}`}>
        Mientras tanto, todo se carga en el Índice de prueba. Esta sección va a traer:
      </EstadoVacio>
      <ul className={s.lista} style={{ maxWidth: 460, marginInline: 'auto' }}>
        {(QUE_TRAE[seccion] ?? []).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
