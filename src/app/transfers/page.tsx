"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TransfersRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/activity?filter=transfers");
    }, [router]);
    return (
        <div className="flex min-h-[60vh] items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
    );
}
