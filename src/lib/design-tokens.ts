/**
 * Unified Design System - Single source of truth for spacing, radius, typography, and icon sizes.
 * Use these tokens everywhere for consistent, professional UI.
 */

export const SPACING = {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    12: 48,
    16: 64,
} as const;

export const RADIUS = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
} as const;

export const TYPOGRAPHY = {
    pageTitle: 'text-2xl font-bold',
    sectionTitle: 'text-lg font-bold',
    cardTitle: 'text-sm font-bold',
    body: 'text-sm',
    label: 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground',
    value: 'text-lg font-black',
    valueCompact: 'text-sm font-bold',
    caption: 'text-[10px] text-muted-foreground',
} as const;

export const ICON_SIZES = {
    nav: 18,
    widgetGrid: 18,
    widgetTab: 14,
    stat: 16,
    card: 16,
    badge: 12,
} as const;
