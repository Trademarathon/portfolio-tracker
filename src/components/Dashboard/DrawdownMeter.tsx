"use client";

import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown } from "lucide-react";

interface DrawdownMeterProps {
    title: string;
    value: number; // Current percentage
    maxDrawdown: number; // All-time high DD
    peak: number;
    current: number;
    color?: string;
}

export function DrawdownMeter({ title, value, maxDrawdown, peak, current, color = "emerald" }: DrawdownMeterProps) {
    const isCritical = value > 15;
    const isWarning = value > 5;

    // Meter color logic
    const meterColor = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#10b981";
    const bgGlow = isCritical ? "rgba(239, 68, 68, 0.1)" : isWarning ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)";

    // Max DD marker calculation (0-360 degrees, but we use 0-100 for dasharray)
    // We'll show a small "notch" for the max DD reached
    const maxDDPerc = Math.min(maxDrawdown * 2, 100);

    return (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4">
            <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    {title}
                </span>
                <div className="flex gap-2 text-[8px] font-bold uppercase tracking-wider">
                    <span className="text-zinc-600">ATH DD: <span className="text-zinc-400">{maxDrawdown.toFixed(2)}%</span></span>
                </div>
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className="text-2xl font-black text-white flex items-baseline gap-1 leading-none">
                        {value.toFixed(2)}
                        <span className="text-sm font-medium text-zinc-500">%</span>
                    </div>

                    <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-mono">
                            <div className="w-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="w-full bg-emerald-500" style={{ height: '0%' }} /> {/* Min DD is usually 0 */}
                            </div>
                            <span>MIN DD: 0.00%</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-mono">
                            <div className="w-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${Math.min(maxDrawdown * 4, 100)}%` }}
                                    className="w-full bg-red-500/50"
                                />
                            </div>
                            <span>MAX DD: {maxDrawdown.toFixed(2)}%</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-zinc-400 font-mono bg-white/5 w-fit px-2 py-0.5 rounded border border-white/5">
                        <TrendingDown className="h-3 w-3 text-zinc-500" />
                        <span>PEAK: ${peak.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                </div>

                <div className="relative h-20 w-20">
                    <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
                        <path
                            className="stroke-zinc-800"
                            strokeWidth="2.5"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        {/* Current DD Path */}
                        <motion.path
                            initial={{ strokeDasharray: "0, 100" }}
                            animate={{ strokeDasharray: `${Math.min(value * 2, 100)}, 100` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            stroke={meterColor}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        {/* Max DD Marker (Notch) */}
                        <motion.path
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            stroke="#ef4444"
                            strokeWidth="3"
                            strokeDasharray="0.5, 99.5"
                            strokeDashoffset={-maxDDPerc}
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: meterColor, boxShadow: `0 0 10px ${meterColor}` }}
                        />
                    </div>
                </div>
            </div>

            {/* Background Glow */}
            <div
                className="absolute -right-4 -bottom-4 w-24 h-24 blur-[40px] rounded-full pointer-events-none"
                style={{ backgroundColor: bgGlow }}
            />
        </div>
    );
}
