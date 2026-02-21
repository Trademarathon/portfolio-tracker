"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Returns a debounced value - updates after `delay` ms of no changes.
 * Use for search inputs to reduce re-renders and API calls.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced input: pass the immediate value and get a debounced one for filtering/search.
 */
export function useDebouncedInput(initialValue = "", delay = 300) {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebouncedValue(value, delay);
  const setValueImmediate = useCallback((v: string) => setValue(v), []);
  return [value, debouncedValue, setValueImmediate] as const;
}
