import type { DataQualityIssue, DataSource, DemandRecord, ListQuery, Product } from "@/types/domain";
import { audit, getDb, nextId, paramsFor } from "@/lib/mock/db";
import { actorName } from "@/lib/mock/directory";
import { expectedAt, HISTORY_DAYS } from "@/lib/mock/series";
import { createRng, hashString } from "@/lib/mock/random";
import { DAY_MS, iso, isoDate, MINUTE_MS } from "@/lib/mock/time";
import { applyList, ApiError, read, write, type ApiContext, type ListSpec } from "./client";

/* ── Products ──────────────────────────────────────────────────────── */

const productSpec: ListSpec<Product> = {
  search: (p) => `${p.name} ${p.sku} ${p.brand} ${p.category} ${p.subcategory}`,
  sorters: {
    name: (p) => p.name,
    sku: (p) => p.sku,
    category: (p) => p.category,
    brand: (p) => p.brand,
    lifecycle: (p) => p.lifecycle,
    launchedAt: (p) => p.launchedAt,
  },
  filters: {
    category: (p, v) => v.includes(p.category),
    lifecycle: (p, v) => v.includes(p.lifecycle),
    brand: (p, v) => v.includes(p.brand),
  },
};

export function listProducts(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const src = db.sources.find((s) => s.id === "src_dwh");
    return applyList(db.products, { sort: "name", dir: "asc", ...query }, { ...productSpec, asOf: src?.lastSuccessAt ?? null });
  });
}

export function catalogueFacets(ctx: ApiContext) {
  const db = getDb(ctx.workspaceId);
  const brands = Array.from(new Set(db.products.map((p) => p.brand))).sort();
  return { brands, locations: db.locations };
}

/* ── Historical demand ─────────────────────────────────────────────── */

/**
 * Historical demand at SKU × day grain (all locations, or one location). Records are
 * generated on demand for the requested page, so the full history is never
 * materialised. Sorting is by date only; this mirrors a server-side paged query.
 */
export function listDemand(
  ctx: ApiContext,
  query: ListQuery & { from?: string; to?: string; locationId?: string },
) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    let products = db.products;
    const q = query.q?.trim().toLowerCase();
    if (q) products = products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q));
    const cats = query.filters?.category ?? [];
    if (cats.length) products = products.filter((p) => cats.includes(p.category));
    const today = db.today;
    const minTs = today - HISTORY_DAYS * DAY_MS;
    const from = Math.max(minTs, query.from ? new Date(query.from).setHours(0, 0, 0, 0) : today - 28 * DAY_MS);
    const to = Math.min(today - DAY_MS, query.to ? new Date(query.to).setHours(0, 0, 0, 0) : today - DAY_MS);
    const days = to >= from ? Math.round((to - from) / DAY_MS) + 1 : 0;
    const location = query.locationId ? db.locations.find((l) => l.id === query.locationId) : undefined;
    const locationShare = location ? 1 / db.locations.length : 1;
    const qualityFilter = query.filters?.quality ?? [];
    const pageSize = query.pageSize ?? 25;
    const asc = query.dir === "asc";
    const total = days * products.length;
    const page = Math.min(Math.max(1, query.page ?? 1), Math.max(1, Math.ceil(total / pageSize)));
    const dq = db.dqIssues.filter((i) => i.status !== "resolved");
    const blocking = new Set(dq.filter((i) => i.severity === "blocking").flatMap((i) => i.sampleProductIds));
    const warning = new Set(dq.filter((i) => i.severity === "warning").flatMap((i) => i.sampleProductIds));
    const makeRecord = (index: number): DemandRecord | null => {
      const dayIdx = Math.floor(index / products.length);
      const product = products[index % products.length];
      if (!product) return null;
      const ts = asc ? from + dayIdx * DAY_MS : to - dayIdx * DAY_MS;
      const t = Math.round((ts - today) / DAY_MS);
      const p = paramsFor(db, product.id);
      const rng = createRng(hashString(`${product.id}:${ts}:${location?.id ?? "all"}`));
      const e = expectedAt(p, t, ts) * locationShare;
      const units = Math.max(0, Math.round(e * Math.exp(p.noise * rng.normal() - (p.noise * p.noise) / 2)));
      const recent = t >= -9 && t <= -3;
      const quality: DemandRecord["quality"] = blocking.has(product.id) && recent ? "blocking" : warning.has(product.id) && t >= -7 ? "warning" : "ok";
      return {
        id: `${product.id}:${isoDate(ts)}:${location?.id ?? "all"}`,
        date: isoDate(ts),
        productId: product.id,
        locationId: location?.id ?? "all",
        units: quality === "blocking" ? 0 : units,
        sourceId: rng.chance(0.86) ? "src_pos" : "src_erp",
        quality,
        updatedAt: iso(ts + DAY_MS + 4 * 3_600_000 + rng.int(0, 90) * MINUTE_MS),
      };
    };
    let items: DemandRecord[] = [];
    let filteredTotal = total;
    if (qualityFilter.length > 0) {
      // Quality filter requires a scan; bounded to keep the mock responsive.
      const all: DemandRecord[] = [];
      for (let i = 0; i < total && all.length < 5000; i++) {
        const r = makeRecord(i);
        if (r && qualityFilter.includes(r.quality)) all.push(r);
      }
      filteredTotal = all.length;
      items = all.slice((page - 1) * pageSize, page * pageSize);
    } else {
      for (let i = (page - 1) * pageSize; i < Math.min(total, page * pageSize); i++) {
        const r = makeRecord(i);
        if (r) items.push(r);
      }
    }
    const pos = db.sources.find((s) => s.id === "src_pos");
    return {
      page: { items, total: filteredTotal, page, pageSize, asOf: pos?.lastSuccessAt ?? null },
      window: { from: isoDate(from), to: isoDate(to), earliest: isoDate(minTs) },
      products: new Map(products.map((pr) => [pr.id, pr])),
      location: location ?? null,
    };
  });
}

