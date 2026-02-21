import { AssetPageClient } from './AssetPageClient';

export function generateStaticParams() {
    const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'MATIC', 'DOT', 'UNI', 'ATOM', 'LTC', 'BCH', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'SEI', 'INJ', 'TIA', 'BRETT', 'WIF', 'PEPE', 'BONK', 'SHIB', 'JUP', 'PYTH', 'RNDR', 'FET', 'RENDER'];
    return symbols.map((symbol) => ({ symbol: symbol.toLowerCase() }));
}

export default function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
    return <AssetPageClient params={params} />;
}
