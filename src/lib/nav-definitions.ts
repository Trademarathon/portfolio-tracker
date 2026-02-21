/**
 * Unified Navigation - Single source of truth for main sidebar and journal sidebar.
 * Use these definitions for consistent tab names and icons across the app.
 */

import type { LucideIcon } from 'lucide-react';
import {
    LayoutDashboard,
    BarChart2,
    PieChart,
    Wallet,
    Globe,
    BookMarked,
    BookOpen,
    Activity,
    Info,
    Settings,
    TrendingUp,
    Home,
    BarChart3,
    Tag,
    Calendar,
    FileText,
    ListOrdered,
    CircleDot,
    Clock3,
    GitCompareArrows,
    HelpCircle,
    Layers3,
    Shield,
    Trophy,
} from 'lucide-react';

export interface NavItemDef {
    href: string;
    title: string;
    icon: LucideIcon;
    children?: NavItemDef[];
}

export const MAIN_SIDEBAR_ITEMS: NavItemDef[] = [
    { href: '/', title: 'Overview', icon: LayoutDashboard },
    { href: '/watchlist', title: 'Markets', icon: TrendingUp },
    { href: '/balances', title: 'Balances', icon: Wallet },
    { href: '/futures', title: 'Futures', icon: BarChart2 },
    { href: '/wallet-tracker', title: 'Wallet Tracker', icon: Globe },
    { href: '/playbook', title: 'Playbook', icon: BookMarked },
    { href: '/journal', title: 'Journal', icon: BookOpen },
    { href: '/activity', title: 'Activity', icon: Activity },
    { href: '/how-it-works', title: 'How it works', icon: HelpCircle },
    { href: '/about', title: 'About', icon: Info },
    { href: '/settings', title: 'Settings', icon: Settings },
];

export const JOURNAL_SIDEBAR_ITEMS: NavItemDef[] = [
    { href: '/journal', title: 'Home', icon: Home },
    { href: '/journal/dashboard', title: 'Dashboard', icon: LayoutDashboard },
    {
        href: '/journal/reports',
        title: 'Reports',
        icon: BarChart3,
        children: [
            { href: '/journal/reports/tags', title: 'Tags', icon: Tag },
            { href: '/journal/reports/symbols', title: 'Symbols', icon: PieChart },
            { href: '/journal/reports/pnl-curve', title: 'PnL Curve', icon: TrendingUp },
            { href: '/journal/reports/risk', title: 'Risk', icon: Shield },
            { href: '/journal/reports/day-time', title: 'Day & Time', icon: Clock3 },
            { href: '/journal/reports/playbook', title: 'Playbook', icon: Layers3 },
            { href: '/journal/reports/win-loss', title: 'Win vs Loss', icon: Trophy },
            { href: '/journal/reports/compare', title: 'Compare', icon: GitCompareArrows },
            { href: '/journal/reports/options', title: 'Options', icon: CircleDot },
        ],
    },
    { href: '/journal/analytics', title: 'Analytics', icon: TrendingUp },
    { href: '/journal/calendar', title: 'Calendar', icon: Calendar },
    {
        href: '/journal/trades',
        title: 'Trades',
        icon: FileText,
        children: [
            { href: '/journal/trades', title: 'All Trades', icon: ListOrdered },
            { href: '/journal/trades/open', title: 'Open Positions', icon: CircleDot },
        ],
    },
    { href: '/journal/preferences', title: 'Preferences', icon: Settings },
];
