"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import type { ListQuery, SortDirection } from "@/types/domain";
import { track } from "@/lib/telemetry";

/**
 * List state in the URL (backlog §63–64): search, filters, sort, page and the selected
 * entity are deep-linkable, and returning from a detail page restores them.
 */

type Options = {
  filterKeys: readonly string[];
  defaultSort?: string;
  defaultDir?: SortDirection;
  defaultPageSize?: number;
};

const RESERVED = new Set(["q", "page", "size", "sort", "dir"]);

export function useListState({ filterKeys, defaultSort, defaultDir = "desc", defaultPageSize = 25 }: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const query = React.useMemo<ListQuery>(() => {
    const filters: Record<string, string[]> = {};
    for (const key of filterKeys) {
      const raw = params.get(key);
      if (raw) filters[key] = raw.split(",").filter(Boolean);
    }
    return {
      q: params.get("q") ?? undefined,
      page: Number(params.get("page")) || 1,
      pageSize: Number(params.get("size")) || defaultPageSize,
      sort: params.get("sort") ?? defaultSort,
      dir: (params.get("dir") as SortDirection | null) ?? defaultDir,
      filters,
    };
  }, [params, filterKeys, defaultSort, defaultDir, defaultPageSize]);

  const update = React.useCallback(
    (mutate: (p: URLSearchParams) => void, opts: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      if (opts.resetPage) next.delete("page");
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const setSearch = React.useCallback(
    (q: string) =>
      update(
        (p) => {
          if (q) p.set("q", q);
          else p.delete("q");
        },
        { resetPage: true },
      ),
    [update],
  );

  const setFilter = React.useCallback(
    (key: string, values: string[]) => {
      track("filter_used", { key, count: values.length });
      update(
        (p) => {
          if (values.length) p.set(key, values.join(","));
          else p.delete(key);
        },
        { resetPage: true },
      );
    },
    [update],
  );

  const clearFilters = React.useCallback(
    () =>
      update(
        (p) => {
          for (const k of filterKeys) p.delete(k);
          p.delete("q");
        },
        { resetPage: true },
      ),
    [update, filterKeys],
  );

  const setSort = React.useCallback(
    (sort: string, dir: SortDirection) =>
      update((p) => {
        p.set("sort", sort);
        p.set("dir", dir);
      }),
    [update],
  );

  const setPage = React.useCallback((page: number) => update((p) => (page > 1 ? p.set("page", String(page)) : p.delete("page"))), [update]);
  const setPageSize = React.useCallback(
    (size: number) =>
      update(
        (p) => {
          p.set("size", String(size));
        },
        { resetPage: true },
      ),
    [update],
  );

  /** Non-list params such as the selected entity (`id`) or a tab. */
  const getParam = React.useCallback((key: string) => params.get(key), [params]);
  const setParam = React.useCallback(
    (key: string, value: string | null) =>
      update((p) => {
        if (RESERVED.has(key)) return;
        if (value) p.set(key, value);
        else p.delete(key);
      }),
    [update],
  );

  const activeFilterCount = Object.values(query.filters ?? {}).reduce((n, v) => n + (v.length > 0 ? 1 : 0), 0) + (query.q ? 1 : 0);

  return { query, setSearch, setFilter, clearFilters, setSort, setPage, setPageSize, getParam, setParam, activeFilterCount };
}

export type ListState = ReturnType<typeof useListState>;
