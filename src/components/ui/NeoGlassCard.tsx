import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface NeoGlassCardProps {
    children: ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export function NeoGlassCard({ children, className, hoverEffect = false }: NeoGlassCardProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/40 backdrop-blur-2xl transition-all duration-300",
                "shadow-[inner_0_0_20px_rgba(255,255,255,0.03)]",
                hoverEffect && "hover:border-white/20 hover:shadow-[inner_0_0_30px_rgba(255,255,255,0.05),0_0_20px_rgba(168,85,247,0.15)]",
                className
            )}
        >
            {/* Subtle noise texture overlay if desired, or just glass */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
}
