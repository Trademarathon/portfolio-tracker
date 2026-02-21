
import { getGroupedOrderbook, calculateOrderbookStepSizes } from '../src/lib/orderbook-grouping';


async function main() {
    const args = process.argv.slice(2);
    const symbol = args[0] || 'BTC';
    const targetStep = args[1] ? parseFloat(args[1]) : undefined;

    console.log(`=== Orderbook Grouping for ${symbol} ===`);

    // 1. Get Asset Metadata
    console.log('Fetching metadata...');

    const metaResponse = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' })
    });
    const meta = await metaResponse.json();
    const assetInfo = meta.universe.find((u: any) => u.name === symbol);

    if (!assetInfo) {
        console.error(`Asset ${symbol} not found!`);
        return;
    }

    const szDecimals = assetInfo.szDecimals;
    console.log(`szDecimals: ${szDecimals}`);

    // 2. Get Reference Price
    const initialBookRes = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'l2Book', coin: symbol })
    });
    const initialBook = await initialBookRes.json();

    // Debug raw structure
    // console.log('Initial Book Response:', JSON.stringify(initialBook).substring(0, 200));

    if (!initialBook.levels || !Array.isArray(initialBook.levels) || initialBook.levels.length < 2) {
        console.error('Initial book levels empty or invalid format');
        return;
    }

    // Access first bid from the first array
    const firstBid = initialBook.levels[0][0];
    if (!firstBid) {
        console.error('No bids found in orderbook');
        return;
    }

    const currentPrice = parseFloat(firstBid.px);
    console.log(`Current Price ~ ${currentPrice}`);

    // 3. Calculate Steps
    const steps = calculateOrderbookStepSizes(currentPrice, szDecimals);
    console.log(`Available step sizes: [${steps.join(', ')}]`);

    // 4. Determine Step to Use
    const stepToUse = targetStep || steps[1]; // Default to second option
    console.log(`Fetching orderbook with step size: ${stepToUse}`);

    // 5. Fetch Grouped Book
    const groupedBook = await getGroupedOrderbook(symbol, stepToUse, currentPrice, szDecimals);

    if (!groupedBook) {
        console.error('Failed to get orderbook');
        return;
    }

    // 6. Display Top 5
    // groupedBook.bids is already sorted High -> Low
    console.log('\nTop 5 Bids (High to Low):');
    groupedBook.bids.slice(0, 5).forEach(l => console.log(`  ${l.px} - ${parseFloat(l.sz).toFixed(4)}`));

    // groupedBook.asks is already sorted Low -> High by our function
    console.log('\nTop 5 Asks (Low to High):');
    groupedBook.asks.slice(0, 5).forEach(l => console.log(`  ${l.px} - ${parseFloat(l.sz).toFixed(4)}`));
}

main().catch(console.error);
