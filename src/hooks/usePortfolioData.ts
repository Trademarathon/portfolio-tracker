
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { getTopCoins, fetchSpecificPrices } from '@/lib/api/prices';
import { apiFetch } from '@/lib/api/client';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { PortfolioAsset, AssetSector, Transaction, Position, PortfolioConnection } from '@/lib/api/types';
import { useLivePrices } from './useLivePrices';
import { getChainPortfolio } from "@/lib/api/wallet";
import { getZerionFullPortfolio } from "@/lib/api/zerion";
import {
    getHyperliquidAccountState,
    getHyperliquidOpenOrdersResult,
    getHyperliquidSpotMeta,
    getHyperliquidSpotState,
    parseHyperliquidPositions,
    getHyperliquidAllAssets,
    getHyperliquidPerpsMetaAndCtxs,
    getHyperliquidNotionalVolumeUsd,
    SpotMeta,
    PerpsMetaWithCtx
} from '@/lib/api/hyperliquid';
import { fetchBybitBalanceByType, fetchCexBalance, fetchCexOpenOrders, fetchCexPositions } from '@/lib/api/cex';
import { EnhancedWebSocketManager } from '@/lib/api/websocket-enhanced';

import { WebSocketConnectionInfo, WebSocketMessage } from '@/lib/api/websocket-types';
import { processActivities } from '@/lib/api/transactions';
import {
    buildCumulativePnlAndDrawdownSeries,
    buildUtcDayOfWeekBuckets,
    buildUtcTwoHourBuckets
} from '@/lib/journal/analytics-core';
import { useUserHistory } from "./useUserHistory";
import { useRealTimeData } from "./useRealTimeData";

const PORTFOLIO_SNAPSHOT_KEY = "portfolio_snapshot_v1";

/** Max sane balance per token in one wallet (filter impossible/scam amounts from chain APIs) */
const MAX_SANE_BALANCE = 1e24;

/** Return true if this symbol+balance should be skipped when adding from chain fetches (fake/scam/impossible) */
function shouldSkipFakeTokenFromFetch(symbol: string, balance: number): boolean {
    if (!symbol || balance <= 0) return true;
    if (balance > MAX_SANE_BALANCE) return true; // Impossible balance (e.g. 8e48 "ETH" scam)
    const raw = String(symbol).toUpperCase().trim();
    if (raw === "H") return true;
    if (raw.length > 28) return true; // Long scammy names
    const spamPatterns = [
        /\bCLAIM\b/, /\bAIRDROP\b/, /\bREWARDS?\b/, /\bBRIDGE\b/, /\bHTTPS?:\/\//,
        /\.(COM|APP|IO|XYZ|LAT|LOL|NET)\b/, /\bME-QR\b/, /\bVERCEL\.APP\b/, /\bGET\s+(PEPE|TOKEN|COIN|FREE)\b/i,
        /\$\s*(DHT|FOXY|POL|PEPE)\s*(AT|@)/i, /AT\s+HTTPS/i, /\[.*\.COM\]/i,
        /\bREWARD\s+AT\b/, /\bVOUCHER\s+AT\b/, /\bCEX\.LAT\b/, /\bOPCHAIN\.LOL\b/, /\bFIRSTCHEF\.NET\b/,
        /\s+AT\s+[A-Z0-9.-]+\.(COM|LAT|LOL|NET|APP)\b/
    ];
    if (spamPatterns.some(p => p.test(raw))) return true;
    return false;
}

/** Detect wallet spam/junk tokens (claim airdrops, scam URLs, vouchers, etc.) so we can hide them from the assets list */
function isLikelySpamOrFakeToken(asset: { symbol: string; valueUsd: number; price?: number; name?: string }): boolean {
    if (asset.valueUsd > 0.01) return false; // Has real value, keep it
    const raw = String(asset.symbol || '').toUpperCase();
    if (raw === "H") return true;
    const name = String(asset.name || '').toUpperCase();
    const combined = `${raw} ${name}`;
    if (raw.length > 28) return true; // Long scammy names (e.g. "30000P VOUCHER AT OPCHAIN.LOL")
    const spamPatterns = [
        /\bCLAIM\b/, /\bAIRDROP\b/, /\bREWARDS?\b/, /\bBRIDGE\b/, /\bHTTPS?:\/\//,
        /\.(COM|APP|IO|XYZ|LAT|LOL|NET)\b/, /\bME-QR\b/, /\bVERCEL\.APP\b/, /\bGET\s+(PEPE|TOKEN|COIN|FREE)\b/i,
        /\$\s*(DHT|FOXY|POL|PEPE)\s*(AT|@)/i, /AT\s+HTTPS/i, /\[.*\.COM\]/i,
        /\bREWARD\s+AT\b/, /\bVOUCHER\s+AT\b/, /\bCEX\.LAT\b/, /\bOPCHAIN\.LOL\b/, /\bFIRSTCHEF\.NET\b/,
        /\s+AT\s+[A-Z0-9.-]+\.(COM|LAT|LOL|NET|APP)\b/, // "SOMETHING AT domain.TLD"
        /\bLARRY\b/, /\bNIGGO\b/, /\bBEN\b/, /\bSNEK\b/ // Known junk/meme spam observed on some chains
    ];
    return spamPatterns.some(p => p.test(combined));
}

function getSector(symbol: string): AssetSector {
    const s = symbol.toUpperCase();
    if (['BTC', 'ETH', 'SOL', 'AVAX', 'ADA'].includes(s)) return 'L1';
    if (['UNI', 'AAVE', 'MKR', 'JUP', 'RUNE'].includes(s)) return 'DeFi';
    if (['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK'].includes(s)) return 'Meme';
    if (['RENDER', 'FET', 'TAO', 'WLD'].includes(s)) return 'AI';
    if (['USDT', 'USDC', 'DAI', 'BUSD', 'PYUSD', 'FRAX', 'USDE'].includes(s)) return 'Stablecoin';
    if (['LINK', 'STX'].includes(s)) return 'Infra';
    if (['IMX', 'GALA', 'AXS'].includes(s)) return 'Gaming';
    return 'Other';
}

function normalizeConnectionType(type: unknown): string {
    return String(type || '').toLowerCase().trim();
}

function sanitizeUiErrorMessage(raw: unknown, fallback = 'Unavailable'): string {
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return fallback;
    if (/<!doctype html|<html|<head|<body|<script/i.test(text)) {
        return 'Service unavailable (invalid response).';
    }
    const maxLen = 180;
    if (text.length > maxLen) return `${text.slice(0, maxLen - 3)}...`;
    return text;
}

function normalizeConnectionRecord(conn: PortfolioConnection): PortfolioConnection {
    return {
        ...conn,
        type: normalizeConnectionType(conn.type) as PortfolioConnection['type'],
    };
}

function isFundingLikeTransaction(tx: any): boolean {
    const feeType = String(tx?.feeType || '').toLowerCase();
    const side = String(tx?.side || '').toLowerCase();
    const marketType = String(tx?.marketType || '').toLowerCase();
    return feeType === 'funding' || side === 'funding' || marketType === 'funding';
}

function isFuturesLikeTransaction(tx: any): boolean {
    const instrumentType = String(tx?.instrumentType || '').toLowerCase();
    const marketType = String(tx?.marketType || '').toLowerCase();
    const exchange = String(tx?.exchange || '').toLowerCase();
    const rawSymbol = String(tx?.rawSymbol || tx?.symbol || '').toUpperCase();
    const symbol = String(tx?.symbol || '').toUpperCase();

    if (instrumentType === 'future') return true;
    if (marketType === 'perp' || marketType === 'future' || marketType === 'funding') return true;
    if (exchange === 'hyperliquid') return true;
    if (/(PERP|SWAP|FUTURES|CONTRACT|:USDT|:USD|USDTM|UMCBL|DMCBL)/i.test(rawSymbol)) return true;
    if (/(PERP|SWAP|FUTURES|CONTRACT)/i.test(symbol)) return true;
    if (tx?.leverage !== undefined || tx?.info?.positionIdx !== undefined) return true;
    return isFundingLikeTransaction(tx);
}

