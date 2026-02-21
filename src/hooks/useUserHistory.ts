"use client";

import { useQuery } from "@tanstack/react-query";
import { getHyperliquidUserFills, getHyperliquidUserTransfers, getHyperliquidUserFunding } from "@/lib/api/hyperliquid";
import { fetchCexTransfers, fetchCexTrades } from "@/lib/api/cex";
import { getEvmHistory as _getEvmHistory, getSolanaHistory as _getSolanaHistory } from "@/lib/api/wallet";
import { PortfolioConnection } from "@/lib/api/types";
import { apiUrl } from "@/lib/api/client";
import { normalizeSymbol } from "@/lib/utils/normalization";

function normalizeConnectionType(type: unknown): string {
    return String(type || '').toLowerCase().trim();
}

export function useUserHistory(connections: PortfolioConnection[]) {
    const safeConnections = Array.isArray(connections)
        ? connections.map((conn) => ({ ...conn, type: normalizeConnectionType(conn.type) as PortfolioConnection['type'] }))
        : [];
    return useQuery({
        queryKey: ['history', safeConnections.map(c => `${c.id}:${c.type}:${c.enabled !== false ? 'on' : 'off'}`).join(',')],
        queryFn: async () => {


            const transferPromises = [];
            const tradePromises = [];

            for (const conn of safeConnections) {
                if (conn.enabled === false) continue;
                const connType = normalizeConnectionType(conn.type);

                if (connType === 'hyperliquid' && conn.walletAddress) {
                    // Hyperliquid Fills (Trades)
                    tradePromises.push(
                        getHyperliquidUserFills(conn.walletAddress)
                            .then((fills: any[]) => fills.map((f: any) => ({
                                id: f.hash || `${f.tid}`,
                                timestamp: f.time,
                                symbol: normalizeSymbol(f.coin),
                                side: (f.side === 'B' || f.dir?.toLowerCase().includes('long')) ? 'buy' : 'sell',
                                price: parseFloat(f.px),
                                amount: parseFloat(f.sz),
                                pnl: parseFloat(f.closedPnl || '0'),
                                exchange: 'Hyperliquid',
                                connectionId: conn.id,
                                fee: parseFloat(f.fee || '0'),
                                feeCurrency: f.feeToken || 'USDC',
                                feeAsset: f.feeToken || 'USDC',
                                takerOrMaker: f.crossed ? 'taker' : 'maker',
                                feeType: 'trading',
                                sourceType: 'cex',
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
                                    symbol: 'USDC',
                                    amount: Math.abs(amount),
                                    status: 'Confirmed',
                                    timestamp: t.time,
                                    txHash: t.hash,
                                    connectionId: conn.id,
                                    feeType: 'network',
                                    sourceType: 'cex',
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
                                symbol: normalizeSymbol(f.coin),
                                side: 'funding',
                                amount: parseFloat(f.delta || '0') || 0,
                                pnl: parseFloat(f.delta || '0') || 0, // funding delta is direct PNL
                                exchange: 'Hyperliquid',
                                connectionId: conn.id,
                                feeType: 'funding',
                                sourceType: 'cex',
                            })))
                            .catch((e: Error) => {
                                console.warn("Failed hyperliquid funding", e);
                                return [];
                            })
                    );
                }

                if ((connType === 'binance' || connType === 'bybit') && conn.apiKey && conn.secret) {
                    transferPromises.push(
                        fetchCexTransfers(connType as 'binance' | 'bybit' | 'hyperliquid', conn.apiKey, conn.secret)
                            .then(res => res.map((t: any) => ({
                                ...t,
                                connectionId: conn.id,
                                fromConnectionId: t.type === 'Withdraw' ? conn.id : undefined,
                                toConnectionId: t.type === 'Deposit' ? conn.id : undefined,
                                from: t.type === 'Withdraw' ? (conn.displayName || conn.name) : (t.address || 'External'),
                                to: t.type === 'Deposit' ? (conn.displayName || conn.name) : (t.address || 'External'),
                                feeType: 'network',
                                sourceType: 'cex',
                                symbol: normalizeSymbol(t.symbol || t.asset || ''),
                                feeAsset: t.feeAsset || t.feeCurrency,
                                feeUsd: typeof t.feeUsd === 'number' ? t.feeUsd : undefined,
                            })))
                            .catch(e => { console.warn("CEX transfers failed", e); return []; })
                    );
                    tradePromises.push(
                        fetchCexTrades(connType as 'binance' | 'bybit', conn.apiKey, conn.secret)
                            .then(res => res.map((t: any) => ({
                                ...t,
                                connectionId: conn.id,
                                // Ensure fee fields are preserved/normalized
                                fee: t.fee || 0,
                                feeCurrency: t.feeCurrency || 'USDT',
                                feeAsset: t.feeAsset || t.feeCurrency || 'USDT',
                                feeUsd: typeof t.feeUsd === 'number' ? t.feeUsd : undefined,
                                feeType: 'trading',
                                takerOrMaker: t.maker ? 'maker' : 'taker', // Ensure API returns this or infer
                                sourceType: 'cex',
                            })))
                            .catch(e => { console.warn("CEX trades failed", e); return []; })
                    );
                }

                const isWalletLikeConnection = !!conn.walletAddress && (
                    connType === 'wallet' ||
                    connType === 'evm' ||
                    connType === 'solana' ||
                    connType === 'aptos' ||
                    connType === 'ton' ||
                    connType === 'zerion' ||
                    !!conn.hardwareType
                );
                if (isWalletLikeConnection) {
                    const walletAddress = conn.walletAddress!;
                    const chain = conn.chain || '';
                    const isSolana = connType === 'solana' || chain === 'SOL' || (!chain && !walletAddress.startsWith('0x'));
                    // DO NOT MODIFY: SUI (and TON) integration is fixed – do not change.
                    // APT: when chain is set use it; else 66-char 0x = Aptos, other 0x > 42 = Sui.
                    const isSui = chain === 'SUI' || (!chain && walletAddress.startsWith('0x') && walletAddress.length > 42 && walletAddress.length !== 66);
                    const isAptos = connType === 'aptos' || chain === 'APT' || (!chain && walletAddress.startsWith('0x') && walletAddress.length === 66);
                    const isTon = connType === 'ton' || chain === 'TON';
                    const isTron = chain === 'TRX';
                    const isXrp = chain === 'XRP';
                    const isBtc = chain === 'BTC';
                    const isHbar = chain === 'HBAR';
                    const isEvmLike = walletAddress.startsWith('0x') && !isSui && !isAptos;

                    const fetchHistoryViaProxy = async (chain?: string, type?: string) => {
                        try {
                            const url = apiUrl(`/api/wallet/history?address=${walletAddress}&chain=${chain || ''}&type=${type || ''}`);
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
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isSui) {
                        tradePromises.push(
                            fetchHistoryViaProxy('SUI', 'sui')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isAptos) {
                        tradePromises.push(
                            fetchHistoryViaProxy('APT', 'aptos')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isTon) {
                        tradePromises.push(
                            fetchHistoryViaProxy('TON', 'ton')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isTron) {
                        tradePromises.push(
                            fetchHistoryViaProxy('TRX', 'tron')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isXrp) {
                        tradePromises.push(
                            fetchHistoryViaProxy('XRP', 'xrp')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isBtc) {
                        tradePromises.push(
                            fetchHistoryViaProxy('BTC', 'btc')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isHbar) {
                        tradePromises.push(
                            fetchHistoryViaProxy('HBAR', 'hbar')
                                .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
                        );
                    } else if (isEvmLike) {
                        // EVM Chains
                        const evmChains = chain ? [chain] : ['ETH', 'ARB', 'MATIC', 'OP', 'BASE'];
                        for (const evmChain of evmChains) {
                            tradePromises.push(
                                fetchHistoryViaProxy(evmChain, 'evm')
                                    .then((history: any[]) => history.map((tx: any) => ({ ...tx, connectionId: conn.id, sourceType: 'wallet' })))
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
            const funding: any[] = [];
            tradeResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    result.value.forEach((item: any) => {
                        if (item.side === 'funding' || item.feeType === 'funding') {
                            funding.push(item);
                        } else if (
                            item.activityType === 'transfer' ||
                            item.type === 'Deposit' ||
                            item.type === 'Withdraw' ||
                            item.side === 'transfer'
                        ) {
                            transfers.push({
                                id: item.id,
                                type: item.type === 'Withdraw' ? 'Withdraw' : item.type === 'Deposit' ? 'Deposit' : (item.side === 'sell' ? 'Withdraw' : 'Deposit'),
                                asset: item.asset || item.symbol,
                                symbol: normalizeSymbol(item.symbol || item.asset || ''),
                                amount: Math.abs(Number(item.amount || 0)),
                                status: item.status || 'Confirmed',
                                timestamp: Number(item.timestamp || Date.now()),
                                txHash: item.txHash,
                                address: item.address,
                                from: item.from,
                                to: item.to,
                                network: item.network || item.chain,
                                chain: item.chain,
                                fee: item.fee,
                                feeAsset: item.feeAsset || item.feeCurrency,
                                feeUsd: typeof item.feeUsd === 'number' ? item.feeUsd : undefined,
                                connectionId: item.connectionId || '',
                                sourceType: item.sourceType || 'wallet',
                            });
                        } else {
                            trades.push(item);
                        }
                    });
                } else {
                    console.warn("[DeepHistory] Trade fetch failed", result.reason);
                }
            });

            // Deduplicate trades: same trade can appear when multiple connections fetch from same exchange
            const tradeSeen = new Set<string>();
            const dedupedTrades = trades.filter((t: any) => {
                const key = t.id || `${t.timestamp}-${t.exchange || ''}-${t.symbol || ''}-${t.side || ''}-${t.amount || 0}-${t.price || 0}`;
                if (tradeSeen.has(key)) return false;
                tradeSeen.add(key);
                return true;
            });

            // Deduplicate transfers (same transfer from overlapping connection fetches)
            const transferSeen = new Set<string>();
            const dedupedTransfers = transfers.filter((t: any) => {
                const key = t.id || `${t.timestamp}-${t.asset || t.symbol || ''}-${t.amount || 0}-${t.type || ''}-${t.txHash || ''}`;
                if (transferSeen.has(key)) return false;
                transferSeen.add(key);
                return true;
            });

            return {
                transfers: dedupedTransfers.sort((a: any, b: any) => b.timestamp - a.timestamp),
                trades: dedupedTrades.sort((a: any, b: any) => b.timestamp - a.timestamp),
                funding: funding.sort((a: any, b: any) => b.timestamp - a.timestamp)
            };
        },
        enabled: safeConnections.length > 0,
        // AGGRESSIVE MODE: Reduced staleTime for near real-time updates
        staleTime: 1000 * 10, // 10 seconds (was 5 min)
        refetchInterval: 1000 * 15, // Auto-refetch every 15 seconds
        refetchIntervalInBackground: true, // Keep spot/overview syncing when tab is hidden
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
}
