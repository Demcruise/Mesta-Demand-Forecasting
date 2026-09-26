/**
 * Column alignment contract (TABLE-ALIGN-001 / §125–127). Header and body cells call the
 * same resolver, so a column can never be left-aligned in the header and right-aligned
 * in the rows.
 *
 *   meta.align → numeric ? right → left
 */

export type ColumnAlign = "left" | "center" | "right";

export function getColumnAlignment(meta?: { align?: ColumnAlign; numeric?: boolean }): ColumnAlign {
  if (meta?.align) return meta.align;
  if (meta?.numeric) return "right";
  return "left";
}

export const ALIGN_CLASSES: Record<ColumnAlign, string> = {
  left: "justify-start text-left",
  center: "justify-center text-center",
  right: "justify-end text-right",
};
