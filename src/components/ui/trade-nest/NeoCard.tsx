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
            {/* Glow / Border Beam */}
            <div className={cn(
                "absolute -inset-0.5 rounded-xl opacity-20 group-hover:opacity-60 transition duration-500 blur-md",
                glowColor === "emerald" && "bg-gradient-to-r from-emerald-600 to-teal-400",
                glowColor === "indigo" && "bg-gradient-to-r from-indigo-600 to-purple-400",
                glowColor === "rose" && "bg-gradient-to-r from-rose-600 to-orange-400",
                glowColor === "orange" && "bg-gradient-to-r from-orange-600 to-amber-400",
                glowColor === "purple" && "bg-gradient-to-r from-purple-600 to-pink-400",
            )} />

            {/* Glass Content */}
            <div className={cn(
                "relative h-full w-full rounded-xl bg-zinc-950/80 backdrop-blur-xl border border-white/5 p-4",
                className
            )}>
                {children}
            </div>
        </motion.div>
    );
}
