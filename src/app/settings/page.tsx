"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Plus, Trash2, CheckCircle2, XCircle, Clock, Filter, AlertTriangle, Zap, Power, Shield, RefreshCw, LayoutGrid, Search, Server } from "lucide-react";
import { PortfolioConnection } from "@/lib/api/types";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { useWebSocketStatus } from "@/hooks/useWebSocketStatus";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { ToggleTheme } from "@/components/ui/toggle-theme";
import { MonitorCogIcon } from "lucide-react";

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
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold", getLatencyColor(latency))}>
                <Zap className="h-3 w-3" />
                <span>{latency}ms</span>
            </div>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">{getLatencyLabel(latency)}</span>
        </div>
    );
}

export default function SettingsPage() {
    const [saved, setSaved] = useState(false);

    // --- STATE: GENERAL ---
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [baseCurrency, setBaseCurrency] = useState('USD'); // Placeholder for now

    // --- STATE: CONNECTIONS ---
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newConnection, setNewConnection] = useState<Partial<PortfolioConnection>>({
        type: 'binance',
        name: '',
    });

    // --- STATE: PREFERENCES (Advanced) ---
    const [dustThreshold, setDustThreshold] = useState(1.0); // Default $1.00
    const [hideSpam, setHideSpam] = useState(true);
    const [filters, setFilters] = useState({
        transactionTypes: ['buy', 'sell', 'transfer'],
        minAmount: 0,
        dateRange: 'all' as 'all' | '7d' | '30d' | '90d',
    });

    // Real-time Connection Status
    const wsStatusMap = useWebSocketStatus();

    // Derived connection status for UI
    const connectionStatus = connections.reduce((acc, conn) => {
        const info = wsStatusMap.get(conn.id);
        acc[conn.id] = {
            status: info?.status === 'connected' ? 'connected' : info?.status === 'error' ? 'disconnected' : 'checking',
            lastSync: info?.lastUpdate,
            latency: info?.latency
        };
        return acc;
    }, {} as { [key: string]: { status: 'connected' | 'disconnected' | 'checking'; lastSync?: Date; latency?: number } });


    // --- LOAD / SAVE EFFECTS ---
    useEffect(() => {
        // Load settings
        setIsDemoMode(localStorage.getItem("demo_mode") === "true");
        setAutoRefresh(localStorage.getItem("settings_auto_refresh") !== "false");
        setHideSpam(localStorage.getItem("settings_hide_spam") !== "false");

        const savedDust = localStorage.getItem("settings_dust_threshold");
        if (savedDust) setDustThreshold(parseFloat(savedDust));

        const savedConnections = localStorage.getItem("portfolio_connections");
        if (savedConnections) setConnections(JSON.parse(savedConnections));

        const savedFilters = localStorage.getItem("transaction_filters");
        if (savedFilters) setFilters(JSON.parse(savedFilters));
    }, []);

    const handleSave = () => {
        localStorage.setItem("portfolio_connections", JSON.stringify(connections));
        localStorage.setItem("transaction_filters", JSON.stringify(filters));
        localStorage.setItem("settings_auto_refresh", String(autoRefresh));
        localStorage.setItem("settings_dust_threshold", String(dustThreshold));
        localStorage.setItem("settings_hide_spam", String(hideSpam));

        // Demo mode has its own toggle handler, but sync it here just in case
        localStorage.setItem("demo_mode", String(isDemoMode));

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        // Dispatch custom event to notify app of setting changes (if needed by other components)
        window.dispatchEvent(new Event('settings-changed'));
    };

    const toggleDemoMode = () => {
        const newValue = !isDemoMode;
        setIsDemoMode(newValue);
        localStorage.setItem("demo_mode", String(newValue));
        window.location.reload();
    };

    // --- CONNECTION HANDLERS ---
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
            enabled: true
        };
        const updatedConnections = [...connections, conn];
        setConnections(updatedConnections);
        // Auto-save connections immediately for better UX
        localStorage.setItem("portfolio_connections", JSON.stringify(updatedConnections));
        setIsAdding(false);
        setNewConnection({ type: 'binance', name: '' });
    };

    const toggleConnection = (id: string) => {
        const updatedConnections = connections.map(conn =>
            conn.id === id ? { ...conn, enabled: !conn.enabled } : conn
        );
        setConnections(updatedConnections);
        localStorage.setItem("portfolio_connections", JSON.stringify(updatedConnections));
    };

    const removeConnection = (id: string) => {
        const updatedConnections = connections.filter(c => c.id !== id);
        setConnections(updatedConnections);
        localStorage.setItem("portfolio_connections", JSON.stringify(updatedConnections));
    };

    // --- FILTER HANDLERS ---
    const toggleTransactionType = (type: string) => {
        setFilters(prev => ({
            ...prev,
            transactionTypes: prev.transactionTypes.includes(type)
                ? prev.transactionTypes.filter(t => t !== type)
                : [...prev.transactionTypes, type]
        }));
    };

    return (
        <div className="flex flex-col gap-6 pb-24 md:pb-12 max-w-5xl mx-auto w-full">
            <div className="flex flex-col gap-1 px-1">
                <h1 className="text-3xl font-serif font-bold tracking-tight text-white mb-1">Settings</h1>
                <p className="text-sm text-muted-foreground">Manage your <span className="italic font-serif text-zinc-400">connections</span>, preferences, and system configuration.</p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6 bg-zinc-900/50 p-1 h-auto">
                    <TabsTrigger value="general" className="data-[state=active]:bg-zinc-800 text-xs sm:text-sm py-2">General</TabsTrigger>
                    <TabsTrigger value="connections" className="data-[state=active]:bg-zinc-800 text-xs sm:text-sm py-2">Connections</TabsTrigger>
                    <TabsTrigger value="preferences" className="data-[state=active]:bg-zinc-800 text-xs sm:text-sm py-2">Preferences</TabsTrigger>
                    <TabsTrigger value="debug" className="data-[state=active]:bg-zinc-800 text-xs sm:text-sm py-2 text-zinc-500">Debug</TabsTrigger>
                </TabsList>

                {/* --- GENERAL TAB --- */}
                <TabsContent value="general" className="space-y-4">
                    <Card className="bg-zinc-950/50 backdrop-blur-xl border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <LayoutGrid className="h-4 w-4 text-zinc-400" />
                                System Mode
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">Demo Mode</h3>
                                        <p className="text-xs text-muted-foreground">Toggle between real data and simulated demo data.</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={cn("text-[10px] font-bold tracking-wider", isDemoMode ? "text-blue-500" : "text-zinc-500")}>
                                        {isDemoMode ? "ACTIVE" : "INACTIVE"}
                                    </span>
                                    <button
                                        onClick={toggleDemoMode}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            isDemoMode ? "bg-blue-500" : "bg-zinc-700"
                                        )}
                                    >
                                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", isDemoMode ? "translate-x-6" : "translate-x-1")} />
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/50 backdrop-blur-xl border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <MonitorCogIcon className="h-4 w-4 text-zinc-400" />
                                Interface Theme
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-zinc-200">Appearance</label>
                                    <p className="text-xs text-muted-foreground">Customize the look and feel of the dashboard.</p>
                                </div>
                                <ToggleTheme />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/50 backdrop-blur-xl border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <RefreshCw className="h-4 w-4 text-zinc-400" />
                                Data Refresh
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-zinc-200">Auto-Refresh</label>
                                    <p className="text-xs text-muted-foreground">Automatically poll for new data every 30 seconds.</p>
                                </div>
                                <button
                                    onClick={() => setAutoRefresh(!autoRefresh)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        autoRefresh ? "bg-emerald-500" : "bg-zinc-700"
                                    )}
                                >
                                    <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", autoRefresh ? "translate-x-5" : "translate-x-1")} />
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- CONNECTIONS TAB --- */}
                <TabsContent value="connections" className="space-y-4">
                    <div className="grid gap-4">
                        {/* ... existing code ... */}

                        {connections.map(conn => {
                            const status = connectionStatus[conn.id];
                            const isEnabled = conn.enabled !== false;
                            return (
                                <div key={conn.id} className="relative rounded-xl">
                                    <GlowingEffect
                                        spread={40}
                                        glow={true}
                                        disabled={false}
                                        proximity={64}
                                        inactiveZone={0.01}
                                        borderWidth={2}
                                    />
                                    <Card className={cn(
                                        "relative bg-zinc-950/80 backdrop-blur-sm border-white/5 transition-all hover:bg-zinc-900/50",
                                        !isEnabled && "opacity-60 grayscale"
                                    )}>
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                                {/* Connection Info */}
                                                <div className="flex items-center gap-4">
                                                    <CryptoIcon type={conn.type} id={conn.chain || conn.type} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-white text-sm">{conn.name}</h3>
                                                            {isEnabled && (
                                                                <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold tracking-wider">LIVE</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                                                            {conn.type} {conn.chain ? `• ${conn.chain}` : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Controls & Status */}
                                                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        {isEnabled && status && (
                                                            <div className="text-[10px] text-zinc-500 font-mono hidden sm:block">
                                                                {status.latency ? `${status.latency}ms` : 'Syncing...'}
                                                            </div>
                                                        )}
                                                        <div className="text-right text-[10px] text-zinc-500 font-mono">
                                                            {conn.apiKey ? `API: ...${conn.apiKey.slice(-4)}` : `${conn.walletAddress?.slice(0, 4)}...${conn.walletAddress?.slice(-4)}`}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 pl-2 border-l border-white/5">
                                                        <button
                                                            onClick={() => toggleConnection(conn.id)}
                                                            className={cn(
                                                                "p-2 rounded-lg transition-colors relative z-10",
                                                                isEnabled ? "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-zinc-500 bg-zinc-800 hover:bg-zinc-700"
                                                            )}
                                                            title={isEnabled ? "Disable" : "Enable"}
                                                        >
                                                            <Power className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => removeConnection(conn.id)}
                                                            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors relative z-10"
                                                            title="Remove Connection"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}

                        {!isAdding ? (
                            <button
                                onClick={() => setIsAdding(true)}
                                className="w-full py-8 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all group"
                            >
                                <div className="h-10 w-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <span className="font-bold text-sm">Add New Connection</span>
                            </button>
                        ) : (
                            <Card className="bg-zinc-950 border-primary/50 ring-1 ring-primary/20 animate-in fade-in slide-in-from-bottom-2">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">Add Connection</CardTitle>
                                        <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-white"><XCircle className="h-5 w-5" /></button>
                                    </div>
                                    <CardDescription className="text-xs">Connect a new exchange API or wallet address.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                                            <select
                                                className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white text-sm focus:border-primary/50 outline-none"
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
                                                className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white text-sm focus:border-primary/50 outline-none"
                                                value={newConnection.name}
                                                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {newConnection.type === 'wallet' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase text-muted-foreground">Chain</label>
                                            <select
                                                className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white text-sm focus:border-primary/50 outline-none"
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
                                                <option value="SUI">Sui (SUI)</option>
                                                <option value="APT">Aptos (APT)</option>
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
                                                    className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white font-mono text-sm focus:border-primary/50 outline-none"
                                                    value={newConnection.apiKey || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-muted-foreground">API Secret</label>
                                                <input
                                                    type="password"
                                                    className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white font-mono text-sm focus:border-primary/50 outline-none"
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
                                                className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white font-mono text-sm focus:border-primary/50 outline-none"
                                                value={newConnection.walletAddress || ''}
                                                onChange={(e) => setNewConnection({ ...newConnection, walletAddress: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 pt-4 border-t border-white/5 mt-4">
                                        <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                        <button onClick={addConnection} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-primary/20">Add Connection</button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                {/* --- PREFERENCES TAB (ADVANCED) --- */}
                <TabsContent value="preferences" className="space-y-6">
                    {/* Visual Preferences */}
                    <Card className="bg-zinc-950/50 backdrop-blur-xl border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Search className="h-4 w-4 text-zinc-400" />
                                Display Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Dust Threshold */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-zinc-500">Dust Threshold ($)</label>
                                <div className="flex gap-4 items-center">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="bg-black/40 border border-white/10 rounded p-3 text-white text-sm w-32 focus:border-primary/50 outline-none"
                                        value={dustThreshold}
                                        onChange={(e) => setDustThreshold(parseFloat(e.target.value) || 0)}
                                    />
                                    <p className="text-xs text-muted-foreground">Balances below this value will be hidden from Spot/Overview.</p>
                                </div>
                            </div>

                            {/* Hide Spam */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-zinc-200">Hide Spam Assets</label>
                                    <p className="text-xs text-muted-foreground">Automatically filter out known spam tokens and scam NFTs.</p>
                                </div>
                                <button
                                    onClick={() => setHideSpam(!hideSpam)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        hideSpam ? "bg-emerald-500" : "bg-zinc-700"
                                    )}
                                >
                                    <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", hideSpam ? "translate-x-5" : "translate-x-1")} />
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Transaction Filters */}
                    <Card className="bg-zinc-950/50 backdrop-blur-xl border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Filter className="h-4 w-4 text-zinc-400" />
                                Transaction Filter Defaults
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-zinc-500">Visible Types</label>
                                <div className="flex flex-wrap gap-2">
                                    {['buy', 'sell', 'transfer'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => toggleTransactionType(type)}
                                            className={cn(
                                                "px-4 py-2 rounded-lg border text-xs font-bold uppercase transition-all",
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase text-zinc-500">Min Transaction ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                                        value={filters.minAmount}
                                        onChange={(e) => setFilters({ ...filters, minAmount: parseFloat(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase text-zinc-500">Default Date Range</label>
                                    <select
                                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                                        value={filters.dateRange}
                                        onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                                    >
                                        <option value="all">All Time</option>
                                        <option value="7d">Last 7 Days</option>
                                        <option value="30d">Last 30 Days</option>
                                        <option value="90d">Last 90 Days</option>
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- DEBUG TAB --- */}
                <TabsContent value="debug" className="space-y-4">
                    <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Server className="h-4 w-4 text-zinc-400" />
                                Network Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {connections.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500 text-sm">
                                    No connections configured.
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
                                            "flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5",
                                            isDisabled && "opacity-50"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-1.5 w-1.5 rounded-full",
                                                    isDisabled ? "bg-zinc-600" :
                                                        isConnected ? "bg-emerald-500" :
                                                            isChecking ? "bg-yellow-500" : "bg-red-500"
                                                )} />
                                                <span className="text-sm font-bold text-zinc-300">{conn.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {isEnabled && <LatencyMeter latency={status?.latency} />}
                                                <div className={cn(
                                                    "text-[10px] uppercase font-bold tracking-wider",
                                                    isDisabled ? "text-zinc-500" :
                                                        isConnected ? "text-emerald-500" :
                                                            isChecking ? "text-yellow-500" : "text-red-500"
                                                )}>
                                                    {isDisabled ? 'Disabled' : isConnected ? 'Connected' : isChecking ? 'Connecting' : 'Error'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* FLOATING SAVE ACTION */}
            <div className="fixed bottom-6 right-6 md:right-12 z-50">
                <button
                    onClick={handleSave}
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-4 px-8 rounded-full shadow-2xl hover:scale-105 transition-all"
                >
                    <Save className="h-5 w-5" /> {saved ? "Saved" : "Save Changes"}
                </button>
            </div>
        </div>
    );
}
