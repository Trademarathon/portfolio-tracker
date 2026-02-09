/**
 * Journal Statistics Engine
 * Calculates 20+ trading metrics for comprehensive trade analysis
 * Inspired by Tradestream.xyz analytics
 */

import { Transaction } from "@/lib/api/types";

// ============= TYPES =============

export interface TradingStats {
    // Core Metrics
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakEvenTrades: number;
    winRate: number;

    // PnL Metrics
    totalPnL: number;
    grossProfit: number;
    grossLoss: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;

    // Risk Metrics
    profitFactor: number;
    expectancy: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    sortinoRatio: number;

    // Duration Metrics
    avgHoldTime: number; // in milliseconds
    longestTrade: number;
    shortestTrade: number;
}

export interface HoldtimeStats {
    scalp: TradingSubStats; // < 1 hour
    dayTrade: TradingSubStats; // 1-24 hours
    swing: TradingSubStats; // 1-7 days
    position: TradingSubStats; // > 7 days
}

export interface TradingSubStats {
    count: number;
    winRate: number;
    totalPnL: number;
    avgPnL: number;
}

export interface SessionStats {
    asia: TradingSubStats; // 00:00-08:00 UTC
    london: TradingSubStats; // 08:00-16:00 UTC
    newYork: TradingSubStats; // 13:00-21:00 UTC
    overlap: TradingSubStats; // London/NY overlap
}

export interface DayOfWeekStats {
    monday: TradingSubStats;
    tuesday: TradingSubStats;
    wednesday: TradingSubStats;
    thursday: TradingSubStats;
    friday: TradingSubStats;
    saturday: TradingSubStats;
    sunday: TradingSubStats;
}

export interface HourlyStats {
    [hour: number]: TradingSubStats; // 0-23
}

export interface SymbolStats {
    symbol: string;
    count: number;
    winRate: number;
    totalPnL: number;
    avgPnL: number;
    longCount: number;
    shortCount: number;
}

export interface EquityCurvePoint {
    timestamp: number;
    cumulativePnL: number;
    tradeIndex: number;
}

export interface DrawdownPoint {
    timestamp: number;
    drawdown: number;
    drawdownPercent: number;
}

// ============= HELPER FUNCTIONS =============

function isWinningTrade(pnl: number | undefined): boolean {
    return (pnl ?? 0) > 0;
}

function isLosingTrade(pnl: number | undefined): boolean {
    return (pnl ?? 0) < 0;
}

function getHoldTime(trade: Transaction): number {
    // closeTime is optional - not always available from exchanges
    const tradeWithClose = trade as Transaction & { closeTime?: number };
    if (tradeWithClose.closeTime && trade.timestamp) {
        return tradeWithClose.closeTime - trade.timestamp;
    }
    return 0;
}

function getTradingSession(timestamp: number): 'asia' | 'london' | 'newYork' | 'overlap' {
    const date = new Date(timestamp);
    const utcHour = date.getUTCHours();

    // London/NY overlap: 13:00-16:00 UTC
    if (utcHour >= 13 && utcHour < 16) return 'overlap';
    // Asia: 00:00-08:00 UTC
    if (utcHour >= 0 && utcHour < 8) return 'asia';
    // London: 08:00-16:00 UTC
    if (utcHour >= 8 && utcHour < 16) return 'london';
    // New York: 13:00-21:00 UTC
    if (utcHour >= 13 && utcHour < 21) return 'newYork';

    return 'asia'; // Default for off-hours
}

function getHoldtimeCategory(holdTimeMs: number): 'scalp' | 'dayTrade' | 'swing' | 'position' {
    const hours = holdTimeMs / (1000 * 60 * 60);
    if (hours < 1) return 'scalp';
    if (hours < 24) return 'dayTrade';
    if (hours < 168) return 'swing'; // 7 days
    return 'position';
}

function getDayOfWeek(timestamp: number): keyof DayOfWeekStats {
    const days: (keyof DayOfWeekStats)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date(timestamp).getDay()];
}

// ============= MAIN CALCULATION FUNCTIONS =============

/**
 * Calculate comprehensive trading statistics
 */
