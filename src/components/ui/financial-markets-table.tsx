"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";

export interface MarketIndex {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  ytdReturn: number;
  pltmEps: number | null;
  divYield: number;
  marketCap: number;
  volume: number;
  chartData: number[];
  price: number;
  dailyChange: number;
  dailyChangePercent: number;
}

interface FinancialTableProps {
  title?: string;
  indices?: MarketIndex[];
  onIndexSelect?: (indexId: string) => void;
  className?: string;
}

const defaultIndices: MarketIndex[] = [
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
  {
    id: "4",
    name: "TSX Canada",
    country: "Canada",
    countryCode: "CA",
    ytdReturn: -0.78,
    pltmEps: 6.06,
    divYield: 2.56,
    marketCap: 3.67,
    volume: 771.5,
    chartData: [32.1, 32.3, 32.5, 32.4, 32.7, 32.8, 32.9, 33.0, 32.9, 32.96],
    price: 32.96,
    dailyChange: 0.19,
    dailyChangePercent: 0.58,
  },
  {
    id: "5",
    name: "Grupo BMV Mexico",
    country: "Mexico",
    countryCode: "MX",
    ytdReturn: 4.15,
    pltmEps: 8.19,
    divYield: 2.34,
    marketCap: 1.22,
    volume: 1.1,
    chartData: [52.1, 52.8, 53.2, 53.5, 53.9, 54.1, 54.3, 54.0, 53.8, 53.7],
    price: 53.7,
    dailyChange: -1.01,
    dailyChangePercent: -1.85,
  },
  {
    id: "6",
    name: "Ibovespa Brazil",
    country: "Brazil",
    countryCode: "BR",
    ytdReturn: 11.19,
    pltmEps: 6.23,
    divYield: 9.46,
    marketCap: 4.87,
    volume: 6.8,
    chartData: [28.5, 28.8, 29.1, 29.3, 29.5, 29.4, 29.6, 29.5, 29.3, 29.28],
    price: 29.28,
    dailyChange: -0.06,
    dailyChangePercent: -0.22,
  },
];

export function FinancialTable({
  title = "Index",
  indices: initialIndices = defaultIndices,
  onIndexSelect,
  className = "",
}: FinancialTableProps = {}) {
  const indices = initialIndices;
  const [selectedIndex, setSelectedIndex] = useState<string | null>("1");
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleIndexSelect = (indexId: string) => {
    setSelectedIndex(indexId);
    if (onIndexSelect) onIndexSelect(indexId);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatLargeNumber = (amount: number, unit: string) => {
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}${unit}`;
    return `${amount.toFixed(1)}${unit}`;
  };
  const formatPercentage = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  const getPerformanceColor = (value: number) => {
    if (!mounted) {
      const isPositive = value >= 0;
      return {
        bgColor: isPositive ? "bg-green-500/10" : "bg-red-500/10",
        borderColor: isPositive ? "border-green-500/30" : "border-red-500/30",
        textColor: isPositive ? "text-green-400" : "text-red-400",
      };
    }

    const isPositive = value >= 0;
    const bgColor = isPositive ? (isDark ? "bg-green-500/10" : "bg-green-50") : (isDark ? "bg-red-500/10" : "bg-red-50");
    const borderColor = isPositive ? (isDark ? "border-green-500/30" : "border-green-200") : (isDark ? "border-red-500/30" : "border-red-200");
    const textColor = isPositive ? (isDark ? "text-green-400" : "text-green-600") : (isDark ? "text-red-400" : "text-red-600");
    return { bgColor, borderColor, textColor };
  };

  const getCountryFlag = (countryCode: string) => {
    switch (countryCode) {
      case "US":
        return "🇺🇸";
      case "CA":
        return "🇨🇦";
      case "MX":
        return "🇲🇽";
      case "BR":
        return "🇧🇷";
      default:
        return "🌐";
    }
  };

  const renderSparkline = (data: number[]) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * 60;
        const y = 20 - ((value - min) / range) * 15;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <div className="h-6 w-16">
        <motion.svg
          width="60"
          height="20"
          viewBox="0 0 60 20"
          className="overflow-visible"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25, duration: shouldReduceMotion ? 0.2 : 0.5 }}
        >
          <motion.polyline
            points={points}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: shouldReduceMotion ? 0.3 : 0.8, ease: "easeOut", delay: 0.2 }}
          />
        </motion.svg>
      </div>
    );
  };

  const containerVariants = {
    visible: {
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.1,
      },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: { type: "spring" as const, stiffness: 400, damping: 25, mass: 0.7 },
    },
  };

  return (
    <div className={`mx-auto w-full max-w-7xl ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-background">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div
              className="border-b border-border/20 bg-muted/15 px-8 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground/70"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "250px 100px minmax(60px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr) minmax(80px, 1fr) minmax(60px, 1fr) minmax(100px, 1fr)",
                columnGap: "6px",
              }}
            >
              <div>{title}</div>
              <div>YTD Return</div>
              <div>P/LTM EPS</div>
              <div>Div yield</div>
              <div>Mkt cap</div>
              <div>Volume</div>
              <div>2-day chart</div>
              <div>Price</div>
              <div className="pr-4">Daily performance</div>
            </div>

            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              {indices.map((index, indexNum) => (
                <motion.div key={index.id} variants={rowVariants}>
                  <div
                    className={`group relative cursor-pointer px-8 py-3 transition-all duration-200 ${
                      selectedIndex === index.id ? "border-b border-border/30 bg-muted/50" : "hover:bg-muted/30"
                    } ${indexNum < indices.length - 1 && selectedIndex !== index.id ? "border-b border-border/20" : ""}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "250px 100px minmax(60px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr) minmax(80px, 1fr) minmax(60px, 1fr) minmax(100px, 1fr)",
                      columnGap: "6px",
                    }}
                    onClick={() => handleIndexSelect(index.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border/30 text-lg">
                        {getCountryFlag(index.countryCode)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground/90">{index.name}</div>
                        <div className="text-xs text-muted-foreground/70">{index.country}</div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {(() => {
                        const { bgColor, borderColor, textColor } = getPerformanceColor(index.ytdReturn);
                        return (
                          <div className={`rounded-lg border px-2 py-1 text-xs font-medium ${bgColor} ${borderColor} ${textColor}`}>
                            {formatPercentage(index.ytdReturn)}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">{index.pltmEps ? index.pltmEps.toFixed(2) : "N/A"}</span>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-orange-500">{formatPercentage(index.divYield)}</span>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">{formatLargeNumber(index.marketCap, "B")}</span>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">
                        {index.volume >= 1 ? formatLargeNumber(index.volume, "M") : `${(index.volume * 1000).toFixed(1)}k`}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <div className="px-6">{renderSparkline(index.chartData)}</div>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold text-foreground/90">{formatCurrency(index.price)}</span>
                    </div>

                    <div className="flex items-center gap-2 pr-4">
                      <span className={`font-semibold ${getPerformanceColor(index.dailyChange).textColor}`}>
                        {index.dailyChange >= 0 ? "+" : ""}
                        {index.dailyChange.toFixed(2)}
                      </span>
                      {(() => {
                        const { bgColor, borderColor, textColor } = getPerformanceColor(index.dailyChangePercent);
                        return (
                          <div className={`rounded-lg border px-2 py-1 text-xs font-medium ${bgColor} ${borderColor} ${textColor}`}>
                            {formatPercentage(index.dailyChangePercent)}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
