'use client';

import { useEffect } from 'react';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';


/**
 * Suppresses known-noisy console in development. Keeps the patch for the session (no restore on unmount).
 */
export function ErrorSuppressor() {
    useEffect(() => {
        if (!isDev) return;

        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => {
            const msg = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
            if (msg.includes('ws error: undefined')) {
                return;
            }
            originalWarn.apply(console, args);
        };

        return () => {
            console.warn = originalWarn;
        };
    }, []);

    return null;
}
