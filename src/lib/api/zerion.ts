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

function normalizeZerionFullResponse(data: unknown): ZerionFullPortfolio {
    const portfolio: ZerionFullPortfolio = {
        tokens: [],
        nfts: [],
        defi: [],
        totalValue: 0
    };

    const root = data as Record<string, unknown>;
    const positions = root.data;
    if (!positions || !Array.isArray(positions)) {
        return portfolio;
    }

    positions.forEach((position: unknown) => {
        const pos = position as Record<string, unknown>;
        const attr = (pos.attributes || {}) as Record<string, unknown>;
        const quantity = parseFloat(String(attr.quantity || '0'));
        const value = Number(attr.value || 0);
        const price = Number(attr.price || 0);
        const chain = String(attr.chain || 'unknown');

        // Tokens
        const fungibleInfo = attr.fungible_info as Record<string, unknown> | undefined;
        const nftInfo = attr.nft_info as Record<string, unknown> | undefined;

        if (fungibleInfo) {
            const asset: ZerionAsset = {
                id: String(pos.id || ''),
                symbol: String(fungibleInfo.symbol || ''),
                name: String(fungibleInfo.name || ''),
                balance: quantity,
                price,
                value,
                icon: (fungibleInfo.icon as Record<string, unknown> | undefined)?.url as string | undefined,
                change24h: Number((attr.changes as Record<string, unknown> | undefined)?.absolute_1d || 0), // value change
                type: 'token',
                chain
            };
            portfolio.tokens.push(asset);
            portfolio.totalValue += value;
        }
        // NFTs
        else if (nftInfo) {
            const asset: ZerionAsset = {
                id: String(pos.id || ''),
                symbol: String(nftInfo.contract_address || '').slice(0, 6) || 'NFT',
                name: String(nftInfo.name || '') || 'Unknown NFT',
                balance: quantity,
                price, // Floor price often?
                value,
                icon: (
                    (((nftInfo.content as Record<string, unknown> | undefined)?.preview as Record<string, unknown> | undefined)?.url as string | undefined) ||
                    (((nftInfo.content as Record<string, unknown> | undefined)?.detail as Record<string, unknown> | undefined)?.url as string | undefined)
                ),
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
                id: String(pos.id || ''),
                symbol: 'DeFi',
                name: String((((pos.relationships as Record<string, unknown> | undefined)?.dapp as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)?.id || 'Unknown Protocol'),
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

export async function getZerionHistory(address: string): Promise<unknown[]> {
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

        const root = data as Record<string, unknown>;
        const rows = root.data;
        if (!rows || !Array.isArray(rows)) return [];

        return rows.map((tx: unknown) => {
            const t = tx as Record<string, unknown>;
            const attr = (t.attributes || {}) as Record<string, unknown>;
            const transfers = (attr.transfers as unknown[]) || [];
            const firstTransfer = transfers[0] as Record<string, unknown> | undefined;
            const fungibleInfo = (firstTransfer?.fungible_info || {}) as Record<string, unknown>;
            return {
                id: String(t.id || ''),
                timestamp: new Date(String(attr.mined_at || 0)).getTime(),
                symbol: String(fungibleInfo.symbol || 'Unknown'),
                side: String(attr.operation_type || 'transfer'),
            price: 0,
                amount: parseFloat(String(firstTransfer?.quantity || '0')),
            exchange: 'Zerion',
                status: String(attr.status || '') === 'confirmed' ? 'Confirmed' : 'Pending'
            };
        });
    } catch (e) {
        console.error("Zerion History Error:", e);
        return [];
    }
}
