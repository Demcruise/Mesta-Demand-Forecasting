import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Cpu,
  Database,
  FlaskConical,
  GitCompareArrows,
  History,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Plug,
  ScrollText,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

/** Global information architecture (backlog §7). */

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match these path prefixes as active. */
  match?: string[];
  count?: "exceptions" | "approvals" | "dataIssues";
  /** Shown to everyone; the page explains restrictions. Used only for a lock hint. */
  permission?: Permission;
};

export type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [{ label: "Overview", href: "/overview", icon: LayoutDashboard }],
  },
  {
    label: "Forecasting",
    icon: TrendingUp,
    items: [
      { label: "Forecast runs", href: "/forecasting/runs", icon: Workflow },
      { label: "Forecast explorer", href: "/forecasting/explorer", icon: Table2, match: ["/forecasting/explorer", "/forecasting/detail"] },
    ],
  },
  {
    label: "Demand data",
    icon: Database,
    items: [
      { label: "Products", href: "/demand-data/products", icon: Boxes },
      { label: "Historical demand", href: "/demand-data/historical", icon: History },
      { label: "Data quality", href: "/demand-data/quality", icon: ShieldAlert, count: "dataIssues" },
      { label: "Data sources", href: "/demand-data/sources", icon: Plug },
    ],
  },
  {
    label: "Models",
    icon: Cpu,
    items: [
      { label: "Model registry", href: "/models", icon: Cpu, match: ["/models$", "/models/mdl_"] },
      { label: "Model performance", href: "/models/performance", icon: LineChart },
      { label: "Backtesting", href: "/models/backtesting", icon: FlaskConical },
    ],
  },
  {
    label: "Scenarios",
    icon: GitCompareArrows,
    items: [
      { label: "Scenarios", href: "/scenarios", icon: SlidersHorizontal, match: ["/scenarios$", "/scenarios/new", "/scenarios/scn_"] },
      { label: "Scenario comparison", href: "/scenarios/compare", icon: GitCompareArrows },
    ],
  },
  {
    label: "Planning",
    icon: ClipboardCheck,
    items: [
      { label: "Plan workspace", href: "/planning", icon: ClipboardCheck, match: ["/planning$"] },
      { label: "Exceptions", href: "/planning/exceptions", icon: ListChecks, count: "exceptions" },
      { label: "Approvals", href: "/planning/approvals", icon: ShieldAlert, count: "approvals" },
    ],
  },
  {
    label: "Operations",
    icon: Activity,
    items: [{ label: "Monitoring", href: "/monitoring", icon: BarChart3 }],
  },
  {
    label: "Administration",
    icon: Settings,
    items: [
      { label: "Integrations", href: "/administration/integrations", icon: Plug, permission: "integration.manage" },
      { label: "Users & roles", href: "/administration/users", icon: Users, permission: "users.manage" },
      { label: "Audit log", href: "/administration/audit", icon: ScrollText, permission: "audit.view" },
      { label: "Settings", href: "/administration/settings", icon: Settings, match: ["/administration/settings"] },
    ],
  },
];

export function isActive(item: NavItem, pathname: string) {
  const patterns = item.match ?? [item.href];
  return patterns.some((p) => {
    if (p.endsWith("$")) return pathname === p.slice(0, -1);
    return pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p);
  });
}

/** Static breadcrumb labels by path segment. */
export const SEGMENT_LABELS: Record<string, string> = {
  overview: "Overview",
  forecasting: "Forecasting",
  runs: "Forecast runs",
  new: "New",
  explorer: "Forecast explorer",
  detail: "Forecast explorer",
  "demand-data": "Demand data",
  products: "Products",
  historical: "Historical demand",
  quality: "Data quality",
  sources: "Data sources",
  models: "Models",
  performance: "Model performance",
  backtesting: "Backtesting",
  scenarios: "Scenarios",
  compare: "Scenario comparison",
  planning: "Planning",
  exceptions: "Exceptions",
  approvals: "Approvals",
  monitoring: "Monitoring",
  administration: "Administration",
  integrations: "Integrations",
  users: "Users & roles",
  audit: "Audit log",
  settings: "Settings",
  lineage: "Decision lineage",
};

/** Where a breadcrumb segment should link (some segments have no page of their own). */
export const SEGMENT_HREFS: Record<string, string> = {
  "/forecasting": "/forecasting/runs",
  "/forecasting/detail": "/forecasting/explorer",
  "/demand-data": "/demand-data/products",
  "/administration": "/administration/audit",
};
