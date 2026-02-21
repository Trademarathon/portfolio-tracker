"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Key, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useLicense } from "@/contexts/LicenseContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateToken } from "@/lib/license/token";
import { useNotifications } from "@/components/Notifications/NotificationSystem";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export function LicenseSettingsCard() {
  const { isValid, expiresAt, tier, activate, deactivate } = useLicense();
  const { notify } = useNotifications();
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

    if (ok) {
      setTokenInput("");
      const exp = result.expiresAt;
      notify({ type: "success", title: "License Activated", message: exp ? `Valid until ${format(new Date(exp * 1000), "PPP")}` : "License activated." });
    } else {
      setError("Activation failed");
    }
  };

  const handleDeactivate = () => {
    deactivate();
    notify({ type: "success", title: "License Removed", message: "You will need to enter a valid token to use the app." });
  };

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-lg bg-indigo-500/20">
            <Key className="h-4 w-4 text-indigo-400" />
          </div>
          Subscription License
        </CardTitle>
        <CardDescription>
          Manage your Trade Marathon® subscription. A valid license is required to use the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            {isValid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="font-bold text-white text-sm">
                {isValid ? "Active" : "No license"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {isValid && expiresAt
                  ? `Valid until ${format(new Date(expiresAt * 1000), "PPP")} (${tier || "subscription"})`
                  : "Enter a license token to activate"}
              </p>
            </div>
          </div>
          {isValid && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeactivate}
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            >
              Deactivate
            </Button>
          )}
        </div>

        {/* Enter new license */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Enter new license token
          </Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="TM-..."
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
              className="flex-1 font-mono text-sm bg-black/40 border-white/10"
              disabled={isActivating}
            />
            <Button
              onClick={handleActivate}
              disabled={isActivating}
              className="shrink-0"
            >
              {isActivating ? "Activating..." : "Activate"}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
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
      </CardContent>
    </Card>
  );
}
