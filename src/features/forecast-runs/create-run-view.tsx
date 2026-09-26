"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, Loader2, Play } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import type { ForecastModel } from "@/types/domain";
import { createRun, defaultRunInput, getRun, previewScope, RUN_FORM_OPTIONS, runToInput, validateRun, type RunInput, type ValidationCheck } from "@/lib/api/forecasting";
import { listModelOptions } from "@/lib/api/models";
import { listDataQuality, listSources } from "@/lib/api/data";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDate, formatDateRange, formatNumber, formatPercent, pluralize } from "@/lib/format";
import { DAY_MS } from "@/lib/mock/time";
import { track } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/controls";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { PageContainer, PageHeader, Panel } from "@/components/page/page";
import { WizardLayout, WizardPanel, WizardSteps, type WizardStep } from "@/components/workflows/wizard";
import { ErrorState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { StatusBadge } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { ConsequenceSummary } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { pick, localized } from "@/lib/i18n";

const STEPS: WizardStep[] = localized([
  { key: "scope", label: "Cakupan", description: "Yang ingin diperkirakan" },
  { key: "period", label: "Periode", description: "Data historis yang dipakai" },
  { key: "horizon", label: "Rentang", description: "Seberapa jauh ke depan" },
  { key: "model", label: "Model", description: "Model dan versinya" },
  { key: "validate", label: "Periksa Data", description: "Periksa masukan" },
  { key: "review", label: "Tinjau", description: "Konfirmasi pengaturan" },
], [
  { key: "scope", label: "Define scope", description: "What to forecast" },
  { key: "period", label: "Data period", description: "History to learn from" },
  { key: "horizon", label: "Horizon", description: "How far ahead" },
  { key: "model", label: "Model", description: "Which model and version" },
  { key: "validate", label: "Validate data", description: "Check inputs" },
  { key: "review", label: "Review", description: "Confirm configuration" },
]);

/** Large runs get an explicit consequence confirmation before starting (backlog §20). */
const HIGH_IMPACT_SKUS = 500;

/** PAGE-CREATE-FORECAST: scope → data period → horizon → model → validate → review → run. */
export function CreateRunView() {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get("from");
  const { ctx, can } = useSession();
  useBreadcrumbLeaf(pick("Perkiraan Baru", "New forecast run"));
  const [step, setStep] = React.useState(0);
  const [completed, setCompleted] = React.useState<Set<number>>(new Set());
  const [input, setInput] = React.useState<RunInput>(() => ({ ...defaultRunInput(ctx), name: params.get("name") ?? "" }));
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [touchedName, setTouchedName] = React.useState(false);

  const source = useApiQuery(["run", fromId], (c) => getRun(c, fromId as string), { enabled: !!fromId });
  React.useEffect(() => {
    if (source.data) setInput(runToInput(source.data.run));
  }, [source.data]);

  const scope = useApiQuery(["scope-preview", input.regions, input.categories], (c) => previewScope(c, input), { keepPrevious: true });
  const models = useApiQuery(["model-options"], listModelOptions);
  const sources = useApiQuery(["sources"], listSources, { enabled: step === 1 });
  const dq = useApiQuery(["dq", "missing"], (c) => listDataQuality(c, { filters: { type: ["missing_records"], status: ["open", "investigating"] } }), { enabled: step === 1 });
  const validation = useApiQuery(["run-validation", input], (c) => validateRun(c, input), { enabled: step >= 4 });

  const create = useApiMutation((c, v: RunInput) => createRun(c, v), {
    invalidate: [["runs"], ["overview"]],
    success: (r) => pick(`Proses perkiraan ${r.id} masuk antrean`, `Forecast run ${r.id} queued`),
    successDescription: pick("Proses akan segera dimulai. Anda boleh meninggalkan halaman ini; Anda akan diberi tahu saat selesai.", "Processing starts shortly. You can leave this page; you will be notified when it finishes."),
    failure: pick("Proses perkiraan tidak dapat dibuat.", "The forecast run was not created."),
    onSuccess: (r) => {
      track("forecast_run_started", { horizon: r.horizonDays, skus: r.scope.skuCount });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });

  if (!can("forecast.run.create")) {
    return (
      <PageContainer width="narrow">
        <PageHeader title={pick("Buat Perkiraan", "Create forecast run")} />
        <PermissionNotice permission="forecast.run.create" />
      </PageContainer>
    );
  }

  const set = <K extends keyof RunInput>(key: K, value: RunInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));
  const selectedModel = models.data?.find((m) => m.id === input.modelId);
  const historyDays = Math.round((new Date(input.historicalEnd).getTime() - new Date(input.historicalStart).getTime()) / DAY_MS) + 1;
  const checks = validation.data ?? [];
  const blocking = checks.filter((c) => c.result === "blocking");
  const warnings = checks.filter((c) => c.result === "warning");
  const nameError = touchedName && input.name.trim().length === 0 ? pick("Beri nama proses agar mudah ditemukan lagi.", "Name the run so it can be found later.") : null;

  const stepValid = (i: number) => {
    if (i === 0) return input.name.trim().length > 0 && (scope.data?.skuCount ?? 0) > 0;
    if (i === 1) return historyDays >= 1 && input.historicalStart <= input.historicalEnd;
    if (i === 2) return input.horizonDays >= 1 && input.horizonDays <= 180;
    if (i === 3) return !!selectedModel;
    if (i === 4) return !validation.isPending && blocking.length === 0 && !validation.isError;
    return true;
  };

  const goNext = () => {
    if (step === 0) setTouchedName(true);
    if (!stepValid(step)) return;
    setCompleted((prev) => new Set(prev).add(step));
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const start = () => {
    if ((scope.data?.skuCount ?? 0) >= HIGH_IMPACT_SKUS) setConfirmOpen(true);
    else create.mutate(input);
  };

  const nextLabel = [pick("Lanjut ke Periode", "Set data period"), pick("Lanjut ke Rentang", "Configure horizon"), pick("Lanjut ke Model", "Choose model"), pick("Periksa Data", "Validate data"), pick("Lanjut ke Tinjau", "Review configuration")][step];
  const backLabel = ["", pick("Kembali ke Cakupan", "Back to scope"), pick("Kembali ke Periode", "Back to data period"), pick("Kembali ke Rentang", "Back to horizon"), pick("Kembali ke Model", "Back to model"), pick("Kembali ke Pemeriksaan", "Back to validation")][step];

  const summaryRows = [
    { label: pick("Nama", "Name"), value: input.name || "—" },
    { label: pick("Cakupan", "Scope"), value: pick(`${input.businessUnit} · ${input.categories.length ? input.categories.join(", ") : "Semua kategori"} · ${input.regions.length ? input.regions.join(", ") : "Semua wilayah"}`, `${input.businessUnit} · ${input.categories.length ? input.categories.join(", ") : "All categories"} · ${input.regions.length ? input.regions.join(", ") : "All regions"}`) },
    { label: pick("Ukuran", "Size"), value: scope.data ? pick(`${pluralize(scope.data.skuCount, "SKU")} × ${scope.data.locationCount} lokasi`, `${pluralize(scope.data.skuCount, "SKU")} × ${scope.data.locationCount} locations`) : "…" },
    { label: pick("Periode historis", "Historical period"), value: pick(`${formatDateRange(input.historicalStart, input.historicalEnd)} (${historyDays} hari)`, `${formatDateRange(input.historicalStart, input.historicalEnd)} (${historyDays} days)`) },
    { label: pick("Rentang perkiraan", "Forecast horizon"), value: pick(`${input.horizonDays} hari · ${input.frequency === "daily" ? "harian" : "mingguan"}`, `${input.horizonDays} days · ${input.frequency}`) },
    { label: pick("Model", "Model"), value: selectedModel ? pick(`${selectedModel.name} ${selectedModel.version}`, `${selectedModel.name} ${selectedModel.version}`) : "—" },
    { label: pick("Hasil yang diharapkan", "Expected output"), value: scope.data ? pick(`${formatNumber(scope.data.skuCount * input.horizonDays)} perkiraan SKU-hari dengan rentang 80%`, `${formatNumber(scope.data.skuCount * input.horizonDays)} SKU-day forecasts with 80% prediction intervals`) : "…" },
    { label: pick("Peringatan yang diketahui", "Known warnings"), value: warnings.length ? warnings.map((w) => w.detail).join(" ") : pick("Tidak ada", "None"), emphasis: warnings.length > 0 },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={fromId ? pick("Buat Perkiraan dari Salinan", "Create forecast run from a copy") : pick("Buat Perkiraan", "Create forecast run")}
        description={pick("Pilih data dan model untuk membuat perkiraan permintaan. Belum ada yang diterbitkan sampai manajer menerbitkan hasilnya.", "Configure what to forecast, validate the inputs, then run. Nothing is published until a manager publishes the results.")}
      />
      {fromId && source.isError && <ErrorState compact what={pick("Proses yang ingin disalin tidak dapat dimuat.", "The run to copy could not be loaded.")} error={source.error} />}
      <WizardLayout steps={<WizardSteps steps={STEPS} current={step} completed={completed} onSelect={setStep} />}>
        {step === 0 && (
          <WizardPanel
            title={pick("Pilih Cakupan", "Define scope")}
            description={pick("Tentukan produk atau kategori yang ingin diperkirakan. Biarkan kosong untuk mencakup semuanya.", "Choose the products and locations to forecast. Leave a dimension empty to include all of it.")}
            footer={
              <>
                <span className="caption tabular">{scope.data ? pick(`${pluralize(scope.data.skuCount, "SKU")} · ${scope.data.locationCount} lokasi · ${formatNumber(scope.data.seriesCount)} seri`, `${pluralize(scope.data.skuCount, "SKU")} · ${scope.data.locationCount} locations · ${formatNumber(scope.data.seriesCount)} series`) : pick("Menghitung cakupan…", "Calculating scope…")}</span>
                <Button variant="primary" onClick={goNext}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            <div className="grid gap-5">
              <Field label={pick("Nama proses", "Run name")} htmlFor="run-name" required error={nameError} hint={pick("Tampil di daftar proses, pemberitahuan, dan riwayat aktivitas.", "Shown in run lists, notifications and audit history.")}>
                <Input id="run-name" value={input.name} onChange={(e) => set("name", e.target.value)} onBlur={() => setTouchedName(true)} placeholder={pick("mis. Minuman · periode promo 60 hari", "e.g. Beverages · 60-day promo horizon")} aria-invalid={!!nameError} aria-describedby={nameError ? "run-name-error" : "run-name-hint"} maxLength={80} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={pick("Unit bisnis", "Business unit")} htmlFor="bu">
                  <Select id="bu" value={input.businessUnit} onValueChange={(v) => set("businessUnit", v)} options={RUN_FORM_OPTIONS.businessUnits.map((b) => ({ value: b, label: b }))} />
                </Field>
                <Field label={pick("Kategori", "Categories")} htmlFor="cats" hint={pick("Kosong berarti semua kategori.", "Empty means all categories.")}>
                  <MultiSelect id="cats" aria-describedby="cats-hint" value={input.categories} onChange={(v) => set("categories", v)} allLabel={pick("Semua kategori", "All categories")} options={RUN_FORM_OPTIONS.categories.map((c) => ({ value: c, label: c }))} placeholder={pick("Cari kategori", "Search categories")} />
                </Field>
                <Field label={pick("Wilayah", "Regions")} htmlFor="regions" hint={pick("Kosong berarti semua wilayah.", "Empty means all regions.")}>
                  <MultiSelect id="regions" aria-describedby="regions-hint" value={input.regions} onChange={(v) => set("regions", v)} allLabel={pick("Semua wilayah", "All regions")} options={RUN_FORM_OPTIONS.regions.map((c) => ({ value: c, label: c }))} placeholder={pick("Cari wilayah", "Search regions")} />
                </Field>
              </div>
              <div>
                <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary hover:underline" aria-expanded={showAdvanced}>
                  <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} aria-hidden />
                  {showAdvanced ? pick("Sembunyikan filter grup toko, grup produk, dan SKU", "Hide store group, product group and SKU filters") : pick("Tampilkan filter grup toko, grup produk, dan SKU", "Show store group, product group and SKU filters")}
                </button>
                {showAdvanced && (
                  <InlineAlert tone="info" title={pick("Filter grup toko, grup produk, dan SKU belum tersedia.", "Store group, product group and SKU filters are not available yet.")} className="mt-3">
                    {pick("Dimensi ini bergantung pada hierarki produk dan lokasi yang sudah dikonfirmasi. Untuk sekarang gunakan kategori dan wilayah.", "These dimensions depend on the confirmed product and location hierarchy (backlog §93 items 3 and 4). Use categories and regions for now.")}
                  </InlineAlert>
                )}
              </div>
            </div>
          </WizardPanel>
        )}

        {step === 1 && (
          <WizardPanel
            title={pick("Pilih Periode", "Select data period")}
            description={pick("Pilih data historis yang akan digunakan model.", "The historical window the model learns from.")}
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(1)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={pick("Awal historis", "Historical start")} htmlFor="hs" required>
                <Input id="hs" type="date" value={input.historicalStart} max={input.historicalEnd} onChange={(e) => set("historicalStart", e.target.value)} />
              </Field>
              <Field label={pick("Akhir historis", "Historical end")} htmlFor="he" required hint={pick("Hari terakhir dengan data lengkap.", "Latest complete day of data.")}>
                <Input id="he" type="date" value={input.historicalEnd} min={input.historicalStart} onChange={(e) => set("historicalEnd", e.target.value)} />
              </Field>
              <Field label={pick("Sumber data", "Data source")} htmlFor="src" hint={pick("Permintaan menggabungkan data POS dan pesanan ERP. Atur sumbernya di Sumber Data.", "Demand combines POS and ERP orders. Configure sources in Data sources.")}>
                <Select id="src" value="combined" onValueChange={() => undefined} options={[{ value: "combined", label: pick("Transaksi POS + pesanan penjualan ERP", "POS transactions + ERP sales orders") }]} />
              </Field>
              <Field label={pick("Frekuensi", "Frequency")} htmlFor="freq">
                <Select
                  id="freq"
                  value={input.frequency}
                  onValueChange={(v) => set("frequency", v as RunInput["frequency"])}
                  options={[
                    { value: "daily", label: pick("Harian", "Daily") },
                    { value: "weekly", label: pick("Mingguan", "Weekly"), description: pick("Hanya untuk model permintaan intermiten", "Only intermittent-demand models") },
                  ]}
                />
              </Field>
            </div>
            {/* PAGE-CREATE-FRESH-002/004: one fixed cell per fact; 4 → 2×2 → 1 column, never overlapping. */}
            <Panel className="mt-5 shadow-none" bodyClassName="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
              <Stat label={pick("Rentang historis", "Historical window")} value={pick(`${historyDays} hari`, `${historyDays} days`)} />
              <Stat label={pick("Data tersedia sampai", "Data available through")} value={formatDate(input.historicalEnd)} />
              <div className="min-w-0">
                <p className="caption">{pick("Terakhir diperbarui", "Data freshness")}</p>
                <FreshnessIndicator variant="cell" timestamp={sources.data?.find((x) => x.id === "src_pos")?.lastSuccessAt} label={pick("POS diperbarui", "POS updated")} source={pick("Transaksi POS", "POS transactions")} />
              </div>
              <Stat
                label={pick("Periode yang kosong", "Missing periods")}
                value={dq.data ? (dq.data.page.total === 0 ? pick("Tidak ditemukan", "None detected") : pluralize(dq.data.page.items.reduce((n, i) => n + i.affectedSkus, 0), "SKU") + pick(" terdampak", " affected")) : "…"}
                hint={dq.data?.page.items[0]?.title}
              />
            </Panel>
          </WizardPanel>
        )}

        {step === 2 && (
          <WizardPanel
            title={pick("Pilih Rentang Perkiraan", "Configure horizon")}
            description={pick("Tentukan berapa lama ke depan yang ingin diperkirakan. Rentang lebih panjang memiliki rentang perkiraan yang lebih lebar.", "How many days ahead to forecast. Longer horizons have wider prediction intervals.")}
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(2)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            <RadioCards
              aria-label={pick("Rentang perkiraan", "Forecast horizon")}
              columns={3}
              value={RUN_FORM_OPTIONS.horizons.includes(input.horizonDays) ? String(input.horizonDays) : "custom"}
              onValueChange={(v) => v !== "custom" && set("horizonDays", Number(v))}
              options={[
                ...RUN_FORM_OPTIONS.horizons.map((h) => ({
                  value: String(h),
                  label: pick(`${h} hari`, `${h} days`),
                  description: h <= 14 ? pick("Pengisian ulang", "Replenishment") : h <= 30 ? pick("Perencanaan bulanan", "Monthly planning") : pick("Persiapan musiman", "Seasonal build"),
                })),
                { value: "custom", label: pick("Khusus", "Custom"), description: pick("Masukkan nilai di bawah", "Enter a value below") },
              ]}
            />
            <Field className="mt-4 max-w-xs" label={pick("Rentang khusus (hari)", "Custom horizon (days)")} htmlFor="h-custom" hint={pick("1–180 hari. Nilai yang diizinkan masih perlu dikonfirmasi.", "1–180 days. Allowed values need confirmation (backlog §93 item 6).")}>
              <Input id="h-custom" type="number" min={1} max={180} value={input.horizonDays} onChange={(e) => set("horizonDays", Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
            </Field>
          </WizardPanel>
        )}

        {step === 3 && (
          <WizardPanel
            title={pick("Pilih Model", "Select model")}
            description={pick("Bandingkan model berdasarkan performa historis, bukan satu angka saja. Model kandidat sebaiknya ditinjau sebelum diterbitkan.", "Compare models on historical performance, not a single score. Candidate models should be reviewed before publishing.")}
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(3)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            {models.isPending ? (
              <p className="caption">{pick("Memuat model…", "Loading models…")}</p>
            ) : models.isError ? (
              <ErrorState compact what={pick("Model tidak dapat dimuat.", "Models could not be loaded.")} error={models.error} onRetry={() => models.refetch()} />
            ) : (
              <RadioCards
                aria-label={pick("Model", "Model")}
                value={input.modelId}
                onValueChange={(v) => set("modelId", v)}
                options={(models.data ?? []).map((m: ForecastModel) => {
                  const incompatible = m.status === "archived" || m.horizonDays < input.horizonDays || m.frequency !== input.frequency;
                  return {
                    value: m.id,
                    disabled: m.status === "archived",
                    label: `${m.name} ${m.version}${m.isDefault ? pick(" · Bawaan", " · Default") : ""}`,
                    meta: <StatusBadge status={m.status} size="sm" />,
                    description: (
                      <span className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-4">
                        <span>WAPE {formatPercent(m.metrics.wape)}</span>
                        <span>Bias {m.metrics.bias >= 0 ? "+" : "−"}{formatPercent(Math.abs(m.metrics.bias))}</span>
                        <span>{pick("Cakupan", "Coverage")} {formatPercent(m.metrics.coverage80, 0)}</span>
                        <span>{pick("Dilatih", "Trained")} {formatDate(m.lastTrainedAt)}</span>
                        {incompatible && m.status !== "archived" && (
                          <span className="col-span-full font-semibold text-warning-fg">
                            {m.frequency !== input.frequency ? pick(`Hanya mendukung perkiraan ${m.frequency === "weekly" ? "mingguan" : "harian"}.`, `Supports ${m.frequency} forecasts only.`) : pick(`Mendukung periode hingga ${m.horizonDays} hari.`, `Supports horizons up to ${m.horizonDays} days.`)}
                          </span>
                        )}
                      </span>
                    ),
                  };
                })}
              />
            )}
          </WizardPanel>
        )}

        {step === 4 && (
          <WizardPanel
            title={pick("Periksa Data", "Validate data")}
            description={pick("Pemeriksaan dijalankan pada cakupan, periode, dan model yang dipilih. Temuan yang menghambat harus diselesaikan sebelum dijalankan.", "Checks run against the selected scope, window and model. Blocking results must be resolved before running.")}
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(4)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            {validation.isPending ? (
              <p className="flex items-center gap-2 body-sm text-fg-secondary" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden /> {pick("Menjalankan pemeriksaan…", "Running validation checks…")}
              </p>
            ) : validation.isError ? (
              <ErrorState compact what={pick("Pemeriksaan tidak dapat dijalankan.", "Validation could not run.")} error={validation.error} onRetry={() => validation.refetch()} retryLabel={pick("Coba periksa lagi", "Retry validation")} />
            ) : (
              <>
                {blocking.length > 0 ? (
                  <InlineAlert tone="critical" title={pick(`${pluralize(blocking.length, "temuan")} menghambat dan harus diselesaikan sebelum dijalankan.`, `${pluralize(blocking.length, "blocking issue")} must be resolved before running.`)} className="mb-4">
                    {pick("Ubah cakupan, periode, rentang, atau model, atau selesaikan masalah datanya lebih dulu.", "Change the scope, period, horizon or model, or resolve the data issue first.")}
                  </InlineAlert>
                ) : (
                  <InlineAlert tone={warnings.length ? "warning" : "success"} title={warnings.length ? pick(`Siap dijalankan dengan ${pluralize(warnings.length, "peringatan")}.`, `Ready to run with ${pluralize(warnings.length, "warning")}.`) : pick("Semua pemeriksaan lolos.", "All checks passed.")} className="mb-4" />
                )}
                <ul className="divide-y divide-border-subtle rounded-lg border border-border">
                  {checks.map((c) => (
                    <CheckRow key={c.key} check={c} />
                  ))}
                </ul>
              </>
            )}
          </WizardPanel>
        )}

        {step === 5 && (
          <WizardPanel
            title={pick("Tinjau Perkiraan", "Review configuration")}
            description={pick("Periksa pengaturan sebelum dijalankan. Proses dapat dibatalkan selama masih berjalan.", "Check the configuration before starting. The run can be cancelled while it is processing.")}
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={start} loading={create.isPending} loadingText={pick("Menjalankan perkiraan", "Starting forecast run")} disabled={blocking.length > 0}>
                  <Play aria-hidden /> {pick("Jalankan Perkiraan", "Run forecast")}
                </Button>
              </>
            }
          >
            <ConsequenceSummary rows={summaryRows} />
          </WizardPanel>
        )}
      </WizardLayout>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title={pick("Jalankan perkiraan ini?", "Run this forecast?")}
          description={pick(`Proses ini akan membuat perkiraan untuk ${pluralize(scope.data?.skuCount ?? 0, "SKU")}.`, `This run will generate forecasts for ${pluralize(scope.data?.skuCount ?? 0, "SKU")}.`)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                {pick("Kembali ke pengaturan", "Back to configuration")}
              </Button>
              <Button variant="primary" loading={create.isPending} loadingText={pick("Menjalankan perkiraan", "Starting forecast run")} onClick={() => create.mutate(input)}>
                <Play aria-hidden /> {pick("Jalankan Perkiraan", "Run forecast")}
              </Button>
            </>
          }
        >
          <ConsequenceSummary
            rows={[
              { label: pick("SKU", "SKUs"), value: formatNumber(scope.data?.skuCount ?? 0), emphasis: true },
              { label: pick("Rentang historis", "Historical window"), value: formatDateRange(input.historicalStart, input.historicalEnd) },
              { label: pick("Rentang perkiraan", "Forecast horizon"), value: pick(`${input.horizonDays} hari`, `${input.horizonDays} days`) },
              { label: pick("Model", "Model"), value: selectedModel ? pick(`${selectedModel.name} ${selectedModel.version}`, `${selectedModel.name} ${selectedModel.version}`) : "—" },
              { label: pick("Peringatan", "Warnings"), value: warnings.length ? warnings.map((w) => w.detail).join(" ") : pick("Tidak ada", "None") },
              { label: pick("Yang terjadi berikutnya", "What happens next"), value: pick("Proses masuk antrean, diproses, lalu disimpan sebagai Selesai. Proses ini tidak menggantikan acuan perencanaan sampai diterbitkan.", "The run is queued, processed and saved as Completed. It does not replace the planning baseline until it is published.") },
            ]}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="caption">{label}</p>
      <p className="body-sm font-semibold text-fg tabular">{value}</p>
      {hint && <p className="caption break-words">{hint}</p>}
    </div>
  );
}

function CheckRow({ check }: { check: ValidationCheck }) {
  const icon =
    check.result === "pass" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : check.result === "warning" ? <AlertTriangle className="size-4 text-warning" aria-hidden /> : <AlertOctagon className="size-4 text-critical" aria-hidden />;
  const label = check.result === "pass" ? pick("Lolos", "Pass") : check.result === "warning" ? pick("Peringatan", "Warning") : pick("Menghambat", "Blocking");
  return (
    <li className="grid grid-cols-[1.25rem_minmax(8rem,12rem)_1fr_auto] items-start gap-3 px-4 py-3">
      <span className="mt-0.5">{icon}</span>
      <span className="body-sm font-semibold text-fg">{check.label}</span>
      <span className="body-sm text-fg-secondary">{check.detail}</span>
      <span className={cn("text-xs font-bold", check.result === "pass" ? "text-success-fg" : check.result === "warning" ? "text-warning-fg" : "text-critical-fg")}>{label}</span>
    </li>
  );
}
