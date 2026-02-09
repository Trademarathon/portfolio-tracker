
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { getTopCoins, fetchSpecificPrices } from '@/lib/api/prices';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { PortfolioAsset, AssetSector, Transaction, SourceBreakdown, Position, PortfolioConnection } from '@/lib/api/types';
import { useLivePrices } from './useLivePrices';
import {
    getEvmPortfolio,
    getSolanaPortfolio,
    getBitcoinPortfolio,
    getHederaPortfolio
} from "@/lib/api/wallet";
import {
    getHyperliquidAccountState,
    getHyperliquidSpotMeta,
    getHyperliquidSpotState,
    parseHyperliquidPositions,
    getHyperliquidAllAssets,
    getHyperliquidOpenOrders,
    getHyperliquidUserFills,
    SpotMeta
} from '@/lib/api/hyperliquid';
import { fetchCexBalance, fetchCexTransfers, fetchCexTrades, fetchCexOpenOrders, CexTransfer } from '@/lib/api/cex';
import { EnhancedWebSocketManager } from '@/lib/api/websocket-enhanced';
import { WalletWebSocketManager } from '@/lib/api/websocket-wallet';
import { WebSocketConnectionInfo, WebSocketMessage } from '@/lib/api/websocket-types';
import { processActivities, UnifiedActivity } from '@/lib/api/transactions';
import { useUserHistory } from "./useUserHistory";
import { useRealTimeData, POLL_INTERVALS } from "./useRealTimeData";

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


