"use client";

import { useState, memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { getTokenColor } from "@/lib/token-metadata";

interface TokenIconProps {
    symbol: string;
    className?: string;
    size?: number;
}

export const TokenIcon = memo(({ symbol, className, size = 32 }: TokenIconProps) => {
    const [error, setError] = useState(false);

    if (!symbol) {
        return <div className={cn("rounded-full bg-zinc-800", className)} style={{ width: size, height: size }} />;
    }

    const normalizedSymbol = symbol.toLowerCase();

    // Try CoinCap first, it's generally good.
    const iconUrl = `https://assets.coincap.io/assets/icons/${normalizedSymbol}@2x.png`;

    if (error) {
        return <CryptoIcon type={symbol} size={size} className={className} />;
    }

    const fallbackColor = getTokenColor(symbol);

    return (
        <div
            className={cn(
                "relative rounded-full shrink-0 flex items-center justify-center bg-card/40 backdrop-blur-md border border-white/10 overflow-hidden group",
                className
            )}
            style={{ width: size, height: size }}
        >
            <Avatar className="h-full w-full bg-transparent overflow-hidden">
                <AvatarImage
                    src={iconUrl}
                    alt={symbol}
                    onError={() => setError(true)}
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <AvatarFallback
                    className="flex items-center justify-center text-white/90 font-bold uppercase tracking-tighter"
                    style={{
                        backgroundColor: fallbackColor,
                        fontSize: size * 0.35,
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)"
                    }}
                >
                    {symbol.slice(0, 2)}
                </AvatarFallback>
            </Avatar>

            {/* Premium Shine Layer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
        </div>
    );
});
