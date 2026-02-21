"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TradeAnnotation, StrategyTagId, JournalStats, STRATEGY_TAGS } from '@/lib/api/journal-types';

const STORAGE_KEY = 'trade_journal_annotations';

function generateId(): string {
    return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useTradeJournal() {
    const [annotations, setAnnotations] = useState<TradeAnnotation[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                try {
                    setAnnotations(JSON.parse(stored));
                } catch (e) {
                    console.warn('Failed to parse journal annotations:', e);
                }
            }
            setIsLoaded(true);
        }
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        if (isLoaded && typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
        }
    }, [annotations, isLoaded]);

    // Add a new annotation
    const addAnnotation = useCallback((data: Omit<TradeAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => {
        const now = Date.now();
        const newAnnotation: TradeAnnotation = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        };
        setAnnotations(prev => [...prev, newAnnotation]);
        return newAnnotation;
    }, []);

    // Update an existing annotation
    const updateAnnotation = useCallback((id: string, updates: Partial<Omit<TradeAnnotation, 'id' | 'tradeId' | 'createdAt'>>) => {
        setAnnotations(prev => prev.map(ann =>
            ann.id === id
                ? { ...ann, ...updates, updatedAt: Date.now() }
                : ann
        ));
    }, []);

    // Delete an annotation
    const deleteAnnotation = useCallback((id: string) => {
        setAnnotations(prev => prev.filter(ann => ann.id !== id));
    }, []);

    // Get annotation by trade ID
    const getAnnotationByTradeId = useCallback((tradeId: string) => {
        return annotations.find(ann => ann.tradeId === tradeId);
    }, [annotations]);

    // Get all annotations for a list of trade IDs
    const getAnnotationsForTrades = useCallback((tradeIds: string[]) => {
        const idSet = new Set(tradeIds);
        return annotations.filter(ann => idSet.has(ann.tradeId));
    }, [annotations]);

    // Filter annotations by strategy tag
    const filterByTag = useCallback((tag: StrategyTagId) => {
        return annotations.filter(ann => ann.strategyTag === tag);
    }, [annotations]);

    // Calculate stats for all strategies
    const stats = useMemo((): JournalStats => {
        const taggedTrades = annotations.length;
        const totalQuality = annotations.reduce((sum, ann) => sum + ann.executionQuality, 0);

        // Initialize win rate tracking per tag
        const winRateByTag: JournalStats['winRateByTag'] = {} as JournalStats['winRateByTag'];
        STRATEGY_TAGS.forEach(tag => {
            winRateByTag[tag.id] = { wins: 0, losses: 0, winRate: 0, totalPnl: 0 };
        });

        // Note: To calculate actual P&L, we'd need to join with trade data
        // For now, we just count tagged trades per strategy
        annotations.forEach(_ann => {
            // Placeholder: In real implementation, lookup trade P&L
            // For now, just increment count
            // This would be enhanced when integrating with usePortfolioData
        });

        return {
            totalTrades: 0, // Will be populated when integrating with trade history
            taggedTrades,
            winRateByTag,
            avgExecutionQuality: taggedTrades > 0 ? totalQuality / taggedTrades : 0,
        };
    }, [annotations]);

    return {
        annotations,
        isLoaded,
        addAnnotation,
        updateAnnotation,
        deleteAnnotation,
        getAnnotationByTradeId,
        getAnnotationsForTrades,
        filterByTag,
        stats,
    };
}
