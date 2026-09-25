"use client";

import {
  AlertOctagon,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { NotificationCategory } from "@/types/domain";
import { listNotifications, markNotificationsRead } from "@/lib/api/governance";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/controls";
import { EmptyState, ErrorState, TimelineSkeleton } from "@/components/feedback/states";

const CATEGORY: Record<NotificationCategory, { icon: LucideIcon; tone: string; label: string }> = {
  forecast_completed: { icon: TrendingUp, tone: "text-success", label: "Forecast completed" },
  forecast_failed: { icon: AlertOctagon, tone: "text-critical", label: "Forecast failed" },
  data_quality: { icon: Database, tone: "text-warning", label: "Data quality" },
  data_freshness: { icon: Clock, tone: "text-warning", label: "Data freshness" },
  approval_requested: { icon: ShieldCheck, tone: "text-info", label: "Approval requested" },
  approval_completed: { icon: CheckCircle2, tone: "text-success", label: "Approval completed" },
  exception_opened: { icon: ListChecks, tone: "text-warning", label: "Exception opened" },
  scenario_completed: { icon: SlidersHorizontal, tone: "text-info", label: "Scenario simulated" },
  model_issue: { icon: AlertOctagon, tone: "text-warning", label: "Model issue" },
};

/** NotificationCenter (NOTIFY-001): every actionable notification deep-links to its source. */
export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "unread">("unread");
  const q = useApiQuery(["notifications"], listNotifications, { refetchInterval: 20_000 });
  const mark = useApiMutation((ctx, ids: string[] | "all") => markNotificationsRead(ctx, ids), {
    invalidate: [["notifications"]],
    failure: "Notifications were not marked as read.",
  });
  const unread = q.data?.filter((n) => !n.read).length ?? 0;
  const items = (q.data ?? []).filter((n) => filter === "all" || !n.read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative inline-flex size-9 items-center justify-center rounded-md text-fg-secondary hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-[1.125rem]" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[0.625rem] font-bold tabular text-white" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="card-title">Notifications</h2>
          <div className="flex items-center gap-2">
            <Segmented
              size="sm"
              aria-label="Show"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: "unread", label: `Unread${unread ? ` (${unread})` : ""}` },
                { value: "all", label: "All" },
              ]}
            />
          </div>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {q.isPending ? (
            <div className="p-4">
              <TimelineSkeleton items={4} />
            </div>
          ) : q.isError ? (
            <ErrorState compact what="Notifications could not be loaded." error={q.error} onRetry={() => q.refetch()} retryLabel="Retry loading notifications" />
          ) : items.length === 0 ? (
            <EmptyState compact icon={CheckCircle2} title={filter === "unread" ? "You're all caught up." : "No notifications yet."} description={filter === "unread" ? "New approvals, failed runs and data issues will appear here." : "Notifications about runs, approvals and data appear here."} />
          ) : (
            <ul>
              {items.map((n) => {
                const c = CATEGORY[n.category];
                const Icon = c.icon;
                return (
                  <li key={n.id} className="border-b border-border-subtle last:border-b-0">
                    <Link
                      href={n.href}
                      onClick={() => {
                        if (!n.read) mark.mutate([n.id]);
                        setOpen(false);
                      }}
                      className={cn("flex gap-3 px-4 py-3 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none", !n.read && "bg-subtle")}
                    >
                      <Icon className={cn("mt-0.5 size-4 shrink-0", c.tone)} aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn("text-[0.8125rem] leading-5 text-fg", n.read ? "font-medium" : "font-bold")}>{n.title}</span>
                          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        </span>
                        <span className="line-clamp-2 text-xs text-fg-secondary">{n.body}</span>
                        <span className="text-[0.6875rem] font-medium text-fg-tertiary">
                          {c.label} · {formatRelative(n.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <Link href="/administration/settings/notifications" className="text-xs font-semibold text-primary hover:underline" onClick={() => setOpen(false)}>
            Notification settings
          </Link>
          <Button size="sm" variant="ghost" disabled={unread === 0} loading={mark.isPending} onClick={() => mark.mutate("all")}>
            Mark all as read
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
