# Aureo

Plan del día para operar oro (XAU/USD) con el resto de mercados como contexto. Cloudflare Worker + D1, sin framework, datos gratuitos. Motor de datos heredado de MarketDesk.

| Página | Qué hace |
|---|---|
| Hoy | Precio contado, sesión, balanza de 9 factores con su acierto medido, escenarios con probabilidad de tocar, niveles, velas de 15 min, riesgo y tamaño de posición, eventos y titulares, tu plan |
| Oro | 7 capítulos: técnico (velas 15m/1h/4h/D), volatilidad (GARCH, GJR, HMM), riesgo (VaR/ES, caídas, días de más de 3σ), proyección (abanico, mapa de probabilidades), posicionamiento (COT, GLD), macro, relaciones |
| Mercados | Mapa de calor por periodos, momentum frente a volatilidad, correlaciones; buscador de cualquier ticker |
| `/a/TICKER` | Ficha de cualquier activo de Yahoo (acciones, cripto, futuros) |
| Agenda | Semana en hora de Madrid con lo que suele mover el oro cada dato |
| Diario | Tus planes, acierto por sesgo y por día de la semana |
| Método | Cómo se calcula todo y el backtest de cada factor |

## Arrancar en local

```bash
npm install
npm run dev        # http://localhost:8788 (usa la base local ya copiada de MarketDesk)
npm test           # 31 tests
npm run factors    # backtest de los factores (1 min); repítelo de vez en cuando
node scripts/check-sources.mjs   # qué fuentes responden
```

`.dev.vars`: `WRITE_OPEN=1` (escribir el diario sin Access) y `FRED_KEY`. Las tareas se lanzan a mano con `curl -X POST "localhost:8788/api/admin/run?job=all"`. Un ticker nuevo en `config.js` carga su histórico solo en la siguiente pasada.

## Desplegar

```bash
npx wrangler d1 create lingote             # pega el database_id en wrangler.toml
npx wrangler d1 execute DB --remote --file schema.sql
npm run backfill -- --remote               # ~130.000 filas; el plan gratuito escribe 100.000 al día
npm run factors -- --remote
npx wrangler secret put FRED_KEY
npm run deploy
```

Después, Cloudflare Access con tu email: sin él no se puede guardar el plan ni el diario.

## Límites

- Velas del futuro GC; los niveles de Hoy se pasan a contado restando la base del momento.
- Yahoo no es oficial y algunos mercados llegan con 15 min de retraso.
- GARCH y HMM se ajustan en el Worker y se cachean 6 h; en el plan gratuito (10 ms de CPU) puede hacer falta moverlos a un script.
- No es asesoramiento financiero.
