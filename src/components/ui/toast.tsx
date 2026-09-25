"use client";

import { Toast as T } from "radix-ui";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "warning" | "critical";

type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
};

type ToastApi = (t: Omit<ToastItem, "id">) => void;

const ToastContext = React.createContext<ToastApi | null>(null);

const ICONS: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  info: <Info className="size-4 text-info" aria-hidden />,
  warning: <AlertTriangle className="size-4 text-warning" aria-hidden />,
  critical: <XCircle className="size-4 text-critical" aria-hidden />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);
  const push = React.useCallback<ToastApi>((t) => {
    counter.current += 1;
    const id = counter.current;
    setItems((prev) => [...prev.slice(-3), { ...t, id }]);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      <T.Provider swipeDirection="right" duration={6000}>
        {children}
        {items.map((t) => (
          <T.Root
            key={t.id}
            type={t.tone === "critical" ? "foreground" : "background"}
            duration={t.tone === "critical" ? 10_000 : 6000}
            onOpenChange={(open) => !open && setItems((prev) => prev.filter((x) => x.id !== t.id))}
            className={cn(
              "grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-popover",
              t.tone === "critical" && "border-critical/40",
            )}
          >
            <span className="mt-0.5">{ICONS[t.tone]}</span>
            <div className="min-w-0">
              <T.Title className="body-sm font-semibold text-fg">{t.title}</T.Title>
              {t.description && <T.Description className="caption mt-0.5">{t.description}</T.Description>}
              {t.action && (
                <T.Action altText={t.action.label} asChild>
                  {t.action.href ? (
                    <Link href={t.action.href} className="mt-2 inline-block text-[0.8125rem] font-semibold text-primary hover:underline">
                      {t.action.label}
                    </Link>
                  ) : (
                    <button onClick={t.action.onClick} className="mt-2 text-[0.8125rem] font-semibold text-primary hover:underline">
                      {t.action.label}
                    </button>
                  )}
                </T.Action>
              )}
            </div>
            <T.Close className="inline-flex size-6 items-center justify-center rounded-sm text-fg-tertiary hover:bg-hover hover:text-fg" aria-label="Dismiss notification">
              <X className="size-3.5" aria-hidden />
            </T.Close>
          </T.Root>
        ))}
        <T.Viewport className="fixed bottom-0 right-0 z-[var(--z-index-toast)] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </T.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
