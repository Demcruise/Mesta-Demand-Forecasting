"use client";

import { Check, Copy, KeyRound, Plus, RefreshCw, Send, Trash2, Webhook as WebhookIcon } from "lucide-react";
import * as React from "react";
import type { ApiKey, ApiScope, Webhook, WebhookEvent } from "@/types/domain";
import { API_SCOPES, createApiKey, createWebhook, deleteWebhook, listApiKeys, listWebhooks, revokeApiKey, rotateApiKey, setWebhookEnabled, testWebhook, WEBHOOK_EVENTS } from "@/lib/api/platform";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDate, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { CheckboxField, Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, Drawer, DrawerContent, Tooltip } from "@/components/ui/overlay";
import { Panel } from "@/components/page/page";
import { useToast } from "@/components/ui/toast";
import { StatusBadge, Tag } from "@/components/feedback/status";
import { EmptyState, ErrorState, InlineAlert, PermissionNotice, TableSkeleton } from "@/components/feedback/states";
import { UserIdentity } from "@/components/entities/identity";
import { ChartDataTable } from "@/components/charts/chart-frame";
import { TypedConfirmDialog } from "@/components/governance/typed-confirm";

/** Settings › API & access (PLAT-001, PLAT-002). Administrator only; every change is audited. */
export function ApiAccessSection() {
  const { can } = useSession();
  if (!can("api.manage")) return <PermissionNotice permission="api.manage" message="API keys and webhooks are managed by administrators." />;
  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="info" title="Programmatic access acts on behalf of the workspace.">
        Give each system its own key with the narrowest scopes it needs, set an expiry, and rotate keys when people with access leave.
      </InlineAlert>
      <ApiKeysPanel />
      <WebhooksPanel />
    </div>
  );
}

function SecretReveal({ secret, onDone }: { secret: string; onDone: () => void }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex flex-col gap-3">
      <InlineAlert tone="warning" title="Copy this key now. It will not be shown again.">
        Store it in your secrets manager. If it is lost, rotate the key to issue a new one.
      </InlineAlert>
      <div className="flex items-center gap-2 rounded-md border border-border bg-subtle p-2">
        <code className="min-w-0 flex-1 break-all mono-id text-fg">{secret}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy key"}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          I have stored the key
        </Button>
      </div>
    </div>
  );
}

