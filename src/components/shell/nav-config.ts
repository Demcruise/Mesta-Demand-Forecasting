import {
  Activity,
  BarChart3,
  CalendarClock,
  Boxes,
  ChartSpline,
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
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { getActiveLocale, type Locale } from "@/lib/i18n/core";

/**
 * Global information architecture. Six limited sections with
 * localized labels (English default, Indonesian supported).
 */

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

export function getNav(locale: Locale = getActiveLocale()): NavGroup[] {
  const isId = locale === "id";
  return [
    {
      label: isId ? "Ringkasan" : "Overview",
      icon: LayoutDashboard,
      items: [{ label: isId ? "Ringkasan" : "Overview", href: "/overview", icon: LayoutDashboard }],
    },
    {
      label: isId ? "Perkiraan" : "Forecasting",
      icon: TrendingUp,
      items: [
        { label: isId ? "Proses Perkiraan" : "Forecast Runs", href: "/forecasting/runs", icon: Workflow },
        { label: isId ? "Perkiraan Permintaan" : "Forecast Explorer", href: "/forecasting/explorer", icon: Table2, match: ["/forecasting/explorer", "/forecasting/detail"] },
        { label: isId ? "Wawasan Perkiraan" : "Forecast Insights", href: "/forecasting/insights", icon: ChartSpline },
        { label: isId ? "Jadwal Perkiraan" : "Forecast Schedules", href: "/forecasting/schedules", icon: CalendarClock },
      ],
    },
    {
      label: isId ? "Data" : "Demand Data",
      icon: Database,
      items: [
        { label: isId ? "Produk" : "Products", href: "/demand-data/products", icon: Boxes },
        { label: isId ? "Permintaan Historis" : "Historical Demand", href: "/demand-data/historical", icon: History },
        { label: isId ? "Kualitas Data" : "Data Quality", href: "/demand-data/quality", icon: ShieldAlert, count: "dataIssues" },
        { label: isId ? "Sumber Data" : "Data Sources", href: "/demand-data/sources", icon: Plug },
      ],
    },
    {
      label: isId ? "Model" : "Models",
      icon: Cpu,
      items: [
        { label: isId ? "Daftar Model" : "Model Registry", href: "/models", icon: Cpu, match: ["/models$", "/models/mdl_"] },
        { label: isId ? "Performa Model" : "Model Performance", href: "/models/performance", icon: LineChart },
        { label: isId ? "Uji Model" : "Backtesting", href: "/models/backtesting", icon: FlaskConical },
      ],
    },
    {
      label: isId ? "Perencanaan" : "Planning",
      icon: ClipboardCheck,
      items: [
        { label: isId ? "Rencana" : "Plan Workspace", href: "/planning", icon: ClipboardCheck, match: ["/planning$"] },
        { label: isId ? "Skenario" : "Scenarios", href: "/scenarios", icon: SlidersHorizontal, match: ["/scenarios$", "/scenarios/new", "/scenarios/scn_"] },
        { label: isId ? "Bandingkan Skenario" : "Compare Scenarios", href: "/scenarios/compare", icon: GitCompareArrows },
        { label: isId ? "Perlu Ditinjau" : "Exceptions", href: "/planning/exceptions", icon: ListChecks, count: "exceptions" },
        { label: isId ? "Persetujuan" : "Approvals", href: "/planning/approvals", icon: ShieldAlert, count: "approvals" },
      ],
    },
    {
      label: isId ? "Sistem" : "System",
      icon: Settings,
      items: [
        { label: isId ? "Integrasi" : "Integrations", href: "/administration/integrations", icon: Plug, permission: "integration.manage" },
        { label: isId ? "Pemantauan" : "Monitoring", href: "/monitoring", icon: BarChart3 },
        { label: isId ? "Riwayat Aktivitas" : "Audit Log", href: "/administration/audit", icon: ScrollText, permission: "audit.view" },
        { label: isId ? "Pengguna & Akses" : "Users & Roles", href: "/administration/users", icon: Users, permission: "users.manage" },
        { label: isId ? "Sumber Keputusan" : "Decision Lineage", href: "/forecasting/lineage", icon: Waypoints },
        { label: isId ? "Pengaturan" : "Settings", href: "/administration/settings", icon: Settings, match: ["/administration/settings"] },
      ],
    },
  ];
}

export const NAV: NavGroup[] = new Proxy([] as NavGroup[], {
  get(_t, prop) {
    const nav = getNav(getActiveLocale());
    return (nav as any)[prop];
  },
  has(_t, prop) {
    return prop in getNav(getActiveLocale());
  },
  ownKeys() {
    return Object.keys(getNav(getActiveLocale()));
  },
  getOwnPropertyDescriptor(_t, prop) {
    const nav = getNav(getActiveLocale());
    return Object.getOwnPropertyDescriptor(nav, prop);
  },
});

export function isActive(item: NavItem, pathname: string) {
  const patterns = item.match ?? [item.href];
  return patterns.some((p) => {
    if (p.endsWith("$")) return pathname === p.slice(0, -1);
    return pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p);
  });
}

