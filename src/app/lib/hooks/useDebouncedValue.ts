import { useEffect, useRef, useState } from "react";

/**
 * Returns a debounced version of the value.
 * Useful for delaying API calls until the user stops typing.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Returns a debounced setter for search input values.
 * The rawValue updates immediately; debouncedValue updates after `delayMs` of inactivity.
 */
export function useDebouncedSearch(delayMs = 300) {
  const [rawValue, setRawValue] = useState("");
  const debouncedValue = useDebouncedValue(rawValue, delayMs);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { rawValue, debouncedValue, setRawValue, setDebouncedValue: setRawValue };
}
