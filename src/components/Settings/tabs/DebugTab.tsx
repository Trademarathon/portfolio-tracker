"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { LatencyMeter } from "@/components/Settings/LatencyMeter";
import type { PortfolioConnection } from "@/lib/api/types";

export interface ConnectionStatusMap {
    [key: string]: { status: "connected" | "disconnected" | "checking"; lastSync?: Date; latency?: number };
}

interface DebugTabProps {
    connections: PortfolioConnection[];
    connectionStatus: ConnectionStatusMap;
}

export function DebugTab({ connections, connectionStatus }: DebugTabProps) {
    return (
        <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Server className="h-4 w-4 text-zinc-400" />
                    Network Status
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {connections.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">No connections configured.</div>
                ) : (
                    connections.map((conn) => {
                        const status = connectionStatus[conn.id];
                        const isEnabled = conn.enabled !== false;
                        const isConnected = isEnabled && status?.status === "connected";
                        const isChecking = isEnabled && status?.status === "checking";
                        const isDisabled = !isEnabled;

                        return (
                            <div
                                key={conn.id}
                                className={cn(
                                    "flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5",
                                    isDisabled && "opacity-50"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            isDisabled ? "bg-zinc-600" : isConnected ? "bg-emerald-500" : isChecking ? "bg-yellow-500" : "bg-red-500"
                                        )}
                                    />
                                    <span className="text-sm font-bold text-zinc-300">{conn.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {isEnabled && <LatencyMeter latency={status?.latency} />}
                                    <div
                                        className={cn(
                                            "text-[10px] uppercase font-bold tracking-wider",
                                            isDisabled ? "text-zinc-500" : isConnected ? "text-emerald-500" : isChecking ? "text-yellow-500" : "text-red-500"
                                        )}
                                    >
                                        {isDisabled ? "Disabled" : isConnected ? "Connected" : isChecking ? "Connecting" : "Error"}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
