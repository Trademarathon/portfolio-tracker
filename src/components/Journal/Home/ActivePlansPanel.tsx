"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SpotPlan, PerpPlan } from "@/lib/api/session";
import { Target, Shield, TrendingUp, ArrowRight, BookOpen, Zap } from "lucide-react";

interface ActivePlansPanelProps {
    spotPlans: SpotPlan[];
    perpPlans: PerpPlan[];
}

interface PlanCardProps {
    plan: SpotPlan | PerpPlan;
    type: 'spot' | 'perp';
}

function PlanCard({ plan, type }: PlanCardProps) {
    const isPerp = type === 'perp';
    const leverage = isPerp ? (plan as PerpPlan).leverage : undefined;
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="neo-metric p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30 hover:border-zinc-600/50 transition-all group"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{plan.symbol}</span>
                    <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                        plan.bias === 'long' ? "bg-emerald-500/20 text-emerald-400" : 
                        plan.bias === 'short' ? "bg-rose-500/20 text-rose-400" :
                        "bg-zinc-500/20 text-zinc-400"
                    )}>
                        {plan.bias}
                    </span>
                    {leverage && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                            {leverage}x
                        </span>
                    )}
                </div>
                <span className={cn(
                    "text-[10px] font-medium uppercase",
                    isPerp ? "text-purple-400" : "text-blue-400"
                )}>
                    {type}
                </span>
            </div>
            
            {/* Key levels preview */}
            <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                {!isPerp && (plan as SpotPlan).buyLimits?.length ? (
                    <span className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-emerald-400" />
                        Buy: {(plan as SpotPlan).buyLimits!.length} level{(plan as SpotPlan).buyLimits!.length > 1 ? "s" : ""}
                    </span>
                ) : null}
                {!isPerp && (plan as SpotPlan).sellLimits?.length ? (
                    <span className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-rose-400" />
                        Sell: {(plan as SpotPlan).sellLimits!.length} level{(plan as SpotPlan).sellLimits!.length > 1 ? "s" : ""}
                    </span>
                ) : null}
                {plan.entryZone && (isPerp || (!(plan as SpotPlan).buyLimits?.length && !(plan as SpotPlan).sellLimits?.length)) && (
                    <span className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-emerald-400" />
                        Entry: ${plan.entryZone.low.toFixed(2)}
                    </span>
                )}
                {plan.stopLoss && (
                    <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-rose-400" />
                        Stop: ${plan.stopLoss.toFixed(2)}
                    </span>
                )}
            </div>
            
            {/* Targets count */}
            {plan.targets && plan.targets.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
                    <TrendingUp className="w-3 h-3" />
                    {plan.targets.length} target{plan.targets.length > 1 ? 's' : ''}
                </div>
            )}
        </motion.div>
    );
}

export function ActivePlansPanel({ spotPlans, perpPlans }: ActivePlansPanelProps) {
    const activeSpotPlans = spotPlans.filter(p => p.isActive);
    const activePerpPlans = perpPlans.filter(p => p.isActive);
    const totalActive = activeSpotPlans.length + activePerpPlans.length;
    
    return (
        <div className="neo-card neo-card-warm p-4 rounded-2xl bg-zinc-900/40 border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-zinc-200" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Active Plans</h3>
                        <p className="text-[10px] text-zinc-500">
                            {totalActive} active • {activeSpotPlans.length} spot • {activePerpPlans.length} perp
                        </p>
                    </div>
                </div>
                
                <Link 
                    href="/spot" 
                    className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
            
            {/* Plans List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {totalActive > 0 ? (
                    <>
                        {activeSpotPlans.map(plan => (
                            <PlanCard key={plan.id} plan={plan} type="spot" />
                        ))}
                        {activePerpPlans.map(plan => (
                            <PlanCard key={plan.id} plan={plan} type="perp" />
                        ))}
                    </>
                ) : (
                    <div className="py-8 text-center">
                        <Zap className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No active plans</p>
                        <Link 
                            href="/spot" 
                            className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 inline-block"
                        >
                            Create a trading plan
                        </Link>
                    </div>
                )}
            </div>
            
            {/* Quick Stats */}
            {totalActive > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-2">
                    <div className="text-center">
                        <p className="text-[10px] text-zinc-500">Long</p>
                        <p className="text-sm font-bold text-emerald-400">
                            {[...activeSpotPlans, ...activePerpPlans].filter(p => p.bias === 'long').length}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-zinc-500">Short</p>
                        <p className="text-sm font-bold text-rose-400">
                            {[...activeSpotPlans, ...activePerpPlans].filter(p => p.bias === 'short').length}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-zinc-500">With Leverage</p>
                        <p className="text-sm font-bold text-amber-400">
                            {activePerpPlans.filter(p => p.leverage && p.leverage > 1).length}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
