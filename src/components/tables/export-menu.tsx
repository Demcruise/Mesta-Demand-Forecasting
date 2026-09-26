"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import type { ExportFormat } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlay";
import { pick } from "@/lib/i18n/core";

/** EXPORT-001: explicit export with format choice; the label states how many rows and that filters apply. */
export function ExportMenu({ label, note, onExport, disabled }: { label?: string; note?: string; onExport: (format: ExportFormat) => void; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled} aria-label={label ?? pick("Ekspor", "Export")}>
          <Download aria-hidden />
          <span className="hidden sm:inline">{label ?? pick("Ekspor", "Export")}</span>
        </Button>
      </DropdownMenuTrigger>
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
