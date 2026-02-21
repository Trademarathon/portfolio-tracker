"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PulseIndicatorProps {
    color?: "emerald" | "rose" | "indigo" | "amber";
    className?: string;
}

export function PulseIndicator({ color = "emerald", className }: PulseIndicatorProps) {
    const colors = {
        emerald: { bg: "bg-emerald-500", ring: "bg-emerald-400" },
        rose: { bg: "bg-rose-500", ring: "bg-rose-400" },
        indigo: { bg: "bg-indigo-500", ring: "bg-indigo-400" },
        amber: { bg: "bg-amber-500", ring: "bg-amber-400" },
    };

    return (
        <span className={cn("relative flex h-2 w-2", className)}>
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", colors[color].ring)}></span>
            <span className={cn("relative inline-flex rounded-full h-2 w-2", colors[color].bg)}></span>
        </span>
    );
}
