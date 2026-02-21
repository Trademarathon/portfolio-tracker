"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { LayoutGrid, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeneralTabProps {
    isDemoMode: boolean;
    toggleDemoMode: () => void;
    autoRefresh: boolean;
    setAutoRefresh: (v: boolean) => void;
}

export function GeneralTab({ isDemoMode, toggleDemoMode, autoRefresh, setAutoRefresh }: GeneralTabProps) {
    return (
        <>
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

            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        Integrations
                    </CardTitle>
                    <CardDescription>
                        X, Discord, Telegram and AI provider credentials are now managed in the Security tab for a single integration workflow.
                    </CardDescription>
                </CardHeader>
            </Card>
        </>
    );
}
