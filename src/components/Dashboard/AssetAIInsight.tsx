"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Info, Calendar, Newspaper, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { chatWithAI } from "@/lib/api/ai";

interface AssetAIInsightProps {
    symbol: string;
    isOpen: boolean;
    onClose: () => void;
}

type SectionKey = "fundamentals" | "unlocks" | "news";
type Sentiment = "bullish" | "neutral" | "bearish";
type Volatility = "low" | "medium" | "high";

interface AssetInsightResult {
    fundamentals: string;
    unlocks: string;
    news: string;
    sentiment: Sentiment;
    volatility: Volatility;
    tags: string[];
}

export function AssetAIInsight({ symbol, isOpen, onClose }: AssetAIInsightProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [typedText, setTypedText] = useState("");
    const [activeSection, setActiveSection] = useState<SectionKey>("fundamentals");
    const [insight, setInsight] = useState<AssetInsightResult>(() => buildFallbackInsight(symbol || "ASSET"));
    const requestIdRef = useRef(0);

    const sectionText = useMemo(() => insight[activeSection], [insight, activeSection]);

    useEffect(() => {
        if (!isOpen || !symbol) return;
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);
        setTypedText("");
        setActiveSection("fundamentals");

        const today = new Date().toISOString().slice(0, 10);
        const fetchInsight = async () => {
            try {
                const response = await chatWithAI({
                    feature: "asset_ai_insight",
                    jsonMode: true,
                    temperature: 0.2,
                    maxTokens: 320,
                    messages: [
                        {
                            role: "system",
                            content:
                                "Return strict JSON only with keys fundamentals, unlocks, news, sentiment, volatility, tags. " +
                                "Use concise plain-English lines for a trader. Sentiment must be bullish|neutral|bearish. " +
                                "Volatility must be low|medium|high. tags should be 1-3 short labels.",
                        },
                        {
                            role: "user",
                            content: `Symbol: ${symbol}. Date: ${today}. Give a concise desk-level snapshot.`,
                        },
                    ],
                });
                if (requestId !== requestIdRef.current) return;
                setInsight(parseInsight(response.content, symbol));
            } catch (err) {
                if (requestId !== requestIdRef.current) return;
                setInsight(buildFallbackInsight(symbol));
                setError(err instanceof Error ? err.message : "AI insight request failed");
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        };

        void fetchInsight();
    }, [isOpen, symbol]);

    useEffect(() => {
        if (!isOpen || loading) {
            setTypedText("");
            return;
        }
        const fullText = sectionText;
        let i = 0;
        const interval = setInterval(() => {
            i += 2;
            setTypedText(fullText.slice(0, i));
            if (i >= fullText.length) clearInterval(interval);
        }, 12);
        return () => clearInterval(interval);
    }, [loading, sectionText, isOpen, activeSection]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/20">
                                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{symbol} AI INSIGHT</h3>
                                    <p className="text-[9px] text-zinc-500 font-bold">Neural Analysis Engine v2.1</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-zinc-400" />
                            </button>
                        </div>

                        {/* Navigation */}
                        <div className="flex p-2 bg-black/40 gap-1">
                                {[
                                    { id: 'fundamentals', icon: Info, label: 'Fundamentals' },
                                    { id: 'unlocks', icon: Calendar, label: 'Unlocks' },
                                    { id: 'news', icon: Newspaper, label: 'Alpha' }
                                ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveSection(tab.id as SectionKey);
                                        setTypedText("");
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all duration-300",
                                        activeSection === tab.id ? "bg-primary/20 text-primary border border-primary/20" : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                                    )}
                                >
                                    <tab.icon className="w-3 h-3" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="p-6 min-h-[160px] relative">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <motion.div
                                                key={i}
                                                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                                className="w-1.5 h-1.5 rounded-full bg-primary"
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Scanning Blockchain...</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-zinc-300 text-sm leading-relaxed font-medium font-mono min-h-[4.5rem]">
                                        {typedText}
                                        <motion.span
                                            animate={{ opacity: [0, 1, 0] }}
                                            transition={{ duration: 0.8, repeat: Infinity }}
                                            className="inline-block w-1 h-4 ml-1 bg-primary align-middle"
                                        />
                                    </div>

                                    {/* Action Chips */}
                                    <div className="flex flex-wrap gap-2 pt-4">
                                        <div
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black",
                                                insight.sentiment === "bullish" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                                                insight.sentiment === "neutral" && "bg-zinc-500/10 border-zinc-500/30 text-zinc-300",
                                                insight.sentiment === "bearish" && "bg-rose-500/10 border-rose-500/20 text-rose-400",
                                            )}
                                        >
                                            <CheckCircle2 size={10} /> {insight.sentiment.toUpperCase()} SENTIMENT
                                        </div>
                                        <div
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black",
                                                insight.volatility === "high" && "bg-rose-500/10 border-rose-500/20 text-rose-400",
                                                insight.volatility === "medium" && "bg-amber-500/10 border-amber-500/20 text-amber-300",
                                                insight.volatility === "low" && "bg-cyan-500/10 border-cyan-500/20 text-cyan-300",
                                            )}
                                        >
                                            <Zap size={10} /> {insight.volatility.toUpperCase()} VOLATILITY
                                        </div>
                                        {insight.tags.slice(0, 2).map((tag) => (
                                            <div
                                                key={tag}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black text-primary"
                                            >
                                                <Sparkles size={10} /> {tag.toUpperCase()}
                                            </div>
                                        ))}
                                    </div>

                                    {error && (
                                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[10px] text-amber-200">
                                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>{error}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Overlay */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function parseInsight(raw: string, symbol: string): AssetInsightResult {
    const fallback = buildFallbackInsight(symbol);
    const parsed = extractJsonObject(raw);
    if (!parsed) {
        return {
            ...fallback,
            fundamentals: cleanLine(raw, fallback.fundamentals),
        };
    }
    return {
        fundamentals: cleanLine(parsed.fundamentals, fallback.fundamentals),
        unlocks: cleanLine(parsed.unlocks, fallback.unlocks),
        news: cleanLine(parsed.news, fallback.news),
        sentiment: toSentiment(parsed.sentiment),
        volatility: toVolatility(parsed.volatility),
        tags: toTags(parsed.tags),
    };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
    const text = String(raw || "").trim();
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const candidate = fenced || text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        return null;
    }
    return null;
}

function cleanLine(value: unknown, fallback: string): string {
    const text = typeof value === "string" ? value.trim() : "";
    return text ? text.replace(/\s+/g, " ") : fallback;
}

function toSentiment(value: unknown): Sentiment {
    const v = String(value || "").toLowerCase();
    if (v === "bullish" || v === "bearish") return v;
    return "neutral";
}

function toVolatility(value: unknown): Volatility {
    const v = String(value || "").toLowerCase();
    if (v === "low" || v === "high") return v;
    return "medium";
}

function toTags(value: unknown): string[] {
    const raw = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split(/[,\n]/)
            : [];
    return raw
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, 3);
}

function buildFallbackInsight(symbol: string): AssetInsightResult {
    const cleanSymbol = (symbol || "ASSET").toUpperCase();
    return {
        fundamentals: `${cleanSymbol} fundamentals are available but no live AI detail could be generated right now.`,
        unlocks: `Unlock schedule and emissions for ${cleanSymbol} should be checked before sizing new risk.`,
        news: `No fresh catalyst summary returned. Review latest protocol, exchange, and macro headlines for ${cleanSymbol}.`,
        sentiment: "neutral",
        volatility: "medium",
        tags: ["watchlist", "risk-check"],
    };
}
