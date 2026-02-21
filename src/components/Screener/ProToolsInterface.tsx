"use client";

import { useState, useRef, useEffect } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { X, Layout, Maximize2 } from "lucide-react";
import { createChart, ColorType, LineSeries } from 'lightweight-charts';

const REAL_TICKERS = ["ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT", "MATIC", "INJ", "RNDR", "PEPE", "WIF", "SUI", "FET"];

// Mock realistic crypto "spaghetti" charting data starting at 0%
const generateRealisticSpaghettiData = (primaryAsset: string) => {
    const data: Record<string, any[]> = {};
    const symbols = [primaryAsset, ...REAL_TICKERS.filter(t => t !== primaryAsset)].slice(0, 16);

    symbols.forEach(s => data[s] = []);

    const volatilities: Record<string, number> = {};
    const biases: Record<string, number> = {};
    const currentValues: Record<string, number> = {};

    symbols.forEach(s => {
        currentValues[s] = 0;
        // Primary is naturally less volatile than alts
        volatilities[s] = s === primaryAsset ? 0.3 : (Math.random() * 1.5 + 0.8);
        biases[s] = (Math.random() - 0.5) * 0.15; // slight directional drift
    });

    const now = Math.floor(Date.now() / 1000);
    const HOURS = 150;

    // Force exact 0 as the starting point.
    for (const s of symbols) {
        data[s].push({ time: (now - HOURS * 3600), value: 0 });
    }

    for (let i = 1; i < HOURS; i++) {
        const time = (now - (HOURS - i) * 3600);

        symbols.forEach(s => {
            // Random walk with momentum
            const change = (Math.random() - 0.5 + biases[s]) * volatilities[s];
            currentValues[s] += change;

            // Add some "market correlation" - alts sort of follow primary slightly
            if (s !== primaryAsset && i > 1) {
                const primaryChange = data[primaryAsset][i - 1].value - data[primaryAsset][i - 2].value;
                currentValues[s] += primaryChange * (Math.random() * 1.8 + 0.5);
            }

            data[s].push({ time, value: currentValues[s] });
        });
    }

    return data;
};

