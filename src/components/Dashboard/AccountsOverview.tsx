import { Card, CardContent } from "@/components/ui/card";
import { PortfolioAsset, PortfolioConnection } from "@/lib/api/types";
import { Wallet, Building2, ArrowUpRight, Zap, Activity, HardDrive, Sparkles, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ExchangeIcon } from "@/components/ui/ExchangeIcon";

interface AccountsOverviewProps {
    assets: PortfolioAsset[];
    connections?: PortfolioConnection[];
    onSelectAccount?: (account: string, accountMeta?: { chainIds?: string[] }) => void;
    selectedAccount?: string | null;
    connectionErrors?: Record<string, string>;
    onRetryConnection?: (connectionId: string) => void;
}

interface ProcessedAccount {
    id: string;
    name: string;
    value: number;
    percent: number;
    type: string;
    isConnected: boolean;
    isHardwareWallet?: boolean;
    hardwareDevice?: string;
    chainCount?: number;
    chainIds?: string[];
    recentlyUsed?: boolean;
    lastActivity?: number;
    activityInsight?: string;
    isCex?: boolean;
    exchangeType?: string;
    isLoading?: boolean;
    connectionError?: string;
}

export function AccountsOverview({ assets, connections, onSelectAccount, selectedAccount, connectionErrors, onRetryConnection }: AccountsOverviewProps) {
    const safeAssets = Array.isArray(assets) ? assets : [];
    const safeConnections = Array.isArray(connections) ? connections : [];
    const safeConnectionErrors = connectionErrors && typeof connectionErrors === 'object' ? connectionErrors : {};
    const [now, setNow] = useState(Date.now());
    
    // Update time every minute for "recently used" calculations
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);
    
    const { accounts, totalPortfolioValue } = useMemo(() => {
        const stats: Record<string, number> = {};
        let totalVal = 0;

        safeAssets.forEach(asset => {
            if (asset.breakdown) {
                Object.entries(asset.breakdown).forEach(([key, balance]) => {
                    const price = asset.price || 0;
                    const value = balance * price;
                    stats[key] = (stats[key] || 0) + value;
                    totalVal += value;
                });
            }
        });

        const connMap = new Map(safeConnections.map(c => [c.id, c]));
        
        // Helper to check if recently used (within last 5 minutes)
        const RECENT_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        const isRecentlyUsed = (lastFetch?: number) => {
            if (!lastFetch) return false;
            return (now - lastFetch) < RECENT_THRESHOLD;
        };
        
        // Helper to generate activity insight
        const getActivityInsight = (conn: PortfolioConnection | undefined, isRecent: boolean) => {
            if (!conn) return undefined;
            if (isRecent) {
                const secondsAgo = Math.floor((now - (conn.lastFetchTime || 0)) / 1000);
                if (secondsAgo < 60) return `Active ${secondsAgo}s ago`;
                return `Active ${Math.floor(secondsAgo / 60)}m ago`;
            }
            if (conn.lastFetchMs && conn.lastFetchMs < 100) return 'Ultra-fast sync';
            if (conn.lastFetchMs && conn.lastFetchMs < 300) return 'Fast connection';
            return undefined;
        };
        
        // Group hardware wallet chains by device type + name
        const hardwareWalletGroups: Record<string, { 
            deviceName: string; 
            device: string; 
            value: number; 
            chainIds: string[];
            chains: string[];
            recentlyUsed: boolean;
            lastActivity: number;
        }> = {};
        
        // Group CEX accounts by connection ID to avoid duplicates (e.g., connId and connId::Spot)
        const cexAccountGroups: Record<string, {
            connection: PortfolioConnection;
            value: number;
            subTypes: string[];
            recentlyUsed: boolean;
            lastActivity: number;
        }> = {};
        
        const regularAccounts: ProcessedAccount[] = [];

        Object.entries(stats).forEach(([key, value]) => {
            const [connId, subType] = key.split('::');
            const connection = connMap.get(connId);
            const isRecent = isRecentlyUsed(connection?.lastFetchTime);
            
            // Check if this is a hardware wallet connection (has hardwareType)
            if (connection?.hardwareType) {
                // Group by hardware type + name (e.g., "ledger_Nano X" or "trezor_Model T")
                const deviceKey = `${connection.hardwareType}_${connection.name || 'Wallet'}`;
                
                if (!hardwareWalletGroups[deviceKey]) {
                    hardwareWalletGroups[deviceKey] = {
                        deviceName: connection.name || connection.hardwareType,
                        device: connection.hardwareType,
                        value: 0,
                        chainIds: [],
                        chains: [],
                        recentlyUsed: false,
                        lastActivity: 0
                    };
                }
                
                hardwareWalletGroups[deviceKey].value += value;
                hardwareWalletGroups[deviceKey].chainIds.push(key);
                if (connection.chain) {
                    hardwareWalletGroups[deviceKey].chains.push(connection.chain);
                }
                // Mark as recently used if any chain was recently active
                if (isRecent) {
                    hardwareWalletGroups[deviceKey].recentlyUsed = true;
                }
                // Track most recent activity
                if (connection.lastFetchTime && connection.lastFetchTime > hardwareWalletGroups[deviceKey].lastActivity) {
                    hardwareWalletGroups[deviceKey].lastActivity = connection.lastFetchTime;
                }
            } else {
                // Identify CEX (centralized exchanges)
                const isCex = ['binance', 'bybit', 'hyperliquid', 'okx'].includes(connection?.type || '');
                
                // Group CEX accounts by connection ID to merge Spot/Perp/legacy keys
                if (isCex && connection) {
                    if (!cexAccountGroups[connId]) {
                        cexAccountGroups[connId] = {
                            connection,
                            value: 0,
                            subTypes: [],
                            recentlyUsed: false,
                            lastActivity: 0
                        };
                    }
                    cexAccountGroups[connId].value += value;
                    if (subType && !cexAccountGroups[connId].subTypes.includes(subType)) {
                        cexAccountGroups[connId].subTypes.push(subType);
                    }
                    if (isRecent) {
                        cexAccountGroups[connId].recentlyUsed = true;
                    }
                    if (connection.lastFetchTime && connection.lastFetchTime > cexAccountGroups[connId].lastActivity) {
                        cexAccountGroups[connId].lastActivity = connection.lastFetchTime;
                    }
                } else {
                    // Non-CEX regular connection (wallet, etc.)
                    let displayName = connection?.name || (connId.length > 10 ? `${connId.slice(0, 6)}...${connId.slice(-4)}` : connId);
                    if (subType) displayName += ` (${subType})`;

                    regularAccounts.push({
                        id: key,
                        name: displayName,
                        value,
                        percent: totalVal > 0 ? (value / totalVal) * 100 : 0,
                        type: connection?.type || 'exchange',
                        isConnected: connection?.enabled !== false,
                        recentlyUsed: isRecent,
                        lastActivity: connection?.lastFetchTime,
                        activityInsight: getActivityInsight(connection, isRecent),
                        isCex: false,
                        exchangeType: connection?.type
                    });
                }
            }
        });
        
        // Convert CEX account groups to accounts (merged by connection ID)
        const cexAccounts: ProcessedAccount[] = Object.entries(cexAccountGroups)
            .map(([connId, group]) => {
                const conn = group.connection;
                const secondsAgo = group.lastActivity ? Math.floor((now - group.lastActivity) / 1000) : 0;
                let insight: string | undefined;
                if (group.recentlyUsed) {
                    insight = secondsAgo < 60 ? `Active ${secondsAgo}s ago` : `Active ${Math.floor(secondsAgo / 60)}m ago`;
                }
                
                // Display name: connection name + subTypes if multiple
                let displayName = conn.name || conn.type;
                if (group.subTypes.length === 1) {
                    displayName += ` (${group.subTypes[0]})`;
                } else if (group.subTypes.length > 1) {
                    // Multiple subTypes (e.g., Spot + Perp) - just show the name
                    displayName = conn.name || conn.type;
                }
                
                return {
                    id: connId,
                    name: displayName,
                    value: group.value,
                    percent: totalVal > 0 ? (group.value / totalVal) * 100 : 0,
                    type: conn.type,
                    isConnected: conn.enabled !== false,
                    recentlyUsed: group.recentlyUsed,
                    lastActivity: group.lastActivity,
                    activityInsight: insight,
                    isCex: true,
                    exchangeType: conn.type
                };
            });
        
        // Convert hardware wallet groups to accounts
        const hwAccounts: ProcessedAccount[] = Object.entries(hardwareWalletGroups)
            .map(([deviceKey, group]) => {
                const secondsAgo = group.lastActivity ? Math.floor((now - group.lastActivity) / 1000) : 0;
                let insight: string | undefined;
                if (group.recentlyUsed) {
                    insight = secondsAgo < 60 ? `Active ${secondsAgo}s ago` : `Active ${Math.floor(secondsAgo / 60)}m ago`;
                }
                
                return {
                    id: `hw_${deviceKey}`,
                    name: group.deviceName,
                    value: group.value,
                    percent: totalVal > 0 ? (group.value / totalVal) * 100 : 0,
                    type: 'hardware',
                    isConnected: true,
                    isHardwareWallet: true,
                    hardwareDevice: group.device,
                    chainCount: group.chains.length,
                    chainIds: group.chainIds,
                    recentlyUsed: group.recentlyUsed,
                    lastActivity: group.lastActivity,
                    activityInsight: insight
                };
            });
        
        // Add CEX connections that don't have balance data yet (show loading or error state)
        const cexConnectionIds = new Set(cexAccounts.map(a => a.id));
        const pendingCexAccounts: ProcessedAccount[] = safeConnections
            .filter(conn => 
                ['binance', 'bybit', 'hyperliquid', 'okx'].includes(conn.type) && 
                conn.enabled !== false &&
                !cexConnectionIds.has(conn.id)
            )
            .map(conn => ({
                id: conn.id,
                name: conn.name || conn.type,
                value: 0,
                percent: 0,
                type: conn.type,
                isConnected: true,
                isCex: true,
                exchangeType: conn.type,
                // Avoid endless loading cards when an exchange returns empty/zero balances.
                isLoading: false,
                connectionError: safeConnectionErrors[conn.id]
            }));

        // Add hardware wallet devices that don't have balance data yet (so they show in the list)
        const hwDeviceKeysWithData = new Set(Object.keys(hardwareWalletGroups));
        const hwDeviceKeysFromConnections = new Map<string, PortfolioConnection[]>();
        safeConnections.filter(c => c.hardwareType && c.enabled !== false).forEach(conn => {
            const deviceKey = `${conn.hardwareType}_${conn.name || 'Wallet'}`;
            if (!hwDeviceKeysFromConnections.has(deviceKey)) hwDeviceKeysFromConnections.set(deviceKey, []);
            hwDeviceKeysFromConnections.get(deviceKey)!.push(conn);
        });
        const pendingHwAccounts: ProcessedAccount[] = [];
        hwDeviceKeysFromConnections.forEach((conns, deviceKey) => {
            if (hwDeviceKeysWithData.has(deviceKey)) return;
            const first = conns[0];
            if (!first) return;
            pendingHwAccounts.push({
                id: `hw_${deviceKey}`,
                name: first.name || first.hardwareType || 'Wallet',
                value: 0,
                percent: 0,
                type: 'hardware',
                isConnected: true,
                isHardwareWallet: true,
                hardwareDevice: first.hardwareType,
                chainCount: conns.length,
                chainIds: conns.map(c => c.id),
                isLoading: true as any
            });
        });
        
        // Combine and sort all accounts (include pending CEX and pending HW so they always show)
        const allAccounts = [
            ...regularAccounts.filter(acc => acc.value > 0.01),
            ...cexAccounts.filter(acc => acc.value > 0.01),
            ...hwAccounts.filter(acc => acc.value > 0.01),
            ...pendingCexAccounts, // Show pending CEX even without balance
            ...pendingHwAccounts   // Show hardware wallet devices even without balance yet
        ].sort((a, b) => {
            // Sort loaded accounts by value, pending accounts at the end
            if ((a as any).isLoading && !(b as any).isLoading) return 1;
            if (!(a as any).isLoading && (b as any).isLoading) return -1;
            return b.value - a.value;
        });

        return { accounts: allAccounts, totalPortfolioValue: totalVal };
    }, [safeAssets, safeConnections, now, safeConnectionErrors]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em]">Asset Distribution</h2>
                    <p className="text-xs text-zinc-600 font-medium">Aggregated balances across all active connections</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.08]">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Live
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                        {accounts.length} Active Accounts
                    </div>
                    <div className="w-px h-3 bg-white/10 hidden md:block" />
                    <div className="hidden md:flex items-center gap-1 text-zinc-600">
                        <Activity className="w-3 h-3" />
                        Updated Just Now
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-3">
                {/* Global View Card */}
                <motion.div>
                    <Card
                        className={cn(
                            "group cursor-pointer relative overflow-hidden transition-all duration-300 bg-zinc-900/30 border-white/[0.08] hover:border-white/20",
                            (!selectedAccount || selectedAccount === 'All') && "bg-white/[0.04] border-white/20 ring-1 ring-white/10"
                        )}
                        onClick={() => onSelectAccount && onSelectAccount('All')}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn(
                                    "p-2 rounded-lg bg-zinc-800/50 text-zinc-400 transition-colors",
                                    (!selectedAccount || selectedAccount === 'All') && "bg-primary/20 text-primary"
                                )}>
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="text-[10px] font-black text-zinc-500 group-hover:text-primary transition-colors">ALL OPS</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-2xl font-black text-white tracking-tighter">
                                    ${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Total Net Worth</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Individual Cards */}
                <AnimatePresence mode="popLayout">
                    {accounts.map((acc, index) => (
                        <motion.div
                            key={acc.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="relative"
                        >
                            <Card
                                className={cn(
                                    "group cursor-pointer relative overflow-hidden transition-all duration-300 bg-zinc-900/40 border-white/[0.08] hover:border-white/20",
                                    selectedAccount === acc.id && "bg-white/[0.05] border-white/25 ring-1 ring-white/10",
                                    acc.isHardwareWallet && "border-purple-500/20",
                                    acc.isCex && acc.exchangeType === 'binance' && "border-yellow-500/20",
                                    acc.isCex && acc.exchangeType === 'bybit' && "border-orange-500/20",
                                    acc.isCex && acc.exchangeType === 'hyperliquid' && "border-emerald-500/20",
                                    acc.isCex && acc.exchangeType === 'okx' && "border-indigo-500/20"
                                )}
                                onClick={() => onSelectAccount && onSelectAccount(acc.id, { chainIds: (acc as any).chainIds })}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={cn(
                                            "flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-black tracking-tight",
                                            acc.isHardwareWallet 
                                                ? "bg-purple-500/10 text-purple-400" 
                                                : acc.isCex
                                                    ? acc.exchangeType === 'binance' 
                                                        ? "bg-yellow-500/10 text-yellow-400"
                                                        : acc.exchangeType === 'bybit'
                                                            ? "bg-orange-500/10 text-orange-400"
                                                            : acc.exchangeType === 'hyperliquid'
                                                                ? "bg-emerald-500/10 text-emerald-400"
                                                                : acc.exchangeType === 'okx'
                                                                    ? "bg-indigo-500/10 text-indigo-400"
                                                                    : "bg-orange-500/10 text-orange-400"
                                                    : acc.type === 'wallet' 
                                                        ? "bg-blue-500/10 text-blue-400" 
                                                        : "bg-orange-500/10 text-orange-400"
                                        )}>
                                            {acc.isHardwareWallet ? (
                                                <>
                                                    <HardDrive size={12} />
                                                    {acc.hardwareDevice?.toUpperCase()}
                                                </>
                                            ) : acc.isCex && acc.exchangeType ? (
                                                <>
                                                    <ExchangeIcon exchange={acc.exchangeType} size={14} />
                                                    <span className="uppercase">{acc.exchangeType}</span>
                                                </>
                                            ) : (
                                                <>
                                                    {acc.type === 'wallet' ? <Wallet size={12} /> : <Zap size={12} />}
                                                    {acc.type.toUpperCase()}
                                                </>
                                            )}
                                        </div>
                                        {acc.isHardwareWallet && acc.chainCount && (
                                            <div className="text-[9px] font-mono text-purple-400/70 bg-purple-500/10 px-1.5 py-0.5 rounded">
                                                {acc.chainCount} chains
                                            </div>
                                        )}
                                        {/* Recently used indicator */}
                                        {acc.recentlyUsed && (
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                                <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                                                <span className="text-[8px] font-black text-emerald-400">ACTIVE</span>
                                            </div>
                                        )}
                                        <ArrowUpRight className="h-3 w-3 text-zinc-700 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-lg font-black text-white tracking-tight truncate leading-none mb-1">
                                            {acc.name}
                                        </div>
                                        <div className="flex items-baseline justify-between">
                                            {(acc as ProcessedAccount).connectionError ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] text-amber-500 font-medium">
                                                        {acc.isCex ? 'Connection issue' : 'Unavailable'}
                                                    </span>
                                                    <span className="block text-[8px] text-zinc-500 max-w-[120px] truncate" title={(acc as ProcessedAccount).connectionError}>
                                                        {(acc as ProcessedAccount).connectionError}
                                                    </span>
                                                    {onRetryConnection && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); onRetryConnection(acc.id); }}
                                                            className="text-[9px] font-bold text-primary hover:underline"
                                                        >
                                                            Retry
                                                        </button>
                                                    )}
                                                </div>
                                            ) : acc.isLoading ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-5 w-16 bg-zinc-700/50 rounded animate-pulse" />
                                                    <span className="text-[9px] text-zinc-500 animate-pulse">Loading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-xl font-bold text-white/90 tracking-tighter">
                                                        ${acc.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </div>
                                                    <div className="text-[10px] font-black text-zinc-500">
                                                        {acc.percent.toFixed(1)}%
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        
                                        {/* Activity insight */}
                                        {acc.activityInsight && !acc.isLoading && (
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <Clock className="h-2.5 w-2.5 text-emerald-400" />
                                                <span className="text-[9px] font-medium text-emerald-400/80">{acc.activityInsight}</span>
                                            </div>
                                        )}
                                        
                                        <div className="h-1 w-full bg-zinc-800 rounded-full mt-2 overflow-hidden">
                                            {(acc as ProcessedAccount).connectionError || acc.isLoading ? (
                                                <div className="h-full bg-zinc-700" style={{ width: '100%' }} />
                                            ) : (
                                                <motion.div
                                                    className={cn(
                                                        "h-full bg-zinc-600 group-hover:bg-primary transition-colors",
                                                        acc.isHardwareWallet 
                                                            ? "bg-purple-500/40" 
                                                            : acc.isCex && acc.exchangeType === 'binance'
                                                                ? "bg-yellow-500/40"
                                                                : acc.isCex && acc.exchangeType === 'bybit'
                                                                    ? "bg-orange-500/40"
                                                                    : acc.isCex && acc.exchangeType === 'hyperliquid'
                                                                        ? "bg-emerald-500/40"
                                                                        : acc.isCex && acc.exchangeType === 'okx'
                                                                            ? "bg-indigo-500/40"
                                                                            : acc.type === 'wallet' 
                                                                                ? "bg-blue-500/40" 
                                                                                : "bg-orange-500/40",
                                                        acc.recentlyUsed && "opacity-90"
                                                    )}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${acc.percent}%` }}
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
