"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isTradingEnabled,
  setTradingEnabled,
  hasTradingPin,
  setTradingPin,
  removeTradingPin,
  isTradingUnlocked,
  unlockTrading,
  lockTrading,
  getLockTimeoutMinutes,
  setLockTimeoutMinutes,
  requireTradingUnlock,
  canPlaceOrder,
} from "@/lib/security/trading";

export function useTradingSecurity() {
  const [enabled, setEnabledState] = useState(false);
  const [hasPin, setHasPinState] = useState(false);
  const [unlocked, setUnlockedState] = useState(false);
  const [lockTimeout, setLockTimeoutState] = useState(15);

  const refresh = useCallback(() => {
    setEnabledState(isTradingEnabled());
    setHasPinState(hasTradingPin());
    setUnlockedState(isTradingUnlocked());
    setLockTimeoutState(getLockTimeoutMinutes());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("trading-security-changed", handler);
    return () => window.removeEventListener("trading-security-changed", handler);
  }, [refresh]);

  const enableTrading = useCallback((value: boolean) => {
    setTradingEnabled(value);
    if (!value) lockTrading();
    refresh();
  }, [refresh]);

  const setupPin = useCallback(async (pin: string) => {
    await setTradingPin(pin);
    refresh();
  }, [refresh]);

  const clearPin = useCallback(async () => {
    await removeTradingPin();
    refresh();
  }, [refresh]);

  const unlockWithPin = useCallback(async (pin: string) => {
    const result = await requireTradingUnlock(pin);
    refresh();
    return result;
  }, [refresh]);

  const unlock = useCallback(() => {
    if (!hasTradingPin()) {
      unlockTrading();
      refresh();
      return true;
    }
    return false;
  }, [hasPin, refresh]);

  const lock = useCallback(() => {
    lockTrading();
    refresh();
  }, [refresh]);

  const updateLockTimeout = useCallback((minutes: number) => {
    setLockTimeoutMinutes(minutes);
    refresh();
  }, [refresh]);

  const checkCanPlaceOrder = useCallback(async () => {
    return canPlaceOrder();
  }, []);

  const ensureUnlocked = useCallback(async (pin?: string) => {
    return requireTradingUnlock(pin);
  }, []);

  return {
    enabled,
    hasPin,
    unlocked,
    lockTimeout,
    enableTrading,
    setupPin,
    clearPin,
    unlockWithPin,
    unlock,
    lock,
    updateLockTimeout,
    checkCanPlaceOrder,
    ensureUnlocked,
    refresh,
  };
}
