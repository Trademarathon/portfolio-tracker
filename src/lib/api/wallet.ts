import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ultraFetch, getLatencyTracker } from '@/lib/ultraFast';

/**
 * Fetch external APIs with resilient behavior across environments:
 * - Server/Tauri/static-export: direct request
 * - Browser + Next runtime: direct first, then /api/proxy fallback if needed
 */
async function fetchViaProxy(url: string, options?: RequestInit): Promise<Response> {
    if (typeof window === 'undefined') {
        return ultraFetch(url, options);
    }

    try {
        return await ultraFetch(url, options);
    } catch (directErr) {
        // If direct fetch fails (usually CORS in browser), try local proxy when available.
        let parsedBody: any = undefined;
        if (options?.body) {
            try {
                parsedBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            } catch {
                parsedBody = options.body;
            }
        }

        try {
            return await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    method: options?.method || 'GET',
                    headers: options?.headers,
                    body: parsedBody
                })
            });
        } catch {
            throw directErr;
        }
    }
}

// ============================================================================
// CHAIN CONFIGURATION - All Ledger & Trezor Supported Chains
// ============================================================================

export type ChainType =
    // EVM Chains
    | 'ETH' | 'ARB' | 'MATIC' | 'OP' | 'BASE' | 'BSC' | 'AVAX' | 'FTM' | 'CELO' | 'CRONOS' | 'GNOSIS' | 'LINEA' | 'SCROLL' | 'ZKSYNC' | 'MANTLE' | 'BLAST'
    // Non-EVM Chains
    | 'SOL' | 'BTC' | 'XRP' | 'HBAR' | 'SUI' | 'APT' | 'TON' | 'TRX' | 'NEAR' | 'COSMOS' | 'DOT' | 'ADA' | 'ALGO' | 'XLM' | 'DOGE' | 'LTC' | 'BCH' | 'XTZ' | 'EOS' | 'FIL' | 'VET' | 'EGLD' | 'KAVA' | 'INJ';

export interface ChainConfig {
    id: ChainType;
    name: string;
    symbol: string;
    decimals: number;
    addressFormat: 'evm' | 'base58' | 'bech32' | 'custom';
    addressPrefix?: string;
    ledgerSupport: boolean;
    trezorSupport: boolean;
    chainId?: number;
    api: {
        balance: string;
        history?: string;
        tokens?: string;
    };
    rpc?: string[];
}

// Comprehensive chain registry
export const CHAIN_CONFIGS: Record<ChainType, ChainConfig> = {
    // ===== EVM CHAINS =====
    ETH: {
        id: 'ETH', name: 'Ethereum', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 1,
        api: {
            balance: 'https://eth.blockscout.com/api',
            history: 'https://eth.blockscout.com/api',
            tokens: 'https://eth.blockscout.com/api'
        },
        rpc: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth']
    },
    ARB: {
        id: 'ARB', name: 'Arbitrum', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 42161,
        api: { balance: 'https://arbitrum.blockscout.com/api' },
        rpc: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com']
    },
    MATIC: {
        id: 'MATIC', name: 'Polygon', symbol: 'MATIC', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 137,
        api: { balance: 'https://polygon.blockscout.com/api' },
        rpc: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com']
    },
    OP: {
        id: 'OP', name: 'Optimism', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 10,
        api: { balance: 'https://optimism.blockscout.com/api' },
        rpc: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com']
    },
    BASE: {
        id: 'BASE', name: 'Base', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 8453,
        api: { balance: 'https://base.blockscout.com/api' },
        rpc: ['https://mainnet.base.org', 'https://base.llamarpc.com']
    },
    BSC: {
        id: 'BSC', name: 'BNB Chain', symbol: 'BNB', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 56,
        api: { balance: 'https://api.bscscan.com/api' },
        rpc: ['https://bsc-dataseed.binance.org', 'https://binance.llamarpc.com']
    },
    AVAX: {
        id: 'AVAX', name: 'Avalanche C-Chain', symbol: 'AVAX', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 43114,
        api: { balance: 'https://api.snowtrace.io/api' },
        rpc: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.llamarpc.com']
    },
    FTM: {
        id: 'FTM', name: 'Fantom', symbol: 'FTM', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 250,
        // Legacy ftmscan endpoints are no longer resolvable; rely on RPC fallback.
        api: { balance: '' },
        rpc: ['https://rpcapi.fantom.network', 'https://1rpc.io/ftm']
    },
    CELO: {
        id: 'CELO', name: 'Celo', symbol: 'CELO', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        chainId: 42220,
        api: { balance: 'https://api.celoscan.io/api' },
        rpc: ['https://forno.celo.org']
    },
    CRONOS: {
        id: 'CRONOS', name: 'Cronos', symbol: 'CRO', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        chainId: 25,
        api: { balance: 'https://cronos.org/explorer/api' },
        rpc: ['https://evm.cronos.org']
    },
    GNOSIS: {
        id: 'GNOSIS', name: 'Gnosis Chain', symbol: 'xDAI', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: true,
        chainId: 100,
        api: { balance: 'https://gnosis.blockscout.com/api' },
        rpc: ['https://rpc.gnosischain.com']
    },
    LINEA: {
        id: 'LINEA', name: 'Linea', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        chainId: 59144,
        api: { balance: 'https://api.lineascan.build/api' },
        rpc: ['https://rpc.linea.build']
    },
    SCROLL: {
        id: 'SCROLL', name: 'Scroll', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        chainId: 534352,
        api: { balance: 'https://api.scrollscan.com/api' },
        rpc: ['https://rpc.scroll.io']
    },
    ZKSYNC: {
        id: 'ZKSYNC', name: 'zkSync Era', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        chainId: 324,
        api: { balance: 'https://block-explorer-api.mainnet.zksync.io/api' },
        rpc: ['https://mainnet.era.zksync.io']
    },
    MANTLE: {
        id: 'MANTLE', name: 'Mantle', symbol: 'MNT', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        chainId: 5000,
        api: { balance: 'https://explorer.mantle.xyz/api' },
        rpc: ['https://rpc.mantle.xyz']
    },
    BLAST: {
        id: 'BLAST', name: 'Blast', symbol: 'ETH', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        chainId: 81457,
        api: { balance: 'https://api.blastscan.io/api' },
        rpc: ['https://rpc.blast.io']
    },

    // ===== NON-EVM CHAINS =====
    SOL: {
        id: 'SOL', name: 'Solana', symbol: 'SOL', decimals: 9,
        addressFormat: 'base58', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://api.mainnet-beta.solana.com' }
    },
    BTC: {
        id: 'BTC', name: 'Bitcoin', symbol: 'BTC', decimals: 8,
        addressFormat: 'custom', ledgerSupport: true, trezorSupport: true,
        api: {
            balance: 'https://blockchain.info/rawaddr',
            history: 'https://blockchain.info/rawaddr'
        }
    },
    XRP: {
        id: 'XRP', name: 'XRP Ledger', symbol: 'XRP', decimals: 6,
        addressFormat: 'custom', addressPrefix: 'r', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://api.xrpscan.com/api/v1/account' }
    },
    HBAR: {
        id: 'HBAR', name: 'Hedera', symbol: 'HBAR', decimals: 8,
        addressFormat: 'custom', addressPrefix: '0.0.', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://mainnet-public.mirrornode.hedera.com/api/v1/accounts' }
    },
    SUI: {
        id: 'SUI', name: 'Sui', symbol: 'SUI', decimals: 9,
        addressFormat: 'custom', addressPrefix: '0x', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://fullnode.mainnet.sui.io' }
    },
    APT: {
        id: 'APT', name: 'Aptos', symbol: 'APT', decimals: 8,
        addressFormat: 'custom', addressPrefix: '0x', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://fullnode.mainnet.aptoslabs.com/v1/accounts' }
    },
    TON: {
        id: 'TON', name: 'TON', symbol: 'TON', decimals: 9,
        addressFormat: 'custom', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://toncenter.com/api/v2/getAddressInformation' }
    },
    TRX: {
        id: 'TRX', name: 'Tron', symbol: 'TRX', decimals: 6,
        addressFormat: 'custom', addressPrefix: 'T', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://api.trongrid.io/v1/accounts' }
    },
    NEAR: {
        id: 'NEAR', name: 'NEAR Protocol', symbol: 'NEAR', decimals: 24,
        addressFormat: 'custom', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://rpc.mainnet.near.org' }
    },
    COSMOS: {
        id: 'COSMOS', name: 'Cosmos Hub', symbol: 'ATOM', decimals: 6,
        addressFormat: 'bech32', addressPrefix: 'cosmos', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances' }
    },
    DOT: {
        id: 'DOT', name: 'Polkadot', symbol: 'DOT', decimals: 10,
        addressFormat: 'custom', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://polkadot.api.subscan.io/api/v2/scan/account/tokens' }
    },
    ADA: {
        id: 'ADA', name: 'Cardano', symbol: 'ADA', decimals: 6,
        addressFormat: 'bech32', addressPrefix: 'addr', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://cardano-mainnet.blockfrost.io/api/v0/addresses' }
    },
    ALGO: {
        id: 'ALGO', name: 'Algorand', symbol: 'ALGO', decimals: 6,
        addressFormat: 'custom', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://mainnet-api.algonode.cloud/v2/accounts' }
    },
    XLM: {
        id: 'XLM', name: 'Stellar', symbol: 'XLM', decimals: 7,
        addressFormat: 'custom', addressPrefix: 'G', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://horizon.stellar.org/accounts' }
    },
    DOGE: {
        id: 'DOGE', name: 'Dogecoin', symbol: 'DOGE', decimals: 8,
        addressFormat: 'custom', addressPrefix: 'D', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://dogechain.info/api/v1/address/balance' }
    },
    LTC: {
        id: 'LTC', name: 'Litecoin', symbol: 'LTC', decimals: 8,
        addressFormat: 'custom', addressPrefix: 'L', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://ltc.blockchair.com/api' }
    },
    BCH: {
        id: 'BCH', name: 'Bitcoin Cash', symbol: 'BCH', decimals: 8,
        addressFormat: 'custom', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://rest.bitcoin.com/v2/address/details' }
    },
    XTZ: {
        id: 'XTZ', name: 'Tezos', symbol: 'XTZ', decimals: 6,
        addressFormat: 'custom', addressPrefix: 'tz', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://api.tzkt.io/v1/accounts' }
    },
    EOS: {
        id: 'EOS', name: 'EOS', symbol: 'EOS', decimals: 4,
        addressFormat: 'custom', ledgerSupport: true, trezorSupport: true,
        api: { balance: 'https://eos.greymass.com/v1/chain/get_account' }
    },
    FIL: {
        id: 'FIL', name: 'Filecoin', symbol: 'FIL', decimals: 18,
        addressFormat: 'custom', addressPrefix: 'f', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://api.filscan.io/api/v1/address' }
    },
    VET: {
        id: 'VET', name: 'VeChain', symbol: 'VET', decimals: 18,
        addressFormat: 'evm', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://vethor-node.vechain.com/accounts' }
    },
    EGLD: {
        id: 'EGLD', name: 'MultiversX', symbol: 'EGLD', decimals: 18,
        addressFormat: 'bech32', addressPrefix: 'erd', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://api.multiversx.com/accounts' }
    },
    KAVA: {
        id: 'KAVA', name: 'Kava', symbol: 'KAVA', decimals: 6,
        addressFormat: 'bech32', addressPrefix: 'kava', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://api.kava.io/cosmos/bank/v1beta1/balances' }
    },
    INJ: {
        id: 'INJ', name: 'Injective', symbol: 'INJ', decimals: 18,
        addressFormat: 'bech32', addressPrefix: 'inj', ledgerSupport: true, trezorSupport: false,
        api: { balance: 'https://lcd.injective.network/cosmos/bank/v1beta1/balances' }
    }
};

