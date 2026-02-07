"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface ExchangeIconProps {
    exchange: string;
    className?: string;
    size?: number;
}

const EXCHANGE_LOGOS: Record<string, string> = {
    binance: "https://cryptologos.cc/logos/binance-coin-bnb-logo.png", // Using BNB logo for Binance usually works well enough or specific CDN
    bybit: "https://cryptologos.cc/logos/bybit-logo.png", // Might not work directly if hotlink protected, fallback to text
    hyperliquid: "https://hyperliquid.xyz/favicon.ico",
    ethereum: "https://assets.coincap.io/assets/icons/eth@2x.png",
    bitcoin: "https://assets.coincap.io/assets/icons/btc@2x.png",
};

// Map display names to keys
const NORMALIZE_MAP: Record<string, string> = {
    "Binance": "binance",
    "Binance Futures": "binance",
    "Bybit": "bybit",
    "Hyperliquid": "hyperliquid",
    "Wallet (ETH)": "ethereum",
    "Wallet (BTC)": "bitcoin",
};

export function ExchangeIcon({ exchange, className, size = 24 }: ExchangeIconProps) {
    const key = NORMALIZE_MAP[exchange] || exchange.toLowerCase();
    // For now, let's use a nice colored badge if we don't have a reliable logo, 
    // but we will try to define some known colors.

    const COLORS: Record<string, string> = {
        binance: "bg-[#F3BA2F] text-black",
        bybit: "bg-black text-white border border-white/20",
        hyperliquid: "bg-[#25C4F4] text-black",
        ethereum: "bg-[#627EEA] text-white",
        bitcoin: "bg-[#F7931A] text-white",
    };

    const colorClass = COLORS[key] || "bg-zinc-800 text-zinc-400";
    const letter = exchange.slice(0, 1).toUpperCase();

    return (
        <div
            className={cn(
                "rounded-full flex items-center justify-center font-bold shadow-sm",
                colorClass,
                className
            )}
            style={{ width: size, height: size, fontSize: size * 0.5 }}
            title={exchange}
        >
            {letter}
        </div>
    );
}
