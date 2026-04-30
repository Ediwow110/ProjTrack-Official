import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "sonner";
import { BrandingProvider } from "./components/brand/BrandingProvider";

export default function App() {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </BrandingProvider>
    </ThemeProvider>
  );
}
