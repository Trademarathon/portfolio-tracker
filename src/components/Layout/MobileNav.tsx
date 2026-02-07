"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "./Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    return (
        <div className="md:hidden">
            {/* Mobile Header */}
            <div className="fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-white/5 flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xl">P</span>
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Portfolio
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(true)}
                    className="text-muted-foreground hover:text-white"
                >
                    <Menu className="h-6 w-6" />
                </Button>
            </div>

            {/* Spacer for fixed header */}
            <div className="h-16" />

            {/* Overlay & Sidebar */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
                        />

                        {/* Sidebar */}
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 20, stiffness: 300 }}
                            className="fixed inset-y-0 left-0 z-50 shadow-xl"
                        >
                            <div className="relative h-full">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsOpen(false)}
                                    className="absolute top-4 right-4 text-muted-foreground hover:text-white z-50 md:hidden"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                                <Sidebar
                                    className="w-[280px] h-full"
                                    onClose={() => setIsOpen(false)}
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
