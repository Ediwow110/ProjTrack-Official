import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "sonner";
<<<<<<< HEAD
import { BrandingProvider } from "./components/brand/BrandingProvider";
=======
import { SpeedInsights } from "@vercel/speed-insights/react";
>>>>>>> ad54c6061ab89616e6326c47d0def78ae815b6a7

export default function App() {
  return (
    <ThemeProvider>
<<<<<<< HEAD
      <BrandingProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </BrandingProvider>
=======
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
      <SpeedInsights />
>>>>>>> ad54c6061ab89616e6326c47d0def78ae815b6a7
    </ThemeProvider>
  );
}
