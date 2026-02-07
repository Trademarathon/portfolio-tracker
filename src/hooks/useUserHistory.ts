"use client";

import { useQuery } from "@tanstack/react-query";
import { getHyperliquidUserFills } from "@/lib/api/hyperliquid";
import { fetchCexTransfers, fetchCexTrades } from "@/lib/api/cex";
import { PortfolioConnection } from "@/lib/api/types";

export function useUserHistory(connections: PortfolioConnection[]) {
    return useQuery({
        queryKey: ['history', connections.map(c => c.id).join(',')],
        queryFn: async () => {
            const transfers = [];
            const trades = [];

            const transferPromises = [];
            const tradePromises = [];

            for (const conn of connections) {
                if (conn.enabled === false) continue;

                if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    // Hyperliquid Fills (Trades)
                    tradePromises.push(
                        getHyperliquidUserFills(conn.walletAddress)
                            .then(fills => fills.map(f => ({ ...f, connectionId: conn.id })))
                            .catch(e => {
                                console.error("Failed hyperliquid history", e);
                                return [];
                            })
                    );
                }

                if ((conn.type === 'binance' || conn.type === 'bybit') && conn.apiKey && conn.secret) {
                    transferPromises.push(
                        fetchCexTransfers(conn.type, conn.apiKey, conn.secret)
                            .catch(e => { console.error("CEX transfers failed", e); return []; })
                    );
                    tradePromises.push(
                        fetchCexTrades(conn.type, conn.apiKey, conn.secret)
                            .catch(e => { console.error("CEX trades failed", e); return []; })
                    );
                }

                // EVM/Solana history? (Currently not implemented in usePortfolioData, only balances)
            }

            const [transferResults, tradeResults] = await Promise.all([
                Promise.all(transferPromises),
                Promise.all(tradePromises)
            ]);

            return {
                transfers: transferResults.flat().sort((a: any, b: any) => b.timestamp - a.timestamp),
                trades: tradeResults.flat().sort((a: any, b: any) => b.timestamp - a.timestamp)
            };
        },
        enabled: connections.length > 0,
        staleTime: 1000 * 60 * 5, // 5 min
    });
}
