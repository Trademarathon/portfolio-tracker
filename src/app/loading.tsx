"use client";

import { motion } from "framer-motion";

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="relative">
                {/* Outer ring */}
                <motion.div
                    className="w-16 h-16 rounded-full border-2 border-primary/20"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                {/* Inner glowing core */}
                <motion.div
                    className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
            <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-serif font-black uppercase tracking-[0.3em] text-white/40">Synchronizing</p>
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-1 h-1 rounded-full bg-primary"
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