// Get chains by hardware wallet support
export function getSupportedChains(wallet: 'ledger' | 'trezor'): ChainType[] {
    return Object.values(CHAIN_CONFIGS)
        .filter(c => wallet === 'ledger' ? c.ledgerSupport : c.trezorSupport)
        .map(c => c.id);
}

// EVM chains list for easy access
export const EVM_CHAINS: ChainType[] = ['ETH', 'ARB', 'MATIC', 'OP', 'BASE', 'BSC', 'AVAX', 'FTM', 'CELO', 'CRONOS', 'GNOSIS', 'LINEA', 'SCROLL', 'ZKSYNC', 'MANTLE', 'BLAST'];

// Legacy compatibility maps
const BLOCKSCOUT_API: { [key: string]: string } = {};
const RPC_CONFIG: { [key: string]: string[] } = {};

// Build legacy maps from new config
EVM_CHAINS.forEach(chain => {
    const config = CHAIN_CONFIGS[chain];
    if (config.api.balance) BLOCKSCOUT_API[chain] = config.api.balance;
    if (config.rpc) RPC_CONFIG[chain] = config.rpc;
});

function getEvmChainId(chain: ChainType): number | undefined {
    return CHAIN_CONFIGS[chain]?.chainId;
}

const RPC_HEALTH_CACHE = new Map<string, { ok: boolean; ts: number }>();
const RPC_OK_TTL_MS = 5 * 60 * 1000;
const RPC_FAIL_TTL_MS = 60 * 1000;

