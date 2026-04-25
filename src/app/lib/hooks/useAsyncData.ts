import { useCallback, useEffect, useMemo, useState } from "react";

export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const stableFetcher = useMemo(() => fetcher, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => {
    setReloadTick((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    stableFetcher()
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setData(null);
        setError(err instanceof Error ? err.message : "Unable to load data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [stableFetcher, reloadTick]);

  return { data, loading, error, setData, reload };
}