function ApiKeysPanel() {
  const q = useApiQuery(["api-keys"], listApiKeys);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<ApiScope[]>(["forecasts:read"]);
  const [expiry, setExpiry] = React.useState("90");
  const [secret, setSecret] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<ApiKey | null>(null);
  const [rotating, setRotating] = React.useState<ApiKey | null>(null);
  const inv = [["api-keys"], ["audit"]] as const;
  const create = useApiMutation((c, _v: void) => createApiKey(c, { name, scopes, expiresInDays: expiry === "never" ? null : Number(expiry) }), {
    invalidate: inv,
    success: (r) => `Key “${r.key.name}” created`,
    failure: "The key was not created.",
    onSuccess: (r) => setSecret(r.secret),
  });
  const rotate = useApiMutation((c, id: string) => rotateApiKey(c, id), {
    invalidate: inv,
    success: (r) => `Key “${r.key.name}” rotated`,
    successDescription: "The previous secret stops working immediately.",
    failure: "The key was not rotated.",
    onSuccess: (r) => {
      setRotating(null);
      setSecret(r.secret);
      setCreateOpen(true);
    },
  });
  const revoke = useApiMutation((c, id: string) => revokeApiKey(c, id), { invalidate: inv, success: (k) => `Key “${k.name}” revoked`, failure: "The key was not revoked.", onSuccess: () => setRevoking(null) });

  const openCreate = () => {
    setName("");
    setScopes(["forecasts:read"]);
    setExpiry("90");
    setSecret(null);
    setCreateOpen(true);
  };

  return (
    <Panel
      title="API keys"
      description="Keys for systems that read forecasts or push data. Only the prefix is stored after creation."
      actions={
        <Button size="sm" variant="primary" onClick={openCreate}>
          <Plus aria-hidden /> Create key
        </Button>
      }
      flush
    >
      {q.isPending ? (
        <TableSkeleton rows={3} columns={5} />
      ) : q.isError ? (
        <ErrorState compact what="API keys could not be loaded." error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState compact icon={KeyRound} title="No API keys yet." description="Create a key for each system that needs programmatic access." />
      ) : (
        <ul>
          {q.data.map((k) => (
            <li key={k.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto]">
              <span className="min-w-0">
                <span className="block truncate body-sm font-semibold">{k.name}</span>
                <span className="block mono-id text-fg-tertiary">{k.prefix}••••••••</span>
              </span>
              <span className="hidden min-w-0 flex-wrap gap-1 sm:flex">
                {k.scopes.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </span>
              <span className="hidden text-right text-xs text-fg-secondary sm:block">
                <span className="block">{k.lastUsedAt ? `Used ${formatRelative(k.lastUsedAt)}` : "Never used"}</span>
                <span className={cn("block", k.status === "active" && k.expiresAt && new Date(k.expiresAt).getTime() - Date.now() < 30 * 86_400_000 && "font-semibold text-warning-fg")}>
                  {k.expiresAt ? `${k.status === "expired" ? "Expired" : "Expires"} ${formatDate(k.expiresAt)}` : "No expiry"}
                </span>
              </span>
              <span className="flex items-center justify-end gap-1">
                <StatusBadge status={k.status === "active" ? "active" : k.status === "expired" ? "stale" : "cancelled"} label={k.status === "active" ? "Active" : k.status === "expired" ? "Expired" : "Revoked"} size="sm" />
                {k.status === "active" && (
                  <>
                    <Tooltip content="Rotate key">
                      <Button size="icon-sm" variant="ghost" aria-label={`Rotate ${k.name}`} onClick={() => setRotating(k)}>
                        <RefreshCw aria-hidden />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Revoke key">
                      <Button size="icon-sm" variant="ghost" aria-label={`Revoke ${k.name}`} onClick={() => setRevoking(k)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </Tooltip>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setSecret(null); } }}>
        <DialogContent
          size="md"
          title={secret ? "Your new API key" : "Create API key"}
          description={secret ? undefined : "Name the key after the system that uses it, so it can be traced in the audit log."}
          footer={
            secret ? undefined : (
              <>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={name.trim().length < 3 || scopes.length === 0} loading={create.isPending} onClick={() => create.mutate()}>
                  Create key
                </Button>
              </>
            )
          }
        >
          {secret ? (
            <SecretReveal secret={secret} onDone={() => { setCreateOpen(false); setSecret(null); }} />
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Name" htmlFor="key-name" required>
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Replenishment system" autoFocus />
              </Field>
              <fieldset>
                <legend className="mb-2 label">Scopes</legend>
                <div className="flex flex-col gap-2.5">
                  {API_SCOPES.map((s) => (
                    <CheckboxField key={s.value} id={`scope-${s.value}`} label={`${s.label} (${s.value})`} description={s.description} checked={scopes.includes(s.value)} onCheckedChange={(v) => setScopes((prev) => (v ? [...prev, s.value] : prev.filter((x) => x !== s.value)))} />
                  ))}
                </div>
              </fieldset>
              <Field label="Expiry" htmlFor="key-exp" hint="Short-lived keys limit the damage if one leaks.">
                <Select id="key-exp" value={expiry} onValueChange={setExpiry} options={[{ value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "1 year" }, { value: "never", label: "No expiry (not recommended)" }]} />
              </Field>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TypedConfirmDialog
        open={!!rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        title={`Rotate “${rotating?.name ?? ""}”?`}
        resourceName={rotating?.prefix ?? ""}
        confirmLabel="Rotate key"
        loading={rotate.isPending}
        onConfirm={() => rotating && rotate.mutate(rotating.id)}
        consequences={[
          { label: "Consequence", value: "The current secret stops working immediately. Integrations using it fail until updated.", emphasis: true },
          { label: "Next", value: "A new secret is shown once. Update the system that uses this key." },
        ]}
      />
      <TypedConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke “${revoking?.name ?? ""}”?`}
        resourceName={revoking?.prefix ?? ""}
        confirmLabel="Revoke key"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
        consequences={[
          { label: "Scopes", value: revoking?.scopes.join(", ") },
          { label: "Last used", value: revoking?.lastUsedAt ? formatDateTime(revoking.lastUsedAt) : "Never" },
          { label: "Consequence", value: "Requests with this key are rejected. This cannot be undone.", emphasis: true },
        ]}
      />
    </Panel>
  );
}

function WebhooksPanel() {
  const q = useApiQuery(["webhooks"], listWebhooks);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [events, setEvents] = React.useState<WebhookEvent[]>(["forecast_run.published"]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<Webhook | null>(null);
  const inv = [["webhooks"], ["audit"]] as const;
  const create = useApiMutation((c, _v: void) => createWebhook(c, { url, description, events }), { invalidate: inv, success: "Endpoint added", successDescription: "Send a test event to confirm it receives deliveries.", failure: "The endpoint was not added.", onSuccess: () => setCreateOpen(false) });
  const toggle = useApiMutation((c, v: { id: string; enabled: boolean }) => setWebhookEnabled(c, v.id, v.enabled), { invalidate: inv, failure: "The endpoint was not changed." });
  const remove = useApiMutation((c, id: string) => deleteWebhook(c, id), { invalidate: inv, success: "Endpoint deleted", failure: "The endpoint was not deleted.", onSuccess: () => { setDeleting(null); setOpenId(null); } });
  const toast = useToast();
  const test = useApiMutation((c, id: string) => testWebhook(c, id), {
    invalidate: inv,
    success: (d) => (d.status < 300 ? `Test delivered (HTTP ${d.status})` : null),
    failure: "The test event was not sent.",
    onSuccess: (d) => {
      if (d.status >= 300) toast({ tone: "critical", title: `Test delivery failed (HTTP ${d.status})`, description: "The endpoint did not accept the event. Check that it is reachable and returns 2xx." });
    },
  });
  const open = q.data?.find((w) => w.id === openId) ?? null;
  const host = (u: string) => {
    try {
      return new URL(u).host;
    } catch {
      return u;
    }
  };

  return (
    <Panel
      title="Webhooks"
      description="Endpoints that receive signed events when runs, approvals or plans change."
      actions={
        <Button size="sm" variant="primary" onClick={() => { setUrl(""); setDescription(""); setEvents(["forecast_run.published"]); setCreateOpen(true); }}>
          <Plus aria-hidden /> Add endpoint
        </Button>
      }
      flush
    >
      {q.isPending ? (
        <TableSkeleton rows={2} columns={4} />
      ) : q.isError ? (
        <ErrorState compact what="Webhooks could not be loaded." error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState compact icon={WebhookIcon} title="No webhook endpoints." description="Add an endpoint to push events to replenishment or alerting systems." />
      ) : (
        <ul>
          {q.data.map((w) => {
            const failures = w.deliveries.slice(0, 5).filter((d) => d.status >= 300).length;
            return (
              <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0">
                <button type="button" onClick={() => setOpenId(w.id)} className="min-w-0 text-left">
                  <span className="block truncate body-sm font-semibold hover:text-primary hover:underline">{host(w.url)}</span>
                  <span className="block truncate caption">
                    {w.description || w.url} · {pluralize(w.events.length, "event")}
                  </span>
                  {failures > 0 && <span className="mt-0.5 block text-xs font-semibold text-critical-fg">{failures} of the last 5 deliveries failed</span>}
                </button>
                <span className="flex items-center gap-2">
                  <Switch checked={w.enabled} onCheckedChange={(v) => toggle.mutate({ id: w.id, enabled: v })} aria-label={`${w.enabled ? "Disable" : "Enable"} ${host(w.url)}`} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          title="Add webhook endpoint"
          description="Events are sent as JSON with an HMAC signature header."
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!url.trim() || events.length === 0} loading={create.isPending} onClick={() => create.mutate()}>
                Add endpoint
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Endpoint URL" htmlFor="wh-url" required hint="Must use HTTPS.">
              <Input id="wh-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks/mesta" autoFocus />
            </Field>
            <Field label="Description" htmlFor="wh-desc" optional>
              <Input id="wh-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this endpoint does" />
            </Field>
            <fieldset>
              <legend className="mb-2 label">Events</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <CheckboxField key={ev.value} id={`ev-${ev.value}`} label={ev.label} description={ev.value} checked={events.includes(ev.value)} onCheckedChange={(v) => setEvents((prev) => (v ? [...prev, ev.value] : prev.filter((x) => x !== ev.value)))} />
                ))}
              </div>
            </fieldset>
          </div>
        </DialogContent>
      </Dialog>

      <Drawer open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && (
          <DrawerContent
            size="lg"
            eyebrow="Webhook endpoint"
            title={host(open.url)}
            description={open.url}
            footer={
              <>
                <Button variant="danger-outline" onClick={() => setDeleting(open)}>
                  <Trash2 aria-hidden /> Delete endpoint
                </Button>
                <Button variant="primary" loading={test.isPending} onClick={() => test.mutate(open.id)}>
                  <Send aria-hidden /> Send test event
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={open.enabled ? "active" : "paused"} label={open.enabled ? "Enabled" : "Disabled"} />
                <UserIdentity userId={open.createdBy} secondary={`Added ${formatDate(open.createdAt)}`} />
              </div>
              {open.deliveries[0] && open.deliveries[0].status >= 300 && (
                <InlineAlert tone="critical" title={`Last delivery failed with HTTP ${open.deliveries[0].status}.`}>
                  Deliveries are retried 3 times with backoff. Check that the endpoint is reachable and returns 2xx within 10 seconds.
                </InlineAlert>
              )}
              <section>
                <h3 className="mb-2 card-title">Subscribed events</h3>
                <div className="flex flex-wrap gap-1.5">
                  {open.events.map((e) => (
                    <Tag key={e}>{e}</Tag>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="mb-2 card-title">Recent deliveries</h3>
                {open.deliveries.length === 0 ? (
                  <p className="caption">No deliveries yet. Send a test event.</p>
                ) : (
                  <ChartDataTable
                    caption="Recent webhook deliveries"
                    columns={[{ key: "at", label: "Time" }, { key: "event", label: "Event" }, { key: "status", label: "Response", numeric: true }, { key: "ms", label: "Duration", numeric: true }, { key: "attempt", label: "Attempts", numeric: true }]}
                    rows={open.deliveries.slice(0, 20).map((d) => ({
                      at: formatDateTime(d.at),
                      event: <span className="mono-id">{d.event}</span>,
                      status: <span className={cn("font-semibold", d.status >= 300 ? "text-critical-fg" : "text-success-fg")}>{d.status}</span>,
                      ms: `${d.durationMs.toLocaleString("en-US")} ms`,
                      attempt: d.attempt,
                    }))}
                  />
                )}
              </section>
            </div>
          </DrawerContent>
        )}
      </Drawer>

      <TypedConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete webhook endpoint?"
        resourceName={deleting ? host(deleting.url) : ""}
        confirmLabel="Delete endpoint"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        consequences={[
          { label: "Endpoint", value: deleting?.url },
          { label: "Consequence", value: "Events stop immediately and the delivery history is removed.", emphasis: true },
          { label: "Alternative", value: "Disable the endpoint to pause deliveries and keep its history." },
        ]}
      />
    </Panel>
  );
}
