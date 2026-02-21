"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandId = "binance" | "hyperliquid" | "tradingview" | "bybit";
type BrandVariant = "mark" | "wordmark";

interface BrandLogoProps {
  brand: BrandId;
  variant?: BrandVariant;
  size?: number;
  className?: string;
}

const BRAND_MAP: Record<BrandId, { mark: string; wordmark?: string; label: string }> = {
  binance: {
    mark: "/binance.svg",
    label: "Binance",
  },
  bybit: {
    mark: "/bybit.svg",
    label: "Bybit",
  },
  hyperliquid: {
    mark: "/brands/hyperliquid-mark.svg",
    wordmark: "/hyperliquid.png",
    label: "Hyperliquid",
  },
  tradingview: {
    mark: "/brands/tradingview-mark.svg",
    label: "TradingView",
  },
};

export function BrandLogo({
  brand,
  variant = "mark",
  size = 18,
  className,
}: BrandLogoProps) {
  const entry = BRAND_MAP[brand];
  const src = variant === "wordmark" && entry.wordmark ? entry.wordmark : entry.mark;

  if (variant === "wordmark") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)} title={entry.label}>
        <span className="relative shrink-0" style={{ width: size, height: size }}>
          <Image src={entry.mark} alt={entry.label} fill className="object-contain" unoptimized />
        </span>
        {entry.wordmark ? (
          <span className="relative inline-block h-4" style={{ width: Math.round(size * 3.8) }}>
            <Image src={src} alt={`${entry.label} wordmark`} fill className="object-contain object-left" unoptimized />
          </span>
        ) : (
          <span className="text-[11px] font-bold tracking-wide">{entry.label}</span>
        )}
      </span>
    );
  }

  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }} title={entry.label}>
      <Image src={src} alt={entry.label} fill className="object-contain" unoptimized />
    </span>
  );
}

