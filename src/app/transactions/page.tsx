"use client";

import { usePortfolioData } from "@/hooks/usePortfolioData";
import TransactionHistory from "@/components/Dashboard/TransactionHistory";

export default function TransactionsPage() {
    const { transactions, loading } = usePortfolioData();

    return (
        <div className="flex flex-col gap-6 pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Trade History</h1>
                <p className="text-muted-foreground">Recent trades from connected exchanges.</p>
            </div>

            <TransactionHistory transactions={transactions} />
        </div>
    );
}
