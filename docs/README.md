# Portfolio Tracker – Docs

## Alerts and sync

- **[Alerts and notifications](ALERTS_AND_NOTIFICATIONS.md)** – How alerts, signals, notification settings, and cloud sync work (Realtime guards, cooldown, AI feeds, Sidebar Market Session, cloud-as-memory).

## Terminal & Advanced DOM

- **[Advanced DOM column reference](terminal-advanced-dom-columns.md)** – What every column is, how it’s computed, and how columns relate. Aligned with **Exocharts** (DOM single/dual/cluster, delta profile, cumulative order book) and **Insilico Terminal** (Orderbook + DOM: Pull/Stack, IMB/UPD/WGT, footer V/Δ/IMB/S). Use this to understand or extend the DOM.

### Related code

| Area | Path |
|------|------|
| Advanced DOM component | `src/components/Terminal/AdvancedDOM.tsx` |
| DOM vs Depth view switch | `src/components/Terminal/OrderBookWidget.tsx` |
| Depth chart (Insilico) | `src/components/Terminal/InsilicoOrderBook.tsx` |
| L2 book (Hyperliquid) | `src/hooks/useL2Book.ts` |
| REST aggregation | `src/hooks/useFuturesAggregator.ts` |
| WebSocket aggregation | `src/hooks/useFuturesWebSocket.ts` |
| Bybit trades (M column) | `src/lib/api/terminal-ws-pool.ts` (acquireBybitCvd) |
