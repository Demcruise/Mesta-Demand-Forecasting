"use client";

import { PageContainer, PageHeader } from "@/components/page/page";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { ScenarioBuilder } from "./scenario-builder";
import { pick } from "@/lib/i18n";

export function NewScenarioView() {
  useBreadcrumbLeaf(pick("Skenario Baru", "New scenario"));
  return (
    <PageContainer>
      <PageHeader title={pick("Buat Skenario", "Create scenario")} description={pick("Terapkan asumsi pada perkiraan terbit, simulasikan dampaknya, lalu simpan. Tidak ada perubahan pada rencana sampai skenario disetujui dan dipakai.", "Apply assumptions to a published forecast, simulate the impact, then save. Nothing changes in plans until the scenario is approved and adopted.")} />
      <ScenarioBuilder initial={null} />
    </PageContainer>
  );
}
