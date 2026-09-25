"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import * as React from "react";
import type { Workspace } from "@/types/domain";
import { useSession } from "@/lib/session-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlay";
import { Tag } from "@/components/feedback/status";
import { getActiveLocale, pick } from "@/lib/i18n";

const ENV_TONE = { Production: "primary", Staging: "info", Sandbox: "neutral" } as const;
const ENV_LABELS: Record<Workspace["environment"], string> = new Proxy({} as Record<Workspace["environment"], string>, {
  get(_t, env: Workspace["environment"]) {
    if (getActiveLocale() === "id") {
      return env === "Production" ? "Produksi" : env;
    }
    return env;
  },
});

function WorkspaceStatus({ status }: { status: Workspace["status"] }) {
  if (status === "active") return null;
  const isId = getActiveLocale() === "id";
  return (
    <Tag tone={status === "degraded" ? "warning" : "neutral"}>
      {status === "degraded" ? (isId ? "Menurun" : "Degraded") : (isId ? "Pemeliharaan" : "Maintenance")}
    </Tag>
  );
}

/**
 * WorkspaceSwitcher (WORKSPACE-001): name, organisation, environment, status and the
 * user's role. Switching invalidates workspace data and resets scoped filters.
 */
export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { workspace, workspaces, session, switchWorkspace } = useSession();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const filtered = workspaces.filter((w) => `${w.name} ${w.environment} ${w.organization}`.toLowerCase().includes(q.toLowerCase()));

  const trigger = (
    <PopoverTrigger
      className={cn(
        "flex w-full items-center rounded-md border border-border bg-subtle text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus",
        collapsed ? "size-10 justify-center" : "gap-2 px-2.5 py-2",
      )}
      aria-label={`Ruang kerja: ${workspace.name}, ${ENV_LABELS[workspace.environment]}. Ganti ruang kerja`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary text-[0.6875rem] font-bold text-primary-fg" aria-hidden>
        {workspace.name.slice(0, 1)}
      </span>
      {!collapsed && (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold leading-5 text-fg">{workspace.name}</span>
            <span className="flex items-center gap-1 truncate text-xs text-fg-tertiary">
              {ENV_LABELS[workspace.environment]} · {ROLE_LABELS[session.role]}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
        </>
      )}
    </PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      {collapsed ? <Tooltip content={`${workspace.name} · ${ENV_LABELS[workspace.environment]}`} side="right">{trigger}</Tooltip> : trigger}
      <PopoverContent className="w-80 p-0" align="start" side={collapsed ? "right" : "bottom"}>
        <div className="border-b border-border p-2">
          <label className="relative block">
            <span className="sr-only">Cari ruang kerja</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari ruang kerja"
              className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-sm outline-none focus-visible:border-focus"
            />
          </label>
        </div>
        <ul role="listbox" aria-label="Ruang Kerja" className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 && <li className="px-3 py-6 text-center caption">Tidak ada ruang kerja yang cocok dengan “{q}”.</li>}
          {filtered.map((w) => {
            const current = w.id === workspace.id;
            return (
              <li key={w.id} role="option" aria-selected={current}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    switchWorkspace(w.id);
                  }}
                  className={cn("flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none", current && "bg-selected")}
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary text-[0.6875rem] font-bold text-primary-fg" aria-hidden>
                    {w.name.slice(0, 1)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[0.8125rem] font-semibold text-fg">{w.name}</span>
                      <Tag tone={ENV_TONE[w.environment]}>{ENV_LABELS[w.environment]}</Tag>
                      <WorkspaceStatus status={w.status} />
                    </span>
                    <span className="truncate text-xs text-fg-tertiary">
                      {w.organization} · {w.region}
                    </span>
                    <span className="text-xs text-fg-secondary">Peran Anda: {ROLE_LABELS[session.role]}</span>
                  </span>
                  {current && <Check className="mt-1 size-4 shrink-0 text-primary" aria-label="Ruang kerja aktif" />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-3 py-2 caption">{pick("Beralih ruang kerja mengatur ulang filter dan memuat ulang data.", "Switching workspace resets filters and reloads data.")}</p>
      </PopoverContent>
    </Popover>
  );
}

export function WorkspaceContextBanner() {
  const { workspace } = useSession();
  if (workspace.environment === "Production" && workspace.status === "active") return null;
  const tone = workspace.status === "degraded" ? "border-warning/30 bg-warning-subtle text-warning-fg" : "border-info/25 bg-info-subtle text-info-fg";
  return (
    <div className={cn("flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs font-semibold", tone)} role="status">
      {workspace.status === "degraded"
        ? pick(`${workspace.name} · ${ENV_LABELS[workspace.environment]} sedang menurun: sebagian sumber data terlambat. Perkiraan dapat memakai data lama.`, `${workspace.name} · ${ENV_LABELS[workspace.environment]} is degraded: some data sources are late. Forecasts may use stale data.`)
        : pick(`Anda bekerja di ${workspace.name} · ${ENV_LABELS[workspace.environment]}. Perubahan di sini tidak memengaruhi Produksi.`, `You are working in ${workspace.name} · ${ENV_LABELS[workspace.environment]}. Changes here do not affect Production.`)}
    </div>
  );
}
