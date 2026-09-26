"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  ChartSpline,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  Database,
  GitBranch,
  History,
  Send,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { getForecastLineage, type ForecastLineageNode, type LineageStatus } from "@/lib/api/governance";
import { useApiQuery } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DescriptionList, PageContainer, PageHeader, Panel } from "@/components/page/page";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { pick } from "@/lib/i18n";

/** Status is icon + label + colour, never colour alone (§163). */
function statusMeta(status: LineageStatus): { icon: LucideIcon; cls: string; label: string } {
  switch (status) {
    case "ready":
      return { icon: CheckCircle2, cls: "text-success", label: pick("Siap", "Ready") };
    case "attention":
      return { icon: AlertTriangle, cls: "text-warning", label: pick("Perlu perhatian", "Needs attention") };
    case "blocking":
      return { icon: AlertOctagon, cls: "text-critical", label: pick("Masalah menghambat", "Blocking issue") };
    case "pending":
      return { icon: Clock, cls: "text-info", label: pick("Menunggu", "Pending") };
    default:
      return { icon: Circle, cls: "text-fg-disabled", label: pick("Belum dimulai", "Not started") };
  }
}

function stageMeta(key: ForecastLineageNode["key"]): { icon: LucideIcon; label: string } {
  switch (key) {
    case "data":
      return { icon: Database, label: pick("Data Permintaan", "Demand data") };
    case "readiness":
      return { icon: ShieldCheck, label: pick("Kesiapan Data", "Data readiness") };
    case "model":
      return { icon: BrainCircuit, label: pick("Model Perkiraan", "Forecast model") };
    case "run":
      return { icon: Workflow, label: pick("Proses Perkiraan", "Forecast run") };
    case "baseline":
      return { icon: ChartSpline, label: pick("Acuan Perkiraan", "Forecast baseline") };
    case "scenario":
      return { icon: GitBranch, label: pick("Skenario", "Scenario") };
    case "plan":
      return { icon: ClipboardList, label: pick("Keputusan Perencanaan", "Planning decision") };
    case "approval":
      return { icon: BadgeCheck, label: pick("Persetujuan", "Approval") };
    case "published":
      return { icon: Send, label: pick("Rencana Terbit", "Published plan") };
    default:
      return { icon: History, label: pick("Aktivitas", "Activity") };
  }
}

/**
 * Forecast lineage (PAGE-LINEAGE-001): how this forecast moved from source data to a
 * planning decision. One highlighted forecast-baseline node anchors the chain; every
 * node names its stage, forecast-specific value, status and where to act.
 */
export function LineageView() {
  const params = useSearchParams();
  const productId = params.get("product");
  const title = pick("Jejak Perkiraan", "Forecast lineage");
  useBreadcrumbLeaf(title);
  const q = useApiQuery(["lineage", productId], (c) => getForecastLineage(c, productId));

  if (q.isPending)
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    );
  if (q.isError)
    return (
      <PageContainer>
        <PageHeader title={title} />
        <Panel>
          <ErrorState what={pick("Jejak perkiraan tidak dapat dimuat.", "Forecast lineage could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      </PageContainer>
    );

  const { context, nodes } = q.data;
  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-6">
        <PageHeader
          title={title}
          description={pick("Bagaimana perkiraan ini dibuat: dari data sumber sampai keputusan perencanaan.", "How this forecast was produced: from source data to planning decision.")}
        />

        {/* §81/§162: anchor the page to one forecast before the chain starts. */}
        <Panel>
          <DescriptionList
            columns={3}
            items={[
              {
                label: pick("Produk", "Product"),
                value: context.product ? (
                  <Link href={`/forecasting/detail/${context.product.id}`} className="text-primary hover:underline">
                    {context.product.name}
                  </Link>
                ) : (
                  pick("Semua produk dalam cakupan", "All products in scope")
                ),
                hint: context.product ? context.product.sku : undefined,
              },
              { label: pick("Kategori", "Category"), value: context.scope },
              { label: pick("Lokasi", "Location"), value: context.locations },
              {
                label: pick("Proses perkiraan", "Forecast run"),
                value: context.runId ? (
                  <Link href={`/forecasting/runs/${context.runId}`} className="mono-id text-primary hover:underline">
                    {context.runId}
                  </Link>
                ) : (
                  "—"
                ),
                hint: context.runName ?? undefined,
              },
              { label: pick("Periode perkiraan", "Horizon"), value: context.horizonDays ? pick(`${context.horizonDays} hari`, `${context.horizonDays} days`) : "—" },
              { label: pick("Dibuat", "Generated"), value: context.generatedAt ? formatDateTime(context.generatedAt) : "—" },
            ]}
          />
        </Panel>

        <ol className="relative flex flex-col" aria-label={title}>
          {nodes.map((n, i) => (
            <LineageStep key={n.key} node={n} last={i === nodes.length - 1} />
          ))}
        </ol>
      </div>
    </PageContainer>
  );
}

