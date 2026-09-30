import { Check, Copy, ExternalLink, FileSearch, Pencil, Plus, UserPlus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Boton } from '../componentes/Boton';
import { AreaTexto, Entrada, Selector } from '../componentes/campos';
import { AvisoError, EstadoVacio, FilasEsqueleto, IndicadorGuardado } from '../componentes/estados';
import { Dato, Datos, Nada, Parrafo, Seccion, TextoInterpretacion } from '../componentes/Ficha';
import {
  Avatar,
  Chip,
  ChipTipo,
  EstadoProcesal,
  EtiquetaEfecto,
  Falta,
  MarcaSugerencia,
  PilaAvatares,
  Relevancia,
  Sello,
} from '../componentes/marcas';
import { CerrarPanel, FilaPanel, PanelLateral } from '../componentes/PanelLateral';
import { TablaPiezas, type FilaIndice } from '../componentes/TablaPiezas';
import { TarjetaKanban } from '../componentes/TarjetaKanban';
import { useToast } from '../componentes/Toast';
import { armarCita } from '../lib/cita';
import s from './PaginaDiseno.module.css';
import { SeccionIlustraciones } from './SeccionIlustraciones';

// ---------------------------------------------------------------------
// Ejemplos: solo nombres y números que figuran en el prompt maestro.
// Lo que no figura se muestra como [completar]. Relevancias, responsables
// y estados son ilustrativos.
// ---------------------------------------------------------------------
function muestra(p: Partial<FilaIndice> & Pick<FilaIndice, 'id' | 'titulo'>): FilaIndice {
  return {
    causa_id: 'ejemplo',
    numero_orden: null,
    orden_clave: null,
    tipo: 'documental_secuestrada',
    fecha_desde: null,
    fecha_hasta: null,
    fecha_precision: 'sin_fecha',
    autor: null,
    destinatarios: null,
    resumen: null,
    observaciones_analista: null,
    efecto_id: null,
    sobre: null,
    lugar_secuestro: null,
    fecha_secuestro: null,
    informe_id: null,
    fojas: null,
    conversacion_id: null,
    mensaje_id: null,
    relevancia: null,
    estado_trabajo: 'pendiente',
    responsable: null,
    etiquetas: [],
    origen: null,
    creado_en: '2026-09-26T12:00:00Z',
    creado_por: null,
    actualizado_en: '2026-09-26T12:00:00Z',
    actualizado_por: null,
    version: 1,
    archivado_en: null,
    archivado_por: null,
    efecto_numero: null,
    informe_numero: null,
    situacion: null,
    responsable_alias: null,
    ...p,
  };
}

const EJEMPLOS: FilaIndice[] = [
  muestra({ id: 'e1', numero_orden: '1', tipo: 'expediente_administrativo', titulo: 'Expte. 154782 – LP 05/2020', autor: 'Dirección Provincial de Vialidad', relevancia: 'alta', responsable: 'carli', responsable_alias: 'CARLI' }),
  muestra({ id: 'e2', numero_orden: '2', tipo: 'mensaje_conversacion', titulo: 'Conversación Meynet – Gervasoni', autor: 'Meynet', destinatarios: 'Gervasoni', relevancia: 'alta', responsable: 'rober', responsable_alias: 'ROBER' }),
  muestra({ id: 'e3', numero_orden: '2.1', tipo: 'mensaje_conversacion', mensaje_id: 'm', titulo: 'Mensaje sobre el reparto de la cotización', autor: 'Gervasoni', destinatarios: 'Meynet', relevancia: 'alta', responsable: 'rober', responsable_alias: 'ROBER' }),
  muestra({ id: 'e4', numero_orden: '3', tipo: 'mensaje_conversacion', titulo: 'Conversación Meynet – Difiori', autor: 'Meynet', destinatarios: 'Difiori', relevancia: 'media', responsable: 'agus', responsable_alias: 'AGUS' }),
  muestra({ id: 'e5', numero_orden: '4', tipo: 'mensaje_conversacion', titulo: 'Conversación Meynet – Fernández (Equivial)', autor: 'Meynet', destinatarios: 'Fernández', relevancia: 'media', responsable: 'agus', responsable_alias: 'AGUS' }),
  muestra({ id: 'e6', numero_orden: '5', tipo: 'mensaje_conversacion', titulo: 'Conversación Meynet – “Emiliano” (contacto sin identificar)', autor: 'Meynet', relevancia: 'media', responsable: 'ines', responsable_alias: 'INES' }),
  muestra({
    id: 'e7',
    numero_orden: '11',
    tipo: 'extraccion_forense',
    titulo: 'Extracción de teléfono celular',
    relevancia: 'alta',
    responsable: 'rober',
    responsable_alias: 'ROBER',
    situacion: { pieza_id: 'e7', situacion: 'pendiente_resolucion', gravedad: 2, titulo: 'Extracción suspendida · casación', incidencia_id: 'i', via: 'efecto' },
  }),
  muestra({ id: 'e8', numero_orden: '14', tipo: 'otro', titulo: 'Acta de allanamiento – DPV', fecha_desde: '2025-10-28', fecha_precision: 'dia', relevancia: 'alta', responsable: 'ines', responsable_alias: 'INES' }),
  muestra({ id: 'e9', numero_orden: '19', titulo: 'Agenda 2021', efecto_numero: '48435', informe_numero: 'C6855', relevancia: 'media', responsable: 'ines', responsable_alias: 'INES' }),
  muestra({ id: 'e10', numero_orden: '23', titulo: 'Documentación del Efecto 48436', efecto_numero: '48436' }),
];

