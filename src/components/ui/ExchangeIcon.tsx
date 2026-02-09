"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface ExchangeIconProps {
    exchange: string;
    className?: string;
    size?: number;
}

const EXCHANGE_LOGOS: Record<string, string> = {
    binance: "https://cryptologos.cc/logos/binance-coin-bnb-logo.svg",
    bybit: "https://cryptologos.cc/logos/bybit-logo.svg",
    hyperliquid: "https://app.hyperliquid.xyz/favicon.ico", // Best available for now
    ethereum: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
    bitcoin: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
    solana: "https://cryptologos.cc/logos/solana-sol-logo.svg",
    sui: "https://cryptologos.cc/logos/sui-sui-logo.svg",
    aptos: "https://cryptologos.cc/logos/aptos-apt-logo.svg",
    coinbase: "https://cryptologos.cc/logos/coinbase-coin-logo.svg",
    kraken: "https://cryptologos.cc/logos/kraken-logo.svg",
    kucoin: "https://cryptologos.cc/logos/kucoin-token-kcs-logo.svg",
    okx: "https://cryptologos.cc/logos/okb-okb-logo.svg", // OKB is standard for OKX
    gate: "https://cryptologos.cc/logos/gate-token-gt-logo.svg",
    bitget: "https://cryptologos.cc/logos/bitget-token-bgb-logo.svg",
    mexc: "https://cryptologos.cc/logos/mexc-mx-logo.svg",
    huobi: "https://cryptologos.cc/logos/huobi-token-ht-logo.svg",
    bitfinex: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
    deribit: "https://cryptologos.cc/logos/deribit-logo.svg", // Verify if SVG exists
    dydx: "https://cryptologos.cc/logos/dydx-dydx-logo.svg",
    phemex: "https://phemex.com/favicon.ico",
    woo: "https://cryptologos.cc/logos/woo-network-woo-logo.svg",
};

// Map display names to keys
const NORMALIZE_MAP: Record<string, string> = {
    "Binance": "binance",
    "Binance Futures": "binance",
    "Binance Spot": "binance",
    "Bybit": "bybit",
    "Bybit Spot": "bybit",
    "Bybit Linear": "bybit",
    "Hyperliquid": "hyperliquid",
    "Wallet (ETH)": "ethereum",
    "Wallet (BTC)": "bitcoin",
    "Wallet (SOL)": "solana",
    "Wallet (SUI)": "sui",
    "Wallet (APT)": "aptos",
    "wallet": "ethereum", // Default generic wallet to ETH
    "evm": "ethereum",
    "solana": "solana",
    "sui": "sui",
    "aptos": "aptos",
    "Coinbase": "coinbase",
    "Kraken": "kraken",
    "KuCoin": "kucoin",
    "OKX": "okx",
    "Gate.io": "gate",
    "Bitget": "bitget",
    "MEXC": "mexc",
    "Huobi": "huobi",
    "Bitfinex": "bitfinex",
    "Deribit": "deribit",
    "dYdX": "dydx",
};

export function ExchangeIcon({ exchange, className, size = 24 }: ExchangeIconProps) {
    const key = NORMALIZE_MAP[exchange] || exchange.toLowerCase();
    const logoUrl = EXCHANGE_LOGOS[key];

    // Fallback Colors if no logo is found
    const COLORS: Record<string, string> = {
        binance: "bg-[#F3BA2F] text-black",
        bybit: "bg-black text-white border border-white/20",
        hyperliquid: "bg-[#25C4F4] text-black",
        ethereum: "bg-[#627EEA] text-white",
        bitcoin: "bg-[#F7931A] text-white",
        solana: "bg-[#14F195] text-black",
        sui: "bg-[#6FBCF0] text-white",
        aptos: "bg-[#EED3AA] text-black",
    };

    if (logoUrl) {
        return (
            <div
                className={cn("relative rounded-full overflow-hidden flex-shrink-0 bg-white/5", className)}
                style={{ width: size, height: size }}
                title={exchange}
            >
                <Image
                    src={logoUrl}
                    alt={exchange}
                    fill
                    className="object-cover p-0.5" // Slight padding to prevent edge cutting for round icons
                    unoptimized // Allow external URLs
                />
            </div>
        );
    }

    const colorClass = COLORS[key] || "bg-zinc-800 text-zinc-400";
    const letter = exchange.slice(0, 1).toUpperCase();

    return (
        <div
            className={cn(
                "rounded-full flex items-center justify-center font-bold shadow-sm flex-shrink-0",
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
