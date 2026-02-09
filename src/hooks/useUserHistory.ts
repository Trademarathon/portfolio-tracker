"use client";

import { useQuery } from "@tanstack/react-query";
import { getHyperliquidUserFills, getHyperliquidUserTransfers, getHyperliquidUserFunding } from "@/lib/api/hyperliquid";
import { fetchCexTransfers, fetchCexTrades } from "@/lib/api/cex";
import { getEvmHistory, getSolanaHistory } from "@/lib/api/wallet";
import { PortfolioConnection } from "@/lib/api/types";

export function useUserHistory(connections: PortfolioConnection[]) {
    return useQuery({
        queryKey: ['history', connections.map(c => c.id).join(',')],
        queryFn: async () => {


            const transferPromises = [];
            const tradePromises = [];

            for (const conn of connections) {
                if (conn.enabled === false) continue;

                if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    // Hyperliquid Fills (Trades)
                    tradePromises.push(
                        getHyperliquidUserFills(conn.walletAddress)
                            .then((fills: any[]) => fills.map((f: any) => ({
                                id: f.hash || `${f.tid}`,
                                timestamp: f.time,
                                symbol: f.coin,
                                side: (f.side === 'B' || f.dir?.toLowerCase().includes('long')) ? 'buy' : 'sell',
                                price: parseFloat(f.px),
                                amount: parseFloat(f.sz),
                                pnl: parseFloat(f.closedPnl || '0'),
                                exchange: 'Hyperliquid',
                                connectionId: conn.id,
                                fee: parseFloat(f.fee || '0'),
                                feeCurrency: f.feeToken || 'USDC',
                                takerOrMaker: f.crossed ? 'taker' : 'maker',
                                feeType: 'trading'
                            })))
                            .catch((e: Error) => {
                                console.warn("Failed hyperliquid history", e);
                                return [];
                            })
                    );

                    // Hyperliquid Transfers
                    transferPromises.push(
                        getHyperliquidUserTransfers(conn.walletAddress)
                            .then((transfers: any[]) => transfers.map((t: any) => {
                                const entry = t.delta || {};
                                const amount = parseFloat(entry.amount || '0');
                                return {
                                    id: t.hash || `${t.time}`,
                                    type: (amount > 0 ? 'Deposit' : 'Withdraw') as 'Deposit' | 'Withdraw',
                                    asset: 'USDC',
                                    amount: Math.abs(amount),
                                    status: 'Confirmed',
                                    timestamp: t.time,
                                    txHash: t.hash,
                                    connectionId: conn.id,
                                    feeType: 'network'
                                };
                            }))
                            .catch((e: Error) => {
                                console.warn("Failed hyperliquid transfers", e);
                                return [];
                            })
                    );

                    // Hyperliquid Funding
                    tradePromises.push(
                        getHyperliquidUserFunding(conn.walletAddress)
                            .then((funding: any[]) => funding.map((f: any) => ({
                                id: `funding-${f.time}`,
                                timestamp: f.time,
                                symbol: f.coin,
                                side: 'funding',
                                amount: parseFloat(f.delta),
                                pnl: parseFloat(f.delta), // funding delta is direct PNL
                                exchange: 'Hyperliquid',
                                connectionId: conn.id,
                                feeType: 'funding'
                            })))
                            .catch((e: Error) => {
                                console.warn("Failed hyperliquid funding", e);
                                return [];
                            })
                    );
                }

                if ((conn.type === 'binance' || conn.type === 'bybit') && conn.apiKey && conn.secret) {
                    transferPromises.push(
                        fetchCexTransfers(conn.type, conn.apiKey, conn.secret)
                            .then(res => res.map((t: any) => ({ ...t, connectionId: conn.id, feeType: 'network' })))
                            .catch(e => { console.warn("CEX transfers failed", e); return []; })
                    );
                    tradePromises.push(
                        fetchCexTrades(conn.type, conn.apiKey, conn.secret)
                            .then(res => res.map((t: any) => ({
                                ...t,
                                connectionId: conn.id,
                                // Ensure fee fields are preserved/normalized
                                fee: t.fee || 0,
                                feeCurrency: t.feeCurrency || 'USDT',
                                feeType: 'trading',
                                takerOrMaker: t.maker ? 'maker' : 'taker' // Ensure API returns this or infer
                            })))
                            .catch(e => { console.warn("CEX trades failed", e); return []; })
                    );
                }

                if ((conn.type === 'wallet' || conn.type === 'evm' || conn.type === 'solana') && conn.walletAddress) {
                    const isSolana = conn.type === 'solana' || conn.chain === 'SOL' || (!conn.chain && !conn.walletAddress.startsWith('0x'));
                    const isSui = conn.chain === 'SUI' || (conn.type === 'wallet' && conn.walletAddress.startsWith('0x') && conn.walletAddress.length > 42);
                    const isAptos = conn.chain === 'APT' || (conn.type === 'wallet' && conn.walletAddress.startsWith('0x') && conn.walletAddress.length === 66);

                    const fetchHistoryViaProxy = async (chain?: string, type?: string) => {
                        try {
                            const url = `/api/wallet/history?address=${conn.walletAddress}&chain=${chain || ''}&type=${type || ''}`;
                            const res = await fetch(url);
                            if (!res.ok) throw new Error(`History proxy failed: ${res.status}`);
                            return await res.json();
                        } catch (e) {
                            console.warn(`History proxy failed for ${conn.id}`, e);
                            return [];
                        }
                    };

                    if (isSolana) {
                        tradePromises.push(
                            fetchHistoryViaProxy('SOL', 'solana')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id })))
                        );
                    } else if (isSui) {
                        tradePromises.push(
                            fetchHistoryViaProxy('SUI', 'sui')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id })))
                        );
                    } else if (isAptos) {
                        tradePromises.push(
                            fetchHistoryViaProxy('APT', 'aptos')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id })))
                        );
                    } else {
                        // EVM Chains
                        const chains = conn.chain ? [conn.chain] : ['ETH', 'ARB', 'MATIC', 'OP', 'BASE'];
                        for (const chain of chains) {
                            tradePromises.push(
                                fetchHistoryViaProxy(chain, 'evm')
                                    .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id })))
                            );
                        }
                    }
                }
            }

            const [transferResults, tradeResults] = await Promise.all([
                Promise.allSettled(transferPromises),
                Promise.allSettled(tradePromises)
            ]);

            const transfers: any[] = [];
            transferResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    transfers.push(...result.value);
                } else {
                    console.warn("[DeepHistory] Transfer fetch failed", result.reason);
                }
            });

            const trades: any[] = [];
            tradeResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    trades.push(...result.value);
                } else {
                    console.warn("[DeepHistory] Trade fetch failed", result.reason);
                }
            });

            return {
                transfers: transfers.sort((a: any, b: any) => b.timestamp - a.timestamp),
                trades: trades.sort((a: any, b: any) => b.timestamp - a.timestamp)
            };
        },
        enabled: connections.length > 0,
        staleTime: 1000 * 60 * 5, // 5 min
    });
}
