import { WebSocketConnectionInfo } from "@/lib/api/websocket-types";
import { Activity, Wifi, WifiOff, ShieldCheck } from "lucide-react";
import { ComponentSettingsLink } from "@/components/ui/ComponentSettingsLink";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface ConnectionStatusProps {
    status: Map<string, WebSocketConnectionInfo>;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
    const connections = Array.from(status.values());
    const total = connections.length;

    // Default to a sane baseline if no active WS but we have connections
    if (total === 0) return null;

    const connected = connections.filter(c => c.status === 'connected').length;
    const errors = connections.filter(c => c.status === 'error').length;

    let state: 'good' | 'warning' | 'error' = 'good';
    if (errors > 0 || connected === 0) state = 'error';
    else if (connected < total) state = 'warning';

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative flex items-center group cursor-pointer"
                    >
                        {/* The "N" Logo style Circle from image */}
                        <div className="absolute -left-2 z-10 w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center shadow-2xl shadow-black ring-4 ring-[#0E0E11]">
                            <span className="text-white font-black text-sm tracking-tighter italic">N</span>
                            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${state === 'good' ? 'bg-emerald-500' : state === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                                }`} />
                        </div>

                        {/* Status Card */}
                        <div className="pl-10 pr-6 py-2 bg-[#1A1A1E]/80 backdrop-blur-xl border border-white/[0.03] rounded-2xl flex flex-col items-start min-w-[140px] shadow-2xl group-hover:border-primary/30 transition-all duration-300">
                            <div className="flex items-center justify-between w-full gap-2">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#F9A825] mb-0.5">System Status</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold text-zinc-100">{connected}/{total} Connected</span>
                                        {state === 'good' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                    </div>
                                </div>
                                <ComponentSettingsLink tab="connections" size="xs" title="Connection settings" className="p-1.5 shrink-0" />
                            </div>
                        </div>
                    </motion.div>
                </TooltipTrigger>
                <TooltipContent className="bg-black/90 border-white/10 backdrop-blur-xl p-4 min-w-[200px] z-[100]">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Node Status</span>
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="space-y-2">
                            {connections.map(conn => (
                                <div key={conn.id} className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-300 font-medium">{conn.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-mono ${conn.status === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                                            }`}>
                                            {conn.status === 'connected' ? 'LIVE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