export function calculateTradingStats(trades: Transaction[]): TradingStats {
    if (trades.length === 0) {
        return getEmptyStats();
    }

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    const winningTrades = sortedTrades.filter(t => isWinningTrade(t.pnl));
    const losingTrades = sortedTrades.filter(t => isLosingTrade(t.pnl));
    const breakEvenTrades = sortedTrades.filter(t => (t.pnl ?? 0) === 0);

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const totalPnL = grossProfit - grossLoss;

    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

    const largestWin = winningTrades.length > 0
        ? Math.max(...winningTrades.map(t => t.pnl || 0))
        : 0;
    const largestLoss = losingTrades.length > 0
        ? Math.abs(Math.min(...losingTrades.map(t => t.pnl || 0)))
        : 0;

    const holdTimes = sortedTrades.map(getHoldTime).filter(h => h > 0);
    const avgHoldTime = holdTimes.length > 0
        ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
        : 0;

    // Calculate drawdown
    const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(sortedTrades);

    // Calculate Sharpe and Sortino ratios
    const returns = sortedTrades.map(t => t.pnl || 0);
    const sharpeRatio = calculateSharpeRatio(returns);
    const sortinoRatio = calculateSortinoRatio(returns);

    // Profit Factor
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Expectancy
    const winRate = sortedTrades.length > 0 ? winningTrades.length / sortedTrades.length : 0;
    const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

    return {
        totalTrades: sortedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        breakEvenTrades: breakEvenTrades.length,
        winRate,
        totalPnL,
        grossProfit,
        grossLoss,
        avgWin,
        avgLoss,
        largestWin,
        largestLoss,
        profitFactor,
        expectancy,
        maxDrawdown,
        maxDrawdownPercent,
        sharpeRatio,
        sortinoRatio,
        avgHoldTime,
        longestTrade: holdTimes.length > 0 ? Math.max(...holdTimes) : 0,
        shortestTrade: holdTimes.length > 0 ? Math.min(...holdTimes) : 0,
    };
}

function getEmptyStats(): TradingStats {
    return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        winRate: 0,
        totalPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        profitFactor: 0,
        expectancy: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        avgHoldTime: 0,
        longestTrade: 0,
        shortestTrade: 0,
    };
}

/**
 * Calculate max drawdown and drawdown percentage
 */
function calculateMaxDrawdown(trades: Transaction[]): { maxDrawdown: number; maxDrawdownPercent: number } {
    if (trades.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

    let peak = 0;
    let maxDrawdown = 0;
    let cumulativePnL = 0;

    for (const trade of trades) {
        cumulativePnL += trade.pnl || 0;
        if (cumulativePnL > peak) {
            peak = cumulativePnL;
        }
        const drawdown = peak - cumulativePnL;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
    return { maxDrawdown, maxDrawdownPercent };
}

/**
 * Calculate Sharpe Ratio (annualized)
 */
function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualize assuming ~252 trading days
    const dailyExcess = avgReturn - riskFreeRate;
    return (dailyExcess / stdDev) * Math.sqrt(252);
}

/**
 * Calculate Sortino Ratio (downside risk only)
 */
function calculateSortinoRatio(returns: number[], targetReturn: number = 0): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < targetReturn);

    if (negativeReturns.length === 0) return avgReturn > targetReturn ? Infinity : 0;

    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - targetReturn, 2), 0) / negativeReturns.length;
    const downsideDev = Math.sqrt(downsideVariance);

    if (downsideDev === 0) return 0;

    return ((avgReturn - targetReturn) / downsideDev) * Math.sqrt(252);
}

/**
 * Generate equity curve data points
 */
export function generateEquityCurve(trades: Transaction[]): EquityCurvePoint[] {
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let cumulative = 0;

    return sorted.map((trade, index) => {
        cumulative += trade.pnl || 0;
        return {
            timestamp: trade.timestamp,
            cumulativePnL: cumulative,
            tradeIndex: index,
        };
    });
}

/**
 * Generate drawdown curve data points
 */
export function generateDrawdownCurve(trades: Transaction[], initialCapital: number = 10000): DrawdownPoint[] {
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let peak = initialCapital;
    let equity = initialCapital;

    return sorted.map((trade) => {
        equity += trade.pnl || 0;
        if (equity > peak) peak = equity;

        const drawdown = peak - equity;
        const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

        return {
            timestamp: trade.timestamp,
            drawdown,
            drawdownPercent,
        };
    });
}

/**
 * Calculate holdtime-segmented statistics
 */
export function calculateHoldtimeStats(trades: Transaction[]): HoldtimeStats {
    const categories = {
        scalp: [] as Transaction[],
        dayTrade: [] as Transaction[],
        swing: [] as Transaction[],
        position: [] as Transaction[],
    };

    trades.forEach(trade => {
        const holdTime = getHoldTime(trade);
        if (holdTime > 0) {
            const category = getHoldtimeCategory(holdTime);
            categories[category].push(trade);
        }
    });

    const calcSubStats = (subset: Transaction[]): TradingSubStats => {
        const wins = subset.filter(t => isWinningTrade(t.pnl));
        const totalPnL = subset.reduce((sum, t) => sum + (t.pnl || 0), 0);
        return {
            count: subset.length,
            winRate: subset.length > 0 ? wins.length / subset.length : 0,
            totalPnL,
            avgPnL: subset.length > 0 ? totalPnL / subset.length : 0,
        };
    };

    return {
        scalp: calcSubStats(categories.scalp),
        dayTrade: calcSubStats(categories.dayTrade),
        swing: calcSubStats(categories.swing),
        position: calcSubStats(categories.position),
    };
}

