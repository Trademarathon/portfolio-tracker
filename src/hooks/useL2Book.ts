"use client";

import { useState, useEffect, useRef } from 'react';
import { getUniversalManager, subscribeToUniversalMessages } from './useRealtimeMarket';
import { L2Book } from '@/lib/api/hyperliquid';

export function useL2Book(symbol: string) {
    const [book, setBook] = useState<L2Book | null>(null);
    const bookRef = useRef<L2Book | null>(null);

    useEffect(() => {
        if (!symbol) return;

        const manager = getUniversalManager();
        if (!manager) return;

        // Use normalized symbol if needed, but HL expects its own ticker names
        // Typically it matches for primary assets
        manager.subscribeL2Book(symbol);

        const unsubscribe = subscribeToUniversalMessages((msg) => {
            if (msg.type === 'l2Book' && (msg.data as any).coin === symbol) {
                bookRef.current = msg.data as any;
            }
        });

        let frameId: number;
        const updateLoop = () => {
            if (bookRef.current) {
                // Clone to ensure React sees a new object if we want immediate update
                // or just pass direct. Let's pass if it's high frequency.
                setBook(bookRef.current);
                // We don't null it out here if we want to keep showing the last known book
                // But we only want to trigger a re-render if it changed.
                // Actually, in DOM we usually want to update as fast as possible.
                bookRef.current = null;
            }
            frameId = requestAnimationFrame(updateLoop);
        };
        frameId = requestAnimationFrame(updateLoop);

        return () => {
            unsubscribe();
            manager.unsubscribeL2Book(symbol);
            cancelAnimationFrame(frameId);
        };
    }, [symbol]);

    return book;
}
