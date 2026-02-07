"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TokenIconProps {
    symbol: string;
    className?: string;
    size?: number;
}

export function TokenIcon({ symbol, className, size = 32 }: TokenIconProps) {
    const [error, setError] = useState(false);
    const normalizedSymbol = symbol.toLowerCase();

    // Try CoinCap CDN first, it's generally reliable for major coins
    const iconUrl = `https://assets.coincap.io/assets/icons/${normalizedSymbol}@2x.png`;

    return (
        <Avatar className={cn("inline-block", className)} style={{ width: size, height: size }}>
            {!error && (
                <AvatarImage
                    src={iconUrl}
                    alt={symbol}
                    onError={() => setError(true)}
                    className="object-cover"
                />
            )}
            <AvatarFallback className="text-[10px] font-bold bg-zinc-800 text-zinc-400">
                {symbol.slice(0, 2).toUpperCase()}
            </AvatarFallback>
        </Avatar>
    );
}
