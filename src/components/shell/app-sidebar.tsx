"use client";

import { Lock, PanelLeftClose, PanelLeftOpen, Rocket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavCounts } from "@/lib/api/governance";
import { getOnboarding } from "@/lib/api/onboarding";
import { useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlay";
import { isActive, NAV, type NavItem } from "./nav-config";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { pick } from "@/lib/i18n";

export function MestaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <path d="M8 22V10.5l8 7 8-7V22" fill="none" stroke="var(--primary-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * AppSidebar: stable width (248 / 56 collapsed); labels never change the content
 * width. Every section is visible to every role — restricted pages explain access
 * rather than disappearing (backlog §7).
 */
export function AppSidebar({ onNavigate, mobile }: { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const { sidebarCollapsed, setPreference } = usePreferences();
  const collapsed = sidebarCollapsed && !mobile;
  const { can } = useSession();
  const counts = useApiQuery(["nav-counts"], getNavCounts, { refetchInterval: 30_000 });
  const onboarding = useApiQuery(["onboarding"], getOnboarding);
  const setup = onboarding.data && !onboarding.data.dismissed && !onboarding.data.complete ? onboarding.data : null;

  return (
    <nav aria-label={pick("Utama", "Main")} className={cn("flex h-full flex-col bg-surface", !mobile && "border-r border-border")}>
      <div className={cn("flex h-[var(--topbar-h)] shrink-0 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
        <Link href="/overview" className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-focus" onClick={onNavigate}>
          <MestaMark className="size-7 shrink-0" />
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold text-fg">Mesta</span>
              <span className="truncate text-[0.6875rem] font-semibold text-fg-tertiary">Demand Forecasting</span>
            </span>
          )}
        </Link>
      </div>
      <div className={cn("shrink-0 border-b border-border", collapsed ? "p-2" : "p-3")}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>
      {setup && (
        <div className={cn("shrink-0 border-b border-border", collapsed ? "p-2" : "p-3")}>
          <Link
            href="/onboarding"
            onClick={onNavigate}
            className={cn("flex items-center gap-2 rounded-md border border-primary/30 bg-primary-subtle text-[0.8125rem] font-semibold text-primary-subtle-fg hover:border-primary/60", collapsed ? "size-10 justify-center" : "px-2.5 py-2")}
            aria-label={pick(`Selesaikan persiapan ruang kerja, ${setup.steps.filter((s) => !s.optional && s.done).length} dari ${setup.steps.filter((s) => !s.optional).length} langkah selesai`, `Finish workspace setup, ${setup.steps.filter((s) => !s.optional && s.done).length} of ${setup.steps.filter((s) => !s.optional).length} steps done`)}
          >
            <Rocket className="size-4 shrink-0" aria-hidden />
            {!collapsed && (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">{pick("Selesaikan persiapan", "Finish setup")}</span>
                <span className="tabular text-xs">
                  {setup.steps.filter((s) => !s.optional && s.done).length}/{setup.steps.filter((s) => !s.optional).length}
                </span>
              </span>
            )}
          </Link>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2">
        {NAV.map((group) => (
          <div key={group.label} className={cn("py-1.5", collapsed ? "px-2" : "px-3")}>
            {!collapsed && group.items.length > 1 && <div className="px-2 pb-1 pt-1 metadata">{group.label}</div>}
            {collapsed && group.label !== "Ringkasan" && <div className="mx-auto my-1 h-px w-6 bg-border" aria-hidden />}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(item, pathname)} collapsed={collapsed} count={item.count ? counts.data?.[item.count] : undefined} locked={item.permission ? !can(item.permission) : false} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {!mobile && (
        <div className={cn("shrink-0 border-t border-border p-2", !collapsed && "px-3")}>
          <button
            type="button"
            onClick={() => setPreference("sidebarCollapsed", !sidebarCollapsed)}
            className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2 text-[0.8125rem] font-semibold text-fg-secondary hover:bg-hover hover:text-fg", collapsed && "justify-center px-0")}
            aria-label={collapsed ? pick("Buka bilah samping", "Expand sidebar") : pick("Ciutkan bilah samping", "Collapse sidebar")}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            {!collapsed && pick("Ciutkan", "Collapse")}
          </button>
        </div>
      )}
    </nav>
  );
}

function NavLink({ item, active, collapsed, count, locked, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; count?: number; locked: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-md text-[0.8125rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
        collapsed ? "justify-center px-0" : "px-2",
        active ? "bg-selected text-primary-subtle-fg" : "text-fg-secondary hover:bg-hover hover:text-fg",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && locked && <Lock className="size-3 shrink-0 text-fg-tertiary" aria-label={pick("Terbatas", "Restricted")} />}
      {!collapsed && count !== undefined && count > 0 && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[0.6875rem] font-bold tabular leading-[1.125rem] text-fg-secondary" aria-label={pick(`${count} terbuka`, `${count} open`)}>
          {count > 99 ? "99+" : count}
        </span>
      )}
      {collapsed && count !== undefined && count > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-warning" aria-label={pick(`${count} terbuka`, `${count} open`)} />}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={count ? `${item.label} · ${count}` : item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