async function probeRpc(url: string, chainId?: number): Promise<boolean> {
    const cached = RPC_HEALTH_CACHE.get(url);
    if (cached) {
        const ttl = cached.ok ? RPC_OK_TTL_MS : RPC_FAIL_TTL_MS;
        if (Date.now() - cached.ts < ttl) return cached.ok;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
        const response = await fetchViaProxy(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
            signal: controller.signal
        });
        const raw = await response.text();
        if (!raw) return false;
        let data: any;
        try {
            data = JSON.parse(raw);
        } catch {
            return false;
        }
        if (!data?.result) {
            RPC_HEALTH_CACHE.set(url, { ok: false, ts: Date.now() });
            return false;
        }
        if (!chainId) {
            RPC_HEALTH_CACHE.set(url, { ok: true, ts: Date.now() });
            return true;
        }
        const parsed = typeof data.result === 'string' ? parseInt(data.result, 16) : Number(data.result);
        const ok = Number.isFinite(parsed) && parsed === chainId;
        RPC_HEALTH_CACHE.set(url, { ok, ts: Date.now() });
        return ok;
    } catch {
        RPC_HEALTH_CACHE.set(url, { ok: false, ts: Date.now() });
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export async function getEvmPortfolio(address: string, chain: 'ETH' | 'ARB' | 'MATIC' | 'OP' | 'BASE' | 'BSC' | 'AVAX' = 'ETH'): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    const nativeSymbol = CHAIN_CONFIGS[chain]?.symbol || 'ETH';

    // 1. Fetch Native Balance & Token List via Blockscout (The "Deep" Way)
    // Blockscout 'tokenlist' usually returns all ERC20/721 held by address
    const apiUrl = BLOCKSCOUT_API[chain];

    if (apiUrl) {
        try {
            // Fetch Tokens
            const tokenRes = await fetchViaProxy(`${apiUrl}?module=account&action=tokenlist&address=${address}`);
            const tokenRaw = await tokenRes.text();
            let tokenData: any = null;
            if (tokenRaw) {
                try {
                    tokenData = JSON.parse(tokenRaw);
                } catch {
                    tokenData = null;
                }
            }

            if (tokenData && tokenData.status === '1' && Array.isArray(tokenData.result)) {
                tokenData.result.forEach((t: any) => {
                    // Filter for meaningful balance
                    if (t.balance && t.decimals && t.symbol) {
                        const decimals = parseInt(t.decimals);
                        const rawBalance = parseFloat(t.balance);
                        if (rawBalance > 0) {
                            const balance = rawBalance / Math.pow(10, decimals);
                            // Filter dust (optional, but keeps UI clean)
                            if (balance * (parseFloat(t.exchange_rate) || 0) > 0.01 || balance > 0.0001) {
                                balances.push({
                                    symbol: t.symbol,
                                    balance: balance
                                });
                            }
                        }
                    }
                });
            }

            // Fetch Native Balance separately if not in token list (it usually isn't)
            const nativeRes = await fetchViaProxy(`${apiUrl}?module=account&action=balance&address=${address}`);
            const nativeRaw = await nativeRes.text();
            let nativeData: any = null;
            if (nativeRaw) {
                try {
                    nativeData = JSON.parse(nativeRaw);
                } catch {
                    nativeData = null;
                }
            }

            if (nativeData && nativeData.status === '1') {
                const nativeVal = parseFloat(nativeData.result);
                if (nativeVal > 0) {
                    balances.push({
                        symbol: nativeSymbol,
                        balance: nativeVal / 1e18
                    });
                }
            }

            // If we found data, return early. Use RPC fallback only if API fails/returns nothing.
            if (balances.length > 0) return balances;

        } catch (e) {
            console.warn(`[DeepPortfolio] Blockscout failed for ${chain}, falling back to RPC`, e);
        }
    }

    // Fallback: Use RPC and Hardcoded list (Legacy/Reliability Backup)
    const urls = RPC_CONFIG[chain] || RPC_CONFIG['ETH'];
    let provider = null;
    let success = false;
    const chainId = getEvmChainId(chain);

    for (const url of urls) {
        try {
            const ok = await probeRpc(url, chainId);
            if (!ok) continue;
            provider = new ethers.JsonRpcProvider(url, chainId ? { name: chain, chainId } : undefined, { staticNetwork: true });
            success = true;
            break;
        } catch (_e) { /* ignore */ }
    }

    if (!success || !provider) return [];

    try {
        const nativeBalance = await provider.getBalance(address);
        if (nativeBalance > BigInt(0)) {
            balances.push({
                symbol: nativeSymbol,
                balance: parseFloat(ethers.formatEther(nativeBalance))
            });
        }

        // Note: We skip the hardcoded list here to avoid duplication if the API partially worked. 
        // But if API completely failed (balances empty), we could try the hardcoded list.
        // For now, let's keep the fallback simple (Native only) to avoid huge file size with lists.
        // Or if user really wants specific tokens, we can re-add the list. 
        // Given "Deep" requirement, API is the way.

    } catch (e) {
        console.warn(`RPC Fallback Error (${chain}):`, e);
    }

    return balances;
}

// Legacy support
export async function getEvmBalance(address: string, rpcUrl = 'https://rpc.ankr.com/eth'): Promise<number> {
    const portfolio = await getEvmPortfolio(address, rpcUrl.includes('arbitrum') ? 'ARB' : 'ETH');
    const native = portfolio.find(p => p.symbol === 'ETH');
    return native ? native.balance : 0;
}

