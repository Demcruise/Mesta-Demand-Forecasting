"use client";

import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { Boxes, Cpu, FileSearch, ListChecks, Loader2, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { search, type SearchResult } from "@/lib/api/governance";
import { useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { track } from "@/lib/telemetry";
import { formatRelative } from "@/lib/format";
import { Kbd } from "@/components/ui/controls";
import { STATUS } from "@/components/feedback/status";
import type { StatusKey } from "@/types/domain";
import { NAV } from "./nav-config";

const RESULT_ICONS: Record<SearchResult["type"], React.ComponentType<{ className?: string }>> = {
  Product: Boxes,
  "Forecast run": Workflow,
  Scenario: SlidersHorizontal,
  Model: Cpu,
  Exception: ListChecks,
  Approval: ShieldCheck,
};

/** Search categories (v3 §9 NAV-002). */
const RESULT_LABELS: Record<SearchResult["type"], string> = {
  Product: "Produk",
  "Forecast run": "Perkiraan",
  Scenario: "Skenario",
  Model: "Model",
  Exception: "Perlu Ditinjau",
  Approval: "Persetujuan",
};

const CommandMenuContext = React.createContext<{ open: () => void } | null>(null);

export function useCommandMenu() {
  const ctx = React.useContext(CommandMenuContext);
  if (!ctx) throw new Error("useCommandMenu must be used inside CommandMenuProvider");
  return ctx;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Command menu (NAV-001): Ctrl/Cmd + K. Results are scoped to the current workspace
 * and actions are filtered by the user's permissions.
 */
export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const router = useRouter();
  const { can, workspace } = useSession();
  const debounced = useDebounced(q, 180);
  const results = useApiQuery(["search", debounced], (c) => search(c, debounced), { enabled: open && debounced.trim().length >= 2 });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => {
          if (!o) track("command_menu_opened", {});
          return !o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const actions = [
    { label: "Buat Perkiraan", href: "/forecasting/runs/new", icon: Plus, allowed: can("forecast.run.create"), keywords: "perkiraan baru" },
    { label: "Buat Skenario", href: "/scenarios/new", icon: Plus, allowed: can("scenario.create"), keywords: "skenario baru" },
    { label: "Buka Perlu Ditinjau", href: "/planning/exceptions?status=open", icon: ListChecks, allowed: true, keywords: "perlu ditinjau" },
    { label: "Buka Persetujuan", href: "/planning/approvals?status=pending", icon: ShieldCheck, allowed: true, keywords: "persetujuan" },
    { label: "Buka Pengaturan", href: "/administration/settings", icon: Settings, allowed: true, keywords: "pengaturan" },
  ].filter((a) => a.allowed);

  const grouped = React.useMemo(() => {
    const out = new Map<SearchResult["type"], SearchResult[]>();
    for (const r of results.data ?? []) out.set(r.type, [...(out.get(r.type) ?? []), r]);
    return out;
  }, [results.data]);

  return (
    <CommandMenuContext.Provider value={{ open: () => { track("command_menu_opened", {}); setOpen(true); } }}>
      {children}
      <D.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-[var(--z-index-dialog)] bg-overlay" />
          <D.Content className="fixed left-1/2 top-[12vh] z-[var(--z-index-dialog)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-dialog outline-none">
            <D.Title className="sr-only">Cari dan perintah</D.Title>
            <D.Description className="sr-only">Cari produk, perkiraan, skenario, model, item yang perlu ditinjau dan persetujuan di ruang kerja ini, atau jalankan perintah.</D.Description>
            <Command label="Cari dan perintah" shouldFilter={false} className="flex flex-col">
              <div className="flex items-center gap-2 border-b border-border px-4">
                <Search className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
                <Command.Input
                  value={q}
                  onValueChange={setQ}
                  placeholder="Cari produk, perkiraan, atau skenario"
                  className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-tertiary"
                />
                {results.isFetching && <Loader2 className="size-4 animate-spin text-fg-tertiary" aria-label="Mencari" />}
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                {debounced.trim().length >= 2 && !results.isFetching && (results.data?.length ?? 0) === 0 && (
                  <Command.Empty className="px-3 py-8 text-center">
                    <FileSearch className="mx-auto mb-2 size-5 text-fg-tertiary" aria-hidden />
                    <p className="body-sm font-semibold">Tidak ditemukan untuk “{debounced}”.</p>
                    <p className="caption">Coba kata lain. Pencarian mencakup nama, SKU dan ID.</p>
                  </Command.Empty>
                )}
                {Array.from(grouped.entries()).map(([type, items]) => {
                  const Icon = RESULT_ICONS[type];
                  return (
                    <Command.Group key={type} heading={RESULT_LABELS[type]} className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:metadata">
                      {items.map((r) => (
                        <Command.Item key={`${type}-${r.id}`} value={`${type}-${r.id}`} onSelect={() => go(r.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 data-[selected=true]:bg-hover">
                          <Icon className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[0.8125rem] font-semibold text-fg">{r.title}</span>
                            <span className="truncate text-xs text-fg-tertiary">{r.subtitle}</span>
                          </span>
                          {r.status && r.status in STATUS && <span className="shrink-0 text-xs font-semibold text-fg-secondary">{STATUS[r.status as StatusKey].label}</span>}
                          {r.updatedAt && <span className="hidden shrink-0 text-xs text-fg-tertiary sm:inline">{formatRelative(r.updatedAt)}</span>}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
                {debounced.trim().length < 2 && (
                  <>
                    <Command.Group heading="Actions" className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:metadata">
                      {actions.map((a) => (
                        <Command.Item key={a.href} value={`${a.label} ${a.keywords}`} onSelect={() => go(a.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-[0.8125rem] font-semibold data-[selected=true]:bg-hover">
                          <a.icon className="size-4 text-fg-tertiary" aria-hidden />
                          {a.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                    <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:metadata">
                      {NAV.flatMap((g) => g.items).map((item) => (
                        <Command.Item key={item.href} value={item.label} onSelect={() => go(item.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-[0.8125rem] font-semibold data-[selected=true]:bg-hover">
                          <item.icon className="size-4 text-fg-tertiary" aria-hidden />
                          {item.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  </>
                )}
              </Command.List>
              <div className="flex items-center justify-between border-t border-border px-4 py-2 caption">
                <span className="truncate">Scoped to {workspace.name} · {workspace.environment} and your permissions.</span>
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> to move · <Kbd>↵</Kbd> to open
                </span>
              </div>
            </Command>
          </D.Content>
        </D.Portal>
      </D.Root>
    </CommandMenuContext.Provider>
  );
}
