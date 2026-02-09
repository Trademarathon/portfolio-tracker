"use client";

import { GlowingEffectDemo } from "@/components/demos/GlowingEffectDemo";

export default function DemoPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold font-mono text-white">Component Demo</h1>
                <p className="text-muted-foreground">Showcasing the GlowingEffect component.</p>
            </div>

            <div className="py-8">
                <GlowingEffectDemo />
            </div>
        </div>
    );
}
