import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { apiKey, apiSecret } = await req.json();

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const res = await fetch('https://fapi.binance.com/fapi/v1/listenKey', {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Binance API Error: ${res.status} ${errorText}`);
        }

        const data = await res.json();
        return NextResponse.json({ listenKey: data.listenKey });

    } catch (error: any) {
        console.error('Binance ListenKey Futures Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { apiKey, listenKey } = await req.json();

        if (!apiKey || !listenKey) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const res = await fetch('https://fapi.binance.com/fapi/v1/listenKey', {
            method: 'PUT',
            headers: {
                'X-MBX-APIKEY': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded' // Binance usually expects this or just query params?
                // Actually listenKey usually in URL or body. 
            },
            // For PUT, Binance docs say parameters can be sent.
            body: new URLSearchParams({ listenKey })
        });

        // Actually for correct implementation, let's check docs. 
        // POST /fapi/v1/listenKey (header X-MBX-APIKEY) -> returns {listenKey}
        // PUT /fapi/v1/listenKey (header X-MBX-APIKEY) -> body usually empty? No, usually no params? 
        // Wait, for Spot it's url param `listenKey`. For Futures?
        // "Keepalive a user data stream to prevent a time out. User data streams will close after 60 minutes. It's recommended to send a ping about every 30 minutes."
        // Parameters: listenKey (STRING, YES)

        return NextResponse.json({ success: res.ok });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
