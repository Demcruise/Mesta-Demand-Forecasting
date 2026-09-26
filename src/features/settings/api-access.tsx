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
import { pick } from "@/lib/i18n";

/** Settings › API & access (PLAT-001, PLAT-002). Administrator only; every change is audited. */
export function ApiAccessSection() {
  const { can } = useSession();
  if (!can("api.manage")) return <PermissionNotice permission="api.manage" message={pick("API key dan webhook dikelola oleh administrator.", "API keys and webhooks are managed by administrators.")} />;
  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="info" title={pick("Akses programatik bertindak atas nama ruang kerja.", "Programmatic access acts on behalf of the workspace.")}>
        {pick("Beri setiap sistem key sendiri dengan cakupan sesempit mungkin, tetapkan masa berlaku, dan putar key saat orang yang punya akses keluar.", "Give each system its own key with the narrowest scopes it needs, set an expiry, and rotate keys when people with access leave.")}
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
      <InlineAlert tone="warning" title={pick("Salin key ini sekarang. Key tidak akan ditampilkan lagi.", "Copy this key now. It will not be shown again.")}>
        {pick("Simpan di pengelola rahasia Anda. Jika hilang, putar key untuk menerbitkan yang baru.", "Store it in your secrets manager. If it is lost, rotate the key to issue a new one.")}
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
          {copied ? pick("Tersalin", "Copied") : pick("Salin key", "Copy key")}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          {pick("Key sudah saya simpan", "I have stored the key")}
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
    success: (r) => pick(`Key “${r.key.name}” dibuat`, `Key “${r.key.name}” created`),
    failure: pick("Key tidak dapat dibuat.", "The key was not created."),
    onSuccess: (r) => setSecret(r.secret),
  });
  const rotate = useApiMutation((c, id: string) => rotateApiKey(c, id), {
    invalidate: inv,
    success: (r) => pick(`Key “${r.key.name}” diputar`, `Key “${r.key.name}” rotated`),
    successDescription: pick("Rahasia sebelumnya langsung tidak berlaku.", "The previous secret stops working immediately."),
    failure: pick("Key tidak dapat diputar.", "The key was not rotated."),
    onSuccess: (r) => {
      setRotating(null);
      setSecret(r.secret);
      setCreateOpen(true);
    },
  });
  const revoke = useApiMutation((c, id: string) => revokeApiKey(c, id), { invalidate: inv, success: (k) => pick(`Key “${k.name}” dicabut`, `Key “${k.name}” revoked`), failure: pick("Key tidak dapat dicabut.", "The key was not revoked."), onSuccess: () => setRevoking(null) });

  const openCreate = () => {
    setName("");
    setScopes(["forecasts:read"]);
    setExpiry("90");
    setSecret(null);
    setCreateOpen(true);
  };

  return (
    <Panel
      title={pick("API key", "API keys")}
      description={pick("Key untuk sistem yang membaca perkiraan atau mengirim data. Hanya prefiksnya yang disimpan setelah dibuat.", "Keys for systems that read forecasts or push data. Only the prefix is stored after creation.")}
      actions={
        <Button size="sm" variant="primary" onClick={openCreate}>
          <Plus aria-hidden /> {pick("Buat key", "Create key")}
        </Button>
      }
      flush
    >
      {q.isPending ? (
        <TableSkeleton rows={3} columns={5} />
      ) : q.isError ? (
        <ErrorState compact what={pick("API key tidak dapat dimuat.", "API keys could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState compact icon={KeyRound} title={pick("Belum ada API key.", "No API keys yet.")} description={pick("Buat key untuk setiap sistem yang memerlukan akses programatik.", "Create a key for each system that needs programmatic access.")} />
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
                <span className="block">{k.lastUsedAt ? pick(`Dipakai ${formatRelative(k.lastUsedAt)}`, `Used ${formatRelative(k.lastUsedAt)}`) : pick("Belum pernah dipakai", "Never used")}</span>
                <span className={cn("block", k.status === "active" && k.expiresAt && new Date(k.expiresAt).getTime() - Date.now() < 30 * 86_400_000 && "font-semibold text-warning-fg")}>
                  {k.expiresAt ? pick(`${k.status === "expired" ? "Kedaluwarsa" : "Berakhir"} ${formatDate(k.expiresAt)}`, `${k.status === "expired" ? "Expired" : "Expires"} ${formatDate(k.expiresAt)}`) : pick("Tanpa kedaluwarsa", "No expiry")}
                </span>
              </span>
              <span className="flex items-center justify-end gap-1">
                <StatusBadge status={k.status === "active" ? "active" : k.status === "expired" ? "stale" : "cancelled"} label={k.status === "active" ? pick("Aktif", "Active") : k.status === "expired" ? pick("Kedaluwarsa", "Expired") : pick("Dicabut", "Revoked")} size="sm" />
                {k.status === "active" && (
                  <>
                    <Tooltip content={pick("Putar key", "Rotate key")}>
                      <Button size="icon-sm" variant="ghost" aria-label={pick(`Putar ${k.name}`, `Rotate ${k.name}`)} onClick={() => setRotating(k)}>
                        <RefreshCw aria-hidden />
                      </Button>
                    </Tooltip>
                    <Tooltip content={pick("Cabut key", "Revoke key")}>
                      <Button size="icon-sm" variant="ghost" aria-label={pick(`Cabut ${k.name}`, `Revoke ${k.name}`)} onClick={() => setRevoking(k)}>
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
          title={secret ? pick("API key baru Anda", "Your new API key") : pick("Buat API key", "Create API key")}
          description={secret ? undefined : pick("Beri nama key sesuai sistem yang memakainya, agar dapat ditelusuri di riwayat aktivitas.", "Name the key after the system that uses it, so it can be traced in the audit log.")}
          footer={
            secret ? undefined : (
              <>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  {pick("Batal", "Cancel")}
                </Button>
                <Button variant="primary" disabled={name.trim().length < 3 || scopes.length === 0} loading={create.isPending} onClick={() => create.mutate()}>
                  {pick("Buat key", "Create key")}
                </Button>
              </>
            )
          }
        >
          {secret ? (
            <SecretReveal secret={secret} onDone={() => { setCreateOpen(false); setSecret(null); }} />
          ) : (
            <div className="flex flex-col gap-4">
              <Field label={pick("Nama", "Name")} htmlFor="key-name" required>
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={pick("mis. Sistem pengisian ulang", "e.g. Replenishment system")} autoFocus />
              </Field>
              <fieldset>
                <legend className="mb-2 label">{pick("Cakupan izin", "Permission scope")}</legend>
                <div className="flex flex-col gap-2.5">
                  {API_SCOPES.map((s) => (
                    <CheckboxField key={s.value} id={`scope-${s.value}`} label={`${s.label} (${s.value})`} description={s.description} checked={scopes.includes(s.value)} onCheckedChange={(v) => setScopes((prev) => (v ? [...prev, s.value] : prev.filter((x) => x !== s.value)))} />
                  ))}
                </div>
              </fieldset>
              <Field label={pick("Kedaluwarsa", "Expires")} htmlFor="key-exp" hint={pick("Key berumur pendek membatasi dampak bila bocor.", "Short-lived keys limit the blast radius if leaked.")}>
                <Select id="key-exp" value={expiry} onValueChange={setExpiry} options={[{ value: "30", label: pick("30 hari", "30 days") }, { value: "90", label: pick("90 hari", "90 days") }, { value: "365", label: pick("1 tahun", "1 year") }, { value: "never", label: pick("Tanpa kedaluwarsa (tidak disarankan)", "No expiry (not recommended)") }]} />
              </Field>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TypedConfirmDialog
        open={!!rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        title={pick(`Putar “${rotating?.name ?? ""}”?`, `Rotate “${rotating?.name ?? ""}”?`)}
        resourceName={rotating?.prefix ?? ""}
        confirmLabel={pick("Putar key", "Rotate key")}
        loading={rotate.isPending}
        onConfirm={() => rotating && rotate.mutate(rotating.id)}
        consequences={[
          { label: pick("Dampak", "Impact"), value: pick("Rahasia saat ini langsung tidak berlaku. Integrasi yang memakainya akan gagal sampai diperbarui.", "The current secret stops working immediately. Integrations using it fail until updated."), emphasis: true },
          { label: pick("Berikutnya", "Next"), value: pick("Rahasia baru ditampilkan sekali. Perbarui sistem yang memakai key ini.", "A new secret is shown once. Update the system that uses this key.") },
        ]}
      />
      <TypedConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={pick(`Cabut “${revoking?.name ?? ""}”?`, `Revoke “${revoking?.name ?? ""}”?`)}
        resourceName={revoking?.prefix ?? ""}
        confirmLabel={pick("Cabut key", "Revoke key")}
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
        consequences={[
          { label: pick("Cakupan", "Scopes"), value: revoking?.scopes.join(", ") },
          { label: pick("Terakhir dipakai", "Last used"), value: revoking?.lastUsedAt ? formatDateTime(revoking.lastUsedAt) : pick("Belum pernah", "Never") },
          { label: pick("Dampak", "Impact"), value: pick("Permintaan dengan key ini akan ditolak. Tindakan ini tidak dapat dibatalkan.", "Requests with this key will be rejected. This cannot be undone."), emphasis: true },
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
  const create = useApiMutation((c, _v: void) => createWebhook(c, { url, description, events }), { invalidate: inv, success: pick("Endpoint ditambahkan", "Endpoint added"), successDescription: pick("Kirim kejadian uji untuk memastikan endpoint menerima pengiriman.", "Send a test event to confirm the endpoint accepts deliveries."), failure: pick("Endpoint tidak dapat ditambahkan.", "The endpoint could not be added."), onSuccess: () => setCreateOpen(false) });
  const toggle = useApiMutation((c, v: { id: string; enabled: boolean }) => setWebhookEnabled(c, v.id, v.enabled), { invalidate: inv, failure: pick("Endpoint tidak dapat diubah.", "The endpoint could not be updated.") });
  const remove = useApiMutation((c, id: string) => deleteWebhook(c, id), { invalidate: inv, success: pick("Endpoint dihapus", "Endpoint deleted"), failure: pick("Endpoint tidak dapat dihapus.", "The endpoint could not be deleted."), onSuccess: () => { setDeleting(null); setOpenId(null); } });
  const toast = useToast();
  const test = useApiMutation((c, id: string) => testWebhook(c, id), {
    invalidate: inv,
    success: (d) => (d.status < 300 ? pick(`Uji terkirim (HTTP ${d.status})`, `Test delivered (HTTP ${d.status})`) : null),
    failure: pick("Kejadian uji tidak terkirim.", "The test event could not be sent."),
    onSuccess: (d) => {
      if (d.status >= 300) toast({ tone: "critical", title: pick(`Pengiriman uji gagal (HTTP ${d.status})`, `Test delivery failed (HTTP ${d.status})`), description: pick("Endpoint tidak menerima kejadian. Pastikan endpoint dapat dijangkau dan mengembalikan 2xx.", "The endpoint did not accept the event. Check it is reachable and returns 2xx.") });
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
      title="Webhook"
      description={pick("Endpoint yang menerima kejadian bertanda tangan saat proses, persetujuan, atau rencana berubah.", "Endpoints that receive signed events when runs, approvals or plans change.")}
      actions={
        <Button size="sm" variant="primary" onClick={() => { setUrl(""); setDescription(""); setEvents(["forecast_run.published"]); setCreateOpen(true); }}>
          <Plus aria-hidden /> {pick("Tambah endpoint", "Add endpoint")}
        </Button>
      }
      flush
    >
      {q.isPending ? (
        <TableSkeleton rows={2} columns={4} />
      ) : q.isError ? (
        <ErrorState compact what={pick("Webhook tidak dapat dimuat.", "Webhooks could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState compact icon={WebhookIcon} title={pick("Belum ada endpoint webhook.", "No webhook endpoints yet.")} description={pick("Tambahkan endpoint untuk mengirim kejadian ke sistem pengisian ulang atau peringatan.", "Add an endpoint to deliver events to replenishment or alerting systems.")} />
      ) : (
        <ul>
          {q.data.map((w) => {
            const failures = w.deliveries.slice(0, 5).filter((d) => d.status >= 300).length;
            return (
              <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0">
                <button type="button" onClick={() => setOpenId(w.id)} className="min-w-0 text-left">
                  <span className="block truncate body-sm font-semibold hover:text-primary hover:underline">{host(w.url)}</span>
                  <span className="block truncate caption">
                    {w.description || w.url} · {pick(`${w.events.length} kejadian`, pluralize(w.events.length, "event"))}
                  </span>
                  {failures > 0 && <span className="mt-0.5 block text-xs font-semibold text-critical-fg">{pick(`${failures} dari 5 pengiriman terakhir gagal`, `${failures} of the last 5 deliveries failed`)}</span>}
                </button>
                <span className="flex items-center gap-2">
                  <Switch checked={w.enabled} onCheckedChange={(v) => toggle.mutate({ id: w.id, enabled: v })} aria-label={`${w.enabled ? pick("Nonaktifkan", "Disable") : pick("Aktifkan", "Enable")} ${host(w.url)}`} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          title={pick("Tambah endpoint webhook", "Add webhook endpoint")}
          description={pick("Kejadian dikirim sebagai JSON dengan header tanda tangan HMAC.", "Events are delivered as JSON with an HMAC signature header.")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                {pick("Batal", "Cancel")}
              </Button>
              <Button variant="primary" disabled={!url.trim() || events.length === 0} loading={create.isPending} onClick={() => create.mutate()}>
                {pick("Tambah endpoint", "Add endpoint")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label={pick("URL endpoint", "Endpoint URL")} htmlFor="wh-url" required hint={pick("Harus memakai HTTPS.", "Must use HTTPS.")}>
              <Input id="wh-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks/mesta" autoFocus />
            </Field>
            <Field label={pick("Deskripsi", "Description")} htmlFor="wh-desc" optional>
              <Input id="wh-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={pick("Untuk apa endpoint ini", "What this endpoint is for")} />
            </Field>
            <fieldset>
              <legend className="mb-2 label">{pick("Kejadian", "Events")}</legend>
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
            eyebrow={pick("Endpoint webhook", "Webhook endpoint")}
            title={host(open.url)}
            description={open.url}
            footer={
              <>
                <Button variant="danger-outline" onClick={() => setDeleting(open)}>
                  <Trash2 aria-hidden /> {pick("Hapus endpoint", "Delete endpoint")}
                </Button>
                <Button variant="primary" loading={test.isPending} onClick={() => test.mutate(open.id)}>
                  <Send aria-hidden /> {pick("Kirim kejadian uji", "Send test event")}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={open.enabled ? "active" : "paused"} label={open.enabled ? pick("Aktif", "Enabled") : pick("Nonaktif", "Disabled")} />
                <UserIdentity userId={open.createdBy} secondary={pick(`Ditambahkan ${formatDate(open.createdAt)}`, `Added ${formatDate(open.createdAt)}`)} />
              </div>
              {open.deliveries[0] && open.deliveries[0].status >= 300 && (
                <InlineAlert tone="critical" title={pick(`Pengiriman terakhir gagal dengan HTTP ${open.deliveries[0].status}.`, `Last delivery failed with HTTP ${open.deliveries[0].status}.`)}>
                  {pick("Pengiriman dicoba ulang 3 kali dengan jeda. Pastikan endpoint dapat dijangkau dan membalas 2xx dalam 10 detik.", "Deliveries are retried 3 times with backoff. Check that the endpoint is reachable and returns 2xx within 10 seconds.")}
                </InlineAlert>
              )}
              <section>
                <h3 className="mb-2 card-title">{pick("Kejadian yang diikuti", "Subscribed events")}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {open.events.map((e) => (
                    <Tag key={e}>{e}</Tag>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="mb-2 card-title">{pick("Pengiriman terbaru", "Recent deliveries")}</h3>
                {open.deliveries.length === 0 ? (
                  <p className="caption">{pick("Belum ada pengiriman. Kirim kejadian uji.", "No deliveries yet. Send a test event.")}</p>
                ) : (
                  <ChartDataTable
                    caption={pick("Pengiriman webhook terbaru", "Recent webhook deliveries")}
                    columns={[{ key: "at", label: pick("Waktu", "Time") }, { key: "event", label: pick("Kejadian", "Events") }, { key: "status", label: pick("Respons", "Response"), numeric: true }, { key: "ms", label: pick("Durasi", "Duration"), numeric: true }, { key: "attempt", label: pick("Percobaan", "Attempts"), numeric: true }]}
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
        title={pick("Hapus endpoint webhook?", "Delete webhook endpoint?")}
        resourceName={deleting ? host(deleting.url) : ""}
        confirmLabel={pick("Hapus endpoint", "Delete endpoint")}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        consequences={[
          { label: "Endpoint", value: deleting?.url },
          { label: pick("Konsekuensi", "Consequence"), value: pick("Pengiriman kejadian langsung berhenti dan riwayat pengiriman dihapus.", "Events stop immediately and the delivery history is removed."), emphasis: true },
          { label: pick("Alternatif", "Alternative"), value: pick("Nonaktifkan endpoint untuk menjeda pengiriman dan menyimpan riwayatnya.", "Disable the endpoint to pause deliveries and keep its history.") },
        ]}
      />
    </Panel>
  );
}
