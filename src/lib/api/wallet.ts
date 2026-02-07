import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// EVM Token Interfaces
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

// Top Tokens to track (Address, Decimals)
const EVM_TOKENS: { [chain: string]: { [symbol: string]: { address: string, decimals: number } } } = {
    'ETH': {
        'USDT': { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
        'USDC': { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
        'DAI': { address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18 },
        'WBTC': { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8 },
        'SHIB': { address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', decimals: 18 },
        'LINK': { address: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18 },
        'UNI': { address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', decimals: 18 },
        'PEPE': { address: '0x6982508145454ce325ddbe47a25d4ec3d2311933', decimals: 18 },
        'WETH': { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', decimals: 18 },
        'AAVE': { address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', decimals: 18 },
        'MKR': { address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', decimals: 18 },
        'CRV': { address: '0xd533a949740bb3306d119cc777fa900ba034cd52', decimals: 18 },
        'LDO': { address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32', decimals: 18 }
    },
    'ARB': {
        'USDT': { address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', decimals: 6 },
        'USDC': { address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', decimals: 6 },
        'ARB': { address: '0x912ce59144191c1204e64559fe8253a0e49e6548', decimals: 18 },
        'WBTC': { address: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', decimals: 8 },
        'GMX': { address: '0xfc5a1a6eb076a2c7ad06ed22d90d7e710e35ad0a', decimals: 18 },
        'WETH': { address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', decimals: 18 },
        'LINK': { address: '0xf97f4df75117a78c1a5a0dbb88af22247d3959f6', decimals: 18 }
    },
    'MATIC': {
        'USDT': { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6 },
        'USDC': { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimals: 6 },
        'WETH': { address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', decimals: 18 },
        'MATIC': { address: '0x0000000000000000000000000000000000001010', decimals: 18 },
        'DAI': { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 }
    },
    'OP': {
        'USDT': { address: '0x94b008aa00579c1307b0ef2c499ad98a8ce98749', decimals: 6 },
        'USDC': { address: '0x0b2c639c5336b12d41a8bc879a8f602001e76f00', decimals: 6 },
        'WETH': { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
        'OP': { address: '0x4200000000000000000000000000000000000042', decimals: 18 },
        'DAI': { address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', decimals: 18 },
        'LDO': { address: '0xfdb794692724153d1488ccdbe0c56c252596735f', decimals: 18 }
    }
};

interface TokenBalance {
    symbol: string;
    balance: number;
}

// EVM
export async function getEvmPortfolio(address: string, chain: 'ETH' | 'ARB' | 'MATIC' | 'OP' = 'ETH'): Promise<TokenBalance[]> {
    // Use highly reliable public RPCs
    let rpcUrl = '';
    if (chain === 'ETH') rpcUrl = 'https://eth.llamarpc.com';
    else if (chain === 'ARB') rpcUrl = 'https://arb1.arbitrum.io/rpc';
    else if (chain === 'MATIC') rpcUrl = 'https://polygon-rpc.com';
    else if (chain === 'OP') rpcUrl = 'https://mainnet.optimism.io';

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balances: TokenBalance[] = [];

    try {
        // 1. Native Balance
        const nativeBalance = await provider.getBalance(address);
        if (nativeBalance > BigInt(0)) {
            let symbol = 'ETH';
            if (chain === 'MATIC') symbol = 'MATIC';
            // Optimism native is ETH, Arbitrum native is ETH

            balances.push({
                symbol: symbol,
                balance: parseFloat(ethers.formatEther(nativeBalance))
            });
        }

        // 2. Token Balances (Parallel)
        const tokens = EVM_TOKENS[chain];
        if (tokens) {
            const promises = Object.entries(tokens).map(async ([symbol, info]) => {
                try {
                    const contract = new ethers.Contract(info.address, ERC20_ABI, provider);
                    const bal = await contract.balanceOf(address);
                    if (bal > BigInt(0)) {
                        const formatted = parseFloat(ethers.formatUnits(bal, info.decimals));
                        return { symbol, balance: formatted };
                    }
                } catch (e) {
                    console.warn(`Failed to fetch ${symbol} on ${chain}`, e);
                }
                return null;
            });

            const results = await Promise.all(promises);
            results.forEach(res => {
                if (res) balances.push(res);
            });
        }
    } catch (e) {
        console.error(`EVM Portfolio Error (${chain}):`, e);
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
        console.error("Solana Portfolio Error:", e);
    }
    return balances;
}

// Legacy support
export async function getSolanaBalance(address: string): Promise<number> {
    const portfolio = await getSolanaPortfolio(address);
    const native = portfolio.find(p => p.symbol === 'SOL');
    return native ? native.balance : 0;
}
