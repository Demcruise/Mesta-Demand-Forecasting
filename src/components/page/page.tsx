import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Page composition (Master Prompt §10):
 *   Page header → context/scope → needs attention → primary surface → analysis → supporting → activity
 */

export function PageContainer({ children, className, width = "default" }: { children: React.ReactNode; className?: string; width?: "default" | "narrow" | "full" }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",
        width === "default" && "max-w-[var(--content-max)]",
        width === "narrow" && "max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Primary action last (right-most). One primary per page. */
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 metadata">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1 max-w-3xl body text-fg-secondary">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section className={cn("flex flex-col gap-3", className)} aria-labelledby={headingId} id={id}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="section-title">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 body-sm text-fg-secondary">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Panel (card anatomy, Master Prompt §19): header → description → content → footer.
 * In grids, panels stretch to equal height and footers align to the bottom.
 */
export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  flush,
  as: As = "section",
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Remove body padding (tables, lists). */
  flush?: boolean;
  as?: "section" | "div" | "article";
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <As className={cn("flex h-full min-w-0 flex-col rounded-lg border border-border bg-surface", className)} aria-labelledby={headingId} id={id}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h3 id={headingId} className="card-title">
                {title}
              </h3>
            )}
            {description && <p className="mt-0.5 caption">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cn("min-h-0 flex-1", !flush && "p-4", bodyClassName)}>{children}</div>
      {footer && <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle px-4 py-2.5">{footer}</div>}
    </As>
  );
}

/** Definition list for metadata: label column + value column on a shared grid. */
export function DescriptionList({
  items,
  columns = 1,
  className,
}: {
  items: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-0.5">
          <dt className="caption">{item.label}</dt>
          <dd className="min-w-0 body-sm font-semibold text-fg">{item.value}</dd>
          {item.hint && <dd className="caption">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function MetaItem({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-fg-secondary [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-tertiary">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
