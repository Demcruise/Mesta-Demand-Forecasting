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
import { pick } from "@/lib/i18n";

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
    name: name.trim().length < 3 ? pick("Beri nama skenario minimal 3 karakter.", "Give the scenario a name of at least 3 characters.") : null,
    assumptions: assumptions.length === 0 ? pick("Tambahkan minimal satu asumsi.", "Add at least one assumption.") : null,
    rows: assumptions.map((a) => ({
      value: a.value === a.baselineValue ? pick("Ubah nilainya, atau hapus asumsi ini.", "Change the value, or remove this assumption.") : null,
      rationale: a.rationale.trim().length === 0 ? pick("Tambahkan sumber atau alasannya.", "Add the source or rationale.") : null,
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

  const simulate = useApiMutation((c, id: string) => simulateSavedScenario(c, id), { invalidate: [["scenarios"], ["scenario"]], failure: pick("Skenario tersimpan, tetapi simulasi tidak berjalan.", "The scenario was saved but the simulation did not run.") });
  const save = useApiMutation((c, _v: void) => saveScenario(c, initial?.id ?? null, { name, description, baselineRunId, assumptions }), {
    invalidate: [["scenarios"], ["scenario"]],
    success: (s) => pick(`“${s.name}” tersimpan`, `Saved “${s.name}”`),
    successDescription: () => (preview && !stale ? pick("Hasil simulasi tersimpan bersama skenario.", "Simulation results were saved with the scenario.") : pick("Jalankan simulasi dari halaman skenario untuk melihat dampaknya.", "Run the simulation from the scenario page to see its impact.")),
    failure: pick("Skenario tidak dapat disimpan.", "The scenario was not saved."),
    onSuccess: async (s) => {
      if (!initial) track("scenario_created", {});
      if (preview && !stale) await simulate.mutateAsync(s.id).catch(() => undefined);
      router.push(`/scenarios/${s.id}`);
    },
  });

  if (!can("scenario.create")) return <PermissionNotice permission="scenario.create" />;

  const unitLabel = (a: Assumption) => (a.unit === "pp" ? "%" : a.unit);

  // PAGE-SCENARIO-001: one main column — Step 1 → Step 2 → Step 3 — so every step
  // gets the full content width and the actions sit where the review ends.
  return (
    <div className="flex w-full max-w-[70rem] flex-col gap-6">
      <PageSection title={pick("1. Acuan dan Nama", "1. Baseline and name")} description={pick("Skenario menerapkan asumsi di atas proses perkiraan yang sudah diterbitkan.", "Scenarios apply assumptions on top of a published forecast run.")}>
        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={pick("Proses perkiraan acuan", "Baseline forecast run")} htmlFor="scn-base" required hint={pick("Hanya proses yang sudah diterbitkan yang dapat menjadi acuan.", "Only published runs can be a baseline.")}>
              <Select
                id="scn-base"
                value={baselineRunId || undefined}
                onValueChange={setBaselineRunId}
                placeholder={baselines.isPending ? pick("Memuat proses…", "Loading runs…") : pick("Pilih proses", "Select a run")}
                options={(baselines.data ?? []).map((r, i) => ({ value: r.id, label: `${r.id}${i === 0 ? pick(" · acuan saat ini", " · current baseline") : ""}`, description: `${r.name} · ${formatDateTime(r.publishedAt)}` }))}
              />
            </Field>
            <Field label={pick("Nama skenario", "Scenario name")} htmlFor="scn-name" required error={showErrors ? errors.name : null}>
              <Input id="scn-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={pick("mis. Kenaikan libur akhir tahun", "e.g. Year-end holiday uplift")} maxLength={80} aria-invalid={showErrors && !!errors.name} />
            </Field>
            <Field className="md:col-span-2" label={pick("Deskripsi", "Description")} htmlFor="scn-desc" optional>
              <Textarea id="scn-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={pick("Pertanyaan apa yang ingin dijawab skenario ini?", "What question does this scenario answer?")} />
            </Field>
          </div>
        </Panel>
      </PageSection>

      <PageSection
        title={pick("2. Asumsi", "2. Assumptions")}
        description={pick("Setiap asumsi mengubah satu pendorong untuk satu cakupan.", "Each assumption changes one driver for one scope.")}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setAssumptions((p) => [...p, newAssumption()])} disabled={assumptions.length >= 12}>
            <Plus aria-hidden /> {pick("Tambah asumsi", "Add assumption")}
          </Button>
        }
      >
        {showErrors && errors.assumptions && <InlineAlert tone="critical" title={errors.assumptions} />}
        <ul className="flex flex-col gap-3">
          {assumptions.map((a, i) => {
            const effect = assumptionEffect(a);
            const rowErr = showErrors ? errors.rows[i] : undefined;
            const change = a.value - a.baselineValue;
            return (
              <li key={a.id} className="rounded-lg border border-border bg-surface p-4" aria-label={pick(`Asumsi ${i + 1}`, `Assumption ${i + 1}`)}>
                {/* Desktop: Driver · Scope · Baseline · Change · Result · Reason · Action on one row. Mobile: stacked. */}
                <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_5.5rem_6rem_6.5rem_minmax(0,1.8fr)_2rem]">
                  <Field label={pick("Pendorong", "Driver")} htmlFor={`${a.id}-driver`}>
                    <Select id={`${a.id}-driver`} value={a.driver} onValueChange={(v) => update(a.id, { driver: v as ScenarioDriver })} options={DRIVERS.map((d) => ({ value: d, label: DRIVER_LABELS[d] }))} />
                  </Field>
                  <Field label={pick("Cakupan", "Scope")} htmlFor={`${a.id}-scope`}>
                    <Select
                      id={`${a.id}-scope`}
                      value={a.scope}
                      onValueChange={(v) => update(a.id, { scope: v })}
                      options={SCOPES.filter((s) => (a.driver === "regional" ? s.startsWith(REGION_SCOPE_PREFIX) : true)).map((s) => ({ value: s, label: s }))}
                    />
                  </Field>
                  <Field label={pick("Acuan", "Baseline")} htmlFor={`${a.id}-base`}>
                    <Input id={`${a.id}-base`} value={`${a.baselineValue}${unitLabel(a)}`} readOnly disabled aria-readonly />
                  </Field>
                  <Field label={pick(`Nilai baru (${unitLabel(a)})`, `New (${unitLabel(a)})`)} htmlFor={`${a.id}-val`}>
                    <Input id={`${a.id}-val`} type="number" step="0.5" value={a.value} onChange={(e) => update(a.id, { value: Number(e.target.value) })} aria-invalid={!!rowErr?.value} aria-describedby={rowErr?.value ? `${a.id}-val-error` : undefined} />
                  </Field>
                  <div className="flex flex-col gap-1.5">
                    <span className="label">{pick("Efek permintaan", "Demand effect")}</span>
                    <span className={cn("flex h-[var(--control-h-md)] items-center rounded-md border border-border bg-subtle px-3 text-sm font-semibold tabular", deltaToneClass(effect))}>{formatDeltaPercent(effect)}</span>
                  </div>
                  <Field className="sm:col-span-2 xl:col-span-1" label={pick("Sumber atau alasan", "Source or rationale")} htmlFor={`${a.id}-why`} required error={rowErr?.rationale}>
                    <Input id={`${a.id}-why`} value={a.rationale} onChange={(e) => update(a.id, { rationale: e.target.value })} placeholder={pick("mis. Pemberitahuan pemasok: harga naik 8%", "e.g. Supplier notice: +8% list price")} aria-invalid={!!rowErr?.rationale} />
                  </Field>
                  <div className="flex items-end sm:col-span-2 xl:col-span-1 xl:h-full xl:pb-0.5 xl:pt-6">
                    <Tooltip content={pick("Hapus asumsi", "Remove assumption")}>
                      <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label={pick(`Hapus asumsi ${i + 1}`, `Remove assumption ${i + 1}`)} onClick={() => setAssumptions((p) => p.filter((x) => x.id !== a.id))}>
                        <Trash2 aria-hidden />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                {rowErr?.value && (
                  <p id={`${a.id}-val-error`} className="mt-1.5 text-xs font-medium text-critical-fg" role="alert">
                    {rowErr.value}
                  </p>
                )}
                <p className="mt-2 caption">
                  {DRIVER_HELP[a.driver]}{" "}
                  <span className="text-fg-tertiary">
                    {pick("Perubahan", "Change")}: {change >= 0 ? "+" : "−"}
                    {Math.abs(change)}
                    {a.unit === "pp" ? pick(" poin persentase", " percentage points") : a.unit === "%" ? "%" : ` ${a.unit}`} · {a.scope}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </PageSection>

      <PageSection title={pick("3. Simulasikan dan Tinjau Dampak", "3. Simulate and review impact")} description={pick("Simulasi menerapkan asumsi pada acuan. Jalankan lagi setelah mengubah asumsi.", "Simulation applies the assumptions to the baseline. Run it again after changing assumptions.")}>
        <Panel
          footer={
            <>
              <span className="caption">{pick(`${assumptions.length} asumsi`, pluralize(assumptions.length, "assumption"))}</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={runPreview} loading={previewing} loadingText={pick("Menyimulasikan", "Simulating")}>
                  <Play aria-hidden /> {pick("Jalankan Simulasi", "Run simulation")}
                </Button>
                <Button
                  variant="primary"
                  loading={save.isPending || simulate.isPending}
                  loadingText={pick("Menyimpan", "Saving")}
                  onClick={() => {
                    setShowErrors(true);
                    if (!invalid && baselineRunId) save.mutate();
                  }}
                >
                  <Save aria-hidden /> {pick("Simpan Skenario", "Save scenario")}
                </Button>
              </div>
            </>
          }
        >
          {previewError && (
            <InlineAlert tone="critical" title={pick("Simulasi gagal.", "Simulation failed.")} className="mb-3">
              {previewError}
            </InlineAlert>
          )}
          {stale && (
            <InlineAlert tone="warning" title={pick("Asumsi berubah sejak simulasi terakhir.", "Assumptions changed since the last simulation.")} className="mb-3">
              {pick("Jalankan simulasi lagi untuk memperbarui dampaknya.", "Run the simulation again to update the impact.")}
            </InlineAlert>
          )}
          {preview ? (
            <ImpactPreview result={preview.result} />
          ) : (
            <div className="flex flex-col items-start gap-1 py-2">
              <p className="body-sm font-semibold text-fg">{pick("Belum ada simulasi.", "No simulation yet.")}</p>
              <p className="body-sm text-fg-secondary">{pick("Jalankan simulasi untuk melihat dampaknya sebelum menyimpan.", "Run the simulation to see the impact before saving.")}</p>
            </div>
          )}
          {showErrors && invalid && <p className="mt-3 text-xs font-semibold text-critical-fg">{pick("Perbaiki kolom yang ditandai sebelum menyimpan.", "Fix the highlighted fields before saving.")}</p>}
          {preview && !stale && (
            <p className="mt-3 caption">
              {pick(
                `Acuan ${baselineRunId} · disimulasikan ${formatDateTime(preview.result.simulatedAt)} · total ${formatNumber(preview.result.scenarioUnits)} unit.`,
                `Baseline ${baselineRunId} · simulated ${formatDateTime(preview.result.simulatedAt)} · total ${formatNumber(preview.result.scenarioUnits)} units.`,
              )}
            </p>
          )}
        </Panel>
      </PageSection>
    </div>
  );
}
