"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { ApiError } from "@/lib/api/client";
import { PermissionError } from "@/lib/permissions";
import { PreferencesProvider } from "@/lib/preferences";
import { installBrowserTransport } from "@/lib/telemetry";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/overlay";

export function Providers({ children }: { children: React.ReactNode }) {
  // Telemetry (backlog §72) delivers through the collector endpoint once mounted.
  React.useEffect(() => {
    installBrowserTransport();
  }, []);

  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // Do not retry errors a retry cannot fix.
            retry: (count, error) => {
              if (error instanceof PermissionError) return false;
              if (error instanceof ApiError && error.code !== "unavailable") return false;
              return count < 1;
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <TooltipProvider>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
