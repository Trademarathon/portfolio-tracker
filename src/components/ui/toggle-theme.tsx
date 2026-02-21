'use client';

import React from 'react';
import { MonitorCogIcon, MoonStarIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { IconToggle } from '@/components/ui/icon-toggle';
import { cn } from '@/lib/utils';

export function ToggleTheme({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className={cn("w-full h-9 rounded-full bg-muted/50 border border-border animate-pulse", className)} />
        );
    }

    return (
        <IconToggle
            value={(theme as 'system' | 'light' | 'dark') || 'system'}
            onChange={(val) => setTheme(val)}
            options={[
                { value: 'light', icon: SunIcon, label: 'Light' },
                { value: 'system', icon: MonitorCogIcon, label: 'System' },
                { value: 'dark', icon: MoonStarIcon, label: 'Dark' },
            ]}
            className={cn("w-full border-border", className)}
            size="sm"
        />
    );
}
