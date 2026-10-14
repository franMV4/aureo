# Lingote: plan de estilos v3 (vidrio)

Sustituye a la dirección "cabina de aviónica". Lo pide el usuario: barra lateral, vidrio tipo Apple Liquid Glass, aspecto más moderno, gráfico con eje estrecho como TradingView y jerarquía clara entre títulos, etiquetas y cifras.

## 1. Qué falla ahora

| Problema | Causa | Arreglo |
|---|---|---|
| El gráfico de Hoy crece hacia abajo sin fin | El PFD se estira con `flex: 1` dentro de la rejilla, y el SVG de la cinta toma su alto del `viewBox`: cada redibujado suma píxeles | Alto fijo para el gráfico y la cinta propia fuera; se usa el eje de precios de lightweight-charts |
| La cinta derecha ocupa 168 px | Instrumento propio | Eje nativo de unos 64 px, como TradingView, con los niveles como etiquetas de color en el eje |
| Etiquetas y cifras se confunden ("Movimiento esperado ±46 $ 17,4 %…") | Etiqueta de 10 px en mayúsculas, cifra de 15 px y nota de 11 px casi del mismo gris | Escala nueva: etiqueta de 12 px en gris medio, cifra de 24 px seminegrita en blanco, nota de 12 px en gris tenue y con más aire |
| Los títulos de panel no destacan | Mayúsculas de 11 px | Título de 15 px seminegrita en blanco, con icono a la izquierda |
| Las secciones se funden | Todos los paneles iguales sobre el mismo negro | Tres niveles de vidrio, grupos con título de sección y más separación entre grupos que dentro de ellos |
| "Cómo leer esto" se mezcla con los datos | Enlace de texto encima de las cifras | Botón de información (i) en la cabecera del panel; la ayuda se despliega en una nota de vidrio |
| Sin barra lateral | Se quitó en la v2 | Barra lateral flotante de vidrio con iconos y texto |

## 2. Dirección

**Una mesa de trading en vidrio oscuro**: paneles de vidrio esmerilado flotando sobre un fondo grafito con dos luces muy suaves (oro arriba a la izquierda, azul abajo a la derecha). Esas luces son las que el vidrio refracta: sin ellas no hay vidrio. Es una aproximación web al Liquid Glass de Apple (con `backdrop-filter`, bordes de luz y reflejos), no el material oficial, que solo existe en sus plataformas.

Se queda de la v2: el contenido, las funciones, el color con significado fijo y la honestidad del backtest. Se va: la cinta de aviónica, las teclas físicas, la tipografía B612 y las mayúsculas en todo.

## 3. Sistema

### Fondo y materiales

| Token | Uso | Valor |
|---|---|---|
| `--bg` | Fondo de página | `#0a0b0f` con dos campos radiales fijos: oro `rgba(230,180,80,.16)` en la esquina superior izquierda y azul `rgba(10,132,255,.12)` en la inferior derecha |
| Vidrio 1 · `--glass` | Paneles | `rgba(30,32,40,.55)` + `blur(28px) saturate(170%)` |
| Vidrio 2 · `--glass-strong` | Barra lateral, barra de pestañas del móvil, cabecera de grupo | `rgba(24,26,33,.72)` + `blur(36px) saturate(180%)` |
| Vidrio 3 · `--glass-inset` | Lecturas, tarjetas de escenario, campos y celdas dentro de un panel | `rgba(255,255,255,.04)`, sin desenfoque (el panel ya lo tiene) |
| Borde de luz | Todo el vidrio | Borde interior de 1px `rgba(255,255,255,.08)`, más una luz superior `inset 0 1px 0 rgba(255,255,255,.10)` y una sombra `0 12px 32px rgba(0,0,0,.35)` |
| Respaldo | `prefers-reduced-transparency` o sin `backdrop-filter` | Vidrio opaco `#17191f` |

### Color: significado fijo, ahora con la paleta de Apple

| Rol | Color | Dónde |
|---|---|---|
| Marca y niveles calculados | Oro `#e6b450` | Logo, elemento activo de la barra lateral, niveles en el gráfico y la tabla |
| Lo tuyo | Azul `#0a84ff` | Tu plan en el gráfico, el foco, el control seleccionado y la acción principal |
| Sube / normal | Verde `#30d158` | Cifras al alza, sesión activa y probabilidades |
| Baja / aviso | Rojo `#ff453a` | Cifras a la baja y dato en menos de 15 min |
| Precaución | Naranja `#ff9f0a` | Dato rojo próximo, dato retrasado y veredicto "confluencia" |
| Texto | `#f2f2f5` / `#a1a1aa` / `#71717a` | Cifras y títulos / etiquetas / notas |

La paleta de los gráficos (oro, azul y rosa) se valida con el comprobador de dataviz sobre `#1a1c22` antes de usarla.

### Tipografía

Geist para la interfaz y Geist Mono solo para los ejes, todo con cifras tabulares. Sin mayúsculas salvo las siglas.

