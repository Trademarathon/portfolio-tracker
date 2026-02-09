'use client';

import React from 'react';
import { MonitorCogIcon, MoonStarIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { IconToggle } from '@/components/ui/icon-toggle';

export function ToggleTheme() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-[100px] h-10 bg-zinc-900 rounded-full opacity-20" />;
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
            className="w-full bg-zinc-900/50 border-white/5"
            size="sm"
        />
    );
}
