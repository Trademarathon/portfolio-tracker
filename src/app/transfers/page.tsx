"use client";

import { usePortfolioData } from "@/hooks/usePortfolioData";
import TransactionHistory from "@/components/Dashboard/TransactionHistory";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FundingAnalysis from "@/components/Dashboard/FundingAnalysis";

export default function TransfersPage() {
    const { activities, funding, loading } = usePortfolioData();

    return (
        <div className="flex flex-col gap-6 pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Transfers & History</h1>
                <p className="text-muted-foreground">Comprehensive view of all wallet and exchange movements.</p>
            </div>

            <Tabs defaultValue="history" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
                    <TabsTrigger value="history" className="px-6">Transaction History</TabsTrigger>
                    <TabsTrigger value="funding" className="px-6">Funding Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="history">
                    <TransactionHistory transactions={activities} />
                </TabsContent>

                <TabsContent value="funding">
                    <FundingAnalysis fundingData={funding} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
