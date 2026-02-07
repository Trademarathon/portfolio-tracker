import { Badge } from "@/components/ui/badge";
import { WebSocketConnectionInfo } from "@/lib/api/websocket-types";
import { Activity, Wifi, WifiOff, AlertCircle } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionStatusProps {
    status: Map<string, WebSocketConnectionInfo>;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
    const connections = Array.from(status.values());
    const total = connections.length;

    if (total === 0) return null;

    const connected = connections.filter(c => c.status === 'connected').length;
    const errors = connections.filter(c => c.status === 'error').length;

    let state: 'good' | 'warning' | 'error' = 'good';
    if (errors > 0) state = 'error';
    else if (connected < total) state = 'warning';

    // Calculate average latency
    const validLatencies = connections.filter(c => c.latency !== undefined).map(c => c.latency!);
    const avgLatency = validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : 0;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <Badge variant="outline" className={`
                        flex items-center gap-2 px-3 py-1 bg-zinc-900 border-opacity-50
                        ${state === 'good' ? 'border-emerald-500/50 text-emerald-500' : ''}
                        ${state === 'warning' ? 'border-amber-500/50 text-amber-500' : ''}
                        ${state === 'error' ? 'border-red-500/50 text-red-500' : ''}
                    `}>
                        {state === 'good' ? <Wifi className="h-3 w-3" /> :
                            state === 'error' ? <WifiOff className="h-3 w-3" /> :
                                <Activity className="h-3 w-3 animate-pulse" />}

                        <span className="text-xs font-medium">
                            {state === 'good' ? 'Live' : state === 'error' ? 'Error' : 'Connecting'}
                        </span>

                        {avgLatency > 0 && (
                            <span className="ml-1 text-[10px] opacity-70">
                                {avgLatency}ms
                            </span>
                        )}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-900 border-zinc-800 p-3">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-zinc-400 mb-2">Connection Status</p>
                        {connections.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-zinc-300">{conn.name}</span>
                                <div className="flex items-center gap-2">
                                    {conn.latency && <span className="text-zinc-500">{conn.latency}ms</span>}
                                    <span className={`
                                        ${conn.status === 'connected' ? 'text-emerald-500' : ''}
                                        ${conn.status === 'error' ? 'text-red-500' : ''}
                                        ${conn.status === 'connecting' || conn.status === 'reconnecting' ? 'text-amber-500' : ''}
                                    `}>
                                        {conn.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
