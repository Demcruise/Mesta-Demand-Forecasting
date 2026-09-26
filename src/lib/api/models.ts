import type { Backtest, Frequency, ListQuery } from "@/types/domain";
import { buildBacktestResult } from "@/lib/mock/backtests";
import { audit, getDb, nextId } from "@/lib/mock/db";
import { addDays, iso, isoDate } from "@/lib/mock/time";
import { applyList, ApiError, read, write, type ApiContext } from "./client";
import { pick } from "@/lib/i18n/core";

export function listModels(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    return applyList(
      db.models,
      { sort: "status", dir: "asc", ...query },
      {
        search: (m) => `${m.name} ${m.version} ${m.family}`,
        sorters: {
          name: (m) => `${m.name} ${m.version}`,
          status: (m) => ({ production: 0, candidate: 1, training: 2, archived: 3 })[m.status],
          lastTrainedAt: (m) => m.lastTrainedAt,
          wape: (m) => m.metrics.wape,
          bias: (m) => Math.abs(m.metrics.bias),
        },
        filters: { status: (m, v) => v.includes(m.status) },
      },
    );
  });
}

export function getModel(ctx: ApiContext, id: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const model = db.models.find((m) => m.id === id);
    if (!model) throw new ApiError(pick("Model ini tidak ada di ruang kerja ini.", "This model does not exist in the current workspace."), "not_found");
    return {
      model,
      backtests: db.backtests.filter((b) => b.modelId === id),
      runs: db.runs.filter((r) => r.modelId === id).slice(0, 8),
      audit: db.audit.filter((e) => e.entityId === id).slice(0, 10),
      pendingApproval: db.approvals.find((a) => a.type === "model_default" && a.objectId === id && a.status === "pending") ?? null,
    };
  });
}

export function listModelOptions(ctx: ApiContext) {
  return read(() => getDb(ctx.workspaceId).models);
}

/** Requests that a model become the default. Model promotion always goes through approval. */
export function requestDefaultModel(ctx: ApiContext, id: string, rationale: string) {
  return write(ctx, "model.manage", () => {
    const db = getDb(ctx.workspaceId);
    const model = db.models.find((m) => m.id === id);
    if (!model) throw new ApiError(pick("Model tidak ditemukan.", "Model not found."), "not_found");
    if (model.isDefault) throw new ApiError(pick("Model ini sudah menjadi bawaan.", "This model is already the default."), "conflict");
    if (model.status === "archived") throw new ApiError(pick("Model yang diarsipkan tidak dapat menjadi bawaan.", "Archived models cannot become the default."), "conflict");
    const existing = db.approvals.find((a) => a.type === "model_default" && a.objectId === id && a.status === "pending");
    if (existing) throw new ApiError(pick("Permintaan menjadikan model ini bawaan sudah menunggu.", "A request to make this model the default is already pending."), "conflict");
    const current = db.models.find((m) => m.isDefault);
    const approvalId = nextId(db, "apr");
    const now = iso(Date.now());
    db.approvals.unshift({
      id: approvalId,
      type: "model_default",
      objectId: id,
      objectLabel: pick(`Jadikan ${model.name} ${model.version} model bawaan`, `Make ${model.name} ${model.version} the default model`),
      requestedBy: ctx.userId,
      requestedAt: now,
      dueAt: iso(Date.now() + 3 * 86_400_000),
      status: "pending",
      impact: {
        units: 0,
        percent: current ? model.metrics.wape - current.metrics.wape : 0,
        skuCount: db.products.length,
        summary: current ? pick(`WAPE ${(current.metrics.wape * 100).toFixed(1)}% → ${(model.metrics.wape * 100).toFixed(1)}% pada evaluasi terakhir.`, `WAPE ${(current.metrics.wape * 100).toFixed(1)}% → ${(model.metrics.wape * 100).toFixed(1)}% in the latest evaluation.`) : "",
      },
      changeSet: [{ field: pick("Model bawaan", "Default model"), from: current ? `${current.name} ${current.version}` : pick("Tidak ada", "None"), to: pick(`${model.name} ${model.version}`, `${model.name} ${model.version}`) }],
      evidence: db.backtests.filter((b) => b.modelId === id).map((b) => pick(`Uji model ${b.id} (${b.windowStart} – ${b.windowEnd}).`, `Backtest ${b.id} (${b.windowStart} – ${b.windowEnd}).`)),
      assumptions: [rationale],
      policy: { name: pick("Promosi model", "Model promotion"), rule: pick("Mengubah model bawaan memerlukan persetujuan Manajer.", "Changing the default model needs Manager approval."), requiredRole: "manager" },
      afterApproval: pick(`Proses perkiraan baru memakai ${model.name} ${model.version} sebagai bawaan. Proses yang ada tidak berubah.`, `New forecast runs use ${model.name} ${model.version} by default. Existing runs are unchanged.`),
      history: [{ id: `${approvalId}-h1`, at: now, actorId: ctx.userId, text: pick("Mengajukan promosi model.", "Requested model promotion.") }],
    });
    audit(db, { actorId: ctx.userId, action: "set_default_model", entityType: "model", entityId: id, entityLabel: pick(`${model.name} ${model.version}`, `${model.name} ${model.version}`), previousState: "not default", newState: "approval requested", reason: rationale, source: "web" });
    return approvalId;
  });
}

