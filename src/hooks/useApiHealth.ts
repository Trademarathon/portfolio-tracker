"use client";

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api/client";

function getApiBaseUrl(): string {
    if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_URL || "";
    const env = process.env.NEXT_PUBLIC_API_URL;
    if (env) return env;
    return "";
}

export function useApiHealth() {
    const [unreachable, setUnreachable] = useState(false);
    const [checked, setChecked] = useState(false);

    const check = useCallback(async () => {
        const base = getApiBaseUrl();
        if (!base) {
            setUnreachable(false);
            setChecked(true);
            return;
        }
        setUnreachable(false);
        try {
            const res = await fetch(apiUrl("/api/health"), { method: "GET" });
            setUnreachable(!res.ok);
        } catch {
            setUnreachable(true);
        } finally {
            setChecked(true);
        }
    }, []);

    useEffect(() => {
        check();
    }, [check]);

    return { unreachable: unreachable && checked, retry: check };
}
