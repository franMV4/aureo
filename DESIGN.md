---
name: Lingote
description: Mesa de trading de oro en vidrio oscuro
colors:
  ground: "#000000"
  glass: "rgba(28, 28, 30, 0.82)"
  glass-strong: "rgba(22, 22, 24, 0.7)"
  glass-inset: "rgba(118, 118, 128, 0.14)"
  edge: "rgba(255, 255, 255, 0.085)"
  hairline: "rgba(255, 255, 255, 0.07)"
  ink: "#ffffff"
  ink-secondary: "rgba(235, 235, 245, 0.64)"
  ink-tertiary: "rgba(235, 235, 245, 0.52)"
  gold: "#e6b450"
  blue: "#0a84ff"
  green: "#30d158"
  red: "#ff453a"
  orange: "#ff9f0a"
  series-gold: "#c2852a"
  series-blue: "#2f7fe0"
  series-rose: "#c9508f"
typography:
  page:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  section:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  figure:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  axis:
    fontFamily: "SF Mono, Cascadia Mono, ui-monospace, Consolas, monospace"
    fontSize: "11px"
rounded:
  inner: "12px"
  tile: "18px"
  panel: "20px"
  chrome: "24px"
  capsule: "999px"
spacing:
  in-group: "8px"
  panel-gap: "16px"
  section-gap: "34px"
  panel-pad: "20px"
components:
  panel:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.panel}"
    padding: "18px 20px 20px"
  control:
    backgroundColor: "{colors.glass-inset}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.capsule}"
    height: "34px"
    padding: "0 16px"
  control-selected:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
  action-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    height: "34px"
  field:
    backgroundColor: "{colors.glass-inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inner}"
    height: "40px"
---

# Design System: Lingote

## Overview

**Creative North Star: "La mesa de vidrio"**

Fondo negro puro con superficies en los grises de sistema de Apple, un punto más claras. La transparencia está donde Apple la pone: en el cromo (barra lateral, cabecera fija de página, barra de pestañas), por debajo del cual el contenido pasa desenfocado. Es una aproximación web al Liquid Glass de Apple (con `backdrop-filter`, bordes de luz y reflejo superior), no el material oficial.

La jerarquía se lee desde lejos: página, sección, título de panel con icono, cifra, etiqueta y nota. Cada nivel cambia de tamaño o de tono lo bastante para no confundirse con el siguiente. Las cifras mandan; las etiquetas acompañan.

**Key Characteristics:**
- Tres niveles de vidrio: panel, cromo (barra lateral, cabecera y pestañas) e interior (controles y campos).
- Color con significado fijo en la paleta de sistema de Apple: oro para la marca y los niveles calculados, azul para lo tuyo, verde sube, rojo baja y naranja precaución.
- Tipografía del sistema: SF Pro en Apple y Segoe UI Variable en Windows.
- Gráfico de velas con eje de precios estrecho, como TradingView.

## Colors

Grafito casi negro bajo vidrio translúcido. El color con tono solo aparece cuando significa algo.

### Primary
- **Oro** (gold): marca, icono de la página activa y niveles calculados (líneas y etiquetas del eje, precios en la tabla de niveles).
- **Azul** (blue): todo lo que es tuyo. Tu plan en el gráfico, el control seleccionado, la acción principal, el foco y la fila "Precio ahora".

### Secondary
- **Verde** (green): subidas, sesión activa y ±1σ esperado.
- **Rojo** (red): bajadas y dato a menos de 15 minutos.
- **Naranja** (orange): precaución. Dato rojo próximo, dato retrasado y veredicto "confluencia, no señal".

### Tertiary
- **Series de gráficos** (series-gold, series-blue, series-rose): paleta categórica validada con el comprobador de dataviz sobre `#1a1c22`.

