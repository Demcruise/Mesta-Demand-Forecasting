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
  draft: { label: "Draft", tone: "neutral", icon: FileEdit, tooltip: "Belum dikirim atau dijalankan." },
  queued: { label: "Menunggu", tone: "info", icon: Clock, tooltip: "Menunggu antrean diproses." },
  running: { label: "Sedang diproses", tone: "info", icon: Loader2, tooltip: "Sedang diproses sekarang.", spin: true },
  completed: { label: "Selesai", tone: "success", icon: CheckCircle2, tooltip: "Selesai. Hasil sudah tersedia tetapi belum diterbitkan." },
  published: { label: "Diterbitkan", tone: "primary", icon: Send, tooltip: "Diterbitkan sebagai acuan perencanaan." },
  approved: { label: "Disetujui", tone: "success", icon: ShieldCheck, tooltip: "Disetujui oleh peninjau yang berwenang." },
  rejected: { label: "Ditolak", tone: "critical", icon: XCircle, tooltip: "Ditolak oleh peninjau." },
  needs_review: { label: "Perlu ditinjau", tone: "warning", icon: Eye, tooltip: "Memiliki setidaknya satu item yang perlu ditinjau." },
  failed: { label: "Gagal", tone: "critical", icon: AlertOctagon, tooltip: "Berhenti karena terjadi kesalahan." },
  paused: { label: "Dijeda", tone: "neutral", icon: PauseCircle, tooltip: "Dijeda dan tidak sedang diproses." },
  archived: { label: "Diarsipkan", tone: "neutral", icon: Archive, tooltip: "Disimpan untuk referensi. Hanya baca." },
  stale: { label: "Usang", tone: "warning", icon: AlertTriangle, tooltip: "Data sumber lebih lama dari batas pembaruan." },
  unavailable: { label: "Tidak tersedia", tone: "neutral", icon: Slash, tooltip: "Data tidak tersedia." },
  cancelled: { label: "Dibatalkan", tone: "neutral", icon: Ban, tooltip: "Dihentikan oleh pengguna sebelum selesai." },
  pending: { label: "Menunggu keputusan", tone: "warning", icon: Clock, tooltip: "Menunggu keputusan." },
  open: { label: "Terbuka", tone: "warning", icon: CircleDot, tooltip: "Belum ditangani." },
  investigating: { label: "Sedang ditelusuri", tone: "info", icon: Eye, tooltip: "Sedang ditangani." },
  resolved: { label: "Teratasi", tone: "success", icon: CheckCircle2, tooltip: "Ditutup dengan penyelesaian." },
  dismissed: { label: "Diabaikan", tone: "neutral", icon: Slash, tooltip: "Ditutup tanpa tindakan." },
  escalated: { label: "Dieskalasi", tone: "critical", icon: AlertTriangle, tooltip: "Diteruskan ke manajer." },
  revision_requested: { label: "Perlu revisi", tone: "warning", icon: RotateCcw, tooltip: "Dikembalikan ke pengaju untuk diperbaiki." },
  in_review: { label: "Sedang ditinjau", tone: "info", icon: Eye, tooltip: "Sudah dikirim dan menunggu persetujuan." },
  simulated: { label: "Tersimulasi", tone: "success", icon: CheckCircle2, tooltip: "Hasil simulasi sudah tersedia." },
  connected: { label: "Terhubung", tone: "success", icon: CheckCircle2, tooltip: "Sinkronisasi berjalan sesuai jadwal." },
  syncing: { label: "Menyinkronkan", tone: "info", icon: Loader2, tooltip: "Sinkronisasi sedang berjalan.", spin: true },
  warning: { label: "Peringatan", tone: "warning", icon: AlertTriangle, tooltip: "Tersinkron, tetapi ada hal yang perlu ditinjau." },
  disconnected: { label: "Terputus", tone: "neutral", icon: Unplug, tooltip: "Tidak terhubung. Tidak ada data yang diterima." },
  active: { label: "Aktif", tone: "success", icon: CheckCircle2, tooltip: "Dapat masuk." },
  invited: { label: "Diundang", tone: "info", icon: UserPlus, tooltip: "Undangan terkirim, belum diterima." },
  suspended: { label: "Ditangguhkan", tone: "critical", icon: Ban, tooltip: "Tidak dapat masuk." },
  production: { label: "Produksi", tone: "primary", icon: Radio, tooltip: "Disetujui untuk perkiraan produksi." },
  candidate: { label: "Kandidat", tone: "info", icon: CircleDashed, tooltip: "Sedang dievaluasi. Belum menjadi default." },
  training: { label: "Pelatihan", tone: "info", icon: Loader2, tooltip: "Pelatihan sedang berjalan.", spin: true },
  overridden: { label: "Diubah manual", tone: "primary", icon: Pencil, tooltip: "Ada perubahan manual dari perencana." },
  normal: { label: "Tidak ada masalah", tone: "neutral", icon: CheckCircle2, tooltip: "Tidak ada item yang perlu ditinjau atau diubah." },
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
  critical: { label: "Kritis", tone: "critical", icon: AlertOctagon },
  blocking: { label: "Menghambat", tone: "critical", icon: AlertOctagon },
  warning: { label: "Peringatan", tone: "warning", icon: AlertTriangle },
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
