"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import type { ExportFormat } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlay";

/** EXPORT-001: explicit export with format choice; the label states how many rows and that filters apply. */
export function ExportMenu({ label = "Export", note = "Current filters and sort are applied.", onExport, disabled }: { label?: string; note?: string; onExport: (format: ExportFormat) => void; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled} aria-label={label}>
          <Download aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>{note}</DropdownMenuLabel>
        <DropdownMenuItem icon={<FileSpreadsheet />} onSelect={() => onExport("xlsx")}>
          Excel workbook (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem icon={<FileText />} onSelect={() => onExport("csv")}>
          CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
