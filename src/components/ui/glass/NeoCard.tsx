"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface NeoCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    glowColor?: string; // e.g., "emerald", "indigo", "rose"
    hoverEffect?: boolean;
}

export function NeoCard({ children, className, glowColor = "indigo", hoverEffect = true, ...props }: NeoCardProps) {
    return (
        <motion.div
            whileHover={hoverEffect ? { y: -4, scale: 1.01 } : {}}
            className="group relative h-full rounded-xl"
            {...props as any}
        >
            {/* Glow - Apple-influence: soft, diffuse, no harsh edge */}
            <div className={cn(
                "absolute -inset-1 rounded-xl opacity-[0.18] group-hover:opacity-45 transition-all duration-700 ease-[cubic-bezier(0.33,1,0.68,1)] blur-xl",
                glowColor === "emerald" && "bg-gradient-to-r from-emerald-500/40 to-teal-400/30",
                glowColor === "indigo" && "bg-gradient-to-r from-indigo-500/40 to-purple-400/30",
                glowColor === "rose" && "bg-gradient-to-r from-rose-500/40 to-orange-400/30",
                glowColor === "orange" && "bg-gradient-to-r from-orange-500/40 to-amber-400/30",
                glowColor === "purple" && "bg-gradient-to-r from-purple-500/40 to-pink-400/30",
            )} />

            {/* Glass Content */}
            <div className={cn(
                "tm-premium-card relative h-full w-full rounded-xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-4",
                className
            )}>
                {children}
            </div>
        </motion.div>
    );
}
