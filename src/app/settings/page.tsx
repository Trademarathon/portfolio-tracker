"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Plus, Trash2, CheckCircle2, XCircle, Clock, Filter, AlertTriangle, Zap, Power } from "lucide-react";
import { PortfolioConnection } from "@/lib/api/types";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import Image from "next/image";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useWebSocketStatus } from "@/hooks/useWebSocketStatus";

// Exchange/Wallet Icon Component
function ConnectionIcon({ type, chain }: { type: string; chain?: string }) {
    const iconMap: { [key: string]: string } = {
        binance: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
        bybit: "https://cryptologos.cc/logos/bybit-logo.svg",
        hyperliquid: "https://app.hyperliquid.xyz/favicon.ico",
        wallet: chain === "ETH" ? "https://cryptologos.cc/logos/ethereum-eth-logo.svg" :
            chain === "SOL" ? "https://cryptologos.cc/logos/solana-sol-logo.svg" :
                chain === "BTC" ? "https://cryptologos.cc/logos/bitcoin-btc-logo.svg" :
                    chain === "ARB" ? "https://cryptologos.cc/logos/arbitrum-arb-logo.svg" :
                        chain === "MATIC" ? "https://cryptologos.cc/logos/polygon-matic-logo.svg" :
                            chain === "OP" ? "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg" :
                                chain === "BASE" ? "https://cryptologos.cc/logos/base-logo.svg" :
                                    chain === "AVAX" ? "https://cryptologos.cc/logos/avalanche-avax-logo.svg" :
                                        chain === "BSC" ? "https://cryptologos.cc/logos/bnb-bnb-logo.svg" :
                                            chain === "HBAR" ? "https://cryptologos.cc/logos/hedera-hbar-logo.svg" :
                                                chain === "HASHCROFT" ? "https://cryptologos.cc/logos/ethereum-eth-logo.svg" :
                                                    "https://cryptologos.cc/logos/ethereum-eth-logo.svg"
    };

    return (
        <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 p-1.5">
            <Image
                src={iconMap[type] || iconMap.wallet}
                alt={type}
                width={28}
                height={28}
                className="object-contain"
                unoptimized
            />
        </div>
    );
}

// Latency Meter Component
function LatencyMeter({ latency }: { latency?: number }) {
    if (!latency) return null;

    const getLatencyColor = (ms: number) => {
        if (ms < 100) return "text-emerald-500 bg-emerald-500/20";
        if (ms < 300) return "text-yellow-500 bg-yellow-500/20";
        return "text-red-500 bg-red-500/20";
    };

    const getLatencyLabel = (ms: number) => {
        if (ms < 100) return "Excellent";
        if (ms < 300) return "Good";
        return "Slow";
    };

    return (
        <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold", getLatencyColor(latency))}>
                <Zap className="h-3 w-3" />
                <span>{latency}ms</span>
            </div>
            <span className="text-xs text-zinc-500">{getLatencyLabel(latency)}</span>
        </div>
    );
}

