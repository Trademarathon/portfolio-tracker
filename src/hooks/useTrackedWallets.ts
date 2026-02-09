import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLivePrices } from './useLivePrices';
import { PortfolioAsset, Transaction, Transfer } from '@/lib/api/types';

export interface TrackedAddress {
    address: string;
    chain: string; // 'ETH', 'SOL', 'SUI', 'APT', 'BTC', etc.
    type: 'evm' | 'solana' | 'sui' | 'aptos' | 'bitcoin' | 'zerion';
    name?: string;
}

export interface TrackedGroup {
    id: string;
    name: string;
    addresses: TrackedAddress[];
}

export interface GroupData {
    assets: PortfolioAsset[];
    transactions: (Transaction | Transfer)[];
    totalValue: number;
    loading: boolean;
}

const STORAGE_KEY = 'crypto-tracker-groups';

export function useTrackedWallets() {
    const [groups, setGroups] = useState<TrackedGroup[]>([]);
    const [rawGroupData, setRawGroupData] = useState<Record<string, { assets: any[], transactions: any[], loading: boolean }>>({});
    const [isInitialized, setIsInitialized] = useState(false);

    // 1. Load Groups
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    setGroups(JSON.parse(stored));
                }
            } catch (e) {
                console.error("Failed to load tracked groups", e);
            } finally {
                setIsInitialized(true);
            }
        }
    }, []);

    // 2. Save Groups
    const saveGroups = (newGroups: TrackedGroup[]) => {
        setGroups(newGroups);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroups));
        }
    };

    const addGroup = (name: string) => {
        const newGroup: TrackedGroup = {
            id: crypto.randomUUID(),
            name,
            addresses: []
        };
        saveGroups([...groups, newGroup]);
    };

    const removeGroup = (id: string) => {
        const newGroups = groups.filter(g => g.id !== id);
        saveGroups(newGroups);
        const newData = { ...rawGroupData };
        delete newData[id];
        setRawGroupData(newData);
    };

    const addAddressToGroup = (groupId: string, address: TrackedAddress) => {
        const newGroups = groups.map(g => {
            if (g.id === groupId) {
                return { ...g, addresses: [...g.addresses, address] };
            }
            return g;
        });
        saveGroups(newGroups);
        // Fetch data for this specific group immediately
        const updatedGroup = newGroups.find(g => g.id === groupId);
        if (updatedGroup) fetchGroupData(updatedGroup);
    };

    const removeAddressFromGroup = (groupId: string, addressStr: string) => {
        const newGroups = groups.map(g => {
            if (g.id === groupId) {
                return { ...g, addresses: g.addresses.filter(a => a.address !== addressStr) };
            }
            return g;
        });
        saveGroups(newGroups);
        const updatedGroup = newGroups.find(g => g.id === groupId);
        if (updatedGroup) fetchGroupData(updatedGroup);
    };

    // 3. Raw Data Fetching (Independent of Prices)
    const fetchGroupData = useCallback(async (group: TrackedGroup) => {
        setRawGroupData(prev => ({
            ...prev,
            [group.id]: { ...prev[group.id], loading: true }
        }));

        try {
            const allAssets: any[] = []; // Use partial type
            const allHistory: any[] = [];

            await Promise.all(group.addresses.map(async (addr) => {
                try {
                    // Fetch Portfolio
                    const portRes = await fetch(`/api/wallet/portfolio?address=${addr.address}&chain=${addr.chain}&type=${addr.type}`);
                    if (portRes.ok) {
                        const rawData = await portRes.json();
                        let assetList: any[] = [];

                        // Handle Zerion Object vs Standard Array
                        if (rawData && !Array.isArray(rawData) && rawData.tokens) {
                            // It's Zerion Full Portfolio
                            // We flatten it for now, highlighting type
                            assetList = [
                                ...rawData.tokens.map((t: any) => ({ ...t, _cat: 'Token' })),
                                ...rawData.nfts.map((n: any) => ({ ...n, _cat: 'NFT' })),
                                ...rawData.defi.map((d: any) => ({ ...d, _cat: 'DeFi' }))
                            ];
                        } else if (Array.isArray(rawData)) {
                            assetList = rawData;
                        }

                        assetList.forEach((a: any) => {
                            const existing = allAssets.find(x => x.symbol === a.symbol && x.name === a.name); // Stricter dedup for NFTs/DeFi
                            const balance = parseFloat(a.balance || '0');
                            const price = a.price || 0;
                            const value = a.value || (balance * price);

                            if (existing) {
                                existing.amount += balance;
                                // existing.valueUsd += value; // dynamically calc later, but base value useful
                                if (!existing.breakdown) existing.breakdown = {};
                                existing.breakdown[addr.address] = (existing.breakdown[addr.address] || 0) + balance;
                            } else {
                                allAssets.push({
                                    symbol: a.symbol,
                                    name: a.name || a.symbol,
                                    amount: balance,
                                    price: price,
                                    valueUsd: value, // Store pre-calced value if available (essential for DeFi)
                                    type: a._cat || 'Token', // Store category
                                    icon: a.icon,
                                    breakdown: { [addr.address]: balance }
                                });
                            }
                        });
                    }

                    // Fetch History
                    const histRes = await fetch(`/api/wallet/history?address=${addr.address}&chain=${addr.chain}&type=${addr.type}`);
                    if (histRes.ok) {
                        const history = await histRes.json();
                        allHistory.push(...history.map((tx: any) => ({
                            ...tx,
                            connectionId: addr.address
                        })));
                    }
                } catch (err) {
                    console.error(`Failed fetch for ${addr.address}`, err);
                }
            }));

            setRawGroupData(prev => ({
                ...prev,
                [group.id]: {
                    assets: allAssets,
                    transactions: allHistory,
                    loading: false
                }
            }));
        } catch (e) {
            console.error(`Group fetch error ${group.name}`, e);
            setRawGroupData(prev => ({
                ...prev,
                [group.id]: { assets: [], transactions: [], loading: false }
            }));
        }
    }, []); // No dependencies, stable function

    // 4. Compute Derived Data with Live Prices
    const { prices: livePrices } = useLivePrices([]);

    const groupData = useMemo(() => {
        const derived: Record<string, GroupData> = {};

        Object.keys(rawGroupData).forEach(gid => {
            const raw = rawGroupData[gid];
            if (!raw) return;

            let totalValue = 0;
            const pricedAssets = raw.assets.map(asset => {
                const livePrice = livePrices[asset.symbol] || asset.price || 0;
                const value = asset.amount * livePrice;
                totalValue += value;
                return {
                    ...asset,
                    price: livePrice,
                    valueUsd: value
                } as PortfolioAsset;
            }).sort((a, b) => b.valueUsd - a.valueUsd);

            const sortedHistory = raw.transactions.sort((a, b) => b.timestamp - a.timestamp);

            derived[gid] = {
                assets: pricedAssets,
                transactions: sortedHistory,
                totalValue,
                loading: raw.loading
            };
        });
        return derived;
    }, [rawGroupData, livePrices]);

    // Initial Fetch for all groups once loaded
    useEffect(() => {
        if (isInitialized && groups.length > 0) {
            // Only fetch if rawGroupData is empty for that group
            groups.forEach(g => {
                if (!rawGroupData[g.id]) {
                    fetchGroupData(g);
                }
            });
        }
    }, [isInitialized, groups, fetchGroupData, rawGroupData]);

    const refreshAll = () => {
        groups.forEach(g => fetchGroupData(g));
    };

    return {
        groups,
        groupData,
        loading: !isInitialized,
        addGroup,
        removeGroup,
        addAddressToGroup,
        removeAddressFromGroup,
        refreshAll
    };
}