const TVRSChart = ({ primaryAsset, data }: { primaryAsset: string, data: Record<string, any[]> }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [lastValues, setLastValues] = useState<Record<string, number>>({});

    const primaryColor = "#3b82f6";
    const colors = [
        "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
        "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#6366f1",
        "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
    ];

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#71717a',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
            },
            rightPriceScale: {
                mode: 2, // Percentage
                borderColor: 'rgba(255, 255, 255, 0.05)',
                visible: true,
                alignLabels: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                visible: false, // Matches screenshot cleanly without explicit dates visually crowding
                borderColor: 'rgba(255, 255, 255, 0.05)',
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    color: 'rgba(255,255,255,0.4)',
                    width: 1,
                    style: 3,
                    labelVisible: false,
                },
                horzLine: {
                    visible: false,
                    labelVisible: false,
                },
            },
            handleScroll: {
                vertTouchDrag: false,
            }
        });

        const seriesMap: Record<string, any> = {};
        const latest: Record<string, number> = {};

        const altKeys = Object.keys(data).filter(k => k !== primaryAsset).slice(0, 15);

        // Sort keys by final value so legend naturally waterfalls correctly for aesthetic mapping
        const finalValues = altKeys.map(k => ({ key: k, val: data[k][data[k].length - 1]?.value || 0 }));
        finalValues.sort((a, b) => b.val - a.val);
        const sortedAltKeys = finalValues.map(v => v.key);

        sortedAltKeys.forEach((key, i) => {
            const series = chart.addSeries(LineSeries, {
                color: colors[i % colors.length],
                lineWidth: 1,
                lineType: 2 as any, // Curled smooth line
                crosshairMarkerVisible: false,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            series.setData(data[key]);
            seriesMap[key] = series;
            latest[key] = data[key][data[key].length - 1]?.value || 0;
            series.applyOptions({ color: `${colors[i % colors.length]}aa` });
        });

        if (data[primaryAsset]) {
            const series = chart.addSeries(LineSeries, {
                color: primaryColor,
                lineWidth: 3,
                lineType: 2 as any,
                crosshairMarkerVisible: true,
                lastValueVisible: true,
                priceLineVisible: false,
            });
            series.setData(data[primaryAsset]);
            seriesMap[primaryAsset] = series;
            latest[primaryAsset] = data[primaryAsset][data[primaryAsset].length - 1]?.value || 0;
        }

        setLastValues(latest);
        chart.timeScale().fitContent();

        chart.subscribeCrosshairMove((param) => {
            if (param.time && param.point && param.point.x > 0 && param.point.y > 0) {
                const currentVals: Record<string, number> = {};
                if (data[primaryAsset]) {
                    const dataItem = param.seriesData.get(seriesMap[primaryAsset]);
                    if (dataItem && 'value' in dataItem) currentVals[primaryAsset] = (dataItem as any).value;
                }
                Object.keys(data).filter(k => k !== primaryAsset).slice(0, 15).forEach(key => {
                    const dataItem = param.seriesData.get(seriesMap[key]);
                    if (dataItem && 'value' in dataItem) currentVals[key] = (dataItem as any).value;
                });

                if (Object.keys(currentVals).length > 0) {
                    setLastValues(currentVals);
                } else {
                    setLastValues(latest);
                }
            } else {
                setLastValues(latest);
            }
        });

        const handleResize = () => {
            if (containerRef.current) {
                chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
            }
        };
        const ro = new ResizeObserver(handleResize);
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            chart.remove();
        };
    }, [data, primaryAsset]);

    const primaryVal = lastValues[primaryAsset] || 0;

    return (
        <div className="w-full h-full relative overflow-hidden bg-[#0c0c0e]">
            {/* The TV chart container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* TradingView Legend matching the uploaded image exactly */}
            <div className="absolute top-4 left-4 flex flex-col gap-[3px] text-[11px] font-mono leading-none z-10 pointer-events-none select-none drop-shadow-md">
                <div className="text-blue-400 mb-1 flex items-center gap-2 tracking-tight">
                    <span className="font-semibold">{primaryAsset}</span>
                    <span>{primaryVal > 0 ? '+' : ''}{primaryVal.toFixed(2)}%</span>
                </div>
                {Object.keys(data).filter(k => k !== primaryAsset).slice(0, 15).map((key, i) => {
                    const val = lastValues[key] || 0;
                    return (
                        <div key={key} style={{ color: colors[i % colors.length] }} className="flex items-center gap-1.5 opacity-90 tracking-tight">
                            <span>{key}</span>
                            <span>{val > 0 ? '+' : ''}{val.toFixed(2)}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export function ProToolsInterface() {
    const [rsBtcData] = useState(() => generateRealisticSpaghettiData("BTC"));
    const [rsSolData] = useState(() => generateRealisticSpaghettiData("SOL"));

    return (
        <div className="flex h-[800px] w-full bg-[#0c0c0e] text-zinc-300 rounded-xl overflow-hidden border border-white/5 font-sans">
            {/* Main Layout Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Nav inside the tool */}
                <div className="h-12 border-b border-white/5 flex items-center px-4 gap-6 bg-[#111115] shrink-0 text-sm font-medium text-zinc-500">
                    <button className="text-white">Relative Strength (Spaghetti)</button>
                    <button className="hover:text-zinc-300 transition-colors">Compare</button>
                    <button className="hover:text-zinc-300 transition-colors">Correlations</button>
                    <div className="flex-1" />
                    <button className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded text-xs transition-colors">
                        Settings
                    </button>
                </div>

                {/* Resizable Panels */}
                <div className="flex-1 h-full overflow-hidden p-1">
                    <PanelGroup orientation="horizontal" className="h-full">
                        {/* Panel 1: RS BTC */}
                        <Panel defaultSize={50} minSize={20}>
                            <div className="h-full bg-[#111115] border border-white/5 rounded-lg flex flex-col relative group">
                                <div className="h-8 border-b border-white/5 flex items-center justify-between px-3 shrink-0">
                                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                                        BTC <span className="text-emerald-400">$67,072.4</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Maximize2 className="w-3 h-3 text-zinc-600 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <X className="w-3 h-3 text-zinc-600 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden relative">
                                    <TVRSChart primaryAsset="BTC" data={rsBtcData} />
                                </div>
                            </div>
                        </Panel>

                        <PanelResizeHandle className="w-1 bg-transparent hover:bg-blue-500/50 transition-colors cursor-col-resize mx-0.5" />

                        {/* Panel 2: RS SOL */}
                        <Panel defaultSize={50} minSize={20}>
                            <div className="h-full bg-[#111115] border border-white/5 rounded-lg flex flex-col relative group">
                                <div className="h-8 border-b border-white/5 flex items-center justify-between px-3 shrink-0">
                                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                        SOL <span className="text-emerald-400">$193.20</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Maximize2 className="w-3 h-3 text-zinc-600 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <X className="w-3 h-3 text-zinc-600 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden relative">
                                    <TVRSChart primaryAsset="SOL" data={rsSolData} />
                                </div>
                            </div>
                        </Panel>
                    </PanelGroup>
                </div>
            </div>
        </div>
    );
}
