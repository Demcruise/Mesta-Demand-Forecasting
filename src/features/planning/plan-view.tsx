"use client";

import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Check, ClipboardCheck, Flag, MoreHorizontal, Pencil, Send, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { PlanDecision } from "@/types/domain";
import { getPlan, submitPlan, updatePlanLines, type PlanRow } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { actorName } from "@/lib/mock/directory";
import { formatDateRange, formatDateTime, formatDeltaNumber, formatDeltaPercent, formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlay";
import { MetaItem, PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { StatusBadge, Tag, type Tone } from "@/components/feedback/status";
import { EmptyState, ErrorState, InlineAlert, PageSkeleton, PermissionNotice } from "@/components/feedback/states";
import { ProductIdentity } from "@/components/entities/identity";
import { MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { ConsequenceSummary } from "@/components/governance/audit";

const DECISION: Record<PlanDecision, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  adjusted: { label: "Adjusted", tone: "primary" },
  rejected: { label: "Rejected", tone: "critical" },
  flagged: { label: "Flagged", tone: "warning" },
};

type Edit = { ids: string[]; decision: PlanDecision; forecast: number; label: string } | null;

/**
 * PAGE-PLANNING: translate the forecast into an operational decision.
 *   Plan context → baseline → exceptions → proposed changes → impact → review → submit
 */
export function PlanView() {
  const { can } = useSession();
  const state = useListState({ filterKeys: ["decision", "category", "exceptions"], defaultSort: "exceptions", defaultDir: "desc" });
  const q = useApiQuery(["plan", state.query], (c) => getPlan(c, state.query), { keepPrevious: true });
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [edit, setEdit] = React.useState<Edit>(null);
  const [qty, setQty] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submitNote, setSubmitNote] = React.useState("");
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  const update = useApiMutation((c, v: { ids: string[]; decision: PlanDecision; proposed?: number; note?: string }) => updatePlanLines(c, v.ids, v), {
    invalidate: [["plan"]],
    success: (n, v) => `${pluralize(n, "line")} ${DECISION[v.decision].label.toLowerCase()}`,
    failure: "The plan was not updated.",
    onSuccess: () => {
      setEdit(null);
      setSelection({});
    },
  });
  const submit = useApiMutation((c, v: string) => submitPlan(c, v), {
    invalidate: [["plan"], ["approvals"], ["nav-counts"]],
    success: "Plan submitted for approval",
    successDescription: "A Manager will review before it is published to replenishment.",
    failure: "The plan was not submitted.",
    onSuccess: () => setSubmitOpen(false),
  });

  const readOnly = !q.data || q.data.plan.status !== "draft" || !can("plan.edit");

  const openEdit = (ids: string[], decision: PlanDecision, forecast: number, label: string) => {
    if (decision === "accepted" || decision === "pending") {
      update.mutate({ ids, decision });
      return;
    }
    setQty(String(forecast));
    setNote("");
    setEdit({ ids, decision, forecast, label });
  };

  const columns = React.useMemo<ColumnDef<PlanRow, unknown>[]>(
    () => [
      { id: "product", header: "Product", meta: { width: "minmax(260px, 2.4fr)", sortKey: "product", pinned: true, label: "Product" } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} href={`/forecasting/detail/${row.original.productId}`} /> },
      { id: "forecast", header: "Forecast", meta: { width: "110px", numeric: true, sortKey: "forecast", description: "Baseline forecast for the plan period." } satisfies ColumnMeta, cell: ({ row }) => formatNumber(row.original.forecast) },
      {
        id: "proposed",
        header: "Planned",
        meta: { width: "110px", numeric: true, sortKey: "proposed", description: "Quantity that will be sent to replenishment." } satisfies ColumnMeta,
        cell: ({ row }) => <span className={cn("font-semibold", row.original.proposed !== row.original.forecast && "text-primary")}>{formatNumber(row.original.proposed)}</span>,
      },
      {
        id: "delta",
        header: "Change",
        meta: { width: "110px", numeric: true, sortKey: "delta", hideBelow: "md" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const d = row.original.proposed - row.original.forecast;
          return d === 0 ? <span className="text-fg-tertiary">—</span> : <span className="tabular">{formatDeltaPercent(d / Math.max(1, row.original.forecast))}</span>;
        },
      },
      {
        id: "exceptions",
        header: "Exceptions",
        meta: { width: "100px", numeric: true, sortKey: "exceptions", hideBelow: "lg" } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.exceptionCount > 0 ? (
            <Link href={`/planning/exceptions?q=${encodeURIComponent(row.original.product.sku)}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-warning-fg hover:underline">
              {row.original.exceptionCount} open
            </Link>
          ) : (
            <span className="text-fg-tertiary">None</span>
          ),
      },
      { id: "decision", header: "Decision", meta: { width: "110px", sortKey: "decision" } satisfies ColumnMeta, cell: ({ row }) => <Tag tone={DECISION[row.original.decision].tone}>{DECISION[row.original.decision].label}</Tag> },
      { id: "note", header: "Note", meta: { width: "minmax(160px, 1.4fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-xs text-fg-secondary" title={row.original.note ?? undefined}>{row.original.note ?? ""}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { width: "52px", pinned: true, label: "Actions" } satisfies ColumnMeta,
        cell: ({ row }) =>
          readOnly ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`Decide on ${row.original.product.name}`} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem icon={<Check />} onSelect={() => openEdit([row.original.id], "accepted", row.original.forecast, row.original.product.name)}>
                  Accept forecast
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Pencil />} onSelect={() => openEdit([row.original.id], "adjusted", row.original.proposed, row.original.product.name)}>
                  Adjust quantity
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Flag />} onSelect={() => openEdit([row.original.id], "flagged", row.original.forecast, row.original.product.name)}>
                  Flag for follow-up
                </DropdownMenuItem>
                <DropdownMenuItem icon={<X />} destructive onSelect={() => openEdit([row.original.id], "rejected", row.original.forecast, row.original.product.name)}>
                  Reject (plan zero)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly],
  );

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Plan workspace" />
        <ErrorState what="The plan could not be loaded." error={q.error} onRetry={() => q.refetch()} />
      </PageContainer>
    );
  }
  const { plan, baseline, totals, counts, approval, page } = q.data;
  const unresolved = counts.pending + counts.flagged;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Planning"
        title={plan.name}
        meta={
          <>
            <StatusBadge status={plan.status === "in_review" ? "in_review" : plan.status === "published" ? "published" : "draft"} />
            <MetaItem>Period {formatDateRange(plan.periodStart, plan.periodEnd)}</MetaItem>
            <MetaItem>
              Baseline{" "}
              {baseline ? (
                <Link href={`/forecasting/runs/${baseline.id}`} className="mono-id text-primary hover:underline">
                  {baseline.id}
                </Link>
              ) : (
                "—"
              )}
            </MetaItem>
            <MetaItem>Owner {actorName(plan.ownerId)} · updated {formatDateTime(plan.updatedAt)}</MetaItem>
          </>
        }
        actions={
          plan.status === "draft" && can("plan.edit") ? (
            <Button variant="primary" onClick={() => { setSubmitNote(""); setSubmitOpen(true); }}>
              <Send aria-hidden /> Submit plan for approval
            </Button>
          ) : undefined
        }
      />
      {plan.status === "in_review" && (
        <InlineAlert tone="info" title="This plan is waiting for approval and cannot be edited." action={approval ? <Link href={`/planning/approvals?id=${approval.id}`} className={buttonVariants({ size: "sm" })}>View approval</Link> : undefined}>
          Requested {approval ? formatDateTime(approval.requestedAt) : ""}. If changes are needed, the approver will send it back.
        </InlineAlert>
      )}
      {plan.status === "published" && <InlineAlert tone="success" title="Published. Planned quantities were sent to replenishment." />}
      {!can("plan.edit") && plan.status === "draft" && <PermissionNotice permission="plan.edit" compact message="You can view this plan but not change it." />}
      {baseline && baseline.status !== "published" && <InlineAlert tone="warning" title="The baseline run is no longer published.">Rebuild the plan on the current baseline before submitting.</InlineAlert>}

      <MetricStrip>
        <MetricCard label="Baseline forecast" value={formatNumber(totals.forecast)} unit="units" context={`${pluralize(plan.lines.length, "line")} in this plan`} />
        <MetricCard label="Planned quantity" value={formatNumber(totals.proposed)} unit="units" context={`${formatDeltaPercent(totals.deltaPercent)} (${formatDeltaNumber(totals.delta)}) vs forecast`} />
        <MetricCard label="Lines needing a decision" value={formatNumber(unresolved)} context={`${counts.pending} pending · ${counts.flagged} flagged`} href="/planning?decision=pending,flagged" hrefLabel="Show undecided lines" />
        <MetricCard label="Decided" value={formatNumber(counts.accepted + counts.adjusted + counts.rejected)} context={`${counts.accepted} accepted · ${counts.adjusted} adjusted · ${counts.rejected} rejected`} />
      </MetricStrip>

      <DataTable
        label="Plan lines"
        columns={columns}
        data={page.items}
        getRowId={(r) => r.id}
        isFetching={q.isFetching}
        storageKey="plan"
        selection={!readOnly ? { selected: selection, onChange: setSelection } : undefined}
        bulkBar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="body-sm font-semibold">{pluralize(selectedIds.length, "line")} selected</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" loading={update.isPending} onClick={() => update.mutate({ ids: selectedIds, decision: "accepted" })}>
                <Check aria-hidden /> Accept forecasts
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(selectedIds, "flagged", 0, `${selectedIds.length} lines`)}>
                <Flag aria-hidden /> Flag
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
                Clear
              </Button>
            </div>
          </div>
        }
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: page.page, pageSize: state.query.pageSize ?? 25, total: page.total, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Search product or SKU"
            facets={[
              { key: "decision", label: "Decision", primary: true, options: Object.entries(DECISION).map(([value, d]) => ({ value, label: d.label, count: counts[value as PlanDecision] })) },
              { key: "exceptions", label: "Exceptions", primary: true, options: [{ value: "with", label: "Has open exceptions" }, { value: "without", label: "No exceptions" }] },
              { key: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
            ]}
          />
        }
        empty={<EmptyState icon={ClipboardCheck} title="No plan lines match the current filters." action={<Button variant="secondary" onClick={state.clearFilters}>Clear filters</Button>} />}
      />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        {edit && (
          <DialogContent
            size="sm"
            title={edit.decision === "adjusted" ? `Adjust quantity · ${edit.label}` : edit.decision === "rejected" ? `Reject · ${edit.label}` : `Flag · ${edit.label}`}
            description={edit.decision === "rejected" ? "Rejected lines plan zero units for the period." : edit.decision === "flagged" ? "Flagged lines block submission until decided." : `Forecast ${formatNumber(edit.forecast)} units for the period.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setEdit(null)}>
                  Cancel
                </Button>
                <Button
                  variant={edit.decision === "rejected" ? "danger" : "primary"}
                  disabled={note.trim().length < 3 || (edit.decision === "adjusted" && !(Number(qty) >= 0 && qty.trim() !== ""))}
                  loading={update.isPending}
                  onClick={() => update.mutate({ ids: edit.ids, decision: edit.decision, proposed: edit.decision === "adjusted" ? Number(qty) : undefined, note })}
                >
                  {edit.decision === "adjusted" ? "Save adjustment" : edit.decision === "rejected" ? "Reject line" : "Flag lines"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {edit.decision === "adjusted" && (
                <Field label="Planned quantity" htmlFor="plan-qty" required hint={Number(qty) >= 0 && qty ? `${formatDeltaPercent((Number(qty) - edit.forecast) / Math.max(1, edit.forecast))} vs forecast` : undefined}>
                  <Input id="plan-qty" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
                </Field>
              )}
              <Field label="Note" htmlFor="plan-note" required hint="Why this decision? Visible to reviewers.">
                <Textarea id="plan-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus={edit.decision !== "adjusted"} />
              </Field>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent
          title="Submit plan for approval?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSubmitOpen(false)}>
                Back to plan
              </Button>
              <Button variant="primary" disabled={unresolved > 0} loading={submit.isPending} onClick={() => submit.mutate(submitNote)}>
                Submit for approval
              </Button>
            </>
          }
        >
          {unresolved > 0 && (
            <InlineAlert tone="critical" title={`${pluralize(unresolved, "line")} still need a decision.`} className="mb-4">
              Accept, adjust or reject every pending or flagged line before submitting.
            </InlineAlert>
          )}
          <ConsequenceSummary
            rows={[
              { label: "Plan", value: `${plan.name} · ${formatDateRange(plan.periodStart, plan.periodEnd)}` },
              { label: "Planned quantity", value: `${formatNumber(totals.proposed)} units (${formatDeltaPercent(totals.deltaPercent)} vs forecast)`, emphasis: true },
              { label: "Lines", value: `${counts.accepted} accepted · ${counts.adjusted} adjusted · ${counts.rejected} rejected` },
              { label: "Approval", value: "Manager approval required before publication." },
              { label: "After approval", value: "The plan is published, becomes read-only, and replenishment receives the planned quantities." },
            ]}
          />
          <Field className="mt-4" label="Note for the approver" htmlFor="plan-submit-note" optional>
            <Textarea id="plan-submit-note" value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
