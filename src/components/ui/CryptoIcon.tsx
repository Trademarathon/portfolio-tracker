"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface CryptoIconProps {
    type: string; // 'exchange' or 'chain' or specific name
    id?: string;  // specific id like 'binance', 'ETH', etc.
    className?: string;
    size?: number;
}

export function CryptoIcon({ type, id, className, size = 28 }: CryptoIconProps) {
    // Normalization helper
    const key = (id || type).toLowerCase();

    // Mapping for Exchanges
    const exchangeIcons: Record<string, string> = {
        binance: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
        bybit: "https://cryptologos.cc/logos/bybit-logo.svg",
        coinbase: "https://cryptologos.cc/logos/coinbase-coin-logo.svg",
        kraken: "https://cryptologos.cc/logos/kraken-logo.svg",
        kucoin: "https://cryptologos.cc/logos/kucoin-token-kcs-logo.svg",
        okx: "https://cryptologos.cc/logos/okb-okb-logo.svg",
        gate: "https://cryptologos.cc/logos/gate-token-gt-logo.svg",
        bitget: "https://cryptologos.cc/logos/bitget-token-bgb-logo.svg",
        hyperliquid: "/hyperliquid.png",
        mexc: "https://cryptologos.cc/logos/mexc-mx-logo.svg",
        huobi: "https://cryptologos.cc/logos/huobi-token-ht-logo.svg",
        bitfinex: "https://cryptologos.cc/logos/tether-usdt-logo.svg", // Placeholder/Close enough
        deribit: "https://cryptologos.cc/logos/deribit-logo.svg", // might need check
        dydx: "https://cryptologos.cc/logos/dydx-dydx-logo.svg",
        // Add more as needed
    };

    // Mapping for Chains/Networks
    const chainIcons: Record<string, string> = {
        eth: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
        ethereum: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
        btc: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
        bitcoin: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
        sol: "https://cryptologos.cc/logos/solana-sol-logo.svg",
        solana: "https://cryptologos.cc/logos/solana-sol-logo.svg",
        arb: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg",
        arbitrum: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg",
        matic: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
        polygon: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
        op: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg",
        optimism: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg",
        base: "https://cryptologos.cc/logos/base-logo.svg",
        avax: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
        avalanche: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
        bsc: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
        bnb: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
        ftm: "https://cryptologos.cc/logos/fantom-ftm-logo.svg",
        fantom: "https://cryptologos.cc/logos/fantom-ftm-logo.svg",
        atom: "https://cryptologos.cc/logos/cosmos-atom-logo.svg",
        cosmos: "https://cryptologos.cc/logos/cosmos-atom-logo.svg",
        sui: "https://cryptologos.cc/logos/sui-sui-logo.svg",
        apt: "https://cryptologos.cc/logos/aptos-apt-logo.svg",
        aptos: "https://cryptologos.cc/logos/aptos-apt-logo.svg",
        hbar: "https://cryptologos.cc/logos/hedera-hbar-logo.svg",
        sei: "https://cryptologos.cc/logos/sei-sei-logo.svg",
        near: "https://cryptologos.cc/logos/near-protocol-near-logo.svg",
        dot: "https://cryptologos.cc/logos/polkadot-new-dot-logo.svg",
        algo: "https://cryptologos.cc/logos/algorand-algo-logo.svg",
        ada: "https://cryptologos.cc/logos/cardano-ada-logo.svg",
        xrp: "https://cryptologos.cc/logos/xrp-xrp-logo.svg",
        doge: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg",
        trx: "https://cryptologos.cc/logos/tron-trx-logo.svg",
        ltc: "https://cryptologos.cc/logos/litecoin-ltc-logo.svg",
        link: "https://cryptologos.cc/logos/chainlink-link-logo.svg",
        uni: "https://cryptologos.cc/logos/uniswap-uni-logo.svg",
    };

    // Fallback logic
    let src = exchangeIcons[key] || chainIcons[key];

    // Fallback for "wallet" generic
    if (!src && (key === 'wallet' || key === 'on-chain wallet')) {
        src = chainIcons['eth']; // Default wallet icon
    }

    // Attempt to handle custom identifiers like 'binance futures' -> binance
    if (!src) {
        if (key.includes('binance')) src = exchangeIcons['binance'];
        else if (key.includes('bybit')) src = exchangeIcons['bybit'];
        else if (key.includes('coinbase')) src = exchangeIcons['coinbase'];
        else if (key.includes('kucoin')) src = exchangeIcons['kucoin'];
        else if (key.includes('okx')) src = exchangeIcons['okx'];
        else if (key.includes('kraken')) src = exchangeIcons['kraken'];
        else if (key.includes('hyperliquid')) src = exchangeIcons['hyperliquid'];
    }

    // Final fallback
    if (!src) {
        // Generic coin/question mark or just ETH/BTC placeholder
        src = "https://cryptologos.cc/logos/ethereum-eth-logo.svg";
    }

    return (
        <div
            className={cn(
                "relative rounded-full flex items-center justify-center overflow-hidden shrink-0",
                "bg-card/40 backdrop-blur-md border border-white/10 shadow-xl",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent",
                className
            )}
            style={{ width: size + 8, height: size + 8 }}
        >
            <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                <Image
                    src={src}
                    alt={id || type}
                    width={size}
                    height={size}
                    className="object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-110"
                    unoptimized
                />
            </div>

            {/* Subtle Inner Glow */}
            <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
        </div>
    );
}