export function usePortfolioData() {
    const [staticAssets, setStaticAssets] = useState<PortfolioAsset[]>([]);
    // Transactions and Transfers are now managed by useUserHistory query
    const [spotOrders, setSpotOrders] = useState<any[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [wsConnectionStatus, setWsConnectionStatus] = useState<Map<string, WebSocketConnectionInfo>>(new Map());
    const wsManagerRef = useRef<EnhancedWebSocketManager | null>(null);
    const walletWsManagerRef = useRef<WalletWebSocketManager | null>(null);

    const [spotMeta, _setSpotMeta] = useState<SpotMeta | null>(null);
    const spotMetaRef = useRef<SpotMeta | null>(null);

    // Wrapper to update both ref and state
    const setSpotMeta = (meta: SpotMeta | null) => {
        spotMetaRef.current = meta;
        _setSpotMeta(meta);
    };

    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [availableAssets, setAvailableAssets] = useState<{ perp: string[], spot: string[] }>({ perp: [], spot: [] });

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
        if (spotMeta && (s.startsWith('@') || /^\d+$/.test(s))) {
            const index = parseInt(s.startsWith('@') ? s.substring(1) : s);
            const token = spotMeta.tokens.find(t => t.index === index);
            return token ? token.name : s;
        }
        return s;
    };

    // DEMO MODE DATA INJECTION
    const activeTransactions = useMemo(() => {
        const raw = isDemo ? [
            { id: 'demo-tx-1', type: 'Buy', asset: 'BTC', symbol: 'BTC', amount: 0.1, price: 60000, value: 6000, timestamp: Date.now() - 3600000, status: 'completed', exchange: 'Demo Binance', fee: 5 },
            { id: 'demo-tx-2', type: 'Sell', asset: 'ETH', symbol: 'ETH', amount: 1.0, price: 3400, value: 3400, timestamp: Date.now() - 86400000, status: 'completed', exchange: 'Demo Ethereum', fee: 3.4 }
        ] : transactions;

        return raw.map((t: any) => ({
            ...t,
            symbol: resolveSymbol(t.symbol),
            asset: resolveSymbol(t.asset || t.symbol)
        }));
    }, [isDemo, transactions, spotMeta]);

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
            spot: calculateStats(activeTransactions.filter(t => t.symbol && !t.symbol.includes('PERP'))),
            futures: calculateStats(activeTransactions.filter(t => t.symbol && t.symbol.includes('PERP')))
        });
    }, [activeTransactions]);

    // Extract symbols for price WS
    // Use JSON.stringify to ensure deep equality check for dependency array
    const rawSymbols = useMemo(() => {
        const assetSymbols = staticAssets.map(a => a.symbol);
        const positionSymbols = positions.map(p => p.symbol);
        const orderSymbols = Object.values(ordersMapRef.current).flat().map(o => normalizeSymbol(o.symbol));
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

    // Update State (Join with prices and names)
    const updateState = () => {
        // Enriched Assets
        const assetList = Object.values(assetsMapRef.current);
        const initializedAssets = assetList.map(asset => {
            const cleanSym = normalizeSymbol(asset.symbol);
            let coin = priceCacheRef.current.find(p => p.symbol.toUpperCase() === cleanSym);

            if (!coin) {
                if (cleanSym === 'WETH') coin = priceCacheRef.current.find(p => p.symbol === 'ETH');
                if (cleanSym === 'WBTC') coin = priceCacheRef.current.find(p => p.symbol === 'BTC');
            }

            let price = coin ? coin.current_price : (asset.price || 0);
            if (['USDC', 'USDT', 'DAI'].includes(cleanSym) && price === 0) price = 1;

            let name = coin?.name || asset.symbol;

            // Try to resolve Hyperliquid ID to Name if it looks like an ID
            const meta = spotMetaRef.current;
            if (meta && (/^\d+$/.test(asset.symbol) || asset.symbol.startsWith('@'))) {
                let id = -1;
                if (/^\d+$/.test(asset.symbol)) id = parseInt(asset.symbol);
                else if (asset.symbol.startsWith('@')) id = parseInt(asset.symbol.substring(1));

                if (id !== -1) {
                    const tokenInfo = meta.tokens.find(t => t.index === id);
                    if (tokenInfo) name = tokenInfo.name;
                }
            }

            return {
                ...asset,
                price,
                valueUsd: asset.balance * price,
                name
            };
        });
        setStaticAssets(initializedAssets);

        // Enriched Orders (using flattened mapping)
        const allOrders = Object.values(ordersMapRef.current).flat();
        setSpotOrders(allOrders.map(order => {
            const cleanSym = normalizeSymbol(order.symbol);
            let coin = priceCacheRef.current.find(p => p.symbol.toUpperCase() === cleanSym);

            let assetName = coin?.name || cleanSym;

            // Hyperliquid specific resolution
            const meta = spotMetaRef.current;
            if (meta && (order.exchange === 'Hyperliquid' || order.connectionName === 'Hyperliquid')) {
                // If symbol is numeric or starts with @, treat as Market ID (Universe Index)
                // We need to find the Base Token for this Market
                let marketIndex = -1;

                if (/^\d+$/.test(order.symbol)) {
                    marketIndex = parseInt(order.symbol);
                } else if (order.symbol.startsWith('@')) {
                    const idx = parseInt(order.symbol.substring(1));
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
                            assetName = tokenInfo.name;
                        } else {
                            // Fallback to market name if token not found (e.g. @156)
                            assetName = marketInfo.name;
                        }
                    }
                }
            }

            return {
                ...order,
                assetName
            };
        }));

        // Enriched Positions
        setPositions(prev => prev.map(pos => {
            const cleanSym = normalizeSymbol(pos.symbol);
            const coin = priceCacheRef.current.find(p => p.symbol.toUpperCase() === cleanSym);
            return {
                ...pos,
                assetName: coin?.name || cleanSym
            };
        }));
    };

    const addAsset = (symbol: string, balance: number, sourceName: string, connectionId: string = "unknown", subType?: string) => {
        const rawS = symbol.toUpperCase();
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
            // FIXED: Set balance directly instead of accumulating
            // Each source (connection/subType) provides its complete balance
            assetsMapRef.current[s].breakdown![breakdownKey] = balance;
        }

        const total = Object.values(assetsMapRef.current[s].breakdown || {}).reduce((acc: number, val: any) => acc + (val || 0), 0);
        assetsMapRef.current[s].balance = total;

        // Sync total value immediately if price exists
        if (assetsMapRef.current[s].price) {
            assetsMapRef.current[s].valueUsd = total * assetsMapRef.current[s].price!;
        }
    };

    const updatePositions = (connectionId: string, newPositions: Position[]) => {
        positionsMapRef.current[connectionId] = newPositions;
        updateState();
    };

    const updateOrders = (connectionId: string, newOrders: any[]) => {
        ordersMapRef.current[connectionId] = newOrders;
        updateState();
    };

    useEffect(() => {
        async function fetchData() {
            const savedConnections = localStorage.getItem("portfolio_connections");
            const parsedConnections: PortfolioConnection[] = savedConnections ? JSON.parse(savedConnections) : [];
            setConnections(parsedConnections);
            const savedWatchlist = localStorage.getItem("user_watchlist");
            const watchlistSymbols = savedWatchlist ? JSON.parse(savedWatchlist) : [];

            // CRITICAL FIX: Clear ALL maps to avoid stale/duplicate data on refresh
            ordersMapRef.current = {};
            assetsMapRef.current = {};
            positionsMapRef.current = {};

            try {
                // 1. Fetch Metadata FIRST (Essential for Resolution)
                try {
                    const meta = await getHyperliquidSpotMeta();
                    if (meta) setSpotMeta(meta);
                } catch (e) {
                    console.warn("Metadata pre-fetch failed:", e);
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
                            if (msg.type === 'balance' && Array.isArray(msg.data)) {
                                msg.data.forEach((b: any) => {
                                    const total = b.free !== undefined ? b.free + (b.locked || 0) : b.balance;
                                    addAsset(b.symbol, total, msg.source, msg.connectionId);
                                });
                                updateState();
                            } else if (msg.type === 'blockchain' && msg.data) {
                                if (msg.data.balance !== undefined) {
                                    const symbol = msg.data.symbol || msg.data.chain || 'Unknown';
                                    addAsset(symbol, parseFloat(msg.data.balance), msg.source, msg.connectionId);
                                    updateState();
                                }
                            } else if (msg.type === 'position' && Array.isArray(msg.data)) {
                                if (msg.connectionId) {
                                    updatePositions(msg.connectionId, msg.data);
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
                for (const conn of parsedConnections) {
                    if (conn.enabled === false) continue;

                    const wrap = (p: Promise<any>) => p.then(() => updateState()).catch(e => console.warn(`Fetch failed for ${conn.name}`, e));

                    if ((conn.type === 'wallet' || conn.type === 'evm' || conn.type === 'solana' || conn.type === 'zerion') && conn.walletAddress) {
                        const isSolana = conn.type === 'solana' || conn.chain === 'SOL' || (!conn.chain && !conn.walletAddress.startsWith('0x') && conn.walletAddress.length > 30);
                        const isEvm = conn.type === 'evm' || (conn.type === 'wallet' && conn.walletAddress.startsWith('0x'));
                        const isBitcoin = conn.chain === 'BTC' || (conn.type === 'wallet' && !conn.walletAddress.startsWith('0x') && (conn.walletAddress.startsWith('1') || conn.walletAddress.startsWith('3') || conn.walletAddress.startsWith('bc1')));
                        const isHedera = conn.chain === 'HBAR' || (conn.type === 'wallet' && /^\d+\.\d+\.\d+$/.test(conn.walletAddress));
                        const isSui = conn.chain === 'SUI' || (conn.type === 'wallet' && conn.walletAddress.startsWith('0x') && conn.walletAddress.length > 42);
                        const isAptos = conn.chain === 'APT' || (conn.type === 'wallet' && conn.walletAddress.startsWith('0x') && conn.walletAddress.length === 66);
                        const isTon = conn.chain === 'TON' || (conn.type === 'wallet' && (conn.walletAddress.startsWith('EQ') || conn.walletAddress.startsWith('UQ')));
                        const isTron = conn.chain === 'TRX' || conn.chain === 'TRON' || (conn.type === 'wallet' && conn.walletAddress.startsWith('T') && conn.walletAddress.length === 34);
                        const isXrp = conn.chain === 'XRP' || (conn.type === 'wallet' && conn.walletAddress.startsWith('r') && conn.walletAddress.length >= 25 && conn.walletAddress.length <= 35);
                        const isZerion = conn.type === 'zerion';

                        const fetchViaProxy = async (chain?: string, type?: string) => {
                            try {
                                const url = `/api/wallet/portfolio?address=${conn.walletAddress}&chain=${chain || ''}&type=${type || ''}`;
                                const res = await fetch(url);
                                if (!res.ok) throw new Error(`Proxy fetch failed with status ${res.status}`);
                                return await res.json();
                            } catch (e) {
                                console.warn(`Proxy fetch failed for ${conn.name} (${chain})`, e);
                                return [];
                            }
                        };

                        if (isZerion) {
                            restPromises.push(wrap(fetchViaProxy('', 'zerion').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isEvm && !isSui && !isAptos) {
                            const chains = conn.chain ? [conn.chain] : ['ETH', 'ARB', 'MATIC', 'OP', 'BASE', 'BSC', 'AVAX'];
                            for (const chain of chains) {
                                restPromises.push(wrap(fetchViaProxy(chain, 'evm').then((balances: any[]) => {
                                    balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                                })));
                            }
                        }

                        if (isSolana) {
                            restPromises.push(wrap(fetchViaProxy('SOL', 'solana').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isBitcoin) {
                            restPromises.push(wrap(fetchViaProxy('BTC', 'bitcoin').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isHedera) {
                            restPromises.push(wrap(fetchViaProxy('HBAR', 'hedera').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isSui) {
                            restPromises.push(wrap(fetchViaProxy('SUI', 'sui').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isAptos) {
                            restPromises.push(wrap(fetchViaProxy('APT', 'aptos').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isTon) {
                            restPromises.push(wrap(fetchViaProxy('TON', 'ton').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isTron) {
                            restPromises.push(wrap(fetchViaProxy('TRX', 'tron').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }

                        if (isXrp) {
                            restPromises.push(wrap(fetchViaProxy('XRP', 'xrp').then((balances: any[]) => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name, conn.id));
                            })));
                        }
                    }

                    if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                        restPromises.push(wrap(fetchCexBalance('binance', conn.apiKey, conn.secret).then((balances: any[]) => {
                            balances.forEach((b: { symbol: string; balance: number }) => addAsset(b.symbol, b.balance, conn.name, conn.id));
                        })));
                        restPromises.push(wrap(fetchCexOpenOrders('binance', conn.apiKey, conn.secret).then((orders: any[]) => {
                            updateOrders(conn.id, orders);
                        })));
                    }

                    if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                        restPromises.push(wrap(fetchCexBalance('bybit', conn.apiKey, conn.secret).then((balances: any[]) => {
                            balances.forEach((b: { symbol: string; balance: number }) => addAsset(b.symbol, b.balance, conn.name, conn.id));
                        })));
                        restPromises.push(wrap(fetchCexOpenOrders('bybit', conn.apiKey, conn.secret).then((orders: any[]) => {
                            updateOrders(conn.id, orders);
                        })));
                    }

                    if (conn.type === 'hyperliquid' && conn.walletAddress) {
                        restPromises.push(wrap(Promise.all([
                            getHyperliquidSpotState(conn.walletAddress).then(async spotState => {
                                if (spotState) {
                                    const meta = await getHyperliquidSpotMeta();
                                    if (meta) setSpotMeta(meta);

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
                                    const rawPositions = parseHyperliquidPositions(state);
                                    updatePositions(conn.id, rawPositions);
                                    const accountValue = parseFloat(state.marginSummary.accountValue);
                                    if (accountValue > 0) {
                                        addAsset('USDC', accountValue, `${conn.name} (Equity)`, conn.id, 'Perp');
                                    }
                                }
                            }),
                            getHyperliquidOpenOrders(conn.walletAddress).then(orders => {
                                updateOrders(conn.id, orders);
                            })
                        ])));
                    }
                }

                restPromises.push(getHyperliquidAllAssets().then(assets => {
                    setAvailableAssets(assets);
                }).catch(e => console.warn("Failed to fetch Hyperliquid Assets", e)));

                await Promise.race([
                    Promise.allSettled(restPromises),
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);

                setWatchlist(watchlistSymbols);
                setLoading(false);
            } catch (error) {
                console.warn("Portfolio Sync Error:", error);
                setLoading(false);
            }
        }

        fetchData();

        return () => {
            if (wsManagerRef.current) {
                wsManagerRef.current.disconnect();
                wsManagerRef.current = null;
            }
        };
    }, []);

    // REAL-TIME AGGRESSIVE POLLING
    // This hook provides additional polling on top of WebSockets for maximum data freshness
    useRealTimeData({
        connections,
        enabled: connections.length > 0 && !isDemo,
        onBalanceUpdate: (connectionId, balances) => {
            const conn = connections.find(c => c.id === connectionId);
            if (!conn) return;
            balances.forEach(b => {
                addAsset(b.symbol, b.balance, conn.name, connectionId);
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

    const assets = useMemo(() => {
        let list = staticAssets.map(asset => ({
            ...asset,
            price: livePrices[asset.symbol] || asset.price || 0,
            priceChange24h: livePriceChanges[asset.symbol] || asset.priceChange24h || 0,
            valueUsd: (livePrices[asset.symbol] || asset.price || 0) * asset.balance
        })).sort((a, b) => b.valueUsd - a.valueUsd);

        if (hideDust) {
            list = list.filter(a => a.valueUsd >= 1.0 || a.balance > 1000); // Filter dust: <$1 OR small balance
        }
        return list;
        if (hideDust) {
            list = list.filter(a => a.valueUsd >= 1.0 || a.balance > 1000); // Filter dust: <$1 OR small balance
        }
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
            // Mark as requested immediately
            missing.forEach(s => requestedMissingSymbols.current.add(s));

            console.log(`[Portfolio] Fetching missing prices for: ${missing.join(', ')}`);
            fetchSpecificPrices(missing).then(newPrices => {
                if (newPrices.length > 0) {
                    console.log(`[Portfolio] Found ${newPrices.length} new prices`);
                    // Merge into price cache
                    priceCacheRef.current = [...priceCacheRef.current, ...newPrices];

                    // Also update assetsMapRef prices for immediate consistency?
                    // Not easily accessible here without iterating.
                    // But 'assets' memo uses 'asset.price' which comes from staticAssets which comes from assetsMapRef.
                    // We need to update assetsMapRef to persist this price until next live update.

                    newPrices.forEach(p => {
                        const s = normalizeSymbol(p.symbol);
                        if (assetsMapRef.current[s]) {
                            assetsMapRef.current[s].price = p.current_price;
                            assetsMapRef.current[s].priceChange24h = p.price_change_percentage_24h;
                        }
                    });

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
            let newHwm = { ...prev };
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
        connections.forEach(c => {
            if (c.walletAddress) walletMap[c.walletAddress] = c.name;
        });
        return processActivities(activeTransactions, activeTransfers, walletMap);
    }, [activeTransactions, activeTransfers, connections]);

    const futuresAnalytics = useMemo(() => {
        if (!activeTransactions || activeTransactions.length === 0) return null;

        // Filter and sort trades
        const sortedTrades = [...activeTransactions]
            .filter(t => t.exchange === 'Hyperliquid' || t.pnl !== undefined)
            .sort((a, b) => a.timestamp - b.timestamp);

        let cumulativePnl = 0;
        let maxPnl = 0;
        const pnlSeries: { date: number; value: number }[] = [];
        const drawdownSeries: { date: number; value: number }[] = [];

        let totalWin = 0;
        let totalLoss = 0;
        let winCount = 0;
        let lossCount = 0;
        let volumeTraded = 0;

        sortedTrades.forEach(t => {
            const pnl = (t.pnl || 0) - (t.fee || 0);
            cumulativePnl += pnl;
            volumeTraded += (t.amount * (t.price || 1));

            pnlSeries.push({ date: t.timestamp, value: cumulativePnl });

            if (cumulativePnl > maxPnl) maxPnl = cumulativePnl;
            const dd = maxPnl > 0 ? cumulativePnl - maxPnl : 0;
            drawdownSeries.push({ date: t.timestamp, value: dd });

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

        // Session Analysis
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days.map(d => ({ day: d, pnl: 0, count: 0, wins: 0 }));
        const timeOfDay = Array.from({ length: 12 }, (_, i) => ({ hour: i * 2, pnl: 0, count: 0, wins: 0 }));

        sortedTrades.forEach(t => {
            const pnl = (t.pnl || 0) - (t.fee || 0);
            const date = new Date(t.timestamp);

            const dayIdx = date.getDay();
            dayOfWeek[dayIdx].pnl += pnl;
            dayOfWeek[dayIdx].count++;
            if (pnl > 0) dayOfWeek[dayIdx].wins++;

            const hour = date.getHours();
            const hourIdx = Math.floor(hour / 2);
            timeOfDay[hourIdx].pnl += pnl;
            timeOfDay[hourIdx].count++;
            if (pnl > 0) timeOfDay[hourIdx].wins++;
        });

        return {
            pnlSeries,
            drawdownSeries,
            metrics: {
                totalPnl: cumulativePnl,
                winRate,
                winCount,
                lossCount,
                totalTrades,
                avgWin,
                avgLoss,
                volumeTraded,
                profitFactor,
                maxDrawdown: Math.min(...drawdownSeries.map(d => d.value), 0)
            },
            session: {
                dayOfWeek,
                timeOfDay
            }
        };
    }, [activeTransactions]);

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
        watchlist,
        setWatchlist,
        availableAssets,
        isDemo,
        prices,
        priceChanges
    };
}
