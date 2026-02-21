"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, LayoutGrid, Activity } from "lucide-react";
import { memo, useState, useEffect, useRef } from "react";
import { ComponentSettingsLink } from "@/components/ui/ComponentSettingsLink";
import { motion } from "framer-motion";
import Image from "next/image";

const formatUSD = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
const formatPct = (val: number) => `${val > 0 ? "+" : ""}${val.toFixed(2)}%`;

interface TickerData {
  price: number;
  change24h: number;
}

interface DashboardHeaderProps {
  totalValue: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  btcPrice: number;
  btcChange: number;
  gold?: TickerData;
  silver?: TickerData;
}

const TickerPill = memo(({
  label,
  icon,
  price,
  change,
  flash,
  delay = 0,
}: {
  label: string;
  icon: React.ReactNode;
  price: number;
  change: number;
  flash?: "up" | "down" | null;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.35, ease: "easeOut" }}
    whileHover={{ y: -2, scale: 1.01 }}
    className={cn(
      "group relative flex items-center gap-2.5 rounded-full border px-3 py-1.5 transition-all duration-300",
      "bg-[linear-gradient(165deg,rgba(16,17,23,0.7),rgba(10,11,15,0.72))] border-white/10 hover:border-white/20",
      flash === "up" && "flash-up",
      flash === "down" && "flash-down"
    )}
  >
    <div className="flex items-center justify-center shrink-0">{icon}</div>
    <span className="font-bold text-white text-xs shrink-0">{label}</span>
    <span className="font-mono text-white text-xs tabular-nums">
      ${price > 0 ? price.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : "—"}
    </span>
    <span className={cn(
      "text-[10px] font-bold shrink-0",
      change >= 0 ? "text-emerald-400" : "text-rose-400",
      change === 0 && price > 0 ? "text-zinc-500" : ""
    )}>
      {price > 0 ? formatPct(change) : "—"}
    </span>
  </motion.div>
));

TickerPill.displayName = "TickerPill";

export const DashboardHeader = memo(({
  totalValue,
  totalPnlUsd,
  totalPnlPercent,
  btcPrice,
  btcChange,
  gold,
  silver,
}: DashboardHeaderProps) => {
  const [valueFlash, setValueFlash] = useState<"up" | "down" | null>(null);
  const [btcFlash, setBtcFlash] = useState<"up" | "down" | null>(null);
  const prevValue = useRef(totalValue);
  const prevBtc = useRef(btcPrice);

  useEffect(() => {
    if (totalValue > prevValue.current) {
      setValueFlash("up");
      const t = setTimeout(() => setValueFlash(null), 800);
      prevValue.current = totalValue;
      return () => clearTimeout(t);
    }
    if (totalValue < prevValue.current) {
      setValueFlash("down");
      const t = setTimeout(() => setValueFlash(null), 800);
      prevValue.current = totalValue;
      return () => clearTimeout(t);
    }
  }, [totalValue]);

  useEffect(() => {
    if (btcPrice > prevBtc.current) {
      setBtcFlash("up");
      const t = setTimeout(() => setBtcFlash(null), 800);
      prevBtc.current = btcPrice;
      return () => clearTimeout(t);
    }
    if (btcPrice < prevBtc.current) {
      setBtcFlash("down");
      const t = setTimeout(() => setBtcFlash(null), 800);
      prevBtc.current = btcPrice;
      return () => clearTimeout(t);
    }
  }, [btcPrice]);

  return (
    <div className="relative tm-tab-shell flex flex-col gap-3 pb-3 sticky top-0 z-40 px-4 md:px-6 lg:px-8 pt-4 backdrop-blur-xl gpu-accelerated no-select clone-noise clone-divider">
      <motion.div
        className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[linear-gradient(120deg,transparent_0%,rgba(99,102,241,0.1)_38%,transparent_70%)]"
        animate={{ x: ["-55%", "55%"] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
      />

      <ComponentSettingsLink tab="general" corner="top-right" title="Open Settings" size="xs" />
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.38 }}
            className="flex items-center gap-3 shrink-0"
          >
            <div className="tm-page-header-icon">
              <LayoutGrid className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="tm-page-title">Overview</h1>
                <div className="tm-live-pill">
                  <div className="tm-live-pill-dot animate-pulse" />
                  <span>LIVE</span>
                </div>
              </div>
              <p className="tm-page-subtitle">Portfolio command surface · positions · orders · signals</p>
            </div>
          </motion.div>

          <div className="hidden md:block h-8 w-px bg-white/10 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <TickerPill
              label="BTC"
              icon={<Image src="/brands/connections/bitcoin.svg" alt="BTC" width={16} height={16} className="w-4 h-4" />}
              price={btcPrice}
              change={btcChange}
              flash={btcFlash}
              delay={0.08}
            />
            <TickerPill
              label="Gold"
              icon={<span className="w-4 h-4 rounded-full flex items-center justify-center bg-amber-500/30 text-amber-400 text-[9px] font-black">Au</span>}
              price={gold?.price ?? 0}
              change={gold?.change24h ?? 0}
              delay={0.14}
            />
            <TickerPill
              label="Silver"
              icon={<span className="w-4 h-4 rounded-full flex items-center justify-center bg-zinc-400/30 text-zinc-300 text-[9px] font-black">Ag</span>}
              price={silver?.price ?? 0}
              change={silver?.change24h ?? 0}
              delay={0.2}
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          className="flex items-center gap-3 shrink-0 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
        >
          <div>
            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">Net Worth</div>
            <div className={cn(
              "text-xl font-black text-white font-mono tracking-tight p-0.5 rounded transition-colors font-balance-digital",
              valueFlash === 'up' && "flash-up",
              valueFlash === 'down' && "flash-down"
            )}>
              {formatUSD(totalValue)}
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className={cn(
            "rounded-lg px-2.5 py-1.5 transition-all",
            Math.abs(totalPnlPercent) >= 5 && (totalPnlUsd >= 0 ? "animate-pnl-glow-up" : "animate-pnl-glow-down")
          )}>
            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">24h PnL</div>
            <div className={cn("text-base font-bold font-mono flex items-center gap-2", totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {totalPnlUsd >= 0 ? <ArrowUpRight className="w-4 h-4 shrink-0" /> : <ArrowDownRight className="w-4 h-4 shrink-0" />}
              <span>{formatUSD(Math.abs(totalPnlUsd))}</span>
              <span className={cn("text-xs px-1.5 py-0.5 rounded", totalPnlUsd >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500')}>
                {formatPct(totalPnlPercent)}
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
            <Activity className="h-3 w-3" />
            <span className="text-[10px] font-black uppercase tracking-wider">Syncing</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
});

DashboardHeader.displayName = "DashboardHeader";
