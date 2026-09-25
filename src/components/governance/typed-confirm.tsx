"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { ConsequenceSummary } from "./audit";

/**
 * Destructive confirmation that requires typing the resource name. Used for
 * irreversible or security-sensitive actions (revoke a key, delete an endpoint).
 */
export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  resourceName,
  consequences,
  confirmLabel,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What the user must type. */
  resourceName: string;
  consequences: { label: string; value: React.ReactNode; emphasis?: boolean }[];
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const matches = typed.trim() === resourceName;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        title={title}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!matches} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </>
        }
      >
        <ConsequenceSummary rows={consequences} />
        <Field className="mt-4" label={<>Type <span className="mono-id rounded-xs bg-muted px-1 text-fg">{resourceName}</span> to confirm</>} htmlFor="typed-confirm">
          <Input
            id="typed-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches && !loading) onConfirm();
            }}
          />
        </Field>
      </DialogContent>
    </Dialog>
  );
}
