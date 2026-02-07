import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioAsset } from "@/lib/api/types";
import { Wallet, Building2, ArrowRight } from "lucide-react";

interface AccountsOverviewProps {
    assets: PortfolioAsset[];
    onSelectAccount?: (account: string) => void;
    selectedAccount?: string | null;
}

export function AccountsOverview({ assets, onSelectAccount, selectedAccount }: AccountsOverviewProps) {
    // 1. Aggregate Value by Source
    const accountStats: { [key: string]: number } = {};
    let totalPortfolioValue = 0;

    assets.forEach(asset => {
        if (asset.breakdown) {
            Object.entries(asset.breakdown).forEach(([source, balance]) => {
                const value = balance * (asset.price || 0);
                accountStats[source] = (accountStats[source] || 0) + value;
                totalPortfolioValue += value;
            });
        } else {
            // Fallback if no breakdown (shouldn't happen with new logic, but safety)
            const source = 'Uncategorized';
            const value = asset.valueUsd;
            accountStats[source] = (accountStats[source] || 0) + value;
            totalPortfolioValue += value;
        }
    });

    const accounts = Object.entries(accountStats)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({
            name,
            value,
            percent: totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0,
            type: name.toLowerCase().includes('wallet') ? 'wallet' : 'exchange'
        }));

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card
                className={`cursor-pointer transition-all hover:bg-zinc-900/80 border-white/10 ${!selectedAccount ? 'ring-2 ring-primary' : ''}`}
                onClick={() => onSelectAccount && onSelectAccount('All')}
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">All Accounts</CardTitle>
                    <Building2 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground">100% of Net Worth</p>
                </CardContent>
            </Card>

            {accounts.map((acc) => (
                <Card
                    key={acc.name}
                    className={`cursor-pointer transition-all hover:bg-zinc-900/80 border-white/10 ${selectedAccount === acc.name ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => onSelectAccount && onSelectAccount(acc.name)}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={acc.name}>
                            {acc.name}
                        </CardTitle>
                        {acc.type === 'wallet' ? <Wallet className="h-4 w-4 text-blue-500" /> : <ArrowRight className="h-4 w-4 text-orange-500" />}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${acc.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-muted-foreground">{acc.percent.toFixed(1)}% of Portfolio</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