// Solana
export async function getSolanaPortfolio(address: string): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    try {
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const pubKey = new PublicKey(address);

        // 1. Native SOL
        const solBalance = await connection.getBalance(pubKey);
        if (solBalance > 0) {
            balances.push({ symbol: 'SOL', balance: solBalance / 1e9 });
        }

        // 2. SPL Tokens
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
            programId: TOKEN_PROGRAM_ID
        });

        tokenAccounts.value.forEach((accountInfo) => {
            const parsedInfo = accountInfo.account.data.parsed.info;
            const mintAddress = parsedInfo.mint;
            const amount = parsedInfo.tokenAmount.uiAmount;

            if (amount > 0) {
                // Map common mints to symbols (or use a list)
                let symbol = 'Unknown';
                if (mintAddress === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') symbol = 'USDC';
                else if (mintAddress === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') symbol = 'USDT';
                else if (mintAddress === 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263') symbol = 'BONK';
                else if (mintAddress === 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm') symbol = 'WIF';
                else if (mintAddress === 'JUPyiwrYJFskUPiHa7hkeR8VUtkqj20HMNtjKeOV2T8') symbol = 'JUP';
                else if (mintAddress === 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So') symbol = 'mSOL';
                else if (mintAddress === 'HzwqbKZw8JxJG80C4hE8t3Q6bT4kK3q3k7aK3jK3k3k3') symbol = 'PYTH';
                else if (mintAddress === '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs') symbol = 'WETH';
                else if (mintAddress === '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh') symbol = 'WBTC';
                else {
                    // Fallback to truncated mint address for visibility
                    symbol = `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`;
                }

                balances.push({ symbol, balance: amount });
            }
        });

    } catch (e) {
        console.warn("Solana Portfolio Error:", e);
    }
    return balances;
}

// Bitcoin
export async function getBitcoinPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await ultraFetch(`https://blockchain.info/rawaddr/${address}`);
        if (!response.ok) throw new Error('BTC Fetch Failed');
        const data = await response.json();
        return [{
            symbol: 'BTC',
            balance: data.final_balance / 1e8
        }];
    } catch (e) {
        try {
            const fallback = await ultraFetch(`https://blockstream.info/api/address/${address}`);
            if (!fallback.ok) throw new Error('Blockstream BTC Fetch Failed');
            const data = await fallback.json();
            const chain = data?.chain_stats;
            const mempool = data?.mempool_stats;
            const funded = Number(chain?.funded_txo_sum || 0) + Number(mempool?.funded_txo_sum || 0);
            const spent = Number(chain?.spent_txo_sum || 0) + Number(mempool?.spent_txo_sum || 0);
            const sats = Math.max(funded - spent, 0);
            return [{ symbol: 'BTC', balance: sats / 1e8 }];
        } catch (fallbackErr) {
            try {
                const mempoolRes = await ultraFetch(`https://mempool.space/api/address/${address}`);
                if (!mempoolRes.ok) throw new Error('Mempool BTC Fetch Failed');
                const data = await mempoolRes.json();
                const chain = data?.chain_stats;
                const mempool = data?.mempool_stats;
                const funded = Number(chain?.funded_txo_sum || 0) + Number(mempool?.funded_txo_sum || 0);
                const spent = Number(chain?.spent_txo_sum || 0) + Number(mempool?.spent_txo_sum || 0);
                const sats = Math.max(funded - spent, 0);
                return [{ symbol: 'BTC', balance: sats / 1e8 }];
            } catch (lastErr) {
                console.warn("BTC Portfolio Error:", e);
                console.warn("BTC Fallback Error:", fallbackErr);
                console.warn("BTC Mempool Error:", lastErr);
                return [];
            }
        }
    }
}

// Hedera
export async function getHederaPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        // address is account ID like 0.0.12345
        const response = await ultraFetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`);
        if (!response.ok) {
            console.warn(`HBAR API returned ${response.status} for ${address}`);
            return [];
        }
        const data = await response.json();

        // Handle different response structures
        let balance = 0;
        if (data.balance) {
            // New API format: balance.balance
            balance = typeof data.balance.balance === 'number'
                ? data.balance.balance / 1e8
                : parseFloat(data.balance.balance || '0') / 1e8;
        } else if (data.account) {
            // Alternative format: account.balance
            balance = parseFloat(data.account.balance || '0') / 1e8;
        }

        return balance > 0 ? [{ symbol: 'HBAR', balance }] : [];
    } catch (e) {
        console.warn("HBAR Portfolio Error:", e);
        return [];
    }
}

// History Fetchers
export async function getEvmHistory(address: string, chain: string): Promise<any[]> {
    try {
        let baseUrl = 'https://eth.blockscout.com/api';
        if (chain === 'MATIC') baseUrl = 'https://polygon.blockscout.com/api';
        if (chain === 'ARB') baseUrl = 'https://arbitrum.blockscout.com/api';
        if (chain === 'OP') baseUrl = 'https://optimism.blockscout.com/api';
        if (chain === 'BASE') baseUrl = 'https://base.blockscout.com/api';
        if (chain === 'BSC') baseUrl = 'https://bsc.blockscout.com/api';

        // Fetch both native and token transfers
        const [nativeRes, tokenRes] = await Promise.all([
            fetch(`${baseUrl}?module=account&action=txlist&address=${address}&offset=100&sort=desc`).then(r => r.json()),
            fetch(`${baseUrl}?module=account&action=tokentx&address=${address}&offset=100&sort=desc`).then(r => r.json())
        ]);

        const txs: any[] = [];

        if (nativeRes.status === '1' && Array.isArray(nativeRes.result)) {
            nativeRes.result.forEach((tx: any) => {
                if (parseFloat(tx.value) > 0) {
                    txs.push({
                        id: tx.hash,
                        timestamp: parseInt(tx.timeStamp) * 1000,
                        symbol: chain === 'MATIC' ? 'MATIC' : chain === 'BSC' ? 'BNB' : 'ETH',
                        side: tx.from.toLowerCase() === address.toLowerCase() ? 'sell' : 'buy',
                        type: tx.from.toLowerCase() === address.toLowerCase() ? 'Withdraw' : 'Deposit',
                        price: 0,
                        amount: parseFloat(ethers.formatEther(tx.value)),
                        exchange: chain,
                        status: 'Confirmed',
                        txHash: tx.hash,
                        from: tx.from,
                        to: tx.to,
                        address: tx.from.toLowerCase() === address.toLowerCase() ? tx.to : tx.from,
                        chain,
                        network: chain,
                        gasUsed: tx.gasUsed ? parseFloat(tx.gasUsed) : undefined,
                        gasPrice: tx.gasPrice ? parseFloat(tx.gasPrice) : undefined,
                        fee: tx.gasUsed && tx.gasPrice ? (parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice)) / 1e18 : undefined,
                        feeAsset: chain === 'MATIC' ? 'MATIC' : chain === 'BSC' ? 'BNB' : 'ETH',
                        sourceType: 'wallet',
                    });
                }
            });
        }

        if (tokenRes.status === '1' && Array.isArray(tokenRes.result)) {
            tokenRes.result.forEach((tx: any) => {
                txs.push({
                    id: `${tx.hash}-${tx.tokenSymbol}`,
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    symbol: tx.tokenSymbol,
                    side: tx.from.toLowerCase() === address.toLowerCase() ? 'sell' : 'buy',
                    type: tx.from.toLowerCase() === address.toLowerCase() ? 'Withdraw' : 'Deposit',
                    price: 0,
                    amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
                    exchange: chain,
                    status: 'Confirmed',
                    txHash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    address: tx.from.toLowerCase() === address.toLowerCase() ? tx.to : tx.from,
                    chain,
                    network: chain,
                    tokenContract: tx.contractAddress,
                    fee: tx.gasUsed && tx.gasPrice ? (parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice)) / 1e18 : undefined,
                    feeAsset: chain === 'MATIC' ? 'MATIC' : chain === 'BSC' ? 'BNB' : 'ETH',
                    sourceType: 'wallet',
                });
            });
        }

        return txs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
    } catch (e) {
        console.warn("EVM History Error:", e);
        return [];
    }
}

export async function getSolanaHistory(address: string): Promise<any[]> {
    try {
        const response = await ultraFetch('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [address, { limit: 100 }]
            })
        });

        if (!response.ok) return [];
        const data = await response.json();

        if (data.result && Array.isArray(data.result)) {
            return data.result.map((sig: any) => ({
                id: sig.signature,
                timestamp: sig.blockTime * 1000,
                symbol: 'SOL',
                side: 'transfer',
                type: 'Transfer',
                price: 0,
                amount: 0, // Discovery: getSignatures doesn't give amount
                exchange: 'Solana',
                status: sig.confirmationStatus || 'confirmed',
                txHash: sig.signature,
                chain: 'SOL',
                network: 'SOL',
                sourceType: 'wallet',
            }));
        }
        return [];
    } catch (e) {
        console.warn("Solana History Error:", e);
        return [];
    }
}

// Sui - RPC endpoints (public fullnode is rate-limited, use fallbacks)
const SUI_RPC_ENDPOINTS = [
    'https://fullnode.mainnet.sui.io',
    'https://rpc.ankr.com/sui',
    'https://sui-rpc.publicnode.com',
];

async function trySuiRpc(address: string): Promise<TokenBalance[]> {
    const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getAllBalances',
        params: [address]
    };

    for (const endpoint of SUI_RPC_ENDPOINTS) {
        try {
            const response = await ultraFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (data.error) {
                console.warn(`SUI RPC Error (${endpoint}):`, data.error);
                continue;
            }

            if (!data.result || !Array.isArray(data.result)) return [];

            return data.result.map((b: any) => {
                let symbol = 'SUI';
                if (b.coinType && b.coinType !== '0x2::sui::SUI') {
                    const parts = b.coinType.split('::');
                    symbol = (parts[parts.length - 1] || 'SUI').replace(/^[0-9]+_/, '');
                }

                let balance = 0;
                try {
                    const totalBalance = b.totalBalance ?? b.balance ?? '0';
                    balance = parseFloat(String(totalBalance)) / 1e9;
                } catch (e) {
                    console.warn(`Failed to parse SUI balance for ${symbol}:`, e);
                }

                return { symbol, balance };
            }).filter((b: { symbol: string; balance: number }) => b.balance > 0);
        } catch (e) {
            console.warn(`SUI RPC failed (${endpoint}):`, e);
            continue;
        }
    }
    return [];
}

export async function getSuiPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        if (!address || !address.startsWith('0x')) return [];
        return await trySuiRpc(address);
    } catch (e) {
        console.warn("SUI Portfolio Error:", e);
        return [];
    }
}

export async function getSuiHistory(address: string): Promise<any[]> {
    try {
        if (!address || !address.startsWith('0x')) return [];
        const endpoint = SUI_RPC_ENDPOINTS[0];
        const response = await ultraFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_queryTransactionBlocks',
                params: [{ filter: { FromAddress: address }, options: { showEffects: true, showTimestamp: true } }, null, 50, true]
            })
        });
        const data = await response.json();
        if (!data.result || !data.result.data) return [];

        return data.result.data.map((tx: any) => ({
            id: tx.digest,
            timestamp: parseInt(tx.timestampMs),
            symbol: 'SUI',
            side: 'sell',
            type: 'Transfer',
            price: 0,
            amount: 0,
            exchange: 'Sui',
            status: tx.effects.status.status === 'success' ? 'Confirmed' : 'Failed',
            txHash: tx.digest,
            chain: 'SUI',
            network: 'SUI',
            sourceType: 'wallet',
        }));
    } catch (e) {
        console.error("SUI History Error:", e);
        return [];
    }
}

// Aptos
const APTOS_GRAPHQL_URL = 'https://api.mainnet.aptoslabs.com/v1/graphql';
const APTOS_FULLNODE_URL = 'https://fullnode.mainnet.aptoslabs.com/v1';

function normalizeAptosAddress(raw: string): string | null {
    const trimmed = String(raw || '').trim().toLowerCase();
    if (!trimmed) return null;
    const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
    const hex = prefixed.slice(2);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    if (hex.length === 0 || hex.length > 64) return null;
    return `0x${hex.padStart(64, '0')}`;
}

function aptosTypeToSymbol(typeValue: string | undefined | null): string {
    const raw = String(typeValue || '');
    if (!raw || raw.includes('aptos_coin::AptosCoin')) return 'APT';
    const parts = raw.split('::').filter(Boolean);
    return parts[parts.length - 1] || 'APT';
}

function sanitizeAptosSymbol(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const symbol = String(raw).trim().toUpperCase();
    // Keep native APT always.
    if (symbol === 'APT') return 'APT';
    // Filter obvious parser garbage and unsupported symbols.
    if (symbol.length < 2 || symbol.length > 16) return null;
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(symbol)) return null;
    // Reject very generic placeholders often returned from type suffixes.
    if (['COIN', 'TOKEN', 'ASSET'].includes(symbol)) return null;
    return symbol;
}

export async function getAptosPortfolio(address: string): Promise<TokenBalance[]> {
    const normalizedAddress = normalizeAptosAddress(address);
    if (!normalizedAddress) return [];

    const bySymbol = new Map<string, number>();
    const addBalance = (rawSymbol: string | undefined | null, rawBalance: number) => {
        if (!Number.isFinite(rawBalance) || rawBalance <= 0) return;
        const symbol = sanitizeAptosSymbol(rawSymbol);
        if (!symbol) return;
        bySymbol.set(symbol, (bySymbol.get(symbol) || 0) + rawBalance);
    };

    try {
        // Supported Aptos indexer table (current_coin_balances is deprecated)
        const query = `
            query getAccountBalances($address: String!, $limit: Int!, $offset: Int!) {
                current_fungible_asset_balances(
                    where: { owner_address: { _eq: $address } }
                    limit: $limit
                    offset: $offset
                ) {
                    amount
                    asset_type
                    metadata {
                        symbol
                        decimals
                    }
                }
            }
        `;

        const PAGE_SIZE = 200;
        const MAX_PAGES = 10;
        for (let page = 0; page < MAX_PAGES; page++) {
            const body = JSON.stringify({
                query,
                variables: { address: normalizedAddress, limit: PAGE_SIZE, offset: page * PAGE_SIZE }
            });
            const response = await ultraFetch(APTOS_GRAPHQL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            }, 6000);

            if (!response.ok) {
                console.warn(`Aptos Indexer returned ${response.status} for ${normalizedAddress}`);
                break;
            }

            const payload = await response.json().catch(() => null) as any;
            if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
                console.warn(`Aptos Indexer GraphQL error for ${normalizedAddress}:`, payload.errors?.[0]?.message || payload.errors?.[0]);
                break;
            }

            const rows = Array.isArray(payload?.data?.current_fungible_asset_balances)
                ? payload.data.current_fungible_asset_balances
                : [];
            if (rows.length === 0) break;

            for (const fa of rows) {
                const amount = parseFloat(String(fa?.amount ?? '0')) || 0;
                if (amount <= 0) continue;
                const decimalsRaw = Number(fa?.metadata?.decimals);
                const decimals = Number.isFinite(decimalsRaw) && decimalsRaw >= 0 && decimalsRaw <= 30 ? decimalsRaw : 8;
                const balanceValue = amount / Math.pow(10, decimals);
                if (balanceValue <= 0) continue;

                const symbol =
                    sanitizeAptosSymbol(fa?.metadata?.symbol) ||
                    sanitizeAptosSymbol(aptosTypeToSymbol(fa?.asset_type));
                addBalance(symbol, balanceValue);
            }

            if (rows.length < PAGE_SIZE) break;
        }

        // Fallback path: fullnode legacy CoinStore resources (covers wallets where indexer data is delayed/unavailable)
        if (bySymbol.size === 0) {
            const resourcesRes = await ultraFetch(`${APTOS_FULLNODE_URL}/accounts/${normalizedAddress}/resources`, {}, 7000);
            if (resourcesRes.ok) {
                const resources = await resourcesRes.json().catch(() => []) as any[];
                if (Array.isArray(resources)) {
                    for (const r of resources) {
                        const type = String(r?.type || '');
                        if (!type.includes('::coin::CoinStore<')) continue;
                        const lt = type.indexOf('<');
                        const gt = type.lastIndexOf('>');
                        if (lt < 0 || gt <= lt) continue;
                        const coinType = type.slice(lt + 1, gt);
                        const raw = parseFloat(String(r?.data?.coin?.value ?? '0')) || 0;
                        if (raw <= 0) continue;
                        addBalance(aptosTypeToSymbol(coinType), raw / 1e8);
                    }
                }
            }
        }

        return Array.from(bySymbol.entries()).map(([symbol, balance]) => ({ symbol, balance }));
    } catch (e) {
        console.warn("Aptos Portfolio Error:", e);
        return [];
    }
}

export async function getAptosHistory(address: string): Promise<any[]> {
    try {
        const normalizedAddress = normalizeAptosAddress(address) || address;
        const response = await ultraFetch(`${APTOS_FULLNODE_URL}/accounts/${normalizedAddress}/transactions?limit=50`);
        if (!response.ok) return [];
        const data = await response.json();

        return data.map((tx: any) => ({
            id: tx.hash,
            timestamp: parseInt(tx.timestamp) / 1000,
            symbol: 'APT',
            side: 'sell',
            type: 'Transfer',
            price: 0,
            amount: 0,
            exchange: 'Aptos',
            status: tx.success ? 'Confirmed' : 'Failed',
            txHash: tx.hash,
            from: tx.sender,
            chain: 'APT',
            network: 'APT',
            sourceType: 'wallet',
        }));
    } catch (e) {
        console.error("Aptos History Error:", e);
        return [];
    }
}

// TON
export async function getTonPortfolio(address: string): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    const encodedAddress = encodeURIComponent(address);
    try {
        // 1. Native TON balance - Use toncenter
        const nativeRes = await fetchViaProxy(`https://toncenter.com/api/v2/getAddressInformation?address=${encodedAddress}`);
        const nativeData = await nativeRes.json();

        if (nativeData.ok && nativeData.result && nativeData.result.balance !== undefined) {
            balances.push({
                symbol: 'TON',
                balance: parseInt(nativeData.result.balance) / 1e9
            });
        }

        // 2. Jetton balances (All other tickers) - Use tonapi.io
        // This fetches all tokens (Jettons) in a single call
        const jettonRes = await fetchViaProxy(`https://tonapi.io/v2/accounts/${encodedAddress}/jettons`);
        if (jettonRes.ok) {
            const jettonData = await jettonRes.json();
            if (jettonData.balances && Array.isArray(jettonData.balances)) {
                jettonData.balances.forEach((j: any) => {
                    const symbol = j.jetton?.symbol;
                    const rawBalance = j.balance;

                    if (symbol && rawBalance) {
                        const decimals = j.jetton.decimals || 9;
                        const balanceValue = parseFloat(rawBalance) / Math.pow(10, decimals);
                        if (balanceValue > 0) {
                            balances.push({
                                symbol: symbol.toUpperCase(),
                                balance: balanceValue
                            });
                        }
                    }
                });
            }
        }

        return balances;
    } catch (e) {
        console.warn("TON Portfolio Error:", e);
        return balances; // Return whatever we managed to fetch
    }
}

