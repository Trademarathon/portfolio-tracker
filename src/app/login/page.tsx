"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { SignInForm } from "@/components/Auth/SignInForm";
import { setLoginAsBuilderFlag } from "@/lib/user-cloud/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, HelpCircle } from "lucide-react";

export default function LoginPage() {
  const { user, isLoading } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const asBuilder = searchParams.get("as") === "builder";
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  useEffect(() => {
    if (asBuilder) setLoginAsBuilderFlag();
  }, [asBuilder]);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(next);
    }
  }, [user, isLoading, next, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Link href="/" className="flex flex-col items-center gap-2 group">
            <Image
              src="/trade-marathon-logo.png"
              alt="Trade Marathon®"
              width={240}
              height={80}
              className="object-contain w-full max-w-[280px] h-auto"
              priority
            />
          </Link>
          <p className="text-sm text-muted-foreground italic">Build for the marathon, not the sprint.</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-xl p-6 shadow-lg">
          {asBuilder && (
            <p className="text-xs text-indigo-400 mb-3 pb-2 border-b border-white/5">
              Signing in as app builder — you’ll get Admin tab and full Supabase sync.
            </p>
          )}
          <SignInForm />
          <div className="mt-3 pt-2 border-t border-white/5 text-center">
            {asBuilder ? (
              <Link href="/login" className="text-xs text-zinc-500 hover:text-zinc-400">
                Sign in as regular user instead
              </Link>
            ) : (
              <Link href="/login?as=builder" className="text-xs text-zinc-500 hover:text-indigo-400">
                Sign in as app builder
              </Link>
            )}
          </div>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            aria-label="How it works"
          >
            <HelpCircle className="h-4 w-4" />
            <span>How it works</span>
          </button>
        </div>
        <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
          <DialogContent className="max-h-[90vh] flex flex-col dark:border-zinc-800 dark:bg-zinc-950">
            <DialogHeader>
              <DialogTitle>How it works & why sign in</DialogTitle>
              <DialogDescription>
                One dashboard for CEX and wallets, real-time sync, and tools to trade like a pro.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[80vh] overflow-y-auto space-y-5 pr-2">
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-1">How it actually works</h3>
                <p className="text-sm text-muted-foreground">
                  Trade Marathon gives you one place for all your exchange and wallet positions. Connect your CEX (e.g. Binance) and wallets in Settings; data syncs in real time. Use Overview for a single view of holdings, Markets for trading, Journal to log and learn from trades, and Alerts to get notified when price or conditions hit your targets.
                </p>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-1">Why you need this to become a professional trader</h3>
                <p className="text-sm text-muted-foreground">
                  Clarity: one place for positions and history instead of scattered spreadsheets. A journal to learn from every trade. Alerts so you act on your plan instead of watching screens. Building habits for the long run—marathon, not sprint—is how you get from reactive to professional.
                </p>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">App flow</h3>
                <div className="w-full overflow-x-auto py-2">
                  <svg viewBox="0 0 900 180" className="w-full min-w-[600px] h-auto" style={{ maxHeight: "180px" }}>
                    <defs>
                      <linearGradient id="loginFlowGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
                      </linearGradient>
                      <marker id="loginArrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" opacity="0.6" />
                      </marker>
                    </defs>
                    {[
                      { x: 20, y: 30, w: 100, h: 50, label: "1. Connect", sub: "Add API keys & wallets" },
                      { x: 160, y: 30, w: 100, h: 50, label: "2. Sync", sub: "Real-time data" },
                      { x: 300, y: 30, w: 100, h: 50, label: "3. View", sub: "Overview & Holdings" },
                      { x: 440, y: 30, w: 100, h: 50, label: "4. Trade", sub: "Markets" },
                      { x: 580, y: 30, w: 100, h: 50, label: "5. Analyze", sub: "Journal & AI" },
                      { x: 720, y: 30, w: 100, h: 50, label: "6. Optimize", sub: "Alerts & Reports" },
                    ].map((box, i) => (
                      <g key={i}>
                        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" fill="url(#loginFlowGrad1)" stroke="#6366f1" strokeWidth="1.5" opacity="0.9" />
                        <text x={box.x + box.w / 2} y={box.y + 22} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{box.label}</text>
                        <text x={box.x + box.w / 2} y={box.y + 38} textAnchor="middle" fill="#a1a1aa" fontSize="8">{box.sub}</text>
                      </g>
                    ))}
                    {[100, 240, 380, 520, 660].map((x, i) => (
                      <line key={i} x1={x + 40} y1="55" x2={x + 80} y2="55" stroke="#6366f1" strokeWidth="2" markerEnd="url(#loginArrowhead)" opacity="0.7" />
                    ))}
                  </svg>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-1">Example</h3>
                <p className="text-sm text-muted-foreground">
                  Connect Binance in Settings → see positions on Overview → set price alerts in Alerts → get notified and trade with clarity.
                </p>
              </section>
              <div className="pt-2 border-t border-border">
                <Link
                  href="/how-it-works"
                  onClick={() => setHowItWorksOpen(false)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                >
                  View full guide
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
