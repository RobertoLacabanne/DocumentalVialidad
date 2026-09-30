---
name: diseno-con-identidad
description: Usar SIEMPRE antes de crear o modificar cualquier interfaz (pantallas, componentes, estilos, layouts) en apps web. Garantiza que la app se vea hermosa, con identidad propia y terminación profesional, y no como una plantilla genérica.
---

# Diseño con identidad

Roberto quiere apps que se vean **hermosas**, con identidad propia y terminación de producto profesional. Que sea "profesional" no justifica que se vea pobre. Si el resultado parece "otra app hecha con shadcn y Tailwind por defecto", el trabajo está mal hecho, aunque funcione perfecto.

## Por qué esto es necesario

Cuando construís en un repo, tendés a priorizar la ingeniería y a aceptar los defaults: gris neutro, azul `blue-500`, cards idénticas, Inter en todo, sin mirar nunca el resultado. Esta skill corrige eso. **El diseño es parte del entregable, no la última capa.**

## Proceso obligatorio

1. **Dirección visual antes del código.** Antes de la primera pantalla, proponé en pocas líneas un concepto con nombre (p. ej. "expediente moderno", "papel y tinta", "consultorio luminoso"), la paleta con hex, el par tipográfico y 2 o 3 rasgos distintivos que hagan reconocible la app. Esperá el OK.
2. **Tokens primero.** Definí en un solo lugar (CSS variables o el theme de Tailwind): colores semánticos (fondo, superficie, texto, texto-suave, borde, acento, éxito, alerta, peligro y un pastel por categoría), escala tipográfica, espaciado (base 4 u 8), radios, sombras y duraciones. Prohibido hardcodear colores o tamaños en los componentes.
3. **Boceto estático.** Para cada pantalla nueva e importante, primero hacé una maqueta HTML/CSS estática con contenido realista (nombres, fechas, montos verosímiles; nunca "Lorem ipsum" ni "Item 1") y mostrala.
4. **Mirá lo que hiciste.** Después de cada cambio visual, sacá capturas con Playwright (Chromium ya está instalado) en 1440×900 y 390×844, abrilas y evaluálas con la checklist de abajo. Corregí y repetí hasta que pase. No declares terminada una pantalla que no miraste.
5. **Mostrá las capturas** al terminar cada fase.

## Principios de estética

- **Jerarquía clara.** En cada pantalla hay una sola cosa más importante, y se nota. Usá contraste de tamaño y peso real (un título de 28–32 px contra un cuerpo de 14–15 px), no todo en 16 px.
- **Tipografía con carácter.** Combiná una familia de interfaz (Inter, Roboto, Plus Jakarta Sans, DM Sans) con una display o serif para títulos (Source Serif 4, Fraunces, Newsreader, DM Serif Display) cuando el tono lo pida. En números y tablas usá cifras tabulares (`font-variant-numeric: tabular-nums`). Interlineado de 1.5 en cuerpo y de 1.15–1.25 en títulos.
- **Color con intención.** Fondo apenas cálido o frío, nunca blanco puro plano ni gris muerto. Un acento principal usado con moderación. Chips y badges en pastel suave con el texto del mismo tono, más oscuro. Contraste AA como mínimo.
- **Aire.** Espaciado generoso y consistente. Agrupá con espacio antes que con bordes. Máximo de ~70 caracteres por línea en texto corrido.
- **Profundidad sutil.** Sombras suaves y en capas (dos sombras de opacidad baja en lugar de una dura), bordes de 1 px en tono del fondo y radios consistentes (8–12 px en cards, 6 px en inputs, pill en chips).
- **Detalle de terminación.** Hover, focus visible, active y disabled en todo lo que sea interactivo. Transiciones de 150–200 ms con ease-out. Skeletons al cargar. Estados vacíos con ilustración o ícono y una frase que diga qué hacer. Toasts discretos para confirmar acciones.
- **Íconos coherentes:** un solo set lineal (Lucide o Phosphor), con el mismo grosor y tamaño. Nunca emojis como íconos de interfaz.
- **Tablas bien hechas:** encabezado gris suave y pegajoso, filas de 40–44 px, zebra muy tenue o separadores finos, números alineados a la derecha, hover de fila, y columnas con ancho pensado para el contenido.

## Gusto de Roberto (respetar siempre)

- Estética **clara** y luminosa. Las bandas y los fondos oscuros le resultan "tétricos": el modo oscuro solo si lo pide.
- Le gusta la claridad tipo Google Sheets (Roboto, encabezados grises, chips pastel), pero con más personalidad y terminación.
- Todo en castellano rioplatense, con textos de interfaz cortos, cálidos y claros.

## Anti-patrones (si aparecen, está mal)

- El look default de shadcn/ui o Tailwind sin personalizar: gris `slate`, azul `blue-500`, cards blancas idénticas en grilla.
- Degradados violetas o azules "de IA", glassmorphism gratuito, sombras negras duras.
- Todo centrado, o todo el mismo tamaño de letra.
- Dashboards llenos de cards de KPI iguales sin jerarquía.
- Placeholders genéricos, textos en inglés y botones que dicen "Submit".
- Pantallas sin estado vacío, sin estado de carga o sin feedback al guardar.

## Checklist antes de dar por terminada una pantalla

1. ¿Se reconoce la identidad de la app sin ver el logo?
2. ¿La jerarquía se entiende en 3 segundos?
3. ¿Tokens usados en todo, sin valores sueltos?
4. ¿Espaciado consistente y con aire?
5. ¿Estados de hover, focus, vacío, carga y error resueltos?
6. ¿Se ve bien en 1440 px y en 390 px, sin scroll horizontal?
7. ¿Contraste AA?
8. ¿La mirarías y dirías "qué linda", y no solo "funciona"?

Si alguna respuesta es "no", iterá antes de avanzar.
