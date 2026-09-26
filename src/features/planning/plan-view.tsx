"use client";

import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Check, CheckCheck, ClipboardCheck, Flag, ListTodo, MoreHorizontal, Package, Pencil, Send, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { PlanDecision } from "@/types/domain";
import { getPlan, submitPlan, updatePlanLines, type PlanRow } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { actorName } from "@/lib/mock/directory";
import { formatDateRange, formatDateTime, formatDeltaPercent, formatMetric, formatNumber, pluralize } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
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
import { MetricCard, MetricDelta, MetricStrip } from "@/components/forecasting/metrics";
import { ConsequenceSummary } from "@/components/governance/audit";
import { pick, localized } from "@/lib/i18n";

const DECISION: Record<PlanDecision, { label: string; tone: Tone }> = localized({
  pending: { label: "Menunggu", tone: "warning" },
  accepted: { label: "Diterima", tone: "success" },
  adjusted: { label: "Disesuaikan", tone: "primary" },
  rejected: { label: "Ditolak", tone: "critical" },
  flagged: { label: "Ditandai", tone: "warning" },
}, {
  pending: { label: "Pending", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  adjusted: { label: "Adjusted", tone: "primary" },
  rejected: { label: "Rejected", tone: "critical" },
  flagged: { label: "Flagged", tone: "warning" },
});

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
    success: (n, v) => `${pluralize(n, pick("baris", "line"), pick("baris", "lines"))} ${DECISION[v.decision].label.toLowerCase()}`,
    failure: pick("Rencana tidak dapat diperbarui.", "The plan was not updated."),
    onSuccess: () => {
      setEdit(null);
      setSelection({});
    },
  });
  const submit = useApiMutation((c, v: string) => submitPlan(c, v), {
    invalidate: [["plan"], ["approvals"], ["nav-counts"]],
    success: pick("Rencana dikirim untuk persetujuan", "Plan submitted for approval"),
    successDescription: pick("Manajer akan meninjaunya sebelum diterbitkan ke pengisian ulang.", "A Manager will review before it is published to replenishment."),
    failure: pick("Rencana tidak dapat dikirim.", "The plan was not submitted."),
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
      { id: "product", header: pick("Produk", "Product"), meta: { width: "minmax(260px, 2.4fr)", sortKey: "product", pinned: true, label: pick("Produk", "Product") } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} href={`/forecasting/detail/${row.original.productId}`} /> },
      { id: "forecast", header: pick("Perkiraan", "Forecast"), meta: { width: "110px", numeric: true, sortKey: "forecast", description: pick("Perkiraan acuan untuk periode rencana.", "Baseline forecast for the plan period.") } satisfies ColumnMeta, cell: ({ row }) => formatNumber(row.original.forecast) },
      {
        id: "proposed",
        header: pick("Direncanakan", "Planned"),
        meta: { width: "110px", numeric: true, sortKey: "proposed", description: pick("Jumlah yang akan dikirim ke pengisian ulang.", "Quantity that will be sent to replenishment.") } satisfies ColumnMeta,
        cell: ({ row }) => <span className={cn("font-semibold", row.original.proposed !== row.original.forecast && "text-primary")}>{formatNumber(row.original.proposed)}</span>,
      },
      {
        id: "delta",
        header: pick("Perubahan", "Change"),
        meta: { width: "110px", numeric: true, sortKey: "delta", hideBelow: "md" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const d = row.original.proposed - row.original.forecast;
          return d === 0 ? <span className="text-fg-tertiary">—</span> : <SignedPercent percent={d / Math.max(1, row.original.forecast)} />;
        },
      },
      {
        id: "exceptions",
        header: pick("Perlu Ditinjau", "Exceptions"),
        // Context for the decision, not a quantity to compare: left axis (§49).
        meta: { width: "120px", numeric: true, align: "left", sortKey: "exceptions", hideBelow: "lg", label: pick("Perlu Ditinjau", "Exceptions") } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.exceptionCount > 0 ? (
            <Link href={`/planning/exceptions?q=${encodeURIComponent(row.original.product.sku)}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-warning-fg hover:underline">
              {pick(`${row.original.exceptionCount} terbuka`, `${row.original.exceptionCount} open`)}
            </Link>
          ) : (
            <span className="text-fg-tertiary">{pick("Tidak ada", "None")}</span>
          ),
      },
      { id: "decision", header: pick("Keputusan", "Decision"), meta: { width: "120px", align: "left", sortKey: "decision" } satisfies ColumnMeta, cell: ({ row }) => <Tag tone={DECISION[row.original.decision].tone}>{DECISION[row.original.decision].label}</Tag> },
      { id: "note", header: pick("Catatan", "Note"), meta: { width: "minmax(160px, 1.4fr)", align: "left", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-xs text-fg-secondary" title={row.original.note ?? undefined}>{row.original.note ?? ""}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">{pick("Aksi", "Actions")}</span>,
        meta: { width: "52px", pinned: true, align: "center", label: pick("Aksi", "Actions") } satisfies ColumnMeta,
        cell: ({ row }) =>
          readOnly ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={pick(`Putuskan ${row.original.product.name}`, `Decide on ${row.original.product.name}`)} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem icon={<Check />} onSelect={() => openEdit([row.original.id], "accepted", row.original.forecast, row.original.product.name)}>
                  {pick("Terima perkiraan", "Accept forecast")}
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Pencil />} onSelect={() => openEdit([row.original.id], "adjusted", row.original.proposed, row.original.product.name)}>
                  {pick("Sesuaikan jumlah", "Adjust quantity")}
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Flag />} onSelect={() => openEdit([row.original.id], "flagged", row.original.forecast, row.original.product.name)}>
                  {pick("Tandai untuk ditindaklanjuti", "Flag for follow-up")}
                </DropdownMenuItem>
                <DropdownMenuItem icon={<X />} destructive onSelect={() => openEdit([row.original.id], "rejected", row.original.forecast, row.original.product.name)}>
                  {pick("Tolak (rencanakan nol)", "Reject (plan zero)")}
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
        <PageHeader title={pick("Rencana", "Plan workspace")} />
        <ErrorState what={pick("Rencana tidak dapat dimuat.", "The plan could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
      </PageContainer>
    );
  }
  const { plan, baseline, totals, counts, approval, page } = q.data;
  const unresolved = counts.pending + counts.flagged;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={pick("Perencanaan", "Planning")}
        title={plan.name}
        meta={
          <>
            <StatusBadge status={plan.status === "in_review" ? "in_review" : plan.status === "published" ? "published" : "draft"} />
            <MetaItem>
              {pick("Periode", "Period")} {formatDateRange(plan.periodStart, plan.periodEnd)}
            </MetaItem>
            <MetaItem>
              {pick("Acuan", "Baseline")}{" "}
              {baseline ? (
                <Link href={`/forecasting/runs/${baseline.id}`} className="mono-id text-primary hover:underline">
                  {baseline.id}
                </Link>
              ) : (
                "—"
              )}
            </MetaItem>
            <MetaItem>
              {pick(`Penanggung jawab ${actorName(plan.ownerId)} · diperbarui ${formatDateTime(plan.updatedAt)}`, `Owner ${actorName(plan.ownerId)} · updated ${formatDateTime(plan.updatedAt)}`)}
            </MetaItem>
          </>
        }
        actions={
          plan.status === "draft" && can("plan.edit") ? (
            <Button variant="primary" onClick={() => { setSubmitNote(""); setSubmitOpen(true); }}>
              <Send aria-hidden /> {pick("Kirim untuk persetujuan", "Submit for approval")}
            </Button>
          ) : undefined
        }
      />
      {plan.status === "in_review" && (
        <InlineAlert tone="info" title={pick("Rencana ini menunggu persetujuan dan tidak dapat diubah.", "This plan is waiting for approval and cannot be edited.")} action={approval ? <Link href={`/planning/approvals?id=${approval.id}`} className={buttonVariants({ size: "sm" })}>{pick("Lihat persetujuan", "View approval")}</Link> : undefined}>
{pick(
            `Diajukan ${approval ? formatDateTime(approval.requestedAt) : ""}. Jika perlu perubahan, penyetuju akan mengembalikannya.`,
            `Submitted ${approval ? formatDateTime(approval.requestedAt) : ""}. If changes are needed, the approver will send it back.`,
          )}
        </InlineAlert>
      )}
      {plan.status === "published" && <InlineAlert tone="success" title={pick("Diterbitkan. Jumlah yang direncanakan sudah dikirim ke pengisian ulang.", "Published. Planned quantities were sent to replenishment.")} />}
      {!can("plan.edit") && plan.status === "draft" && <PermissionNotice permission="plan.edit" compact message={pick("Anda dapat melihat rencana ini, tetapi tidak mengubahnya.", "You can view this plan but not change it.")} />}
      {baseline && baseline.status !== "published" && <InlineAlert tone="warning" title={pick("Proses acuan sudah tidak diterbitkan.", "The baseline run is no longer published.")}>{pick("Bangun ulang rencana pada acuan saat ini sebelum mengirim.", "Rebuild the plan on the current baseline before submitting.")}</InlineAlert>}

      {/* PAGE-PLANNING-CARDS-001: compact signals, then the plan table carries the work. */}
      <MetricStrip>
        <MetricCard
          variant="compact"
          icon={Package}
          label={pick("Perkiraan Acuan", "Baseline forecast")}
          value={formatMetric(totals.forecast)}
          exactValue={`${formatNumber(totals.forecast)} ${pick("unit", "units")}`}
          unit={pick("unit", "units")}
          meta={pick(`${formatNumber(plan.lines.length)} baris`, `${formatNumber(plan.lines.length)} lines`)}
        />
        <MetricCard
          variant="compact"
          icon={ClipboardCheck}
          label={pick("Jumlah Direncanakan", "Planned quantity")}
          value={formatMetric(totals.proposed)}
          exactValue={`${formatNumber(totals.proposed)} ${pick("unit", "units")}`}
          unit={pick("unit", "units")}
          delta={<MetricDelta value={totals.deltaPercent} />}
          comparison={pick("vs perkiraan", "vs forecast")}
        />
        <MetricCard
          variant="compact"
          icon={ListTodo}
          tone={unresolved > 0 ? "warning" : "neutral"}
          label={pick("Baris yang Perlu Diputuskan", "Lines needing a decision")}
          value={formatNumber(unresolved)}
          meta={pick(`${counts.pending} menunggu · ${counts.flagged} ditandai`, `${counts.pending} pending · ${counts.flagged} flagged`)}
          href="/planning?decision=pending,flagged"
          destination={pick("tampilkan baris yang belum diputuskan", "shows undecided lines")}
        />
        <MetricCard
          variant="compact"
          icon={CheckCheck}
          label={pick("Sudah Diputuskan", "Decided")}
          value={formatNumber(counts.accepted + counts.adjusted + counts.rejected)}
          meta={pick(`${counts.accepted} diterima · ${counts.adjusted} disesuaikan`, `${counts.accepted} accepted · ${counts.adjusted} adjusted`)}
          tooltip={pick(`${counts.rejected} ditolak`, `${counts.rejected} rejected`)}
        />
      </MetricStrip>

      <DataTable
        label={pick("Baris rencana", "Plan lines")}
        columns={columns}
        data={page.items}
        getRowId={(r) => r.id}
        isFetching={q.isFetching}
        storageKey="plan"
        selection={!readOnly ? { selected: selection, onChange: setSelection } : undefined}
        bulkBar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="body-sm font-semibold">{pick(`${formatNumber(selectedIds.length)} baris dipilih`, `${pluralize(selectedIds.length, "line")} selected`)}</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" loading={update.isPending} onClick={() => update.mutate({ ids: selectedIds, decision: "accepted" })}>
                <Check aria-hidden /> {pick("Terima perkiraan", "Accept forecast")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(selectedIds, "flagged", 0, pick(`${selectedIds.length} baris`, `${selectedIds.length} lines`))}>
                <Flag aria-hidden /> {pick("Tandai", "Flag")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
                {pick("Batalkan pilihan", "Clear")}
              </Button>
            </div>
          </div>
        }
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: page.page, pageSize: state.query.pageSize ?? 25, total: page.total, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari produk atau SKU", "Search product or SKU")}
            facets={[
              { key: "decision", label: pick("Keputusan", "Decision"), primary: true, options: Object.entries(DECISION).map(([value, d]) => ({ value, label: d.label, count: counts[value as PlanDecision] })) },
              { key: "exceptions", label: pick("Perlu Ditinjau", "Exceptions"), primary: true, options: [{ value: "with", label: pick("Ada yang terbuka", "Has open exceptions") }, { value: "without", label: pick("Tidak ada", "No exceptions") }] },
              { key: "category", label: pick("Kategori", "Category"), options: CATEGORIES.map((c) => ({ value: c, label: c })) },
            ]}
          />
        }
        empty={<EmptyState icon={ClipboardCheck} title={pick("Tidak ada baris rencana yang cocok dengan filter.", "No plan lines match the current filters.")} action={<Button variant="secondary" onClick={state.clearFilters}>{pick("Hapus filter", "Clear filters")}</Button>} />}
      />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        {edit && (
          <DialogContent
            size="sm"
            title={edit.decision === "adjusted" ? pick(`Sesuaikan jumlah · ${edit.label}`, `Adjust quantity · ${edit.label}`) : edit.decision === "rejected" ? pick(`Tolak · ${edit.label}`, `Reject · ${edit.label}`) : pick(`Tandai · ${edit.label}`, `Flag · ${edit.label}`)}
            description={edit.decision === "rejected" ? pick("Baris yang ditolak merencanakan nol unit untuk periode ini.", "Rejected lines plan zero units for the period.") : edit.decision === "flagged" ? pick("Baris yang ditandai menghalangi pengiriman sampai diputuskan.", "Flagged lines block submission until decided.") : pick(`Perkiraan ${formatNumber(edit.forecast)} unit untuk periode ini.`, `Forecast ${formatNumber(edit.forecast)} units for the period.`)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setEdit(null)}>
                  {pick("Batal", "Cancel")}
                </Button>
                <Button
                  variant={edit.decision === "rejected" ? "danger" : "primary"}
                  disabled={note.trim().length < 3 || (edit.decision === "adjusted" && !(Number(qty) >= 0 && qty.trim() !== ""))}
                  loading={update.isPending}
                  onClick={() => update.mutate({ ids: edit.ids, decision: edit.decision, proposed: edit.decision === "adjusted" ? Number(qty) : undefined, note })}
                >
                  {edit.decision === "adjusted" ? pick("Simpan penyesuaian", "Save adjustment") : edit.decision === "rejected" ? pick("Tolak baris", "Reject line") : pick("Tandai baris", "Flag lines")}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {edit.decision === "adjusted" && (
                <Field label={pick("Jumlah direncanakan", "Planned quantity")} htmlFor="plan-qty" required hint={Number(qty) >= 0 && qty ? pick(`${formatDeltaPercent((Number(qty) - edit.forecast) / Math.max(1, edit.forecast))} dibanding perkiraan`, `${formatDeltaPercent((Number(qty) - edit.forecast) / Math.max(1, edit.forecast))} vs forecast`) : undefined}>
                  <Input id="plan-qty" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
                </Field>
              )}
              <Field label={pick("Catatan", "Note")} htmlFor="plan-note" required hint={pick("Mengapa keputusan ini? Terlihat oleh peninjau.", "Why this decision? Visible to reviewers.")}>
                <Textarea id="plan-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus={edit.decision !== "adjusted"} />
              </Field>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent
          title={pick("Kirim rencana untuk persetujuan?", "Submit plan for approval?")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSubmitOpen(false)}>
                {pick("Kembali ke rencana", "Back to plan")}
              </Button>
              <Button variant="primary" disabled={unresolved > 0} loading={submit.isPending} onClick={() => submit.mutate(submitNote)}>
                {pick("Kirim untuk persetujuan", "Submit for approval")}
              </Button>
            </>
          }
        >
          {unresolved > 0 && (
            <InlineAlert tone="critical" title={pick(`${pluralize(unresolved, "baris")} masih perlu keputusan.`, `${pluralize(unresolved, "line")} still need a decision.`)} className="mb-4">
              {pick("Terima, sesuaikan, atau tolak setiap baris yang menunggu atau ditandai sebelum mengirim.", "Accept, adjust or reject every pending or flagged line before submitting.")}
            </InlineAlert>
          )}
          <ConsequenceSummary
            rows={[
              { label: pick("Rencana", "Plan"), value: `${plan.name} · ${formatDateRange(plan.periodStart, plan.periodEnd)}` },
              { label: pick("Jumlah direncanakan", "Planned quantity"), value: pick(`${formatNumber(totals.proposed)} unit (${formatDeltaPercent(totals.deltaPercent)} dibanding perkiraan)`, `${formatNumber(totals.proposed)} units (${formatDeltaPercent(totals.deltaPercent)} vs forecast)`), emphasis: true },
              { label: pick("Baris", "Lines"), value: pick(`${counts.accepted} diterima · ${counts.adjusted} disesuaikan · ${counts.rejected} ditolak`, `${counts.accepted} accepted · ${counts.adjusted} adjusted · ${counts.rejected} rejected`) },
              { label: pick("Persetujuan", "Approval"), value: pick("Perlu persetujuan Manajer sebelum diterbitkan.", "Manager approval required before publication.") },
              { label: pick("Setelah disetujui", "After approval"), value: pick("Rencana diterbitkan, menjadi hanya baca, dan pengisian ulang menerima jumlah yang direncanakan.", "The plan is published, becomes read-only, and replenishment receives the planned quantities.") },
            ]}
          />
          <Field className="mt-4" label={pick("Catatan untuk penyetuju", "Note for the approver")} htmlFor="plan-submit-note" optional>
            <Textarea id="plan-submit-note" value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
