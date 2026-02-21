"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { loadSocialSettings, saveSocialSettings, type SocialSettings } from "@/lib/social-settings";
import { cn } from "@/lib/utils";

export function SocialSettings() {
  const [settings, setSettings] = useState<SocialSettings>(loadSocialSettings());

  const update = (next: Partial<SocialSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveSocialSettings(merged);
  };

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border">
      <CardHeader>
        <CardTitle className="text-base">Social Feed Settings</CardTitle>
        <CardDescription>External social integration is disabled. Configure local feed filters here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">Enable Social Feed</div>
            <div className="text-xs text-zinc-500">Enable social feed cards where supported.</div>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Curated Accounts</label>
            <Input
              placeholder="whale_alert, lookonchain, glassnode"
              value={settings.accounts.join(", ")}
              onChange={(e) =>
                update({ accounts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Keywords</label>
            <Input
              placeholder="BTC, ETH, funding, liquidation"
              value={settings.keywords.join(", ")}
              onChange={(e) =>
                update({ keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
              }
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Show In</label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["overview", "markets", "spot", "balances"] as const).map((key) => (
              <button
                key={key}
                onClick={() =>
                  update({
                    sections: { ...settings.sections, [key]: !settings.sections[key] },
                  })
                }
                className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold",
                  settings.sections[key]
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-white/10 bg-white/5 text-zinc-400"
                )}
              >
                {key.toUpperCase()}
                <span className="text-[10px]">{settings.sections[key] ? "ON" : "OFF"}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
