const NETWORK_ACTIVITY_EVENT = "projtrack:network-activity";

type NetworkActivityDetail = {
  activeRequests: number;
  lastUpdatedAt: number;
};

let activeRequests = 0;

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NetworkActivityDetail>(NETWORK_ACTIVITY_EVENT, {
      detail: {
        activeRequests,
        lastUpdatedAt: Date.now(),
      },
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
  return {
    activeRequests,
    lastUpdatedAt: Date.now(),
  };
}

export function subscribeToNetworkActivity(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => listener();
  window.addEventListener(NETWORK_ACTIVITY_EVENT, handler as EventListener);
  return () => window.removeEventListener(NETWORK_ACTIVITY_EVENT, handler as EventListener);
}
