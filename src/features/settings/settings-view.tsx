"use client";

import { Bell, Building2, Database, KeyRound, Lock, ScrollText, ShieldCheck, UserRound, Users, Workflow } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { WorkspaceSettings } from "@/lib/mock/db";
import { getSettings, updateSettings } from "@/lib/api/governance";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { usePreferences } from "@/lib/preferences";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { RadioCards, SwitchField } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader, Panel } from "@/components/page/page";
import { ErrorState, InlineAlert, PageSkeleton, PermissionNotice } from "@/components/feedback/states";
import { Tag } from "@/components/feedback/status";
import { ConsequenceSummary } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { ApiAccessSection } from "./api-access";
import { NotificationRulesSection } from "./notification-rules";
import type { SectionKey } from "./sections";


const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }>; group: "Personal" | "Workspace administration" }[] = [
  { key: "personal", label: "Pribadi", icon: UserRound, group: "Personal" },
  { key: "notifications", label: "Notifikasi", icon: Bell, group: "Personal" },
  { key: "workspace", label: "Ruang Kerja", icon: Building2, group: "Workspace administration" },
  { key: "forecasting", label: "Perkiraan", icon: Workflow, group: "Workspace administration" },
  { key: "data", label: "Data & Integrasi", icon: Database, group: "Workspace administration" },
  { key: "approvals", label: "Persetujuan", icon: ShieldCheck, group: "Workspace administration" },
  { key: "roles", label: "Pengguna & Akses", icon: Users, group: "Workspace administration" },
  { key: "audit", label: "Audit & Retensi", icon: ScrollText, group: "Workspace administration" },
  { key: "security", label: "Keamanan", icon: Lock, group: "Workspace administration" },
  { key: "api", label: "API", icon: KeyRound, group: "Workspace administration" },
];

/**
 * PAGE-SETTINGS: personal preferences are separated from workspace administration;
 * administrative sections are permission-gated and every change is audited.
 */
