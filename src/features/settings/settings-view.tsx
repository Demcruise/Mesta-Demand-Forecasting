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
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { RadioCards, SwitchField } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader, Panel } from "@/components/page/page";
import { EmptyState, ErrorState, InlineAlert, PageSkeleton, PermissionNotice } from "@/components/feedback/states";
import { Tag } from "@/components/feedback/status";
import { ConsequenceSummary } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import type { SectionKey } from "./sections";


const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }>; group: "Personal" | "Workspace administration" }[] = [
  { key: "personal", label: "Personal", icon: UserRound, group: "Personal" },
  { key: "notifications", label: "Notifications", icon: Bell, group: "Personal" },
  { key: "workspace", label: "Workspace", icon: Building2, group: "Workspace administration" },
  { key: "forecasting", label: "Forecasting", icon: Workflow, group: "Workspace administration" },
  { key: "data", label: "Data & integrations", icon: Database, group: "Workspace administration" },
  { key: "approvals", label: "Approvals", icon: ShieldCheck, group: "Workspace administration" },
  { key: "roles", label: "Roles & permissions", icon: Users, group: "Workspace administration" },
  { key: "audit", label: "Audit & retention", icon: ScrollText, group: "Workspace administration" },
  { key: "security", label: "Security", icon: Lock, group: "Workspace administration" },
  { key: "api", label: "API & access", icon: KeyRound, group: "Workspace administration" },
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
      <PageHeader title="Settings" description="Personal preferences apply only to you. Workspace settings apply to everyone in this workspace and are recorded in the audit log." />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-[calc(var(--topbar-h)+1.5rem)] lg:self-start">
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
          {current.key === "personal" ? <PersonalSection /> : current.key === "api" ? <ApiSection /> : current.key === "roles" ? <RolesSection /> : <WorkspaceSections section={current.key} />}
        </div>
      </div>
    </PageContainer>
  );
}

function PersonalSection() {
  const { theme, density, sidebarCollapsed, setPreference } = usePreferences();
  const { session } = useSession();
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Profile" description="Managed by your identity provider.">
        <DescriptionList
          columns={2}
          items={[
            { label: "Name", value: session.name },
            { label: "Email", value: session.email },
            { label: "Role in this workspace", value: ROLE_LABELS[session.role] },
            { label: "Signed in via", value: session.idp },
          ]}
        />
      </Panel>
      <Panel title="Appearance" description="Saved in this browser only.">
        <div className="flex flex-col gap-5">
          <Field label="Theme" htmlFor="theme">
            <RadioCards
              aria-label="Theme"
              columns={3}
              value={theme}
              onValueChange={(v) => setPreference("theme", v as typeof theme)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "Match system" },
              ]}
            />
          </Field>
          <Field label="Default table density" htmlFor="density" hint="Tables can still be switched individually.">
            <RadioCards
              aria-label="Default table density"
              columns={2}
              value={density}
              onValueChange={(v) => setPreference("density", v as typeof density)}
              options={[
                { value: "comfortable", label: "Comfortable", description: "54px rows" },
                { value: "compact", label: "Compact", description: "42px rows" },
              ]}
            />
          </Field>
          <SwitchField id="sidebar" label="Collapse the sidebar" description="Show icons only to give tables more room." checked={sidebarCollapsed} onCheckedChange={(v) => setPreference("sidebarCollapsed", v)} />
        </div>
      </Panel>
      <Panel title="Formats">
        <DescriptionList
          columns={3}
          items={[
            { label: "Dates", value: "25 Sep 2026" },
            { label: "Numbers", value: "12,440" },
            { label: "Changes", value: "+4.5% / −3.2%" },
          ]}
        />
        <p className="mt-3 caption">One product-wide convention (backlog §65), so exports and screenshots read the same for everyone.</p>
      </Panel>
    </div>
  );
}

function RolesSection() {
  return (
    <Panel title="Roles & permissions">
      <p className="body-sm text-fg-secondary">Role assignments and the permission matrix are managed on the Users & roles page.</p>
      <Link href="/administration/users" className={cn(buttonVariants({ variant: "secondary" }), "mt-3")}>
        Open users & roles
      </Link>
    </Panel>
  );
}

