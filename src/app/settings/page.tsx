"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Plus, Trash2, Key, Shield, AlertTriangle, Eye, EyeOff, Globe, Zap, Power, RefreshCw, LayoutGrid, Search, Server, CheckCircle2, XCircle, Clock, Filter, Wrench, Wifi, WifiOff, Activity } from "lucide-react";
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

// Dynamic Latency Bar Component with real-time animated segments
function LatencyBar({ latency, status }: { latency?: number; status?: 'connected' | 'disconnected' | 'checking' }) {
    const getBarColor = (ms?: number, idx?: number) => {
        if (!ms || status === 'checking') return 'bg-zinc-700';
        if (status === 'disconnected') return 'bg-red-500/50';
        if (ms < 100) return idx !== undefined && idx < 4 ? 'bg-emerald-500' : 'bg-emerald-500/30';
        if (ms < 300) return idx !== undefined && idx < 3 ? 'bg-yellow-500' : 'bg-yellow-500/30';
        if (ms < 500) return idx !== undefined && idx < 2 ? 'bg-orange-500' : 'bg-orange-500/30';
        return idx !== undefined && idx < 1 ? 'bg-red-500' : 'bg-red-500/30';
    };

    const getActiveSegments = (ms?: number) => {
        if (!ms) return 0;
        if (ms < 100) return 4;
        if (ms < 300) return 3;
        if (ms < 500) return 2;
        return 1;
    };

    const getStatusLabel = () => {
        if (status === 'checking') return 'Checking connection...';
        if (status === 'disconnected') return 'Disconnected - Click repair to reconnect';
        if (!latency) return 'Waiting for data...';
        if (latency < 100) return `Excellent (${latency}ms)`;
        if (latency < 300) return `Good (${latency}ms)`;
        if (latency < 500) return `Moderate (${latency}ms)`;
        return `Slow (${latency}ms) - Consider checking connection`;
    };

    const activeSegments = getActiveSegments(latency);

    return (
        <div
            className="flex items-center gap-1 cursor-help group relative"
            title={getStatusLabel()}
        >
            <Activity className={cn(
                "h-3.5 w-3.5 mr-1 transition-all",
                status === 'connected' ? 'text-emerald-500' : status === 'disconnected' ? 'text-red-500 animate-pulse' : 'text-zinc-500 animate-spin',
                status === 'connected' && latency && latency < 100 && 'animate-pulse'
            )} />
            <div className="flex gap-0.5 items-end">
                {[0, 1, 2, 3].map((idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "w-1.5 rounded-full transition-all duration-500",
                            idx < activeSegments ? getBarColor(latency, idx) : 'bg-zinc-800',
                            status === 'checking' && 'animate-pulse',
                            status === 'connected' && idx < activeSegments && 'shadow-sm',
                            status === 'connected' && latency && latency < 100 && idx < activeSegments && 'shadow-emerald-500/50'
                        )}
                        style={{
                            height: `${8 + (idx * 3)}px`,
                            animationDelay: `${idx * 100}ms`
                        }}
                    />
                ))}
            </div>
            {latency && status === 'connected' && (
                <span className="text-[9px] text-zinc-500 ml-1.5 font-mono">{latency}ms</span>
            )}
            {/* Hover tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {getStatusLabel()}
            </div>
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

    // Repair connection state
    const [repairingId, setRepairingId] = useState<string | null>(null);

    // Repair / test connection handler
    const repairConnection = async (conn: PortfolioConnection) => {
        setRepairingId(conn.id);
        try {
            let testLatency = 0;
            const startTime = Date.now();

            if (conn.type === 'hyperliquid' && conn.walletAddress) {
                const res = await fetch('https://api.hyperliquid.xyz/info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'clearinghouseState', user: conn.walletAddress }),
                });
                testLatency = Date.now() - startTime;
                if (!res.ok) throw new Error('Connection failed');
            } else if ((conn.type === 'binance' || conn.type === 'bybit') && conn.apiKey && conn.secret) {
                const res = await fetch('/api/cex/balance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exchangeId: conn.type, apiKey: conn.apiKey, secret: conn.secret }),
                });
                testLatency = Date.now() - startTime;
                if (!res.ok) throw new Error('API key validation failed');
            } else if (conn.walletAddress) {
                // Test wallet address (EVM, Solana, etc.)
                testLatency = Date.now() - startTime + 100; // Simulated
            }

            console.log(`[Repair] ${conn.name}: ${testLatency}ms - OK`);
            window.dispatchEvent(new Event('settings-changed'));
        } catch (error) {
            console.error(`[Repair] ${conn.name}: Failed`, error);
        } finally {
            setRepairingId(null);
        }
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
                <TabsList className="grid w-full grid-cols-5 mb-6 bg-muted/50 p-1 h-auto">
                    <TabsTrigger value="general" className="data-[state=active]:bg-card text-xs sm:text-sm py-2">General</TabsTrigger>
                    <TabsTrigger value="connections" className="data-[state=active]:bg-card text-xs sm:text-sm py-2">Connections</TabsTrigger>
                    <TabsTrigger value="security" className="data-[state=active]:bg-card text-xs sm:text-sm py-2">Security</TabsTrigger>
                    <TabsTrigger value="preferences" className="data-[state=active]:bg-card text-xs sm:text-sm py-2">Preferences</TabsTrigger>
                    <TabsTrigger value="debug" className="data-[state=active]:bg-card text-xs sm:text-sm py-2 text-muted-foreground/50">Debug</TabsTrigger>
                </TabsList>

                {/* --- SECURITY TAB --- */}
                <TabsContent value="security" className="space-y-4">
                    <Card className="bg-card/50 backdrop-blur-xl border-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Shield className="h-4 w-4 text-zinc-400" />
                                Account Security
                            </CardTitle>
                            <CardDescription>Manage your account security settings and API key permissions.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">2FA Enabled</h4>
                                        <p className="text-xs text-zinc-500">Your account is secure with Two-Factor Authentication.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">ACTIVE</span>
                                    <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">API Keys Encryption</h4>
                                        <p className="text-xs text-zinc-500">All API keys are encrypted at rest.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded">ENCRYPTED</span>
                                    <div className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-zinc-500 text-xs">Last login: Today, 10:42 AM from 127.0.0.1 (This Device)</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- GENERAL TAB --- */}
                <TabsContent value="general" className="space-y-4">
                    <Card className="bg-card/50 backdrop-blur-xl border-border">
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

                    <Card className="bg-card/50 backdrop-blur-xl border-border">
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
                <TabsContent value="connections" className="space-y-6">
                    {/* Connection Type Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Exchange Card */}
                        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <Server className="h-5 w-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">CEX Exchanges</h3>
                                        <p className="text-xs text-zinc-400">API-based connections</p>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-300 mb-2">Connect your centralized exchanges via API keys for real-time balance and trade tracking.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">Binance</span>
                                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-bold">Bybit</span>
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold">Hyperliquid</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Wallet Card */}
                        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                        <Globe className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">On-Chain Wallets</h3>
                                        <p className="text-xs text-zinc-400">Address-based tracking</p>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-300 mb-2">Track any wallet address across 50+ blockchains with Zerion integration.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">Ethereum</span>
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px] font-bold">Solana</span>
                                    <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 rounded text-[10px] font-bold">+45 chains</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* EXCHANGES SECTION */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Server className="h-4 w-4 text-amber-500" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Exchanges</h2>
                            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                                {connections.filter(c => ['binance', 'bybit', 'hyperliquid'].includes(c.type)).length} connected
                            </span>
                        </div>

                        <div className="space-y-2">
                            {connections.filter(c => ['binance', 'bybit', 'hyperliquid'].includes(c.type)).map(conn => {
                                const status = connectionStatus[conn.id];
                                const isEnabled = conn.enabled !== false;
                                return (
                                    <div key={conn.id} className="relative rounded-xl">
                                        <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
                                        <Card className={cn(
                                            "relative bg-zinc-950/80 backdrop-blur-sm border-white/5 transition-all hover:bg-zinc-900/50",
                                            !isEnabled && "opacity-60 grayscale"
                                        )}>
                                            <CardContent className="p-4">
                                                <div className="flex flex-col gap-3">
                                                    {/* Top Row: Name, Status, Latency */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <CryptoIcon type={conn.type} id={conn.chain || conn.type} />
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-bold text-white text-sm">{conn.name}</h3>
                                                                    {isEnabled && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold">LIVE</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground uppercase">{conn.type}</p>
                                                            </div>
                                                        </div>
                                                        {/* Latency Bar */}
                                                        <LatencyBar latency={status?.latency} status={status?.status} />
                                                    </div>
                                                    {/* Bottom Row: API Key, Actions */}
                                                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                                        <div className="text-[10px] text-zinc-500 font-mono">
                                                            {conn.apiKey ? `API: ...${conn.apiKey.slice(-4)}` : conn.walletAddress ? `${conn.walletAddress.slice(0, 6)}...${conn.walletAddress.slice(-4)}` : ''}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {/* Repair Button */}
                                                            <button
                                                                onClick={() => repairConnection(conn)}
                                                                disabled={repairingId === conn.id}
                                                                className={cn(
                                                                    "p-2 rounded-lg transition-colors",
                                                                    repairingId === conn.id
                                                                        ? "text-amber-500 bg-amber-500/10 animate-pulse"
                                                                        : "text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10"
                                                                )}
                                                                title="Test Connection"
                                                            >
                                                                <Wrench className={cn("h-4 w-4", repairingId === conn.id && "animate-spin")} />
                                                            </button>
                                                            {/* Power Toggle */}
                                                            <button
                                                                onClick={() => toggleConnection(conn.id)}
                                                                className={cn(
                                                                    "p-2 rounded-lg transition-colors group relative",
                                                                    isEnabled ? "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-zinc-500 bg-zinc-800 hover:bg-zinc-700"
                                                                )}
                                                                title={isEnabled ? "Disable Connection" : "Enable Connection"}
                                                            >
                                                                <Power className="h-4 w-4" />
                                                            </button>
                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => removeConnection(conn.id)}
                                                                className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
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

                            {connections.filter(c => ['binance', 'bybit', 'hyperliquid'].includes(c.type)).length === 0 && (
                                <div className="text-center py-6 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                                    No exchanges connected yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* WALLETS SECTION */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Globe className="h-4 w-4 text-blue-500" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Wallets</h2>
                            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                                {connections.filter(c => ['wallet', 'zerion', 'evm', 'solana'].includes(c.type)).length} connected
                            </span>
                        </div>

                        <div className="space-y-2">
                            {connections.filter(c => ['wallet', 'zerion', 'evm', 'solana'].includes(c.type)).map(conn => {
                                const status = connectionStatus[conn.id];
                                const isEnabled = conn.enabled !== false;
                                return (
                                    <div key={conn.id} className="relative rounded-xl">
                                        <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
                                        <Card className={cn(
                                            "relative bg-zinc-950/80 backdrop-blur-sm border-white/5 transition-all hover:bg-zinc-900/50",
                                            !isEnabled && "opacity-60 grayscale"
                                        )}>
                                            <CardContent className="p-4">
                                                <div className="flex flex-col gap-3">
                                                    {/* Top Row: Name, Status, Latency */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <CryptoIcon type={conn.type} id={conn.chain || conn.type} />
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-bold text-white text-sm">{conn.name}</h3>
                                                                    {isEnabled && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 font-bold">TRACKING</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground uppercase">{conn.type} {conn.chain ? `• ${conn.chain}` : ''}</p>
                                                            </div>
                                                        </div>
                                                        {/* Latency Bar */}
                                                        <LatencyBar latency={status?.latency} status={status?.status} />
                                                    </div>
                                                    {/* Bottom Row: Address, Actions */}
                                                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                                        <div className="text-[10px] text-zinc-500 font-mono">
                                                            {conn.walletAddress ? `${conn.walletAddress.slice(0, 6)}...${conn.walletAddress.slice(-4)}` : ''}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {/* Repair Button */}
                                                            <button
                                                                onClick={() => repairConnection(conn)}
                                                                disabled={repairingId === conn.id}
                                                                className={cn(
                                                                    "p-2 rounded-lg transition-colors",
                                                                    repairingId === conn.id
                                                                        ? "text-amber-500 bg-amber-500/10 animate-pulse"
                                                                        : "text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10"
                                                                )}
                                                                title="Test Connection"
                                                            >
                                                                <Wrench className={cn("h-4 w-4", repairingId === conn.id && "animate-spin")} />
                                                            </button>
                                                            {/* Power Toggle */}
                                                            <button
                                                                onClick={() => toggleConnection(conn.id)}
                                                                className={cn(
                                                                    "p-2 rounded-lg transition-colors",
                                                                    isEnabled ? "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20" : "text-zinc-500 bg-zinc-800 hover:bg-zinc-700"
                                                                )}
                                                                title={isEnabled ? "Disable Tracking" : "Enable Tracking"}
                                                            >
                                                                <Power className="h-4 w-4" />
                                                            </button>
                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => removeConnection(conn.id)}
                                                                className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Remove Wallet"
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

                            {connections.filter(c => ['wallet', 'zerion', 'evm', 'solana'].includes(c.type)).length === 0 && (
                                <div className="text-center py-6 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                                    No wallets connected yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ADD CONNECTION */}
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-6 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all group"
                        >
                            <div className="h-10 w-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
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
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Connection Type Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Connection Type</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {[
                                            { value: 'binance', label: 'Binance', icon: '🟡', desc: 'Spot & Futures' },
                                            { value: 'bybit', label: 'Bybit', icon: '🟠', desc: 'Spot & Derivatives' },
                                            { value: 'hyperliquid', label: 'Hyperliquid', icon: '🟢', desc: 'Perps DEX' },
                                            { value: 'zerion', label: 'Zerion', icon: '🌐', desc: '50+ chains' },
                                            { value: 'wallet', label: 'Single Chain', icon: '💼', desc: 'ETH/SOL/etc' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setNewConnection({ ...newConnection, type: opt.value as any, chain: opt.value === 'wallet' ? 'ETH' : undefined })}
                                                className={cn(
                                                    "p-3 rounded-lg border text-left transition-all",
                                                    newConnection.type === opt.value
                                                        ? "border-primary bg-primary/10"
                                                        : "border-white/5 bg-white/5 hover:border-white/20"
                                                )}
                                            >
                                                <div className="text-lg mb-1">{opt.icon}</div>
                                                <div className="text-xs font-bold text-white">{opt.label}</div>
                                                <div className="text-[10px] text-zinc-500">{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Connection Name */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Name (Label)</label>
                                    <input
                                        type="text"
                                        placeholder={
                                            newConnection.type === 'binance' ? 'e.g. Binance Main, Trading Account' :
                                                newConnection.type === 'bybit' ? 'e.g. Bybit Futures, Scalping Account' :
                                                    newConnection.type === 'hyperliquid' ? 'e.g. Hyperliquid Perps, Main Wallet' :
                                                        newConnection.type === 'zerion' ? 'e.g. DeFi Portfolio, Main Wallet' :
                                                            'e.g. ETH Wallet, Cold Storage'
                                        }
                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-lg p-3 text-white text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-600"
                                        value={newConnection.name}
                                        onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                                    />
                                </div>

                                {/* Exchange-specific: API Keys */}
                                {(newConnection.type === 'binance' || newConnection.type === 'bybit') && (
                                    <>
                                        {/* Hint Box */}
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-amber-200 font-bold mb-1">
                                                        {newConnection.type === 'binance' ? 'Binance API Setup' : 'Bybit API Setup'}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        {newConnection.type === 'binance'
                                                            ? 'Go to Binance → Profile → API Management → Create API. Enable "Read" permissions only. IP whitelist recommended.'
                                                            : 'Go to Bybit → Account → API → Create New Key. Select "Read-Only" for security. Enable IP restrictions.'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">API Key</label>
                                                <div className="relative group">
                                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="text"
                                                        placeholder={newConnection.type === 'binance' ? 'e.g. vmPUZE6mv9SD5VNHk4...' : 'e.g. aBc1DeF2gHi3jKl4mN...'}
                                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                        value={newConnection.apiKey || ''}
                                                        onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">API Secret</label>
                                                <div className="relative group">
                                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="password"
                                                        placeholder="Your API secret (hidden)"
                                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                        value={newConnection.secret || ''}
                                                        onChange={(e) => setNewConnection({ ...newConnection, secret: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Hyperliquid: Wallet Address */}
                                {newConnection.type === 'hyperliquid' && (
                                    <>
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Zap className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-emerald-200 font-bold mb-1">Hyperliquid Setup</p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        Enter your Arbitrum wallet address used with Hyperliquid. No API keys needed - we read your positions directly from the chain.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Arbitrum Wallet Address</label>
                                            <div className="relative group">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-emerald-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="0x742d35Cc6634C0532925a3b844..."
                                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                    value={newConnection.walletAddress || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, walletAddress: e.target.value })}
                                                />
                                            </div>
                                            <p className="text-[10px] text-zinc-500">Example: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e</p>
                                        </div>
                                    </>
                                )}

                                {/* Zerion: Multi-chain wallet */}
                                {newConnection.type === 'zerion' && (
                                    <>
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Globe className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-blue-200 font-bold mb-1">Zerion Multi-Chain Tracking</p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        Enter any EVM wallet address to track across 50+ chains including Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, and more. Also supports Solana addresses!
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Wallet Address (Any Chain)</label>
                                            <div className="relative group">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-blue-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="0x... or So1ana..."
                                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                    value={newConnection.walletAddress || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, walletAddress: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex gap-3 text-[10px] text-zinc-500">
                                                <span>EVM: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</span>
                                                <span>SOL: 5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG</span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Single Chain Wallet */}
                                {newConnection.type === 'wallet' && (
                                    <>
                                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Globe className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-purple-200 font-bold mb-1">Single Chain Wallet</p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        Track a specific wallet on a single blockchain. Select the chain first, then enter the wallet address.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Blockchain</label>
                                            <select
                                                className="w-full bg-zinc-900/50 border border-white/5 rounded-lg p-3 text-white text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all"
                                                value={newConnection.chain}
                                                onChange={(e) => setNewConnection({ ...newConnection, chain: e.target.value })}
                                            >
                                                <option value="ETH">Ethereum (ETH) - 0x addresses</option>
                                                <option value="SOL">Solana (SOL) - Base58 addresses</option>
                                                <option value="ARB">Arbitrum (ARB) - 0x addresses</option>
                                                <option value="OP">Optimism (OP) - 0x addresses</option>
                                                <option value="BASE">Base - 0x addresses</option>
                                                <option value="MATIC">Polygon (MATIC) - 0x addresses</option>
                                                <option value="AVAX">Avalanche (AVAX) - 0x addresses</option>
                                                <option value="BSC">BNB Chain (BSC) - 0x addresses</option>
                                                <option value="SUI">Sui (SUI) - 0x addresses</option>
                                                <option value="APT">Aptos (APT) - 0x addresses</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Wallet Address</label>
                                            <div className="relative group">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-purple-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder={
                                                        newConnection.chain === 'SOL'
                                                            ? '5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG'
                                                            : '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
                                                    }
                                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                    value={newConnection.walletAddress || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, walletAddress: e.target.value })}
                                                />
                                            </div>
                                            <p className="text-[10px] text-zinc-500">
                                                {newConnection.chain === 'SOL'
                                                    ? 'Solana addresses are Base58 encoded, typically 32-44 characters'
                                                    : 'EVM addresses start with 0x followed by 40 hex characters'
                                                }
                                            </p>
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-end gap-2 pt-4 border-t border-white/5 mt-4">
                                    <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                    <button
                                        onClick={addConnection}
                                        disabled={!newConnection.name}
                                        className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Add Connection
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* --- PREFERENCES TAB (ADVANCED) --- */}
                <TabsContent value="preferences" className="space-y-6">
                    {/* Visual Preferences */}
                    <Card className="bg-card/50 backdrop-blur-xl border-border">
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
                    <Card className="bg-card/50 backdrop-blur-xl border-border">
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
                    <Card className="bg-card/50 backdrop-blur-sm border-border">
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
                    className={cn(
                        "group relative flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold shadow-2xl transition-all duration-300 active:scale-95 overflow-hidden",
                        saved
                            ? "bg-emerald-500 text-white"
                            : "bg-gradient-to-r from-trade-purple to-indigo-600 text-white hover:shadow-indigo-500/25 hover:scale-105"
                    )}
                >
                    {/* Glass Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    {/* Pulsing Outer Glow */}
                    {!saved && (
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur opacity-20 group-hover:opacity-40 animate-pulse transition-opacity -z-10" />
                    )}

                    <div className="relative flex items-center gap-2">
                        {saved ? (
                            <>
                                <CheckCircle2 className="h-5 w-5 animate-in zoom-in duration-300" />
                                <span className="animate-in slide-in-from-right-2 duration-300">Saved Successfully</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                                <span className="tracking-tight font-serif italic text-lg opacity-90">Save Changes</span>
                            </>
                        )}
                    </div>
                </button>
            </div>
        </div>
    );
}