export async function getTonHistory(address: string): Promise<any[]> {
    try {
        const response = await fetchViaProxy(`https://toncenter.com/api/v2/getTransactions?address=${address}&limit=50`);
        const data = await response.json();
        if (!data.ok || !data.result) return [];

        return data.result.map((tx: any) => ({
            id: tx.transaction_id.hash,
            timestamp: tx.utime * 1000,
            symbol: 'TON',
            side: 'transfer',
            type: 'Transfer',
            price: 0,
            amount: parseInt(tx.in_msg?.value || tx.out_msgs?.[0]?.value || 0) / 1e9,
            exchange: 'TON',
            status: 'Confirmed',
            txHash: tx.transaction_id.hash,
            from: tx.in_msg?.source,
            to: tx.in_msg?.destination || tx.out_msgs?.[0]?.destination,
            address: tx.in_msg?.source || tx.out_msgs?.[0]?.destination,
            chain: 'TON',
            network: 'TON',
            fee: tx.fee ? parseFloat(tx.fee) / 1e9 : undefined,
            feeAsset: 'TON',
            sourceType: 'wallet',
        }));
    } catch (e) {
        console.error("TON History Error:", e);
        return [];
    }
}

// TRON
export async function getTronPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await ultraFetch(`https://api.trongrid.io/v1/accounts/${address}`);
        const data = await response.json();
        if (!data.data || !data.data[0]) return [];

        const balances: TokenBalance[] = [];
        const account = data.data[0];

        // Native TRX
        if (account.balance) {
            balances.push({
                symbol: 'TRX',
                balance: account.balance / 1e6
            });
        }

        // TRC20 tokens
        if (account.trc20) {
            Object.entries(account.trc20).forEach(([contract, amount]: [string, any]) => {
                // Map common contracts to symbols
                let symbol = 'TRC20';
                if (contract === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t') symbol = 'USDT';
                if (contract === 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8') symbol = 'USDC';

                balances.push({
                    symbol,
                    balance: parseFloat(amount) / 1e6
                });
            });
        }

        return balances;
    } catch (e) {
        console.warn("TRON Portfolio Error:", e);
        return [];
    }
}

