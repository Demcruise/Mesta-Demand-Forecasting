"use client";

import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { getForecastDetail } from "@/lib/api/forecasting";
import { useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/overlay";
import { DescriptionList } from "@/components/page/page";
import { DetailSkeleton, ErrorState } from "@/components/feedback/states";
import { SeverityBadge, StatusBadge } from "@/components/feedback/status";
import { ProductIdentity } from "@/components/entities/identity";
import { ForecastInterval } from "@/components/forecasting/metrics";
import { ForecastChartCanvas, ForecastLegend } from "@/components/charts/forecast-chart";
import { OverrideDialog } from "@/features/forecast-detail/override-dialog";
import { pick } from "@/lib/i18n/core";

/** Investigation drawer (560–640px) for one product within a run. */
export function ForecastDrawer({ productId, runId, onClose }: { productId: string | null; runId: string | null; onClose: () => void }) {
  const { can } = useSession();
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const q = useApiQuery(["forecast-detail", productId, runId], (c) => getForecastDetail(c, productId as string, runId), { enabled: !!productId && !!runId });
  const d = q.data;
  const openExceptions = d?.exceptions.filter((e) => e.status === "open" || e.status === "investigating" || e.status === "escalated") ?? [];

  return (
    <>
      <Drawer open={!!productId} onOpenChange={(o) => !o && onClose()}>
        {productId && (
          <DrawerContent
            size="lg"
            eyebrow={pick("Perkiraan", "Forecast")}
            title={d ? d.product.name : pick("Memuat perkiraan", "Loading forecast")}
            description={d ? pick(`${d.product.category} · ${d.product.sku} · proses ${d.run.id}`, `${d.product.category} · ${d.product.sku} · run ${d.run.id}`) : undefined}
            footer={
              d ? (
                <>
                  {can("forecast.override") && d.run.status === "published" && (
                    <Button variant="secondary" onClick={() => setOverrideOpen(true)}>
                      <Pencil aria-hidden /> {pick("Ubah perkiraan", "Override forecast")}
                    </Button>
                  )}
                  <Link href={`/forecasting/detail/${d.product.id}?run=${d.run.id}`} className={buttonVariants({ variant: "primary" })}>
                    {pick("Buka detail lengkap", "Open full detail")} <ArrowUpRight aria-hidden />
                  </Link>
                </>
              ) : undefined
            }
          >
            {q.isPending ? (
              <DetailSkeleton />
            ) : q.isError ? (
              <ErrorState compact what={pick("Perkiraan ini tidak dapat dimuat.", "This forecast could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
            ) : d ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ProductIdentity product={d.product} />
                  {d.row && <StatusBadge status={d.row.status} />}
                </div>
                <section aria-labelledby="dr-summary">
                  <h3 id="dr-summary" className="mb-3 card-title">
                    {pick(`${d.summary.horizonDays} hari ke depan`, `Next ${d.summary.horizonDays} days`)}
                  </h3>
                  <DescriptionList
                    columns={3}
                    items={[
                      { label: pick("Perkiraan permintaan", "Expected demand"), value: <span className="numeric-md">{formatNumber(d.summary.forecastValue)} {d.product.unit}</span> },
                      { label: pick("Perkiraan sebelumnya", "Previous run"), value: <span className="tabular">{formatNumber(d.summary.previousForecast)}</span>, hint: formatDeltaPercent(d.summary.deltaPercent) },
                      { label: pick("Aktual, periode sebelumnya", "Actual, prior period"), value: <span className="tabular">{formatNumber(d.summary.actualLastPeriod)}</span> },
                    ]}
                  />
                  <ForecastInterval
                    className="mt-4"
                    lower={d.summary.lowerBound}
                    upper={d.summary.upperBound}
                    forecast={d.summary.forecastValue}
                    comparison={d.summary.previousForecast}
                    override={d.row?.overrideUnits}
                    unit={d.product.unit}
                    coverage={d.summary.coverage}
                  />
                </section>
                <section aria-labelledby="dr-chart">
                  <h3 id="dr-chart" className="mb-2 card-title">
                    {pick("8 minggu terakhir dan perkiraan", "Last 8 weeks and forecast")}
                  </h3>
                  <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
                    <ForecastLegend />
                  </div>
                  <ForecastChartCanvas points={d.points.slice(-(56 + d.summary.horizonDays))} height={190} unit={pick(`${d.product.unit} per hari`, `${d.product.unit} per day`)} />
                  <p className="mt-2 caption">
                    {pick(
                      `Perkiraan ${formatNumber(d.summary.forecastValue)} ${d.product.unit}; rentang 80% ${formatNumber(d.summary.lowerBound)}–${formatNumber(d.summary.upperBound)} (${formatPercent((d.summary.upperBound - d.summary.lowerBound) / Math.max(1, d.summary.forecastValue), 0)} dari perkiraan).`,
                      `Expected ${formatNumber(d.summary.forecastValue)} ${d.product.unit}; 80% interval ${formatNumber(d.summary.lowerBound)}–${formatNumber(d.summary.upperBound)} (${formatPercent((d.summary.upperBound - d.summary.lowerBound) / Math.max(1, d.summary.forecastValue), 0)} of the forecast).`,
                    )}
                  </p>
                </section>
                <section aria-labelledby="dr-ex">
                  <h3 id="dr-ex" className="mb-2 card-title">
                    {pick(`Item terbuka (${openExceptions.length})`, `Open exceptions (${openExceptions.length})`)}
                  </h3>
                  {openExceptions.length === 0 ? (
                    <p className="caption">{pick("Tidak ada item terbuka untuk produk ini.", "No open exceptions for this product.")}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {openExceptions.map((e) => (
                        <li key={e.id}>
                          <Link href={`/planning/exceptions?id=${e.id}`} className="flex items-center gap-3 rounded-md border border-border p-3 hover:border-border-strong hover:bg-hover">
                            <SeverityBadge severity={e.severity} size="sm" />
                            <span className="min-w-0 flex-1 body-sm text-fg-secondary">{e.reason}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section aria-labelledby="dr-signals">
                  <h3 id="dr-signals" className="mb-2 card-title">
                    {pick("Sinyal dan asumsi", "Signals and assumptions")}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {d.signals.map((s) => (
                      <li key={s.label} className="body-sm">
                        <span className="font-semibold text-fg">{s.label}.</span> <span className="text-fg-secondary">{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : null}
          </DrawerContent>
        )}
      </Drawer>
      {d && (
        <OverrideDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          runId={d.run.id}
          productIds={[d.product.id]}
          originalUnits={d.summary.forecastValue}
          label={d.product.name}
          horizonDays={d.summary.horizonDays}
        />
      )}
    </>
  );
}
