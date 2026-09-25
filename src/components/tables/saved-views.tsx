"use client";

import { Bookmark, Check, Plus, Trash2, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import type { SavedView } from "@/types/domain";
import { deleteView, listSavedViews, saveView } from "@/lib/api/platform";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { actorName } from "@/lib/mock/directory";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";

/** Params that describe list state; drawer selection (`id`, `event`) is not saved. */
const VIEW_PARAMS_EXCLUDE = new Set(["id", "event", "page"]);

function normalise(params: URLSearchParams) {
  const entries = [...params.entries()].filter(([k]) => !VIEW_PARAMS_EXCLUDE.has(k)).sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

/** PLAT-004: named, optionally shared list views (filters + sort) stored per workspace. */
export function SavedViewsMenu({ surface }: { surface: SavedView["surface"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { session } = useSession();
  const q = useApiQuery(["saved-views", surface], (c) => listSavedViews(c, surface));
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const current = normalise(params);
  const active = q.data?.find((v) => normalise(new URLSearchParams(v.query)) === current);

  const save = useApiMutation((c, _v: void) => saveView(c, { name, surface, query: current, shared }), {
    invalidate: [["saved-views", surface]],
    success: (v) => `View “${v.name}” saved`,
    failure: "The view was not saved.",
    onSuccess: () => setSaveOpen(false),
  });
  const remove = useApiMutation((c, id: string) => deleteView(c, id), { invalidate: [["saved-views", surface]], success: "View deleted", failure: "The view was not deleted." });

  const mine = (q.data ?? []).filter((v) => v.ownerId === session.userId);
  const team = (q.data ?? []).filter((v) => v.ownerId !== session.userId);

  const item = (v: SavedView) => (
    <DropdownMenuItem key={v.id} icon={active?.id === v.id ? <Check /> : v.shared ? <Users /> : <Bookmark />} onSelect={() => router.replace(`${pathname}?${v.query}`, { scroll: false })}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{v.name}</span>
        {v.ownerId !== session.userId && <span className="truncate text-[0.6875rem] text-fg-tertiary">Shared by {actorName(v.ownerId)}</span>}
      </span>
    </DropdownMenuItem>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" aria-label={active ? `Saved view: ${active.name}` : "Saved views"}>
            <Bookmark aria-hidden />
            <span className="hidden max-w-36 truncate sm:inline">{active ? active.name : "Views"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="end">
          {mine.length > 0 && <DropdownMenuLabel>My views</DropdownMenuLabel>}
          {mine.map(item)}
          {team.length > 0 && <DropdownMenuLabel>Shared with the workspace</DropdownMenuLabel>}
          {team.map(item)}
          {(q.data?.length ?? 0) === 0 && <p className="px-2 py-3 caption">No saved views yet. Filter the list, then save it here.</p>}
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Plus />} disabled={!current || !!active} onSelect={() => { setName(""); setShared(false); setSaveOpen(true); }}>
            Save current filters as a view
          </DropdownMenuItem>
          {active && active.ownerId === session.userId && (
            <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => remove.mutate(active.id)}>
              Delete “{active.name}”
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent
          size="sm"
          title="Save view"
          description="Saves the current search, filters and sort. Selected rows and open panels are not saved."
          footer={
            <>
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={name.trim().length < 2} loading={save.isPending} onClick={() => save.mutate()}>
                Save view
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Name" htmlFor="view-name" required>
              <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Beverages needing review" autoFocus maxLength={60} />
            </Field>
            <CheckboxField id="view-shared" label="Share with the workspace" description="Everyone in this workspace can apply it. Only you can delete it." checked={shared} onCheckedChange={setShared} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