export async function getTronHistory(address: string): Promise<any[]> {
    try {
        const response = await ultraFetch(`https://api.trongrid.io/v1/accounts/${address}/transactions?limit=50`);
        const data = await response.json();
        if (!data.data) return [];

        return data.data.map((tx: any) => ({
            id: tx.txID,
            timestamp: tx.block_timestamp,
            symbol: 'TRX',
            side: 'transfer',
            type: 'Transfer',
            price: 0,
            amount: 0,
            exchange: 'TRON',
            status: tx.ret?.[0]?.contractRet === 'SUCCESS' ? 'Confirmed' : 'Failed',
            txHash: tx.txID,
            from: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address,
            to: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address,
            chain: 'TRX',
            network: 'TRX',
            sourceType: 'wallet',
        }));
    } catch (e) {
        console.error("TRON History Error:", e);
        return [];
    }
}

// XRP (Ripple)
export async function getXrpPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await ultraFetch(`https://api.xrpscan.com/api/v1/account/${address}`);
        if (!response.ok) {
            console.warn(`XRP API returned ${response.status} for ${address}`);
            return [];
        }
        const data = await response.json();

        const balances: TokenBalance[] = [];

        // Native XRP balance
        if (data.xrpBalance) {
            const balance = parseFloat(data.xrpBalance);
            if (balance > 0) {
                balances.push({ symbol: 'XRP', balance });
            }
        }

        // Trustline tokens (issued currencies)
        if (data.trustlines && Array.isArray(data.trustlines)) {
            data.trustlines.forEach((tl: any) => {
                const balance = parseFloat(tl.balance || '0');
                if (balance > 0) {
                    balances.push({
                        symbol: tl.currency || 'Unknown',
                        balance
                    });
                }
            });
        }

        return balances;
    } catch (e) {
        console.warn("XRP Portfolio Error:", e);
        return [];
    }
}

export async function getXrpHistory(address: string): Promise<any[]> {
    try {
        const response = await ultraFetch(`https://api.xrpscan.com/api/v1/account/${address}/transactions?limit=50`);
        if (!response.ok) return [];
        const data = await response.json();

        if (!data.transactions || !Array.isArray(data.transactions)) return [];

        return data.transactions.map((tx: any) => ({
            id: tx.hash,
            timestamp: new Date(tx.date).getTime(),
            symbol: 'XRP',
            side: tx.type === 'Payment' ? 'transfer' : 'other',
            type: tx.type === 'Payment' ? 'Transfer' : 'Trade',
            price: 0,
            amount: parseFloat(tx.amount?.value || '0'),
            exchange: 'XRP',
            status: tx.result === 'tesSUCCESS' ? 'Confirmed' : 'Failed',
            txHash: tx.hash,
            from: tx.Account,
            to: tx.Destination,
            chain: 'XRP',
            network: 'XRP',
            fee: tx.Fee ? parseFloat(tx.Fee) / 1e6 : undefined,
            feeAsset: 'XRP',
            sourceType: 'wallet',
        }));
    } catch (e) {
        console.error("XRP History Error:", e);
        return [];
    }
}

