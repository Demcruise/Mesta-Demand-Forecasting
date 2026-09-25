// Dev helper: generates thin route files that render a feature view.
// Usage: node scripts/gen-pages.mjs  (edit PAGES below)
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const PAGES = [
  ["monitoring", "MonitoringView", "@/features/monitoring/monitoring-view", "Monitoring", ""],
  ["administration/audit", "AuditView", "@/features/governance/audit-view", "Audit log", ""],
  ["administration/users", "UsersView", "@/features/governance/users-view", "Users & roles", ""],
  ["forecasting/lineage", "LineageView", "@/features/governance/lineage-view", "Decision lineage", ""],
  ["planning", "PlanView", "@/features/planning/plan-view", "Plan workspace", ""],
  ["planning/exceptions", "ExceptionsView", "@/features/exceptions/exceptions-view", "Exceptions", ""],
  ["planning/approvals", "ApprovalsView", "@/features/approvals/approvals-view", "Approvals", ""],
  ["scenarios", "ScenariosView", "@/features/scenarios/scenarios-view", "Scenarios", ""],
  ["scenarios/new", "NewScenarioView", "@/features/scenarios/new-scenario-view", "Create scenario", ""],
  ["scenarios/compare", "CompareView", "@/features/scenarios/compare-view", "Scenario comparison", ""],
  ["models", "RegistryView", "@/features/models/registry-view", "Model registry", ""],
  ["models/performance", "PerformanceView", "@/features/models/performance-view", "Model performance", ""],
  ["models/backtesting", "BacktestingView", "@/features/models/backtesting-view", "Backtesting", ""],
  ["demand-data/products", "ProductsView", "@/features/demand-data/products-view", "Products", ""],
  ["demand-data/historical", "HistoricalView", "@/features/demand-data/historical-view", "Historical demand", ""],
  ["demand-data/quality", "QualityView", "@/features/demand-data/quality-view", "Data quality", ""],
  ["demand-data/sources", "SourcesView", "@/features/demand-data/sources-view", "Data sources", ' mode="data"'],
  ["administration/integrations", "SourcesView", "@/features/demand-data/sources-view", "Integrations", ' mode="admin"'],
];

const force = process.argv.includes("--force");
for (const [route, component, from, title, props] of PAGES) {
  const file = join("src/app/(app)", route, "page.tsx");
  if (existsSync(file) && !force) continue;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `import type { Metadata } from "next";\nimport { ${component} } from "${from}";\n\nexport const metadata: Metadata = { title: "${title}" };\n\nexport default function Page() {\n  return <${component}${props} />;\n}\n`,
  );
  console.log("wrote", file);
}
