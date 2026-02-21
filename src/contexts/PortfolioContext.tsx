"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { usePortfolioData as usePortfolioDataHook } from '@/hooks/usePortfolioData';

type PortfolioData = ReturnType<typeof usePortfolioDataHook>;

const PortfolioContext = createContext<PortfolioData | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
    const portfolio = usePortfolioDataHook();

    return (
        <PortfolioContext.Provider value={portfolio}>
            {children}
        </PortfolioContext.Provider>
    );
}

export function usePortfolio() {
    const context = useContext(PortfolioContext);
    if (!context) {
        throw new Error("usePortfolio must be used within a PortfolioProvider");
    }
    return context;
}
