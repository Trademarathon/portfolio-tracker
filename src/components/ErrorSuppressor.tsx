'use client';

import { useEffect } from 'react';

export function ErrorSuppressor() {
    useEffect(() => {
        // Backup original verified
        const originalError = console.error;
        const originalWarn = console.warn;

        // Override console.error
        console.error = (...args) => {
            // Filter out specific error messages that cause annoyance in dev mode
            const msg = args.join(' ');
            if (
                msg.includes('ws error: undefined') ||
                msg.includes('WebSocket connection failed') ||
                msg.includes('ws error') ||
                msg.includes('provider destroyed') ||
                msg.includes('UNSUPPORTED_OPERATION')
            ) {
                // Suppress or downgrade to log
                // console.log('[Suppressed Error]', ...args); 
                return;
            }
            originalError.apply(console, args);
        };

        // Override console.warn if needed (optional)
        console.warn = (...args) => {
            const msg = args.join(' ');
            if (msg.includes('ws error')) {
                return;
            }
            originalWarn.apply(console, args);
        };

        return () => {
            // Cleanup if needed? Usually we want this persistent.
            // But for HMR, we might want to restore?
            // console.error = originalError; 
        };
    }, []);

    return null;
}
