"use client";

import { PageContainer, PageHeader } from "@/components/page/page";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { ScenarioBuilder } from "./scenario-builder";

export function NewScenarioView() {
  useBreadcrumbLeaf("Skenario Baru");
  return (
    <PageContainer>
      <PageHeader title="Buat Skenario" description="Terapkan asumsi pada perkiraan terbit, simulasikan dampaknya, lalu simpan. Tidak ada perubahan pada rencana sampai skenario disetujui dan dipakai." />
      <ScenarioBuilder initial={null} />
    </PageContainer>
  );
}
