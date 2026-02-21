"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { BrandLogo } from "@/components/ui/BrandLogo";

interface ExchangeIconProps {
    exchange: string;
    className?: string;
    size?: number;
}

const EXCHANGE_LOGOS: Record<string, string> = {
    binance: "/binance.svg",
    bybit: "/bybit.svg",
    hyperliquid: "/brands/hyperliquid-mark.svg",
    tradingview: "/brands/tradingview-mark.svg",
    ethereum: "/brands/connections/ethereum.svg",
    bitcoin: "/brands/connections/bitcoin.svg",
    solana: "/brands/connections/solana.svg",
    sui: "/brands/connections/sui.svg",
    aptos: "/brands/connections/aptos.svg",
    coinbase: "/brands/connections/coinbase.png",
    kraken: "/brands/connections/kraken.png",
    kucoin: "/brands/connections/kucoin.svg",
    okx: "/brands/connections/okx.svg",
    gate: "/brands/connections/gate.png",
    bitget: "/brands/connections/bitget.png",
    mexc: "/brands/connections/mexc.png",
    huobi: "/brands/connections/huobi.png",
    bitfinex: "/brands/connections/bitfinex.png",
    deribit: "/brands/connections/deribit.png",
    dydx: "/brands/connections/dydx.png",
    phemex: "/brands/connections/phemex.png",
    woo: "/brands/connections/woo.png",
    zerion: "/brands/connections/zerion.png",
    ledger: "/ledger-logo.png",
    trezor: "/trezor-logo.png",
    gridplus: "/brands/connections/gridplus.png",
    tangem: "/brands/connections/tangem.png",
    onekey: "/brands/connections/onekey.png",
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
    "hl": "hyperliquid",
    "TradingView": "tradingview",
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
    "gate.io": "gate",
    "Bitget": "bitget",
    "MEXC": "mexc",
    "Huobi": "huobi",
    "Bitfinex": "bitfinex",
    "Deribit": "deribit",
    "dYdX": "dydx",
    "Zerion": "zerion",
    "Ledger": "ledger",
    "Trezor": "trezor",
    "GridPlus": "gridplus",
    "Tangem": "tangem",
    "OneKey": "onekey",
};

export function ExchangeIcon({ exchange, className, size = 24 }: ExchangeIconProps) {
    const safeExchange = exchange || "unknown";
    const normalized = safeExchange.toLowerCase();
    let key = NORMALIZE_MAP[safeExchange] || NORMALIZE_MAP[normalized] || normalized;
    if (!EXCHANGE_LOGOS[key]) {
        if (normalized.includes("binance")) key = "binance";
        else if (normalized.includes("bybit")) key = "bybit";
        else if (normalized.includes("hyperliquid") || normalized === "hl") key = "hyperliquid";
        else if (normalized.includes("okx")) key = "okx";
        else if (normalized.includes("kucoin")) key = "kucoin";
        else if (normalized.includes("kraken")) key = "kraken";
        else if (normalized.includes("gate")) key = "gate";
        else if (normalized.includes("bitget")) key = "bitget";
        else if (normalized.includes("mexc")) key = "mexc";
        else if (normalized.includes("coinbase")) key = "coinbase";
        else if (normalized.includes("zerion")) key = "zerion";
        else if (normalized.includes("ledger")) key = "ledger";
        else if (normalized.includes("trezor")) key = "trezor";
        else if (normalized.includes("gridplus") || normalized.includes("grid+")) key = "gridplus";
        else if (normalized.includes("tangem")) key = "tangem";
        else if (normalized.includes("onekey")) key = "onekey";
        else if (normalized.includes("ethereum") || normalized.includes("eth")) key = "ethereum";
        else if (normalized.includes("bitcoin") || normalized.includes("btc")) key = "bitcoin";
        else if (normalized.includes("solana") || normalized.includes("sol")) key = "solana";
        else if (normalized.includes("aptos") || normalized.includes("apt")) key = "aptos";
        else if (normalized.includes("sui")) key = "sui";
    }
    const logoUrl = EXCHANGE_LOGOS[key];
    const needsLightBg = ["okx", "deribit", "onekey", "keystone", "coldcard", "gridplus"].includes(key);

    if (key === "binance" || key === "bybit" || key === "hyperliquid" || key === "tradingview") {
        return (
            <div
                className={cn(
                    "relative rounded-full overflow-hidden shrink-0 bg-card/40 backdrop-blur-md border border-white/10 flex items-center justify-center",
                    className
                )}
                style={{ width: size + 6, height: size + 6 }}
                title={exchange}
            >
                <BrandLogo brand={key as "binance" | "bybit" | "hyperliquid" | "tradingview"} size={size} />
            </div>
        );
    }

    // Fallback Colors if no logo is found
    const COLORS: Record<string, string> = {
        binance: "bg-[#F3BA2F] text-black",
        bybit: "bg-black text-white border border-white/20",
        hyperliquid: "bg-[#25C4F4] text-black",
        tradingview: "bg-[#0f172f] text-white",
        ethereum: "bg-[#627EEA] text-white",
        bitcoin: "bg-[#F7931A] text-white",
        solana: "bg-[#14F195] text-black",
        sui: "bg-[#6FBCF0] text-white",
        aptos: "bg-[#EED3AA] text-black",
        okx: "bg-white text-black",
        kraken: "bg-[#5741D9] text-white",
        kucoin: "bg-[#24AE8F] text-white",
        gate: "bg-[#2354E6] text-white",
        bitget: "bg-[#00D0CC] text-black",
        mexc: "bg-[#0045FF] text-white",
    };

    if (logoUrl) {
        return (
            <div
                className={cn(
                    "relative rounded-full overflow-hidden shrink-0 bg-card/40 backdrop-blur-md border border-white/10 flex items-center justify-center group",
                    className
                )}
                style={{ width: size + 6, height: size + 6 }}
                title={exchange}
            >
                <div className={cn("relative", needsLightBg && "rounded-full bg-white p-0.5")} style={{ width: size, height: size }}>
                    <Image
                        src={logoUrl}
                        alt={exchange}
                        fill
                        className="object-contain p-0.5 transition-transform duration-300 group-hover:scale-110"
                        unoptimized
                    />
                </div>
            </div>
        );
    }

    const colorClass = COLORS[key] || "bg-zinc-800 text-zinc-400";
    const letter = safeExchange.slice(0, 1).toUpperCase();

    return (
        <div
            className={cn(
                "rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 border border-white/10",
                colorClass,
                className
            )}
            style={{ width: size + 6, height: size + 6, fontSize: size * 0.5 }}
            title={exchange}
        >
            {letter}
        </div>
    );
}
