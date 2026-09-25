"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus, MoreHorizontal, UserPlus, Users } from "lucide-react";
import * as React from "react";
import type { Role, StatusKey } from "@/types/domain";
import { inviteMember, listMembers, updateMember, type MemberRow } from "@/lib/api/governance";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { ALL_PERMISSIONS, can as roleCan, PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { PageContainer, PageHeader, Panel } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { StatusBadge, Tag, STATUS } from "@/components/feedback/status";
import { EmptyState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { UserIdentity } from "@/components/entities/identity";
import { ConsequenceSummary } from "@/components/governance/audit";
import { pick } from "@/lib/i18n";

const ROLES: Role[] = ["viewer", "planner", "manager", "analyst", "admin"];

type Action = { kind: "role" | "suspend" | "reactivate" | "remove"; member: MemberRow } | null;

/** PAGE-USERS: users, roles and access for this workspace. */
export function UsersView() {
  const { can, session, workspace } = useSession();
  const manage = can("users.manage");
  const state = useListState({ filterKeys: ["role", "status"], defaultSort: "name", defaultDir: "asc" });
  const q = useApiQuery(["members", state.query], (c) => listMembers(c, state.query), { keepPrevious: true });
  const [action, setAction] = React.useState<Action>(null);
  const [role, setRole] = React.useState<Role>("planner");
  const [reason, setReason] = React.useState("");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Role>("viewer");

  const update = useApiMutation((c, v: { userId: string; role?: Role; status?: "active" | "suspended"; remove?: boolean; reason: string }) => updateMember(c, v.userId, v), {
    invalidate: [["members"]],
    success: (_r, v) => (v.remove ? pick("Anggota dihapus", "Member removed") : v.role ? pick(`Peran diubah ke ${ROLE_LABELS[v.role]}`, `Role changed to ${ROLE_LABELS[v.role]}`) : v.status === "suspended" ? pick("Akses ditangguhkan", "Access suspended") : pick("Akses dipulihkan", "Access restored")),
    failure: pick("Akses tidak dapat diubah.", "Access was not changed."),
    onSuccess: () => setAction(null),
  });
  const invite = useApiMutation((c, _v: void) => inviteMember(c, { email: inviteEmail, role: inviteRole }), {
    invalidate: [["members"]],
    success: `Invitation sent to ${inviteEmail}`,
    successDescription: pick("Mereka masuk lewat SSO; perannya berlaku setelah menerima undangan.", "They sign in with SSO; the role applies once they accept."),
    failure: pick("Undangan tidak terkirim.", "The invitation was not sent."),
    onSuccess: () => setInviteOpen(false),
  });

  const columns = React.useMemo<ColumnDef<MemberRow, unknown>[]>(
    () => [
      { id: "user", header: pick("Pengguna", "User"), meta: { width: "minmax(260px, 2.2fr)", sortKey: "name", pinned: true, label: pick("Pengguna", "User") } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.userId} secondary={row.original.email} size="md" /> },
      { id: "title", header: pick("Jabatan", "Title"), meta: { width: "minmax(160px, 1.2fr)", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-fg-secondary">{row.original.title}</span> },
      { id: "role", header: pick("Peran", "Role"), meta: { width: "140px", sortKey: "role" } satisfies ColumnMeta, cell: ({ row }) => <Tag tone={row.original.role === "admin" ? "primary" : "neutral"}>{ROLE_LABELS[row.original.role]}</Tag> },
      { id: "status", header: "Status", meta: { width: "120px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: "active", header: pick("Terakhir aktif", "Last active"), meta: { width: "130px", sortKey: "lastActiveAt", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{row.original.lastActiveAt ? formatRelative(row.original.lastActiveAt) : pick("Belum pernah", "Never")}</span> },
      { id: "ws", header: "Ruang kerja", meta: { width: "110px", numeric: true, hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => row.original.workspaces },
      {
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        meta: { width: "52px", pinned: true, label: "Aksi" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const m = row.original;
          if (!manage || m.userId === session.userId) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`Manage access for ${m.name}`}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => { setRole(m.role); setReason(""); setAction({ kind: "role", member: m }); }}>{pick("Ubah peran", "Change role")}</DropdownMenuItem>
                {m.status === "suspended" ? (
                  <DropdownMenuItem onSelect={() => { setReason(""); setAction({ kind: "reactivate", member: m }); }}>{pick("Pulihkan akses", "Restore access")}</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => { setReason(""); setAction({ kind: "suspend", member: m }); }}>{pick("Tangguhkan akses", "Suspend access")}</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => { setReason(""); setAction({ kind: "remove", member: m }); }}>
                  Remove from workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [manage, session.userId],
  );

  const confirmDisabled = reason.trim().length < 5 || (action?.kind === "role" && role === action.member.role);

  return (
    <PageContainer>
      <PageHeader
        title={pick("Pengguna & Akses", "Users & roles")}
        description={`Who can access ${workspace.name} · ${workspace.environment} and what they can do. Identities come from your identity provider; roles are managed here.`}
        actions={
          manage ? (
            <Button variant="primary" onClick={() => { setInviteEmail(""); setInviteRole("viewer"); setInviteOpen(true); }}>
              <UserPlus aria-hidden /> Invite user
            </Button>
          ) : undefined
        }
      />
      {!manage && <PermissionNotice permission="users.manage" compact message={pick("Anda dapat melihat siapa yang punya akses, tetapi tidak mengubahnya.", "You can see who has access but cannot change it.")} />}
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members" count={q.data?.total}>
            Members
          </TabsTrigger>
          <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="pt-4">
          <DataTable
            label="Anggota ruang kerja"
            columns={columns}
            data={q.data?.items}
            getRowId={(m) => m.userId}
            isLoading={q.isPending}
            error={q.error}
            onRetry={() => q.refetch()}
            errorWhat={pick("Anggota tidak dapat dimuat.", "Members could not be loaded.")}
            sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
            pagination={{ page: q.data?.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.total ?? 0, onPageChange: state.setPage }}
            hideDensityToggle
            toolbarStart={
              <FilterBar
                state={state}
                searchPlaceholder={pick("Cari nama, email, atau jabatan", "Search name, email or title")}
                facets={[
                  { key: "role", label: pick("Peran", "Role"), primary: true, options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
                  { key: "status", label: "Status", primary: true, options: (["active", "invited", "suspended"] as StatusKey[]).map((s) => ({ value: s, label: STATUS[s].label })) },
                ]}
              />
            }
            empty={<EmptyState icon={Users} title={pick("Tidak ada anggota yang cocok dengan filter.", "No members match the current filters.")} />}
          />
        </TabsContent>
        <TabsContent value="roles" className="pt-4">
          <InlineAlert tone="info" title={pick("Model peran yang diusulkan.", "Suggested role model.")} className="mb-4">
            Role names and permissions need approval by the business (backlog §93 items 2 and 18). Administrators cannot approve business changes or apply overrides.
          </InlineAlert>
          <Panel flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-[0.8125rem]">
                <caption className="sr-only">{pick("Izin per peran", "Permissions by role")}</caption>
                <thead className="bg-subtle">
                  <tr>
                    <th scope="col" className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold text-fg-secondary">
                      Permission
                    </th>
                    {ROLES.map((r) => (
                      <th key={r} scope="col" className="border-b border-border px-3 py-2.5 text-center text-xs font-semibold text-fg-secondary">
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_PERMISSIONS.map((p) => (
                    <tr key={p} className="border-b border-border-subtle last:border-b-0">
                      <th scope="row" className="px-4 py-2 text-left font-medium text-fg">
                        {PERMISSION_LABELS[p]}
                      </th>
                      {ROLES.map((r) => (
                        <td key={r} className="px-3 py-2 text-center">
                          {roleCan(r, p) ? <Check className="mx-auto size-4 text-success" aria-label={pick("Diizinkan", "Allowed")} /> : <Minus className="mx-auto size-4 text-fg-disabled" aria-label={pick("Tidak diizinkan", "Not allowed")} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {ROLES.map((r) => (
              <li key={r} className="rounded-lg border border-border bg-surface p-3">
                <p className="body-sm font-semibold">{ROLE_LABELS[r]}</p>
                <p className="caption">{ROLE_DESCRIPTIONS[r]}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        {action && (
          <DialogContent
            size="md"
            title={
              action.kind === "role"
                ? `Change role for ${action.member.name}`
                : action.kind === "suspend"
                  ? `Suspend ${action.member.name}?`
                  : action.kind === "reactivate"
                    ? `Restore access for ${action.member.name}?`
                    : `Remove ${action.member.name} from this workspace?`
            }
            footer={
              <>
                <Button variant="ghost" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button
                  variant={action.kind === "remove" || action.kind === "suspend" ? "danger" : "primary"}
                  disabled={confirmDisabled}
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate({
                      userId: action.member.userId,
                      reason,
                      ...(action.kind === "role" ? { role } : action.kind === "remove" ? { remove: true } : { status: action.kind === "suspend" ? "suspended" : "active" }),
                    })
                  }
                >
                  {action.kind === "role" ? pick("Ubah peran", "Change role") : action.kind === "suspend" ? pick("Tangguhkan akses", "Suspend access") : action.kind === "reactivate" ? pick("Pulihkan akses", "Restore access") : "Hapus anggota"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {action.kind === "role" && (
                <Field label={pick("Peran baru", "New role")} htmlFor="new-role" hint={ROLE_DESCRIPTIONS[role]}>
                  <Select id="new-role" value={role} onValueChange={(v) => setRole(v as Role)} options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
                </Field>
              )}
              <ConsequenceSummary
                rows={[
                  { label: "Siapa", value: `${action.member.name} (${action.member.email})` },
                  { label: "Cakupan", value: `${workspace.name} · hanya ${workspace.environment}` },
                  {
                    label: "Dampak",
                    emphasis: true,
                    value:
                      action.kind === "role"
                        ? `${ROLE_LABELS[action.member.role]} → ${ROLE_LABELS[role]}. Takes effect at their next request.`
                        : action.kind === "suspend"
                          ? pick("Mereka dikeluarkan dan tidak dapat masuk ke ruang kerja ini. Riwayatnya tetap disimpan.", "They are removed and cannot sign in to this workspace. Their history is retained.")
                          : action.kind === "reactivate"
                            ? `They can sign in again with the ${ROLE_LABELS[action.member.role]} role.`
                            : pick("Mereka kehilangan akses ke ruang kerja ini. Riwayat aktivitas tetap menyimpan tindakan mereka sebelumnya.", "They lose access to this workspace. The audit log keeps their previous actions."),
                  },
                  { label: pick("Izin yang diperlukan", "Required permission"), value: pick("Mengelola pengguna dan akses (Administrator)", "Manage users and access (Administrator)") },
                ]}
              />
              <Field label="Alasan" htmlFor="access-reason" required hint={pick("Tercatat di riwayat aktivitas. Minimal 5 karakter.", "Recorded in the audit log. At least 5 characters.")}>
                <Textarea id="access-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent
          size="sm"
          title={pick("Undang pengguna", "Invite user")}
          description={pick("Pengguna yang diundang masuk lewat SSO organisasi Anda. Tidak ada kata sandi yang dibuat.", "Invited users sign in through your organisation's SSO. No password is created.")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail.trim())} loading={invite.isPending} onClick={() => invite.mutate()}>
                Send invitation
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Email kantor" htmlFor="invite-email" required hint={pick("Harus memakai domain yang diizinkan untuk ruang kerja ini.", "Must use an allowed domain for this workspace.")}>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@mesta.click" autoFocus />
            </Field>
            <Field label="Role" htmlFor="invite-role" hint={ROLE_DESCRIPTIONS[inviteRole]}>
              <Select id="invite-role" value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)} options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
