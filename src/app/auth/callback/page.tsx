"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"exchanging" | "done" | "error">("exchanging");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      setStatus("error");
      setMessage(errorDescription || errorParam);
      return;
    }

    if (!code) {
      setStatus("done");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase not configured");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(() => {
        setStatus("done");
        window.location.href = "/settings?tab=general";
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message || "Sign-in failed");
      });
  }, [searchParams]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-sm text-rose-400 text-center max-w-md">{message}</p>
        <a
          href="/settings?tab=general"
          className="text-sm text-indigo-400 hover:text-indigo-300 underline"
        >
          Back to Settings
        </a>
      </div>
    );
  }

  if (status === "done" && !searchParams.get("code")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-sm text-zinc-500">No code received. Redirecting…</p>
        <a
          href="/settings?tab=general"
          className="text-sm text-indigo-400 hover:text-indigo-300 underline"
        >
          Go to Settings
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      <p className="text-sm text-zinc-500">Signing you in…</p>
    </div>
  );
}
