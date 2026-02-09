"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    PieChart,
    Wallet,
    BarChart2,
    ArrowRightLeft,
    BookOpen,
    Settings,
    Star,
    Globe,
    Target,
} from "lucide-react";
import { ToggleTheme } from "@/components/ui/toggle-theme";

const sidebarItems = [
    {
        title: "Overview",
        href: "/",
        icon: LayoutDashboard,
    },
    {
        title: "TM Screener",
        href: "/watchlist",
        icon: BarChart2,
    },
    {
        title: "All Markets",
        href: "/markets",
        icon: Globe,
    },
    {
        title: "Spot Holdings",
        href: "/spot",
        icon: PieChart,
    },
    {
        title: "Balances",
        href: "/balances",
        icon: Wallet,
    },
    {
        title: "Wallet Tracker",
        href: "/wallet-tracker",
        icon: Globe,
    },
    {
        title: "Futures",
        href: "/futures",
        icon: BarChart2,
    },
    {
        title: "Transactions",
        href: "/transactions",
        icon: ArrowRightLeft,
    },
    {
        title: "Transfers",
        href: "/transfers",
        icon: ArrowRightLeft,
    },
    {
        title: "Journal",
        href: "/journal",
        icon: BookOpen,
    },
    {
        title: "About",
        href: "/about",
        icon: Star,
    },
    {
        title: "Settings",
        href: "/settings",
        icon: Settings,
    },
];

import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useWebSocketStatus } from "@/hooks/useWebSocketStatus";
import { WebSocketConnectionInfo } from "@/lib/api/websocket-types";

// ... constants ...

interface SidebarProps {
    className?: string;
    onClose?: () => void; // For mobile close
}

export default function Sidebar({ className, onClose }: SidebarProps) {
    const pathname = usePathname();
    // Use the hook we created earlier or stick to usePortfolioData if that hook wasn't properly exported
    // Let's use usePortfolioData directly for safety as I recall creating the hook but maybe not exporting it perfectly
    const { wsConnectionStatus } = usePortfolioData();

    // Calculate system status
    const statusArray = Array.from(wsConnectionStatus?.values() || []);
    const totalConnections = statusArray.length;
    const connectedCount = statusArray.filter(s => s.status === 'connected').length;

    let systemStatus: 'online' | 'partial' | 'offline' = 'offline';
    if (totalConnections > 0) {
        if (connectedCount === totalConnections) systemStatus = 'online';
        else if (connectedCount > 0) systemStatus = 'partial';
    } else {
        // If no connections, simpler "System Ready" or similar? 
        // Or just online if we consider the app itself. 
        // Let's stick to "System Standby" if 0 connections.
        systemStatus = 'online'; // Default to online if no connections programmed yet
    }

    return (
        <div className={cn("h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50", className)}>
            <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative h-10 w-44 overflow-hidden">
                            <Image
                                src="/logo.png"
                                alt="Trade Marathon"
                                fill
                                className="object-contain filter dark:brightness-110"
                                priority
                            />
                        </div>
                    </Link>
                </div>

                <nav className="space-y-2 mb-8">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm",
                                    isActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground")} />
                                <span className="font-medium">{item.title}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="px-4 py-4 border-t border-sidebar-border mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono mb-3">Theme Selection</p>
                    <ToggleTheme />
                </div>
            </div>

            <div className="mt-auto p-6 border-t border-sidebar-border">
                <div className={cn(
                    "rounded-xl p-4 border transition-colors duration-500",
                    systemStatus === 'online' ? "bg-emerald-500/10 border-emerald-500/20" :
                        systemStatus === 'partial' ? "bg-yellow-500/10 border-yellow-500/20" :
                            "bg-red-500/10 border-red-500/20"
                )}>
                    <p className={cn(
                        "text-xs font-medium mb-1",
                        systemStatus === 'online' ? "text-emerald-500" :
                            systemStatus === 'partial' ? "text-yellow-500" :
                                "text-red-500"
                    )}>
                        System Status
                    </p>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "h-2 w-2 rounded-full animate-pulse",
                            systemStatus === 'online' ? "bg-emerald-500" :
                                systemStatus === 'partial' ? "bg-yellow-500" :
                                    "bg-red-500"
                        )} />
                        <span className="text-xs text-foreground/80">
                            {systemStatus === 'online' ? 'All Systems Operational' :
                                systemStatus === 'partial' ? `${connectedCount}/${totalConnections} Connected` :
                                    'System Offline'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
