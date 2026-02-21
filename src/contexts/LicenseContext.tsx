"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  validateToken,
  getStoredToken,
  storeToken,
  clearToken,
  type TokenResult,
} from "@/lib/license/token";

const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface LicenseContextType {
  isValid: boolean;
  isChecking: boolean;
  expiresAt?: number;
  tier?: "monthly" | "yearly";
  activate: (token: string) => Promise<boolean>;
  deactivate: () => void;
}

const LicenseContext = createContext<LicenseContextType | null>(null);

function checkStored(): TokenResult {
  const stored = getStoredToken();
  if (!stored) return { valid: false, error: "No license" };
  return validateToken(stored);
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [result, setResult] = useState<TokenResult>({ valid: false });

  const doCheck = useCallback(() => {
    const r = checkStored();
    setResult(r);
    setIsValid(r.valid);
  }, []);

  useEffect(() => {
    doCheck();
    setIsChecking(false);
  }, [doCheck]);

  useEffect(() => {
    if (!isValid) return;
    const t = setInterval(doCheck, RECHECK_INTERVAL_MS);
    return () => clearInterval(t);
  }, [isValid, doCheck]);

  const activate = useCallback(async (token: string): Promise<boolean> => {
    const r = validateToken(token);
    if (r.valid) {
      storeToken(token);
      setResult(r);
      setIsValid(true);
      window.dispatchEvent(new CustomEvent("license-activated"));
      return true;
    }
    return false;
  }, []);

  const deactivate = useCallback(() => {
    clearToken();
    setResult({ valid: false });
    setIsValid(false);
    window.dispatchEvent(new CustomEvent("license-deactivated"));
  }, []);

  const value: LicenseContextType = {
    isValid,
    isChecking,
    expiresAt: result.expiresAt,
    tier: result.tier,
    activate,
    deactivate,
  };

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error("useLicense must be used within a LicenseProvider");
  }
  return context;
}