function ApiSection() {
  return (
    <Panel>
      <EmptyState
        icon={KeyRound}
        title="API access is not available yet."
        description="API keys, service accounts and webhooks are planned (backlog PLAT-001 and PLAT-002). They will require explicit confirmation, scoped access and rotation."
      />
    </Panel>
  );
}

type Draft = WorkspaceSettings;

function WorkspaceSections({ section }: { section: Exclude<SectionKey, "personal" | "api" | "roles"> }) {
  const { can, workspace } = useSession();
  const q = useApiQuery(["settings"], getSettings);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (q.data) setDraft(structuredClone(q.data.settings));
  }, [q.data, section]);

  const settingsKey: keyof WorkspaceSettings | null =
    section === "forecasting" ? "forecasting" : section === "approvals" ? "approvals" : section === "notifications" ? "notifications" : section === "audit" ? "audit" : section === "security" ? "security" : null;
  const secondaryKey: keyof WorkspaceSettings | null = section === "forecasting" ? "exceptions" : null;
  const personal = section === "notifications";
  const editable = personal || can("settings.workspace");

  const save = useApiMutation(
    async (c, v: { reason: string }) => {
      if (!draft || !settingsKey) return;
      await updateSettings(c, settingsKey, draft[settingsKey] as never, v.reason);
      if (secondaryKey) await updateSettings(c, secondaryKey, draft[secondaryKey] as never, v.reason);
    },
    { invalidate: [["settings"], ["notifications"]], success: "Settings saved", successDescription: personal ? undefined : "The change is recorded in the audit log.", failure: "Settings were not saved.", onSuccess: () => setConfirm(false) },
  );

  if (q.isPending || !draft) return <PageSkeleton />;
  if (q.isError) return <ErrorState what="Settings could not be loaded." error={q.error} onRetry={() => q.refetch()} />;
  const saved = q.data.settings;
  const diffs = diffSettings(saved, draft, [settingsKey, secondaryKey].filter(Boolean) as (keyof WorkspaceSettings)[]);
  const dirty = diffs.length > 0;
  const set = <K extends keyof WorkspaceSettings>(key: K, patch: Partial<WorkspaceSettings[K]>) => setDraft((d) => (d ? { ...d, [key]: { ...d[key], ...patch } } : d));

  const footer =
    settingsKey && editable ? (
      <>
        <span className="caption">{dirty ? `${diffs.length} unsaved change${diffs.length === 1 ? "" : "s"}` : "No unsaved changes"}</span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(structuredClone(saved))}>
            Discard changes
          </Button>
          <Button variant="primary" disabled={!dirty} onClick={() => (personal ? save.mutate({ reason: "" }) : (setReason(""), setConfirm(true)))} loading={personal && save.isPending}>
            Save changes
          </Button>
        </div>
      </>
    ) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {!editable && <PermissionNotice permission="settings.workspace" message="These settings are read-only for your role." />}
      {section === "workspace" && (
        <Panel title="Workspace">
          <DescriptionList
            columns={2}
            items={[
              { label: "Name", value: workspace.name },
              { label: "Environment", value: <Tag tone={workspace.environment === "Production" ? "primary" : "info"}>{workspace.environment}</Tag> },
              { label: "Organisation", value: workspace.organization },
              { label: "Region", value: workspace.region },
              { label: "Status", value: workspace.status === "active" ? "Active" : workspace.status === "degraded" ? "Degraded" : "Maintenance" },
            ]}
          />
          <p className="mt-3 caption">Workspace identity is provisioned by Mesta support. Contact them to rename or move a workspace.</p>
        </Panel>
      )}
      {section === "data" && (
        <Panel title="Data & integrations" footer={<Link href="/administration/integrations" className="text-xs font-semibold text-primary hover:underline">Manage integrations →</Link>}>
          <p className="body-sm text-fg-secondary">Sources, schedules and field mappings are managed in Integrations. Data freshness thresholds are set in Forecasting.</p>
        </Panel>
      )}
      {section === "forecasting" && (
        <Panel title="Forecasting defaults" description="Applied when someone creates a new forecast run. Existing runs are unchanged." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Default horizon" htmlFor="def-h">
              <Select id="def-h" value={String(draft.forecasting.defaultHorizonDays)} onValueChange={(v) => set("forecasting", { defaultHorizonDays: Number(v) })} options={[7, 14, 28, 30, 60, 90].map((d) => ({ value: String(d), label: `${d} days` }))} disabled={!editable} />
            </Field>
            <Field label="Default frequency" htmlFor="def-f">
              <Select id="def-f" value={draft.forecasting.defaultFrequency} onValueChange={(v) => set("forecasting", { defaultFrequency: v as "daily" | "weekly" })} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} disabled={!editable} />
            </Field>
            <Field label="Default history window" htmlFor="def-w" hint="Days of history used by default.">
              <Select id="def-w" value={String(draft.forecasting.historyWindowDays)} onValueChange={(v) => set("forecasting", { historyWindowDays: Number(v) })} options={[180, 365, 730].map((d) => ({ value: String(d), label: `${d} days` }))} disabled={!editable} />
            </Field>
            <Field label="Default model" htmlFor="def-m" hint="Changing the default model requires Manager approval.">
              <div className="flex items-center gap-2">
                <Input id="def-m" readOnly value={q.data.models.find((m) => m.id === draft.forecasting.defaultModelId)?.name + " " + (q.data.models.find((m) => m.id === draft.forecasting.defaultModelId)?.version ?? "")} />
                <Link href="/models" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  Registry
                </Link>
              </div>
            </Field>
          </fieldset>
          <h4 className="mb-3 mt-6 card-title">Exception thresholds</h4>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-3">
            <Field label="Forecast change" htmlFor="th-delta" hint="Raise an exception above this change vs the previous run.">
              <Select id="th-delta" value={String(draft.exceptions.deltaThreshold)} onValueChange={(v) => set("exceptions", { deltaThreshold: Number(v) })} options={[0.1, 0.15, 0.2, 0.25].map((d) => ({ value: String(d), label: formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label="Interval width" htmlFor="th-width" hint="Relative width of the 80% interval.">
              <Select id="th-width" value={String(draft.exceptions.intervalWidthThreshold)} onValueChange={(v) => set("exceptions", { intervalWidthThreshold: Number(v) })} options={[0.6, 0.75, 0.9, 1.2].map((d) => ({ value: String(d), label: formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label="Data freshness" htmlFor="th-fresh" hint="Hours before data counts as delayed.">
              <Select id="th-fresh" value={String(draft.exceptions.freshnessHours)} onValueChange={(v) => set("exceptions", { freshnessHours: Number(v) })} options={[6, 12, 24, 48].map((d) => ({ value: String(d), label: `${d} hours` }))} disabled={!editable} />
            </Field>
          </fieldset>
          <p className="mt-3 caption">Threshold changes apply from the next forecast run.</p>
        </Panel>
      )}
      {section === "approvals" && (
        <Panel title="Approval policies" description="Which changes need a second person before they take effect." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Override threshold (change)" htmlFor="ap-pct" hint="Overrides above this change need approval.">
              <Select id="ap-pct" value={String(draft.approvals.overrideDeltaThreshold)} onValueChange={(v) => set("approvals", { overrideDeltaThreshold: Number(v) })} options={[0, 0.02, 0.05, 0.1].map((d) => ({ value: String(d), label: d === 0 ? "Every override" : formatPercent(d, 0) }))} disabled={!editable} />
            </Field>
            <Field label="Override threshold (units)" htmlFor="ap-units" hint="Overrides above this many units need approval.">
              <Select id="ap-units" value={String(draft.approvals.overrideUnitsThreshold)} onValueChange={(v) => set("approvals", { overrideUnitsThreshold: Number(v) })} options={[1000, 5000, 10000, 50000].map((d) => ({ value: String(d), label: `${d.toLocaleString("en-US")} units` }))} disabled={!editable} />
            </Field>
            <Field label="Approver role" htmlFor="ap-role" hint="Administrators cannot approve business changes.">
              <Select id="ap-role" value={draft.approvals.approverRole} onValueChange={() => undefined} options={[{ value: "manager", label: "Manager" }]} disabled />
            </Field>
          </fieldset>
          <SwitchField id="ap-plan" label="Plans need approval before publication" description="Turning this off lets planners publish plans directly." checked={draft.approvals.planPublishRequiresApproval} onCheckedChange={(v) => set("approvals", { planPublishRequiresApproval: v })} disabled={!editable} />
        </Panel>
      )}
      {section === "notifications" && (
        <Panel title="Notifications" description="Which events notify you in the app. Approval requests addressed to you are always shown." footer={footer}>
          <div className="divide-y divide-border-subtle">
            {(
              [
                ["forecast_completed", "Forecast completed", "A run you can see finished processing."],
                ["forecast_failed", "Forecast failed", "A run stopped with an error."],
                ["data_quality", "Data quality issue", "A blocking or warning data check failed."],
                ["data_freshness", "Data freshness", "A source is delayed or failing."],
                ["approval_requested", "Approval requested", "Always on."],
                ["approval_completed", "Approval completed", "A request you made or follow was decided."],
                ["exception_opened", "Exception opened", "Can be noisy after each daily refresh."],
                ["scenario_completed", "Scenario simulated", "A scenario simulation finished."],
                ["model_issue", "Model issue", "Drift or degradation detected on a production model."],
              ] as const
            ).map(([key, label, desc]) => (
              <SwitchField key={key} id={`n-${key}`} label={label} description={desc} checked={draft.notifications[key] !== false} disabled={key === "approval_requested"} onCheckedChange={(v) => setDraft((d) => (d ? { ...d, notifications: { ...d.notifications, [key]: v } } : d))} />
            ))}
          </div>
        </Panel>
      )}
      {section === "audit" && (
        <Panel title="Audit & retention" description="Audit events are immutable from normal workflows." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Retention period" htmlFor="au-ret" hint="Events older than this are archived. Confirm with compliance (backlog §93 item 19).">
              <Select id="au-ret" value={String(draft.audit.retentionDays)} onValueChange={(v) => set("audit", { retentionDays: Number(v) })} options={[90, 180, 365, 730, 2555].map((d) => ({ value: String(d), label: d === 2555 ? "7 years" : `${d} days` }))} disabled={!editable} />
            </Field>
          </fieldset>
          <SwitchField id="au-exp" label="Allow audit export" description="Managers, analysts and administrators can download the audit log as CSV." checked={draft.audit.exportEnabled} onCheckedChange={(v) => set("audit", { exportEnabled: v })} disabled={!editable} />
        </Panel>
      )}
      {section === "security" && (
        <Panel title="Security" description="Authentication is handled by your identity provider. These settings control sessions in Mesta." footer={footer}>
          <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
            <Field label="Session length" htmlFor="se-len" hint="Users sign in again after this period.">
              <Select id="se-len" value={String(draft.security.sessionHours)} onValueChange={(v) => set("security", { sessionHours: Number(v) })} options={[4, 8, 12, 24].map((d) => ({ value: String(d), label: `${d} hours` }))} disabled={!editable} />
            </Field>
            <Field label="Allowed email domains" htmlFor="se-dom" hint="Comma separated. Only these domains can be invited.">
              <Input id="se-dom" value={draft.security.allowedDomains.join(", ")} onChange={(e) => set("security", { allowedDomains: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} disabled={!editable} />
            </Field>
          </fieldset>
          <SwitchField id="se-sso" label="Require single sign-on" description="Password sign-in is not available. Turning this off is not supported." checked={draft.security.enforceSso} onCheckedChange={() => undefined} disabled />
        </Panel>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title="Save workspace settings?"
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
          <InlineAlert tone="info" title="Recorded in the audit log with your name and reason." className="mt-4" />
          <Field className="mt-4" label="Reason" htmlFor="set-reason" required hint="At least 5 characters.">
            <Textarea id="set-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const LABELS: Record<string, string> = {
  defaultHorizonDays: "Default horizon",
  defaultFrequency: "Default frequency",
  historyWindowDays: "Default history window",
  deltaThreshold: "Forecast change threshold",
  intervalWidthThreshold: "Interval width threshold",
  freshnessHours: "Freshness threshold",
  overrideDeltaThreshold: "Override threshold (change)",
  overrideUnitsThreshold: "Override threshold (units)",
  planPublishRequiresApproval: "Plans need approval",
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

