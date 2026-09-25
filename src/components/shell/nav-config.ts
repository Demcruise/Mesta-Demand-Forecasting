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

/**
 * Global information architecture (backlog v3 §9 NAV-001). Six limited sections with
 * Indonesian labels; every page stays reachable from its own section rather than
 * disappearing, and restricted pages explain access instead of being hidden.
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

export const NAV: NavGroup[] = [
  {
    label: "Ringkasan",
    icon: LayoutDashboard,
    items: [{ label: "Ringkasan", href: "/overview", icon: LayoutDashboard }],
  },
  {
    label: "Perkiraan",
    icon: TrendingUp,
    items: [
      { label: "Proses Perkiraan", href: "/forecasting/runs", icon: Workflow },
      { label: "Perkiraan Permintaan", href: "/forecasting/explorer", icon: Table2, match: ["/forecasting/explorer", "/forecasting/detail"] },
      { label: "Wawasan Perkiraan", href: "/forecasting/insights", icon: ChartSpline },
      { label: "Jadwal Perkiraan", href: "/forecasting/schedules", icon: CalendarClock },
    ],
  },
  {
    label: "Data",
    icon: Database,
    items: [
      { label: "Produk", href: "/demand-data/products", icon: Boxes },
      { label: "Permintaan Historis", href: "/demand-data/historical", icon: History },
      { label: "Kualitas Data", href: "/demand-data/quality", icon: ShieldAlert, count: "dataIssues" },
      { label: "Sumber Data", href: "/demand-data/sources", icon: Plug },
    ],
  },
  {
    label: "Model",
    icon: Cpu,
    items: [
      { label: "Daftar Model", href: "/models", icon: Cpu, match: ["/models$", "/models/mdl_"] },
      { label: "Performa Model", href: "/models/performance", icon: LineChart },
      { label: "Uji Model", href: "/models/backtesting", icon: FlaskConical },
    ],
  },
  {
    label: "Perencanaan",
    icon: ClipboardCheck,
    items: [
      { label: "Rencana", href: "/planning", icon: ClipboardCheck, match: ["/planning$"] },
      { label: "Skenario", href: "/scenarios", icon: SlidersHorizontal, match: ["/scenarios$", "/scenarios/new", "/scenarios/scn_"] },
      { label: "Bandingkan Skenario", href: "/scenarios/compare", icon: GitCompareArrows },
      { label: "Perlu Ditinjau", href: "/planning/exceptions", icon: ListChecks, count: "exceptions" },
      { label: "Persetujuan", href: "/planning/approvals", icon: ShieldAlert, count: "approvals" },
    ],
  },
  {
    label: "Sistem",
    icon: Settings,
    items: [
      { label: "Integrasi", href: "/administration/integrations", icon: Plug, permission: "integration.manage" },
      { label: "Pemantauan", href: "/monitoring", icon: BarChart3 },
      { label: "Riwayat Aktivitas", href: "/administration/audit", icon: ScrollText, permission: "audit.view" },
      { label: "Pengguna & Akses", href: "/administration/users", icon: Users, permission: "users.manage" },
      { label: "Sumber Keputusan", href: "/forecasting/lineage", icon: Waypoints },
      { label: "Pengaturan", href: "/administration/settings", icon: Settings, match: ["/administration/settings"] },
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

/** Static breadcrumb labels by path segment (Indonesian). */
export const SEGMENT_LABELS: Record<string, string> = {
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

/** Where a breadcrumb segment should link (some segments have no page of their own). */
export const SEGMENT_HREFS: Record<string, string> = {
  "/forecasting": "/forecasting/runs",
  "/forecasting/detail": "/forecasting/explorer",
  "/demand-data": "/demand-data/products",
  "/administration": "/administration/audit",
};
