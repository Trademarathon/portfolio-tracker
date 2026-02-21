"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { FileText, Settings, ArrowLeft } from "lucide-react";
import { JOURNAL_SIDEBAR_ITEMS } from "@/lib/nav-definitions";
import { NavItem } from "@/components/ui/NavItem";

export function JournalSidebar() {
    return (
        <aside className="fixed left-0 top-0 h-screen w-[200px] bg-zinc-900/80 border-r border-zinc-800/50 flex flex-col z-40">
            {/* Logo / Title */}
            <div className="h-16 flex items-center px-4 border-b border-zinc-800/50">
                <Link href="/journal" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-sm font-bold text-white">Journal</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {JOURNAL_SIDEBAR_ITEMS.map((item) => (
                    <NavItem key={item.href} item={item} variant="journal" />
                ))}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-zinc-800/50 space-y-1">
                <Link
                    href="/settings?tab=journal"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    )}
                >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                </Link>
                <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                </Link>
            </div>
        </aside>
    );
}
