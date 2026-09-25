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
  pending: { label: "Menunggu", tone: "warning" },
  accepted: { label: "Diterima", tone: "success" },
  adjusted: { label: "Disesuaikan", tone: "primary" },
  rejected: { label: "Ditolak", tone: "critical" },
  flagged: { label: "Ditandai", tone: "warning" },
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
    success: (n, v) => `${pluralize(n, "baris")} ${DECISION[v.decision].label.toLowerCase()}`,
    failure: "Rencana tidak dapat diperbarui.",
    onSuccess: () => {
      setEdit(null);
      setSelection({});
    },
  });
  const submit = useApiMutation((c, v: string) => submitPlan(c, v), {
    invalidate: [["plan"], ["approvals"], ["nav-counts"]],
    success: "Rencana dikirim untuk persetujuan",
    successDescription: "A Manager will review before it is published to replenishment.",
    failure: "Rencana tidak dapat dikirim.",
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
      { id: "product", header: "Produk", meta: { width: "minmax(260px, 2.4fr)", sortKey: "product", pinned: true, label: "Produk" } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} href={`/forecasting/detail/${row.original.productId}`} /> },
      { id: "forecast", header: "Perkiraan", meta: { width: "110px", numeric: true, sortKey: "forecast", description: "Perkiraan acuan untuk periode rencana." } satisfies ColumnMeta, cell: ({ row }) => formatNumber(row.original.forecast) },
      {
        id: "proposed",
        header: "Direncanakan",
        meta: { width: "110px", numeric: true, sortKey: "proposed", description: "Jumlah yang akan dikirim ke pengisian ulang." } satisfies ColumnMeta,
        cell: ({ row }) => <span className={cn("font-semibold", row.original.proposed !== row.original.forecast && "text-primary")}>{formatNumber(row.original.proposed)}</span>,
      },
      {
        id: "delta",
        header: "Perubahan",
        meta: { width: "110px", numeric: true, sortKey: "delta", hideBelow: "md" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const d = row.original.proposed - row.original.forecast;
          return d === 0 ? <span className="text-fg-tertiary">—</span> : <span className="tabular">{formatDeltaPercent(d / Math.max(1, row.original.forecast))}</span>;
        },
      },
      {
        id: "exceptions",
        header: "Perlu Ditinjau",
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
      { id: "decision", header: "Keputusan", meta: { width: "110px", sortKey: "decision" } satisfies ColumnMeta, cell: ({ row }) => <Tag tone={DECISION[row.original.decision].tone}>{DECISION[row.original.decision].label}</Tag> },
      { id: "note", header: "Catatan", meta: { width: "minmax(160px, 1.4fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-xs text-fg-secondary" title={row.original.note ?? undefined}>{row.original.note ?? ""}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        meta: { width: "52px", pinned: true, label: "Aksi" } satisfies ColumnMeta,
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
                  Terima perkiraan
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Pencil />} onSelect={() => openEdit([row.original.id], "adjusted", row.original.proposed, row.original.product.name)}>
                  Sesuaikan jumlah
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Flag />} onSelect={() => openEdit([row.original.id], "flagged", row.original.forecast, row.original.product.name)}>
                  Tandai untuk ditindaklanjuti
                </DropdownMenuItem>
                <DropdownMenuItem icon={<X />} destructive onSelect={() => openEdit([row.original.id], "rejected", row.original.forecast, row.original.product.name)}>
                  Tolak (rencanakan nol)
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
        <PageHeader title="Rencana" />
        <ErrorState what="Rencana tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} />
      </PageContainer>
    );
  }
  const { plan, baseline, totals, counts, approval, page } = q.data;
  const unresolved = counts.pending + counts.flagged;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Perencanaan"
        title={plan.name}
        meta={
          <>
            <StatusBadge status={plan.status === "in_review" ? "in_review" : plan.status === "published" ? "published" : "draft"} />
            <MetaItem>Periode {formatDateRange(plan.periodStart, plan.periodEnd)}</MetaItem>
            <MetaItem>
              Acuan{" "}
              {baseline ? (
                <Link href={`/forecasting/runs/${baseline.id}`} className="mono-id text-primary hover:underline">
                  {baseline.id}
                </Link>
              ) : (
                "—"
              )}
            </MetaItem>
            <MetaItem>Penanggung jawab {actorName(plan.ownerId)} · diperbarui {formatDateTime(plan.updatedAt)}</MetaItem>
          </>
        }
        actions={
          plan.status === "draft" && can("plan.edit") ? (
            <Button variant="primary" onClick={() => { setSubmitNote(""); setSubmitOpen(true); }}>
              <Send aria-hidden /> Kirim rencana untuk persetujuan
            </Button>
          ) : undefined
        }
      />
      {plan.status === "in_review" && (
        <InlineAlert tone="info" title="Rencana ini menunggu persetujuan dan tidak dapat diubah." action={approval ? <Link href={`/planning/approvals?id=${approval.id}`} className={buttonVariants({ size: "sm" })}>Lihat persetujuan</Link> : undefined}>
Diajukan {approval ? formatDateTime(approval.requestedAt) : ""}. Jika perlu perubahan, penyetuju akan mengembalikannya.
        </InlineAlert>
      )}
      {plan.status === "published" && <InlineAlert tone="success" title="Diterbitkan. Jumlah yang direncanakan sudah dikirim ke pengisian ulang." />}
      {!can("plan.edit") && plan.status === "draft" && <PermissionNotice permission="plan.edit" compact message="Anda dapat melihat rencana ini, tetapi tidak mengubahnya." />}
      {baseline && baseline.status !== "published" && <InlineAlert tone="warning" title="Proses acuan sudah tidak diterbitkan.">Bangun ulang rencana pada acuan saat ini sebelum mengirim.</InlineAlert>}

      <MetricStrip>
        <MetricCard label="Perkiraan acuan" value={formatNumber(totals.forecast)} unit="unit" context={`${pluralize(plan.lines.length, "baris")} pada rencana ini`} />
        <MetricCard label="Jumlah direncanakan" value={formatNumber(totals.proposed)} unit="unit" context={`${formatDeltaPercent(totals.deltaPercent)} (${formatDeltaNumber(totals.delta)}) dibanding perkiraan`} />
        <MetricCard label="Baris perlu keputusan" value={formatNumber(unresolved)} context={`${counts.pending} menunggu · ${counts.flagged} ditandai`} href="/planning?decision=pending,flagged" hrefLabel="Lihat baris belum diputuskan" />
        <MetricCard label="Sudah diputuskan" value={formatNumber(counts.accepted + counts.adjusted + counts.rejected)} context={`${counts.accepted} diterima · ${counts.adjusted} disesuaikan · ${counts.rejected} ditolak`} />
      </MetricStrip>

      <DataTable
        label="Baris rencana"
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
                <Check aria-hidden /> Terima perkiraan
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(selectedIds, "flagged", 0, `${selectedIds.length} lines`)}>
                <Flag aria-hidden /> Tandai
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
            searchPlaceholder="Cari produk atau SKU"
            facets={[
              { key: "decision", label: "Keputusan", primary: true, options: Object.entries(DECISION).map(([value, d]) => ({ value, label: d.label, count: counts[value as PlanDecision] })) },
              { key: "exceptions", label: "Perlu Ditinjau", primary: true, options: [{ value: "with", label: "Ada yang terbuka" }, { value: "without", label: "Tidak ada" }] },
              { key: "category", label: "Kategori", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
            ]}
          />
        }
        empty={<EmptyState icon={ClipboardCheck} title="Tidak ada baris rencana yang cocok dengan filter." action={<Button variant="secondary" onClick={state.clearFilters}>Hapus filter</Button>} />}
      />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        {edit && (
          <DialogContent
            size="sm"
            title={edit.decision === "adjusted" ? `Sesuaikan jumlah · ${edit.label}` : edit.decision === "rejected" ? `Tolak · ${edit.label}` : `Tandai · ${edit.label}`}
            description={edit.decision === "rejected" ? "Baris yang ditolak merencanakan nol unit untuk periode ini." : edit.decision === "flagged" ? "Baris yang ditandai menghalangi pengiriman sampai diputuskan." : `Perkiraan ${formatNumber(edit.forecast)} unit untuk periode ini.`}
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
                  {edit.decision === "adjusted" ? "Simpan penyesuaian" : edit.decision === "rejected" ? "Tolak baris" : "Tandai baris"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {edit.decision === "adjusted" && (
                <Field label="Jumlah direncanakan" htmlFor="plan-qty" required hint={Number(qty) >= 0 && qty ? `${formatDeltaPercent((Number(qty) - edit.forecast) / Math.max(1, edit.forecast))} dibanding perkiraan` : undefined}>
                  <Input id="plan-qty" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
                </Field>
              )}
              <Field label="Catatan" htmlFor="plan-note" required hint="Mengapa keputusan ini? Terlihat oleh peninjau.">
                <Textarea id="plan-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus={edit.decision !== "adjusted"} />
              </Field>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent
          title="Kirim rencana untuk persetujuan?"
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
            <InlineAlert tone="critical" title={`${pluralize(unresolved, "baris")} masih perlu keputusan.`} className="mb-4">
              Accept, adjust or reject every pending or flagged line before submitting.
            </InlineAlert>
          )}
          <ConsequenceSummary
            rows={[
              { label: "Rencana", value: `${plan.name} · ${formatDateRange(plan.periodStart, plan.periodEnd)}` },
              { label: "Jumlah direncanakan", value: `${formatNumber(totals.proposed)} unit (${formatDeltaPercent(totals.deltaPercent)} dibanding perkiraan)`, emphasis: true },
              { label: "Baris", value: `${counts.accepted} diterima · ${counts.adjusted} disesuaikan · ${counts.rejected} ditolak` },
              { label: "Persetujuan", value: "Perlu persetujuan Manajer sebelum diterbitkan." },
              { label: "Setelah disetujui", value: "Rencana diterbitkan, menjadi hanya baca, dan pengisian ulang menerima jumlah yang direncanakan." },
            ]}
          />
          <Field className="mt-4" label="Catatan untuk penyetuju" htmlFor="plan-submit-note" optional>
            <Textarea id="plan-submit-note" value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
