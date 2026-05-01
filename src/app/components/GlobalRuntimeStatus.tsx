import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudOff, LoaderCircle, WifiOff } from "lucide-react";

import { featureFlags } from "../lib/flags";
import {
  getNetworkActivitySnapshot,
  subscribeToNetworkActivity,
} from "../lib/networkActivity";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return isOnline;
}

export function GlobalRuntimeStatus() {
  const isOnline = useOnlineStatus();
  const networkState = useSyncExternalStore(
    subscribeToNetworkActivity,
    getNetworkActivitySnapshot,
    getNetworkActivitySnapshot,
  );

  const showBusyOverlay =
    featureFlags.globalNetworkOverlay && isOnline && networkState.activeRequests > 0;
  const showOfflineBanner = featureFlags.globalOfflineBanner && !isOnline;

  return (
    <>
      {showOfflineBanner ? (
        <div className="fixed inset-x-0 top-0 z-[120] border-b border-amber-300/40 bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-950/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <WifiOff size={16} />
              You are offline. ProjTrack will retry when connectivity returns.
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-900/70">
              Offline Mode
            </span>
          </div>
        </div>
      ) : null}

      {showBusyOverlay ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[110]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/92 px-4 py-3 text-sm font-medium text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
            <LoaderCircle size={18} className="animate-spin text-sky-300" />
            <div className="flex flex-col">
              <span>Syncing live data</span>
              <span className="text-xs text-slate-400">
                {networkState.activeRequests} request{networkState.activeRequests === 1 ? "" : "s"} in flight
              </span>
            </div>
            <CloudOff size={16} className="text-slate-500" />
          </div>
        </div>
      ) : null}
    </>
  );
}
