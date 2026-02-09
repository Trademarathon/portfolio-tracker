export async function fetchCexBalance(exchangeId: string, apiKey: string, secret: string) {
    const response = await fetch('/api/cex/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchangeId, apiKey, secret })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch balance');
    }

    const rawBalance = await response.json();
    return normalizeCexBalance(rawBalance);
}

export function normalizeCexBalance(ccxtBalance: any): { symbol: string, balance: number }[] {
    const balances: { symbol: string, balance: number }[] = [];

    if (ccxtBalance && typeof ccxtBalance === 'object') {
        // Try to use 'total' first (Binance style)
        let total = ccxtBalance.total || {};

        // If total is empty or missing, calculate from free + used (Bybit unified account style)
        if (Object.keys(total).length === 0 && ccxtBalance.free && ccxtBalance.used) {
            const free = ccxtBalance.free || {};
            const used = ccxtBalance.used || {};

            // Merge free and used to calculate total
            const allSymbols = new Set([...Object.keys(free), ...Object.keys(used)]);
            allSymbols.forEach(symbol => {
                const freeAmount = typeof free[symbol] === 'string' ? parseFloat(free[symbol]) : (free[symbol] || 0);
                const usedAmount = typeof used[symbol] === 'string' ? parseFloat(used[symbol]) : (used[symbol] || 0);
                total[symbol] = freeAmount + usedAmount;
            });
        }

        // Now extract balances from total
        Object.entries(total).forEach(([symbol, balance]) => {
            const b = typeof balance === 'string' ? parseFloat(balance) : (balance as number);
            if (b > 0) {
                balances.push({ symbol, balance: b });
            }
        });
    }

    return balances;
}

export interface CexTransfer {
    id: string;
    type: 'Deposit' | 'Withdraw';
    asset: string;
    amount: number;
    status: string;
    timestamp: number;
    txHash?: string;
    address?: string;
}

export async function fetchCexTransfers(
    exchange: 'binance' | 'bybit' | 'hyperliquid',
    apiKey: string,
    apiSecret: string
): Promise<CexTransfer[]> {
    // In a real backend, this would use CCXT via an API route. 
    // Since we are client-side or Next.js server actions, we need an endpoint.
    // For now, let's assume we call an API endpoint similar to balance.

    // However, the previous plan assumed direct CCXT use which is Node.js only.
    // We should create an API route for transfers if we want to use CCXT.
    // OR, we can try to fetch from our existing /api/cex/balance if we expand it, 
    // but better to have /api/cex/transfers.

    // Let's create the API route first? 
    // Or we can mock it here if we want to stay client-side but we need secrets.
    // Secrets are in localStorage, valid for client-side usage if we passed them.
    // BUT CCXT doesn't run in browser easily.

    // We MUST create an API route: /api/cex/transfers
    try {
        const response = await fetch('/api/cex/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exchange, apiKey, secret: apiSecret })
        });

        if (!response.ok) return [];
        const data = await response.json();
        return data.transfers || [];
    } catch (e) {
        console.warn("Transfers Fetch Error", e);
        return [];
    }
}

export async function fetchCexTrades(
    exchange: 'binance' | 'bybit',
    apiKey: string,
    apiSecret: string
) {
    try {
        const response = await fetch('/api/cex/trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exchange, apiKey, secret: apiSecret })
        });

        if (!response.ok) return [];
        const data = await response.json();
        return data.trades || [];
    } catch (e) {
        console.warn("Trades Fetch Error", e);
        return [];
    }
}

export async function fetchCexOpenOrders(
    exchange: 'binance' | 'bybit',
    apiKey: string,
    apiSecret: string
) {
    try {
        const response = await fetch('/api/cex/open-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exchangeId: exchange, apiKey, secret: apiSecret })
        });

        if (!response.ok) return [];
        const data = await response.json();
        return data.orders || [];
    } catch (e) {
        console.warn("Open Orders Fetch Error", e);
        return [];
    }
}
