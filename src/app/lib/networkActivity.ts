const NETWORK_ACTIVITY_EVENT = "projtrack:network-activity";

type NetworkActivityDetail = {
  activeRequests: number;
  lastUpdatedAt: number;
};

let activeRequests = 0;
let snapshot: NetworkActivityDetail = {
  activeRequests,
  lastUpdatedAt: Date.now(),
};

function emit() {
  snapshot = {
    activeRequests,
    lastUpdatedAt: Date.now(),
  };

  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NetworkActivityDetail>(NETWORK_ACTIVITY_EVENT, {
      detail: snapshot,
    }),
  );
}

export function beginNetworkActivity() {
  activeRequests += 1;
  emit();
}

export function endNetworkActivity() {
  activeRequests = Math.max(0, activeRequests - 1);
  emit();
}

export function getNetworkActivitySnapshot(): NetworkActivityDetail {
  return snapshot;
}

export function subscribeToNetworkActivity(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => listener();
  window.addEventListener(NETWORK_ACTIVITY_EVENT, handler as EventListener);
  return () => window.removeEventListener(NETWORK_ACTIVITY_EVENT, handler as EventListener);
}
