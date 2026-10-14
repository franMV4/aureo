# Lingote: plan

Web para analizar el oro (XAU/USD) cada mañana y salir con un plan del día, con el resto de mercados como contexto. Contenido inspirado en ROAD Trading; estética propia de terminal de mesa de metales. Reutiliza el motor de datos de MarketDesk.

**Regla de todo el proyecto**: ningún indicador se presenta como señal sin su acierto medido al lado. El backtest decide, no la opinión.

## Estado (14 oct 2026)

| Fase | Entrega | Estado |
|---|---|---|
| F0 | Motor de MarketDesk copiado con su base local; prueba de fuentes nuevas (`scripts/check-sources.mjs`) | Hecho |
| F1 | Sistema visual: `public/styles.css` (tokens claro/oscuro, Plex, un acento, paleta de gráficos validada) | Hecho |
| F2 | Hoy: precio, sesión, niveles (`levels.js`) y velas de 15 min | Hecho |
| F3 | Balanza de 9 factores (`factors.js`) + backtest 2008–hoy (`npm run factors`) | Hecho |
| F4 | Escenarios, riesgo del día, calculadora de lotes, eventos con reacción histórica | Hecho |
| F5 | Página Oro: 7 capítulos (técnico, volatilidad, riesgo, proyección, posicionamiento, macro, relaciones) | Hecho |
| F6 | Mercados (mapa de calor, momentum/volatilidad, correlaciones) y ficha `/a/:ticker` | Hecho |
| F7 | Diario (acierto por sesgo y día) y Método | Hecho |
| F8 | Despliegue: D1 remota, secretos, Cloudflare Access | Pendiente (tuyo) |

## Fuentes (comprobadas el 14 oct 2026)

| Dato | Fuente | Estado |
|---|---|---|
| Velas diarias e intradía | Yahoo chart v8 (Stooq de respaldo) | OK |
| Contado XAU | gold-api; respaldo XAUT/USDT de Bybit | OK |
| COT | CFTC Socrata | OK |
| Macro | FRED (API con `FRED_KEY` en el Worker; CSV desde Node) | OK |
| Calendario | Forex Factory | OK |
| Opciones GLD (strikes, skew) | Yahoo options | 401: descartado |
| Curva de futuros del VIX | CBOE | 403: se usa VIX9D/VIX/VIX3M de Yahoo |
| Fear & Greed | CNN | 418: descartado |

## Hallazgo del backtest (2008–2026, 4.721 sesiones)

Ningún factor ni el total superan a su base fuera de muestra (2021–hoy). El que más se acerca es **tipos reales** (+2,3 pp dentro, +1,4 pp fuera a 1 día). El **COT leído a la contra falla en los dos periodos** (−2,6 y −3,4 pp): en el oro los especuladores cargados han acompañado la subida. La página lo dice: "Confluencia, no señal".

## Para más adelante

- Herramientas de dibujo sobre el gráfico (TradingView ya las tiene).
- EGARCH (GJR ya cubre la asimetría).
- Plan del día para plata o índices: el motor de factores ya funciona por símbolo.
- Si el Worker gratuito se pasa de CPU con GARCH/HMM: mover `quant` a un script nocturno que escriba en D1.
- Venta como producto (cuentas, Stripe): solo si lo decides.
