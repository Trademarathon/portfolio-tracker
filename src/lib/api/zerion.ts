const ZERION_API_KEY = 'zk_9d7975317512447895db6d167f58e1cf';
const ZERION_BASE_URL = 'https://api.zerion.io/v1';

// Transform API key for Basic Auth (base64 encode with colon suffix)
const getAuthHeader = () => {
    if (typeof window !== 'undefined') {
        return `Basic ${btoa(ZERION_API_KEY + ':')}`;
    }
    // Server-side (Node.js)
    return `Basic ${Buffer.from(ZERION_API_KEY + ':').toString('base64')}`;
};

export interface ZerionAsset {
    id: string;
    symbol: string;
    name: string;
    balance: number;
    price: number;
    value: number;
    icon?: string;
    change24h?: number;
    type: 'token' | 'nft' | 'defi';
    chain: string;
}

export interface ZerionFullPortfolio {
    tokens: ZerionAsset[];
    nfts: ZerionAsset[];
    defi: ZerionAsset[];
    totalValue: number;
}

export async function getZerionFullPortfolio(address: string): Promise<ZerionFullPortfolio> {
    try {
        const response = await fetch(`${ZERION_BASE_URL}/wallets/${address}/portfolio`, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`Zerion API returned ${response.status} for ${address}`);
            return { tokens: [], nfts: [], defi: [], totalValue: 0 };
        }

        const data = await response.json();
        return normalizeZerionFullResponse(data);
    } catch (e) {
        console.warn("Zerion Portfolio Error:", e);
        return { tokens: [], nfts: [], defi: [], totalValue: 0 };
    }
}

function normalizeZerionFullResponse(data: any): ZerionFullPortfolio {
    const portfolio: ZerionFullPortfolio = {
        tokens: [],
        nfts: [],
        defi: [],
        totalValue: 0
    };

    if (!data.data || !Array.isArray(data.data)) {
        return portfolio;
    }

    data.data.forEach((position: any) => {
        const attr = position.attributes;
        const quantity = parseFloat(attr.quantity || '0');
        const value = attr.value || 0;
        const price = attr.price || 0;
        const chain = attr.chain || 'unknown';

        // Tokens
        if (attr.fungible_info) {
            const asset: ZerionAsset = {
                id: position.id,
                symbol: attr.fungible_info.symbol,
                name: attr.fungible_info.name,
                balance: quantity,
                price,
                value,
                icon: attr.fungible_info.icon?.url,
                change24h: attr.changes?.absolute_1d || 0, // value change
                type: 'token',
                chain
            };
            portfolio.tokens.push(asset);
            portfolio.totalValue += value;
        }
        // NFTs
        else if (attr.nft_info) {
            const asset: ZerionAsset = {
                id: position.id,
                symbol: attr.nft_info.contract_address?.slice(0, 6) || 'NFT',
                name: attr.nft_info.name || 'Unknown NFT',
                balance: quantity,
                price, // Floor price often?
                value,
                icon: attr.nft_info.content?.preview?.url || attr.nft_info.content?.detail?.url,
                type: 'nft',
                chain
            };
            portfolio.nfts.push(asset);
            portfolio.totalValue += value;
        }
        // DeFi (Usually positions without fungible/nft info but with app info? Zerion structure varies)
        // For now, if value > 0 and not token/nft, treat as DeFi, or check flags.
        // Simplified: everything else with value is DeFi
        else if (value > 0) {
            const asset: ZerionAsset = {
                id: position.id,
                symbol: 'DeFi',
                name: position.relationships?.dapp?.data?.id || 'Unknown Protocol',
                balance: quantity,
                price,
                value,
                type: 'defi',
                chain
            };
            portfolio.defi.push(asset);
            portfolio.totalValue += value;
        }
    });

    return portfolio;
}

// Keep legacy for compatibility if needed, or redirect
export async function getZerionPortfolio(address: string): Promise<{ symbol: string; balance: number }[]> {
    const full = await getZerionFullPortfolio(address);
    return full.tokens.map(t => ({ symbol: t.symbol, balance: t.balance }));
}

export async function getZerionHistory(address: string): Promise<any[]> {
    try {
        const response = await fetch(`${ZERION_BASE_URL}/wallets/${address}/transactions/?currency=usd&page[size]=50`, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        if (!response.ok) return [];
        const data = await response.json();

        if (!data.data || !Array.isArray(data.data)) return [];

        return data.data.map((tx: any) => ({
            id: tx.id,
            timestamp: new Date(tx.attributes.mined_at).getTime(),
            symbol: tx.attributes.transfers?.[0]?.fungible_info?.symbol || 'Unknown',
            side: tx.attributes.operation_type || 'transfer',
            price: 0,
            amount: parseFloat(tx.attributes.transfers?.[0]?.quantity || '0'),
            exchange: 'Zerion',
            status: tx.attributes.status === 'confirmed' ? 'Confirmed' : 'Pending'
        }));
    } catch (e) {
        console.error("Zerion History Error:", e);
        return [];
    }
}
