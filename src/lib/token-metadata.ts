// Comprehensive token metadata for proper naming and colors

export const TOKEN_METADATA: Record<string, { name: string; logo?: string; color?: string }> = {
    // Top Layer 1s
    BTC: { name: "Bitcoin", color: "#F7931A" },
    ETH: { name: "Ethereum", color: "#627EEA" },
    SOL: { name: "Solana", color: "#14F195" },
    BNB: { name: "Binance Coin", color: "#F3BA2F" },
    ADA: { name: "Cardano", color: "#0033AD" },
    AVAX: { name: "Avalanche", color: "#E84142" },
    DOT: { name: "Polkadot", color: "#E6007A" },
    MATIC: { name: "Polygon", color: "#8247E5" },
    POL: { name: "Polygon", color: "#8247E5" },
    TRX: { name: "TRON", color: "#FF0013" },
    SUI: { name: "Sui", color: "#4DA2FF" },
    APT: { name: "Aptos", color: "#000000" },
    TON: { name: "Toncoin", color: "#0098EA" },
    HBAR: { name: "Hedera", color: "#000000" },
    SEI: { name: "Sei", color: "#A73639" },
    INJ: { name: "Injective", color: "#00F2FF" },
    OP: { name: "Optimism", color: "#FF0420" },
    ARB: { name: "Arbitrum", color: "#2D374B" },
    NEAR: { name: "NEAR Protocol", color: "#000000" },
    ATOM: { name: "Cosmos", color: "#2E3148" },
    FTM: { name: "Fantom", color: "#1969FF" },
    ALGO: { name: "Algorand", color: "#000000" },
    XRP: { name: "Ripple", color: "#23292F" },
    DOGE: { name: "Dogecoin", color: "#C2A633" },
    LTC: { name: "Litecoin", color: "#BFBBBB" },
    BCH: { name: "Bitcoin Cash", color: "#8DC351" },
    XLM: { name: "Stellar", color: "#000000" },
    ETC: { name: "Ethereum Classic", color: "#328332" },
    FIL: { name: "Filecoin", color: "#0090FF" },
    HYPE: { name: "Hyperliquid", color: "#00D9FF" },
    TIA: { name: "Celestia", color: "#7B2BF9" },
    STX: { name: "Stacks", color: "#5546FF" },
    ICP: { name: "Internet Computer", color: "#29ABE2" },
    VET: { name: "VeChain", color: "#15BDFF" },
    EGLD: { name: "MultiversX", color: "#23F7DD" },
    XMR: { name: "Monero", color: "#FF6600" },

    // Stablecoins
    USDT: { name: "Tether", color: "#26A17B" },
    USDC: { name: "USD Coin", color: "#2775CA" },
    DAI: { name: "Dai", color: "#F5AC37" },
    FDUSD: { name: "First Digital USD", color: "#00C9A7" },
    BUSD: { name: "Binance USD", color: "#F0B90B" },
    TUSD: { name: "TrueUSD", color: "#002868" },
    USDP: { name: "Pax Dollar", color: "#00594C" },
    PYUSD: { name: "PayPal USD", color: "#003087" },

    // DeFi / Exchange Tokens
    UNI: { name: "Uniswap", color: "#FF007A" },
    LINK: { name: "Chainlink", color: "#2A5ADA" },
    LDO: { name: "Lido DAO", color: "#00A3FF" },
    MKR: { name: "Maker", color: "#1AAB9B" },
    AAVE: { name: "Aave", color: "#B6509E" },
    CRV: { name: "Curve DAO", color: "#FF0000" },
    DYDX: { name: "dYdX", color: "#6966FF" },
    JUP: { name: "Jupiter", color: "#CBE434" },
    RUNE: { name: "THORChain", color: "#00CC99" },
    CAKE: { name: "PancakeSwap", color: "#D1884F" },
    RAY: { name: "Raydium", color: "#5F4B8B" },
    SNX: { name: "Synthetix", color: "#00D1FF" },
    COMP: { name: "Compound", color: "#00D395" },
    SUSHI: { name: "SushiSwap", color: "#FA52A0" },
    "1INCH": { name: "1inch", color: "#1B314F" },
    GMX: { name: "GMX", color: "#2D42FC" },
    PENDLE: { name: "Pendle", color: "#0094FF" },
    ENA: { name: "Ethena", color: "#000000" },
    ONDO: { name: "Ondo Finance", color: "#2F5EE5" },

    // Meme Coins
    SHIB: { name: "Shiba Inu", color: "#FFA409" },
    PEPE: { name: "Pepe", color: "#2B8C3E" },
    WIF: { name: "dogwifhat", color: "#A88B6B" },
    BONK: { name: "Bonk", color: "#FFA500" },
    FLOKI: { name: "Floki", color: "#F5A623" },
    MEME: { name: "Memecoin", color: "#000000" },
    BOME: { name: "Book of Meme", color: "#FF4500" },
    POPCAT: { name: "Popcat", color: "#FFFF00" },
    BRETT: { name: "Brett", color: "#0000FF" },
    WEN: { name: "Wen", color: "#00A86B" },
    MOODENG: { name: "Moo Deng", color: "#FF69B4" },
    NEIRO: { name: "Neiro", color: "#8B4513" },
    COW: { name: "CoW Protocol", color: "#2F80ED" },
    ACT: { name: "Act I", color: "#FFD700" },
    PNUT: { name: "Peanut", color: "#DEB887" },
    MEW: { name: "cat in a dogs world", color: "#FFA500" },
    GOAT: { name: "Goatseus Maximus", color: "#8B0000" },
    AI16Z: { name: "ai16z", color: "#4169E1" },
    FARTCOIN: { name: "Fartcoin", color: "#90EE90" },
    MOTHER: { name: "Mother Iggy", color: "#FF1493" },
    CHILLGUY: { name: "Chill Guy", color: "#87CEEB" },
    PENGU: { name: "Pudgy Penguins", color: "#89CFF0" },

    // Gaming / Metaverse
    SAND: { name: "The Sandbox", color: "#00ADEF" },
    MANA: { name: "Decentraland", color: "#FF2D55" },
    AXS: { name: "Axie Infinity", color: "#0055D5" },
    GALA: { name: "Gala", color: "#090909" },
    IMX: { name: "Immutable", color: "#1AABCF" },
    APE: { name: "ApeCoin", color: "#0054F7" },
    ENJ: { name: "Enjin", color: "#624DBF" },
    BLUR: { name: "Blur", color: "#FF6B00" },

    // AI / Compute
    RENDER: { name: "Render", color: "#C8FF00" },
    FET: { name: "Fetch.ai", color: "#1D2951" },
    RNDR: { name: "Render", color: "#C8FF00" },
    AGIX: { name: "SingularityNET", color: "#5D26C1" },
    TAO: { name: "Bittensor", color: "#000000" },
    ARKM: { name: "Arkham", color: "#4169E1" },
    WLD: { name: "Worldcoin", color: "#000000" },
    OCEAN: { name: "Ocean Protocol", color: "#141414" },
    GRT: { name: "The Graph", color: "#6747ED" },

    // Infrastructure
    QNT: { name: "Quant", color: "#000000" },
    THETA: { name: "Theta", color: "#2AB8E6" },
    FLR: { name: "Flare", color: "#E62058" },
    ROSE: { name: "Oasis", color: "#0092F6" },
    KAS: { name: "Kaspa", color: "#49EACB" },
    CFX: { name: "Conflux", color: "#1A1A1A" },
    MINA: { name: "Mina Protocol", color: "#E39B4E" },
    ZEC: { name: "Zcash", color: "#ECB244" },
    DASH: { name: "Dash", color: "#008CE7" },

    // Hyperliquid Ecosystem & Popular Trading Tokens
    PURR: { name: "Purr", color: "#FF69B4" },
    MIGGO: { name: "Miggo", color: "#32CD32" },
    OM: { name: "MANTRA", color: "#E36C00" },
    ORCA: { name: "Orca", color: "#FFD700" },
    W: { name: "Wormhole", color: "#8B5CF6" },
    JTO: { name: "Jito", color: "#00D4AA" },
    PYTH: { name: "Pyth Network", color: "#6B21A8" },
    DYM: { name: "Dymension", color: "#FF6B35" },
    STRK: { name: "Starknet", color: "#EC796B" },
    ZK: { name: "zkSync", color: "#8C8DFC" },
    ZEREBRO: { name: "Zerebro", color: "#9B59B6" },
    VIRTUAL: { name: "Virtual Protocol", color: "#00CED1" },
    GRIFFAIN: { name: "Griffain", color: "#FF4500" },
    AIXBT: { name: "aixbt", color: "#00BFFF" },
    STEL: { name: "Stelai", color: "#4682B4" },
    OKI: { name: "Oki", color: "#32CD32" },
    OKA: { name: "Oka", color: "#20B2AA" },
    HADES: { name: "Hades", color: "#8B0000" },
    DOMI: { name: "Domi", color: "#4B0082" },

    // Additional Popular Tokens
    EIGEN: { name: "EigenLayer", color: "#1E40AF" },
    ZRO: { name: "LayerZero", color: "#000000" },
    MANTA: { name: "Manta Network", color: "#00B4D8" },
    BLAST: { name: "Blast", color: "#FCFC03" },
    MODE: { name: "Mode", color: "#DFFE00" },
    SCROLL: { name: "Scroll", color: "#FFEBD0" },
    LINEA: { name: "Linea", color: "#61DFFF" },
    BASE: { name: "Base", color: "#0052FF" },
    SONIC: { name: "Sonic", color: "#0066FF" },
    KAIA: { name: "Kaia", color: "#117ACA" },
    AEVO: { name: "Aevo", color: "#C8FF00" },
    ZETA: { name: "ZetaChain", color: "#00724C" },
    CYBER: { name: "Cyber", color: "#000000" },

    // Additional Staking & Yield
    STETH: { name: "Lido Staked ETH", color: "#00A3FF" },
    RETH: { name: "Rocket Pool ETH", color: "#FF6347" },
    CBETH: { name: "Coinbase Wrapped ETH", color: "#0052FF" },
    WSTETH: { name: "Wrapped stETH", color: "#00A3FF" },
    WETH: { name: "Wrapped ETH", color: "#627EEA" },
    WBTC: { name: "Wrapped BTC", color: "#F7931A" },
    TBTC: { name: "tBTC", color: "#000000" },
};

// Normalize symbol to standard format
export function normalizeSymbol(symbol: string): string {
    let s = symbol.toUpperCase().trim();

    // Remove common suffixes
    s = s.replace(/\/USDT$/i, '');
    s = s.replace(/\/USD$/i, '');
    s = s.replace(/\/USDC$/i, '');
    s = s.replace(/-PERP$/i, '');
    s = s.replace(/-USD$/i, '');
    s = s.replace(/-USDT$/i, '');
    s = s.replace(/USDT$/i, '');

    // Handle wrapped tokens
    if (s === 'WETH') return 'ETH';
    if (s === 'WBTC') return 'BTC';
    if (s === 'STETH' || s === 'WSTETH') return 'ETH';
    if (s === 'USDC.E' || s === 'USDC.P') return 'USDC';
    if (s === 'USDT.E' || s === 'USDT.P') return 'USDT';

    return s;
}

export function getTokenName(symbol: string): string {
    const normalized = normalizeSymbol(symbol);
    return TOKEN_METADATA[normalized]?.name || normalized;
}

export function getTokenColor(symbol: string): string {
    const normalized = normalizeSymbol(symbol);
    return TOKEN_METADATA[normalized]?.color || "#52525B"; // Zinc-600 default
}