export default function SettingsPage() {
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);
    const [saved, setSaved] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newConnection, setNewConnection] = useState<Partial<PortfolioConnection>>({
        type: 'binance',
        name: '',
    });

    // Real-time Connection Status
    const wsStatusMap = useWebSocketStatus();

    // Derived connection status for UI compatibility
    const connectionStatus = connections.reduce((acc, conn) => {
        const info = wsStatusMap.get(conn.id);
        acc[conn.id] = {
            status: info?.status === 'connected' ? 'connected' : info?.status === 'error' ? 'disconnected' : 'checking',
            lastSync: info?.lastUpdate, // Corrected property name
            latency: info?.latency
        };
        return acc;
    }, {} as { [key: string]: { status: 'connected' | 'disconnected' | 'checking'; lastSync?: Date; latency?: number } });

    // Transaction Filters State
    const [filters, setFilters] = useState({
        transactionTypes: ['buy', 'sell', 'transfer'],
        minAmount: 0,
        dateRange: 'all' as 'all' | '7d' | '30d' | '90d',
        sources: [] as string[]
    });

    useEffect(() => {
        // Load from localStorage
        const savedConnections = localStorage.getItem("portfolio_connections");
        const savedFilters = localStorage.getItem("transaction_filters");

        if (savedConnections) {
            setConnections(JSON.parse(savedConnections));
        } else {
            // MIGRATION: Check for old keys and migrate
            const oldKeys = localStorage.getItem("api_keys");
            const oldWallets = localStorage.getItem("user_wallets");
            const migrated: PortfolioConnection[] = [];

            if (oldKeys) {
                const k = JSON.parse(oldKeys);
                if (k.binanceApiKey) migrated.push({ id: uuidv4(), type: 'binance', name: 'Binance Main', apiKey: k.binanceApiKey, secret: k.binanceSecret });
                if (k.bybitApiKey) migrated.push({ id: uuidv4(), type: 'bybit', name: 'Bybit Main', apiKey: k.bybitApiKey, secret: k.bybitSecret });
                if (k.hyperliquidWallet) migrated.push({ id: uuidv4(), type: 'hyperliquid', name: 'Hyperliquid Main', walletAddress: k.hyperliquidWallet });
            }
            if (oldWallets) {
                const w = JSON.parse(oldWallets);
                if (w.ethAddress) migrated.push({ id: uuidv4(), type: 'wallet', name: 'Ethereum Main', chain: 'ETH', walletAddress: w.ethAddress });
                if (w.solAddress) migrated.push({ id: uuidv4(), type: 'wallet', name: 'Solana Main', chain: 'SOL', walletAddress: w.solAddress });
                if (w.btcAddress) migrated.push({ id: uuidv4(), type: 'wallet', name: 'Bitcoin Main', chain: 'BTC', walletAddress: w.btcAddress });
            }

            if (migrated.length > 0) {
                setConnections(migrated);
                localStorage.setItem("portfolio_connections", JSON.stringify(migrated));
            }
        }

        if (savedFilters) {
            setFilters(JSON.parse(savedFilters));
        }
    }, [connections.length]);

    const handleSave = () => {
        localStorage.setItem("portfolio_connections", JSON.stringify(connections));
        localStorage.setItem("transaction_filters", JSON.stringify(filters));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const addConnection = () => {
        if (!newConnection.name) return;
        const conn: PortfolioConnection = {
            id: uuidv4(),
            type: newConnection.type as any,
            name: newConnection.name,
            apiKey: newConnection.apiKey,
            secret: newConnection.secret,
            walletAddress: newConnection.walletAddress,
            chain: newConnection.chain,
            enabled: true // Enable real-time data fetching by default
        };
        const updatedConnections = [...connections, conn];
        setConnections(updatedConnections);
        // Immediately save to localStorage
        localStorage.setItem("portfolio_connections", JSON.stringify(updatedConnections));
        setIsAdding(false);
        setNewConnection({ type: 'binance', name: '' });
    };

    const toggleConnection = (id: string) => {
        const updatedConnections = connections.map(conn =>
            conn.id === id ? { ...conn, enabled: !conn.enabled } : conn
        );
        setConnections(updatedConnections);
        // Immediately save to localStorage
        localStorage.setItem("portfolio_connections", JSON.stringify(updatedConnections));
    };

    const removeConnection = (id: string) => {
        if (confirm("Are you sure you want to remove this connection?")) {
            const updatedConnections = connections.filter(c => c.id !== id);
            setConnections(updatedConnections);
            // Immediately save to localStorage
            localStorage.setItem("portfolio_connections", JSON.stringify(updatedConnections));
        }
    };

    const toggleTransactionType = (type: string) => {
        setFilters(prev => ({
            ...prev,
            transactionTypes: prev.transactionTypes.includes(type)
                ? prev.transactionTypes.filter(t => t !== type)
                : [...prev.transactionTypes, type]
        }));
    };

    return (
        <div className="flex flex-col gap-6 pb-16">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
                <p className="text-sm text-muted-foreground">Manage your connections, filters, and monitoring preferences.</p>
            </div>

            <Tabs defaultValue="connections" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-zinc-900/50">
                    <TabsTrigger value="connections" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                        Connections
                    </TabsTrigger>
                    <TabsTrigger value="status" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                        Connection Status
                    </TabsTrigger>
                    <TabsTrigger value="filters" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                        Transaction Filters
                    </TabsTrigger>
                </TabsList>

                {/* CONNECTIONS TAB */}
                <TabsContent value="connections" className="space-y-4">
                    <div className="grid gap-4">
                        {connections.map(conn => {
                            const status = connectionStatus[conn.id];
                            const isEnabled = conn.enabled !== false; // Default to true if undefined
                            return (
                                <Card key={conn.id} className={cn(
                                    "bg-zinc-950/50 backdrop-blur-sm border-white/10 transition-all",
                                    !isEnabled && "opacity-50"
                                )}>
                                    <CardContent className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-4">
                                            <ConnectionIcon type={conn.type} chain={conn.chain} />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-white text-sm">{conn.name}</h3>
                                                    {isEnabled && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold">LIVE</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                                                    {conn.type} {conn.chain ? `(${conn.chain})` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {isEnabled && <LatencyMeter latency={status?.latency} />}
                                            <div className="text-right text-xs text-muted-foreground font-mono">
                                                {conn.apiKey ? (
                                                    <div>API: {conn.apiKey.slice(0, 4)}...{conn.apiKey.slice(-4)}</div>
                                                ) : (
                                                    <div>{conn.walletAddress?.slice(0, 6)}...{conn.walletAddress?.slice(-4)}</div>
                                                )}
                                            </div>
                                            {/* Toggle Switch */}
                                            <button
                                                onClick={() => toggleConnection(conn.id)}
                                                className={cn(
                                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                                    isEnabled ? "bg-emerald-500" : "bg-zinc-700"
                                                )}
                                                title={isEnabled ? "Disable real-time sync" : "Enable real-time sync"}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                        isEnabled ? "translate-x-6" : "translate-x-1"
                                                    )}
                                                />
                                            </button>
                                            <button onClick={() => removeConnection(conn.id)} className="p-2 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 rounded transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}

                        {/* Add New Connection */}
                        {!isAdding ? (
                            <button
                                onClick={() => setIsAdding(true)}
                                className="w-full py-6 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors bg-white/5 hover:bg-white/10"
                            >
                                <Plus className="h-6 w-6 mb-2" />
                                <span className="font-bold text-sm">Add New Connection</span>
                            </button>
                        ) : (
                            <Card className="bg-zinc-900 border-primary/50 ring-1 ring-primary/20">
                                <CardHeader>
                                    <CardTitle className="text-base">Add Connection</CardTitle>
                                    <CardDescription className="text-xs">Connect a new exchange API or wallet address.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                                            <select
                                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white text-sm"
                                                value={newConnection.type}
                                                onChange={(e) => setNewConnection({ ...newConnection, type: e.target.value as any, chain: e.target.value === 'wallet' ? 'ETH' : undefined })}
                                            >
                                                <option value="binance">Binance</option>
                                                <option value="bybit">Bybit</option>
                                                <option value="hyperliquid">Hyperliquid</option>
                                                <option value="wallet">On-Chain Wallet</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase text-muted-foreground">Name (Label)</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Main Account"
                                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white text-sm"
                                                value={newConnection.name}
                                                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {newConnection.type === 'wallet' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase text-muted-foreground">Chain</label>
                                            <select
                                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white text-sm"
                                                value={newConnection.chain}
                                                onChange={(e) => setNewConnection({ ...newConnection, chain: e.target.value })}
                                            >
                                                <option value="ETH">Ethereum (ETH)</option>
                                                <option value="SOL">Solana (SOL)</option>
                                                <option value="BTC">Bitcoin (BTC)</option>
                                                <option value="ARB">Arbitrum (ARB)</option>
                                                <option value="MATIC">Polygon (MATIC)</option>
                                                <option value="OP">Optimism (OP)</option>
                                                <option value="BASE">Base</option>
                                                <option value="AVAX">Avalanche (AVAX)</option>
                                                <option value="BSC">Binance Smart Chain (BSC)</option>
                                                <option value="HBAR">Hedera Hashgraph (HBAR)</option>
                                                <option value="HASHCROFT">Hashcroft</option>
                                            </select>
                                        </div>
                                    )}

                                    {newConnection.type !== 'wallet' && newConnection.type !== 'hyperliquid' && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-muted-foreground">API Key</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-white font-mono text-sm"
                                                    value={newConnection.apiKey || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-muted-foreground">API Secret</label>
                                                <input
                                                    type="password"
                                                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-white font-mono text-sm"
                                                    value={newConnection.secret || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, secret: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {(newConnection.type === 'wallet' || newConnection.type === 'hyperliquid') && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase text-muted-foreground">Wallet Address</label>
                                            <input
                                                type="text"
                                                placeholder={newConnection.type === 'hyperliquid' ? "Arbitrum Address (0x...)" : "Address"}
                                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white font-mono text-sm"
                                                value={newConnection.walletAddress || ''}
                                                onChange={(e) => setNewConnection({ ...newConnection, walletAddress: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 pt-4">
                                        <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-white">Cancel</button>
                                        <button onClick={addConnection} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded font-bold text-sm">Add Connection</button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                {/* CONNECTION STATUS TAB */}
                <TabsContent value="status" className="space-y-4">
                    <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                        <CardHeader>
                            <CardTitle className="text-base">Real-Time Connection Monitoring</CardTitle>
                            <CardDescription className="text-xs">Live status and latency of all your exchanges and wallets</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {connections.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500 text-sm">
                                    No connections configured. Add connections in the Connections tab.
                                </div>
                            ) : (
                                connections.map(conn => {
                                    const status = connectionStatus[conn.id];
                                    const isEnabled = conn.enabled !== false;
                                    const isConnected = isEnabled && status?.status === 'connected';
                                    const isChecking = isEnabled && status?.status === 'checking';
                                    const isDisabled = !isEnabled;

                                    return (
                                        <div key={conn.id} className={cn(
                                            "flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5 transition-all",
                                            isDisabled && "opacity-50"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    isDisabled ? "bg-zinc-600" :
                                                        isConnected ? "bg-emerald-500 animate-pulse" :
                                                            isChecking ? "bg-yellow-500 animate-pulse" : "bg-red-500"
                                                )} />
                                                <ConnectionIcon type={conn.type} chain={conn.chain} />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-white text-sm">{conn.name}</h4>
                                                        {isEnabled && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold">LIVE</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{conn.type.toUpperCase()} {conn.chain ? `• ${conn.chain}` : ''}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {isEnabled && <LatencyMeter latency={status?.latency} />}
                                                {isEnabled && status?.lastSync && (
                                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                        <Clock className="h-3 w-3" />
                                                        <span>{status.lastSync.toLocaleTimeString()}</span>
                                                    </div>
                                                )}
                                                {/* Toggle Switch */}
                                                <button
                                                    onClick={() => toggleConnection(conn.id)}
                                                    className={cn(
                                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                                        isEnabled ? "bg-emerald-500" : "bg-zinc-700"
                                                    )}
                                                    title={isEnabled ? "Disable real-time sync" : "Enable real-time sync"}
                                                >
                                                    <span
                                                        className={cn(
                                                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                            isEnabled ? "translate-x-6" : "translate-x-1"
                                                        )}
                                                    />
                                                </button>
                                                <div className={cn(
                                                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold",
                                                    isDisabled ? "bg-zinc-700/20 text-zinc-500" :
                                                        isConnected ? "bg-emerald-500/20 text-emerald-500" :
                                                            isChecking ? "bg-yellow-500/20 text-yellow-500" : "bg-red-500/20 text-red-500"
                                                )}>
                                                    {isDisabled ? (
                                                        <>
                                                            <Power className="h-3 w-3" />
                                                            <span>DISABLED</span>
                                                        </>
                                                    ) : isConnected ? (
                                                        <>
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            <span>CONNECTED</span>
                                                        </>
                                                    ) : isChecking ? (
                                                        <>
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span>CHECKING</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="h-3 w-3" />
                                                            <span>DISCONNECTED</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TRANSACTION FILTERS TAB */}
                <TabsContent value="filters" className="space-y-4">
                    <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                Transaction Filters
                            </CardTitle>
                            <CardDescription className="text-xs">Configure which transactions to display in your dashboard</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Transaction Types */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-muted-foreground">Transaction Types</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['buy', 'sell', 'transfer'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => toggleTransactionType(type)}
                                            className={cn(
                                                "p-3 rounded-lg border-2 transition-all text-sm font-bold uppercase",
                                                filters.transactionTypes.includes(type)
                                                    ? "border-primary bg-primary/20 text-primary"
                                                    : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                            )}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Minimum Amount */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-muted-foreground">Minimum Amount (USD)</label>
                                <input
                                    type="number"
                                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm"
                                    value={filters.minAmount}
                                    onChange={(e) => setFilters({ ...filters, minAmount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0"
                                />
                            </div>

                            {/* Date Range */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-muted-foreground">Date Range</label>
                                <select
                                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm"
                                    value={filters.dateRange}
                                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                                >
                                    <option value="all">All Time</option>
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                    <option value="90d">Last 90 Days</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full"
            >
                <Save className="h-4 w-4" /> {saved ? "Saved!" : "Save All Changes"}
            </button>
        </div>
    );
}
