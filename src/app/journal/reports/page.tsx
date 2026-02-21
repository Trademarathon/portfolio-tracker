"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tag, PieChart, TrendingUp, ChevronRight } from "lucide-react";

const reports = [
    {
        id: 'tags',
        title: 'Tags Report',
        description: 'Analyze your performance by strategy tags. See which strategies work best for you.',
        icon: Tag,
        href: '/journal/reports/tags',
        color: 'violet',
    },
    {
        id: 'symbols',
        title: 'Symbols Report',
        description: 'Break down your performance by trading pair. Identify your most profitable markets.',
        icon: PieChart,
        href: '/journal/reports/symbols',
        color: 'blue',
    },
    {
        id: 'pnl-curve',
        title: 'PnL Curve Report',
        description: 'Compare equity curves across different dimensions like sessions, time of day, and more.',
        icon: TrendingUp,
        href: '/journal/reports/pnl-curve',
        color: 'emerald',
    },
];

export default function ReportsPage() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <div className="mb-8">
                <h2 className="text-2xl font-black text-white">Reports</h2>
                <p className="text-sm text-zinc-500 mt-1">
                    Deep dive into your trading performance with specialized reports
                </p>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {reports.map((report, index) => {
                    const colorClasses = {
                        violet: 'bg-violet-500/20 text-violet-400 group-hover:bg-violet-500/30',
                        blue: 'bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30',
                        emerald: 'bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30',
                    };

                    return (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Link
                                href={report.href}
                                className="group block p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-all"
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                                    colorClasses[report.color as keyof typeof colorClasses]
                                )}>
                                    <report.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{report.title}</h3>
                                <p className="text-sm text-zinc-500 mb-4">{report.description}</p>
                                <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-white transition-colors">
                                    <span>View Report</span>
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}
