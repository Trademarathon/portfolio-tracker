const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

async function testFetch() {
    try {
        const response = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "metaAndAssetCtxs" })
        });
        const data = await response.json();
        // data[0] is universe (meta)
        // data[1] is assetCtxs (prices)

        const universe = data[0].universe;
        const prices = data[1]; // array of ctx

        console.log("Universe sample:", JSON.stringify(universe.slice(0, 5)));
        console.log("Price sample:", JSON.stringify(prices.slice(0, 5)));

        // precise mapping
        universe.slice(0, 5).forEach((u, i) => {
            console.log(`Symbol: ${u.name}, Price: ${prices[i].markPx}`);
        });

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testFetch();
