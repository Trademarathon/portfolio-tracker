"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeDropboxCode } from "@/lib/user-cloud/dropbox";
import {
  setUserCloudProvider,
  setStoredTokens,
  type StoredUserCloudTokens,
} from "@/lib/user-cloud/config";
import { Loader2 } from "lucide-react";

export default function DropboxCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"exchanging" | "done" | "error">("exchanging");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // userId
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setStatus("error");
      setMessage(searchParams.get("error_description") || errorParam);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Missing code or state");
      return;
    }

    exchangeDropboxCode(code)
      .then((tokens) => {
        if (!tokens) {
          setStatus("error");
          setMessage("Could not connect Dropbox");
          return;
        }
        const stored: StoredUserCloudTokens = {
          provider: "dropbox",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_in
            ? Date.now() + tokens.expires_in * 1000
            : undefined,
        };
        setStoredTokens(state, stored);
        setUserCloudProvider("dropbox");
        setStatus("done");
        router.replace("/settings?tab=general");
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message || "Connection failed");
      });
  }, [searchParams, router]);

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      <p className="text-sm text-zinc-500">Connecting Dropbox…</p>
    </div>
  );
}
