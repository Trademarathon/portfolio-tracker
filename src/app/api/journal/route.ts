import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const trades = await prisma.trade.findMany({
            orderBy: { date: 'desc' }
        });
        return NextResponse.json(trades);
    } catch (error) {
        console.error('Failed to fetch trades:', error);
        return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const trade = await prisma.trade.create({
            data: {
                symbol: body.symbol,
                side: body.side,
                entryPrice: parseFloat(body.entryPrice),
                size: parseFloat(body.size),
                notes: body.notes,
                status: 'open'
            }
        });
        return NextResponse.json(trade);
    } catch (error) {
        console.error('Failed to create trade:', error);
        return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
    }
}
