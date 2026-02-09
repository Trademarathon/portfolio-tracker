import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// EVM Token Interfaces
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

// Blockscout API Config
const BLOCKSCOUT_API: { [key: string]: string } = {
    'ETH': 'https://eth.blockscout.com/api',
    'ARB': 'https://arbitrum.blockscout.com/api',
    'MATIC': 'https://polygon.blockscout.com/api',
    'OP': 'https://optimism.blockscout.com/api',
    'BASE': 'https://base.blockscout.com/api',
    'BSC': 'https://bsc.blockscout.com/api', // Note: BSC Scan might be different, but Blockscout supports BSC too usually
    'AVAX': 'https://avalanche.blockscout.com/api' // Check availability
};

// Fallback RPCs if Blockscout fails or for native balance
const RPC_CONFIG: { [key: string]: string[] } = {
    'ETH': ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    'ARB': ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
    'MATIC': ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'],
    'OP': ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com'],
    'BASE': ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    'BSC': ['https://bsc-dataseed.binance.org', 'https://binance.llamarpc.com'],
    'AVAX': ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.llamarpc.com']
};

export async function getEvmPortfolio(address: string, chain: 'ETH' | 'ARB' | 'MATIC' | 'OP' | 'BASE' | 'BSC' | 'AVAX' = 'ETH'): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];

    // 1. Fetch Native Balance & Token List via Blockscout (The "Deep" Way)
    // Blockscout 'tokenlist' usually returns all ERC20/721 held by address
    const apiUrl = BLOCKSCOUT_API[chain];

    if (apiUrl) {
        try {
            // Fetch Tokens
            const tokenRes = await fetch(`${apiUrl}?module=account&action=tokenlist&address=${address}`);
            const tokenData = await tokenRes.json();

            if (tokenData.status === '1' && Array.isArray(tokenData.result)) {
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
            const nativeRes = await fetch(`${apiUrl}?module=account&action=balance&address=${address}`);
            const nativeData = await nativeRes.json();

            if (nativeData.status === '1') {
                const nativeVal = parseFloat(nativeData.result);
                if (nativeVal > 0) {
                    let symbol = 'ETH';
                    if (chain === 'MATIC') symbol = 'MATIC';
                    if (chain === 'BSC') symbol = 'BNB';
                    if (chain === 'AVAX') symbol = 'AVAX';

                    balances.push({
                        symbol,
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

    for (const url of urls) {
        try {
            provider = new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true });
            await provider.getBlockNumber();
            success = true;
            break;
        } catch (e) { /* ignore */ }
    }

    if (!success || !provider) return [];

    try {
        const nativeBalance = await provider.getBalance(address);
        if (nativeBalance > BigInt(0)) {
            let symbol = 'ETH';
            if (chain === 'MATIC') symbol = 'MATIC';
            if (chain === 'BSC') symbol = 'BNB';
            if (chain === 'AVAX') symbol = 'AVAX';
            balances.push({
                symbol: symbol,
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
        const response = await fetch(`https://blockchain.info/rawaddr/${address}`);
        if (!response.ok) throw new Error('BTC Fetch Failed');
        const data = await response.json();
        return [{
            symbol: 'BTC',
            balance: data.final_balance / 1e8
        }];
    } catch (e) {
        console.warn("BTC Portfolio Error:", e);
        return [];
    }
}

// Hedera
export async function getHederaPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        // address is account ID like 0.0.12345
        const response = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`);
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
                        price: 0,
                        amount: parseFloat(ethers.formatEther(tx.value)),
                        exchange: chain,
                        status: 'Confirmed'
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
                    price: 0,
                    amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
                    exchange: chain,
                    status: 'Confirmed'
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
        const response = await fetch('https://api.mainnet-beta.solana.com', {
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
                price: 0,
                amount: 0, // Discovery: getSignatures doesn't give amount
                exchange: 'Solana',
                status: sig.confirmationStatus || 'confirmed'
            }));
        }
        return [];
    } catch (e) {
        console.warn("Solana History Error:", e);
        return [];
    }
}

// Sui
export async function getSuiPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await fetch('https://fullnode.mainnet.sui.io', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_getAllBalances',
                params: [address]
            })
        });
        const data = await response.json();

        // Check for RPC errors
        if (data.error) {
            console.warn("SUI RPC Error:", data.error);
            return [];
        }

        if (!data.result || !Array.isArray(data.result)) return [];

        return data.result.map((b: any) => {
            let symbol = 'SUI';
            if (b.coinType && b.coinType !== '0x2::sui::SUI') {
                const parts = b.coinType.split('::');
                symbol = parts[parts.length - 1];
            }

            // Parse balance safely - totalBalance can be a very large number
            let balance = 0;
            try {
                // SUI uses 9 decimals (1 SUI = 1e9 MIST)
                const totalBalance = b.totalBalance || '0';
                balance = parseFloat(totalBalance) / 1e9;
            } catch (e) {
                console.warn(`Failed to parse SUI balance for ${symbol}:`, e);
            }

            return {
                symbol,
                balance
            };
        }).filter((b: { symbol: string; balance: number }) => b.balance > 0); // Filter out zero balances
    } catch (e) {
        console.warn("SUI Portfolio Error:", e);
        return [];
    }
}

export async function getSuiHistory(address: string): Promise<any[]> {
    try {
        const response = await fetch('https://fullnode.mainnet.sui.io', {
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
            price: 0,
            amount: 0,
            exchange: 'Sui',
            status: tx.effects.status.status === 'success' ? 'Confirmed' : 'Failed'
        }));
    } catch (e) {
        console.error("SUI History Error:", e);
        return [];
    }
}

// Aptos
export async function getAptosPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resources`);
        if (!response.ok) {
            console.warn(`Aptos API returned ${response.status} for ${address}`);
            return [];
        }
        const data = await response.json();

        const balances: TokenBalance[] = [];
        if (Array.isArray(data)) {
            data.forEach((res: any) => {
                if (res.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>') {
                    try {
                        const value = res.data?.coin?.value || '0';
                        const balance = parseFloat(value) / 1e8; // APT uses 8 decimals
                        if (balance > 0) {
                            balances.push({ symbol: 'APT', balance });
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse APT balance:', parseError);
                    }
                }
            });
        }
        return balances;
    } catch (e) {
        console.warn("Aptos Portfolio Error:", e);
        return [];
    }
}

export async function getAptosHistory(address: string): Promise<any[]> {
    try {
        const response = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/transactions?limit=50`);
        if (!response.ok) return [];
        const data = await response.json();

        return data.map((tx: any) => ({
            id: tx.hash,
            timestamp: parseInt(tx.timestamp) / 1000,
            symbol: 'APT',
            side: 'sell',
            price: 0,
            amount: 0,
            exchange: 'Aptos',
            status: tx.success ? 'Confirmed' : 'Failed'
        }));
    } catch (e) {
        console.error("Aptos History Error:", e);
        return [];
    }
}

// TON
export async function getTonPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await fetch(`https://toncenter.com/api/v2/getAddressInformation?address=${address}`);
        const data = await response.json();
        if (!data.ok || !data.result) return [];

        return [{
            symbol: 'TON',
            balance: parseInt(data.result.balance) / 1e9
        }];
    } catch (e) {
        console.warn("TON Portfolio Error:", e);
        return [];
    }
}

export async function getTonHistory(address: string): Promise<any[]> {
    try {
        const response = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${address}&limit=50`);
        const data = await response.json();
        if (!data.ok || !data.result) return [];

        return data.result.map((tx: any) => ({
            id: tx.transaction_id.hash,
            timestamp: tx.utime * 1000,
            symbol: 'TON',
            side: 'transfer',
            price: 0,
            amount: parseInt(tx.in_msg?.value || tx.out_msgs?.[0]?.value || 0) / 1e9,
            exchange: 'TON',
            status: 'Confirmed'
        }));
    } catch (e) {
        console.error("TON History Error:", e);
        return [];
    }
}

// TRON
export async function getTronPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await fetch(`https://api.trongrid.io/v1/accounts/${address}`);
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
        const response = await fetch(`https://api.trongrid.io/v1/accounts/${address}/transactions?limit=50`);
        const data = await response.json();
        if (!data.data) return [];

        return data.data.map((tx: any) => ({
            id: tx.txID,
            timestamp: tx.block_timestamp,
            symbol: 'TRX',
            side: 'transfer',
            price: 0,
            amount: 0,
            exchange: 'TRON',
            status: tx.ret?.[0]?.contractRet === 'SUCCESS' ? 'Confirmed' : 'Failed'
        }));
    } catch (e) {
        console.error("TRON History Error:", e);
        return [];
    }
}

// XRP (Ripple)
export async function getXrpPortfolio(address: string): Promise<TokenBalance[]> {
    try {
        const response = await fetch(`https://api.xrpscan.com/api/v1/account/${address}`);
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
        const response = await fetch(`https://api.xrpscan.com/api/v1/account/${address}/transactions?limit=50`);
        if (!response.ok) return [];
        const data = await response.json();

        if (!data.transactions || !Array.isArray(data.transactions)) return [];

        return data.transactions.map((tx: any) => ({
            id: tx.hash,
            timestamp: new Date(tx.date).getTime(),
            symbol: 'XRP',
            side: tx.type === 'Payment' ? 'transfer' : 'other',
            price: 0,
            amount: parseFloat(tx.amount?.value || '0'),
            exchange: 'XRP',
            status: tx.result === 'tesSUCCESS' ? 'Confirmed' : 'Failed'
        }));
    } catch (e) {
        console.error("XRP History Error:", e);
        return [];
    }
}

// Type definition
interface TokenBalance {
    symbol: string;
    balance: number;
}
