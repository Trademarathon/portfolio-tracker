"use client";

import { useState, useEffect } from "react";
import {
  signInWithPassword,
  signUp,
  signInWithOAuth,
} from "@/lib/supabase/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Lock, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const REMEMBER_EMAIL_KEY = "auth_remember_email";

export interface SignInFormProps {
  className?: string;
  onSuccess?: () => void;
}

export function SignInForm({ className, onSuccess }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(REMEMBER_EMAIL_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string };
        if (parsed?.email && typeof parsed.email === "string") {
          setEmail(parsed.email);
          setRememberMe(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const persistRememberEmail = (value: string) => {
    if (typeof window === "undefined") return;
    try {
      if (rememberMe && value.trim()) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, JSON.stringify({ email: value.trim() }));
      } else if (!rememberMe) {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      // ignore
    }
  };

  const handleSignInWithPassword = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setPasswordLoading(true);
    const { error: err } = await signInWithPassword(email.trim(), password);
    setPasswordLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    persistRememberEmail(email);
    onSuccess?.();
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setPasswordLoading(true);
    const { error: err, needsEmailConfirm } = await signUp(email.trim(), password);
    setPasswordLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSignUpSuccess(true);
    if (needsEmailConfirm) {
      setError(null);
    }
    onSuccess?.();
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    setOauthLoading(provider);
    const { error: err } = await signInWithOAuth(provider);
    if (err) {
      setError(err.message);
      setOauthLoading(null);
      return;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <Tabs defaultValue="password" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9 bg-zinc-800/50 border border-white/5">
          <TabsTrigger value="password" className="text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
            Password
          </TabsTrigger>
          <TabsTrigger value="signup" className="text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300">
            Sign up
          </TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="space-y-3 mt-3">
          <p className="text-xs text-zinc-500">Sign in with your email and password.</p>
          <div className="space-y-2">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (rememberMe) persistRememberEmail(e.target.value);
              }}
              className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRememberMe(checked);
                  if (checked && email.trim()) {
                    persistRememberEmail(email);
                  } else if (!checked) {
                    if (typeof window !== "undefined") localStorage.removeItem(REMEMBER_EMAIL_KEY);
                  }
                }}
                className="rounded border-white/20 bg-zinc-900/50 text-indigo-500 focus:ring-indigo-500/50"
              />
              <span className="text-xs text-zinc-400">Remember login details</span>
            </label>
            <button
              onClick={handleSignInWithPassword}
              disabled={!email.trim() || !password || passwordLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
            >
              {passwordLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Sign in
            </button>
          </div>
        </TabsContent>
        <TabsContent value="signup" className="space-y-3 mt-3">
          {signUpSuccess ? (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              Account created. Check your email to confirm, then sign in with Password.
            </p>
          ) : (
            <>
              <p className="text-xs text-zinc-500">Create an account with email and password.</p>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                />
                <button
                  onClick={handleSignUp}
                  disabled={!email.trim() || !password || password !== confirmPassword || passwordLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                >
                  {passwordLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Sign up
                </button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      <div className="space-y-2 pt-2 border-t border-white/5">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Or sign in with</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={!!oauthLoading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50",
              oauthLoading === "google" && "opacity-70"
            )}
          >
            {oauthLoading === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("apple")}
            disabled={!!oauthLoading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50",
              oauthLoading === "apple" && "opacity-70"
            )}
          >
            {oauthLoading === "apple" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 6.98.48 10.01.93 1.01 1.53 2.12 1.38 3.37-.12 1.11-.78 2.2-1.43 3.03zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
            )}
            Apple
          </button>
        </div>
      </div>
    </div>
  );
}
