"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, Check, Hourglass, RotateCcw, ShieldCheck, TimerOff, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { Approval, ApprovalType, StatusKey } from "@/types/domain";
import { decideApproval, getApproval, listApprovals } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { actorName } from "@/lib/mock/directory";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime, formatDeltaNumber, formatDeltaPercent, formatNumber, formatRelative, pluralize } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
import { track } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, Drawer, DrawerContent } from "@/components/ui/overlay";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { StatusBadge, Tag, STATUS } from "@/components/feedback/status";
import { DetailSkeleton, EmptyState, ErrorState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { EntityId, UserIdentity } from "@/components/entities/identity";
import { MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { ActivityList, ConsequenceSummary } from "@/components/governance/audit";
import { pick, localized } from "@/lib/i18n";

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = localized({
  override: "Perubahan perkiraan",
  scenario: "Penggunaan skenario",
  plan_publish: "Penerbitan rencana",
  model_default: "Perubahan model bawaan",
}, {
  override: "Forecast override",
  scenario: "Scenario adoption",
  plan_publish: "Plan publication",
  model_default: "Default model change",
});

function objectHref(a: Approval) {
  switch (a.type) {
    case "scenario":
      return `/scenarios/${a.objectId}`;
    case "plan_publish":
      return "/planning";
    case "model_default":
      return `/models/${a.objectId}`;
    default:
      return null;
  }
}

function Impact({ a }: { a: Approval }) {
  if (a.type === "model_default") return <span className="text-xs text-fg-secondary">{a.impact.summary.split(" in the")[0]}</span>;
  return (
    <span className="flex flex-col items-end">
      <SignedPercent percent={a.impact.percent} className="font-semibold" />
      <span className="text-[0.6875rem] tabular text-fg-tertiary">
        {pick(`${formatDeltaNumber(a.impact.units)} unit · ${a.impact.skuCount} SKU`, `${formatDeltaNumber(a.impact.units)} units · ${pluralize(a.impact.skuCount, "SKU")}`)}
      </span>
    </span>
  );
}

/** PAGE-APPROVALS: centralised human review for consequential actions. */
export function ApprovalsView() {
  const state = useListState({ filterKeys: ["status", "type"], defaultSort: "dueAt", defaultDir: "asc" });
  const q = useApiQuery(["approvals", state.query], (c) => listApprovals(c, state.query), { keepPrevious: true });
  const selectedId = state.getParam("id");

  const columns = React.useMemo<ColumnDef<Approval, unknown>[]>(
    () => [
      { id: "type", header: pick("Jenis", "Type"), meta: { width: "170px", align: "left", sortKey: "type" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{APPROVAL_TYPE_LABELS[row.original.type]}</Tag> },
      {
        id: "object",
        header: pick("Permintaan", "Request"),
        meta: { width: "minmax(260px, 2.5fr)", align: "left", pinned: true, label: pick("Permintaan", "Request") } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.objectLabel}</span>
            <span className="mono-id text-fg-tertiary">{row.original.id}</span>
          </span>
        ),
      },
      { id: "by", header: pick("Diajukan oleh", "Submitted by"), meta: { width: "minmax(150px, 1fr)", align: "left", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.requestedBy} secondary={formatRelative(row.original.requestedAt)} /> },
      { id: "impact", header: pick("Dampak", "Impact"), meta: { width: "170px", numeric: true, align: "right", sortKey: "impact" } satisfies ColumnMeta, cell: ({ row }) => <Impact a={row.original} /> },
      { id: "status", header: "Status", meta: { width: "170px", align: "left" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: "due",
        header: pick("Batas waktu", "Due"),
        meta: { width: "140px", align: "left", sortKey: "dueAt" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const overdue = row.original.status === "pending" && new Date(row.original.dueAt).getTime() < Date.now();
          return <span className={cn("whitespace-nowrap tabular", overdue ? "font-semibold text-critical-fg" : "text-fg-secondary")}>{overdue ? pick(`Terlambat ${formatRelative(row.original.dueAt)}`, `Overdue ${formatRelative(row.original.dueAt)}`) : formatRelative(row.original.dueAt)}</span>;
        },
      },
    ],
    [],
  );

  const s = q.data?.summary;
  return (
    <PageContainer>
      <PageHeader title={pick("Persetujuan", "Approvals")} description={pick("Tinjau perubahan sebelum diterapkan: perubahan perkiraan, penggunaan skenario, penerbitan rencana, dan perubahan model.", "Review changes before they apply: forecast overrides, scenario usage, plan publication and model changes.")} />
      <MetricStrip className="xl:grid-cols-3">
        <MetricCard
          variant="compact"
          icon={Hourglass}
          label={pick("Menunggu Keputusan", "Awaiting decision")}
          value={s ? formatNumber(s.pending) : "—"}
          meta={pick("Permintaan terbuka", "Open requests")}
          href="/planning/approvals?status=pending"
          destination={pick("tampilkan yang menunggu", "shows pending requests")}
        />
        <MetricCard variant="compact" icon={AlarmClock} label={pick("Jatuh Tempo 24 Jam", "Due within 24h")} value={s ? formatNumber(s.dueToday) : "—"} meta={pick("Perlu diputuskan hari ini", "Decide today")} />
        <MetricCard
          variant="compact"
          icon={TimerOff}
          tone={s?.overdue ? "critical" : "neutral"}
          label={pick("Terlambat", "Overdue")}
          value={s ? formatNumber(s.overdue) : "—"}
          meta={s?.overdue ? pick("Melewati batas waktu", "Past the due date") : pick("Tidak ada yang terlambat", "None overdue")}
        />
      </MetricStrip>
      <DataTable
        label={pick("Permintaan persetujuan", "Approval requests")}
        columns={columns}
        data={q.data?.page.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Permintaan persetujuan tidak dapat dimuat.", "Approval requests could not be loaded.")}
        activeRowId={selectedId}
        onRowClick={(r) => {
          track("approval_opened", { type: r.type });
          state.setParam("id", r.id);
        }}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari permintaan", "Search requests")}
            facets={[
              { key: "status", label: "Status", primary: true, options: (["pending", "approved", "rejected", "revision_requested"] as StatusKey[]).map((v) => ({ value: v, label: STATUS[v].label })) },
              { key: "type", label: pick("Jenis", "Type"), primary: true, options: Object.entries(APPROVAL_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
            ]}
          />
        }
        empty={<EmptyState icon={ShieldCheck} title={state.activeFilterCount ? pick("Tidak ada permintaan yang cocok dengan filter.", "No requests match the current filters.") : pick("Tidak ada persetujuan yang menunggu.", "No approvals are pending.")} description={pick("Permintaan muncul di sini saat perubahan perkiraan, skenario, rencana, atau model perlu keputusan.", "Requests appear here when forecast, scenario, plan or model changes need a decision.")} />}
      />
      <ApprovalDrawer id={selectedId} onClose={() => state.setParam("id", null)} />
    </PageContainer>
  );
}

function ApprovalDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, session } = useSession();
  const q = useApiQuery(["approval", id], (c) => getApproval(c, id as string), { enabled: !!id });
  const [decision, setDecision] = React.useState<null | "approved" | "rejected" | "revision_requested">(null);
  const [comment, setComment] = React.useState("");
  const decide = useApiMutation((c, v: { decision: "approved" | "rejected" | "revision_requested"; comment: string }) => decideApproval(c, id as string, v.decision, v.comment), {
    invalidate: [["approvals"], ["approval"], ["overview"], ["nav-counts"], ["notifications"], ["plan"], ["scenario"], ["scenarios"], ["model"], ["forecast-rows"], ["forecast-detail"]],
    success: (a) => `${a.status === "approved" ? pick("Disetujui", "Approved") : a.status === "rejected" ? pick("Ditolak", "Rejected") : pick("Perlu revisi", "Revision requested")}: ${a.objectLabel}`,
    successDescription: (a) => (a.status === "approved" ? a.afterApproval : pick(`${actorName(a.requestedBy)} sudah diberi tahu.`, `${actorName(a.requestedBy)} has been notified.`)),
    failure: pick("Keputusan tidak dapat dicatat.", "The decision could not be recorded."),
    onSuccess: () => {
      track("approval_completed", {});
      setDecision(null);
    },
  });
  const a = q.data;
  const own = a?.requestedBy === session.userId;
  const href = a ? objectHref(a) : null;

  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id && (
        <DrawerContent
          size="lg"
          eyebrow={a ? APPROVAL_TYPE_LABELS[a.type] : pick("Persetujuan", "Approval")}
          title={a?.objectLabel ?? pick("Permintaan persetujuan", "Approval requests")}
          description={a ? pick(`Diminta oleh ${actorName(a.requestedBy)} · ${formatDateTime(a.requestedAt)}`, `Requested by ${actorName(a.requestedBy)} · ${formatDateTime(a.requestedAt)}`) : undefined}
          footer={
            a && a.status === "pending" && can("approval.decide") && !own ? (
              <>
                <Button variant="ghost" onClick={() => { setComment(""); setDecision("revision_requested"); }}>
                  <RotateCcw aria-hidden /> {pick("Minta revisi", "Request revision")}
                </Button>
                <Button variant="danger-outline" onClick={() => { setComment(""); setDecision("rejected"); }}>
                  <X aria-hidden /> {pick("Tolak", "Reject")}
                </Button>
                <Button variant="primary" onClick={() => { setComment(""); setDecision("approved"); }}>
                  <Check aria-hidden /> {pick("Setujui", "Approve")}
                </Button>
              </>
            ) : undefined
          }
        >
          {q.isPending ? (
            <DetailSkeleton />
          ) : q.isError ? (
            <ErrorState compact what={pick("Permintaan ini tidak dapat dimuat.", "This request could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
          ) : a ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={a.status} />
                <EntityId value={a.id} />
                {a.status === "pending" && <span className="caption">{pick(`Batas ${formatDateTime(a.dueAt)}`, `Due ${formatDateTime(a.dueAt)}`)}</span>}
              </div>
              {a.status === "pending" && own && <InlineAlert tone="info" title={pick("Anda yang mengajukan perubahan ini.", "You submitted this change.")}>{pick("Pemisahan tugas: Manajer lain yang harus memutuskan.", "Separation of duties: a different Manager must decide.")}</InlineAlert>}
              {a.status === "pending" && !can("approval.decide") && <PermissionNotice permission="approval.decide" compact message={pick("Anda dapat mengikuti permintaan ini, tetapi tidak memutuskannya.", "You can follow this request but cannot decide it.")} />}
              <section aria-labelledby="ap-cs">
                <h3 id="ap-cs" className="mb-2 card-title">
                  {pick("Daftar perubahan", "Change set")}
                </h3>
                <ul className="divide-y divide-border-subtle rounded-lg border border-border">
                  {a.changeSet.map((c) => (
                    <li key={c.field} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-3.5 py-2.5 body-sm">
                      <span className="font-semibold">{c.field}</span>
                      <span className="tabular text-fg-secondary line-through decoration-fg-tertiary">{c.from}</span>
                      <span aria-hidden className="text-fg-tertiary">→</span>
                      <span className="font-semibold tabular">{c.to}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="ap-impact">
                <h3 id="ap-impact" className="mb-2 card-title">
                  {pick("Dampak", "Impact")}
                </h3>
                <ConsequenceSummary
                  rows={[
                    ...(a.type !== "model_default" ? [{ label: pick("Berapa besar?", "How much?"), value: pick(`${formatDeltaPercent(a.impact.percent)} (${formatDeltaNumber(a.impact.units)} unit)`, `${formatDeltaPercent(a.impact.percent)} (${formatDeltaNumber(a.impact.units)} units)`), emphasis: true }] : []),
                    { label: pick("Siapa yang terdampak?", "Who is affected?"), value: pluralize(a.impact.skuCount, "SKU") },
                    { label: pick("Ringkasan", "Summary"), value: a.impact.summary },
                  ]}
                />
              </section>
              <section aria-labelledby="ap-ev">
                <h3 id="ap-ev" className="mb-2 card-title">
                  {pick("Bukti dan asumsi", "Evidence and assumptions")}
                </h3>
                {a.evidence.length === 0 && a.assumptions.length === 0 ? (
                  <p className="caption">{pick("Tidak ada bukti yang dilampirkan.", "No evidence was attached.")}</p>
                ) : (
                  <ul className="list-disc pl-5 body-sm text-fg-secondary">
                    {a.evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                    {a.assumptions.map((e) => (
                      <li key={e}>
                        <span className="font-semibold text-fg">{pick("Asumsi:", "Assumption:")}</span> {e}
                      </li>
                    ))}
                  </ul>
                )}
                {href && (
                  <Link href={href} className="mt-2 inline-block text-[0.8125rem] font-semibold text-primary hover:underline">
                    {pick(`Buka ${APPROVAL_TYPE_LABELS[a.type].toLowerCase()} →`, `Open the ${APPROVAL_TYPE_LABELS[a.type].toLowerCase()} →`)}
                  </Link>
                )}
              </section>
              <section aria-labelledby="ap-policy" className="rounded-lg border border-border bg-subtle p-3.5">
                <h3 id="ap-policy" className="mb-1 card-title">
                  {pick("Kebijakan", "Policy")} · {a.policy.name}
                </h3>
                <p className="body-sm text-fg-secondary">{a.policy.rule}</p>
                <p className="mt-1 caption">{pick("Penyetuju yang dibutuhkan", "Required approver")}: {ROLE_LABELS[a.policy.requiredRole]}</p>
                <p className="mt-2 body-sm">
                  <span className="font-semibold">{pick("Setelah disetujui:", "After approval:")}</span> <span className="text-fg-secondary">{a.afterApproval}</span>
                </p>
              </section>
              <section aria-labelledby="ap-hist">
                <h3 id="ap-hist" className="mb-2 card-title">
                  {pick("Riwayat persetujuan", "Approval history")}
                </h3>
                <ActivityList items={a.history} />
              </section>
            </div>
          ) : null}
        </DrawerContent>
      )}
      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        {decision && a && (
          <DialogContent
            title={decision === "approved" ? pick(`Setujui ${a.objectLabel}?`, `Approve ${a.objectLabel}?`) : decision === "rejected" ? pick(`Tolak ${a.objectLabel}?`, `Reject ${a.objectLabel}?`) : pick("Minta revisi?", "Request a revision?")}
            footer={
              <>
                <Button variant="ghost" onClick={() => setDecision(null)}>
                  {pick("Kembali", "Back")}
                </Button>
                <Button
                  variant={decision === "rejected" ? "danger" : "primary"}
                  disabled={decision !== "approved" && comment.trim().length < 5}
                  loading={decide.isPending}
                  onClick={() => decide.mutate({ decision, comment })}
                >
                  {decision === "approved" ? pick("Setujui perubahan", "Approve request") : decision === "rejected" ? pick("Tolak permintaan", "Reject request") : pick("Kembalikan untuk revisi", "Send back for revision")}
                </Button>
              </>
            }
          >
            <ConsequenceSummary
              rows={[
                { label: pick("Apa yang berubah?", "What will change?"), value: a.changeSet.map((c) => `${c.field}: ${c.from} → ${c.to}`).join("; ") },
                ...(a.type !== "model_default" ? [{ label: pick("Berapa besar?", "How much?"), value: pick(`${formatDeltaPercent(a.impact.percent)} (${formatDeltaNumber(a.impact.units)} unit)`, `${formatDeltaPercent(a.impact.percent)} (${formatDeltaNumber(a.impact.units)} units)`), emphasis: true }] : []),
                { label: pick("Siapa yang terdampak?", "Who is affected?"), value: pluralize(a.impact.skuCount, "SKU") },
                { label: pick("Mengapa?", "Why?"), value: a.assumptions[0] ?? a.evidence[0] ?? "—" },
                { label: pick("Kebijakan apa yang berlaku?", "What policy applies?"), value: a.policy.rule },
                { label: pick("Apa yang terjadi setelahnya?", "What happens next?"), value: decision === "approved" ? a.afterApproval : pick(`${actorName(a.requestedBy)} diberi tahu dan perubahan tidak diterapkan.`, `${actorName(a.requestedBy)} is notified and the change is not applied.`), emphasis: true },
              ]}
            />
            <Field
              className="mt-4"
              label={decision === "approved" ? pick("Komentar", "Comment") : pick("Alasan", "Reason")}
              htmlFor="ap-comment"
              optional={decision === "approved"}
              required={decision !== "approved"}
              hint={decision === "approved" ? pick("Tercatat bersama persetujuan Anda.", "Recorded with your approval.") : pick("Pengaju akan melihat ini. Minimal 5 karakter.", "The requester sees this. At least 5 characters.")}
            >
              <Textarea id="ap-comment" value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
