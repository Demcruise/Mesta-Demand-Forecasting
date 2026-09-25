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

/**
 * Status system (STATUS-001). Every status carries label + icon + semantic colour +
 * tooltip + accessible text. Colour is never the only signal.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "critical" | "primary";

type StatusDef = { label: string; tone: Tone; icon: LucideIcon; tooltip: string; spin?: boolean };

export const STATUS: Record<StatusKey, StatusDef> = {
  draft: { label: "Draft", tone: "neutral", icon: FileEdit, tooltip: "Not yet submitted or run." },
  queued: { label: "Queued", tone: "info", icon: Clock, tooltip: "Waiting for a worker to start." },
  running: { label: "Running", tone: "info", icon: Loader2, tooltip: "Processing now.", spin: true },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2, tooltip: "Finished. Results are available but not published." },
  published: { label: "Published", tone: "primary", icon: Send, tooltip: "Published as a planning baseline." },
  approved: { label: "Approved", tone: "success", icon: ShieldCheck, tooltip: "Approved by an authorised reviewer." },
  rejected: { label: "Rejected", tone: "critical", icon: XCircle, tooltip: "Rejected by a reviewer." },
  needs_review: { label: "Needs review", tone: "warning", icon: Eye, tooltip: "Has at least one open exception." },
  failed: { label: "Failed", tone: "critical", icon: AlertOctagon, tooltip: "Stopped because of an error." },
  paused: { label: "Paused", tone: "neutral", icon: PauseCircle, tooltip: "Paused and not processing." },
  archived: { label: "Archived", tone: "neutral", icon: Archive, tooltip: "Kept for reference. Read-only." },
  stale: { label: "Stale", tone: "warning", icon: AlertTriangle, tooltip: "Underlying data is older than the freshness threshold." },
  unavailable: { label: "Unavailable", tone: "neutral", icon: Slash, tooltip: "No data available." },
  cancelled: { label: "Cancelled", tone: "neutral", icon: Ban, tooltip: "Stopped by a user before completion." },
  pending: { label: "Pending", tone: "warning", icon: Clock, tooltip: "Waiting for a decision." },
  open: { label: "Open", tone: "warning", icon: CircleDot, tooltip: "Not yet picked up." },
  investigating: { label: "Investigating", tone: "info", icon: Eye, tooltip: "Someone is working on it." },
  resolved: { label: "Resolved", tone: "success", icon: CheckCircle2, tooltip: "Closed with a resolution." },
  dismissed: { label: "Dismissed", tone: "neutral", icon: Slash, tooltip: "Closed without action." },
  escalated: { label: "Escalated", tone: "critical", icon: AlertTriangle, tooltip: "Raised to a manager." },
  revision_requested: { label: "Revision requested", tone: "warning", icon: RotateCcw, tooltip: "Sent back to the requester for changes." },
  in_review: { label: "In review", tone: "info", icon: Eye, tooltip: "Submitted and waiting for approval." },
  simulated: { label: "Simulated", tone: "success", icon: CheckCircle2, tooltip: "Simulation results are available." },
  connected: { label: "Connected", tone: "success", icon: CheckCircle2, tooltip: "Syncing on schedule." },
  syncing: { label: "Syncing", tone: "info", icon: Loader2, tooltip: "Sync in progress.", spin: true },
  warning: { label: "Warning", tone: "warning", icon: AlertTriangle, tooltip: "Syncing, with issues to review." },
  disconnected: { label: "Disconnected", tone: "neutral", icon: Unplug, tooltip: "Not connected. No data is received." },
  active: { label: "Active", tone: "success", icon: CheckCircle2, tooltip: "Can sign in." },
  invited: { label: "Invited", tone: "info", icon: UserPlus, tooltip: "Invitation sent, not yet accepted." },
  suspended: { label: "Suspended", tone: "critical", icon: Ban, tooltip: "Cannot sign in." },
  production: { label: "Production", tone: "primary", icon: Radio, tooltip: "Approved for production forecasting." },
  candidate: { label: "Candidate", tone: "info", icon: CircleDashed, tooltip: "Under evaluation. Not the default." },
  training: { label: "Training", tone: "info", icon: Loader2, tooltip: "Training in progress.", spin: true },
  overridden: { label: "Overridden", tone: "primary", icon: Pencil, tooltip: "A planner override is applied." },
  normal: { label: "No issues", tone: "neutral", icon: CheckCircle2, tooltip: "No open exceptions or overrides." },
};

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
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border font-semibold",
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

const SEVERITY: Record<Severity | "blocking", { label: string; tone: Tone; icon: LucideIcon }> = {
  critical: { label: "Critical", tone: "critical", icon: AlertOctagon },
  blocking: { label: "Blocking", tone: "critical", icon: AlertOctagon },
  warning: { label: "Warning", tone: "warning", icon: AlertTriangle },
  info: { label: "Info", tone: "info", icon: Info },
};

export function SeverityBadge({ severity, size = "md" }: { severity: Severity | "blocking"; size?: "sm" | "md" }) {
  const def = SEVERITY[severity];
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border font-semibold",
        size === "sm" ? "h-5 px-1.5 text-[0.6875rem]" : "h-6 px-2 text-xs",
        TONE_CLASSES[def.tone],
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {def.label}
    </span>
  );
}

/** Neutral metadata tag (e.g. category, environment). Not a status. */
export function Tag({ children, tone = "neutral", className, icon }: { children: React.ReactNode; tone?: Tone; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 text-[0.6875rem] font-semibold [&_svg]:size-3", TONE_CLASSES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