/* ── Data sources ──────────────────────────────────────────────────── */

export function listSources(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    return db.sources.map((s) => ({
      ...s,
      openIssues: db.dqIssues.filter((i) => i.sourceId === s.id && i.status !== "resolved" && i.status !== "dismissed").length,
    }));
  });
}

export function getSource(ctx: ApiContext, id: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const source = db.sources.find((s) => s.id === id);
    if (!source) throw new ApiError("This data source does not exist in the current workspace.", "not_found");
    const issues = db.dqIssues.filter((i) => i.sourceId === id);
    const activity = db.audit.filter((e) => e.entityId === id).slice(0, 10);
    return { source, issues, activity };
  });
}

function mutateSource(ctx: ApiContext, id: string, fn: (s: DataSource) => DataSource, action: string) {
  const db = getDb(ctx.workspaceId);
  const idx = db.sources.findIndex((s) => s.id === id);
  const source = db.sources[idx];
  if (!source) throw new ApiError("Data source not found.", "not_found");
  const next = fn(source);
  db.sources[idx] = next;
  audit(db, {
    actorId: ctx.userId,
    action: "integration_update",
    entityType: "data_source",
    entityId: id,
    entityLabel: source.name,
    previousState: source.status,
    newState: next.status,
    reason: action,
    source: "web",
  });
  return next;
}

export function testConnection(ctx: ApiContext, id: string) {
  return write(ctx, "integration.manage", () => {
    const db = getDb(ctx.workspaceId);
    const s = db.sources.find((x) => x.id === id);
    if (!s) throw new ApiError("Data source not found.", "not_found");
    if (s.status === "disconnected") return { ok: false, message: "The source is disconnected. Connect it before testing." };
    if (s.id === "src_promo" && s.status === "failed") {
      return { ok: false, message: "Authentication failed (HTTP 401). Rotate the service credential with the source owner, then test again." };
    }
    return { ok: true, message: `Connected in ${120 + Math.round(Math.random() * 180)} ms. Schema matches the configured mapping.` };
  });
}

export function syncNow(ctx: ApiContext, id: string) {
  return write(ctx, "integration.manage", () =>
    mutateSource(
      ctx,
      id,
      (s) => {
        if (s.status === "disconnected") throw new ApiError("Connect the source before syncing.", "conflict");
        if (s.id === "src_promo" && s.status === "failed") {
          return { ...s, lastSyncAt: iso(Date.now()), lastFailureAt: iso(Date.now()), lastError: "Authentication to the promotions API failed (HTTP 401). The service credential may have expired." };
        }
        return { ...s, status: "connected", lastSyncAt: iso(Date.now()), lastSuccessAt: iso(Date.now()), lastError: null };
      },
      "Manual sync requested",
    ),
  );
}

