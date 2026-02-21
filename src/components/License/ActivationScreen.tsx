"use client";

import { useState } from "react";
import Image from "next/image";
import { useLicense } from "@/contexts/LicenseContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateToken } from "@/lib/license/token";
import { Key, ExternalLink, AlertCircle } from "lucide-react";

export function ActivationScreen() {
  const { activate } = useLicense();
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError("Please enter your license token");
      return;
    }

    setError(null);
    setIsActivating(true);

    const result = validateToken(trimmed);

    if (!result.valid) {
      setError(result.error || "Invalid token");
      setIsActivating(false);
      return;
    }

    const ok = await activate(trimmed);
    setIsActivating(false);

    if (!ok) {
      setError("Activation failed");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950 overflow-auto">
      <div className="w-full max-w-md mx-4 p-8 rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-14 w-40">
              <Image
                src="/trade-marathon-logo.png"
                alt="Trade Marathon®"
                fill
                className="object-contain filter dark:brightness-110"
              />
            </div>
            <h1 className="text-xl font-bold text-white text-center">
              Activate Your License
            </h1>
            <p className="text-sm text-zinc-400 text-center max-w-sm">
              Enter your subscription token to access Trade Marathon®. Without a valid token, the app cannot be used.
            </p>
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Key className="h-3.5 w-3.5" />
                License Token
              </label>
              <Input
                type="text"
                placeholder="TM-..."
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                className="h-11 bg-black/40 border-white/10 font-mono text-sm placeholder:text-zinc-600"
                disabled={isActivating}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={handleActivate}
              disabled={isActivating}
              className="w-full h-11 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold"
            >
              {isActivating ? "Activating..." : "Activate"}
            </Button>
          </div>

          <a
            href="https://www.trademarathon.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Purchase a license at trademarathon.trade
          </a>
        </div>
      </div>
    </div>
  );
}
