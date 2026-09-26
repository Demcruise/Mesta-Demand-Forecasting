"use client";

import { Bell, Building2, Database, FlaskConical, KeyRound, Lock, Palette, ScrollText, ShieldCheck, UserRound, Users, Workflow } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { WorkspaceSettings } from "@/lib/mock/db";
import { getSettings, updateSettings } from "@/lib/api/governance";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { usePreferences } from "@/lib/preferences";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatDateTime, formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { demoControls, loadDemoControls, saveDemoControls, type DemoControls } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
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
import { localizedRecord, pick } from "@/lib/i18n";


type SectionGroup = "personal" | "appearance" | "workspace" | "demo";

/** Built per render so labels follow the active locale (module-scope pick() would freeze them). */
function getSections(): { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }>; group: SectionGroup }[] {
  return [
    { key: "personal", label: pick("Preferensi pribadi", "Personal preferences"), icon: UserRound, group: "personal" },
    { key: "notifications", label: pick("Notifikasi", "Notifications"), icon: Bell, group: "personal" },
    { key: "appearance", label: pick("Bahasa, tema & tabel", "Language, theme & tables"), icon: Palette, group: "appearance" },
    { key: "workspace", label: pick("Ruang Kerja", "Workspace"), icon: Building2, group: "workspace" },
    { key: "forecasting", label: pick("Perkiraan", "Forecasting"), icon: Workflow, group: "workspace" },
    { key: "data", label: pick("Data & Integrasi", "Data & integrations"), icon: Database, group: "workspace" },
    { key: "approvals", label: pick("Persetujuan", "Approvals"), icon: ShieldCheck, group: "workspace" },
    { key: "roles", label: pick("Pengguna & Peran", "Users & roles"), icon: Users, group: "workspace" },
    { key: "audit", label: pick("Audit & Retensi", "Audit & retention"), icon: ScrollText, group: "workspace" },
    { key: "security", label: pick("Keamanan", "Security"), icon: Lock, group: "workspace" },
    { key: "api", label: "API", icon: KeyRound, group: "workspace" },
    { key: "demo", label: pick("Kontrol demo", "Demo controls"), icon: FlaskConical, group: "demo" },
  ];
}

/**
 * PAGE-SETTINGS: personal preferences are separated from workspace administration;
 * administrative sections are permission-gated and every change is audited.
 */
