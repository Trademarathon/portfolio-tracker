"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Shield, Lock, Clock, RefreshCw, Zap } from "lucide-react";
import { useTradingSecurity } from "@/hooks/useTradingSecurity";
import { getLockOnTabBlur, setLockOnTabBlur } from "@/lib/security/trading";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/components/Notifications/NotificationSystem";

export function TradingSecurityCard() {
  const { enabled, hasPin, unlocked, lockTimeout, enableTrading, setupPin, clearPin, unlockWithPin, lock, updateLockTimeout, refresh } = useTradingSecurity();
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [lockOnBlur, setLockOnBlurState] = useState(getLockOnTabBlur());
  const { notify } = useNotifications();

  const handleSetupPin = async () => {
    if (pinInput.length < 4 || pinInput.length > 8) {
      notify({ type: "error", title: "Invalid PIN", message: "PIN must be 4-8 digits." });
      return;
    }
    if (pinInput !== pinConfirm) {
      notify({ type: "error", title: "Mismatch", message: "PINs do not match." });
      return;
    }
    await setupPin(pinInput);
    setPinInput("");
    setPinConfirm("");
    notify({ type: "success", title: "PIN Set", message: "Trading PIN enabled." });
  };

  const handleLockOnBlurChange = (checked: boolean) => {
    setLockOnTabBlur(checked);
    setLockOnBlurState(checked);
    notify({ type: "success", title: "Saved", message: checked ? "Trading locks when tab loses focus." : "Tab blur lock disabled." });
  };

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Shield className="h-4 w-4 text-amber-400" />
          </div>
          Trading Security
        </CardTitle>
        <CardDescription>
          Protect your API keys with PIN and session lock. Required before placing orders via connected exchanges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Trading */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-amber-400" />
            <div>
              <Label className="font-bold text-white text-sm">Enable Trading</Label>
              <p className="text-[10px] text-zinc-500 mt-0.5">Allow order placement from the terminal</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={enableTrading} />
        </div>

        {/* Trading PIN */}
        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-400" />
              <div>
                <Label className="font-bold text-white text-sm">Trading PIN</Label>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {hasPin ? "Enter PIN to unlock before placing orders" : "Optional 4-8 digit PIN for extra protection"}
                </p>
              </div>
            </div>
            {hasPin && (
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">ACTIVE</span>
            )}
          </div>
          {hasPin ? (
            <div className="flex gap-2">
              <button
                onClick={lock}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 text-xs font-medium"
              >
                Lock Now
              </button>
              <button
                onClick={async () => {
                  await clearPin();
                  refresh();
                  notify({ type: "success", title: "PIN Removed", message: "Trading PIN cleared." });
                }}
                className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium"
              >
                Remove PIN
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="PIN (4-8 digits)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-zinc-600 focus:border-amber-500/50 outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="Confirm"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-zinc-600 focus:border-amber-500/50 outline-none"
              />
              <button
                onClick={handleSetupPin}
                disabled={pinInput.length < 4 || pinInput !== pinConfirm}
                className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
              >
                Set PIN
              </button>
            </div>
          )}
        </div>

        {/* Lock timeout */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <div>
              <Label className="font-bold text-white text-sm">Auto-lock timeout</Label>
              <p className="text-[10px] text-zinc-500 mt-0.5">Minutes of inactivity before session locks</p>
            </div>
          </div>
          <select
            value={lockTimeout}
            onChange={(e) => updateLockTimeout(parseInt(e.target.value, 10))}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500/50 outline-none"
          >
            {[5, 15, 30, 60, 120].map((m) => (
              <option key={m} value={m} className="bg-zinc-900 text-white">
                {m} min
              </option>
            ))}
          </select>
        </div>

        {/* Lock on tab blur */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-amber-400" />
            <div>
              <Label className="font-bold text-white text-sm">Lock on tab switch</Label>
              <p className="text-[10px] text-zinc-500 mt-0.5">Lock trading when you switch to another tab</p>
            </div>
          </div>
          <Switch checked={lockOnBlur} onCheckedChange={handleLockOnBlurChange} />
        </div>

        {unlocked && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-500">Trading session unlocked</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
