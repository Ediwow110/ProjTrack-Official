import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const stableFetcher = useMemo(() => fetcher, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    setReloadTick((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abortController = new AbortController();
    abortRef.current = abortController;

    setLoading(true);
    setError("");

    stableFetcher()
      .then((result) => {
        if (!active || abortController.signal.aborted) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (!active || abortController.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setData(null);
        setError(err instanceof Error ? err.message : "Unable to load data.");
      })
      .finally(() => {
        if (active && !abortController.signal.aborted) setLoading(false);
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, [stableFetcher, reloadTick]);

  return { data, loading, error, setData, reload };
}
