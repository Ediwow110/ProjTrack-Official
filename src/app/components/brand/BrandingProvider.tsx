import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { brandingService } from "../../lib/api/services";
import { DEFAULT_FAVICON_PATH, defaultBranding, type BrandingResponse } from "./branding";

type BrandingContextValue = {
  branding: BrandingResponse;
  loading: boolean;
  error: string | null;
  reloadBranding: () => Promise<BrandingResponse>;
  replaceBranding: (nextBranding: BrandingResponse) => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function upsertFavicon(href: string) {
  const existing =
    document.head.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
    document.head.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
  const link = existing ?? document.createElement("link");
  link.rel = "icon";
  link.href = href || DEFAULT_FAVICON_PATH;
  if (!existing) {
    document.head.appendChild(link);
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingResponse>(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranding = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextBranding = await brandingService.getBranding();
      startTransition(() => {
        setBranding(nextBranding);
        setError(null);
        setLoading(false);
      });
      return nextBranding;
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load branding.";
      startTransition(() => {
        setBranding(defaultBranding);
        setError(message);
        setLoading(false);
      });
      return defaultBranding;
    }
  };

  useEffect(() => {
    void loadBranding();
  }, []);

  useEffect(() => {
    upsertFavicon(branding.faviconUrl || DEFAULT_FAVICON_PATH);
  }, [branding.faviconUrl]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding,
      loading,
      error,
      reloadBranding: loadBranding,
      replaceBranding: (nextBranding) => {
        startTransition(() => {
          setBranding(nextBranding);
          setError(null);
          setLoading(false);
        });
      },
    }),
    [branding, error, loading],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const value = useContext(BrandingContext);
  if (!value) {
    throw new Error("useBranding must be used within BrandingProvider.");
  }
  return value;
}
