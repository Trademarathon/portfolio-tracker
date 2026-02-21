"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface IconToggleOption<T extends string> {
    value: T;
    icon: LucideIcon;
    label?: string;
}

interface IconToggleProps<T extends string> {
    options: IconToggleOption<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
    size?: "sm" | "md" | "lg";
}

export function IconToggle<T extends string>({
    options,
    value,
    onChange,
    className,
    size = "md"
}: IconToggleProps<T>) {

    const sizeClasses = {
        sm: "h-8 p-0.5",
        md: "h-10 p-1",
        lg: "h-12 p-1.5"
    };

    const iconSizes = {
        sm: "h-3.5 w-3.5",
        md: "h-4 w-4",
        lg: "h-5 w-5"
    };

    return (
        <div className={cn(
            "flex items-center bg-muted/80 border border-border rounded-full relative",
            sizeClasses[size],
            className
        )}>
            {options.map((option) => {
                const isActive = value === option.value;
                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "relative flex-1 h-full flex items-center justify-center rounded-full transition-colors z-10",
                            isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label={option.label || option.value}
                        title={option.label || option.value}
                    >
                        {isActive && (
                            <motion.div
                                layoutId={`icon-toggle-active-${className}`}
                                className="absolute inset-0 bg-primary rounded-full -z-10"
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30
                                }}
                            />
                        )}
                        <option.icon className={iconSizes[size]} />
                    </button>
                );
            })}
        </div>
    );
}
