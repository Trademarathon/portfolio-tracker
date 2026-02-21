'use client';

import { Transaction } from '@/lib/api/types';
import { useMemo } from 'react';
import { StatCard } from '@/components/ui/StatCard';

interface TradingStatsProps {
    transactions: Transaction[];
}

export function TradingStats({ transactions }: TradingStatsProps) {
    const stats = useMemo(() => {
        const closedTrades = transactions.filter(t => t.status === 'closed' || t.pnl !== undefined);
        const totalTrades = closedTrades.length;

        if (totalTrades === 0) {
            return {
                netPnl: 0,
                winRate: 0,
                profitFactor: 0,
                avgWin: 0,
                avgLoss: 0,
                bestPair: '-',
                makerFees: 0,
                takerFees: 0,
                networkFees: 0,
                fundingPnL: 0
            };
        }

        const netPnl = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
        const losses = closedTrades.filter(t => (t.pnl || 0) <= 0);

        const winRate = (wins.length / totalTrades) * 100;

        const grossProfit = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

        const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
        const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0; // Keeping positive for display

        // Best Pair
        const pairPerformance: Record<string, number> = {};
        closedTrades.forEach(t => {
            pairPerformance[t.symbol] = (pairPerformance[t.symbol] || 0) + (t.pnl || 0);
        });
        const bestPair = Object.entries(pairPerformance).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        // Fee Stats
        let makerFees = 0;
        let takerFees = 0;
        let networkFees = 0;
        let fundingPnL = 0;

        transactions.forEach(t => {
            const feeVal = t.fee || 0;
            // distinct negative funding (cost) vs positive (income) if needed, but usually net is good
            // Note: Hyperliquid funding is reported as PnL, not fee.
            if (t.feeType === 'funding') {
                fundingPnL += t.pnl || 0;
            } else if (t.feeType === 'network') {
                networkFees += feeVal;
            } else if (t.feeType === 'trading' || (t.exchange && !t.feeType)) {
                // Default to trading fee if exchange is present
                if (t.takerOrMaker === 'maker') makerFees += feeVal;
                else takerFees += feeVal;
            }
        });

        return {
            netPnl,
            winRate,
            profitFactor,
            avgWin,
            avgLoss,
            bestPair,
            makerFees,
            takerFees,
            networkFees,
            fundingPnL
        };
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <StatCard variant="simple" label="Net PnL" value={stats.netPnl} format="currency" valueClassName={stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
                    <StatCard variant="simple" label="Win Rate" value={stats.winRate} format="number" suffix="%" decimals={0} />
                    <StatCard variant="simple" label="Profit Factor" value={stats.profitFactor} decimals={2} />
                    <StatCard variant="simple" label="Avg Win" value={stats.avgWin} format="currency" valueClassName="text-green-400" />
                    <StatCard variant="simple" label="Avg Loss" value={stats.avgLoss} format="currency" valueClassName="text-red-400" />
                    <StatCard variant="simple" label="Best Pair" value={stats.bestPair} />
                </div>
            </div>

            {/* Trading Fees Section */}
            <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Trading Fees</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatCard variant="simple" label="Maker Fees" value={stats.makerFees} format="currency" valueClassName="text-emerald-400" />
                    <StatCard variant="simple" label="Taker Fees" value={stats.takerFees} format="currency" valueClassName="text-orange-400" />
                    <StatCard variant="simple" label="Total Trading Fees" value={(stats.makerFees || 0) + (stats.takerFees || 0)} format="currency" valueClassName="text-red-400" />
                </div>
            </div>

            {/* Network/Transaction Fees Section */}
            <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Network & Transaction Fees</h3>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                    <StatCard variant="simple" label="Gas/Network Fees" value={stats.networkFees} format="currency" valueClassName="text-blue-400" />
                    <StatCard variant="simple" label="Funding PnL" value={stats.fundingPnL} format="currency" valueClassName={stats.fundingPnL >= 0 ? 'text-green-400' : 'text-red-400'} />
                </div>
            </div>

            {/* Total Fees Overview Section */}
            <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Total Fees Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        variant="simple"
                        label="Total Fees Paid"
                        value={stats.makerFees + stats.takerFees + stats.networkFees}
                        format="currency"
                        valueClassName="text-red-500 text-2xl font-extrabold"
                    />
                    <StatCard
                        variant="simple"
                        label="Net After Fees"
                        value={stats.netPnl - (stats.makerFees + stats.takerFees + stats.networkFees)}
                        format="currency"
                        valueClassName={`${(stats.netPnl - (stats.makerFees + stats.takerFees + stats.networkFees)) >= 0 ? 'text-green-400' : 'text-red-400'} text-2xl font-extrabold`}
                    />
                    <StatCard
                        variant="simple"
                        label="Fee Impact on PnL"
                        value={stats.netPnl !== 0 ? ((stats.makerFees + stats.takerFees + stats.networkFees) / Math.abs(stats.netPnl) * 100) : 0}
                        format="number"
                        suffix="%"
                        decimals={1}
                        valueClassName="text-yellow-400"
                    />
                </div>
            </div>
        </div>
    );
}
