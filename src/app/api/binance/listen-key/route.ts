import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { apiKey, apiSecret, marketType } = await request.json();

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Missing API credentials' }, { status: 400 });
        }

        const baseUrl = marketType === 'futures'
            ? 'https://fapi.binance.com/fapi/v1/listenKey'
            : 'https://api.binance.com/api/v3/userDataStream';

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json({ error: `Binance ${marketType || 'Spot'} Error: ${error}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('ListenKey Error:', error);
        return NextResponse.json({ error: 'Failed to create ListenKey' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { apiKey, listenKey, marketType } = await request.json();

        if (!apiKey || !listenKey) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const baseUrl = marketType === 'futures'
            ? 'https://fapi.binance.com/fapi/v1/listenKey'
            : 'https://api.binance.com/api/v3/userDataStream';

        // Note: fapi uses POST/PUT/DELETE on /fapi/v1/listenKey, but v3 uses query param for PUT?
        // Actually fapi documentation says PUT /fapi/v1/listenKey to keepalive.
        // v3 documentation says PUT /api/v3/userDataStream?listenKey=...

        // Let's handle the difference:
        let url = baseUrl;
        if (marketType !== 'futures') {
            url = `${baseUrl}?listenKey=${listenKey}`;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to keep-alive ListenKey' }, { status: response.status });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