export async function getBitcoinHistory(address: string): Promise<any[]> {
    try {
        const response = await ultraFetch(`https://blockchain.info/rawaddr/${address}?limit=50`);
        if (!response.ok) return [];
        const data = await response.json();
        const txs = Array.isArray(data?.txs) ? data.txs : [];
        return txs.map((tx: any) => {
            const inputs = Array.isArray(tx.inputs) ? tx.inputs : [];
            const outs = Array.isArray(tx.out) ? tx.out : [];
            const sent = inputs.some((i: any) => i?.prev_out?.addr === address);
            const received = outs.some((o: any) => o?.addr === address);
            const value = sent
                ? outs.filter((o: any) => o?.addr !== address).reduce((s: number, o: any) => s + (o?.value || 0), 0)
                : outs.filter((o: any) => o?.addr === address).reduce((s: number, o: any) => s + (o?.value || 0), 0);
            const from = inputs[0]?.prev_out?.addr;
            const to = outs[0]?.addr;
            return {
                id: tx.hash,
                timestamp: (tx.time || 0) * 1000,
                symbol: 'BTC',
                side: sent ? 'sell' : 'buy',
                type: sent ? 'Withdraw' : (received ? 'Deposit' : 'Transfer'),
                price: 0,
                amount: (value || 0) / 1e8,
                exchange: 'BTC',
                status: 'Confirmed',
                txHash: tx.hash,
                from,
                to,
                address: sent ? to : from,
                chain: 'BTC',
                network: 'BTC',
                fee: typeof tx.fee === 'number' ? tx.fee / 1e8 : undefined,
                feeAsset: 'BTC',
                sourceType: 'wallet',
            };
        });
    } catch (e) {
        console.warn("BTC History Error:", e);
        return [];
    }
}

export async function getHederaHistory(address: string): Promise<any[]> {
    try {
        const response = await ultraFetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/transactions?account.id=${address}&limit=50&order=desc`);
        if (!response.ok) return [];
        const data = await response.json();
        const txs = Array.isArray(data?.transactions) ? data.transactions : [];
        return txs.map((tx: any) => ({
            id: tx.transaction_id,
            timestamp: tx.consensus_timestamp ? Number(String(tx.consensus_timestamp).split('.')[0]) * 1000 : Date.now(),
            symbol: 'HBAR',
            side: 'transfer',
            type: 'Transfer',
            price: 0,
            amount: 0,
            exchange: 'HBAR',
            status: tx.result === 'SUCCESS' ? 'Confirmed' : tx.result,
            txHash: tx.transaction_hash,
            chain: 'HBAR',
            network: 'HBAR',
            feeAsset: 'HBAR',
            sourceType: 'wallet',
        }));
    } catch (e) {
        console.warn("HBAR History Error:", e);
        return [];
    }
}

// Type definition
interface TokenBalance {
    symbol: string;
    balance: number;
}

// ============================================================================
// ADDITIONAL CHAIN FETCHERS - Ledger/Trezor Supported Chains
// ============================================================================

// NEAR Protocol
export async function getNearPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('near');
    const start = Date.now();
    try {
        const response = await ultraFetch('https://rpc.mainnet.near.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 'dontcare', method: 'query',
                params: { request_type: 'view_account', finality: 'final', account_id: address }
            })
        });
        const data = await response.json();
        tracker.add(Date.now() - start);

        if (data.result?.amount) {
            const balance = parseFloat(data.result.amount) / 1e24;
            if (balance > 0) return [{ symbol: 'NEAR', balance }];
        }
        return [];
    } catch (e) {
        console.warn("NEAR Portfolio Error:", e);
        return [];
    }
}

// Cosmos Hub (ATOM)
export async function getCosmosPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('cosmos');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        const balances: TokenBalance[] = [];
        if (data.balances && Array.isArray(data.balances)) {
            data.balances.forEach((b: any) => {
                const symbol = 'ATOM';
                if (b.denom === 'uatom') {
                    balances.push({ symbol, balance: parseFloat(b.amount) / 1e6 });
                }
            });
        }
        return balances;
    } catch (e) {
        console.warn("Cosmos Portfolio Error:", e);
        return [];
    }
}

// Polkadot
export async function getPolkadotPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('polkadot');
    const start = Date.now();
    try {
        const response = await ultraFetch('https://polkadot.api.subscan.io/api/v2/scan/account/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });
        const data = await response.json();
        tracker.add(Date.now() - start);

        if (data.data?.native) {
            const balance = parseFloat(data.data.native[0]?.balance || '0') / 1e10;
            if (balance > 0) return [{ symbol: 'DOT', balance }];
        }
        return [];
    } catch (e) {
        console.warn("Polkadot Portfolio Error:", e);
        return [];
    }
}

// Algorand
export async function getAlgorandPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('algorand');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://mainnet-api.algonode.cloud/v2/accounts/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        const balances: TokenBalance[] = [];
        if (data.amount) {
            balances.push({ symbol: 'ALGO', balance: data.amount / 1e6 });
        }
        // ASAs (Algorand Standard Assets)
        if (data.assets && Array.isArray(data.assets)) {
            data.assets.forEach((a: any) => {
                if (a.amount > 0) {
                    balances.push({ symbol: `ASA-${a['asset-id']}`, balance: a.amount / 1e6 });
                }
            });
        }
        return balances;
    } catch (e) {
        console.warn("Algorand Portfolio Error:", e);
        return [];
    }
}

// Stellar (XLM)
export async function getStellarPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('stellar');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://horizon.stellar.org/accounts/${address}`);
        if (!response.ok) return [];
        const data = await response.json();
        tracker.add(Date.now() - start);

        const balances: TokenBalance[] = [];
        if (data.balances && Array.isArray(data.balances)) {
            data.balances.forEach((b: any) => {
                if (b.asset_type === 'native') {
                    balances.push({ symbol: 'XLM', balance: parseFloat(b.balance) });
                } else if (b.balance && parseFloat(b.balance) > 0) {
                    balances.push({ symbol: b.asset_code || 'Unknown', balance: parseFloat(b.balance) });
                }
            });
        }
        return balances;
    } catch (e) {
        console.warn("Stellar Portfolio Error:", e);
        return [];
    }
}

// Dogecoin
export async function getDogePortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('doge');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://dogechain.info/api/v1/address/balance/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        if (data.success && data.balance) {
            return [{ symbol: 'DOGE', balance: parseFloat(data.balance) }];
        }
        return [];
    } catch (e) {
        console.warn("Doge Portfolio Error:", e);
        return [];
    }
}

