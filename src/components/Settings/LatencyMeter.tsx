"use client";

import { memo, useState, useEffect } from "react";
import { Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export const LatencyMeter = memo(({ latency }: { latency?: number }) => {
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
});

LatencyMeter.displayName = "LatencyMeter";

export const LatencyBar = memo(({ latency, status }: { latency?: number; status?: "connected" | "disconnected" | "checking" }) => {
    const [animatedBars, setAnimatedBars] = useState([0, 0, 0, 0]);

    useEffect(() => {
        if (status === "checking") {
            let frame = 0;
            const interval = setInterval(() => {
                frame = (frame + 1) % 4;
                setAnimatedBars([0, 1, 2, 3].map((i) => (i === frame || i === (frame + 1) % 4 ? 1 : 0.3)));
            }, 150);
            return () => clearInterval(interval);
        } else {
            setAnimatedBars([1, 1, 1, 1]);
        }
    }, [status]);

    const getBarColor = (ms?: number, idx?: number) => {
        if (status === "checking") return "bg-cyan-500";
        if (!ms || status === "disconnected") return "bg-red-500/50";
        if (ms < 100) return idx !== undefined && idx < 4 ? "bg-emerald-500" : "bg-zinc-800";
        if (ms < 300) return idx !== undefined && idx < 3 ? "bg-yellow-500" : "bg-zinc-800";
        if (ms < 500) return idx !== undefined && idx < 2 ? "bg-orange-500" : "bg-zinc-800";
        return idx !== undefined && idx < 1 ? "bg-red-500" : "bg-zinc-800";
    };

    const getGlowColor = (ms?: number) => {
        if (status === "checking") return "shadow-cyan-500/50";
        if (!ms || status === "disconnected") return "shadow-red-500/50";
        if (ms < 100) return "shadow-emerald-500/50";
        if (ms < 300) return "shadow-yellow-500/50";
        if (ms < 500) return "shadow-orange-500/50";
        return "shadow-red-500/50";
    };

    const getActiveSegments = (ms?: number) => {
        if (status === "checking") return 4;
        if (!ms) return 0;
        if (ms < 100) return 4;
        if (ms < 300) return 3;
        if (ms < 500) return 2;
        return 1;
    };

    const getStatusLabel = () => {
        if (status === "checking") return "Checking connection...";
        if (status === "disconnected") return "Disconnected - Click repair to reconnect";
        if (!latency) return "Waiting for data...";
        if (latency < 100) return `Excellent (${latency}ms)`;
        if (latency < 300) return `Good (${latency}ms)`;
        if (latency < 500) return `Moderate (${latency}ms)`;
        return `Slow (${latency}ms) - Consider checking connection`;
    };

    const activeSegments = getActiveSegments(latency);

    return (
        <div className="flex items-center gap-1 cursor-help group relative" title={getStatusLabel()}>
            <Activity
                className={cn(
                    "h-3.5 w-3.5 mr-1 transition-all duration-300",
                    status === "connected" ? "text-emerald-500" : status === "disconnected" ? "text-red-500 animate-pulse" : "text-cyan-500 animate-spin",
                    status === "connected" && latency && latency < 100 && "drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                )}
            />
            <div className="flex gap-0.5 items-end">
                {[0, 1, 2, 3].map((idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "w-1.5 rounded-full transition-all duration-200",
                            idx < activeSegments ? getBarColor(latency, idx) : "bg-zinc-800",
                            status === "connected" && idx < activeSegments && `shadow-md ${getGlowColor(latency)}`
                        )}
                        style={{
                            height: `${8 + idx * 3}px`,
                            opacity: status === "checking" ? animatedBars[idx] : 1,
                            transform: status === "checking" ? `scaleY(${0.7 + animatedBars[idx] * 0.3})` : "scaleY(1)",
                            transition: "all 0.15s ease-out",
                        }}
                    />
                ))}
            </div>
            {latency && status === "connected" && (
                <span
                    className={cn(
                        "text-[9px] ml-1.5 font-mono font-bold transition-colors",
                        latency < 100 ? "text-emerald-400" : latency < 300 ? "text-yellow-400" : latency < 500 ? "text-orange-400" : "text-red-400"
                    )}
                >
                    {latency}ms
                </span>
            )}
            {status === "checking" && <span className="text-[9px] text-cyan-400 ml-1.5 font-mono animate-pulse">...</span>}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {getStatusLabel()}
            </div>
        </div>
    );
});

LatencyBar.displayName = "LatencyBar";
