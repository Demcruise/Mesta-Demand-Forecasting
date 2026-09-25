"use client";

import { Dialog as D } from "radix-ui";
import { ChevronRight, Languages, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { usePreferences } from "@/lib/preferences";
import { getActiveLocale, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/overlay";
import { AppSidebar } from "./app-sidebar";
import { CommandMenuProvider, useCommandMenu } from "./command-menu";
import { NotificationCenter } from "./notification-center";
import { SEGMENT_HREFS, SEGMENT_LABELS } from "./nav-config";
import { UserMenu } from "./user-menu";
import { WorkspaceContextBanner } from "./workspace-switcher";

/* ── Breadcrumbs: hierarchy, not decoration ────────────────────────── */

const BreadcrumbContext = React.createContext<{ setLeaf: (label: string | null) => void } | null>(null);
const BreadcrumbLeafContext = React.createContext<string | null>(null);

/** Pages call this to name the last crumb (e.g. a run ID or product name). */
export function useBreadcrumbLeaf(label: string | null | undefined) {
  const ctx = React.useContext(BreadcrumbContext);
  React.useEffect(() => {
    ctx?.setLeaf(label ?? null);
    return () => ctx?.setLeaf(null);
  }, [ctx, label]);
}

function Breadcrumbs() {
  const pathname = usePathname();
  const leaf = React.useContext(BreadcrumbLeafContext);
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const isLast = i === segments.length - 1;
    const known = SEGMENT_LABELS[seg];
    const label = isLast && leaf ? leaf : (known ?? (isLast ? (leaf ?? decodeURIComponent(seg)) : decodeURIComponent(seg)));
    return { href: SEGMENT_HREFS[href] ?? href, label, isLast };
  });
  // Collapse "Forecasting › Forecast explorer › <product>" duplicates from /forecasting/detail.
  const deduped = crumbs.filter((c, i) => i === 0 || c.label !== crumbs[i - 1]?.label);
  return (
    <nav aria-label={getActiveLocale() === "id" ? "Jejak navigasi" : "Breadcrumbs"} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem]">
        {deduped.map((c, i) => (
          <li key={c.href + i} className={cn("flex min-w-0 items-center gap-1", i < deduped.length - 2 && "hidden md:flex")}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-fg-tertiary" aria-hidden />}
            {c.isLast ? (
              <span aria-current="page" className="truncate font-semibold text-fg">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="truncate font-medium text-fg-secondary hover:text-fg hover:underline underline-offset-2">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SearchButton() {
  const { open } = useCommandMenu();
  const { t } = useI18n();
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="hidden h-9 w-64 items-center gap-2 rounded-md border border-border bg-subtle px-3 text-left text-[0.8125rem] text-fg-tertiary hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus lg:flex"
        aria-label={t.nav.searchPlaceholder}
        aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{t.nav.searchPlaceholder}</span>
        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </button>
      <button type="button" onClick={open} className="inline-flex size-9 items-center justify-center rounded-md text-fg-secondary hover:bg-hover lg:hidden" aria-label={t.nav.searchPlaceholder}>
        <Search className="size-[1.125rem]" aria-hidden />
      </button>
    </>
  );
}

function LanguageToggle() {
  const { locale, setPreference } = usePreferences();
  const isId = locale === "id";
  return (
    <Tooltip content={isId ? "Ganti ke English" : "Switch to Bahasa Indonesia"}>
      <button
        type="button"
        onClick={() => setPreference("locale", isId ? "en" : "id")}
        className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-2 text-xs font-semibold text-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
        aria-label={isId ? "Ganti ke English" : "Switch to Bahasa Indonesia"}
      >
        <Languages className="mr-1 size-3.5 text-fg-tertiary" aria-hidden />
        {isId ? "ID" : "EN"}
      </button>
    </Tooltip>
  );
}

/**
 * AppShell (SHELL-001): stable sidebar, top bar with context, main content that does
 * not shift when navigation labels change. Below 1024px the sidebar becomes a drawer.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = usePreferences();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [leaf, setLeaf] = React.useState<string | null>(null);
  const pathname = usePathname();
  const isId = getActiveLocale() === "id";
  React.useEffect(() => setMobileOpen(false), [pathname]);
  const breadcrumbApi = React.useMemo(() => ({ setLeaf }), []);

  return (
    <BreadcrumbContext.Provider value={breadcrumbApi}>
      <BreadcrumbLeafContext.Provider value={leaf}>
        <CommandMenuProvider>
          <a href="#main" className="sr-only z-[var(--z-index-toast)] rounded-md bg-surface px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
            {isId ? "Lewati ke konten utama" : "Skip to main content"}
          </a>
          <div className="flex min-h-dvh">
            <aside
              className={cn(
                "sticky top-0 hidden h-dvh shrink-0 lg:block",
                sidebarCollapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]",
              )}
            >
              <AppSidebar />
            </aside>
            <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <D.Portal>
                <D.Overlay className="fixed inset-0 z-[var(--z-index-drawer)] bg-overlay lg:hidden" />
                <D.Content className="fixed inset-y-0 left-0 z-[var(--z-index-drawer)] w-[min(20rem,85vw)] border-r border-border bg-surface shadow-drawer outline-none lg:hidden">
                  <D.Title className="sr-only">{isId ? "Navigasi" : "Navigation"}</D.Title>
                  <D.Description className="sr-only">{isId ? "Navigasi utama" : "Main navigation"}</D.Description>
                  <D.Close className="absolute right-2 top-3 z-10 inline-flex size-8 items-center justify-center rounded-md text-fg-tertiary hover:bg-hover" aria-label={isId ? "Tutup navigasi" : "Close navigation"}>
                    <X className="size-4" aria-hidden />
                  </D.Close>
                  <AppSidebar mobile onNavigate={() => setMobileOpen(false)} />
                </D.Content>
              </D.Portal>
            </D.Root>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-[var(--z-index-sticky)] border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
                <div className="flex h-[var(--topbar-h)] items-center gap-3 px-4 sm:px-6">
                  <button type="button" onClick={() => setMobileOpen(true)} className="-ml-1 inline-flex size-9 items-center justify-center rounded-md text-fg-secondary hover:bg-hover lg:hidden" aria-label={isId ? "Buka navigasi" : "Open navigation"}>
                    <Menu className="size-5" aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1">
                    <Breadcrumbs />
                  </div>
                  <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                    <Tooltip content={isId ? "Backend tiruan dengan data contoh. Perubahan hanya tersimpan di tab ini dan kembali semula saat halaman dimuat ulang." : "Mock backend with sample data. Changes persist in this tab only and reset on reload."}>
                      <span tabIndex={0} className="hidden h-6 items-center rounded-sm border border-warning/30 bg-warning-subtle px-2 text-[0.6875rem] font-bold text-warning-fg md:inline-flex">
                        {isId ? "Data demo" : "Demo data"}
                      </span>
                    </Tooltip>
                    <SearchButton />
                    <LanguageToggle />
                    <NotificationCenter />
                    <UserMenu />
                  </div>
                </div>
                <WorkspaceContextBanner />
              </header>
              <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
                {children}
              </main>
            </div>
          </div>
        </CommandMenuProvider>
      </BreadcrumbLeafContext.Provider>
    </BreadcrumbContext.Provider>
  );
}
