"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Home,
    LayoutDashboard,
    BarChart3,
    Calendar,
    FileText,
    Settings,
} from "lucide-react";

const items = [
    { id: "home", label: "My Home", href: "/journal", icon: Home },
    { id: "dashboard", label: "Dashboard", href: "/journal/dashboard", icon: LayoutDashboard },
    { id: "reports", label: "Reports", href: "/journal/reports", icon: BarChart3 },
    { id: "analytics", label: "Analytics", href: "/journal/analytics", icon: BarChart3 },
    { id: "calendar", label: "Calendar", href: "/journal/calendar", icon: Calendar },
    { id: "trades", label: "Trades", href: "/journal/trades", icon: FileText },
    { id: "preferences", label: "Preferences", href: "/journal/preferences", icon: Settings },
];

export function JournalTopNav() {
    const pathname = usePathname();

    return (
        <nav className="mb-4">
            <div className="tm-tab-shell neo-shell p-2">
            <div className="flex gap-2 overflow-x-auto pb-0.5">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/journal" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={cn(
                                "neo-tab flex flex-col items-center justify-center min-w-[90px] px-3 py-2.5 rounded-xl border text-[11px] font-semibold transition-colors",
                                "bg-zinc-900/35 border-white/[0.05] text-zinc-400 hover:text-white hover:border-white/[0.14]",
                                isActive && "border-sky-500/45 bg-sky-500/12 text-sky-200"
                            )}
                            data-state={isActive ? "active" : "inactive"}
                        >
                            <Icon
                                className={cn(
                                    "w-4 h-4 mb-1.5",
                                    isActive ? "text-sky-300" : "text-zinc-500"
                                )}
                            />
                            <span className="text-center leading-tight">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
            </div>
        </nav>
    );
}