// Litecoin
export async function getLitecoinPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('litecoin');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://api.blockcypher.com/v1/ltc/main/addrs/${address}/balance`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        if (data.balance !== undefined) {
            return [{ symbol: 'LTC', balance: data.balance / 1e8 }];
        }
        return [];
    } catch (e) {
        console.warn("Litecoin Portfolio Error:", e);
        return [];
    }
}

// Tezos
export async function getTezosPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('tezos');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://api.tzkt.io/v1/accounts/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        if (data.balance) {
            return [{ symbol: 'XTZ', balance: data.balance / 1e6 }];
        }
        return [];
    } catch (e) {
        console.warn("Tezos Portfolio Error:", e);
        return [];
    }
}

// MultiversX (Elrond)
export async function getMultiversXPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('multiversx');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://api.multiversx.com/accounts/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        if (data.balance) {
            return [{ symbol: 'EGLD', balance: parseFloat(data.balance) / 1e18 }];
        }
        return [];
    } catch (e) {
        console.warn("MultiversX Portfolio Error:", e);
        return [];
    }
}

// VeChain
export async function getVeChainPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('vechain');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://vethor-node.vechain.com/accounts/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        const balances: TokenBalance[] = [];
        if (data.balance) {
            balances.push({ symbol: 'VET', balance: parseFloat(data.balance) / 1e18 });
        }
        if (data.energy) {
            balances.push({ symbol: 'VTHO', balance: parseFloat(data.energy) / 1e18 });
        }
        return balances;
    } catch (e) {
        console.warn("VeChain Portfolio Error:", e);
        return [];
    }
}

// Kava
export async function getKavaPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('kava');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://api.kava.io/cosmos/bank/v1beta1/balances/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        const balances: TokenBalance[] = [];
        if (data.balances && Array.isArray(data.balances)) {
            data.balances.forEach((b: any) => {
                if (b.denom === 'ukava') {
                    balances.push({ symbol: 'KAVA', balance: parseFloat(b.amount) / 1e6 });
                }
            });
        }
        return balances;
    } catch (e) {
        console.warn("Kava Portfolio Error:", e);
        return [];
    }
}

// Injective
export async function getInjectivePortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('injective');
    const start = Date.now();
    try {
        const response = await ultraFetch(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
        const data = await response.json();
        tracker.add(Date.now() - start);

        const balances: TokenBalance[] = [];
        if (data.balances && Array.isArray(data.balances)) {
            data.balances.forEach((b: any) => {
                if (b.denom === 'inj') {
                    balances.push({ symbol: 'INJ', balance: parseFloat(b.amount) / 1e18 });
                }
            });
        }
        return balances;
    } catch (e) {
        console.warn("Injective Portfolio Error:", e);
        return [];
    }
}

// Filecoin
export async function getFilecoinPortfolio(address: string): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker('filecoin');
    const start = Date.now();
    try {
        const response = await ultraFetch('https://api.node.glif.io/rpc/v0', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1, method: 'Filecoin.WalletBalance',
                params: [address]
            })
        });
        const data = await response.json();
        tracker.add(Date.now() - start);

        if (data.result) {
            const balance = parseFloat(data.result) / 1e18;
            if (balance > 0) return [{ symbol: 'FIL', balance }];
        }
        return [];
    } catch (e) {
        console.warn("Filecoin Portfolio Error:", e);
        return [];
    }
}

// ============================================================================
// UNIFIED CHAIN FETCHER - Routes to correct fetcher based on chain type
// ============================================================================

export async function getChainPortfolio(address: string, chain: ChainType): Promise<TokenBalance[]> {
    const tracker = getLatencyTracker(chain.toLowerCase());
    const start = Date.now();

    try {
        let result: TokenBalance[] = [];

        // Route to appropriate fetcher
        if (EVM_CHAINS.includes(chain)) {
            result = await getEvmPortfolio(address, chain as any);
        } else {
            switch (chain) {
                case 'SOL': result = await getSolanaPortfolio(address); break;
                case 'BTC': result = await getBitcoinPortfolio(address); break;
                case 'XRP': result = await getXrpPortfolio(address); break;
                case 'HBAR': result = await getHederaPortfolio(address); break;
                case 'SUI': result = await getSuiPortfolio(address); break;
                case 'APT': result = await getAptosPortfolio(address); break;
                case 'TON': result = await getTonPortfolio(address); break;
                case 'TRX': result = await getTronPortfolio(address); break;
                case 'NEAR': result = await getNearPortfolio(address); break;
                case 'COSMOS': result = await getCosmosPortfolio(address); break;
                case 'DOT': result = await getPolkadotPortfolio(address); break;
                case 'ALGO': result = await getAlgorandPortfolio(address); break;
                case 'XLM': result = await getStellarPortfolio(address); break;
                case 'DOGE': result = await getDogePortfolio(address); break;
                case 'LTC': result = await getLitecoinPortfolio(address); break;
                case 'XTZ': result = await getTezosPortfolio(address); break;
                case 'EGLD': result = await getMultiversXPortfolio(address); break;
                case 'VET': result = await getVeChainPortfolio(address); break;
                case 'KAVA': result = await getKavaPortfolio(address); break;
                case 'INJ': result = await getInjectivePortfolio(address); break;
                case 'FIL': result = await getFilecoinPortfolio(address); break;
                default:
                    console.warn(`No fetcher for chain: ${chain}`);
            }
        }

        tracker.add(Date.now() - start);
        return result;
    } catch (e) {
        console.warn(`Chain ${chain} portfolio error:`, e);
        return [];
    }
}

// ============================================================================
// PARALLEL MULTI-CHAIN FETCHER - Fetch all chains for a wallet in parallel
// ============================================================================

export interface MultiChainBalance {
    chain: ChainType;
    balances: TokenBalance[];
    latencyMs: number;
    error?: string;
}

export async function getAllChainBalances(
    addresses: { chain: ChainType; address: string }[]
): Promise<MultiChainBalance[]> {
    const results = await Promise.all(
        addresses.map(async ({ chain, address }) => {
            const start = Date.now();
            try {
                const balances = await getChainPortfolio(address, chain);
                return {
                    chain,
                    balances,
                    latencyMs: Date.now() - start
                };
            } catch (e) {
                return {
                    chain,
                    balances: [],
                    latencyMs: Date.now() - start,
                    error: e instanceof Error ? e.message : 'Unknown error'
                };
            }
        })
    );

    return results;
}

// Fetch all chains for a single EVM address (same address works on all EVM chains)
export async function getAllEvmBalances(address: string): Promise<MultiChainBalance[]> {
    return getAllChainBalances(
        EVM_CHAINS.map(chain => ({ chain, address }))
    );
}

// Get transaction history for a chain
export async function getChainHistory(address: string, chain: ChainType): Promise<any[]> {
    if (EVM_CHAINS.includes(chain)) {
        return getEvmHistory(address, chain);
    }

    switch (chain) {
        case 'SOL': return getSolanaHistory(address);
        case 'SUI': return getSuiHistory(address);
        case 'APT': return getAptosHistory(address);
        case 'TON': return getTonHistory(address);
        case 'TRX': return getTronHistory(address);
        case 'XRP': return getXrpHistory(address);
        default:
            console.warn(`No history fetcher for chain: ${chain}`);
            return [];
    }
}