export function SettingsView({ section }: { section: SectionKey }) {
  const { workspace } = useSession();
  // PROFILE-003 / §52: demo controls exist only outside production workspaces.
  const showDemo = workspace.environment !== "Production";
  const SECTIONS = getSections().filter((s) => s.group !== "demo" || showDemo);
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0]!;
  useBreadcrumbLeaf(current.label);
  const groups: { key: SectionGroup; label: string }[] = [
    { key: "personal", label: pick("Pribadi", "Personal") },
    { key: "appearance", label: pick("Tampilan", "Appearance") },
    { key: "workspace", label: pick("Ruang kerja", "Workspace") },
    { key: "demo", label: "Demo" },
  ];
  return (
    <PageContainer>
      <PageHeader title={pick("Pengaturan", "Settings")} description={pick("Atur preferensi pribadi dan ruang kerja.", "Manage your preferences and workspace settings.")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={pick("Bagian pengaturan", "Settings sections")} className="min-w-0 lg:sticky lg:top-[calc(var(--topbar-h)+1.5rem)] lg:self-start">
          {groups.map((g) => (
            <div key={g.key} className="mb-4">
              <p className="mb-1 px-2 metadata">{g.label}</p>
              <ul className="flex gap-1 overflow-x-auto lg:flex-col">
                {SECTIONS.filter((s) => s.group === g.key).map((s) => {
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
          ) : current.key === "appearance" ? (
            <AppearanceSection />
          ) : current.key === "demo" ? (
            <DemoSection />
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
  const { locale } = usePreferences();
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
          ]}
        />
      </Panel>
      {/* PROFILE-004: session details live here, not in the account menu. */}
      <Panel title={isId ? "Sesi" : "Session"}>
        <DescriptionList
          columns={2}
          items={[
            { label: isId ? "Masuk melalui" : "Signed in via", value: session.idp },
            { label: isId ? "Sesi berakhir" : "Session expires", value: formatDateTime(session.expiresAt) },
          ]}
        />
      </Panel>
      <Panel title={isId ? "Format" : "Formats"}>
        <DescriptionList
          columns={3}
          items={[
            { label: isId ? "Tanggal" : "Dates", value: formatDate("2026-09-25T00:00:00") },
            { label: isId ? "Angka" : "Numbers", value: formatNumber(12440) },
            { label: isId ? "Perubahan" : "Changes", value: `${formatDeltaPercent(0.045)} / ${formatDeltaPercent(-0.032)}` },
          ]}
        />
        <p className="mt-3 caption">{isId ? "Format angka dan tanggal otomatis mengikuti bahasa yang dipilih." : "Number and date formats follow your selected language."}</p>
      </Panel>
    </div>
  );
}

/** Language, theme, table density and sidebar: the personal appearance preferences (§53). */
function AppearanceSection() {
  const { theme, density, sidebarCollapsed, locale, setPreference } = usePreferences();
  const isId = locale === "id";
  return (
    <div className="flex flex-col gap-4">
      <Panel title={isId ? "Tampilan" : "Appearance"} description={isId ? "Hanya tersimpan di peramban ini." : "Saved in this browser only."}>
        <div className="flex flex-col gap-5">
          <Field label={isId ? "Bahasa" : "Language"} htmlFor="locale" hint={isId ? "Pilih bahasa tampilan antarmuka Mesta." : "Choose the interface display language for Mesta."}>
            <RadioCards
              aria-label={isId ? "Bahasa" : "Language"}
              columns={2}
              value={locale}
              onValueChange={(v) => setPreference("locale", v as "en" | "id")}
              options={[
                { value: "en", label: "English", description: isId ? "Antarmuka dalam bahasa Inggris" : "Interface in English" },
                { value: "id", label: "Bahasa Indonesia", description: isId ? "Antarmuka dalam bahasa Indonesia" : "Interface in Indonesian" },
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
          <Field label={isId ? "Kerapatan tabel" : "Table density"} htmlFor="density" hint={isId ? "Pilih kerapatan yang digunakan di seluruh Mesta. Berlaku untuk semua tabel." : "Choose the density used across Mesta. Applies to every table."}>
            <RadioCards
              aria-label={isId ? "Kerapatan tabel" : "Table density"}
              columns={2}
              value={density}
              onValueChange={(v) => setPreference("density", v as typeof density)}
              options={[
                { value: "comfortable", label: isId ? "Nyaman" : "Comfortable", description: isId ? "Jarak antarbaris lebih longgar" : "More spacing between rows" },
                { value: "compact", label: isId ? "Padat" : "Compact", description: isId ? "Lebih banyak baris terlihat" : "More rows visible at once" },
              ]}
            />
          </Field>
          <SwitchField id="sidebar" label={isId ? "Ciutkan bilah samping" : "Collapse sidebar"} description={isId ? "Tampilkan ikon saja agar tabel lebih lega." : "Show icons only to give tables more room."} checked={sidebarCollapsed} onCheckedChange={(v) => setPreference("sidebarCollapsed", v)} />
        </div>
      </Panel>
    </div>
  );
}

/** Demo-only failure injection (PROFILE-003), moved out of the account menu. */
function DemoSection() {
  const queryClient = useQueryClient();
  const [demo, setDemo] = React.useState<DemoControls>(demoControls);
  React.useEffect(() => {
    setDemo({ ...loadDemoControls() });
  }, []);
  const update = (next: Partial<DemoControls>) => {
    saveDemoControls(next);
    setDemo({ ...demoControls });
    queryClient.invalidateQueries();
  };
  return (
    <Panel
      title={pick("Kontrol demo", "Demo controls")}
      description={pick("Simulasikan jaringan lambat dan kegagalan layanan untuk menguji status pemuatan dan galat. Hanya untuk ruang kerja demo; tersimpan di peramban ini.", "Simulate a slow network and service failures to test loading and error states. Demo workspaces only; saved in this browser.")}
    >
      <div className="flex flex-col divide-y divide-border-subtle">
        <SwitchField id="demo-slow" label={pick("Jaringan lambat", "Slow network")} description={pick("Setiap permintaan menunggu lebih lama.", "Every request takes longer.")} checked={demo.latency === "slow"} onCheckedChange={(v) => update({ latency: v ? "slow" : "normal" })} />
        <SwitchField id="demo-fail-reads" label={pick("Gagal membaca", "Fail reads")} description={pick("Halaman menampilkan status galat.", "Pages show their error state.")} checked={demo.failReads} onCheckedChange={(v) => update({ failReads: v })} />
        <SwitchField id="demo-fail-writes" label={pick("Gagal menulis", "Fail writes")} description={pick("Perubahan gagal disimpan.", "Changes fail to save.")} checked={demo.failWrites} onCheckedChange={(v) => update({ failWrites: v })} />
      </div>
    </Panel>
  );
}

function RolesSection() {
  return (
    <Panel title={pick("Pengguna & Akses", "Users & roles")}>
      <p className="body-sm text-fg-secondary">{pick("Penetapan peran dan matriks hak akses dikelola di halaman Pengguna & Peran.", "Role assignments and the permission matrix are managed on the Users & roles page.")}</p>
      <Link href="/administration/users" className={cn(buttonVariants({ variant: "secondary" }), "mt-3")}>
        {pick("Buka Pengguna & Peran", "Open users & roles")}
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
    { invalidate: [["settings"], ["notifications"]], success: pick("Pengaturan tersimpan", "Settings saved"), successDescription: pick("Perubahan tercatat di riwayat aktivitas.", "The change is recorded in the audit log."), failure: pick("Pengaturan tidak tersimpan.", "Settings were not saved."), onSuccess: () => setConfirm(false) },
  );

  if (q.isPending || !draft) return <PageSkeleton />;
  if (q.isError) return <ErrorState what={pick("Pengaturan tidak dapat dimuat.", "Settings could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />;
  const saved = q.data.settings;
  const diffs = diffSettings(saved, draft, [settingsKey, secondaryKey].filter(Boolean) as (keyof WorkspaceSettings)[]);
  const dirty = diffs.length > 0;
  const set = <K extends keyof WorkspaceSettings>(key: K, patch: Partial<WorkspaceSettings[K]>) => setDraft((d) => (d ? { ...d, [key]: { ...d[key], ...patch } } : d));

  const footer =
    settingsKey && editable ? (
      <>
        <span className="caption">{dirty ? pick(`${diffs.length} perubahan belum disimpan`, `${diffs.length} unsaved change${diffs.length === 1 ? "" : "s"}`) : pick("Tidak ada perubahan belum disimpan", "No unsaved changes")}</span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(structuredClone(saved))}>
            {pick("Buang perubahan", "Discard changes")}
          </Button>
          <Button variant="primary" disabled={!dirty} onClick={() => { setReason(""); setConfirm(true); }}>
            {pick("Simpan perubahan", "Save changes")}
          </Button>
        </div>
      </>
    ) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {!editable && <PermissionNotice permission="settings.workspace" message={pick("Pengaturan ini hanya baca untuk peran Anda.", "These settings are read-only for your role.")} />}
      {section === "workspace" && (
        <Panel title={pick("Ruang Kerja", "Workspace")}>
          <DescriptionList
            columns={2}
            items={[
              { label: pick("Nama", "Name"), value: workspace.name },
              { label: pick("Lingkungan", "Environment"), value: <Tag tone={workspace.environment === "Production" ? "primary" : "info"}>{workspace.environment}</Tag> },
              { label: pick("Organisasi", "Organisation"), value: workspace.organization },
              { label: pick("Wilayah", "Region"), value: workspace.region },
              { label: "Status", value: workspace.status === "active" ? pick("Aktif", "Active") : workspace.status === "degraded" ? pick("Menurun", "Degraded") : pick("Pemeliharaan", "Maintenance") },
            ]}
          />
          <p className="mt-3 caption">{pick("Identitas ruang kerja disediakan oleh dukungan Mesta. Hubungi mereka untuk mengganti nama atau memindahkan ruang kerja.", "Workspace identity is provisioned by Mesta support. Contact them to rename or move a workspace.")}</p>
        </Panel>
      )}
      {section === "data" && (
        <Panel title={pick("Data & Integrasi", "Data & integrations")} footer={<Link href="/administration/integrations" className="text-xs font-semibold text-primary hover:underline">{pick("Kelola integrasi →", "Manage integrations →")}</Link>}>
          <p className="body-sm text-fg-secondary">{pick("Sumber, jadwal, dan pemetaan kolom dikelola di Integrasi. Batas kebaruan data diatur di Perkiraan.", "Sources, schedules and field mappings are managed in Integrations. Data freshness thresholds are set in Forecasting.")}</p>
        </Panel>
      )}
      {section === "forecasting" && (
        <Panel title={pick("Bawaan perkiraan", "Forecasting defaults")} description={pick("Diterapkan saat seseorang membuat proses perkiraan baru. Proses yang sudah ada tidak berubah.", "Applied when someone creates a new forecast run. Existing runs are unchanged.")} footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label={pick("Rentang bawaan", "Default horizon")} htmlFor="def-h">
              <Select id="def-h" value={String(draft.forecasting.defaultHorizonDays)} onValueChange={(v) => set("forecasting", { defaultHorizonDays: Number(v) })} options={[7, 14, 28, 30, 60, 90].map((d) => ({ value: String(d), label: pick(`${d} hari`, `${d} days`) }))} disabled={!editable} />
            </Field>
            <Field label={pick("Frekuensi bawaan", "Default frequency")} htmlFor="def-f">
              <Select id="def-f" value={draft.forecasting.defaultFrequency} onValueChange={(v) => set("forecasting", { defaultFrequency: v as "daily" | "weekly" })} options={[{ value: "daily", label: pick("Harian", "Daily") }, { value: "weekly", label: pick("Mingguan", "Weekly") }]} disabled={!editable} />
            </Field>
            <Field label={pick("Rentang historis bawaan", "Default history window")} htmlFor="def-w" hint={pick("Jumlah hari riwayat yang dipakai secara bawaan.", "Days of history used by default.")}>
              <Select id="def-w" value={String(draft.forecasting.historyWindowDays)} onValueChange={(v) => set("forecasting", { historyWindowDays: Number(v) })} options={[180, 365, 730].map((d) => ({ value: String(d), label: pick(`${d} hari`, `${d} days`) }))} disabled={!editable} />
            </Field>
            <Field label={pick("Model bawaan", "Default model")} htmlFor="def-m" hint={pick("Mengubah model bawaan memerlukan persetujuan Manajer.", "Changing the default model requires Manager approval.")}>
              <div className="flex items-center gap-2">
                <Input id="def-m" readOnly value={q.data.models.find((m) => m.id === draft.forecasting.defaultModelId)?.name + " " + (q.data.models.find((m) => m.id === draft.forecasting.defaultModelId)?.version ?? "")} />
                <Link href="/models" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  {pick("Registri", "Registry")}
                </Link>
              </div>
            </Field>
          </fieldset>
          <h4 className="mb-3 mt-6 card-title">{pick("Batas tinjauan", "Exception thresholds")}</h4>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-3">
            <Field label={pick("Perubahan perkiraan", "Forecast change")} htmlFor="th-delta" hint={pick("Tandai untuk ditinjau bila perubahannya melebihi nilai ini dibanding proses sebelumnya.", "Raise an exception above this change vs the previous run.")}>
              <Select id="th-delta" value={String(draft.exceptions.deltaThreshold)} onValueChange={(v) => set("exceptions", { deltaThreshold: Number(v) })} options={[0.1, 0.15, 0.2, 0.25].map((d) => ({ value: String(d), label: formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label={pick("Lebar rentang", "Interval width")} htmlFor="th-width" hint={pick("Lebar relatif rentang 80%.", "Relative width of the 80% interval.")}>
              <Select id="th-width" value={String(draft.exceptions.intervalWidthThreshold)} onValueChange={(v) => set("exceptions", { intervalWidthThreshold: Number(v) })} options={[0.6, 0.75, 0.9, 1.2].map((d) => ({ value: String(d), label: formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label={pick("Pembaruan data", "Data freshness")} htmlFor="th-fresh" hint={pick("Berapa jam sebelum data dianggap terlambat.", "Hours before data counts as delayed.")}>
              <Select id="th-fresh" value={String(draft.exceptions.freshnessHours)} onValueChange={(v) => set("exceptions", { freshnessHours: Number(v) })} options={[6, 12, 24, 48].map((d) => ({ value: String(d), label: pick(`${d} jam`, `${d} hours`) }))} disabled={!editable} />
            </Field>
          </fieldset>
          <p className="mt-3 caption">{pick("Perubahan batas berlaku mulai proses perkiraan berikutnya.", "Threshold changes apply from the next forecast run.")}</p>
        </Panel>
      )}
      {section === "approvals" && (
        <Panel title={pick("Kebijakan persetujuan", "Approval policies")} description={pick("Perubahan mana yang perlu orang kedua sebelum berlaku.", "Which changes need a second person before they take effect.")} footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label={pick("Batas perubahan manual (persen)", "Override threshold (change)")} htmlFor="ap-pct" hint={pick("Perubahan manual di atas nilai ini perlu persetujuan.", "Overrides above this change need approval.")}>
              <Select id="ap-pct" value={String(draft.approvals.overrideDeltaThreshold)} onValueChange={(v) => set("approvals", { overrideDeltaThreshold: Number(v) })} options={[0, 0.02, 0.05, 0.1].map((d) => ({ value: String(d), label: d === 0 ? pick("Setiap perubahan", "Every override") : formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label={pick("Batas perubahan manual (unit)", "Override threshold (units)")} htmlFor="ap-units" hint={pick("Perubahan manual di atas jumlah unit ini perlu persetujuan.", "Overrides above this many units need approval.")}>
              <Select id="ap-units" value={String(draft.approvals.overrideUnitsThreshold)} onValueChange={(v) => set("approvals", { overrideUnitsThreshold: Number(v) })} options={[1000, 5000, 10000, 50000].map((d) => ({ value: String(d), label: pick(`${d.toLocaleString("id-ID")} unit`, `${d.toLocaleString("en-US")} units`) }))} disabled={!editable} />
            </Field>
            <Field label={pick("Peran penyetuju", "Approver role")} htmlFor="ap-role" hint={pick("Administrator tidak dapat menyetujui perubahan bisnis.", "Administrators cannot approve business changes.")}>
              <Select id="ap-role" value={draft.approvals.approverRole} onValueChange={() => undefined} options={[{ value: "manager", label: pick("Manajer", "Manager") }]} disabled />
            </Field>
          </fieldset>
          <SwitchField id="ap-plan" label={pick("Rencana perlu persetujuan sebelum diterbitkan", "Plans need approval before publication")} description={pick("Mematikan ini membuat perencana dapat menerbitkan rencana langsung.", "Turning this off lets planners publish plans directly.")} checked={draft.approvals.planPublishRequiresApproval} onCheckedChange={(v) => set("approvals", { planPublishRequiresApproval: v })} disabled={!editable} />
        </Panel>
      )}
      {section === "audit" && (
        <Panel title={pick("Audit & Retensi", "Audit & retention")} description={pick("Catatan aktivitas tidak dapat diubah dari alur kerja biasa.", "Audit events are immutable from normal workflows.")} footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label={pick("Periode retensi", "Retention period")} htmlFor="au-ret" hint={pick("Catatan yang lebih lama dari ini akan diarsipkan. Konfirmasi dengan tim kepatuhan.", "Events older than this are archived. Confirm with compliance (backlog §93 item 19).")}>
              <Select id="au-ret" value={String(draft.audit.retentionDays)} onValueChange={(v) => set("audit", { retentionDays: Number(v) })} options={[90, 180, 365, 730, 2555].map((d) => ({ value: String(d), label: d === 2555 ? pick("7 tahun", "7 years") : pick(`${d} hari`, `${d} days`) }))} disabled={!editable} />
            </Field>
          </fieldset>
          <SwitchField id="au-exp" label={pick("Izinkan ekspor riwayat aktivitas", "Allow audit export")} description={pick("Manajer, analis, dan administrator dapat mengunduh riwayat aktivitas sebagai CSV.", "Managers, analysts and administrators can download the audit log as CSV.")} checked={draft.audit.exportEnabled} onCheckedChange={(v) => set("audit", { exportEnabled: v })} disabled={!editable} />
        </Panel>
      )}
      {section === "security" && (
        <Panel title={pick("Keamanan", "Security")} description={pick("Autentikasi ditangani penyedia identitas Anda. Pengaturan ini mengatur sesi di Mesta.", "Authentication is handled by your identity provider. These settings control sessions in Mesta.")} footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label={pick("Durasi sesi", "Session length")} htmlFor="se-len" hint={pick("Pengguna harus masuk lagi setelah periode ini.", "Users must sign in again after this period.")}>
              <Select id="se-len" value={String(draft.security.sessionHours)} onValueChange={(v) => set("security", { sessionHours: Number(v) })} options={[4, 8, 12, 24].map((d) => ({ value: String(d), label: pick(`${d} jam`, `${d} hours`) }))} disabled={!editable} />
            </Field>
            <Field label={pick("Domain email yang diizinkan", "Allowed email domains")} htmlFor="se-dom" hint={pick("Dipisahkan koma. Hanya domain ini yang dapat diundang.", "Comma separated. Only these domains can be invited.")}>
              <Input id="se-dom" value={draft.security.allowedDomains.join(", ")} onChange={(e) => set("security", { allowedDomains: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} disabled={!editable} />
            </Field>
          </fieldset>
          <SwitchField id="se-sso" label={pick("Wajibkan single sign-on", "Require single sign-on")} description={pick("Masuk dengan kata sandi tidak tersedia. Mematikan ini tidak didukung.", "Password sign-in is not available. Disabling this is not supported.")} checked={draft.security.enforceSso} onCheckedChange={() => undefined} disabled />
        </Panel>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title={pick("Simpan pengaturan ruang kerja?", "Save workspace settings?")}
          description={pick(`Berlaku untuk semua orang di ${workspace.name} · ${workspace.environment}.`, `Applies to everyone in ${workspace.name} · ${workspace.environment}.`)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                {pick("Kembali", "Back")}
              </Button>
              <Button variant="primary" disabled={reason.trim().length < 5} loading={save.isPending} onClick={() => save.mutate({ reason })}>
                {pick(`Simpan ${diffs.length} perubahan`, `Save ${diffs.length} change${diffs.length === 1 ? "" : "s"}`)}
              </Button>
            </>
          }
        >
          <ConsequenceSummary rows={diffs.map((d) => ({ label: d.label, value: `${d.from} → ${d.to}`, emphasis: true }))} />
          <InlineAlert tone="info" title={pick("Tercatat di riwayat aktivitas bersama nama dan alasan Anda.", "Recorded in the audit log with your name and reason.")} className="mt-4" />
          <Field className="mt-4" label={pick("Alasan", "Reason")} htmlFor="set-reason" required hint={pick("Minimal 5 karakter.", "At least 5 characters.")}>
            <Textarea id="set-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const LABELS: Record<string, string> = localizedRecord(
  {
    defaultHorizonDays: "Periode bawaan",
    defaultFrequency: "Frekuensi bawaan",
    historyWindowDays: "Rentang historis bawaan",
    deltaThreshold: "Batas perubahan perkiraan",
    intervalWidthThreshold: "Batas lebar rentang",
    freshnessHours: "Batas kebaruan data",
    overrideDeltaThreshold: "Batas perubahan manual (persen)",
    overrideUnitsThreshold: "Batas perubahan manual (unit)",
    planPublishRequiresApproval: "Rencana perlu persetujuan",
    retentionDays: "Retensi audit",
    exportEnabled: "Ekspor audit",
    sessionHours: "Durasi sesi",
    allowedDomains: "Domain yang diizinkan",
  },
  {
    defaultHorizonDays: "Default horizon",
    defaultFrequency: "Default frequency",
    historyWindowDays: "Default history window",
    deltaThreshold: "Forecast change limit",
    intervalWidthThreshold: "Interval width limit",
    freshnessHours: "Data freshness limit",
    overrideDeltaThreshold: "Override threshold (change)",
    overrideUnitsThreshold: "Override threshold (units)",
    planPublishRequiresApproval: "Plans need approval",
    retentionDays: "Audit retention",
    exportEnabled: "Audit export",
    sessionHours: "Session length",
    allowedDomains: "Allowed domains",
  },
);

function show(key: string, v: unknown) {
  if (typeof v === "boolean") return v ? pick("Aktif", "On") : pick("Nonaktif", "Off");
  if (Array.isArray(v)) return v.join(", ") || pick("Tidak ada", "None");
  if (typeof v === "number" && (key.endsWith("Threshold") && v < 5)) return formatPercent(v, 0);
  if (key === "freshnessHours" || key === "sessionHours") return pick(`${v} jam`, `${v} hours`);
  if (key.endsWith("Days")) return pick(`${v} hari`, `${v} days`);
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

