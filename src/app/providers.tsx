
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // High performance defaults
                staleTime: 1000 * 60, // Data is fresh for 1 minute
                gcTime: 1000 * 60 * 60, // Garbage collect unused data after 1 hour
                refetchOnWindowFocus: true,
                retry: 1,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