const SEGMENT_LABELS_ID: Record<string, string> = {
  overview: "Ringkasan",
  forecasting: "Perkiraan",
  runs: "Proses Perkiraan",
  new: "Baru",
  explorer: "Perkiraan Permintaan",
  insights: "Wawasan Perkiraan",
  detail: "Perkiraan Permintaan",
  "demand-data": "Data Permintaan",
  products: "Produk",
  historical: "Permintaan Historis",
  quality: "Kualitas Data",
  sources: "Sumber Data",
  models: "Model",
  performance: "Performa Model",
  backtesting: "Uji Model",
  scenarios: "Skenario",
  compare: "Bandingkan Skenario",
  planning: "Perencanaan",
  exceptions: "Perlu Ditinjau",
  approvals: "Persetujuan",
  monitoring: "Pemantauan",
  administration: "Administrasi",
  integrations: "Integrasi",
  users: "Pengguna & Akses",
  audit: "Riwayat Aktivitas",
  settings: "Pengaturan",
  lineage: "Sumber Keputusan",
  onboarding: "Persiapan Ruang Kerja",
  schedules: "Jadwal Perkiraan",
};

const SEGMENT_LABELS_EN: Record<string, string> = {
  overview: "Overview",
  forecasting: "Forecasting",
  runs: "Forecast Runs",
  new: "New",
  explorer: "Forecast Explorer",
  insights: "Forecast Insights",
  detail: "Forecast Detail",
  "demand-data": "Demand Data",
  products: "Products",
  historical: "Historical Demand",
  quality: "Data Quality",
  sources: "Data Sources",
  models: "Models",
  performance: "Model Performance",
  backtesting: "Backtesting",
  scenarios: "Scenarios",
  compare: "Compare Scenarios",
  planning: "Planning",
  exceptions: "Exceptions",
  approvals: "Approvals",
  monitoring: "Monitoring",
  administration: "Administration",
  integrations: "Integrations",
  users: "Users & Roles",
  audit: "Audit Log",
  settings: "Settings",
  lineage: "Decision Lineage",
  onboarding: "Workspace Setup",
  schedules: "Forecast Schedules",
};

export const SEGMENT_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, key: string) {
    const isId = getActiveLocale() === "id";
    const dict = isId ? SEGMENT_LABELS_ID : SEGMENT_LABELS_EN;
    return dict[key] ?? key;
  },
  has(_t, key: string) {
    return key in SEGMENT_LABELS_EN;
  },
  ownKeys() {
    return Object.keys(SEGMENT_LABELS_EN);
  },
  getOwnPropertyDescriptor(_t, key: string) {
    const isId = getActiveLocale() === "id";
    const dict = isId ? SEGMENT_LABELS_ID : SEGMENT_LABELS_EN;
    return {
      value: dict[key] ?? key,
      enumerable: true,
      configurable: true,
    };
  },
});

/** Where a breadcrumb segment should link (some segments have no page of their own). */
export const SEGMENT_HREFS: Record<string, string> = {
  "/forecasting": "/forecasting/runs",
  "/forecasting/detail": "/forecasting/explorer",
  "/demand-data": "/demand-data/products",
  "/administration": "/administration/audit",
};
