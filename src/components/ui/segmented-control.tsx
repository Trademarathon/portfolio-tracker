"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SegmentedControlProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function SegmentedControl({
    options,
    value,
    onChange,
    className
}: SegmentedControlProps) {
    return (
        <div className={cn("flex p-1 bg-zinc-900/50 rounded-full border border-white/5 relative", className)}>
            {options.map((option) => {
                const isActive = value === option;
                return (
                    <button
                        key={option}
                        onClick={() => onChange(option)}
                        className={cn(
                            "relative flex-1 px-4 py-1.5 text-xs font-bold transition-colors z-10",
                            isActive ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="segmented-control-active"
                                className="absolute inset-0 bg-white rounded-full -z-10"
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30
                                }}
                            />
                        )}
                        {option}
                    </button>
                );
            })}
        </div>
    );
}
