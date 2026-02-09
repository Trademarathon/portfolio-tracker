"use client";

import { ToggleTheme } from "@/components/ui/toggle-theme";
import { cn } from '@/lib/utils';

export function ToggleThemeDemo() {
    return (
        <div className="relative flex min-h-[200px] w-full items-center justify-center rounded-lg border bg-background p-10">
            <div
                aria-hidden="true"
                className={cn(
                    'absolute inset-0 -z-10 size-full',
                    'bg-[radial-gradient(color-mix(in_oklab,--theme(--color-foreground/.1)30%,transparent)_2px,transparent_2px)]',
                    'bg-[size:12px_12px]',
                )}
            />
            <ToggleTheme />
        </div>
    );
}