const COLORES: { grupo: string; tokens: [string, string][] }[] = [
  {
    grupo: 'Superficies',
    tokens: [
      ['--color-fondo', 'Papel: fondo general'],
      ['--color-superficie', 'Tablas, fichas, paneles'],
      ['--color-riel', 'Riel lateral'],
      ['--color-cabecera', 'Encabezados de tabla'],
      ['--color-borde', 'Bordes y divisiones'],
      ['--color-seleccion', 'Fila seleccionada'],
    ],
  },
  {
    grupo: 'Tinta y acento',
    tokens: [
      ['--color-texto', 'Texto y botón primario'],
      ['--color-texto-suave', 'Texto secundario'],
      ['--color-texto-tenue', 'Rótulos y ayudas'],
      ['--color-acento', 'Links, foco, selección'],
    ],
  },
  {
    grupo: 'Semánticos',
    tokens: [
      ['--color-exito', 'Guardado, en línea'],
      ['--color-alerta', 'Vencimientos, sin conexión'],
      ['--color-peligro', 'Lacre: solo alertas procesales'],
      ['--color-falta-borde', 'Dato faltante'],
      ['--color-nota-fondo', 'Interpretación del analista'],
    ],
  },
  {
    grupo: 'Familias de pieza',
    tokens: [
      ['--cat-documental-fondo', 'Documental'],
      ['--cat-pericial-fondo', 'Pericial y forense'],
      ['--cat-mensaje-fondo', 'Mensajes y correos'],
      ['--cat-contratacion-fondo', 'Contratación'],
      ['--cat-persona-fondo', 'Persona o empresa'],
      ['--cat-otros-fondo', 'Otros'],
    ],
  },
];

const SECCIONES = [
  ['colores', 'Colores'],
  ['tipografia', 'Tipografía'],
  ['espacio', 'Espacio y forma'],
  ['marcas', 'Marcas de identidad'],
  ['controles', 'Botones y campos'],
  ['tabla', 'Tabla del índice'],
  ['ficha', 'Panel lateral y ficha'],
  ['kanban', 'Tarjeta de efecto'],
  ['estados', 'Estados'],
  ['ilustraciones', 'Ilustraciones'],
] as const;

function Bloque({ id, titulo, bajada, children }: { id: string; titulo: string; bajada?: string; children: ReactNode }) {
  return (
    <section id={id} className={s.seccion}>
      <div>
        <h2 className={s.seccionTitulo}>{titulo}</h2>
        {bajada && <p className={s.seccionBajada}>{bajada}</p>}
      </div>
      {children}
    </section>
  );
}

function MuestraColor({ token, uso }: { token: string; uso: string }) {
  const [hex, setHex] = useState('');
  useEffect(() => {
    setHex(getComputedStyle(document.documentElement).getPropertyValue(token).trim());
  }, [token]);
  return (
    <div className={s.muestra}>
      <div className={s.color} style={{ background: `var(${token})` }} />
      <div className={s.muestraNombre}>{uso}</div>
      <div className={s.muestraDato}>
        <span>{token.replace('--color-', '').replace('--cat-', '')}</span>
        <span>{hex}</span>
      </div>
    </div>
  );
}

