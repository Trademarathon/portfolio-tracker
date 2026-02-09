"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    intensity?: "low" | "medium" | "high";
    border?: boolean;
}

export function GlassPanel({ children, className, intensity = "medium", border = true, ...props }: GlassPanelProps) {
    const intensityClasses = {
        low: "bg-zinc-900/40 backdrop-blur-sm",
        medium: "bg-zinc-900/60 backdrop-blur-md",
        high: "bg-zinc-900/80 backdrop-blur-xl",
    };

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-xl",
                intensityClasses[intensity],
                border && "border border-white/5",
                className
            )}
            {...props}
        >
            {/* Noise Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