export function usePortfolioData() {
    const [staticAssets, setStaticAssets] = useState<PortfolioAsset[]>([]);
    // Transactions and Transfers are now managed by useUserHistory query
    const [spotOrders, setSpotOrders] = useState<any[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [wsConnectionStatus, setWsConnectionStatus] = useState<Map<string, WebSocketConnectionInfo>>(new Map());
    const wsManagerRef = useRef<EnhancedWebSocketManager | null>(null);
    const updateStateTimerRef = useRef<NodeJS.Timeout | null>(null);
    const updateStatePendingRef = useRef(false);


    const [spotMeta, _setSpotMeta] = useState<SpotMeta | null>(null);
    const spotMetaRef = useRef<SpotMeta | null>(null);
    const [perpMeta, _setPerpMeta] = useState<PerpsMetaWithCtx | null>(null);
    const perpMetaRef = useRef<PerpsMetaWithCtx | null>(null);

    // Wrapper to update both ref and state
    const setSpotMeta = (meta: SpotMeta | null) => {
        spotMetaRef.current = meta;
        _setSpotMeta(meta);
    };

    const setPerpMeta = (meta: PerpsMetaWithCtx | null) => {
        perpMetaRef.current = meta;
        _setPerpMeta(meta);
    };

    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [availableAssets, setAvailableAssets] = useState<{ perp: string[], spot: string[] }>({ perp: [], spot: [] });
    const [manualTransactions, setManualTransactions] = useState<Transaction[]>([]);
    const [selectedChart, setSelectedChart] = useState<{
        symbol: string;
        entryPrice?: number;
        avgBuyPrice?: number;
        avgSellPrice?: number;
        side?: string;
        timeframe?: '5m' | '15m' | '1h' | '4h' | '1d';
    } | null>(null);
    const [refetchTrigger, setRefetchTrigger] = useState(0);
    const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
    const hasBootstrappedRef = useRef(false);

    // Top-level refs for state that updates frequently or needs to be accessed in callbacks without causing re-renders
    const assetsMapRef = useRef<{ [key: string]: PortfolioAsset }>({});
    const positionsMapRef = useRef<{ [connectionId: string]: Position[] }>({});
    const ordersMapRef = useRef<{ [connectionId: string]: any[] }>({});
    const priceCacheRef = useRef<any[]>([]);

    // Fee Statistics
    const [feeStats, setFeeStats] = useState<{ spot: any, futures: any }>({ spot: null, futures: null });

    // Dust Filtering
    const [hideDust, setHideDust] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('hide_dust') === 'true';
        }
        return false;
    });

    useEffect(() => {
        localStorage.setItem('hide_dust', hideDust.toString());
    }, [hideDust]);

    // Transactions and Transfers are now managed by useUserHistory query
    // Disable real history fetch if in Demo Mode
    const isDemo = connections.some(c => c.id.startsWith('demo-'));
    const { data: historyData } = useUserHistory(isDemo ? [] : connections);

    // Use stable empty array to prevent infinite loops in useMemo/useEffect
    const EMPTY_ARRAY = useMemo(() => [], []);
    const transactions = historyData?.trades || EMPTY_ARRAY;
    const transfers = historyData?.transfers || EMPTY_ARRAY;
    const funding = historyData?.funding || EMPTY_ARRAY;

    const resolveSymbol = (s: string) => {
        if (!s) return s;
        // Hyperliquid sometimes returns numeric IDs or '@<index>' which represent Universe market indexes.
        // Resolve to the base token symbol when possible, then normalize.
        if (spotMeta && (s.startsWith('@') || /^\d+$/.test(s))) {
            const marketIndex = parseInt(s.startsWith('@') ? s.substring(1) : s);
            if (!isNaN(marketIndex)) {
                const marketInfo = spotMeta.universe.find(u => u.index === marketIndex);
                if (marketInfo) {
                    const baseTokenId = marketInfo.tokens?.[0];
                    const tokenInfo = spotMeta.tokens.find(t => t.index === baseTokenId);
                    const resolved = tokenInfo?.name || marketInfo.name;
                    return normalizeSymbol(resolved || s);
                }
            }
        }

        return normalizeSymbol(s);
    };

    // DEMO MODE DATA INJECTION
    const activeTransactions = useMemo(() => {
        const raw = isDemo ? [
            { id: 'demo-tx-1', type: 'Buy', asset: 'BTC', symbol: 'BTC', amount: 0.1, price: 60000, value: 6000, timestamp: Date.now() - 3600000, status: 'completed', exchange: 'Demo Binance', fee: 5 },
            { id: 'demo-tx-2', type: 'Sell', asset: 'ETH', symbol: 'ETH', amount: 1.0, price: 3400, value: 3400, timestamp: Date.now() - 86400000, status: 'completed', exchange: 'Demo Ethereum', fee: 3.4 }
        ] : [...transactions, ...manualTransactions];

        return raw.map((t: any) => ({
            ...t,
            symbol: resolveSymbol(t.symbol),
            asset: resolveSymbol(t.asset || t.symbol)
        }));
    }, [isDemo, transactions, manualTransactions, spotMeta]);

    const futuresTransactions = useMemo(
        () => activeTransactions.filter((t: any) => isFuturesLikeTransaction(t)),
        [activeTransactions]
    );

    const activeTransfers = useMemo(() => {
        const raw = isDemo ? [] : transfers;
        return raw.map((t: any) => ({
            ...t,
            asset: resolveSymbol(t.asset)
        }));
    }, [isDemo, transfers, spotMeta]);

    const activeFunding = useMemo(() => {
        return funding.map((f: any) => ({
            ...f,
            symbol: resolveSymbol(f.symbol)
        }));
    }, [funding, spotMeta]);

    // Calculate Fee Stats whenever history changes
    useEffect(() => {
        if (!activeTransactions.length) return;

        const calculateStats = (trades: any[]) => {
            let marketFees = 0;
            let limitFees = 0;
            trades.forEach(t => {
                const fee = t.fee || 0;
                if (t.takerOrMaker === 'taker') marketFees += fee;
                else limitFees += fee;
            });
            const total = marketFees + limitFees;
            return {
                marketFees,
                limitFees,
                ratio: total > 0 ? (marketFees / total) * 100 : 0,
                count: trades.length
            };
        };

        // Filter and calculate
        setFeeStats({
            spot: calculateStats(activeTransactions.filter((t: any) => !isFuturesLikeTransaction(t))),
            futures: calculateStats(futuresTransactions.filter((t: any) => !isFundingLikeTransaction(t)))
        });
    }, [activeTransactions, futuresTransactions]);

    // Extract symbols for price WS
    // Use JSON.stringify to ensure deep equality check for dependency array
    const rawSymbols = useMemo(() => {
        const assetSymbols = staticAssets.map(a => a.symbol);
        const positionSymbols = positions.map(p => p.symbol);
        const currentOrders = ordersMapRef.current || {};
        const orderSymbols = Object.values(currentOrders).flat().map(o => normalizeSymbol(o?.symbol || ''));
        return Array.from(new Set([...assetSymbols, ...positionSymbols, ...orderSymbols])).sort();
    }, [staticAssets, positions, spotOrders]);

    const symbols = useMemo(() => rawSymbols, [JSON.stringify(rawSymbols)]);

    const { prices: livePrices, priceChanges: livePriceChanges } = useLivePrices(symbols);
    const requestedMissingSymbols = useRef<Set<string>>(new Set()); // Track requested symbols to avoid redundant calls

    const prices = { ...livePrices };
    const priceChanges = { ...livePriceChanges };
    priceCacheRef.current.forEach(p => {
        if (prices[p.symbol] === undefined) prices[p.symbol] = p.current_price;
        if (priceChanges[p.symbol] === undefined) priceChanges[p.symbol] = p.price_change_percentage_24h;
    });

    // Export WebSocket connection status for Settings page
    const getWsStatus = () => wsConnectionStatus;

    // Update State (Join with prices and names) - never throw so callers don't crash
    const performUpdateState = () => {
        try {
            const currentAssets = assetsMapRef.current || {};
            const assetList = Object.values(currentAssets);
            const priceCache = priceCacheRef.current || [];
            const initializedAssets = assetList.map(asset => {
                const cleanSym = normalizeSymbol(asset?.symbol);
                let coin = priceCache.find((p: any) => p?.symbol?.toUpperCase() === cleanSym);

                if (!coin) {
                    if (cleanSym === 'WETH') coin = priceCache.find((p: any) => p?.symbol === 'ETH');
                    if (cleanSym === 'WBTC') coin = priceCache.find((p: any) => p?.symbol === 'BTC');
                }

                let price = coin ? coin.current_price : (asset?.price ?? 0);
                if (['USDC', 'USDT', 'DAI'].includes(cleanSym) && price === 0) price = 1;

                let name = coin?.name || asset?.symbol || '';

                // Try to resolve Hyperliquid ID to Name if it looks like an ID
                const meta = spotMetaRef.current;
                const symStr = String(asset?.symbol ?? '');
                if (meta && (/^\d+$/.test(symStr) || symStr.startsWith('@'))) {
                    let id = -1;
                    if (/^\d+$/.test(symStr)) id = parseInt(symStr);
                    else if (symStr.startsWith('@')) id = parseInt(symStr.substring(1));

                    if (id !== -1) {
                        const tokenInfo = meta.tokens.find(t => t.index === id);
                        if (tokenInfo) name = tokenInfo.name;
                    }
                }

                return {
                    ...asset,
                    price,
                    valueUsd: (Number(asset?.balance) || 0) * price,
                    name
                };
            });
            setStaticAssets(initializedAssets);

            // Enriched Orders (using flattened mapping, deduplicated by exchange+id)
            const currentOrders = ordersMapRef.current || {};
            const rawOrders = Object.entries(currentOrders).flatMap(([connId, orders]) =>
                (Array.isArray(orders) ? orders : []).map((o: any) => ({ ...o, _connectionId: connId }))
            );
            const orderSeen = new Set<string>();
            const allOrders = rawOrders.filter((o: any) => {
                const key = `${o.exchange || o.connectionName || 'unknown'}-${o.id}`;
                if (orderSeen.has(key)) return false;
                orderSeen.add(key);
                return true;
            });
            setSpotOrders(allOrders.map((order: any) => {
                const cleanSym = normalizeSymbol(order?.symbol);
                const coin = priceCache.find((p: any) => p?.symbol?.toUpperCase() === cleanSym);

                let resolvedSymbol = cleanSym;
                let assetName = coin?.name || cleanSym;

                // Hyperliquid specific resolution
                const meta = spotMetaRef.current;
                const exName = String((order as any).exchange || '').toLowerCase();
                const connName = String((order as any).connectionName || '').toLowerCase();
                if (meta && (exName === 'hyperliquid' || connName.includes('hyperliquid'))) {
                    // If symbol is numeric or starts with @, treat as Market ID (Universe Index)
                    // We need to find the Base Token for this Market
                    let marketIndex = -1;

                    const ordSym = String(order?.symbol ?? '');
                    if (/^\d+$/.test(ordSym)) {
                        marketIndex = parseInt(ordSym);
                    } else if (ordSym.startsWith('@')) {
                        const idx = parseInt(ordSym.substring(1));
                        if (!isNaN(idx)) marketIndex = idx;
                    }

                    if (marketIndex !== -1) {
                        // 1. Find Market in Universe
                        const marketInfo = meta.universe.find(u => u.index === marketIndex);
                        if (marketInfo) {
                            // 2. Get Base Token ID from Market (tokens[0] is Base, tokens[1] is Quote)
                            const baseTokenId = marketInfo.tokens[0];

                            // 3. Find Token Name in Tokens list
                            const tokenInfo = meta.tokens.find(t => t.index === baseTokenId);
                            if (tokenInfo) {
                                resolvedSymbol = normalizeSymbol(tokenInfo.name);
                            } else {
                                // Fallback to market name if token not found (e.g. @156)
                                resolvedSymbol = normalizeSymbol(marketInfo.name);
                            }

                            // If we resolved a better symbol, prefer that for display name too
                            assetName = coin?.name || resolvedSymbol;
                        }
                    }
                }

                return {
                    ...order,
                    symbol: resolvedSymbol,
                    assetName,
                    originalSymbol: order?.symbol
                };
            }));

            // Enriched Positions
            const currentPositions = positionsMapRef.current || {};
            const allPositions = Object.values(currentPositions).flat();
            setPositions(allPositions.map((pos: any) => {
                const cleanSym = normalizeSymbol(pos?.symbol);
                const coin = priceCache.find((p: any) => p?.symbol?.toUpperCase() === cleanSym);
                return {
                    ...pos,
                    assetName: coin?.name || cleanSym
                };
            }));
        } catch (err) {
            console.warn("[usePortfolioData] updateState error:", err);
        }
    };

    const updateState = () => {
        if (updateStatePendingRef.current) return;
        updateStatePendingRef.current = true;
        if (updateStateTimerRef.current) clearTimeout(updateStateTimerRef.current);
        updateStateTimerRef.current = setTimeout(() => {
            updateStatePendingRef.current = false;
            performUpdateState();
        }, 120);
    };

    const addAsset = (symbol: string, balance: number, sourceName: string, connectionId: string = "unknown", subType?: string) => {
        if (shouldSkipFakeTokenFromFetch(symbol, balance)) return; // Skip fake/scam/impossible balances from chain fetches
        const _rawS = symbol.toUpperCase();
        const s = normalizeSymbol(symbol);

        // Use connectionId as the key to ensure uniqueness between accounts with same name
        // If subType is provided, create a composite key to separate balances logically (e.g. Spot vs Perp)
        const breakdownKey = subType ? `${connectionId}::${subType}` : connectionId;

        if (!assetsMapRef.current[s]) {
            assetsMapRef.current[s] = {
                symbol: s,
                balance: 0,
                valueUsd: 0,
                allocations: 0,
                sector: getSector(s),
                breakdown: {}
            };
        }

        if (assetsMapRef.current[s].breakdown) {
            assetsMapRef.current[s].breakdown![breakdownKey] = balance;
            const breakdown = assetsMapRef.current[s].breakdown || {};
            const total = Object.values(breakdown).reduce((acc: number, val: any) => acc + (val || 0), 0);
            assetsMapRef.current[s].balance = total;
        }

        // Sync total value immediately if price exists
        if (assetsMapRef.current[s].price) {
            assetsMapRef.current[s].valueUsd = assetsMapRef.current[s].balance * assetsMapRef.current[s].price!;
        }
    };

    // Clear all breakdown entries for a connection to prevent stale/duplicate data
    const clearConnectionBreakdown = (connectionId: string) => {
        const currentAssets = assetsMapRef.current || {};
        Object.values(currentAssets).forEach(asset => {
            if (asset.breakdown) {
                let changed = false;
                Object.keys(asset.breakdown).forEach(key => {
                    // Match both "connectionId" and "connectionId::subType" patterns
                    if (key === connectionId || key.startsWith(`${connectionId}::`)) {
                        delete asset.breakdown![key];
                        changed = true;
                    }
                });
                if (changed) {
                    // Recalculate total balance after removing entries
                    const total = Object.values(asset.breakdown).reduce((acc: number, val: any) => acc + (val || 0), 0);
                    asset.balance = total;
                    if (asset.price) asset.valueUsd = total * asset.price;
                }
            }
        });
    };

    const updatePositions = (connectionId: string, newPositions: Position[]) => {
        const connection = connections.find((c) => c.id === connectionId);
        const exchange = normalizeConnectionType(connection?.type || connection?.name || '');
        positionsMapRef.current[connectionId] = (Array.isArray(newPositions) ? newPositions : []).map((pos) => ({
            ...pos,
            connectionId: pos.connectionId || connectionId,
            exchange: pos.exchange || exchange || undefined,
            marketType: pos.marketType || 'perp',
        }));
        updateState();
    };

    const updateOrders = (connectionId: string, newOrders: any[]) => {
        ordersMapRef.current[connectionId] = newOrders;
        updateState();
    };

    const addManualTransaction = (tx: Transaction) => {
        const updated = [tx, ...manualTransactions];
        setManualTransactions(updated);
        localStorage.setItem("manual_transactions", JSON.stringify(updated));
    };

    // Manual Transaction Balance Calculation
    useEffect(() => {
        // 1. Clear existing manual balances from all assets to avoid stale data
        const currentAssets = assetsMapRef.current || {};
        Object.values(currentAssets).forEach(asset => {
            if (asset.breakdown) {
                let changed = false;
                Object.keys(asset.breakdown || {}).forEach(key => {
                    // Manual transactions use subType 'Manual', producing key `${connId}::Manual`
                    if (key.endsWith('::Manual')) {
                        delete asset.breakdown![key];
                        changed = true;
                    }
                });

                if (changed) {
                    // Re-calculate total if we removed something
                    const total = Object.values(asset.breakdown || {}).reduce((acc: number, val: any) => acc + (val || 0), 0);
                    asset.balance = total;
                    if (asset.price) asset.valueUsd = total * asset.price!;
                }
            }
        });

        if (manualTransactions.length === 0) {
            updateState();
            return;
        }

        const balances = new Map<string, Map<string, number>>(); // connId -> symbol -> amount

        manualTransactions.forEach(tx => {
            if (!tx.connectionId) return;

            if (!balances.has(tx.connectionId)) balances.set(tx.connectionId, new Map());
            const wallet = balances.get(tx.connectionId)!;

            const sym = normalizeSymbol(tx.symbol);
            const qty = tx.side === 'buy' ? tx.amount : -tx.amount;

            wallet.set(sym, (wallet.get(sym) || 0) + qty);
        });

        balances.forEach((walletBalances, connId) => {
            const conn = connections.find(c => c.id === connId);
            const name = conn ? conn.name : 'Unknown Manual';

            walletBalances.forEach((amount, symbol) => {
                addAsset(symbol, amount, name, connId, 'Manual');
            });
        });

        updateState();
    }, [manualTransactions, connections]);

    const lastConnectionsKeyRef = useRef<string>('');
    const retryOnceRef = useRef(false);
    const fingerprintConnectionsRaw = (raw: string | null): string => {
        if (!raw) return '0';
        return `${raw.length}:${raw.slice(0, 200)}`;
    };

    // Refetch portfolio when connections change (e.g. add hardware wallet chains or Bybit in Settings)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onConnectionsChanged = () => setRefetchTrigger(t => t + 1);
        window.addEventListener('connections-changed', onConnectionsChanged);
        const onStorage = (e: StorageEvent) => { if (e.key === 'portfolio_connections') onConnectionsChanged(); };
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener('connections-changed', onConnectionsChanged);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    // When user returns to tab, re-read connections and refetch if they changed (backup for missed events)
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const onVisible = () => {
            try {
                const raw = localStorage.getItem('portfolio_connections');
                const nextKey = fingerprintConnectionsRaw(raw);
                if (nextKey !== lastConnectionsKeyRef.current) {
                    lastConnectionsKeyRef.current = nextKey;
                    setRefetchTrigger(t => t + 1);
                }
            } catch (_) { }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    useEffect(() => {
        async function fetchData() {
            if (!hasBootstrappedRef.current) setLoading(true);
            let restoredAssetsSnapshot: PortfolioAsset[] = [];
            let restoredPositionsSnapshot: Position[] = [];
            let restoredOrdersSnapshot: any[] = [];
            let savedConnectionsRaw: string | null = null;
            if (typeof window !== 'undefined') {
                try {
                    const raw = localStorage.getItem(PORTFOLIO_SNAPSHOT_KEY);
                    if (raw) {
                        const snap = JSON.parse(raw) as {
                            assets?: PortfolioAsset[];
                            positions?: Position[];
                            spotOrders?: any[];
                        };
                        if (Array.isArray(snap.assets) && snap.assets.length > 0) {
                            restoredAssetsSnapshot = snap.assets;
                            const restoredMap: { [key: string]: PortfolioAsset } = {};
                            snap.assets.forEach((asset) => {
                                if (asset?.symbol) restoredMap[asset.symbol] = asset;
                            });
                            assetsMapRef.current = restoredMap;
                            setStaticAssets(snap.assets);
                        }
                        if (Array.isArray(snap.positions) && snap.positions.length > 0) {
                            restoredPositionsSnapshot = snap.positions;
                            setPositions(snap.positions);
                        }
                        if (Array.isArray(snap.spotOrders) && snap.spotOrders.length > 0) {
                            restoredOrdersSnapshot = snap.spotOrders;
                            setSpotOrders(snap.spotOrders);
                        }
                    }
                } catch {
                    // ignore invalid snapshot
                }
            }
            let parsedConnections: PortfolioConnection[] = [];
            try {
                savedConnectionsRaw = localStorage.getItem("portfolio_connections");
                if (savedConnectionsRaw) {
                    const parsed = JSON.parse(savedConnectionsRaw);
                    parsedConnections = Array.isArray(parsed)
                        ? parsed.map((conn) => normalizeConnectionRecord(conn as PortfolioConnection))
                        : [];
                }
            } catch (e) {
                console.warn("[usePortfolioData] Failed to parse portfolio_connections", e);
            }
            lastConnectionsKeyRef.current = fingerprintConnectionsRaw(savedConnectionsRaw);
            setConnections(parsedConnections);
            const savedWatchlist = localStorage.getItem("user_watchlist");
            const watchlistSymbols = savedWatchlist ? JSON.parse(savedWatchlist) : [];

            const savedManualTxs = localStorage.getItem("manual_transactions");
            if (savedManualTxs) {
                try {
                    setManualTransactions(JSON.parse(savedManualTxs));
                } catch (e) {
                    console.warn("Failed to parse manual transactions", e);
                }
            }

            // Preserve in-memory maps during refetch to avoid UI blank/flicker when APIs are temporarily unavailable.

            // Clear CEX errors so Retry shows Loading, then we set error again if fetch fails
            const cexIds = parsedConnections
                .filter((c) => c.enabled !== false && ['binance', 'bybit', 'okx'].includes(normalizeConnectionType(c.type)))
                .map((c) => c.id);
            if (cexIds.length > 0) {
                setConnectionErrors(prev => {
                    const next = { ...prev };
                    cexIds.forEach(id => delete next[id]);
                    return next;
                });
            }

            // No connections: stop loading immediately, no need to wait
            if (parsedConnections.length === 0) {
                setWatchlist(watchlistSymbols);
                setLoading(false);
                hasBootstrappedRef.current = true;
                return;
            }

            try {
                // 1. Fetch Hyperliquid metadata ONLY if a Hyperliquid connection is enabled.
                // This prevents background 429 spam when users don't use Hyperliquid.
                const hasHyperliquid = parsedConnections.some(
                    c => c.enabled !== false && normalizeConnectionType(c.type) === 'hyperliquid' && !!c.walletAddress
                );
                if (hasHyperliquid) {
                    try {
                        const [sMeta, pMeta] = await Promise.all([
                            getHyperliquidSpotMeta(),
                            getHyperliquidPerpsMetaAndCtxs()
                        ]);
                        if (sMeta) setSpotMeta(sMeta);
                        if (pMeta) setPerpMeta(pMeta);
                    } catch (e) {
                        console.warn("Metadata pre-fetch failed:", e);
                    }
                }

                // 2. Start Price Fetch Immediately (Parallel)
                getTopCoins(250).then(data => {
                    priceCacheRef.current = data;
                    updateState();
                }).catch(e => console.warn("Price fetch failed", e));

                // 3. Initialize WebSocket Manager (Non-blocking)
                if (!wsManagerRef.current && parsedConnections.length > 0) {
                    wsManagerRef.current = new EnhancedWebSocketManager(
                        parsedConnections,
                        (msg: WebSocketMessage) => {
                            const conn = parsedConnections.find(c => c.id === msg.connectionId);
                            const exchange = normalizeConnectionType(conn?.type || msg.source);
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('ws-message', { detail: { ...msg, exchange } }));
                            }

                            if (msg.type === 'balance' && Array.isArray(msg.data)) {
                                // Find connection to determine type for proper subType
                                const isCex = conn && ['binance', 'bybit', 'hyperliquid'].includes(conn.type);
                                const subType = isCex ? 'Spot' : undefined;

                                msg.data.forEach((b: any) => {
                                    const total = b.free !== undefined ? b.free + (b.locked || 0) : b.balance;
                                    addAsset(b.symbol, total, msg.source, msg.connectionId, subType);
                                });
                                if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('balance-update', { detail: msg.data }));
                                }
                                updateState();
                            } else if (msg.type === 'blockchain' && msg.data) {
                                const data = msg.data as Record<string, unknown>;
                                if (data.balance !== undefined) {
                                    const symbol = String(data.symbol || data.chain || 'Unknown');
                                    addAsset(symbol, parseFloat(String(data.balance)), msg.source, msg.connectionId);
                                    updateState();
                                }
                            } else if (msg.type === 'position' && Array.isArray(msg.data)) {
                                if (msg.connectionId) {
                                    updatePositions(msg.connectionId, msg.data);
                                }
                                if (typeof window !== 'undefined') {
                                    msg.data.forEach((position: unknown) => {
                                        window.dispatchEvent(new CustomEvent('position-update', { detail: position }));
                                    });
                                }
                            }
                        },
                        (status) => setWsConnectionStatus(status)
                    );

                    try {
                        wsManagerRef.current.initialize(); // Don't await
                    } catch (e) {
                        console.warn("[usePortfolioData] Failed to initialize WS Manager:", e);
                    }
                }

                // 4. fetching REST data (Initial Snapshot)
                const restPromises = [];
                const setConnectionError = (connId: string, message: string) => {
                    setConnectionErrors(prev => ({ ...prev, [connId]: sanitizeUiErrorMessage(message) }));
                };
                const clearConnectionError = (connId: string) => {
                    setConnectionErrors(prev => {
                        const next = { ...prev };
                        delete next[connId];
                        return next;
                    });
                };
                for (const conn of parsedConnections) {
                    if (conn.enabled === false) continue;
                    const connType = normalizeConnectionType(conn.type);
                    const wrap = (p: Promise<any>) => p.then(() => updateState()).catch(e => console.warn(`Fetch failed for ${conn.name}`, e));
                    const wrapCex = (connId: string, p: Promise<any>) =>
                        p.then(() => {
                            try { clearConnectionError(connId); updateState(); } catch (_) { }
                        }).catch((e: unknown) => {
                            try {
                                setConnectionError(connId, (e instanceof Error ? e.message : String(e)) || 'Unavailable');
                            } catch (_) { }
                            console.warn(`Fetch failed for ${conn.name}`, e);
                        });
                    const withTimeout = <T,>(promise: Promise<T>, ms = 9000) =>
                        Promise.race([
                            promise,
                            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)),
                        ]);
                    const isWalletLikeConnection = !!conn.walletAddress && (
                        connType === 'wallet' ||
                        connType === 'evm' ||
                        connType === 'solana' ||
                        connType === 'zerion' ||
                        connType === 'aptos' ||
                        connType === 'ton' ||
                        !!conn.hardwareType
                    );
                    const fetchWalletChain = async (chain: string) => {
                        const address = conn.walletAddress!;
                        try {
                            const res = await apiFetch(`/api/wallet/portfolio?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`, {}, 9000);
                            if (res.ok) {
                                const data = await res.json();
                                if (Array.isArray(data)) return data;
                            }
                        } catch {
                            // Fall through to direct chain fetch below.
                        }
                        return await withTimeout(getChainPortfolio(address, chain as any), 9000);
                    };

                    if (isWalletLikeConnection) {
                        const walletAddress = conn.walletAddress!;
                        const chain = conn.chain || '';
                        const isSolana = connType === 'solana' || chain === 'SOL' || (!chain && !walletAddress.startsWith('0x') && walletAddress.length > 30);
                        const isEvm = connType === 'evm' || (walletAddress.startsWith('0x') && chain !== 'APT' && chain !== 'SUI');
                        const isBitcoin = chain === 'BTC' || (!walletAddress.startsWith('0x') && (walletAddress.startsWith('1') || walletAddress.startsWith('3') || walletAddress.startsWith('bc1')));
                        const isHedera = chain === 'HBAR' || /^\d+\.\d+\.\d+$/.test(walletAddress);
                        // DO NOT MODIFY: SUI and TON integration is fixed – do not change.
                        // APT: when chain is set use it; else 66-char 0x = Aptos, other 0x > 42 = Sui (no double-fetch).
                        const isSui = chain === 'SUI' || (!chain && walletAddress.startsWith('0x') && walletAddress.length > 42 && walletAddress.length !== 66);
                        const isAptos = connType === 'aptos' || chain === 'APT' || (!chain && walletAddress.startsWith('0x') && walletAddress.length === 66);
                        const isTon = connType === 'ton' || chain === 'TON' || (walletAddress.startsWith('EQ') || walletAddress.startsWith('UQ'));
                        const isTron = chain === 'TRX' || (walletAddress.startsWith('T') && walletAddress.length === 34);
                        const isXrp = chain === 'XRP' || (walletAddress.startsWith('r') && walletAddress.length >= 25 && walletAddress.length <= 35);
                        const isZerion = connType === 'zerion';

                        const addBalances = (balances: any[]) => {
                            (Array.isArray(balances) ? balances : []).forEach((b: any) => {
                                if (b && (b.symbol != null || b.coin != null)) addAsset(b.symbol ?? b.coin, typeof b.balance === 'number' ? b.balance : parseFloat(b.balance ?? b.total ?? '0') || 0, conn.name, conn.id);
                            });
                        };

                        // Fetch wallet balances directly from chain APIs (no server needed – works in browser and Tauri)
                        if (isZerion) {
                            restPromises.push(wrap(withTimeout(getZerionFullPortfolio(walletAddress), 9000).then(p => addBalances((p.tokens || []).map(t => ({ symbol: t.symbol, balance: t.balance }))))));
                        }
                        if (isEvm && !isSui && !isAptos) {
                            // Only fetch the explicitly selected chain. If none is set, default to ETH only.
                            const chains = (chain ? [chain] : ['ETH']) as string[];
                            for (const ch of chains) {
                                restPromises.push(wrap(fetchWalletChain(ch).then(addBalances)));
                            }
                        }
                        if (isSolana) restPromises.push(wrap(fetchWalletChain('SOL').then(addBalances)));
                        if (isBitcoin) restPromises.push(wrap(fetchWalletChain('BTC').then(addBalances)));
                        if (isHedera) restPromises.push(wrap(fetchWalletChain('HBAR').then(addBalances)));
                        // SUI: fixed – do not modify.
                        if (isSui) {
                            restPromises.push(wrap(fetchWalletChain('SUI').then((balances) => {
                                clearConnectionBreakdown(conn.id);
                                addBalances(balances);
                            })));
                        }
                        if (isAptos) {
                            restPromises.push(wrap(fetchWalletChain('APT').then((balances) => {
                                clearConnectionBreakdown(conn.id);
                                addBalances(balances);
                            })));
                        }
                        if (isTon) {
                            restPromises.push(wrap(fetchWalletChain('TON').then((balances) => {
                                clearConnectionBreakdown(conn.id);
                                addBalances(balances);
                            })));
                        }
                        if (isTron) restPromises.push(wrap(fetchWalletChain('TRX').then(addBalances)));
                        if (isXrp) restPromises.push(wrap(fetchWalletChain('XRP').then(addBalances)));
                    }

                    if (connType === 'binance' && conn.apiKey && conn.secret) {
                        restPromises.push(wrapCex(conn.id, fetchCexBalance('binance', conn.apiKey, conn.secret).then((balances: any[]) => {
                            clearConnectionBreakdown(conn.id);
                            balances.forEach((b: { symbol: string; balance: number }) => addAsset(b.symbol, b.balance, conn.name, conn.id, 'Spot'));
                        })));
                        restPromises.push(wrap(fetchCexOpenOrders('binance', conn.apiKey, conn.secret).then((orders: any[]) => updateOrders(conn.id, orders))));
                    }

                    if (connType === 'bybit' && conn.apiKey && conn.secret) {
                        let bybitCleared = false;
                        const ensureBybitClear = () => {
                            if (bybitCleared) return;
                            bybitCleared = true;
                            clearConnectionBreakdown(conn.id);
                        };
                        const addBybitBalances = (balances: any[], subType: 'Spot' | 'Perp') =>
                            balances.forEach((b: { symbol: string; balance: number }) => {
                                ensureBybitClear();
                                addAsset(b.symbol, b.balance, conn.name, conn.id, subType);
                            });

                        const bybitBalanceTask = (async () => {
                            const stables = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDE'];
                            const attemptErrors: string[] = [];
                            let typedAttempts = 0;
                            let typedFailures = 0;
                            let mergedAttempted = false;
                            let mergedFailed = false;
                            let hasData = false;
                            const tryByType = async (accountType: 'spot' | 'unified' | 'swap' | 'contract' | 'funding') => {
                                typedAttempts += 1;
                                try {
                                    return await fetchBybitBalanceByType(accountType, conn.apiKey!, conn.secret!);
                                } catch (e) {
                                    typedFailures += 1;
                                    const message = e instanceof Error ? e.message : String(e);
                                    attemptErrors.push(`${accountType}: ${message}`);
                                    return [] as { symbol: string; balance: number }[];
                                }
                            };

                            // Spot balances: prefer SPOT account; if empty, fall back to UNIFIED.
                            let spotBalances: { symbol: string; balance: number }[] = [];
                            let unifiedBalances: { symbol: string; balance: number }[] = [];
                            spotBalances = await tryByType('spot');
                            if (spotBalances.length === 0) {
                                unifiedBalances = await tryByType('unified');
                                if (unifiedBalances.length > 0) {
                                    addBybitBalances(unifiedBalances, 'Spot');
                                    hasData = true;
                                }
                                if (unifiedBalances.length === 0) {
                                    const fundingBalances = await tryByType('funding');
                                    if (fundingBalances.length > 0) {
                                        addBybitBalances(fundingBalances, 'Spot');
                                        hasData = true;
                                    }
                                }
                            } else {
                                addBybitBalances(spotBalances, 'Spot');
                                hasData = true;
                            }

                            // Perp collateral: try swap/contract first. If empty, use unified.
                            let perpBalances: { symbol: string; balance: number }[] = [];
                            perpBalances = await tryByType('swap');
                            if (perpBalances.length === 0) {
                                perpBalances = await tryByType('contract');
                            }

                            // Only treat as Perp collateral when spot is non-empty.
                            // Do not fall back to UNIFIED here; that can mirror spot balances and double count stablecoins.
                            if (spotBalances.length > 0 && perpBalances.length > 0) {
                                const stableOnly = perpBalances.filter(b => stables.includes(normalizeSymbol(b.symbol)));
                                if (stableOnly.length > 0) {
                                    addBybitBalances(stableOnly, 'Perp');
                                    hasData = true;
                                }
                            }

                            // Final fallback: use merged Bybit balance endpoint if typed endpoints returned empty.
                            if (!hasData && spotBalances.length === 0 && unifiedBalances.length === 0 && perpBalances.length === 0) {
                                mergedAttempted = true;
                                try {
                                    const merged = await fetchCexBalance('bybit', conn.apiKey!, conn.secret!);
                                    if (merged.length > 0) {
                                        addBybitBalances(merged, 'Spot');
                                        hasData = true;
                                    }
                                } catch (e) {
                                    mergedFailed = true;
                                    const message = e instanceof Error ? e.message : String(e);
                                    attemptErrors.push(`merged: ${message}`);
                                }
                            }

                            const allTypedFailed = typedAttempts > 0 && typedFailures >= typedAttempts;
                            if (!hasData && allTypedFailed && (!mergedAttempted || mergedFailed)) {
                                throw new Error(`Bybit balance fetch failed (${attemptErrors.join(' | ')})`);
                            }
                        })();

                        restPromises.push(wrapCex(conn.id, bybitBalanceTask));

                        restPromises.push(wrap(fetchCexOpenOrders('bybit', conn.apiKey, conn.secret).then((orders: any[]) => updateOrders(conn.id, orders))));
                        restPromises.push(wrapCex(conn.id, fetchCexPositions('bybit', conn.apiKey, conn.secret).then(positions => updatePositions(conn.id, positions))));
                    }

                    if (connType === 'okx' && conn.apiKey && conn.secret) {
                        restPromises.push(wrapCex(conn.id, fetchCexBalance('okx', conn.apiKey, conn.secret).then((balances: any[]) => {
                            clearConnectionBreakdown(conn.id);
                            balances.forEach((b: { symbol: string; balance: number }) => addAsset(b.symbol, b.balance, conn.name, conn.id, 'Spot'));
                        })));
                        restPromises.push(wrap(fetchCexOpenOrders('okx', conn.apiKey, conn.secret).then((orders: any[]) => updateOrders(conn.id, orders))));
                    }

                    if (connType === 'hyperliquid' && conn.walletAddress) {
                        let hlCleared = false;
                        const ensureHyperliquidClear = () => {
                            if (hlCleared) return;
                            hlCleared = true;
                            clearConnectionBreakdown(conn.id);
                        };

                        restPromises.push(wrap(Promise.all([
                            getHyperliquidSpotState(conn.walletAddress).then(async spotState => {
                                if (spotState) {
                                    ensureHyperliquidClear();
                                    // Avoid repeated meta fetches; use cached spot meta if present
                                    const meta = spotMetaRef.current ?? await getHyperliquidSpotMeta();
                                    if (meta && !spotMetaRef.current) setSpotMeta(meta);

                                    spotState.balances.forEach(b => {
                                        let tokenName = b.coin;
                                        if (meta && /^\d+$/.test(b.coin)) {
                                            const tokenInfo = meta.tokens.find(u => u.index === parseInt(b.coin));
                                            if (tokenInfo) tokenName = tokenInfo.name;
                                            else tokenName = `Unknown-${b.coin}`;
                                        } else if (b.coin.startsWith('@')) {
                                            const index = parseInt(b.coin.substring(1));
                                            if (!isNaN(index) && meta) {
                                                const tokenInfo = meta.tokens.find(u => u.index === index);
                                                if (tokenInfo) tokenName = tokenInfo.name;
                                            }
                                        }
                                        addAsset(tokenName, parseFloat(b.total), conn.name, conn.id, 'Spot');
                                    });
                                }
                            }),
                            getHyperliquidAccountState(conn.walletAddress).then(state => {
                                if (state) {
                                    ensureHyperliquidClear();
                                    const rawPositions = parseHyperliquidPositions(state);
                                    updatePositions(conn.id, rawPositions);
                                    const accountValue = [
                                        state?.marginSummary?.accountValue,
                                        state?.crossMarginSummary?.accountValue,
                                        (state as any)?.withdrawable,
                                        (state as any)?.accountValue,
                                        (state as any)?.totalAccountValue,
                                        (state as any)?.userState?.accountValue,
                                    ]
                                        .map((v) => parseFloat(String(v ?? "0")) || 0)
                                        .find((v) => v > 0) || 0;
                                    if (accountValue > 0) {
                                        // Keep perp collateral in stablecoin breakdown so UI cards compute correctly.
                                        addAsset('USDC', accountValue, `${conn.name} (Perp)`, conn.id, 'Perp');
                                    } else {
                                        addAsset('USDC', 0, `${conn.name} (Equity)`, conn.id, 'Perp');
                                    }
                                }
                            }),
                            getHyperliquidOpenOrdersResult(conn.walletAddress, conn.name).then(result => {
                                if (result.ok) {
                                    updateOrders(conn.id, result.orders);
                                }
                            })
                        ])));
                    }
                }

                // Only fetch Hyperliquid available assets if HL is enabled
                if (parsedConnections.some(c => c.enabled !== false && normalizeConnectionType(c.type) === 'hyperliquid')) {
                    restPromises.push(getHyperliquidAllAssets().then(assets => {
                        setAvailableAssets(assets);
                    }).catch(e => console.warn("Failed to fetch Hyperliquid Assets", e)));
                }

                await Promise.race([
                    Promise.allSettled(restPromises),
                    new Promise(resolve => setTimeout(resolve, 10000))
                ]);

                // Fallback: if live fetch returned nothing, preserve snapshot instead of blanking the UI.
                if (Object.keys(assetsMapRef.current).length === 0 && restoredAssetsSnapshot.length > 0) {
                    const restoredMap: { [key: string]: PortfolioAsset } = {};
                    restoredAssetsSnapshot.forEach((asset) => {
                        if (asset?.symbol) restoredMap[asset.symbol] = asset;
                    });
                    assetsMapRef.current = restoredMap;
                    setStaticAssets(restoredAssetsSnapshot);
                }
                if (Object.keys(positionsMapRef.current).length === 0 && restoredPositionsSnapshot.length > 0) {
                    setPositions(restoredPositionsSnapshot);
                }
                if (Object.keys(ordersMapRef.current).length === 0 && restoredOrdersSnapshot.length > 0) {
                    setSpotOrders(restoredOrdersSnapshot);
                }

                setWatchlist(watchlistSymbols);
                try {
                    if (typeof window !== 'undefined') {
                        const assetSnapshot = Object.values(assetsMapRef.current || {});
                        const positionSnapshot = Object.values(positionsMapRef.current || {}).flat();
                        const ordersSnapshot = Object.values(ordersMapRef.current || {}).flat();
                        if (assetSnapshot.length > 0 || positionSnapshot.length > 0 || ordersSnapshot.length > 0) {
                            localStorage.setItem(PORTFOLIO_SNAPSHOT_KEY, JSON.stringify({
                                assets: assetSnapshot,
                                positions: positionSnapshot,
                                spotOrders: ordersSnapshot,
                                at: Date.now(),
                            }));
                        }
                    }
                } catch {
                    // ignore snapshot write failures
                }
                setLoading(false);
                hasBootstrappedRef.current = true;
                if (!retryOnceRef.current) {
                    retryOnceRef.current = true;
                    setTimeout(() => setRefetchTrigger(t => t + 1), 6000);
                }
            } catch (error) {
                console.warn("Portfolio Sync Error:", error);
                setLoading(false);
                hasBootstrappedRef.current = true;
            }
        }

        fetchData();

        return () => {
            if (updateStateTimerRef.current) {
                clearTimeout(updateStateTimerRef.current);
                updateStateTimerRef.current = null;
            }
            if (wsManagerRef.current) {
                wsManagerRef.current.disconnect();
                wsManagerRef.current = null;
            }
        };
    }, [refetchTrigger]);

    // REAL-TIME AGGRESSIVE POLLING
    // This hook provides additional polling on top of WebSockets for maximum data freshness
    const { triggerRefresh } = useRealTimeData({
        connections,
        enabled: connections.length > 0 && !isDemo,
        pollTrades: false,
        pollWallets: false,
        onBalanceUpdate: (connectionId, balances) => {
            const conn = connections.find(c => c.id === connectionId);
            if (!conn) return;
            // Use consistent subType for CEX connections to prevent double-counting
            const isCex = ['binance', 'bybit', 'hyperliquid', 'okx'].includes(conn.type);
            balances.forEach(b => {
                const overrideSubType = (b as any)?.subType || (b as any)?._subType;
                const subType = overrideSubType || (isCex ? 'Spot' : undefined);
                addAsset(b.symbol, b.balance, conn.name, connectionId, subType);
            });
            updateState();
        },
        onPositionUpdate: (connectionId, positions) => {
            updatePositions(connectionId, positions);
        },
        onOrderUpdate: (connectionId, orders) => {
            updateOrders(connectionId, orders);
        },
        onTradeUpdate: (connectionId, trades) => {
            // Trades are handled by useUserHistory, but this provides faster updates
            console.log(`[RealTime] Got ${trades.length} trades for ${connectionId}`);
        },
    });

    // Keep Overview tab data fresh when browser tab becomes visible (works in background)
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                triggerRefresh?.();
                getTopCoins(250).then(data => {
                    priceCacheRef.current = data;
                    updateState();
                }).catch(() => { });
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [triggerRefresh]);

    const assets = useMemo(() => {
        let list = staticAssets.map(asset => ({
            ...asset,
            price: livePrices[asset.symbol] || asset.price || 0,
            priceChange24h: livePriceChanges[asset.symbol] || asset.priceChange24h || 0,
            valueUsd: (livePrices[asset.symbol] || asset.price || 0) * asset.balance
        })).sort((a, b) => b.valueUsd - a.valueUsd);

        if (hideDust) {
            // Hide if value is <$1 AND (it has no price OR balance is suspicious)
            // If value is 0, we only keep it if it's a known symbol or has some relevance
            list = list.filter(a => a.valueUsd >= 1.0 || (a.valueUsd > 0 && a.balance > 0));
        }
        // Internal synthetic token used for Hyperliquid account equity; do not show in user asset inventory.
        list = list.filter(a => a.symbol !== 'HL_ACCOUNT');
        // Hide wallet spam/fake tokens (claim airdrops, scam URLs, etc.)
        list = list.filter(a => !isLikelySpamOrFakeToken(a));
        return list;
    }, [staticAssets, livePrices, livePriceChanges, hideDust]);

    // Missing Price Fetcher
    useEffect(() => {
        // Debounce slightly or just check
        if (loading) return;

        const missing = assets
            .filter(a => a.price === 0 && a.balance > 0 && !requestedMissingSymbols.current.has(a.symbol))
            .map(a => a.symbol);

        if (missing.length > 0) {
            console.log(`[Portfolio] Fetching missing prices for: ${missing.join(', ')}`);
            fetchSpecificPrices(missing).then(newPrices => {
                if (newPrices.length > 0) {
                    console.log(`[Portfolio] Found ${newPrices.length} new prices`);
                    priceCacheRef.current = [...priceCacheRef.current, ...newPrices];

                    const receivedSymbols = new Set<string>();
                    newPrices.forEach(p => {
                        const s = normalizeSymbol(p.symbol);
                        receivedSymbols.add(s);
                        if (assetsMapRef.current[s]) {
                            assetsMapRef.current[s].price = p.current_price;
                            assetsMapRef.current[s].priceChange24h = p.price_change_percentage_24h;
                        }
                    });
                    // Only mark symbols we actually got a price for, so others (e.g. DOGS) can retry
                    receivedSymbols.forEach(s => requestedMissingSymbols.current.add(s));

                    updateState();
                }
            }).catch(e => console.warn("[Portfolio] Failed to fetch missing prices", e));
        }
    }, [assets, loading]);

    const totalValue = useMemo(() => {
        return assets.reduce((sum, asset) => sum + asset.valueUsd, 0);
    }, [assets]);

    const totalPnlUsd = useMemo(() => {
        return positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
    }, [positions]);

    const totalPnlPercent = useMemo(() => {
        const totalInvested = positions.reduce((sum, pos) =>
            sum + Math.abs(pos.size) * pos.entryPrice, 0
        );
        return totalInvested > 0 ? (totalPnlUsd / totalInvested) * 100 : 0;
    }, [positions, totalPnlUsd]);

    const allocations = useMemo(() => {
        return assets.map(asset => ({
            ...asset,
            allocations: totalValue > 0 ? (asset.valueUsd / totalValue) * 100 : 0
        }));
    }, [assets, totalValue]);

    const [hwmState, setHwmState] = useState({ total: 0, spot: 0, futures: 0 });

    useEffect(() => {
        const total = parseFloat(localStorage.getItem('portfolio_hwm') || '0');
        const spot = parseFloat(localStorage.getItem('portfolio_hwm_spot') || '0');
        setHwmState({ total, spot, futures: 0 });
    }, []);

    useEffect(() => {
        if (loading || totalValue === 0) return;

        const currentTotal = totalValue + totalPnlUsd;
        const currentSpot = totalValue;

        setHwmState(prev => {
            const newHwm = { ...prev };
            let changed = false;

            if (currentTotal > prev.total) {
                newHwm.total = currentTotal;
                localStorage.setItem('portfolio_hwm', currentTotal.toString());
                changed = true;
            }

            if (currentSpot > prev.spot) {
                newHwm.spot = currentSpot;
                localStorage.setItem('portfolio_hwm_spot', currentSpot.toString());
                changed = true;
            }

            return changed ? newHwm : prev;
        });
    }, [totalValue, totalPnlUsd, loading]);

    const drawdowns = useMemo(() => {
        if (loading || (totalValue === 0 && totalPnlUsd === 0)) {
            return {
                total: 0,
                spot: 0,
                futures: 0,
                peaks: { total: 0, spot: 0, futures: 0 },
                max: { total: 0, spot: 0, futures: 0 }
            };
        }

        const currentTotal = totalValue + totalPnlUsd;
        const currentSpot = totalValue;

        const activeHwmTotal = Math.max(hwmState.total, currentTotal);
        const ddTotal = activeHwmTotal > 0 ? ((activeHwmTotal - currentTotal) / activeHwmTotal) * 100 : 0;

        const activeHwmSpot = Math.max(hwmState.spot, currentSpot);
        const ddSpot = activeHwmSpot > 0 ? ((activeHwmSpot - currentSpot) / activeHwmSpot) * 100 : 0;

        return {
            total: ddTotal,
            spot: ddSpot,
            futures: 0,
            peaks: {
                total: activeHwmTotal,
                spot: activeHwmSpot,
                futures: 0
            },
            max: {
                total: ddTotal,
                spot: ddSpot,
                futures: 0
            }
        };
    }, [totalValue, totalPnlUsd, loading, hwmState]);

    const activities = useMemo(() => {
        const walletMap: Record<string, string> = {};
        const connectionMap: Record<string, string> = {};
        connections.forEach(c => {
            if (c.walletAddress) walletMap[c.walletAddress] = c.name;
            if (c.id) connectionMap[c.id] = c.displayName || c.name;
        });
        return processActivities(activeTransactions, activeTransfers, walletMap, connectionMap);
    }, [activeTransactions, activeTransfers, connections]);

    const futuresAnalytics = useMemo(() => {
        const futuresTradeEvents = (futuresTransactions || []).filter((t: any) => !isFundingLikeTransaction(t));
        const futuresFundingEvents = (activeFunding || []).map((f: any) => ({
            ...f,
            instrumentType: 'future',
            marketType: 'funding',
            feeType: 'funding',
            side: 'funding',
        }));
        if (futuresTradeEvents.length === 0 && futuresFundingEvents.length === 0) return null;

        // Build unified chronological event stream for futures (realized trades + funding)
        const sortedTrades = [...futuresTradeEvents, ...futuresFundingEvents]
            .filter((t: any) => t.pnl !== undefined && Number.isFinite(Number(t.timestamp)))
            .sort((a, b) => a.timestamp - b.timestamp);
        if (sortedTrades.length === 0) return null;

        const seriesStats = buildCumulativePnlAndDrawdownSeries(sortedTrades, {
            getTimestamp: (event) => Number(event.timestamp),
            getPnlDelta: (event) => Number(event.pnl || 0) - Number(event.fee || 0),
        });

        let totalWin = 0;
        let totalLoss = 0;
        let winCount = 0;
        let lossCount = 0;
        let volumeTraded = 0;
        let fundingPnl = 0;
        let tradePnl = 0;

        sortedTrades.forEach(t => {
            const pnl = Number(t.pnl || 0) - Number(t.fee || 0);
            const isFunding = isFundingLikeTransaction(t);

            if (isFunding) {
                fundingPnl += pnl;
                return;
            }

            tradePnl += pnl;
            const amount = Math.abs(Number(t.amount || 0));
            const price = Math.abs(Number(t.price || 0) || 1);
            volumeTraded += amount * price;

            if (pnl > 0) {
                totalWin += pnl;
                winCount++;
            } else if (pnl < 0) {
                totalLoss += Math.abs(pnl);
                lossCount++;
            }
        });

        const totalTrades = winCount + lossCount;
        const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
        const avgWin = winCount > 0 ? totalWin / winCount : 0;
        const avgLoss = lossCount > 0 ? totalLoss / lossCount : 0;
        const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? 99 : 0;

        const sessionEvents = sortedTrades.filter((event: any) => !isFundingLikeTransaction(event));
        const dayOfWeek = buildUtcDayOfWeekBuckets(sessionEvents, {
            getTimestamp: (event) => Number(event.timestamp),
            getPnl: (event) => Number(event.pnl || 0) - Number(event.fee || 0),
            dayLabels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        }).map((bucket) => ({
            day: bucket.day,
            pnl: bucket.pnl,
            count: bucket.count,
            wins: bucket.wins,
        }));

        const timeOfDay = buildUtcTwoHourBuckets(sessionEvents, {
            getTimestamp: (event) => Number(event.timestamp),
            getPnl: (event) => Number(event.pnl || 0) - Number(event.fee || 0),
        }).map((bucket) => ({
            hour: bucket.hour,
            pnl: bucket.pnl,
            count: bucket.count,
            wins: bucket.wins,
        }));

        return {
            pnlSeries: seriesStats.pnlSeries,
            drawdownSeries: seriesStats.drawdownSeries,
            metrics: {
                totalPnl: seriesStats.totalPnl,
                winRate,
                winCount,
                lossCount,
                totalTrades,
                avgWin,
                avgLoss,
                volumeTraded,
                profitFactor,
                maxDrawdown: seriesStats.maxDrawdown,
                tradePnl,
                fundingPnl,
                futuresEventCount: sortedTrades.length,
            },
            session: {
                dayOfWeek,
                timeOfDay
            }
        };
    }, [futuresTransactions, activeFunding]);

    const futuresMarketData = useMemo(() => {
        if (!perpMeta) return {};
        const data: Record<string, { funding: number, oi: number, volume24h: number, markPrice: number }> = {};
        perpMeta.meta.universe.forEach((u, i) => {
            const ctx = perpMeta.ctxs[i];
            if (ctx) {
                const symbol = normalizeSymbol(u.name);
                data[symbol] = {
                    funding: parseFloat(ctx.funding || "0"),
                    oi: parseFloat(ctx.openInterest || "0"),
                    volume24h: getHyperliquidNotionalVolumeUsd(ctx),
                    markPrice: parseFloat(ctx.markPx || "0")
                };
            }
        });
        return data;
    }, [perpMeta]);

    return {
        assets: allocations,
        transactions: activeTransactions,
        transfers: activeTransfers,
        spotOrders,
        feeStats,
        hideDust,
        setHideDust,
        activities,
        funding: activeFunding,
        positions,
        totalValue,
        totalPnlUsd,
        totalPnlPercent,
        drawdowns,
        loading,
        connections,
        wsConnectionStatus,
        getWsStatus,
        futuresAnalytics,
        futuresMarketData,
        perpMeta,
        watchlist,
        setWatchlist,
        availableAssets,
        isDemo,
        prices,
        priceChanges,
        addManualTransaction,
        selectedChart,
        setSelectedChart,
        triggerConnectionsRefetch: () => setRefetchTrigger(t => t + 1),
        connectionErrors: connectionErrors ?? {},
    };
}