export function PaginaDiseno() {
  const { avisar } = useToast();
  const [densidad, setDensidad] = useState<'comoda' | 'compacta'>('comoda');
  const [seleccionada, setSeleccionada] = useState<string | null>('e9');
  const cita = armarCita(null, { efecto: '48435', titulo: 'Agenda 2021', informe: 'C6855', numero: '19' });

  return (
    <main className={s.pagina}>
      <header className={s.cabecera}>
        <div className={s.marca}>
          <img src="/sello.svg" alt="" />
          Tablero de Prueba · UFIL Paraná
        </div>
        <span className={s.eyebrow}>Sistema de diseño · Fase 0</span>
        <h1 className={s.titular}>Expediente moderno</h1>
        <p className={s.bajada}>
          Sobrio e institucional, pero cálido. Papel, tinta azul y lacre: la estética de un legajo bien foliado, con la
          claridad de una planilla y la terminación de una herramienta profesional.
        </p>
        <div className={s.rasgos}>
          <div className={s.rasgo}>
            <strong>Foliado</strong>
            <span>Números de orden en sello y efectos como etiquetas de secuestro. Se reconocen sin leer.</span>
          </div>
          <div className={s.rasgo}>
            <strong>Dato e interpretación</strong>
            <span>Lo que dice el documento va en sans; lo que piensa el analista, en serif itálica sobre nota.</span>
          </div>
          <div className={s.rasgo}>
            <strong>Lacre con significado</strong>
            <span>El rojo aparece solo cuando hay un problema procesal. Si lo ves, prestá atención.</span>
          </div>
        </div>
        <p className={s.aviso}>
          Los ejemplos de esta página usan nombres y números que figuran en el prompt del proyecto. Lo que no figura se
          muestra como [completar]. Relevancias, responsables y estados son ilustrativos.
        </p>
      </header>

      <div className={s.cuerpo}>
        <nav className={s.indice} aria-label="Secciones del sistema de diseño">
          {SECCIONES.map(([id, nombre]) => (
            <a key={id} href={`#${id}`}>
              {nombre}
            </a>
          ))}
        </nav>

        <div className={s.secciones}>
          <Bloque id="colores" titulo="Colores" bajada="Todos los pares de texto y fondo superan el contraste AA (4,5:1). Los componentes solo usan estos tokens.">
            {COLORES.map((g) => (
              <div key={g.grupo} className={s.grupo}>
                <h3 className={s.grupoTitulo}>{g.grupo}</h3>
                <div className={s.muestras}>
                  {g.tokens.map(([token, uso]) => (
                    <MuestraColor key={token} token={token} uso={uso} />
                  ))}
                </div>
              </div>
            ))}
          </Bloque>

          <Bloque id="tipografia" titulo="Tipografía" bajada="Inter para interfaz y tablas, con cifras tabulares. Source Serif 4 para carátulas, títulos de ficha y la voz del analista.">
            <div className={`${s.panelBlanco} ${s.escala}`}>
              {[
                ['Carátula · 36', <span style={{ fontFamily: 'var(--fuente-titulos)', fontSize: 'var(--texto-4xl)', fontWeight: 600, letterSpacing: '-0.02em' }}>Legajo 299113</span>],
                ['Pantalla · 28', <span style={{ fontSize: 'var(--texto-3xl)', fontWeight: 600, letterSpacing: '-0.015em' }}>Índice de prueba</span>],
                ['Ficha · 22 serif', <span style={{ fontFamily: 'var(--fuente-titulos)', fontSize: 'var(--texto-2xl)', fontWeight: 600 }}>Agenda 2021</span>],
                ['Cuerpo · 14', <span>Una fila por pieza, con su origen, su estado y quién la trabaja.</span>],
                ['Tabla · 13', <span style={{ fontSize: 'var(--texto-sm)', fontVariantNumeric: 'tabular-nums' }}>48435 · 154782 · 2.1 · 28/10/2025</span>],
                ['Rótulo · 11', <span className="rotulo">Datos del documento</span>],
                ['Analista · 15', <span style={{ fontFamily: 'var(--fuente-titulos)', fontStyle: 'italic', fontSize: 'var(--texto-lg)', color: 'var(--color-texto-suave)' }}>La interpretación nunca se confunde con el dato.</span>],
              ].map(([dato, ejemplo], i) => (
                <div key={i} className={s.escalaFila}>
                  <span className={s.escalaDato}>{dato}</span>
                  {ejemplo}
                </div>
              ))}
            </div>
          </Bloque>

          <Bloque id="espacio" titulo="Espacio y forma" bajada="Espaciado en base 4. Radios de 12 px en tarjetas, 6 px en campos, píldora en chips. Sombras suaves, en capas y teñidas de tinta.">
            <div className={s.panelBlanco}>
              <div className={s.espacios}>
                {[4, 8, 12, 16, 24, 32, 48, 64].map((n) => (
                  <div key={n} className={s.espacio}>
                    <span style={{ width: n, height: n }} />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
              <div className={s.cajas}>
                <div className={s.caja} style={{ borderRadius: 'var(--radio-xs)' }}>sello · 3</div>
                <div className={s.caja} style={{ borderRadius: 'var(--radio-sm)' }}>campo · 6</div>
                <div className={s.caja} style={{ borderRadius: 'var(--radio-lg)', boxShadow: 'var(--sombra-1)' }}>tarjeta · 12</div>
                <div className={s.caja} style={{ borderRadius: 'var(--radio-lg)', boxShadow: 'var(--sombra-2)' }}>sombra 2</div>
                <div className={s.caja} style={{ borderRadius: 'var(--radio-lg)', boxShadow: 'var(--sombra-3)' }}>sombra 3</div>
              </div>
            </div>
          </Bloque>

          <Bloque id="marcas" titulo="Marcas de identidad" bajada="Las piezas chicas que hacen reconocible la app.">
            <div className={s.panelBlanco}>
              <div className={s.grupo}>
                <h3 className={s.grupoTitulo}>Chips por familia de pieza</h3>
                <div className={s.fila}>
                  <ChipTipo tipo="documental_secuestrada" />
                  <ChipTipo tipo="expediente_administrativo" />
                  <ChipTipo tipo="informe_pericial" />
                  <ChipTipo tipo="extraccion_forense" />
                  <ChipTipo tipo="mensaje_conversacion" />
                  <ChipTipo tipo="correo_electronico" />
                  <Chip familia="contratacion">LP 05/2020</Chip>
                  <Chip familia="persona">Meynet</Chip>
                  <ChipTipo tipo="testimonial" />
                </div>
              </div>
              <div className={s.grupo}>
                <h3 className={s.grupoTitulo}>Foliado: orden 2 &lt; 2.1 &lt; 2.2 &lt; 2 bis &lt; 2 ter &lt; 3</h3>
                <div className={s.fila}>
                  {['2', '2.1', '2.2', '2 bis', '2 ter', '3'].map((n) => (
                    <Sello key={n} numero={n} />
                  ))}
                  <Sello numero="19" grande />
                  <Sello numero={null} />
                </div>
                <div className={s.fila}>
                  <EtiquetaEfecto numero="48435" />
                  <EtiquetaEfecto numero="48436" />
                  <EtiquetaEfecto numero="48438" />
                </div>
              </div>
              <div className={s.grupo}>
                <h3 className={s.grupoTitulo}>Situación procesal (lacre)</h3>
                <div className={s.fila}>
                  <EstadoProcesal situacion="admisibilidad_cuestionada" />
                  <EstadoProcesal situacion="pendiente_resolucion" />
                  <EstadoProcesal situacion="excluida" />
                </div>
              </div>
              <div className={s.grupo}>
                <h3 className={s.grupoTitulo}>Relevancia, faltantes y sugerencias</h3>
                <div className={s.fila}>
                  <Relevancia valor="alta" />
                  <Relevancia valor="media" />
                  <Relevancia valor="baja" />
                  <Relevancia valor="descartada" />
                  <Relevancia valor={null} />
                  <Falta />
                  <MarcaSugerencia />
                </div>
              </div>
              <div className={s.grupo}>
                <h3 className={s.grupoTitulo}>Equipo</h3>
                <div className={s.fila}>
                  <Avatar texto="ROBER" email="rober" enLinea />
                  <Avatar texto="INES" email="ines" enLinea />
                  <Avatar texto="CARLI" email="carli" />
                  <Avatar texto="AGUS" email="agus" />
                  <Avatar texto="Fiscal" email="fiscal" />
                  <PilaAvatares>
                    <Avatar texto="ROBER" email="rober" tamano="chico" />
                    <Avatar texto="INES" email="ines" tamano="chico" />
                    <Avatar texto="CARLI" email="carli" tamano="chico" />
                  </PilaAvatares>
                </div>
              </div>
            </div>
          </Bloque>

          <Bloque id="controles" titulo="Botones y campos" bajada="Hover, foco visible, activo, cargando y deshabilitado en todo lo que se toca.">
            <div className={s.panelBlanco}>
              <div className={s.fila}>
                <Boton variante="primario" icono={<Plus aria-hidden />}>Nueva pieza</Boton>
                <Boton icono={<Copy aria-hidden />}>Copiar cita</Boton>
                <Boton icono={<Check aria-hidden />} hecho>Copiada</Boton>
                <Boton variante="fantasma" icono={<Pencil aria-hidden />}>Editar</Boton>
                <Boton variante="peligro">Archivar</Boton>
                <Boton cargando>Guardando</Boton>
                <Boton disabled icono={<ExternalLink aria-hidden />}>Sin link</Boton>
                <Boton tamano="chico" icono={<UserPlus aria-hidden />}>Invitar</Boton>
              </div>
              <div className={s.fila}>
                <IndicadorGuardado estado={{ tipo: 'guardado', cuando: new Date(Date.now() - 2000) }} />
                <IndicadorGuardado estado={{ tipo: 'guardando' }} />
                <IndicadorGuardado estado={{ tipo: 'sin_conexion', enCola: 2 }} />
                <IndicadorGuardado estado={{ tipo: 'error', mensaje: 'Ejemplo' }} />
              </div>
              <div className={s.dosCol}>
                <Entrada etiqueta="Título o asunto" defaultValue="Agenda 2021" />
                <Selector etiqueta="Tipo" defaultValue="documental_secuestrada">
                  <option value="documental_secuestrada">Documental secuestrada</option>
                  <option value="informe_pericial">Informe pericial</option>
                </Selector>
                <Entrada etiqueta="Fojas" placeholder="Como figuran: 12, 12/14, 12 vta." ayuda="Admite rangos y vueltas." />
                <Entrada etiqueta="Link de Drive" defaultValue="drive.google.com/archivo" error="Pegá el link completo, que empiece con https://" />
              </div>
              <AreaTexto etiqueta="Resumen del contenido" placeholder="Qué dice el documento, sin interpretar." />
              <div className={s.fila}>
                <Boton onClick={() => avisar('Pieza Nº 24 cargada. El equipo ya la ve.')}>Mostrar aviso</Boton>
                <Boton
                  onClick={() =>
                    avisar('Pieza archivada.', { accion: { texto: 'Deshacer', alHacer: () => avisar('Se restauró.') }, duracion: 7000 })
                  }
                >
                  Aviso con deshacer
                </Boton>
              </div>
            </div>
          </Bloque>

          <Bloque id="tabla" titulo="Tabla del índice" bajada="Encabezado gris y fijo, orden jerárquico, sello foliado, franja de lacre si hay alerta, presencia del equipo. Se mueve con flechas y se abre con Enter. En el celular, cada fila es una tarjeta.">
            <div className={s.marcoTabla}>
              <div className={s.marcoTablaBarra}>
                <span>{EJEMPLOS.length} piezas de ejemplo · orden jerárquico por Nº</span>
                <span className={s.fila}>
                  <Boton tamano="chico" variante={densidad === 'comoda' ? 'primario' : 'secundario'} onClick={() => setDensidad('comoda')}>
                    Cómoda
                  </Boton>
                  <Boton tamano="chico" variante={densidad === 'compacta' ? 'primario' : 'secundario'} onClick={() => setDensidad('compacta')}>
                    Compacta
                  </Boton>
                </span>
              </div>
              <TablaPiezas
                filas={EJEMPLOS}
                seleccionada={seleccionada}
                onSeleccionar={setSeleccionada}
                densidad={densidad}
                viendo={{ e3: [{ alias: 'INES', email: 'ines' }] }}
              />
            </div>
          </Bloque>

          <Bloque id="ficha" titulo="Panel lateral y ficha" bajada="Se abre al hacer clic en una fila. Los datos objetivos arriba; la interpretación, aparte y con otra voz. Lo que falta se ve.">
            <div className={s.panelMuestra}>
              <PanelLateral
                etiqueta="Ficha de ejemplo"
                onCerrar={() => undefined}
                encabezado={
                  <>
                    <FilaPanel>
                      <Sello numero="19" grande />
                      <ChipTipo tipo="documental_secuestrada" />
                      <CerrarPanel onCerrar={() => undefined} />
                    </FilaPanel>
                    <h2 style={{ fontFamily: 'var(--fuente-titulos)', fontSize: 'var(--texto-3xl)', fontWeight: 600, lineHeight: 1.15 }}>Agenda 2021</h2>
                    <div className={s.fila}>
                      <Boton variante="primario" icono={<ExternalLink aria-hidden />}>Abrir en Drive</Boton>
                      <Boton icono={<Copy aria-hidden />}>Copiar cita</Boton>
                      <Boton icono={<Pencil aria-hidden />}>Editar</Boton>
                    </div>
                  </>
                }
              >
                <Seccion titulo="Datos del documento" naturaleza="dato">
                  <Datos>
                    <Dato etiqueta="Fecha"><Falta /></Dato>
                    <Dato etiqueta="Autor"><Falta /></Dato>
                    <Dato etiqueta="Destinatarios"><Nada /></Dato>
                    <Dato etiqueta="Fojas"><Falta /></Dato>
                  </Datos>
                  <Parrafo>Resumen del contenido: <Falta /></Parrafo>
                </Seccion>
                <Seccion titulo="Origen" naturaleza="dato">
                  <Datos>
                    <Dato etiqueta="Efecto"><EtiquetaEfecto numero="48435" /></Dato>
                    <Dato etiqueta="Sobre"><Falta /></Dato>
                    <Dato etiqueta="Informe">C6855</Dato>
                  </Datos>
                </Seccion>
                <Seccion titulo="Observaciones del analista" naturaleza="interpretacion">
                  <TextoInterpretacion>Todavía no hay observaciones. Tocá «Editar» para escribir por qué importa esta pieza.</TextoInterpretacion>
                </Seccion>
                <Seccion titulo="Cita para escritos">
                  <div style={{ fontFamily: 'var(--fuente-titulos)', background: 'var(--color-fondo)', border: '1px solid var(--color-borde)', borderRadius: 'var(--radio-sm)', padding: '10px 12px' }}>
                    {cita}
                  </div>
                </Seccion>
              </PanelLateral>
            </div>
          </Bloque>

          <Bloque id="kanban" titulo="Tarjeta de efecto" bajada="Para el tablero de efectos de la Fase 1: etiqueta de secuestro, material, responsable y semáforo procesal.">
            <div className={s.tablero}>
              <div className={s.columna}>
                <div className={s.columnaTitulo}><span>Sin iniciar</span><span>1</span></div>
                <TarjetaKanban numero="48436" soporte="papel" material="Documentación varia" descripcion={null} fojas={null} responsable={null} situacion={null} />
              </div>
              <div className={s.columna}>
                <div className={s.columnaTitulo}><span>En proceso</span><span>1</span></div>
                <TarjetaKanban numero="48435" soporte="papel" material="Manuscritos" descripcion="Agenda 2021" fojas={null} responsable={{ alias: 'INES', email: 'ines' }} situacion={null} prioridadAlta piezas={1} />
              </div>
              <div className={s.columna}>
                <div className={s.columnaTitulo}><span>Observado</span><span>1</span></div>
                <TarjetaKanban numero="48438" soporte="digital" material="Dispositivo" descripcion={null} fojas={null} responsable={{ alias: 'ROBER', email: 'rober' }} situacion="pendiente_resolucion" />
              </div>
            </div>
          </Bloque>

          <Bloque id="estados" titulo="Estados" bajada="Toda pantalla resuelve el vacío, la carga y el error con una frase que dice qué hacer.">
            <div className={s.estados}>
              <div>
                <EstadoVacio icono={<FileSearch />} titulo="Todavía no hay piezas" accion={<Boton variante="primario" icono={<Plus aria-hidden />}>Cargar la primera pieza</Boton>}>
                  Cargá cada documento como una fila, con su número de orden y el link al Drive.
                </EstadoVacio>
              </div>
              <div>
                <FilasEsqueleto filas={5} />
              </div>
              <div style={{ padding: 'var(--esp-5)' }}>
                <AvisoError titulo="No pudimos traer el índice" accion={<Boton>Probar de nuevo</Boton>}>
                  Revisá la conexión a internet. Lo que estabas cargando quedó en cola y se guarda al volver.
                </AvisoError>
              </div>
            </div>
          </Bloque>

          <Bloque
            id="ilustraciones"
            titulo="Ilustraciones"
            bajada="«La Bajada»: una serie en acuarela del Litoral, pintada con código sobre el papel de la app y horneada a imágenes. Es la identidad artística: vive donde no hay datos y nunca compite con la lectura."
          >
            <SeccionIlustraciones />
          </Bloque>
        </div>
      </div>
    </main>
  );
}