### Neutral
- **Suelo** (ground): negro puro, sin luces de color. Las superficies usan los grises de sistema de Apple (#1C1C1E y rellenos de #767680 a baja opacidad).
- **Vidrio** (glass, glass-strong, glass-inset): panel, cromo e interior.
- **Tinta** (ink, ink-secondary, ink-tertiary): cifras y títulos, etiquetas, notas.

### Named Rules
**The Meaning Rule.** Un color con tono significa siempre lo mismo; sin significado, el elemento va en tinta.
**The Blue Is Yours Rule.** El azul es solo para lo que el usuario elige o escribe.

## Typography

**Display Font:** la del sistema (SF Pro / Segoe UI Variable)
**Body Font:** la misma
**Label/Mono Font:** SF Mono / Cascadia Mono, solo en los ejes de los gráficos y las horas de las listas

**Character:** la letra nativa de cada plataforma, con cifras tabulares y sin mayúsculas decorativas.

### Hierarchy
- **Página** (600, 26px, −0,02em): "Hoy", "Oro".
- **Sección** (600, 16px): agrupa paneles ("Mercado ahora", "Plan del día", "Riesgo y agenda"), con un filete que se desvanece a la derecha.
- **Título de panel** (600, 15px) con icono Phosphor de 17px.
- **Cifra** (600, 22px; 32px el precio del oro; 18px en escenarios y bajo el gráfico).
- **Etiqueta** (500, 12px, ink-secondary): encima de cada cifra.
- **Nota** (400, 12px, ink-tertiary): debajo de la cifra, a 4px.
- **Cuerpo** (400, 14px, interlineado 1,55, máximo 72ch).

### Named Rules
**The Figure First Rule.** En una lectura, la cifra es al menos 1,8 veces la etiqueta y va en tinta plena; la etiqueta nunca compite con ella.

## Layout

- **Escritorio:**
  - Barra lateral flotante de 256px (vidrio cromo, radio de 24px, separada 12px del borde).
  - Contenido de hasta 1560px en una rejilla de 12 columnas, con 16px entre paneles y 34px entre secciones.
- **Hoy:**
  - Franja de 5 tarjetas de estado, con el precio a 1,5 columnas.
  - Gráfico (8 columnas, 460px fijos) con los niveles al lado (4 columnas, desplazamiento propio).
  - Escenarios y Mi plan (5 columnas) junto a la balanza (7).
  - Riesgo, datos y titulares (4 columnas cada uno).
- **Por debajo de 1180px:** una columna.
- **Por debajo de 900px:** cabecera de vidrio arriba y barra de pestañas flotante en cápsula abajo.
- **Por debajo de 640px:** las tarjetas pasan a dos columnas y el gráfico a 340px.

## Elevation & Depth

El vidrio da la profundidad: desenfoque de fondo con borde interior de luz de 1px, reflejo superior y una sombra suave hacia abajo. Sin bordes sólidos.
- Si el sistema pide menos transparencia, o el navegador no tiene `backdrop-filter`, todo pasa a `#17191f` opaco.

### Shadow Vocabulary
- **Vidrio** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.085), inset 0 1px 0 rgba(255,255,255,.1), 0 12px 32px rgba(0,0,0,.35)`): paneles, tarjetas, cromo y ayudas.

### Named Rules
**The No Nested Glass Rule.** Dentro de un panel no hay otra tarjeta. Las lecturas se separan con un filete superior y los escenarios con una línea entre ellos.

## Shapes

Radios concéntricos:
- 24px en el cromo, 20px en los paneles, 18px en las tarjetas de estado y 12px en campos y filas resaltadas.
- Cápsula en controles, etiquetas, puntuaciones y en la barra de pestañas del móvil.

## Components

### Buttons
- **Control:** cápsula de 34px de alto con fondo de vidrio interior y texto en ink-secondary. Al pasar el ratón el fondo se aclara; al pulsar escala 0,98.
- **Seleccionado:** cápsula azul con texto blanco.
- **Acción principal:** cápsula azul sólida ("Guardar plan", "Abrir ficha").
- **Segmentado:** grupo de cápsulas dentro de una cápsula de vidrio. La seleccionada se aclara con borde de luz. Ocupa una sola fila y se desplaza en horizontal en el móvil.

### Inputs / Fields
- **Estilo:** 40px de alto, radio de 12px, vidrio interior y texto en 15px seminegrita.
- **Foco:** borde azul y halo azul de 3px al 25 %.

### Navigation
- **Escritorio:**
  - Barra lateral con el precio del oro en vivo y enlaces de 40px con icono y texto.
  - El activo va en un vidrio aclarado con el icono en oro.
- **Móvil:** barra de pestañas flotante en cápsula con 5 iconos con texto.

### Panel
- Cabecera con icono, título y nota tenue a la derecha. El botón (i) en la esquina despliega la ayuda en un vidrio.

### Status tile (signature)
- Tarjeta de vidrio con etiqueta e icono, valor de 19px y nota.
- La del precio del oro es más ancha: cifra de 32px y cambio del día al lado.

### Price chart (signature)
- lightweight-charts con eje derecho estrecho.
- Líneas y etiquetas de nivel en oro: continuas las fuertes, discontinuas las débiles.
- Tu plan va en azul y el ±1σ en verde punteado.
- Alto fijo, para que nunca crezca. La rueda del ratón desplaza la página.

## Do's and Don'ts

### Do:
- **Do** separar los grupos con títulos de sección y 34px de aire.
- **Do** dar a cada cifra al menos 1,8 veces el tamaño de su etiqueta.
- **Do** mantener el respaldo opaco para `prefers-reduced-transparency`.
- **Do** fijar el alto de todo gráfico de velas.

### Don't:
- **Don't** poner una tarjeta dentro de otra ni franjas de color laterales.
- **Don't** usar sombras de color o halos; la sombra es siempre negra y difusa.
- **Don't** usar etiquetas en mayúsculas encima de los títulos.
- **Don't** usar el azul para algo que no haya elegido el usuario.
