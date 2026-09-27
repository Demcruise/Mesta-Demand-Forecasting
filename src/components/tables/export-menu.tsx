"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import type { ExportFormat } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Tooltip } from "@/components/ui/overlay";
import { pick } from "@/lib/i18n/core";

/**
 * EXPORT-001: explicit export with format choice. The trigger is icon-only (v7 ACTION-001) —
 * the row count and filter note live in the tooltip and the accessible name, not in the
 * toolbar, so a dense table keeps one row.
 */
export function ExportMenu({ label, note, onExport, disabled }: { label?: string; note?: string; onExport: (format: ExportFormat) => void; disabled?: boolean }) {
  const text = label ?? pick("Ekspor", "Export");
  return (
    <DropdownMenu>
      <Tooltip content={text}>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="secondary" disabled={disabled} aria-label={text}>
            <Download aria-hidden />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>{note ?? pick("Filter dan urutan saat ini diterapkan.", "Current filters and sort are applied.")}</DropdownMenuLabel>
        <DropdownMenuItem icon={<FileSpreadsheet />} onSelect={() => onExport("xlsx")}>
          {pick("Buku kerja Excel (.xlsx)", "Excel workbook (.xlsx)")}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<FileText />} onSelect={() => onExport("csv")}>
          {pick("CSV (.csv)", "CSV (.csv)")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
