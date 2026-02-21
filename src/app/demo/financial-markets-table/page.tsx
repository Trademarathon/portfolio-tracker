"use client";

import { useState, useEffect } from "react";
import { FinancialTable, type MarketIndex } from "@/components/ui/financial-markets-table";

const initialIndices: MarketIndex[] = [
  {
    id: "1",
    name: "Dow Jones USA",
    country: "USA",
    countryCode: "US",
    ytdReturn: 0.4,
    pltmEps: 18.74,
    divYield: 2.0,
    marketCap: 28.04,
    volume: 1.7,
    chartData: [330.5, 331.2, 330.8, 331.5, 332.1, 331.8, 332.4, 333.2, 333.9, 333.7],
    price: 333.9,
    dailyChange: -0.2,
    dailyChangePercent: -0.06,
  },
  {
    id: "2",
    name: "S&P 500 USA",
    country: "USA",
    countryCode: "US",
    ytdReturn: 11.72,
    pltmEps: 7.42,
    divYield: 1.44,
    marketCap: 399.6,
    volume: 24.6,
    chartData: [425.1, 426.3, 427.8, 428.1, 429.2, 428.9, 429.5, 429.1, 428.7, 428.9],
    price: 428.72,
    dailyChange: -0.82,
    dailyChangePercent: -0.19,
  },
  {
    id: "3",
    name: "Nasdaq USA",
    country: "USA",
    countryCode: "US",
    ytdReturn: 36.59,
    pltmEps: null,
    divYield: 0.54,
    marketCap: 199.9,
    volume: 18.9,
    chartData: [360.2, 361.8, 362.4, 363.1, 364.3, 363.8, 364.1, 363.5, 363.2, 362.97],
    price: 362.97,
    dailyChange: -1.73,
    dailyChangePercent: -0.47,
  },
];

export default function FinancialTableDemoPage() {
  const [indices, setIndices] = useState<MarketIndex[]>(initialIndices);

  const handleIndexSelect = (indexId: string) => {
    console.log("Selected market index:", indexId);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setIndices((prev) =>
        prev.map((index) => {
          const lastPrice = index.chartData[index.chartData.length - 1];
          const variation = (Math.random() - 0.5) * 2;
          const newPrice = Math.max(1, lastPrice + variation);
          const newChartData = [...index.chartData.slice(1), newPrice];
          const priceChange = newPrice - lastPrice;
          const priceChangePercent = (priceChange / lastPrice) * 100;

          return {
            ...index,
            chartData: newChartData,
            price: newPrice,
            dailyChange: priceChange,
            dailyChangePercent: priceChangePercent,
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background py-6 md:py-12">
      <div className="container mx-auto mt-12 px-2 sm:px-4">
        <FinancialTable title="Index" indices={indices} onIndexSelect={handleIndexSelect} />
      </div>
    </div>
  );
}