export function archiveModel(ctx: ApiContext, id: string) {
  return write(ctx, "model.manage", () => {
    const db = getDb(ctx.workspaceId);
    const model = db.models.find((m) => m.id === id);
    if (!model) throw new ApiError(pick("Model tidak ditemukan.", "Model not found."), "not_found");
    if (model.isDefault) throw new ApiError(pick("Model bawaan tidak dapat diarsipkan.", "The default model cannot be archived."), "conflict", pick("Jadikan model lain bawaan terlebih dahulu.", "Make another model the default first."));
    const prev = model.status;
    model.status = "archived";
    audit(db, { actorId: ctx.userId, action: "set_default_model", entityType: "model", entityId: id, entityLabel: pick(`${model.name} ${model.version}`, `${model.name} ${model.version}`), previousState: prev, newState: "archived", reason: null, source: "web" });
    return model;
  });
}

/* ── Backtests ─────────────────────────────────────────────────────── */

export function listBacktests(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const now = Date.now();
    for (const b of db.backtests) {
      if ((b.status === "queued" || b.status === "running") && now - new Date(b.createdAt).getTime() > 6000) {
        const windowDays = Math.round((new Date(b.windowEnd).getTime() - new Date(b.windowStart).getTime()) / 86_400_000) + 1;
        Object.assign(b, { status: "completed" }, buildBacktestResult(db, b.modelId, windowDays, b.frequency));
      } else if (b.status === "queued" && now - new Date(b.createdAt).getTime() > 1500) {
        b.status = "running";
      }
    }
    return db.backtests;
  });
}

export function runBacktest(ctx: ApiContext, input: { modelId: string; windowDays: number; frequency: Frequency }) {
  return write(ctx, "backtest.run", () => {
    const db = getDb(ctx.workspaceId);
    const model = db.models.find((m) => m.id === input.modelId);
    if (!model) throw new ApiError(pick("Pilih model.", "Select a model."), "validation");
    if (input.windowDays < 28) throw new ApiError(pick("Periode evaluasi minimal 28 hari.", "The evaluation window must be at least 28 days."), "validation");
    if (input.windowDays > 180) throw new ApiError(pick("Periode evaluasi tidak boleh melebihi 182 hari riwayat yang dimuat.", "The evaluation window cannot exceed the 182 days of loaded history."), "validation");
    const count = db.backtests.length;
    const bt: Backtest = {
      id: `BT-${String(413 + count).padStart(4, "0")}`,
      modelId: model.id,
      modelVersion: model.version,
      windowStart: isoDate(addDays(db.today, -input.windowDays)),
      windowEnd: isoDate(addDays(db.today, -1)),
      frequency: input.frequency,
      status: "queued",
      createdAt: iso(Date.now()),
      createdBy: ctx.userId,
      metrics: null,
      segments: [],
      points: [],
      errorBuckets: [],
    };
    db.backtests.unshift(bt);
    audit(db, { actorId: ctx.userId, action: "run_backtest", entityType: "backtest", entityId: bt.id, entityLabel: pick(`${model.name} ${model.version}`, `${model.name} ${model.version}`), previousState: null, newState: "queued", reason: pick(`periode ${input.windowDays} hari, ${input.frequency === "weekly" ? "mingguan" : "harian"}`, `${input.windowDays}-day window, ${input.frequency}`), source: "web" });
    return bt;
  });
}

/** Performance view data: metric trend per model over recent weeks. */
export function getModelPerformance(ctx: ApiContext, modelIds: string[]) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const models = db.models.filter((m) => modelIds.includes(m.id));
    const weeks = 12;
    const series = Array.from({ length: weeks }, (_, i) => {
      const weekStart = isoDate(addDays(db.today, -(weeks - i) * 7));
      const row: Record<string, string | number> = { week: weekStart };
      for (const m of models) {
        const seed = (m.id.charCodeAt(4) + i * 13) % 17;
        row[`${m.id}:wape`] = Math.max(0.05, m.metrics.wape * (1 + ((seed - 8) / 8) * 0.12));
        row[`${m.id}:bias`] = m.metrics.bias + ((seed - 8) / 8) * 0.015 + (m.id === "mdl_gbm_24" && i > 8 ? 0.012 : 0);
      }
      return row;
    });
    const latestBacktest = (id: string) => db.backtests.find((b) => b.modelId === id && b.status === "completed") ?? null;
    return { models, series, backtests: Object.fromEntries(models.map((m) => [m.id, latestBacktest(m.id)])) };
  });
}
