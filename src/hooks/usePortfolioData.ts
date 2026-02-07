
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { getTopCoins } from '@/lib/api/prices';
import { PortfolioAsset, AssetSector, Transaction, SourceBreakdown, Position, PortfolioConnection } from '@/lib/api/types';
import { useLivePrices } from './useLivePrices';
import { getEvmPortfolio, getSolanaPortfolio } from '@/lib/api/wallet';
import { getHyperliquidAccountState, parseHyperliquidPositions, getHyperliquidSpotMeta, getHyperliquidSpotState, getHyperliquidUserFills, getHyperliquidAllAssets, SpotMeta } from '@/lib/api/hyperliquid';
import { fetchCexBalance, fetchCexTransfers, fetchCexTrades, CexTransfer } from '@/lib/api/cex';
import { EnhancedWebSocketManager } from '@/lib/api/websocket-enhanced';
import { WalletWebSocketManager } from '@/lib/api/websocket-wallet';
import { WebSocketConnectionInfo, WebSocketMessage } from '@/lib/api/websocket-types';
import { processActivities, UnifiedActivity } from '@/lib/api/transactions';
import { useUserHistory } from "./useUserHistory";

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
    const [positions, setPositions] = useState<Position[]>([]);
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [wsConnectionStatus, setWsConnectionStatus] = useState<Map<string, WebSocketConnectionInfo>>(new Map());
    const wsManagerRef = useRef<EnhancedWebSocketManager | null>(null);
    const walletWsManagerRef = useRef<WalletWebSocketManager | null>(null);

    const [spotMeta, setSpotMeta] = useState<SpotMeta | null>(null);
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [availableAssets, setAvailableAssets] = useState<{ perp: string[], spot: string[] }>({ perp: [], spot: [] });

    // Top-level refs for state that updates frequently or needs to be accessed in callbacks without causing re-renders
    const assetsMapRef = useRef<{ [key: string]: PortfolioAsset }>({});
    const priceCacheRef = useRef<any[]>([]);

    // Fetch History via TanStack Query (Non-blocking)
    const { data: historyData } = useUserHistory(connections);
    const transactions = historyData?.trades || [];
    const transfers = historyData?.transfers || [];

    // Extract symbols for price WS
    const symbols = useMemo(() => {
        const assetSymbols = staticAssets.map(a => a.symbol);
        const positionSymbols = positions.map(p => p.symbol);
        return Array.from(new Set([...assetSymbols, ...positionSymbols]));
    }, [staticAssets, positions]);

    const { prices, priceChanges } = useLivePrices(symbols);

    // Export WebSocket connection status for Settings page
    const getWsStatus = () => wsConnectionStatus;

    // Helper to update state incrementally
    const updateState = () => {
        const assetList = Object.values(assetsMapRef.current);
        const initializedAssets = assetList.map(asset => {
            // Try to find price in cache
            let coin = priceCacheRef.current.find(p => p.symbol.toUpperCase() === asset.symbol);

            if (!coin) {
                if (asset.symbol === 'WETH') coin = priceCacheRef.current.find(p => p.symbol === 'ETH');
                if (asset.symbol === 'WBTC') coin = priceCacheRef.current.find(p => p.symbol === 'BTC');
            }

            // Fallback price logic
            let price = coin ? coin.current_price : (asset.price || 0);
            if (['USDC', 'USDT', 'DAI'].includes(asset.symbol) && price === 0) price = 1;

            return {
                ...asset,
                price,
                valueUsd: asset.balance * price,
                name: coin?.name || asset.symbol
            };
        });

        setStaticAssets(initializedAssets);
    };

    const addAsset = (symbol: string, balance: number, sourceName: string) => {
        const s = symbol.toUpperCase();

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
            assetsMapRef.current[s].breakdown![sourceName] = balance;
        }

        const total = Object.values(assetsMapRef.current[s].breakdown || {}).reduce((acc, val) => acc + val, 0);
        assetsMapRef.current[s].balance = total;
    };

    useEffect(() => {
        async function fetchData() {
            const savedConnections = localStorage.getItem("portfolio_connections");
            const parsedConnections: PortfolioConnection[] = savedConnections ? JSON.parse(savedConnections) : [];
            setConnections(parsedConnections);
            const savedWatchlist = localStorage.getItem("user_watchlist");
            const watchlistSymbols = savedWatchlist ? JSON.parse(savedWatchlist) : [];

            try {
                // 1. Start Price Fetch Immediately (Parallel)
                getTopCoins(250).then(data => {
                    priceCacheRef.current = data;
                    updateState();
                }).catch(e => console.error("Price fetch failed", e));

                // 2. Initialize WebSocket Manager (Non-blocking)
                if (!wsManagerRef.current && parsedConnections.length > 0) {
                    wsManagerRef.current = new EnhancedWebSocketManager(
                        parsedConnections,
                        (msg: WebSocketMessage) => {
                            if (msg.type === 'balance' && Array.isArray(msg.data)) {
                                msg.data.forEach((b: any) => {
                                    const total = b.free !== undefined ? b.free + (b.locked || 0) : b.balance;
                                    addAsset(b.symbol, total, msg.source);
                                });
                                updateState();
                            } else if (msg.type === 'position' && Array.isArray(msg.data)) {
                                setPositions(msg.data);
                            }
                        },
                        (status) => setWsConnectionStatus(status)
                    );

                    wsManagerRef.current.initialize(); // Don't await
                }

                // 3. fetching REST data (Initial Snapshot)
                const restPromises = [];
                for (const conn of parsedConnections) {
                    if (conn.enabled === false) continue;

                    const wrap = (p: Promise<any>) => p.then(() => updateState()).catch(e => console.warn(`Fetch failed for ${conn.name}`, e));

                    if (conn.type === 'wallet' && conn.walletAddress) {
                        const chains: ('ETH' | 'ARB' | 'MATIC' | 'OP')[] = [];
                        if (conn.chain === 'ETH' || !conn.chain) chains.push('ETH');
                        if (conn.chain === 'ARB') chains.push('ARB');
                        if (conn.chain === 'MATIC') chains.push('MATIC');
                        if (conn.chain === 'OP') chains.push('OP');

                        for (const chain of chains) {
                            restPromises.push(wrap(getEvmPortfolio(conn.walletAddress, chain).then(balances => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name));
                            })));
                        }

                        if (conn.chain === 'SOL') {
                            restPromises.push(wrap(getSolanaPortfolio(conn.walletAddress).then(balances => {
                                balances.forEach(b => addAsset(b.symbol, b.balance, conn.name));
                            })));
                        }
                    }

                    if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                        restPromises.push(wrap(fetchCexBalance('binance', conn.apiKey, conn.secret).then((balances: any[]) => {
                            balances.forEach((b: { symbol: string; balance: number }) => addAsset(b.symbol, b.balance, conn.name));
                        })));
                    }

                    if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                        restPromises.push(wrap(fetchCexBalance('bybit', conn.apiKey, conn.secret).then((balances: any[]) => {
                            balances.forEach((b: { symbol: string; balance: number }) => addAsset(b.symbol, b.balance, conn.name));
                        })));
                    }

                    if (conn.type === 'hyperliquid' && conn.walletAddress) {
                        restPromises.push(wrap(Promise.all([
                            getHyperliquidSpotState(conn.walletAddress).then(spotState => {
                                if (spotState) {
                                    getHyperliquidSpotMeta().then(meta => {
                                        setSpotMeta(meta);
                                        spotState.balances.forEach(b => {
                                            let tokenName = b.coin;
                                            if (meta && /^\d+$/.test(b.coin)) {
                                                const tokenInfo = meta.universe.find(u => u.index === parseInt(b.coin));
                                                if (tokenInfo) tokenName = tokenInfo.name;
                                            }
                                            addAsset(tokenName, parseFloat(b.total), conn.name);
                                        });
                                    });
                                }
                            }),
                            getHyperliquidAccountState(conn.walletAddress).then(state => {
                                if (state) {
                                    const rawPositions = parseHyperliquidPositions(state);
                                    setPositions(rawPositions);
                                }
                            })
                        ])));
                    }
                }

                // Push HL available assets fetch
                restPromises.push(getHyperliquidAllAssets().then(assets => {
                    setAvailableAssets(assets);
                }).catch(e => console.warn("Failed to fetch Hyperliquid Assets", e)));

                // Wait for a reasonable subset or all initial balances to load, but time-cap it
                await Promise.race([
                    Promise.allSettled(restPromises),
                    new Promise(resolve => setTimeout(resolve, 5000)) // Max 5s wait for REST sync
                ]);

                setWatchlist(watchlistSymbols);
                setLoading(false);
            } catch (error) {
                console.error("Portfolio Sync Error:", error);
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

    const assets = useMemo(() => {
        return staticAssets.map(asset => ({
            ...asset,
            price: prices[asset.symbol] || asset.price || 0,
            priceChange24h: priceChanges[asset.symbol] || asset.priceChange24h || 0,
            valueUsd: (prices[asset.symbol] || asset.price || 0) * asset.balance
        }));
    }, [staticAssets, prices, priceChanges]);

    const totalValue = useMemo(() => {
        return assets.reduce((sum, asset) => sum + asset.valueUsd, 0);
    }, [assets]);

    const totalPnlUsd = useMemo(() => {
        return positions.reduce((sum, pos) => sum + pos.pnl, 0);
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
        // processActivities is imported
        return processActivities(transactions, transfers, walletMap);
    }, [transactions, transfers, connections]);

    return {
        assets: allocations,
        transactions,
        transfers,
        activities,
        positions,
        totalValue,
        totalPnlUsd,
        totalPnlPercent,
        drawdowns,
        loading,
        wsConnectionStatus,
        getWsStatus,
        watchlist,
        setWatchlist,
        availableAssets
    };
}
