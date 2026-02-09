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

    const iconUrl = `https://assets.coincap.io/assets/icons/${normalizedSymbol}@2x.png`;

    if (error) {
        return <CryptoIcon type={symbol} size={size} className={className} />;
    }

    return (
        <Avatar className={cn("inline-block", className)} style={{ width: size, height: size }}>
            <AvatarImage
                src={iconUrl}
                alt={symbol}
                onError={() => setError(true)}
                className="object-cover"
            />
            <AvatarFallback className="flex items-center justify-center bg-zinc-800 text-zinc-400">
                <CryptoIcon type={symbol} size={size - 8} />
            </AvatarFallback>
        </Avatar>
    );
}

import { CryptoIcon } from "@/components/ui/CryptoIcon";