export function SettingsView({ section }: { section: SectionKey }) {
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0]!;
  useBreadcrumbLeaf(current.label);
  const groups = ["Personal", "Workspace administration"] as const;
  return (
    <PageContainer>
      <PageHeader title="Pengaturan" description="Preferensi pribadi hanya berlaku untuk Anda. Pengaturan ruang kerja berlaku untuk semua orang dan tercatat di riwayat aktivitas." />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Bagian pengaturan" className="lg:sticky lg:top-[calc(var(--topbar-h)+1.5rem)] lg:self-start">
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <p className="mb-1 px-2 metadata">{g}</p>
              <ul className="flex gap-1 overflow-x-auto lg:flex-col">
                {SECTIONS.filter((s) => s.group === g).map((s) => {
                  const Icon = s.icon;
                  const active = s.key === current.key;
                  return (
                    <li key={s.key}>
                      <Link
                        href={`/administration/settings/${s.key}`}
                        aria-current={active ? "page" : undefined}
                        className={cn("flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-2 text-[0.8125rem] font-semibold", active ? "bg-selected text-primary-subtle-fg" : "text-fg-secondary hover:bg-hover hover:text-fg")}
                      >
                        <Icon className="size-4 shrink-0" />
                        {s.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          {current.key === "personal" ? (
            <PersonalSection />
          ) : current.key === "notifications" ? (
            <NotificationRulesSection />
          ) : current.key === "api" ? (
            <ApiAccessSection />
          ) : current.key === "roles" ? (
            <RolesSection />
          ) : (
            <WorkspaceSections section={current.key} />
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function PersonalSection() {
  const { theme, density, sidebarCollapsed, locale, setPreference } = usePreferences();
  const { session } = useSession();
  const isId = locale === "id";
  return (
    <div className="flex flex-col gap-4">
      <Panel title={isId ? "Profil" : "Profile"} description={isId ? "Dikelola oleh penyedia identitas Anda." : "Managed by your identity provider."}>
        <DescriptionList
          columns={2}
          items={[
            { label: isId ? "Nama" : "Name", value: session.name },
            { label: isId ? "Email" : "Email", value: session.email },
            { label: isId ? "Peran di ruang kerja ini" : "Role in this workspace", value: ROLE_LABELS[session.role] },
            { label: isId ? "Masuk melalui" : "Signed in via", value: session.idp },
          ]}
        />
      </Panel>
      <Panel title={isId ? "Tampilan" : "Appearance"} description={isId ? "Hanya tersimpan di peramban ini." : "Saved in this browser only."}>
        <div className="flex flex-col gap-5">
          <Field label={isId ? "Bahasa" : "Language"} htmlFor="locale" hint={isId ? "Pilih bahasa tampilan antarmuka Mesta." : "Choose the interface display language for Mesta."}>
            <RadioCards
              aria-label={isId ? "Bahasa" : "Language"}
              columns={2}
              value={locale}
              onValueChange={(v) => setPreference("locale", v as "en" | "id")}
              options={[
                { value: "en", label: "English", description: "Default interface language" },
                { value: "id", label: "Bahasa Indonesia", description: "Antarmuka bahasa Indonesia" },
              ]}
            />
          </Field>
          <Field label={isId ? "Tema" : "Theme"} htmlFor="theme">
            <RadioCards
              aria-label={isId ? "Tema" : "Theme"}
              columns={3}
              value={theme}
              onValueChange={(v) => setPreference("theme", v as typeof theme)}
              options={[
                { value: "light", label: isId ? "Terang" : "Light" },
                { value: "dark", label: isId ? "Gelap" : "Dark" },
                { value: "system", label: isId ? "Ikuti sistem" : "Match system" },
              ]}
            />
          </Field>
          <Field label={isId ? "Kerapatan tabel bawaan" : "Default table density"} htmlFor="density" hint={isId ? "Tiap tabel tetap dapat diubah sendiri-sendiri." : "Tables can still be switched individually."}>
            <RadioCards
              aria-label={isId ? "Kerapatan tabel bawaan" : "Default table density"}
              columns={2}
              value={density}
              onValueChange={(v) => setPreference("density", v as typeof density)}
              options={[
                { value: "comfortable", label: isId ? "Nyaman" : "Comfortable", description: isId ? "baris 54px" : "54px rows" },
                { value: "compact", label: isId ? "Padat" : "Compact", description: isId ? "baris 42px" : "42px rows" },
              ]}
            />
          </Field>
          <SwitchField id="sidebar" label={isId ? "Tutup bilah samping" : "Collapse sidebar"} description={isId ? "Tampilkan ikon saja agar tabel lebih lega." : "Show icons only to give tables more room."} checked={sidebarCollapsed} onCheckedChange={(v) => setPreference("sidebarCollapsed", v)} />
        </div>
      </Panel>
      <Panel title={isId ? "Format" : "Formats"}>
        <DescriptionList
          columns={3}
          items={[
            { label: isId ? "Tanggal" : "Dates", value: formatDate("2026-09-25") },
            { label: isId ? "Angka" : "Numbers", value: formatNumber(12440) },
            { label: isId ? "Perubahan" : "Changes", value: `${formatDeltaPercent(0.045)} / ${formatDeltaPercent(-0.032)}` },
          ]}
        />
        <p className="mt-3 caption">{isId ? "Format angka dan tanggal otomatis mengikuti bahasa yang dipilih." : "Number and date formats automatically follow your selected language."}</p>
      </Panel>
    </div>
  );
}

function RolesSection() {
  return (
    <Panel title="Pengguna & Akses">
      <p className="body-sm text-fg-secondary">Role assignments and the permission matrix are managed on the Users & roles page.</p>
      <Link href="/administration/users" className={cn(buttonVariants({ variant: "secondary" }), "mt-3")}>
        Open users & roles
      </Link>
    </Panel>
  );
}

type Draft = WorkspaceSettings;

function WorkspaceSections({ section }: { section: Exclude<SectionKey, "personal" | "api" | "roles" | "notifications"> }) {
  const { can, workspace } = useSession();
  const q = useApiQuery(["settings"], getSettings);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (q.data) setDraft(structuredClone(q.data.settings));
  }, [q.data, section]);

  const settingsKey: keyof WorkspaceSettings | null =
    section === "forecasting" ? "forecasting" : section === "approvals" ? "approvals" : section === "audit" ? "audit" : section === "security" ? "security" : null;
  const secondaryKey: keyof WorkspaceSettings | null = section === "forecasting" ? "exceptions" : null;
  const editable = can("settings.workspace");

  const save = useApiMutation(
    async (c, v: { reason: string }) => {
      if (!draft || !settingsKey) return;
      await updateSettings(c, settingsKey, draft[settingsKey] as never, v.reason);
      if (secondaryKey) await updateSettings(c, secondaryKey, draft[secondaryKey] as never, v.reason);
    },
    { invalidate: [["settings"], ["notifications"]], success: "Pengaturan tersimpan", successDescription: "Perubahan tercatat di riwayat aktivitas.", failure: "Pengaturan tidak tersimpan.", onSuccess: () => setConfirm(false) },
  );

  if (q.isPending || !draft) return <PageSkeleton />;
  if (q.isError) return <ErrorState what="Pengaturan tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} />;
  const saved = q.data.settings;
  const diffs = diffSettings(saved, draft, [settingsKey, secondaryKey].filter(Boolean) as (keyof WorkspaceSettings)[]);
  const dirty = diffs.length > 0;
  const set = <K extends keyof WorkspaceSettings>(key: K, patch: Partial<WorkspaceSettings[K]>) => setDraft((d) => (d ? { ...d, [key]: { ...d[key], ...patch } } : d));

  const footer =
    settingsKey && editable ? (
      <>
        <span className="caption">{dirty ? `${diffs.length} perubahan belum disimpan` : "Tidak ada perubahan belum disimpan"}</span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(structuredClone(saved))}>
            Discard changes
          </Button>
          <Button variant="primary" disabled={!dirty} onClick={() => { setReason(""); setConfirm(true); }}>
            Save changes
          </Button>
        </div>
      </>
    ) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {!editable && <PermissionNotice permission="settings.workspace" message="Pengaturan ini hanya baca untuk peran Anda." />}
      {section === "workspace" && (
        <Panel title="Ruang Kerja">
          <DescriptionList
            columns={2}
            items={[
              { label: "Nama", value: workspace.name },
              { label: "Lingkungan", value: <Tag tone={workspace.environment === "Production" ? "primary" : "info"}>{workspace.environment}</Tag> },
              { label: "Organisasi", value: workspace.organization },
              { label: "Wilayah", value: workspace.region },
              { label: "Status", value: workspace.status === "active" ? "Aktif" : workspace.status === "degraded" ? "Menurun" : "Pemeliharaan" },
            ]}
          />
          <p className="mt-3 caption">Identitas ruang kerja disediakan oleh dukungan Mesta. Hubungi mereka untuk mengganti nama atau memindahkan ruang kerja.</p>
        </Panel>
      )}
      {section === "data" && (
        <Panel title="Data & Integrasi" footer={<Link href="/administration/integrations" className="text-xs font-semibold text-primary hover:underline">Kelola integrasi →</Link>}>
          <p className="body-sm text-fg-secondary">Sources, schedules and field mappings are managed in Integrations. Data freshness thresholds are set in Forecasting.</p>
        </Panel>
      )}
      {section === "forecasting" && (
        <Panel title="Bawaan perkiraan" description="Diterapkan saat seseorang membuat proses perkiraan baru. Proses yang sudah ada tidak berubah." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Rentang bawaan" htmlFor="def-h">
              <Select id="def-h" value={String(draft.forecasting.defaultHorizonDays)} onValueChange={(v) => set("forecasting", { defaultHorizonDays: Number(v) })} options={[7, 14, 28, 30, 60, 90].map((d) => ({ value: String(d), label: `${d} days` }))} disabled={!editable} />
            </Field>
            <Field label="Frekuensi bawaan" htmlFor="def-f">
              <Select id="def-f" value={draft.forecasting.defaultFrequency} onValueChange={(v) => set("forecasting", { defaultFrequency: v as "daily" | "weekly" })} options={[{ value: "daily", label: "Harian" }, { value: "weekly", label: "Mingguan" }]} disabled={!editable} />
            </Field>
            <Field label="Rentang historis bawaan" htmlFor="def-w" hint="Jumlah hari riwayat yang dipakai secara bawaan.">
              <Select id="def-w" value={String(draft.forecasting.historyWindowDays)} onValueChange={(v) => set("forecasting", { historyWindowDays: Number(v) })} options={[180, 365, 730].map((d) => ({ value: String(d), label: `${d} days` }))} disabled={!editable} />
            </Field>
            <Field label="Model bawaan" htmlFor="def-m" hint="Mengubah model bawaan memerlukan persetujuan Manajer.">
              <div className="flex items-center gap-2">
                <Input id="def-m" readOnly value={q.data.models.find((m) => m.id === draft.forecasting.defaultModelId)?.name + " " + (q.data.models.find((m) => m.id === draft.forecasting.defaultModelId)?.version ?? "")} />
                <Link href="/models" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  Registry
                </Link>
              </div>
            </Field>
          </fieldset>
          <h4 className="mb-3 mt-6 card-title">Batas tinjauan</h4>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-3">
            <Field label="Perubahan perkiraan" htmlFor="th-delta" hint="Tandai untuk ditinjau bila perubahannya melebihi nilai ini dibanding proses sebelumnya.">
              <Select id="th-delta" value={String(draft.exceptions.deltaThreshold)} onValueChange={(v) => set("exceptions", { deltaThreshold: Number(v) })} options={[0.1, 0.15, 0.2, 0.25].map((d) => ({ value: String(d), label: formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label="Lebar rentang" htmlFor="th-width" hint="Lebar relatif rentang 80%.">
              <Select id="th-width" value={String(draft.exceptions.intervalWidthThreshold)} onValueChange={(v) => set("exceptions", { intervalWidthThreshold: Number(v) })} options={[0.6, 0.75, 0.9, 1.2].map((d) => ({ value: String(d), label: formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label="Pembaruan data" htmlFor="th-fresh" hint="Berapa jam sebelum data dianggap terlambat.">
              <Select id="th-fresh" value={String(draft.exceptions.freshnessHours)} onValueChange={(v) => set("exceptions", { freshnessHours: Number(v) })} options={[6, 12, 24, 48].map((d) => ({ value: String(d), label: `${d} hours` }))} disabled={!editable} />
            </Field>
          </fieldset>
          <p className="mt-3 caption">Threshold changes apply from the next forecast run.</p>
        </Panel>
      )}
      {section === "approvals" && (
        <Panel title="Kebijakan persetujuan" description="Perubahan mana yang perlu orang kedua sebelum berlaku." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Batas perubahan manual (persen)" htmlFor="ap-pct" hint="Perubahan manual di atas nilai ini perlu persetujuan.">
              <Select id="ap-pct" value={String(draft.approvals.overrideDeltaThreshold)} onValueChange={(v) => set("approvals", { overrideDeltaThreshold: Number(v) })} options={[0, 0.02, 0.05, 0.1].map((d) => ({ value: String(d), label: d === 0 ? "Setiap perubahan" : formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label="Batas perubahan manual (unit)" htmlFor="ap-units" hint="Perubahan manual di atas jumlah unit ini perlu persetujuan.">
              <Select id="ap-units" value={String(draft.approvals.overrideUnitsThreshold)} onValueChange={(v) => set("approvals", { overrideUnitsThreshold: Number(v) })} options={[1000, 5000, 10000, 50000].map((d) => ({ value: String(d), label: `${d.toLocaleString("en-US")} units` }))} disabled={!editable} />
            </Field>
            <Field label="Peran penyetuju" htmlFor="ap-role" hint="Administrator tidak dapat menyetujui perubahan bisnis.">
              <Select id="ap-role" value={draft.approvals.approverRole} onValueChange={() => undefined} options={[{ value: "manager", label: "Manajer" }]} disabled />
            </Field>
          </fieldset>
          <SwitchField id="ap-plan" label="Rencana perlu persetujuan sebelum diterbitkan" description="Mematikan ini membuat perencana dapat menerbitkan rencana langsung." checked={draft.approvals.planPublishRequiresApproval} onCheckedChange={(v) => set("approvals", { planPublishRequiresApproval: v })} disabled={!editable} />
        </Panel>
      )}
      {section === "audit" && (
        <Panel title="Audit & Retensi" description="Catatan aktivitas tidak dapat diubah dari alur kerja biasa." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Periode retensi" htmlFor="au-ret" hint="Catatan yang lebih lama dari ini akan diarsipkan. Konfirmasi dengan tim kepatuhan.">
              <Select id="au-ret" value={String(draft.audit.retentionDays)} onValueChange={(v) => set("audit", { retentionDays: Number(v) })} options={[90, 180, 365, 730, 2555].map((d) => ({ value: String(d), label: d === 2555 ? "7 years" : `${d} days` }))} disabled={!editable} />
            </Field>
          </fieldset>
          <SwitchField id="au-exp" label="Izinkan ekspor riwayat aktivitas" description="Manajer, analis, dan administrator dapat mengunduh riwayat aktivitas sebagai CSV." checked={draft.audit.exportEnabled} onCheckedChange={(v) => set("audit", { exportEnabled: v })} disabled={!editable} />
        </Panel>
      )}
      {section === "security" && (
        <Panel title="Keamanan" description="Autentikasi ditangani penyedia identitas Anda. Pengaturan ini mengatur sesi di Mesta." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Durasi sesi" htmlFor="se-len" hint="Pengguna harus masuk lagi setelah periode ini.">
              <Select id="se-len" value={String(draft.security.sessionHours)} onValueChange={(v) => set("security", { sessionHours: Number(v) })} options={[4, 8, 12, 24].map((d) => ({ value: String(d), label: `${d} hours` }))} disabled={!editable} />
            </Field>
            <Field label="Domain email yang diizinkan" htmlFor="se-dom" hint="Dipisahkan koma. Hanya domain ini yang dapat diundang.">
              <Input id="se-dom" value={draft.security.allowedDomains.join(", ")} onChange={(e) => set("security", { allowedDomains: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} disabled={!editable} />
            </Field>
          </fieldset>
          <SwitchField id="se-sso" label="Wajibkan single sign-on" description="Masuk dengan kata sandi tidak tersedia. Mematikan ini tidak didukung." checked={draft.security.enforceSso} onCheckedChange={() => undefined} disabled />
        </Panel>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title="Simpan pengaturan ruang kerja?"
          description={`Applies to everyone in ${workspace.name} · ${workspace.environment}.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Back
              </Button>
              <Button variant="primary" disabled={reason.trim().length < 5} loading={save.isPending} onClick={() => save.mutate({ reason })}>
                Save {diffs.length} change{diffs.length === 1 ? "" : "s"}
              </Button>
            </>
          }
        >
          <ConsequenceSummary rows={diffs.map((d) => ({ label: d.label, value: `${d.from} → ${d.to}`, emphasis: true }))} />
          <InlineAlert tone="info" title="Tercatat di riwayat aktivitas bersama nama dan alasan Anda." className="mt-4" />
          <Field className="mt-4" label="Alasan" htmlFor="set-reason" required hint="Minimal 5 karakter.">
            <Textarea id="set-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const LABELS: Record<string, string> = {
  defaultHorizonDays: "Rentang bawaan",
  defaultFrequency: "Frekuensi bawaan",
  historyWindowDays: "Rentang historis bawaan",
  deltaThreshold: "Batas perubahan perkiraan",
  intervalWidthThreshold: "Batas lebar rentang",
  freshnessHours: "Batas pembaruan data",
  overrideDeltaThreshold: "Batas perubahan manual (persen)",
  overrideUnitsThreshold: "Batas perubahan manual (unit)",
  planPublishRequiresApproval: "Rencana perlu persetujuan",
  retentionDays: "Audit retention",
  exportEnabled: "Audit export",
  sessionHours: "Session length",
  allowedDomains: "Allowed domains",
};

function show(key: string, v: unknown) {
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (Array.isArray(v)) return v.join(", ") || "None";
  if (typeof v === "number" && (key.endsWith("Threshold") && v < 5)) return formatPercent(v, 0);
  if (key === "freshnessHours" || key === "sessionHours") return `${v} hours`;
  if (key.endsWith("Days")) return `${v} days`;
  return String(v);
}

function diffSettings(a: WorkspaceSettings, b: WorkspaceSettings, keys: (keyof WorkspaceSettings)[]) {
  const out: { label: string; from: string; to: string }[] = [];
  for (const k of keys) {
    const x = a[k] as Record<string, unknown>;
    const y = b[k] as Record<string, unknown>;
    for (const f of Object.keys(y)) {
      if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) out.push({ label: LABELS[f] ?? f.replace(/_/g, " "), from: show(f, x[f]), to: show(f, y[f]) });
    }
  }
  return out;
}

