"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItemDef } from "@/lib/nav-definitions";
import { ICON_SIZES } from "@/lib/design-tokens";

/** Shared NavItem for Sidebar and JournalSidebar. Renders a nav link with optional children. */
export interface NavItemProps {
    item: NavItemDef;
    variant: "main" | "journal";
    isActive?: boolean;
    isPending?: boolean;
    onClick?: (e: React.MouseEvent, href: string) => void;
    onPrefetch?: (href: string) => void;
    collapsed?: boolean;
}

export function NavItem({
    item,
    variant,
    isActive = false,
    isPending = false,
    onClick,
    onPrefetch,
    collapsed = false,
}: NavItemProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = item.children && item.children.length > 0;
    const active =
        variant === "main"
            ? (isActive ?? pathname === item.href)
            : pathname === item.href || (hasChildren && item.children!.some((c) => pathname === c.href));

    if (variant === "main") {
        const Icon = item.icon;
        return (
            <Link
                href={item.href}
                prefetch={false}
                onMouseEnter={() => onPrefetch?.(item.href)}
                onClick={(e) => onClick?.(e, item.href)}
                className={cn(
                    "group relative isolate flex items-center gap-3 rounded-xl border transition-all duration-200",
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                    active
                        ? "text-zinc-100 border-white/20 bg-gradient-to-r from-white/[0.13] via-white/[0.07] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                        : "text-zinc-400 border-transparent hover:text-zinc-200 hover:border-white/10 hover:bg-white/[0.04]",
                    isPending && "opacity-70"
                )}
                title={collapsed ? item.title : undefined}
            >
                {active && (
                    <span className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(120%_130%_at_0%_0%,rgba(45,212,191,0.14),rgba(0,0,0,0))]" />
                )}
                <div
                    className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-full transition-all duration-200",
                        active ? "bg-emerald-400 opacity-100" : "bg-transparent opacity-0"
                    )}
                />
                <span
                    className={cn(
                        "relative z-10 flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200",
                        active
                            ? "border-white/25 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                            : "border-white/8 bg-white/[0.02] group-hover:border-white/20 group-hover:bg-white/[0.06]"
                    )}
                >
                    <Icon
                        size={ICON_SIZES.nav}
                        className={cn(
                            "shrink-0 transition-all duration-200",
                            active
                                ? "text-zinc-100 scale-105"
                                : "text-zinc-500 group-hover:text-zinc-300 group-hover:scale-105"
                        )}
                    />
                </span>
                {!collapsed && (
                    <span
                        className={cn(
                            "relative z-10 text-[13px] tracking-[0.01em] transition-colors",
                            active ? "font-bold text-zinc-100" : "font-medium text-zinc-300/90 group-hover:text-zinc-100"
                        )}
                    >
                        {item.title}
                    </span>
                )}
                {isPending && (
                    <div className="absolute right-3 z-10 w-3 h-3">
                        <div className="h-full w-full animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    </div>
                )}
            </Link>
        );
    }

    // Journal variant: supports children with expand/collapse
    const Icon = item.icon;
    const handleClick = (e: React.MouseEvent) => {
        if (hasChildren) {
            e.preventDefault();
            setIsOpen(!isOpen);
        }
    };

    return (
        <div>
            <Link
                href={item.href}
                onClick={handleClick}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-[11px] font-bold transition-all",
                    active
                        ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/30"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                )}
            >
                <Icon
                    size={20}
                    className={active ? "text-emerald-400" : "text-zinc-500"}
                />
                <span className="text-center leading-tight">{item.title}</span>
                {hasChildren && (
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                    </motion.div>
                )}
            </Link>
            <AnimatePresence>
                {hasChildren && isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="py-1">
                            {item.children!.map((child) => (
                                <NavItemChild key={child.href} item={child} pathname={pathname} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function NavItemChild({ item, pathname }: { item: NavItemDef; pathname: string }) {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-center gap-3 pl-10 py-2 pr-3 rounded-lg text-sm font-medium transition-all",
                isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )}
        >
            <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-emerald-400" : "text-zinc-500")} />
            <span className="flex-1">{item.title}</span>
        </Link>
    );
}
