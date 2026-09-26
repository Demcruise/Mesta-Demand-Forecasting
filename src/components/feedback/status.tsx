import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Eye,
  FileEdit,
  Info,
  Loader2,
  PauseCircle,
  Pencil,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  Slash,
  Unplug,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Severity, StatusKey } from "@/types/domain";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlay";
import { getActiveLocale, getTranslations, type Locale } from "@/lib/i18n/core";

/**
 * Status system (STATUS-001). Every status carries label + icon + semantic colour +
 * tooltip + accessible text. Colour is never the only signal.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "critical" | "primary";

type StatusDef = { label: string; tone: Tone; icon: LucideIcon; tooltip: string; spin?: boolean };

const STATUS_META: Record<StatusKey, { tone: Tone; icon: LucideIcon; spin?: boolean }> = {
  draft: { tone: "neutral", icon: FileEdit },
  queued: { tone: "info", icon: Clock },
  running: { tone: "info", icon: Loader2, spin: true },
  completed: { tone: "success", icon: CheckCircle2 },
  published: { tone: "primary", icon: Send },
  approved: { tone: "success", icon: ShieldCheck },
  rejected: { tone: "critical", icon: XCircle },
  needs_review: { tone: "warning", icon: Eye },
  failed: { tone: "critical", icon: AlertOctagon },
  paused: { tone: "neutral", icon: PauseCircle },
  archived: { tone: "neutral", icon: Archive },
  stale: { tone: "warning", icon: AlertTriangle },
  unavailable: { tone: "neutral", icon: Slash },
  cancelled: { tone: "neutral", icon: Ban },
  pending: { tone: "warning", icon: Clock },
  open: { tone: "warning", icon: CircleDot },
  investigating: { tone: "info", icon: Eye },
  resolved: { tone: "success", icon: CheckCircle2 },
  dismissed: { tone: "neutral", icon: Slash },
  escalated: { tone: "critical", icon: AlertTriangle },
  revision_requested: { tone: "warning", icon: RotateCcw },
  in_review: { tone: "info", icon: Eye },
  simulated: { tone: "success", icon: CheckCircle2 },
  connected: { tone: "success", icon: CheckCircle2 },
  syncing: { tone: "info", icon: Loader2, spin: true },
  warning: { tone: "warning", icon: AlertTriangle },
  disconnected: { tone: "neutral", icon: Unplug },
  active: { tone: "success", icon: CheckCircle2 },
  invited: { tone: "info", icon: UserPlus },
  suspended: { tone: "critical", icon: Ban },
  production: { tone: "primary", icon: Radio },
  candidate: { tone: "info", icon: CircleDashed },
  training: { tone: "info", icon: Loader2, spin: true },
  overridden: { tone: "primary", icon: Pencil },
  normal: { tone: "neutral", icon: CheckCircle2 },
};

export const STATUS: Record<StatusKey, StatusDef> = new Proxy({} as Record<StatusKey, StatusDef>, {
  get(_t, key: StatusKey) {
    const meta = STATUS_META[key] ?? { tone: "neutral", icon: CircleDot };
    const text = getTranslations(getActiveLocale()).statuses[key] ?? { label: key, tooltip: "" };
    return { ...meta, label: text.label, tooltip: text.tooltip };
  },
  has(_t, key: StatusKey) {
    return key in STATUS_META;
  },
  ownKeys() {
    return Object.keys(STATUS_META);
  },
  getOwnPropertyDescriptor(_t, key: StatusKey) {
    const meta = STATUS_META[key];
    if (!meta) return undefined;
    const text = getTranslations(getActiveLocale()).statuses[key] ?? { label: key, tooltip: "" };
    return {
      value: { ...meta, label: text.label, tooltip: text.tooltip },
      enumerable: true,
      configurable: true,
    };
  },
});

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-neutral-subtle text-neutral-fg border-border",
  info: "bg-info-subtle text-info-fg border-info/25",
  success: "bg-success-subtle text-success-fg border-success/25",
  warning: "bg-warning-subtle text-warning-fg border-warning/30",
  critical: "bg-critical-subtle text-critical-fg border-critical/25",
  primary: "bg-primary-subtle text-primary-subtle-fg border-primary/20",
};

export function StatusBadge({ status, className, label, size = "md" }: { status: StatusKey; className?: string; label?: string; size?: "sm" | "md" }) {
  const def = STATUS[status];
  const Icon = def.icon;
  return (
    <Tooltip content={def.tooltip}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border font-semibold leading-none",
          size === "sm" ? "h-5 px-1.5 text-[0.6875rem]" : "h-6 px-2 text-xs",
          TONE_CLASSES[def.tone],
          className,
        )}
        tabIndex={0}
        aria-label={`Status: ${label ?? def.label}. ${def.tooltip}`}
      >
        <Icon className={cn("size-3.5 shrink-0", def.spin && "animate-spin")} aria-hidden />
        {label ?? def.label}
      </span>
    </Tooltip>
  );
}

export function getSeverityLabel(severity: Severity | "blocking", locale: Locale = getActiveLocale()) {
  const isId = locale === "id";
  if (severity === "blocking") return isId ? "Menghambat" : "Blocking";
  if (severity === "critical") return isId ? "Kritis" : "Critical";
  if (severity === "warning") return isId ? "Peringatan" : "Warning";
  return "Info";
}

export function SeverityBadge({ severity, size = "md" }: { severity: Severity | "blocking"; size?: "sm" | "md" }) {
  const meta: Record<Severity | "blocking", { tone: Tone; icon: LucideIcon }> = {
    critical: { tone: "critical", icon: AlertOctagon },
    blocking: { tone: "critical", icon: AlertOctagon },
    warning: { tone: "warning", icon: AlertTriangle },
    info: { tone: "info", icon: Info },
  };
  const def = meta[severity];
  const Icon = def.icon;
  const label = getSeverityLabel(severity);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border font-semibold leading-none",
        size === "sm" ? "h-5 px-1.5 text-[0.6875rem]" : "h-6 px-2 text-xs",
        TONE_CLASSES[def.tone],
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

/** Neutral metadata tag (e.g. category, environment). Not a status. */
export function Tag({ children, tone = "neutral", className, icon }: { children: React.ReactNode; tone?: Tone; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 text-[0.6875rem] font-semibold leading-none [&_svg]:size-3 [&_svg]:shrink-0", TONE_CLASSES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
