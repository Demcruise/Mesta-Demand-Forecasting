import type { ForecastRun, RunStep, RunStepKey } from "@/types/domain";
import { pick, localized } from "@/lib/i18n/core";

export const RUN_STEPS: { key: RunStepKey; label: string }[] = localized([
  { key: "queued", label: "Menunggu" },
  { key: "loading", label: "Menyiapkan data" },
  { key: "validating", label: "Memeriksa data" },
  { key: "modelling", label: "Menjalankan model" },
  { key: "generating", label: "Membuat hasil" },
  { key: "writing", label: "Menyimpan hasil" },
], [
  { key: "queued", label: "Queued" },
  { key: "loading", label: "Loading data" },
  { key: "validating", label: "Validating data" },
  { key: "modelling", label: "Running model" },
  { key: "generating", label: "Generating forecast" },
  { key: "writing", label: "Writing results" },
]);

/** Relative duration of each step; scaled by run size. */
const STEP_WEIGHT: Record<RunStepKey, number> = {
  queued: 0.08,
  loading: 0.14,
  validating: 0.12,
  modelling: 0.38,
  generating: 0.2,
  writing: 0.08,
};

/** Total processing time for a run, in ms. Mock backend only. */
export function runDurationMs(skuCount: number, horizonDays: number) {
  const base = 18_000 + skuCount * 55 + horizonDays * 400;
  return Math.min(base, 6 * 60_000);
}

export function pendingSteps(): RunStep[] {
  return RUN_STEPS.map((s) => ({ ...s, status: "pending", startedAt: null, completedAt: null, detail: null }));
}

function stepDetail(key: RunStepKey, run: ForecastRun): string {
  switch (key) {
    case "queued":
      return "Waiting for a forecasting worker.";
    case "loading":
      return `Read ${run.scope.skuCount.toLocaleString("en-US")} SKUs × ${run.scope.locationCount} locations of daily demand.`;
    case "validating":
      return run.warnings.length > 0
        ? `${run.warnings.length} warning${run.warnings.length === 1 ? "" : "s"}; no blocking issues.`
        : "All validation checks passed.";
    case "modelling":
      return pick(`Model ${run.modelVersion} menghitung ${run.scope.skuCount.toLocaleString("id-ID")} seri.`, `Model ${run.modelVersion} scored ${run.scope.skuCount.toLocaleString("en-US")} series.`);
    case "generating":
      return `Generated ${run.horizonDays}-day forecasts with 80% prediction intervals.`;
    case "writing":
      return "Results written to the forecast store.";
  }
}

/**
 * Derives the step state of a queued/running run from elapsed time. This stands in
 * for backend job state: the UI never animates progress on its own (backlog §21).
 */
export function advanceRun(run: ForecastRun, now: number): ForecastRun {
  if (run.status !== "queued" && run.status !== "running") return run;
  if (!run.startedAt) return run;
  const start = new Date(run.startedAt).getTime();
  if (now < start) return run;
  const total = runDurationMs(run.scope.skuCount, run.horizonDays);
  let cursor = start;
  let finished = true;
  const steps: RunStep[] = RUN_STEPS.map((def) => {
    const dur = total * STEP_WEIGHT[def.key];
    const stepStart = cursor;
    const stepEnd = cursor + dur;
    cursor = stepEnd;
    if (now >= stepEnd) {
      return {
        ...def,
        status: "completed",
        startedAt: new Date(stepStart).toISOString(),
        completedAt: new Date(stepEnd).toISOString(),
        detail: stepDetail(def.key, run),
      };
    }
    finished = false;
    if (now >= stepStart) {
      return { ...def, status: "running", startedAt: new Date(stepStart).toISOString(), completedAt: null, detail: null };
    }
    return { ...def, status: "pending", startedAt: null, completedAt: null, detail: null };
  });
  if (finished) {
    return { ...run, status: "completed", steps, completedAt: new Date(cursor).toISOString() };
  }
  const queuedDone = steps[0]?.status === "completed";
  return { ...run, status: queuedDone ? "running" : "queued", steps };
}

/** Steps for a run that finished at `completedAt`, used when seeding history. */
export function completedSteps(run: ForecastRun): RunStep[] {
  if (!run.startedAt || !run.completedAt) return pendingSteps();
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.completedAt).getTime();
  const total = end - start;
  let cursor = start;
  return RUN_STEPS.map((def) => {
    const dur = total * STEP_WEIGHT[def.key];
    const s = cursor;
    cursor += dur;
    return {
      ...def,
      status: "completed" as const,
      startedAt: new Date(s).toISOString(),
      completedAt: new Date(cursor).toISOString(),
      detail: stepDetail(def.key, run),
    };
  });
}

/** Steps for a run that failed during `failedAt`. */
export function failedSteps(run: ForecastRun, failedAt: RunStepKey, detail: string): RunStep[] {
  const completed = completedSteps(run);
  let failed = false;
  return completed.map((s) => {
    if (failed) return { ...s, status: "skipped", startedAt: null, completedAt: null, detail: null };
    if (s.key === failedAt) {
      failed = true;
      return { ...s, status: "failed", completedAt: s.completedAt, detail };
    }
    return s;
  });
}

export function runProgress(run: ForecastRun) {
  const done = run.steps.filter((s) => s.status === "completed").length;
  return { done, total: run.steps.length, current: run.steps.find((s) => s.status === "running") ?? null };
}
