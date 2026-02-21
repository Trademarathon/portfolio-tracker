"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Settings, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PreferencesPage() {
    const router = useRouter();
    
    // Auto-redirect after 2 seconds
    useEffect(() => {
        const timeout = setTimeout(() => {
            router.push('/settings?tab=journal');
        }, 2000);
        
        return () => clearTimeout(timeout);
    }, [router]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center h-[60vh]"
        >
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                    <Settings className="w-8 h-8 text-emerald-400" />
                </div>
                
                <h1 className="text-2xl font-bold text-white mb-2">Settings Moved</h1>
                <p className="text-zinc-400 mb-6">
                    Journal and Playbook settings are now in the main Settings page for easier access.
                </p>
                
                <Link
                    href="/settings?tab=journal"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors"
                >
                    Go to Settings
                    <ArrowRight className="w-4 h-4" />
                </Link>
                
                <p className="text-xs text-zinc-500 mt-4">
                    Redirecting automatically in 2 seconds...
                </p>
            </div>
        </motion.div>
    );
}
