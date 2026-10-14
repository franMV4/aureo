# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Traders intradía de oro (XAU/USD). Hoy el usuario es su autor, un scalper de oro; más adelante, otros traders de oro que paguen por ella. Preparan el plan antes de la sesión y dejan la web abierta mientras operan en su bróker o en TradingView, mirándola de reojo cada pocos minutos. La usan en PC y en móvil por igual.

## Product Purpose

Decir cada mañana dónde está el oro, qué niveles importan hoy, qué empuja al precio y qué hacer si rompe por arriba o por abajo, con el resto de mercados (plata, dólar, bonos, índices, acciones, cripto, petróleo) como contexto. Éxito: en un minuto el trader tiene su plan escrito y sabe a qué precios reaccionar.

## Positioning

Cada indicador lleva al lado su acierto medido con un backtest fuera de muestra (2008–hoy, mismo código que la web). Lo que no gana a su base se presenta como contexto, no como señal. Los competidores (ROAD Trading y similares) enseñan decenas de indicadores sin decir cuáles funcionan.

## Operating Context

- Rutina: plan antes de Londres, consulta durante la sesión, revisión por la noche en el diario.
- Se usa junto a un bróker y TradingView; no sustituye al gráfico de ejecución.
- Hora de Madrid. Sesiones Asia, Londres y Nueva York. Calendario de datos de EE. UU. (IPC, nóminas, FOMC).
- Primer dato al abrir: precio y niveles del día.

## Capabilities and Constraints

- Cloudflare Worker + D1, cron cada 15 min, front sin framework (HTML/CSS/JS), velas con lightweight-charts.
- Solo datos gratuitos: Yahoo (con retraso en algunos mercados), gold-api, CFTC, FRED, SPDR, Forex Factory, RSS.
- Páginas: Hoy, Oro (7 capítulos), Mercados, ficha de activo, Agenda, Diario, Método.
- Escritura (plan, diario) solo tras Cloudflare Access.
- Abierto: cuentas, pagos y página de presentación para la venta (aún no decidido cuándo).

## Brand Commitments

- Nombre: Aureo (antes Lingote).
- Español de España, llano, sin lenguaje de venta.
- No debe parecer generada por IA; aspecto de herramienta profesional.
- Nunca "compra"/"vende" como recomendación; aviso de que no es asesoramiento.

## Evidence on Hand

- Backtest real de 9 factores (kv `factors:backtest`): ninguno supera a su base fuera de muestra; tipos reales es el más cercano; el COT a la contra falla.
- No hay clientes, testimonios ni precios: no inventarlos.

## Product Principles

1. La medida decide, no la opinión: todo número que sugiera acción va con su acierto.
2. Precio y niveles primero; el resto, a un vistazo después.
3. Legible de reojo durante la sesión, completo cuando hay tiempo.
4. Honestidad sobre los límites de los datos (retrasos, fuentes no oficiales).
