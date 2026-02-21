"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, memo, useRef } from "react";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
    children: React.ReactNode;
    className?: string;
}

// Stable-mount wrapper with subtle fade only
export const PageWrapper = memo(({ children, className }: PageWrapperProps) => {
    const pathname = usePathname();
    const [isFading, setIsFading] = useState(false);
    const prevPathname = useRef(pathname);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip animation on first render
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        
        if (prevPathname.current !== pathname) {
            setIsFading(true);
            const timer = setTimeout(() => {
                setIsFading(false);
                prevPathname.current = pathname;
            }, 160);
            return () => clearTimeout(timer);
        }
    }, [pathname]);

    return (
        <div
            className={cn(
                "w-full h-full",
                "transition-opacity duration-150 ease-out",
                isFading ? "opacity-95" : "opacity-100",
                className
            )}
        >
            {children}
        </div>
    );
});
