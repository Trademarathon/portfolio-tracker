/**
 * Single registry for all WebSocket (and related) endpoints.
 * Change URLs or add env-based overrides in one place.
 */

export const WS_ENDPOINTS = {
  hyperliquid: {
    ws: 'wss://api.hyperliquid.xyz/ws',
    api: 'https://api.hyperliquid.xyz/info',
  },
  binance: {
    futures: 'https://fapi.binance.com',
    spot: 'https://api.binance.com',
    ws: 'wss://fstream.binance.com/ws',
    wsSpot: 'wss://stream.binance.com:9443/ws',
    /** Combined streams: use with ?streams=btcusdt@ticker/ethusdt@miniTicker */
    wsSpotStream: 'wss://stream.binance.com:9443/stream',
    wsFuturesStream: 'wss://fstream.binance.com/stream',
  },
  bybit: {
    api: 'https://api.bybit.com',
    wsLinear: 'wss://stream.bybit.com/v5/public/linear',
    wsSpot: 'wss://stream.bybit.com/v5/public/spot',
    wsPrivate: 'wss://stream.bybit.com/v5/private',
  },
  okx: {
    api: 'https://www.okx.com/api/v5',
    ws: 'wss://ws.okx.com:8443/ws/v5/public',
  },
  coinbase: {
    api: 'https://api.exchange.coinbase.com',
    ws: 'wss://ws-feed.exchange.coinbase.com',
  },
  gate: {
    ws: 'wss://fx-ws.gateio.ws/v4/ws/usdt',
  },
  bitget: {
    ws: 'wss://ws.bitget.com/mix/v1/stream',
  },
  dydx: {
    ws: 'wss://indexer.dydx.trade/v4/ws',
  },
  blockchainInfo: {
    ws: 'wss://ws.blockchain.info/inv',
  },
} as const;

/** Backward-compatible: same shape as ultraFast.ENDPOINTS for drop-in use */
export const ENDPOINTS = {
  hyperliquid: {
    api: WS_ENDPOINTS.hyperliquid.api,
    ws: WS_ENDPOINTS.hyperliquid.ws,
  },
  binance: {
    futures: WS_ENDPOINTS.binance.futures,
    spot: WS_ENDPOINTS.binance.spot,
    ws: WS_ENDPOINTS.binance.ws,
    wsSpot: WS_ENDPOINTS.binance.wsSpot,
  },
  bybit: {
    api: WS_ENDPOINTS.bybit.api,
    ws: WS_ENDPOINTS.bybit.wsLinear,
  },
  okx: {
    api: WS_ENDPOINTS.okx.api,
    ws: WS_ENDPOINTS.okx.ws,
  },
  coinbase: {
    api: WS_ENDPOINTS.coinbase.api,
    ws: WS_ENDPOINTS.coinbase.ws,
  },
};