function LineageStep({ node, last }: { node: ForecastLineageNode; last: boolean }) {
  const [open, setOpen] = React.useState(false);
  const stage = stageMeta(node.key);
  const status = statusMeta(node.status);
  const StageIcon = stage.icon;
  const StatusIcon = status.icon;
  const emphasis = node.key === "baseline";
  const detailsId = `lineage-${node.key}-details`;

  return (
    <li className="relative flex gap-3 sm:gap-4">
      {/* Vertical connector (§95): icon rail on the left, line to the next node. */}
      <div className="flex w-9 shrink-0 flex-col items-center" aria-hidden>
        <span className={cn("mt-4 flex size-9 items-center justify-center rounded-full border bg-surface", emphasis ? "border-primary bg-primary text-primary-fg" : "border-border text-fg-secondary")}>
          <StageIcon className="size-4" />
        </span>
        {!last && <span className="w-px flex-1 bg-border" />}
      </div>

      <div className={cn("mb-3 min-w-0 flex-1 rounded-lg border bg-surface", emphasis ? "border-primary/50 bg-primary-subtle/40 shadow-[inset_3px_0_0_var(--primary)]" : "border-border")}>
        {/* Stage | forecast-specific value | state/action (§94). Stacks on mobile. */}
        <div className="grid gap-3 px-4 py-3.5 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:items-center md:gap-5">
          <div className="min-w-0">
            <p className={cn("text-[0.8125rem] font-semibold", emphasis ? "text-primary-subtle-fg" : "text-fg-secondary")}>{stage.label}</p>
          </div>
          <div className="min-w-0">
            <p className={cn("truncate font-semibold text-fg", emphasis ? "text-lg tabular" : "body-sm")} title={node.title}>
              {node.title}
            </p>
            {node.subtitle && <p className={cn("truncate caption", emphasis && "font-semibold text-fg-secondary")}>{node.subtitle}</p>}
            {node.facts.length > 0 && (
              <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                {node.facts.map((f) => (
                  <div key={f.label} className="flex min-w-0 items-baseline gap-1.5">
                    <dt className="caption text-fg-tertiary">{f.label}</dt>
                    <dd className="truncate text-xs font-semibold text-fg tabular">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:flex-col md:items-end md:gap-1.5">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-fg-secondary">
              <StatusIcon className={cn("size-4 shrink-0", status.cls)} aria-hidden />
              {status.label}
            </span>
            {node.href && node.cta && (
              <Link href={node.href} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                {node.cta} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        </div>
        {node.details.length > 0 && (
          <div className="border-t border-border-subtle">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-xs font-semibold text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
              {open ? pick("Sembunyikan detail", "Hide details") : pick("Tampilkan detail", "Show details")}
            </button>
            {open && (
              <dl id={detailsId} className="grid gap-x-6 gap-y-2 px-4 pb-3 sm:grid-cols-2">
                {node.details.map((d) => (
                  <div key={d.label} className="min-w-0">
                    <dt className="caption text-fg-tertiary">{d.label}</dt>
                    <dd className="truncate body-sm text-fg" title={d.value}>
                      {d.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
