import { can, PermissionError, type Permission } from "@/lib/permissions";
import type { ListQuery, Page, Role } from "@/types/domain";
import { delay } from "@/lib/utils";

/**
 * Mock API transport. Every call goes through `request`, which adds realistic
 * latency and honours the demo controls (slow network, failing reads) so loading,
 * empty and error states can be exercised. Replace with real HTTP calls once the
 * backend contracts exist (backlog §62).
 */

export type ApiContext = {
  workspaceId: string;
  userId: string;
  role: Role;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "validation" | "conflict" | "unavailable" | "permission",
    public detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type DemoControls = {
  latency: "fast" | "normal" | "slow";
  failReads: boolean;
  failWrites: boolean;
};

const DEMO_KEY = "mdf.demo-controls";

export const demoControls: DemoControls = { latency: "normal", failReads: false, failWrites: false };

export function loadDemoControls() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DEMO_KEY) : null;
    if (raw) Object.assign(demoControls, JSON.parse(raw) as Partial<DemoControls>);
  } catch {
    // Storage unavailable: keep defaults.
  }
  return demoControls;
}

export function saveDemoControls(next: Partial<DemoControls>) {
  Object.assign(demoControls, next);
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(demoControls));
  } catch {
    // Non-critical per-viewer preference.
  }
}

function latency() {
  const base = demoControls.latency === "fast" ? 60 : demoControls.latency === "slow" ? 2200 : 320;
  return base + Math.random() * base * 0.6;
}

export async function read<T>(fn: () => T): Promise<T> {
  await delay(latency());
  if (demoControls.failReads) {
    throw new ApiError("The service did not respond.", "unavailable", "Demo control “Fail reads” is on. Turn it off in the user menu to recover.");
  }
  return fn();
}

export async function write<T>(ctx: ApiContext, permission: Permission | null, fn: () => T): Promise<T> {
  await delay(latency());
  if (permission && !can(ctx.role, permission)) throw new PermissionError(permission);
  if (demoControls.failWrites) {
    throw new ApiError("The change was not saved.", "unavailable", "Demo control “Fail writes” is on. Turn it off in the user menu to recover.");
  }
  return fn();
}

export function authorize(ctx: ApiContext, permission: Permission) {
  if (!can(ctx.role, permission)) throw new PermissionError(permission);
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.detail ? `${error.message} ${error.detail}` : error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error.";
}

/* ── List helpers ──────────────────────────────────────────────────── */

export type ListSpec<T> = {
  search?: (item: T) => string;
  sorters?: Record<string, (item: T) => string | number | null | undefined>;
  filters?: Record<string, (item: T, values: string[]) => boolean>;
  asOf?: string | null;
};

export function applyList<T>(items: readonly T[], query: ListQuery, spec: ListSpec<T>): Page<T> {
  let out = items as T[];
  const q = query.q?.trim().toLowerCase();
  if (q && spec.search) out = out.filter((i) => spec.search?.(i).toLowerCase().includes(q));
  if (query.filters && spec.filters) {
    for (const [key, values] of Object.entries(query.filters)) {
      const fn = spec.filters[key];
      if (fn && values.length > 0) out = out.filter((i) => fn(i, values));
    }
  }
  if (query.sort && spec.sorters?.[query.sort]) {
    const get = spec.sorters[query.sort] as (item: T) => string | number | null | undefined;
    const dir = query.dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }
  const pageSize = query.pageSize ?? 25;
  const total = out.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), maxPage);
  return {
    items: out.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    asOf: spec.asOf ?? null,
  };
}

/** Returns every matching item (used by export and bulk selection "select all matching"). */
export function applyAll<T>(items: readonly T[], query: ListQuery, spec: ListSpec<T>): T[] {
  return applyList(items, { ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER }, spec).items;
}
