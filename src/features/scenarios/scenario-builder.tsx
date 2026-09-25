"use client";

import { Play, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { Assumption, Scenario, ScenarioDriver, ScenarioResult } from "@/types/domain";
import { previewScenario, saveScenario, scenarioBaselines, simulateSavedScenario } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { CATEGORIES, REGIONS } from "@/lib/mock/catalog";
import { ALL_CATEGORIES_SCOPE, assumptionEffect, DRIVER_HELP, DRIVER_LABELS, DRIVER_UNITS, REGION_SCOPE_PREFIX } from "@/lib/mock/scenarios";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime, formatDeltaPercent, formatNumber, pluralize } from "@/lib/format";
import { deltaToneClass } from "@/components/forecasting/metrics";
import { track } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/overlay";
import { PageSection, Panel } from "@/components/page/page";
import { InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { ImpactPreview } from "./impact-preview";

const DRIVERS = Object.keys(DRIVER_LABELS) as ScenarioDriver[];
const SCOPES = [ALL_CATEGORIES_SCOPE, ...CATEGORIES, ...REGIONS.map((r) => `${REGION_SCOPE_PREFIX}${r}`)];

function newAssumption(): Assumption {
  return { id: `a_${Math.random().toString(36).slice(2, 8)}`, driver: "demand_change", scope: ALL_CATEGORIES_SCOPE, baselineValue: 0, value: 0, unit: "%", rationale: "" };
}

/**
 * PAGE-SCENARIO-BUILDER: select baseline → name → assumptions → validate → run
 * simulation → review impact → save. Every assumption shows baseline, changed value,
 * delta and rationale.
 */
export function ScenarioBuilder({ initial }: { initial: Scenario | null }) {
  const router = useRouter();
  const { can, ctx } = useSession();
  const baselines = useApiQuery(["scenario-baselines"], scenarioBaselines);
  const [baselineRunId, setBaselineRunId] = React.useState(initial?.baselineRunId ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [assumptions, setAssumptions] = React.useState<Assumption[]>(initial?.assumptions.length ? structuredClone(initial.assumptions) : [newAssumption()]);
  const [preview, setPreview] = React.useState<{ result: ScenarioResult; signature: string } | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);

  React.useEffect(() => {
    if (!baselineRunId && baselines.data?.[0]) setBaselineRunId(baselines.data[0].id);
  }, [baselines.data, baselineRunId]);

  const signature = JSON.stringify({ baselineRunId, assumptions });
  const stale = preview && preview.signature !== signature;

  const errors = {
    name: name.trim().length < 3 ? "Beri nama skenario minimal 3 karakter." : null,
    assumptions: assumptions.length === 0 ? "Tambahkan minimal satu asumsi." : null,
    rows: assumptions.map((a) => ({
      value: a.value === a.baselineValue ? "Ubah nilainya, atau hapus asumsi ini." : null,
      rationale: a.rationale.trim().length === 0 ? "Tambahkan sumber atau alasannya." : null,
    })),
  };
  const invalid = !!errors.name || !!errors.assumptions || errors.rows.some((r) => r.value || r.rationale);

  const update = (id: string, patch: Partial<Assumption>) =>
    setAssumptions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a, ...patch };
        if (patch.driver && patch.driver !== a.driver) {
          next.unit = DRIVER_UNITS[patch.driver];
          next.baselineValue = patch.driver === "availability" ? 97 : 0;
          next.value = next.baselineValue;
          if (patch.driver === "regional" && !next.scope.startsWith(REGION_SCOPE_PREFIX)) next.scope = `${REGION_SCOPE_PREFIX}${REGIONS[0]}`;
        }
        return next;
      }),
    );

  const runPreview = async () => {
    setShowErrors(true);
    if (!baselineRunId || errors.rows.some((r) => r.value) || assumptions.length === 0) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const result = await previewScenario(ctx, { baselineRunId, assumptions });
      if (result) {
        setPreview({ result, signature });
        track("scenario_simulated", { assumptions: assumptions.length });
      }
    } catch (e) {
      setPreviewError(errorMessage(e));
    } finally {
      setPreviewing(false);
    }
  };

  const simulate = useApiMutation((c, id: string) => simulateSavedScenario(c, id), { invalidate: [["scenarios"], ["scenario"]], failure: "Skenario tersimpan, tetapi simulasi tidak berjalan." });
  const save = useApiMutation((c, _v: void) => saveScenario(c, initial?.id ?? null, { name, description, baselineRunId, assumptions }), {
    invalidate: [["scenarios"], ["scenario"]],
    success: (s) => `Saved “${s.name}”`,
    successDescription: () => (preview && !stale ? "Hasil simulasi tersimpan bersama skenario." : "Jalankan simulasi dari halaman skenario untuk melihat dampaknya."),
    failure: "Skenario tidak dapat disimpan.",
    onSuccess: async (s) => {
      if (!initial) track("scenario_created", {});
      if (preview && !stale) await simulate.mutateAsync(s.id).catch(() => undefined);
      router.push(`/scenarios/${s.id}`);
    },
  });

  if (!can("scenario.create")) return <PermissionNotice permission="scenario.create" />;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <PageSection title="1. Acuan dan nama" description="Skenario menerapkan asumsi di atas proses perkiraan yang sudah diterbitkan.">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proses perkiraan acuan" htmlFor="scn-base" required hint="Hanya proses yang sudah diterbitkan yang dapat menjadi acuan.">
                <Select
                  id="scn-base"
                  value={baselineRunId || undefined}
                  onValueChange={setBaselineRunId}
                  placeholder={baselines.isPending ? "Memuat proses…" : "Pilih proses"}
                  options={(baselines.data ?? []).map((r, i) => ({ value: r.id, label: `${r.id}${i === 0 ? " · current baseline" : ""}`, description: `${r.name} · ${formatDateTime(r.publishedAt)}` }))}
                />
              </Field>
              <Field label="Nama skenario" htmlFor="scn-name" required error={showErrors ? errors.name : null}>
                <Input id="scn-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Year-end holiday uplift" maxLength={80} aria-invalid={showErrors && !!errors.name} />
              </Field>
              <Field className="sm:col-span-2" label="Deskripsi" htmlFor="scn-desc" optional>
                <Textarea id="scn-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Pertanyaan apa yang ingin dijawab skenario ini?" />
              </Field>
            </div>
          </Panel>
        </PageSection>

        <PageSection
          title="2. Assumptions"
          description="Setiap asumsi mengubah satu pendorong untuk satu cakupan. Pendorong dan efeknya masih placeholder sampai dikonfirmasi dengan tim domain."
          actions={
            <Button size="sm" variant="secondary" onClick={() => setAssumptions((p) => [...p, newAssumption()])} disabled={assumptions.length >= 12}>
              <Plus aria-hidden /> Add assumption
            </Button>
          }
        >
          {showErrors && errors.assumptions && <InlineAlert tone="critical" title={errors.assumptions} />}
          <ul className="flex flex-col gap-3">
            {assumptions.map((a, i) => {
              const effect = assumptionEffect(a);
              const rowErr = showErrors ? errors.rows[i] : undefined;
              return (
                <li key={a.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="metadata">Assumption {i + 1}</span>
                    <Tooltip content="Hapus asumsi">
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove assumption ${i + 1}`} onClick={() => setAssumptions((p) => p.filter((x) => x.id !== a.id))}>
                        <Trash2 aria-hidden />
                      </Button>
                    </Tooltip>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_6rem_6rem_7rem]">
                    <Field label="Pendorong" htmlFor={`${a.id}-driver`} hint={DRIVER_HELP[a.driver]}>
                      <Select id={`${a.id}-driver`} value={a.driver} onValueChange={(v) => update(a.id, { driver: v as ScenarioDriver })} options={DRIVERS.map((d) => ({ value: d, label: DRIVER_LABELS[d] }))} />
                    </Field>
                    <Field label="Scope" htmlFor={`${a.id}-scope`}>
                      <Select
                        id={`${a.id}-scope`}
                        value={a.scope}
                        onValueChange={(v) => update(a.id, { scope: v })}
                        options={SCOPES.filter((s) => (a.driver === "regional" ? s.startsWith(REGION_SCOPE_PREFIX) : true)).map((s) => ({ value: s, label: s }))}
                      />
                    </Field>
                    <Field label="Acuan" htmlFor={`${a.id}-base`}>
                      <Input id={`${a.id}-base`} value={`${a.baselineValue}${a.unit === "pp" ? "%" : a.unit}`} readOnly disabled aria-readonly />
                    </Field>
                    <Field label={`New (${a.unit === "pp" ? "%" : a.unit})`} htmlFor={`${a.id}-val`}>
                      <Input id={`${a.id}-val`} type="number" step="0.5" value={a.value} onChange={(e) => update(a.id, { value: Number(e.target.value) })} aria-invalid={!!rowErr?.value} aria-describedby={rowErr?.value ? `${a.id}-val-error` : undefined} />
                    </Field>
                    <div className="flex flex-col gap-1.5">
                      <span className="label">Efek permintaan</span>
                      <span className={cn("flex h-[var(--control-h-md)] items-center rounded-md border border-border bg-subtle px-3 text-sm font-semibold tabular", deltaToneClass(effect))}>{formatDeltaPercent(effect)}</span>
                    </div>
                  </div>
                  {rowErr?.value && <p id={`${a.id}-val-error`} className="mt-1.5 text-xs font-medium text-critical-fg" role="alert">{rowErr.value}</p>}
                  <Field className="mt-3" label="Sumber atau alasan" htmlFor={`${a.id}-why`} required error={rowErr?.rationale}>
                    <Input id={`${a.id}-why`} value={a.rationale} onChange={(e) => update(a.id, { rationale: e.target.value })} placeholder="e.g. Supplier notice: +8% list price from next month" aria-invalid={!!rowErr?.rationale} />
                  </Field>
                  <p className="mt-2 caption">
                    Delta: {a.value - a.baselineValue >= 0 ? "+" : "−"}
                    {Math.abs(a.value - a.baselineValue)}
                    {a.unit === "pp" ? " percentage points" : a.unit === "%" ? "%" : ` ${a.unit}`} on {a.scope}.
                  </p>
                </li>
              );
            })}
          </ul>
        </PageSection>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-[calc(var(--topbar-h)+1.5rem)] xl:self-start">
        <Panel
          title="3. Simulate and review impact"
          description="Simulasi menerapkan asumsi pada acuan. Jalankan lagi setelah mengubah asumsi."
          footer={
            <>
              <span className="caption">{pluralize(assumptions.length, "assumption")}</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={runPreview} loading={previewing} loadingText="Menyimulasikan">
                  <Play aria-hidden /> Run simulation
                </Button>
                <Button
                  variant="primary"
                  loading={save.isPending || simulate.isPending}
                  loadingText="Menyimpan"
                  onClick={() => {
                    setShowErrors(true);
                    if (!invalid && baselineRunId) save.mutate();
                  }}
                >
                  <Save aria-hidden /> Save scenario
                </Button>
              </div>
            </>
          }
        >
          {previewError && <InlineAlert tone="critical" title="Simulasi gagal." className="mb-3">{previewError}</InlineAlert>}
          {stale && <InlineAlert tone="warning" title="Asumsi berubah sejak simulasi terakhir." className="mb-3">Jalankan simulasi lagi untuk memperbarui dampaknya.</InlineAlert>}
          {preview ? (
            <ImpactPreview result={preview.result} compact />
          ) : (
            <p className="body-sm text-fg-secondary">No simulation yet. Run it to see the change in total demand and by category before saving.</p>
          )}
          {showErrors && invalid && <p className="mt-3 text-xs font-semibold text-critical-fg">Fix the highlighted fields before saving.</p>}
          {preview && !stale && <p className="mt-3 caption">Baseline {baselineRunId} · simulated {formatDateTime(preview.result.simulatedAt)} · total {formatNumber(preview.result.scenarioUnits)} units.</p>}
        </Panel>
      </aside>
    </div>
  );
}