export function setSourceConnection(ctx: ApiContext, id: string, connected: boolean) {
  return write(ctx, "integration.manage", () =>
    mutateSource(
      ctx,
      id,
      (s) => (connected ? { ...s, status: "connected", lastSyncAt: iso(Date.now()), lastSuccessAt: iso(Date.now()), lastError: null } : { ...s, status: "disconnected" }),
      connected ? "Connected" : "Disconnected",
    ),
  );
}

export function updateSourceSchedule(ctx: ApiContext, id: string, schedule: string) {
  return write(ctx, "integration.manage", () => mutateSource(ctx, id, (s) => ({ ...s, schedule }), `Schedule changed to “${schedule}”`));
}

/* ── Data quality ──────────────────────────────────────────────────── */

const dqSpec: ListSpec<DataQualityIssue> = {
  search: (i) => `${i.id} ${i.title} ${i.description}`,
  sorters: {
    severity: (i) => ({ blocking: 0, warning: 1, info: 2 })[i.severity],
    detectedAt: (i) => i.detectedAt,
    affectedSkus: (i) => i.affectedSkus,
    status: (i) => i.status,
  },
  filters: {
    severity: (i, v) => v.includes(i.severity),
    status: (i, v) => v.includes(i.status),
    source: (i, v) => v.includes(i.sourceId),
    type: (i, v) => v.includes(i.type),
  },
};

export function listDataQuality(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const open = db.dqIssues.filter((i) => i.status === "open" || i.status === "investigating");
    const coverage = 1 - open.filter((i) => i.severity !== "info").reduce((s, i) => s + i.affectedSkus, 0) / Math.max(1, db.products.length * 4);
    return {
      page: applyList(db.dqIssues, { sort: "severity", dir: "asc", ...query }, dqSpec),
      summary: {
        blocking: open.filter((i) => i.severity === "blocking").length,
        warnings: open.filter((i) => i.severity === "warning").length,
        info: open.filter((i) => i.severity === "info").length,
        coverage: Math.max(0, Math.min(1, coverage)),
        skus: db.products.length,
      },
      sources: db.sources,
    };
  });
}

export function getDataQualityIssue(ctx: ApiContext, id: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const issue = db.dqIssues.find((i) => i.id === id);
    if (!issue) throw new ApiError("This data quality issue was not found.", "not_found");
    return {
      issue,
      source: db.sources.find((s) => s.id === issue.sourceId) ?? null,
      products: issue.sampleProductIds.map((pid) => db.productById.get(pid)).filter((p): p is Product => !!p),
      activity: db.audit.filter((e) => e.entityId === id),
    };
  });
}

export function updateDataQualityIssue(
  ctx: ApiContext,
  id: string,
  change: { status?: DataQualityIssue["status"]; ownerId?: string | null; note?: string },
) {
  return write(ctx, "data.manage", () => {
    const db = getDb(ctx.workspaceId);
    const issue = db.dqIssues.find((i) => i.id === id);
    if (!issue) throw new ApiError("This data quality issue was not found.", "not_found");
    const prev = issue.status;
    if (change.status) issue.status = change.status;
    if (change.ownerId !== undefined) issue.ownerId = change.ownerId;
    audit(db, {
      actorId: ctx.userId,
      action: "update_exception",
      entityType: "data_source",
      entityId: id,
      entityLabel: issue.title,
      previousState: prev,
      newState: issue.status,
      reason: change.note || (change.ownerId !== undefined ? `Assigned to ${actorName(change.ownerId)}` : null),
      source: "web",
    });
    return issue;
  });
}

export function retryDataCheck(ctx: ApiContext, id: string) {
  return write(ctx, "data.manage", () => {
    const db = getDb(ctx.workspaceId);
    const issue = db.dqIssues.find((i) => i.id === id);
    if (!issue) throw new ApiError("This data quality issue was not found.", "not_found");
    audit(db, {
      actorId: ctx.userId,
      action: "update_exception",
      entityType: "data_source",
      entityId: id,
      entityLabel: issue.title,
      previousState: issue.status,
      newState: issue.status,
      reason: "Re-ran the data check. The issue is still present.",
      source: "web",
    });
    return { stillPresent: true, checkedAt: iso(Date.now()), id: nextId(db, "chk") };
  });
}