/**
 * Calculate trading session statistics
 */
export function calculateSessionStats(trades: Transaction[]): SessionStats {
    const sessions = {
        asia: [] as Transaction[],
        london: [] as Transaction[],
        newYork: [] as Transaction[],
        overlap: [] as Transaction[],
    };

    trades.forEach(trade => {
        const session = getTradingSession(trade.timestamp);
        sessions[session].push(trade);
    });

    const calcSubStats = (subset: Transaction[]): TradingSubStats => {
        const wins = subset.filter(t => isWinningTrade(t.pnl));
        const totalPnL = subset.reduce((sum, t) => sum + (t.pnl || 0), 0);
        return {
            count: subset.length,
            winRate: subset.length > 0 ? wins.length / subset.length : 0,
            totalPnL,
            avgPnL: subset.length > 0 ? totalPnL / subset.length : 0,
        };
    };

    return {
        asia: calcSubStats(sessions.asia),
        london: calcSubStats(sessions.london),
        newYork: calcSubStats(sessions.newYork),
        overlap: calcSubStats(sessions.overlap),
    };
}

/**
 * Calculate day of week statistics
 */
export function calculateDayOfWeekStats(trades: Transaction[]): DayOfWeekStats {
    const days: Record<keyof DayOfWeekStats, Transaction[]> = {
        sunday: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
    };

    trades.forEach(trade => {
        const day = getDayOfWeek(trade.timestamp);
        days[day].push(trade);
    });

    const calcSubStats = (subset: Transaction[]): TradingSubStats => {
        const wins = subset.filter(t => isWinningTrade(t.pnl));
        const totalPnL = subset.reduce((sum, t) => sum + (t.pnl || 0), 0);
        return {
            count: subset.length,
            winRate: subset.length > 0 ? wins.length / subset.length : 0,
            totalPnL,
            avgPnL: subset.length > 0 ? totalPnL / subset.length : 0,
        };
    };

    return {
        sunday: calcSubStats(days.sunday),
        monday: calcSubStats(days.monday),
        tuesday: calcSubStats(days.tuesday),
        wednesday: calcSubStats(days.wednesday),
        thursday: calcSubStats(days.thursday),
        friday: calcSubStats(days.friday),
        saturday: calcSubStats(days.saturday),
    };
}

/**
 * Calculate hourly statistics (0-23)
 */
export function calculateHourlyStats(trades: Transaction[]): HourlyStats {
    const hours: Record<number, Transaction[]> = {};
    for (let i = 0; i < 24; i++) hours[i] = [];

    trades.forEach(trade => {
        const hour = new Date(trade.timestamp).getHours();
        hours[hour].push(trade);
    });

    const result: HourlyStats = {};
    for (let i = 0; i < 24; i++) {
        const subset = hours[i];
        const wins = subset.filter(t => isWinningTrade(t.pnl));
        const totalPnL = subset.reduce((sum, t) => sum + (t.pnl || 0), 0);
        result[i] = {
            count: subset.length,
            winRate: subset.length > 0 ? wins.length / subset.length : 0,
            totalPnL,
            avgPnL: subset.length > 0 ? totalPnL / subset.length : 0,
        };
    }

    return result;
}

/**
 * Calculate per-symbol statistics
 */
export function calculateSymbolStats(trades: Transaction[]): SymbolStats[] {
    const symbolMap: Record<string, Transaction[]> = {};

    trades.forEach(trade => {
        const symbol = trade.symbol || 'UNKNOWN';
        if (!symbolMap[symbol]) symbolMap[symbol] = [];
        symbolMap[symbol].push(trade);
    });

    return Object.entries(symbolMap).map(([symbol, subset]) => {
        const wins = subset.filter(t => isWinningTrade(t.pnl));
        const totalPnL = subset.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const longs = subset.filter(t => t.side === 'buy').length;
        const shorts = subset.filter(t => t.side === 'sell').length;

        return {
            symbol,
            count: subset.length,
            winRate: subset.length > 0 ? wins.length / subset.length : 0,
            totalPnL,
            avgPnL: subset.length > 0 ? totalPnL / subset.length : 0,
            longCount: longs,
            shortCount: shorts,
        };
    }).sort((a, b) => b.totalPnL - a.totalPnL);
}

/**
 * Format hold time for display
 */
export function formatHoldTime(ms: number): string {
    if (ms <= 0) return '-';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

/**
 * Get PnL color based on value
 */
export function getPnLColor(pnl: number): string {
    if (pnl > 0) return '#65c49d'; // Green
    if (pnl < 0) return '#de576f'; // Red
    return '#7f807f'; // Gray
}

/**
 * Format currency with proper sign
 */
export function formatPnL(value: number): string {
    const formatted = Math.abs(value).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
}
