/**
 * Orion-style screener alert presets. One-click create in AlertsSidebar.
 * Conditions use the same shape as AlertCondition in useAlerts.
 */

export interface ScreenerAlertPresetCondition {
    type: string;
    operator?: "gt" | "lt" | "outside";
    target?: number;
    targetMin?: number;
    targetMax?: number;
}

export interface ScreenerAlertPreset {
    id: string;
    name: string;
    description: string;
    exchange: "binance" | "hyperliquid" | "bybit";
    symbol: string | "GLOBAL";
    symbols?: string[];
    conditions: ScreenerAlertPresetCondition[];
    logic: "AND" | "OR";
    repeat: boolean;
    sound: boolean;
}

export const SCREENER_ALERT_PRESETS: ScreenerAlertPreset[] = [
    {
        id: "absorption",
        name: "Absorption",
        description: "TRD 15M > 65k, CHG % 15M tight, RVOL > 2.5x, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "trd_15m", operator: "gt", target: 65000 },
            { type: "chg_15m", operator: "outside", targetMin: -1.2, targetMax: 1.2 },
            { type: "rvol", target: 2.5 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "breakout",
        name: "Breakout",
        description: "TRD 15M > 40k, CHG % 15M > 3%, VLT 15M > 2%, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "trd_15m", operator: "gt", target: 40000 },
            { type: "chg_15m", operator: "gt", target: 3 },
            { type: "vlt_15m", target: 2 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "volatility-nuke",
        name: "Volatility Nuke",
        description: "VLT 15M > 4%, TRD 15M > 50k, OI CHG % 15M tight, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "vlt_15m", target: 4 },
            { type: "trd_15m", operator: "gt", target: 50000 },
            { type: "oi_chg_15m", operator: "outside", targetMin: -1.5, targetMax: 1.5 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "liquidation",
        name: "Liquidation",
        description: "CHG % 15M < -3%, VLT 15M > 3%, TRD 15M > 30k, OI CHG % 15M < -3%, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "chg_15m", operator: "lt", target: -3 },
            { type: "vlt_15m", target: 3 },
            { type: "trd_15m", operator: "gt", target: 30000 },
            { type: "oi_chg_15m", operator: "lt", target: -3 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "god-candle",
        name: "God Candle (The Pump)",
        description: "CHG % 15M > 3%, OI CHG % 15M > 2%, CVD 15M > $500K, RVOL > 3x, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "chg_15m", operator: "gt", target: 3 },
            { type: "oi_chg_15m", operator: "gt", target: 2 },
            { type: "cvd_15m", operator: "gt", target: 500 },
            { type: "rvol", target: 3 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "anomaly",
        name: "Anomaly (The Dark Market Scanner)",
        description: "RVOL > 5x, TRD 15M > 15k, CHG % 15M tight, MCAP > $50M, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "rvol", target: 5 },
            { type: "trd_15m", operator: "gt", target: 15000 },
            { type: "chg_15m", operator: "outside", targetMin: -2, targetMax: 2 },
            { type: "mcap", operator: "gt", target: 50 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "weekend-absorption",
        name: "Weekend Absorption (The Slow Grind)",
        description: "TRD 15M > 35k, CHG % 15M outside -1%-1%, RVOL > 2x, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "trd_15m", operator: "gt", target: 35000 },
            { type: "chg_15m", operator: "outside", targetMin: -1, targetMax: 1 },
            { type: "rvol", target: 2 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "weekend-pump",
        name: "Weekend Pump (The Casino)",
        description: "RVOL > 5x, CHG % 15M > 4%, MCAP > $50M, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "rvol", target: 5 },
            { type: "chg_15m", operator: "gt", target: 4 },
            { type: "mcap", operator: "gt", target: 50 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "weekend-reversion",
        name: "Weekend Reversion (The Scam Wick)",
        description: "TRD 15M > 25k, VLT 15M > 3%, OI CHG % 15M outside -2%-2%, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "trd_15m", operator: "gt", target: 25000 },
            { type: "vlt_15m", target: 3 },
            { type: "oi_chg_15m", operator: "outside", targetMin: -2, targetMax: 2 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "btc-sniper",
        name: "BTC Sniper",
        description: "CHG % 15M and OI CHG % 15M tight, CVD 15M range (BTCUSDT)",
        exchange: "binance",
        symbol: "BTCUSDT",
        symbols: ["BTCUSDT"],
        conditions: [
            { type: "chg_15m", operator: "outside", targetMin: -1.5, targetMax: 1.5 },
            { type: "oi_chg_15m", operator: "outside", targetMin: -1, targetMax: 1 },
            { type: "cvd_15m", operator: "outside", targetMin: -1000, targetMax: 1000 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "eth-sniper",
        name: "ETH Sniper",
        description: "CHG % 15M and OI CHG % 15M tight, CVD 15M range (ETHUSDT)",
        exchange: "binance",
        symbol: "ETHUSDT",
        symbols: ["ETHUSDT"],
        conditions: [
            { type: "chg_15m", operator: "outside", targetMin: -1.5, targetMax: 1.5 },
            { type: "oi_chg_15m", operator: "outside", targetMin: -1, targetMax: 1 },
            { type: "cvd_15m", operator: "outside", targetMin: -1000, targetMax: 1000 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "funding-entry",
        name: "Funding Entry Setup",
        description: "FUNDING > 1%, TRD 15M > 20k, RVOL > 0.25x, OI > $20M, MCAP > $100M, VLT 15M > 1%",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "funding", operator: "gt", target: 1 },
            { type: "trd_15m", operator: "gt", target: 20000 },
            { type: "rvol", target: 0.25 },
            { type: "oi", target: 20 },
            { type: "mcap", operator: "gt", target: 100 },
            { type: "vlt_15m", target: 1 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "extreme-negative-funding",
        name: "Extreme Negative Funding",
        description: "FUNDING < -1%, TRD 15M > 20k, RVOL > 0.25x, OI > $20M, MCAP > $100M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "funding", operator: "lt", target: -1 },
            { type: "trd_15m", operator: "gt", target: 20000 },
            { type: "rvol", target: 0.25 },
            { type: "oi", target: 20 },
            { type: "mcap", operator: "gt", target: 100 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
    {
        id: "tm-positioning-trap",
        name: "TM - Positioning Trap",
        description: "OI CHG % 15M > 2%, CHG % 15M outside -0.8%-0.8%, TRD 15M > 25k, OI > $20M",
        exchange: "binance",
        symbol: "GLOBAL",
        conditions: [
            { type: "oi_chg_15m", operator: "gt", target: 2 },
            { type: "chg_15m", operator: "outside", targetMin: -0.8, targetMax: 0.8 },
            { type: "trd_15m", operator: "gt", target: 25000 },
            { type: "oi", target: 20 },
        ],
        logic: "AND",
        repeat: true,
        sound: true,
    },
];
