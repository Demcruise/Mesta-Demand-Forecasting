"use client";

import { AlertOctagon, AlertTriangle, ArrowDown, CheckCircle2, Circle, Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { getLineage, type LineageNode } from "@/lib/api/governance";
import { useApiQuery } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader, Panel } from "@/components/page/page";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";

const STATE: Record<LineageNode["state"], { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  ok: { icon: CheckCircle2, cls: "text-success", label: "Sudah siap" },
  warning: { icon: AlertTriangle, cls: "text-warning", label: "Perlu perhatian" },
  critical: { icon: AlertOctagon, cls: "text-critical", label: "Masalah menghambat" },
  pending: { icon: Clock, cls: "text-info", label: "Menunggu" },
  none: { icon: Circle, cls: "text-fg-disabled", label: "Belum dimulai" },
};

/**
 * LINEAGE-001: Data → Quality → Model → Run → Forecast → Scenario → Plan → Approval →
 * Published plan → Audit, navigable forward and backward.
 */
export function LineageView() {
  const params = useSearchParams();
  const productId = params.get("product");
  useBreadcrumbLeaf("Sumber Keputusan");
  const q = useApiQuery(["lineage", productId], (c) => getLineage(c, productId));
  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) return <PageContainer><PageHeader title="Sumber Keputusan" /><Panel><ErrorState what="Sumber keputusan tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} /></Panel></PageContainer>;
  return (
    <PageContainer width="narrow">
      <PageHeader title="Sumber Keputusan" description={`Bagaimana keputusan perencanaan ${productId ? "produk ini" : "hari ini"} dihasilkan, dari data sumber sampai riwayat aktivitas. Setiap langkah tertaut ke catatannya.`} />
      <ol className="flex flex-col" aria-label="Sumber keputusan">
        {q.data.map((n, i) => {
          const s = STATE[n.state];
          const Icon = s.icon;
          const body = (
            <span className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-4">
              <span className="metadata">{n.label}</span>
              <span className="min-w-0">
                <span className="block truncate body-sm font-semibold text-fg">{n.title}</span>
                <span className="block truncate caption">{n.detail}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-secondary">
                <Icon className={cn("size-4", s.cls)} aria-hidden />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sr-only sm:hidden">{s.label}</span>
              </span>
            </span>
          );
          return (
            <li key={n.key} className="flex flex-col items-stretch">
              {n.href ? (
                <Link href={n.href} className="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {body}
                </Link>
              ) : (
                <div className="rounded-lg border border-border bg-surface px-4 py-3">{body}</div>
              )}
              {i < q.data.length - 1 && (
                <span className="flex justify-center py-1 text-fg-tertiary" aria-hidden>
                  <ArrowDown className="size-4" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </PageContainer>
  );
}
