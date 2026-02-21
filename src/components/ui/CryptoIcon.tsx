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
    // Normalization helper with safety check
    const key = (id || type || '').toLowerCase();

    // Mapping for Exchanges - local logos for reliability/professional consistency
    const exchangeIcons: Record<string, string> = {
        binance: "/binance.svg",
        bybit: "/bybit.svg",
        coinbase: "/brands/connections/coinbase.png",
        kraken: "/brands/connections/kraken.png",
        kucoin: "/brands/connections/kucoin.svg",
        okx: "/brands/connections/okx.svg",
        gate: "/brands/connections/gate.png",
        bitget: "/brands/connections/bitget.png",
        hyperliquid: "/brands/hyperliquid-mark.svg",
        hl: "/brands/hyperliquid-mark.svg",
        tradingview: "/brands/tradingview-mark.svg",
        mexc: "/brands/connections/mexc.png",
        huobi: "/brands/connections/huobi.png",
        bitfinex: "/brands/connections/bitfinex.png",
        deribit: "/brands/connections/deribit.png",
        dydx: "/brands/connections/dydx.png",
        phemex: "/brands/connections/phemex.png",
        woo: "/brands/connections/woo.png",
        zerion: "/brands/connections/zerion.png",
    };

    // Mapping for Hardware Wallets - local logos for reliability/professional consistency
    const hardwareIcons: Record<string, string> = {
        ledger: "/ledger-logo.png",
        trezor: "/trezor-logo.png",
        gridplus: "/brands/connections/gridplus.png",
        tangem: "/brands/connections/tangem.png",
        onekey: "/brands/connections/onekey.png",
        coldcard: "/brands/connections/coldcard.png",
        keystone: "/brands/connections/keystone.png",
        safepal: "/brands/connections/safepal.png",
    };

    // Mapping for Chains/Networks - Comprehensive list
    const chainIcons: Record<string, string> = {
        // Major L1s
        eth: "/brands/connections/ethereum.svg",
        ethereum: "/brands/connections/ethereum.svg",
        btc: "/brands/connections/bitcoin.svg",
        bitcoin: "/brands/connections/bitcoin.svg",
        sol: "/brands/connections/solana.svg",
        solana: "/brands/connections/solana.svg",

        // L2s & Rollups
        arb: "/brands/connections/arbitrum.svg",
        arbitrum: "/brands/connections/arbitrum.svg",
        matic: "/brands/connections/polygon.svg",
        polygon: "/brands/connections/polygon.svg",
        op: "/brands/connections/optimism.svg",
        optimism: "/brands/connections/optimism.svg",
        base: "/brands/connections/base.png",
        linea: "https://avatars.githubusercontent.com/u/106817195",
        scroll: "https://avatars.githubusercontent.com/u/96539549",
        zksync: "https://avatars.githubusercontent.com/u/78247609",
        blast: "https://avatars.githubusercontent.com/u/168192929",
        mantle: "https://cryptologos.cc/logos/mantle-mnt-logo.svg",
        mnt: "https://cryptologos.cc/logos/mantle-mnt-logo.svg",

        // EVM Chains
        avax: "/brands/connections/avalanche.svg",
        avalanche: "/brands/connections/avalanche.svg",
        bsc: "/brands/connections/bnb.svg",
        bnb: "/brands/connections/bnb.svg",
        ftm: "https://cryptologos.cc/logos/fantom-ftm-logo.svg",
        fantom: "https://cryptologos.cc/logos/fantom-ftm-logo.svg",
        cro: "https://cryptologos.cc/logos/cronos-cro-logo.svg",
        cronos: "https://cryptologos.cc/logos/cronos-cro-logo.svg",
        gnosis: "https://cryptologos.cc/logos/gnosis-gno-gno-logo.svg",
        xdai: "https://cryptologos.cc/logos/gnosis-gno-gno-logo.svg",
        celo: "https://cryptologos.cc/logos/celo-celo-logo.svg",
        
        // Cosmos Ecosystem
        atom: "https://cryptologos.cc/logos/cosmos-atom-logo.svg",
        cosmos: "https://cryptologos.cc/logos/cosmos-atom-logo.svg",
        osmo: "https://cryptologos.cc/logos/osmosis-osmo-logo.svg",
        inj: "https://cryptologos.cc/logos/injective-inj-logo.svg",
        injective: "https://cryptologos.cc/logos/injective-inj-logo.svg",
        kava: "https://cryptologos.cc/logos/kava-kava-logo.svg",
        sei: "https://cryptologos.cc/logos/sei-sei-logo.svg",
        
        // Move Chains
        sui: "/brands/connections/sui.svg",
        apt: "/brands/connections/aptos.svg",
        aptos: "/brands/connections/aptos.svg",

        // Other L1s
        hbar: "/brands/connections/hedera.svg",
        hedera: "/brands/connections/hedera.svg",
        near: "https://cryptologos.cc/logos/near-protocol-near-logo.svg",
        dot: "https://cryptologos.cc/logos/polkadot-new-dot-logo.svg",
        polkadot: "https://cryptologos.cc/logos/polkadot-new-dot-logo.svg",
        algo: "https://cryptologos.cc/logos/algorand-algo-logo.svg",
        algorand: "https://cryptologos.cc/logos/algorand-algo-logo.svg",
        ada: "https://cryptologos.cc/logos/cardano-ada-logo.svg",
        cardano: "https://cryptologos.cc/logos/cardano-ada-logo.svg",
        xrp: "/brands/connections/xrp.svg",
        ripple: "/brands/connections/xrp.svg",
        xlm: "https://cryptologos.cc/logos/stellar-xlm-logo.svg",
        stellar: "https://cryptologos.cc/logos/stellar-xlm-logo.svg",
        xtz: "https://cryptologos.cc/logos/tezos-xtz-logo.svg",
        tezos: "https://cryptologos.cc/logos/tezos-xtz-logo.svg",
        egld: "https://cryptologos.cc/logos/multiversx-egld-egld-logo.svg",
        multiversx: "https://cryptologos.cc/logos/multiversx-egld-egld-logo.svg",
        vet: "https://cryptologos.cc/logos/vechain-vet-logo.svg",
        vechain: "https://cryptologos.cc/logos/vechain-vet-logo.svg",
        fil: "https://cryptologos.cc/logos/filecoin-fil-logo.svg",
        filecoin: "https://cryptologos.cc/logos/filecoin-fil-logo.svg",
        
        // Other
        trx: "/brands/connections/tron.svg",
        tron: "/brands/connections/tron.svg",
        ton: "/brands/connections/ton.svg",
        toncoin: "/brands/connections/ton.svg",
        doge: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg",
        dogecoin: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg",
        ltc: "https://cryptologos.cc/logos/litecoin-ltc-logo.svg",
        litecoin: "https://cryptologos.cc/logos/litecoin-ltc-logo.svg",
        bch: "https://cryptologos.cc/logos/bitcoin-cash-bch-logo.svg",
        
        // DeFi Tokens
        link: "https://cryptologos.cc/logos/chainlink-link-logo.svg",
        uni: "https://cryptologos.cc/logos/uniswap-uni-logo.svg",
        aave: "https://cryptologos.cc/logos/aave-aave-logo.svg",
        mkr: "https://cryptologos.cc/logos/maker-mkr-logo.svg",
        crv: "https://cryptologos.cc/logos/curve-dao-token-crv-logo.svg",
        snx: "https://cryptologos.cc/logos/synthetix-network-token-snx-logo.svg",
        comp: "https://cryptologos.cc/logos/compound-comp-logo.svg",
        
        // Other common tokens
        usdt: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
        usdc: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg",
        dai: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg",

        // Wallets / Generic
        zerion: "/brands/connections/zerion.png",
        metamask: "/brands/connections/metamask.png",
        phantom: "/brands/connections/phantom.png",
        evm: "/brands/connections/ethereum.svg",
        wallet: "/brands/connections/ethereum.svg",
    };

    // Type-aware lookup - prioritize the correct map based on type
    const normalizedType = type?.toLowerCase() || '';
    let src: string | undefined;
    
    if (normalizedType === 'hardware') {
        src = hardwareIcons[key] || hardwareIcons['ledger']; // default to ledger for hardware
    } else if (normalizedType === 'exchange') {
        src = exchangeIcons[key];
    } else if (normalizedType === 'chain') {
        src = chainIcons[key];
    } else {
        // General fallback - check all icon maps
        src = exchangeIcons[key] || chainIcons[key] || hardwareIcons[key];
    }

    // Fallback for "wallet" generic
    if (!src && (key === 'wallet' || key === 'on-chain wallet' || key === 'on-chain')) {
        src = chainIcons['eth']; // Default wallet icon
    }

    // Attempt to handle custom identifiers like 'binance futures' -> binance
    if (!src) {
        // Exchange fallbacks
        if (key.includes('binance')) src = exchangeIcons['binance'];
        else if (key.includes('bybit')) src = exchangeIcons['bybit'];
        else if (key.includes('coinbase')) src = exchangeIcons['coinbase'];
        else if (key.includes('kucoin')) src = exchangeIcons['kucoin'];
        else if (key.includes('okx')) src = exchangeIcons['okx'];
        else if (key.includes('kraken')) src = exchangeIcons['kraken'];
        else if (key.includes('hyperliquid') || key === 'hl') src = exchangeIcons['hyperliquid'];
        else if (key.includes('gate')) src = exchangeIcons['gate'];
        else if (key.includes('bitget')) src = exchangeIcons['bitget'];
        else if (key.includes('mexc')) src = exchangeIcons['mexc'];
        else if (key.includes('dydx')) src = exchangeIcons['dydx'];
        else if (key.includes('gmx')) src = exchangeIcons['gmx'];
        else if (key.includes('huobi') || key.includes('htx')) src = exchangeIcons['huobi'];
        else if (key.includes('bitfinex')) src = exchangeIcons['bitfinex'];
        else if (key.includes('deribit')) src = exchangeIcons['deribit'];
        // Hardware wallet fallbacks
        else if (key.includes('ledger')) src = hardwareIcons['ledger'];
        else if (key.includes('trezor')) src = hardwareIcons['trezor'];
        else if (key.includes('gridplus') || key.includes('grid+')) src = hardwareIcons['gridplus'];
        else if (key.includes('tangem')) src = hardwareIcons['tangem'];
        else if (key.includes('onekey')) src = hardwareIcons['onekey'];
        else if (key.includes('coldcard')) src = hardwareIcons['coldcard'];
        else if (key.includes('keystone')) src = hardwareIcons['keystone'];
        else if (key.includes('safepal')) src = hardwareIcons['safepal'];
        // Chain fallbacks - Major
        else if (key.includes('bitcoin') || key.includes('btc')) src = chainIcons['btc'];
        else if (key.includes('ethereum') || key.includes('eth')) src = chainIcons['eth'];
        else if (key.includes('solana') || key.includes('sol')) src = chainIcons['sol'];
        // L2s
        else if (key.includes('arbitrum') || key.includes('arb')) src = chainIcons['arb'];
        else if (key.includes('polygon') || key.includes('matic')) src = chainIcons['matic'];
        else if (key.includes('optimism') || key.includes(' op')) src = chainIcons['op'];
        else if (key.includes('base')) src = chainIcons['base'];
        else if (key.includes('linea')) src = chainIcons['linea'];
        else if (key.includes('scroll')) src = chainIcons['scroll'];
        else if (key.includes('zksync')) src = chainIcons['zksync'];
        else if (key.includes('blast')) src = chainIcons['blast'];
        else if (key.includes('mantle') || key.includes('mnt')) src = chainIcons['mantle'];
        // EVM Chains
        else if (key.includes('avalanche') || key.includes('avax')) src = chainIcons['avax'];
        else if (key.includes('fantom') || key.includes('ftm')) src = chainIcons['ftm'];
        else if (key.includes('cronos') || key.includes('cro')) src = chainIcons['cro'];
        else if (key.includes('gnosis') || key.includes('xdai')) src = chainIcons['gnosis'];
        else if (key.includes('celo')) src = chainIcons['celo'];
        else if (key.includes('bnb') || key.includes('bsc')) src = chainIcons['bnb'];
        // Cosmos
        else if (key.includes('cosmos') || key.includes('atom')) src = chainIcons['atom'];
        else if (key.includes('osmosis') || key.includes('osmo')) src = chainIcons['osmo'];
        else if (key.includes('injective') || key.includes('inj')) src = chainIcons['inj'];
        else if (key.includes('kava')) src = chainIcons['kava'];
        else if (key.includes('sei')) src = chainIcons['sei'];
        // Move chains
        else if (key.includes('aptos') || key.includes('apt')) src = chainIcons['apt'];
        else if (key.includes('sui')) src = chainIcons['sui'];
        // Other L1s
        else if (key.includes('ton')) src = chainIcons['ton'];
        else if (key.includes('tron') || key.includes('trx')) src = chainIcons['trx'];
        else if (key.includes('hedera') || key.includes('hbar')) src = chainIcons['hbar'];
        else if (key.includes('xrp') || key.includes('ripple')) src = chainIcons['xrp'];
        else if (key.includes('stellar') || key.includes('xlm')) src = chainIcons['xlm'];
        else if (key.includes('cardano') || key.includes('ada')) src = chainIcons['ada'];
        else if (key.includes('polkadot') || key.includes('dot')) src = chainIcons['dot'];
        else if (key.includes('near')) src = chainIcons['near'];
        else if (key.includes('algorand') || key.includes('algo')) src = chainIcons['algo'];
        else if (key.includes('tezos') || key.includes('xtz')) src = chainIcons['xtz'];
        else if (key.includes('multiversx') || key.includes('egld')) src = chainIcons['egld'];
        else if (key.includes('vechain') || key.includes('vet')) src = chainIcons['vet'];
        else if (key.includes('filecoin') || key.includes('fil')) src = chainIcons['fil'];
        else if (key.includes('doge')) src = chainIcons['doge'];
        else if (key.includes('litecoin') || key.includes('ltc')) src = chainIcons['ltc'];
        // DeFi tokens
        else if (key.includes('chainlink') || key.includes('link')) src = chainIcons['link'];
        else if (key.includes('uniswap') || key.includes('uni')) src = chainIcons['uni'];
        else if (key.includes('aave')) src = chainIcons['aave'];
        else if (key.includes('maker') || key.includes('mkr')) src = chainIcons['mkr'];
        // Stablecoins
        else if (key.includes('usdt') || key.includes('tether')) src = chainIcons['usdt'];
        else if (key.includes('usdc')) src = chainIcons['usdc'];
        else if (key.includes('dai')) src = chainIcons['dai'];
    }

    // Final fallback
    if (!src) {
        // Generic coin/question mark or just ETH/BTC placeholder
        src = "/brands/connections/ethereum.svg";
    }
    const needsLightBg = /\/(okx\.svg|deribit\.png|onekey\.png|keystone\.png|coldcard\.png|gridplus\.png)$/.test(src);

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
            <div
                className={cn("relative flex items-center justify-center", needsLightBg && "rounded-full bg-white p-1")}
                style={{ width: size, height: size }}
            >
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