| Nivel | Tamaño / peso | Uso |
|---|---|---|
| Página | 26 px / 600, interletrado −0,02em | "Hoy", "Oro" |
| Sección | 13 px / 600, gris medio, con una línea fina a la derecha | Separa los grupos: "Mercado ahora", "Plan del día", "Riesgo y agenda" |
| Panel | 15 px / 600, blanco, icono de 16 px | Título de cada panel |
| Cifra grande | 28–34 px / 600 | Precio del oro en la franja de estado |
| Cifra | 22 px / 600 | Lecturas (movimiento esperado, ATR, VaR…) |
| Etiqueta | 12 px / 500, gris medio | Encima de cada cifra |
| Nota | 12 px / 400, gris tenue | Debajo de la cifra, separada 4 px |
| Cuerpo | 14 px / 400, interlineado 1,55, máximo 72ch | Lecturas y ayudas |

### Forma y espacio

- Radios concéntricos: 20 px en los paneles, 12 px en lo de dentro, cápsula en controles pequeños (filtros, segmentos, pestañas del móvil).
- Espaciado: 8 px dentro de un grupo de datos, 16 px entre paneles, 32 px entre secciones y 20 px de relleno en los paneles.

## 4. Estructura

- **Barra lateral flotante** (escritorio, 232 px, separada 12 px del borde, de vidrio 2):
  - Arriba: logo y precio del oro en vivo.
  - En medio: Hoy, Oro, Mercados, Agenda, Diario y Método, cada uno con icono Phosphor. El activo va en una cápsula de vidrio con el icono en oro.
  - Abajo: estado de los datos, reloj de Madrid y botón de daltonismo.
- **Móvil (menos de 900 px):** la barra lateral se oculta y aparece una barra de pestañas flotante en cápsula de vidrio (5 iconos con texto). Método pasa a la cabecera.
- **Hoy en tres secciones:**
  1. **Mercado ahora:**
     - Una franja de 5 tarjetas de estado: precio (cifra grande), sesión, régimen, balanza y próximo aviso.
     - Debajo, el gráfico de 15 min (8 columnas, 460 px de alto fijo) y los niveles (4 columnas, lista con el mismo alto y desplazamiento propio).
  2. **Plan del día:**
     - A la izquierda, en 5 columnas, los escenarios y Mi plan.
     - A la derecha, en 7 columnas, la balanza de factores.
  3. **Riesgo y agenda:** riesgo con la calculadora, eventos y titulares, en 4 columnas cada uno.
- **Oro:** control segmentado en cápsula para las 7 páginas y la línea de lectura en una nota de vidrio con icono.
- **Mercados, Agenda, Diario, Método y ficha:** mismos paneles y filtros en cápsula. Las tablas usan filas con fondo de vidrio 3 al pasar el ratón.

## 5. Gráfico estilo TradingView

- lightweight-charts con su **eje de precios a la derecha** (unos 64 px), en Geist Mono de 11 px.
- **Niveles:**
  - Líneas de precio en oro: continuas las fuertes y discontinuas las débiles.
  - Cada una lleva una **etiqueta de color en el eje** y su título corto dentro del gráfico ("Máx. ayer").
- **Tu plan:** líneas azules (entrada e invalidación).
- **Movimiento esperado:** dos líneas verdes punteadas, ±1σ desde la apertura.
- El último precio usa la etiqueta nativa del eje.
- Pasar el ratón por un nivel de la tabla engrosa su línea; pasarlo por el gráfico no hace nada nuevo.
- Alto fijo de 460 px en escritorio y 340 px en móvil. La rueda del ratón desplaza la página.

## 6. Componentes

- **Panel:**
  - Vidrio 1 con radio de 20 px.
  - Cabecera con icono, título y, a la derecha, la nota tenue y el botón (i).
  - Sin línea bajo la cabecera: la separa el espacio.
- **Lectura:**
  - Tarjeta de vidrio 3 (radio de 12 px) con etiqueta, cifra y nota.
  - Si la cifra tiene color, se pone un punto de 6 px junto a la etiqueta. La cifra sigue en blanco salvo cuando el color tiene significado (sube, baja, precaución).
- **Escenario:** tarjeta de vidrio 3 con una barra de color de 3 px a la izquierda (verde al alza, rojo a la baja). Precios grandes y la probabilidad en cápsulas.
- **Indicador de factor:** pista en cápsula de 6 px con el centro marcado y un relleno verde o rojo, con trama si va en contra del total. Puntuación en una cápsula.
- **Controles:**
  - Cápsulas de vidrio 3; la seleccionada en azul con texto blanco.
  - La acción principal es una cápsula azul sólida.
- **Campos:** vidrio 3 con radio de 12 px y anillo azul al enfocar; se quitan los corchetes.
- **Etiquetas de aviso:** cápsulas con fondo tintado (naranja para "Alto", gris para "Medio", rojo para "Ya").

## 7. Movimiento

Solo lo que cambia estado:
- Destello suave del precio al cambiar.
- Aparición de la ayuda (opacidad y desplazamiento de 4 px, 180 ms).
- Hover en filas y controles (150 ms).

Todo se apaga con `prefers-reduced-motion`.

## 8. Verificación

1. Capturas en escritorio (1440 px) y móvil (375 px) de Hoy, Oro y Mercados. Sin desbordamiento horizontal y con el gráfico de alto estable tras 2 minutos y tras cambiar el tamaño de la ventana.
2. Contraste: etiquetas ≥ 4,5:1 sobre el vidrio con el fondo más claro detrás.
3. Detector de impeccable sin hallazgos materiales (el vidrio y el fondo de luces están pedidos expresamente).
4. Actualizar DESIGN.md y `.impeccable/design.json`.
