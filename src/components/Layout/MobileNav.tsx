"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "./Sidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MobileNav = memo(function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar when route changes - instant
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Prevent body scroll when menu is open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleClose = useCallback(() => setIsOpen(false), []);
    const handleOpen = useCallback(() => setIsOpen(true), []);

    return (
        <div className="md:hidden">
            {/* Mobile Header */}
            <div className="fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-white/5 flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xl">P</span>
                    </div>
                    <span className="text-xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Portfolio
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleOpen}
                    className="text-muted-foreground hover:text-white active:scale-95 transition-transform duration-75"
                >
                    <Menu className="h-6 w-6" />
                </Button>
            </div>

            {/* Spacer for fixed header */}
            <div className="h-16" />

            {/* Ultra-fast CSS-based Overlay & Sidebar */}
            {/* Backdrop - CSS transition instead of framer-motion */}
            <div 
                onClick={handleClose}
                className={cn(
                    "fixed inset-0 bg-black/80 z-50 backdrop-blur-sm transition-opacity duration-150 ease-out",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
            />

            {/* Sidebar - CSS transform instead of framer-motion */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-50 shadow-xl transition-transform duration-150 ease-out",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="relative h-full">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-white z-50 md:hidden active:scale-95 transition-transform duration-75"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                    <Sidebar
                        className="w-[280px] h-full"
                        onClose={handleClose}
                    />
                </div>
            </div>
        </div>
    );
});

export default MobileNav;
