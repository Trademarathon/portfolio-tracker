# Screener mapping: data sources and planning (Binance, Bybit, Hyperliquid)

Use this map to see where screener data comes from per exchange and how to plan new sections (e.g. TradeFi).

---

## 1. Screener page structure

| Section | File | What it does |
|--------|------|----------------|
| **Page** | [watchlist/page.tsx](src/app/watchlist/page.tsx) | Route `/watchlist`; header (VOL, OI, LIQS, AVG FUNDING), exchange tabs (ALL / BINANCE / HYPERLIQUID / BYBIT), MarketTable, TradingView chart, Alerts sidebar |
| **Table** | [MarketTable.tsx](src/components/Screener/MarketTable.tsx) | Rows = `tickersList` filtered by `exchangeFilter`; columns: Symbol, Price, CHG %, Vol, OI $, OI CHG %, Funding, VLT, Trd, Momentum, etc. |
| **Data hook** | [useScreenerData.ts](src/hooks/useScreenerData.ts) | Merges WebSocket tickers + static/API markets; exposes `tickersList`, `connectionStatus`, `isConnected` |
| **WS manager** | [screener-websocket.ts](src/lib/api/screener-websocket.ts) | Connects to Binance, Bybit, Hyperliquid; emits `ScreenerTickerData` per ticker |

---

## 2. Where data comes from (per exchange)

```mermaid
flowchart LR
  subgraph binance [Binance]
    B_WS[!ticker@arr]
    B_Mark[!markPrice@arr]
    B_OI[REST /fapi/v1/openInterest]
  end
  subgraph bybit [Bybit]
    BY_WS["tickers.SYMBOL (per symbol)"]
  end
  subgraph hl [Hyperliquid]
    HL_Mids[allMids]
    HL_Info[info: metaAndAssetCtxs]
  end
  subgraph from_somewhere [From elsewhere]
    API[GET /api/screener/markets]
    Default[DEFAULT_MARKETS in useScreenerData]
  end
  Mgr[ScreenerWebSocketManager]
  Hook[useScreenerData]
  UI[watchlist + MarketTable]
  B_WS --> Mgr
  B_Mark --> Mgr
  B_OI --> Mgr
  BY_WS --> Mgr
  HL_Mids --> Mgr
  HL_Info --> Mgr
  Mgr --> Hook
  API --> Hook
  Default --> Hook
  Hook --> UI
```

| Exchange | Price / 24h / Vol | Funding | OI $ | OI CHG % (1h) | Source |
|----------|--------------------|--------|------|----------------|--------|
| **Binance** | WS `!ticker@arr` | WS `!markPrice@arr` | REST poll `BINANCE_OI_SYMBOLS` (60s) | From OI history once we have OI | [screener-websocket.ts](src/lib/api/screener-websocket.ts) |
| **Bybit** | WS `tickers.{symbol}` (per-symbol list) | WS same stream | WS (cached for deltas) | WS `getMetrics` + `oiHistory` | Same |
| **Hyperliquid** | WS `allMids` + poll `metaAndAssetCtxs` | poll `metaAndAssetCtxs` | poll `metaAndAssetCtxs` | WS `getMetrics` + `oiHistory` | Same |
| **Static list** | — | — | — | — | [api-server/routes/screener-markets.ts](api-server/routes/screener-markets.ts) or `DEFAULT_MARKETS` in [useScreenerData.ts](src/hooks/useScreenerData.ts) |

“From somewhere” = **API** (`/api/screener/markets`) for symbol list and exchange labels; if API fails, **DEFAULT_MARKETS** in the hook is used so Binance, Bybit, and Hyperliquid still have placeholder rows.

---

## 3. Planning a new section (e.g. TradeFi) with this mapping

1. **Decide which exchanges** the section uses (e.g. Binance + Hyperliquid only, or all three).
2. **Decide which data** you need:
   - If it’s already in `ScreenerTickerData` (price, funding, OI, volume, etc.) → use `tickersList` from `useScreenerData()` and filter by `exchange === 'binance'` or `'hyperliquid'`.
   - If you need new data (e.g. trade count, order book) → add it in [screener-websocket.ts](src/lib/api/screener-websocket.ts) per exchange (Binance/Bybit/HL), then extend `ScreenerTickerData` and the hook so the new section can read it from `tickersList`.
3. **Add the section** on the screener page (e.g. a new block in [watchlist/page.tsx](src/app/watchlist/page.tsx) or a new component that consumes `tickersList` and optional `exchangeFilter`).

Example for a “TradeFi” block (Binance + HL only):

- In the page: `const tradeFiTickers = tickersList.filter(t => t.exchange === 'binance' || t.exchange === 'hyperliquid');`
- Render a table or cards using `tradeFiTickers` (and existing fields or new ones you added to the WS layer).

**HIP-3 (from Hyperliquid):** TradeFi should include **HIP-3 markets**. HIP-3 = [Hyperliquid Improvement Proposal 3: Builder-deployed perpetuals](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals) – permissionless builder-deployed perpetual markets on Hyperliquid. When implementing: (1) Check Hyperliquid API (info endpoint perpetuals/meta, HIP-3 deployer actions) to identify which assets are HIP-3. (2) In the HL data path ([screener-websocket.ts](src/lib/api/screener-websocket.ts) or HL adapter), tag tickers that are HIP-3 (e.g. `isHip3: true` or `marketType: 'hip3'` from HL meta). (3) TradeFi filter then shows Binance + Hyperliquid (HL tickers include HIP-3 once tagged), or add an optional HIP-3-only filter using that tag.

**Binance and Bybit:** When implementing TradeFi for **Binance** or **Bybit** (e.g. which symbols/markets to show, product types, or data fields), if in doubt, refer to **Binance official documentation** and **Bybit official documentation** so the screener matches each exchange's definitions.

---

## 4. Key file reference

| Purpose | File |
|--------|------|
| Screener UI (header, tabs, table, chart) | [src/app/watchlist/page.tsx](src/app/watchlist/page.tsx) |
| Table + filters + columns | [src/components/Screener/MarketTable.tsx](src/components/Screener/MarketTable.tsx) |
| Ticker list + merge WS + markets | [src/hooks/useScreenerData.ts](src/hooks/useScreenerData.ts) |
| Binance / Bybit / HL WebSocket + Binance OI REST | [src/lib/api/screener-websocket.ts](src/lib/api/screener-websocket.ts) |
| Static markets (API) | [api-server/routes/screener-markets.ts](api-server/routes/screener-markets.ts) |
| Chart symbol (Binance/Bybit/HL) | Same page: `chartSymbol` / `chartLabel` from `selectedSymbol` |

---

## 5. Exchange filter values

Used in the UI and in filtering:

- `all` → show all tickers
- `binance` → `t.exchange === 'binance'`
- `hyperliquid` → `t.exchange === 'hyperliquid'`
- `bybit` → `t.exchange === 'bybit'`
- `tradfi` → TradeFi tab: same as filtering to Binance + Hyperliquid (and HIP-3). TradeFi is defined by exchanges, not asset type—it shows crypto pairs (BTC, ETH, etc.) from those venues.

Any new section that is “for Binance and HL only” should filter with:

`tickersList.filter(t => t.exchange === 'binance' || t.exchange === 'hyperliquid')`.
