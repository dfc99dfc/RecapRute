import "./global.css";

// ✅ Vercel Analytics setup
import { inject } from "@vercel/analytics";
inject();

import { useEffect } from "react";
import { useLocation, BrowserRouter, Routes, Route } from "react-router-dom";
import { track } from "@vercel/analytics";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ✅ Track page changes
function RouteChangeTracker() {
  const location = useLocation();

  useEffect(() => {
    // Send a pageview event whenever the URL changes
    track("Page View", { path: location.pathname });
  }, [location]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Track route changes */}
        <RouteChangeTracker />

        <Routes>
          <Route path="/" element={<Index />} />
          {/* Add more routes here if needed */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>

      {/* Vercel analytics UI component */}
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
