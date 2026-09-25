"use client";

import { PageContainer, PageHeader } from "@/components/page/page";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { ScenarioBuilder } from "./scenario-builder";

export function NewScenarioView() {
  useBreadcrumbLeaf("New scenario");
  return (
    <PageContainer>
      <PageHeader title="Create scenario" description="Apply assumptions to a published forecast, simulate the impact, then save. Nothing changes in plans until the scenario is approved and adopted." />
      <ScenarioBuilder initial={null} />
    </PageContainer>
  );
}
