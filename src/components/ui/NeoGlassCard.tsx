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
                "tm-premium-card relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/45 backdrop-blur-2xl transition-all duration-300",
                "shadow-[inner_0_0_26px_rgba(255,255,255,0.03)]",
                hoverEffect && "hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[inner_0_0_34px_rgba(255,255,255,0.06),0_16px_40px_rgba(56,189,248,0.14)]",
                className
            )}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/6 via-transparent to-transparent" />
            <div className="tm-orbital-glow pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />

            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
}
