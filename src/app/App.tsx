import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BrandingProvider } from "./components/brand/BrandingProvider";
import { GlobalRuntimeStatus } from "./components/GlobalRuntimeStatus";

export default function App() {
  return (
    <ErrorBoundary>
      <BrandingProvider>
        <ThemeProvider>
          <GlobalRuntimeStatus />
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
          <SpeedInsights />
        </ThemeProvider>
      </BrandingProvider>
    </ErrorBoundary>
  );
}
