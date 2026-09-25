"use client";

import { Check, ChevronDown, ListFilter, Search, X } from "lucide-react";
import * as React from "react";
import type { ListState } from "@/hooks/use-list-state";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";

/**
 * FilterBar (FILTER-001):
 *   [Search] [primary facet ▾] [primary facet ▾] [Filters (n)] [Sort ▾]
 *   Active: [Category: Beverages ×] [Status: Open ×]  Clear all
 * Primary facets are visible; the rest are progressive disclosure inside "Filters".
 */

export type Facet = {
  key: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
  /** Shown inline in the toolbar; otherwise inside the Filters popover. */
  primary?: boolean;
};

export type SortOption = { value: string; label: string; dir: "asc" | "desc" };

export function FilterBar({
  state,
  facets,
  searchPlaceholder = "Search",
  sortOptions,
  children,
  className,
}: {
  state: ListState;
  facets: Facet[];
  searchPlaceholder?: string;
  sortOptions?: SortOption[];
  /** Extra controls (e.g. date range) placed after search. */
  children?: React.ReactNode;
  className?: string;
}) {
  const { query, setSearch, setFilter, clearFilters, setSort } = state;
  const [text, setText] = React.useState(query.q ?? "");
  React.useEffect(() => setText(query.q ?? ""), [query.q]);
  React.useEffect(() => {
    if ((query.q ?? "") === text) return;
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const primary = facets.filter((f) => f.primary);
  const advanced = facets.filter((f) => !f.primary);
  const advancedActive = advanced.reduce((n, f) => n + (query.filters?.[f.key]?.length ? 1 : 0), 0);
  const chips = facets.flatMap((f) =>
    (query.filters?.[f.key] ?? []).map((v) => ({ facet: f, value: v, label: f.options.find((o) => o.value === v)?.label ?? v })),
  );
  const sortValue = sortOptions?.find((o) => o.value === `${query.sort}:${query.dir}`)?.value ?? sortOptions?.find((o) => o.value.startsWith(`${query.sort}:`))?.value;

  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-2", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative w-full min-w-0 sm:w-64">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(text.trim());
              if (e.key === "Escape" && text) {
                e.stopPropagation();
                setText("");
                setSearch("");
              }
            }}
            placeholder={searchPlaceholder}
            className="h-[var(--control-h-sm)] w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-[0.8125rem] text-fg placeholder:text-fg-tertiary hover:border-fg-tertiary focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/40 [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        {children}
        {primary.map((f) => (
          <FacetMenu key={f.key} facet={f} selected={query.filters?.[f.key] ?? []} onChange={(v) => setFilter(f.key, v)} />
        ))}
        {advanced.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary" aria-label={advancedActive ? `More filters, ${advancedActive} active` : "More filters"}>
                <ListFilter aria-hidden />
                Filters
                {advancedActive > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold leading-4 text-primary-fg">{advancedActive}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0">
              <div className="max-h-[60vh] overflow-y-auto p-3">
                {advanced.map((f, i) => (
                  <fieldset key={f.key} className={cn(i > 0 && "mt-4")}>
                    <legend className="mb-1.5 metadata">{f.label}</legend>
                    <OptionList facet={f} selected={query.filters?.[f.key] ?? []} onChange={(v) => setFilter(f.key, v)} />
                  </fieldset>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {sortOptions && (
          <Select
            size="sm"
            className="w-auto min-w-44"
            aria-label="Sort"
            prefix="Sort:"
            value={sortValue}
            onValueChange={(v) => {
              const o = sortOptions.find((x) => x.value === v);
              if (o) setSort(o.value.split(":")[0] as string, o.dir);
            }}
            options={sortOptions.map((o) => ({ value: o.value, label: o.label }))}
          />
        )}
      </div>
      {(chips.length > 0 || query.q) && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {query.q && (
            <Chip label={`Search: “${query.q}”`} onRemove={() => { setText(""); setSearch(""); }} />
          )}
          {chips.map((c) => (
            <Chip
              key={`${c.facet.key}:${c.value}`}
              label={`${c.facet.label}: ${c.label}`}
              onRemove={() => setFilter(c.facet.key, (query.filters?.[c.facet.key] ?? []).filter((v) => v !== c.value))}
            />
          ))}
          <Button size="sm" variant="link" className="ml-1 h-6 text-xs" onClick={() => { setText(""); clearFilters(); }}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 max-w-72 items-center gap-1 rounded-sm border border-border bg-subtle pl-2 pr-0.5 text-xs font-semibold text-fg-secondary">
      <span className="truncate">{label}</span>
      <button type="button" onClick={onRemove} className="inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-fg-tertiary hover:bg-hover hover:text-fg" aria-label={`Remove filter ${label}`}>
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

function FacetMenu({ facet, selected, onChange }: { facet: Facet; selected: string[]; onChange: (v: string[]) => void }) {
  const summary = selected.length === 0 ? null : selected.length === 1 ? (facet.options.find((o) => o.value === selected[0])?.label ?? selected[0]) : `${selected.length} selected`;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-[var(--control-h-sm)] max-w-60 items-center gap-2 rounded-md border bg-surface pl-3 pr-3 text-[0.8125rem] font-semibold transition-colors hover:border-fg-tertiary focus-visible:outline-2 focus-visible:outline-focus",
          selected.length ? "border-primary/50 text-fg" : "border-border-strong text-fg-secondary",
        )}
        aria-label={`${facet.label}${summary ? `: ${summary}` : ""}`}
      >
        <span className="truncate">
          {facet.label}
          {summary && <span className="font-medium text-fg-secondary">: {summary}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <OptionList facet={facet} selected={selected} onChange={onChange} />
        {selected.length > 0 && (
          <div className="mt-1 border-t border-border pt-1">
            <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => onChange([])}>
              Clear {facet.label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function OptionList({ facet, selected, onChange }: { facet: Facet; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = React.useState("");
  const options = facet.options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col">
      {facet.options.length > 8 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${facet.label.toLowerCase()}`}
          aria-label={`Search ${facet.label.toLowerCase()}`}
          className="mb-1.5 h-8 rounded-md border border-border bg-surface px-2 text-[0.8125rem] outline-none focus-visible:border-focus"
        />
      )}
      <ul role="listbox" aria-multiselectable aria-label={facet.label} className="max-h-64 overflow-y-auto">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <li key={o.value} role="option" aria-selected={on}>
              <button
                type="button"
                onClick={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-[0.8125rem] hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
              >
                <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-xs border", on ? "border-primary bg-primary text-primary-fg" : "border-border-strong")}>
                  {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
                </span>
                <span className="flex-1 truncate">{o.label}</span>
                {o.count !== undefined && <span className="text-xs tabular text-fg-tertiary">{o.count}</span>}
              </button>
            </li>
          );
        })}
        {options.length === 0 && <li className="px-2 py-3 caption">No options match.</li>}
      </ul>
    </div>
  );
}

/** Date range with presets (DS-004 DateRangePicker). */
export function DateRangeFilter({
  from,
  to,
  onChange,
  min,
  max,
  presets = [7, 28, 91],
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  presets?: number[];
}) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);
  React.useEffect(() => {
    setF(from);
    setT(to);
  }, [from, to, open]);
  const fmt = (d: string) => formatShortDate(d);
  const invalid = !f || !t || f > t;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-[var(--control-h-sm)] items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-[0.8125rem] font-semibold text-fg hover:border-fg-tertiary focus-visible:outline-2 focus-visible:outline-focus" aria-label={`Date range: ${fmt(from)} to ${fmt(to)}`}>
        <span className="tabular">
          {fmt(from)} – {fmt(to)}
        </span>
        <ChevronDown className="size-4 text-fg-tertiary" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((d) => (
            <Button
              key={d}
              size="sm"
              variant="secondary"
              onClick={() => {
                const end = max ? new Date(max) : new Date();
                const start = new Date(end);
                start.setDate(start.getDate() - (d - 1));
                const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
                const s = min && iso(start) < min ? min : iso(start);
                onChange(s, iso(end));
                setOpen(false);
              }}
            >
              Last {d} days
            </Button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="label">From</span>
            <input type="date" value={f} min={min} max={t || max} onChange={(e) => setF(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-[0.8125rem] tabular" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">To</span>
            <input type="date" value={t} min={f || min} max={max} onChange={(e) => setT(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-[0.8125rem] tabular" />
          </label>
        </div>
        {invalid && <p className="mt-2 text-xs font-medium text-critical-fg">The start date must be on or before the end date.</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={invalid}
            onClick={() => {
              onChange(f, t);
              setOpen(false);
            }}
          >
            Apply date range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
